
'use client';

import { DotLoader } from './codeweave/dot-loader';

export function LoadingPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
            <DotLoader className="text-primary w-24" />
            <p className="text-muted-foreground">Loading Content...</p>
        </div>
    </div>
  );
}
