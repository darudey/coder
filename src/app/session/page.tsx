
'use client';

import { Compiler } from '@/components/codeweave/compiler';
import { GridEditor } from '@/components/codeweave/grid-editor';

export default function SessionPage() {
  return (
    <div className="bg-background min-h-screen">
      <Compiler EditorComponent={GridEditor} />
    </div>
  );
}
