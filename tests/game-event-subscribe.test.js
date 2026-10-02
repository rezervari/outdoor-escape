/*
 * M2 — expunerea aditivă a GameEvent-urilor prin subscribe (D-082, D-085, D-092, D-043).
 *
 * listener(state, events):
 * - state  — instantaneul stării, neschimbat față de contractul anterior;
 * - events — GameEvent-urile tranzacției care a produs commit-ul, în ordinea procesării.
 * O tranzacție = o notificare. Batch-ul este doar runtime: nu se salvează, nu se reia
 * la abonare, la re-randare sau după reîncărcare.
 *
 * Aventura: fixture-ul fictiv tests/fixtures/adventure-v2-demo.json (coordonate lângă 0°, 0°).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGame, createInitialState, GameStatus, MissionStatus } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createStorage, storageKey } from "../src/js/storage.js";
import { buildViewModel } from "../src/js/view-model.js";

const rawFixture = JSON.parse(await readFile(new URL("./fixtures/adventure-v2-demo.json", import.meta.url), "utf8"));
const fixture = toAdventureV2(rawFixture);

const NEAR_PIATA = { lat: 0.001, lng: 0.0022, accuracy: 8 }; // ~133 m de loc-piata: „near”
const FAR = { lat: 0.02, lng: 0.02, accuracy: 8 };
const ARRIVAL_BATCH = ["player_arrived", "location_discovered", "mission_completed", "mission_unlocked"];

const answerOf = (adventure, missionId) => adventure.missions.find((m) => m.id === missionId).answer;
const types = (events) => events.map((e) => e.type);

function newGame({ adventure = fixture, savedState = null } = {}) {
  let clock = 1_000;
  return createGame({
    adventure: withoutAnswers(adventure),
    validator: createLocalValidator(adventure),
    savedState,
    now: () => (clock += 1_000),
  });
}

/** Înregistrează fiecare notificare: { state, events }. */
function record(game) {
  const calls = [];
  game.subscribe((state, events) => calls.push({ state, events }));
  return calls;
}

/** „localStorage” în memorie, care păstrează doar șiruri (ca browserul). */
function memoryBackend() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

function allKeys(value, keys = new Set()) {
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      allKeys(child, keys);
    }
  }
  return keys;
}

/* ---------- Contractul subscribe ---------- */

test("compatibilitate: un listener cu un singur parametru (state) funcționează ca înainte", () => {
  const game = newGame();
  const statuses = [];
  const legacy = (state) => statuses.push(state.status);
  assert.equal(legacy.length, 1);
  game.subscribe(legacy);
  game.start();
  game.confirmArrival("loc-piata");
  game.reset();
  assert.deepEqual(statuses, [GameStatus.PLAYING, GameStatus.PLAYING, GameStatus.IDLE]);
});

test("semnătura nouă (state, events): state este instantaneul stării, events batch-ul tranzacției", () => {
  const game = newGame();
  const calls = record(game);
  game.start();
  assert.equal(calls.length, 1);
  const [{ state, events }] = calls;
  assert.deepEqual(state, game.getState()); // primul argument: neschimbat
  assert.equal("events" in state, false);
  assert.ok(Array.isArray(events));
  assert.deepEqual(events.map((e) => [e.type, e.payload, e.seq, e.cause]), [
    ["adventure_started", {}, 1, "start"],
    ["mission_started", { missionId: "m-sosire", locationId: "loc-piata" }, 2, "start"],
  ]);
  assert.ok(events.every((e) => Number.isFinite(e.at)));
});

test("tranzacție fără evenimente: o notificare, ca înainte, cu events = [] (fără evenimente vechi)", () => {
  const game = newGame();
  game.start();
  const calls = record(game);

  game.reportPosition(NEAR_PIATA);
  game.reportPosition(FAR); // near → outside: se schimbă doar prezența, fără tranziție
  assert.equal(calls.length, 2);
  assert.deepEqual(types(calls[0].events), ["player_near_location"]);
  assert.deepEqual(calls[1].events, []);
  assert.equal(calls[1].state.locations["loc-piata"].presence, "outside");

  // Fără schimbare de stare: niciun commit, deci nicio notificare (comportament existent).
  game.reportPosition(FAR);
  assert.equal(calls.length, 2);

  // reset(): commit fără tranzacție → notificare cu [].
  game.reset();
  assert.equal(calls.length, 3);
  assert.deepEqual(calls[2].events, []);
  assert.equal(calls[2].state.status, GameStatus.IDLE);
});

