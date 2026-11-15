'use client';

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="bg-zinc-950 text-zinc-100 grid place-items-center min-h-screen">
        <div className="text-center p-6 max-w-md">
          <h2 className="text-xl font-bold mb-2 text-white">Something went wrong</h2>
          <p className="text-sm text-zinc-400 mb-4">{error?.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-lime-400 hover:bg-lime-300 text-zinc-950 font-semibold rounded-md transition"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
