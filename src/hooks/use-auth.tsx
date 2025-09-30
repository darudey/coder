
'use client';

import { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut as firebaseSignOut, 
    type User,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInAnonymously as firebaseSignInAnonymously
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { app, db } from '@/lib/firebase';
import { useToast } from './use-toast';

type Role = 'student' | 'teacher' | 'developer';

interface AuthContextValue {
  user: User | null;
  userRole: Role | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  registerWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInAnonymously: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const auth = getAuth(app);

  const manageUserDocument = useCallback(async (user: User) => {
    const userDocRef = doc(db, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
        // This is a new user, create their document with a default role.
        await setDoc(userDocRef, { role: 'student', email: user.email || 'anonymous', displayName: user.displayName || 'Guest' });
        return 'student';
    }
    return userDoc.data().role as Role;
  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        const role = await manageUserDocument(firebaseUser);
        setUser(firebaseUser);
        setUserRole(role);
      } else {
        setUser(null);
        setUserRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [auth, manageUserDocument]);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      // onAuthStateChanged will handle user document creation
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      toast({ title: 'Sign-in Error', description: error.message, variant: 'destructive' });
    }
  }, [auth, toast]);

  const registerWithEmail = useCallback(async (email: string, password: string) => {
    try {
        await createUserWithEmailAndPassword(auth, email, password);
         // onAuthStateChanged will handle user document creation
    } catch (error: any) {
        console.error("Error registering with email:", error);
        toast({ title: 'Registration Error', description: error.message, variant: 'destructive' });
    }
  }, [auth, toast]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // onAuthStateChanged will handle user document creation
    } catch (error: any) {
        console.error("Error signing in with email:", error);
        toast({ title: 'Sign-in Error', description: error.message, variant: 'destructive' });
    }
  }, [auth, toast]);

  const signInAnonymously = useCallback(async () => {
    try {
        await firebaseSignInAnonymously(auth);
        // onAuthStateChanged will handle user document creation
    } catch (error: any) {
        console.error("Error signing in anonymously:", error);
        toast({ title: 'Sign-in Error', description: error.message, variant: 'destructive' });
    }
  }, [auth, toast]);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      console.error("Error signing out:", error);
      toast({ title: 'Sign-out Error', description: error.message, variant: 'destructive' });
    }
  }, [auth, toast]);
  
  const value = useMemo(() => ({
    user,
    userRole,
    loading,
    signInWithGoogle,
    signOut,
    registerWithEmail,
    signInWithEmail,
    signInAnonymously
  }), [user, userRole, loading, signInWithGoogle, signOut, registerWithEmail, signInWithEmail, signInAnonymously]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
