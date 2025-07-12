import { useParams } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, getDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import Loading from './Loading';
import ChatMessages from './ChatMessages';
import Layout from './Layout';

function getDirectChatId(username1, username2) {
  // Always order alphabetically for unique chat id
  return [username1, username2].sort().join('_');
}

function DirectChat({ username }) {
  const { friendUsername } = useParams();
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [friendExists, setFriendExists] = useState(true);
  const [scheduledMessages, setScheduledMessages] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const chatId = getDirectChatId(username, friendUsername);

  useEffect(() => {
    async function checkFriend() {
      if (!username || !friendUsername) return;
      // Check if friend exists in user's friends
      const friendDoc = await getDoc(doc(db, 'users', username, 'friends', friendUsername));
      setFriendExists(friendDoc.exists());
      setLoading(false);
    }
    checkFriend();
  }, [username, friendUsername]);

  useEffect(() => {
    if (!friendExists) return;
    const msgsQuery = query(
      collection(db, 'directChats', chatId, 'messages'),
      orderBy('timestamp', 'asc')
    );
    const unsubscribe = onSnapshot(msgsQuery, (snap) => {
      setMessages(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [chatId, friendExists]);

  // Load scheduled messages from Firestore on mount
  useEffect(() => {
    if (!username || !friendUsername) return;
    const scheduledRef = collection(db, 'users', username, 'scheduledDirectMessages');
    let unsub = () => {};
    (async () => {
      const snap = await getDocs(scheduledRef);
      const now = Date.now();
      const msgs = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.friendUsername === friendUsername && data.scheduledDate > now) {
          msgs.push({
            id: docSnap.id,
            text: data.text,
            scheduledDate: data.scheduledDate,
            friendUsername: data.friendUsername,
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
  }, [username, friendUsername]);

  // Helper to send scheduled message and remove from Firestore
  const handleSendScheduled = async (m) => {
    try {
      await addDoc(collection(db, 'directChats', chatId, 'messages'), {
        senderUsername: username,
        recipientUsername: friendUsername,
        text: m.text.trim(),
        timestamp: serverTimestamp(),
      });
      await setDoc(doc(db, 'directChats', chatId), {
        users: [username, friendUsername],
        lastMessage: m.text.trim(),
        lastTimestamp: serverTimestamp(),
      }, { merge: true });
      await deleteDoc(doc(db, 'users', username, 'scheduledDirectMessages', m.id));
      setScheduledMessages(prev => prev.filter(msg => msg.id !== m.id));
      if (inputRef.current) inputRef.current.focus();
    } catch {}
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMsg.trim() || !username || !friendUsername) return;
    setSending(true);
    try {
      await addDoc(collection(db, 'directChats', chatId, 'messages'), {
        senderUsername: username,
        recipientUsername: friendUsername,
        text: newMsg.trim(),
        timestamp: serverTimestamp(),
      });
      // Optionally, update a 'lastMessage' field for chat list previews
      await setDoc(doc(db, 'directChats', chatId), {
        users: [username, friendUsername],
        lastMessage: newMsg.trim(),
        lastTimestamp: serverTimestamp(),
      }, { merge: true });
      setNewMsg("");
      if (inputRef.current) inputRef.current.focus();
    } catch {}
    setSending(false);
  };

  // Scheduled send logic
  const handleScheduleSend = async (msg, scheduledDate) => {
    const id = Math.random().toString(36).slice(2) + Date.now();
    const docRef = doc(db, 'users', username, 'scheduledDirectMessages', id);
    await setDoc(docRef, {
      text: msg,
      scheduledDate: scheduledDate.getTime(),
      friendUsername,
    });
    const delay = scheduledDate.getTime() - Date.now();
    const timeoutId = setTimeout(() => handleSendScheduled({ id, text: msg, scheduledDate: scheduledDate.getTime(), friendUsername }), delay);
    setScheduledMessages(prev => [...prev, { id, text: msg, scheduledDate: scheduledDate.getTime(), friendUsername, timeoutId }]);
  };

  const handleCancelScheduled = async (id) => {
    setScheduledMessages(prev => {
      const msg = prev.find(m => m.id === id);
      if (msg && msg.timeoutId) clearTimeout(msg.timeoutId);
      return prev.filter(m => m.id !== id);
    });
    await deleteDoc(doc(db, 'users', username, 'scheduledDirectMessages', id));
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
  if (!friendExists) return <Layout><div style={{ textAlign: 'center', marginTop: 50, color: 'red' }}>You are not friends with {friendUsername}.</div></Layout>;

  return (
    <Layout>
      <div style={{ textAlign: 'center', marginTop: 50 }}>
        <h1>Direct Chat with {friendUsername}</h1>
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
        />
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

export default DirectChat;
