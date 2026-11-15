import {
  degreesLat,
  degreesLong,
  eciToGeodetic,
  gstime,
  json2satrec,
  propagate,
  type OMMJsonObject,
} from "satellite.js";

/** An OMM record as returned by CelesTrak and stored in `gp_element.raw_omm`. */
export type OmmRecord = OMMJsonObject;

export interface OrbitPosition {
  latitude: number;
  longitude: number;
  altitudeKm: number;
  velocityKmS: number;
  /** The instant the position was propagated to. */
  at: string;
}

/**
 * Propagate one OMM element set with SGP4 and return geodetic coordinates.
 * Positions are computed on demand; nothing is stored per second.
 *
 * Returns null for a malformed element set or a propagation failure, so the
 * caller can render a "last known position" fallback.
 */
export function propagateOmm(omm: OmmRecord, date: Date = new Date()): OrbitPosition | null {
  let satrec;
  try {
    satrec = json2satrec(omm);
  } catch {
    return null;
  }

  const state = propagate(satrec, date);
  if (!state || typeof state.position === "boolean" || typeof state.velocity === "boolean") {
    return null;
  }
  if (!state.position || !state.velocity) return null;

  const geodetic = eciToGeodetic(state.position, gstime(date));
  const velocityKmS = Math.hypot(
    state.velocity.x,
    state.velocity.y,
    state.velocity.z
  );

  const position = {
    latitude: degreesLat(geodetic.latitude),
    longitude: degreesLong(geodetic.longitude),
    altitudeKm: geodetic.height,
    velocityKmS,
    at: date.toISOString(),
  };

  if (
    !Number.isFinite(position.latitude) ||
    !Number.isFinite(position.longitude) ||
    !Number.isFinite(position.altitudeKm) ||
    !Number.isFinite(position.velocityKmS)
  ) {
    return null;
  }

  return position;
}
