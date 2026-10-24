"use client";

import { Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Sheet } from "./overlay";
import { IconButton } from "./ui";

/** Hamburger for the player pages outside a game; the content is server-rendered. */
export function PlayerMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon={Menu} label="Menu" onClick={() => setOpen(true)} />
      <Sheet open={open} onClose={() => setOpen(false)} title="Menu">
        <div className="flex flex-col gap-1">{children}</div>
      </Sheet>
    </>
  );
}
