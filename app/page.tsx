import Link from "next/link";
import { getItems, getZones } from "@/lib/api";
import RelicSolarMapLoader from "@/components/RelicSolarMapLoader";

const STEPS = [
  {
    n: "01",
    title: "Explore 3D Sectors",
    body: "Start on the relic map. It draws a hall for every sector that currently holds abandoned hardware — and it grows automatically as new relics are catalogued.",
    soon: false,
  },
  {
    n: "02",
    title: "Inspect 3D Machines",
    body: "Click a relic to spin a real NASA 3D model, then follow its story from the day it was built to the day it went quiet.",
    soon: false,
  },
  {
    n: "03",
    title: "Ask the AI",
    body: "Ask a question about a machine and get an answer built only from NASA records — never from guesses.",
    soon: false,
  },
  {
    n: "04",
    title: "Test Your Knowledge",
    body: "Finish with a quick mission test so you can see how much you actually remember.",
    soon: false,
  },
];

const HALLS: Record<string, string> = {
  moon: "The Lunar Regolith Plain",
  mars: "The Red Planet Dust Bowl",
  "earth-orbit": "The Orbital Graveyard",
  "deep-space": "The Deep Space Abyss",
};

export default async function HomePage() {
  const [zones, items] = await Promise.all([getZones(), getItems()]);
  const totalFacts = items.reduce((n, i) => n + i.facts.length, 0);
  const totalPhases = items.reduce((n, i) => n + i.phases.length, 0);
  const totalZones = zones.filter((z) => z.item_count > 0).length;

  return (
    <div className="container">
      <section className="hero hero-gateway">
        <div className="hero-collection-mark">COSMIC RELIC MUSEUM <span>·</span> FIELD ARCHIVE 001—026</div>
        <div className="eyebrow">NASA storytelling challenge · for explorers aged 10 and up</div>
        <h1>
          We went to space.
          <br />
          And then we left our stuff there.
        </h1>
        <p className="hero-hook">
          These machines carried people&apos;s questions into space. Some ran out of power, some
          were too far away to bring home, and some are still travelling. Explore their real
          stories, spin the spacecraft in 3D, and discover what happens after a mission ends.
        </p>
        <div className="row">
          <Link href="/archive" className="btn btn-primary">
            Explore the archive
          </Link>
          <Link href="/compare" className="btn btn-blue">
            Compare two machines
          </Link>
        </div>
        <div className="row" style={{ marginTop: 26, gap: 26 }}>
          <span className="muted" style={{ fontSize: 13 }}>
            <strong style={{ color: "var(--text)" }}>{items.length}</strong> catalogued relics
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            <strong style={{ color: "var(--text)" }}>{totalZones}</strong> sectors
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            <strong style={{ color: "var(--text)" }}>{totalFacts}</strong> NASA-sourced facts
          </span>
          <span className="muted" style={{ fontSize: 13 }}>
            <strong style={{ color: "var(--text)" }}>{totalPhases}</strong> story phases
          </span>
        </div>
      </section>

      <section className="section">
        <div className="eyebrow">How it works &amp; what you&apos;ll discover</div>
        <h2>Why do we leave things in space?</h2>
        <p className="lead">
          Spacecraft are usually abandoned for one of three reasons: they run out of power, they
          are too heavy to bring home, or they simply keep going. Nothing up there gets repaired
          or recycled. Once a machine is done, it stays — for centuries.
        </p>

        <div className="steps" style={{ marginTop: 24 }}>
          {STEPS.map((step) => (
            <div key={step.n} className="step">
              <div className="step-num">Step {step.n}</div>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
              {step.soon ? <span className="step-soon">coming next</span> : null}
            </div>
          ))}
        </div>

        <p className="muted" style={{ fontSize: 12.5, marginTop: 14 }}>
          Every exhibit connects a machine&apos;s mission story to the NASA records behind it.
        </p>
      </section>

      <section className="section-tight">
        <div className="eyebrow">Choose a sector</div>
        <div className="grid grid-4">
          {zones.map((zone) => {
            const empty = zone.item_count === 0;
            const inner = (
              <>
                <div className="card-media">
                  {zone.hero_image ? (
                    <img
                      src={zone.hero_image}
                      alt=""
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : null}
                  <span className="zone-count">
                    {empty ? "soon" : `${zone.item_count} relic${zone.item_count === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="card-pad">
                  <div className="zone-hall">{HALLS[zone.id]}</div>
                  <div className="card-title">{zone.label}</div>
                  <div className="card-meta">{zone.blurb}</div>
                </div>
              </>
            );

            return empty ? (
              <div key={zone.id} className={`card zone-card is-empty zone-${zone.id}`}>
                {inner}
              </div>
            ) : (
              <Link
                key={zone.id}
                href={`/archive?zone=${zone.id}`}
                className={`card zone-card zone-${zone.id}`}
              >
                {inner}
              </Link>
            );
          })}
        </div>

        <div className="map-cta">
          <a href="#relic-map" className="btn btn-primary">
            Launch 3D Solar System Relic Map ↓
          </a>
          <span className="map-cta-sub">A living 3D atlas. Choose a world, follow a trajectory, meet the machines.</span>
        </div>
      </section>

      <section id="relic-map" className="section map-section">
        <div className="eyebrow">3D Solar System Relic Map</div>
        <h2>Every hall is generated from the archive</h2>
        <p className="lead">
          The map is built from the relic records themselves: a sector appears the moment it has
          something left in it, and disappears when it does not. Drag to orbit, click a glowing
          beacon to zoom in, then inspect a relic in the slide-out panel.
        </p>

        <RelicSolarMapLoader items={items} zones={zones} />
      </section>

      <section className="section-tight">
        <div className="card">
          <div className="card-pad">
            <div className="card-title">Straight from NASA</div>
            <p className="card-meta" style={{ marginTop: 8 }}>
              Every fact on this site comes from a NASA mission page or NASA&apos;s own records,
              and every image is NASA public-domain imagery. The 3D models are NASA 3D Resources
              assets. No AI-generated pictures, no guesswork, no invented numbers.
            </p>
            <Link href="/sources" className="btn btn-sm" style={{ marginTop: 12 }}>
              See every source →
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
