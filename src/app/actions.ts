
'use server';

import { errorCheck } from '@/ai/flows/error-checking';
import { db } from '@/lib/firebase';
import { addDoc, collection, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import fs from 'fs/promises';
import { customAlphabet } from 'nanoid';
import path from 'path';

export interface RunResult {
  output: string;
  type: 'result' | 'error';
}

/**
 * Performs AI-based static analysis on the code.
 * Does not execute the code.
 */
export async function checkCodeForErrors(code: string): Promise<RunResult | null> {
    try {
        const errorCheckResult = await errorCheck({ code });
        if (errorCheckResult.hasErrors && errorCheckResult.errors.length > 0) {
            const formattedErrors = errorCheckResult.errors.map(err => 
              `Summary: ${err.summary}\n\nExplanation: ${err.explanation}`
            ).join('\n\n---\n\n');

            return {
                output: `Static Analysis Errors:\n\n${formattedErrors}`,
                type: 'error',
            };
        }
        return null; // No errors found
    } catch (e: any) {
        // This could happen if the Genkit call fails
        return {
            output: `AI Error Check Failed: ${e.message}`,
            type: 'error',
        };
    }
}

export async function shareCode(code: string): Promise<{id: string} | {error: string}> {
    try {
        const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 10);
        const shareId = nanoid();
        
        await addDoc(collection(db, "shares"), {
            id: shareId,
            code: code,
            createdAt: serverTimestamp(),
        });

        return { id: shareId };
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
