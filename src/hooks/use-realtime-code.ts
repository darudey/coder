'use client';

import { useEffect, useRef, useState } from 'react';
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
  const myId = useRef(getGuestId());
  const [code, setCode] = useState(initialCode ?? '');
  const debouncedCode = useDebounce(code, 250);
  const isWriting = useRef(false);

  // Set initial code only once
  useEffect(() => {
    if (initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  /* LISTEN */
  useEffect(() => {
    if (!connectId) return;

    let unsub: () => void;
    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      const sessionRef = ref(db, `connectSessions/${connectId}`);
      unsub = onValue(sessionRef, (snap) => {
        const data = snap.val();
        // If we are in the middle of writing, don't accept updates.
        if (isWriting.current) return;

        // If there's no remote code or it matches local code, do nothing.
        if (!data?.code || data.code === code) return;
        
        // Update local state with remote changes.
        setCode(data.code);
      });
    })();

    return () => unsub?.();
  }, [connectId, code]);

  /* WRITE */
  useEffect(() => {
    if (!connectId) return;

    // Don't write if the debounced code is the same as the initial state
    if (debouncedCode === initialCode && code === initialCode) return;

    (async () => {
      isWriting.current = true;
      const db = await getClientRtdb();
      if (!db) {
        isWriting.current = false;
        return;
      }

      await update(ref(db, `connectSessions/${connectId}`), {
        code: debouncedCode,
        updatedBy: myId.current,
        updatedAt: serverTimestamp(),
      });
      // After writing, allow listening for remote changes again
      setTimeout(() => {
        isWriting.current = false;
      }, 100); 
    })();
  }, [debouncedCode, connectId, initialCode, code]);

  return { code, setCode };
}
