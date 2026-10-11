import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div aria-busy className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
