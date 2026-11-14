import type { Item } from "./types";

/**
 * Zone / exhibition-hall metadata + 3D sector coordinates.
 * The map renders whatever zones the API returns — these coordinates are
 * ready for zones that do not have relics yet (Venus, Titan, Mercury, the
 * Asteroid Belt), so a backend that returns items in them lights up instantly.
 */
export interface ZoneMeta {
  id: string;
  label: string;
  hall: string;
  tagline: string;
  /** "r, g, b" for rgba() use */
  rim: string;
  rimHex: string;
  /** 3D placement */
  orbitRadius: number;
  angle: number;
  bodyRadius: number;
  bodyColor: string;
  atmosphere: string;
  hasBody: boolean;
  labelOffset: number;
}

const ORIGIN: Omit<ZoneMeta, "id" | "label" | "hall" | "tagline" | "rim" | "rimHex"> = {
  orbitRadius: 6,
  angle: 0,
  bodyRadius: 0.35,
  bodyColor: "#94A3B8",
  atmosphere: "#CBD5E1",
  hasBody: true,
  labelOffset: 0.55,
};

const META: ZoneMeta[] = [
  {
    ...ORIGIN,
    id: "moon",
    label: "The Moon",
    hall: "The Lunar Regolith Plain",
    tagline: "Landers, cars and footprints nobody ever cleaned up.",
    rim: "226, 232, 240",
    rimHex: "#E2E8F0",
    orbitRadius: 6.4,
    angle: 1.15,
    bodyRadius: 0.3,
    bodyColor: "#CBD5E1",
    atmosphere: "#F8FAFC",
    labelOffset: 0.55,
  },
  {
    ...ORIGIN,
    id: "mars",
    label: "Mars",
    hall: "The Red Planet Dust Bowl",
    tagline: "Robots that went quiet but never came home.",
    rim: "245, 158, 11",
    rimHex: "#F59E0B",
    orbitRadius: 9.8,
    angle: 2.75,
    bodyRadius: 0.46,
    bodyColor: "#C2410C",
    atmosphere: "#F59E0B",
    labelOffset: 0.7,
  },
  {
    ...ORIGIN,
    id: "earth-orbit",
    label: "Earth Orbit",
    hall: "The Orbital Graveyard",
    tagline: "Dead satellites and old stations still circling us.",
    rim: "56, 189, 248",
    rimHex: "#38BDF8",
    orbitRadius: 4.2,
    angle: 0.55,
    bodyRadius: 0.62,
    bodyColor: "#1E40AF",
    atmosphere: "#60A5FA",
    labelOffset: 0.85,
  },
  {
    ...ORIGIN,
    id: "deep-space",
    label: "Deep Space",
    hall: "The Deep Space Abyss",
    tagline: "Probes that left the solar system and cannot turn back.",
    rim: "167, 139, 250",
    rimHex: "#A78BFA",
    orbitRadius: 15,
    angle: 3.95,
    bodyRadius: 0,
    bodyColor: "#A78BFA",
    atmosphere: "#C4B5FD",
    hasBody: false,
    labelOffset: 0.5,
  },
  /* ---- coordinates ready for future zones ---- */
  {
    ...ORIGIN,
    id: "mercury",
    label: "Mercury",
    hall: "The Sun-Scorched Plain",
    tagline: "Nothing tracked here yet.",
    rim: "148, 163, 184",
    rimHex: "#94A3B8",
    orbitRadius: 2.5,
    angle: 0.15,
    bodyRadius: 0.28,
    bodyColor: "#9CA3AF",
  },
  {
    ...ORIGIN,
    id: "venus",
    label: "Venus",
    hall: "The Cloud Deck",
    tagline: "Nothing tracked here yet.",
    rim: "234, 179, 8",
    rimHex: "#EAB308",
    orbitRadius: 3.3,
    angle: 2.05,
    bodyRadius: 0.48,
    bodyColor: "#B45309",
    atmosphere: "#EAB308",
  },
  {
    ...ORIGIN,
    id: "asteroid-belt",
    label: "Asteroid Belt",
    hall: "The Debris Field",
    tagline: "Nothing tracked here yet.",
    rim: "168, 162, 158",
    rimHex: "#A8A29E",
    orbitRadius: 12.6,
    angle: 0.9,
    bodyRadius: 0.16,
    bodyColor: "#78716C",
  },
  {
    ...ORIGIN,
    id: "titan",
    label: "Titan",
    hall: "The Methane Shore",
    tagline: "Nothing tracked here yet.",
    rim: "251, 191, 36",
    rimHex: "#FBBF24",
    orbitRadius: 11.6,
    angle: 5.1,
    bodyRadius: 0.38,
    bodyColor: "#B45309",
    atmosphere: "#FCD34D",
  },
];

