import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGame, calculateScore, restoreState, createInitialState, GameStatus, ChallengeStatus } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { createStorage } from "../src/js/storage.js";

const demo = JSON.parse(await readFile(new URL("../content/adventures/brasov-centrul-vechi.json", import.meta.url), "utf8"));

function newGame(savedState = null) {
  let clock = 1000;
  return createGame({
    adventure: withoutAnswers(demo),
    validator: createLocalValidator(demo),
    savedState,
    now: () => (clock += 1000),
  });
}

test("motorul nu primește răspunsurile (D-021)", () => {
  const game = newGame();
  for (const challenge of game.adventure.challenges) assert.equal("answer" in challenge, false);
});

test("calculateScore: suma punctelor provocărilor rezolvate", () => {
  const progress = {
    "challenge-01": { status: ChallengeStatus.SOLVED },
    "challenge-02": { status: ChallengeStatus.SKIPPED },
    "challenge-03": { status: ChallengeStatus.SOLVED },
  };
  assert.equal(calculateScore(demo, progress), 100 + 150);
  assert.equal(calculateScore(demo, {}), 0);
});

test("stare inițială: idle", () => {
  const game = newGame();
  assert.equal(game.getState().status, GameStatus.IDLE);
  assert.equal(game.getCurrentChallenge(), null);
  assert.throws(() => game.next());
});

test("drum normal: start → răspunsuri corecte → completed, scor maxim", async () => {
  const game = newGame();
  const seen = [];
  game.subscribe((state) => seen.push(state.status));

  game.start();
  assert.equal(game.getState().status, GameStatus.PLAYING);
  assert.equal(game.getCurrentChallenge().index, 0);
  assert.equal(game.getCurrentChallenge().total, 3);

  assert.equal((await game.submitAnswer("BRASOV")).result, "correct");
  assert.equal(game.getSummary().score, 100);
  game.next();
  assert.equal((await game.submitAnswer(" 3 ")).result, "correct");
  game.next();
  assert.equal(game.getCurrentChallenge().isLast, true);
  assert.equal((await game.submitAnswer("Arici")).result, "correct");
  game.next();

  const state = game.getState();
  assert.equal(state.status, GameStatus.COMPLETED);
  assert.ok(state.completedAt > state.startedAt);
  assert.deepEqual(game.getSummary(), { score: 350, maxScore: 350, solved: 3, total: 3 });
  assert.ok(seen.includes(GameStatus.COMPLETED));
});

test("răspuns incorect, gol, indiciu, sărire peste provocare", async () => {
  const game = newGame();
  game.start();

  assert.equal((await game.submitAnswer("   ")).result, "empty");
  assert.equal(game.getCurrentChallenge().progress.attempts, 0);

  assert.equal((await game.submitAnswer("Cluj")).result, "incorrect");
  assert.equal(game.getCurrentChallenge().progress.attempts, 1);
  assert.equal(game.getCurrentChallenge().progress.status, ChallengeStatus.PENDING);
  assert.throws(() => game.next()); // nu se poate trece mai departe fără închiderea provocării

  const hint = game.useHint();
  assert.equal(hint, demo.challenges[0].hint);
  assert.equal(game.getCurrentChallenge().progress.hintUsed, true);
  assert.equal(game.getSummary().score, 0); // fără penalizări în această etapă

  assert.equal((await game.submitAnswer("Brașov")).result, "correct");
  assert.equal(game.getCurrentChallenge().progress.attempts, 2);
  assert.equal((await game.submitAnswer("Brașov")).result, "ignored"); // deja rezolvată
  assert.equal(game.getSummary().score, 100);
  game.next();

  game.skipChallenge(); // cale de continuare, 0 puncte
  assert.equal(game.getCurrentChallenge().progress.status, ChallengeStatus.SKIPPED);
  assert.equal((await game.submitAnswer("3")).result, "ignored");
  game.next();

  assert.equal((await game.submitAnswer("arici")).result, "correct");
  game.next();
  assert.deepEqual(game.getSummary(), { score: 250, maxScore: 350, solved: 2, total: 3 });
});

test("dublu submit în timpul verificării este ignorat", async () => {
  let release;
  const slowValidator = {
    check: () => new Promise((resolve) => { release = () => resolve(true); }),
  };
  const game = createGame({ adventure: withoutAnswers(demo), validator: slowValidator });
  game.start();
  const first = game.submitAnswer("brasov");
  assert.equal((await game.submitAnswer("brasov")).result, "ignored");
  release();
  assert.equal((await first).result, "correct");
  assert.equal(game.getCurrentChallenge().progress.attempts, 1);
});

test("refresh: progresul salvat este restaurat (prin storage.js)", async () => {
  const map = new Map();
  const storage = createStorage({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  });
  const game = newGame();
  game.subscribe((state) => storage.saveGame(demo.id, state));
  game.start();
  await game.submitAnswer("brasov");
  game.next();
  game.useHint();

  // „Refresh”: joc nou, din starea salvată.
  const restored = newGame(storage.loadGame(demo.id));
  const current = restored.getCurrentChallenge();
  assert.equal(restored.getState().status, GameStatus.PLAYING);
  assert.equal(current.index, 1);
  assert.equal(current.progress.hintUsed, true);
  assert.equal(restored.getSummary().score, 100);

  // Reset: progresul dispare.
  storage.resetGame(demo.id);
  restored.reset();
  assert.equal(storage.loadGame(demo.id), null);
  assert.equal(restored.getState().status, GameStatus.IDLE);
  assert.equal(newGame(storage.loadGame(demo.id)).getState().status, GameStatus.IDLE);
});

