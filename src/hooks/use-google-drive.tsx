
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
  signIn: () => void;
  signOut: () => void;
  saveFileToDrive: (fileName: string, content: string) => Promise<void>;
  loading: boolean;
}

const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(undefined);

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const { scriptsLoaded, scriptLoadError } = useGoogleScripts();
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchUserProfile = useCallback(async () => {
    try {
      // Use the gapi client to get user info.
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
    if (!scriptsLoaded) {
      if (scriptLoadError) {
        toast({ title: "Script Error", description: "Failed to load Google API scripts.", variant: "destructive" });
        setLoading(false);
      }
      return;
    }

    // 1. GAPI has loaded, now initialize the GAPI client.
    const initializeGapiClient = async () => {
      try {
        await window.gapi.client.init({ apiKey: API_KEY });
        
        // 2. Client is initialized, now load the required APIs sequentially.
        await window.gapi.client.load('drive', 'v3');
        await window.gapi.client.load('oauth2', 'v2');
        
        // 3. All APIs are loaded, the API is ready.
        setIsApiLoaded(true);

      } catch (error: any) {
        const errorDetails = error?.result?.error?.message || error?.details || JSON.stringify(error);
        console.error('Error initializing GAPI client or loading APIs:', error);
        toast({ title: "Initialization Error", description: `Could not initialize Google API client. Details: ${errorDetails}`, variant: "destructive"});
      }
    };
    
    window.gapi.load('client', initializeGapiClient);

  }, [scriptsLoaded, scriptLoadError, toast]);
  
   // Initialize the Google Identity Services (GIS) token client once the GAPI is ready.
   useEffect(() => {
    if (!isApiLoaded) return;

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
          if (tokenResponse && tokenResponse.access_token) {
            window.gapi.client.setToken(tokenResponse);
            fetchUserProfile(); // Fetch profile and set signed-in state
          }
        },
      });
      setTokenClient(client);
    } catch (error) {
      console.error('Error initializing google accounts client', error);
      toast({ title: 'Sign-In Init Error', description: "Failed to initialize Google sign-in.", variant: 'destructive' });
    }
   }, [isApiLoaded, toast, fetchUserProfile]);


  // Update the main loading state.
  useEffect(() => {
    if (isApiLoaded && tokenClient) {
      setLoading(false);
    }
  }, [isApiLoaded, tokenClient]);

  const signIn = useCallback(() => {
    if (loading || !tokenClient) {
      toast({ title: 'Not Ready', description: 'Google Sign-In is not ready yet.', variant: 'destructive' });
      return;
    }
    // Prompt the user to select a Google Account and ask for consent to share their data.
    tokenClient.requestAccessToken();
  }, [tokenClient, loading, toast]);

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
  }, [toast]);

  const saveFileToDrive = useCallback(async (fileName: string, content: string) => {
    if (!isSignedIn) {
      toast({ title: 'Not Signed In', description: 'Please sign in with Google to save to Drive.', variant: 'destructive' });
      return;
    }
    if (!isApiLoaded) {
      toast({ title: 'API Not Ready', description: 'The Google Drive API is not yet available.', variant: 'destructive' });
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
  }, [isSignedIn, isApiLoaded, toast]);

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
