'use server';

import * as cheerio from 'cheerio';
import { z } from 'zod';
import { improveTmdbMatching } from '@/ai/flows/improve-tmdb-matching';

const TMDB_API_KEY = 'c809c8f0886f57672175beeeed53a196';

export interface MovieData {
  title: string;
  year: number | null;
  letterboxdUrl: string;
  tmdbId: number | null;
}

interface ConverterState {
  movies: MovieData[];
  message: string | null;
  error?: string | null;
}

const schema = z.object({
  username: z.string().min(1, 'Letterboxd username is required.').regex(/^[a-zA-Z0-9_]{1,15}$/, 'Invalid username format.'),
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayDuration = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) { // Too Many Requests from TMDB
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delayDuration * (i + 1);
        console.warn(`Rate limited. Retrying after ${waitTime}ms...`);
        await delay(waitTime);
      } else {
        console.error(`Fetch failed for ${url} with status ${response.status}. Retrying...`);
        await delay(delayDuration);
      }
    } catch (error) {
      console.error(`Fetch request failed for ${url}:`, error);
      if (i < retries - 1) {
        await delay(delayDuration);
      } else {
        throw new Error(`Failed to fetch ${url} after ${retries} retries.`);
      }
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries.`);
}


export async function convertWatchlist(
  prevState: ConverterState,
  formData: FormData
): Promise<ConverterState> {
  const validatedFields = schema.safeParse({
    username: formData.get('username'),
  });

  if (!validatedFields.success) {
    return {
      movies: [],
      message: null,
      error: validatedFields.error.flatten().fieldErrors.username?.join(', ') || 'Invalid input.',
    };
  }

  const { username } = validatedFields.data;
  const allMovies: MovieData[] = [];
  let page = 1;
  const MAX_PAGES = 50; 

  try {
    while (page <= MAX_PAGES) {
      const watchlistUrl = `https://letterboxd.com/${username}/watchlist/page/${page}/`;
      const response = await fetch(watchlistUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          if (page === 1) throw new Error('User not found or watchlist is private.');
          break;
        }
        throw new Error(`Failed to fetch Letterboxd watchlist. Status: ${response.status}`);
      }

      const html = await response.text();
      const $ = cheerio.load(html);

      const filmPosters = $('li.poster-container');
      if (filmPosters.length === 0) break;

      filmPosters.each((i, el) => {
        const filmElement = $(el).find('.film-poster');
        const filmSlug = filmElement.attr('data-film-slug');
        const filmTitle = filmElement.find('img').attr('alt');
        const filmYearStr = filmElement.attr('data-film-release-year');
        
        if (filmSlug && filmTitle && filmYearStr) {
          allMovies.push({
            title: filmTitle,
            year: parseInt(filmYearStr, 10),
            letterboxdUrl: `https://letterboxd.com${filmSlug}`,
            tmdbId: null,
          });
        }
      });
      page++;
      await delay(100);
    }

    if (allMovies.length === 0) {
        return { movies: [], message: null, error: "Could not find any movies. Is the watchlist empty or username incorrect?" };
    }

    for (const movie of allMovies) {
      try {
        let tmdbId: number | null = null;
        
        // Initial search
        const searchUrl = new URL('https://api.themoviedb.org/3/search/movie');
        searchUrl.searchParams.append('api_key', TMDB_API_KEY);
        searchUrl.searchParams.append('query', movie.title);
        if (movie.year) {
          searchUrl.searchParams.append('year', movie.year.toString());
        }

        const tmdbResponse = await fetchWithRetry(searchUrl.toString(), {});
        const tmdbData = await tmdbResponse.json();

        if (tmdbData.results && tmdbData.results.length > 0) {
          tmdbId = tmdbData.results[0].id;
        } else {
            console.log(`No initial TMDB match for "${movie.title} (${movie.year})". Trying with AI refinement.`);
            try {
                const refinement = await improveTmdbMatching({
                    title: movie.title,
                    year: movie.year || 0,
                    initialResults: tmdbData.results || [],
                });

                const refinedSearchUrl = new URL('https://api.themoviedb.org/3/search/movie');
                refinedSearchUrl.searchParams.append('api_key', TMDB_API_KEY);
                refinedSearchUrl.searchParams.append('query', refinement.refinedQuery);

                const refinedTmdbResponse = await fetchWithRetry(refinedSearchUrl.toString(), {});
                const refinedTmdbData = await refinedTmdbResponse.json();

                if (refinedTmdbData.results && refinedTmdbData.results.length > 0) {
                    tmdbId = refinedTmdbData.results[0].id;
                }
            } catch (aiError) {
                console.error("AI refinement failed:", aiError);
            }
        }
        movie.tmdbId = tmdbId;
        await delay(250); // Respect TMDB API rate limits
      } catch (error) {
          console.error(`Failed to get TMDB ID for ${movie.title}:`, error);
      }
    }
    
    return {
      movies: allMovies,
      message: `Successfully converted ${allMovies.length} movies.`,
      error: null,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return {
      movies: [],
      message: null,
      error: errorMessage,
    };
  }
}
