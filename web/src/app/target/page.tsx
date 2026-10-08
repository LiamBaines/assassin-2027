import type { Metadata } from "next";
import Link from "next/link";
import { Card, PlayerShell } from "@/components/ui";
import { getMyTarget } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Target · Assassin 2027" };

export default async function TargetPage() {
  const assignment = await getMyTarget();

  return (
    <PlayerShell title="Your target">
      <Card className="py-10 text-center">
        {assignment ? (
          <>
            <p
              data-testid="target-name"
              className="text-3xl font-semibold break-words"
            >
              {assignment.target.displayName}
            </p>
            <p className="mt-3 text-xs text-zinc-500">
              Assigned {formatDateTime(assignment.assignedAt)}
            </p>
          </>
        ) : (
          <p data-testid="target-name" className="text-lg text-zinc-600">
            No target yet
          </p>
        )}
      </Card>
      <Link href="/me" className="block text-center text-sm text-zinc-600 underline">
        Back to my page
      </Link>
    </PlayerShell>
  );
}
