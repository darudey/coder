
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

const isConsonant = (char: string) => {
    return !'aeiouAEIOU'.includes(char);
}

const fuzzyMatch = (partialWord: string, suggestion: Suggestion) => {
    const suggestionValue = suggestion.value;
    let score = 0;
    let suggestionIndex = 0;
    let consecutiveMatches = 0;
    const lowerPartial = partialWord.toLowerCase();
    const lowerSuggestion = suggestionValue.toLowerCase();

    if (lowerSuggestion.startsWith(lowerPartial)) {
        score += 100; // Big bonus for prefix match
    }

    for (let i = 0; i < partialWord.length; i++) {
        const char = lowerPartial[i];
        const index = lowerSuggestion.indexOf(char, suggestionIndex);

        if (index !== -1) {
            score += 10;
            
            if (isConsonant(char)) {
                score += 15; // Bonus for consonant match
            }

            if (index === suggestionIndex) {
                consecutiveMatches++;
                score += 10 * consecutiveMatches;
            } else {
                consecutiveMatches = 0;
            }
            suggestionIndex = index + 1;
        } else {
            return 0; // If a character is not found, it's not a match
        }
    }
    
    // Penalize for length difference
    score -= Math.abs(suggestionValue.length - partialWord.length);

    return score;
}

export const getSuggestions = (code: string, cursorPosition: number): { suggestions: Suggestion[], word: string, startPos: number } => {
    const textBeforeCursor = code.slice(0, cursorPosition);
    
    // Match object property access, e.g., "console."
    const propertyMatch = textBeforeCursor.match(/(\b[a-zA-Z_]\w*)\.\s*(\w*)$/);
    if (propertyMatch) {
        const objectName = propertyMatch[1];
        const partialProperty = propertyMatch[2];
        const startPos = cursorPosition - partialProperty.length;

        if (jsObjects[objectName]) {
             const suggestions = jsObjects[objectName]
                .map(prop => ({ suggestion: prop, score: fuzzyMatch(partialProperty, prop) }))
                .filter(item => item.score > 0)
                .sort((a, b) => b.score - a.score)
                .map(item => item.suggestion);
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

        const suggestions = allKeywords
            .map(keyword => ({ suggestion: keyword, score: fuzzyMatch(partialWord, keyword) }))
            .filter(item => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map(item => item.suggestion);


        return { suggestions, word: partialWord, startPos };
    }

    return { suggestions: [], word: '', startPos: 0 };
};
