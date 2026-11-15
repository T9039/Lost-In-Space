"use client";

import { useMemo, useState } from "react";
import ModelViewer from "./ModelViewer";
import DustCanvas from "./widgets/DustCanvas";
import LaserRange from "./widgets/LaserRange";
import SignalRange from "./widgets/SignalRange";
import { displayText } from "@/lib/displayText";
import type { GpSummary, Item, Source } from "@/lib/types";
import { Activity, Orbit, Radio, Rocket, Wrench } from "lucide-react";

const PHASE_ICONS = [Wrench, Rocket, Activity, Radio, Orbit];

function phaseYearLabel(item: Item, phase: Item["phases"][number]) {
  if (phase.key === "still-there") return "PRESENT";
  const relatedFacts = item.facts.filter((fact) => fact.phase_key === phase.key);
  const dates = [phase.body, phase.stat_value, ...relatedFacts.flatMap((fact) => [fact.value, fact.claim])]
    .join(" ")
    .match(/\b(?:19|20)\d{2}\b/g) ?? [];
  const uniqueYears = Array.from(new Set(dates));
  if (uniqueYears.length > 1) return `${uniqueYears[0]} to ${uniqueYears[uniqueYears.length - 1]}`;
  if (uniqueYears.length === 1) return uniqueYears[0];
  if (phase.key === "built") return "BEFORE LAUNCH";
  if (phase.stat_value && !/unknown|undated|not specified/i.test(phase.stat_value)) return displayText(`${phase.stat_value} · ${phase.stat_label}`);
  return `${displayText(phase.title)} phase`;
}

export default function LabPane({ item, sources, gp }: { item: Item; sources: Source[]; gp: GpSummary | null }) {
  const phases = useMemo(() => [...item.phases].sort((a, b) => a.order - b.order), [item]);
  const [activeIndex, setActiveIndex] = useState(2);
  const phase = phases[Math.min(activeIndex, phases.length - 1)];

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const poster = item.model_url ? item.model_url.replace(/\.glb$/i, ".png") : undefined;
  const fallbackImage = item.images[0]?.src;

  const showDust = item.zone === "mars";
  const showLaser = item.zone === "moon";
  const showSignal = item.zone === "earth-orbit" || item.zone === "deep-space";
  const lunarMissionName = item.name.match(/Apollo\s+\d+/i)?.[0];
  const dustImage = item.images.find((image) => /solar|panel|array/i.test(image.caption))?.src ?? item.images[0]?.src;

  return (
    <div className="lab-pane">
      <div className="pane-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>
            3D Story &amp; Science Lab
          </div>
          <h3>{displayText(item.name)}</h3>
        </div>
        <span className={`chip status-${item.status}`}>
          {item.status === "active" ? "Active" : "Artifact"}
        </span>
      </div>

      <div className="lab-top">
        <div className="model-stage">
          <ModelViewer
          src={item.model_url}
          poster={poster}
          fallback={fallbackImage}
            alt={`3D model of ${displayText(item.name)}`}
          credit={item.model_credit}
          />
          <div className="model-stage-label"><span>INTERACTIVE 3D RELIC</span><span>DRAG TO ROTATE · SCROLL TO ZOOM</span></div>
        </div>

        <div className="chapter-detail">
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Chapter {phase ? phases.indexOf(phase) + 1 : 1} of {phases.length}
          </div>
          <h3>{phase ? displayText(phase.title) : "Mission phase"}</h3>
          <p>{phase ? displayText(phase.body) : "Mission details are not available in this record."}</p>
          <div className="chapter-stat">
            <span className="chapter-stat-value">{phase ? displayText(phase.stat_value) : ""}</span>
            <span className="chapter-stat-label">{phase ? displayText(phase.stat_label) : ""}</span>
          </div>
        </div>
      </div>

      <div className="chapter-track-heading">
        <span>{phases.length ? `ODYSSEY IN ${phases.length} CHAPTERS` : "MISSION ODYSSEY"}</span>
        <label className="chapter-scrubber">
          <span>SCRUB TIMELINE</span>
          <input
            type="range"
            min={0}
            max={Math.max(phases.length - 1, 0)}
            value={Math.min(activeIndex, Math.max(phases.length - 1, 0))}
            onChange={(event) => setActiveIndex(Number(event.target.value))}
            aria-label="Scrub mission timeline"
          />
        </label>
      </div>
      <nav className="chapter-bar" aria-label="Mission odyssey">
        {phases.map((p, i) => {
          return (
            <button
              key={p.id}
              className={`chapter-btn ${i === activeIndex ? "is-active" : ""}`}
              onClick={() => setActiveIndex(i)}
              aria-current={i === activeIndex ? "step" : undefined}
            >
              <span className="chapter-name">{String(i + 1)}. {p.key === "abandoned" ? "WENT SILENT" : p.key === "still-there" ? "STILL THERE" : displayText(p.title.toUpperCase())}</span>
              <small className="chapter-year">{phaseYearLabel(item, p)}</small>
            </button>
          );
        })}
      </nav>
      <div className="chapter-progress-track" aria-hidden="true">
        <span style={{ width: `${phases.length ? ((activeIndex + 1) / phases.length) * 100 : 0}%` }} />
      </div>
      <div className="chapter-icon-rail" aria-label="Chapter markers">
        {phases.map((p, i) => {
          const Icon = PHASE_ICONS[i] ?? Activity;
          return (
            <button key={p.id} className={i === activeIndex ? "is-active" : ""} onClick={() => setActiveIndex(i)} aria-label={`Show chapter ${i + 1}: ${p.title}`}>
              <Icon size={14} strokeWidth={1.6} />
            </button>
          );
        })}
      </div>

      <div className="lab-grid">
        <div className="lab-block">
          <div className="lab-block-title">Facts → Sources</div>
          <div className="lab-facts">
            {item.facts.map((fact) => {
              const src = sourceById.get(fact.source_id);
              return (
                <div key={fact.id} className="fact">
                  <div>
                    <div className="fact-label">{displayText(fact.label)}</div>
                    <p className="fact-claim">{displayText(fact.claim)}</p>
                    {src ? (
                      <a className="source-link" href={src.url} target="_blank" rel="noreferrer">
                        {displayText(src.publisher)} ↗
                      </a>
                    ) : null}
                  </div>
                  <div className="fact-value">{displayText(fact.value)}</div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {(showDust || showLaser || showSignal) && (
        <div className="lab-widgets">
          {showDust ? <DustCanvas image={dustImage} /> : null}
          {showLaser ? <LaserRange missionName={lunarMissionName} /> : null}
          {showSignal ? <SignalRange item={item} gp={gp} sources={sources} /> : null}
        </div>
      )}
    </div>
  );
}
