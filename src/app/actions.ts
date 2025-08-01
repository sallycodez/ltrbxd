
'use server';

import * as cheerio from 'cheerio';
import { z } from 'zod';
import { improveTmdbMatching } from '@/ai/flows/improve-tmdb-matching';

const TMDB_API_KEY = 'c809c8f0886f57672175beeeed53a196';
const TMDB_API_URL = 'https://api.themoviedb.org/3';

export interface MovieData {
  title: string;
  year: number | null;
  letterboxdUrl: string;
  tmdbId: number | null;
}

export interface ConverterState {
  movies: MovieData[];
  message: string | null;
  error?: string | null;
  logs: string[];
}

const schema = z.object({
  username: z.string().min(1, 'Letterboxd username is required.').regex(/^[a-zA-Z0-9_]{1,15}$/, 'Invalid username format.'),
});

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit, retries = 3, delayDuration = 1000, log: (msg: string) => void) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
      if (response.status === 429) { // Too Many Requests from TMDB
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : delayDuration * (i + 1);
        log(`Rate limited by TMDB. Retrying after ${waitTime}ms...`);
        await delay(waitTime);
      } else {
        log(`Fetch failed for ${url} with status ${response.status}. Retrying...`);
        await delay(delayDuration);
      }
    } catch (error) {
      log(`Fetch request failed for ${url}: ${error instanceof Error ? error.message : String(error)}`);
      if (i < retries - 1) {
        await delay(delayDuration);
      } else {
        throw new Error(`Failed to fetch ${url} after ${retries} retries.`);
      }
    }
  }
  throw new Error(`Failed to fetch ${url} after ${retries} retries.`);
}

export async function getTrendingMovies(): Promise<any[]> {
    const url = `${TMDB_API_URL}/trending/movie/week?api_key=${TMDB_API_KEY}`;
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error('Failed to fetch trending movies');
            return [];
        }
        const data = await response.json();
        return data.results;
    } catch (error) {
        console.error('Error fetching trending movies:', error);
        return [];
    }
}

async function fetchTmdbId(movie: MovieData, log: (message: string) => void): Promise<number | null> {
    try {
        log(`Searching for "${movie.title} (${movie.year || 'N/A'})"...`);
        
        const searchUrl = new URL('https://api.themoviedb.org/3/search/movie');
        searchUrl.searchParams.append('api_key', TMDB_API_KEY);
        searchUrl.searchParams.append('query', movie.title);
        if (movie.year) {
            searchUrl.searchParams.append('primary_release_year', movie.year.toString());
        }

        const tmdbResponse = await fetchWithRetry(searchUrl.toString(), {}, 3, 1000, log);
        const tmdbData = await tmdbResponse!.json();

        if (tmdbData.results && tmdbData.results.length > 0) {
            const bestMatch = tmdbData.results[0];
            log(`  > Found match: TMDB ID ${bestMatch.id} for "${bestMatch.title}"`);
            return bestMatch.id;
        }

        log(`  > No TMDB match found for "${movie.title}".`);
        return null;
    } catch (error) {
        log(`  > Failed to get TMDB ID for ${movie.title}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

export async function getWatchlistData(username: string, log: (message: string) => void): Promise<MovieData[]> {
  log(`Fetching watchlist from Letterboxd...`);
  let page = 1;
  let hasMorePages = true;
  const allMovies: MovieData[] = [];

  while (hasMorePages) {
    const watchlistUrl = `https://letterboxd.com/${username}/watchlist/page/${page}/`;
    log(`Fetching page ${page}: ${watchlistUrl}`);
    
    const response = await fetch(watchlistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      }
    });

    if (page === 1 && response.status === 404) {
      const error = 'User not found or watchlist is private.';
      log(`Error: ${error}`);
      throw new Error(error);
    }

    if (!response.ok) {
      const error = `Failed to fetch Letterboxd watchlist page ${page}. Status: ${response.status}`;
      log(`Error: ${error}`);
      hasMorePages = false; 
      continue;
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    const filmPosterElements = $('div.film-poster');

    if (filmPosterElements.length === 0) {
      log('No more movies found on this page. Ending scrape.');
      hasMorePages = false;
    } else {
      log(`Found ${filmPosterElements.length} movies on page ${page}. Parsing...`);
      
        filmPosterElements.each((_i, el) => {
            const filmDiv = $(el);
            const title = filmDiv.find('img').attr('alt');
            const slug = filmDiv.attr('data-film-slug');
            const link = filmDiv.attr('data-target-link');

            if (title && slug && link) {
                const yearMatch = slug.match(/-(\d{4})$/);
                const year = yearMatch ? parseInt(yearMatch[1], 10) : null;
                
                log(`  -> Parsed: ${title} (${year || 'N/A'})`);

                allMovies.push({
                    title: title,
                    year: year,
                    letterboxdUrl: `https://letterboxd.com${link}`,
                    tmdbId: null,
                });
            } else {
                log(`  -> Failed to parse details for a movie poster.`);
            }
        });

      page++;
      await delay(250); // Be nice to Letterboxd
    }
  }

  if (allMovies.length === 0) {
      const message = "Watchlist is empty or no movies could be parsed.";
      log(`Warning: ${message}`);
      throw new Error(message);
  }
  
  log(`Found a total of ${allMovies.length} movies. Now fetching TMDB IDs in batches...`);
  
  const BATCH_SIZE = 10;
  for (let i = 0; i < allMovies.length; i += BATCH_SIZE) {
      const batch = allMovies.slice(i, i + BATCH_SIZE);
      log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}... (${i + 1} to ${i + batch.length})`);
      
      const batchPromises = batch.map(movie => fetchTmdbId(movie, log).then(tmdbId => {
          movie.tmdbId = tmdbId;
      }));
      
      await Promise.all(batchPromises);
      
      log(`Batch ${Math.floor(i / BATCH_SIZE) + 1} complete.`);
      if (i + BATCH_SIZE < allMovies.length) {
        log('Waiting before next batch...');
        await delay(1000); // Wait 1 second between batches to be safe with rate limits
      }
  }

  return allMovies;
}


export async function convertWatchlist(
  prevState: ConverterState,
  formData: FormData
): Promise<ConverterState> {
  const logs: string[] = [];
  const log = (message: string) => {
    logs.push(`${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}: ${message}`);
  };

  const validatedFields = schema.safeParse({
    username: formData.get('username'),
  });

  if (!validatedFields.success) {
    const error = validatedFields.error.flatten().fieldErrors.username?.join(', ') || 'Invalid input.';
    log(`Validation failed: ${error}`);
    return {
      movies: [],
      message: null,
      error,
      logs,
    };
  }
  
  const { username } = validatedFields.data;
  log(`Starting conversion for user: ${username}`);
  
  try {
    const allMovies = await getWatchlistData(username, log);
    
    log('Conversion complete!');
    return {
      movies: allMovies,
      message: `Successfully converted ${allMovies.filter(m => m.tmdbId).length} of ${allMovies.length} movies.`,
      error: null,
      logs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    log(`Critical error: ${errorMessage}`);
    return {
      movies: [],
      message: null,
      error: errorMessage,
      logs,
    };
  }
}
