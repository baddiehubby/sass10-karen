export default function DashboardLoading() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="glass-panel shimmer h-10 w-64" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="glass-panel shimmer h-28" />
        <div className="glass-panel shimmer h-28" />
        <div className="glass-panel shimmer h-28" />
      </div>
      <div className="mt-6 glass-panel shimmer h-64" />
    </main>
  );
}
