
'use server';

import { db } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { customAlphabet } from 'nanoid';

export interface RunResult {
  output: string;
  type: 'result' | 'error';
}

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);

export async function shareCode(code: string): Promise<{id: string} | {error: string}> {
    try {
        const id = nanoid();
        await addDoc(collection(db, "shares"), {
            id: id,
            code: code,
        });

        return { id: id };
    } catch (e: any) {
        console.error(e);
        return { error: 'Failed to share code. Please try again.' };
    }
}

export async function getSharedCode(id: string): Promise<string | null> {
    try {
        const q = query(collection(db, "shares"), where("id", "==", id), limit(1));
        const querySnapshot = await getDocs(q);

        if (!querySnapshot.empty) {
            const docSnap = querySnapshot.docs[0];
            return docSnap.data().code;
        } else {
            return null;
        }
    } catch (e: any) {
        console.error(e);
        return null;
    }
}
