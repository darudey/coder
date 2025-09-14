
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { File, Folder, Plus, Keyboard, Sparkles, MoveHorizontal, MousePointerClick, CornerDownLeft } from "lucide-react";

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
        <p className="text-muted-foreground">
            24HrCoding is a lightweight, mobile-friendly JavaScript playground packed with powerful features to make coding on the go a breeze.
        </p>
        
        <div className="space-y-4">
            <FeatureCard title="Syntax Highlighting" icon={<Sparkles className="text-primary"/>}>
                <p>The editor automatically color-codes your JavaScript to make it more readable. Different colors are used for keywords, strings, numbers, and comments, helping you spot mistakes at a glance.</p>
                <div className="flex items-center gap-4">
                    <span className="text-blue-600">keywords</span>
                    <span className="text-green-600">'strings'</span>
                    <span className="text-purple-600">123</span>
                    <span className="text-gray-500 italic">// comments</span>
                </div>
            </FeatureCard>

            <FeatureCard title="File System" icon={<Folder className="text-primary"/>}>
                <p>All your code is saved directly in your browser—no account needed! You can organize your work into folders and files.</p>
                <ul className="list-disc pl-5 space-y-1">
                    <li>Click the <Plus className="inline h-4 w-4 mx-1"/> button in the settings panel or the tab bar to create a new file.</li>
                    <li>Double-click a tab to rename a file.</li>
                    <li>Files are grouped into folders in the "Saved Code" section.</li>
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
                    <li className="flex items-center justify-between"><span>Save As</span> <Key>Ctrl/Cmd + S (Not implemented, use button)</Key></li>
                    <li className="flex items-center justify-between"><span>Delete File</span> <Key>Ctrl/Cmd + D</Key></li>
                    <li className="flex items-center justify-between"><span>Indent (Tab)</span> <Key>Tab</Key></li>
                    <li className="flex items-center justify-between"><span>Select suggestion</span> <Key>Enter</Key> or <Key>Tab</Key></li>
                 </ul>
            </FeatureCard>
        </div>
    </div>
  );
}

