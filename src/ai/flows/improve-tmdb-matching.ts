'use server';
/**
 * @fileOverview This file defines a Genkit flow to improve TMDB movie matching using LLM.
 *
 * - improveTmdbMatching - A function that enhances TMDB search queries.
 * - ImproveTmdbMatchingInput - The input type for the improveTmdbMatching function.
 * - ImproveTmdbMatchingOutput - The return type for the improveTmdbMatching function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ImproveTmdbMatchingInputSchema = z.object({
  title: z.string().describe('The title of the movie.'),
  year: z.number().describe('The release year of the movie.'),
  initialResults: z.array(z.any()).describe('The initial TMDB search results.'),
});
export type ImproveTmdbMatchingInput = z.infer<typeof ImproveTmdbMatchingInputSchema>;

const ImproveTmdbMatchingOutputSchema = z.object({
  refinedQuery: z.string().describe('The refined TMDB search query.'),
});
export type ImproveTmdbMatchingOutput = z.infer<typeof ImproveTmdbMatchingOutputSchema>;

export async function improveTmdbMatching(input: ImproveTmdbMatchingInput): Promise<ImproveTmdbMatchingOutput> {
  return improveTmdbMatchingFlow(input);
}

const prompt = ai.definePrompt({
  name: 'improveTmdbMatchingPrompt',
  input: {schema: ImproveTmdbMatchingInputSchema},
  output: {schema: ImproveTmdbMatchingOutputSchema},
  prompt: `You are an expert movie database search query refiner.

  Given the movie title "{{title}}" released in {{year}}, and the initial TMDB search results ({{{initialResults}}}), your goal is to refine the search query to get a better match.

  Consider the initial results and identify any potential issues with the search query, such as incorrect year, alternative titles, or missing keywords.

  Return a refined search query that is more likely to return the correct movie.

  Just return the refined query. Do not include any additional explanation.
  `,
});

const improveTmdbMatchingFlow = ai.defineFlow(
  {
    name: 'improveTmdbMatchingFlow',
    inputSchema: ImproveTmdbMatchingInputSchema,
    outputSchema: ImproveTmdbMatchingOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return {
      refinedQuery: output!.refinedQuery,
    };
  }
);
