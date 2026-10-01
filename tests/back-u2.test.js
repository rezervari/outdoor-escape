// U2 — Back (TASK 4, pasul 7). Fără DOM: un istoric simulat (pushState / go asincron / popstate,
// ca în browser), motorul real și funcțiile de decizie din play-ui.js, legate exact ca în app.js
// (render → syncHistory; popstate → planBack). Plus verificări în sursa app.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { describePlayUi, openLayers, planHistorySync, planBack, Layer } from "../src/js/play-ui.js";
import { buildViewModel } from "../src/js/view-model.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const slice = JSON.parse(read("../content/adventures/demo-vertical-slice.json"));
const demoV1 = JSON.parse(read("../content/adventures/brasov-centrul-vechi.json"));
const app = read("../src/js/app.js");

const URL0 = "http://127.0.0.1:8000/src/?adventure=demo-vertical-slice";

/** Istoric de browser simulat: o singură pagină; go() este asincron și declanșează popstate. */
function createFakeHistory({ entries = [{ state: null, url: URL0 }], index = entries.length - 1 } = {}) {
  const h = {
    entries: entries.map((e) => ({ ...e })),
    index,
    left: false, // Back a ieșit din pagină (navigarea normală a browserului)
    reloads: 0,
    popstates: 0,
    queue: [],
    onpopstate: null,
    get state() { return h.entries[h.index].state; },
    get url() { return h.entries[h.index].url; },
    pushState(state, title, url) {
      assert.equal(url, undefined, "pushState nu primește URL");
      h.entries = h.entries.slice(0, h.index + 1);
      h.entries.push({ state: structuredClone(state), url: h.url });
      h.index += 1;
    },
    go(delta) { h.queue.push(delta); },
    back() { h.go(-1); },
    forward() { h.go(1); },
    /** Rulează traversările în așteptare (ca event loop-ul browserului). */
    flush() {
      let guard = 0;
      while (h.queue.length > 0) {
        assert.ok((guard += 1) < 20, "buclă popstate");
        const target = h.index + h.queue.shift();
        if (target < 0) { h.left = true; continue; }
        if (target >= h.entries.length) continue;
        h.index = target;
        h.popstates += 1;
        h.onpopstate?.();
      }
    },
  };
  return h;
}

/** Orchestrarea din app.js, redusă la starea efemeră + istoric (fără DOM). */
function createHarness(source = slice, { history = createFakeHistory(), savedState = null } = {}) {
  const content = toAdventureV2(source);
  const game = createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), savedState });
  const ui = { dismissedMissionId: null, hintConfirmMissionId: null, focus: null };
  let traversalPending = false;
  const vm = () => buildViewModel({ content: game.content, state: game.getState() });
  const playUi = () => describePlayUi(vm(), { dismissedMissionId: ui.dismissedMissionId, hintConfirmMissionId: ui.hintConfirmMissionId });
  const historyDepth = () => (Number.isInteger(history.state?.oeLayers) ? history.state.oeLayers : 0);

  function syncHistory() {
    if (traversalPending) return;
    const depth = historyDepth();
    const plan = planHistorySync(openLayers(playUi()).length, depth);
    if (!plan) return;
    if (plan.push) for (let i = 1; i <= plan.push; i += 1) history.pushState({ oeLayers: depth + i }, "");
    else { traversalPending = true; history.go(-plan.back); }
  }
  const render = () => syncHistory();
  game.subscribe(render);

  const h = {
    game, ui, history, vm, playUi, render,
    layers: () => openLayers(playUi()),
    openPuzzleFromCard() { ui.dismissedMissionId = null; ui.hintConfirmMissionId = null; game.next(); },
    askHint() { ui.hintConfirmMissionId = vm().mission.id; render(); },
    cancelHintConfirm() { if (ui.hintConfirmMissionId === null) return; ui.hintConfirmMissionId = null; render(); ui.focus = "btn-hint"; },
    confirmHint() { const m = vm(); ui.hintConfirmMissionId = null; game.requestHint(m.puzzle.missionId); },
    closePuzzleOverlay() {
      if (!playUi().puzzle.open) return;
      ui.dismissedMissionId = vm().mission.id; ui.hintConfirmMissionId = null; render(); ui.focus = "btn-objective-action";
    },
    reopenPuzzle() { ui.dismissedMissionId = null; render(); },
    /** Butonul Back al telefonului / browserului. */
    back() { history.back(); history.flush(); },
    settle() { history.flush(); },
  };

  history.onpopstate = () => {
    if (traversalPending) { traversalPending = false; syncHistory(); return; }
    const plan = planBack(h.layers(), historyDepth());
    if (!plan) return;
    if (plan.back) { traversalPending = true; history.go(-plan.back); return; }
    for (const layer of plan.close) {
      if (layer === Layer.HINT_CONFIRM) h.cancelHintConfirm();
      else if (layer === Layer.PUZZLE) h.closePuzzleOverlay();
    }
  };
  render(); // prima desenare (ca la pornirea aplicației)
  h.settle();
  return h;
}

