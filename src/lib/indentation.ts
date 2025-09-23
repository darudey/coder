

const INDENT_CHAR = '    ';

function getCurrentLine(code: string, cursorPosition: number): string {
    const textBeforeCursor = code.substring(0, cursorPosition);
    const lastNewline = textBeforeCursor.lastIndexOf('\n');
    return textBeforeCursor.substring(lastNewline + 1);
}

function getLineIndentation(line: string): string {
    const match = line.match(/^\s*/);
    return match ? match[0] : '';
}

export function getSmartIndentation(code: string, cursorPosition: number): { indent: string, insertClosingBrace: boolean } {
    const lineBeforeCursor = code.substring(0, cursorPosition);
    const textAfterCursor = code.substring(cursorPosition);
    
    const prevLine = lineBeforeCursor.substring(0, lineBeforeCursor.lastIndexOf('\n'));
    const currentLine = prevLine.substring(prevLine.lastIndexOf('\n') + 1);
    
    let indent = getLineIndentation(currentLine);
    let insertClosingBrace = false;
    
    const trimmedLineBefore = lineBeforeCursor.trimEnd();

    // Rule: If previous line ends with an opening brace, indent.
    if (trimmedLineBefore.endsWith('{') || trimmedLineBefore.endsWith('(') || trimmedLineBefore.endsWith('[')) {
        indent += INDENT_CHAR;
        // Also check if we should auto-insert a closing brace.
        const openingBrace = trimmedLineBefore.slice(-1);
        const closingMap: {[key: string]: string} = {'{': '}', '(': ')', '[': ']'};
        const expectedClosingBrace = closingMap[openingBrace];
        
        if (!textAfterCursor.trim().startsWith(expectedClosingBrace)) {
            insertClosingBrace = true;
        }
    }
    
    return { indent, insertClosingBrace };
}
