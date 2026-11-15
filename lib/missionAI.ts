import type { Fact, Item, Source } from "./types";

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

function uniqueCitations(sources: Source[], ids: (string | undefined)[]): AICitation[] {
  const seen = new Set<string>();
  const out: AICitation[] = [];
  for (const id of ids) {
    if (!id || seen.has(id)) continue;
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

type ActIntent = "design" | "discovery" | "status" | "general";

function routeIntent(question: string): ActIntent {
  const q = question.toLowerCase();
  if (/rocket|booster|launch|launched|built|design|designed|purpose|mass|weight|power|battery|solar|instrument|camera|sensor|why.{0,24}(built|made|designed)/i.test(q)) {
    return "design";
  }
  if (/discover|discovery|achiev|record|surviv|survive|worked|science|found|find|environment|dust|storm|radiation|temperature/i.test(q)) {
    return "discovery";
  }
  if (/went silent|silent|abandon|left behind|where|location|still|persist|transmi|signal|today|current|orbit|altitude|distance|why.{0,24}(left|silent|abandon)/i.test(q)) {
    return "status";
  }
  return "general";
}

function factsForIntent(item: Item, question: string, intent: ActIntent): Fact[] {
  const pattern: RegExp | null = intent === "design"
    ? /design|built|purpose|mission|launch|rocket|mass|weight|power|battery|solar|instrument|camera|sensor|antenna|site/i
    : intent === "discovery"
      ? /discover|found|record|distance|dust|storm|temperature|radiation|worked|science|survive|water|achievement/i
      : intent === "status"
        ? /silent|abandon|left|location|where|orbit|altitude|distance|signal|transmit|status|today|persist|operat/i
        : null;
  const relevant = pattern
    ? item.facts.filter((fact) => pattern.test(`${fact.label} ${fact.value} ${fact.claim}`))
    : [];
  const scored = scoreFacts(item, question);
  const ordered = [...relevant, ...scored];
  const seen = new Set<string>();
  return ordered.filter((fact) => {
    if (seen.has(fact.id)) return false;
    seen.add(fact.id);
    return true;
  });
}

function phaseBodies(item: Item, keys: string[]) {
  return [...item.phases]
    .sort((a, b) => a.order - b.order)
    .filter((phase) => keys.includes(phase.key));
}

function citeRecords(sources: Source[], facts: Fact[], phaseSourceIds: (string | undefined)[] = []) {
  return uniqueCitations(sources, [...facts.map((fact) => fact.source_id), ...phaseSourceIds]);
}

function uniqueLines(lines: string[]) {
  const seen = new Set<string>();
  return lines.map((line) => line.trim()).filter((line) => {
    if (!line || seen.has(line)) return false;
    seen.add(line);
    return true;
  });
}

/**
 * Deterministic, fully grounded responder: no model, no invention.
 * Every sentence is copied from the item's own facts/phases and every
 * answer carries the NASA source ids behind it.
 */
export function answerQuestion(
  item: Item,
  sources: Source[],
  question: string
): AIAnswer {
  const q = question.toLowerCase();
  if (/quiz|test me|three questions|3 questions|questions/i.test(q)) {
    const pool = item.facts.filter((fact) => fact.kind !== "spec").concat(item.facts.filter((fact) => fact.kind === "spec"));
    const picked = pool.slice(0, 3);
    return {
      answer: "Three questions straight from this mission record. Open each answer after you have a guess.",
      bullets: [],
      citations: citeRecords(sources, picked),
      quiz: picked.map((fact, index) => ({
        question: `${index + 1}. What does the ${fact.label.toLowerCase()} record say about ${item.short_name}?`,
        answer: `${fact.value} — ${fact.claim}`,
      })),
    };
  }

  const intent = routeIntent(question);
  if (/cool|coolest|best|favourite|favorite|amazing|wow/i.test(q) && intent === "general") {
    const kindOrder: Record<Fact["kind"], number> = { discovery: 0, legacy: 1, mission: 2, spec: 3 };
    const picked = item.facts
      .slice()
      .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind])
      .slice(0, 3);
    return {
      answer: `Here are some standout records attached to ${item.short_name}:`,
      bullets: picked.map((f) => f.claim),
      citations: citeRecords(sources, picked),
    };
  }

  if (intent === "design") {
    const facts = factsForIntent(item, question, intent).slice(0, 4);
    const phases = phaseBodies(item, ["built", "launched"]);
    const specs = Object.entries(item.specs)
      .filter(([label]) => /mass|power|launch|instrument|type/i.test(label))
      .map(([label, value]) => `${label}: ${value}.`);
    const bullets = uniqueLines([...phases.map((phase) => phase.body), ...specs, ...facts.map((fact) => fact.claim)]).slice(0, 5);
    return {
      answer: `Act I · The mission and the machine. Here are the design, size, power, and launch details recorded for ${item.short_name}.`,
      bullets: bullets.length ? bullets : ["The saved record has no matching design or launch detail for this question."],
      citations: citeRecords(sources, facts, phases.map((phase) => phase.source_id)),
    };
  }

  if (intent === "discovery") {
    const facts = factsForIntent(item, question, intent).slice(0, 4);
    const phases = phaseBodies(item, ["worked"]);
    const bullets = uniqueLines([...phases.map((phase) => phase.body), ...facts.map((fact) => fact.claim)]).slice(0, 5);
    return {
      answer: `Act II · Into the unknown. These are the operations, discoveries, and records saved for ${item.short_name}.`,
      bullets: bullets.length ? bullets : ["The saved record has no matching discovery or operations detail for this question."],
      citations: citeRecords(sources, facts, phases.map((phase) => phase.source_id)),
    };
  }

  if (intent === "status") {
    const facts = factsForIntent(item, question, intent).slice(0, 4);
    const phases = phaseBodies(item, ["abandoned", "still-there"]);
    const asksWhySilent = /why|silent|abandon|left behind/i.test(q);
    const bullets = uniqueLines([
      ...phases.map((phase) => phase.body),
      `Last recorded location: ${item.location.label}.`,
      `Archive status: ${item.status.replace("-", " ")}.`,
      ...(asksWhySilent && item.abandonment_reason ? [item.abandonment_reason] : []),
      ...facts.map((fact) => fact.claim),
    ]).slice(0, 5);
    return {
      answer: `Act III · Silent, not gone. Here is the latest location and status stored for ${item.short_name}.`,
      bullets,
      citations: citeRecords(sources, facts, phases.map((phase) => phase.source_id)),
    };
  }

  const matched = scoreFacts(item, question).slice(0, 3);

  if (matched.length === 0) {
    return {
      answer: `I can only use the saved facts and mission phases for ${item.short_name}. Try asking about its design and launch, discoveries, present location, or status.`,
      bullets: [],
      citations: [],
    };
  }

  return {
    answer: `Here is what the saved record says about ${item.short_name}:`,
    bullets: matched.map((fact) => fact.claim),
    citations: citeRecords(sources, matched),
  };
}

export const PROMPT_CHIPS = [
  "Why was it left behind?",
  "Coolest fact",
  "Quiz me with 3 questions",
];
