// Teste pentru src/js/play-ui.js (TASK 4, pasul 4): panoul puzzle-ului și acțiunea cardului,
// derivate din modelul interfeței, cu motorul real ca sursă a stării. Fără DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { describePlayUi, CardAction } from "../src/js/play-ui.js";
import { buildViewModel, View } from "../src/js/view-model.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));
const slice = json("../content/adventures/demo-vertical-slice.json");
const demoV1 = json("../content/adventures/brasov-centrul-vechi.json");

function newGame(source = slice) {
  const content = toAdventureV2(source);
  return createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content) });
}

const vm = (game) => buildViewModel({ content: game.content, state: game.getState() });
const ui = (game, dismissedMissionId = null) => describePlayUi(vm(game), { dismissedMissionId });

/** Start → „Am ajuns” la locația 1. */
function arrived() {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-demo-1");
  return game;
}

test("înainte de sosire: niciun puzzle, nicio acțiune în card în afară de „Am ajuns”", () => {
  const game = newGame();
  game.start();
  const u = ui(game);
  assert.equal(u.puzzle.visible, false);
  assert.equal(u.puzzle.open, false);
  assert.equal(u.cardAction, null);
});

test("după sosire: cardul oferă accesul la provocare (game.next), fără ca overlay-ul să fie deja deschis", () => {
  const game = arrived();
  const u = ui(game);
  assert.equal(vm(game).view, View.ARRIVED);
  assert.equal(u.cardAction, CardAction.CONTINUE);
  assert.equal(u.nextKind, "open_puzzle");
  assert.equal(u.puzzle.visible, false);
});

test("după „Deschide provocarea”: overlay deschis peste hartă, cu titlul, locația și întrebarea", () => {
  const game = arrived();
  game.next(); // ce face acțiunea cardului
  const u = ui(game);
  assert.equal(u.puzzle.visible, true);
  assert.equal(u.puzzle.mode, "overlay");
  assert.equal(u.puzzle.open, true);
  assert.equal(u.puzzle.title, "[DEMO] Cuvântul întors");
  assert.equal(u.puzzle.question, "Puzzle de test: scrie cuvântul DEMO citit de la coadă la cap.");
  assert.equal(u.puzzle.locationName, "[DEMO] Punctul A");
  assert.equal(u.puzzle.showForm, true);
  assert.equal(u.puzzle.showContinue, false);
  assert.equal(u.cardAction, null); // cardul e acoperit de overlay
});

test("răspunsul corect nu apare în descrierea panoului (nici cu conținutul complet)", async () => {
  const game = arrived();
  game.next();
  const answers = slice.missions.filter((m) => m.answer).map((m) => m.answer);
  const full = toAdventureV2(slice); // CU răspunsuri
  const check = () => {
    const text = JSON.stringify(describePlayUi(buildViewModel({ content: full, state: game.getState() })));
    for (const answer of answers) assert.equal(text.includes(answer), false, answer);
  };
  check();
  await game.submitAnswer("omed");
  check();
});

test("răspuns greșit: puzzle-ul rămâne activ și deschis, misiunea nu avansează", async () => {
  const game = arrived();
  game.next();
  assert.deepEqual(await game.submitAnswer("greșit"), { result: "incorrect" });
  const u = ui(game);
  assert.equal(u.puzzle.open, true);
  assert.equal(u.puzzle.showForm, true);
  assert.equal(u.puzzle.showContinue, false);
  assert.equal(u.puzzle.status, "pending");
  assert.equal(game.getState().currentMissionId, "m-demo-puzzle-1");
  assert.equal(game.getState().missions["m-demo-puzzle-1"].attempts, 1);
});

test("răspuns corect: starea vine din motor; formularul dispare, „Continuă” apare în panou", async () => {
  const game = arrived();
  game.next();
  assert.deepEqual(await game.submitAnswer("OMED"), { result: "correct" });
  assert.equal(game.getState().missions["m-demo-puzzle-1"].status, "solved");
  const u = ui(game);
  assert.equal(u.puzzle.open, true);
  assert.equal(u.puzzle.solved, true);
  assert.equal(u.puzzle.showForm, false);
  assert.equal(u.puzzle.showContinue, vm(game).actions.continue);
  assert.equal(u.puzzle.showContinue, true);
  assert.equal(u.nextKind, "go_to_location");
  assert.equal(u.isFinish, false);
});

test("„Continuă” urmează modelul: după game.next() overlay-ul dispare și cardul arată locația 2", async () => {
  const game = arrived();
  game.next();
  await game.submitAnswer("omed");
  game.next();
  const model = vm(game);
  const u = describePlayUi(model);
  assert.equal(model.view, View.TRAVEL);
  assert.equal(model.objective.name, "[DEMO] Punctul B");
  assert.equal(u.puzzle.visible, false);
  assert.equal(u.puzzle.open, false);
});

