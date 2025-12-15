
'use server';

// This file is now empty as all share logic has been moved to the client
// to simplify authentication and fix the sharing feature.

export async function shareCode(code: string): Promise<{id: string} | {error: string}> {
    // This server action is no longer used.
    // The logic has been moved to src/components/codeweave/compiler.tsx
    return { error: 'This function is deprecated.' };
}

export async function getSharedCode(id: string): Promise<string | null> {
    // This server action is no longer used.
    // The logic has been moved to src/app/s/[id]/page.tsx
    return null;
}
