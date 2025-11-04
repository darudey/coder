'use client';
import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useToast } from './use-toast';

declare global {
    var gapi: any;
    var google: any;
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

const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(undefined);

const CLIENT_ID = '1095073746611-dklrdrkmq1km4kv2kddpocc2qi90fpbg.apps.googleusercontent.com';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isGisLoaded, setIsGisLoaded] = useState(false);

  const updateUserProfile = useCallback(async () => {
    try {
      if (!gapi.client.oauth2) {
          await gapi.client.load('oauth2', 'v2');
      }
      const response = await gapi.client.oauth2.userinfo.get();
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
         throw new Error("Failed to retrieve user profile.");
      }
    } catch(e) {
      console.error("Could not fetch user profile", e);
      // Don't toast here as it might be an expected failure on signout
    }
  }, []);

  useEffect(() => {
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      gapi.load('client', async () => {
        await gapi.client.init({ apiKey: API_KEY, discoveryDocs: [DISCOVERY_DOC] });
        setIsGapiLoaded(true);
      });
    };
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: (tokenResponse: any) => {
              if (tokenResponse && tokenResponse.access_token) {
                gapi.client.setToken(tokenResponse);
                setIsSignedIn(true);
                updateUserProfile();
              } else {
                 console.error("Access token error", tokenResponse);
                 toast({ title: 'Sign-In Error', description: 'Could not get access token from Google.', variant: 'destructive' });
              }
            },
        });
        setTokenClient(client);
        setIsGisLoaded(true);
    };
    document.body.appendChild(gisScript);

    return () => {
        const gapiScriptInDom = document.querySelector('script[src="https://apis.google.com/js/api.js"]');
        if (gapiScriptInDom) document.body.removeChild(gapiScriptInDom);

        const gisScriptInDom = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
        if (gisScriptInDom) document.body.removeChild(gisScriptInDom);
    }

  }, [toast, updateUserProfile]);

  useEffect(() => {
      if(isGapiLoaded && isGisLoaded){
          setIsApiLoaded(true);
      }
  }, [isGapiLoaded, isGisLoaded])


  const signIn = useCallback(() => {
    if (CLIENT_ID.startsWith('YOUR_GOOGLE_CLIENT_ID')) {
        toast({ title: "Google Drive Not Configured", description: "Please add your Google Client ID.", variant: 'destructive' });
        return;
    }
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
        toast({ title: "Google API not ready", description: "Please wait a moment and try again.", variant: 'destructive' });
    }
  }, [tokenClient, toast]);

  const signOut = useCallback(() => {
    const token = gapi.client.getToken();
    if (token !== null) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken('');
        setIsSignedIn(false);
        setUserProfile(null);
        toast({ title: 'Signed Out', description: 'You have successfully signed out from Google Drive.' });
      });
    }
  }, [toast]);

  const saveFileToDrive = useCallback((fileName: string, content: string) => {
    if (!isSignedIn) {
      toast({ title: 'Not signed in', description: 'Please connect to Google Drive first.', variant: 'destructive' });
      return;
    }

    const showPicker = () => {
        const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
            .setSelectFolderEnabled(true)
            .setMimeTypes("application/vnd.google-apps.folder");

        const picker = new google.picker.PickerBuilder()
            .addView(view)
            .setOAuthToken(gapi.client.getToken().access_token)
            .setDeveloperKey(API_KEY)
            .setCallback((data: any) => {
                if (data.action === google.picker.Action.PICKED) {
                    const folderId = data.docs[0].id;
                    createFileInFolder(folderId, fileName, content);
                }
            })
            .build();
        picker.setVisible(true);
    };
    
    gapi.load('picker', showPicker);

  }, [isSignedIn, toast]);

  const createFileInFolder = async (folderId: string, fileName: string, content: string) => {
    try {
        const fileMetadata = {
            name: fileName,
            parents: [folderId],
            mimeType: 'application/javascript',
        };
        const file = new Blob([content], { type: 'application/javascript' });

        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }));
        form.append('file', file);
        
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.client.getToken().access_token }),
            body: form,
        });

        if (response.ok) {
            toast({ title: 'File Saved', description: `${fileName} was saved to your Google Drive.` });
        } else {
            const error = await response.json();
            toast({ title: 'Save Failed', description: error.error.message, variant: 'destructive' });
        }
    } catch (error) {
        console.error("Error saving to Drive:", error);
        toast({ title: 'Error', description: "Could not save file to Google Drive.", variant: 'destructive' });
    }
  };


  const value = {
    isApiLoaded,
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
