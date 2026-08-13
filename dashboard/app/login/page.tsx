async redirect({ url }) {
  const siteUrl = getCanonicalSiteUrl();
  // Allow explicit dashboard callbacks; force everything else to /dashboard
  if (url.startsWith("/dashboard")) return `${siteUrl}${url}`;
  try {
    const target = new URL(url);
    const allowed = new URL(siteUrl);
    if (target.origin === allowed.origin && target.pathname.startsWith("/dashboard")) {
      return url;
    }
  } catch {
    /* ignore malformed url */
  }
  return resolvePostAuthCallbackUrl("/dashboard");
}
