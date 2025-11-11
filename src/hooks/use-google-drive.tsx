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

// Proper typing for Google Picker (avoid any)
interface PickerCallbackData {
  action: string;
  docs?: Array<{ id: string; name: string }>;
}

declare global {
  interface Window {
    google: any;
    gapi: any;
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
  openFileFromDrive: () => Promise<{ fileName: string; content: string } | null>;
}

const CLIENT_ID = '1095073746611-dklrdrkmq1km4kv2kddpocc2qi90fpbg.apps.googleusercontent.com';
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_API_KEY; // Must be public
const SCOPES = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';
const DISCOVERY_DOCS = [
  'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
  'https://www.googleapis.com/discovery/v1/apis/oauth2/v2/rest',
];

const GoogleDriveContext = createContext<GoogleDriveContextValue | undefined>(undefined);

export function GoogleDriveProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();

  const [isApiLoaded, setIsApiLoaded] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [tokenClient, setTokenClient] = useState<any>(null);
  const [pickerApiLoaded, setPickerApiLoaded] = useState(false);

  const updateUserProfile = useCallback(async () => {
    try {
      const response = await gapi.client.oauth2.userinfo.get();
      const profile = response.result;
      if (profile?.email) {
        setUserProfile({
          email: profile.email,
          name: profile.name || '',
          givenName: profile.given_name || '',
          imageUrl: profile.picture || '',
        });
        setIsSignedIn(true);
      }
    } catch (err) {
      console.error('Failed to fetch user profile', err);
      toast({
        title: 'Profile Error',
        description: 'Could not load user info.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  // Load GAPI + GIS + Picker
  useEffect(() => {
    const loadScript = (src: string) => {
      return new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
        document.body.appendChild(script);
      });
    };

    const init = async () => {
      try {
        // 1. Load GAPI
        await loadScript('https://apis.google.com/js/api.js');
        await new Promise<void>((resolve) => {
          gapi.load('client', () => {
            gapi.client.init({ discoveryDocs: DISCOVERY_DOCS }).then(resolve);
          });
        });

        // 2. Load GIS
        await loadScript('https://accounts.google.com/gsi/client');
        const client = google.accounts.oauth2.initTokenClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          callback: (tokenResponse: any) => {
            if (tokenResponse?.access_token) {
              gapi.client.setToken(tokenResponse);
              updateUserProfile();
            } else {
              toast({
                title: 'Sign-In Failed',
                description: 'No access token received.',
                variant: 'destructive',
              });
            }
          },
        });
        setTokenClient(client);

        // 3. Load Picker API
        await new Promise<void>((resolve) => {
          gapi.load('picker', () => {
            setPickerApiLoaded(true);
            resolve();
          });
        });

        setIsApiLoaded(true);
      } catch (err) {
        console.error('Failed to load Google APIs', err);
        toast({
          title: 'Google API Load Failed',
          description: 'Check internet or API key.',
          variant: 'destructive',
        });
      }
    };

    init();

  }, [toast, updateUserProfile]);

  const signIn = useCallback(() => {
    if (!tokenClient) {
      toast({
        title: 'API Not Ready',
        description: 'Google API is still loading...',
        variant: 'destructive',
      });
      return;
    }
    tokenClient.requestAccessToken({ prompt: 'consent' });
  }, [tokenClient, toast]);

  const signOut = useCallback(() => {
    const token = gapi.client.getToken();
    if (token?.access_token) {
      google.accounts.oauth2.revoke(token.access_token, () => {
        gapi.client.setToken(null);
        setIsSignedIn(false);
        setUserProfile(null);
        toast({ title: 'Signed Out', description: 'Disconnected from Google Drive.' });
      });
    } else {
      setIsSignedIn(false);
      setUserProfile(null);
    }
  }, [toast]);
  
  const openFileFromDrive = useCallback(
    async (): Promise<{ fileName: string; content: string } | null> => {
       if (!isSignedIn || !gapi.client.getToken()?.access_token) {
        signIn();
        toast({
          title: 'Sign In Required',
          description: 'Please sign in to open files.',
        });
        return null;
      }

      if (!API_KEY) {
        toast({
          title: 'Missing API Key',
          description: 'NEXT_PUBLIC_GOOGLE_API_KEY is not set.',
          variant: 'destructive',
        });
        return null;
      }

      if (!pickerApiLoaded) {
        toast({
          title: 'Picker Not Ready',
          description: 'Google Picker is still loading...',
          variant: 'destructive',
        });
        return null;
      }
      
      return new Promise((resolve) => {
        const accessToken = gapi.client.getToken().access_token;
        
        const view = new google.picker.View(google.picker.ViewId.DOCS);
        view.setMimeTypes('application/javascript,text/plain');

        const picker = new google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken)
          .setDeveloperKey(API_KEY)
          .setCallback(async (data: PickerCallbackData) => {
            if (data.action === google.picker.Action.PICKED) {
              const fileId = data.docs?.[0]?.id;
              const fileName = data.docs?.[0]?.name;
              if (fileId && fileName) {
                try {
                  const response = await gapi.client.drive.files.get({
                    fileId: fileId,
                    alt: 'media',
                  });
                  resolve({ fileName: fileName, content: response.body });
                } catch (err: any) {
                  console.error('Error fetching file content:', err);
                  toast({
                    title: 'Error Opening File',
                    description: err.message || 'Could not read file from Drive.',
                    variant: 'destructive',
                  });
                  resolve(null);
                }
              }
            } else if (data.action === google.picker.Action.CANCEL) {
              resolve(null);
            } else {
              resolve(null);
            }
          })
          .build();
        picker.setVisible(true);
      });
    },
    [isSignedIn, pickerApiLoaded, signIn, toast]
  );


  const saveFileToDrive = useCallback(
    async (fileName: string, content: string) => {
      if (!isSignedIn || !gapi.client.getToken()?.access_token) {
        signIn();
        toast({
          title: 'Sign In Required',
          description: 'Please sign in to save files.',
        });
        return;
      }

      if (!API_KEY) {
        toast({
          title: 'Missing API Key',
          description: 'NEXT_PUBLIC_GOOGLE_API_KEY is not set.',
          variant: 'destructive',
        });
        return;
      }

      if (!pickerApiLoaded) {
        toast({
          title: 'Picker Not Ready',
          description: 'Google Picker is still loading...',
          variant: 'destructive',
        });
        return;
      }

      const accessToken = gapi.client.getToken().access_token;

      const createFileInFolder = async (folderId: string) => {
        try {
          const metadata = {
            name: fileName,
            parents: [folderId],
            mimeType: 'application/javascript',
          };

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

          const response = await fetch(
            'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
              },
              body,
            }
          );

          const result = await response.json();

          if (!response.ok) {
            throw new Error(result.error?.message || 'Upload failed');
          }

          toast({
            title: 'Success!',
            description: `${fileName} saved to Google Drive.`,
          });
        } catch (err: any) {
          console.error('Upload error:', err);
          toast({
            title: 'Save Failed',
            description: err.message || 'Could not save file.',
            variant: 'destructive',
          });
        }
      };

      try {
        const view = new google.picker.View(google.picker.ViewId.FOLDERS);
        if (typeof view.setSelectableMimeTypes === 'function') {
           view.setSelectableMimeTypes('application/vnd.google-apps.folder');
        }
      
        new google.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(accessToken)
          .setDeveloperKey(API_KEY)
          .setCallback((data: PickerCallbackData) => {
            console.log('Picker callback:', data); // Debug
            if (data.action === google.picker.Action.PICKED) {
              const folderId = data.docs?.[0]?.id;
              if (folderId) {
                createFileInFolder(folderId);
              }
            } else if (data.action === google.picker.Action.CANCEL) {
              console.log('Picker cancelled');
              toast({ description: 'Folder selection cancelled.' });
            } else if ((data as any).action === 'error') {
               console.error('Picker error:', data);
               toast({ title: 'Picker Failed', description: 'Check console for details.', variant: 'destructive' });
            }
          })
          .build()
          .setVisible(true);
      } catch (err: any) {
        console.error('Picker error:', err);
        toast({
          title: 'Picker Error',
          description: 'Failed to open folder picker.',
          variant: 'destructive',
        });
      }
    },
    [isSignedIn, pickerApiLoaded, signIn, toast]
  );

  const value: GoogleDriveContextValue = {
    isApiLoaded,
    isSignedIn,
    userProfile,
    signIn,
    signOut,
    saveFileToDrive,
    openFileFromDrive,
  };

  return <GoogleDriveContext.Provider value={value}>{children}</GoogleDriveContext.Provider>;
}

export function useGoogleDrive() {
  const context = useContext(GoogleDriveContext);
  if (!context) {
    throw new Error('useGoogleDrive must be used within a GoogleDriveProvider');
  }
  return context;
}
