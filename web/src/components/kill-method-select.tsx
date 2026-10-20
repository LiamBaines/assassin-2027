import { Select } from "@/components/select";
import type { KillMethod } from "@/lib/api-types";

/** Select for the `killMethodId` field; callers pass only the methods that can be chosen. */
export function KillMethodSelect({
  methods,
  defaultValue,
  name = "killMethodId",
}: {
  methods: Pick<KillMethod, "id" | "name" | "points">[];
  defaultValue?: number;
  name?: string;
}) {
  return (
    <Select
      name={name}
      required
      defaultValue={defaultValue === undefined ? "" : String(defaultValue)}
      aria-label="Kill method"
      placeholder="Method…"
      options={methods.map((m) => ({ value: String(m.id), label: `${m.name} (${m.points} pts)` }))}
    />
  );
}
