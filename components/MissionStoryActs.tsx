"use client";

import { displayText } from "@/lib/displayText";
import type { Fact, GpSummary, Item, LineageEdge, Phase, Source } from "@/lib/types";

export type ActId = 1 | 2 | 3;

export interface MissionAct {
  id: ActId;
  title: string;
  lines: Array<{ text: string; sourceId?: string }>;
}

function uniqueLines(lines: MissionAct["lines"]) {
  const seen = new Set<string>();
  return lines.filter((line) => {
    const text = line.text.trim();
    if (!text || seen.has(text)) return false;
    seen.add(text);
    return true;
  });
}

function phaseLines(phases: Phase[]) {
  return phases.map((phase) => ({ text: displayText(phase.body), sourceId: phase.source_id }));
}

function factLines(facts: Fact[]) {
  return facts.map((fact) => ({ text: displayText(fact.claim), sourceId: fact.source_id }));
}

function matchingFacts(item: Item, pattern: RegExp) {
  return item.facts.filter((fact) => pattern.test(`${fact.label} ${fact.value} ${fact.claim}`));
}

function launchMassLine(item: Item): MissionAct["lines"][number] | null {
  const fact = item.facts.find((entry) => /launch mass|mass at launch/i.test(`${entry.label} ${entry.claim}`));
  const mass = item.specs["Launch mass"] ?? fact?.value;
  if (!mass) return null;
  const kilograms = Number(mass.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0]);
  const comparison = Number.isFinite(kilograms)
    ? ` That is about ${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(kilograms)} one-kilogram bags in mass.`
    : "";
  return { text: displayText(`At launch it weighed ${mass}.${comparison}`), sourceId: fact?.source_id };
}

function statusNarrative(item: Item) {
  const statusText: Record<Item["status"], string> = {
    active: "Its latest mission status is active.",
    inactive: "Its final mission signal is marked inactive.",
    derelict: "This hardware was left behind after its mission.",
    destroyed: "The last mission record marks the object as destroyed.",
  };
  return statusText[item.status];
}

function epochLabel(epoch: string) {
  const date = new Date(epoch);
  if (Number.isNaN(date.getTime())) return epoch;
  return `${date.toLocaleString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  })} UTC`;
}

