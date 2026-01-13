
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, update, serverTimestamp } from 'firebase/database';
import { useDebounce } from './use-debounce';

export function useRealtimeCode(connectId?: string, initialCode?: string | null) {
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
      });
    })();

    return () => unsub?.();
  }, [connectId]);

  // Firebase writer effect
  useEffect(() => {
    if (!connectId || debouncedCode === initialCode) return;

    if (debouncedCode === lastWrittenCode.current) return;
    
    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      lastWrittenCode.current = debouncedCode;
      
      await update(ref(db, `connectSessions/${connectId}`), {
        code: debouncedCode,
        updatedAt: serverTimestamp(),
      });
    })();
  }, [debouncedCode, connectId, initialCode]);

  return { code, setCode };
}
