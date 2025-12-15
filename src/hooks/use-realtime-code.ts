
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

  /* LISTEN */
  useEffect(() => {
    if (!connectId) return;

    let unsub: () => void;

    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      const sessionRef = ref(db, `connectSessions/${connectId}`);

      unsub = onValue(sessionRef, snap => {
        const data = snap.val();
        if (!data?.code) return;
        if (data.code === code) return;
        setCode(data.code);
      });
    })();

    return () => unsub?.();
  }, [connectId, code]);

  /* WRITE */
  useEffect(() => {
    if (!connectId) return;

    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      await update(ref(db, `connectSessions/${connectId}`), {
        code: debouncedCode,
        updatedBy: myId.current,
        updatedAt: serverTimestamp(),
      });
    })();
  }, [debouncedCode, connectId]);
  
  // Handle initial code if provided, but only once
  useEffect(() => {
    if (initialCode) {
        setCode(initialCode);
    }
  }, [initialCode]);


  return { code, setCode };
}

