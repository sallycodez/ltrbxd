
import { NextResponse } from 'next/server';
import { getWatchlistData } from '@/app/actions';

export const dynamic = 'force-dynamic'; // force dynamic rendering

export async function GET(
  request: Request,
  { params }: { params: { username: string } }
) {
  const username = params.username;

  if (!username) {
    return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
  }

  const logs: string[] = [];
  const log = (message: string) => {
    // In API mode, we can choose to log to console or ignore.
    // console.log(message);
    logs.push(message); // Keep logs in case of error
  };

  try {
    const movies = await getWatchlistData(username, log);
    const tmdbIds = movies.map(movie => movie.tmdbId).filter(id => id !== null);

    return NextResponse.json({
      total_movies: movies.length,
      tmdb_ids: tmdbIds,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json(
      { 
        error: errorMessage,
        logs: logs 
      }, 
      { status: 500 }
    );
  }
}
