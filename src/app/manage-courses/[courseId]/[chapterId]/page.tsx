

'use client';

import { type Topic, type NoteSegment, type PracticeQuestion } from '@/lib/courses-data';
import Link from 'next/link';
import { notFound, useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronLeft, Video, StickyNote, Code, BrainCircuit, Save, Plus, Trash2, ArrowUp, ArrowDown, Play, Check, Loader2, Bold, Italic, List, ChevronDown as ChevronDownIcon, Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Compiler, type CompilerRef, type RunResult } from '@/components/codeweave/compiler';
import React, { useRef, useState, useEffect, useImperativeHandle, useCallback } from 'react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
  } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { nanoid } from 'nanoid';
import { useCourses } from '@/hooks/use-courses';
import { ChevronRight } from 'lucide-react';
import { DotLoader } from '@/components/codeweave/dot-loader';
import { LoadingPage } from '@/components/loading-page';
import { NoteCodeEditor, type NoteCodeEditorRef } from '@/components/codeweave/note-code-editor';
import { Header } from '@/components/codeweave/header';
import { db } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useIsMobile } from '@/hooks/use-mobile';
import { CoderKeyboard } from '@/components/codeweave/coder-keyboard';
import { cn } from '@/lib/utils';


interface MarkdownEditorRef {
  getValue: () => string;
}

