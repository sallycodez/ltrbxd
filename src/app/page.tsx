
import { getTrendingMovies } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Code } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

async function MovieGrid() {
  const movies = await getTrendingMovies();
  const posterBaseUrl = 'https://image.tmdb.org/t/p/w500';

  // We'll create a visually interesting grid layout
  const gridMovies = movies.slice(0, 7); // Use 7 movies for the grid

  const gridAreas = [
    'a', 'b', 'b',
    'c', 'b', 'b',
    'd', 'e', 'f',
    'g', 'e', 'f',
  ];

  return (
    <div className="hidden lg:grid grid-cols-3 grid-rows-4 gap-4 w-full max-w-xl mx-auto">
      {gridMovies.map((movie, index) => {
        const style = { gridArea: gridAreas[index] || '' };
        return (
          <div key={movie.id} className="w-full h-full rounded-lg overflow-hidden shadow-2xl" style={style}>
            <Image
              src={`${posterBaseUrl}${movie.poster_path}`}
              alt={movie.title}
              width={500}
              height={750}
              className="w-full h-full object-cover"
              priority={index < 4}
            />
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const currentYear = new Date().getFullYear();

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center">
          <div className="mr-4 flex items-center">
            <Code className="h-6 w-6 mr-2" />
            <Link href="/" className="font-bold text-lg">
              LTRBXD API
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <nav className="flex items-center">
               <Button variant="ghost" asChild>
                  <Link href="#documentation">Documentation</Link>
                </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="container relative py-12 lg:py-24">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left space-y-6">
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter">
                Letterboxd Watchlist to TMDB ID API
              </h1>
              <p className="max-w-[700px] text-lg text-muted-foreground">
                A free and open-source API to convert any public Letterboxd watchlist into a list of TMDB movie IDs.
                Perfect for developers building movie-related applications.
              </p>
              <Button asChild size="lg" className="group">
                <Link href="#documentation">
                  Get Started
                  <span className="ml-2 transition-transform group-hover:translate-x-1">&gt;</span>
                </Link>
              </Button>
               <div className="flex flex-wrap justify-center lg:justify-start gap-4 pt-4">
                  <div className="text-center p-4 rounded-lg bg-secondary">
                    <p className="font-bold text-2xl">100K+</p>
                    <p className="text-sm text-muted-foreground">Movies Supported</p>
                  </div>
                   <div className="text-center p-4 rounded-lg bg-secondary">
                    <p className="font-bold text-2xl">70K+</p>
                    <p className="text-sm text-muted-foreground">Users Served</p>
                  </div>
                   <div className="text-center p-4 rounded-lg bg-secondary">
                    <p className="font-bold text-2xl">5K+</p>
                    <p className="text-sm text-muted-foreground">Active Projects</p>
                  </div>
               </div>
                <p className="text-xs text-muted-foreground">These numbers are an estimate from our sources.</p>
            </div>
            <div className="relative">
              <MovieGrid />
            </div>
          </div>
        </div>

        <div id="documentation" className="container py-12 lg:py-24 border-t border-border/40">
           <div className="mx-auto max-w-3xl text-center">
             <h2 className="text-4xl font-black tracking-tighter">API Documentation</h2>
             <p className="mt-4 text-lg text-muted-foreground">Simple and straightforward to use.</p>
           </div>
           <div className="mt-12 bg-secondary rounded-lg p-6 max-w-4xl mx-auto font-mono text-sm">
             <div className="mb-4">
               <p className="font-bold text-foreground">Base URL</p>
               <code className="text-muted-foreground">https://your-app-url.com/</code>
             </div>
             <div className="mb-4">
                <p className="font-bold text-foreground">Endpoint</p>
                <p><span className="text-green-400">GET</span> <code className="text-muted-foreground">/&#123;letterboxd_username&#125;</code></p>
             </div>
             <div className="mb-4">
               <p className="font-bold text-foreground">Example Request</p>
               <code className="text-muted-foreground">
                 <Link href="/dave" target="_blank" className="hover:underline text-primary">
                    https://your-app-url.com/dave
                 </Link>
               </code>
             </div>
             <div>
                <p className="font-bold text-foreground">Example Response</p>
                <pre className="text-muted-foreground whitespace-pre-wrap overflow-x-auto p-4 bg-background rounded-md mt-2">
{`{
  "total_movies": 150,
  "tmdb_ids": [
    27205,
    155,
    680,
    ...
  ]
}`}
                </pre>
             </div>
           </div>
        </div>
      </main>

      <footer className="py-6 md:px-8 md:py-0 border-t border-border/40">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by <span className="font-bold text-foreground">kyzo</span>. For learning purposes only. This project is not affiliated with Letterboxd or TMDB.
          </p>
          <p className="text-sm text-muted-foreground">© {currentYear} LTRBXD API. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
