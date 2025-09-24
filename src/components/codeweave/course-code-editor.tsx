
'use client';

import { useState, useCallback } from 'react';
import { CodeEditor } from './code-editor';

interface CourseCodeEditorProps {
    initialCode: string;
}

// This is a client-side wrapper for the CodeEditor on the course pages.
// It manages the editor's state locally.
export function CourseCodeEditor({ initialCode }: CourseCodeEditorProps) {
    const [code, setCode] = useState(initialCode);

    // The functions for undo, redo, and delete are not needed for the
    // read-only view in the course pages, so we pass empty functions.
    const handleUndo = useCallback(() => {}, []);
    const handleRedo = useCallback(() => {}, []);
    const handleDeleteFile = useCallback(() => {}, []);

    return (
        <CodeEditor
            code={code}
            onCodeChange={setCode}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onDeleteFile={handleDeleteFile}
            hasActiveFile={false}
        />
    );
}