test("ultimul puzzle rezolvat: „Continuă” duce la final (isFinish)", async () => {
  const game = arrived();
  game.next();
  await game.submitAnswer("omed");
  game.next();
  game.confirmArrival("loc-demo-2");
  game.next();
  await game.submitAnswer("2DEMO");
  const u = ui(game);
  assert.equal(u.puzzle.showContinue, true);
  assert.equal(u.isFinish, true);
  game.next();
  assert.equal(vm(game).view, View.COMPLETED);
});

test("„Închide” (stare efemeră): overlay ascuns, motorul neschimbat, cardul permite redeschiderea", async () => {
  const game = arrived();
  game.next();
  const before = game.getState();
  const closed = ui(game, "m-demo-puzzle-1");
  assert.equal(closed.puzzle.visible, false);
  assert.equal(closed.puzzle.open, false);
  assert.equal(closed.cardAction, CardAction.OPEN_PUZZLE);
  assert.deepEqual(game.getState(), before); // închiderea nu atinge jocul
  // Redeschidere = dismissedMissionId null.
  assert.equal(ui(game, null).puzzle.open, true);
  // Închis după rezolvare: cardul oferă direct „Continuă”.
  await game.submitAnswer("omed");
  assert.equal(ui(game, "m-demo-puzzle-1").cardAction, CardAction.CONTINUE);
  // O închidere veche (altă misiune) nu ascunde puzzle-ul curent.
  assert.equal(ui(game, "m-demo-sosire-1").puzzle.open, true);
});

test("aventură V1 fără locații: puzzle-ul rămâne în pagină (fără overlay, fără acțiune în card)", () => {
  const game = newGame(demoV1);
  game.start();
  const u = ui(game, "challenge-01"); // nici o închidere nu se aplică în pagină
  assert.equal(u.puzzle.visible, true);
  assert.equal(u.puzzle.mode, "inline");
  assert.equal(u.puzzle.open, false);
  assert.equal(u.puzzle.locationName, null);
  assert.equal(u.cardAction, null);
});

test("play-ui.js este pur: fără DOM, stocare, navigare sau apeluri în motor (verificare în sursă)", () => {
  const source = readFileSync(new URL("../src/js/play-ui.js", import.meta.url), "utf8");
  const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  for (const token of ["window", "document", "localStorage", "navigator", "history", "game.", "innerHTML", "setTimeout"]) {
    assert.ok(!code.includes(token), `codul play-ui.js nu trebuie să conțină „${token}”`);
  }
  const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["./view-model.js"]);
});

/* ---------- Indicii în panoul puzzle-ului (TASK 4, pasul 5 — D-030) ---------- */

/** Puzzle-ul 1 deschis (2 indicii). */
function atPuzzle1() {
  const game = arrived();
  game.next();
  return game;
}

const hintsOf = (game, options = {}) => describePlayUi(vm(game), options).hints;

test("indicii: puzzle fără indicii → zona nu apare și nu se poate cere nimic", () => {
  const noHints = structuredClone(slice);
  delete noHints.missions.find((m) => m.id === "m-demo-puzzle-1").hints;
  const game = newGame(noHints);
  game.start();
  game.confirmArrival("loc-demo-1");
  game.next();
  const hints = hintsOf(game, { hintConfirmMissionId: "m-demo-puzzle-1" });
  assert.equal(hints.visible, false);
  assert.equal(hints.total, 0);
  assert.equal(hints.canRequest, false);
  assert.equal(hints.confirming, false); // nici confirmarea nu poate apărea
});

test("indicii: puzzle cu 2 indicii → disponibilitatea vine din motor; nimic înainte de puzzle", () => {
  const hints = hintsOf(atPuzzle1());
  assert.deepEqual(
    { visible: hints.visible, total: hints.total, used: hints.used, remaining: hints.remaining, canRequest: hints.canRequest, nextNumber: hints.nextNumber, opened: hints.opened },
    { visible: true, total: 2, used: 0, remaining: 2, canRequest: true, nextNumber: 1, opened: [] }
  );
  const travel = newGame();
  travel.start();
  assert.equal(hintsOf(travel).visible, false);
  assert.equal(hintsOf(arrived()).visible, false);
});

test("D-030: confirmarea (stare efemeră) nu modifică motorul și nu consumă indiciul", () => {
  const game = atPuzzle1();
  const before = game.getState();
  const confirming = hintsOf(game, { hintConfirmMissionId: "m-demo-puzzle-1" });
  assert.equal(confirming.confirming, true);
  assert.equal(confirming.used, 0);
  assert.equal(confirming.opened.length, 0);
  assert.deepEqual(game.getState(), before);
  // „Renunță” = confirmarea dispare; motorul rămâne identic.
  assert.equal(hintsOf(game).confirming, false);
  assert.deepEqual(game.getState(), before);
  // O confirmare rămasă pentru altă misiune nu se aplică.
  assert.equal(hintsOf(game, { hintConfirmMissionId: "m-demo-sosire-1" }).confirming, false);
});

