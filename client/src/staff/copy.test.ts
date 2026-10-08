import { describe, expect, it } from "vitest";
import { enMessages } from "./copy";
import { ar } from "./copy.ar";
import { tr } from "./copy.tr";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Array<[string, string]> {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "string" ? [[`${prefix}${key}`, value] as [string, string]] : leaves(value, `${prefix}${key}.`)
  );
}

const english = new Map(leaves(enMessages as unknown as Tree));

describe.each([
  ["Arabic", ar],
  ["Turkish", tr],
])("%s staff copy", (_name, dictionary) => {
  const entries = leaves(dictionary as unknown as Tree);

  it("has every English key and no empty strings", () => {
    expect(entries.map(([key]) => key).sort()).toEqual([...english.keys()].sort());
    expect(entries.filter(([key, value]) => !value.trim() && english.get(key)?.trim())).toEqual([]);
  });

  it("is actually translated", () => {
    // Product names, codes, and symbols may stay as they are.
    const same = entries.filter(([key, value]) => value === english.get(key) && /[a-z]{4,}/i.test(value));
    expect(same.length / entries.length).toBeLessThan(0.04);
  });
});
