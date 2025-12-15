
'use client';

import { useEffect, useRef, useState } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, update, serverTimestamp, onDisconnect } from 'firebase/database';
import throttle from 'lodash.throttle';

export interface RemoteCursor {
  userId: string;
  name: string;
  line: number;
  ch: number;
}

export function useRealtimeCursor(
  connectId?: string,
  myId?: string,
  myName?: string,
) {
  const [cursors, setCursors] = useState<RemoteCursor[]>([]);

  /* WRITE (throttled) */
  const updateCursor = useRef(
    throttle(async (line: number, ch: number) => {
      if (!connectId || !myId) return;
      const db = await getClientRtdb();
      if (!db) return;

      const cursorRef = ref(db, `connectSessions/${connectId}/cursors/${myId}`);
      
      // Ensure cursor is removed if client disconnects
      onDisconnect(cursorRef).remove();

      await update(cursorRef, {
        line,
        ch,
        name: myName ?? 'Guest', // Ensure name is never undefined
        updatedAt: serverTimestamp(),
      });
    }, 120)
  ).current;

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
          // Filter out cursors that haven't been updated in 30 seconds
          .filter(([, v]: any) => typeof v.updatedAt === 'number' && now - v.updatedAt < 30000)
          .map(([userId, v]: any) => ({
            userId,
            name: v.name || 'Guest',
            line: v.line,
            ch: v.ch,
          }));
        setCursors(list);
      });
    })();

    return () => unsub?.();
  }, [connectId, myId]);

  return { cursors, updateCursor };
}
