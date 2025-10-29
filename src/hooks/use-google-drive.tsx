
'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useToast } from './use-toast';
import { useAuth } from './use-auth';
import { getAuth, getIdToken } from 'firebase/auth';
import { app } from '@/lib/firebase';

interface UserProfile {
  email: string | null;
  name: string | null;
  givenName: string | null;
  imageUrl: string | null;
}

interface GoogleDriveContextValue {
  isSignedIn: boolean;
  userProfile: UserProfile | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  saveFileToDrive: (fileName: string, content: string) => Promise<void>;
}

const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(undefined);

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const { user, signInWithGoogle, signOut: firebaseSignOut } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  
  const isGoogleSignIn = user?.providerData.some(p => p.providerId === 'google.com');
  const isSignedIn = !!user && isGoogleSignIn;

  useEffect(() => {
    if (isSignedIn) {
      setUserProfile({
        email: user.email,
        name: user.displayName,
        givenName: user.displayName?.split(' ')[0] || null,
        imageUrl: user.photoURL,
      });
    } else {
      setUserProfile(null);
    }
  }, [user, isSignedIn]);

  const signIn = async () => {
    await signInWithGoogle();
  };

  const signOut = async () => {
    await firebaseSignOut();
    toast({ title: 'Signed Out', description: 'You have been signed out from Google Drive connection.' });
  };
  
  const saveFileToDrive = async (fileName: string, content: string) => {
    if (!isSignedIn) {
      toast({ title: 'Not Signed In', description: 'Please sign in with Google to save to Drive.', variant: 'destructive' });
      return;
    }
    
    const auth = getAuth(app);
    if (!auth.currentUser) {
        toast({ title: 'Authentication Error', description: 'User not found. Please sign in again.', variant: 'destructive' });
        return;
    }

    try {
        const idToken = await getIdToken(auth.currentUser);
        
        const response = await fetch('/api/drive/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
            body: JSON.stringify({ fileName, content }),
        });

        const result = await response.json();

        if (response.ok) {
            toast({ title: 'File Saved', description: `${fileName} was saved to your Google Drive.` });
        } else {
             toast({ title: 'Save Failed', description: result.error || 'An unknown error occurred.', variant: 'destructive' });
        }

    } catch (error) {
        console.error("Error saving to Drive:", error);
        toast({ title: 'Error', description: 'Could not save file to Google Drive.', variant: 'destructive' });
    }
  };

  const value = {
    isSignedIn,
    userProfile,
    signIn,
    signOut,
    saveFileToDrive,
  };

  return <GoogleDriveContext.Provider value={value}>{children}</GoogleDriveContext.Provider>;
}

export function useGoogleDrive() {
  const context = useContext(GoogleDriveContext);
  if (context === undefined) {
    throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  }
  return context;
}
