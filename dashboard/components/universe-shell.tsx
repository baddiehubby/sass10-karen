"use client";

import { usePathname } from "next/navigation";
import type { UniverseWorld } from "@/lib/universe-flags";

function worldFromPath(pathname: string): UniverseWorld | null {
  if (pathname.startsWith("/dashboard/oracle")) return "oracle";
  if (pathname.startsWith("/dashboard/mood")) return "mood";
  if (pathname === "/dashboard") return "buddy";
  return null;
}

const WORLD_LABEL: Record<UniverseWorld, string> = {
  buddy: "Buddy World",
  mood: "Mood Universe",
  oracle: "Oracle Realm",
};

export function UniverseShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const world = worldFromPath(pathname);

  if (!world) return <>{children}</>;

  return (
    <div className={`universe-shell universe-${world}`}>
      <p className="universe-whisper" aria-hidden>
        {WORLD_LABEL[world]}
      </p>
      {children}
    </div>
  );
}
