
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { File, Folder, Plus, Keyboard, Sparkles, MoveHorizontal, MousePointerClick, CornerDownLeft, Database, Bot, BookOpen, SkipForward, ArrowDown, ArrowUp } from "lucide-react";

export function AboutContent() {

  const FeatureCard = ({ title, icon, badge, children }: { title: string, icon: React.ReactNode, badge?: string, children: React.ReactNode }) => (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          {icon}
          <span className="text-lg">{title}</span>
          {badge && <Badge variant="secondary">{badge}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-2">
        {children}
      </CardContent>
    </Card>
  );

  const Key = ({ children }: { children: React.ReactNode }) => (
    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-md dark:bg-gray-600 dark:text-gray-100 dark:border-gray-500">
      {children}
    </kbd>
  );

  return (
    <div className="space-y-6 text-sm py-4">
        
        <div className="space-y-4">
            <FeatureCard title="Interactive Courses" icon={<BookOpen className="text-primary"/>}>
                <p>Learn web development from the ground up with structured courses. Each chapter includes video lectures, detailed notes, and hands-on coding exercises with automated checks to test your knowledge.</p>
            </FeatureCard>

            <FeatureCard title="Smart Editing" icon={<Sparkles className="text-primary"/>}>
                <p>The editor automatically color-codes your JavaScript to make it more readable and provides intelligent suggestions to speed up your coding.</p>
            </FeatureCard>
            
            <FeatureCard title="Offline-First File System" icon={<Database className="text-primary"/>}>
                <p>All your code is saved directly in your browser using IndexedDB—no account needed! You can organize your work into folders and files, and it's all available even when you're offline.</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Click the <Plus className="inline h-4 w-4 mx-1"/> button in the settings panel or the tab bar to create a new file.</li>
                    <li>Double-click a tab to rename a file.</li>
                </ul>
            </FeatureCard>

             <FeatureCard title="AI-Powered Features" icon={<Bot className="text-primary"/>}>
                <p>Leveraging Google's Gemini models via Genkit, the app offers AI-driven error checking to help you find and fix bugs faster.</p>
            </FeatureCard>
            
            <FeatureCard title="Quick-Jump" icon={<SkipForward className="text-primary"/>} badge="Desktop">
                <p>Quickly navigate through your code with these spacebar-powered shortcuts.</p>
                 <ul className="list-disc pl-5 space-y-2">
                    <li><strong className="flex items-center gap-2">Jump Forward:</strong> Press <Key>Shift</Key> or <Key>Alt</Key> + <Key>Space</Key> to jump the cursor to the beginning of the next word, symbol, or block of spaces.</li>
                    <li><strong className="flex items-center gap-2">Cycle Suggestions:</strong> When the suggestion box is open, press <Key>Shift</Key> + <Key>Space</Key> to cycle through the available autocomplete suggestions.</li>
                    <li><strong className="flex items-center gap-2">Jump Out of Pairs:</strong> When your cursor is just inside a closing symbol like `)` or `'''`, press <Key>Space</Key> three times quickly to jump the cursor just outside of it.</li>
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
                    <li className="flex items-center justify-between"><span>Undo</span> <Key>Ctrl/Cmd + Z</Key></li>
                    <li className="flex items-center justify-between"><span>Redo</span> <Key>Ctrl/Cmd + Y</Key></li>
                    <li className="flex items-center justify-between"><span>Copy Line</span> <Key>Ctrl/Cmd + C</Key></li>
                    <li className="flex items-center justify-between"><span>Cut Line</span> <Key>Ctrl/Cmd + X</Key></li>
                    <li className="flex items-center justify-between"><span>Paste</span> <Key>Ctrl/Cmd + V</Key></li>
                    <li className="flex items-center justify-between"><span>Delete File</span> <Key>Ctrl/Cmd + D</Key></li>
                    <li className="flex items-center justify-between"><span>Indent (Tab)</span> <Key>Tab</Key></li>
                    <li className="flex items-center justify-between"><span>Navigate suggestions</span> <div><ArrowUp className="inline h-4 w-4" /> <ArrowDown className="inline h-4 w-4" /></div></li>
                    <li className="flex items-center justify-between"><span>Select suggestion</span> <div><Key>Enter</Key> or <Key>Tab</Key></div></li>
                 </ul>
            </FeatureCard>

             <FeatureCard title="Virtual Keyboard Shortcuts" icon={<Keyboard className="text-primary" />} badge="Mobile">
                 <p>Use the <Key>Ctrl</Key> key on the virtual keyboard to activate shortcuts for common actions.</p>
                 <ul className="space-y-2">
                    <li className="flex items-center justify-between"><span>Undo / Redo</span> <div><Key>Ctrl</Key> + <Key>Z</Key> / <Key>Y</Key></div></li>
                    <li className="flex items-center justify-between"><span>Select All</span> <div><Key>Ctrl</Key> + <Key>A</Key></div></li>
                     <li className="flex items-center justify-between"><span>Copy / Cut / Paste</span> <div><Key>Ctrl</Key> + <Key>C</Key> / <Key>X</Key> / <Key>V</Key></div></li>
                    <li className="flex items-center justify-between"><span>Bold / Italic / Underline</span> <div><Key>Ctrl</Key> + <Key>B</Key> / <Key>I</Key> / <Key>U</Key></div></li>
                 </ul>
            </FeatureCard>
        </div>
    </div>
  );
}
