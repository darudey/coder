
'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { FC } from 'react';
import React from 'react';

interface CoderKeyboardProps {
  onKeyPress: (key: string) => void;
}

const keyboardLayout = [
  ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
  ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', '( )', '{ }', '[ ]'],
  [' '],
];

const symbolMap: { [key: string]: string } = {
  '`': '~', '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
  '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '"', ',': '<', '.': '>', '/': '?',
};

export const CoderKeyboard: FC<CoderKeyboardProps> = ({ onKeyPress }) => {
  const [shift, setShift] = React.useState(false);

  const handleKeyPress = (key: string) => {
    if (key === 'Shift') {
      setShift(!shift);
      return;
    }
    const keyToSend = shift ? (symbolMap[key.toLowerCase()] || key.toUpperCase()) : key;
    onKeyPress(keyToSend);
    if (shift) setShift(false);
  };
  
  return (
    <div className="bg-black text-white p-1 md:p-2 font-code shadow-2xl rounded-t-lg">
      {keyboardLayout.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1 my-1">
          {row.map((key) => {
            const keyChar = shift ? (symbolMap[key.toLowerCase()] || key.toUpperCase()) : key;
            
            return (
              <Button
                key={key}
                variant="outline"
                className={cn(
                  'h-10 bg-gray-800 text-white border-gray-700 hover:bg-gray-700 active:bg-gray-600 transition-all transform active:scale-95 text-xs md:text-sm px-2',
                  {
                    'w-16 sm:w-24': key === 'Backspace',
                    'w-12 sm:w-16': key === 'Tab',
                    'w-16 sm:w-20': key === 'Enter',
                    'flex-grow': key === ' ',
                  }
                )}
                onClick={() => handleKeyPress(key)}
              >
                {keyChar}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
};
