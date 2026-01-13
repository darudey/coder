
'use client';

import React from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User, Users, LogOut, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useRealtimeConfig } from '@/hooks/use-realtime-config';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';

export interface ConnectedUser {
  id: string;
  name: string;
  isGuest: boolean;
  isAdmin: boolean;
}

interface PresenceDisplayProps {
  users: ConnectedUser[];
  className?: string;
  onDisconnect: () => void;
}

export const PresenceDisplay: React.FC<PresenceDisplayProps> = ({ users, className, onDisconnect }) => {
  const { debounceDelay, setDebounceDelay } = useRealtimeConfig();

  if (users.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div className={cn("flex items-center gap-2 text-sm text-muted-foreground truncate bg-muted px-3 py-1.5 rounded-md cursor-pointer", className)}>
            <Users className="w-4 h-4" />
            <span>{users.length} Connected</span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-64">
        <DropdownMenuLabel>Connected Users</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {users.map(user => (
          <DropdownMenuItem key={user.id} className="gap-2">
            <Avatar className="h-6 w-6">
                <AvatarFallback>
                    {user.isGuest ? <User className="h-4 w-4" /> : user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <span className={cn("truncate", user.isGuest && "italic text-muted-foreground")}>{user.name}</span>
            {user.isAdmin && <Crown className="w-4 h-4 text-amber-500 ml-auto" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <div className="p-2">
            <div className="flex items-center justify-between text-sm">
                <Label htmlFor="debounce-delay-slider-presence">Sync Delay</Label>
                <span className="text-muted-foreground">{debounceDelay}ms</span>
            </div>
            <Slider
                id="debounce-delay-slider-presence"
                min={50}
                max={2000}
                step={50}
                value={[debounceDelay]}
                onValueChange={(value) => setDebounceDelay(value[0])}
                className="mt-2"
            />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDisconnect} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
