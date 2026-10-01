/*
 * Adventure QA — regulile GPS și de structură (Pasul 3).
 *
 *   QA-G02  locația țintă a unei misiuni „location”: confirmarea manuală efectivă activă
 *           și fallback.instructions nevid (D-006)                                   (error)
 *   QA-G03  misiune principală fără locationId, într-o aventură cu locații         (warning)
 *   QA-G04  două locații la mai puțin de 1 m una de alta                           (warning)
 *   QA-G05  zone GPS suprapuse: distanța < suma razelor efective                   (warning)
 *   QA-G06  aventură care nu este public-demo, cu o locație lângă 0°, 0°            (error)
 *   QA-G07  public-demo cu o locație în afara zonei de lângă 0°, 0° (D-034, D-068)  (error)
 *
 * Sursa de adevăr este motorul: distanța (geo.distanceMeters, haversine), raza efectivă
 * (geo.effectiveRadius) și regula confirmării manuale din game.confirmArrival. QA nu are
 * formule proprii. Coordonatele invalide sunt raportate deja de schemă (QA-S01) și sunt sărite aici.
 * Mesajele nu conțin coordonate; id-urile apar doar între „…” (mascate pentru aventurile private).
 * Fiecare finding are `subject` (pentru excepțiile declarate).
 *
 * Primește aventura normalizată (toAdventureV2) și clasificarea fișierului. Pur: fără disc, fără consolă.
 */

import { DEFAULT_SETTINGS } from "../../src/js/defaults.js";
import { distanceMeters, effectiveRadius, isValidCoordinates } from "../../src/js/geo.js";
import { CLASSES } from "./classify.mjs";

/** Zona „lângă 0°, 0°” (aceeași limită ca testele demo-urilor fictive): |lat| < 0,01 și |lng| < 0,01. */
export const NEAR_ZERO_DEGREES = 0.01;
/** QA-G04: sub această distanță, două locații sunt practic același punct. */
export const DUPLICATE_DISTANCE_METERS = 1;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isPositiveNumber = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const isNonEmptyText = (value) => typeof value === "string" && value.trim().length > 0;

export const isNearZero = ({ lat, lng }) => Math.abs(lat) < NEAR_ZERO_DEGREES && Math.abs(lng) < NEAR_ZERO_DEGREES;

const meters = (value) => `${Math.round(value * 10) / 10} m`;

/**
 * content — aventura normalizată; classification — clasa fișierului (classify.mjs).
 * Întoarce findings { ruleId, level, path, message, subject }.
 */
export function checkGps(content, { classification } = {}) {
  const findings = [];
  const add = (ruleId, level, path, message, subject) => findings.push({ ruleId, level, path, message, subject });

  const locations = Array.isArray(content.locations) ? content.locations : [];
  const missions = Array.isArray(content.missions) ? content.missions : [];
  if (locations.length === 0) return findings;

  // Setările GPS normalizate; o rază implicită invalidă (raportată de QA-S01) → valoarea implicită a motorului.
  const settingsGps = isObject(content.settings?.gps) ? content.settings.gps : DEFAULT_SETTINGS.gps;
  const gps = isPositiveNumber(settingsGps.defaultRadius) ? settingsGps : { ...settingsGps, defaultRadius: DEFAULT_SETTINGS.gps.defaultRadius };

  const placed = locations
    .map((location, index) => ({ location, index }))
    .filter(({ location }) => isObject(location) && isValidCoordinates(location.coordinates));

  // QA-G02 — doar locațiile la care sosirea este condiția misiunii (type „location”); cele ascunse sunt excluse:
  // confirmarea manuală este refuzată cât timp sunt „locked”, iar instrucțiunile nu se afișează.
  const gpsTargets = new Set(missions.filter((m) => isObject(m) && m.type === "location" && typeof m.locationId === "string").map((m) => m.locationId));
  locations.forEach((location, index) => {
    if (!isObject(location) || !gpsTargets.has(location.id) || location.hiddenUntilDiscovered === true) return;
    const where = `locations[${index}]`;
    const name = `locația „${location.id}”`;
    const fallback = isObject(location.fallback) ? location.fallback : {};
    // Aceeași regulă ca game.confirmArrival.
    const manual = fallback.allowManualConfirmation ?? gps.allowManualConfirmation ?? true;
    if (manual !== true) {
      const path = fallback.allowManualConfirmation !== undefined ? `${where}.fallback.allowManualConfirmation` : "settings.gps.allowManualConfirmation";
      add("QA-G02", "error", path, `${name}: confirmarea manuală („Am ajuns”) este dezactivată; GPS-ul nu poate fi singura cale de sosire (D-006).`, `locations.${location.id}.allowManualConfirmation`);
    }
    if (!isNonEmptyText(fallback.instructions)) {
      add("QA-G02", "error", `${where}.fallback.instructions`, `${name}: lipsesc instrucțiunile de rezervă (fallback.instructions) pentru cazul în care GPS-ul nu poate fi folosit.`, `locations.${location.id}.fallback.instructions`);
    }
  });

  // QA-G03 — o misiune „location” fără locationId este deja eroare de schemă (QA-S01).
  missions.forEach((mission, index) => {
    if (!isObject(mission) || (mission.track ?? "main") !== "main" || mission.type === "location") return;
    if (mission.locationId !== undefined) return;
    add("QA-G03", "warning", `missions[${index}].locationId`, `misiunea principală „${mission.id}” nu are locationId, deși aventura are locații (fără obiectiv pe hartă).`, `missions.${mission.id}.locationId`);
  });

  // QA-G04 / QA-G05 — toate perechile distincte.
  for (let i = 0; i < placed.length; i++) {
    for (let j = i + 1; j < placed.length; j++) {
      const a = placed[i].location;
      const b = placed[j].location;
      const where = `locations[${placed[j].index}].coordinates`;
      const pair = `„${a.id}” și „${b.id}”`;
      const subject = `locations.${a.id}|${b.id}`;
      const distance = distanceMeters(a.coordinates, b.coordinates);
      if (distance < DUPLICATE_DISTANCE_METERS) {
        add("QA-G04", "warning", where, `locațiile ${pair} sunt practic în același punct (${meters(distance)}); dacă mai multe misiuni folosesc același loc, reutilizează același locationId.`, subject);
      }
      const radiusA = effectiveRadius(a, gps);
      const radiusB = effectiveRadius(b, gps);
      if (distance < radiusA + radiusB) {
        add("QA-G05", "warning", where, `zonele GPS ale locațiilor ${pair} se suprapun: distanța ${meters(distance)} < ${meters(radiusA)} + ${meters(radiusB)}.`, subject);
      }
    }
  }

  // QA-G06 / QA-G07 — coordonatele de lângă 0°, 0° sunt rezervate demo-urilor fictive.
  const isDemo = classification === CLASSES.PUBLIC_DEMO;
  for (const { location, index } of placed) {
    const where = `locations[${index}].coordinates`;
    const subject = `locations.${location.id}.coordinates`;
    if (!isDemo && isNearZero(location.coordinates)) {
      add("QA-G06", "error", where, `locația „${location.id}” are coordonate de test (lângă 0°, 0°) într-o aventură care nu este demo.`, subject);
    }
    if (isDemo && !isNearZero(location.coordinates)) {
      add("QA-G07", "error", where, `locația „${location.id}” are coordonate în afara zonei fictive de lângă 0°, 0° într-un demo public (posibile date reale — D-034).`, subject);
    }
  }
  return findings;
}
