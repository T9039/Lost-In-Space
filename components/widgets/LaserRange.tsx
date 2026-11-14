"use client";

import { useEffect, useRef, useState } from "react";

const C_KM_PER_S = 299792.458;

/**
 * Lunar Laser Ranging — align the optics, fire a pulse, and derive distance
 * from round-trip time: d = (c * t) / 2.
 */
export default function LaserRange() {
  const [alignment, setAlignment] = useState(50);
  const [firing, setFiring] = useState(false);
  const [roundTrip, setRoundTrip] = useState<number | null>(null);
  const [photons, setPhotons] = useState(0);
  const timer = useRef<number | null>(null);

  const offsetDeg = (Math.abs(50 - alignment) / 50) * 8;
  const efficiency = Math.max(0, Math.cos((offsetDeg * Math.PI) / 180));
  const optimal = offsetDeg <= 0.6;

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    []
  );

  const fire = () => {
    if (firing) return;
    setFiring(true);
    setRoundTrip(null);
    setPhotons(0);

    timer.current = window.setTimeout(() => {
      const base = 2.5638;
      const jitter = (Math.random() - 0.5) * 0.0004;
      const t = base + jitter;
      setRoundTrip(t);
      setPhotons(Math.round(efficiency * 3));
      setFiring(false);
    }, 950);
  };

  const distance = roundTrip ? (C_KM_PER_S * roundTrip) / 2 : null;

  return (
    <div className="widget widget-laser">
      <div className="widget-head">
        <div>
          <div className="widget-title">Apollo 11 · Lunar Laser Ranging</div>
          <div className="widget-sub">
            Corner-cube array left by Apollo 11 · alignment {offsetDeg.toFixed(2)}°{" "}
            <span className={optimal ? "tag-ok" : "tag-warn"}>{optimal ? "OPTIMAL" : "OFF-AXIS"}</span>
          </div>
        </div>
      </div>

      <div className="laser-stage">
        <div className="laser-station">
          <span className="laser-icon">⌖</span>
          <span>Earth observatory</span>
        </div>
        <div className={`laser-beam ${firing ? "is-firing" : ""}`}>
          <span className="laser-pulse" />
        </div>
        <div className="laser-station">
          <span className="laser-icon">▣</span>
          <span>Apollo array</span>
        </div>
      </div>

      <div className="widget-row">
        <label className="field-label" htmlFor="laser-align">
          Optics alignment
        </label>
        <input
          id="laser-align"
          type="range"
          min={0}
          max={100}
          value={alignment}
          onChange={(e) => setAlignment(Number(e.target.value))}
          className="range"
        />
        <button className="btn btn-primary btn-sm" onClick={fire} disabled={firing}>
          {firing ? "Pulse in flight…" : "Fire laser pulse"}
        </button>
      </div>

      <div className="widget-stats">
        <div className="widget-stat">
          <span className="widget-stat-value">{roundTrip ? `${roundTrip.toFixed(4)} s` : "—"}</span>
          <span className="widget-stat-label">Round-trip time</span>
        </div>
        <div className="widget-stat">
          <span className="widget-stat-value">{distance ? `${distance.toFixed(1)} km` : "—"}</span>
          <span className="widget-stat-label">Distance d = c·t / 2</span>
        </div>
        <div className={`widget-status ${photons > 0 ? "is-ok" : ""}`}>
          {photons > 0
            ? `${photons} photon${photons === 1 ? "" : "s"} detected of 10^17 emitted.`
            : "Alignment ready. Emit a pulse to measure the Moon."}
        </div>
      </div>
    </div>
  );
}
