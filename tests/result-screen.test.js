// Finalizarea aventurii și ecranul de rezultat (TASK 4, pasul 6).
// Rezultatul este derivat exclusiv din starea motorului (view === "completed"); restartul
// folosește API-ul existent game.reset(). Motor real + model + verificări în sursă, fără DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildViewModel, View, PrimaryAction, StopStatus } from "../src/js/view-model.js";
import { describePlayUi } from "../src/js/play-ui.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const slice = JSON.parse(read("../content/adventures/demo-vertical-slice.json"));
const demoV1 = JSON.parse(read("../content/adventures/brasov-centrul-vechi.json"));
const html = read("../src/index.html").replace(/<!--[\s\S]*?-->/g, "");
const app = read("../src/js/app.js");

function newGame(source = slice, savedState = null) {
  const content = toAdventureV2(source);
  return createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), savedState });
}

const vm = (game) => buildViewModel({ content: game.content, state: game.getState() });

/** Parcurge demo-ul până la ultimul puzzle rezolvat (cu toate indiciile, opțional). */
async function lastPuzzleSolved({ useHints = false } = {}) {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-demo-1");
  game.next();
  if (useHints) { game.requestHint("m-demo-puzzle-1"); game.requestHint("m-demo-puzzle-1"); }
  await game.submitAnswer("omed");
  game.next();
  game.confirmArrival("loc-demo-2");
  game.next();
  if (useHints) game.requestHint("m-demo-puzzle-2");
  await game.submitAnswer("2DEMO");
  return game;
}

/* ---------- Motor + model ---------- */

test("în timpul jocului nu există rezultat: nici la ultimul puzzle rezolvat, înainte de „Vezi rezultatul”", async () => {
  const game = await lastPuzzleSolved();
  const model = vm(game);
  assert.equal(game.getState().status, "playing");
  assert.equal(model.view, View.SOLVED); // ultimul puzzle a schimbat starea motorului, dar jocul nu e încheiat
  assert.equal(game.getState().missions["m-demo-puzzle-2"].status, "solved");
  assert.equal(model.next.kind, "finish");
  assert.equal(model.actions.continue, true);
});

test("game.next() după ultimul puzzle → motorul „completed”; modelul descrie rezultatul", async () => {
  const game = await lastPuzzleSolved();
  game.next();
  const state = game.getState();
  assert.equal(state.status, "completed");
  assert.equal(typeof state.completedAt, "number");
  const model = vm(game);
  assert.equal(model.view, View.COMPLETED);
  assert.equal(model.primaryAction, PrimaryAction.RESTART);
  // Scorul și progresul sunt cele din motor.
  assert.deepEqual(model.summary, { ...game.getSummary(), hintsUsed: 0 });
  assert.deepEqual(model.summary, { score: 350, maxScore: 350, solved: 4, total: 4, hintsUsed: 0 });
  assert.equal(model.summary.score, state.score);
  assert.deepEqual(model.progress.stops.map((s) => s.status), [StopStatus.DONE, StopStatus.DONE]);
});

test("cu toate indiciile folosite, scorul rămâne 350/350 (fără penalizări — D-025)", async () => {
  const game = await lastPuzzleSolved({ useHints: true });
  game.next();
  assert.deepEqual(vm(game).summary, { score: 350, maxScore: 350, solved: 4, total: 4, hintsUsed: 3 });
});

test("la „completed”: niciun obiectiv activ, niciun puzzle, niciun indiciu, overlay închis, nicio acțiune de joc", async () => {
  const game = await lastPuzzleSolved();
  game.next();
  const model = vm(game);
  assert.equal(model.objective, null);
  assert.equal(model.puzzle, null);
  assert.equal(model.mission, null);
  assert.deepEqual(model.actions, { confirmArrival: false, submitAnswer: false, requestHint: false, skip: false, continue: false });
  // Nici o stare efemeră rămasă nu redeschide ceva.
  const ui = describePlayUi(model, { dismissedMissionId: "m-demo-puzzle-2", hintConfirmMissionId: "m-demo-puzzle-2" });
  assert.equal(ui.puzzle.visible, false);
  assert.equal(ui.puzzle.open, false);
  assert.equal(ui.hints.visible, false);
  assert.equal(ui.hints.confirming, false);
  assert.equal(ui.cardAction, null);
});

test("rezultatul nu expune răspunsurile corecte (nici cu conținutul complet)", async () => {
  const game = await lastPuzzleSolved();
  game.next();
  const full = toAdventureV2(slice); // CU răspunsuri
  const text = JSON.stringify([buildViewModel({ content: full, state: game.getState() }), describePlayUi(vm(game))]);
  for (const mission of slice.missions) if (mission.answer) assert.equal(text.includes(mission.answer), false, mission.answer);
});

