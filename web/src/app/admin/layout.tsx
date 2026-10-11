import { Gamepad2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/api";
import { AdminChrome } from "./admin-nav";

export const metadata: Metadata = { title: "Admin · Assassin 2027" };

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireAdmin();

  return (
    <AdminChrome
      footer={
        <>
          <Link
            href={me.games.length > 0 ? "/me" : "/join"}
            className="flex items-center gap-3 rounded-control px-3 py-2 text-sm text-muted hover:bg-raised hover:text-bone"
          >
            <Gamepad2 aria-hidden className="size-4" />
            Player view
          </Link>
          <p className="truncate px-3 text-xs text-muted" title={me.email}>
            {me.email}
          </p>
          <SignOutButton />
        </>
      }
    >
      {children}
    </AdminChrome>
  );
}
