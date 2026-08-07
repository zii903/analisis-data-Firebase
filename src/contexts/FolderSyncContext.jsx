import { createContext, useContext } from 'react';
import { useFolderSync } from '../hooks/useFolderSync';

const FolderSyncContext = createContext();

export function FolderSyncProvider({ children }) {
  const syncState = useFolderSync();

  return (
    <FolderSyncContext.Provider value={syncState}>
      {children}
    </FolderSyncContext.Provider>
  );
}

export function useFolderSyncContext() {
  return useContext(FolderSyncContext);
}
