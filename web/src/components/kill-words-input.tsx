"use client";

import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/ui";

/** Single-line word inputs; a fresh empty one appears once the last has text. */
export function KillWordsInput() {
  const [values, setValues] = useState([""]);
  const ref = useRef<HTMLDivElement>(null);

  // React resets the form after a successful action; mirror that in state.
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const reset = () => setValues([""]);
    form.addEventListener("reset", reset);
    return () => form.removeEventListener("reset", reset);
  }, []);

  function change(index: number, value: string) {
    setValues((prev) => {
      const next = prev.map((v, i) => (i === index ? value : v));
      if (index === next.length - 1 && value.trim() !== "") next.push("");
      return next;
    });
  }

  return (
    <div ref={ref} className="space-y-2">
      {values.map((value, i) => (
        <input
          key={i}
          type="text"
          name="words"
          value={value}
          onChange={(e) => change(i, e.target.value)}
          aria-label={`Word ${i + 1}`}
          placeholder={i === 0 ? "A word or phrase" : undefined}
          autoComplete="off"
          required={i === 0}
          data-testid={i === 0 ? "kill-words-input" : undefined}
          className={`${inputClass} resize-none`}
        />
      ))}
    </div>
  );
}
