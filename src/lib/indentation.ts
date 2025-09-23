

const INDENT_CHAR = '    ';

function getLineIndentation(line: string): string {
    const match = line.match(/^\s*/);
    return match ? match[0] : '';
}

export interface SmartIndentResult {
    textToInsert: string;
    newCursorPosition: number;
}

export function getSmartIndentation(code: string, cursorPosition: number): SmartIndentResult {
    const textBeforeCursor = code.substring(0, cursorPosition);
    const textAfterCursor = code.substring(cursorPosition);
    
    const lineBefore = textBeforeCursor.substring(textBeforeCursor.lastIndexOf('\n') + 1);
    const currentIndent = getLineIndentation(lineBefore);

    const trimmedLineBefore = lineBefore.trimEnd();
    const trimmedTextAfter = textAfterCursor.trimStart();

    // Rule: If previous line ends with an opening brace, and the line after the cursor starts with a closing brace.
    if (trimmedLineBefore.endsWith('{') && trimmedTextAfter.startsWith('}')) {
        const indent = currentIndent + INDENT_CHAR;
        
        const textToInsert = '\n' + indent + '\n' + currentIndent;
        const newCursorPosition = cursorPosition + indent.length + 1; // +1 for the newline

        return { textToInsert, newCursorPosition };
    }

    // Default Rule: For all other cases, just insert a new line with the current indentation.
    const textToInsert = '\n' + currentIndent;
    const newCursorPosition = cursorPosition + textToInsert.length;
    
    return { textToInsert, newCursorPosition };
}
