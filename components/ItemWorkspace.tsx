"use client";

import Link from "next/link";
import { useState } from "react";
import AIPane from "./AIPane";
import LabPane from "./LabPane";
import { useCompare } from "./CompareProvider";
import type { Item, Source } from "@/lib/types";
import { ZONES } from "@/lib/types";

type Mode = "split" | "ai" | "lab";

export default function ItemWorkspace({
  item,
  sources,
  peers,
}: {
  item: Item;
  sources: Source[];
  peers: Item[];
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

  return (
    <div className="workspace-shell">
      <div style={{ paddingTop: 22 }}>
        <Link href={`/archive?zone=${item.zone}`} className="back-link">
          ← Back to {ZONES[item.zone].label}
        </Link>
      </div>

      <header className="item-head">
        <div>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className={`chip status-${item.status}`}>
              {item.status === "inactive" ? "Went Silent" : item.status === "derelict" ? "Inactive" : item.status === "destroyed" ? "Destroyed" : "Active"}
            </span>
            <span className="chip">{item.type}</span>
            <span className="chip">{item.zone.replace("-", " ")}</span>
            {item.catalog ? <span className="chip">{item.catalog}</span> : null}
          </div>
          <h1 className="detail-title">{item.name}</h1>
          <p className="lead" style={{ marginBottom: 0 }}>
            {item.abandonment_reason}
          </p>
        </div>
      </header>

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
          ⇄ Swap Sides
        </button>
        {mode === "split" ? (
          <>
            <button className="toolbar-btn" onClick={() => setMode("ai")}>
              ⤢ Maximize AI
            </button>
            <button className="toolbar-btn" onClick={() => setMode("lab")}>
              ⤢ Maximize Lab
            </button>
            <button className="toolbar-btn" onClick={() => setMode("lab")}>
              ✕ Close AI
            </button>
            <button className="toolbar-btn" onClick={() => setMode("ai")}>
              ✕ Close Lab
            </button>
          </>
        ) : (
          <button className="toolbar-btn is-primary" onClick={() => setMode("split")}>
            ⟲ Restore Split View
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
