

export const getSmartIndentation = (code: string, start: number, end: number): { textToInsert: string, newCursorPosition: number } => {
    const lineBefore = code.substring(0, start).substring(code.lastIndexOf('\n', start - 1) + 1);
    const currentIndent = lineBefore.match(/^\s*/)?.[0] || '';
    
    const lastCharOfLine = lineBefore.trim().slice(-1);
    const nextChar = code[end];
    
    let textToInsert = '\n' + currentIndent;
    let newCursorPosition = start + textToInsert.length;

    if (lastCharOfLine === '{' && nextChar === '}') {
        const indent = '    ';
        textToInsert = '\n' + currentIndent + indent + '\n' + currentIndent;
        newCursorPosition = start + currentIndent.length + indent.length + 1;
    } else if (lastCharOfLine === '{') {
        textToInsert += '    ';
        newCursorPosition = start + textToInsert.length;
    }
    
    return { textToInsert, newCursorPosition };
}
