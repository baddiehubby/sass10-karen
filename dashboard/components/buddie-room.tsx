import Link from "next/link";

export function BuddieRoom({
  title,
  whisper,
  children,
}: {
  title: string;
  whisper: string;
  children: React.ReactNode;
}) {
  return (
    <div className="buddie-home mx-auto min-h-[calc(100vh-5rem)] w-full max-w-xl px-6 pb-24 pt-4">
      <Link href="/dashboard" className="text-xs text-white/35 hover:text-white/55">
        ← Home
      </Link>
      <h1 className="buddie-brand mt-6 text-4xl text-[#f4efe6]">{title}</h1>
      <p className="mt-2 text-sm text-white/45">{whisper}</p>
      <div className="mt-10 space-y-8">{children}</div>
    </div>
  );
}
