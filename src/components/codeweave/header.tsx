
'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Settings, Save, File, Share2, Code, Book, User, Edit3, Moon, Sun, Info, HelpCircle, MessageSquare, ChevronDown, Palette, Grid } from 'lucide-react';
import React from 'react';
import type { ActiveFile } from './compiler';
import { DotLoader } from './dot-loader';
import { LogoIcon } from './logo-icon';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu"
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';
import { useSettings } from '@/hooks/use-settings';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { ScrollArea } from '../ui/scroll-area';
import { AboutContent } from './about-content';
import { Slider } from '../ui/slider';
import { Label } from '../ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

interface HeaderProps {
  onRun?: () => void;
  onSettings?: () => void;
  isCompiling?: boolean;
  onSaveToBrowser?: () => void;
  onSaveToDrive?: () => void;
  onShare?: () => void;
  activeFile?: ActiveFile | null;
  hasActiveFile?: boolean;
  variant?: 'default' | 'minimal' | 'page';
  children?: React.ReactNode;
  actions?: React.ReactNode;
}

const NavItems = () => {
  const { user, userRole } = useAuth();
  const pathname = usePathname();
  const { theme, toggleTheme } = useSettings();
  const [effectiveTheme, setEffectiveTheme] = React.useState(theme);
  const [isAboutOpen, setIsAboutOpen] = React.useState(false);

  React.useEffect(() => {
    if (theme === 'system') {
      setEffectiveTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } else {
      setEffectiveTheme(theme);
    }
  }, [theme]);


  const navItems = [
    { href: '/profile', label: 'Profile', icon: User },
    { href: '/courses', label: 'Courses', icon: Book },
    { href: '/', label: 'Compiler', icon: Code },
    { href: '/session', label: 'Session', icon: Grid },
  ];
  
  const adminNavItems = [
    { href: '/manage-courses', label: 'Manage Courses', icon: Edit3, roles: ['teacher', 'developer'] },
    { href: '/ask', label: 'Ask a Question', icon: HelpCircle, roles: ['teacher', 'developer'] },
  ];
  
  const studentNavItems = [
      { href: '/live-answer', label: 'Live Session', roles: ['student'] },
  ]

  const visibleAdminItems = adminNavItems.filter(item => item.roles.includes(userRole || ''));
  const visibleStudentItems = user ? studentNavItems.filter(item => item.roles.includes(userRole || 'student')) : [];


  return (
    <div className="p-1">
      {navItems.map(item => (
        <Link href={item.href} key={item.label} passHref>
          <DropdownMenuItem className={cn(
            "my-1 border focus:bg-primary/20 active:bg-primary/30",
            pathname === item.href && "border-primary"
          )}>
            <item.icon className="mr-2 h-4 w-4" />
            <span>{item.label}</span>
          </DropdownMenuItem>
        </Link>
      ))}
      
      {visibleAdminItems.length > 0 && <DropdownMenuSeparator />}
      
      {visibleAdminItems.map(item => (
         <Link href={item.href} key={item.label} passHref>
            <DropdownMenuItem className={cn(
                "my-1 border focus:bg-primary/20 active:bg-primary/30",
                pathname.startsWith(item.href) && "border-primary"
            )}>
                <item.icon className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
            </DropdownMenuItem>
         </Link>
      ))}

      {visibleStudentItems.length > 0 && <DropdownMenuSeparator />}

       {visibleStudentItems.map(item => (
         <Link href={item.href} key={item.label} passHref>
            <DropdownMenuItem className={cn(
                "my-1 border focus:bg-primary/20 active:bg-primary/30",
                pathname.startsWith(item.href) && "border-primary"
            )}>
                <MessageSquare className="mr-2 h-4 w-4" />
                <span>{item.label}</span>
            </DropdownMenuItem>
         </Link>
      ))}

      <DropdownMenuSeparator />
      
       <Dialog open={isAboutOpen} onOpenChange={setIsAboutOpen}>
          <DialogTrigger asChild>
            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="my-1 border focus:bg-primary/20 active:bg-primary/30">
                <Info className="mr-2 h-4 w-4" />
                <span>About</span>
            </DropdownMenuItem>
          </DialogTrigger>
          <DialogContent className="max-w-2xl h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>About 24HrCoding</DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-grow pr-6 -mr-6">
                <AboutContent />
            </ScrollArea>
          </DialogContent>
        </Dialog>

      <DropdownMenuItem onClick={toggleTheme} className="my-1 border focus:bg-primary/20 active:bg-primary/30">
        {effectiveTheme === 'dark' ? (
          <Sun className="mr-2 h-4 w-4" />
        ) : (
          <Moon className="mr-2 h-4 w-4" />
        )}
        <span>{effectiveTheme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
      </DropdownMenuItem>
    </div>
  )
}


const MemoizedHeader: React.FC<HeaderProps> = ({ 
  onRun, 
  onSettings, 
  isCompiling, 
  onSaveToBrowser, 
  onSaveToDrive,
  onShare, 
  activeFile, 
  hasActiveFile,
  variant = 'default',
  children,
  actions
}) => {
  const { settings, setSettings, toggleTheme } = useSettings();

  const MainNav = ({className}: {className?: string}) => (
     <DropdownMenu>
        <DropdownMenuTrigger asChild>
        <div className={cn("flex items-center gap-2 shrink-0 cursor-pointer p-1 rounded-md transition-colors active:bg-primary/20", className)}>
            <LogoIcon className="w-6 h-6" />
            <h1 className="text-base font-bold font-headline text-gray-900 dark:text-gray-100">24HrCoding</h1>
        </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-0 bg-popover/80 backdrop-blur-sm border-border/50">
            <NavItems />
        </DropdownMenuContent>
    </DropdownMenu>
  );

  const AppearanceMenu = ({className}: {className?: string}) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className={cn("h-8 w-8", className)}>
            <Palette className="w-4 h-4" />
            <span className="sr-only">Appearance</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Appearance</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="p-2">
            <div className="flex items-center justify-between text-sm">
                <Label htmlFor="font-size-slider">Font Size</Label>
                <span className="text-muted-foreground">{settings.editorFontSize}px</span>
            </div>
            <Slider
                id="font-size-slider"
                min={10}
                max={24}
                step={1}
                value={[settings.editorFontSize]}
                onValueChange={(value) => setSettings({ ...settings, editorFontSize: value[0] })}
                className="mt-2"
            />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (variant === 'page') {
    return (
      <header className="bg-background">
        <div className="flex items-center justify-between py-2 px-2 gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <MainNav />
            <div className="flex-1 min-w-0">{children}</div>
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </div>
        <Separator />
      </header>
    );
  }

  const RunButton = () => (
    <TooltipProvider delayDuration={200}>
        <Tooltip>
            <TooltipTrigger asChild>
                <Button onClick={onRun} disabled={isCompiling || !hasActiveFile} className="min-w-[70px] md:min-w-[88px] h-8 px-3">
                    {isCompiling ? (
                    <DotLoader />
                    ) : (
                    <>
                        <Play className="w-4 h-4" />
                        <span className="ml-1.5 hidden sm:inline">Run</span>
                    </>
                    )}
                </Button>
            </TooltipTrigger>
            <TooltipContent>
                <p>Shift + Enter</p>
            </TooltipContent>
        </Tooltip>
    </TooltipProvider>
  )

  if (variant === 'minimal') {
    return (
      <header className="bg-background">
        <div className={cn("flex items-center justify-between py-2 px-2 gap-2")}>
          <RunButton />
           <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={onShare} disabled={!hasActiveFile} className="h-8 w-8">
                <Share2 className="w-4 h-4" />
                <span className="sr-only">Share</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={!hasActiveFile} className="h-8 w-8">
                    <Save className="w-4 h-4" />
                    <span className="sr-only">Save</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onSaveToBrowser}>Save to Browser</DropdownMenuItem>
                  <DropdownMenuItem onClick={onSaveToDrive}>Save to Google Drive</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AppearanceMenu className="hidden md:inline-flex" />
              <Button variant="outline" size="icon" onClick={onSettings} className="h-8 w-8">
                <Settings className="w-4 h-4" />
                <span className="sr-only">Settings</span>
              </Button>
          </div>
        </div>
        <Separator />
      </header>
    )
  }

  return (
    <header className="bg-background">
      <div className={cn(
        "flex items-center justify-between py-2 px-2 gap-2",
      )}>
        <MainNav />
        
        <div className="flex-1 flex justify-center min-w-0 px-2">
          {activeFile && (
              <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground truncate bg-muted px-3 py-1.5 rounded-md">
                  <File className="w-4 h-4 shrink-0" />
                  <span className="truncate">{activeFile.folderName} / {activeFile.fileName}</span>
              </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          <RunButton />
          <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={onShare} disabled={!hasActiveFile} className="h-8 w-8">
                <Share2 className="w-4 h-4" />
                <span className="sr-only">Share</span>
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" disabled={!hasActiveFile} className="h-8 w-8">
                    <Save className="w-4 h-4" />
                     <span className="sr-only">Save</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={onSaveToBrowser}>Save to Browser</DropdownMenuItem>
                  <DropdownMenuItem onClick={onSaveToDrive}>Save to Google Drive</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <AppearanceMenu className="hidden md:inline-flex" />
               <Button variant="outline" size="icon" onClick={toggleTheme} className="h-8 w-8 hidden md:inline-flex">
                <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                <span className="sr-only">Toggle theme</span>
              </Button>
              <Button variant="outline" size="icon" onClick={onSettings} className="h-8 w-8 ml-auto">
                <Settings className="w-4 h-4" />
                <span className="sr-only">Settings</span>
              </Button>
          </div>
        </div>
      </div>
      <Separator />
    </header>
  );
};

export const Header = React.memo(MemoizedHeader);
