import { inputClass } from "@/components/ui";
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
    <select
      name={name}
      required
      defaultValue={defaultValue ?? ""}
      aria-label="Kill method"
      className={`${inputClass} !w-auto !py-2 text-sm`}
    >
      <option value="" disabled>
        Method…
      </option>
      {methods.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.points} pts)
        </option>
      ))}
    </select>
  );
}
