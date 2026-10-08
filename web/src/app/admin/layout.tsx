import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { requireAdmin } from "@/lib/api";

export const metadata: Metadata = { title: "Admin · Assassin 2027" };

const NAV = [
  { href: "/admin", label: "Game" },
  { href: "/admin/players", label: "Players" },
  { href: "/admin/rings", label: "Rings" },
] as const;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const me = await requireAdmin();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-8 px-6 py-3">
          <span className="font-semibold">Assassin 2027 admin</span>
          <nav className="flex gap-5 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-zinc-600 hover:text-zinc-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm text-zinc-600">
            <Link href={me.player ? "/me" : "/join"} className="hover:text-zinc-900">
              Player view
            </Link>
            <span>{me.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
