// Teste pentru src/js/view-model.js (TASK 4, pasul 1) și pentru aventura demo-vertical-slice.
// Motorul real este folosit ca sursă a stării; modelul este doar o transformare.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildViewModel, View, PrimaryAction, NextKind, StopStatus } from "../src/js/view-model.js";
import { validateAdventure } from "../src/js/content.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createGame, restoreState } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";

const raw = JSON.parse(readFileSync(new URL("../content/adventures/demo-vertical-slice.json", import.meta.url), "utf8"));
const adventure = toAdventureV2(raw);
const demoV1 = JSON.parse(readFileSync(new URL("../content/adventures/brasov-centrul-vechi.json", import.meta.url), "utf8"));

function newGame(source = adventure, savedState = null) {
  const content = toAdventureV2(source);
  return createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), savedState });
}

const model = (game) => buildViewModel({ content: game.content, state: game.getState() });

/** Joacă până la primul puzzle deschis (sosire la locația 1 + next). */
function atPuzzle1() {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-demo-1");
  game.next();
  return game;
}

/* ---------- Conținutul demo ---------- */

test("demo-vertical-slice: V2 valid, demo, fictiv, 2 locații și 4 misiuni în ordinea fluxului", () => {
  assert.deepEqual(validateAdventure(raw), { valid: true, errors: [] });
  assert.equal(raw.schemaVersion, 2);
  assert.equal(raw.demo, true);
  assert.equal(raw.locations.length, 2);
  for (const location of raw.locations) {
    // Coordonate fictive, lângă 0°, 0° (D-034).
    assert.ok(Math.abs(location.coordinates.lat) < 0.01 && Math.abs(location.coordinates.lng) < 0.01, location.id);
  }
  assert.deepEqual(
    raw.missions.map((m) => [m.type, m.locationId, m.track]),
    [
      ["location", "loc-demo-1", "main"],
      ["riddle", "loc-demo-1", "main"],
      ["location", "loc-demo-2", "main"],
      ["code", "loc-demo-2", "main"],
    ]
  );
  for (const puzzle of raw.missions.filter((m) => m.type !== "location")) {
    assert.ok(puzzle.briefing && puzzle.answer && puzzle.hints.length >= 1, puzzle.id);
  }
});

test("demo-vertical-slice: se poate parcurge cap-coadă doar prin API-ul motorului", async () => {
  const game = atPuzzle1();
  assert.equal(game.useHint(), "Citește literele de la dreapta la stânga.");
  assert.deepEqual(await game.submitAnswer("greșit"), { result: "incorrect" });
  assert.deepEqual(await game.submitAnswer("  OMED "), { result: "correct" });
  game.next();
  game.confirmArrival("loc-demo-2");
  game.next();
  assert.deepEqual(await game.submitAnswer("2demo"), { result: "correct" });
  game.next();
  assert.equal(game.getState().status, "completed");
  assert.deepEqual(game.getSummary(), { score: 350, maxScore: 350, solved: 4, total: 4 });
});

/* ---------- Modelul: stările de început și de sfârșit ---------- */

test("idle → intro, acțiunea principală este start, fără obiectiv și fără puzzle", () => {
  const m = model(newGame());
  assert.equal(m.view, View.INTRO);
  assert.equal(m.primaryAction, PrimaryAction.START);
  assert.equal(m.objective, null);
  assert.equal(m.puzzle, null);
  assert.equal(m.summary.total, 4);
  // Locația 2 este încă blocată: numele nu este expus în progres.
  assert.deepEqual(m.progress.stops.map((s) => s.name), ["[DEMO] Punctul A", null]);
});

/* ---------- A. Înainte de sosire ---------- */

