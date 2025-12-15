
'use server';

import { adminDb } from '@/lib/firebase-admin';

export async function shareCode(code: string): Promise<{id: string} | {error: string}> {
    if (!adminDb) {
        return { error: 'Failed to connect to the database. Please check server configuration.' };
    }
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
    if (!adminDb) {
        console.error('Database not connected for getSharedCode.');
        return null;
    }
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
