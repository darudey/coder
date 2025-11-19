
export interface Suggestion {
    value: string;
    type: 'keyword' | 'property' | 'variable';
}

const keywords: Suggestion[] = [
    { value: "break", type: 'keyword' },
    { value: "case", type: 'keyword' },
    { value: "catch", type: 'keyword' },
    { value: "class", type: 'keyword' },
    { value: "const", type: 'keyword' },
    { value: "continue", type: 'keyword' },
    { value: "debugger", type: 'keyword' },
    { value: "default", type: 'keyword' },
    { value: "delete", type: 'keyword' },
    { value: "do", type: 'keyword' },
    { value: "else", type: 'keyword' },
    { value: "export", type: 'keyword' },
    { value: "extends", type: 'keyword' },
    { value: "finally", type: 'keyword' },
    { value: "for", type: 'keyword' },
    { value: "function", type: 'keyword' },
    { value: "if", type: 'keyword' },
    { value: "import", type: 'keyword' },
    { value: "in", type: 'keyword' },
    { value: "instanceof", type: 'keyword' },
    { value: "let", type: 'keyword' },
    { value: "new", type: 'keyword' },
    { value: "return", type: 'keyword' },
    { value: "super", type: 'keyword' },
    { value: "switch", type: 'keyword' },
    { value: "this", type: 'keyword' },
    { value: "throw", type: 'keyword' },
    { value: "try", type: 'keyword' },
    { value: "typeof", type: 'keyword' },
    { value: "var", type: 'keyword' },
    { value: "void", type: 'keyword' },
    { value: "while", type: 'keyword' },
    { value: "with", type: 'keyword' },
    { value: "yield", type: 'keyword' },
    { value: "await", type: 'keyword' },
    { value: "enum", type: 'keyword' },
    { value: "implements", type: 'keyword' },
    { value: "interface", type: 'keyword' },
    { value: "package", type: 'keyword' },
    { value: "private", type: 'keyword' },
    { value: "protected", type: 'keyword' },
    { value: "public", type: 'keyword' },
    { value: "static", type: 'keyword' },
    { value: "true", type: 'keyword' },
    { value: "false", type: 'keyword' },
    { value: "null", type: 'keyword' },
    { value: "undefined", type: 'keyword' },
];

const globalFunctions: Suggestion[] = [
    { value: "eval", type: 'keyword' },
    { value: "isFinite", type: 'keyword' },
    { value: "isNaN", type: 'keyword' },
    { value: "parseFloat", type: 'keyword' },
    { value: "parseInt", type: 'keyword' },
    { value: "decodeURI", type: 'keyword' },
    { value: "decodeURIComponent", type: 'keyword' },
    { value: "encodeURI", type: 'keyword' },
    { value: "encodeURIComponent", type: 'keyword' },
    { value: "alert", type: 'keyword' },
    { value: "confirm", type: 'keyword' },
    { value: "prompt", type: 'keyword' },
    { value: "setTimeout", type: 'keyword' },
    { value: "setInterval", type: 'keyword' },
    { value: "clearTimeout", type: 'keyword' },
    { value: "clearInterval", type: 'keyword' },
];

