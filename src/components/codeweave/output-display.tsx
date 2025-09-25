
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
  const renderOutputContent = (content: string, type: 'result' | 'error' = 'result') => {
    return (
      <pre
        className={cn(
            "p-4 text-sm whitespace-pre-wrap font-code h-full",
            type === 'error' ? 'text-destructive' : 'text-foreground'
        )}
        style={{ overflowWrap: 'anywhere' }}
        dangerouslySetInnerHTML={{ __html: AnsiToHtml(content) }}
      />
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
