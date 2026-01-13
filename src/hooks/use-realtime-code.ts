
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, update, serverTimestamp } from 'firebase/database';
import { useDebounce } from './use-debounce';

interface UseRealtimeCodeOptions {
  connectId?: string;
  initialCode?: string | null;
  onError?: (error: Error) => void;
}

export function useRealtimeCode(options: UseRealtimeCodeOptions) {
  const { connectId, initialCode, onError } = options;
  const [code, setCode] = useState(initialCode ?? '');
  const debouncedCode = useDebounce(code, 250); 
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
      try {
        const db = await getClientRtdb();
        if (!db) {
          onError?.(new Error('Firebase Realtime Database is not available.'));
          return;
        }

        const sessionRef = ref(db, `connectSessions/${connectId}`);
        unsub = onValue(sessionRef, (snap) => {
          const data = snap.val();
          const remoteCode = data?.code;

          if (typeof remoteCode !== 'string') return;
          
          // Ignore the echo of our own write
          if (remoteCode === lastWrittenCode.current) return;
          
          setCode(remoteCode);
        }, (error) => {
          onError?.(error);
        });
      } catch (error) {
        onError?.(error as Error);
      }
    })();

    return () => unsub?.();
  }, [connectId, onError]);

  // Firebase writer effect
  useEffect(() => {
    if (!connectId || debouncedCode === initialCode) return;

    if (debouncedCode === lastWrittenCode.current) return;
    
    (async () => {
      try {
        const db = await getClientRtdb();
        if (!db) {
          onError?.(new Error('Firebase Realtime Database is not available for writing.'));
          return;
        }

        lastWrittenCode.current = debouncedCode;
        
        await update(ref(db, `connectSessions/${connectId}`), {
          code: debouncedCode,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        onError?.(error as Error);
      }
    })();
  }, [debouncedCode, connectId, initialCode, onError]);

  return { code, setCode };
}
