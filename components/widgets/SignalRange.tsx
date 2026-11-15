"use client";

import { useEffect, useMemo, useState } from "react";
import { Radio, Satellite } from "lucide-react";
import { displayText } from "@/lib/displayText";
import type { GpSummary, Item, Source } from "@/lib/types";

const SPEED_OF_LIGHT_KM_S = 299_792.458;
const ASTRONOMICAL_UNIT_KM = 149_597_870.7;

interface DistanceReading {
  km: number;
  label: string;
  sourceId?: string;
}

function parseDistanceKm(item: Item, gp: GpSummary | null): DistanceReading | null {
  if (item.zone === "earth-orbit" && gp?.position) {
    return { km: gp.position.altitudeKm, label: "latest orbital element altitude" };
  }

  const candidates = [
    ...Object.entries(item.specs).map(([label, value]) => ({ label, value, sourceId: undefined as string | undefined })),
    ...item.facts.map((fact) => ({ label: fact.label, value: `${fact.value} ${fact.claim}`, sourceId: fact.source_id })),
  ];
  for (const candidate of candidates) {
    if (!/distance|altitude|heliocentric|orbit|from earth|from sun/i.test(candidate.label)) continue;
    const match = candidate.value.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(au|astronomical units?|km|kilometers?|mi|miles?)\b/i);
    if (!match) continue;
    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();
    const km = unit === "au" || unit.startsWith("astronomical")
      ? amount * ASTRONOMICAL_UNIT_KM
      : unit === "mi" || unit.startsWith("mile")
        ? amount * 1.609344
        : amount;
    if (Number.isFinite(km) && km > 0) return { km, label: candidate.label, sourceId: candidate.sourceId };
  }
  return null;
}

function formatDuration(seconds: number) {
  if (seconds < 1) return `${Math.round(seconds * 1000)} ms`;
  if (seconds < 60) return `${seconds.toFixed(2)} s`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} min`;
  if (seconds < 86_400) return `${(seconds / 3600).toFixed(2)} hr`;
  return `${(seconds / 86_400).toFixed(1)} days`;
}

export default function SignalRange({ item, gp, sources }: { item: Item; gp: GpSummary | null; sources: Source[] }) {
  const stored = useMemo(() => parseDistanceKm(item, gp), [item, gp]);
  const isOrbit = item.zone === "earth-orbit";
  const minKm = isOrbit ? 100 : ASTRONOMICAL_UNIT_KM / 10;
  const maxKm = isOrbit ? 60_000 : ASTRONOMICAL_UNIT_KM * 200;
  const initialKm = Math.min(maxKm, Math.max(minKm, stored?.km ?? (isOrbit ? 2_000 : ASTRONOMICAL_UNIT_KM)));
  const initialSlider = (Math.log(initialKm / minKm) / Math.log(maxKm / minKm)) * 100;
  const [slider, setSlider] = useState(initialSlider);
  const [pulseRun, setPulseRun] = useState(0);
  const source = stored?.sourceId ? sources.find((entry) => entry.id === stored.sourceId) : undefined;

  useEffect(() => setSlider(initialSlider), [item.id, initialSlider]);

  const distanceKm = minKm * Math.pow(maxKm / minKm, slider / 100);
  const oneWaySeconds = distanceKm / SPEED_OF_LIGHT_KM_S;
  const roundTripSeconds = oneWaySeconds * 2;
  const distanceLabel = isOrbit
    ? `${Math.round(distanceKm).toLocaleString("en-US")} km`
    : `${(distanceKm / ASTRONOMICAL_UNIT_KM).toFixed(2)} AU · ${Math.round(distanceKm).toLocaleString("en-US")} km`;

  return (
    <section className={`widget signal-range-widget zone-${item.zone}`} aria-label="Signal and orbit distance simulator">
      <div className="widget-head">
        <div>
          <div className="widget-title"><Radio size={15} /> {isOrbit ? "ORBITAL SIGNAL PATH" : "DEEP SPACE SIGNAL PATH"}</div>
          <div className="widget-sub">{displayText(item.short_name)} · {displayText(item.location.label)}</div>
        </div>
        <span className="chip">SIMULATOR</span>
      </div>

      <div className="experiment-story-box">
        <span>WHAT IS THIS EXPERIMENT?</span>
        <p>
          {isOrbit
            ? "Change the separation to see how long a radio signal would take between Earth and an orbital spacecraft. A stored element set is shown when available; otherwise the slider is an illustrative simulation."
            : "At interplanetary distances, even light takes time to travel. Adjust the range to compare one way and round trip signal delay; this is a physics simulator, not a live spacecraft transmission."}
        </p>
      </div>

      <div className="signal-readouts">
        <div className="signal-distance-readout"><Satellite size={16} /><span>{stored ? `RECORDED ${displayText(stored.label.toUpperCase())}` : "ILLUSTRATIVE DISTANCE"}</span><strong>{distanceLabel}</strong></div>
        <div><span>ONE WAY LIGHT TIME</span><strong>{formatDuration(oneWaySeconds)}</strong></div>
        <div><span>ROUND TRIP</span><strong>{formatDuration(roundTripSeconds)}</strong></div>
      </div>
      {source ? <a className="signal-source" href={source.url} target="_blank" rel="noreferrer">Distance record: {displayText(source.publisher)} ↗</a> : null}

      <div className={`signal-beam-stage ${pulseRun ? "is-transmitting" : ""}`}>
        <span className="signal-earth-node">EARTH</span>
        <span className="signal-beam-line"><i key={pulseRun} className="signal-beam-pulse" /></span>
        <span className="signal-target-node">{isOrbit ? "ORBIT" : "PROBE"}</span>
      </div>

      <div className="signal-controls">
        <label htmlFor={`signal-range-${item.id}`}>SIMULATED SEPARATION</label>
        <input
          id={`signal-range-${item.id}`}
          type="range"
          min={0}
          max={100}
          value={slider}
          onChange={(event) => setSlider(Number(event.target.value))}
          className="range"
        />
        <button type="button" className="btn btn-blue btn-sm" onClick={() => setPulseRun((run) => run + 1)}>SEND TEST PULSE</button>
      </div>
    </section>
  );
}
