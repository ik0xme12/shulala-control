import { createContext, useContext } from 'react';

export const SyncContext = createContext(false);

export const useSyncReady = () => useContext(SyncContext);
