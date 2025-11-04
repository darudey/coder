
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
  'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.metadata.readonly https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

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
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isGisLoaded, setIsGisLoaded] = useState(false);

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
    }
  }, []);

  // ---- INITIALIZE GAPI + GIS ----
  useEffect(() => {
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = async () => {
      gapi.load('client', async () => {
        await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS });
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
          if (tokenResponse?.access_token) {
            gapi.client.setToken(tokenResponse);
            setIsSignedIn(true);
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
      setIsGisLoaded(true);
    };
    document.body.appendChild(gisScript);

    const pickerScript = document.createElement('script');
    pickerScript.src = 'https://apis.google.com/js/api.picker.js';
    pickerScript.async = true;
    pickerScript.defer = true;
    pickerScript.onload = () => {
      console.log('Google Picker API loaded');
    };
    document.body.appendChild(pickerScript);


    return () => {
      [gapiScript, gisScript, pickerScript].forEach((s) =>
        document.body.removeChild(s)
      );
    };
  }, [toast, updateUserProfile]);

  // ---- WHEN BOTH APIS ARE READY ----
  useEffect(() => {
    if (isGapiLoaded && isGisLoaded) setIsApiLoaded(true);
  }, [isGapiLoaded, isGisLoaded]);

  // ---- SIGN IN ----
  const signIn = useCallback(() => {
    if (CLIENT_ID.startsWith('YOUR_GOOGLE_CLIENT_ID')) {
      toast({
        title: 'Google Drive Not Configured',
        description: 'Please add your Google Client ID.',
        variant: 'destructive',
      });
      return;
    }
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      toast({
        title: 'Google API Not Ready',
        description: 'Please wait a moment and try again.',
        variant: 'destructive',
      });
    }
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
      if (!isSignedIn) {
        toast({
          title: 'Not Signed In',
          description: 'Please connect to Google Drive first.',
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
            toast({
              title: 'Save Failed',
              description: result.error?.message || 'Unknown error.',
              variant: 'destructive',
            });
          }
        } catch (error) {
          console.error('Error saving to Drive:', error);
          toast({
            title: 'Error',
            description: 'Could not save file to Google Drive.',
            variant: 'destructive',
          });
        }
      };

      // ---- Show Picker ----
      const showPicker = () => {
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
      };

      if (window.google && google.picker && google.picker.PickerBuilder) {
        showPicker();
      } else {
        console.warn('Picker not ready yet, loading dynamically...');
        gapi.load('picker', showPicker);
      }
    },
    [isSignedIn, toast]
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