test("A. înainte de sosire: locația curentă, neajuns, „Am ajuns” disponibil, puzzle-ul nu este activ", () => {
  const game = newGame();
  game.start();
  const m = model(game);
  assert.equal(m.view, View.TRAVEL);
  assert.equal(m.mission.id, "m-demo-sosire-1");
  assert.equal(m.objective.locationId, "loc-demo-1");
  assert.equal(m.objective.name, "[DEMO] Punctul A");
  assert.equal(m.objective.type, "start");
  assert.deepEqual(m.objective.coordinates, { lat: 0.001, lng: 0.001 });
  assert.equal(m.objective.arrived, false);
  assert.equal(m.objective.presence, "outside");
  assert.equal(m.actions.confirmArrival, true);
  assert.equal(m.primaryAction, PrimaryAction.CONFIRM_ARRIVAL);
  // Puzzle-ul următor nu este prezentat ca activ.
  assert.equal(m.puzzle, null);
  assert.equal(m.actions.submitAnswer, false);
  assert.equal(m.actions.requestHint, false);
  assert.equal(m.actions.continue, false);
  assert.equal(m.next.available, false);
  assert.deepEqual(m.progress.stops.map((s) => s.status), [StopStatus.CURRENT, StopStatus.UPCOMING]);
});

test("A. „Am ajuns” nu este oferit când aventura interzice confirmarea manuală", () => {
  const strict = structuredClone(raw);
  strict.settings.gps.allowManualConfirmation = false;
  for (const location of strict.locations) delete location.fallback.allowManualConfirmation;
  const game = newGame(strict);
  game.start();
  const m = model(game);
  assert.equal(m.objective.manualConfirmationAllowed, false);
  assert.equal(m.actions.confirmArrival, false);
  assert.equal(m.primaryAction, null); // se așteaptă GPS-ul
});

/* ---------- B. După sosire ---------- */

test("B. după sosire: locația atinsă, puzzle-ul următor disponibil, acțiunea este „continuă”", () => {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-demo-1");
  const m = model(game);
  assert.equal(m.view, View.ARRIVED);
  assert.equal(m.mission.status, "solved");
  assert.equal(m.objective.arrived, true);
  assert.equal(m.objective.arrivalSource, "manual");
  assert.equal(m.objective.status, "discovered");
  assert.equal(m.actions.confirmArrival, false);
  assert.deepEqual(m.next, { kind: NextKind.OPEN_PUZZLE, missionId: "m-demo-puzzle-1", locationId: "loc-demo-1", available: true });
  assert.equal(m.actions.continue, true);
  assert.equal(m.primaryAction, PrimaryAction.CONTINUE);
  assert.equal(m.puzzle, null); // puzzle-ul devine curent abia după game.next()
});

test("B. sosirea prin GPS (reportPosition) produce același model, cu sursa „gps”", () => {
  const game = newGame();
  game.start();
  game.reportPosition({ lat: 0.001, lng: 0.001, accuracy: 5 });
  const m = model(game);
  assert.equal(m.view, View.ARRIVED);
  assert.equal(m.objective.arrivalSource, "gps");
  assert.equal(m.objective.presence, "inside");
});

/* ---------- C. Puzzle disponibil ---------- */

test("C. puzzle disponibil: întrebarea, nerezolvat, indicii existente, niciun indiciu deschis", () => {
  const m = model(atPuzzle1());
  assert.equal(m.view, View.PUZZLE);
  assert.equal(m.puzzle.missionId, "m-demo-puzzle-1");
  assert.equal(m.puzzle.question, "Puzzle de test: scrie cuvântul DEMO citit de la coadă la cap.");
  assert.equal(m.puzzle.available, true);
  assert.equal(m.puzzle.solved, false);
  assert.equal(m.puzzle.closed, false);
  assert.deepEqual(
    { total: m.puzzle.hints.total, used: m.puzzle.hints.used, remaining: m.puzzle.hints.remaining, opened: m.puzzle.hints.opened },
    { total: 2, used: 0, remaining: 2, opened: [] }
  );
  assert.equal(m.actions.submitAnswer, true);
  assert.equal(m.actions.requestHint, true);
  assert.equal(m.primaryAction, PrimaryAction.SUBMIT_ANSWER);
  assert.equal(m.objective.arrived, true); // puzzle-ul este la locația deja atinsă
  assert.equal(m.actions.confirmArrival, false);
});

