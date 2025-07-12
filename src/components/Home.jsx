import { useEffect, useState } from 'react'
import { db } from '../firebase'
import { collection, setDoc, doc, getDoc, query, where, getDocs, runTransaction, onSnapshot } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom';
import '../home.css';

function generateRoomId() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function getUniqueRoomId() {
  let roomId, exists = true, tries = 0;
  while (exists && tries < 10) {
    roomId = generateRoomId();
    const docRef = doc(db, "chatrooms", roomId);
    const docSnap = await getDoc(docRef);
    exists = docSnap.exists();
    tries++;
  }
  if (exists) throw new Error("Could not generate unique room ID. Please try again.");
  return roomId;
}

function Home({ user, onSignOut, username }) {
  const [roomName, setRoomName] = useState("")
  const [roomPassword, setRoomPassword] = useState("")
  const [createError, setCreateError] = useState("")
  const [successMsg, setSuccessMsg] = useState("")
  const [showCreate, setShowCreate] = useState(false)
  const [joinRoomId, setJoinRoomId] = useState("")
  const [joinRoomPassword, setJoinRoomPassword] = useState("")
  const [joinError, setJoinError] = useState("")
  const [friendUsername, setFriendUsername] = useState("");
  const [friendMsg, setFriendMsg] = useState("");
  const [joinedRooms, setJoinedRooms] = useState([]);
  const [joinedLoading, setJoinedLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchJoined() {
      setJoinedLoading(true);
      if (!username) {
        setJoinedRooms([]);
        setJoinedLoading(false);
        return;
      }
      try {
        const q = collection(db, 'users', username, 'chatroomsJoined');
        const snap = await getDocs(q);
        setJoinedRooms(snap.docs.map(doc => doc.data()));
      } catch {
        setJoinedRooms([]);
      }
      setJoinedLoading(false);
    }
    fetchJoined();
  }, [username]);

  const handleCreateRoom = async () => {
    setCreateError("");
    setSuccessMsg("");
    if (!roomName.trim()) {
      setCreateError("Room name is required");
      return;
    }
    if (!roomPassword.trim()) {
      setCreateError("Room password is required");
      return;
    }
    if (/^\d/.test(roomName.trim())) {
      setCreateError("Room name must not start with a number");
      return;
    }
    const sanitizedRoomName = roomName.trim().toLowerCase();
    let roomId;
    try {
      await runTransaction(db, async (transaction) => {
        const nameRef = doc(db, 'chatroomNames', sanitizedRoomName);
        const nameSnap = await transaction.get(nameRef);
        if (nameSnap.exists()) {
          throw new Error('Room name already exists. Please choose another name.');
        }
        // Reserve the name
        transaction.set(nameRef, { roomId: null });
        roomId = await getUniqueRoomId();
        const roomRef = doc(db, "chatrooms", roomId);
        transaction.set(roomRef, {
          name: roomName,
          password: roomPassword,
          createdBy: { username },
          createdAt: new Date(),
          roomId: roomId
        });
        // Link name to roomId
        transaction.set(nameRef, { roomId });
        // Add to user's chatroomsCreated subcollection
        const createdRef = doc(db, 'users', username, 'chatroomsCreated', roomId);
        transaction.set(createdRef, {
          roomId,
          name: roomName,
          createdAt: new Date(),
        });
        // Add to user's chatroomsJoined subcollection
        const joinedRef = doc(db, 'users', username, 'chatroomsJoined', roomId);
        transaction.set(joinedRef, { roomId, name: roomName, joinedAt: new Date() });
        // Add user to chatroom's members subcollection
        const memberRef = doc(db, 'chatrooms', roomId, 'members', username);
        transaction.set(memberRef, { username, joinedAt: new Date() });
      });
      setSuccessMsg(`Room created! ID: ${roomId}`)
      setRoomName("")
      setRoomPassword("")
      navigate(`/chatroom/${roomId}`);
    } catch (err) {
      setCreateError(err.message || "Failed to create room")
    }
  }

  // Send a friend request
  const handleSendFriendRequest = async (e) => {
    e.preventDefault();
    setFriendMsg("");
    if (!friendUsername.trim()) {
      setFriendMsg("Enter a username");
      return;
    }
    if (friendUsername.trim() === username) {
      setFriendMsg("You cannot add yourself as a friend.");
      return;
    }
    try {
      // Check if user exists
      const userSnap = await getDoc(doc(db, 'users', friendUsername.trim()));
      if (!userSnap.exists()) {
        setFriendMsg("User does not exist.");
        return;
      }
      // Check if already friends
      const alreadyFriend = await getDoc(doc(db, 'users', username, 'friends', friendUsername.trim()));
      if (alreadyFriend.exists()) {
        setFriendMsg("Already friends.");
        return;
      }
      // Send friend request to the other user
      await setDoc(doc(db, 'users', friendUsername.trim(), 'friendRequests', username), {
        from: username,
        sentAt: new Date()
      });
      setToastMsg("Friend request sent!");
      setFriendMsg("");
      setFriendUsername("");
    } catch (err) {
      setFriendMsg("Failed to send friend request");
    }
  };

  return (
      <div className="home-page-container">
        <button className="home-signout-btn" onClick={onSignOut}>Sign Out</button>
        <div className="home-title-section">
          <h1 className="home-header" style={{textAlign: 'center', paddingLeft: 0}}>Welcome to Chattrix!</h1>
          <div className="home-welcome" style={{textAlign: 'center', paddingLeft: 0}}>Hello, {username}</div>
        </div>
        <div className="home-content-scroll">
          {/* Left: Chat Rooms */}
          <div className="home-left">
            <div className="chatroom-section">
              {/* Split forms into two halves (now only join form remains) */}
              <div className="home-forms-row">
                <div className="home-join-form">
                  <form
                    className="home-form-row"
                    onSubmit={async e => {
                      e.preventDefault();
                      setJoinError("");
                      let roomIdToJoin = joinRoomId.trim();
                      let roomDocSnap = null;
                      if (/^\d{6}$/.test(roomIdToJoin)) {
                        // Input is a 6-digit room ID
                        const roomRef = doc(db, "chatrooms", roomIdToJoin);
                        roomDocSnap = await getDoc(roomRef);
                      } else {
                        // Input is a room name, look up the room
                        const q = query(collection(db, "chatrooms"), where("name", "==", roomIdToJoin));
                        const querySnapshot = await getDocs(q);
                        if (!querySnapshot.empty) {
                          roomDocSnap = querySnapshot.docs[0];
                          roomIdToJoin = roomDocSnap.id;
                        }
                      }
                      if (!roomDocSnap || !roomDocSnap.exists()) {
                        setJoinError("Room not found.");
                        return;
                      }
                      const data = roomDocSnap.data();
                      if (data.password !== joinRoomPassword) {
                        setJoinError("Incorrect password.");
                        return;
                      }
                      // Add to user's chatroomsJoined subcollection
                      await setDoc(
                        doc(db, 'users', username, 'chatroomsJoined', roomIdToJoin),
                        { roomId: roomIdToJoin, name: data.name, joinedAt: new Date() }
                      );
                      // Add user to chatroom's members subcollection
                      await setDoc(
                        doc(db, 'chatrooms', roomIdToJoin, 'members', username),
                        { username, joinedAt: new Date() }
                      );
                      navigate(`/chatroom/${roomIdToJoin}`);
                    }}
                  >
                    <input
                      type="text"
                      className="home-input"
                      placeholder="Enter Room Name or 6-digit ID"
                      value={joinRoomId || ''}
                      onChange={e => setJoinRoomId(e.target.value)}
                      required
                    />
                    <input
                      type="password"
                      className="home-password"
                      placeholder="Room password"
                      value={joinRoomPassword}
                      onChange={e => setJoinRoomPassword(e.target.value)}
                      required
                    />
                    <button className="home-btn home-btn-primary" type="submit">Join Chat Room</button>
                  </form>
                  {joinError && <div className="home-error">{joinError}</div>}
                </div>
              </div>
              {/* Joined Chat Rooms and Create Room button beside title */}
              <div className="home-card">
                <div className="home-joined-header-row">
                  <h2>{showCreate ? 'Create a Chat Room' : 'Joined Chat Rooms'}</h2>
                  <button className="home-btn home-btn-primary" style={{marginLeft: 'auto'}} onClick={() => setShowCreate(v => !v)}>
                    {showCreate ? 'Back to Joined Rooms' : 'Create a Chat Room'}
                  </button>
                </div>
                {showCreate ? (
                  <>
                    <div className="home-form-row">
                      <input
                        type="text"
                        className="home-input"
                        placeholder="Enter room name"
                        value={roomName}
                        onChange={e => setRoomName(e.target.value)}
                      />
                      <input
                        type="password"
                        className="home-password"
                        placeholder="Set room password"
                        value={roomPassword}
                        onChange={e => setRoomPassword(e.target.value)}
                      />
                      <button className="home-btn home-btn-primary" onClick={handleCreateRoom}>Create</button>
                      <button className="home-btn home-btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                    </div>
                    {createError && <div className="home-error">{createError}</div>}
                    {successMsg && <div className="home-success">{successMsg}</div>}
                  </>
                ) : (
                  joinedLoading ? (
                    <p>Loading...</p>
                  ) : joinedRooms.length === 0 ? (
                    <p>No joined chat rooms found.</p>
                  ) : (
                    <ul className="home-list">
                      {joinedRooms.map(room => (
                        <li key={room.roomId}>
                          <span>{room.name} (ID: {room.roomId})</span>
                          <button className="home-btn home-btn-secondary" onClick={() => navigate(`/chatroom/${room.roomId}`)}>
                            Open
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </div>
          </div>
          {/* Right: Friends */}
          <div className="home-right">
            <div className="friend-section">
              <div className="home-card">
                <h3>Add a Friend</h3>
                <form className="home-form-row" onSubmit={handleSendFriendRequest}>
                  <input
                    type="text"
                    className="home-input"
                    placeholder="Friend's username"
                    value={friendUsername}
                    onChange={e => setFriendUsername(e.target.value)}
                  />
                  <button className="home-btn home-btn-primary" type="submit">Send Friend Request</button>
                </form>
                {friendMsg && <div className="home-error">{friendMsg}</div>}
                {/* Friend Requests List */}
                <FriendRequests username={username} setToastMsg={setToastMsg} />
                {/* Friends List */}
                <FriendsList username={username} />
              </div>
            </div>
          </div>
        </div>
        <Toast message={toastMsg} onClose={() => setToastMsg("")} />
      </div>
  );
}

// FriendRequests component
function FriendRequests({ username, setToastMsg }) {
  const [requests, setRequests] = useState([]);
  useEffect(() => {
    async function fetchRequests() {
      if (!username) return setRequests([]);
      const q = collection(db, 'users', username, 'friendRequests');
      const snap = await getDocs(q);
      // Only include requests that have a 'from' field (filter out empty docs)
      setRequests(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })).filter(r => r.from));
    }
    fetchRequests();
  }, [username]);

  const handleAccept = async (fromUser) => {
    try {
      // Add each other as friends
      await setDoc(doc(db, 'users', username, 'friends', fromUser), {
        username: fromUser,
        addedAt: new Date()
      });
      await setDoc(doc(db, 'users', fromUser, 'friends', username), {
        username,
        addedAt: new Date()
      });
      // Remove the friend request
      await setDoc(doc(db, 'users', username, 'friendRequests', fromUser), {}, { merge: false });
      setRequests(requests.filter(r => r.id !== fromUser));
      setToastMsg(`You are now friends with ${fromUser}`);
    } catch {
      setToastMsg('Failed to accept friend request');
    }
  };

  const handleReject = async (fromUser) => {
    try {
      // Remove the friend request
      await setDoc(doc(db, 'users', username, 'friendRequests', fromUser), {}, { merge: false });
      setRequests(requests.filter(r => r.id !== fromUser));
      setToastMsg(`Friend request from ${fromUser} rejected`);
    } catch {
      setToastMsg('Failed to reject friend request');
    }
  };

  if (!requests || requests.length === 0) return null;
  return (
    <div style={{ marginTop: 20, width: '100%' }}>
      <h4>Friend Requests</h4>
      <ul className="home-list">
        {requests.map(req => (
          <li key={req.id}>
            <span>{req.from}</span>
            <button className="home-btn home-btn-primary" style={{ marginLeft: 10 }} onClick={() => handleAccept(req.from)}>Accept</button>
            <button className="home-btn home-btn-secondary" style={{ marginLeft: 10 }} onClick={() => handleReject(req.from)}>Reject</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// FriendsList component
function FriendsList({ username }) {
  const [friends, setFriends] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    if (!username) return setFriends([]);
    const q = collection(db, 'users', username, 'friends');
    const unsubscribe = onSnapshot(q, (snap) => {
      setFriends(snap.docs.map(doc => doc.id));
    });
    return () => unsubscribe();
  }, [username]);

  if (friends.length === 0) return null;
  return (
    <div style={{ marginTop: 20, width: '100%' }}>
      <h4>Your Friends</h4>
      <ul className="home-list">
        {friends.map(friend => (
          <li key={friend}>
            <span>{friend}</span>
            <button className="home-btn home-btn-primary" style={{ marginLeft: 10 }} onClick={() => navigate(`/direct/${friend}`)}>
              Message
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Toast notification
function Toast({ message, onClose }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  return (
    <div className="home-toast">
      {message}
    </div>
  );
}

export default Home;
