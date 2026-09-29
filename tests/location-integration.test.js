/*
 * Integrare M-003.1: Browser Geolocation (mock) → location.js → game.reportPosition
 * → geo.js (zone, histerezis) → events.js (reguli) → progres.
 * Folosește fixture-ul fictiv V2 (coordonate lângă 0°, 0°), nu aventura publică.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGame, GameStatus, MissionStatus, LocationStatus } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { assessFix } from "../src/js/geo.js";
import { createLocationTracker, describeLocation, LocationDisplay } from "../src/js/location.js";
import { mockGeolocation, position } from "./helpers/mock-geolocation.js";

const fixture = toAdventureV2(JSON.parse(await readFile(new URL("./fixtures/adventure-v2-demo.json", import.meta.url), "utf8")));
const piata = fixture.locations.find((l) => l.id === "loc-piata").coordinates;

// Poziții de browser (GeolocationPosition) față de „Piața cu ceas”.
const FAR = position(0.02, 0.02, 8);
const NEAR = position(piata.lat, 0.0022, 8); // ~133 m est
const INSIDE = position(piata.lat, piata.lng, 8);
const INSIDE_WEAK = position(piata.lat, piata.lng, 250);

/** Aceeași legătură ca în app.js: fix-ul merge nemodificat în motor, doar în timpul jocului. */
function setup() {
  let clock = 1_000;
  const game = createGame({
    adventure: withoutAnswers(fixture),
    validator: createLocalValidator(fixture),
    now: () => (clock += 1_000),
  });
  const reports = [];
  const geolocation = mockGeolocation();
  const tracker = createLocationTracker({
    geolocation,
    secureContext: true,
    onFix: (fix) => {
      if (game.getState().status !== GameStatus.PLAYING) return;
      reports.push(game.reportPosition(fix));
    },
  });
  let commits = 0;
  game.subscribe(() => (commits += 1));
  const display = () => {
    const s = tracker.getState();
    return describeLocation(s, s.fix ? assessFix(s.fix, fixture.settings.gps) : null);
  };
  return { game, tracker, geolocation, reports, display, commits: () => commits };
}

const messages = (game) => game.takeEffects().filter((e) => e.type === "message").map((e) => e.messageId);

test("outside → near → arrived: tranziția ajunge în motorul de evenimente și în gameplay", () => {
  const { game, tracker, geolocation, reports, display } = setup();
  game.start();
  game.takeEffects();
  tracker.start();

  geolocation.emit(FAR);
  assert.equal(display(), LocationDisplay.READY);
  assert.equal(reports.at(-1).results.find((r) => r.locationId === "loc-piata").zone, "outside");
  assert.equal(game.getState().locations["loc-piata"].presence, "outside");

  geolocation.emit(NEAR);
  assert.equal(game.getState().locations["loc-piata"].presence, "near");
  assert.ok("ev-aproape-piata" in game.getState().firedEvents); // regula player_near_location
  assert.deepEqual(messages(game), ["approaching"]);

  geolocation.emit(INSIDE);
  const state = game.getState();
  assert.equal(state.locations["loc-piata"].presence, "inside");
  assert.equal(state.locations["loc-piata"].arrivalSource, "gps");
  assert.equal(state.locations["loc-piata"].status, LocationStatus.DISCOVERED);
  assert.ok("ev-sosire-piata" in state.firedEvents); // regula player_arrived
  assert.equal(state.missions["m-sosire"].status, MissionStatus.SOLVED); // misiunea „location”
  assert.equal(state.missions["m-ceas"].status, MissionStatus.PENDING); // progresia continuă
  assert.equal(game.getSummary().score, 50);
  assert.deepEqual(messages(game), ["arrived-square"]);
});

test("fix-uri înainte de începerea jocului: afișate, dar netransmise motorului", () => {
  const { game, tracker, geolocation, reports, display } = setup();
  tracker.start();
  geolocation.emit(INSIDE);
  assert.equal(display(), LocationDisplay.READY);
  assert.equal(reports.length, 0);
  assert.equal(game.getState().status, GameStatus.IDLE);
});

test("actualizări duplicate: aceeași poziție nu produce tranziții sau salvări repetate", () => {
  const { game, tracker, geolocation, commits } = setup();
  game.start();
  tracker.start();
  geolocation.emit(INSIDE);
  const after = commits();
  const snapshot = game.getState();
  for (let i = 0; i < 5; i++) geolocation.emit(position(piata.lat, piata.lng, 8, 2_000 + i));
  assert.equal(commits(), after); // nicio schimbare de stare
  assert.deepEqual(game.getState(), snapshot);
});

