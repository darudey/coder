
'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useToast } from './use-toast';
import { useGoogleScripts } from './use-google-scripts';

declare global {
  interface Window {
    google: typeof google;
    gapi: any;
  }
}

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
  loading: boolean;
}

const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(undefined);

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file';

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const { scriptsLoaded, scriptLoadError } = useGoogleScripts();
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // 1. Initialize GAPI client and GIS token client
  useEffect(() => {
    if (!scriptsLoaded || scriptLoadError) {
      if(scriptLoadError) {
        toast({ title: "Script Error", description: "Failed to load Google API scripts.", variant: "destructive" });
        setLoading(false);
      }
      return;
    }

    // Load GAPI client
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          apiKey: API_KEY,
          discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
        });
        setIsGapiLoaded(true);
      } catch (error: any) {
        console.error('Error initializing gapi client', error);
        toast({ title: 'Initialization Error', description: `Failed to initialize Google API. ${error?.details || ''}`, variant: 'destructive' });
      }
    });

    // Initialize GIS client
    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            window.gapi.client.setToken(tokenResponse);
            setIsSignedIn(true);
            fetchUserProfile();
          }
        },
      });
      setTokenClient(client);
    } catch (error) {
      console.error('Error initializing google accounts client', error);
       toast({ title: 'Initialization Error', description: "Failed to initialize Google sign-in.", variant: 'destructive' });
    }

  }, [scriptsLoaded, scriptLoadError, toast]);
  
  useEffect(() => {
    if (isGapiLoaded && tokenClient) {
      setLoading(false);
    }
  }, [isGapiLoaded, tokenClient])

  const fetchUserProfile = useCallback(async () => {
    try {
      const response = await window.gapi.client.oauth2.userinfo.get();
      const profile = response.result;
      setUserProfile({
        name: profile.name || null,
        givenName: profile.given_name || null,
        email: profile.email || null,
        imageUrl: profile.picture || null,
      });
    } catch (error) {
      console.error('Error fetching user profile', error);
    }
  }, []);

  const signIn = useCallback(() => {
    if (!tokenClient) {
      toast({ title: 'Not Ready', description: 'Google Sign-In is not ready yet.', variant: 'destructive' });
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      try {
        tokenClient.requestAccessToken();
        resolve();
      } catch(e) {
        reject(e);
      }
    });
  }, [tokenClient, toast]);

  const signOut = useCallback(() => {
    const token = window.gapi.client.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        window.gapi.client.setToken(null);
        setIsSignedIn(false);
        setUserProfile(null);
        toast({ title: 'Signed Out', description: 'You have been signed out from Google Drive.' });
      });
    }
    return Promise.resolve();
  }, [toast]);
  
  const saveFileToDrive = useCallback(async (fileName: string, content: string) => {
    if (!isSignedIn) {
      toast({ title: 'Not Signed In', description: 'Please sign in with Google to save to Drive.', variant: 'destructive' });
      return;
    }
    
    try {
        const fileMetadata = {
            name: fileName,
            mimeType: 'text/plain',
        };
        const boundary = '-------' + Math.random().toString(36).substring(2);
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const multipartRequestBody =
            delimiter +
            'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
            JSON.stringify(fileMetadata) +
            delimiter +
            'Content-Type: text/plain; charset=UTF-8\r\n\r\n' +
            content +
            close_delim;

        const request = window.gapi.client.request({
            path: '/upload/drive/v3/files',
            method: 'POST',
            params: { uploadType: 'multipart' },
            headers: { 'Content-Type': 'multipart/related; boundary=' + boundary },
            body: multipartRequestBody,
        });

        await request;
        toast({ title: 'File Saved', description: `${fileName} was saved to your Google Drive.` });

    } catch (error: any) {
        console.error("Error saving to Drive:", error);
        toast({ title: 'Error', description: error?.result?.error?.message || 'Could not save file to Google Drive.', variant: 'destructive' });
    }
  }, [isSignedIn, toast]);

  const value = {
    isSignedIn,
    userProfile,
    signIn,
    signOut,
    saveFileToDrive,
    loading,
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
