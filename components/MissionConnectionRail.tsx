import { ArrowRight, Link2, MapPin } from "lucide-react";
import { displayText } from "@/lib/displayText";
import type { GpSummary, Item, LineageEdge, Source } from "@/lib/types";

export default function MissionConnectionRail({
  item,
  sources,
  edges,
  gp,
}: {
  item: Item;
  sources: Source[];
  edges: LineageEdge[];
  gp: GpSummary | null;
}) {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return (
    <section className="mission-connection-rail" aria-label="Mission connections and NASA photographs">
      <header className="mission-connection-header">
        <div className="eyebrow"><Link2 size={13} /> MISSION CONNECTIONS / ARCHIVE PHOTOGRAPHS</div>
        <p>Trace the rocket that launched this machine, related missions, and the real NASA photographs from its journey.</p>
      </header>

      <div className="mission-connection-details">
        <div className="connection-location">
          <span className="connection-label"><MapPin size={13} /> LAST RECORDED LOCATION</span>
          <strong>{displayText(item.location.label)}</strong>
          {item.location.lat !== undefined && item.location.lon !== undefined ? (
            <span className="connection-coordinate">{item.location.lat.toFixed(4)}°, {item.location.lon.toFixed(4)}°</span>
          ) : null}
          {gp?.position ? (
            <span className="connection-coordinate">{gp.position.altitudeKm.toFixed(0)} km altitude · {gp.age}</span>
          ) : null}
        </div>
        <div className="connection-lineage">
          <span className="connection-label"><Link2 size={13} /> RELATED HARDWARE &amp; MISSIONS</span>
          {edges.length ? (
            <div className="connection-edge-list">
              {edges.map((edge) => (
                <div key={`${edge.parent_slug}:${edge.child_slug}:${edge.label}`} className="connection-edge">
                  <b>{displayText(edge.parent_name)}</b><ArrowRight size={13} /><b>{displayText(edge.child_name)}</b>
                  <small>{displayText(edge.label.replace(/_/g, " "))}{edge.via ? ` · ${displayText(edge.via)}` : ""}</small>
                </div>
              ))}
            </div>
          ) : (
            <p className="connection-empty">No linked carrier or related spacecraft is recorded for this artifact yet.</p>
          )}
        </div>
      </div>

      <div className="mission-photo-rail">
        {item.images.map((image) => {
          const source = sourceById.get(image.source_id);
          return (
            <figure key={image.src}>
              <img src={image.src} alt={displayText(image.caption)} loading="lazy" />
              <figcaption>
                <span>{displayText(image.caption)}</span>
                {source ? <a href={source.url} target="_blank" rel="noreferrer">{displayText(source.publisher)} ↗</a> : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
