"use client";

import { useState } from "react";
import { secondaryButtonClass } from "@/components/ui";

/** Copies `text` to the clipboard and briefly confirms it. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (for example an insecure origin); the link stays selectable.
    }
  }

  return (
    <button type="button" onClick={copy} className={secondaryButtonClass}>
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}