test("tranziții repetate: plecare și revenire nu dublează sosirea, regulile once sau punctele", () => {
  const { game, tracker, geolocation } = setup();
  game.start();
  tracker.start();
  geolocation.emit(INSIDE);
  const first = game.getState();
  geolocation.emit(FAR); // left
  assert.equal(game.getState().locations["loc-piata"].presence, "outside");
  geolocation.emit(INSIDE); // arrived din nou
  const again = game.getState();
  assert.equal(again.locations["loc-piata"].presence, "inside");
  assert.equal(again.locations["loc-piata"].arrivedAt, first.locations["loc-piata"].arrivedAt);
  assert.equal(again.firedEvents["ev-sosire-piata"], first.firedEvents["ev-sosire-piata"]);
  assert.equal(game.getSummary().score, 50);
});

test("precizie slabă: „uncertain”, nimic declanșat; apoi precizie bună → sosire", () => {
  const { game, tracker, geolocation, reports, display } = setup();
  game.start();
  tracker.start();
  geolocation.emit(INSIDE_WEAK);
  assert.equal(display(), LocationDisplay.UNCERTAIN);
  assert.equal(reports.at(-1).uncertain, true);
  assert.equal(reports.at(-1).reason, "low_accuracy");
  assert.equal(game.getState().locations["loc-piata"].presence, "outside");
  assert.equal(game.getState().missions["m-sosire"].status, MissionStatus.PENDING);

  geolocation.emit(INSIDE);
  assert.equal(display(), LocationDisplay.READY);
  assert.equal(game.getState().missions["m-sosire"].status, MissionStatus.SOLVED);
});

test("fallback manual când GPS-ul este nesigur: același mecanism de sosire (reguli, misiune, scor)", () => {
  const { game, tracker, geolocation } = setup();
  game.start();
  game.takeEffects();
  tracker.start();
  geolocation.emit(INSIDE_WEAK);
  assert.deepEqual(game.confirmArrival("loc-piata"), { accepted: true });
  const state = game.getState();
  assert.equal(state.locations["loc-piata"].arrivalSource, "manual");
  assert.ok("ev-sosire-piata" in state.firedEvents);
  assert.equal(state.missions["m-sosire"].status, MissionStatus.SOLVED);
  assert.deepEqual(messages(game), ["arrived-square"]);
  // Un fix GPS bun ulterior nu mai produce o a doua sosire.
  geolocation.emit(INSIDE);
  assert.equal(game.getState().firedEvents["ev-sosire-piata"], state.firedEvents["ev-sosire-piata"]);
  assert.deepEqual(messages(game), []);
});

test("fallback manual cu permisiune refuzată sau API indisponibil: jocul continuă", () => {
  const denied = setup();
  denied.game.start();
  denied.tracker.start();
  denied.geolocation.fail(1);
  assert.equal(denied.display(), LocationDisplay.PERMISSION_DENIED);
  assert.deepEqual(denied.game.confirmArrival("loc-piata"), { accepted: true });
  assert.equal(denied.game.getState().missions["m-sosire"].status, MissionStatus.SOLVED);

  let clock = 0;
  const game = createGame({ adventure: withoutAnswers(fixture), validator: createLocalValidator(fixture), now: () => ++clock });
  const tracker = createLocationTracker({ geolocation: null, onFix: (fix) => game.reportPosition(fix) });
  game.start();
  assert.equal(tracker.start(), false);
  assert.equal(describeLocation(tracker.getState(), null), LocationDisplay.UNAVAILABLE);
  assert.deepEqual(game.confirmArrival("loc-piata"), { accepted: true });
  assert.equal(game.getState().missions["m-sosire"].status, MissionStatus.SOLVED);
});

test("oprirea urmăririi: pozițiile întârziate nu mai ajung în motor", () => {
  const { game, tracker, geolocation, reports } = setup();
  game.start();
  tracker.start();
  const [watch] = [...geolocation.watches.values()];
  tracker.stop();
  watch.success(INSIDE);
  assert.equal(reports.length, 0);
  assert.equal(game.getState().missions["m-sosire"].status, MissionStatus.PENDING);
});