const jsObjects: Record<string, Suggestion[]> = {
    console: ["log", "error", "warn", "info", "table", "clear", "time", "timeEnd", "assert"].map(v => ({ value: v, type: 'property' })),
    Math: [
        "abs", "acos", "acosh", "asin", "asinh", "atan", "atan2", "atanh",
        "cbrt", "ceil", "clz32", "cos", "cosh", "exp", "expm1", "floor",
        "fround", "hypot", "imul", "log", "log1p", "log2", "log10",
        "max", "min", "pow", "random", "round", "sign", "sin", "sinh",
        "sqrt", "tan", "tanh", "trunc", "PI", "E", "LN2", "LN10", "LOG2E", "LOG10E", "SQRT1_2", "SQRT2"
    ].map(v => ({ value: v, type: 'property' })),
    JSON: ["parse", "stringify"].map(v => ({ value: v, type: 'property' })),
    Date: [
        "now", "parse", "UTC",
        "getDate", "getDay", "getFullYear", "getHours", "getMilliseconds",
        "getMinutes", "getMonth", "getSeconds", "getTime", "getTimezoneOffset",
        "getUTCDate", "getUTCDay", "getUTCFullYear", "getUTCHours",
        "getUTCMilliseconds", "getUTCMinutes", "getUTCMonth", "getUTCSeconds",
        "setDate", "setFullYear", "setHours", "setMilliseconds", "setMinutes",
        "setMonth", "setSeconds", "setTime", "setUTCDate", "setUTCFullYear",
        "setUTCHours", "setUTCMilliseconds", "setUTCMinutes", "setUTCMonth",
        "setUTCSeconds", "toDateString", "toISOString", "toJSON", "toLocaleDateString",
        "toLocaleString", "toLocaleTimeString", "toTimeString", "toUTCString", "valueOf"
    ].map(v => ({ value: v, type: 'property' })),
    Array: [
        "from", "isArray", "of", "length", "concat", "copyWithin", "entries",
        "every", "fill", "filter", "find", "findIndex", "flat", "flatMap",
        "forEach", "includes", "indexOf", "join", "keys", "lastIndexOf", "map",
        "pop", "push", "reduce", "reduceRight", "reverse", "shift", "slice",
        "some", "sort", "splice", "toLocaleString", "toString", "unshift", "values"
    ].map(v => ({ value: v, type: 'property' })),
    String: [
        "fromCharCode", "fromCodePoint", "raw", "charAt", "charCodeAt",
        "codePointAt", "concat", "endsWith", "includes", "indexOf", "lastIndexOf",
        "localeCompare", "match", "matchAll", "normalize", "padEnd", "padStart",
        "repeat", "replace", "replaceAll", "search", "slice", "split", "startsWith",
        "substring", "toLocaleLowerCase", "toLocaleUpperCase", "toLowerCase",
        "toUpperCase", "trim", "trimEnd", "trimStart", "valueOf"
    ].map(v => ({ value: v, type: 'property' })),
    Promise: ["all", "allSettled", "any", "race", "resolve", "reject", "then", "catch", "finally"].map(v => ({ value: v, type: 'property' })),
    Object: [
        "assign", "create", "defineProperties", "defineProperty", "entries",
        "freeze", "fromEntries", "getOwnPropertyDescriptor",
        "getOwnPropertyDescriptors", "getOwnPropertyNames", "getOwnPropertySymbols",
        "getPrototypeOf", "is", "isExtensible", "isFrozen", "isSealed",
        "keys", "preventExtensions", "seal", "setPrototypeOf", "values"
    ].map(v => ({ value: v, type: 'property' })),
    Number: [
        "isFinite", "isInteger", "isNaN", "isSafeInteger", "parseFloat", "parseInt",
        "EPSILON", "MAX_SAFE_INTEGER", "MAX_VALUE", "MIN_SAFE_INTEGER", "MIN_VALUE", "NaN", "NEGATIVE_INFINITY", "POSITIVE_INFINITY"
    ].map(v => ({ value: v, type: 'property' })),
    Boolean: ["valueOf"].map(v => ({ value: v, type: 'property' })),
    RegExp: ["exec", "test", "toString"].map(v => ({ value: v, type: 'property' })),
    Error: ["message", "name", "stack"].map(v => ({ value: v, type: 'property' })),
    window: ["alert", "confirm", "prompt", "setTimeout", "setInterval", "clearTimeout", "clearInterval"].map(v => ({ value: v, type: 'property' })),
    document: ["getElementById", "querySelector", "querySelectorAll", "createElement", "write"].map(v => ({ value: v, type: 'property' })),
};


const isConsonant = (char: string) => {
    return !'aeiouAEIOU'.includes(char);
}

const fuzzyMatch = (partialWord: string, suggestion: Suggestion) => {
    const suggestionValue = suggestion.value;
    const lowerPartial = partialWord.toLowerCase();
    const lowerSuggestion = suggestionValue.toLowerCase();

    if (lowerSuggestion.startsWith(lowerPartial)) {
        // Strong score for prefix matches
        return 100 - (lowerSuggestion.length - lowerPartial.length);
    }
    
    // For non-prefix matches, be much stricter
    let suggestionIndex = 0;
    for (let i = 0; i < partialWord.length; i++) {
        const char = lowerPartial[i];
        const index = lowerSuggestion.indexOf(char, suggestionIndex);

        if (index === -1) {
            return 0; // If a character is not found, it's not a match at all
        }
        suggestionIndex = index + 1;
    }
    
    // Only return a score if it's a subsequence match
    return 10;
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
            
            const exactMatchSuggestion = { value: partialProperty + ' ', type: 'variable' as const };
            
            return { suggestions: [exactMatchSuggestion, ...suggestions], word: partialProperty, startPos };
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

        const wordsInCode = [...new Set(code.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g) || [])]
            .filter(word => word.length >= 3)
            .filter(word => !keywords.some(kw => kw.value === word))
            .map(word => ({ value: word, type: 'variable' as const }));
        
        const allKeywords = [
            ...keywords, 
            ...globalFunctions,
            ...Object.keys(jsObjects).map(k => ({ value: k, type: 'variable' as const })),
            ...wordsInCode,
        ];

        const uniqueSuggestions = allKeywords
            .map(keyword => ({ suggestion: keyword, score: fuzzyMatch(partialWord, keyword) }))
            .filter(item => item.score > 0)
            .filter(item => item.suggestion.value.toLowerCase() !== partialWord.toLowerCase())
            .sort((a, b) => b.score - a.score)
            .map(item => item.suggestion)
            .filter((value, index, self) => self.findIndex(s => s.value === value.value) === index);
        
        const exactMatchSuggestion = { value: partialWord + ' ', type: 'variable' as const };

        return { suggestions: [exactMatchSuggestion, ...uniqueSuggestions], word: partialWord, startPos };
    }

    return { suggestions: [], word: '', startPos: 0 };
};
