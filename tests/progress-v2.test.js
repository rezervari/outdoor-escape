import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createGame, restoreState, migrateStateV1, createInitialState, maxScore, GameStatus, MissionStatus, LocationStatus } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createStorage } from "../src/js/storage.js";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const fixture = toAdventureV2(await readJson("./fixtures/adventure-v2-demo.json"));
const demoV1 = await readJson("../content/adventures/brasov-centrul-vechi.json");

// Coordonatele fixture-ului (inventate, lângă 0°, 0°).
const at = (locationId, accuracy = 8) => {
  const { lat, lng } = fixture.locations.find((l) => l.id === locationId).coordinates;
  return { lat, lng, accuracy };
};
const FAR = { lat: 0.02, lng: 0.02, accuracy: 8 };

function memoryStorage() {
  const map = new Map();
  return createStorage({ getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) });
}

function newGame(savedState = null, adventure = fixture) {
  let clock = 1_000;
  return createGame({
    adventure: withoutAnswers(adventure),
    validator: createLocalValidator(adventure),
    savedState,
    now: () => (clock += 1_000),
  });
}

const messages = (game) => game.takeEffects().filter((e) => e.type === "message").map((e) => e.messageId);

test("progres V2: forma stării și pornirea", () => {
  const game = newGame();
  const initial = game.getState();
  assert.equal(initial.schemaVersion, 2);
  assert.equal(initial.status, GameStatus.IDLE);
  assert.equal(initial.currentMissionId, null);
  for (const key of ["missions", "locations", "partners", "secrets", "firedEvents"]) assert.equal(typeof initial[key], "object", key);
  assert.equal("currentIndex" in initial, false);

  game.start();
  const state = game.getState();
  assert.equal(state.currentMissionId, "m-sosire");
  assert.equal(state.missions["m-sosire"].status, MissionStatus.PENDING);
  assert.equal(state.missions["m-ceas"].status, MissionStatus.LOCKED);
  assert.equal(state.missions["m-rapid"].status, MissionStatus.LOCKED);
  assert.equal(state.locations["loc-piata"].status, LocationStatus.UNLOCKED);
  assert.equal(state.locations["loc-pasaj"].status, LocationStatus.LOCKED); // fog of war
  assert.ok("ev-start" in state.firedEvents);
  assert.deepEqual(messages(game), ["intro"]); // textul vine din conținut
});

test("GPS prin motor: near → arrival → misiune „location” rezolvată → leave", () => {
  const game = newGame();
  game.start();
  game.takeEffects();

  const far = game.reportPosition(FAR);
  assert.equal(far.uncertain, false);
  assert.deepEqual(far.results.map((r) => r.zone), ["outside"]); // doar locațiile vizibile

  const near = game.reportPosition({ ...at("loc-piata"), lng: 0.0022 });
  assert.equal(near.results.find((r) => r.locationId === "loc-piata").zone, "near");
  assert.deepEqual(messages(game), ["approaching"]);

  game.reportPosition(at("loc-piata"));
  const state = game.getState();
  assert.equal(state.locations["loc-piata"].status, LocationStatus.DISCOVERED);
  assert.equal(state.locations["loc-piata"].arrivalSource, "gps");
  assert.equal(state.missions["m-sosire"].status, MissionStatus.SOLVED);
  assert.equal(state.missions["m-ceas"].status, MissionStatus.PENDING); // progresie liniară
  assert.deepEqual(messages(game), ["arrived-square"]);

  const left = game.reportPosition(FAR);
  assert.equal(game.getState().locations["loc-piata"].presence, "outside");
  assert.equal(left.results.length, 1);
});

test("GPS: precizie slabă → incert, fără schimbări; confirmarea manuală funcționează", () => {
  const game = newGame();
  game.start();
  const before = game.getState();
  const result = game.reportPosition(at("loc-piata", 200));
  assert.equal(result.uncertain, true);
  assert.equal(result.reason, "low_accuracy");
  assert.deepEqual(game.getState(), before);

  assert.deepEqual(game.confirmArrival("loc-piata"), { accepted: true });
  assert.equal(game.getState().locations["loc-piata"].arrivalSource, "manual");
  assert.equal(game.getState().missions["m-sosire"].status, MissionStatus.SOLVED);
  // Jucătorul este deja „inside” (locația mai are misiunea m-ceas, deci nu e încă „completed”).
  assert.deepEqual(game.confirmArrival("loc-piata"), { accepted: false, reason: "already_inside" });
  // O locație încă blocată (inclusiv una ascunsă) nu poate fi confirmată manual.
  assert.deepEqual(game.confirmArrival("loc-pasaj"), { accepted: false, reason: "locked" });
});

test("evenimente duplicate: sosiri repetate nu repetă regulile și nici punctele", () => {
  const game = newGame();
  game.start();
  for (let i = 0; i < 3; i++) {
    game.reportPosition(at("loc-piata"));
    game.reportPosition(FAR);
  }
  const state = game.getState();
  assert.equal(state.missions["m-sosire"].status, MissionStatus.SOLVED);
  assert.equal(game.getSummary().score, 50); // o singură dată
  const arrivalMessages = game.takeEffects().filter((e) => e.messageId === "arrived-square");
  assert.equal(arrivalMessages.length, 1); // regula ev-sosire-piata este „once”
});

