import { describe, expect, it } from "vitest";
import { parseKillMethods, readMethodId } from "./kill-methods";

function form(entries: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
}

describe("parseKillMethods", () => {
  it("is undefined when the form has no editor", () => {
    expect(parseKillMethods(form({ expectedRoundNo: "1" }))).toBeUndefined();
  });

  it("reads rows in index order, with new rows lacking an id", () => {
    const f = form({
      "method.1.name": " Spoon ",
      "method.1.points": "7",
      "method.0.id": "4",
      "method.0.name": "Clamp",
      "method.0.points": "10",
      "method.0.enabled": "on",
    });
    expect(parseKillMethods(f)).toEqual([
      { id: 4, name: "Clamp", points: 10, enabled: true },
      { name: "Spoon", points: 7, enabled: false },
    ]);
  });

  it("rejects a blank name, bad points or a bad id", () => {
    expect(parseKillMethods(form({ "method.0.name": " ", "method.0.points": "1" }))).toBeNull();
    expect(parseKillMethods(form({ "method.0.name": "a", "method.0.points": "-1" }))).toBeNull();
    expect(parseKillMethods(form({ "method.0.name": "a", "method.0.points": "1.5" }))).toBeNull();
    expect(
      parseKillMethods(form({ "method.0.id": "x", "method.0.name": "a", "method.0.points": "1" })),
    ).toBeNull();
  });
});

describe("readMethodId", () => {
  it("accepts positive integers only", () => {
    expect(readMethodId(form({ killMethodId: "12" }))).toBe(12);
    expect(readMethodId(form({ killMethodId: "" }))).toBeNull();
    expect(readMethodId(form({ killMethodId: "0" }))).toBeNull();
    expect(readMethodId(form({ killMethodId: "abc" }))).toBeNull();
    expect(readMethodId(form({}))).toBeNull();
  });
});
