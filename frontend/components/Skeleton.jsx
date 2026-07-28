export default function Skeleton({ className = "" }) {
  return <div className={`animate-pulse rounded-md bg-white/10 ${className}`} />;
}

export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#031d1f] via-[#083c3f] to-[#0d5b5f] p-8 animate-pulse">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-20 rounded-3xl bg-white/10" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-[400px] rounded-3xl bg-white/10" />
          <div className="h-[400px] rounded-3xl bg-white/10" />
          <div className="h-[400px] rounded-3xl bg-white/10" />
        </div>
        <div className="ml-auto h-14 w-64 rounded-xl bg-white/10" />
      </div>
    </div>
  );
}
