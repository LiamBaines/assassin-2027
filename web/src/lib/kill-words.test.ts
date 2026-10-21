import { describe, expect, it } from "vitest";
import { deathSentenceEnabled, parseWords, splitWordLines } from "./kill-words";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};

describe("parseWords", () => {
  it("is undefined without a words step", () => {
    expect(parseWords(form({ name: "x" }))).toBeUndefined();
  });

  it("trims words and leaves blanks out", () => {
    expect(parseWords(form({ [`word.${A}`]: "  pineapple ", [`word.${B}`]: " " }))).toEqual({
      [A]: "pineapple",
    });
  });

  it("limits to the given players", () => {
    expect(parseWords(form({ [`word.${A}`]: "a", [`word.${B}`]: "b" }), [B])).toEqual({ [B]: "b" });
  });

  it("rejects a key that isn't a player id", () => {
    expect(parseWords(form({ "word.nope": "a" }))).toBeNull();
  });
});

describe("splitWordLines", () => {
  it("splits on lines and drops blanks", () => {
    expect(splitWordLines("one\r\n\n two words \n")).toEqual(["one", "two words"]);
  });
});

describe("deathSentenceEnabled", () => {
  it("matches the enabled method by name, ignoring case", () => {
    expect(deathSentenceEnabled([{ name: "death sentence", enabled: true }])).toBe(true);
    expect(deathSentenceEnabled([{ name: "Death Sentence", enabled: false }])).toBe(false);
    expect(deathSentenceEnabled([{ name: "Stab", enabled: true }])).toBe(false);
  });
});
