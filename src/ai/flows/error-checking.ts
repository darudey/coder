'use server';

/**
 * @fileOverview Error checking flow for identifying syntax and runtime errors in JavaScript code.
 *
 * - errorCheck - A function that performs error checking on the provided JavaScript code.
 * - ErrorCheckInput - The input type for the errorCheck function.
 * - ErrorCheckOutput - The return type for the errorCheck function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ErrorCheckInputSchema = z.object({
  code: z.string().describe('The JavaScript code to check for errors.'),
});
export type ErrorCheckInput = z.infer<typeof ErrorCheckInputSchema>;

const ErrorCheckOutputSchema = z.object({
  hasErrors: z.boolean().describe('Indicates whether any errors were found in the code.'),
  errors: z
    .array(z.string())
    .describe('A list of error messages found in the code, if any.'),
});
export type ErrorCheckOutput = z.infer<typeof ErrorCheckOutputSchema>;

export async function errorCheck(input: ErrorCheckInput): Promise<ErrorCheckOutput> {
  return errorCheckFlow(input);
}

const errorCheckPrompt = ai.definePrompt({
  name: 'errorCheckPrompt',
  input: {schema: ErrorCheckInputSchema},
  output: {schema: ErrorCheckOutputSchema},
  prompt: `You are a JavaScript code analysis tool.

  Your task is to analyze the provided JavaScript code for syntax and runtime errors.

  Respond with a JSON object indicating whether errors were found and, if so, a list of error messages.

  Code to analyze:
  \`\`\`javascript
  {{{code}}}
  \`\`\`
`,
});

const errorCheckFlow = ai.defineFlow(
  {
    name: 'errorCheckFlow',
    inputSchema: ErrorCheckInputSchema,
    outputSchema: ErrorCheckOutputSchema,
  },
  async input => {
    const {output} = await errorCheckPrompt(input);
    return output!;
  }
);
