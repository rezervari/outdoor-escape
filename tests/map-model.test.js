// Teste pentru src/js/map-model.js (M-003.2 — D-048, D-049-B/C/D). Fără Leaflet, fără browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildMapModel, qualityFromDisplay, locationStateFromProgress, MapQuality, MapLocationState } from "../src/js/map-model.js";
import { LocationDisplay } from "../src/js/location.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/adventure-v2-demo.json", import.meta.url), "utf8"));

function view(id, progress, { lat = 45.64, lng = 25.59, radiusMeters = 40, name = `Loc ${id}` } = {}) {
  return { location: { id, name, coordinates: { lat, lng } }, progress, radiusMeters };
}

const fix = { lat: 45.6412, lng: 25.5887, accuracy: 12, timestamp: 1700000000000 };

test("model valid cu jucător și locații (forma D-048)", () => {
  const model = buildMapModel({
    locations: [
      view("a", { status: "unlocked", presence: "outside", arrivedAt: null }),
      view("b", { status: "locked", presence: "outside", arrivedAt: null }),
    ],
    currentObjectiveLocationId: "a",
    locationDisplay: LocationDisplay.READY,
    trackerFix: fix,
  });
  assert.deepEqual(Object.keys(model).sort(), ["currentObjectiveId", "locations", "player"]);
  assert.deepEqual(model.player, { fix: { lat: 45.6412, lng: 25.5887, accuracy: 12, timestamp: 1700000000000 }, quality: "valid" });
  assert.deepEqual(model.locations[0], { id: "a", name: "Loc a", lat: 45.64, lng: 25.59, radius: 40, state: "available", visible: true });
  for (const location of model.locations) {
    assert.deepEqual(Object.keys(location).sort(), ["id", "lat", "lng", "name", "radius", "state", "visible"]);
  }
  assert.equal(model.currentObjectiveId, "a");
});

test("calitatea: gps-ready → valid, gps-uncertain → uncertain (D-049-C)", () => {
  assert.equal(qualityFromDisplay(LocationDisplay.READY), MapQuality.VALID);
  assert.equal(qualityFromDisplay(LocationDisplay.UNCERTAIN), MapQuality.UNCERTAIN);
});

test("calitatea: toate celelalte stări afișate → none", () => {
  for (const display of [LocationDisplay.OFF, LocationDisplay.UNAVAILABLE, LocationDisplay.PERMISSION_DENIED,
    LocationDisplay.SEARCHING, LocationDisplay.ERROR, "necunoscut", null, undefined, "constructor", "__proto__"]) {
    assert.equal(qualityFromDisplay(display), MapQuality.NONE, String(display));
  }
});

test("calitatea: `weak` există în contract, dar nu este produsă de nicio stare M-003.1", () => {
  assert.equal(MapQuality.WEAK, "weak");
  const produced = Object.values(LocationDisplay).map(qualityFromDisplay);
  assert.ok(!produced.includes(MapQuality.WEAK));
  assert.deepEqual([...new Set(produced)].sort(), ["none", "uncertain", "valid"]);
});

test("stările locațiilor: traducere 1:1 din progresul motorului (D-049-B)", () => {
  const s = (progress) => locationStateFromProgress(progress);
  assert.equal(s({ status: "locked", presence: "outside", arrivedAt: null }), MapLocationState.LOCKED);
  assert.equal(s({ status: "unlocked", presence: "outside", arrivedAt: null }), MapLocationState.AVAILABLE);
  assert.equal(s({ status: "unlocked", presence: "near", arrivedAt: null }), MapLocationState.NEAR);
  assert.equal(s({ status: "discovered", presence: "inside", arrivedAt: 5 }), MapLocationState.ARRIVED);
  assert.equal(s({ status: "discovered", presence: "outside", arrivedAt: null }), MapLocationState.ARRIVED); // descoperită prin eveniment
  assert.equal(s({ status: "unlocked", presence: "outside", arrivedAt: 5 }), MapLocationState.ARRIVED);
  assert.equal(s({ status: "completed", presence: "outside", arrivedAt: 5 }), MapLocationState.COMPLETED);
  assert.equal(s(undefined), MapLocationState.LOCKED);
});