test("C. răspunsul nu apare niciodată în model (nici dacă UI-ul primește conținutul complet)", async () => {
  const game = atPuzzle1();
  const answers = raw.missions.filter((m) => m.answer).map((m) => m.answer);
  const check = (m) => {
    const json = JSON.stringify(m);
    assert.equal(json.includes("\"answer\""), false);
    for (const answer of answers) assert.equal(json.includes(answer), false, answer);
  };
  check(buildViewModel({ content: adventure, state: game.getState() })); // conținut CU răspunsuri
  await game.submitAnswer("omed");
  check(buildViewModel({ content: adventure, state: game.getState() }));
});

/* ---------- D. Indiciu deschis ---------- */

test("D. indiciu deschis: marcat deschis, nu mai este oferit ca nedeschis (D-030)", () => {
  const game = atPuzzle1();
  game.useHint();
  let m = model(game);
  assert.deepEqual(m.puzzle.hints.opened, [{ index: 0, text: "Citește literele de la dreapta la stânga." }]);
  assert.equal(m.puzzle.hints.used, 1);
  assert.equal(m.puzzle.hints.remaining, 1);
  assert.equal(m.puzzle.status, "pending"); // misiunea rămâne activă, nu există stare HINT_USED
  assert.equal(m.view, View.PUZZLE);
  assert.equal(m.actions.requestHint, true);

  game.useHint();
  m = model(game);
  assert.deepEqual(m.puzzle.hints.opened.map((h) => h.index), [0, 1]);
  assert.equal(m.puzzle.hints.remaining, 0);
  assert.equal(m.puzzle.hints.canRequest, false);
  assert.equal(m.actions.requestHint, false);

  // Ireversibil: încă o cerere nu schimbă nimic, indiciile rămân deschise.
  game.useHint();
  assert.deepEqual(model(game).puzzle.hints, m.puzzle.hints);
  assert.equal(m.summary.hintsUsed, 2);
});

test("D. indiciile deschise se păstrează după reîncărcare (starea salvată → restoreState)", () => {
  const game = atPuzzle1();
  game.useHint();
  const reloaded = newGame(adventure, JSON.parse(JSON.stringify(game.getState())));
  assert.deepEqual(model(reloaded), model(game));
  assert.notEqual(restoreState(adventure, game.getState()), null);
});

/* ---------- E. Puzzle rezolvat ---------- */

test("E. puzzle rezolvat: marcat rezolvat, nu mai este activ, motorul poate continua", async () => {
  const game = atPuzzle1();
  game.useHint();
  await game.submitAnswer("omed");
  const m = model(game);
  assert.equal(m.view, View.SOLVED);
  assert.equal(m.puzzle.solved, true);
  assert.equal(m.puzzle.closed, true);
  assert.equal(m.puzzle.available, false);
  assert.equal(m.actions.submitAnswer, false);
  assert.equal(m.actions.requestHint, false);
  assert.equal(m.actions.skip, false);
  assert.equal(m.puzzle.hints.opened.length, 1); // indiciul folosit rămâne vizibil
  assert.deepEqual(m.next, { kind: NextKind.GO_TO_LOCATION, missionId: "m-demo-sosire-2", locationId: "loc-demo-2", available: true });
  assert.equal(m.primaryAction, PrimaryAction.CONTINUE);
  assert.equal(m.summary.score, 150);
  assert.doesNotThrow(() => game.next());
});

test("E. răspuns greșit: puzzle-ul rămâne activ, încercările cresc", async () => {
  const game = atPuzzle1();
  await game.submitAnswer("nu");
  const m = model(game);
  assert.equal(m.view, View.PUZZLE);
  assert.equal(m.puzzle.available, true);
  assert.equal(m.puzzle.attempts, 1);
});

/* ---------- F. Tranziția către locația 2 ---------- */