const MarkdownEditor = React.forwardRef<MarkdownEditorRef, { initialValue: string; onContentChange: () => void; }>(({ initialValue, onContentChange }, ref) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [history, setHistory] = useState([initialValue]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const value = history[historyIndex];

    const isMobile = useIsMobile();
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const [ctrlActive, setCtrlActive] = useState(false);


    useImperativeHandle(ref, () => ({
        getValue: () => value,
    }));
    
    useEffect(() => {
        setHistory([initialValue]);
        setHistoryIndex(0);
    }, [initialValue]);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
        }
    }, [value]);

    const handleChange = (newValue: string) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newValue);
        setHistory(newHistory);
        setHistoryIndex(i => i + 1);
        onContentChange();
    };

    const undo = () => { if (historyIndex > 0) setHistoryIndex(i => i - 1); }
    const redo = () => { if (historyIndex < history.length - 1) setHistoryIndex(i => i + 1); }
    
    const applyFormat = (syntax: { prefix: string; suffix?: string; }) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = value.substring(start, end);

        let newValue, newCursorPosition;

        if (selectedText) {
            newValue = `${value.substring(0, start)}${syntax.prefix}${selectedText}${syntax.suffix || ''}${value.substring(end)}`;
            newCursorPosition = end + syntax.prefix.length + (syntax.suffix?.length || 0);
        } else {
            newValue = `${value.substring(0, start)}${syntax.prefix}${syntax.suffix || ''}${value.substring(end)}`;
            newCursorPosition = start + syntax.prefix.length;
        }

        handleChange(newValue);
        
        requestAnimationFrame(() => {
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = newCursorPosition;
        });
    };

    const handleKeyPress = async (key: string) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        if (key === 'Ctrl') {
            setCtrlActive(prev => !prev);
            return;
        }

        if (ctrlActive) {
            setCtrlActive(false);
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            switch (key.toLowerCase()) {
                case 'a': textarea.select(); break;
                case 'z': undo(); break;
                case 'y': redo(); break;
                case 'c':
                    if (start !== end) await navigator.clipboard.writeText(value.substring(start, end));
                    break;
                case 'x':
                    if (start !== end) {
                        await navigator.clipboard.writeText(value.substring(start, end));
                        const newValue = value.substring(0, start) + value.substring(end);
                        handleChange(newValue);
                        requestAnimationFrame(() => { textarea.selectionStart = textarea.selectionEnd = start; });
                    }
                    break;
                case 'v':
                    const text = await navigator.clipboard.readText();
                    const newValue = value.substring(0, start) + text + value.substring(end);
                    handleChange(newValue);
                    requestAnimationFrame(() => {
                        const newCursorPos = start + text.length;
                        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
                    });
                    break;
                case 'b': applyFormat({ prefix: '**', suffix: '**' }); break;
                case 'i': applyFormat({ prefix: '*', suffix: '*' }); break;
                case 'l': applyFormat({ prefix: '- ' }); break;
            }
            return;
        }

        if (key === 'Enter') {
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const newValue = value.substring(0, start) + '\n' + value.substring(end);
            handleChange(newValue);
            requestAnimationFrame(() => { textarea.selectionStart = textarea.selectionEnd = start + 1; });
            return;
        }

        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        let newValue, newCursorPosition;
        
        if (key === 'Backspace') {
            if (start === end && start > 0) {
              newValue = value.substring(0, start - 1) + value.substring(end);
              newCursorPosition = start - 1;
            } else {
              newValue = value.substring(0, start) + value.substring(end);
              newCursorPosition = start;
            }
        } else if (!['Shift', 'CapsLock'].includes(key)){
            newValue = value.substring(0, start) + key + value.substring(end);
            newCursorPosition = start + key.length;
        } else {
            return;
        }

        handleChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = newCursorPosition;
          textarea.selectionEnd = newCursorPosition;
          textarea.focus();
        });
    }

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const textarea = textareaRef.current;
        if (!textarea) return;

        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const textAfter = value.substring(start);
            const pairMap: {[key:string]: string} = { '**': '**', '*': '*', '`': '`', '(': ')', '{': '}', '[': ']' };

            let jumped = false;
            for (const key in pairMap) {
                if (textAfter.startsWith(pairMap[key])) {
                    const newCursorPos = start + pairMap[key].length;
                     // Check if we are right before this pair
                    const textBefore = value.substring(0, start);
                    if (textBefore.endsWith(key)) {
                        textarea.selectionStart = textarea.selectionEnd = newCursorPos;
                        jumped = true;
                        break;
                    }
                }
            }

            if (!jumped) {
                applyFormat({ prefix: '  ' }); // Default to indent
            }
            return;
        }

        if (e.ctrlKey || e.metaKey) {
            switch(e.key.toLowerCase()) {
                case 'b': e.preventDefault(); applyFormat({ prefix: '**', suffix: '**' }); break;
                case 'i': e.preventDefault(); applyFormat({ prefix: '*', suffix: '*' }); break;
                case 'l': e.preventDefault(); applyFormat({ prefix: '- ' }); break;
                case 'h': e.preventDefault(); /* Open dropdown or cycle through headers */ break;
                case 'z': e.preventDefault(); undo(); break;
                case 'y': e.preventDefault(); redo(); break;
            }
        }
        if (e.key === 'Enter' && e.shiftKey) {
            e.preventDefault();
            applyFormat({prefix: '<br />\n'});
        }
    };


    return (
        <div className="border rounded-md">
            <div className="flex items-center gap-1 p-2 border-b bg-muted/50">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                         <Button variant="ghost" size="sm" className="gap-1">
                            Headlines <ChevronDownIcon className="w-4 h-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuItem onClick={() => applyFormat({ prefix: '# ' })}>H1</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => applyFormat({ prefix: '## ' })}>H2</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => applyFormat({ prefix: '### ' })}>H3</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => applyFormat({ prefix: '**', suffix: '**' })}><Bold className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => applyFormat({ prefix: '*', suffix: '*' })}><Italic className="w-4 h-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => applyFormat({ prefix: '- ' })}><List className="w-4 h-4" /></Button>
            </div>
             <Textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onClick={() => { if(isMobile) setIsKeyboardVisible(true) }}
                inputMode={isMobile ? 'none' : 'text'}
                className="min-h-[120px] w-full overflow-hidden resize-none rounded-t-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0 p-4"
                rows={1}
            />
            {isMobile && isKeyboardVisible && (
                <div id="coder-keyboard" className={cn(
                    "fixed bottom-0 left-0 right-0 z-50 transition-transform duration-300 ease-in-out",
                    isKeyboardVisible ? "translate-y-0" : "translate-y-full"
                )}>
                    <CoderKeyboard 
                        onKeyPress={handleKeyPress}
                        ctrlActive={ctrlActive}
                        onHide={() => setIsKeyboardVisible(false)}
                        isSuggestionsOpen={false}
                        onNavigateSuggestions={() => {}}
                        onSelectSuggestion={() => {}}
                    />
                </div>
            )}
        </div>
    )
});
MarkdownEditor.displayName = 'MarkdownEditor';


interface ManageTopicPageProps {
  params: {
    courseId: string;
    chapterId: string;
  };
}

