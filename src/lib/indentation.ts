

const INDENT_CHAR = '    ';

function getLineIndentation(line: string): string {
    const match = line.match(/^\s*/);
    return match ? match[0] : '';
}

export function getSmartIndentation(code: string, cursorPosition: number): { indent: string, closingBraceIndentation: string | null } {
    const textBeforeCursor = code.substring(0, cursorPosition);
    const textAfterCursor = code.substring(cursorPosition);
    
    const lineBefore = textBeforeCursor.substring(textBeforeCursor.lastIndexOf('\n') + 1);
    const currentIndent = getLineIndentation(lineBefore);

    const trimmedLineBefore = lineBefore.trimEnd();

    // Rule: If previous line ends with an opening brace, indent.
    if (trimmedLineBefore.endsWith('{')) {
        // Check if the next non-whitespace character is already a closing brace.
        const nextChar = textAfterCursor.trim().charAt(0);
        
        // If the next character is already a closing brace, create a new indented line between them.
        if (nextChar === '}') {
            return { indent: currentIndent + INDENT_CHAR, closingBraceIndentation: currentIndent };
        }
        
        // Otherwise, just indent the new line.
        return { indent: currentIndent + INDENT_CHAR, closingBraceIndentation: null };
    }
    
    // Default Rule: For all other cases (e.g., pressing enter on an empty or existing line)
    // mirror the current line's indentation.
    return { indent: currentIndent, closingBraceIndentation: null };
}
