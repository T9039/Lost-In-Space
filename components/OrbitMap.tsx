"use client";

import { useEffect, useRef, useState } from "react";
import type { GpSummary, Item } from "@/lib/types";

interface Row {
  item: Item;
  gp: GpSummary | null;
}

export default function OrbitMap({ items }: { items: Item[] }) {
  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<unknown>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    Promise.all(
      items.map(async (item) => {
        try {
          const response = await fetch(`/api/artifacts/${encodeURIComponent(item.id)}/gp`);
          if (!response.ok) return { item, gp: null } satisfies Row;
          const gp = (await response.json()) as GpSummary;
          return { item, gp } satisfies Row;
        } catch {
          return { item, gp: null } satisfies Row;
        }
      })
    ).then((next) => {
      if (alive) setRows(next);
    });
    return () => {
      alive = false;
    };
  }, [items]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled || !container.current) return;
        const map = new maplibregl.Map({
          container: container.current,
          style: "https://demotiles.maplibre.org/style.json",
          center: [0, 10],
          zoom: 1.3,
          attributionControl: {},
        });
        map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
        mapRef.current = map;
      } catch {
        if (!cancelled) setMapError("The live map style could not be loaded.");
      }
    })();
    return () => {
      cancelled = true;
      const map = mapRef.current as { remove?: () => void } | null;
      map?.remove?.();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = mapRef.current as
        | { isStyleLoaded: () => boolean; on: (event: string, cb: () => void) => void }
        | null;
      if (!map) return;
      try {
        const maplibregl = await import("maplibre-gl");
        if (cancelled) return;
        const add = () => {
          for (const row of rows) {
            const position = row.gp?.position;
            if (!position) continue;
            const element = document.createElement("div");
            element.className = "orbit-marker";
            element.textContent = row.item.short_name;
            element.title = `${row.item.short_name}: ${position.latitude.toFixed(2)}°, ${position.longitude.toFixed(2)}°`;
            new maplibregl.Marker({ element })
              .setLngLat([position.longitude, position.latitude])
              .addTo(map as never);
          }
        };
        if (map.isStyleLoaded()) add();
        else map.on("load", add);
      } catch {
        /* the list below is the reliable fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [rows]);

  return (
    <section className="orbit-map" aria-label="Live orbital positions">
      <div className="orbit-map-heading">
        <div>
          <div className="eyebrow">LIVE ORBITAL POSITIONS</div>
          <h2>Earth orbit right now</h2>
        </div>
        <span className="muted">{rows.filter((row) => row.gp).length} live element sets</span>
      </div>
      <div className="orbit-map-grid">
        <div className="orbit-map-canvas" ref={container} data-testid="orbit-map-canvas">
          {mapError ? <p className="muted">{mapError}</p> : null}
        </div>
        <div className="orbit-map-list">
          {rows.length === 0 ? <p className="muted">Loading orbital records…</p> : null}
          {rows.map((row) => (
            <div key={row.item.id} className="orbit-row">
              <div>
                <div className="card-title">{row.item.short_name}</div>
                <div className="card-meta">{row.item.location.label}</div>
              </div>
              {row.gp?.position ? (
                <div className="orbit-readout">
                  <b>
                    {row.gp.position.latitude.toFixed(2)}°, {row.gp.position.longitude.toFixed(2)}°
                  </b>
                  <span>
                    {row.gp.position.altitudeKm.toFixed(0)} km · {row.gp.age}
                  </span>
                </div>
              ) : (
                <span className="chip">NO LIVE ELEMENT SET</span>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
