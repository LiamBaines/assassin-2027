"use client";

import { LayoutList, Menu, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Sheet } from "@/components/overlay";
import { IconButton } from "@/components/ui";

type Item = { href: string; label: string; icon: LucideIcon; exact?: boolean };

const ITEMS: Item[] = [{ href: "/admin", label: "Games", icon: LayoutList, exact: true }];

function NavLink({ item, onNavigate }: { item: Item; onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = item.exact ? pathname === item.href : pathname.startsWith(item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={`flex items-center gap-3 rounded-control px-3 py-2 text-sm ${
        current ? "bg-raised font-medium text-bone" : "text-muted hover:bg-raised hover:text-bone"
      }`}
    >
      <Icon aria-hidden className={`size-4 ${current ? "text-blood" : ""}`} />
      {item.label}
    </Link>
  );
}

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Admin" className="space-y-1">
      {ITEMS.map((i) => (
        <NavLink key={i.href} item={i} onNavigate={onNavigate} />
      ))}
    </nav>
  );
}

/**
 * Persistent sidebar on desktop, a top bar with a sheet on mobile. It lives in
 * the admin layout, so moving between sections never remounts it.
 */
export function AdminChrome({
  children,
  footer,
}: {
  children: ReactNode;
  footer: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const { gameId } = useParams<{ gameId?: string }>();
  // Game screens bring their own top bar and tabs; the sidebar is for the games list.
  if (gameId) {
    return (
      <main className="min-w-0 flex-1 px-4 py-4 md:px-8 md:py-6">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    );
  }
  return (
    <div className="flex flex-1 flex-col md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="sticky top-0 flex h-dvh flex-col gap-6 p-4">
          <p className="font-display px-3 pt-1 text-xl font-semibold">Assassin 2027</p>
          <NavList />
          <div className="mt-auto space-y-2 border-t border-line pt-3">{footer}</div>
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 md:hidden">
        <p className="font-display text-xl font-semibold">Assassin 2027</p>
        <IconButton icon={Menu} label="Menu" onClick={() => setOpen(true)} />
      </header>
      <Sheet open={open} onClose={() => setOpen(false)} title="Admin">
        <NavList onNavigate={() => setOpen(false)} />
        <div className="mt-4 space-y-2 border-t border-line pt-3">{footer}</div>
      </Sheet>

      <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
