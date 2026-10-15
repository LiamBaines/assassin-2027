import { Select } from "@/components/ui";
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
    <Select name={name} required defaultValue={defaultValue ?? ""} aria-label="Kill method">
      <option value="" disabled>
        Method…
      </option>
      {methods.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.points} pts)
        </option>
      ))}
    </Select>
  );
}
