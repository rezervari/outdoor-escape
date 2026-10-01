// Obiecte colecționabile (items + acțiunea collect_item) și variante de răspuns (mission.choices).
// Aventura de test este FICTIVĂ, definită aici. Fără DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { validateAdventure } from "../src/js/content.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { ACTION_TYPES } from "../src/js/events.js";
import { createGame, collectedItems } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { buildViewModel } from "../src/js/view-model.js";

const base = () => ({
  schemaVersion: 2,
  id: "test-items",
  demo: true,
  meta: { title: "[TEST] Obiecte", city: "Test" },
  items: [
    { id: "fragment-a", name: "Fragmentul A", description: "prima bucată", icon: "🔢" },
    { id: "fragment-b", name: "Fragmentul B" },
  ],
  missions: [
    { id: "m-1", type: "riddle", track: "main", title: "Alege", briefing: "Stânga sau dreapta?", points: 10, answer: "dreapta", choices: ["STÂNGA", "DREAPTA"] },
    { id: "m-2", type: "observation", track: "main", title: "Numără", briefing: "Câte?", points: 10, answer: "4" },
  ],
  events: [
    { id: "ev-a", on: "mission_completed", where: { missionId: "m-1" }, do: [{ action: "collect_item", itemId: "fragment-a" }] },
    { id: "ev-b", on: "mission_completed", where: { missionId: "m-2" }, do: [{ action: "collect_item", itemId: "fragment-b" }] },
  ],
});

function clock() {
  let t = 0;
  return () => (t += 1_000);
}

function newGame(source = base(), savedState = null) {
  const content = toAdventureV2(source);
  return createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), savedState, now: clock() });
}

const vm = (game) => buildViewModel({ content: game.content, state: game.getState() });

/* ---------- Schema ---------- */

test("schema: items + collect_item + choices sunt valide", () => {
  assert.deepEqual(validateAdventure(base()), { valid: true, errors: [] });
  assert.deepEqual(ACTION_TYPES.collect_item, { itemId: "items" });
});

test("schema: collect_item cu un obiect inexistent este respins", () => {
  const data = base();
  data.events[0].do[0].itemId = "nu-exista";
  const { valid, errors } = validateAdventure(data);
  assert.equal(valid, false);
  assert.ok(errors.some((e) => e.includes("nu-exista") && e.includes("items")), errors.join("\n"));
});

test("schema: item fără nume, id duplicat → erori", () => {
  const data = base();
  data.items.push({ id: "fragment-a", name: "" });
  const { errors } = validateAdventure(data);
  assert.ok(errors.some((e) => e.includes("duplicat")));
  assert.ok(errors.some((e) => e.includes(".name lipsește")));
});

test("schema: choices doar pe misiuni cu răspuns, 2–6 texte nevide și diferite", () => {
  const tooFew = base();
  tooFew.missions[0].choices = ["UNA"];
  assert.equal(validateAdventure(tooFew).valid, false);
  const duplicate = base();
  duplicate.missions[0].choices = ["A", "A"];
  assert.equal(validateAdventure(duplicate).valid, false);
  const onLocation = base();
  onLocation.locations = [{ id: "loc", name: "L", type: "start", coordinates: { lat: 0.001, lng: 0.001 } }];
  onLocation.missions.unshift({ id: "m-0", type: "location", track: "main", title: "Mergi", briefing: "Mergi.", locationId: "loc", points: 0, choices: ["A", "B"] });
  assert.ok(validateAdventure(onLocation).errors.some((e) => e.includes("choices este permis doar")));
});

/* ---------- Motorul ---------- */

test("collect_item: obiectul apare după regula declanșată, în ordinea obținerii; fără stare nouă salvată", async () => {
  const game = newGame();
  game.start();
  assert.deepEqual(game.getProgressSummary().collectedItems, []);
  await game.submitAnswer("dreapta");
  assert.deepEqual(game.getProgressSummary().collectedItems, ["fragment-a"]);
  assert.ok(game.takeEffects().some((e) => e.type === "item" && e.itemId === "fragment-a"));
  game.next();
  await game.submitAnswer("4");
  assert.deepEqual(game.getProgressSummary().collectedItems, ["fragment-a", "fragment-b"]);
  assert.equal(Object.prototype.hasOwnProperty.call(game.getState(), "items"), false, "obiectele se derivă din firedEvents");
});

test("collect_item: obiectele se păstrează după reîncărcare", async () => {
  const game = newGame();
  game.start();
  await game.submitAnswer("dreapta");
  const reloaded = newGame(base(), structuredClone(game.getState()));
  assert.deepEqual(reloaded.getProgressSummary().collectedItems, ["fragment-a"]);
  assert.deepEqual(vm(reloaded).items, vm(game).items);
});

test("misiunea sărită nu dă obiectul", () => {
  const game = newGame();
  game.start();
  game.skipChallenge();
  assert.deepEqual(game.getProgressSummary().collectedItems, []);
});

test("collectedItems: același obiect din două reguli apare o singură dată", () => {
  const data = base();
  data.events[1].do[0].itemId = "fragment-a";
  assert.deepEqual(collectedItems(data, { "ev-a": 1, "ev-b": 2 }), ["fragment-a"]);
});

/* ---------- Modelul interfeței ---------- */

test("view-model: items cu nume, descriere, pictogramă; choices pe puzzle; fără răspuns în model", async () => {
  const game = newGame();
  game.start();
  const before = vm(game);
  assert.deepEqual(before.puzzle.choices, ["STÂNGA", "DREAPTA"]);
  assert.deepEqual(before.items, []);
  assert.doesNotMatch(JSON.stringify(before), /"answer"/);
  await game.submitAnswer("DREAPTA"); // varianta afișată trece prin aceeași normalizare (D-024)
  assert.deepEqual(vm(game).items, [{ id: "fragment-a", name: "Fragmentul A", description: "prima bucată", icon: "🔢" }]);
  game.next();
  assert.equal(vm(game).puzzle.choices, null, "fără choices → răspuns tastat");
});

test("aventurile fără items rămân neschimbate (items: [])", () => {
  const raw = JSON.parse(readFileSync(new URL("../content/adventures/demo-vertical-slice.json", import.meta.url), "utf8"));
  const content = toAdventureV2(raw);
  const game = createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content) });
  game.start();
  assert.deepEqual(vm(game).items, []);
  assert.deepEqual(game.getProgressSummary().collectedItems, []);
});

/* ---------- Interfața (sursă) ---------- */

test("interfața: variantele trimit prin formular (aceeași verificare); obiectele prin textContent", () => {
  const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8");
  for (const id of ["choice-list", "typed-answer", "items-panel", "items-list", "end-items-panel", "end-items-list"]) {
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  const app = readFileSync(new URL("../src/js/app.js", import.meta.url), "utf8");
  const choices = /function renderChoices\(viewModel\) \{([\s\S]*?)\n  \}/.exec(app)[1];
  assert.match(choices, /requestSubmit\(\)/);
  assert.doesNotMatch(choices, /game\./, "butonul nu ocolește formularul");
  const items = /function renderItems\(items, \{ panel, title, list \}\) \{([\s\S]*?)\n  \}/.exec(app)[1];
  assert.match(items, /textContent/);
  assert.doesNotMatch(items, /innerHTML/);
});
