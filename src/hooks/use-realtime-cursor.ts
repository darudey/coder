
'use client';

import { useEffect, useRef, useState } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, update, serverTimestamp } from 'firebase/database';
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

      await update(ref(db, `connectSessions/${connectId}/cursors/${myId}`), {
        line,
        ch,
        name: myName,
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
          .filter(([, v]: any) => now - v.updatedAt < 30000) // Cursors disappear after 30s
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
