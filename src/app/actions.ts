
'use server';

import { errorCheck } from '@/ai/flows/error-checking';
import fs from 'fs/promises';
import path from 'path';

export interface RunResult {
  output: string;
  type: 'result' | 'error';
}

export async function runCode(code: string, useErrorChecking: boolean): Promise<RunResult> {
  if (useErrorChecking) {
    const errorCheckResult = await errorCheck({ code });
    if (errorCheckResult.hasErrors && errorCheckResult.errors.length > 0) {
      return {
        output: `Static Analysis Errors:\n${errorCheckResult.errors.join('\n')}`,
        type: 'error',
      };
    }
  }

  try {
    // WARNING: `eval` is used for simplicity. In a real-world application,
    // this should be replaced with a secure sandboxing environment.
    const result = eval(code);
    const output = result === undefined ? 'undefined' : JSON.stringify(result, null, 2);
    return {
      output: output,
      type: 'result',
    };
  } catch (e: any) {
    return {
      output: e.message,
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
    await fs.writeFile(envLocalPath, `GEMINI_API_KEY=${apiKey}\n`);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save API key:', error);
    return { success: false, error: 'Failed to save API key on the server.' };
  }
}
