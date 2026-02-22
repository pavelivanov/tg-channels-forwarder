import { Skeleton } from '@/components/ui/skeleton';

export function LoadingSpinner() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="rounded-lg border bg-card py-3 px-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-48" />
        </div>
      ))}
    </div>
  );
}
