import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import Loading from './Loading';
import Layout from './Layout';

function JoinedChatRooms({ username }) {
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchJoined() {
      setLoading(true);
      if (!username) {
        setJoinedRooms([]);
        setLoading(false);
        return;
      }
      try {
        const q = collection(db, 'users', username, 'chatroomsJoined');
        const snap = await getDocs(q);
        setJoinedRooms(snap.docs.map(doc => doc.data()));
      } catch {
        setJoinedRooms([]);
      }
      setLoading(false);
    }
    fetchJoined();
  }, [username]);

  if (loading) return <Loading />;

  return (
    <Layout>
      <div style={{ textAlign: 'center', marginTop: 50 }}>
        <h2>Joined Chat Rooms</h2>
        {joinedRooms.length === 0 ? (
          <p>No joined chat rooms found.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {joinedRooms.map(room => (
              <li key={room.roomId} style={{ marginBottom: 12 }}>
                <button onClick={() => navigate(`/chatroom/${room.roomId}`)}>
                  {room.name} (ID: {room.roomId})
                </button>
              </li>
            ))}
          </ul>
        )}
        <button onClick={() => navigate('/')}>Back to Home</button>
      </div>
    </Layout>
  );
}

export default JoinedChatRooms;
