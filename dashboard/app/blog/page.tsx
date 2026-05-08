import type { Metadata } from "next";
import Link from "next/link";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description: "Buddie AI insights on emotional intelligence, AI chat UX, and companion analytics.",
  alternates: { canonical: "/blog" },
};

export default async function BlogIndexPage() {
  const posts = await getAllPosts();

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-14">
      <p className="text-xs uppercase tracking-[0.28em] text-indigo-300">Buddie AI · blog</p>
      <h1 className="mt-4 text-3xl font-semibold text-white sm:text-5xl">Emotional intelligence for AI chat</h1>
      <p className="mt-4 max-w-3xl text-slate-300">
        Launch notes, practical guides, and research-style stories on how to humanize your AI with Buddie telemetry.
      </p>

      <div className="mt-10 grid gap-4">
        {posts.map((post) => (
          <article key={post.slug} className="glass-panel p-6">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {new Date(post.date).toLocaleDateString()} · {post.author}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">{post.title}</h2>
            <p className="mt-2 text-sm text-slate-300">{post.description}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full border border-white/15 px-2 py-1 text-xs text-slate-300">
                  {tag}
                </span>
              ))}
            </div>
            <Link href={`/blog/${post.slug}`} className="mt-4 inline-flex text-sm font-medium text-indigo-300 hover:underline">
              Read article →
            </Link>
          </article>
        ))}
      </div>
    </main>
  );
}
