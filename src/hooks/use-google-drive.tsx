
'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { useToast } from './use-toast';

// ---- GLOBAL DECLARATIONS ----
declare global {
  interface Window {
    gapi: any;
    google: any;
  }
  var gapi: any;
  var google: any;
}

// ---- TYPES ----
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

// ---- CONFIG ----
const CLIENT_ID =
  '1095073746611-dklrdrkmq1km4kv2kddpocc2qi90fpbg.apps.googleusercontent.com';

const SCOPES =
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest',
];

// ---- CONTEXT ----
const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(
  undefined
);

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);

  // ---- FETCH USER PROFILE ----
  const updateUserProfile = useCallback(async () => {
    try {
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
        throw new Error('Failed to retrieve user profile.');
      }
    } catch (e) {
      console.error('Could not fetch user profile', e);
      // Don't toast here as it may be part of a normal sign-out flow
    }
  }, []);

  // ---- INITIALIZE GAPI + GIS ----
  useEffect(() => {
    let gapiScript: HTMLScriptElement | null = null;
    let gisScript: HTMLScriptElement | null = null;

    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve();
          return;
        }
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = (err) => reject(new Error(`Failed to load ${src}: ${err}`));
        document.body.appendChild(script);
        
        if (src.includes('api.js')) gapiScript = script;
        if (src.includes('gsi/client')) gisScript = script;
      });
    }

    const initializeApis = async () => {
      try {
        await Promise.all([
          loadScript('https://apis.google.com/js/api.js'),
          loadScript('https://accounts.google.com/gsi/client')
        ]);

        // GAPI is loaded, now initialize the client and picker.
        await new Promise<void>((resolve, reject) => {
          gapi.load('client:picker', {
            callback: async () => {
              try {
                await gapi.client.init({
                  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
                  clientId: CLIENT_ID,
                  discoveryDocs: DISCOVERY_DOCS,
                  scope: SCOPES,
                });
                resolve();
              } catch(err) {
                reject(err);
              }
            },
            onerror: reject,
          });
        });

        // GIS is loaded, initialize the token client.
        const client = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse?.access_token) {
              gapi.client.setToken(tokenResponse);
              updateUserProfile();
            } else {
              toast({
                title: 'Sign-In Error',
                description: 'Failed to get access token.',
                variant: 'destructive',
              });
            }
          },
        });
        setTokenClient(client);
        
        setIsApiLoaded(true);

      } catch (err) {
        console.error("🚨 Failed to initialize Google APIs", err);
        toast({
            title: 'API Error',
            description: 'Could not load Google services. Please refresh the page.',
            variant: 'destructive'
        });
      }
    };

    initializeApis();

    return () => {
      if (gapiScript) document.body.removeChild(gapiScript);
      if (gisScript) document.body.removeChild(gisScript);
    };
  }, [toast, updateUserProfile]);


  // ---- SIGN IN ----
  const signIn = useCallback(() => {
    if (!tokenClient) {
      toast({
        title: 'Google API Not Ready',
        description: 'Please wait a moment and try again.',
        variant: 'destructive',
      });
      return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }, [tokenClient, toast]);

  // ---- SIGN OUT ----
  const signOut = useCallback(() => {
    const token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken(null);
        setIsSignedIn(false);
        setUserProfile(null);
        toast({
          title: 'Signed Out',
          description: 'You have successfully signed out from Google Drive.',
        });
      });
    }
  }, [toast]);

  // ---- SAVE FILE ----
  const saveFileToDrive = useCallback(
    (fileName: string, content: string) => {
      if (!isApiLoaded || !isSignedIn) {
        toast({
          title: 'Not Ready',
          description: 'Please sign in to Google Drive first.',
          variant: 'destructive',
        });
        return;
      }
      
      const createFileInFolder = async (
        folderId: string,
        fileName: string,
        content: string
      ) => {
        try {
          const metadata = {
            name: fileName,
            parents: [folderId],
            mimeType: 'application/javascript',
          };

          const boundary = 'foo_bar_baz';
          const delimiter = `\r\n--${boundary}\r\n`;
          const closeDelim = `\r\n--${boundary}--`;

          const body =
            delimiter +
            'Content-Type: application/json\r\n\r\n' +
            JSON.stringify(metadata) +
            delimiter +
            'Content-Type: application/javascript\r\n\r\n' +
            content +
            closeDelim;

          const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${gapi.client.getToken().access_token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
              },
              body,
            }
          );

          const result = await response.json();
          if (response.ok) {
            toast({
              title: 'File Saved',
              description: `${fileName} was saved to your Google Drive.`,
            });
          } else {
            throw new Error(result.error?.message || 'Unknown error during file upload.');
          }
        } catch (error: any) {
          console.error('Error saving to Drive:', error);
          toast({
            title: 'Error Saving File',
            description: error.message || 'Could not save file to Google Drive.',
            variant: 'destructive',
          });
        }
      };

      const view = new google.picker.View(google.picker.ViewId.DOCS);
      view.setMimeTypes('application/vnd.google-apps.folder');

      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(gapi.client.getToken().access_token)
        .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '')
        .setCallback((data: any) => {
          if (data.action === google.picker.Action.PICKED) {
            const folderId = data.docs[0].id;
            createFileInFolder(folderId, fileName, content);
          }
        })
        .build();

      picker.setVisible(true);
    },
    [isApiLoaded, isSignedIn, toast]
  );

  // ---- CONTEXT VALUE ----
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

// ---- HOOK ----
export function useGoogleDrive() {
  const context = useContext(GoogleDriveContext);
  if (!context)
    throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  return context;
}
