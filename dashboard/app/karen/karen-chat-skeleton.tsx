/**
 * Dark loading skeleton for /karen — full-screen avatar stage (no white flash).
 */
export function KarenChatSkeleton() {
  return (
    <div
      className="relative h-[100dvh] w-screen overflow-hidden bg-black text-white"
      aria-busy="true"
      aria-label="Loading Karen"
    >
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
        <div className="h-40 w-40 animate-pulse rounded-full bg-rose-500/20 ring-2 ring-rose-400/30" />
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-black/80 via-black/40 to-transparent"
        aria-hidden
      />
      <div className="absolute left-3 right-3 top-4 mx-auto h-14 max-w-lg animate-pulse rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md" />
      <div className="absolute inset-x-3 bottom-20 mx-auto h-40 max-w-lg animate-pulse rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md" />
    </div>
  );
}
