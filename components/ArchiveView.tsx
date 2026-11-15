"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ItemCard from "./ItemCard";
import SectorMap from "./SectorMap";
import { getItems, getZones } from "@/lib/api";
import { ZONES, type Item, type Zone, type ZoneSummary } from "@/lib/types";
import { hallTelemetry, zoneMeta } from "@/lib/zones";
import { GalleryVerticalEnd, MapPinned } from "lucide-react";

const ZONE_IDS = Object.keys(ZONES) as Zone[];

export default function ArchiveView() {
  const params = useSearchParams();
  const router = useRouter();
  const zoneParam = params.get("zone");
  const activeZone =
    zoneParam && (ZONE_IDS as string[]).includes(zoneParam) ? (zoneParam as Zone) : null;

  const [items, setItems] = useState<Item[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [zones, setZones] = useState<ZoneSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"map" | "gallery" | "data">(
    params.get("view") === "map" ? "map" : params.get("view") === "data" ? "data" : "gallery"
  );

  useEffect(() => {
    setView(params.get("view") === "map" ? "map" : params.get("view") === "data" ? "data" : "gallery");
  }, [params]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([getItems(activeZone ?? undefined), getItems(), getZones()]).then(
      ([list, all, zoneList]) => {
        if (!alive) return;
        setItems(list);
        setAllItems(all);
        setZones(zoneList);
        setLoading(false);
      }
    );
    return () => {
      alive = false;
    };
  }, [activeZone]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) =>
      `${i.name} ${i.short_name} ${i.type} ${i.location.label}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  const selectZone = (zone: Zone | null) => {
    const next = new URLSearchParams();
    if (zone) next.set("zone", zone);
    if (view !== "gallery" && zone) next.set("view", view);
    router.replace(next.size ? `/archive?${next}` : "/archive", { scroll: false });
  };

  const selectView = (nextView: "map" | "gallery" | "data") => {
    setView(nextView);
    const next = new URLSearchParams();
    if (activeZone) next.set("zone", activeZone);
    if (nextView !== "gallery") next.set("view", nextView);
    router.replace(next.size ? `/archive?${next}` : "/archive", { scroll: false });
  };

  const meta = activeZone ? zoneMeta(activeZone) : null;
  const telemetry = activeZone ? hallTelemetry(activeZone, allItems.filter((i) => i.zone === activeZone)) : [];

  return (
    <div className="stack archive-explorer">
      <header className="archive-title-block">
        <div className="eyebrow">LOST IN SPACE // SECTOR REPOSITORY</div>
        <h1>SECTOR EXPLORER:<br /><span>RELICS ON {meta?.label.toUpperCase() ?? "ALL SECTORS"}</span></h1>
        <p>Explore the historic telemetry and persistent outposts of human exploration across the solar system.</p>
      </header>

      <div className="tabs zone-select-tabs">
        <button
          className={`tab ${activeZone === null ? "is-active" : ""}`}
          onClick={() => selectZone(null)}
        >
          All halls
        </button>
        {zones.map((z) => (
          <button
            key={z.id}
            className={`tab ${activeZone === z.id ? "is-active" : ""}`}
            onClick={() => selectZone(z.id as Zone)}
          >
            {z.label}
            <span className="sector-count">{z.item_count}</span>
          </button>
        ))}
      </div>

      {meta ? (
        <section className={`hall-banner zone-${activeZone}`}>
          <div className="hall-banner-main">
            <div className="eyebrow">{meta.hall}</div>
            <h2>{meta.label} Exhibition Hall</h2>
            <p>{meta.tagline}</p>
          </div>
          <div className={`hall-schematic hall-schematic-${activeZone}`} aria-hidden="true">
            <div className="schematic-kicker">{activeZone === "moon" ? "LANDING SITE GRID" : activeZone === "mars" ? "ELEVATION / RELIEF" : activeZone === "earth-orbit" ? "ORBITAL ALTITUDE" : "HELIOCENTRIC TRACK"}</div>
            <div className="schematic-rings"><i /><i /><i /><b /></div>
            <span className="schematic-tag tag-a">{activeZone === "moon" ? "TRANQUILLITY" : activeZone === "mars" ? "MERIDIANI" : activeZone === "earth-orbit" ? "LEO" : "1 AU"}</span>
            <span className="schematic-tag tag-b">{activeZone === "moon" ? "TAURUS-LITTROW" : activeZone === "mars" ? "GALE CRATER" : activeZone === "earth-orbit" ? "GEO" : "ESCAPE VECTOR"}</span>
          </div>
          <div className="hall-telemetry">
            {telemetry.map((t) => (
              <div key={t.label} className="telemetry">
                <span className="telemetry-value">{t.value}</span>
                <span className="telemetry-label">{t.label}</span>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="hall-banner hall-banner-all">
          <div className="hall-banner-main">
            <div className="eyebrow">All Exhibition Sectors</div>
            <h2>Lost in Space: The Cosmic Relic Archive</h2>
            <p>Filter by sector, search by object telemetry, or inspect any space probe and rover in 3D.</p>
          </div>
          <div className="hall-telemetry">
            <div className="telemetry">
              <span className="telemetry-value">{allItems.length}</span>
              <span className="telemetry-label">Relics</span>
            </div>
            <div className="telemetry">
              <span className="telemetry-value">{ZONE_IDS.length}</span>
              <span className="telemetry-label">Halls</span>
            </div>
            <div className="telemetry">
              <span className="telemetry-value">
                {allItems.reduce((n, i) => n + i.facts.length, 0)}
              </span>
              <span className="telemetry-label">NASA facts</span>
            </div>
          </div>
        </section>
      )}

      {activeZone ? (
        <div className="archive-toolbar">
          <div className="archive-view-switch" role="group" aria-label="Archive view">
            <button className={view === "map" ? "is-active" : ""} onClick={() => selectView("map")} aria-pressed={view === "map"}>
              <MapPinned size={15} /> [ SURFACE MAP ]
            </button>
            <button className={view === "gallery" ? "is-active" : ""} onClick={() => selectView("gallery")} aria-pressed={view === "gallery"}>
              <GalleryVerticalEnd size={15} /> [ ARTIFACT LIST ]
            </button>
            <button className={view === "data" ? "is-active" : ""} onClick={() => selectView("data")} aria-pressed={view === "data"}>
              [ EXPLORER DATA ]
            </button>
          </div>
          <span className="archive-view-caption">{meta?.hall.toUpperCase()} <span>/</span> {view.toUpperCase()}</span>
        </div>
      ) : null}

      <div className="row" style={{ justifyContent: "space-between" }}>
        <input
          className="input"
          style={{ maxWidth: 340 }}
          placeholder="Search machines, locations, types…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="muted" style={{ fontSize: 13 }}>
          {loading ? "Loading…" : `${filtered.length} of ${items.length} shown`}
        </span>
      </div>

      {!loading && filtered.length === 0 ? (
        <div className="empty-state">
          No machines match that search.{" "}
          <button className="tab" onClick={() => setQuery("")} style={{ marginLeft: 8 }}>
            Clear
          </button>
        </div>
      ) : (
        <>
          {activeZone && view === "map" ? <SectorMap key={activeZone} zone={activeZone} items={filtered} zones={zones} onZoneSelect={selectZone} /> : null}
          {activeZone && view === "data" ? (
            <section className="explorer-data-panel">
              <div className="explorer-data-heading"><div className="eyebrow">EXPLORER DATA</div><h2>{meta?.label} / Mission Telemetry</h2></div>
              <div className="explorer-data-grid">
                {telemetry.map((t) => <div key={t.label} className="explorer-data-cell"><span>{t.label.toUpperCase()}</span><b>{t.value}</b></div>)}
                <div className="explorer-data-cell"><span>CATALOGUE RECORDS</span><b>{filtered.length} ARTIFACTS</b></div>
                <div className="explorer-data-cell"><span>FACTS WITH PROVENANCE</span><b>{filtered.reduce((count, item) => count + item.facts.length, 0)} SOURCED</b></div>
                <div className="explorer-data-cell"><span>MISSION CHAPTERS</span><b>{filtered.reduce((count, item) => count + item.phases.length, 0)} PHASES</b></div>
              </div>
            </section>
          ) : null}
          {activeZone && view === "map" ? <div className="archive-gallery-heading"><div><span className="eyebrow">THE COLLECTION</span><h2>Artifacts in this sector</h2></div><span>{filtered.length} OBJECTS</span></div> : null}
          {view !== "data" ? (
            <div className={`grid grid-3 archive-gallery ${activeZone && view === "map" ? "is-map-gallery" : ""}`}>
              {filtered.map((item) => <ItemCard key={item.id} item={item} />)}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
