"use client";

import Link from "next/link";
import { ArrowUpRight, Crosshair, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import type { Item, Zone, ZoneSummary } from "@/lib/types";

function mapPoint(item: Item, index: number, count: number, zone: Zone) {
  if (zone === "earth-orbit") {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(count, 1);
    const radius = 60 + (index % 3) * 58;
    return { x: 500 + Math.cos(angle) * radius * 2.6, y: 260 + Math.sin(angle) * radius * 1.2 };
  }
  if (zone === "deep-space") {
    const angle = index % 2 === 0 ? -0.54 - Math.floor(index / 2) * 0.18 : Math.PI + 0.54 + Math.floor(index / 2) * 0.18;
    const radius = 150 + Math.floor(index / 2) * 62;
    return { x: 500 + Math.cos(angle) * radius * 1.8, y: 260 + Math.sin(angle) * radius * 0.95 };
  }
  const rawLon = item.location.lon ?? ((index * 79 + 18) % 360) - 180;
  const lon = rawLon > 180 ? rawLon - 360 : rawLon;
  const lat = item.location.lat ?? ((index * 37) % 130) - 65;
  return {
    x: 100 + ((lon + 180) / 360) * 800,
    y: 82 + ((90 - lat) / 180) * 355,
  };
}

function Marker({
  item,
  index,
  point,
  active,
  onSelect,
}: {
  item: Item;
  index: number;
  point: { x: number; y: number };
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <g
      className={`sector-pin ${active ? "is-active" : ""} ${item.status === "active" ? "is-active-signal" : "is-artifact"} ${item.status === "inactive" ? "is-went-silent" : ""}`}
      data-status={item.status}
      transform={`translate(${point.x} ${point.y})`}
      role="button"
      tabIndex={0}
      aria-label={`Select ${item.short_name}`}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
    >
      <title>{item.short_name} · {item.location.label}</title>
      <circle className="pin-wave" r="16" />
      <circle className="pin-core" r="8" />
      <text className="pin-index" x="0" y="3">{String(index + 1).padStart(2, "0")}</text>
    </g>
  );
}

export default function SectorMap({
  zone,
  items,
  zones,
  onZoneSelect,
}: {
  zone: Zone;
  items: Item[];
  zones: ZoneSummary[];
  onZoneSelect: (zone: Zone) => void;
}) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const points = useMemo(() => items.map((item, index) => mapPoint(item, index, items.length, zone)), [items, zone]);
  const selectedIndex = items.findIndex((item) => item.id === selectedId);
  const selected = items[selectedIndex] ?? items[0];
  const mapTitle = zone === "moon" ? "LUNAR SURFACE COORDINATES" : zone === "mars" ? "MARS / TOPOGRAPHIC SURVEY" : zone === "earth-orbit" ? "EARTH / ORBITAL REGIMES" : "HELIOCENTRIC ESCAPE VECTORS";

  return (
    <section className={`sector-map-shell zone-${zone} targeting-frame`} aria-label={`${zone} sector map`}>
      <div className="sector-map-topline">
        <div><span className="hud-live-dot" /> LIVE ARCHIVE PLOT <span className="sector-map-separator">/</span> {mapTitle}</div>
        <span className="sector-map-coordinate">{String(items.length).padStart(2, "0")} TRACKED OBJECTS</span>
      </div>
      <div className="sector-map-layout">
        <div className="sector-map-canvas">
            <svg viewBox="0 0 1000 520" role="group" aria-label={`${mapTitle} with selectable artifact locations`}>
            <defs>
              <radialGradient id="map-vignette"><stop offset="0%" stopColor="var(--map-center)" /><stop offset="100%" stopColor="var(--map-ground)" /></radialGradient>
              <pattern id="map-grid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M 42 0 L 0 0 0 42" fill="none" stroke="var(--map-grid)" strokeWidth="1" /></pattern>
              <filter id="pin-glow" x="-200%" y="-200%" width="400%" height="400%"><feGaussianBlur stdDeviation="4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>
            <rect width="1000" height="520" fill="url(#map-vignette)" />
            <rect width="1000" height="520" fill="url(#map-grid)" opacity=".56" />
            {zone === "moon" || zone === "mars" ? (
              <g className="surface-contours" fill="none">
                {Array.from({ length: 17 }, (_, i) => <ellipse key={i} cx={((i * 127) % 1000)} cy={((i * 83) % 520)} rx={74 + (i % 4) * 26} ry={28 + (i % 5) * 13} transform={`rotate(${i * 19} ${((i * 127) % 1000)} ${((i * 83) % 520)})`} />)}
                {Array.from({ length: 8 }, (_, i) => <circle key={`crater-${i}`} cx={110 + i * 121} cy={118 + (i % 3) * 125} r={22 + (i % 4) * 11} className="surface-crater" />)}
              </g>
            ) : null}
            {zone === "earth-orbit" ? (
              <g className="orbit-rings" fill="none">
                {[78, 126, 179, 228].map((radius) => <ellipse key={radius} cx="500" cy="260" rx={radius * 1.55} ry={radius * .68} transform="rotate(-18 500 260)" />)}
                <circle cx="500" cy="260" r="30" className="orbit-earth" />
              </g>
            ) : null}
            {zone === "deep-space" ? (
              <g className="escape-lines" fill="none">
                <circle cx="500" cy="260" r="20" className="escape-sun" />
                {[-.5, .5, -1.15, 1.15].map((slope) => <path key={slope} d={`M 500 260 Q ${500 + slope * 100} 205 ${500 + slope * 410} ${260 - slope * 205}`} />)}
              </g>
            ) : null}
            <g className="sector-map-markers">
              {items.map((item, index) => (
                <Marker key={item.id} item={item} index={index} point={points[index]} active={selected?.id === item.id} onSelect={() => setSelectedId(item.id)} />
              ))}
            </g>
            <text className="map-compass" x="940" y="46">N <tspan>↑</tspan></text>
            <text className="map-scale" x="36" y="486">{zone === "earth-orbit" ? "NOT TO SCALE · ALTITUDE BANDS" : zone === "deep-space" ? "TRAJECTORY VIEW · NOT TO SCALE" : "COORDINATE GRID · SURFACE VIEW"}</text>
          </svg>
          <div className="map-reticle reticle-tl" /><div className="map-reticle reticle-tr" /><div className="map-reticle reticle-bl" /><div className="map-reticle reticle-br" />
          <div className="sector-map-scale-readout"><Crosshair size={12} /> SECTOR GRID / 01</div>
        </div>
        <aside className="sector-map-console">
          <div className="console-heading"><MapPin size={14} /> EXPLORATION ZONES</div>
          <div className="exploration-zone-list">
            {zones.map((entry) => (
              <button
                key={entry.id}
                className={`exploration-zone-option zone-${entry.id} ${entry.id === zone ? "is-active" : ""}`}
                onClick={() => onZoneSelect(entry.id)}
              >
                <span className="zone-option-signal" />
                <span>{entry.label.toUpperCase()}</span>
                <small>{String(entry.item_count).padStart(2, "0")}</small>
              </button>
            ))}
          </div>
          <div className="console-heading object-index-heading"><MapPin size={14} /> ARTIFACT PINS <span>{String(items.length).padStart(2, "0")}</span></div>
          <div className="sector-map-legend">
            {items.map((item, index) => (
              <button key={item.id} className={`sector-map-legend-item ${selected?.id === item.id ? "is-active" : ""}`} onClick={() => setSelectedId(item.id)}>
                <span className="legend-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="legend-copy"><b>{item.short_name}</b><small>{item.location.label}</small></span>
              </button>
            ))}
          </div>
          {selected ? (
            <div className="sector-map-selected">
              <span className="selected-kicker">SELECTED OBJECT</span>
              <strong>{selected.short_name}</strong>
              <span>{selected.years_active}</span>
              <Link href={`/item/${selected.id}`}>OPEN MISSION DOSSIER <ArrowUpRight size={13} /></Link>
            </div>
          ) : <div className="sector-map-empty">No artifacts are mapped in this hall yet.</div>}
        </aside>
      </div>
    </section>
  );
}
