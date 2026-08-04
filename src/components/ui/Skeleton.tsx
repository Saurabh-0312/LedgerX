/** Loading skeleton block — pair with the .skeleton shimmer utility. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`skeleton ${className}`} />;
}

/** A card-shaped skeleton with title + body lines, for page-level suspense fallbacks. */
export function CardSkeleton({ lines = 4, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`card p-5 ${className}`}>
      <Skeleton className="mb-4 h-4 w-32" />
      <div className="space-y-2.5">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-3 ${i === lines - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    </div>
  );
}

/** Full-page fallback used by route-level lazy loading. */
export function PageSkeleton() {
  return (
    <div className="animate-in space-y-4">
      <Skeleton className="h-7 w-48" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-72" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
