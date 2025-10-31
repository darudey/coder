
'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useToast } from './use-toast';

interface UserProfile {
  email: string;
  name: string;
  given_name: string;
  picture: string;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  iconLink: string;
}

interface GoogleDriveContextValue {
  isSignedIn: boolean;
  userProfile: UserProfile | null;
  driveFiles: DriveFile[];
  signOut: () => void;
  loading: boolean;
  saveFileToDrive: (fileName: string, content: string) => Promise<void>;
}

const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(undefined);

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSessionStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        if (data.isAuthenticated) {
          setIsSignedIn(true);
          setUserProfile(data.profile);
          // Fetch files after confirming session
          const filesRes = await fetch('/api/drive/files');
          if (filesRes.ok) {
            const files = await filesRes.json();
            setDriveFiles(files);
          } else {
             const error = await filesRes.json();
             if (error.error.includes('Session expired')) {
                signOut(); // Token is bad, sign out
             }
          }
        } else {
          setIsSignedIn(false);
          setUserProfile(null);
          setDriveFiles([]);
        }
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessionStatus();
  }, [fetchSessionStatus]);

  const signOut = useCallback(async () => {
    try {
        await fetch('/api/auth/signout');
        setIsSignedIn(false);
        setUserProfile(null);
        setDriveFiles([]);
        toast({ title: 'Signed Out', description: 'You have been signed out from Google.' });
    } catch (error) {
        console.error("Error signing out:", error);
        toast({ title: 'Error', description: 'Failed to sign out.', variant: 'destructive' });
    }
  }, [toast]);
  
  const saveFileToDrive = useCallback(async (fileName: string, content: string) => {
     // This will be implemented in a future step.
     toast({ title: 'Coming Soon', description: 'Saving files to Google Drive will be implemented soon.'});
  }, [toast]);

  const value = {
    isSignedIn,
    userProfile,
    driveFiles,
    signOut,
    loading,
    saveFileToDrive
  };

  return (
    <GoogleDriveContext.Provider value={value}>
        {children}
    </GoogleDriveContext.Provider>
  );
}

export function useGoogleDrive() {
  const context = useContext(GoogleDriveContext);
  if (context === undefined) {
    throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  }
  return context;
}
