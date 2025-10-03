
'use client';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Play, Settings, Save, File, Share2, Home, Book, User, Edit3, Check } from 'lucide-react';
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
} from "@/components/ui/dropdown-menu"
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  onRun?: () => void;
  onSettings?: () => void;
  isCompiling?: boolean;
  onSaveAs?: () => void;
  onShare?: () => void;
  activeFile?: ActiveFile | null;
  hasActiveFile?: boolean;
  variant?: 'default' | 'minimal' | 'page';
  children?: React.ReactNode;
}

const NavItems = () => {
  const { userRole } = useAuth();
  const pathname = usePathname();
  const defaultNavItems = [
    { href: '/', label: 'Compiler', icon: Home },
    { href: '/courses', label: 'Courses', icon: Book },
    { href: '/profile', label: 'Profile', icon: User },
  ];
  const adminNavItems = [
      { href: '/manage-courses', label: 'Manage Courses', icon: Edit3, roles: ['teacher', 'developer'] },
  ];

  const navItems = [
      ...defaultNavItems,
      ...adminNavItems.filter(item => item.roles.includes(userRole || ''))
  ]

  return (
    <div className="p-1">
      {navItems.map(item => (
        <Link href={item.href} key={item.label} passHref>
          <DropdownMenuItem className={cn(
            "my-2 border focus:bg-primary/20 active:bg-primary/30",
            pathname === item.href && "border-primary"
          )}>
            <item.icon className="mr-2 h-4 w-4" />
            <span>{item.label}</span>
          </DropdownMenuItem>
        </Link>
      ))}
    </div>
  )
}


const MemoizedHeader: React.FC<HeaderProps> = ({ 
  onRun, 
  onSettings, 
  isCompiling, 
  onSaveAs, 
  onShare, 
  activeFile, 
  hasActiveFile,
  variant = 'default',
  children,
}) => {
  const MainNav = ({className}: {className?: string}) => (
     <DropdownMenu>
        <DropdownMenuTrigger asChild>
        <div className={cn("flex items-center gap-2 shrink-0 cursor-pointer p-1 rounded-md transition-colors active:bg-primary/20", className)}>
            <LogoIcon className="w-6 h-6" />
            <h1 className="text-base font-bold font-headline text-gray-900 dark:text-gray-100">24HrCoding</h1>
        </div>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="p-0 bg-popover/20 backdrop-blur-sm border-0">
            <NavItems />
        </DropdownMenuContent>
    </DropdownMenu>
  );

  if (variant === 'page') {
    return (
      <header className="bg-background border-b">
        <div className="container mx-auto p-4 md:px-8 md:py-4">
          <div className="flex items-center gap-4">
            <MainNav />
            {children}
          </div>
        </div>
      </header>
    );
  }

  if (variant === 'minimal') {
    return (
      <header className="bg-background">
        <div className={cn("flex items-center justify-between py-2 px-2 gap-2")}>
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
           <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={onShare} disabled={!hasActiveFile} className="h-8 w-8">
                <Share2 className="w-4 h-4" />
                <span className="sr-only">Share</span>
              </Button>
              <Button variant="outline" size="icon" onClick={onSaveAs} disabled={!hasActiveFile} className="h-8 w-8">
                <Save className="w-4 h-4" />
                <span className="sr-only">Save As</span>
              </Button>
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

        <div className="flex items-center gap-1.5 md:gap-2 shrink-0 pr-2">
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
          <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" onClick={onShare} disabled={!hasActiveFile} className="h-8 w-8">
                <Share2 className="w-4 h-4" />
                <span className="sr-only">Share</span>
              </Button>
              <Button variant="outline" size="icon" onClick={onSaveAs} disabled={!hasActiveFile} className="h-8 w-8">
                <Save className="w-4 h-4" />
                <span className="sr-only">Save As</span>
              </Button>
              <Button variant="outline" size="icon" onClick={onSettings} className="h-8 w-8">
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
