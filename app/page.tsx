import Link from "next/link";
import { getItems, getZones } from "@/lib/api";
import RelicSolarMapLoader from "@/components/RelicSolarMapLoader";
import { ArrowRight, Orbit, Satellite, Sparkles } from "lucide-react";

const PORTAL_COPY: Record<string, { kicker: string; description: string }> = {
  moon: { kicker: "LUNAR ECHOES", description: "Silent footprints, historic sites, Apollo's enduring legacy." },
  mars: { kicker: "RED PLANET CHRONICLES", description: "Rusting rovers, orbiters, the ongoing quest for Martian history." },
  "earth-orbit": { kicker: "ORBITAL FRONTIERS", description: "Satellites, space stations, the hustle above our home." },
  "deep-space": { kicker: "VOYAGERS & BEYOND", description: "Pioneering probes, nebulae, the endless frontier." },
};

export default async function HomePage() {
  const [zones, items] = await Promise.all([getZones(), getItems()]);

  return (
    <div className="museum-home">
      <section className="home-hero targeting-frame">
        <div className="home-hero-media" aria-hidden="true" />
        <div className="home-hero-content">
          <div className="hero-collection-mark"><Orbit size={14} /> NASA SPACE MUSEUM <span>·</span> COSMIC RELIC ARCHIVE</div>
          <h1>ABANDONED BUT<br />NOT FORGOTTEN</h1>
          <div className="home-hero-subtitle">A JOURNEY THROUGH LEGACY &amp; EXPLORATION IN THE COSMOS</div>
          <p className="hero-hook">
            Discover the silent sentinels, forgotten outposts, and enduring missions that paved the way
            for humanity&apos;s future among the stars. Explore the real machines and the places they still call home.
          </p>
          <div className="home-hero-actions">
            <Link href="/archive" className="btn btn-primary"><Satellite size={16} /> START EXPLORATION <ArrowRight size={15} /></Link>
            <Link href="/#relic-map" className="btn btn-map-link"><Orbit size={16} /> INTERACTIVE MAP</Link>
          </div>
        </div>
      </section>

      <section id="sector-portals" className="portal-section container">
        <div className="section-heading-row">
          <div>
            <div className="eyebrow">Four halls · one human story</div>
            <h2>Choose your destination.</h2>
          </div>
          <span className="section-index">01 / SECTOR SELECT</span>
        </div>
        <div className="portal-grid">
          {zones.map((zone, index) => {
            const empty = zone.item_count === 0;
            const title = zone.id === "moon" ? "THE MOON" : zone.id === "mars" ? "MARS" : zone.id === "earth-orbit" ? "EARTH ORBIT" : "DEEP SPACE";
            const portal = PORTAL_COPY[zone.id];
            const content = (
              <>
                {zone.hero_image ? <img className="portal-image" src={zone.hero_image} alt="" /> : null}
                <div className="portal-scrim" />
                <span className="portal-number">0{index + 1} <span>·</span> SECTOR</span>
                <div className="portal-info">
                  <span className="portal-kicker">{portal.kicker}</span>
                  <h3>{title}</h3>
                  <p>{portal.description}</p>
                  <div className="portal-bottom">
                    <span className="portal-count">{String(zone.item_count).padStart(2, "0")} RELICS</span>
                    <span className="portal-cta">{empty ? "COMING SOON" : <>LEARN MORE <ArrowRight size={14} /></>}</span>
                  </div>
                </div>
              </>
            );
            return empty ? (
              <div key={zone.id} className={`portal-card portal-${zone.id} is-empty`} aria-disabled="true">{content}</div>
            ) : (
              <Link key={zone.id} href={`/archive?zone=${zone.id}`} className={`portal-card portal-${zone.id}`}>{content}</Link>
            );
          })}
        </div>
      </section>

      <section id="relic-map" className="section map-section targeting-frame">
        <div className="map-section-intro">
          <div className="eyebrow"><Sparkles size={13} /> LIVE SECTOR VISUALIZATION</div>
          <h2>Our Solar System,<br /><em>scattered with stories.</em></h2>
          <p className="lead">Follow each orbital trace into the dark. Select a world or probe to open its exhibit.</p>
        </div>
        <RelicSolarMapLoader items={items} zones={zones} />
      </section>

      <section className="home-story container">
        <div className="home-story-image"><img src="/img/opportunity-2.jpg" alt="Dust on a Mars rover solar array" /></div>
        <div className="home-story-copy">
          <div className="eyebrow">WHY MACHINES STAY</div>
          <h2>Space is a one-way museum.</h2>
          <p>Some spacecraft run out of power. Some are too far away to bring home. Others keep travelling, long after the people who launched them have gone.</p>
          <p>Every exhibit links its story to sourced facts, mission chapters, and the photographs that brought it back to us.</p>
          <Link href="/sources" className="text-link">Explore the source archive <ArrowRight size={15} /></Link>
        </div>
      </section>
    </div>
  );
}
