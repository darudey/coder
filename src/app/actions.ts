
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { collection, doc, getDoc, addDoc } from 'firebase/firestore';


export async function shareCode(code: string): Promise<{id: string} | {error: string}> {
    try {
        const docRef = await adminDb.collection("shares").add({
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
        const docRef = adminDb.collection("shares").doc(id);
        const docSnap = await docRef.get();

        if (docSnap.exists) {
            return docSnap.data()?.code;
        } else {
            return null;
        }
    } catch (e: any) {
        console.error(e);
        // In a real app, you'd want to handle this more gracefully
        // For this scenario, we'll return null and let the page 404
        return null;
    }
}
