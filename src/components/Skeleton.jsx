export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#031d1f] via-[#083c3f] to-[#0d5b5f] p-8 animate-pulse">

      <div className="max-w-6xl mx-auto space-y-6">

        {/* HEADER */}
        <div className="h-20 bg-white/10 rounded-3xl" />

        {/* GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          <div className="h-[400px] bg-white/10 rounded-3xl" />
          <div className="h-[400px] bg-white/10 rounded-3xl" />
          <div className="h-[400px] bg-white/10 rounded-3xl" />

        </div>

        {/* ACTIONS */}
        <div className="h-14 w-64 ml-auto bg-white/10 rounded-xl" />
      </div>
    </div>
  );
}