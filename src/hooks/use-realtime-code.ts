
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

    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      const db = await getClientRtdb();
      if (!db) return;

      const codeRef = ref(db, `connectSessions/${connectId}/code`);

      unsubscribe = onValue(codeRef, (snapshot) => {
        const remoteCode = snapshot.val();
        
        // Only update if the remote code is a string and different from the current code
        // and also not the exact same as what we last wrote (to prevent echo)
        if (typeof remoteCode === 'string' && remoteCode !== code && remoteCode !== lastWrittenRef.current) {
            setCode(remoteCode);
        }
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [connectId, code]); // Re-subscribe if connectId changes, depend on `code` to prevent echo

  // 🔹 Push local changes (debounced)
  useEffect(() => {
    if (!connectId) return;
    
    // Do not write if the debounced code is the same as what we last wrote
    if (debouncedCode === lastWrittenRef.current) {
        return;
    }

    const writeData = async () => {
      const db = await getClientRtdb();
      if (!db) return;

      // Update the ref *before* writing to prevent race conditions with the listener
      lastWrittenRef.current = debouncedCode;
      
      const myId = user?.uid ?? getGuestId();

      await set(ref(db, `connectSessions/${connectId}`), {
        code: debouncedCode,
        updatedAt: serverTimestamp(),
        updatedBy: myId
      });
    };
    
    writeData();

  }, [debouncedCode, connectId, user]);

  return { code, setCode };
}