test("acțiuni: unlock_location, unlock_mission (bonus), mesaje, regulă repetabilă, partener", async () => {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-piata");
  game.next();
  game.takeEffects();

  assert.equal((await game.submitAnswer("7:00")).result, "incorrect");
  assert.equal((await game.submitAnswer("6:00")).result, "incorrect");
  assert.deepEqual(messages(game), ["wrong-answer", "wrong-answer"]); // once: false

  assert.equal((await game.submitAnswer("7:15")).result, "correct");
  const state = game.getState();
  assert.equal(state.locations["loc-cafenea"].status, LocationStatus.UNLOCKED);
  assert.equal(state.missions["m-rapid"].status, MissionStatus.PENDING); // bonus deblocat prin eveniment
  assert.equal(state.missions["m-contact"].status, MissionStatus.PENDING); // următoarea principală
  assert.deepEqual(messages(game), ["contact-intro"]);

  assert.equal(state.partners["partner-contact"].status, "locked");
  game.next();
  assert.equal(game.getState().partners["partner-contact"].status, "unlocked"); // la mission_started
  assert.ok(game.getProgressSummary().unlockedPartners.includes("partner-contact"));
});

test("trasee separate: bonus și secret nu intră în progresia principală", async () => {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-piata");
  game.next();
  await game.submitAnswer("7:15");
  game.next();

  // Traseul principal nu trece prin misiunile bonus/secret.
  assert.equal(game.getCurrentMission().mission.id, "m-contact");
  assert.equal(game.getCurrentMission().index, 2);
  assert.equal(game.getCurrentMission().total, 4);

  // Misiunea secretă nu poate fi rezolvată cât timp e blocată.
  assert.equal((await game.submitMissionAnswer("m-secret-pasaj", "bufnita")).result, "ignored");
  // Trecerea prin locul ascuns o descoperă.
  game.reportPosition(at("loc-pasaj"));
  const state = game.getState();
  assert.equal(state.locations["loc-pasaj"].status, LocationStatus.DISCOVERED);
  assert.ok(state.secrets["secret-pasaj"]);
  assert.equal(state.missions["m-secret-pasaj"].status, MissionStatus.PENDING);
  assert.equal(game.getCurrentMission().mission.id, "m-contact"); // misiunea curentă nu s-a schimbat
  assert.equal((await game.submitMissionAnswer("m-secret-pasaj", "Bufniță")).result, "correct");

  // Bonusul poate fi sărit fără să afecteze traseul principal.
  game.skipMission("m-rapid");
  assert.equal(game.getState().missions["m-rapid"].status, MissionStatus.SKIPPED);
  assert.equal(game.getCurrentMission().mission.id, "m-contact");
});

test("final complet: award_points, complete_adventure, scor derivat", async () => {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-piata");
  game.next();
  await game.submitAnswer("7:15");
  game.next();
  await game.submitMissionAnswer("m-rapid", "4");
  await game.submitAnswer("ROTITA");
  game.next();
  assert.ok(game.getState().finaleStartedAt !== null); // finale_started la pornirea misiunii finale
  await game.submitAnswer("7:15-rotita");

  const state = game.getState();
  assert.equal(state.status, GameStatus.COMPLETED);
  // 50 + 100 + 100 + 50 (bonus) + 200 + 50 (award_points)
  assert.equal(state.score, 550);
  assert.deepEqual(game.getSummary(), { score: 550, maxScore: maxScore(fixture), solved: 4, total: 4 });
  assert.equal(maxScore(fixture), 50 + 100 + 100 + 50 + 75 + 200 + 25 + 50);
  const progress = game.getProgressSummary();
  assert.deepEqual(progress.completedMissions, ["m-sosire", "m-ceas", "m-contact", "m-rapid", "m-final"]);
  assert.ok(progress.triggeredEvents.includes("ev-final"));
  assert.ok(game.takeEffects().some((e) => e.type === "points" && e.points === 50));
});

test("progres V2: salvare și restaurare după refresh, fără a re-declanșa regulile", async () => {
  const storage = memoryStorage();
  const game = newGame();
  game.subscribe((state) => storage.saveGame(fixture.id, state));
  game.start();
  game.reportPosition(at("loc-piata"));
  game.next();
  game.requestHint();
  game.reportPosition(at("loc-pasaj"));

  const saved = storage.loadGame(fixture.id);
  const restored = newGame(saved);
  const state = restored.getState();
  assert.equal(state.currentMissionId, "m-ceas");
  assert.equal(state.missions["m-ceas"].hintsUsed, 1);
  assert.equal(state.locations["loc-piata"].status, LocationStatus.DISCOVERED);
  assert.ok(state.secrets["secret-pasaj"]);
  assert.equal(state.missions["m-secret-pasaj"].status, MissionStatus.PENDING);
  assert.ok("ev-secret" in state.firedEvents);
  assert.equal(restored.getSummary().score, 50 + 25);

  // După refresh, o nouă trecere prin același loc nu mai declanșează nimic.
  restored.reportPosition(FAR);
  restored.reportPosition(at("loc-pasaj"));
  assert.equal(restored.takeEffects().filter((e) => e.messageId === "secret-found").length, 0);
  assert.equal(restored.getSummary().score, 75);
});

