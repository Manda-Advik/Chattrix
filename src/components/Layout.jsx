import React from 'react';

// A simple layout wrapper for consistent dark theme
export default function Layout({ children }) {
  return (
    <div className="app-container">
      {children}
    </div>
  );
}
