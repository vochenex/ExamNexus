import Skeleton from "./Skeleton";

export default function SkeletonCard() {
  return (
    <div className="bg-white/5 border border-white/10 p-5 rounded-2xl space-y-3">
      
      {/* Title */}
      <Skeleton className="h-5 w-2/3" />

      {/* Subtitle */}
      <Skeleton className="h-4 w-1/3" />

      {/* Divider / stats */}
      <Skeleton className="h-10 w-full" />

      {/* Buttons */}
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-8 w-24" />
      </div>

    </div>
  );
}