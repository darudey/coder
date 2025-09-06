
'use server';

import { errorCheck } from '@/ai/flows/error-checking';
import fs from 'fs/promises';
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
