import type { KillMethodInput } from "@/lib/api-types";

/**
 * Reads the method editor's fields (`method.<i>.id|name|points|enabled`).
 * Returns undefined when the form has no editor, and null when a row is invalid.
 */
export function parseKillMethods(
  formData: FormData,
): KillMethodInput[] | undefined | null {
  const indexes = new Set<string>();
  for (const key of formData.keys()) {
    const m = /^method\.(\d+)\./.exec(key);
    if (m) indexes.add(m[1]);
  }
  if (indexes.size === 0) return undefined;

  const methods: KillMethodInput[] = [];
  for (const i of [...indexes].sort((a, b) => Number(a) - Number(b))) {
    const name = String(formData.get(`method.${i}.name`) ?? "").trim();
    const points = Number(formData.get(`method.${i}.points`));
    const rawId = String(formData.get(`method.${i}.id`) ?? "");
    const id = rawId === "" ? undefined : Number(rawId);
    if (!name || !Number.isInteger(points) || points < 0) return null;
    if (id !== undefined && (!Number.isInteger(id) || id < 1)) return null;
    methods.push({
      ...(id === undefined ? {} : { id }),
      name,
      points,
      enabled: formData.get(`method.${i}.enabled`) === "on",
    });
  }
  return methods;
}

/** Reads a positive integer id field, or null when it is missing or malformed. */
export function readMethodId(formData: FormData, field = "killMethodId") {
  const raw = String(formData.get(field) ?? "");
  const id = Number(raw);
  return raw !== "" && Number.isInteger(id) && id > 0 ? id : null;
}