export function buildMissionActs(item: Item, edges: LineageEdge[], gp: GpSummary | null): MissionAct[] {
  const missionPhases = item.phases.filter((phase) => phase.key === "built" || phase.key === "launched");
  const purposeFacts = matchingFacts(item, /designed|purpose|built to|goal|question|mission objective|searched for/i)
    .filter((fact) => fact.kind === "mission");
  const launchFacts = matchingFacts(item, /rocket|booster|launch vehicle|launch site|lifted off|launched|launch pad|cape canaveral|kennedy space center|vandenberg|baikonur/i);
  const powerFacts = matchingFacts(item, /power|solar|battery|rtg|radioisotope/i);
  const instrumentFacts = matchingFacts(item, /instrument|camera|spectrometer|drill|sensor|antenna|retroreflector|laser/i);
  const carrierEdges = edges.filter((edge) => /launch|rocket|booster|vehicle|carrier|stage/i.test(`${edge.kind} ${edge.label} ${edge.via ?? ""} ${edge.parent_name}`));
  const massLine = launchMassLine(item);
  const missionLines = uniqueLines([
    ...factLines(purposeFacts.slice(0, 2)),
    ...phaseLines(missionPhases),
    { text: `It is ${/^[aeiou]/i.test(item.type) ? "an" : "a"} ${item.type}.` },
    ...(massLine ? [massLine] : []),
    ...(item.specs["Power source"] ? [{ text: displayText(`Its power came from ${item.specs["Power source"]}.`) }] : []),
    ...factLines(powerFacts.slice(0, 2)),
    ...factLines(instrumentFacts.slice(0, 2)),
    ...factLines(launchFacts.slice(0, 3)),
    ...carrierEdges.slice(0, 3).map((edge) => ({
      text: displayText(`The lineage connects ${edge.parent_name} to ${edge.child_name}${edge.label ? ` through ${edge.label.replace(/_/g, " ")}` : ""}.`),
    })),
  ]);
  if (!missionLines.some((line) => /rocket|booster|launch site|launched|lifted off/i.test(line.text))) {
    missionLines.push({ text: "No launch vehicle or launch site is named in the available mission record." });
  }

  const workedPhases = item.phases.filter((phase) => phase.key === "worked");
  const discoveries = item.facts.filter((fact) => fact.kind === "discovery" || fact.kind === "legacy");
  const environmentFacts = matchingFacts(item, /dust|storm|temperature|radiation|vacuum|pressure|wind|heat|cold|terrain|surface/i);
  const abandonedPhase = item.phases.find((phase) => phase.key === "abandoned");
  const unknownLines = uniqueLines([
    ...phaseLines(workedPhases.slice(0, 2)),
    ...factLines(discoveries.slice(0, 4)),
    ...factLines(environmentFacts.slice(0, 2)),
    ...(abandonedPhase ? phaseLines([abandonedPhase]) : []),
    ...(item.abandonment_reason ? [{ text: displayText(item.abandonment_reason) }] : []),
  ]);
  if (!unknownLines.length) {
    unknownLines.push({ text: "The available mission record has no operations or discovery detail for this chapter." });
  }

  const stillTherePhase = item.phases.find((phase) => phase.key === "still-there");
  const positionFacts = matchingFacts(item, /where|location|coordinates|distance|heliocentric|altitude|orbit/i);
  const functionFacts = matchingFacts(item, /transmit|signal|communication|still operating|continues to|power|orbit/i);
  const location = displayText(`${item.location.label}${item.location.lat !== undefined && item.location.lon !== undefined ? ` at ${item.location.lat}°, ${item.location.lon}°` : ""}`);
  const presenceLines = uniqueLines([
    ...(stillTherePhase ? phaseLines([stillTherePhase]) : []),
    { text: `The last recorded location is ${location}.` },
    ...factLines(positionFacts.slice(0, 3)),
    ...(gp?.position ? [{ text: `The latest orbital elements show ${gp.position.altitudeKm.toFixed(0)} km altitude and ${gp.position.velocityKmS.toFixed(2)} km/s velocity, measured at epoch ${epochLabel(gp.epoch)} (${gp.age}).` }] : []),
    { text: statusNarrative(item) },
    ...factLines(functionFacts.slice(0, 2)),
    ...(!functionFacts.length ? [{ text: "The available record does not confirm a current transmission or operating function." }] : []),
  ]);

  return [
    { id: 1, title: "THE MISSION & THE MACHINE", lines: missionLines },
    { id: 2, title: "INTO THE UNKNOWN", lines: unknownLines },
    { id: 3, title: "SILENT, NOT GONE", lines: presenceLines },
  ];
}

const actRoman: Record<ActId, string> = { 1: "I", 2: "II", 3: "III" };

export default function MissionStoryActs({
  item,
  sources,
  edges,
  gp,
  activeAct,
  onActSelect,
}: {
  item: Item;
  sources: Source[];
  edges: LineageEdge[];
  gp: GpSummary | null;
  activeAct: ActId;
  onActSelect: (act: MissionAct) => void;
}) {
  const acts = buildMissionActs(item, edges, gp);
  const sourceById = new Map(sources.map((source) => [source.id, source]));

  return (
    <section className="mission-story-acts" aria-label={`Mission story for ${item.short_name}`}>
      <header className="mission-story-heading">
        <div>
          <div className="eyebrow">MISSION STORY / THREE ACTS</div>
          <h2>{displayText(item.short_name)}: a mission in three acts</h2>
        </div>
        <p>Explore the mission record through its design, discoveries, and lasting presence.</p>
      </header>
      <div className="mission-story-flow">
        {acts.map((act) => (
          <article
            key={act.id}
            className={`mission-story-act mission-story-act-${act.id}${activeAct === act.id ? " is-active" : ""}`}
            data-act={act.id}
            tabIndex={0}
            role="button"
            aria-pressed={activeAct === act.id}
            onClick={() => onActSelect(act)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onActSelect(act);
              }
            }}
          >
            <div className="mission-story-act-label">ACT {actRoman[act.id]}</div>
            <h3>{act.title}</h3>
            <div className="mission-story-paragraphs">
              {act.lines.map((line, index) => {
                const source = line.sourceId ? sourceById.get(line.sourceId) : undefined;
                return (
                  <p key={`${act.id}-${index}`}>
                    {displayText(line.text)}
                    {source ? (
                      <> <a href={source.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{displayText(source.publisher)} source ↗</a></>
                    ) : null}
                  </p>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
