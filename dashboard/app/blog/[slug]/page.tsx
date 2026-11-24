import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { compileMDX } from "next-mdx-remote/rsc";
import { getPostBySlug } from "@/lib/blog";

type Params = { slug: string };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  try {
    const post = await getPostBySlug(params.slug);
    return {
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      alternates: { canonical: `/blog/${params.slug}` },
    };
  } catch {
    return {
      title: "Blog",
      description: "Buddie AI blog.",
    };
  }
}

export default async function BlogPostPage({ params }: { params: Params }) {
  let post: Awaited<ReturnType<typeof getPostBySlug>>;
  try {
    post = await getPostBySlug(params.slug);
  } catch {
    notFound();
  }

  const { content } = await compileMDX<{ title: string }>({
    source: post.content,
    options: { parseFrontmatter: false },
  });

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-14">
      <article className="glass-panel p-8 sm:p-10">
        <Link href="/blog" className="text-sm text-indigo-300 hover:underline">
          ← Back to blog
        </Link>
        <p className="mt-4 text-xs uppercase tracking-wide text-slate-500">
          {new Date(post.frontmatter.date).toLocaleDateString()} · {post.frontmatter.author}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white">{post.frontmatter.title}</h1>
        <p className="mt-3 text-sm text-slate-300">{post.frontmatter.description}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.frontmatter.tags.map((tag) => (
            <span key={tag} className="rounded-full border border-white/15 px-2 py-1 text-xs text-slate-300">
              {tag}
            </span>
          ))}
        </div>

        <div className="prose prose-invert mt-8 max-w-none prose-headings:text-white prose-p:text-slate-200 prose-a:text-indigo-300">
          {content}
        </div>
      </article>
    </main>
  );
}
