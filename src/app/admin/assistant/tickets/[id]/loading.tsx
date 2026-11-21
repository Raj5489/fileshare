import { Skeleton } from "@/components/assistant/admin/Skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-5 rounded-lg" />
        <Skeleton className="h-6 w-36" />
        <Skeleton className="ml-auto h-6 w-20 rounded-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="mb-3 h-3 w-20" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-3/4" />
            <Skeleton className="mt-2 h-4 w-1/2" />
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="mb-3 h-3 w-16" />
            <div className="grid grid-cols-2 gap-3">
              {[0,1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <Skeleton className="mb-3 h-3 w-24" />
            <Skeleton className="h-8 w-full rounded-lg" />
            <Skeleton className="mt-2 h-8 w-full rounded-lg" />
            <Skeleton className="mt-2 h-24 w-full rounded-lg" />
            <Skeleton className="mt-3 h-9 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
