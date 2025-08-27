
'use client';

import { runCode, type RunResult } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function OutputPage() {
  const searchParams = useSearchParams();
  const [result, setResult] = useState<RunResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const code = searchParams.get('code');
    const errorChecking = searchParams.get('errorChecking') === 'true';

    if (code) {
      setIsLoading(true);
      runCode(decodeURIComponent(code), errorChecking)
        .then(setResult)
        .finally(() => setIsLoading(false));
    } else {
        setResult({output: "No code provided.", type: "error"});
        setIsLoading(false);
    }
  }, [searchParams]);

  const renderOutput = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="ml-4 text-muted-foreground">Running code...</p>
        </div>
      );
    }
    if (!result) {
      return <p className="text-muted-foreground p-4">No result.</p>;
    }
    return (
      <pre
        className={`p-4 text-sm whitespace-pre-wrap font-code ${
          result.type === 'error' ? 'text-destructive' : 'text-foreground'
        }`}
      >
        {result.output}
      </pre>
    );
  };

  return (
    <main className="bg-background min-h-screen p-4">
        <Card className="flex flex-col h-[calc(100vh-2rem)] overflow-hidden shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline">Execution Result</CardTitle>
            </CardHeader>
            <CardContent className="flex-grow p-0 overflow-hidden">
                <ScrollArea className="h-full">
                    {renderOutput()}
                </ScrollArea>
            </CardContent>
        </Card>
    </main>
  );
}
