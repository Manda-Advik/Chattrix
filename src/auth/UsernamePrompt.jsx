import React from 'react';

export default function UsernamePrompt({ username, setUsername, usernameError, handleSetUsername, loading, onBack }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'rgba(255,255,255,0.9)', padding: 32, borderRadius: 16, boxShadow: '0 4px 24px #0001', minWidth: 320 }}>
        <form onSubmit={handleSetUsername} style={{ marginBottom: 20 }}>
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
            style={{ marginRight: 10 }}
          />
          {usernameError && <span style={{ color: 'red' }}>{usernameError}</span>}
          <button type="submit" disabled={loading}>Set Username</button>
        </form>
        <button onClick={onBack} style={{ marginBottom: 20 }} disabled={loading}>
          Back to Email/Password
        </button>
      </div>
    </div>
  );
}
