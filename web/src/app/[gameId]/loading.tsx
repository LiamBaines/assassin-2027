import { Skeleton } from "@/components/ui";

export default function Loading() {
  return (
    <div aria-busy className="mx-auto w-full max-w-md flex-1 space-y-4 px-4 pt-6">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="mt-10 h-16 w-full" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}
