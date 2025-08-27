'use client';

import { Button } from '@/components/ui/button';
import type { FC } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface CoderKeyboardProps {
  onKeyPress: (key: string) => void;
}

const keyCategories = {
  common: ['( )', '=>', '{ }', '[ ]', ';', '.', ',', "' '", '" "', '` `'],
  keywords: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'async', 'await', 'new'],
  operators: ['+', '-', '*', '/', '%', '=', '==', '===', '!=', '!==', '>', '<', '>=', '<=', '&&', '||', '!'],
  values: ['true', 'false', 'null', 'undefined', 'Infinity', 'NaN'],
  numbers: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  global: ['console.log', 'JSON.stringify', 'JSON.parse', 'Math.', 'Object.', 'Array.']
};

const processKey = (key: string): string => {
    if (key.endsWith('()') || key.endsWith('[]') || key.endsWith('{}') || key.endsWith("''") || key.endsWith('""') || key.endsWith('``') ) {
        return key;
    }
    if (key.includes(' ')) {
        const parts = key.split(' ');
        if (parts.length === 2 && parts[1] !== '') {
        return parts[0] + parts[1];
        }
        return key;
    }
    return key;
};

const getInsertion = (key: string): string => {
    if (key.includes(' ')) {
        const parts = key.split(' ');
        if (parts.length > 1 && parts[1] === '') {
            return parts[0];
        }
        return key;
    }
    return key;
};

export const CoderKeyboard: FC<CoderKeyboardProps> = ({ onKeyPress }) => {
  return (
    <div className="bg-muted/50 p-2">
       <Tabs defaultValue="common" className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto flex-wrap">
          <TabsTrigger value="common" className="text-xs">Common</TabsTrigger>
          <TabsTrigger value="keywords" className="text-xs">Keywords</TabsTrigger>
          <TabsTrigger value="operators" className="text-xs">Operators</TabsTrigger>
          <TabsTrigger value="values" className="text-xs">Values</TabsTrigger>
          <TabsTrigger value="numbers" className="text-xs">Numbers</TabsTrigger>
          <TabsTrigger value="global" className="text-xs">Global</TabsTrigger>
        </TabsList>
        {(Object.keys(keyCategories) as (keyof typeof keyCategories)[]).map(category => (
            <TabsContent key={category} value={category}>
                <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-2 mt-2">
                {keyCategories[category].map((key) => (
                    <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        className="font-code text-xs md:text-sm h-8 bg-background transition-transform transform active:scale-95"
                        onClick={() => onKeyPress(getInsertion(key))}
                    >
                        {processKey(key)}
                    </Button>
                ))}
                </div>
            </TabsContent>
        ))}
      </Tabs>
    </div>
  );
};
