
const tokenRegex = new RegExp(
  [
    // Comments (Group 1)
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)',
    // Strings (Group 2)
    '(`(?:\\\\`|[^`])*`|"(?:\\\\"|[^"])*"|\'(?:\\\\\'|[^\'])*\')',
    // Keywords & special values (Group 3)
    '\\b(function|return|const|let|var|if|else|for|while|switch|case|break|continue|new|this|true|false|null|undefined|typeof|instanceof|async|await|class|extends|super|import|export|from|default|try|catch|finally|debugger|with|yield|in|of)\\b',
    // Built-in objects (Group 4)
    '\\b(console|Math|JSON|Date|Array|String|Number|Boolean|RegExp|Error|Promise|window|document)\\b',
    // Numbers (Group 5)
    '\\b(\\d+(?:\\.\\d+)?(?:e[+-]?\\d+)?)\\b',
    // Identifiers, including properties (Group 6)
    '([a-zA-Z_$][a-zA-Z0-9_$]*)',
    // Operators & Punctuation (Group 7)
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
    // Text before the match is a 'default' token
    if (match.index > lastIndex) {
      tokens.push({
        type: 'default',
        value: code.slice(lastIndex, match.index),
      });
    }
    
    const matchedValue = match[0];
    let tokenType: TokenType = 'default';

    if (match[1]) tokenType = 'comment';
    else if (match[2]) tokenType = 'string';
    else if (match[3]) tokenType = 'keyword';
    else if (match[4]) tokenType = 'builtin';
    else if (match[5]) tokenType = 'number';
    else if (match[6]) tokenType = 'default'; // Initially, all identifiers are default
    else if (match[7]) tokenType = 'operator';

    tokens.push({ type: tokenType, value: matchedValue });
    lastIndex = tokenRegex.lastIndex;
  }

  // Remaining text
  if (lastIndex < code.length) {
    tokens.push({
      type: 'default',
      value: code.slice(lastIndex),
    });
  }

  // Post-processing to identify special identifier types (properties, functions, classes)
  for (let i = 0; i < tokens.length; i++) {
    const currentToken = tokens[i];

    if (currentToken.type === 'default' && /^[a-zA-Z_$]/.test(currentToken.value)) {
        // Check for property (follows a '.')
        const prevToken = tokens.slice(0, i).reverse().find(t => t.type !== 'default' || t.value.trim() !== '');
        if (prevToken?.value === '.') {
            currentToken.type = 'property';
            continue;
        }

        // Check for function/class declaration name
        if (prevToken?.type === 'keyword' && (prevToken.value === 'function' || prevToken.value === 'class')) {
            currentToken.type = prevToken.value === 'class' ? 'class-name' : 'function-name';
            continue;
        }

        // Check for function call name
        const nextToken = tokens.slice(i + 1).find(t => t.type !== 'default' || t.value.trim() !== '');
        if (nextToken?.value === '(') {
            currentToken.type = 'function-name';
            continue;
        }
    }
  }


  return tokens;
};

export const getTokenStyle = (type: TokenType): React.CSSProperties => {
    const style: React.CSSProperties = {
        display: 'inline',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
    };
    switch (type) {
        case 'keyword': 
            style.color = 'hsl(var(--syntax-keyword))';
            break;
        case 'string': 
            style.color = 'hsl(var(--syntax-string))';
            break;
        case 'comment': 
            style.color = 'hsl(var(--syntax-comment))';
            style.fontStyle = 'italic';
            break;
        case 'number': 
            style.color = 'hsl(var(--syntax-number))';
            break;
        case 'operator': 
            style.color = 'hsl(var(--syntax-operator))';
            break;
        case 'function-name': 
            style.color = 'hsl(var(--syntax-function-name))';
            break;
        case 'class-name': 
            style.color = 'hsl(var(--syntax-class-name))';
            break;
        case 'builtin': 
            style.color = 'hsl(var(--syntax-builtin))';
            break;
        case 'property': 
            style.color = 'hsl(var(--syntax-property))';
            break;
        default: 
            style.color = 'hsl(var(--syntax-default))';
            break;
    }
    return style;
}
