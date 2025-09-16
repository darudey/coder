
'use server';

import { db } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc } from 'firebase/firestore';


export async function shareCode(code: string): Promise<{id: string} | {error: string}> {
    try {
        const docRef = await addDoc(collection(db, "shares"), {
            code: code,
        });

        return { id: docRef.id };
    } catch (e: any) {
        console.error(e);
        return { error: 'Failed to share code. Please try again.' };
    }
}

export async function getSharedCode(id: string): Promise<string | null> {
    try {
        const docRef = doc(db, "shares", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            return docSnap.data().code;
        } else {
            return null;
        }
    } catch (e: any) {
        console.error(e);
        return null;
    }
}
