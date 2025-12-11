

type TokenType = 'comment' | 'string' | 'keyword' | 'builtin' | 'function-name' | 'class-name' | 'property' | 'number' | 'operator' | 'default';

interface Token {
  type: TokenType;
  value: string;
}

type ParserState = 'default' | 'in_multiline_comment';

export const parseCode = (code: string, initialState: ParserState = 'default'): { tokens: Token[], finalState: ParserState } => {
  const tokens: Token[] = [];
  let currentState = initialState;
  let remainingCode = code;

  const tokenPatterns: { [K in ParserState]: { type: TokenType, regex: RegExp }[] } = {
    default: [
      { type: 'comment', regex: /^\/\/.*/ },
      { type: 'comment', regex: /^\/\*/ },
      { type: 'string', regex: /^(`(?:\\`|[^`])*`|"(?:\\"|[^"])*"|'(?:\\'|[^'])*')/ },
      { type: 'keyword', regex: /^\b(function|return|const|let|var|if|else|for|while|switch|case|break|continue|new|this|true|false|null|undefined|typeof|instanceof|async|await|class|extends|super|import|export|from|default|try|catch|finally|debugger|with|yield|in|of)\b/ },
      { type: 'builtin', regex: /^\b(console|Math|JSON|Date|Array|String|Number|Boolean|RegExp|Error|Promise|window|document)\b/ },
      { type: 'number', regex: /^\b(\d+(?:\.\d+)?(?:e[+-]?\d+)?)\b/ },
      { type: 'default', regex: /^[a-zA-Z_$][a-zA-Z0-9_$]*/ },
      { type: 'operator', regex: /^([\+\-\*\/%<>=!&|\^~\?:;,\.(){}\[\]])/ },
      { type: 'default', regex: /^\s+/ },
    ],
    in_multiline_comment: [
      { type: 'comment', regex: /^[^\*]+\*+(?!\/)/ },
      { type: 'comment', regex: /^\*\// },
      { type: 'comment', regex: /^./ },
    ],
  };
  
  while (remainingCode.length > 0) {
    let matched = false;
    for (const { type, regex } of tokenPatterns[currentState]) {
      const match = remainingCode.match(regex);
      if (match) {
        let value = match[0];
        if (currentState === 'default') {
          if (type === 'comment' && value.startsWith('/*')) {
            currentState = 'in_multiline_comment';
          }
        } else if (currentState === 'in_multiline_comment') {
          if (value.endsWith('*/')) {
            currentState = 'default';
          }
        }

        tokens.push({ type, value });
        remainingCode = remainingCode.substring(value.length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      tokens.push({ type: 'default', value: remainingCode[0] });
      remainingCode = remainingCode.substring(1);
    }
  }

  // Post-processing
  for (let i = 0; i < tokens.length; i++) {
    const currentToken = tokens[i];

    if (currentToken.type === 'default' && /^[a-zA-Z_$]/.test(currentToken.value)) {
        const prevToken = tokens.slice(0, i).reverse().find(t => t.value.trim() !== '');
        if (prevToken?.value.trim() === '.') {
            currentToken.type = 'property';
            continue;
        }

        if (prevToken?.type === 'keyword' && (prevToken.value === 'function' || prevToken.value === 'class')) {
            currentToken.type = prevToken.value === 'class' ? 'class-name' : 'function-name';
            continue;
        }

        const nextToken = tokens.slice(i + 1).find(t => t.value.trim() !== '');
        if (nextToken?.value.trim() === '(') {
            currentToken.type = 'function-name';
            continue;
        }
    }
  }

  return { tokens, finalState: currentState };
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