/** Start → „Am ajuns” → „Deschide provocarea” (puzzle-ul 1, overlay deschis). */
function atPuzzle(h = createHarness()) {
  h.game.start();
  h.game.confirmArrival("loc-demo-1");
  h.openPuzzleFromCard();
  h.settle();
  return h;
}

const snapshot = (game) => JSON.stringify(game.getState());

/* ---------- Funcțiile pure ---------- */

test("openLayers / planHistorySync / planBack: ordinea straturilor și planurile", () => {
  const ui = (open, confirming) => ({ puzzle: { open }, hints: { confirming } });
  assert.deepEqual(openLayers(ui(false, false)), []);
  assert.deepEqual(openLayers(ui(true, false)), [Layer.PUZZLE]);
  assert.deepEqual(openLayers(ui(true, true)), [Layer.PUZZLE, Layer.HINT_CONFIRM]);
  assert.deepEqual(openLayers(ui(false, true)), [Layer.HINT_CONFIRM]); // V1: confirmare în pagină
  assert.equal(planHistorySync(0, 0), null);
  assert.deepEqual(planHistorySync(2, 0), { push: 2 });
  assert.deepEqual(planHistorySync(0, 1), { back: 1 });
  assert.deepEqual(planBack([Layer.PUZZLE, Layer.HINT_CONFIRM], 1), { close: [Layer.HINT_CONFIRM] });
  assert.deepEqual(planBack([Layer.PUZZLE, Layer.HINT_CONFIRM], 0), { close: [Layer.HINT_CONFIRM, Layer.PUZZLE] });
  assert.equal(planBack([], 0), null); // fără straturi: nimic de interceptat
  assert.deepEqual(planBack([], 1), { back: 1 }); // Forward spre o intrare fără strat
});

/* ---------- Comportamentul Back ---------- */

test("1. Back cu confirmarea deschisă: închide DOAR confirmarea; hint neconsumat; puzzle activ; focus pe „Arată indiciul”", () => {
  const h = atPuzzle();
  h.askHint();
  assert.deepEqual(h.layers(), [Layer.PUZZLE, Layer.HINT_CONFIRM]);
  const before = snapshot(h.game);
  h.back();
  assert.deepEqual(h.layers(), [Layer.PUZZLE]);
  assert.equal(h.playUi().puzzle.open, true);
  assert.equal(h.playUi().puzzle.showForm, true);
  assert.equal(h.playUi().puzzle.question, "Puzzle de test: scrie cuvântul DEMO citit de la coadă la cap.");
  assert.equal(h.game.getState().missions["m-demo-puzzle-1"].hintsUsed, 0);
  assert.equal(snapshot(h.game), before);
  assert.equal(h.ui.focus, "btn-hint");
  assert.equal(h.history.left, false);
});

test("2. Back cu overlay-ul deschis (fără confirmare): închide overlay-ul; jocul neschimbat; harta rămâne", () => {
  const h = atPuzzle();
  const before = h.game.getState();
  h.back();
  assert.deepEqual(h.layers(), []);
  assert.equal(h.playUi().puzzle.open, false);
  assert.equal(h.playUi().cardAction, "open_puzzle"); // cardul de pe hartă oferă redeschiderea
  assert.notEqual(h.vm().objective, null); // obiectivul (harta) rămâne
  const after = h.game.getState();
  assert.deepEqual(after, before);
  assert.equal(after.missions["m-demo-puzzle-1"].status, "pending");
  assert.equal(after.currentMissionId, "m-demo-puzzle-1");
  assert.equal(after.score, before.score);
  assert.equal(h.history.left, false);
});

test("3. Back nu schimbă URL-ul (confirmare și overlay); pushState fără URL", () => {
  const h = atPuzzle();
  h.askHint();
  const before = h.history.url;
  assert.ok(h.history.entries.every((e) => e.url === URL0));
  h.back();
  assert.equal(h.history.url, before);
  h.back();
  assert.equal(h.history.url, before);
  assert.equal(before, URL0);
});