test("F. după primul puzzle: modelul descrie locația 2, apoi al doilea puzzle și finalul", async () => {
  const game = atPuzzle1();
  await game.submitAnswer("omed");
  game.next();

  let m = model(game);
  assert.equal(m.view, View.TRAVEL);
  assert.equal(m.mission.id, "m-demo-sosire-2");
  assert.equal(m.objective.locationId, "loc-demo-2");
  assert.equal(m.objective.name, "[DEMO] Punctul B");
  assert.deepEqual(m.objective.coordinates, { lat: 0.002, lng: 0.0015 });
  assert.equal(m.objective.arrived, false);
  assert.equal(m.primaryAction, PrimaryAction.CONFIRM_ARRIVAL);
  assert.equal(m.puzzle, null);
  assert.deepEqual(m.progress.stops, [
    { locationId: "loc-demo-1", name: "[DEMO] Punctul A", status: StopStatus.DONE },
    { locationId: "loc-demo-2", name: "[DEMO] Punctul B", status: StopStatus.CURRENT },
  ]);

  game.confirmArrival("loc-demo-2");
  game.next();
  m = model(game);
  assert.equal(m.view, View.PUZZLE);
  assert.equal(m.puzzle.missionId, "m-demo-puzzle-2");
  assert.equal(m.puzzle.hints.total, 1);
  assert.equal(m.mission.isLast, true);

  await game.submitAnswer("2DEMO");
  m = model(game);
  assert.equal(m.view, View.SOLVED);
  assert.deepEqual(m.next, { kind: NextKind.FINISH, missionId: null, locationId: null, available: true });

  game.next();
  m = model(game);
  assert.equal(m.view, View.COMPLETED);
  assert.equal(m.primaryAction, PrimaryAction.RESTART);
  assert.deepEqual(m.summary, { score: 350, maxScore: 350, solved: 4, total: 4, hintsUsed: 0 });
  assert.deepEqual(m.progress.stops.map((s) => s.status), [StopStatus.DONE, StopStatus.DONE]);
});

/* ---------- Alte cazuri ---------- */

test("misiune sărită: vizualizarea „solved”, puzzle nerezolvat, se poate continua", () => {
  const game = atPuzzle1();
  game.skipChallenge();
  const m = model(game);
  assert.equal(m.view, View.SOLVED);
  assert.equal(m.puzzle.status, "skipped");
  assert.equal(m.puzzle.solved, false);
  assert.equal(m.puzzle.closed, true);
  assert.equal(m.actions.continue, true);
});

test("aventură V1 fără locații: puzzle direct, fără obiectiv și fără opriri", () => {
  const game = newGame(demoV1);
  game.start();
  const m = model(game);
  assert.equal(m.view, View.PUZZLE);
  assert.equal(m.objective, null);
  assert.deepEqual(m.progress.stops, []);
  assert.equal(m.puzzle.hints.total, 1);
  assert.equal(m.actions.confirmArrival, false);
});

test("modelul este o funcție pură: nu modifică intrarea, același input → același output", () => {
  const game = atPuzzle1();
  const content = game.content;
  const state = game.getState();
  const before = JSON.stringify({ content, state });
  const first = buildViewModel({ content, state });
  assert.equal(JSON.stringify({ content, state }), before);
  assert.deepEqual(buildViewModel({ content, state }), first);
  // Modelul nu este legat de starea motorului: o schimbare ulterioară nu îl atinge.
  game.useHint();
  assert.equal(first.puzzle.hints.used, 0);
});

test("view-model.js nu atinge DOM-ul, stocarea, GPS-ul sau navigarea (verificare în sursă)", () => {
  const source = readFileSync(new URL("../src/js/view-model.js", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const token of ["window", "document", "localStorage", "sessionStorage", "navigator", "history", "location.href",
    "innerHTML", "fetch(", "reportPosition", "confirmArrival(", "submitAnswer(", "useHint(", "requestHint(", ".next(", "setTimeout"]) {
    assert.ok(!code.includes(token), `codul view-model.js nu trebuie să conțină „${token}”`);
  }
  // Importă doar definiții pure ale motorului și schemei.
  const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["./game.js", "./schema.js"]);
});
