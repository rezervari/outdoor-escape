// Raza efectivă: o singură sursă de adevăr (D-049-D, varianta R2) — geo.effectiveRadius,
// folosită de evaluateProximity și expusă de game.getLocation().radiusMeters.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { effectiveRadius, evaluateProximity } from "../src/js/geo.js";
import { DEFAULT_SETTINGS } from "../src/js/defaults.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/adventure-v2-demo.json", import.meta.url), "utf8"));
const fixAt = (lat, lng) => ({ lat, lng, accuracy: 5 });

test("effectiveRadius: raza proprie sau defaultRadius (aceeași regulă ca înainte)", () => {
  const gps = DEFAULT_SETTINGS.gps;
  assert.equal(effectiveRadius({ radius: 25 }, gps), 25);
  assert.equal(effectiveRadius({}, gps), gps.defaultRadius);
  assert.equal(effectiveRadius({ radius: 0 }, gps), gps.defaultRadius);
  assert.equal(effectiveRadius({ radius: -5 }, gps), gps.defaultRadius);
  assert.equal(effectiveRadius({ radius: NaN }, gps), gps.defaultRadius);
  assert.equal(effectiveRadius({}, { ...gps, defaultRadius: 15 }), 15);
  assert.equal(effectiveRadius(null, gps), gps.defaultRadius);
});

test("evaluateProximity folosește exact effectiveRadius", () => {
  const gps = { ...DEFAULT_SETTINGS.gps, defaultRadius: 33 };
  for (const location of [{ coordinates: { lat: 0, lng: 0 } }, { coordinates: { lat: 0, lng: 0 }, radius: 12 }]) {
    assert.equal(evaluateProximity(location, fixAt(0, 0), gps).radiusMeters, effectiveRadius(location, gps));
    assert.equal(evaluateProximity(location, null, gps).radiusMeters, effectiveRadius(location, gps));
  }
});

function gameFor(adventureJson) {
  const adventure = toAdventureV2(adventureJson);
  return { adventure, game: createGame({ adventure: withoutAnswers(adventure), validator: createLocalValidator(adventure) }) };
}

test("game.getLocation().radiusMeters = raza folosită de motor (cu și fără radius în conținut)", () => {
  const json = structuredClone(fixture);
  delete json.locations[0].radius; // fără rază proprie → defaultRadius din settings.gps
  json.settings.gps.defaultRadius = 35;
  const { adventure, game } = gameFor(json);
  for (const location of adventure.locations) {
    const view = game.getLocation(location.id);
    assert.equal(view.radiusMeters, effectiveRadius(location, adventure.settings.gps));
    assert.equal(view.radiusMeters, evaluateProximity(location, fixAt(0, 0), adventure.settings.gps).radiusMeters);
  }
  assert.equal(game.getLocation(adventure.locations[0].id).radiusMeters, 35);
  assert.equal(game.getLocation(adventure.locations[1].id).radiusMeters, adventure.locations[1].radius);
  assert.equal(game.getLocation("nu-exista"), null);
});

test("getLocation păstrează câmpurile existente (location, progress) — adăugare aditivă", () => {
  const { adventure, game } = gameFor(structuredClone(fixture));
  const view = game.getLocation(adventure.locations[0].id);
  assert.deepEqual(Object.keys(view).sort(), ["location", "progress", "radiusMeters"]);
  assert.equal(view.location.id, adventure.locations[0].id);
  assert.equal(typeof view.progress.status, "string");
});
