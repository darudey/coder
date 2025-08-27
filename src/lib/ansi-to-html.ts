
const ansiRegex = new RegExp(
  [
    '[\\u001B\\u009B][[\\]()#;?]*.?(?:(?:[a-zA-Z\\d]*(?:;[a-zA-Z\\d]*)*)?\\u0007|' +
      '(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])',
  ].join('|'),
  'g'
);

const AnsiToHtml = (text: string): string => {
  if (!text) {
    return '';
  }
  
  const colorMap: { [key: number]: string } = {
    30: 'var(--foreground)',
    31: '#ef4444', // red-500
    32: '#22c55e', // green-500
    33: '#eab308', // yellow-500
    34: '#3b82f6', // blue-500
    35: '#a855f7', // purple-500
    36: '#06b6d4', // cyan-500
    37: '#d1d5db', // gray-300
    90: '#6b7280', // gray-500
  };

  let openSpan = false;
  const processed = text.replace(ansiRegex, (match) => {
    const code = parseInt(match.substring(2), 10);
    
    let style = '';
    if (colorMap[code]) {
      style = `color: ${colorMap[code]}`;
    } else if (code === 1) {
      style = 'font-weight: bold;';
    } else if (code === 0) {
      if (openSpan) {
        openSpan = false;
        return '</span>';
      }
      return '';
    }

    let out = '';
    if (openSpan) {
      out += '</span>';
    }
    out += `<span style="${style}">`;
    openSpan = true;
    return out;
  });

  return openSpan ? processed + '</span>' : processed;
};

export default AnsiToHtml;
