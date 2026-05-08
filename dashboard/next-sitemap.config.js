const fs = require("fs");
const path = require("path");

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: "https://buddieai.com",
  generateRobotsTxt: true,
  changefreq: "daily",
  priority: 0.7,
  sitemapSize: 7000,
  additionalPaths: async () => {
    const blogDir = path.join(__dirname, "content", "blog");
    let blogSlugs = [];
    try {
      blogSlugs = fs
        .readdirSync(blogDir)
        .filter((name) => name.endsWith(".mdx"))
        .map((name) => name.replace(/\.mdx$/, ""));
    } catch {
      blogSlugs = [];
    }

    const base = [
      { loc: "/" },
      { loc: "/about" },
      { loc: "/demo" },
      { loc: "/pricing" },
      { loc: "/privacy" },
      { loc: "/terms" },
      { loc: "/challenge" },
      { loc: "/state-of-ai-emotions" },
      { loc: "/integrations" },
      { loc: "/shopify" },
      { loc: "/blog" },
      { loc: "/login" },
      { loc: "/register" },
      { loc: "/product-hunt" },
    ];

    const blogPaths = blogSlugs.map((slug) => ({ loc: `/blog/${slug}` }));
    return [...base, ...blogPaths];
  },
};