test("o tranzacție cu lanț E1 → regulă → E2 → regulă → E3: o singură notificare, în ordinea procesării", async () => {
  // Copie fictivă a fixture-ului, cu două reguli în plus care formează un lanț de adâncime 2.
  const raw = structuredClone(rawFixture);
  raw.events.push(
    { id: "ev-test-lant-1", on: "location_completed", where: { locationId: "loc-piata" }, do: [{ action: "unlock_partner", partnerId: "partner-contact" }] },
    { id: "ev-test-lant-2", on: "partner_unlocked", do: [{ action: "discover_secret", secretId: "secret-pasaj" }] }
  );
  const adventure = toAdventureV2(raw);
  const game = newGame({ adventure });
  game.start();
  game.confirmArrival("loc-piata");

  const calls = record(game);
  await game.submitMissionAnswer("m-ceas", answerOf(adventure, "m-ceas"));
  assert.equal(calls.length, 1);

  const { state, events } = calls[0];
  const subject = (p) => p.secretId ?? p.partnerId ?? p.missionId ?? p.locationId;
  assert.deepEqual(events.map((e) => [e.type, subject(e.payload)]), [
    ["mission_completed", "m-ceas"],
    ["mission_unlocked", "m-contact"],
    ["location_unlocked", "loc-cafenea"],
    ["location_completed", "loc-piata"],
    ["mission_unlocked", "m-rapid"], // regula ev-cafenea-deblocata (din mission_completed)
    ["partner_unlocked", "partner-contact"], // ev-test-lant-1 (din location_completed)
    ["secret_discovered", "secret-pasaj"], // ev-test-lant-2 (din partner_unlocked)
  ]);
  // Ordinea primită este ordinea procesării; seq o urmează, fără goluri.
  assert.deepEqual(events.map((e) => e.seq), events.map((_, i) => events[0].seq + i));
  assert.ok(events.every((e) => e.cause === "submit_answer"));
  // Notificarea vine după commit: starea conține deja consecințele întregului lanț.
  assert.ok(state.secrets["secret-pasaj"]);
  assert.equal(state.partners["partner-contact"].status, "unlocked");
});

test("listenerii nu pot modifica GameEvent-urile și nici batch-ul altui listener", () => {
  const game = newGame();
  const seen = [];
  game.subscribe((state, events) => {
    assert.throws(() => { events[1].payload.missionId = "alt"; }, TypeError);
    assert.throws(() => { events[0].type = "alt"; }, TypeError);
    events.push("intrus");
    events.reverse();
  });
  game.subscribe((state, events) => seen.push(events));
  game.start();
  assert.deepEqual(types(seen[0]), ["adventure_started", "mission_started"]);
  assert.equal(seen[0][1].payload.missionId, "m-sosire");
});

/* ---------- D-092: tranzacție ≠ randare ---------- */

test("D-092: batch-ul vine din tranzacție, nu din randare — re-randarea nu relivrează evenimente", () => {
  const game = newGame();
  const calls = record(game);
  const render = () => buildViewModel({ content: game.content, state: game.getState() });

  game.start();
  assert.equal(calls.length, 1);
  render();
  render();
  render();
  game.getProgressSummary();
  game.takeEffects();
  assert.equal(calls.length, 1);

  // O abonare nouă (ex. o interfață recreată) nu primește evenimentele deja livrate.
  const late = record(game);
  render();
  assert.equal(late.length, 0);

  // Abia următoarea tranzacție produce un batch nou, doar cu evenimentele ei.
  game.confirmArrival("loc-piata");
  assert.equal(calls.length, 2);
  assert.equal(late.length, 1);
  assert.deepEqual(types(late[0].events), ARRIVAL_BATCH);
  assert.deepEqual(late[0].events, calls[1].events);
});

/* ---------- Reîncărcare și persistență (D-043) ---------- */

test("reîncărcare: evenimentele vechi nu se reiau; după restaurare vine doar batch-ul nou", () => {
  const backend = memoryBackend();
  // O inițializare a aplicației: storage peste același backend + salvarea automată din app.js.
  const boot = () => {
    const storage = createStorage(backend);
    const game = newGame({ savedState: storage.loadGame(fixture.id) });
    game.subscribe((state) => {
      if (state.status === GameStatus.IDLE) storage.resetGame(fixture.id);
      else storage.saveGame(fixture.id, state);
    });
    return game;
  };

  // Sesiunea 1: pornire + sosire; listenerul primește evenimentele.
  const first = boot();
  const before = record(first);
  first.start();
  first.confirmArrival("loc-piata");
  assert.deepEqual(before.map((c) => types(c.events)), [["adventure_started", "mission_started"], ARRIVAL_BATCH]);

  // „Închiderea paginii”: rămâne doar backend-ul. Sesiunea 2: restaurare + abonare.
  const second = boot();
  const after = record(second);
  assert.equal(second.getState().missions["m-sosire"].status, MissionStatus.SOLVED); // consecințele există
  assert.equal(after.length, 0); // dar evenimentele care le-au produs nu se reiau

  // O acțiune nouă: doar batch-ul ei; seq este ordinea acestei rulări, nu un id persistent.
  second.requestHint("m-ceas");
  assert.equal(after.length, 1);
  assert.deepEqual(after[0].events.map((e) => [e.seq, e.type, e.cause, e.payload]), [
    [1, "hint_requested", "request_hint", { missionId: "m-ceas", locationId: "loc-piata", hintIndex: 0 }],
  ]);
});

test("persistență: starea salvată nu conține GameEvent-uri, events, seq sau cause", async () => {
  const backend = memoryBackend();
  const storage = createStorage(backend);
  const game = newGame();
  const batches = [];
  game.subscribe((state, events) => {
    storage.saveGame(fixture.id, state);
    batches.push(events);
  });

  game.start();
  game.reportPosition(NEAR_PIATA);
  game.confirmArrival("loc-piata");
  await game.submitMissionAnswer("m-ceas", "raspuns-gresit");
  game.requestHint("m-ceas");
  assert.ok(batches.flat().length >= 8);

  const saved = JSON.parse(backend.map.get(storageKey(fixture.id)));
  const keys = allKeys(saved);
  for (const key of ["events", "seq", "cause", "payload"]) assert.equal(keys.has(key), false, key);
  // Forma salvată rămâne cea a stării V2 (aceleași chei de nivel superior).
  assert.deepEqual(Object.keys(saved).sort(), Object.keys(createInitialState(fixture)).sort());
  assert.equal(allKeys(game.getState()).has("events"), false);
});
