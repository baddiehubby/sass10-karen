/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL || "https://www.buddieai.com",
  generateRobotsTxt: true,
  exclude: [
    "/dashboard",
    "/dashboard/*",
    "/consent",
    "/onboarding",
    "/login",
    "/register",
    "/api/*",
    "/debiopwr",
    "/debiopwr/*",
    "/server-sitemap.xml",
  ],
  robotsTxtOptions: {
    policies: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/dashboard", "/consent", "/onboarding", "/login", "/register", "/api", "/debiopwr"],
      },
    ],
    additionalSitemaps: [],
  },
};
