
'use server';

import { errorCheck } from '@/ai/flows/error-checking';
import { syntaxHighlighting } from '@/ai/flows/syntax-highlighting';

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

export async function getHighlightedCode(code: string): Promise<string> {
    if (!code) return '';
    try {
        const result = await syntaxHighlighting({ code });
        return result.highlightedCode;
    } catch (e) {
        // If highlighting fails, return the original code
        console.error("Syntax highlighting failed:", e);
        return code;
    }
}