test("restoreState V2: date stricate sau entități eliminate sunt reparate", () => {
  const saved = createInitialState(fixture);
  saved.status = "playing";
  saved.currentMissionId = "misiune-stearsa";
  saved.score = 99999;
  saved.missions["m-sosire"].status = "solved";
  saved.missions["m-ceas"] = { status: "ciudat", attempts: -3, hintsUsed: 99 };
  saved.missions["misiune-stearsa"] = { status: "solved" };
  saved.locations["loc-piata"].presence = "undeva";
  saved.firedEvents["regula-stearsa"] = 1;
  saved.secrets["secret-pasaj"] = { discoveredAt: "ieri" };
  const state = restoreState(fixture, saved);
  assert.equal(state.currentMissionId, "m-ceas"); // prima misiune principală neînchisă
  assert.equal(state.score, 50);
  // Starea necunoscută revine la cea inițială („locked”), apoi progresia liniară o deschide,
  // pentru că este prima misiune principală neînchisă.
  assert.equal(state.missions["m-ceas"].status, "pending");
  assert.equal(state.missions["m-ceas"].attempts, 0);
  assert.equal(state.missions["m-ceas"].hintsUsed, 2); // limitat la numărul real de indicii
  assert.equal("misiune-stearsa" in state.missions, false);
  assert.equal(state.locations["loc-piata"].presence, "outside");
  assert.equal("regula-stearsa" in state.firedEvents, false);
  assert.equal("secret-pasaj" in state.secrets, false);
  assert.equal(restoreState(fixture, { ...saved, schemaVersion: 3 }), null);
});

test("migrare progres V1 → V2: joc în curs, păstrat fără pierderi", () => {
  // Exact forma salvată de motorul V1 (commit-ul anterior), în mijlocul jocului.
  const v1Saved = {
    schemaVersion: 1,
    adventureId: "brasov-centrul-vechi",
    status: "playing",
    currentIndex: 1,
    score: 100,
    challenges: {
      "challenge-01": { status: "solved", attempts: 2, hintUsed: true },
      "challenge-02": { status: "skipped", attempts: 1, hintUsed: false },
      "challenge-03": { status: "pending", attempts: 0, hintUsed: false },
    },
    startedAt: 1790000000000,
    completedAt: null,
  };
  const state = restoreState(demoV1, v1Saved);
  assert.equal(state.schemaVersion, 2);
  assert.equal(state.status, "playing");
  assert.equal(state.currentMissionId, "challenge-02");
  assert.deepEqual(
    Object.fromEntries(Object.entries(state.missions).map(([id, m]) => [id, [m.status, m.attempts, m.hintsUsed]])),
    // challenge-03 era „pending” în V1; după migrare este deschisă (următoarea în progresia liniară).
    { "challenge-01": ["solved", 2, 1], "challenge-02": ["skipped", 1, 0], "challenge-03": ["pending", 0, 0] }
  );
  assert.equal(state.startedAt, 1790000000000);
  assert.equal(state.score, 100);

  // Jocul continuă normal din starea migrată.
  const game = newGame(v1Saved, toAdventureV2(demoV1));
  assert.equal(game.getCurrentChallenge().index, 1);
  assert.equal(game.getCurrentChallenge().progress.status, "skipped");
  game.next();
  assert.equal(game.getCurrentMission().mission.id, "challenge-03");
  assert.equal(game.getCurrentMission().progress.status, "pending");
});

test("migrare progres V1 → V2: stările idle și completed", () => {
  const idle = restoreState(demoV1, { schemaVersion: 1, adventureId: "brasov-centrul-vechi", status: "idle", currentIndex: 0, challenges: {} });
  assert.equal(idle.status, "idle");
  assert.equal(idle.currentMissionId, null);

  const completed = migrateStateV1(demoV1, {
    schemaVersion: 1, adventureId: "brasov-centrul-vechi", status: "completed", currentIndex: 2,
    challenges: { "challenge-01": { status: "solved" }, "challenge-02": { status: "solved" }, "challenge-03": { status: "skipped" } },
    startedAt: 10, completedAt: 20,
  });
  const game = newGame(completed, toAdventureV2(demoV1));
  assert.equal(game.getState().status, "completed");
  assert.deepEqual(game.getSummary(), { score: 200, maxScore: 350, solved: 2, total: 3 });
});

test("motorul nu conține logică specifică unei aventuri", async () => {
  const dir = new URL("../src/js/", import.meta.url);
  for (const file of await readdir(dir)) {
    if (file === "app.js") continue; // app.js alege doar id-ul aventurii implicite
    const source = await readFile(new URL(file, dir), "utf8");
    assert.equal(/bra[sș]ov|centrul-vechi|kronstadt/i.test(source), false, `${file} menționează o aventură anume`);
  }
});
