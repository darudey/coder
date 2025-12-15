
'use client';

import { useState, useEffect } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { useAuth } from './use-auth';
import { nanoid } from 'nanoid';

export interface ConnectedUser {
  id: string;
  name: string;
  isGuest: boolean;
}

export function usePresence(sessionId?: string) {
  const { user, loading: authLoading } = useAuth();
  const [connectedUsers, setConnectedUsers] = useState<ConnectedUser[]>([]);

  useEffect(() => {
    if (!sessionId || authLoading) return;

    const initializePresence = async () => {
      const rtdb = await getClientRtdb();
      if (!rtdb) return;

      const myId = user?.uid || `guest-${nanoid(4)}`;
      const myName = user?.displayName || `Guest-${myId.slice(-4)}`;
      const isGuest = !user || user.isAnonymous;

      const myConnectionsRef = ref(rtdb, `sessions/${sessionId}/connections/${myId}`);
      const lastOnlineRef = ref(rtdb, `sessions/${sessionId}/lastOnline/${myId}`);
      const connectedRef = ref(rtdb, '.info/connected');
      const connectionsRef = ref(rtdb, `sessions/${sessionId}/connections`);

      const unsubscribe = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          const con = myConnectionsRef;
          onDisconnect(con).remove();
          set(con, { name: myName, isGuest });
          set(lastOnlineRef, serverTimestamp());
        }
      });
      
      const userListUnsubscribe = onValue(connectionsRef, (snap) => {
          const usersData = snap.val() || {};
          const usersList: ConnectedUser[] = Object.entries(usersData).map(([id, data]) => ({
              id,
              name: (data as any).name || 'Anonymous',
              isGuest: (data as any).isGuest || false,
          }));
          setConnectedUsers(usersList);
      });

      return () => {
        unsubscribe();
        userListUnsubscribe();
        const con = myConnectionsRef;
        if(con) {
            set(con, null);
        }
      };
    };

    let cleanup: (() => void) | void;
    initializePresence().then(cleanupFn => {
        if(cleanupFn) {
            cleanup = cleanupFn;
        }
    });

    return () => {
        if (cleanup) {
            cleanup();
        }
    };
  }, [sessionId, user, authLoading]);

  return { connectedUsers };
}
