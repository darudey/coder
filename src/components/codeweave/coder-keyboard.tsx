
'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { EyeOff } from 'lucide-react';
import React, { useRef, useState } from 'react';
import type { FC } from 'react';

interface CoderKeyboardProps {
  onKeyPress: (key: string) => void;
  ctrlActive?: boolean;
  onHide: () => void;
  isSuggestionsOpen: boolean;
  onNavigateSuggestions: (direction: 'next' | 'prev') => void;
  onSelectSuggestion: () => void;
}

const keyboardLayout = [
    ['(', '{', '[', '`', "'", '/', ')','}','_','+','EyeOff'],
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
    ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '\\'],
    ['CapsLock', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'Enter'],
    ['Shift', 'z', 'x', 'c', 'v', 'b', 'n', 'm', 'Shift'],
    ['Ctrl', ' ', ";", '"', '.', '<'],
];

const symbolMap: { [key: string]: string } = {
  '`': '~', '1': '!', '2': '@', '3': '#', '4': '$', '5': '%', '6': '^', '7': '&', '8': '*', '9': '(', '0': ')',
  '-': '_', '=': '+', '[': '{', ']': '}', '\\': '|', ';': ':', "'": '<', ',': '<', '.': '>', '/': '?',
};

export const CoderKeyboard: FC<CoderKeyboardProps> = ({ 
    onKeyPress, 
    ctrlActive, 
    onHide,
    isSuggestionsOpen,
    onNavigateSuggestions,
    onSelectSuggestion,
}) => {
  const [shift, setShift] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const spacebarInteraction = useRef({
    isDragging: false,
    startX: 0,
    lastX: 0,
    threshold: 10, // Min pixels to move before it's a drag
    didMove: false,
  });

  const handleSpacebarDown = (e: React.MouseEvent | React.TouchEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    spacebarInteraction.current.isDragging = true;
    spacebarInteraction.current.startX = clientX;
    spacebarInteraction.current.lastX = clientX;
    spacebarInteraction.current.didMove = false;
  };

  const handleSpacebarMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!spacebarInteraction.current.isDragging) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const { lastX, threshold } = spacebarInteraction.current;
    const deltaX = clientX - lastX;

    if (Math.abs(deltaX) > threshold) {
        if (isSuggestionsOpen) {
            if (deltaX > 0) {
                onNavigateSuggestions('next');
            } else {
                onNavigateSuggestions('prev');
            }
        } else {
            if (deltaX > 0) {
                onKeyPress('ArrowRight');
            } else {
                onKeyPress('ArrowLeft');
            }
        }
        spacebarInteraction.current.lastX = clientX;
        spacebarInteraction.current.didMove = true;
    }
  };
  
  const handleSpacebarUp = () => {
    if (spacebarInteraction.current.isDragging && !spacebarInteraction.current.didMove) {
        if (isSuggestionsOpen) {
            onSelectSuggestion();
        } else {
            onKeyPress(' ');
        }
    }
    spacebarInteraction.current.isDragging = false;
    spacebarInteraction.current.didMove = false;
  };

  const handleKeyPress = (key: string) => {
    if (key === 'Shift') {
      setShift(!shift);
      return;
    }
    if (key === 'CapsLock') {
        setCapsLock(!capsLock);
        return;
    }
    if (key === 'EyeOff') {
        onHide();
        return;
    }

    let keyToSend = key;
    const isLetter = /^[a-z]$/i.test(key);

    if (isLetter) {
        if (shift || capsLock) {
            keyToSend = key.toUpperCase();
            if (shift) {
                setShift(false);
            }
        } else {
            keyToSend = key.toLowerCase();
        }
    } else if (shift) {
        keyToSend = symbolMap[key] || key;
        setShift(false);
    }
    
    onKeyPress(keyToSend);
  };
  
  return (
    <div className="bg-black text-white p-2 md:px-2 md:py-4 font-code shadow-2xl rounded-t-lg">
      {keyboardLayout.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-0.5 my-0.5">
          {row.map((key, keyIndex) => {
            const isSpecialKey = ['Backspace', 'Enter', 'Shift', 'Ctrl', 'CapsLock', 'Tab'].includes(key);
            const isShift = key === 'Shift';
            const isCapsLock = key === 'CapsLock';
            const isCtrl = key === 'Ctrl';
            const isSpace = key === ' ';
            const isEyeOff = key === 'EyeOff';
            
            let displayKey: React.ReactNode = key;
            const isLetter = /^[a-z]$/i.test(key);

            if (isLetter) {
                if (shift || capsLock) {
                    displayKey = key.toUpperCase();
                } else {
                    displayKey = key.toLowerCase();
                }
            } else if (shift && symbolMap[key]) {
                displayKey = symbolMap[key];
            } else if (isEyeOff) {
                displayKey = <EyeOff />;
            }
            
            const buttonProps = isSpace
              ? {
                  onMouseDown: handleSpacebarDown,
                  onMouseMove: handleSpacebarMove,
                  onMouseUp: handleSpacebarUp,
                  onMouseLeave: handleSpacebarUp,
                  onTouchStart: handleSpacebarDown,
                  onTouchMove: handleSpacebarMove,
                  onTouchEnd: handleSpacebarUp,
                }
              : {
                  onClick: () => handleKeyPress(key),
                };

            return (
              <Button
                key={`${key}-${rowIndex}-${keyIndex}`}
                variant="outline"
                className={cn(
                  'h-10 bg-gray-800 text-white border-gray-700 hover:bg-gray-700 active:bg-gray-600 transition-colors duration-100 p-0 select-none',
                  isSpecialKey ? 'text-[0.6rem]' : 'text-base',
                  'flex-1',
                  {
                    'flex-grow-[2]': key === 'Backspace' || key === 'Enter',
                    'flex-grow-[1.5]': key === 'Tab' || key === 'Shift' || key === 'Ctrl',
                    'flex-grow-[0.8]': key === 'CapsLock',
                    'flex-grow-[8]': key === ' ',
                    'bg-gray-600': (isShift && shift) || (isCapsLock && capsLock) || (isCtrl && ctrlActive),
                  }
                )}
                {...buttonProps}
              >
                {isSpace ? (isSuggestionsOpen ? 'Select' : 'Space') : displayKey}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
};

    