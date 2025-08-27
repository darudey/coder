
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import type { FC } from 'react';
import type { RunResult } from '@/app/actions';

interface OutputDisplayProps {
  output: RunResult | null;
  isCompiling: boolean;
}

export const OutputDisplay: FC<OutputDisplayProps> = ({
  output,
  isCompiling,
}) => {
  const renderOutput = () => {
    if (isCompiling) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Running code...</p>
        </div>
      );
    }
    if (!output) {
      return <p className="text-muted-foreground p-4">Click "Run" to execute the code and see the output here.</p>;
    }
    return (
      <pre
        className={`p-4 text-sm whitespace-pre-wrap font-code h-full ${
          output.type === 'error' ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {output.output}
      </pre>
    );
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-none border-0">
        <CardContent className="flex-grow p-0 overflow-hidden h-full">
            <ScrollArea className="h-full">{renderOutput()}</ScrollArea>
        </CardContent>
    </Card>
  );
};
