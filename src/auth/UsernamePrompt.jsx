import React from 'react';

export default function UsernamePrompt({ username, setUsername, usernameError, handleSetUsername, loading, onBack }) {
  return (
    <>
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
    </>
  );
}
