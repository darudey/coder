
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, update, serverTimestamp } from 'firebase/database';
import { useDebounce } from './use-debounce';

export function useRealtimeCode(connectId?: string, initialCode?: string | null) {
  const [code, setCode] = useState(initialCode ?? '');
  const debouncedCode = useDebounce(code, 300);
  const lastWrittenCode = useRef<string | null>(null);
  const isMounted = useRef(false);
  const isLocalChange = useRef(false);

  // Set initial code only once when it becomes available
  useEffect(() => {
    if (initialCode !== null && initialCode !== undefined && !isMounted.current) {
      setCode(initialCode);
      lastWrittenCode.current = initialCode;
      isMounted.current = true;
    }
  }, [initialCode]);

  // Firebase listener effect
  useEffect(() => {
    if (!connectId) return;

    let unsub: () => void;
    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      const sessionRef = ref(db, `connectSessions/${connectId}`);
      unsub = onValue(sessionRef, (snap) => {
        if (isLocalChange.current) {
            return;
        }
        const data = snap.val();
        const remoteCode = data?.code;

        if (typeof remoteCode !== 'string') return;
        
        // Ignore the echo of our own write
        if (remoteCode === lastWrittenCode.current) return;
        
        setCode(remoteCode);
      });
    })();

    return () => unsub?.();
  }, [connectId]);

  // Firebase writer effect
  useEffect(() => {
    if (!connectId || !isMounted.current) return;

    // Do not write if the debounced code is the same as what we last wrote
    if (debouncedCode === lastWrittenCode.current) return;

    // Do not write if the debounced code is the same as the initial code (prevents overwriting on join)
    if(debouncedCode === initialCode) return;

    (async () => {
        const db = await getClientRtdb();
        if (!db) return;
        
        isLocalChange.current = true;
        lastWrittenCode.current = debouncedCode;
        
        await update(ref(db, `connectSessions/${connectId}`), {
          code: debouncedCode,
          updatedAt: serverTimestamp(),
        });
        
        // Allow remote updates again after a short delay
        setTimeout(() => {
            isLocalChange.current = false;
        }, 100);
    })();
    
  }, [debouncedCode, connectId, initialCode]);


  const updateCode = useCallback((newCode: string) => {
      isLocalChange.current = true;
      setCode(newCode);
      // Reset the flag after local update has been processed
      setTimeout(() => {
        isLocalChange.current = false;
      }, 100)
  }, []);

  return { code, setCode: updateCode };
}

    
