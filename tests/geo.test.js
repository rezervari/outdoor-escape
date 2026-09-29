import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceMeters, evaluateProximity, nextPresence, isValidCoordinates, Zone, Presence, Transition } from "../src/js/geo.js";
import { DEFAULT_SETTINGS, resolveSettings } from "../src/js/defaults.js";

// La ecuator, 1 grad de latitudine ≈ 111 195 m (raza medie 6 371 008,8 m).
const METERS_PER_DEGREE = (2 * Math.PI * 6371008.8) / 360;
const origin = { lat: 0, lng: 0 };
const location = { coordinates: origin, radius: 40 };
const gps = DEFAULT_SETTINGS.gps;

/** O observație la `meters` nord de origine, cu precizia dată. */
const fixAt = (meters, accuracy = 10) => ({ lat: meters / METERS_PER_DEGREE, lng: 0, accuracy });

test("distanceMeters: valori de referință", () => {
  assert.equal(distanceMeters(origin, origin), 0);
  assert.ok(Math.abs(distanceMeters(origin, { lat: 1, lng: 0 }) - 111195) < 1);
  assert.ok(Math.abs(distanceMeters(origin, { lat: 0, lng: 1 }) - 111195) < 1); // la ecuator
  // Pe paralela 45°, 1 grad de longitudine ≈ 111 195 × cos(45°) ≈ 78 626 m.
  assert.ok(Math.abs(distanceMeters({ lat: 45, lng: 25 }, { lat: 45, lng: 26 }) - 78626) < 50);
  // Simetrie și distanțe mici (zeci de metri).
  const a = { lat: 45.6427, lng: 25.5887 };
  const b = { lat: 45.6431, lng: 25.5893 };
  assert.equal(distanceMeters(a, b), distanceMeters(b, a));
  assert.ok(distanceMeters(a, b) > 50 && distanceMeters(a, b) < 70);
  assert.ok(Math.abs(distanceMeters(origin, fixAt(100)) - 100) < 0.01);
});

test("isValidCoordinates", () => {
  assert.equal(isValidCoordinates({ lat: 45.64, lng: 25.58 }), true);
  assert.equal(isValidCoordinates({ lat: 90.1, lng: 0 }), false);
  assert.equal(isValidCoordinates({ lat: 0, lng: -181 }), false);
  assert.equal(isValidCoordinates({ lat: "45", lng: 25 }), false);
  assert.equal(isValidCoordinates(null), false);
});

test("evaluateProximity: raza, toleranța din precizie și zona „near”", () => {
  assert.equal(evaluateProximity(location, fixAt(0)).zone, Zone.INSIDE);
  assert.equal(evaluateProximity(location, fixAt(40, 0)).zone, Zone.INSIDE); // exact pe rază
  assert.equal(evaluateProximity(location, fixAt(41, 0)).zone, Zone.NEAR); // fără toleranță
  // Toleranța = min(precizie, rază/2): cu precizie 10 m, pragul este 50 m.
  assert.equal(evaluateProximity(location, fixAt(49, 10)).zone, Zone.INSIDE);
  assert.equal(evaluateProximity(location, fixAt(51, 10)).zone, Zone.NEAR);
  // Toleranța este limitată la rază/2 (20 m), chiar dacă precizia este 55 m.
  const weak = evaluateProximity(location, fixAt(59, 55));
  assert.equal(weak.insideThreshold, 60);
  assert.equal(weak.zone, Zone.INSIDE);
  assert.equal(evaluateProximity(location, fixAt(61, 55)).zone, Zone.NEAR);
  // near ≤ 150 m, apoi outside.
  assert.equal(evaluateProximity(location, fixAt(150)).zone, Zone.NEAR);
  assert.equal(evaluateProximity(location, fixAt(151)).zone, Zone.OUTSIDE);
});

test("evaluateProximity: precizie slabă sau lipsă → „uncertain”", () => {
  const tooWeak = evaluateProximity(location, fixAt(0, 61));
  assert.equal(tooWeak.zone, Zone.UNCERTAIN);
  assert.equal(tooWeak.reason, "low_accuracy");
  assert.equal(evaluateProximity(location, fixAt(0, 60)).zone, Zone.INSIDE); // exact maxAccuracy
  assert.equal(evaluateProximity(location, { lat: 0, lng: 0 }).zone, Zone.UNCERTAIN); // fără accuracy
  assert.equal(evaluateProximity(location, { lat: 0, lng: 0, accuracy: -1 }).zone, Zone.UNCERTAIN);
  assert.equal(evaluateProximity(location, { lat: 200, lng: 0, accuracy: 5 }).reason, "invalid_fix");
});

