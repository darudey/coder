
const tokenRegex = new RegExp(
  [
    // Comments
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',
    // Strings
    '(`(?:\\\\`|[^`])*`|"(?:\\\\"|[^"])*"|\'(?:\\\\\'|[^\'])*\')',
    // Keywords & special values
    '\\b(function|return|const|let|var|if|else|for|while|switch|case|break|continue|new|this|true|false|null|undefined|typeof|instanceof|async|await|class|extends|super|import|export|from|default|try|catch|finally|debugger|with|yield|in|of)\\b',
    // Function and class names
    '(?:\\b(?:function|class)\\s+([a-zA-Z_$][a-zA-Z0-9_$]*))',
    // Numbers
    '\\b(\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)\\b',
    // Operators & Punctuation
    '([\\+\\-\\*/%<>=!&|\\^~\\?:;,.\\(\\){}\\[\\]])',
  ].join('|'),
  'g'
);

type TokenType = 'comment' | 'string' | 'keyword' | 'function-name' | 'class-name' | 'number' | 'operator' | 'default';

interface Token {
  type: TokenType;
  value: string;
}

export const parseCode = (code: string): Token[] => {
  const tokens: Token[] = [];
  let lastIndex = 0;
  let match;

  while ((match = tokenRegex.exec(code)) !== null) {
    // Add the text before the match as a default token
    if (match.index > lastIndex) {
      tokens.push({
        type: 'default',
        value: code.slice(lastIndex, match.index),
      });
    }

    let tokenType: TokenType = 'default';
    let tokenValue = match[0];
    
    if (match[1]) tokenType = 'comment'; // Comments
    else if (match[2]) tokenType = 'string'; // Strings
    else if (match[3]) tokenType = 'keyword'; // Keywords
    else if (match[4]) { // Function or Class name
      tokenType = match[0].startsWith('class') ? 'class-name' : 'function-name';
      tokenValue = match[4]; // The captured group is just the name
      
      // We need to push the "function" or "class" keyword separately
      const keyword = match[0].startsWith('class') ? 'class' : 'function';
      tokens.push({ type: 'keyword', value: keyword });
      tokens.push({ type: 'default', value: ' ' });

    } else if (match[5]) tokenType = 'number'; // Numbers
    else if (match[6]) tokenType = 'operator'; // Operators

    tokens.push({ type: tokenType, value: tokenValue });
    lastIndex = tokenRegex.lastIndex;
  }

  // Add any remaining text as a default token
  if (lastIndex < code.length) {
    tokens.push({
      type: 'default',
      value: code.slice(lastIndex),
    });
  }

  return tokens;
};

export const getTokenClassName = (type: TokenType) => {
  switch (type) {
    case 'keyword':
      return 'text-blue-600 dark:text-blue-400';
    case 'string':
      return 'text-green-600 dark:text-green-400';
    case 'comment':
      return 'text-gray-500 italic';
    case 'number':
      return 'text-purple-600 dark:text-purple-400';
    case 'operator':
      return 'text-red-500 dark:text-red-400';
    case 'function-name':
      return 'text-yellow-700 dark:text-yellow-500 font-semibold';
    case 'class-name':
        return 'text-teal-600 dark:text-teal-400 font-semibold';
    default:
      return 'text-black dark:text-gray-300';
  }
}
