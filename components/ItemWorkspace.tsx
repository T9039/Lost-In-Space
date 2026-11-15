"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeftRight, Expand, RotateCcw, X } from "lucide-react";
import AIPane from "./AIPane";
import LabPane from "./LabPane";
import { useCompare } from "./CompareProvider";
import type { GpSummary, Item, LineageEdge, NarrationSummary, Source } from "@/lib/types";
import { ZONES } from "@/lib/types";

type Mode = "split" | "ai" | "lab";

export default function ItemWorkspace({
  item,
  sources,
  peers,
  edges,
  gp,
  narration,
}: {
  item: Item;
  sources: Source[];
  peers: Item[];
  edges: LineageEdge[];
  gp: GpSummary | null;
  narration: NarrationSummary | null;
}) {
  const [mode, setMode] = useState<Mode>("split");
  const [swapped, setSwapped] = useState(false);
  const [peerId, setPeerId] = useState(() => {
    const sameZone = peers.find((p) => p.zone === item.zone);
    return sameZone?.id ?? peers[0]?.id ?? "";
  });

  const { add, has } = useCompare();
  const queued = has(item.id);
  const peer = peers.find((p) => p.id === peerId) ?? peers[0];
  const compareHref = peer ? `/compare?a=${item.id}&b=${peer.id}` : "/compare";
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  const phaseSources = Array.from(
    new Set(item.phases.map((phase) => phase.source_id).filter((id): id is string => Boolean(id)))
  )
    .map((id) => sourceById.get(id))
    .filter((source): source is Source => Boolean(source));

  return (
    <div className="workspace-shell">
      <div style={{ paddingTop: 22 }}>
        <Link href={`/archive?zone=${item.zone}`} className="back-link">
          ← Back to {ZONES[item.zone].label}
        </Link>
      </div>

      <header className="item-head">
        <div>
          <div className="eyebrow mission-eyebrow">MISSION PROFILE <span>/</span> EXHIBIT {item.id.toUpperCase()}</div>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className={`chip status-${item.status}`}>
              {item.status === "inactive" ? "Went Silent" : item.status === "derelict" ? "Inactive" : item.status === "destroyed" ? "Destroyed" : "Active"}
            </span>
            <span className="chip">{item.type}</span>
            <span className="chip">{item.zone.replace("-", " ")}</span>
            {item.catalog ? <span className="chip">{item.catalog}</span> : null}
          </div>
          <h1 className="detail-title"><span>MISSION PROFILE:</span> <em>{item.name}</em></h1>
          <div className="mission-readouts">
            <div><span>MISSION WINDOW</span><b>{item.years_active}</b></div>
            <div><span>LAST KNOWN LOCATION</span><b>{item.location.label}</b></div>
            <div><span>LAUNCH MASS</span><b>{item.specs["Launch mass"] ?? "—"}</b></div>
          </div>
        </div>
      </header>

      {item.abandonment_reason ? (
        <section className="card" aria-label="Why it was left">
          <div className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 6 }}>Why it was left</div>
            <p style={{ margin: 0 }}>{item.abandonment_reason}</p>
          </div>
        </section>
      ) : null}

      {narration ? (
        <section className="card" aria-label="AI narration">
          <div className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              AI GENERATED · {narration.model ?? narration.prompt_version}
            </div>
            <p style={{ marginBottom: 10 }}>{narration.text}</p>
            <div className="row">
              <span className="chip">AI generated</span>
              <span className="chip">{narration.facts_used.length} facts used</span>
              <a className="chip" href={`/api/items/${item.id}/lineage`}>
                facts used ↗
              </a>
            </div>
          </div>
        </section>
      ) : null}

      <section className="card" aria-label="Lineage">
        <div className="card-pad">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Lineage</div>
          {edges.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {edges.map((edge) => (
                <li key={`${edge.parent_slug}:${edge.child_slug}:${edge.label}`}>
                  {edge.parent_name} → <strong>{edge.child_name}</strong>{" "}
                  <span className="muted">({edge.label})</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              No curated parent/child edges yet. Facts and phases still carry their own
              provenance.
            </p>
          )}
        </div>
      </section>

      <section className="card" aria-label="Position">
        <div className="card-pad">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Position</div>
          <p style={{ marginBottom: 4 }}><strong>{item.location.label}</strong></p>
          {item.location.lat !== undefined && item.location.lon !== undefined ? (
            <p className="muted" style={{ marginBottom: 8 }}>
              {item.location.lat.toFixed(4)}°, {item.location.lon.toFixed(4)}°
            </p>
          ) : null}
          {item.zone === "earth-orbit" && gp?.position ? (
            <>
              <p className="muted" style={{ marginBottom: 4 }}>
                {gp.position.latitude.toFixed(2)}°, {gp.position.longitude.toFixed(2)}° ·{" "}
                {gp.position.altitudeKm.toFixed(0)} km · {gp.position.velocityKmS.toFixed(2)} km/s
              </p>
              <p className="muted" style={{ marginBottom: 8 }}>
                Element epoch {gp.epoch.slice(0, 16).replace("T", " ")} UTC · {gp.age}
              </p>
            </>
          ) : null}
          <span className="chip">
            {item.zone === "earth-orbit"
              ? gp
                ? "LIVE ELEMENT SET"
                : "ORBITAL — LIVE ELEMENTS PENDING"
              : "LAST KNOWN POSITION"}
          </span>
        </div>
      </section>

      <section className="card" aria-label="Provenance">
        <div className="card-pad">
          <div className="eyebrow" style={{ marginBottom: 6 }}>Provenance</div>
          <p className="muted" style={{ marginBottom: 10 }}>
            Phases and media carry their own source ids, separate from the facts.
          </p>
          {phaseSources.length ? (
            <div className="row" style={{ marginBottom: 10 }}>
              <span className="muted" style={{ fontSize: 13 }}>Phase records:</span>
              {phaseSources.map((source) => (
                <a key={source.id} className="chip" href={source.url} target="_blank" rel="noreferrer">
                  {source.publisher} ↗
                </a>
              ))}
            </div>
          ) : null}
          {item.images.length ? (
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              {item.images.map((image) => {
                const source = sourceById.get(image.source_id);
                return (
                  <li key={image.src}>
                    {image.caption}
                    {source ? (
                      <>
                        {" "}
                        <a href={source.url} target="_blank" rel="noreferrer">
                          {source.publisher} ↗
                        </a>
                      </>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="muted" style={{ margin: 0 }}>No media rows for this artifact.</p>
          )}
        </div>
      </section>

      <div className="peer-bar">
        <label className="field-label" htmlFor="peer-select" style={{ margin: 0 }}>
          Compare with
        </label>
        <select
          id="peer-select"
          className="select peer-select"
          value={peer?.id ?? ""}
          onChange={(e) => setPeerId(e.target.value)}
        >
          {peers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.short_name} — {ZONES[p.zone].label}
            </option>
          ))}
        </select>
        <Link href={compareHref} className="btn btn-sm">
          Open comparison →
        </Link>
        <button
          type="button"
          className={`btn btn-sm ${queued ? "is-queued" : ""}`}
          onClick={() => add(item.id)}
          disabled={queued}
        >
          {queued ? "In compare tray ✓" : "Add to Compare Tray"}
        </button>
        <span className="peer-hint">or press ⇄ to swap panes</span>
      </div>

      <div className="workspace-toolbar">
        <button
          className="toolbar-btn"
          onClick={() => setSwapped((s) => !s)}
          disabled={mode !== "split"}
          title="Swap panes"
        >
          <ArrowLeftRight size={14} /> Swap Sides
        </button>
        {mode === "split" ? (
          <>
            <button className="toolbar-btn" onClick={() => setMode("ai")}>
              <Expand size={14} /> Maximize AI
            </button>
            <button className="toolbar-btn" onClick={() => setMode("lab")}>
              <Expand size={14} /> Maximize Lab
            </button>
            <button className="toolbar-btn" onClick={() => setMode("lab")}>
              <X size={14} /> Close AI
            </button>
            <button className="toolbar-btn" onClick={() => setMode("ai")}>
              <X size={14} /> Close Lab
            </button>
          </>
        ) : (
          <button className="toolbar-btn is-primary" onClick={() => setMode("split")}>
            <RotateCcw size={14} /> Restore Split View
          </button>
        )}
      </div>

      <div className={`workspace mode-${mode} ${swapped ? "is-swapped" : ""}`}>
        <section className="pane pane-ai" aria-label="Mission AI">
          <AIPane item={item} sources={sources} />
        </section>
        <section className="pane pane-lab" aria-label="3D story and science lab">
          <LabPane item={item} sources={sources} />
        </section>
      </div>

      {mode === "lab" ? (
        <button className="floating-pane-btn" onClick={() => setMode("split")}>
          Open Mission AI
        </button>
      ) : null}

      {mode === "ai" ? (
        <button className="floating-pane-btn" onClick={() => setMode("split")}>
          Open Story Lab
        </button>
      ) : null}
    </div>
  );
}
