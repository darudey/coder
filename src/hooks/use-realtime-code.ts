
'use client';

import { useEffect, useRef, useState } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, set, serverTimestamp } from 'firebase/database';
import { useDebounce } from './use-debounce';
import { useAuth } from './use-auth';
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
  const { user } = useAuth();
  const myId = useRef(user?.uid ?? getGuestId());

  const [code, setCode] = useState(initialCode ?? '');
  const [hasLoaded, setHasLoaded] = useState(false);

  const debouncedCode = useDebounce(code, 300);

  /* ------------------ LISTEN (ONCE) ------------------ */
  useEffect(() => {
    if (!connectId) return;

    let unsubscribe: (() => void) | undefined;

    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      const sessionRef = ref(db, `connectSessions/${connectId}`);

      unsubscribe = onValue(sessionRef, snap => {
        const data = snap.val();
        if (!data || typeof data.code !== 'string') {
          setHasLoaded(true);
          return;
        }

        // Ignore my own writes
        if (data.updatedBy === myId.current) {
          setHasLoaded(true);
          return;
        }

        setCode(data.code);
        setHasLoaded(true);
      });
    })();

    return () => unsubscribe?.();
  }, [connectId]);

  /* ------------------ WRITE (DEBOUNCED) ------------------ */
  useEffect(() => {
    if (!connectId) return;
    if (!hasLoaded) return; // ⛔ prevent initial overwrite

    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      await set(ref(db, `connectSessions/${connectId}/code`), debouncedCode);
      await set(ref(db, `connectSessions/${connectId}/updatedBy`), myId.current);
      await set(ref(db, `connectSessions/${connectId}/updatedAt`), serverTimestamp());
    })();
  }, [debouncedCode, connectId, hasLoaded]);

  /* ------------------ INITIAL CODE ------------------ */
  useEffect(() => {
    if (initialCode && !hasLoaded) {
      setCode(initialCode);
    }
  }, [initialCode, hasLoaded]);

  return { code, setCode };
}
