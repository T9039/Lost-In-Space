import type { Fact, Item } from "./types";

export interface SpecRow {
  key: string;
  a: string;
  b: string;
  same: boolean;
}

export interface CompareResult {
  a: Item;
  b: Item;
  specs: SpecRow[];
  sharedCount: number;
  differentCount: number;
  highlights: string[];
  factsByKind: { kind: string; a: Fact[]; b: Fact[] }[];
}

const numberIn = (s?: string): number | null => {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
};

/**
 * Deterministic comparison. No LLM: everything here is derived from the
 * facts layer, which is why the output cannot be wrong.
 */
export function compareItems(a: Item, b: Item): CompareResult {
  const keys = Array.from(new Set([...Object.keys(a.specs), ...Object.keys(b.specs)]));
  const specs: SpecRow[] = keys.map((key) => {
    const av = a.specs[key] ?? "—";
    const bv = b.specs[key] ?? "—";
    return { key, a: av, b: bv, same: av === bv };
  });

  const sharedCount = specs.filter((s) => s.same).length;
  const differentCount = specs.length - sharedCount;

  const highlights: string[] = [];

  const massA = numberIn(a.specs["Launch mass"]);
  const massB = numberIn(b.specs["Launch mass"]);
  if (massA && massB && massA !== massB) {
    const [heavy, light, ratio] = massA > massB ? [a, b, massA / massB] : [b, a, massB / massA];
    highlights.push(
      `${heavy.short_name} is about ${ratio.toFixed(1)}× heavier at launch than ${light.short_name}.`
    );
  }

  if (a.location.label !== b.location.label) {
    highlights.push(
      `${a.short_name} is at ${a.location.label}; ${b.short_name} is at ${b.location.label}.`
    );
  }

  const samePower =
    a.specs["Power source"] && a.specs["Power source"] === b.specs["Power source"];
  if (samePower) {
    highlights.push(`Both run on ${a.specs["Power source"].toLowerCase()}.`);
  } else if (a.specs["Power source"] && b.specs["Power source"]) {
    highlights.push(
      `Different power: ${a.short_name} uses ${a.specs["Power source"].toLowerCase()}, ${b.short_name} uses ${b.specs["Power source"].toLowerCase()}.`
    );
  }

  const kinds = Array.from(
    new Set([...a.facts.map((f) => f.kind), ...b.facts.map((f) => f.kind)])
  );
  const factsByKind = kinds.map((kind) => ({
    kind,
    a: a.facts.filter((f) => f.kind === kind),
    b: b.facts.filter((f) => f.kind === kind),
  }));

  return { a, b, specs, sharedCount, differentCount, highlights, factsByKind };
}

export const KIND_LABEL: Record<string, string> = {
  spec: "Specifications",
  mission: "Mission record",
  discovery: "Discovery",
  legacy: "Legacy",
};
