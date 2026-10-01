// Integrarea view-model.js în aplicație (TASK 4, pasul 2). Fără DOM.
// 1. Orice modul încărcat de app.js este în SHELL_FILES (altfel aplicația nu pornește offline).
// 2. Condițiile pe care app.js le citește acum din modelul interfeței sunt echivalente cu
//    regulile folosite anterior direct în app.js (fără schimbare de comportament).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildViewModel, View } from "../src/js/view-model.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createGame, ChallengeStatus } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const json = (path) => JSON.parse(read(path));

/** Importurile relative ale unui modul din src/js/, fără comentarii. */
function relativeImports(file) {
  const code = read(`../src/js/${file}`).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return [...code.matchAll(/(?:^|\n)\s*import\s[^;]*?from\s+"\.\/([^"]+)"/g)].map((m) => m[1]);
}

test("toate modulele încărcate de app.js (direct sau indirect) sunt în SHELL_FILES din sw.js", () => {
  const seen = new Set();
  const queue = ["app.js"];
  while (queue.length > 0) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    queue.push(...relativeImports(file));
  }
  assert.ok(seen.has("view-model.js"), "app.js trebuie să importe view-model.js");

  const sw = read("../src/sw.js");
  const list = sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/)[1];
  const shell = new Set([...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]));
  for (const file of seen) assert.ok(shell.has(`js/${file}`), `js/${file} lipsește din SHELL_FILES`);
});

/* ---------- Echivalența cu regulile anterioare din app.js ---------- */

function newGame(source) {
  const content = toAdventureV2(source);
  return createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content) });
}

/** Regulile folosite de app.js înainte de pasul 2, calculate direct din motor. */
function previousRules(game) {
  const status = game.getState().status;
  if (status !== "playing") return { status };
  const { mission, progress } = game.getCurrentMission();
  const closed = progress.status !== ChallengeStatus.PENDING;
  const view = mission.locationId ? game.getLocation(mission.locationId) : null;
  const objectiveVisible = Boolean(view && view.progress.status !== "locked");
  const allowManual = objectiveVisible
    && (view.location.fallback?.allowManualConfirmation ?? game.content.settings.gps.allowManualConfirmation);
  return {
    status,
    answerFormVisible: !(closed || mission.type === "location"),
    skipVisible: !closed,
    nextVisible: closed,
    isLast: game.getCurrentMission().isLast,
    objectiveLocationId: objectiveVisible ? mission.locationId : null,
    arrivedVisible: objectiveVisible && !(view.progress.arrivedAt !== null || !allowManual),
  };
}

/** Aceleași valori, citite din modelul interfeței (ca în app.js acum). */
function fromViewModel(game) {
  const vm = buildViewModel({ content: game.content, state: game.getState() });
  if (vm.view === View.INTRO) return { status: "idle" };
  if (vm.view === View.COMPLETED) return { status: "completed" };
  return {
    status: "playing",
    answerFormVisible: vm.actions.submitAnswer,
    skipVisible: vm.actions.skip,
    nextVisible: vm.actions.continue,
    isLast: vm.mission.isLast,
    objectiveLocationId: vm.objective?.locationId ?? null,
    arrivedVisible: vm.actions.confirmArrival,
  };
}

/**
 * Parcurge aventura pe traseul principal, comparând cele două variante după fiecare pas:
 * sosire (dacă e cazul), indiciu, răspuns greșit, răspuns corect sau „sari peste”, next.
 */
async function walk(source, answers) {
  const game = newGame(source);
  const compare = (step) => assert.deepEqual(fromViewModel(game), previousRules(game), `${source.id ?? "?"}: ${step}`);
  compare("idle");
  game.start();
  for (let guard = 0; game.getState().status === "playing" && guard < 50; guard += 1) {
    const { mission } = game.getCurrentMission();
    compare(`${mission.id} deschisă`);
    if (mission.locationId && game.getLocation(mission.locationId).progress.status !== "locked") {
      game.confirmArrival(mission.locationId);
      compare(`${mission.id} după sosire`);
    }
    if (game.getMission(mission.id).progress.status === ChallengeStatus.PENDING) {
      if (mission.hints.length > 0) game.useHint();
      await game.submitAnswer("răspuns-greșit");
      compare(`${mission.id} după indiciu și răspuns greșit`);
      if (answers[mission.id]) await game.submitAnswer(answers[mission.id]);
      else game.skipChallenge();
    }
    compare(`${mission.id} închisă`);
    if (game.getState().status === "playing") game.next();
  }
  compare("final");
  assert.equal(game.getState().status, "completed");
}

const answersOf = (source) => Object.fromEntries((source.missions || source.challenges).filter((m) => m.answer).map((m) => [m.id, m.answer]));

test("echivalență cu regulile anterioare: demo-vertical-slice", async () => {
  const source = json("../content/adventures/demo-vertical-slice.json");
  await walk(source, answersOf(source));
});

test("echivalență cu regulile anterioare: demo-gps-brasov (doar sosiri)", async () => {
  await walk(json("../content/adventures/demo-gps-brasov.json"), {});
});

test("echivalență cu regulile anterioare: aventura V1 implicită (fără locații, cu „sari peste”)", async () => {
  const source = json("../content/adventures/brasov-centrul-vechi.json");
  const answers = answersOf(source);
  delete answers["challenge-02"]; // o misiune sărită
  await walk(source, answers);
});

test("echivalență cu regulile anterioare: fixture-ul V2 complet (evenimente, partener, final prin regulă)", async () => {
  const source = json("./fixtures/adventure-v2-demo.json");
  await walk(source, answersOf(source));
});
