/*
 * Outdoor Escape — modelul de locație (D-039). Calcule pure.
 *
 * NU folosește Geolocation API. Primește o observație GPS de forma
 *   { lat, lng, accuracy, timestamp? }   (grade zecimale WGS84, precizie în metri)
 * și produce zone și tranziții. Sursa observației din browser este location.js
 * (M-003.1); geo.js rămâne pur și testabil cu date simulate.
 *
 * Reguli (setările vin din defaults.js / settings.gps al aventurii):
 * - precizie lipsă, invalidă sau > maxAccuracy → zona „uncertain”: nu declanșează nimic;
 * - „inside” dacă distanța ≤ rază + min(precizie, rază / 2)  (toleranță limitată);
 * - „near” dacă distanța ≤ nearDistance;
 * - altfel „outside”;
 * - histerezis: odată „inside”, ieșirea cere distanța > pragul de intrare + exitMargin;
 *   odată „near”, trecerea la „outside” cere distanța > nearDistance + exitMargin.
 */

import { DEFAULT_SETTINGS } from "./defaults.js";

const EARTH_RADIUS_M = 6371008.8; // raza medie a Pământului (IUGG)

export const Zone = Object.freeze({
  INSIDE: "inside",
  NEAR: "near",
  OUTSIDE: "outside",
  UNCERTAIN: "uncertain",
});

/** Prezența memorată pentru o locație (fără „uncertain”: incertitudinea nu schimbă prezența). */
export const Presence = Object.freeze({
  INSIDE: "inside",
  NEAR: "near",
  OUTSIDE: "outside",
});

export const Transition = Object.freeze({
  NEAR: "near",
  ARRIVED: "arrived",
  LEFT: "left",
});

export function isValidCoordinates(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    Number.isFinite(value.lat) &&
    Number.isFinite(value.lng) &&
    value.lat >= -90 &&
    value.lat <= 90 &&
    value.lng >= -180 &&
    value.lng <= 180
  );
}

const toRadians = (degrees) => (degrees * Math.PI) / 180;

/** Distanța pe suprafața Pământului (formula haversine), în metri. */
export function distanceMeters(a, b) {
  const dLat = toRadians(b.lat - a.lat);
  const dLng = toRadians(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Calitatea unei observații, independent de orice locație (aceeași regulă ca în
 * evaluateProximity — singura sursă a pragului de precizie):
 *   { usable: true,  reason: null }
 *   { usable: false, reason: "invalid_fix" | "low_accuracy" }
 * Folosită de interfață pentru starea „semnal slab”, fără a calcula praguri proprii.
 */
export function assessFix(fix, gps = DEFAULT_SETTINGS.gps) {
  if (!isValidCoordinates(fix)) return { usable: false, reason: "invalid_fix" };
  const accuracy = fix.accuracy;
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > gps.maxAccuracy) {
    return { usable: false, reason: "low_accuracy" };
  }
  return { usable: true, reason: null };
}

/**
 * Evaluează o observație față de o locație.
 * location: { coordinates: {lat, lng}, radius? }
 * fix:      { lat, lng, accuracy }
 * gps:      setările GPS efective (implicit DEFAULT_SETTINGS.gps)
 */
export function evaluateProximity(location, fix, gps = DEFAULT_SETTINGS.gps) {
  const radius = Number.isFinite(location.radius) && location.radius > 0 ? location.radius : gps.defaultRadius;

  const quality = assessFix(fix, gps);
  if (quality.reason === "invalid_fix") {
    return { zone: Zone.UNCERTAIN, reason: "invalid_fix", radiusMeters: radius };
  }
  const distance = distanceMeters(location.coordinates, fix);
  const accuracy = fix.accuracy;
  const base = { distanceMeters: distance, accuracyMeters: accuracy, radiusMeters: radius };

  if (!quality.usable) {
    return { ...base, zone: Zone.UNCERTAIN, reason: quality.reason };
  }

  const insideThreshold = radius + Math.min(accuracy, radius / 2);
  const thresholds = {
    insideThreshold,
    insideExitThreshold: insideThreshold + gps.exitMargin,
    nearDistance: gps.nearDistance,
    nearExitThreshold: gps.nearDistance + gps.exitMargin,
  };

  let zone = Zone.OUTSIDE;
  if (distance <= insideThreshold) zone = Zone.INSIDE;
  else if (distance <= gps.nearDistance) zone = Zone.NEAR;
  return { ...base, ...thresholds, zone };
}

/**
 * Prezența următoare și tranzițiile, pornind de la prezența anterioară (histerezis).
 * Întoarce { presence, transitions: [] } — cel mult o tranziție pe apel.
 */
export function nextPresence(previous, proximity) {
  const prev = Object.values(Presence).includes(previous) ? previous : Presence.OUTSIDE;
  if (proximity.zone === Zone.UNCERTAIN) return { presence: prev, transitions: [] };

  const d = proximity.distanceMeters;

  if (prev === Presence.INSIDE) {
    if (d <= proximity.insideExitThreshold) return { presence: Presence.INSIDE, transitions: [] };
    const presence = d <= proximity.nearDistance ? Presence.NEAR : Presence.OUTSIDE;
    return { presence, transitions: [Transition.LEFT] };
  }

  if (proximity.zone === Zone.INSIDE) return { presence: Presence.INSIDE, transitions: [Transition.ARRIVED] };

  if (prev === Presence.NEAR) {
    if (d <= proximity.nearExitThreshold) return { presence: Presence.NEAR, transitions: [] };
    return { presence: Presence.OUTSIDE, transitions: [] };
  }

  // prev === OUTSIDE
  if (proximity.zone === Zone.NEAR) return { presence: Presence.NEAR, transitions: [Transition.NEAR] };
  return { presence: Presence.OUTSIDE, transitions: [] };
}
