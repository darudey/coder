'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Compiler, type CompilerRef, type RunResult } from '@/components/codeweave/compiler';
import { useSettings } from '@/hooks/use-settings';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Play } from 'lucide-react';
import { DotLoader } from '@/components/codeweave/dot-loader';
import { OutputDisplay } from '@/components/codeweave/output-display';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCompilerFs } from '@/hooks/use-compiler-fs';

export default function Home() {
  const { settings } = useSettings();
  const compilerRef = useRef<CompilerRef>(null);
  const isMobile = useIsMobile();
  const fs = useCompilerFs({});
  
  const [output, setOutput] = useState<RunResult | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [panelWidth, setPanelWidth] = useState(30);

  const handleRun = useCallback(async () => {
    if (compilerRef.current) {
        const showFloating = isMobile ? settings.outputMode === 'floating' : settings.outputMode === 'floating';
        if (!showFloating) {
            setIsCompiling(true);
            setOutput(null);
        }
        // The Compiler component will handle opening the floating panel
        const result = await compilerRef.current.run();
        if (!showFloating) {
            setOutput(result);
            setIsCompiling(false);
        }
    }
  }, [settings.outputMode, isMobile]);

  const showSidePanel = !isMobile && settings.outputMode === 'side';

  if (!showSidePanel) {
    return (
        <div className="bg-background min-h-screen">
            <Compiler ref={compilerRef} onRun={handleRun} {...fs} />
        </div>
    );
  }

  const SidePanelOutput = (
    <div className="h-full flex flex-col overflow-hidden">
        <Card className="flex-grow flex flex-col">
            <CardHeader className="flex flex-row items-center p-2 border-b">
                <div className="flex items-center gap-1 flex-1">
                    <Button variant="ghost" size="xs" className="h-6 px-1 text-xs" onClick={() => setPanelWidth(20)}>20%</Button>
                    <Button variant="ghost" size="xs" className="h-6 px-1 text-xs" onClick={() => setPanelWidth(30)}>30%</Button>
                    <Button variant="ghost" size="xs" className="h-6 px-1 text-xs" onClick={() => setPanelWidth(40)}>40%</Button>
                </div>
                <CardTitle className="text-sm font-semibold flex-1 text-center">Output</CardTitle>
                <div className="flex-1 flex justify-end">
                    <Button onClick={handleRun} disabled={isCompiling} size="sm" className="h-7">
                        {isCompiling ? <DotLoader /> : <><Play className="w-3 h-3 mr-1" /> Run</>}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-grow overflow-auto">
                <OutputDisplay output={output} isCompiling={isCompiling} />
            </CardContent>
        </Card>
    </div>
  );

  return (
    <div className="bg-background h-[calc(100vh-4rem)]">
        <div className="grid h-full p-4 gap-4" style={{ gridTemplateColumns: `1fr ${panelWidth}%`}}>
            <div className="h-full flex flex-col overflow-y-auto">
                 <Compiler ref={compilerRef} onRun={handleRun} {...fs} />
            </div>
            {SidePanelOutput}
        </div>
    </div>
  );
}
