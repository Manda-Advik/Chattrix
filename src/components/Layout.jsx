import React from 'react';
export default function Layout({ children }) {
  // Layout now just renders children directly, no container
  return (
    <>
      {children}
    </>
  );
}
