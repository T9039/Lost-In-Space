"use client";

import Link from "next/link";
import type { Item } from "@/lib/types";
import { useCompare } from "./CompareProvider";

export default function ItemCard({ item }: { item: Item }) {
  const { add, has } = useCompare();
  const queued = has(item.id);
  const img = item.images[0];

  return (
    <article className={`card artifact-card zone-${item.zone}`}>
      <Link href={`/item/${item.id}`} className="card-media-link" aria-label={item.name}>
        <div className="card-media">
          {img ? (
            <img
              src={img.src}
              alt={img.caption}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : null}
        </div>
      </Link>
      <div className="card-pad">
        <Link href={`/item/${item.id}`} className="card-title">
          {item.short_name}
        </Link>
        <div className="card-meta">
          {item.type} · {item.years_active}
        </div>
        <div className="row" style={{ marginTop: 8 }}>
            <span className={`chip status-${item.status}`}>
              {item.status === "inactive" ? "Went Silent" : item.status === "derelict" ? "Inactive" : item.status === "destroyed" ? "Destroyed" : "Active"}
          </span>
          <span className="chip">{item.facts.length} facts</span>
        </div>
        <button
          type="button"
          className={`btn btn-sm add-compare ${queued ? "is-queued" : ""}`}
          onClick={() => add(item.id)}
          disabled={queued}
        >
          {queued ? "Queued ✓" : "Add to Compare"}
        </button>
      </div>
    </article>
  );
}
