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
import '../AppLogin.css';
import GlitchText from './ui/GlitchText.jsx';
import RotatingText from './ui/RotatingText.jsx'


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
          <div className="login-page-container">
            {/* Left Side: Logo and Tagline */}
            <div className="login-left">
              <div className="logo-row">
                <img src="/Chattrix_Logo_White_No_BG-removebg-preview.png" alt="Logo" className="login-logo" />
                <h1 className="login-title">
                  <GlitchText
                    speed={1}
                    enableShadows={true}
                    enableOnHover={true}
                    className="login-title"
                  >
                    CHATTRIX
                  </GlitchText>
                </h1>
              </div>
              <div className="login-tagline-row">
                <span className="login-tagline">The Matrix of</span>
                <RotatingText
                  texts={['Conversations', 'Connections', 'Communication']}
                  mainClassName="rotating-text-main"
                  staggerFrom={"last"}
                  initial={{ y: "100%" }}
                  animate={{ y: "0%" }}
                  exit={{ y: "-180%" }}
                  staggerDuration={0.025}
                  splitLevelClassName="rotating-text-split"
                  transition={{ type: "spring", damping: 30, stiffness: 400 }}
                  rotationInterval={2000}
                />
              </div>
            </div>
            {/* Right Side: Sign-in UI */}
            <div className="login-right">
              <div className="login-right-tagline">
                Chat with friends or jump into chatrooms — <span className="chattrix-highlight"> <GlitchText>CHATTRIX</GlitchText></span> keeps all your conversations connected.
              </div>
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
                <div className='login-container'>
                  <form onSubmit={handleEmailAuth} className="form" >
                    <div className="flex-column">
                      <label>Email </label>
                    </div>
                    <div className="inputForm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" viewBox="0 0 32 32" height="20"><g data-name="Layer 3" id="Layer_3"><path d="m30.853 13.87a15 15 0 0 0 -29.729 4.082 15.1 15.1 0 0 0 12.876 12.918 15.6 15.6 0 0 0 2.016.13 14.85 14.85 0 0 0 7.715-2.145 1 1 0 1 0 -1.031-1.711 13.007 13.007 0 1 1 5.458-6.529 2.149 2.149 0 0 1 -4.158-.759v-10.856a1 1 0 0 0 -2 0v1.726a8 8 0 1 0 .2 10.325 4.135 4.135 0 0 0 7.83.274 15.2 15.2 0 0 0 .823-7.455zm-14.853 8.13a6 6 0 1 1 6-6 6.006 6.006 0 0 1 -6 6z"></path></g></svg>
                      <input
                        id="email"
                        name="email"
                        placeholder="Enter your Email"
                        className="input"
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                      />
                    </div>
                    <div className="flex-column">
                      <label>Password </label>
                    </div>
                    <div className="inputForm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" viewBox="-64 0 512 512" height="20"><path d="m336 512h-288c-26.453125 0-48-21.523438-48-48v-224c0-26.476562 21.546875-48 48-48h288c26.453125 0 48 21.523438 48 48v224c0 26.476562-21.546875 48-48 48zm-288-288c-8.8125 0-16 7.167969-16 16v224c0 8.832031 7.1875 16 16 16h288c8.8125 0 16-7.167969 16-16v-224c0-8.832031-7.1875-16-16-16zm0 0"></path><path d="m304 224c-8.832031 0-16-7.167969-16-16v-80c0-52.929688-43.070312-96-96-96s-96 43.070312-96 96v80c0 8.832031-7.167969 16-16 16s-16-7.167969-16-16v-80c0-70.59375 57.40625-128 128-128s128 57.40625 128 128v80c0 8.832031-7.167969 16-16 16zm0 0"></path></svg>
                      <input
                        id="password"
                        name="password"
                        placeholder="Enter your Password"
                        className="input"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button className="button-submit" type="submit">{isRegister ? "Register" : "Sign In"}</button>
                  </form>
                  <p className="p">
                    {isRegister ? (
                      <>
                        Already have an account? <span className="span" onClick={() => setIsRegister(r => !r)} style={{cursor:'pointer'}} disabled={showUsernamePrompt}>Sign In</span>
                      </>
                    ) : (
                      <>
                        Don't have an account? <span className="span" onClick={() => setIsRegister(r => !r)} style={{cursor:'pointer'}} disabled={showUsernamePrompt}>Sign Up</span>
                      </>
                    )}
                  </p>
                  <p className="p line">Or Sign-in With</p>
                  <div className="flex-row">
                    <button className="btn google" type="button" onClick={handleGoogleSignIn} disabled={showUsernamePrompt}>
                      <svg xmlSpace="preserve" style={{enableBackground:'new 0 0 512 512'}} viewBox="0 0 512 512" y="0px" x="0px" xmlnsXlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg" id="Layer_1" width="20" version="1.1">
                        <path d="M113.47,309.408L95.648,375.94l-65.139,1.378C11.042,341.211,0,299.9,0,256c0-42.451,10.324-82.483,28.624-117.732h0.014l57.992,10.632l25.404,57.644c-5.317,15.501-8.215,32.141-8.215,49.456C103.821,274.792,107.225,292.797,113.47,309.408z" style={{fill:'#FBBB00'}}></path>
                        <path d="M507.527,208.176C510.467,223.662,512,239.655,512,256c0,18.328-1.927,36.206-5.598,53.451c-12.462,58.683-45.025,109.925-90.134,146.187l-0.014-0.014l-73.044-3.727l-10.338-64.535c29.932-17.554,53.324-45.025,65.646-77.911h-136.89V208.176h138.887L507.527,208.176L507.527,208.176z" style={{fill:'#518EF8'}}></path>
                        <path d="M416.253,455.624l0.014,0.014C372.396,490.901,316.666,512,256,512c-97.491,0-182.252-54.491-225.491-134.681l82.961-67.91c21.619,57.698,77.278,98.771,142.53,98.771c28.047,0,54.323-7.582,76.87-20.818L416.253,455.624z" style={{fill:'#28B446'}}></path>
                        <path d="M419.404,58.936l-82.933,67.896c-23.335-14.586-50.919-23.012-80.471-23.012c-66.729,0-123.429,42.957-143.965,102.724l-83.397-68.276h-0.014C71.23,56.123,157.06,0,256,0C318.115,0,375.068,22.126,419.404,58.936z" style={{fill:'#F14336'}}></path>
                      </svg>
                      Google
                    </button>
                  </div>
                  {error && <p className="error">{error}</p>}
                  <p className='warning'>Don't hover on CHATTRIX it's Glitchy </p>
                </div>
              )}
            </div>
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


