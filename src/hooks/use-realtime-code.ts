
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, update, serverTimestamp } from 'firebase/database';
import { useDebounce } from './use-debounce';

export function useRealtimeCode(connectId?: string, initialCode?: string | null) {
  const [code, setCode] = useState(initialCode ?? '');
  const debouncedCode = useDebounce(code, 250); 
  const lastWrittenCode = useRef<string | null>(null);

  // Use a ref to hold the latest code for immediate access in unload handlers
  const latestCodeRef = useRef(code);
  useEffect(() => {
    latestCodeRef.current = code;
  }, [code]);

  // Set initial code only once when it becomes available
  useEffect(() => {
    if (initialCode !== null && initialCode !== undefined) {
      setCode(initialCode);
      latestCodeRef.current = initialCode;
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
        const data = snap.val();
        const remoteCode = data?.code;

        if (typeof remoteCode !== 'string') return;
        
        // Ignore the echo of our own write
        if (remoteCode === lastWrittenCode.current) return;
        
        setCode(remoteCode);
        latestCodeRef.current = remoteCode;
      });
    })();

    return () => unsub?.();
  }, [connectId]);

  const flushChanges = useCallback(async () => {
    if (!connectId) return;
    const currentCode = latestCodeRef.current;
    if (currentCode === lastWrittenCode.current) return;

    const db = await getClientRtdb();
    if (!db) return;

    lastWrittenCode.current = currentCode;
    
    await update(ref(db, `connectSessions/${connectId}`), {
      code: currentCode,
      updatedAt: serverTimestamp(),
    });
  }, [connectId]);

  // Firebase writer effect
  useEffect(() => {
    if (!connectId || debouncedCode === initialCode) return;

    if (debouncedCode === lastWrittenCode.current) return;
    
    flushChanges();
  }, [debouncedCode, connectId, initialCode, flushChanges]);

  // Save on unload/unmount
  useEffect(() => {
    const handleBeforeUnload = () => {
      flushChanges();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      // Also flush when navigating within the app (component unmount)
      flushChanges();
    };
  }, [flushChanges]);


  return { code, setCode };
}
