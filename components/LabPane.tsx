"use client";

import { useMemo, useState } from "react";
import ModelViewer from "./ModelViewer";
import DustCanvas from "./widgets/DustCanvas";
import LaserRange from "./widgets/LaserRange";
import type { Item, Source } from "@/lib/types";
import { Activity, Orbit, Radio, Rocket, Wrench } from "lucide-react";

const PHASE_ICONS = [Wrench, Rocket, Activity, Radio, Orbit];

function phaseYearLabel(item: Item, phase: Item["phases"][number]) {
  if (phase.key === "still-there") return "PRESENT";
  const relatedFacts = item.facts.filter((fact) => fact.phase_key === phase.key);
  const dates = [phase.body, phase.stat_value, ...relatedFacts.flatMap((fact) => [fact.value, fact.claim])]
    .join(" ")
    .match(/\b(?:19|20)\d{2}\b/g) ?? [];
  const uniqueYears = Array.from(new Set(dates));
  if (uniqueYears.length > 1) return `${uniqueYears[0]}–${uniqueYears[uniqueYears.length - 1]}`;
  if (uniqueYears.length === 1) return uniqueYears[0];
  if (phase.key === "built") return "PRE-LAUNCH";
  return "DATE NOT RECORDED";
}

export default function LabPane({ item, sources }: { item: Item; sources: Source[] }) {
  const phases = useMemo(() => [...item.phases].sort((a, b) => a.order - b.order), [item]);
  const [activeIndex, setActiveIndex] = useState(2);
  const phase = phases[Math.min(activeIndex, phases.length - 1)];

  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const poster = item.model_url ? item.model_url.replace(/\.glb$/i, ".png") : undefined;
  const fallbackImage = item.images[0]?.src;

  const phaseFact = item.facts.find((f) => f.phase_key === phase?.key) ?? item.facts[0];
  const phaseSource = phaseFact ? sourceById.get(phaseFact.source_id) : undefined;

  const showDust = item.zone === "mars" && /solar/i.test(item.specs["Power source"] ?? "");
  const showLaser = item.zone === "moon";
  const dustImage = item.images.find((image) => /solar|panel|array/i.test(image.caption))?.src ?? item.images[0]?.src;

  return (
    <div className="lab-pane">
      <div className="pane-head">
        <div>
          <div className="eyebrow" style={{ marginBottom: 2 }}>
            3D Story &amp; Science Lab
          </div>
          <h3>{item.name}</h3>
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
          alt={`3D model of ${item.name}`}
          credit={item.model_credit}
          />
          <div className="model-stage-label"><span>INTERACTIVE 3D RELIC</span><span>DRAG TO ROTATE · SCROLL TO ZOOM</span></div>
        </div>

        <div className="chapter-detail">
          <div className="eyebrow" style={{ marginBottom: 6 }}>
            Chapter {phase ? phases.indexOf(phase) + 1 : 1} of {phases.length}
          </div>
          <h3>{phase?.title}</h3>
          <p>{phase?.body}</p>
          <div className="chapter-stat">
            <span className="chapter-stat-value">{phase?.stat_value}</span>
            <span className="chapter-stat-label">{phase?.stat_label}</span>
          </div>
        </div>
      </div>

      <div className="chapter-track-heading">
        <span>ODYSSEY IN FIVE CHAPTERS</span>
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
      <nav className="chapter-bar" aria-label="Odyssey in five chapters">
        {phases.map((p, i) => {
          return (
            <button
              key={p.id}
              className={`chapter-btn ${i === activeIndex ? "is-active" : ""}`}
              onClick={() => setActiveIndex(i)}
              aria-current={i === activeIndex ? "step" : undefined}
            >
              <span className="chapter-name">{String(i + 1)}. {p.key === "abandoned" ? "WENT SILENT" : p.key === "still-there" ? "STILL THERE" : p.title.toUpperCase()}</span>
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
                    <div className="fact-label">{fact.label}</div>
                    <p className="fact-claim">{fact.claim}</p>
                    {src ? (
                      <a className="source-link" href={src.url} target="_blank" rel="noreferrer">
                        {src.publisher} ↗
                      </a>
                    ) : null}
                  </div>
                  <div className="fact-value">{fact.value}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lab-block">
          <div className="lab-block-title">Lineage strip</div>
          <div className="lineage lineage-vertical">
            <div className="lineage-node">
              <strong>{item.short_name}</strong>
              item
            </div>
            <span className="lineage-arrow">↓</span>
            <button className="lineage-node lineage-btn" onClick={() => setActiveIndex(phases.indexOf(phase))}>
              <strong>{phase?.title}</strong>
              phase
            </button>
            <span className="lineage-arrow">↓</span>
            <button
              className="lineage-node lineage-btn"
              onClick={() => {
                const idx = phases.findIndex((p) => p.key === phaseFact?.phase_key);
                if (idx >= 0) setActiveIndex(idx);
              }}
              title={phaseFact?.claim}
            >
              <strong>{phaseFact?.label}</strong>
              fact
            </button>
            <span className="lineage-arrow">↓</span>
            {phaseSource ? (
              <a
                className="lineage-node lineage-btn"
                href={phaseSource.url}
                target="_blank"
                rel="noreferrer"
              >
                <strong>{phaseSource.publisher}</strong>
                source ↗
              </a>
            ) : null}
          </div>

          <div className="lab-images">
            {item.images.slice(0, 3).map((img) => (
              <figure key={img.src}>
                <img src={img.src} alt={img.caption} />
              </figure>
            ))}
          </div>
        </div>
      </div>

      {(showDust || showLaser) && (
        <div className="lab-widgets">
          {showDust ? <DustCanvas image={dustImage} /> : null}
          {showLaser ? <LaserRange /> : null}
        </div>
      )}
    </div>
  );
}