test("restoreState: respinge sau repară stări nepotrivite", () => {
  assert.equal(restoreState(demo, null), null);
  assert.equal(restoreState(demo, { schemaVersion: 99, adventureId: demo.id, status: "playing" }), null);
  assert.equal(restoreState(demo, { schemaVersion: 1, adventureId: "alta", status: "playing" }), null);
  assert.equal(restoreState(demo, { schemaVersion: 1, adventureId: demo.id, status: "ciudat" }), null);

  // Stare salvată în formatul V1 (currentIndex + challenges), migrată la V2 (D-043).
  const saved = {
    schemaVersion: 1,
    adventureId: demo.id,
    status: "playing",
    currentIndex: 42, // în afara listei
    score: 99999, // scorul salvat nu este de încredere
    challenges: {
      "challenge-01": { status: "solved", attempts: 1, hintUsed: false },
      "challenge-02": { status: "pending", attempts: 0, hintUsed: false },
      "challenge-03": { status: "pending", attempts: 0, hintUsed: false },
      "provocare-stearsa": { status: "solved" },
    },
  };
  const state = restoreState(demo, saved);
  assert.equal(state.currentMissionId, "challenge-03"); // indexul 42 este limitat la ultima misiune
  assert.equal(state.score, 100);
  assert.equal("provocare-stearsa" in state.missions, false);
});

test("start după completed pornește un joc nou", async () => {
  const game = newGame();
  game.start();
  game.skipChallenge(); game.next();
  game.skipChallenge(); game.next();
  game.skipChallenge(); game.next();
  assert.equal(game.getState().status, GameStatus.COMPLETED);
  assert.equal(game.getSummary().solved, 0);
  game.start();
  assert.equal(game.getState().status, GameStatus.PLAYING);
  assert.equal(game.getCurrentChallenge().index, 0);
  assert.equal(game.getCurrentChallenge().progress.status, ChallengeStatus.PENDING);
});

test("skipped: 0 puncte, nu este rezolvată, jocul continuă, se păstrează după refresh", async () => {
  const map = new Map();
  const storage = createStorage({
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  });
  const game = newGame();
  game.subscribe((state) => storage.saveGame(demo.id, state));
  game.start();
  await game.submitAnswer("brasov");
  game.next();

  game.skipChallenge();
  assert.equal(game.getCurrentChallenge().progress.status, ChallengeStatus.SKIPPED);
  assert.equal(game.getSummary().score, 100); // 0 puncte pentru provocarea sărită
  assert.equal(game.getSummary().solved, 1); // nu este considerată rezolvată
  game.skipChallenge(); // a doua apăsare nu schimbă nimic
  game.failChallenge(); // nici nu poate fi transformată în failed
  assert.equal(game.getCurrentChallenge().progress.status, ChallengeStatus.SKIPPED);

  // Refresh înainte de „Continuă”: starea skipped este restaurată.
  let restored = newGame(storage.loadGame(demo.id));
  assert.equal(restored.getCurrentChallenge().index, 1);
  assert.equal(restored.getCurrentChallenge().progress.status, ChallengeStatus.SKIPPED);
  assert.equal(restored.getSummary().score, 100);
  restored.subscribe((state) => storage.saveGame(demo.id, state));
  restored.next(); // jocul poate continua

  // Refresh după „Continuă”: provocarea anterioară rămâne skipped.
  restored = newGame(storage.loadGame(demo.id));
  assert.equal(restored.getCurrentChallenge().index, 2);
  assert.equal(restored.getState().missions["challenge-02"].status, ChallengeStatus.SKIPPED);
  await restored.submitAnswer("arici");
  restored.next();
  assert.deepEqual(restored.getSummary(), { score: 250, maxScore: 350, solved: 2, total: 3 });
  assert.equal(restored.getState().status, GameStatus.COMPLETED);
});

test("failed: 0 puncte, închide provocarea, se restaurează, diferit de skipped", async () => {
  const game = newGame();
  game.start();
  await game.submitAnswer("Cluj");
  game.failChallenge();
  const progress = game.getCurrentChallenge().progress;
  assert.equal(progress.status, ChallengeStatus.FAILED);
  assert.equal(progress.attempts, 1);
  assert.equal((await game.submitAnswer("brasov")).result, "ignored");
  game.skipChallenge(); // nu devine skipped
  assert.equal(game.getCurrentChallenge().progress.status, ChallengeStatus.FAILED);
  assert.equal(game.getSummary().score, 0);

  const restored = newGame(game.getState());
  assert.equal(restored.getCurrentChallenge().progress.status, ChallengeStatus.FAILED);
  restored.next();
  assert.equal(restored.getCurrentChallenge().index, 1);
  assert.equal(restored.getSummary().solved, 0);
});

test("calculateScore: doar solved aduce puncte (failed și skipped = 0)", () => {
  const progress = {
    "challenge-01": { status: ChallengeStatus.FAILED },
    "challenge-02": { status: ChallengeStatus.SKIPPED },
    "challenge-03": { status: ChallengeStatus.SOLVED },
  };
  assert.equal(calculateScore(demo, progress), 150);
  assert.deepEqual(Object.values(ChallengeStatus).sort(), ["failed", "pending", "skipped", "solved"]);
});
