

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, update, serverTimestamp, onDisconnect } from 'firebase/database';
import throttle from 'lodash.throttle';

export interface RemoteCursor {
  userId: string;
  name: string;
  lineIndex: number;
  left: number;
  height: number;
}

export function useRealtimeCursor(
  connectId?: string,
  myId?: string,
  myName?: string,
) {
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);
  const updateCursorRef = useRef<((lineIndex: number, left: number, height: number) => void) | null>(null);

  /* WRITE (throttled) */
  useEffect(() => {
    updateCursorRef.current = throttle(async (lineIndex: number, left: number, height: number) => {
      if (!connectId || !myId) return;
      const db = await getClientRtdb();
      if (!db) return;

      const cursorRef = ref(db, `connectSessions/${connectId}/cursors/${myId}`);
      
      // Ensure cursor is removed if client disconnects
      onDisconnect(cursorRef).remove();

      await update(cursorRef, {
        lineIndex,
        left,
        height,
        name: myName ?? 'Guest',
        updatedAt: serverTimestamp(),
      });
    }, 120);

    return () => {
      (updateCursorRef.current as any)?.cancel();
    };
  }, [connectId, myId, myName]);

  const updateCursor = useCallback((lineIndex: number, left: number, height: number) => {
    updateCursorRef.current?.(lineIndex, left, height);
  }, []);


  /* READ */
  useEffect(() => {
    if (!connectId || !myId) return;

    let unsub: () => void;

    (async () => {
      const db = await getClientRtdb();
      if (!db) return;

      const cursorsRef = ref(db, `connectSessions/${connectId}/cursors`);
      unsub = onValue(cursorsRef, snap => {
        const data = snap.val() || {};
        const now = Date.now();
        const list = Object.entries(data)
          .filter(([id]) => id !== myId)
          // Filter out cursors that haven't been updated in 5 seconds
          .filter(([, v]: any) => typeof v.updatedAt === 'number' && now - v.updatedAt < 5000)
          .map(([userId, v]: any) => ({
            userId,
            name: v.name || 'Guest',
            lineIndex: v.lineIndex,
            left: v.left,
            height: v.height,
          }));
        setCursors(list);
      });
    })();

    return () => unsub?.();
  }, [connectId, myId]);

  return { cursors, updateCursor };
}
