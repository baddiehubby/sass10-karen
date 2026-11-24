import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-lg flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-slate-400">404</p>
      <h1 className="text-2xl font-semibold text-slate-100">Page not found</h1>
      <p className="text-sm text-slate-400">
        That route does not exist. Head back and try another path.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900"
      >
        Go home
      </Link>
    </main>
  );
}
