


const INDENT_CHAR = '  '; // Using 2 spaces for indentation

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

    let indent = currentIndent;

    // Rule: If previous line ends with an opening brace, indent further
    if (trimmedLineBefore.endsWith('{') || trimmedLineBefore.endsWith('(') || trimmedLineBefore.endsWith('[')) {
        indent += INDENT_CHAR;
    }
    
    // Rule: If the line after the cursor starts with a closing brace, create a new line for the cursor and indent the closing brace.
    if (trimmedTextAfter.startsWith('}') || trimmedTextAfter.startsWith(')') || trimmedTextAfter.startsWith(']')) {
        const textToInsert = '\n' + indent + '\n' + currentIndent;
        const newCursorPosition = cursorPosition + indent.length + 1; // +1 for the newline

        return { textToInsert, newCursorPosition };
    }

    // Default Rule: For all other cases, just insert a new line with the calculated indentation.
    const textToInsert = '\n' + indent;
    const newCursorPosition = cursorPosition + textToInsert.length;
    
    return { textToInsert, newCursorPosition };
}

    