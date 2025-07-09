import { useState, useEffect } from 'react'
import { auth, db } from '../firebase'
import { signInWithPopup, GoogleAuthProvider, signOut, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { collection, query, where, getDocs, setDoc, doc } from 'firebase/firestore'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import Home from './Home'
import ChatRoom from './ChatRoom'
import JoinedChatRooms from './JoinedChatRooms.jsx';
import DirectChat from './DirectChat';
import { useLoading, LoadingProvider } from '../context/LoadingContext.jsx'
import Loading from './Loading';
import UsernamePrompt from '../auth/UsernamePrompt';


function App() {
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const { loading, setLoading } = useLoading();
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
      if (firebaseUser) {
        // Always prompt for username if user doc is missing, regardless of displayName (even if it's a UID)
        const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", firebaseUser.uid)));
        if (userDoc.empty) {
          setShowUsernamePrompt(true);
          setUsername("");
        } else {
          setShowUsernamePrompt(false);
          setUsername(userDoc.docs[0].data().username || "");
        }
      } else {
        setShowUsernamePrompt(false);
        setUsername("");
      }
    });
    return () => unsubscribe();
  }, [setLoading])

  useEffect(() => {
    if (!isRegister) setUsername("");
  }, [isRegister]);

  // Unified handler for post-auth logic
  const handlePostAuth = async (firebaseUser) => {
    setUser(firebaseUser);
    setLoading(false);
    if (firebaseUser) {
      // Always prompt for username if user doc is missing, regardless of displayName (even if it's a UID)
      const userDoc = await getDocs(query(collection(db, "users"), where("uid", "==", firebaseUser.uid)));
      if (userDoc.empty) {
        setShowUsernamePrompt(true);
        setUsername("");
      } else {
        setShowUsernamePrompt(false);
        setUsername(userDoc.docs[0].data().username || "");
      }
    } else {
      setShowUsernamePrompt(false);
      setUsername("");
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setUsernameError("");
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      await handlePostAuth(result.user);
      setError("");
    } catch (error) {
      setError('Google sign in failed');
    }
  };

  const isUsernameUnique = async (uname) => {
    const q = query(collection(db, "users"), where("username", "==", uname));
    const querySnapshot = await getDocs(q);
    return querySnapshot.empty;
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setError("");
    setUsernameError("");
    try {
      let result;
      if (isRegister) {
        // Register user with email and password
        result = await createUserWithEmailAndPassword(auth, email, password);
        setUser(result.user);
        setShowUsernamePrompt(true);
        return;
      } else {
        result = await signInWithEmailAndPassword(auth, email, password);
        await handlePostAuth(result.user);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Unified handler for setting username after registration or Google sign-in
  const handleSetUsername = async (e) => {
    e.preventDefault();
    setUsernameError("");
    if (!username.trim()) {
      setUsernameError("Username is required");
      return;
    }
    const unique = await isUsernameUnique(username.trim());
    if (!unique) {
      setUsernameError("Username already taken");
      return;
    }
    try {
      await updateProfile(auth.currentUser, { displayName: username });
      await setDoc(doc(db, "users", username.trim()), {
        username: username.trim(),
        email: auth.currentUser.email,
        uid: auth.currentUser.uid
      });
      setShowUsernamePrompt(false);
      setUsername(username.trim()); // Set username after successful registration
      navigate('/home');
    } catch (err) {
      setUsernameError("Failed to set username");
    }
  };

  const handleSignOut = async () => {
    await signOut(auth)
    setUser(null)
  }

  if (loading) {
    return <Loading />;
  }

  return (
    <Routes>
      <Route path="/login" element={
        (!user || showUsernamePrompt) ? (
          <div style={{ textAlign: 'center', marginTop: 50 }} >
            <h1>Chattrix</h1>
            {showUsernamePrompt ? (
              <UsernamePrompt
                username={username}
                setUsername={setUsername}
                usernameError={usernameError}
                handleSetUsername={handleSetUsername}
                loading={loading}
                onBack={async () => {
                  setLoading(true);
                  setShowUsernamePrompt(false);
                  setUsername("");
                  await signOut(auth);
                  setUser(null);
                  setLoading(false);
                  navigate("/login");
                }}
              />
            ) : (
              <>
                <div className='login-container'>
                <form onSubmit={handleEmailAuth} style={{ marginBottom: 20 }}>
                  <input
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    style={{ marginRight: 10 }}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    style={{ marginRight: 10 }}
                  />
                  <button type="submit">{isRegister ? "Register" : "Sign In"}</button>
                </form>
                <button onClick={() => setIsRegister(r => !r)} style={{ marginBottom: 20 }} disabled={showUsernamePrompt}>
                  {isRegister ? "Already have an account? Sign In" : "Don't have an account? Register"}
                </button>
                <div style={{ margin: '20px 0' }}>or</div>
                <button onClick={handleGoogleSignIn} disabled={showUsernamePrompt}>Sign In with Google</button>
                {error && <p style={{ color: 'red' }}>{error}</p>}
                </div>
              </>
            )}
          </div>
        ) : <Navigate to="/home" />
      } />
      <Route path="/home" element={user && !showUsernamePrompt ? <Home user={user} username={username} onSignOut={handleSignOut} /> : <Navigate to="/login" />} />
      <Route path="/chatroom/:roomId" element={user && !showUsernamePrompt ? <ChatRoom user={user} username={username} /> : <Navigate to="/login" />} />
      <Route path="/joined" element={user && !showUsernamePrompt ? <JoinedChatRooms username={username} /> : <Navigate to="/login" />} />
      <Route path="/direct/:friendUsername" element={user && !showUsernamePrompt ? <DirectChat username={username} /> : <Navigate to="/login" />} />
      <Route path="*" element={<Navigate to={user && !showUsernamePrompt ? "/home" : "/login"} />} />
    </Routes>
  )
}

export default function AppWithRouter() {
  return (
    <LoadingProvider>
      <Router>
        <App />
      </Router>
    </LoadingProvider>
  )
}


