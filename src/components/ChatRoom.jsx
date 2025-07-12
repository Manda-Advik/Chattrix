import { useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import Loading from './Loading';
import ChatMessages from './ChatMessages';
import Layout from './Layout';
import '../chatroom.css';

function ChatRoom({ user, username }) {
  const { roomId } = useParams();
  const [roomName, setRoomName] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState([]);
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    async function fetchRoom() {
      try {
        const docRef = doc(db, 'chatrooms', roomId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setRoomName(data.name);
          setCreatedBy(data.createdBy?.username || "Unknown");
        } else {
          setError('Room not found');
        }
      } catch (err) {
        setError('Error fetching room');
      } finally {
        setLoading(false);
      }
    }
    fetchRoom();
  }, [roomId]);

  // Real-time messages
  useEffect(() => {
    const msgsQuery = query(
      collection(db, 'chatrooms', roomId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(msgsQuery, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [roomId]);

  // Fetch members
  useEffect(() => {
    const membersRef = collection(db, 'chatrooms', roomId, 'members');
    const unsubscribe = onSnapshot(membersRef, (snap) => {
      setMembers(snap.docs.map(doc => doc.id));
    });
    return () => unsubscribe();
  }, [roomId]);

  // Load scheduled messages from Firestore on mount
  useEffect(() => {
    if (!username || !roomId) return;
    const scheduledRef = collection(db, 'users', username, 'scheduledRoomMessages');
    let unsub = () => {};
    (async () => {
      const snap = await getDocs(scheduledRef);
      const now = Date.now();
      const msgs = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.roomId === roomId && data.scheduledDate > now) {
          msgs.push({
            id: docSnap.id,
            text: data.text,
            scheduledDate: data.scheduledDate,
            roomId: data.roomId,
            timeoutId: null,
          });
        }
      });
      setScheduledMessages(msgs);
      // Set timers for each
      msgs.forEach(m => {
        const delay = m.scheduledDate - now;
        if (delay > 0) {
          const timeoutId = setTimeout(() => handleSendScheduled(m), delay);
          setScheduledMessages(prev => prev.map(msg => msg.id === m.id ? { ...msg, timeoutId } : msg));
        }
      });
    })();
    return () => {
      scheduledMessages.forEach(m => m.timeoutId && clearTimeout(m.timeoutId));
      unsub();
    };
    // eslint-disable-next-line
  }, [username, roomId]);

  // Helper to send scheduled message and remove from Firestore
  const handleSendScheduled = async (m) => {
    try {
      await addDoc(collection(db, 'chatrooms', roomId, 'messages'), {
        senderUsername: username,
        text: m.text.trim(),
        timestamp: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'users', username, 'scheduledRoomMessages', m.id));
      setScheduledMessages(prev => prev.filter(msg => msg.id !== m.id));
      if (inputRef.current) inputRef.current.focus();
    } catch {}
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !username) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'chatrooms', roomId, 'messages'), {
        senderUsername: username,
        text: newMsg.trim(),
        timestamp: serverTimestamp(),
      });
      setNewMsg("");
      if (inputRef.current) inputRef.current.focus();
    } catch {}
    setSending(false);
  };

  // Scheduled send logic
  const handleScheduleSend = async (msg, scheduledDate) => {
    const id = Math.random().toString(36).slice(2) + Date.now();
    const docRef = doc(db, 'users', username, 'scheduledRoomMessages', id);
    await setDoc(docRef, {
      text: msg,
      scheduledDate: scheduledDate.getTime(),
      roomId,
    });
    const delay = scheduledDate.getTime() - Date.now();
    const timeoutId = setTimeout(() => handleSendScheduled({ id, text: msg, scheduledDate: scheduledDate.getTime(), roomId }), delay);
    setScheduledMessages(prev => [...prev, { id, text: msg, scheduledDate: scheduledDate.getTime(), roomId, timeoutId }]);
  };

  const handleCancelScheduled = async (id) => {
    setScheduledMessages(prev => {
      const msg = prev.find(m => m.id === id);
      if (msg && msg.timeoutId) clearTimeout(msg.timeoutId);
      return prev.filter(m => m.id !== id);
    });
    await deleteDoc(doc(db, 'users', username, 'scheduledRoomMessages', id));
  };

  // Focus input on Enter key if not focused
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Enter' && document.activeElement !== inputRef.current) {
        if (inputRef.current) inputRef.current.focus();
      }
    };
    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  if (loading) return <Loading />;
  if (error) return <div className="chatroom-error">{error}</div>;

  return (
    <Layout>
      <div className="chatroom-container">
        <h1 style={{ color: '#111', background: 'none', WebkitBackgroundClip: 'initial', WebkitTextFillColor: 'initial' }}>
          Room: {roomName}
        </h1>
        <div style={{ color: '#555', fontSize: '1rem', marginBottom: 8 }}>
          Room ID: <span style={{ fontFamily: 'monospace', color: '#222' }}>{roomId}</span>
        </div>
        <p className="chatroom-created-by">Created by: {createdBy}</p>
        <ChatMessages
          messages={messages}
          onSend={handleSend}
          sending={sending}
          username={username}
          inputRef={inputRef}
          newMsg={newMsg}
          setNewMsg={setNewMsg}
          messagesEndRef={messagesEndRef}
          placeholder="Type your message..."
          onScheduleSend={handleScheduleSend}
        >
          <h4 className="members-title">Members</h4>
          <ul className="members-list">
            {members.map(member => (
              <li
                key={member}
                className="member-item"
              >
                {member}
              </li>
            ))}
          </ul>
        </ChatMessages>
        {scheduledMessages.length > 0 && (
          <div className="scheduled-messages-container">
            <h4>Scheduled Messages</h4>
            <ul className="scheduled-messages-list">
              {scheduledMessages.map((m, i) => (
                <li key={m.id} className="scheduled-message-item">
                  <span className="scheduled-message-text">{m.text}</span>
                  <div className="scheduled-message-footer">
                    <span className="scheduled-message-time">
                      (Scheduled for {new Date(m.scheduledDate).toLocaleString()})
                    </span>
                    <button className="scheduled-message-cancel" onClick={() => handleCancelScheduled(m.id)}>Cancel</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default ChatRoom;
