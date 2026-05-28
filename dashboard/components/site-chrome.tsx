"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { SiteHeader } from "@/components/site-header";
import { CookieBanner } from "@/components/CookieBanner";
import { brandingFromHostname } from "@/lib/tenant-brand";

const IMMERSIVE_PREFIXES = ["/dashboard"];
const IMMERSIVE_EXACT = new Set(["/", "/login", "/pwa"]);

function isImmersiveRoute(pathname: string) {
  if (IMMERSIVE_EXACT.has(pathname)) return true;
  return IMMERSIVE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

type SiteChromeProps = {
  children: React.ReactNode;
  widgetScriptUrl: string;
  apiBase: string;
};

export function SiteChrome({ children, widgetScriptUrl, apiBase }: SiteChromeProps) {
  const pathname = usePathname() ?? "/";
  const branding = brandingFromHostname(typeof window !== "undefined" ? window.location.hostname : "");
  const immersive = isImmersiveRoute(pathname);
  const showWidget = pathname !== "/" && !pathname.startsWith("/dashboard");

  return (
    <>
      {showWidget ? (
        <Script
          src={widgetScriptUrl}
          data-hq-key="DEMO-FREE-LICENSE"
          data-hq-api={apiBase}
          strategy="afterInteractive"
        />
      ) : null}

      {!immersive ? <SiteHeader /> : null}
      <div className={immersive ? "min-h-full" : "flex-1"}>{children}</div>
      {!immersive ? (
        <footer className="mt-16 border-t border-white/10 py-6">
          <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-6 text-sm text-slate-400">
            <p>
              © {new Date().getFullYear()} {branding.name}
            </p>
            <div className="flex items-center gap-4">
              <Link href="/trust-center" className="hover:text-white">
                Trust Center
              </Link>
              <Link href="/eu-ai-act" className="hover:text-white">
                EU AI Act
              </Link>
              <Link href="/gdpr" className="hover:text-white">
                GDPR
              </Link>
              <Link href="/privacy" className="hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white">
                Terms
              </Link>
            </div>
          </div>
        </footer>
      ) : null}
      {!immersive ? <CookieBanner /> : null}
    </>
  );
}
