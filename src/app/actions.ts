
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
            return {
                output: `Static Analysis Errors:\n${errorCheckResult.errors.join('\n')}`,
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


export async function saveApiKey(apiKey: string): Promise<{ success: boolean; error?: string }> {
  if (!apiKey) {
    return { success: false, error: 'API key cannot be empty.' };
  }
  
  try {
    // In a real app, you'd want to handle this more securely.
    // For this prototype, we'll write it to a .env.local file.
    const envLocalPath = path.resolve(process.cwd(), '.env.local');
    // Read existing content, if any
    let content = '';
    try {
      content = await fs.readFile(envLocalPath, 'utf-8');
    } catch (readError: any) {
      if (readError.code !== 'ENOENT') {
        throw readError;
      }
    }

    const lines = content.split('\n');
    const newKeyLine = `GEMINI_API_KEY=${apiKey}`;
    let keyExists = false;

    const newLines = lines.map(line => {
      if (line.startsWith('GEMINI_API_KEY=')) {
        keyExists = true;
        return newKeyLine;
      }
      return line;
    });

    if (!keyExists) {
      newLines.push(newKeyLine);
    }
    
    await fs.writeFile(envLocalPath, newLines.filter(line => line).join('\n'));
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save API key:', error);
    return { success: false, error: 'Failed to save API key on the server.' };
  }
}