export const ZONE_META = META;

const FALLBACK: ZoneMeta = {
  ...ORIGIN,
  id: "unknown",
  label: "Unknown sector",
  hall: "Uncatalogued Hall",
  tagline: "Awaiting records.",
  rim: "148, 163, 184",
  rimHex: "#94A3B8",
};

export function zoneMeta(id: string): ZoneMeta {
  return META.find((m) => m.id === id) ?? { ...FALLBACK, id };
}

export function sectorPosition(meta: ZoneMeta, indexSeed = 0): [number, number, number] {
  if (meta.id === "deep-space") {
    return [
      Math.cos(meta.angle) * meta.orbitRadius,
      0.6,
      Math.sin(meta.angle) * meta.orbitRadius,
    ];
  }
  const y = ((indexSeed % 3) - 1) * 0.18;
  return [Math.cos(meta.angle) * meta.orbitRadius, y, Math.sin(meta.angle) * meta.orbitRadius];
}

/* ------------------------------------------------------------------ */
/* hall telemetry                                                      */
/* ------------------------------------------------------------------ */

export interface Telemetry {
  label: string;
  value: string;
}

const firstNumber = (s?: string) => {
  if (!s) return null;
  const m = s.replace(/,/g, "").match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
};

export function hallTelemetry(zoneId: string, items: Item[]): Telemetry[] {
  const telemetry: Telemetry[] = [{ label: "Relics", value: String(items.length) }];
  const allFacts = items.flatMap((i) => i.facts);

  if (zoneId === "moon") {
    const site = items.find((i) => i.location.lat !== undefined);
    if (site) {
      telemetry.push({
        label: "First coordinate",
        value: `${site.location.lat?.toFixed(2)}°, ${site.location.lon?.toFixed(2)}°`,
      });
    }
    const retro = allFacts.filter((f) => /retroreflect/i.test(f.claim + f.label)).length;
    telemetry.push({
      label: "Retroreflector records",
      value: retro > 0 ? `${retro} logged` : "survey pending",
    });
  }

  if (zoneId === "mars") {
    const km = items
      .map((i) => firstNumber(i.specs["Distance driven"]))
      .filter((n): n is number => n !== null)
      .reduce((a, b) => a + b, 0);
    telemetry.push({ label: "Distance driven", value: km > 0 ? `${km} km` : "n/a" });
    const dust = allFacts.filter((f) => /dust/i.test(f.claim + f.label)).length;
    telemetry.push({ label: "Dust incidents", value: String(dust) });
  }

  if (zoneId === "earth-orbit") {
    const catalog = items.map((i) => i.catalog).filter(Boolean);
    telemetry.push({ label: "Tracked IDs", value: String(catalog.length) });
    const regime = items.some((i) => i.status === "destroyed") ? "LEO → decayed" : "LEO / MEO";
    telemetry.push({ label: "Orbital regime", value: regime });
  }

  if (zoneId === "deep-space") {
    const au = items
      .map((i) => firstNumber(i.specs["Heliocentric distance"]))
      .filter((n): n is number => n !== null);
    telemetry.push({
      label: "Heliocentric distance",
      value: au.length ? `${Math.max(...au)}+ AU` : "n/a",
    });
    telemetry.push({ label: "Signals", value: `${items.filter((i) => i.status === "active").length} active` });
  }

  return telemetry;
}
