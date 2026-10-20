"use client";

import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

export type SelectOption = { value: string; label: string; disabled?: boolean };

const PANEL_MAX_HEIGHT = 280;

/**
 * Custom dropdown in the style of the Round actions menu. Submits `name` via a
 * hidden input; with `required`, that input blocks form submit while empty.
 * The panel is fixed-positioned so Dialog/Sheet/table overflow can't clip it.
 */
export function Select({
  options,
  value,
  defaultValue = "",
  onChange,
  name,
  required,
  disabled,
  placeholder = "Select…",
  className = "",
  "aria-label": ariaLabel,
  "data-testid": testId,
}: {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  name?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
  "data-testid"?: string;
}) {
  const [inner, setInner] = useState(defaultValue);
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  const selected = options.find((o) => o.value === current);

  const openMenu = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const flip = below < 160 && above > below;
    const space = flip ? above : below;
    setPanelStyle({
      // Grow away from the nearer screen edge so a wide panel never runs off it.
      ...(rect.left > window.innerWidth / 2
        ? { right: window.innerWidth - rect.right }
        : { left: rect.left }),
      minWidth: rect.width,
      maxWidth: window.innerWidth - 16,
      maxHeight: Math.min(PANEL_MAX_HEIGHT, space),
      ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    });
    setActive(Math.max(0, options.findIndex((o) => o.value === current && !o.disabled)));
    setOpen(true);
  };

  const choose = (o: SelectOption) => {
    if (o.disabled) return;
    if (value === undefined) setInner(o.value);
    onChange?.(o.value);
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: Event) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = (e: Event) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    const onResize = () => setOpen(false);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  useEffect(() => {
    if (open) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const step = (from: number, dir: 1 | -1) => {
    for (let i = from + dir; i >= 0 && i < options.length; i += dir) {
      if (!options[i].disabled) return i;
    }
    return from;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp":
        e.preventDefault();
        if (!open) openMenu();
        else setActive((a) => step(a, e.key === "ArrowDown" ? 1 : -1));
        break;
      case "Home":
      case "End":
        if (!open) return;
        e.preventDefault();
        setActive(e.key === "Home" ? step(-1, 1) : step(options.length, -1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (!open) openMenu();
        else if (options[active]) choose(options[active]);
        break;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        break;
      case "Tab":
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open && active >= 0 ? `${id}-${active}` : undefined}
        data-testid={testId}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
        className="flex w-full items-center justify-between gap-2 rounded-control border border-line bg-raised py-2 pr-2.5 pl-3 text-left text-sm hover:border-muted disabled:opacity-60"
      >
        <span className={selected ? "text-bone" : "text-muted"}>{selected?.label ?? placeholder}</span>
        <ChevronDown aria-hidden className="size-4 shrink-0 text-muted" />
      </button>
      {name && (
        <input
          name={name}
          value={current}
          required={required}
          tabIndex={-1}
          aria-hidden
          onChange={() => {}}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0"
        />
      )}
      {open && (
        <div
          ref={panelRef}
          id={`${id}-list`}
          role="listbox"
          aria-label={ariaLabel}
          style={panelStyle}
          className="fixed z-50 divide-y divide-line overflow-y-auto rounded-panel border border-line bg-surface py-1"
        >
          {options.map((o, i) => (
            <div
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === current}
              aria-disabled={o.disabled}
              // keep focus on the trigger so the listbox stays open for keyboard use
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => choose(o)}
              onPointerEnter={() => !o.disabled && setActive(i)}
              className={`flex cursor-pointer items-center gap-2 px-3 py-3 text-sm sm:py-2 ${
                i === active ? "bg-raised" : ""
              } ${o.disabled ? "cursor-not-allowed text-muted" : ""}`}
            >
              <span className="flex-1 text-left whitespace-nowrap">{o.label}</span>
              {o.value === current && <Check aria-hidden className="size-4 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
