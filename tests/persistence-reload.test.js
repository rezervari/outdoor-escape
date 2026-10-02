/*
 * Regresie: progresul supraviețuiește închiderii paginii și unei noi inițializări a aplicației.
 *
 * Reproduce lanțul din app.js (startGame + setupGameUi), fără DOM:
 *   loadAdventure (content.js, fișierul real) → toAdventureV2 → createGame({ savedState: storage.loadGame(id) })
 *   → game.subscribe(salvare automată, aceeași regulă ca în app.js) → start → GPS → „închidere”
 *   → o nouă inițializare cu un nou obiect storage peste același localStorage → restaurare → continuare.
 *
 * „localStorage” este un backend în memorie care păstrează doar șiruri (ca browserul);
 * „închiderea paginii” = aruncarea tuturor obiectelor (joc, storage), păstrând doar backend-ul.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { loadAdventure } from "../src/js/content.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { createGame, GameStatus, ChallengeStatus, LocationStatus } from "../src/js/game.js";
import { createStorage, storageKey } from "../src/js/storage.js";
import { buildViewModel, View, NextKind } from "../src/js/view-model.js";

const ADVENTURE_ID = "demo-gps-brasov";

// fetch pentru Node: citește fișierul real din content/adventures/ (URL-ul calculat de content.js).
async function fileFetch(url) {
  const text = await readFile(new URL(url), "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
}

function browserLikeLocalStorage() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

/** O inițializare completă a aplicației (echivalentul startGame + abonarea din setupGameUi). */
async function bootApp(localStorageBackend) {
  const storage = createStorage(localStorageBackend);
  const adventure = toAdventureV2(await loadAdventure(ADVENTURE_ID, { fetchImpl: fileFetch }));
  const game = createGame({
    adventure: withoutAnswers(adventure),
    validator: createLocalValidator(adventure),
    savedState: storage.loadGame(adventure.id),
  });
  // Aceeași regulă ca în app.js: idle → ștergere; altfel → salvare.
  game.subscribe((state) => {
    if (state.status === GameStatus.IDLE) storage.resetGame(adventure.id);
    else storage.saveGame(adventure.id, state);
  });
  return { game, adventure };
}

function fixAt(adventure, locationId, accuracy = 10) {
  const { lat, lng } = adventure.locations.find((l) => l.id === locationId).coordinates;
  return { lat, lng, accuracy, timestamp: Date.now() };
}

// Răspunsul declarat al unei misiuni, din fișierul real (adventure păstrează răspunsurile; motorul nu le vede).
const answerOf = (adventure, missionId) => adventure.missions.find((m) => m.id === missionId).answer;
const viewOf = (game) => buildViewModel({ content: game.content, state: game.getState() });

