"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6">
      <h1 className="font-serif text-5xl">Something went wrong</h1>
      <p className="mt-3 text-stone">The page could not be loaded. Try again, or return home.</p>
      <button type="button" className="mt-6 w-fit rounded-full bg-forest px-5 py-2 text-white" onClick={() => reset()}>Try again</button>
    </main>
  );
}
