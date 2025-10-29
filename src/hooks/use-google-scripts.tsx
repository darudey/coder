
'use client';

import { useState, useEffect } from 'react';
import Script from 'next/script';

export function useGoogleScripts() {
  const [scriptsLoaded, setScriptsLoaded] = useState(false);
  const [scriptLoadError, setScriptLoadError] = useState(false);

  const handleGapiLoad = () => {
    // This is called when gapi script is loaded. We wait for both to be loaded.
    if (window.google) {
        setScriptsLoaded(true);
    }
  };

  const handleGisLoad = () => {
    // This is called when gis script is loaded. We wait for both to be loaded.
    if(window.gapi) {
        setScriptsLoaded(true);
    }
  };

  const handleError = () => {
    setScriptLoadError(true);
  };
  
  useEffect(() => {
    if (window.gapi && window.google) {
      setScriptsLoaded(true);
    }
  }, []);

  return { 
      scriptsLoaded, 
      scriptLoadError,
      // We render the scripts here to ensure they are part of the component lifecycle
      // This is not standard, but we need to ensure the hooks have access to the window objects
      // in a predictable way. A better solution would involve a more complex setup with a
      // script loader that returns a promise.
      GoogleScripts: (
          <>
             <Script 
                src="https://apis.google.com/js/api.js" 
                onLoad={handleGapiLoad} 
                onError={handleError}
                async 
                defer 
            />
            <Script 
                src="https://accounts.google.com/gsi/client" 
                onLoad={handleGisLoad} 
                onError={handleError}
                async 
                defer 
            />
          </>
      )
   };
}