test("reload după detectarea Start (fără „Continuă”): Start rămâne rezolvat, provocarea de la Start deblocată, jocul continuă", async () => {
  const backend = browserLikeLocalStorage();

  // Sesiunea 1: pornire + GPS la Start.
  {
    const { game, adventure } = await bootApp(backend);
    assert.equal(game.getState().status, GameStatus.IDLE);
    game.start();
    game.reportPosition(fixAt(adventure, "start"));
    const state = game.getState();
    assert.equal(state.missions["m-start"].status, ChallengeStatus.SOLVED);
    assert.equal(state.missions["m-start-puzzle"].status, ChallengeStatus.PENDING);
    // Bariera se deblochează abia după provocarea de la Start.
    assert.equal(state.locations.bariera.status, LocationStatus.LOCKED);
    assert.equal(state.missions["m-bariera"].status, "locked");
  }
  // Pagina închisă: rămâne doar localStorage.
  const savedRaw = backend.map.get(storageKey(ADVENTURE_ID));
  assert.equal(typeof savedRaw, "string");

  // Sesiunea 2: o nouă inițializare a aplicației.
  const { game, adventure } = await bootApp(backend);
  assert.equal(backend.map.get(storageKey(ADVENTURE_ID)), savedRaw, "inițializarea nu rescrie și nu șterge progresul");

  const state = game.getState();
  assert.equal(state.status, GameStatus.PLAYING, "nu revine la ecranul de start (idle)");
  assert.equal(state.missions["m-start"].status, ChallengeStatus.SOLVED);
  // Start rămâne „discovered” cât timp provocarea lui este deschisă (devine „completed” după ea).
  assert.equal(state.locations.start.status, LocationStatus.DISCOVERED);
  assert.equal(state.missions["m-start-puzzle"].status, ChallengeStatus.PENDING);
  assert.equal(state.locations.bariera.status, LocationStatus.LOCKED);
  assert.equal(state.missions["m-bariera"].status, "locked");
  assert.equal(state.missions["m-magazin"].status, "locked");
  assert.equal(game.getSummary().score, 50);
  // Misiunea curentă rămâne m-start, dar închisă: interfața arată „Continuă”, nu o reluare.
  assert.equal(game.getCurrentMission().mission.id, "m-start");
  assert.notEqual(game.getCurrentMission().progress.status, ChallengeStatus.PENDING);

  // GPS-ul din nou la Start după reload: nicio sosire dublă, niciun punct în plus.
  const arrivedAt = state.locations.start.arrivedAt;
  game.reportPosition(fixAt(adventure, "start"));
  assert.equal(game.getState().locations.start.arrivedAt, arrivedAt);
  assert.equal(game.getSummary().score, 50);

  // Continuare fără reluarea Start-ului: „Continuă” → provocarea de la Start → „Continuă” → Bariera → GPS la Bariera.
  game.next();
  assert.equal(game.getCurrentMission().mission.id, "m-start-puzzle");
  assert.equal((await game.submitAnswer(answerOf(adventure, "m-start-puzzle"))).result, "correct");
  assert.equal(game.getState().locations.start.status, LocationStatus.COMPLETED);
  assert.equal(game.getState().locations.bariera.status, LocationStatus.UNLOCKED);
  assert.equal(game.getState().missions["m-bariera"].status, ChallengeStatus.PENDING);
  assert.equal(game.getSummary().score, 150);
  game.next();
  assert.equal(game.getCurrentMission().mission.id, "m-bariera");
  game.reportPosition(fixAt(adventure, "bariera"));
  const after = game.getState();
  assert.equal(after.missions["m-bariera"].status, ChallengeStatus.SOLVED);
  assert.equal(after.missions["m-bariera-puzzle"].status, ChallengeStatus.PENDING);
  // Magazinul se deblochează abia după provocarea de la Bariera.
  assert.equal(after.locations.magazin.status, LocationStatus.LOCKED);
  assert.equal(after.missions["m-magazin"].status, "locked");
  assert.equal(game.getSummary().score, 200);
  game.next();
  assert.equal((await game.submitAnswer(answerOf(adventure, "m-bariera-puzzle"))).result, "correct");
  assert.equal(game.getState().locations.magazin.status, LocationStatus.UNLOCKED);
  assert.equal(game.getState().missions["m-magazin"].status, ChallengeStatus.PENDING);
  assert.equal(game.getSummary().score, 300);
});

test("reload după „Continuă”: misiunea curentă este provocarea de la Start", async () => {
  const backend = browserLikeLocalStorage();
  {
    const { game, adventure } = await bootApp(backend);
    game.start();
    game.reportPosition(fixAt(adventure, "start"));
    game.next();
  }
  const { game } = await bootApp(backend);
  const current = game.getCurrentMission();
  assert.equal(current.mission.id, "m-start-puzzle");
  assert.equal(current.index, 1);
  assert.equal(current.progress.status, ChallengeStatus.PENDING);
});

test("reload după finalizare: aventura rămâne finalizată, cu punctele păstrate", async () => {
  const backend = browserLikeLocalStorage();
  {
    const { game, adventure } = await bootApp(backend);
    game.start();
    game.reportPosition(fixAt(adventure, "start"));
    game.next();
    await game.submitAnswer(answerOf(adventure, "m-start-puzzle"));
    game.next();
    game.reportPosition(fixAt(adventure, "bariera"));
    game.next();
    await game.submitAnswer(answerOf(adventure, "m-bariera-puzzle"));
    game.next();
    game.reportPosition(fixAt(adventure, "magazin"));
    assert.equal(game.getState().status, GameStatus.COMPLETED);
  }
  const { game } = await bootApp(backend);
  assert.equal(game.getState().status, GameStatus.COMPLETED);
  assert.equal(game.getSummary().score, 400);
});

test("progresul salvat nu conține poziția GPS (se obține din nou după reload)", async () => {
  const backend = browserLikeLocalStorage();
  const { game, adventure } = await bootApp(backend);
  game.start();
  const fix = fixAt(adventure, "start");
  game.reportPosition(fix);
  const raw = backend.map.get(storageKey(ADVENTURE_ID));
  assert.ok(!raw.includes(String(fix.lat)) && !raw.includes(String(fix.lng)));
  assert.ok(!/"(lat|lng|accuracy)"/.test(raw));
});