test("D-030: confirmarea finală (requestHint) consumă exact un indiciu, care devine vizibil", () => {
  const game = atPuzzle1();
  const counts = [];
  game.subscribe((state) => counts.push(state.missions["m-demo-puzzle-1"].hintsUsed));
  game.requestHint("m-demo-puzzle-1"); // ce face butonul de confirmare
  assert.deepEqual(counts, [1]);
  const hints = hintsOf(game);
  assert.equal(hints.used, 1);
  assert.equal(hints.remaining, 1);
  assert.deepEqual(hints.opened, [{ index: 0, text: "Citește literele de la dreapta la stânga." }]);
  assert.equal(hints.nextNumber, 2);
  assert.equal(game.getState().missions["m-demo-puzzle-1"].status, "pending"); // misiunea rămâne activă
  assert.equal(describePlayUi(vm(game)).puzzle.showForm, true); // formularul rămâne
});

test("indicii: al doilea se deschide, apoi nu mai există acțiune; ambele rămân vizibile", () => {
  const game = atPuzzle1();
  game.requestHint("m-demo-puzzle-1");
  game.requestHint("m-demo-puzzle-1");
  const hints = hintsOf(game, { hintConfirmMissionId: "m-demo-puzzle-1" });
  assert.deepEqual(hints.opened.map((h) => h.text), ["Citește literele de la dreapta la stânga.", "Răspunsul începe cu litera O."]);
  assert.equal(hints.remaining, 0);
  assert.equal(hints.canRequest, false);
  assert.equal(hints.nextNumber, null);
  assert.equal(hints.confirming, false); // fără indiciu de deschis, nicio confirmare
  assert.equal(hints.visible, true); // cele deschise rămân vizibile
  assert.equal(vm(game).actions.requestHint, false);
  // Motorul nu deschide un al treilea (contorul rămâne la total).
  const before = game.getState();
  game.requestHint("m-demo-puzzle-1");
  assert.deepEqual(game.getState(), before);
});

test("indicii: răspunsul corect funcționează după indiciu; fără penalizări; zona dispare după rezolvare", async () => {
  const game = atPuzzle1();
  game.requestHint("m-demo-puzzle-1");
  assert.deepEqual(await game.submitAnswer("greșit"), { result: "incorrect" });
  assert.equal(hintsOf(game).opened.length, 1); // răspunsul greșit nu atinge indiciile
  assert.deepEqual(await game.submitAnswer("omed"), { result: "correct" });
  const u = describePlayUi(vm(game));
  assert.equal(u.puzzle.solved, true);
  assert.equal(u.puzzle.showContinue, true);
  assert.equal(u.hints.visible, false);
  assert.equal(u.hints.canRequest, false);
  assert.equal(vm(game).summary.score, 150); // 50 + 100, fără penalizare (D-025)
});

test("indicii: închiderea / redeschiderea overlay-ului păstrează indiciile", () => {
  const game = atPuzzle1();
  game.requestHint("m-demo-puzzle-1");
  const closed = describePlayUi(vm(game), { dismissedMissionId: "m-demo-puzzle-1" });
  assert.equal(closed.puzzle.visible, false);
  const reopened = hintsOf(game);
  assert.deepEqual(reopened.opened.map((h) => h.index), [0]);
  assert.equal(reopened.remaining, 1);
});

test("indicii: reîncărcarea (stare salvată → motor nou) păstrează exact indiciile; nu se consumă din nou", () => {
  const game = atPuzzle1();
  game.requestHint("m-demo-puzzle-1");
  const saved = JSON.parse(JSON.stringify(game.getState())); // ce scrie storage.saveGame
  const content = toAdventureV2(slice);
  const reloaded = createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), savedState: saved });
  const u = describePlayUi(vm(reloaded));
  assert.equal(u.puzzle.open, true); // puzzle-ul activ se redeschide
  assert.deepEqual(u.hints, describePlayUi(vm(game)).hints);
  assert.equal(u.hints.nextNumber, 2); // următorul este al doilea, nu din nou primul
  reloaded.requestHint("m-demo-puzzle-1");
  assert.equal(reloaded.getState().missions["m-demo-puzzle-1"].hintsUsed, 2);
});

test("indicii: puzzle-ul 2 are un singur indiciu", async () => {
  const game = atPuzzle1();
  await game.submitAnswer("omed");
  game.next();
  game.confirmArrival("loc-demo-2");
  game.next();
  let hints = hintsOf(game);
  assert.equal(hints.total, 1);
  assert.equal(hints.canRequest, true);
  game.requestHint("m-demo-puzzle-2");
  hints = hintsOf(game);
  assert.deepEqual(hints.opened, [{ index: 0, text: "Aventura are două locații: Punctul A și Punctul B." }]);
  assert.equal(hints.canRequest, false);
});

test("indicii V1: în pagină, aceeași descriere (indiciul existent, cu confirmare)", () => {
  const game = newGame(demoV1);
  game.start();
  let u = describePlayUi(vm(game), { hintConfirmMissionId: "challenge-01" });
  assert.equal(u.puzzle.mode, "inline");
  assert.equal(u.hints.visible, true);
  assert.equal(u.hints.total, 1);
  assert.equal(u.hints.confirming, true);
  game.requestHint("challenge-01");
  u = describePlayUi(vm(game));
  assert.equal(u.hints.opened.length, 1);
  assert.equal(u.hints.canRequest, false);
});
