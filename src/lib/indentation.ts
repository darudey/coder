

const INDENT_CHAR = '  '; // 2 spaces

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
    const currentLine = getCurrentLine(code, cursorPosition);
    const lineBeforeCursor = code.substring(0, cursorPosition);
    const textAfterCursor = code.substring(cursorPosition);

    let indent = getLineIndentation(currentLine);
    let insertClosingBrace = false;

    const trimmedLineBefore = lineBeforeCursor.trimEnd();

    if (trimmedLineBefore.endsWith('{') || trimmedLineBefore.endsWith('(') || trimmedLineBefore.endsWith('[')) {
        indent += INDENT_CHAR;
        if (trimmedLineBefore.endsWith('{')) {
            const nextChar = textAfterCursor.trim().charAt(0);
            if (nextChar !== '}') {
                insertClosingBrace = true;
            }
        }
    }
    
    return { indent, insertClosingBrace };
}
