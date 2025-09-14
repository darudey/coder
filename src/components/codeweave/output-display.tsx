
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import React from 'react';
import type { RunResult } from '@/app/actions';
import { DotLoader } from './dot-loader';

interface OutputDisplayProps {
  output: RunResult | null;
  isCompiling: boolean;
}

const renderStaticAnalysisError = (output: string) => {
    const errorSections = output.replace('Static Analysis Errors:\n\n', '').split('\n\n---\n\n');
    
    return (
        <div className="p-4 text-sm font-code text-destructive">
            <h3 className="font-bold text-base mb-4">Static Analysis Errors</h3>
            {errorSections.map((section, index) => {
                const summaryMatch = section.match(/Summary: (.*)/);
                const explanationMatch = section.match(/Explanation: ([\s\S]*)/);
                const summary = summaryMatch ? summaryMatch[1] : 'Unknown Error';
                const explanation = explanationMatch ? explanationMatch[1] : 'No details available.';

                return (
                    <div key={index} className="mb-4 last:mb-0">
                        <p className="font-semibold mb-1">{summary}</p>
                        <p className="whitespace-pre-wrap opacity-90">{explanation}</p>
                    </div>
                );
            })}
        </div>
    );
};


const MemoizedOutputDisplay: React.FC<OutputDisplayProps> = ({
  output,
  isCompiling,
}) => {
  const renderOutput = () => {
    if (isCompiling) {
      return (
        <div className="flex items-center justify-center h-full">
          <DotLoader className="w-12 text-primary" />
          <p className="ml-4 text-muted-foreground">Running code...</p>
        </div>
      );
    }
    if (!output) {
      return <p className="text-muted-foreground p-4">Click "Run" to execute the code and see the output here.</p>;
    }

    if (output.type === 'error' && output.output.startsWith('Static Analysis Errors')) {
        return renderStaticAnalysisError(output.output);
    }

    return (
      <pre
        className={`p-4 text-sm whitespace-pre-wrap font-code h-full overflow-wrap-anywhere ${
          output.type === 'error' ? 'text-destructive' : 'text-foreground'
        }`}
        style={{ overflowWrap: 'anywhere' }}
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

export const OutputDisplay = React.memo(MemoizedOutputDisplay);

    
