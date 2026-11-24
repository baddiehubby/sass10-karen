"use client";

import dynamic from "next/dynamic";

/**
 * Client-only loader so root `layout.tsx` (Server Component) never uses
 * `next/dynamic(..., { ssr: false })` directly — that breaks `/_not-found` prerender.
 */
export const KarenAlarmWatcherLoader = dynamic(
  () =>
    import("@/components/karen/karen-alarm-watcher").then((m) => m.KarenAlarmWatcher),
  { ssr: false },
);
