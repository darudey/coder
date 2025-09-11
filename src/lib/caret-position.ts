
// This is a simplified version to get caret position.
// A more robust solution might use a mirror div.

const properties = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize',
];

let isBrowser: boolean;

try {
  isBrowser = typeof window !== 'undefined';
} catch (error) {
  isBrowser = false;
}


export function getCaretCoordinates(element: HTMLTextAreaElement, position: number) {
  if (!isBrowser) {
    throw new Error('getCaretCoordinates should only be called in a browser environment.');
  }

  const div = document.createElement('div');
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);

  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';

  properties.forEach(prop => {
    // @ts-ignore
    style[prop] = computed[prop];
  });

  div.textContent = element.value.substring(0, position);
  
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth),
    left: span.offsetLeft + parseInt(computed.borderLeftWidth),
    height: parseInt(computed.lineHeight)
  };

  document.body.removeChild(div);

  return coordinates;
}