test("locație locked → visible: false; locație vizibilă → visible: true", () => {
  const model = buildMapModel({
    locations: [
      view("locked", { status: "locked", presence: "outside", arrivedAt: null }),
      view("open", { status: "unlocked", presence: "near", arrivedAt: null }),
      view("done", { status: "completed", presence: "outside", arrivedAt: 1 }),
    ],
  });
  assert.deepEqual(model.locations.map((l) => [l.id, l.state, l.visible]), [
    ["locked", "locked", false],
    ["open", "near", true],
    ["done", "completed", true],
  ]);
});

test("currentObjectiveId este copiat din misiunea curentă (sau null)", () => {
  assert.equal(buildMapModel({ currentObjectiveLocationId: "x" }).currentObjectiveId, "x");
  assert.equal(buildMapModel({}).currentObjectiveId, null);
  assert.equal(buildMapModel({ currentObjectiveLocationId: undefined }).currentObjectiveId, null);
});

test("radius = radiusMeters primit de la motor, copiat fără valoare implicită", () => {
  const model = buildMapModel({
    locations: [
      view("a", { status: "unlocked" }, { radiusMeters: 27 }),
      { location: { id: "b", name: "B", coordinates: { lat: 1, lng: 2 }, radius: 99 }, progress: { status: "unlocked" } },
    ],
  });
  assert.equal(model.locations[0].radius, 27);
  // Fără radiusMeters de la motor, modelul NU inventează o rază (nici din `location.radius`, nici implicită).
  assert.equal(model.locations[1].radius, null);
});

test("lipsa fix-ului: player.fix = null (calitatea rămâne cea a stării afișate)", () => {
  const model = buildMapModel({ locationDisplay: LocationDisplay.SEARCHING, trackerFix: null });
  assert.deepEqual(model.player, { fix: null, quality: "none" });
});

test("ultima poziție reținută este copiată și când calitatea este none (afișare, nu stare GPS)", () => {
  const model = buildMapModel({ locationDisplay: LocationDisplay.ERROR, trackerFix: fix });
  assert.deepEqual(model.player.fix, fix);
  assert.equal(model.player.quality, "none");
  assert.notEqual(model.player.fix, fix); // copie, nu referința trackerului
});

test("modelul nu calculează distanțe și nu adaugă câmpuri GPS", () => {
  const model = buildMapModel({
    locations: [view("a", { status: "unlocked", presence: "near", arrivedAt: null })],
    locationDisplay: LocationDisplay.READY,
    trackerFix: { ...fix, extra: 1 },
  });
  const json = JSON.stringify(model);
  for (const forbidden of ["distance", "distanceMeters", "zone", "threshold", "presence"]) {
    assert.ok(!json.includes(forbidden), forbidden);
  }
  assert.deepEqual(Object.keys(model.player.fix).sort(), ["accuracy", "lat", "lng", "timestamp"]);
});

test("map-model.js nu importă motorul/GPS-ul și nu conține reguli GPS (verificare în sursă)", () => {
  const source = readFileSync(new URL("../src/js/map-model.js", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.ok(!/\bimport\b/.test(code), "map-model.js trebuie să fie fără importuri");
  // Pragurile/regulile GPS nu apar nici măcar în comentarii.
  for (const token of ["defaultRadius", "maxAccuracy", "nearDistance", "exitMargin", "distanceMeters",
    "evaluateProximity", "assessFix", "navigator", "localStorage"]) {
    assert.ok(!source.includes(token), `map-model.js nu trebuie să conțină „${token}”`);
  }
  // Codul (fără comentarii) nu face referire la modulele motorului și nu face calcule numerice.
  for (const token of ["game.js", "geo.js", "location.js", "Math.", "game.", "geo."]) {
    assert.ok(!code.includes(token), `codul map-model.js nu trebuie să conțină „${token}”`);
  }
});

test("integrare cu motorul: raza și stările vin din game.getLocation (fixture V2)", () => {
  const adventure = toAdventureV2(structuredClone(fixture));
  const game = createGame({ adventure: withoutAnswers(adventure), validator: createLocalValidator(adventure) });
  game.start();
  const views = adventure.locations.map((l) => game.getLocation(l.id));
  const model = buildMapModel({ locations: views });
  for (const [i, location] of model.locations.entries()) {
    assert.equal(location.radius, views[i].radiusMeters);
    assert.equal(location.visible, views[i].progress.status !== "locked");
  }
  // Locația ascunsă (hiddenUntilDiscovered) nu este vizibilă.
  const hidden = adventure.locations.find((l) => l.hiddenUntilDiscovered);
  assert.equal(model.locations.find((l) => l.id === hidden.id).visible, false);
});