test("evaluateProximity: raza implicită și setările per aventură", () => {
  const noRadius = { coordinates: origin };
  assert.equal(evaluateProximity(noRadius, fixAt(0)).radiusMeters, 40);
  const strict = resolveSettings({ gps: { defaultRadius: 15, maxAccuracy: 20, nearDistance: 60 } }).gps;
  assert.equal(evaluateProximity(noRadius, fixAt(0), strict).radiusMeters, 15);
  assert.equal(evaluateProximity(noRadius, fixAt(0, 25), strict).zone, Zone.UNCERTAIN);
  assert.equal(evaluateProximity(noRadius, fixAt(61), strict).zone, Zone.OUTSIDE);
});

test("nextPresence: outside → near → arrived → left", () => {
  let step = nextPresence(Presence.OUTSIDE, evaluateProximity(location, fixAt(120)));
  assert.deepEqual(step, { presence: Presence.NEAR, transitions: [Transition.NEAR] });

  step = nextPresence(step.presence, evaluateProximity(location, fixAt(100)));
  assert.deepEqual(step.transitions, []); // deja „near”: fără tranziție repetată

  step = nextPresence(step.presence, evaluateProximity(location, fixAt(10)));
  assert.deepEqual(step, { presence: Presence.INSIDE, transitions: [Transition.ARRIVED] });

  step = nextPresence(step.presence, evaluateProximity(location, fixAt(0)));
  assert.deepEqual(step.transitions, []); // deja „inside”: fără sosire repetată

  step = nextPresence(step.presence, evaluateProximity(location, fixAt(120)));
  assert.deepEqual(step, { presence: Presence.NEAR, transitions: [Transition.LEFT] });

  // Direct din outside în inside: o singură tranziție, „arrived”.
  assert.deepEqual(nextPresence(Presence.OUTSIDE, evaluateProximity(location, fixAt(5))).transitions, [Transition.ARRIVED]);
  // Ieșire direct în outside.
  assert.deepEqual(nextPresence(Presence.INSIDE, evaluateProximity(location, fixAt(500))), { presence: Presence.OUTSIDE, transitions: [Transition.LEFT] });
});

test("exit margin: oscilația la marginea razei nu produce ieșiri/sosiri repetate", () => {
  // Precizie 0 → pragul de intrare = 40 m, pragul de ieșire = 40 + 20 = 60 m.
  let presence = nextPresence(Presence.OUTSIDE, evaluateProximity(location, fixAt(39, 0))).presence;
  assert.equal(presence, Presence.INSIDE);
  const arrivals = [];
  for (const meters of [42, 38, 55, 41, 59, 36, 60]) {
    const step = nextPresence(presence, evaluateProximity(location, fixAt(meters, 0)));
    presence = step.presence;
    arrivals.push(...step.transitions);
  }
  assert.deepEqual(arrivals, []);
  assert.equal(presence, Presence.INSIDE);
  // Peste pragul de ieșire: o singură ieșire.
  const left = nextPresence(presence, evaluateProximity(location, fixAt(61, 0)));
  assert.deepEqual(left.transitions, [Transition.LEFT]);

  // Același histerezis pentru „near”: 150 → ieșire abia peste 170 m.
  let near = nextPresence(Presence.OUTSIDE, evaluateProximity(location, fixAt(140))).presence;
  const nearTransitions = [];
  for (const meters of [155, 145, 165, 149]) {
    const step = nextPresence(near, evaluateProximity(location, fixAt(meters)));
    near = step.presence;
    nearTransitions.push(...step.transitions);
  }
  assert.deepEqual(nearTransitions, []);
  assert.equal(nextPresence(near, evaluateProximity(location, fixAt(171))).presence, Presence.OUTSIDE);
});

test("nextPresence: o observație incertă nu schimbă prezența", () => {
  const uncertain = evaluateProximity(location, fixAt(500, 200));
  assert.deepEqual(nextPresence(Presence.INSIDE, uncertain), { presence: Presence.INSIDE, transitions: [] });
  assert.deepEqual(nextPresence(Presence.OUTSIDE, evaluateProximity(location, fixAt(0, 200))), { presence: Presence.OUTSIDE, transitions: [] });
  assert.equal(nextPresence("valoare-stricata", evaluateProximity(location, fixAt(500))).presence, Presence.OUTSIDE);
});
