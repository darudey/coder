
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';
import type { FC } from 'react';
import type { RunResult } from '@/app/actions';

interface OutputDisplayProps {
  output: RunResult | null;
  highlightedCode: string;
  isCompiling: boolean;
  showSyntaxHighlighting: boolean;
}

export const OutputDisplay: FC<OutputDisplayProps> = ({
  output,
  highlightedCode,
  isCompiling,
  showSyntaxHighlighting,
}) => {
  const renderOutput = () => {
    if (isCompiling) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      );
    }
    if (!output) {
      return <p className="text-muted-foreground p-4">Click "Run" to execute the code and see the output in a new tab.</p>;
    }
    return (
      <pre
        className={`p-4 text-sm whitespace-pre-wrap font-code ${
          output.type === 'error' ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {output.output}
      </pre>
    );
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden shadow-lg">
      <Tabs defaultValue="output" className="flex flex-col h-full">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="font-headline">Preview</CardTitle>
          <TabsList>
            <TabsTrigger value="output">Result</TabsTrigger>
            <TabsTrigger value="highlighted" disabled={!showSyntaxHighlighting}>
              Code
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="flex-grow p-0 overflow-hidden">
          <TabsContent value="output" className="h-full m-0">
            <ScrollArea className="h-full">{renderOutput()}</ScrollArea>
          </TabsContent>
          <TabsContent value="highlighted" className="h-full m-0">
            <ScrollArea className="h-full">
              <pre className="p-4 text-sm font-code">
                <code dangerouslySetInnerHTML={{ __html: highlightedCode || ' ' }} />
              </pre>
            </ScrollArea>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
};
