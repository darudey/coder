// This is a server-side file!
'use server';

/**
 * @fileOverview A syntax highlighting AI agent.
 *
 * - syntaxHighlighting - A function that handles the syntax highlighting process.
 * - SyntaxHighlightingInput - The input type for the syntaxHighlighting function.
 * - SyntaxHighlightingOutput - The return type for the syntaxHighlighting function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SyntaxHighlightingInputSchema = z.object({
  code: z.string().describe('The JavaScript code to highlight.'),
});

export type SyntaxHighlightingInput = z.infer<typeof SyntaxHighlightingInputSchema>;

const SyntaxHighlightingOutputSchema = z.object({
  highlightedCode: z.string().describe('The syntax highlighted code.'),
});

export type SyntaxHighlightingOutput = z.infer<typeof SyntaxHighlightingOutputSchema>;

export async function syntaxHighlighting(input: SyntaxHighlightingInput): Promise<SyntaxHighlightingOutput> {
  return syntaxHighlightingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'syntaxHighlightingPrompt',
  input: {schema: SyntaxHighlightingInputSchema},
  output: {schema: SyntaxHighlightingOutputSchema},
  prompt: `You are a syntax highlighting expert. You will receive JavaScript code as input and return the same code with syntax highlighting using ANSI escape codes for colors and formatting.

  Ensure that keywords, strings, numbers, operators, and comments are clearly distinguished with different colors.

  Here's the JavaScript code to highlight:
  \`\`\`javascript
  {{{code}}}
  \`\`\`
  `,
});

const syntaxHighlightingFlow = ai.defineFlow(
  {
    name: 'syntaxHighlightingFlow',
    inputSchema: SyntaxHighlightingInputSchema,
    outputSchema: SyntaxHighlightingOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