test("vertical slice (D-081): intro → GPS → provocare (greșit, reîncercare, indiciu, corect) → GPS → provocare → final cu epilog, cu reload, apoi replay", async () => {
  const backend = browserLikeLocalStorage();
  const WRONG = "__raspuns-gresit__";
  {
    const { game, adventure } = await bootApp(backend);
    game.start();
    // Intro: mesajul regulii adventure_started, în jurnalul naratorului.
    const intro = viewOf(game).story.entries;
    assert.deepEqual(intro.map((e) => e.messageId), ["msg-intro"]);
    assert.equal(intro[0].text, adventure.narrator.messages["msg-intro"].text);

    // GPS → sosire → următorul pas este o provocare cu răspuns.
    game.reportPosition(fixAt(adventure, "start"));
    let vm = viewOf(game);
    assert.equal(vm.view, View.ARRIVED);
    assert.equal(vm.next.kind, NextKind.OPEN_PUZZLE);
    game.next();
    vm = viewOf(game);
    assert.equal(vm.view, View.PUZZLE);
    assert.equal(vm.puzzle.missionId, "m-start-puzzle");
    assert.equal(vm.puzzle.hints.total, 2);

    // Răspuns greșit: provocarea rămâne deschisă și se poate reîncerca.
    assert.equal((await game.submitAnswer(WRONG)).result, "incorrect");
    assert.equal(game.getState().missions["m-start-puzzle"].status, ChallengeStatus.PENDING);
    assert.equal(game.getState().missions["m-start-puzzle"].attempts, 1);
    assert.equal(viewOf(game).actions.submitAnswer, true);
    // Indiciul (D-030): se deschide primul indiciu, iar al doilea rămâne disponibil.
    assert.equal(game.requestHint("m-start-puzzle"), adventure.missions.find((m) => m.id === "m-start-puzzle").hints[0].text);
    assert.deepEqual(viewOf(game).puzzle.hints.opened.map((h) => h.index), [0]);
    assert.equal(viewOf(game).actions.requestHint, true);
  }

  // Reload în mijlocul provocării: încercarea și indiciul deschis se păstrează.
  {
    const { game, adventure } = await bootApp(backend);
    assert.equal(game.getCurrentMission().mission.id, "m-start-puzzle");
    assert.equal(game.getState().missions["m-start-puzzle"].attempts, 1);
    assert.equal(game.getState().missions["m-start-puzzle"].hintsUsed, 1);
    assert.deepEqual(viewOf(game).story.entries.map((e) => e.messageId), ["msg-intro"]);

    // Reîncercare cu răspunsul corect (normalizat: majuscule, fără diacritice) → „Continuă” → GPS.
    const answer = answerOf(adventure, "m-start-puzzle");
    assert.equal((await game.submitAnswer(answer.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase())).result, "correct");
    let vm = viewOf(game);
    assert.equal(vm.view, View.SOLVED);
    assert.equal(vm.actions.continue, true);
    assert.equal(vm.next.kind, NextKind.GO_TO_LOCATION);
    assert.equal(game.getSummary().score, 150);
    game.next();
    assert.equal(viewOf(game).view, View.TRAVEL);

    // A doua etapă: GPS la Bariera → provocarea de la Bariera → „Continuă”.
    game.reportPosition(fixAt(adventure, "bariera"));
    game.next();
    vm = viewOf(game);
    assert.equal(vm.view, View.PUZZLE);
    assert.equal(vm.puzzle.missionId, "m-bariera-puzzle");
    assert.equal(vm.puzzle.hints.total, 1);
    assert.equal((await game.submitAnswer(answerOf(adventure, "m-bariera-puzzle"))).result, "correct");
    game.next();

    // Finalul: ultima misiune pornește finalul; sosirea la Magazin încheie aventura, cu epilog.
    assert.equal(game.getCurrentMission().mission.id, adventure.finale.missionId);
    assert.notEqual(game.getState().finaleStartedAt, null);
    game.reportPosition(fixAt(adventure, "magazin"));
    vm = viewOf(game);
    assert.equal(vm.view, View.COMPLETED);
    assert.equal(vm.story.epilogue, adventure.narrator.messages[adventure.finale.messageId].text);
    assert.deepEqual(vm.summary, { score: 400, maxScore: 400, solved: 5, total: 5, hintsUsed: 1 });
  }

  // Reload după final: rezultatul și epilogul rămân; „Joacă din nou” (reset) șterge progresul.
  const { game } = await bootApp(backend);
  const vm = viewOf(game);
  assert.equal(vm.view, View.COMPLETED);
  assert.ok(vm.story.epilogue);
  assert.deepEqual(vm.summary, { score: 400, maxScore: 400, solved: 5, total: 5, hintsUsed: 1 });
  game.reset();
  assert.equal(viewOf(game).view, View.INTRO);
  assert.equal(backend.map.has(storageKey(ADVENTURE_ID)), false);
});
