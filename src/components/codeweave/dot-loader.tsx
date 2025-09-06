import { cn } from '@/lib/utils';
import type { FC } from 'react';

interface DotLoaderProps {
  className?: string;
}

export const DotLoader: FC<DotLoaderProps> = ({ className }) => {
  return (
    <div className={cn("flex w-full items-center justify-center gap-1", className)}>
      <div className="h-2 w-2 rounded-full bg-current animate-bounce-dot-1"></div>
      <div className="h-2 w-2 rounded-full bg-current animate-bounce-dot-2"></div>
      <div className="h-2 w-2 rounded-full bg-current animate-bounce-dot-3"></div>
    </div>
  );
};
