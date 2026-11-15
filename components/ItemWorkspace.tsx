"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ArrowLeftRight, Expand, RotateCcw, X } from "lucide-react";
import AIPane from "./AIPane";
import LabPane from "./LabPane";
import MissionStoryActs, { buildMissionActs, type ActId, type MissionAct } from "./MissionStoryActs";
import MissionVideoAudioGuide from "./MissionVideoAudioGuide";
import MissionConnectionRail from "./MissionConnectionRail";
import { useCompare } from "./CompareProvider";
import { displayText } from "@/lib/displayText";
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
  const [activeAct, setActiveAct] = useState<ActId>(1);
  const [peerId, setPeerId] = useState(() => {
    const sameZone = peers.find((peer) => peer.zone === item.zone);
    return sameZone?.id ?? peers[0]?.id ?? "";
  });

  const { add, has } = useCompare();
  const queued = has(item.id);
  const peer = peers.find((candidate) => candidate.id === peerId) ?? peers[0];
  const compareHref = peer ? `/compare?a=${item.id}&b=${peer.id}` : "/compare";
  const acts = useMemo(() => buildMissionActs(item, edges, gp), [edges, gp, item]);
  const handleActSelect = useCallback((act: MissionAct) => setActiveAct(act.id), []);

  return (
    <div className="workspace-shell">
      <div style={{ paddingTop: 22 }}>
        <Link href={`/archive?zone=${item.zone}`} className="back-link">
          ← Back to {ZONES[item.zone].label}
        </Link>
      </div>

      <header className="item-head">
        <div>
          <div className="eyebrow mission-eyebrow">
            MISSION PROFILE <span>/</span> EXHIBIT {displayText(item.id.toUpperCase())}
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            <span className={`chip status-${item.status}`}>
              {item.status === "inactive" ? "Went Silent" : item.status === "derelict" ? "Inactive" : item.status === "destroyed" ? "Destroyed" : "Active"}
            </span>
            <span className="chip">{item.type}</span>
            <span className="chip">{item.zone.replace("-", " ")}</span>
            {item.catalog ? <span className="chip">{item.catalog}</span> : null}
          </div>
          <h1 className="detail-title"><span>MISSION PROFILE:</span> <em>{displayText(item.name)}</em></h1>
          <div className="mission-readouts">
            <div><span>MISSION WINDOW</span><b>{displayText(item.years_active)}</b></div>
            <div><span>LAST KNOWN LOCATION</span><b>{displayText(item.location.label)}</b></div>
            <div><span>LAUNCH MASS</span><b>{displayText(item.specs["Launch mass"] ?? "Not listed")}</b></div>
          </div>
        </div>
      </header>

      <MissionStoryActs
        item={item}
        sources={sources}
        edges={edges}
        gp={gp}
        activeAct={activeAct}
        onActSelect={handleActSelect}
      />

      {narration ? (
        <section className="card" aria-label="AI narration">
          <div className="card-pad">
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              AI GENERATED · {narration.model ?? narration.prompt_version}
            </div>
            <p style={{ marginBottom: 10 }}>{displayText(narration.text)}</p>
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

      <div className="peer-bar">
        <label className="field-label" htmlFor="peer-select" style={{ margin: 0 }}>
          Compare with
        </label>
        <select
          id="peer-select"
          className="select peer-select"
          value={peer?.id ?? ""}
          onChange={(event) => setPeerId(event.target.value)}
        >
          {peers.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {displayText(candidate.short_name)} | {displayText(ZONES[candidate.zone].label)}
            </option>
          ))}
        </select>
        <Link href={compareHref} className="btn btn-sm">Open comparison →</Link>
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
        <button className="toolbar-btn" onClick={() => setSwapped((value) => !value)} disabled={mode !== "split"} title="Swap panes">
          <ArrowLeftRight size={14} /> Swap Sides
        </button>
        {mode === "split" ? (
          <>
            <button className="toolbar-btn" onClick={() => setMode("ai")}><Expand size={14} /> Maximize AI</button>
            <button className="toolbar-btn" onClick={() => setMode("lab")}><Expand size={14} /> Maximize Lab</button>
            <button className="toolbar-btn" onClick={() => setMode("lab")}><X size={14} /> Close AI</button>
            <button className="toolbar-btn" onClick={() => setMode("ai")}><X size={14} /> Close Lab</button>
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
          <MissionVideoAudioGuide item={item} acts={acts} onActChange={setActiveAct} />
        </section>
        <section className="pane pane-lab" aria-label="3D story and science lab">
          <LabPane item={item} sources={sources} gp={gp} />
        </section>
      </div>

      <MissionConnectionRail item={item} sources={sources} edges={edges} gp={gp} />

      {mode === "lab" ? (
        <button className="floating-pane-btn" onClick={() => setMode("split")}>Open Mission AI</button>
      ) : null}
      {mode === "ai" ? (
        <button className="floating-pane-btn" onClick={() => setMode("split")}>Open Story Lab</button>
      ) : null}
    </div>
  );
}
