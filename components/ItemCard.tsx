"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Item } from "@/lib/types";
import { useCompare } from "./CompareProvider";

export default function ItemCard({ item }: { item: Item }) {
  const { add, has } = useCompare();
  const queued = has(item.id);
  const img = item.images[0];
  const years = item.years_active.match(/(?:19|20)\d{2}/g) ?? [];
  const statusLabel = item.status === "inactive" ? "WENT SILENT" : item.status === "active" ? "SIGNAL ACTIVE" : "ARTIFACT";
  const endLabel = item.status === "active" ? "SIGNAL ACTIVE" : `ENDED ${years.at(-1) ?? item.years_active}`;

  return (
    <article className={`card artifact-card zone-${item.zone}`}>
      <Link href={`/item/${item.id}`} className="card-media-link">
        <div className="card-media">
          {img ? (
            <img
              src={img.src}
              alt={img.caption}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
          <span className={`artifact-status-badge status-${item.status}`}>{statusLabel}</span>
          {img ? <span className="artifact-photo-caption">{img.caption}</span> : null}
          <span className="artifact-photo-index">NASA IMAGE · {String(item.images.length).padStart(2, "0")} FRAMES</span>
        </div>
      </Link>
      <div className="card-pad">
        <Link href={`/item/${item.id}`} className="card-title">
          {item.short_name}
        </Link>
        <div className="artifact-site"><MapPin size={13} /><span>{item.location.label}</span></div>
        <div className={`artifact-ended ${item.status === "inactive" ? "is-silent" : ""}`}>{endLabel}</div>
        <div className="artifact-record-line">
          <span>{item.type.toUpperCase()}</span>
          <b>{item.years_active}</b>
          {item.catalog ? <span>{item.catalog}</span> : null}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
            <span className={`chip status-${item.status}`}>
              {item.status === "inactive" ? "Went Silent" : item.status === "derelict" ? "Inactive" : item.status === "destroyed" ? "Destroyed" : "Active"}
          </span>
          <span className="chip">{item.facts.length} facts</span>
        </div>
        <div className="artifact-actions">
          <Link href={`/item/${item.id}`} className={`artifact-view-data ${item.status === "inactive" ? "is-silent" : ""}`}>
            VIEW DATA <span>↗</span>
          </Link>
          <button
            type="button"
            className={`btn btn-sm add-compare ${queued ? "is-queued" : ""}`}
            onClick={() => add(item.id)}
            disabled={queued}
          >
            {queued ? "✓ ADDED" : "+ COMPARE"}
          </button>
        </div>
      </div>
    </article>
  );
}
