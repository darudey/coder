
'use client';

import { useState, useEffect } from 'react';
import { getClientRtdb } from '@/lib/firebase';
import { ref, onValue, onDisconnect, set, serverTimestamp, runTransaction } from 'firebase/database';
import { useAuth } from './use-auth';
import { nanoid } from 'nanoid';

export interface ConnectedUser {
  id: string;
  name: string;
  isGuest: boolean;
  isAdmin: boolean;
}

export function usePresence(sessionId?: string, adminId?: string) {
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
      const adminRef = ref(rtdb, `sessions/${sessionId}/adminId`);

      const unsubscribe = onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
          onDisconnect(myConnectionsRef).remove();
          set(myConnectionsRef, { name: myName, isGuest });
          set(lastOnlineRef, serverTimestamp());

          // Try to become admin if no one is
          runTransaction(adminRef, (currentAdminId) => {
            if (currentAdminId === null) {
              return myId;
            }
            return; // Abort transaction
          });
        }
      });
      
      const userListUnsubscribe = onValue(connectionsRef, (snap) => {
          const usersData = snap.val() || {};
          
          onValue(adminRef, (adminSnap) => {
            const currentAdminId = adminSnap.val();
            const usersList: ConnectedUser[] = Object.entries(usersData).map(([id, data]) => ({
                id,
                name: (data as any).name || 'Anonymous',
                isGuest: (data as any).isGuest || false,
                isAdmin: id === currentAdminId,
            }));
            setConnectedUsers(usersList);
          });

      });

      return () => {
        unsubscribe();
        userListUnsubscribe();
        if (myConnectionsRef) {
            set(myConnectionsRef, null);
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