test("4. Back fără straturi deschise nu este interceptat: nicio intrare adăugată, browserul navighează normal", () => {
  const h = createHarness();
  h.game.start(); // pe hartă, fără overlay
  h.settle();
  assert.equal(h.history.entries.length, 1); // nicio intrare a aplicației
  const before = snapshot(h.game);
  h.back();
  assert.equal(h.history.left, true); // navigarea normală (ieșirea din pagină)
  assert.equal(h.history.popstates, 0); // aplicația nu a primit nimic de închis
  assert.equal(snapshot(h.game), before);
});

test("5. Puzzle → Back → overlay închis → Back → navigarea normală (fără buclă, fără al treilea Back)", () => {
  const h = atPuzzle();
  assert.equal(h.history.entries.length, 2);
  h.back();
  assert.equal(h.playUi().puzzle.open, false);
  assert.equal(h.history.left, false);
  assert.equal(h.history.index, 0);
  h.back();
  assert.equal(h.history.left, true);
  assert.equal(h.history.reloads, 0);
});

test("6. Puzzle → confirmare → Back → Back → puzzle închis → Back → navigarea normală; hint neconsumat", () => {
  const h = atPuzzle();
  h.askHint();
  assert.equal(h.history.entries.length, 3);
  const before = snapshot(h.game);
  h.back();
  assert.deepEqual(h.layers(), [Layer.PUZZLE]);
  h.back();
  assert.deepEqual(h.layers(), []);
  assert.equal(h.history.left, false);
  assert.equal(snapshot(h.game), before);
  h.back();
  assert.equal(h.history.left, true);
});

test("7. După Back, puzzle-ul se redeschide (rămâne activ în motor); Back îl închide din nou", () => {
  const h = atPuzzle();
  h.back();
  h.reopenPuzzle();
  h.settle();
  assert.equal(h.playUi().puzzle.open, true);
  assert.equal(h.playUi().puzzle.showForm, true);
  assert.equal(h.history.entries.length, 2); // o singură intrare (cea veche fusese înlocuită)
  h.back();
  assert.equal(h.playUi().puzzle.open, false);
  h.back();
  assert.equal(h.history.left, true);
});

test("8. Reîncărcare: puzzle activ → overlay restaurat → Back îl închide; jocul neschimbat", () => {
  const first = atPuzzle();
  // Reîncărcarea păstrează intrarea curentă din istoric (cu starea ei) și progresul salvat.
  const history = createFakeHistory({ entries: first.history.entries, index: first.history.index });
  const saved = JSON.parse(JSON.stringify(first.game.getState()));
  const h = createHarness(slice, { history, savedState: saved });
  assert.equal(h.playUi().puzzle.open, true);
  assert.equal(h.history.entries.length, 2); // nicio intrare în plus la reîncărcare
  const before = snapshot(h.game);
  h.back();
  assert.equal(h.playUi().puzzle.open, false);
  assert.equal(snapshot(h.game), before);
  h.back();
  assert.equal(h.history.left, true);
});

test("8b. Reîncărcare cu confirmarea deschisă: confirmarea (efemeră) nu revine; intrarea ei se retrage", () => {
  const first = atPuzzle();
  first.askHint();
  first.settle();
  const history = createFakeHistory({ entries: first.history.entries, index: first.history.index });
  const h = createHarness(slice, { history, savedState: JSON.parse(JSON.stringify(first.game.getState())) });
  assert.deepEqual(h.layers(), [Layer.PUZZLE]);
  assert.equal(h.history.state.oeLayers, 1);
  assert.equal(h.game.getState().missions["m-demo-puzzle-1"].hintsUsed, 0);
  h.back();
  assert.deepEqual(h.layers(), []);
  h.back();
  assert.equal(h.history.left, true);
});

test("Butoanele / Escape închid straturile și își retrag intrările (Back nu trebuie apăsat în plus)", () => {
  const h = atPuzzle();
  h.askHint();
  h.cancelHintConfirm(); // „Renunță”
  h.settle();
  assert.equal(h.history.index, 1);
  h.closePuzzleOverlay(); // „Închide”
  h.settle();
  assert.equal(h.history.index, 0);
  h.back();
  assert.equal(h.history.left, true);
});

test("Confirmarea indiciului + Back: indiciul rămâne consumat, nimic altceva nu se schimbă", () => {
  const h = atPuzzle();
  h.askHint();
  h.confirmHint(); // confirmarea finală (motorul)
  h.settle();
  assert.equal(h.game.getState().missions["m-demo-puzzle-1"].hintsUsed, 1);
  assert.deepEqual(h.layers(), [Layer.PUZZLE]);
  const before = snapshot(h.game);
  h.back();
  assert.equal(h.playUi().puzzle.open, false);
  assert.equal(snapshot(h.game), before);
  h.reopenPuzzle();
  h.settle();
  assert.deepEqual(h.playUi().hints.opened.map((x) => x.index), [0]);
  assert.equal(h.game.getState().missions["m-demo-puzzle-1"].hintsUsed, 1);
});

