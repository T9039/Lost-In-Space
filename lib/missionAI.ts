import type { Fact, Item, Source } from "./types";

export type ReadingLevel = "primary" | "high";

export interface AICitation {
  id: string;
  title: string;
  publisher: string;
  url: string;
}

export interface AIAnswer {
  answer: string;
  bullets: string[];
  citations: AICitation[];
  quiz?: { question: string; answer: string }[];
}

const STOP = new Set([
  "the", "and", "for", "was", "were", "are", "is", "its", "it", "this", "that", "with",
  "from", "what", "why", "how", "did", "does", "do", "can", "you", "me", "about", "tell",
  "there", "their", "they", "has", "have", "had", "into", "when", "where", "which", "who",
]);

const words = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

function uniqueCitations(sources: Source[], ids: string[]): AICitation[] {
  const seen = new Set<string>();
  const out: AICitation[] = [];
  for (const id of ids) {
    if (seen.has(id)) continue;
    const src = sources.find((s) => s.id === id);
    if (!src) continue;
    seen.add(id);
    out.push({ id: src.id, title: src.title, publisher: src.publisher, url: src.url });
  }
  return out;
}

function scoreFacts(item: Item, question: string): Fact[] {
  const q = words(question);
  if (q.length === 0) return [];
  return item.facts
    .map((fact) => {
      const hay = words(`${fact.label} ${fact.claim} ${fact.value}`);
      let score = 0;
      for (const w of q) if (hay.includes(w)) score += 1;
      return { fact, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((r) => r.fact);
}

const trim = (level: ReadingLevel, bullets: string[]) =>
  level === "primary" ? bullets.slice(0, 2) : bullets.slice(0, 3);

/**
 * Deterministic, fully grounded responder: no model, no invention.
 * Every sentence is copied from the item's own facts/phases and every
 * answer carries the NASA source ids behind it.
 */
export function answerQuestion(
  item: Item,
  sources: Source[],
  question: string,
  level: ReadingLevel
): AIAnswer {
  const q = question.toLowerCase();
  const srcIds = (facts: Fact[]) => uniqueCitations(sources, facts.map((f) => f.source_id));

  if (/why|left behind|abandon|forgot|forgotten|silent/i.test(q)) {
    const abandoned = item.facts.filter((f) => f.phase_key === "abandoned");
    const phase = item.phases.find((p) => p.key === "abandoned");
    const bullets = trim(level, abandoned.map((f) => f.claim));
    return {
      answer:
        level === "primary"
          ? `${item.short_name} stayed behind because nobody could bring it home. ${item.abandonment_reason.split(". ")[0]}.`
          : item.abandonment_reason,
      bullets: [
        ...bullets,
        ...(phase && level === "high" ? [phase.body] : []),
      ],
      citations: srcIds(abandoned),
    };
  }

  if (/cool|coolest|best|favourite|favorite|amazing|wow/i.test(q)) {
    const order = ["discovery", "legacy", "mission", "spec"] as const;
    const picked: Fact[] = [];
    for (const kind of order) {
      for (const fact of item.facts) {
        if (fact.kind === kind && picked.length < (level === "primary" ? 2 : 3)) picked.push(fact);
      }
      if (picked.length >= (level === "primary" ? 2 : 3)) break;
    }
    return {
      answer:
        level === "primary"
          ? `Here is the coolest thing about ${item.short_name}:`
          : `The most surprising records attached to ${item.short_name}:`,
      bullets: picked.map((f) => f.claim),
      citations: srcIds(picked),
    };
  }

  if (/quiz|test me|three questions|3 questions|questions/i.test(q)) {
    const pool = item.facts.filter((f) => f.kind !== "spec").concat(item.facts.filter((f) => f.kind === "spec"));
    const picked = pool.slice(0, 3);
    return {
      answer: "Three questions straight from the record. Answers are underneath — no peeking.",
      bullets: [],
      citations: srcIds(picked),
      quiz: picked.map((fact, i) => ({
        question: `${i + 1}. What is ${item.short_name}'s ${fact.label.toLowerCase()}?`,
        answer: `${fact.value} — ${fact.claim}`,
      })),
    };
  }

  const matched = scoreFacts(item, question).slice(0, level === "primary" ? 2 : 3);

  if (matched.length === 0) {
    return {
      answer: `I only know what is stored in ${item.short_name}'s mission record. Try asking why it was left behind, what its coolest fact is, or ask me to quiz you.`,
      bullets: item.facts.slice(0, 2).map((f) => f.claim),
      citations: srcIds(item.facts.slice(0, 2)),
    };
  }

  const touchedPhases = Array.from(
    new Set(matched.map((f) => f.phase_key).filter(Boolean))
  ) as string[];
  const phaseText =
    level === "high" && touchedPhases.length
      ? item.phases.find((p) => p.key === touchedPhases[0])?.body
      : undefined;

  return {
    answer:
      level === "primary"
        ? `From the ${item.short_name} record:`
        : `Here is what the saved record says about ${item.short_name}:`,
    bullets: [...matched.map((f) => f.claim), ...(phaseText ? [phaseText] : [])],
    citations: srcIds(matched),
  };
}

export const PROMPT_CHIPS = [
  "Why was it left behind?",
  "Coolest fact",
  "Quiz me with 3 questions",
];
