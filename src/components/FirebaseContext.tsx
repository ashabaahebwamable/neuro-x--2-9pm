import { createContext, useContext } from 'react';
import { User } from 'firebase/auth';

export interface FirebaseContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  isAuthReady: boolean;
}

export const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  profile: null,
  loading: true,
  isAuthReady: false,
});

export const useFirebase = () => useContext(FirebaseContext);
