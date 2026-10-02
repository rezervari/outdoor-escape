/*
 * M3 — modelul GameMessage (D-082, D-085, D-087, D-088, D-094): { id, text, category, importance, sender, at }.
 * Se verifică contractul: construire pură, identitate deterministă din sursa semantică
 * (independentă de GameEvent.seq și de timp), validare, imutabilitate, separarea de GameEvent.
 * Fără Message Engine: maparea eveniment → mesaj din aceste teste este doar ilustrativă.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGameMessage, MESSAGE_CATEGORIES, MESSAGE_IMPORTANCE } from "../src/js/game-message.js";
import { createGameEvent } from "../src/js/events.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";

const base = Object.freeze({ source: ["mission_completed", "m-1"], text: "Misiune rezolvată.", category: "gameplay" });
const message = (overrides = {}) => createGameMessage({ ...base, ...overrides });

/* ---------- Construire și validare ---------- */

test("creare validă: forma completă, cu valorile implicite (importance normal, sender și at null)", () => {
  assert.deepEqual(message(), {
    id: "mission_completed:m-1",
    text: "Misiune rezolvată.",
    category: "gameplay",
    importance: "normal",
    sender: null,
    at: null,
  });
  assert.deepEqual(
    createGameMessage({ source: ["rule", "ev-start", 0], text: "Bun venit.", category: "story", importance: "important", sender: { name: "Ghidul TEST" }, at: 1000 }),
    { id: "rule:ev-start:0", text: "Bun venit.", category: "story", importance: "important", sender: { name: "Ghidul TEST" }, at: 1000 }
  );
});

test("câmpuri obligatorii: source, text și category; datele invalide sunt respinse", () => {
  for (const input of [undefined, null, "mesaj", [], new (class Message {})()]) {
    assert.throws(() => createGameMessage(input), /obiect/);
  }
  const { source, text, category } = base;
  assert.throws(() => createGameMessage({ text, category }), /source/);
  assert.throws(() => createGameMessage({ source, category }), /text/);
  assert.throws(() => createGameMessage({ source, text }), /categorie/);

  for (const bad of ["mission_completed:m-1", [], [""], ["a b"], ["a:b"], [-1], [1.5], [null], [{}], [() => "x"]]) {
    assert.throws(() => message({ source: bad }), /source/, JSON.stringify(bad));
  }
  for (const bad of ["", "   ", 42, null, { text: "x" }, ["x"], () => "x"]) {
    assert.throws(() => message({ text: bad }), /text/);
  }
  for (const bad of [NaN, Infinity, "1000", {}]) {
    assert.throws(() => message({ at: bad }), /at trebuie/);
  }
});

test("câmpurile din afara modelului sunt respinse (fără acțiuni, persistență, notificare sau date de eveniment)", () => {
  for (const key of ["id", "sourceKey", "order", "actions", "persistent", "displayMode", "notification", "unread", "html", "audio", "type", "payload", "seq", "cause"]) {
    assert.throws(() => message({ [key]: "x" }), /nu face parte din model/, key);
  }
});

/* ---------- Identitatea ---------- */

test("id stabil: aceeași sursă semantică → același id", () => {
  const a = message();
  const b = createGameMessage({ ...base });
  assert.equal(a.id, b.id);
  // Identitatea nu depinde de text, categorie, importanță sau expeditor (aceeași apariție logică).
  assert.equal(message({ text: "Alt text.", category: "story", importance: "urgent", sender: { name: "X" } }).id, a.id);
});

test("surse diferite → id-uri diferite (inclusiv cazurile de alăturare ambiguă)", () => {
  const ids = [
    ["mission_completed", "m-1"],
    ["mission_completed", "m-2"],
    ["mission_failed", "m-1"],
    ["hint", "m-1", 0],
    ["hint", "m-1", 1],
    ["rule", "ev-start", 0],
    ["rule", "ev-start", 1],
    ["mission_completed-m-1"],
  ].map((source) => message({ source }).id);
  assert.equal(new Set(ids).size, ids.length);
  // Separatorul nu poate apărea într-o parte, deci ["a", "b"] și ["a:b"] nu pot coincide.
  assert.throws(() => message({ source: ["mission_completed:m-1"] }), /source/);
});

test("seq diferit nu schimbă id-ul: două GameEvent-uri ale aceleiași surse dau același mesaj logic", () => {
  // Același fapt în două rulări ale motorului (ex. înainte și după reîncărcare): seq și at diferă.
  const first = createGameEvent("mission_completed", { missionId: "m-1", locationId: "loc-a" }, { seq: 7, at: 1000, cause: "submit_answer" });
  const again = createGameEvent("mission_completed", { missionId: "m-1", locationId: "loc-a" }, { seq: 1, at: 99000 });
  const toMessage = (event) => createGameMessage({ source: [event.type, event.payload.missionId], text: "Gata.", category: "gameplay", at: event.at });
  const [a, b] = [toMessage(first), toMessage(again)];
  assert.equal(a.id, b.id);
  assert.notEqual(a.at, b.at);
});

test("timestamp diferit nu schimbă id-ul", () => {
  assert.equal(message({ at: 1000 }).id, message({ at: 2000 }).id);
  assert.equal(message({ at: 1000 }).id, message({ at: null }).id);
});

/* ---------- Categorie, importanță, expeditor, acțiuni ---------- */

test("category: doar lista inițială D-087; valorile viitoare sau greșite sunt respinse", () => {
  assert.deepEqual([...MESSAGE_CATEGORIES], ["position", "gameplay", "hint", "story", "alert"]);
  for (const category of MESSAGE_CATEGORIES) assert.equal(message({ category }).category, category);
  for (const category of ["reward", "system", "character", "mission", "team", "Story", "", null]) {
    assert.throws(() => message({ category }), /categorie/, String(category));
  }
});

