// Jurnalul naratorului (viewModel.story): mesajele `show_message` ale regulilor declanșate,
// derivate din starea salvată (firedEvents), și epilogul (finale.messageId). Fără DOM.
// Aventura de test este FICTIVĂ (coordonate lângă 0°, 0°), definită aici.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildViewModel } from "../src/js/view-model.js";
import { validateAdventure } from "../src/js/content.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";

const story = {
  schemaVersion: 2,
  id: "test-story",
  demo: true,
  meta: { title: "[TEST] Jurnal", city: "Test" },
  settings: { progression: "linear", gps: { allowManualConfirmation: true } },
  narrator: {
    name: "Naratorul",
    messages: {
      intro: { text: "Bun venit.\nPrima linie nouă." },
      arrived: { text: "Ai ajuns la punctul A." },
      solved: { text: "Primul fragment: 7." },
      finale: { text: "Final de test." },
    },
  },
  locations: [
    { id: "loc-a", name: "[TEST] A", type: "start", coordinates: { lat: 0.001, lng: 0.001 }, initialStatus: "unlocked" },
  ],
  missions: [
    { id: "m-go", type: "location", track: "main", title: "Mergi la A", briefing: "Mergi.", locationId: "loc-a", initialStatus: "pending", points: 0 },
    { id: "m-q", type: "riddle", track: "main", title: "Întrebare", briefing: "Scrie 7.", locationId: "loc-a", initialStatus: "locked", points: 100, answer: "7" },
  ],
  events: [
    { id: "ev-intro", on: "adventure_started", do: [{ action: "show_message", messageId: "intro" }] },
    { id: "ev-arrived", on: "mission_completed", where: { missionId: "m-go" }, do: [{ action: "show_message", messageId: "arrived" }] },
    { id: "ev-solved", on: "mission_completed", where: { missionId: "m-q" }, do: [{ action: "show_message", messageId: "solved" }] },
  ],
  finale: { missionId: "m-q", messageId: "finale" },
};

function clock() {
  let t = 1_000;
  return () => (t += 1_000);
}

function newGame(savedState = null) {
  const content = toAdventureV2(story);
  return createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), savedState, now: clock() });
}

const vm = (game) => buildViewModel({ content: game.content, state: game.getState() });
const texts = (game) => vm(game).story.entries.map((entry) => entry.text);

test("aventura de test este V2 validă", () => {
  assert.deepEqual(validateAdventure(story), { valid: true, errors: [] });
});

test("înainte de start: jurnal gol, fără epilog; numele naratorului vine din conținut", () => {
  const model = vm(newGame());
  assert.deepEqual(model.story, { narratorName: "Naratorul", entries: [], epilogue: null });
});

test("mesajele apar pe măsură ce regulile sunt declanșate, în ordinea declanșării", async () => {
  const game = newGame();
  game.start();
  assert.deepEqual(texts(game), ["Bun venit.\nPrima linie nouă."]);
  game.confirmArrival("loc-a");
  assert.deepEqual(texts(game), ["Bun venit.\nPrima linie nouă.", "Ai ajuns la punctul A."]);
  game.next();
  await game.submitAnswer("7");
  assert.deepEqual(texts(game), ["Bun venit.\nPrima linie nouă.", "Ai ajuns la punctul A.", "Primul fragment: 7."]);
  assert.equal(vm(game).story.epilogue, null, "epilogul apare doar după încheiere");
});

test("după încheiere: epilogul este finale.messageId; jurnalul rămâne complet", async () => {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-a");
  game.next();
  await game.submitAnswer("7");
  game.next();
  const model = vm(game);
  assert.equal(model.view, "completed");
  assert.equal(model.story.epilogue, "Final de test.");
  assert.equal(model.story.entries.length, 3);
});

test("jurnalul se reconstruiește identic după reîncărcare (derivat din firedEvents salvat)", () => {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-a");
  const reloaded = newGame(structuredClone(game.getState()));
  assert.deepEqual(vm(reloaded).story, vm(game).story);
});

test("o misiune sărită nu declanșează mesajul legat de rezolvare", () => {
  const game = newGame();
  game.start();
  game.confirmArrival("loc-a");
  game.next();
  game.skipChallenge();
  assert.deepEqual(texts(game), ["Bun venit.\nPrima linie nouă.", "Ai ajuns la punctul A."]);
});

test("aventuri fără narator (demo-urile existente): jurnal gol, fără erori", () => {
  const raw = JSON.parse(readFileSync(new URL("../content/adventures/demo-vertical-slice.json", import.meta.url), "utf8"));
  const content = toAdventureV2(raw);
  const game = createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content) });
  game.start();
  assert.deepEqual(vm(game).story, { narratorName: null, entries: [], epilogue: null });
});

test("interfața: panoul jurnalului și epilogul există în index.html; textele intră prin textContent", () => {
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  for (const id of ["story-panel", "story-title", "story-latest", "story-history", "story-list", "end-epilogue"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  const app = readFileSync(new URL("../src/js/app.js", import.meta.url), "utf8");
  assert.match(app, /function renderStory\(viewModel\)/);
  assert.doesNotMatch(app, /story[^\n]*innerHTML/, "textele naratorului nu se injectează ca HTML");
});
