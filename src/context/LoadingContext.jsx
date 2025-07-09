import { createContext, useContext, useState } from 'react';

export const LoadingContext = createContext();

export function LoadingProvider({ children }) {
  const [loading, setLoading] = useState(true);
  return (
    <LoadingContext.Provider value={{ loading, setLoading }}>
      {children}
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  return useContext(LoadingContext);
}