export default function ManageTopicPage({ params: propsParams }: ManageTopicPageProps) {
  const params = useParams() as { courseId: string; chapterId: string };
  const { toast } = useToast();
  const { courses, updateTopic, loading } = useCourses();
  
  const [isCompiling, setIsCompiling] = useState(false);
  
  const syntaxCompilerRef = useRef<CompilerRef>(null);
  const solutionCompilerRef = useRef<CompilerRef>(null);
  const practiceInitialCodeRefs = useRef<{[key: string]: CompilerRef | null}>({});
  const noteSegmentRefs = useRef<{[key: string]: NoteCodeEditorRef | MarkdownEditorRef | null}>({});


  const course = !loading ? courses.find((c) => c.id === params.courseId) : undefined;
  const chapter = !loading ? course?.chapters.find((ch) => ch.id === params.chapterId) : undefined;
  
  const [topic, setTopic] = useState<Topic | undefined>(undefined);
  
  const [activeTab, setActiveTab] = useState('video');
  const [practiceQuestionIndex, setPracticeQuestionIndex] = useState(0);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!loading && course && chapter) {
        const initialTopic = chapter.topics.find(t => t.id === chapter.id) || chapter.topics[0];
        if (initialTopic) {
            setTopic(JSON.parse(JSON.stringify(initialTopic)));
        } else {
            notFound();
        }
        setHasUnsavedChanges(false);
    }
  }, [course, chapter, loading]);

  useEffect(() => {
      setPracticeQuestionIndex(0);
  }, [topic?.id])
  
  const markAsDirty = () => setHasUnsavedChanges(true);

  if (loading || !course || !chapter || !topic) {
    return <LoadingPage />;
  }
  
  const handleTopicTitleChange = (value: string) => {
    if (!topic) return;
    setTopic(prevTopic => ({ ...prevTopic!, title: value }));
    markAsDirty();
  };
  
  const handleFieldChange = (field: keyof Topic, value: any) => {
    if (!topic) return;
    setTopic(prevTopic => ({ ...prevTopic!, [field]: value }));
    markAsDirty();
  };
  
  const handlePracticeQuestionChange = (index: number, field: keyof PracticeQuestion, value: string) => {
    if (!topic) return;
    const newPractice = [...topic.practice];
    newPractice[index] = { ...newPractice[index], [field]: value };
    setTopic(prevTopic => ({ ...prevTopic!, practice: newPractice }));
    markAsDirty();
  };

  const handleRunSolution = async () => {
    if (solutionCompilerRef.current) {
        setIsCompiling(true);
        const result = await solutionCompilerRef.current.run();
        handlePracticeQuestionChange(practiceQuestionIndex, 'expectedOutput', result.output);
        setIsCompiling(false);
        toast({
            title: "Expected Output Updated",
            description: "The output from the solution code has been saved.",
        })
    }
  }

  const handleAddPracticeQuestion = () => {
    if (!topic) return;
    const newPractice = [...topic.practice, { id: nanoid(), question: '', initialCode: '// Your code here', solutionCode: '// Your solution here', expectedOutput: '' }];
    setTopic(prevTopic => ({ ...prevTopic!, practice: newPractice }));
    setPracticeQuestionIndex(newPractice.length - 1);
    markAsDirty();
  }

  const handleDeletePracticeQuestion = (index: number) => {
    if (!topic) return;
    const newPractice = topic.practice.filter((_, i) => i !== index);
    if (practiceQuestionIndex >= index && practiceQuestionIndex > 0) {
        setPracticeQuestionIndex(p => p - 1);
    }
    setTopic(prevTopic => ({ ...prevTopic!, practice: newPractice }));
    markAsDirty();
  }

  const handleAddNoteSegment = (type: 'html' | 'code', index: number) => {
    if (!topic) return;
    const newSegment: NoteSegment = { type, content: '' };
    const newNotes = [...topic.notes];
    newNotes.splice(index + 1, 0, newSegment);
    setTopic(prevTopic => ({ ...prevTopic!, notes: newNotes }));
    markAsDirty();
  }

  const handleDeleteNoteSegment = (index: number) => {
    if (!topic) return;
    const newNotes = topic.notes.filter((_, i) => i !== index);
    setTopic(prevTopic => ({ ...prevTopic!, notes: newNotes }));
    markAsDirty();
  }

  const handleMoveNoteSegment = (index: number, direction: 'up' | 'down') => {
    if (!topic) return;
    const newNotes = [...topic.notes];
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= newNotes.length) return;
    const [movedItem] = newNotes.splice(index, 1);
    newNotes.splice(newIndex, 0, movedItem);
    setTopic(prevTopic => ({ ...prevTopic!, notes: newNotes }));
    markAsDirty();
  };

  const handlePrevQuestion = () => {
    setPracticeQuestionIndex(prev => Math.max(0, prev - 1));
  }

  const handleNextQuestion = () => {
    setPracticeQuestionIndex(prev => Math.min((topic.practice?.length || 0) - 1, prev + 1));
  }

  const handleSaveChanges = async () => {
    if (!topic || !course || !chapter) return;
    setIsSaving(true);
    
    // Construct the final topic object by gathering data from refs
    const finalTopic: Topic = { ...topic };

    // Get syntax code
    if (syntaxCompilerRef.current) {
        finalTopic.syntax = syntaxCompilerRef.current.getCode();
    }
    
    // Get notes content
    finalTopic.notes = topic.notes.map((segment, index) => {
        const segmentRef = noteSegmentRefs.current[`note-${index}`];
        if (segmentRef) {
            return { ...segment, content: segmentRef.getValue() };
        }
        return segment;
    });

    // Get practice question codes
    finalTopic.practice = topic.practice.map(pq => {
        const initialCodeRef = practiceInitialCodeRefs.current[`initial-${pq.id}`];
        const solutionCode = solutionCompilerRef.current?.getCode(); // This will only get the current one
        
        let updatedPq = {...pq};
        if (initialCodeRef) {
            updatedPq.initialCode = initialCodeRef.getCode();
        }
        if (pq.id === currentPracticeQuestion?.id && solutionCode) {
            updatedPq.solutionCode = solutionCode;
        }

        return updatedPq;
    });

    // Create an updated course object to save to DB
    const updatedCourse = {
        ...course,
        chapters: course.chapters.map(chap => {
            if (chap.id !== chapter.id) return chap;
            return {
                ...chap,
                topics: chap.topics.map(t => t.id === finalTopic.id ? finalTopic : t)
            };
        })
    };
    
    try {
        await setDoc(doc(db, 'courses', course.id), updatedCourse);
        
        // Also update the local global state for immediate consistency on other pages
        updateTopic(course.id, chapter.id, finalTopic.id, finalTopic);
        
        setIsSaving(false);
        setHasUnsavedChanges(false);
        toast({
            title: "Changes Saved",
            description: "Your topic has been successfully updated.",
        });
    } catch (e) {
        console.error("Failed to save changes: ", e);
        setIsSaving(false);
        toast({
            title: "Error Saving",
            description: "Could not save your changes. Please try again.",
            variant: "destructive",
        });
    }
  }

  const currentPracticeQuestion = topic.practice?.[practiceQuestionIndex];

  return (
    <>
      <Header variant="page">
        <div className="border rounded-md px-4 py-1.5 bg-muted min-w-0">
            <Input 
                className="text-base sm:text-lg lg:text-xl font-bold tracking-tight h-auto p-0 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent truncate"
                value={topic.title}
                onChange={(e) => handleTopicTitleChange(e.target.value)}
            />
        </div>
      </Header>

      <div className="container mx-auto px-4 md:px-8">
        <p className="text-muted-foreground text-sm mt-1">{chapter.title}</p>
      </div>

      <div className="flex flex-col mt-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} defaultValue="video">
            <TabsList className="grid w-full grid-cols-4 mx-auto max-w-xl sticky top-0 bg-background z-30 border-b">
                <TabsTrigger value="video" className="active:bg-primary/20"><Video className="w-4 h-4 mr-2" />Video</TabsTrigger>
                <TabsTrigger value="notes" className="active:bg-primary/20"><StickyNote className="w-4 h-4 mr-2" />Notes</TabsTrigger>
                <TabsTrigger value="syntax" className="active:bg-primary/20"><Code className="w-4 h-4 mr-2" />Syntax</TabsTrigger>
                <TabsTrigger value="practice" className="active:bg-primary/20"><BrainCircuit className="w-4 h-4 mr-2" />Practice</TabsTrigger>
            </TabsList>
            <div className="pb-8">
                <TabsContent value="video" className="mt-4 px-4 md:px-8">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Lecture Video</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label htmlFor="video-url">YouTube Video URL</Label>
                                <Input 
                                    id="video-url" 
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    value={topic.videoUrl || ''}
                                    onChange={(e) => handleFieldChange('videoUrl', e.target.value)}
                                />
                            </div>
                            <div className="w-full aspect-video bg-muted rounded-md flex items-center justify-center max-w-3xl">
                                <p className="text-muted-foreground">Video preview placeholder</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="notes" className="mt-0">
                    <Card className="rounded-none border-x-0">
                        <CardHeader>
                            <CardTitle className="text-sm">Topic Notes</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4 p-0">
                            {(topic.notes || []).map((segment, index) => (
                                <div key={segment.type + index} className="relative group border-y note-editor-segment overflow-hidden">
                                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-background p-1 rounded-md border z-10">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveNoteSegment(index, 'up')} disabled={index === 0}>
                                            <ArrowUp className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleMoveNoteSegment(index, 'down')} disabled={index === topic.notes.length - 1}>
                                            <ArrowDown className="w-4 h-4" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteNoteSegment(index)}>
                                            <Trash2 className="w-4 h-4 text-destructive" />
                                        </Button>
                                    </div>

                                    {segment.type === 'html' ? (
                                        <div className="p-4">
                                            <MarkdownEditor
                                                ref={ref => { if(ref) noteSegmentRefs.current[`note-${index}`] = ref; }}
                                                key={`md-${topic.id}-${index}`}
                                                initialValue={segment.content}
                                                onContentChange={markAsDirty}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <Label className="px-4 pt-2 text-xs text-muted-foreground">Code Block</Label>
                                            <NoteCodeEditor
                                                ref={ref => { if(ref) noteSegmentRefs.current[`note-${index}`] = ref; }}
                                                key={`code-${topic.id}-${index}`}
                                                id={`note-code-editor-${index}`}
                                                initialCode={segment.content}
                                                onContentChange={markAsDirty}
                                            />
                                        </div>
                                    )}

                                    <div className="absolute bottom-[-16px] left-1/2 -translate-x-1/2 w-full flex justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <div className="flex items-center bg-background p-1 rounded-full border shadow-md">
                                            <Button variant="ghost" size="sm" onClick={() => handleAddNoteSegment('html', index)}>
                                                <Plus className="w-3 h-3 mr-1" /> Markdown
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleAddNoteSegment('code', index)}>
                                                <Plus className="w-3 h-3 mr-1" /> Code
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                             {(topic.notes?.length || 0) === 0 && (
                                <div className="text-center text-muted-foreground p-4 border-2 border-dashed rounded-md m-4">
                                    <p>No content yet. Add your first block.</p>
                                     <div className="flex items-center justify-center gap-2 mt-2">
                                        <Button variant="outline" size="sm" onClick={() => handleAddNoteSegment('html', -1)}>
                                            <Plus className="w-3 h-3 mr-1" /> Add Markdown
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={() => handleAddNoteSegment('code', -1)}>
                                            <Plus className="w-3 h-3 mr-1" /> Add Code
                                        </Button>
                                    </div>
                                </div>
                             )}
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="syntax" className="mt-4 h-full">
                     <Card className="h-full flex flex-col rounded-none border-x-0">
                        <CardHeader>
                            <CardTitle className="text-sm px-6">Syntax Example</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-grow overflow-auto p-0">
                            <div className="h-full min-h-[400px]">
                                <Compiler 
                                    ref={syntaxCompilerRef}
                                    onCodeChange={markAsDirty}
                                    initialCode={topic.syntax} 
                                    variant="minimal" 
                                    hideHeader 
                                    key={`syntax-compiler-${topic.id}`}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="practice" className="mt-4 h-full">
                    {currentPracticeQuestion ? (
                        <>
                            <Card className="rounded-none border-x-0 border-t-0">
                                <CardHeader>
                                    <div className="flex justify-between items-center mb-4">
                                        <CardTitle className="text-sm">Practice Questions</CardTitle>
                                        <div className="flex gap-2">
                                            <Button variant="outline" size="icon" onClick={handlePrevQuestion} disabled={practiceQuestionIndex === 0}>
                                                <ChevronLeft className="w-4 h-4" />
                                            </Button>
                                            <Button variant="outline" size="icon" onClick={handleNextQuestion} disabled={practiceQuestionIndex === (topic.practice?.length || 0) - 1}>
                                                <ChevronRight className="w-4 h-4" />
                                            </Button>
                                            <Button variant="outline" onClick={handleAddPracticeQuestion}>
                                                <Plus className="w-4 h-4 mr-2" /> Add
                                            </Button>
                                            <Button variant="destructive" size="icon" onClick={() => handleDeletePracticeQuestion(practiceQuestionIndex)} disabled={(topic.practice?.length || 0) <= 1}>
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor={`pq-question-${practiceQuestionIndex}`}>Question {practiceQuestionIndex + 1}</Label>
                                        <Textarea 
                                            id={`pq-question-${practiceQuestionIndex}`}
                                            placeholder="What does this code do?"
                                            value={currentPracticeQuestion.question}
                                            onChange={(e) => handlePracticeQuestionChange(practiceQuestionIndex, 'question', e.target.value)}
                                        />
                                    </div>
                                </CardHeader>
                            </Card>
                            <div className="grid grid-cols-1 md:grid-cols-2">
                                <Card className="h-full flex flex-col rounded-none border-x-0">
                                    <CardHeader><CardTitle className="text-sm">Initial Code (for student)</CardTitle></CardHeader>
                                    <CardContent className="flex-grow overflow-auto p-0">
                                        <div className="h-full min-h-[300px]">
                                            <Compiler 
                                                ref={ref => { practiceInitialCodeRefs.current[`initial-${currentPracticeQuestion.id}`] = ref; }}
                                                onCodeChange={markAsDirty}
                                                initialCode={currentPracticeQuestion.initialCode} 
                                                variant="minimal" hideHeader 
                                                key={`initial-${currentPracticeQuestion.id}`}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                                 <Card className="h-full flex flex-col rounded-none border-x-0 border-l">
                                    <CardHeader className="flex flex-row items-center justify-between">
                                        <CardTitle className="text-sm">Solution Code</CardTitle>
                                        <Button size="sm" onClick={handleRunSolution} disabled={isCompiling}>
                                            {isCompiling ? <DotLoader /> : <Play className="w-4 h-4 mr-2" />}
                                            Run to Get Output
                                        </Button>
                                    </CardHeader>
                                    <CardContent className="flex-grow overflow-auto p-0">
                                        <div className="h-full min-h-[300px]">
                                            <Compiler
                                                ref={solutionCompilerRef}
                                                onCodeChange={markAsDirty}
                                                initialCode={currentPracticeQuestion.solutionCode}
                                                variant="minimal" hideHeader
                                                key={`solution-${currentPracticeQuestion.id}`}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                             <Card className="h-full flex flex-col rounded-none border-x-0 border-t">
                                <CardHeader><CardTitle className="text-sm">Expected Output (Auto-generated)</CardTitle></CardHeader>
                                <CardContent className="flex-grow overflow-auto p-4 bg-muted/50">
                                    <Textarea
                                        className="w-full h-full min-h-[100px] resize-none focus-visible:ring-0 focus-visible:ring-offset-0 border-0 p-0 font-code text-sm bg-transparent"
                                        value={currentPracticeQuestion.expectedOutput}
                                        readOnly
                                        placeholder="Run the solution code to generate this..."
                                    />
                                </CardContent>
                            </Card>
                        </>
                    ) : (
                        <div className="text-center text-muted-foreground p-8">
                            <p>No practice questions for this topic yet.</p>
                            <Button className="mt-4" onClick={handleAddPracticeQuestion}>
                                <Plus className="w-4 h-4 mr-2" />
                                Add First Question
                            </Button>
                        </div>
                    )}
                </TabsContent>
            </div>
            <div className="container mx-auto px-4 md:px-8">
                 <Button asChild variant="outline" size="sm">
                    <Link href={`/manage-courses/${course.id}`}>
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Back to Chapters
                    </Link>
                </Button>
            </div>
        </Tabs>
        <div className="h-[75vh]" />
      </div>

      <div className="fixed top-20 right-8 z-50">
        {!hasUnsavedChanges ? (
            <Button disabled size="lg" className="rounded-full shadow-lg">
                <Check className="w-5 h-5 mr-2" />
                Saved
            </Button>
        ) : (
            <Button onClick={handleSaveChanges} disabled={isSaving} size="lg" className="rounded-full shadow-lg">
                {isSaving ? (
                    <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Saving...
                    </>
                ) : (
                    <>
                        <Save className="w-5 h-5 mr-2" />
                        Save Changes
                    </>
                )}
            </Button>
        )}
      </div>
    </>
  );
}

// Add onCodeChange to Compiler props
declare module '@/components/codeweave/compiler' {
    interface CompilerProps {
        onCodeChange?: () => void;
    }
}

    
