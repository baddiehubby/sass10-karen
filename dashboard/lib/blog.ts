import { readFile } from "fs/promises";
import path from "path";
import matter from "gray-matter";

const POSTS_DIR = path.join(process.cwd(), "content", "blog");

export type BlogFrontmatter = {
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
};

export type BlogPostSummary = BlogFrontmatter & {
  slug: string;
};

async function getPostSlugs(): Promise<string[]> {
  const fs = await import("fs/promises");
  const entries = await fs.readdir(POSTS_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mdx"))
    .map((entry) => entry.name.replace(/\.mdx$/, ""));
}

export async function getAllPosts(): Promise<BlogPostSummary[]> {
  const slugs = await getPostSlugs();
  const posts = await Promise.all(slugs.map((slug) => getPostBySlug(slug)));
  return posts
    .map((post) => ({
      slug: post.slug,
      title: post.frontmatter.title,
      description: post.frontmatter.description,
      date: post.frontmatter.date,
      author: post.frontmatter.author,
      tags: post.frontmatter.tags,
    }))
    .sort((a, b) => +new Date(b.date) - +new Date(a.date));
}

export async function getPostBySlug(slug: string): Promise<{ slug: string; content: string; frontmatter: BlogFrontmatter }> {
  const filePath = path.join(POSTS_DIR, `${slug}.mdx`);
  const source = await readFile(filePath, "utf8");
  const parsed = matter(source);
  return {
    slug,
    content: parsed.content,
    frontmatter: parsed.data as BlogFrontmatter,
  };
}
