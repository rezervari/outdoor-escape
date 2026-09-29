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

test("reload după detectarea Start (fără „Continuă”): Start rămâne rezolvat, Bariera deblocată, jocul continuă", async () => {
  const backend = browserLikeLocalStorage();

  // Sesiunea 1: pornire + GPS la Start.
  {
    const { game, adventure } = await bootApp(backend);
    assert.equal(game.getState().status, GameStatus.IDLE);
    game.start();
    game.reportPosition(fixAt(adventure, "start"));
    const state = game.getState();
    assert.equal(state.missions["m-start"].status, ChallengeStatus.SOLVED);
    assert.equal(state.locations.bariera.status, LocationStatus.UNLOCKED);
    assert.equal(state.missions["m-bariera"].status, ChallengeStatus.PENDING);
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
  assert.equal(state.locations.start.status, LocationStatus.COMPLETED);
  assert.equal(state.locations.bariera.status, LocationStatus.UNLOCKED);
  assert.equal(state.missions["m-bariera"].status, ChallengeStatus.PENDING);
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

  // Continuare fără reluarea Start-ului: „Continuă” → Bariera → GPS la Bariera.
  game.next();
  assert.equal(game.getCurrentMission().mission.id, "m-bariera");
  game.reportPosition(fixAt(adventure, "bariera"));
  const after = game.getState();
  assert.equal(after.missions["m-bariera"].status, ChallengeStatus.SOLVED);
  assert.equal(after.locations.magazin.status, LocationStatus.UNLOCKED);
  assert.equal(after.missions["m-magazin"].status, ChallengeStatus.PENDING);
  assert.equal(game.getSummary().score, 100);
});

test("reload după „Continuă”: misiunea curentă este Bariera", async () => {
  const backend = browserLikeLocalStorage();
  {
    const { game, adventure } = await bootApp(backend);
    game.start();
    game.reportPosition(fixAt(adventure, "start"));
    game.next();
  }
  const { game } = await bootApp(backend);
  const current = game.getCurrentMission();
  assert.equal(current.mission.id, "m-bariera");
  assert.equal(current.index, 1);
  assert.equal(current.progress.status, ChallengeStatus.PENDING);
});

test("reload după finalizare: aventura rămâne finalizată, cu punctele păstrate", async () => {
  const backend = browserLikeLocalStorage();
  {
    const { game, adventure } = await bootApp(backend);
    game.start();
    for (const id of ["start", "bariera", "magazin"]) game.reportPosition(fixAt(adventure, id));
    assert.equal(game.getState().status, GameStatus.COMPLETED);
  }
  const { game } = await bootApp(backend);
  assert.equal(game.getState().status, GameStatus.COMPLETED);
  assert.equal(game.getSummary().score, 200);
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
