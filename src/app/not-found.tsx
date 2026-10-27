import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col justify-center px-6">
      <h1 className="font-serif text-5xl">Page not found</h1>
      <p className="mt-3 text-stone">That address is not part of AuraNova.</p>
      <Link href="/" className="mt-6 underline">Back home</Link>
    </main>
  );
}
