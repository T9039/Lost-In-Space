"use client";

import dynamic from "next/dynamic";
import type { Item, ZoneSummary } from "@/lib/types";

const RelicSolarMap = dynamic(() => import("./RelicSolarMap"), {
  ssr: false,
  loading: () => (
    <div className="map-canvas map-loading">
      <span>Loading the 3D relic map…</span>
    </div>
  ),
});

export default function RelicSolarMapLoader({
  items,
  zones,
}: {
  items: Item[];
  zones: ZoneSummary[];
}) {
  return <RelicSolarMap items={items} zones={zones} />;
}
