"use client";

import { useMemo, useState } from "react";
import ModelViewer from "./ModelViewer";
import DustCanvas from "./widgets/DustCanvas";
import LaserRange from "./widgets/LaserRange";
import type { Item, Source } from "@/lib/types";

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
        <ModelViewer
          src={item.model_url}
          poster={poster}
          fallback={fallbackImage}
          alt={`3D model of ${item.name}`}
          credit={item.model_credit}
        />

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

      <nav className="chapter-bar" aria-label="Odyssey in five chapters">
        {phases.map((p, i) => (
          <button
            key={p.id}
            className={`chapter-btn ${i === activeIndex ? "is-active" : ""}`}
            onClick={() => setActiveIndex(i)}
          >
            <span className="chapter-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="chapter-name">{p.title}</span>
          </button>
        ))}
      </nav>

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
          {showDust ? <DustCanvas image={item.images[0]?.src} /> : null}
          {showLaser ? <LaserRange /> : null}
        </div>
      )}
    </div>
  );
}
