
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
  const [code, setCode] = useState(initialCode || '');
  const [isRemoteUpdate, setIsRemoteUpdate] = useState(false);

  const debouncedCode = useDebounce(code, 300);
  const lastWrittenRef = useRef<string | null>(null);

  // When initialCode changes (e.g., loaded from Firestore share), update local state
  useEffect(() => {
    if(initialCode) {
      setCode(initialCode);
    }
  }, [initialCode]);

  // 🔹 Listen for remote changes
  useEffect(() => {
    if (!connectId) return;

    let unsub: (() => void) | undefined;

    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      const codeRef = ref(db, `connectSessions/${connectId}/code`);

      unsub = onValue(codeRef, snap => {
        const remoteCode = snap.val();
        if (typeof remoteCode !== 'string') return;

        // Prevent echo loop by checking if the remote code is what we just wrote
        if (remoteCode !== lastWrittenRef.current) {
          setIsRemoteUpdate(true);
          setCode(remoteCode);
        }
      });
    })();

    return () => unsub?.();
  }, [connectId]);

  // 🔹 Push local changes (debounced)
  useEffect(() => {
    // If it's a remote update, just reset the flag and do nothing.
    if (isRemoteUpdate) {
      setIsRemoteUpdate(false);
      return;
    }
    
    if (!connectId) return;
    
    // Only write if the debounced code is different from the last written code
    if (debouncedCode === lastWrittenRef.current) {
        return;
    }

    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      lastWrittenRef.current = debouncedCode;
      const myId = user?.uid ?? getGuestId();

      await set(ref(db, `connectSessions/${connectId}`), {
        code: debouncedCode,
        updatedAt: serverTimestamp(),
        updatedBy: myId
      });
    })();
  }, [debouncedCode, connectId, isRemoteUpdate, user]);

  return { code, setCode };
}
