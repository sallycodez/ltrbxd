'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { convertWatchlist } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useRef } from 'react';
import { Loader2, Film, Link as LinkIcon } from 'lucide-react';
import Link from 'next/link';

const initialState = {
  movies: [],
  message: null,
  error: null,
};

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Converting...
        </>
      ) : (
        'Convert to TMDB IDs'
      )}
    </Button>
  );
}

export default function Home() {
  const [state, formAction] = useFormState(convertWatchlist, initialState);
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: state.error,
      });
    }
    // Only show success toast if there are movies, to avoid showing it on initial load.
    if (state.message && state.movies.length > 0) {
      toast({
        title: 'Success',
        description: state.message,
      });
    }
  }, [state, toast]);

  return (
    <main className="flex min-h-screen flex-col items-center p-4 sm:p-8 md:p-12 bg-background">
      <div className="w-full max-w-4xl space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl font-headline">
            Letterboxd to TMDB Converter
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Enter your Letterboxd username to convert your watchlist into a list of TMDB IDs.
          </p>
        </header>
        
        <Card className="w-full max-w-md mx-auto shadow-lg">
          <CardHeader>
            <CardTitle>Enter Username</CardTitle>
            <CardDescription>
              Your Letterboxd profile and watchlist must be public.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form ref={formRef} action={formAction} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Letterboxd Username</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="e.g., davezuck"
                  required
                />
              </div>
              <SubmitButton />
            </form>
          </CardContent>
        </Card>

        {state.movies && state.movies.length > 0 && (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Conversion Results</CardTitle>
              <CardDescription>
                Found {state.movies.length} {state.movies.length === 1 ? 'movie' : 'movies'}. Movies without a TMDB match may be incorrect or very obscure.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead className="text-center w-[100px]">Year</TableHead>
                      <TableHead className="text-center w-[120px]">Letterboxd</TableHead>
                      <TableHead className="text-center w-[120px]">TMDB</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {state.movies.map((movie, index) => (
                      <TableRow key={`${movie.letterboxdUrl}-${index}`}>
                        <TableCell className="font-medium">{movie.title}</TableCell>
                        <TableCell className="text-center text-muted-foreground">{movie.year}</TableCell>
                        <TableCell className="text-center">
                          <Button asChild variant="ghost" size="icon">
                            <Link href={movie.letterboxdUrl} target="_blank" rel="noopener noreferrer" aria-label={`View ${movie.title} on Letterboxd`}>
                              <Film className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                            </Link>
                          </Button>
                        </TableCell>
                        <TableCell className="text-center">
                          {movie.tmdbId ? (
                            <Button asChild variant="ghost" size="icon">
                              <Link href={`https://www.themoviedb.org/movie/${movie.tmdbId}`} target="_blank" rel="noopener noreferrer" aria-label={`View ${movie.title} on TMDB`}>
                                <LinkIcon className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-sm text-muted-foreground">None</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}