test("reîncărcare după „completed”: motorul se reconstruiește „completed”, cu același rezultat", async () => {
  const game = await lastPuzzleSolved({ useHints: true });
  game.next();
  const saved = JSON.parse(JSON.stringify(game.getState())); // ce scrie storage.saveGame
  const reloaded = newGame(slice, saved);
  const model = vm(reloaded);
  assert.equal(reloaded.getState().status, "completed");
  assert.equal(model.view, View.COMPLETED);
  assert.deepEqual(model.summary, vm(game).summary);
  assert.equal(model.puzzle, null); // nu reapare ultimul puzzle
  assert.equal(model.objective, null); // nici obiectivul
  assert.equal(describePlayUi(model).hints.visible, false); // nici indiciul
});

test("restart prin API-ul existent (game.reset): modelul revine la început, apoi jocul repornește normal", async () => {
  const game = await lastPuzzleSolved();
  game.next();
  game.reset();
  assert.equal(game.getState().status, "idle");
  const model = vm(game);
  assert.equal(model.view, View.INTRO);
  assert.equal(model.primaryAction, PrimaryAction.START);
  assert.deepEqual(model.summary, { score: 0, maxScore: 350, solved: 0, total: 4, hintsUsed: 0 });
  assert.deepEqual(model.progress.stops.map((s) => s.status), [StopStatus.UPCOMING, StopStatus.UPCOMING]);
  game.start();
  assert.equal(vm(game).view, View.TRAVEL);
  assert.equal(vm(game).objective.locationId, "loc-demo-1");
});

test("V1: finalizarea existentă funcționează la fel (completed → rezultat din summary, restart)", async () => {
  const game = newGame(demoV1);
  game.start();
  for (const answer of ["Brasov", "3", "arici"]) {
    await game.submitAnswer(answer);
    game.next();
  }
  const model = vm(game);
  assert.equal(model.view, View.COMPLETED);
  assert.deepEqual(model.summary, { score: 350, maxScore: 350, solved: 3, total: 3, hintsUsed: 0 });
  game.reset();
  assert.equal(vm(game).view, View.INTRO);
});

/* ---------- Structură și randare (sursă) ---------- */

/** HTML-ul complet al elementului cu id-ul dat. */
function element(id) {
  const open = new RegExp(`<([a-z0-9]+)\\b[^>]*\\bid="${id}"[^>]*>`).exec(html);
  assert.ok(open, `#${id} lipsește`);
  const tag = open[1];
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "g");
  re.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(open.index, m.index + m[0].length);
  }
  throw new Error(`#${id} nu este închis`);
}

const functionBody = (name) => new RegExp(`function ${name}\\(([^)]*)\\) \\{([\\s\\S]*?)\\n  \\}`).exec(app)[2];

test("ecranul de rezultat există, ascuns inițial, separat de ecranul de joc, fără elemente de joc", () => {
  const end = element("screen-end");
  assert.match(end, /^<section\b[^>]*\bhidden\b/);
  for (const id of ["end-title", "end-adventure", "end-score", "end-solved", "end-hints", "btn-replay"]) {
    assert.ok(end.includes(`id="${id}"`), `#${id} lipsește din rezultat`);
  }
  assert.match(element("end-title"), /tabindex="-1"/);
  assert.ok(!element("screen-play").includes('id="screen-end"'));
  for (const id of ["answer-form", "hint-area", "btn-arrived", "puzzle-panel", "objective", "map-panel"]) {
    assert.ok(!end.includes(`id="${id}"`), `#${id} nu are ce căuta în rezultat`);
  }
});

test("rezultatul se alege și se desenează din model (view „completed” + summary), nu din apăsarea unui buton", () => {
  const render = functionBody("render");
  assert.match(render, /viewModel\.view === View\.COMPLETED\) renderEnd\(viewModel\)/);
  const end = functionBody("renderEnd");
  assert.match(end, /viewModel/);
  assert.match(end, /summary\.score/);
  assert.match(end, /summary\.solved/);
  assert.doesNotMatch(end, /game\./); // nicio citire paralelă din motor și nicio modificare
  assert.doesNotMatch(end, /innerHTML/);
  // Nicio stare de UI de tip „completed”.
  const code = app.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /isCompleted|completed\s*=\s*true|showResult\s*=/);
});

test("la „completed”: overlay-ul se închide (inert și blocarea derulării eliminate), focus pe titlul rezultatului", () => {
  const render = functionBody("render");
  assert.match(render, /View\.COMPLETED\) setOverlayOpen\(false\)/);
  assert.ok(render.indexOf("setOverlayOpen(false)") < render.indexOf("renderEnd(viewModel)"));
  const overlay = functionBody("setOverlayOpen");
  assert.match(overlay, /sibling\.inert = open/); // false → inert eliminat de pe tot restul paginii
  assert.match(overlay, /dataset\.overlay = open \? "open" : "closed"/); // „closed” → derularea revine
  assert.match(functionBody("renderEnd"), /\$\("end-title"\)\.focus\(\)/);
});

test("restartul („Joacă din nou”) folosește API-ul existent: game.reset() + ștergerea progresului salvat", () => {
  assert.match(app, /\$\("btn-replay"\)\.addEventListener\("click", resetEverything\)/);
  const reset = functionBody("resetEverything");
  assert.match(reset, /storage\.resetGame\(adventure\.id\)/);
  assert.match(reset, /game\.reset\(\)/);
});
