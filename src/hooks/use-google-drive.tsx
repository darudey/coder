
'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useToast } from './use-toast';

declare global {
  interface Window {
    google: any;
    gapi: any;
    onGoogleScriptsLoad: () => void;
  }
}

interface UserProfile {
  email: string | null;
  name: string | null;
  givenName: string | null;
  imageUrl: string | null;
}

interface GoogleDriveContextValue {
  isGapiLoaded: boolean;
  isGisLoaded: boolean;
  tokenClient: any;
  isSignedIn: boolean;
  userProfile: UserProfile | null;
  signIn: () => void;
  signOut: () => void;
  saveFileToDrive: (fileName: string, content: string) => Promise<void>;
  scriptLoadCallback: () => void;
}

const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(undefined);

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isGisLoaded, setIsGisLoaded] = useState(false);
  const [scriptLoadCount, setScriptLoadCount] = useState(0);

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  
  const allScriptsLoaded = scriptLoadCount >= 2;

  const scriptLoadCallback = useCallback(() => {
    setScriptLoadCount(prev => prev + 1);
  }, []);

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
      setIsSignedIn(true);
    } catch (error) {
      console.error('Error fetching user profile', error);
      toast({ title: "Profile Error", description: "Could not fetch your Google profile.", variant: "destructive"});
    }
  }, [toast]);
  
  useEffect(() => {
    if (!allScriptsLoaded) return;
    
    const gapi = window.gapi;
    const google = window.google;

    if (!gapi || !google) {
        console.error("GAPI or Google script not loaded yet");
        return;
    }

    const initializeGapiClient = () => {
        gapi.load('client', async () => {
            try {
                await gapi.client.init({ apiKey: API_KEY });
                await Promise.all([
                    gapi.client.load('drive', 'v3'),
                    gapi.client.load('oauth2', 'v2'),
                ]);
                setIsGapiLoaded(true);
            } catch(error: any) {
               const errorDetails = error?.result?.error?.message || 'Could not initialize Google API client.';
               console.error('Error initializing GAPI client:', error);
               toast({ title: "Initialization Error", description: errorDetails, variant: "destructive"});
            }
        });
    }
    
    initializeGapiClient();

    try {
      const client = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse && tokenResponse.access_token) {
              gapi.client.setToken(tokenResponse);
              fetchUserProfile();
            }
          },
      });
      setTokenClient(client);
      setIsGisLoaded(true);
    } catch (error) {
      console.error('Error initializing GIS client:', error);
      toast({ title: "Initialization Error", description: "Could not initialize Google Sign-In.", variant: "destructive"});
    }

  }, [allScriptsLoaded, fetchUserProfile, toast]);


  const signIn = useCallback(() => {
    if (!tokenClient) {
      toast({ title: 'Not Ready', description: 'Google Sign-In is not ready yet. Please wait a moment.', variant: 'destructive' });
      return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }, [tokenClient, toast]);

  const signOut = useCallback(() => {
    const token = window.gapi?.client?.getToken();
    if (token) {
      window.google?.accounts?.oauth2.revoke(token.access_token, () => {
        if (window.gapi?.client) {
          window.gapi.client.setToken(null);
        }
        setIsSignedIn(false);
        setUserProfile(null);
        toast({ title: 'Signed Out', description: 'You have been signed out from Google Drive.' });
      });
    }
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
        const errorDetails = error?.result?.error?.message || 'Could not save file to Google Drive.';
        console.error("Error saving to Drive:", error);
        toast({ title: 'Error', description: errorDetails, variant: 'destructive' });
    }
  }, [isSignedIn, toast]);

  const value = {
    isGapiLoaded,
    isGisLoaded,
    tokenClient,
    isSignedIn,
    userProfile,
    signIn,
    signOut,
    saveFileToDrive,
    scriptLoadCallback,
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
