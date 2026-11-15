"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ItemCard from "./ItemCard";
import { ZONES, type Item, type Zone, type ZoneSummary } from "@/lib/types";
import { zoneMeta } from "@/lib/zones";

const ZONE_IDS = Object.keys(ZONES) as Zone[];

export default function ArchiveView({
  initialItems,
  initialZones,
  initialQuery,
  dataSource,
}: {
  initialItems: Item[];
  initialZones: ZoneSummary[];
  initialQuery: string;
  dataSource: "database" | "fixtures";
}) {
  const params = useSearchParams();
  const router = useRouter();
  const zoneParam = params.get("zone");
  const activeZone = zoneParam && (ZONE_IDS as string[]).includes(zoneParam)
    ? (zoneParam as Zone)
    : null;
  const [query, setQuery] = useState(initialQuery);

  const filtered = useMemo(() => {
    const zoneItems = activeZone
      ? initialItems.filter((item) => item.zone === activeZone)
      : initialItems;
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return zoneItems;
    return zoneItems.filter((item) =>
      `${item.name} ${item.short_name} ${item.type} ${item.location.label}`
        .toLowerCase()
        .includes(normalizedQuery)
    );
  }, [activeZone, initialItems, query]);

  useEffect(() => {
    const currentQuery = params.get("q") ?? "";
    if (query.trim() === currentQuery.trim()) return;

    const timeout = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query.trim()) next.set("q", query.trim());
      else next.delete("q");
      router.replace(next.size ? `/archive?${next}` : "/archive", { scroll: false });
    }, 300);

    return () => clearTimeout(timeout);
  }, [params, query, router]);

  const selectZone = (zone: Zone | null) => {
    const next = new URLSearchParams();
    if (zone) next.set("zone", zone);
    if (query.trim()) next.set("q", query.trim());
    router.replace(next.size ? `/archive?${next}` : "/archive", { scroll: false });
  };

  const meta = activeZone ? zoneMeta(activeZone) : null;
  const zoneItems = activeZone
    ? initialItems.filter((item) => item.zone === activeZone)
    : initialItems;

  return (
    <div className="stack archive-explorer">
      <header className="archive-title-block">
        <div className="eyebrow">
          MISSION ARCHIVE <span>/</span> EXHIBIT GALLERY
          <span className="chip" style={{ marginLeft: 12 }}>
            {dataSource === "database" ? "DATABASE" : "OFFLINE FIXTURES"}
          </span>
        </div>
        <h1>
          ZONE EXPLORER:
          <br />
          <span>ABANDONED ARTIFACTS ON {meta?.label.toUpperCase() ?? "ALL ZONES"}</span>
        </h1>
        <p>Explore the historic traces of robotic exploration across the solar system.</p>
      </header>

      {meta ? (
        <section className={`hall-banner zone-${activeZone}`}>
          <div className="hall-banner-main">
            <div className="eyebrow">{meta.hall}</div>
            <h2>{meta.label} Exhibition Hall</h2>
            <p>{meta.tagline}</p>
          </div>
          <div className={`hall-schematic hall-schematic-${activeZone}`} aria-hidden="true">
            <div className="schematic-kicker">
              {activeZone === "moon"
                ? "LANDING SITE GRID"
                : activeZone === "mars"
                  ? "ELEVATION / RELIEF"
                  : activeZone === "earth-orbit"
                    ? "ORBITAL ALTITUDE"
                    : "HELIOCENTRIC TRACK"}
            </div>
            <div className="schematic-rings"><i /><i /><i /><b /></div>
            <span className="schematic-tag tag-a">
              {activeZone === "moon" ? "TRANQUILLITY" : activeZone === "mars" ? "MERIDIANI" : activeZone === "earth-orbit" ? "LEO" : "1 AU"}
            </span>
            <span className="schematic-tag tag-b">
              {activeZone === "moon" ? "TAURUS-LITTROW" : activeZone === "mars" ? "GALE CRATER" : activeZone === "earth-orbit" ? "GEO" : "ESCAPE VECTOR"}
            </span>
          </div>
        </section>
      ) : (
        <section className="hall-banner hall-banner-all">
          <div className="hall-banner-main">
            <div className="eyebrow">All exhibition halls</div>
            <h2>Every abandoned relic in the museum</h2>
            <p>Filter by hall, search by name, then inspect any machine in 3D.</p>
          </div>
          <div className="hall-telemetry">
            <div className="telemetry">
              <span className="telemetry-value">{initialItems.length}</span>
              <span className="telemetry-label">Relics</span>
            </div>
            <div className="telemetry">
              <span className="telemetry-value">{ZONE_IDS.length}</span>
              <span className="telemetry-label">Halls</span>
            </div>
            <div className="telemetry">
              <span className="telemetry-value">
                {initialItems.reduce((count, item) => count + item.facts.length, 0)}
              </span>
              <span className="telemetry-label">Sourced facts</span>
            </div>
          </div>
        </section>
      )}

      <div className="tabs zone-select-tabs" aria-label="Filter archive by zone">
        <button
          className={`tab ${activeZone === null ? "is-active" : ""}`}
          onClick={() => selectZone(null)}
          aria-pressed={activeZone === null}
        >
          All halls
        </button>
        {initialZones.map((zone) => (
          <button
            key={zone.id}
            className={`tab ${activeZone === zone.id ? "is-active" : ""}`}
            onClick={() => selectZone(zone.id as Zone)}
            aria-pressed={activeZone === zone.id}
          >
            {zone.label}
            <span className="sector-count">{zone.item_count}</span>
          </button>
        ))}
      </div>

      <div className="row" style={{ justifyContent: "space-between" }}>
        <input
          className="input"
          style={{ maxWidth: 340 }}
          placeholder="Search machines, locations, types…"
          aria-label="Search artifacts"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <span className="muted" style={{ fontSize: 13 }}>
          {filtered.length} of {zoneItems.length} shown
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          No machines match that search.{" "}
          <button className="tab" onClick={() => setQuery("")} style={{ marginLeft: 8 }}>
            Clear
          </button>
        </div>
      ) : (
        <div className="grid grid-3 archive-gallery">
          {filtered.map((item) => <ItemCard key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
