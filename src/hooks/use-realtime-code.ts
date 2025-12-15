
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
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

  // Listen for remote changes and update the local state
  useEffect(() => {
    if (!connectId) return;

    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      const db = await getClientRtdb();
      if (!db) return;

      const codeRef = ref(db, `connectSessions/${connectId}/code`);

      unsubscribe = onValue(codeRef, (snapshot) => {
        const remoteCode = snapshot.val();
        if (typeof remoteCode === 'string' && remoteCode !== code) {
            // Check if the incoming code is what we just wrote. If so, ignore it.
            if (remoteCode !== lastWrittenRef.current) {
                setCode(remoteCode);
            }
        }
      });
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  // IMPORTANT: The dependency array must be correct to avoid re-subscribing unnecessarily
  // and to correctly handle updates.
  }, [connectId, code]);

  // Push local changes (debounced) to the database
  useEffect(() => {
    if (!connectId || debouncedCode === lastWrittenRef.current) {
      return;
    }

    const writeData = async () => {
      const db = await getClientRtdb();
      if (!db) return;
      
      const myId = user?.uid ?? getGuestId();

      // Update our ref *before* writing to Firebase
      lastWrittenRef.current = debouncedCode;

      await set(ref(db, `connectSessions/${connectId}`), {
        code: debouncedCode,
        updatedAt: serverTimestamp(),
        updatedBy: myId
      });
    };
    
    // Only write if the debounced code is different from the initial code it might have started with.
    // This prevents writing on initial load.
    if (debouncedCode !== initialCode) {
      writeData();
    }

  }, [debouncedCode, connectId, user, initialCode]);

  return { code, setCode };
}
