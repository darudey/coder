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

declare global {
  interface Window { gapi: any; google: any; }
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

const CLIENT_ID = '1095073746611-dklrdrkmq1km4kv2kddpocc2qi90fpbg.apps.googleusercontent.com';
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest',
];

const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(undefined);

// Helper: load a script if not already present
function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.appendChild(s);
  });
}

// Helper: ensure picker is ready (gapi must be initialized before calling this)
async function ensurePickerReady(timeoutMs = 8000) {
  // Make sure api.js exists (gapi), then call gapi.load('picker')
  if (!window.gapi) {
    await loadScript('https://apis.google.com/js/api.js');
    // wait for gapi global
    await new Promise<void>((resolve) => {
      const check = () => {
        if (window.gapi && typeof window.gapi.load === 'function') resolve();
        else setTimeout(check, 50);
      };
      check();
    });
  }
  // load picker.js (attaches picker implementation and registers it with gapi)
  await loadScript('https://apis.google.com/js/picker.js');

  // Use gapi.load('picker') to initialize the module and wait for window.google.picker
  await new Promise<void>((resolve, reject) => {
    const start = Date.now();
    try {
      // call gapi.load('picker') safely
      window.gapi.load('picker', () => {
        // wait loop until google.picker is attached
        const waitForPicker = () => {
          if (window.google && window.google.picker) {
            resolve();
          } else if (Date.now() - start > timeoutMs) {
            reject(new Error('Timeout waiting for google.picker'));
          } else {
            setTimeout(waitForPicker, 100);
          }
        };
        waitForPicker();
      });
    } catch (e) {
      reject(e);
    }
  });
}

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [isGapiLoaded, setIsGapiLoaded] = useState(false);
  const [isGisLoaded, setIsGisLoaded] = useState(false);

  const updateUserProfile = useCallback(async () => {
    try {
      // ensure oauth2 discovery doc loaded in gapi.client.init (we set it during init)
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
      // no toast here — could be sign-out
    }
  }, []);

  // init gapi & gis
  useEffect(() => {
    const gapiScript = document.createElement('script');
    gapiScript.src = 'https://apis.google.com/js/api.js';
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => {
      // Wait until gapi exists
      if (window.gapi && typeof window.gapi.load === 'function') {
        gapi.load('client', async () => {
          try {
            await gapi.client.init({ discoveryDocs: DISCOVERY_DOCS });
            setIsGapiLoaded(true);
          } catch (e) {
            console.error('Error initializing GAPI client', e);
          }
        });
      }
    };
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = 'https://accounts.google.com/gsi/client';
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => {
      // init token client using GIS
      const client = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse: any) => {
          if (tokenResponse && tokenResponse.access_token) {
            gapi.client.setToken(tokenResponse);
            setIsSignedIn(true);
            updateUserProfile();
          } else {
            console.error('Access token error', tokenResponse);
            toast({ title: 'Sign-In Error', description: 'Could not get access token from Google.', variant: 'destructive' });
          }
        },
      });
      setTokenClient(client);
      setIsGisLoaded(true);
    };
    document.body.appendChild(gisScript);

    return () => {
      if (document.body.contains(gapiScript)) document.body.removeChild(gapiScript);
      if (document.body.contains(gisScript)) document.body.removeChild(gisScript);
    };
  }, [toast, updateUserProfile]);

  useEffect(() => {
    if (isGapiLoaded && isGisLoaded) setIsApiLoaded(true);
  }, [isGapiLoaded, isGisLoaded]);

  const signIn = useCallback(() => {
    if (CLIENT_ID.startsWith('YOUR_GOOGLE_CLIENT_ID')) {
      toast({ title: 'Google Drive Not Configured', description: 'Please add your Google Client ID.', variant: 'destructive' });
      return;
    }
    if (tokenClient) {
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      toast({ title: 'Google API not ready', description: 'Please wait a moment and try again.', variant: 'destructive' });
    }
  }, [tokenClient, toast]);

  const signOut = useCallback(() => {
    const token = gapi.client.getToken();
    if (token) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken(null); // use null to clear
        setIsSignedIn(false);
        setUserProfile(null);
        toast({ title: 'Signed Out', description: 'You have successfully signed out from Google Drive.' });
      });
    } else {
      // no token — just clear state
      setIsSignedIn(false);
      setUserProfile(null);
      toast({ title: 'Signed Out', description: 'You have signed out.' });
    }
  }, [toast]);

  const saveFileToDrive = useCallback(
    async (fileName: string, content: string) => {
      // ensure APIs are loaded
      if (!isApiLoaded) {
        toast({ title: 'APIs loading', description: 'Please wait a moment and try again.', variant: 'destructive' });
        return;
      }

      // require sign-in/token
      let tokenObj = gapi.client.getToken();
      if (!tokenObj || !tokenObj.access_token) {
        // try to request token if tokenClient available
        if (tokenClient) {
          // prompt user to sign in / grant token; tokenClient will call callback and set gapi token
          tokenClient.requestAccessToken({ prompt: 'consent' });
          toast({ title: 'Signing in', description: 'Please accept Google permissions, then retry saving.' });
          return;
        } else {
          toast({ title: 'Not signed in', description: 'Please connect to Google Drive first.', variant: 'destructive' });
          return;
        }
      }

      // ensure Picker is ready
      try {
        await ensurePickerReady();
      } catch (err) {
        console.error('Picker failed to initialize', err);
        toast({ title: 'Picker Error', description: 'Google Picker failed to initialize.', variant: 'destructive' });
        return;
      }

      // create file uploader helper
      const createFileInFolder = async (folderId: string, fileName: string, content: string) => {
        try {
          const metadata = { name: fileName, parents: [folderId], mimeType: 'application/javascript' };
          const boundary = '-------314159265358979323846';
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

          const resp = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${gapi.client.getToken().access_token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body,
          });

          const result = await resp.json();
          if (resp.ok) {
            toast({ title: 'File Saved', description: `${fileName} was saved to your Google Drive.` });
          } else {
            throw new Error(result.error?.message || 'Unknown error during file upload.');
          }
        } catch (err: any) {
          console.error('Error saving to Drive:', err);
          toast({ title: 'Error Saving File', description: err.message || 'Could not save file.', variant: 'destructive' });
        }
      };

      // build and show picker
      const showPicker = () => {
        if (!window.google || !window.google.picker) {
          toast({ title: 'Picker Not Available', description: 'Google Picker is not available.', variant: 'destructive' });
          return;
        }

        const view = new window.google.picker.View(window.google.picker.ViewId.FOLDERS);
        // For folder selection, using FOLDERS view is usually better than DOCS with folder mime type
        const picker = new window.google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(gapi.client.getToken().access_token)
          .setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '')
          .setCallback((data: any) => {
            if (data.action === window.google.picker.Action.PICKED) {
              const folderId = data.docs[0].id;
              createFileInFolder(folderId, fileName, content);
            } else if (data.action === window.google.picker.Action.CANCEL) {
              // user cancelled
            }
          })
          .build();

        picker.setVisible(true);
      };

      showPicker();
    },
    [isApiLoaded, tokenClient, toast]
  );

  const value: GoogleDriveContextValue = {
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
  if (context === undefined) throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  return context;
}
