
'use client';

import { BookOpen, Zap, SkipForward, SkipBack, Keyboard, MoveHorizontal, MousePointerClick, ArrowUp, ArrowDown } from "lucide-react";
import { FeatureCard, Key } from './about-helpers';
import React from 'react';

export function AboutContent() {
  return (
    <div className="space-y-6 text-sm py-4">
        
        <div className="space-y-4">
            <FeatureCard title="Interactive Courses" icon={<BookOpen className="text-primary"/>}>
                <p>Learn web development from the ground up with structured courses. Each chapter includes video lectures, detailed notes, and hands-on coding exercises with automated checks to test your knowledge.</p>
            </FeatureCard>

             <FeatureCard title="AI-Powered Debugger" icon={<Zap className="text-primary"/>}>
                <p>Leveraging Google's Gemini models via Genkit, the app offers an AI-driven debugger to help you visualize your code's execution step-by-step and fix bugs faster.</p>
            </FeatureCard>
            
            <FeatureCard title="Quick-Jump" icon={<SkipForward className="text-primary"/>} badge="Desktop">
                <p>Quickly navigate through your code with these spacebar-powered shortcuts.</p>
                 <ul className="list-disc pl-5 space-y-2">
                    <li><strong className="flex items-center gap-2"><SkipForward size={16} /> Jump Forward:</strong> Press <Key>Shift</Key> or <Key>Alt</Key> + <Key>Space</Key> to jump the cursor to the beginning of the next word or symbol.</li>
                    <li><strong className="flex items-center gap-2"><SkipBack size={16} /> Jump Backward:</strong> Press <Key>Ctrl</Key> or <Key>Cmd</Key> + <Key>Space</Key> to jump to the beginning of the previous word or symbol.</li>
                    <li><strong className="flex items-center gap-2">Cycle Suggestions:</strong> When the suggestion box is open, press <Key>Shift</Key> + <Key>Space</Key> to cycle through the available autocomplete suggestions.</li>
                    <li><strong className="flex items-center gap-2">Jump Out of Pairs:</strong> When your cursor is just inside a closing symbol like `)` or `'`, press <Key>Space</Key> three times quickly to jump the cursor just outside of it.</li>
                </ul>
            </FeatureCard>

            <FeatureCard title="Spacebar Power-ups" icon={<Keyboard className="text-primary"/>} badge="Mobile">
                <p>On mobile devices, the virtual keyboard's spacebar becomes a powerful tool for navigating suggestions.</p>
                 <ul className="list-disc pl-5 space-y-1">
                    <li><strong className="flex items-center gap-2"><MoveHorizontal size={16} /> Drag Left/Right:</strong> When the suggestion box is open, slide your finger left or right across the spacebar to quickly cycle through suggestions.</li>
                    <li><strong className="flex items-center gap-2"><MousePointerClick size={16} /> Tap:</strong> When the suggestion box is open, a single tap on the spacebar selects the highlighted keyword.</li>
                </ul>
            </FeatureCard>

            <FeatureCard title="Keyboard Shortcuts" icon={<Keyboard className="text-primary" />} badge="Desktop">
                 <p>Speed up your workflow on a desktop with these handy keyboard shortcuts.</p>
                 <ul className="space-y-2">
                    <li className="flex items-center justify-between"><span>Run Code</span> <div><Key>Shift</Key> + <Key>Enter</Key></div></li>
                    <li className="flex items-center justify-between"><span>Toggle Line Comment</span> <Key>Ctrl/Cmd + /</Key></li>
                    <li className="flex items-center justify-between"><span>Toggle Block Comment</span> <div><Key>Ctrl/Cmd</Key> + <Key>Shift</Key> + <Key>/</Key></div></li>
                    <li className="flex items-center justify-between"><span>Undo / Redo</span> <div><Key>Ctrl/Cmd</Key> + <Key>Z</Key> / <Key>Y</Key></div></li>
                    <li className="flex items-center justify-between"><span>Copy / Cut / Paste Line</span> <div><Key>Ctrl/Cmd</Key> + <Key>C</Key> / <Key>X</Key> / <Key>V</Key></div></li>
                    <li className="flex items-center justify-between"><span>Delete File</span> <Key>Ctrl/Cmd + D</Key></li>
                    <li className="flex items-center justify-between"><span>Indent (Tab)</span> <Key>Tab</Key></li>
                    <li className="flex items-center justify-between"><span>Navigate suggestions</span> <div><Key>Shift</Key>+<Key>Space</Key> or <ArrowUp className="inline h-4 w-4" /> <ArrowDown className="inline h-4 w-4" /></div></li>
                    <li className="flex items-center justify-between"><span>Select suggestion</span> <div><Key>Enter</Key> or <Key>Tab</Key></div></li>
                    <li className="flex items-center justify-between"><span>Dismiss suggestions</span> <Key>Esc</Key></li>
                 </ul>
            </FeatureCard>
        </div>
    </div>
  );
}
