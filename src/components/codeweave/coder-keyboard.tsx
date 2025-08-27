
'use client';

import { Button } from '@/components/ui/button';
import type { FC } from 'react';

interface CoderKeyboardProps {
  onKeyPress: (key: string) => void;
}

const keys = [
  '( )', '=>', '{ }', '[ ]', ';',
  '.', ',', "' '", '" "', '` `',
  'const', 'let', 'function', 'console.log'
];

const processKey = (key: string): string => {
  if (key.includes(' ')) {
    const parts = key.split(' ');
    if (parts.length === 2 && parts[1] !== '') {
      return parts[0] + parts[1];
    }
    return key;
  }
  return key;
};

export const CoderKeyboard: FC<CoderKeyboardProps> = ({ onKeyPress }) => {
  return (
    <div className="bg-muted/50 p-2">
      <p className="text-xs text-muted-foreground mb-2 px-1">Coder Keyboard</p>
      <div className="grid grid-cols-5 gap-2">
        {keys.map((key) => (
          <Button
            key={key}
            variant="outline"
            size="sm"
            className="font-code text-xs md:text-sm h-8 bg-background transition-transform transform active:scale-95"
            onClick={() => onKeyPress(key.includes(' ') ? key.split(' ')[0] : key)}
          >
            {processKey(key)}
          </Button>
        ))}
      </div>
    </div>
  );
};
