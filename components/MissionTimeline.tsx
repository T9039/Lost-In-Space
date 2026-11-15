"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronRight, Radio, X } from "lucide-react";
import type { Fact, Item, Zone } from "@/lib/types";

const FIRST_YEAR = 1958;
const LAST_YEAR = 2026;
const YEAR_TICKS = [1958, 1960, 1965, 1970, 1975, 1980, 1985, 1990, 1995, 2000, 2005, 2010, 2015, 2020, 2026];
const ZONE_ORDER: Zone[] = ["moon", "mars", "earth-orbit", "deep-space"];
const ZONE_LABEL: Record<Zone, string> = {
  moon: "LUNAR MISSIONS",
  mars: "MARS EXPLORATION",
  "earth-orbit": "EARTH ORBIT",
  "deep-space": "DEEP SPACE",
};

type Achievement = { fact: Fact; year: number };
type MissionRow = { item: Item; start: number; end: number; achievements: Achievement[] };

function yearFrom(value: string): number | null {
  const match = value.match(/\b(19\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function missionSpan(item: Item) {
  const years = item.years_active.match(/\b(19\d{2}|20\d{2})\b/g)?.map(Number) ?? [];
  const start = years[0] ?? FIRST_YEAR;
  const end = item.status === "active" ? LAST_YEAR : years[1] ?? start;
  return { start, end: Math.max(start, end) };
}

function factYear(fact: Fact): number | null {
  return yearFrom(`${fact.value} ${fact.claim}`);
}

function percent(year: number) {
  return Math.min(100, Math.max(0, ((year - FIRST_YEAR) / (LAST_YEAR - FIRST_YEAR)) * 100));
}

function displayYear(item: Item) {
  return item.years_active.replace(/\s*[–—-]\s*present/i, " — NOW").replace(/\s*[–—-]\s*/g, " — ");
}

function zoneTint(zone: Zone) {
  return zone === "mars" ? "#ff7a45" : zone === "moon" ? "#8ddcff" : zone === "earth-orbit" ? "#6ab8ff" : "#b693ff";
}

function SpacecraftIllustration({ item, className = "" }: { item: Item; className?: string }) {
  const id = `craft-${item.id.replace(/[^a-z0-9]/gi, "")}`;
  const tint = zoneTint(item.zone);
  const isRover = item.type === "rover";
  const isLander = item.type === "lander";
  const isOrbit = item.zone === "earth-orbit";
  const isDeep = item.zone === "deep-space";

  return (
    <svg className={`craft-art ${className}`} viewBox="0 0 440 220" role="img" aria-label={`Illustration of ${item.name}`}>
      <defs>
        <linearGradient id={`${id}-sky`} x1="0" y1="0" x2="0.9" y2="1">
          <stop stopColor={isOrbit || isDeep ? "#10172c" : "#2a3545"} />
          <stop offset="1" stopColor={isOrbit || isDeep ? "#070a13" : "#171d27"} />
        </linearGradient>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#d7e4eb" />
          <stop offset=".45" stopColor="#718393" />
          <stop offset="1" stopColor="#273744" />
        </linearGradient>
        <linearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="0">
          <stop stopColor="#b98539" />
          <stop offset=".45" stopColor="#f4c56d" />
          <stop offset="1" stopColor="#7c572d" />
        </linearGradient>
        <radialGradient id={`${id}-planet`}>
          <stop stopColor={item.zone === "mars" ? "#d37a50" : "#8296a8"} />
          <stop offset="1" stopColor={item.zone === "mars" ? "#653d39" : "#293a4b"} />
        </radialGradient>
      </defs>
      <rect width="440" height="220" rx="14" fill={`url(#${id}-sky)`} />
      <path d="M0 166 Q95 150 173 166 T330 163 T440 170 V220 H0Z" fill={isOrbit || isDeep ? "#090d17" : item.zone === "mars" ? "#33231f" : "#252c34"} />
      <path d="M0 177 Q95 164 173 179 T330 174 T440 181" fill="none" stroke={tint} strokeOpacity=".18" />
      {[{x:38,y:35},{x:104,y:62},{x:174,y:28},{x:296,y:49},{x:384,y:31},{x:346,y:91},{x:69,y:111},{x:235,y:73}].map((star, i) => (
        <circle key={i} cx={star.x} cy={star.y} r={i % 3 === 0 ? 1.4 : 1} fill="#d9e8f1" opacity={i % 2 ? ".42" : ".78"} />
      ))}
      {(isOrbit || isDeep) && <circle cx="352" cy="94" r="44" fill={`url(#${id}-planet)`} opacity=".75" />}
      {isRover ? (
        <g transform="translate(111 75)">
          <path d="M4 63 27 50h123l22 14-9 24H14Z" fill={`url(#${id}-metal)`} stroke="#d8e4e9" strokeOpacity=".72" />
          <path d="M13 52 31 29l33 5 7 18-18 8H23Z" fill={`url(#${id}-foil)`} stroke="#f1d198" strokeOpacity=".5" />
          <path d="M61 51 78 24l25 5 10 23-25 10Z" fill="#24394a" stroke={tint} strokeOpacity=".7" />
          <path d="M86 27 91 8 104 4 111 10 108 29" fill="none" stroke="#b8c9d4" strokeWidth="4" />
          <rect x="98" y="0" width="21" height="15" rx="4" fill={`url(#${id}-metal)`} />
          {[29,70,124,154].map((x) => <g key={x}><circle cx={x} cy="91" r="13" fill="#080d13" stroke="#8da1ae" strokeWidth="4"/><circle cx={x} cy="91" r="4" fill={tint} opacity=".78"/></g>)}
          <path d="M39 38 5 26 0 31l35 22M116 40l30-13 6 5-28 20" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="4" />
          <path d="m43 38 19-7 6 20-22 9zM115 38l15-8 8 20-18 7z" fill="#183753" stroke="#4c8eb7" />
        </g>
      ) : isLander ? (
        <g transform="translate(138 64)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M61 53 35 108M93 53l28 55M49 61 5 91M105 61l48 30" stroke="#b5c4cc" strokeWidth="7" />
          <path d="M32 108h14m68 0h15M0 91h16m136 0h15" stroke="#d8ba82" strokeWidth="5" />
          <path d="M39 35 65 20l32 9 11 27-22 20-42-9-15-16Z" fill={`url(#${id}-foil)`} stroke="#ffe0a0" strokeOpacity=".6" />
          <path d="m65 20 2-17 17-6 12 9-1 22" fill="none" stroke="#d7e2e8" strokeWidth="5" />
          <circle cx="87" cy="-1" r="9" fill="#9bdcff" stroke="#e8f6ff" strokeWidth="3" />
          <path d="M51 42h33M60 53h33" stroke="#654b2d" strokeWidth="3" />
        </g>
      ) : isOrbit || isDeep ? (
        <g transform="translate(130 81)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M47 38 14 20 4 27l29 24M112 39l39-20 9 8-36 26" fill="#183d5b" stroke="#69b8ef" strokeWidth="2" />
          <path d="m10 24 25 14m-18-22 25 15m99-13-24 16m40-5-26 16" stroke="#7ccaf5" strokeOpacity=".68" />
          <path d="m51 31 21-19 23 5 10 23-20 19-29-5Z" fill={`url(#${id}-metal)`} stroke="#e4edf1" />
          <circle cx="82" cy="31" r="12" fill="#122738" stroke={tint} strokeWidth="3" />
          <path d="M76 18 86 1l25-14M80 56l-4 22" fill="none" stroke="#becbd1" strokeWidth="3" />
          <path d="M110 2q20-11 37-2-13 4-25 14" fill="#f2d08a" stroke="#ffdf9b" strokeWidth="2" />
        </g>
      ) : (
        <g transform="translate(145 73)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M0 54 21 42h113l19 13-11 28H12Z" fill={`url(#${id}-metal)`} stroke="#cdd9df" strokeOpacity=".68" />
          <path d="M32 50 52 19l29 1 18 30-21 17-34-5Z" fill={`url(#${id}-foil)`} stroke="#f9d89b" strokeOpacity=".6" />
          <path d="M62 22 72 2 87-4l11 9-4 20" fill="none" stroke="#dce7ed" strokeWidth="5" />
          <circle cx="94" cy="2" r="9" fill="#a7ddf5" stroke="#eefaff" strokeWidth="3" />
          {[26,64,118,146].map((x) => <g key={x}><circle cx={x} cy="88" r="12" fill="#090d13" stroke="#8c9da8" strokeWidth="4"/><circle cx={x} cy="88" r="3" fill={tint}/></g>)}
          <path d="M42 43 10 33 5 39l34 17m67-13 31-11 6 6-30 18" fill="none" stroke="#b7c8d1" strokeWidth="4" />
        </g>
      )}
      <path d="M18 19h30M18 19v22M422 179h-30m30 0v-22" fill="none" stroke={tint} strokeOpacity=".4" />
      <text x="20" y="203" fill="#d8e8f2" fillOpacity=".52" fontSize="9" letterSpacing="2">{item.short_name.toUpperCase()} / ARCHIVE ART</text>
    </svg>
  );
}

function AstronautPortrait({ isSpeaking = false }: { isSpeaking?: boolean }) {
  return (
    <div className={`guide-astronaut-wrap ${isSpeaking ? "is-transmitting" : ""}`}>
      <svg className="guide-astronaut" viewBox="0 0 90 104" aria-hidden="true">
        <defs>
          <linearGradient id="guide-suit" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f1f5f9"/><stop offset="1" stopColor="#64748b"/></linearGradient>
          <linearGradient id="guide-visor" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#00f0ff"/>
            <stop offset=".48" stopColor="#0284c7"/>
            <stop offset="1" stopColor="#ffd700"/>
          </linearGradient>
          <filter id="visor-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        <path d="M23 60 15 92q30 18 60 0L66 60" fill="url(#guide-suit)" stroke="#38bdf8" strokeWidth="1.5"/>
        <path d="m27 73-15 13 8 8 17-11m26-10 15 13-8 8-17-11" fill="url(#guide-suit)" stroke="#94a3b8" strokeWidth="1.5"/>
        <rect x="34" y="57" width="22" height="16" rx="8" fill="#334155"/>
        <circle cx="45" cy="35" r="29" fill="url(#guide-suit)" stroke="#00f0ff" strokeWidth="2.5"/>
        <path d="M22 33q2-21 23-21 21 0 23 21l-5 10q-18 10-36 0z" fill="url(#guide-visor)" filter="url(#visor-glow)" stroke="#e0f2fe" strokeWidth="2"/>
        <path d="m29 29 14-10m-10 22 26-18" stroke="#ffffff" strokeOpacity=".75" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="45" cy="35" r="3" fill="#ffea00" className="visor-pupil"/>
        <rect x="57" y="65" width="13" height="14" rx="3" fill="#0f172a" stroke="#00ff88"/>
        <path d="M60 70h7m-7 4h5" stroke="#00ff88" strokeWidth="1.5"/>
        <path d="M20 94q25 8 50 0" fill="none" stroke="#00f0ff" strokeWidth="2"/>
      </svg>
      {isSpeaking && (
        <span className="radio-waves" aria-hidden="true">
          <i /><i /><i />
        </span>
      )}
    </div>
  );
}

export default function MissionTimeline({ items }: { items: Item[] }) {
  const missions = useMemo<MissionRow[]>(() => items
    .map((item) => {
      const span = missionSpan(item);
      const achievements = item.facts
        .filter((fact) => fact.kind === "discovery" || fact.kind === "legacy" || fact.kind === "mission")
        .map((fact) => ({ fact, year: factYear(fact) }))
        .filter((entry): entry is Achievement => entry.year !== null && entry.year >= FIRST_YEAR && entry.year <= LAST_YEAR)
        .sort((a, b) => a.year - b.year);
      return { item, ...span, achievements };
    })
    .sort((a, b) => a.start - b.start || a.item.name.localeCompare(b.item.name)), [items]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFact, setSelectedFact] = useState<Fact | null>(null);
  const [factIndex, setFactIndex] = useState(0);
  const [mediaMode, setMediaMode] = useState<"photo" | "schematic">("photo");
  const [zoneFilter, setZoneFilter] = useState<Zone | "all">("all");
  const [focusYear, setFocusYear] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  const visible = missions.filter(({ item }) => zoneFilter === "all" || item.zone === zoneFilter);
  const grouped = ZONE_ORDER.map((zone) => ({ zone, rows: visible.filter(({ item }) => item.zone === zone) })).filter((group) => group.rows.length);
  const selected = missions.find(({ item }) => item.id === selectedId) ?? null;
  const activeCount = items.filter((item) => item.status === "active").length;

  const currentFacts = selected?.item.facts ?? [];
  const currentFact = selectedFact ?? (currentFacts.length ? currentFacts[factIndex % currentFacts.length] : null);

  function selectMission(item: Item, fact?: Fact, year?: number) {
    setSelectedId(item.id);
    setSelectedFact(fact ?? null);
    setFactIndex(0);
    if (year) setFocusYear(year);
  }

  function nextFact() {
    if (!currentFacts.length) return;
    setSelectedFact(null);
    setFactIndex((prev) => (prev + 1) % currentFacts.length);
  }

  function jumpToYear(year: number) {
    setFocusYear(year);
    const target = timelineRef.current?.querySelector<HTMLElement>(`[data-year="${year}"]`);
    target?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    const nearest = missions.find(({ start, end }) => year >= start && year <= end) ?? missions.reduce<MissionRow | null>((best, row) => !best || Math.abs(row.start - year) < Math.abs(best.start - year) ? row : best, null);
    if (nearest) selectMission(nearest.item, undefined, year);
  }

  return (
    <div className="lost-home">
      <section className="lost-hero">
        <div className="lost-hero-grid" aria-hidden="true" />
        <div className="lost-hero-orbit orbit-a" aria-hidden="true" />
        <div className="lost-hero-orbit orbit-b" aria-hidden="true" />
        <div className="lost-hero-content">
          <div className="lost-kicker"><span className="signal-light" /> HUMANITY&apos;S OFF-WORLD ARCHIVE <span className="kicker-rule" /> EST. 1958</div>
          <h1>LOST <span>IN</span><br /><strong>SPACE</strong></h1>
          <p>Every machine left behind is still part of the mission. Follow NASA&apos;s work through time, meet the machines, and uncover what they changed.</p>
          <a href="#timeline" className="lost-hero-cta">ENTER THE TIMELINE <ArrowDownRight size={17} /></a>
          <div className="lost-hero-stats">
          <div><strong>1958</strong><span>NASA FOUNDED</span></div>
            <i />
            <div><strong>{items.length.toString().padStart(2, "0")}</strong><span>OBJECT FILES</span></div>
            <i />
            <div className="stat-active"><strong>{activeCount.toString().padStart(2, "0")}</strong><span>STILL TRANSMITTING</span></div>
          </div>
        </div>
        <div className="hero-art-stage" aria-hidden="true">
          <div className="hero-ring ring-one" /><div className="hero-ring ring-two" />
          <div className="hero-planet" /><div className="hero-satellite"><span /><i /><b /></div>
          <span className="hero-art-label">SIGNAL / 001</span>
        </div>
        <div className="hero-coordinate">38°53&apos;23.4&quot;N&nbsp; 77°00&apos;32.6&quot;W<br /><span>MISSION CONTROL / EARTH</span></div>
      </section>

      <section className="timeline-section" id="timeline">
        <div className="timeline-heading">
          <div>
            <div className="lost-kicker"><span className="signal-light" /> NASA MISSION HISTORY / 1958—NOW</div>
            <h2>One launch.<br /><span>A thousand afterlives.</span></h2>
            <p className="timeline-intro-copy">Move through the years. Select a mission thread or a gold milestone to open its field notes.</p>
          </div>
          <div className="timeline-legend" aria-label="Timeline legend">
            <span><i className="legend-dead" /> MISSION ENDED</span>
            <span><i className="legend-active" /> ACTIVE SIGNAL</span>
            <span><i className="legend-achievement" /> DISCOVERY / LEGACY</span>
          </div>
        </div>

        <div className="timeline-filter-row">
          <div className="zone-filters" aria-label="Filter mission branches">
            <button className={zoneFilter === "all" ? "selected" : ""} onClick={() => setZoneFilter("all")}>ALL FILES</button>
            {ZONE_ORDER.map((zone) => <button key={zone} className={zoneFilter === zone ? "selected" : ""} onClick={() => setZoneFilter(zone)}>{zone === "earth-orbit" ? "ORBIT" : zone.toUpperCase()}</button>)}
          </div>
          <span className="timeline-count">{visible.length} OBJECT THREADS</span>
        </div>

        <div className="timeline-layout">
          <div className="timeline-board" ref={timelineRef}>
            <div className="timeline-board-inner">
              <div className="timeline-axis-row">
                <div className="axis-label">MISSION / SERVICE WINDOW</div>
                <div className="timeline-axis">
                  {YEAR_TICKS.map((year) => <button key={year} data-year={year} className={focusYear === year ? "axis-tick focused" : "axis-tick"} style={{ left: `${percent(year)}%` }} onClick={() => jumpToYear(year)}>{year}</button>)}
                </div>
              </div>
              {grouped.map(({ zone, rows }) => (
                <div className="mission-group" key={zone}>
                  <div className={`mission-group-title zone-${zone}`}><span />{ZONE_LABEL[zone]}<b>{String(rows.length).padStart(2, "0")}</b></div>
                  {rows.map(({ item, start, end, achievements }) => {
                    const width = Math.max(0.7, percent(end) - percent(start));
                    const isActive = item.status === "active";
                    return (
                      <div className={`mission-row ${isActive ? "is-active" : "is-ended"} ${selectedId === item.id ? "is-selected" : ""}`} key={item.id}>
                        <button className="mission-row-label" onClick={() => selectMission(item)} aria-label={`Open ${item.name} mission details`}>
                          <SpacecraftIllustration item={item} className="row-art" />
                          <span className="row-label-copy"><strong>{item.short_name}</strong><small>{displayYear(item)}</small></span>
                          {isActive ? <Radio className="row-radio" size={13} /> : null}
                        </button>
                        <div className="mission-track">
                          <span className="track-axis" />
                          <button className={`mission-branch ${isActive ? "branch-active" : "branch-ended"}`} style={{ left: `${percent(start)}%`, width: `${width}%` }} onClick={() => selectMission(item)} aria-label={`${item.name}, active ${item.years_active}`}>
                            <span className="branch-start" /><span className="branch-end" />
                          </button>
                          {achievements.map(({ fact, year }, index) => <button key={fact.id} className={`achievement-pin ${selectedFact?.id === fact.id ? "pin-selected" : ""}`} style={{ left: `${percent(year)}%`, marginLeft: `${(index % 3 - 1) * 7}px` }} onClick={() => selectMission(item, fact, year)} aria-label={`${fact.label}, ${year}: ${fact.claim}`} title={`${year} · ${fact.label}`}><span /></button>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div className="timeline-scroll-hint"><span>SCROLL THE YEARS</span><ArrowUpRight size={13} /></div>
            </div>
          </div>

          <aside className={`mission-dossier ${selected ? "has-selection" : ""}`} aria-live="polite">
            {selected ? (
              <>
                <div className="dossier-topline">
                  <span>
                    <i className={selected.item.status === "active" ? "status-live" : "status-ended"} />
                    {selected.item.status === "active" ? "SIGNAL ACTIVE // TRANSMITTING" : selected.item.status === "destroyed" ? "NO LONGER IN ORBIT" : "MISSION SILENT // RESTING"}
                  </span>
                  <button className="dossier-close" onClick={() => { setSelectedId(null); setSelectedFact(null); }} aria-label="Close mission details"><X size={15} /></button>
                </div>

                <div className="media-selector-tabs">
                  <button 
                    className={`media-tab ${mediaMode === "photo" ? "is-active" : ""}`}
                    onClick={() => setMediaMode("photo")}
                  >
                    NASA PHOTOGRAPHY
                  </button>
                  <button 
                    className={`media-tab ${mediaMode === "schematic" ? "is-active" : ""}`}
                    onClick={() => setMediaMode("schematic")}
                  >
                    TACTICAL BLUEPRINT
                  </button>
                </div>

                {mediaMode === "photo" && selected.item.images[0] ? (
                  <div className="dossier-photo-wrap">
                    <img src={selected.item.images[0].src} alt={selected.item.name} className="dossier-photo" />
                    <span className="photo-scanline" />
                    <span className="photo-caption">{selected.item.images[0].caption}</span>
                  </div>
                ) : (
                  <SpacecraftIllustration item={selected.item} className="dossier-art" />
                )}

                <div className="dossier-object-type">{selected.item.zone.replace("-", " ").toUpperCase()} // {selected.item.type.toUpperCase()}</div>
                <h3>{selected.item.name}</h3>
                
                <div className="dossier-service-badge">
                  <span className="service-label">SERVICE WINDOW:</span>
                  <span className="service-value">{displayYear(selected.item)}</span>
                  <span className="service-loc">LOC: {selected.item.location.label}</span>
                </div>

                {selectedFact ? (
                  <div className="achievement-card is-gold-milestone">
                    <div className="achievement-card-label">
                      <span className="gold-star">★</span> MISSION MILESTONE // {selectedFact.value || "ACHIEVEMENT"}
                    </div>
                    <p>{selectedFact.claim}</p>
                    <span className="achievement-corner-tag">[VERIFIED NASA DATA]</span>
                  </div>
                ) : currentFact ? (
                  <div className="achievement-card">
                    <div className="achievement-card-label">
                      <span /> TELEMETRY RECORD // {currentFact.kind.toUpperCase()}
                    </div>
                    <p>{currentFact.claim}</p>
                  </div>
                ) : null}

                <div className="astronaut-guide">
                  <AstronautPortrait isSpeaking={true} />
                  <div className="guide-copy">
                    <div className="guide-header-row">
                      <span>ASTRONAUT LEX // TRANSMISSION</span>
                      <button className="next-fact-btn" onClick={nextFact} title="Transmit next fact">
                        NEXT FACT ⟳
                      </button>
                    </div>
                    <p>
                      {currentFact 
                        ? `"${currentFact.claim}"`
                        : `This is ${selected.item.short_name}. It served from ${selected.item.years_active}.`}
                    </p>
                  </div>
                </div>

                <Link href={`/item/${selected.item.id}`} className="dossier-link">
                  ACCESS FULL RELIC RECORD <ChevronRight size={15} />
                </Link>
              </>
            ) : (
              <div className="dossier-empty">
                <AstronautPortrait isSpeaking={false} />
                <span>MISSION CONTROL STANDBY</span>
                <p>Select any mission branch or gold milestone on the timeline to establish a telemetry link.</p>
              </div>
            )}
          </aside>
        </div>
        <div className="timeline-note"><span>ARCHIVE NOTE</span> Mission dates and milestone claims follow the object records and cited sources. A branch shows the recorded service span; it does not imply an unrecorded project lineage.</div>
      </section>
    </div>
  );
}
