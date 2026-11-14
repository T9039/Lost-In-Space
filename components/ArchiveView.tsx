"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ItemCard from "./ItemCard";
import { getItems, getZones } from "@/lib/api";
import { ZONES, type Item, type Zone, type ZoneSummary } from "@/lib/types";
import { hallTelemetry, zoneMeta } from "@/lib/zones";

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
    router.replace(zone ? `/archive?zone=${zone}` : "/archive", { scroll: false });
  };

  const meta = activeZone ? zoneMeta(activeZone) : null;
  const telemetry = activeZone ? hallTelemetry(activeZone, allItems.filter((i) => i.zone === activeZone)) : [];

  return (
    <div className="stack">
      <div className="tabs">
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
            <div className="eyebrow">All exhibition halls</div>
            <h2>Every abandoned relic in the museum</h2>
            <p>Filter by hall, search by name, then inspect any machine in 3D.</p>
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
        <div className="grid grid-3">
          {filtered.map((item) => (
            <ItemCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
