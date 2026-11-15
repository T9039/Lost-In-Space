"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getItems } from "@/lib/api";
import { displayText } from "@/lib/displayText";
import type { Item } from "@/lib/types";
import { useCompare } from "./CompareProvider";

export default function CompareTray() {
  const { ids, remove, clear, ready } = useCompare();
  const pathname = usePathname();
  const [items, setItems] = useState<Item[]>([]);

  useEffect(() => {
    let alive = true;
    getItems().then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!ready || ids.length === 0) return null;
  if (pathname === "/compare") return null;

  const queued = ids
    .map((id) => items.find((i) => i.id === id))
    .filter((i): i is Item => Boolean(i));

  const canCompare = queued.length === 2;
  const compareHref = canCompare ? `/compare?a=${queued[0].id}&b=${queued[1].id}` : "/archive";

  return (
    <aside className="compare-tray" aria-label="Compare tray">
      <div className="compare-tray-head">
        <span className="compare-tray-title">Compare tray</span>
        <span className="compare-tray-count">{queued.length}/2</span>
        <button className="compare-tray-clear" onClick={clear}>
          Clear
        </button>
      </div>

      <div className="compare-tray-items">
        {queued.map((item) => (
          <div key={item.id} className="compare-tray-item">
            {item.images[0] ? <img src={item.images[0].src} alt="" /> : <div className="thumb-empty" />}
            <div className="compare-tray-meta">
               <strong>{displayText(item.short_name)}</strong>
               <span>{displayText(item.years_active)}</span>
            </div>
            <button
              className="compare-tray-remove"
              onClick={() => remove(item.id)}
               aria-label={`Remove ${displayText(item.short_name)}`}
            >
              ✕
            </button>
          </div>
        ))}
        {queued.length < 2 ? (
          <div className="compare-tray-empty">
            Add {2 - queued.length} more relic{queued.length === 1 ? "" : "s"} from any hall.
          </div>
        ) : null}
      </div>

      {canCompare ? (
        <Link href={compareHref} className="btn btn-primary btn-sm compare-tray-cta">
          Compare Now →
        </Link>
      ) : (
        <span className="compare-tray-cta is-disabled">Compare Now</span>
      )}
    </aside>
  );
}
