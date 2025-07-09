import { useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, doc, getDoc, onSnapshot, query, orderBy, serverTimestamp, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import Loading from './Loading';
import ChatMessages from './ChatMessages';

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
    setSending(true);
  };

  const handleCancelScheduled = async (id) => {
    setScheduledMessages(prev => {
      const msg = prev.find(m => m.id === id);
      if (msg && msg.timeoutId) clearTimeout(msg.timeoutId);
      return prev.filter(m => m.id !== id);
    });
    await deleteDoc(doc(db, 'users', username, 'scheduledRoomMessages', id));
  };

  // Add image message handler
  const handleSendImage = async (imageUrl) => {
    if (!username) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'chatrooms', roomId, 'messages'), {
        senderUsername: username,
        type: 'image',
        imageUrl,
        timestamp: serverTimestamp(),
      });
      if (inputRef.current) inputRef.current.focus();
    } catch {}
    setSending(false);
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
  if (error) return <div style={{ textAlign: 'center', marginTop: 50, color: 'red' }}>{error}</div>;

  return (
    <div style={{ textAlign: 'center', marginTop: 50, maxWidth: 600, marginLeft: 'auto', marginRight: 'auto' }}>
      <h1>Chat Room</h1>
      <p>Room ID: {roomId}</p>
      <p>Room Name: {roomName}</p>
      <p>Created by: {createdBy}</p>
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
        onSendImage={handleSendImage}
      >
        <h4 style={{ margin: 0, marginBottom: 8 }}>Members</h4>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {members.map(member => (
            <li key={member} style={{ marginBottom: 6 }}>{member}</li>
          ))}
        </ul>
      </ChatMessages>
      {scheduledMessages.length > 0 && (
        <div style={{ marginTop: 16, textAlign: 'left' }}>
          <h4>Scheduled Messages</h4>
          <ul style={{ paddingLeft: 20 }}>
            {scheduledMessages.map((m, i) => (
              <li key={m.id} style={{ marginBottom: 6, display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#1976d2', fontWeight: 500 }}>{m.text}</span>
                <span style={{ marginLeft: 8, color: '#888', fontSize: 13 }}>
                  (Scheduled for {new Date(m.scheduledDate).toLocaleString()})
                </span>
                <button style={{ marginLeft: 12, fontSize: 12 }} onClick={() => handleCancelScheduled(m.id)}>Cancel</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default ChatRoom;