test("„Continuă” și finalul retrag intrările: după rezultat, Back este navigarea normală", async () => {
  const h = atPuzzle();
  await h.game.submitAnswer("omed");
  h.settle();
  h.ui.dismissedMissionId = null;
  h.game.next(); // „Continuă” → locația 2, fără overlay
  h.settle();
  assert.equal(h.history.index, 0);
  h.game.confirmArrival("loc-demo-2");
  h.openPuzzleFromCard();
  h.settle();
  await h.game.submitAnswer("2DEMO");
  h.game.next(); // „Vezi rezultatul”
  h.settle();
  assert.equal(h.game.getState().status, "completed");
  assert.equal(h.history.index, 0);
  h.back();
  assert.equal(h.history.left, true);
});

test("Forward spre o intrare fără strat este retrasă automat (Back nu trebuie apăsat de două ori)", () => {
  const h = atPuzzle();
  h.back(); // overlay închis, intrarea rămâne „înainte”
  h.history.forward();
  h.history.flush();
  assert.equal(h.playUi().puzzle.open, false); // Forward nu redeschide nimic
  assert.equal(h.history.index, 0);
  h.back();
  assert.equal(h.history.left, true);
});

test("V1: confirmarea indiciului (în pagină) se închide cu Back; fără overlay, Back este navigarea normală", () => {
  const h = createHarness(demoV1, { history: createFakeHistory({ entries: [{ state: null, url: "http://127.0.0.1:8000/src/" }] }) });
  h.game.start();
  h.settle();
  assert.deepEqual(h.layers(), []); // V1 nu are overlay
  assert.equal(h.history.entries.length, 1);
  h.askHint();
  h.settle();
  assert.deepEqual(h.layers(), [Layer.HINT_CONFIRM]);
  const before = snapshot(h.game);
  h.back();
  assert.deepEqual(h.layers(), []);
  assert.equal(h.game.getState().missions["challenge-01"].hintsUsed, 0);
  assert.equal(snapshot(h.game), before);
  h.back();
  assert.equal(h.history.left, true);
});

/* ---------- app.js: legarea mecanismului (verificări în sursă) ---------- */

const code = app.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("app.js: pushState fără URL, fără hash / query / reload; popstate fără preventDefault", () => {
  const pushes = [...code.matchAll(/history\.pushState\(([^;]*)\);/g)].map((m) => m[1]);
  assert.equal(pushes.length, 1);
  assert.match(pushes[0], /^\{ oeLayers: depth \+ i \}, ""$/); // două argumente: URL-ul rămâne cel curent
  assert.doesNotMatch(code, /replaceState|location\.(?:hash|href|assign|replace)\s*[=(]|hashchange/);
  assert.equal((code.match(/location\.reload\(\)/g) || []).length, 1); // doar „Încearcă din nou” (eroare de încărcare)
  const popstate = /window\.addEventListener\("popstate", \(\) => \{([\s\S]*?)\n  \}\);/.exec(code)[1];
  assert.doesNotMatch(popstate, /preventDefault|stopPropagation|pushState|game\./);
  assert.match(popstate, /planBack\(openLayers\(currentPlayUi\(currentViewModel\(\)\)\), historyDepth\(\)\)/);
  assert.ok(popstate.indexOf("cancelHintConfirm") < popstate.indexOf("closePuzzleOverlay"));
});

test("app.js: istoricul se sincronizează după fiecare desenare, din straturile derivate (nu din stare de joc)", () => {
  const render = /function render\(\) \{([\s\S]*?)\n  \}/.exec(code)[1];
  assert.match(render, /syncHistory\(viewModel\)\s*;?\s*$/);
  const sync = /function syncHistory\(viewModel\) \{([\s\S]*?)\n  \}/.exec(code)[1];
  assert.match(sync, /planHistorySync\(openLayers\(currentPlayUi\(viewModel\)\)\.length, depth\)/);
  assert.match(sync, /if \(traversalPending\) return/);
  assert.doesNotMatch(sync, /game\.|storage/);
  // Starea de navigare nu ajunge în stocare.
  assert.doesNotMatch(code, /oeLayers[^;\n]*storage|storage[^;\n]*oeLayers/);
  assert.doesNotMatch(code, /isBackOpen|closedByBack/);
});
