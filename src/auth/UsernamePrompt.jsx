import React from 'react';

export default function UsernamePrompt({ username, setUsername, usernameError, handleSetUsername, loading, onBack }) {
  return (
    <div className="username-prompt-outer">
      <div className="username-prompt-inner">
        <h2 style={{marginBottom: 8, fontWeight: 700, fontSize: '1.6rem', color: '#151717'}}>Set a Username</h2>
        <p style={{marginBottom: 18, color: '#444', fontSize: '1.05rem'}}>Set a username to your account to continue.</p>
        <form onSubmit={handleSetUsername} className="username-prompt-form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          {usernameError && <span className="username-prompt-error">{usernameError}</span>}
          <button type="submit" disabled={loading}>Set Username</button>
        </form>
        <button onClick={onBack} disabled={loading} className="username-prompt-back">
          Back to Email/Password
        </button>
      </div>
    </div>
  );
}
