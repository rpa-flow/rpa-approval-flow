import { Skeleton } from "@/components/ui/skeleton";
export function LoadingState({ rows = 4 }: { rows?: number }) { return <div className="grid gap-3 rounded-md border border-border bg-surface-container-lowest p-5">{Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>; }
