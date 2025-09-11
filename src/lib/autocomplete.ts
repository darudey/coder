
export interface Suggestion {
    value: string;
    type: 'keyword' | 'property' | 'variable';
}

const keywords: Suggestion[] = [
    { value: 'const', type: 'keyword' },
    { value: 'let', type: 'keyword' },
    { value: 'var', type: 'keyword' },
    { value: 'function', type: 'keyword' },
    { value: 'return', type: 'keyword' },
    { value: 'if', type: 'keyword' },
    { value: 'else', type: 'keyword' },
    { value: 'for', type: 'keyword' },
    { value: 'while', type: 'keyword' },
    { value: 'switch', type: 'keyword' },
    { value: 'case', type: 'keyword' },
    { value: 'break', type: 'keyword' },
    { value: 'continue', type: 'keyword' },
    { value: 'new', type: 'keyword' },
    { value: 'this', type: 'keyword' },
    { value: 'true', type: 'keyword' },
    { value: 'false', type: 'keyword' },
    { value: 'null', type: 'keyword' },
    { value: 'undefined', type: 'keyword' },
    { value: 'typeof', type: 'keyword' },
    { value: 'instanceof', type: 'keyword' },
];

const jsObjects: Record<string, Suggestion[]> = {
    console: [
        { value: 'log', type: 'property' },
        { value: 'error', type: 'property' },
        { value: 'warn', type: 'property' },
        { value: 'info', type: 'property' },
        { value: 'table', type: 'property' },
    ],
    Math: [
        { value: 'abs', type: 'property' },
        { value: 'ceil', type: 'property' },
        { value: 'floor', type: 'property' },
        { value: 'round', type: 'property' },
        { value: 'max', type: 'property' },
        { value: 'min', type: 'property' },
        { value: 'pow', type: 'property' },
        { value: 'random', type: 'property' },
        { value: 'sqrt', type: 'property' },
    ],
    JSON: [
        { value: 'parse', type: 'property' },
        { value: 'stringify', type: 'property' },
    ],
};


export const getSuggestions = (code: string, cursorPosition: number): { suggestions: Suggestion[], word: string, startPos: number } => {
    const textBeforeCursor = code.slice(0, cursorPosition);
    
    // Match object property access, e.g., "console."
    const propertyMatch = textBeforeCursor.match(/(\b[a-zA-Z_]\w*)\.\s*(\w*)$/);
    if (propertyMatch) {
        const objectName = propertyMatch[1];
        const partialProperty = propertyMatch[2];
        const startPos = cursorPosition - partialProperty.length;

        if (jsObjects[objectName]) {
            const suggestions = jsObjects[objectName].filter(prop => 
                prop.value.toLowerCase().startsWith(partialProperty.toLowerCase())
            );
            return { suggestions, word: partialProperty, startPos };
        }
        return { suggestions: [], word: '', startPos: 0 };
    }

    // Match standalone words/keywords
    const wordMatch = textBeforeCursor.match(/(\w+)$/);
    if (wordMatch) {
        const partialWord = wordMatch[1];
        const startPos = cursorPosition - partialWord.length;

        if (partialWord.length === 0) {
            return { suggestions: [], word: '', startPos: 0 };
        }
        
        const allKeywords = [...keywords, ...Object.keys(jsObjects).map(k => ({ value: k, type: 'variable' as const }))];

        const suggestions = allKeywords.filter(keyword =>
            keyword.value.toLowerCase().startsWith(partialWord.toLowerCase())
        );

        return { suggestions, word: partialWord, startPos };
    }

    return { suggestions: [], word: '', startPos: 0 };
};
