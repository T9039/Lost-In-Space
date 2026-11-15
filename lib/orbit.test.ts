import assert from "node:assert/strict";
import test from "node:test";

import { propagateOmm, type OmmRecord } from "./orbit";

// One real CelesTrak OMM record, trimmed to the fields SGP4 needs.
const iss: OmmRecord = {
  OBJECT_NAME: "ISS (ZARYA)",
  OBJECT_ID: "1998-067A",
  EPOCH: "2026-11-14T08:49:22.988352",
  MEAN_MOTION: 15.49369975,
  ECCENTRICITY: 0.0007385,
  INCLINATION: 51.6323,
  RA_OF_ASC_NODE: 276.9113,
  ARG_OF_PERICENTER: 24.4215,
  MEAN_ANOMALY: 335.7122,
  EPHEMERIS_TYPE: 0,
  CLASSIFICATION_TYPE: "U",
  NORAD_CAT_ID: 25544,
  ELEMENT_SET_NO: 999,
  REV_AT_EPOCH: 59503,
  BSTAR: 0.00018238,
  MEAN_MOTION_DOT: 9.745e-5,
  MEAN_MOTION_DDOT: 0,
};

const epoch = new Date("2026-11-14T08:49:22.988Z");

test("propagates a CelesTrak OMM record to geodetic coordinates", () => {
  const position = propagateOmm(iss, epoch);
  assert.ok(position);
  assert.ok(Math.abs(position.latitude) < 0.1);
  assert.ok(Math.abs(position.longitude - 91.09) < 0.5);
  assert.ok(Math.abs(position.altitudeKm - 415) < 20);
  assert.ok(Math.abs(position.velocityKmS - 7.67) < 0.2);
  assert.equal(position.at, epoch.toISOString());
});

test("propagation is deterministic for the same instant", () => {
  assert.deepEqual(propagateOmm(iss, epoch), propagateOmm(iss, epoch));
});

test("a malformed element set returns null", () => {
  assert.equal(propagateOmm({ ...iss, EPOCH: "" } as OmmRecord, epoch), null);
});
