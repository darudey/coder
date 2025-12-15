'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, update, serverTimestamp } from 'firebase/database';
import { useDebounce } from './use-debounce';
import { nanoid } from 'nanoid';

const getGuestId = () => {
  if (typeof window === 'undefined') return 'guest-server';
  let id = sessionStorage.getItem('guestId');
  if (!id) {
    id = `guest-${nanoid(6)}`;
    sessionStorage.setItem('guestId', id);
  }
  return id;
};

export function useRealtimeCode(connectId?: string, initialCode?: string | null) {
  const [code, setCode] = useState(initialCode ?? '');
  const debouncedCode = useDebounce(code, 100); // Reduced delay for better responsiveness
  const lastWrittenCode = useRef<string | null>(null);

  // Set initial code only once when it becomes available
  useEffect(() => {
    if (initialCode !== null && initialCode !== undefined) {
      setCode(initialCode);
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

        // If there's no remote code, do nothing.
        if (remoteCode === null || remoteCode === undefined) return;
        
        // If the remote code is the same as what we last wrote, ignore it.
        // This prevents the listener from overwriting local state with our own echo.
        if (remoteCode === lastWrittenCode.current) {
          return;
        }

        // If the remote code is different from the current local state, update.
        setCode(remoteCode);
      });
    })();

    return () => unsub?.();
  }, [connectId]);

  // Firebase writer effect
  useEffect(() => {
    // Do not write if there is no connectId, or if the code is the initial default.
    if (!connectId || debouncedCode === initialCode) return;

    // Prevent writing if the debounced code hasn't changed from the last written value.
    if (debouncedCode === lastWrittenCode.current) return;
    
    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      // Update what we're about to write, so the listener can ignore the echo.
      lastWrittenCode.current = debouncedCode;
      
      await update(ref(db, `connectSessions/${connectId}`), {
        code: debouncedCode,
        updatedAt: serverTimestamp(),
      });
    })();
  }, [debouncedCode, connectId, initialCode]);

  return { code, setCode };
}
