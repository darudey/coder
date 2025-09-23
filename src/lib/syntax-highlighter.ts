
const tokenRegex = new RegExp(
  [
    // Comments
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',
    // Strings
    '(`(?:\\\\`|[^`])*`|"(?:\\\\"|[^"])*"|\'(?:\\\\\'|[^\'])*\')',
    // Keywords & special values
    '\\b(function|return|const|let|var|if|else|for|while|switch|case|break|continue|new|this|true|false|null|undefined|typeof|instanceof|async|await|class|extends|super|import|export|from|default|try|catch|finally|debugger|with|yield|in|of)\\b',
    // Built-in objects
    '\\b(console|Math|JSON|Date|Array|String|Number|Boolean|RegExp|Error|Promise|window|document)\\b',
    // Function and class names after keywords
    '(?:\\b(?:function|class)\\s+([a-zA-Z_$][a-zA-Z0-9_$]*))',
    // Object properties (after a dot)
    '\\.\\s*([a-zA-Z_$][a-zA-Z0-9_$]*)',
    // Numbers
    '\\b(\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)\\b',
    // Operators & Punctuation
    '([\\+\\-\\*/%<>=!&|\\^~\\?:;,.\\(\\){}\\[\\]])',
  ].join('|'),
  'g'
);

type TokenType = 'comment' | 'string' | 'keyword' | 'builtin' | 'function-name' | 'class-name' | 'property' | 'number' | 'operator' | 'default';

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
    
    if (match[1]) tokenType = 'comment';
    else if (match[2]) tokenType = 'string';
    else if (match[3]) tokenType = 'keyword';
    else if (match[4]) tokenType = 'builtin';
    else if (match[5]) { // Function or Class name
      tokenType = match[0].startsWith('class') ? 'class-name' : 'function-name';
      tokenValue = match[5]; // The captured group is just the name
      
      const keyword = match[0].startsWith('class') ? 'class' : 'function';
      tokens.push({ type: 'keyword', value: keyword });
      tokens.push({ type: 'default', value: ' ' });

    } else if (match[6]) { // Property
        tokenType = 'property';
        tokenValue = match[6];
        const dotAndWs = match[0].substring(0, match[0].length - tokenValue.length);
        tokens.push({ type: 'operator', value: '.' });
        if (dotAndWs.length > 1) {
            tokens.push({ type: 'default', value: dotAndWs.substring(1) });
        }

    } else if (match[7]) tokenType = 'number';
    else if (match[8]) tokenType = 'operator';

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
    case 'builtin':
        return 'text-cyan-600 dark:text-cyan-400';
    case 'property':
        return 'text-indigo-600 dark:text-indigo-400';
    default:
      return 'text-black dark:text-gray-300';
  }
}