test("importance: normal / important / urgent; implicit normal; valorile greșite sunt respinse", () => {
  assert.deepEqual([...MESSAGE_IMPORTANCE], ["normal", "important", "urgent"]);
  assert.equal(message().importance, "normal");
  for (const importance of MESSAGE_IMPORTANCE) assert.equal(message({ importance }).importance, importance);
  for (const importance of ["high", "low", "Urgent", "", null]) {
    assert.throws(() => message({ importance }), /importanță/, String(importance));
  }
});

test("category ≠ importance: niciuna nu o implică pe cealaltă", () => {
  assert.equal(message({ category: "alert" }).importance, "normal");
  assert.equal(message({ category: "story", importance: "urgent" }).category, "story");
  for (const category of MESSAGE_CATEGORIES) {
    for (const importance of MESSAGE_IMPORTANCE) {
      const result = message({ category, importance });
      assert.deepEqual([result.category, result.importance], [category, importance]);
    }
  }
});

test("sender: null sau { name }, doar date (fără funcții, obiecte de interfață sau câmpuri în plus)", () => {
  assert.equal(message().sender, null);
  assert.deepEqual(message({ sender: { name: "Ghidul TEST" } }).sender, { name: "Ghidul TEST" });
  class Element {}
  for (const sender of ["Ghidul TEST", { name: "" }, { name: 1 }, {}, { name: "X", speak: () => "salut" }, { name: "X", avatar: new Element() }, new Element()]) {
    assert.throws(() => message({ sender }), /sender/);
  }
});

test("actions: nu fac parte din model în M3 (MessageAction — D-093); nici date, nici funcții", () => {
  assert.equal(Object.hasOwn(message(), "actions"), false);
  for (const actions of [[], [{ id: "hint", label: "Indiciu" }], [() => {}]]) {
    assert.throws(() => message({ actions }), /nu face parte din model/);
  }
});

/* ---------- Puritate și imutabilitate ---------- */

test("puritate: datele primite, GameEvent-ul și starea jocului nu se modifică; rezultatul este independent", async () => {
  const sender = { name: "Ghidul TEST" };
  const source = ["rule", "ev-start", 0];
  const input = { source, text: "Bun venit.", category: "story", sender, at: 1000 };
  const snapshot = structuredClone(input);
  const result = createGameMessage(input);
  assert.deepEqual(input, snapshot);
  assert.notEqual(result.sender, sender); // copie, nu referința primită
  sender.name = "Altcineva";
  source.push(1);
  assert.deepEqual(result, { id: "rule:ev-start:0", text: "Bun venit.", category: "story", importance: "normal", sender: { name: "Ghidul TEST" }, at: 1000 });

  // Un joc real (fixture fictiv): construirea unui mesaj din evenimentele lui nu atinge starea.
  const fixture = toAdventureV2(JSON.parse(await readFile(new URL("./fixtures/adventure-v2-demo.json", import.meta.url), "utf8")));
  const game = createGame({ adventure: withoutAnswers(fixture), validator: createLocalValidator(fixture), now: () => 5000 });
  const batches = [];
  game.subscribe((state, events) => batches.push(events));
  game.start();
  const before = game.getState();
  const eventsBefore = structuredClone(batches[0]);
  for (const event of batches[0]) {
    createGameMessage({ source: [event.type], text: "x", category: "gameplay", at: event.at });
  }
  assert.deepEqual(game.getState(), before);
  assert.deepEqual(batches[0], eventsBefore);
  assert.equal(batches.length, 1); // nicio notificare nouă: mesajul nu este o tranzacție
});

test("puritate (în sursă): fără DOM, stocare, ceas, aleator, audio sau dependențe de motor / interfață", async () => {
  const code = (await readFile(new URL("../src/js/game-message.js", import.meta.url), "utf8")).replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\bimport\b|\brequire\(/);
  assert.doesNotMatch(code, /\b(document|window|localStorage|sessionStorage|navigator|indexedDB|Audio|AudioContext|fetch)\b/);
  assert.doesNotMatch(code, /Date\.now|new Date|Math\.random|crypto|performance\./);
});

test("imutabilitate: mesajul și expeditorul sunt înghețate", () => {
  const result = message({ sender: { name: "Ghidul TEST" } });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.sender));
  assert.throws(() => { result.text = "alt"; }, TypeError);
  assert.throws(() => { result.sender.name = "alt"; }, TypeError);
  assert.throws(() => { result.actions = []; }, TypeError);
});

/* ---------- GameEvent ≠ GameMessage ---------- */

test("GameEvent ≠ GameMessage: obiecte distincte, cu forme diferite; evenimentul nu este modificat", () => {
  const event = createGameEvent("player_arrived", { locationId: "loc-a", source: "gps" }, { seq: 3, at: 4000, cause: "gps_position" });
  const eventCopy = structuredClone(event);
  const result = createGameMessage({ source: [event.type, event.payload.locationId], text: "Ai ajuns.", category: "position", at: event.at });

  assert.notEqual(result, event);
  assert.deepEqual(Object.keys(result).sort(), ["at", "category", "id", "importance", "sender", "text"]);
  for (const key of ["type", "payload", "seq", "cause"]) assert.equal(Object.hasOwn(result, key), false, key);
  assert.deepEqual(event, eventCopy);
  assert.ok(Object.isFrozen(event));
  // Un GameEvent nu poate fi folosit direct ca GameMessage.
  assert.throws(() => createGameMessage(event), /nu face parte din model/);
});
