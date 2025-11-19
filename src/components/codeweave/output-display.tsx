
'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import React from 'react';
import type { RunResult } from './compiler';
import { DotLoader } from './dot-loader';
import AnsiToHtml from '@/lib/ansi-to-html';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface OutputDisplayProps {
  output: RunResult | null;
  isCompiling: boolean;
  isAiChecking?: boolean;
  expectedOutput?: string;
}

const MemoizedOutputDisplay: React.FC<OutputDisplayProps> = ({
  output,
  isCompiling,
  isAiChecking,
  expectedOutput,
}) => {
    const parseErrorLine = (errorOutput: string): [string, string | null] => {
        if (!errorOutput) return ['', null];

        const lines = errorOutput.split('\n');
        const errorLineRegex = /(?:<anonymous>|eval):(\d+):(\d+)/;
        const mainErrorLine = lines.find(line => errorLineRegex.test(line)) || lines[0];

        const match = mainErrorLine.match(errorLineRegex);
        if (match && match[1]) {
            return [errorOutput, match[1]];
        }
        return [errorOutput, null];
    };

    const renderOutputContent = (content: string, type: 'result' | 'error' = 'result') => {
        const [parsedContent, errorLine] = type === 'error' ? parseErrorLine(content) : [content, null];

        return (
            <div className="p-4 h-full">
                {errorLine && (
                    <div className="mb-2 text-sm font-semibold text-destructive/80">
                        Error on line {errorLine}
                    </div>
                )}
                <pre
                    className={cn(
                        "whitespace-pre-wrap font-code",
                        type === 'error' ? 'text-destructive' : 'text-foreground'
                    )}
                    style={{ overflowWrap: 'anywhere' }}
                    dangerouslySetInnerHTML={{ __html: AnsiToHtml(parsedContent) }}
                />
            </div>
        );
    };

  const renderLoading = () => (
    <div className="flex items-center justify-center h-full">
        {isAiChecking ? (
            <>
                <p className="mr-4 text-muted-foreground">AI is analyzing your code...</p>
                <DotLoader className="w-12 text-primary" />
            </>
        ) : (
            <>
                <DotLoader className="w-12 text-primary" />
                <p className="ml-4 text-muted-foreground">Running code...</p>
            </>
        )}
    </div>
  );
  
  if (isCompiling) {
      return renderLoading();
  }

  if (!output) {
      return <p className="text-muted-foreground p-4">Click "Run" to execute the code and see the output here.</p>;
  }

  if (expectedOutput) {
    return (
        <Tabs defaultValue="user" className="flex flex-col h-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="user">Your Output</TabsTrigger>
                <TabsTrigger value="required">Required Output</TabsTrigger>
            </TabsList>
            <TabsContent value="user" className="flex-grow overflow-hidden mt-0">
                <ScrollArea className="h-full">
                    {renderOutputContent(output.output, output.type)}
                </ScrollArea>
            </TabsContent>
            <TabsContent value="required" className="flex-grow overflow-hidden mt-0">
                <ScrollArea className="h-full">
                    {renderOutputContent(expectedOutput)}
                </ScrollArea>
            </TabsContent>
        </Tabs>
    );
  }

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-none border-0">
        <CardContent className="flex-grow p-0 overflow-hidden h-full">
            <ScrollArea className="h-full">
                {renderOutputContent(output.output, output.type)}
            </ScrollArea>
        </CardContent>
    </Card>
  );
};

export const OutputDisplay = React.memo(MemoizedOutputDisplay);
