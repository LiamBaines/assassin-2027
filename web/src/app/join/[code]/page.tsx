import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";
import { Alert, Card, PlayerShell } from "@/components/ui";
import { getMe, isApiError, previewJoin, type JoinPreview } from "@/lib/api";
import { normalizeJoinCode } from "@/lib/join-code";
import { joinAction } from "../actions";
import { JoinForm } from "./join-form";

export const metadata: Metadata = { title: "Join · Assassin 2027" };

type Preview =
  | { kind: "ok"; preview: JoinPreview }
  | { kind: "invalid" }
  | { kind: "rateLimited" };

async function loadPreview(code: string | null): Promise<Preview> {
  if (!code) return { kind: "invalid" };
  try {
    const preview = await previewJoin(code);
    return preview ? { kind: "ok", preview } : { kind: "invalid" };
  } catch (e) {
    if (isApiError(e, "TOO_MANY_ATTEMPTS")) return { kind: "rateLimited" };
    throw e;
  }
}

export default async function JoinCodePage(props: {
  params: Promise<{ code: string }>;
}) {
  const { code: rawCode } = await props.params;
  const code = normalizeJoinCode(rawCode);
  const [me, result] = await Promise.all([getMe(), loadPreview(code)]);

  if (result.kind === "ok" && result.preview.alreadyJoined) {
    redirect(`/games/${encodeURIComponent(result.preview.gameId)}`);
  }

  const footer = (
    <div className="flex items-center justify-between text-sm text-zinc-600">
      <span>Signed in as {me.email}</span>
      <SignOutButton />
    </div>
  );

  if (result.kind !== "ok") {
    return (
      <PlayerShell title="Join a game" isAdmin={me.isAdmin}>
        <Card className="space-y-4">
          <Alert>
            {result.kind === "rateLimited"
              ? "Too many wrong join codes. Wait a few minutes and try again."
              : "This join link isn't valid."}
          </Alert>
          <Link href="/join" className="block text-sm font-medium underline">
            Enter a join code
          </Link>
        </Card>
        {footer}
      </PlayerShell>
    );
  }

  const { preview } = result;
  return (
    <PlayerShell title={`Join ${preview.name}`} isAdmin={me.isAdmin}>
      <Card className="space-y-4">
        {preview.signupsOpen && code ? (
          <JoinForm action={joinAction.bind(null, code)} />
        ) : (
          <Alert tone="info">Signups are closed.</Alert>
        )}
      </Card>
      {footer}
    </PlayerShell>
  );
}
