
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from 'react';
import { useToast } from './use-toast';

declare global {
  interface Window {
    gapi: any;
    google: any;
  }
}

interface UserProfile {
  email: string;
  name: string;
  givenName: string;
  imageUrl: string;
}

interface GoogleDriveContextValue {
  isApiLoaded: boolean;
  isSignedIn: boolean;
  userProfile: UserProfile | null;
  signIn: () => void;
  signOut: () => void;
  saveFileToDrive: (fileName: string, content: string) => void;
}

const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(
  undefined
);

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';

const SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  const [tokenClient, setTokenClient] = useState<any>(null);

  /** 🧩 Load GAPI, GIS, Picker scripts properly */
  useEffect(() => {
    const loadScript = (src: string) => {
      return new Promise<void>((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) return resolve();
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load ${src}`));
        document.body.appendChild(script);
      });
    };

    const initialize = async () => {
      try {
        await loadScript('https://accounts.google.com/gsi/client');
        await loadScript('https://apis.google.com/js/api.js');

        // Wait until window.gapi actually exists
        await new Promise<void>((resolve, reject) => {
          const checkGapi = () => {
            if (window.gapi && window.gapi.load) resolve();
            else setTimeout(checkGapi, 50);
          };
          checkGapi();
        });

        // Now safely load and init the gapi client
        await new Promise<void>((resolve) => {
          window.gapi.load('client', async () => {
            await window.gapi.client.init({
              apiKey: API_KEY,
              discoveryDocs: [DISCOVERY_DOC],
            });
            resolve();
          });
        });

        // Setup token client
        const client = window.google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: () => {}, // will set dynamically
        });
        setTokenClient(client);
        setIsApiLoaded(true);
      } catch (err) {
        console.error('Google API load failed', err);
        toast({
          title: 'Error',
          description: 'Failed to initialize Google Drive API.',
          variant: 'destructive',
        });
      }
    };

    initialize();
  }, [toast]);

  /** 👤 Fetch user profile info */
  const updateUserProfile = useCallback(async () => {
    try {
      await window.gapi.client.load('oauth2', 'v2');
      const response = await window.gapi.client.oauth2.userinfo.get();
      const profile = response.result;
      if (profile) {
        setUserProfile({
          email: profile.email,
          name: profile.name,
          givenName: profile.given_name,
          imageUrl: profile.picture,
        });
        setIsSignedIn(true);
      } else {
        throw new Error('No profile found');
      }
    } catch (error) {
      console.error('Profile fetch failed', error);
      setIsSignedIn(false);
      setUserProfile(null);
      toast({
        title: 'Error',
        description: 'Could not retrieve your Google profile.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  /** 🔐 Sign-in with Google */
  const signIn = useCallback(() => {
    if (!CLIENT_ID) {
      toast({
        title: 'Configuration Error',
        description: 'Google Client ID missing.',
        variant: 'destructive',
      });
      return;
    }

    if (!tokenClient) {
      toast({
        title: 'API Not Ready',
        description: 'Please wait a moment and try again.',
        variant: 'destructive',
      });
      return;
    }

    tokenClient.callback = async (tokenResponse: any) => {
      if (tokenResponse && tokenResponse.access_token) {
        window.gapi.client.setToken(tokenResponse);
        await updateUserProfile();
      }
    };

    tokenClient.requestAccessToken({ prompt: 'consent' });
  }, [tokenClient, updateUserProfile, toast]);

  /** 🚪 Sign-out */
  const signOut = useCallback(() => {
    const token = window.gapi.client.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        window.gapi.client.setToken('');
        setIsSignedIn(false);
        setUserProfile(null);
        toast({
          title: 'Signed Out',
          description: 'You have successfully signed out.',
        });
      });
    }
  }, [toast]);

  /** 💾 Save file to Drive (with Picker for folder selection) */
  const saveFileToDrive = useCallback(
    async (fileName: string, content: string) => {
      if (!isSignedIn) {
        toast({
          title: 'Not Signed In',
          description: 'Please connect to Google Drive first.',
          variant: 'destructive',
        });
        return;
      }

      const loadPicker = () => {
        const view = new window.google.picker.View(
          window.google.picker.ViewId.DOCS
        );
        view.setMimeTypes('application/vnd.google-apps.folder');

        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(window.gapi.client.getToken().access_token)
          .setDeveloperKey(API_KEY)
          .setCallback(async (data: any) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const folderId = data.docs[0].id;
              await createFileInFolder(folderId, fileName, content);
            }
          })
          .build();

        picker.setVisible(true);
      };

      if (window.google && window.google.picker) {
        loadPicker();
      } else {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => window.gapi.load('picker', loadPicker);
        document.body.appendChild(script);
      }
    },
    [isSignedIn, toast]
  );

  /** 📄 Create file inside selected folder */
  const createFileInFolder = async (
    folderId: string,
    fileName: string,
    content: string
  ) => {
    try {
      const metadata = {
        name: fileName,
        parents: [folderId],
        mimeType: 'text/plain',
      };

      const file = new Blob([content], { type: 'text/plain' });
      const form = new FormData();
      form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
      form.append('file', file);

      const res = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
        {
          method: 'POST',
          headers: new Headers({
            Authorization: 'Bearer ' + window.gapi.client.getToken().access_token,
          }),
          body: form,
        }
      );

      if (res.ok) {
        toast({
          title: 'File Saved',
          description: `${fileName} uploaded to Google Drive.`,
        });
      } else {
        const err = await res.json();
        toast({
          title: 'Error Saving File',
          description: err.error.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Drive upload error:', error);
      toast({
        title: 'Error',
        description: 'Failed to save file to Google Drive.',
        variant: 'destructive',
      });
    }
  };

  const value: GoogleDriveContextValue = {
    isApiLoaded,
    isSignedIn,
    userProfile,
    signIn,
    signOut,
    saveFileToDrive,
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
