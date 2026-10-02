/*
 * M4 — Message Engine (D-082, D-085, D-087, D-088, D-092, D-097): GameEvent[] → GameMessage[].
 *
 * Mesajele vin numai din conținut: regulile `show_message` care au rulat (source ["rule", id, acțiune],
 * aceeași cheie ca jurnalul) și textul indiciilor (source ["hint", misiune, index]). Identitatea nu depinde
 * de seq sau de timp; între apeluri nu se păstrează nimic (fără stare de deduplicare — aceea este M5).
 *
 * Aventura: fixture-ul fictiv tests/fixtures/adventure-v2-demo.json (nemodificat; copii în memorie unde e nevoie).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { processGameEvents, EVENT_MESSAGE_ROUTES } from "../src/js/message-engine.js";
import { createGameEvent, EVENT_TYPES } from "../src/js/events.js";
import { MESSAGE_CATEGORIES, MESSAGE_IMPORTANCE } from "../src/js/game-message.js";
import { createGame, createInitialState } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { buildViewModel } from "../src/js/view-model.js";

const rawFixture = JSON.parse(await readFile(new URL("./fixtures/adventure-v2-demo.json", import.meta.url), "utf8"));
const fixture = toAdventureV2(rawFixture);
const content = withoutAnswers(fixture);
const narratorText = (messageId) => fixture.narrator.messages[messageId].text;

const NEAR_PIATA = { lat: 0.001, lng: 0.0022, accuracy: 8 };
const FAR = { lat: 0.02, lng: 0.02, accuracy: 8 };

/** Un joc real pe fixture; fiecare tranzacție → { events, messages } prin Message Engine. */
function playable({ adventure = fixture, savedState = null } = {}) {
  let clock = 1_000;
  const game = createGame({ adventure: withoutAnswers(adventure), validator: createLocalValidator(adventure), savedState, now: () => (clock += 1_000) });
  const batches = [];
  game.subscribe((state, events) => batches.push({ state, events, messages: processGameEvents(events, { content: game.content, state }) }));
  return { game, batches, last: () => batches[batches.length - 1] };
}

/** Starea în care regulile date au rulat (pentru evenimente sintetice). */
function stateWithFired(...ruleIds) {
  const state = createInitialState(fixture);
  for (const id of ruleIds) state.firedEvents[id] = 1;
  return state;
}

const event = (type, payload, meta = {}) => createGameEvent(type, payload, { seq: 1, at: 1000, ...meta });
const ids = (messages) => messages.map((m) => m.id);

/* ---------- A / B: eveniment → mesaj sau nimic ---------- */

test("eveniment → mesaj: adventure_started produce mesajul de introducere din conținut (regula ev-start)", () => {
  const { game, last } = playable();
  game.start();
  const { events, messages } = last();
  assert.deepEqual(events.map((e) => e.type), ["adventure_started", "mission_started"]);
  assert.deepEqual(messages, [
    { id: "rule:ev-start:0", text: narratorText("intro"), category: "story", importance: "normal", sender: { name: "Centrala" }, at: events[0].at },
  ]);
});

test("evenimentele fără conținut de comunicare produc [] (fără texte generice inventate)", () => {
  const state = stateWithFired("ev-start", "ev-sosire-piata", "ev-aproape-piata");
  for (const e of [
    event("mission_unlocked", { missionId: "m-ceas", locationId: "loc-piata" }),
    event("mission_started", { missionId: "m-sosire", locationId: "loc-piata" }),
    event("location_unlocked", { locationId: "loc-cafenea" }),
    event("location_discovered", { locationId: "loc-piata", source: "gps" }),
    event("player_left_area", { locationId: "loc-piata", source: "gps", distanceMeters: 300, accuracyMeters: 8 }),
    event("adventure_completed", {}),
    // GPS pentru o locație fără regulă de mesaj.
    event("player_near_location", { locationId: "loc-cafenea", source: "gps", distanceMeters: 120, accuracyMeters: 8 }),
    event("player_arrived", { locationId: "loc-cafenea", source: "manual" }),
  ]) {
    assert.deepEqual(processGameEvents([e], { content, state }), [], e.type);
  }
  assert.deepEqual(processGameEvents([], { content, state }), []);
});

test("o regulă care nu a rulat nu produce mesaj (ca jurnalul); un indiciu fără text nu produce mesaj", () => {
  const notFired = createInitialState(fixture);
  assert.deepEqual(processGameEvents([event("adventure_started", {})], { content, state: notFired }), []);
  assert.deepEqual(processGameEvents([event("hint_requested", { missionId: "m-ceas", locationId: "loc-piata", hintIndex: 9 })], { content, state: notFired }), []);
  assert.deepEqual(processGameEvents([event("hint_requested", { missionId: "m-rapid", locationId: "loc-cafenea", hintIndex: 0 })], { content, state: notFired }), []);
});

/* ---------- C / H: mai multe evenimente, lanțuri, ordine ---------- */

test("un batch real: un mesaj per conținut, în ordinea evenimentelor; evenimentele fără conținut nu adaugă nimic", async () => {
  const { game, last } = playable();
  game.start();
  game.confirmArrival("loc-piata");
  await game.submitMissionAnswer("m-ceas", "raspuns-gresit");
  game.requestHint("m-ceas");
  await game.submitMissionAnswer("m-ceas", fixture.missions.find((m) => m.id === "m-ceas").answer);
  const { events, messages } = last();
  assert.deepEqual(events.map((e) => e.type), ["mission_completed", "mission_unlocked", "location_unlocked", "location_completed", "mission_unlocked"]);
  assert.deepEqual(messages.map((m) => [m.id, m.category, m.text]), [["rule:ev-cafenea-deblocata:2", "gameplay", narratorText("contact-intro")]]);
});

test("lanț mission_completed → mission_unlocked: mesajele urmează ordinea evenimentelor (nu id-ul, timpul sau regulile)", async () => {
  // Copie fictivă a fixture-ului, cu o regulă de mesaj și pe mission_unlocked (m-contact).
  const raw = structuredClone(rawFixture);
  raw.events.push({ id: "ev-test-deblocare", on: "mission_unlocked", where: { missionId: "m-contact" }, do: [{ action: "show_message", messageId: "correct-answer" }] });
  const adventure = toAdventureV2(raw);
  const { game, last } = playable({ adventure });
  game.start();
  game.confirmArrival("loc-piata");
  await game.submitMissionAnswer("m-ceas", adventure.missions.find((m) => m.id === "m-ceas").answer);
  assert.deepEqual(ids(last().messages), ["rule:ev-cafenea-deblocata:2", "rule:ev-test-deblocare:0"]);

  // Aceleași evenimente în ordine inversă, cu timpi descrescători: ordinea rezultatului = ordinea primită.
  const state = stateWithFired("ev-cafenea-deblocata", "ev-test-deblocare");
  const unlocked = event("mission_unlocked", { missionId: "m-contact", locationId: "loc-cafenea" }, { seq: 1, at: 9000 });
  const completed = event("mission_completed", { missionId: "m-ceas", locationId: "loc-piata" }, { seq: 2, at: 1000 });
  const messages = processGameEvents([unlocked, completed], { content: toAdventureV2(withoutAnswers(adventure)), state });
  assert.deepEqual(ids(messages), ["rule:ev-test-deblocare:0", "rule:ev-cafenea-deblocata:2"]);
  assert.deepEqual(messages.map((m) => m.at), [9000, 1000]);
});

/* ---------- D / E / F: identitate stabilă ---------- */

test("identitate: același input → același rezultat; Message Engine nu păstrează nimic între apeluri", () => {
  const state = stateWithFired("ev-start");
  const input = [event("adventure_started", {})];
  const first = processGameEvents(input, { content, state });
  const second = processGameEvents(input, { content, state });
  assert.deepEqual(first, second);
  assert.equal(first.length, 1); // același mesaj și la al doilea apel: deduplicarea nu este aici (M5)
});

test("seq diferit (1 vs 999) → același id", () => {
  const state = stateWithFired("ev-sosire-piata");
  const payload = { locationId: "loc-piata", source: "gps", distanceMeters: 5, accuracyMeters: 8 };
  const [a] = processGameEvents([event("player_arrived", payload, { seq: 1 })], { content, state });
  const [b] = processGameEvents([event("player_arrived", payload, { seq: 999 })], { content, state });
  assert.equal(a.id, "rule:ev-sosire-piata:0");
  assert.equal(a.id, b.id);
});

test("timp diferit → același id; at-ul mesajului este at-ul evenimentului", () => {
  const state = stateWithFired("ev-sosire-piata");
  const payload = { locationId: "loc-piata", source: "manual" };
  const [a] = processGameEvents([event("player_arrived", payload, { at: 1000 })], { content, state });
  const [b] = processGameEvents([event("player_arrived", payload, { at: 86_400_000 })], { content, state });
  assert.equal(a.id, b.id);
  assert.deepEqual([a.at, b.at], [1000, 86_400_000]);
});

test("indicii: [\"hint\", misiune, index] — același indiciu → același id, indicii diferite → id-uri diferite", () => {
  const state = createInitialState(fixture);
  const hint = (hintIndex, meta) => event("hint_requested", { missionId: "m-ceas", locationId: "loc-piata", hintIndex }, meta);
  const [first] = processGameEvents([hint(0, { seq: 3, at: 1000 })], { content, state });
  const [again] = processGameEvents([hint(0, { seq: 40, at: 5000 })], { content, state });
  const [second] = processGameEvents([hint(1)], { content, state });
  assert.equal(first.id, "hint:m-ceas:0");
  assert.equal(again.id, first.id);
  assert.equal(second.id, "hint:m-ceas:1");
  assert.equal(first.text, fixture.missions.find((m) => m.id === "m-ceas").hints[0].text);
  assert.deepEqual([first.category, first.sender], ["hint", null]);
});

test("răspunsuri greșite repetate (regulă once: false): același mesaj logic, același id", async () => {
  // Faptul salvat este regula rulată (firedEvents), nu fiecare încercare: nu există o identitate
  // stabilă per încercare fără seq / timp, deci repetarea este același mesaj (D-085; politica — M5).
  const { game, batches } = playable();
  game.start();
  game.confirmArrival("loc-piata");
  await game.submitMissionAnswer("m-ceas", "gresit-1");
  await game.submitMissionAnswer("m-ceas", "gresit-2");
  const [a, b] = batches.slice(-2).map((batch) => batch.messages);
  assert.deepEqual(ids(a), ["rule:ev-raspuns-gresit:0"]);
  assert.deepEqual(ids(b), ids(a));
  assert.notEqual(a[0].at, b[0].at);
});

/* ---------- G: GPS — re-emitere ---------- */

test("GPS: prima apropiere produce mesajul; ieșirea nu produce nimic; reintrarea produce același id (nu un mesaj nou)", () => {
  const { game, batches } = playable();
  game.start();
  game.reportPosition(NEAR_PIATA);
  game.reportPosition(FAR); // near → outside: tranzacție fără evenimente
  game.reportPosition(NEAR_PIATA); // reintrare: player_near_location re-emis
  const [, first, away, again] = batches;
  assert.deepEqual(first.events.map((e) => e.type), ["player_near_location"]);
  assert.deepEqual(ids(first.messages), ["rule:ev-aproape-piata:0"]);
  assert.deepEqual(away.messages, []);
  assert.deepEqual(again.events.map((e) => e.type), ["player_near_location"]);
  assert.deepEqual(ids(again.messages), ids(first.messages)); // același mesaj logic — M5 îl recunoaște după id
  assert.notEqual(again.events[0].seq, first.events[0].seq);
});

test("GPS: același eveniment de două ori în același batch → un singur mesaj (id-ul apare o dată per apel)", () => {
  const state = stateWithFired("ev-aproape-piata");
  const near = (seq) => event("player_near_location", { locationId: "loc-piata", source: "gps", distanceMeters: 120, accuracyMeters: 8 }, { seq });
  assert.deepEqual(ids(processGameEvents([near(1), near(2)], { content, state })), ["rule:ev-aproape-piata:0"]);
  // Între apeluri nu există memorie: fiecare apel produce mesajul, cu același id.
  assert.deepEqual(ids(processGameEvents([near(3)], { content, state })), ["rule:ev-aproape-piata:0"]);
});

test("GPS după reîncărcare: sosirea re-emisă produce același id ca înainte de reîncărcare", () => {
  const session1 = playable();
  session1.game.start();
  session1.game.confirmArrival("loc-piata");
  const before = session1.last().messages;
  session1.game.reportPosition(FAR); // plecare
  const saved = JSON.parse(JSON.stringify(session1.game.getState()));

  const session2 = playable({ savedState: saved });
  session2.game.reportPosition({ lat: 0.001, lng: 0.001, accuracy: 8 }); // revenire în zonă
  const after = session2.last();
  assert.ok(after.events.some((e) => e.type === "player_arrived"));
  assert.deepEqual(ids(after.messages), ids(before));
  assert.deepEqual(ids(before), ["rule:ev-sosire-piata:0"]);
});

/* ---------- I / J / K / L: categorie, importanță, expeditor, timp ---------- */

test("matricea acoperă exact cele 18 tipuri de evenimente, cu categorii și importanțe valide (M3)", () => {
  assert.deepEqual(Object.keys(EVENT_MESSAGE_ROUTES).sort(), [...EVENT_TYPES].sort());
  for (const [type, route] of Object.entries(EVENT_MESSAGE_ROUTES)) {
    assert.ok(MESSAGE_CATEGORIES.includes(route.category), type);
    assert.ok(MESSAGE_IMPORTANCE.includes(route.importance), type);
    assert.ok(Object.isFrozen(route), type);
  }
  assert.equal(EVENT_MESSAGE_ROUTES.hint_requested.own, "hint");
  assert.deepEqual(Object.entries(EVENT_MESSAGE_ROUTES).filter(([, r]) => r.own !== null).map(([type]) => type), ["hint_requested"]);
});

test("categoria și importanța vin din matrice, nu din interfață; importanța rămâne normal (conținutul nu o declară)", async () => {
  const { game, batches } = playable();
  game.start();
  game.reportPosition(NEAR_PIATA);
  game.confirmArrival("loc-piata");
  await game.submitMissionAnswer("m-ceas", "gresit");
  game.requestHint("m-ceas");
  const all = batches.flatMap((b) => b.messages);
  assert.deepEqual(all.map((m) => [m.id, m.category]), [
    ["rule:ev-start:0", "story"],
    ["rule:ev-aproape-piata:0", "position"],
    ["rule:ev-sosire-piata:0", "position"],
    ["rule:ev-raspuns-gresit:0", "gameplay"],
    ["hint:m-ceas:0", "hint"],
  ]);
  assert.ok(all.every((m) => m.importance === "normal"));
});

test("sender: narrator.name din conținut, ca date înghețate; fără narator → null; indiciile → null", () => {
  const state = stateWithFired("ev-start");
  const [withNarrator] = processGameEvents([event("adventure_started", {})], { content, state });
  assert.deepEqual(withNarrator.sender, { name: "Centrala" });
  assert.ok(Object.isFrozen(withNarrator.sender));
  const anonymous = { ...content, narrator: { messages: content.narrator.messages } };
  assert.equal(processGameEvents([event("adventure_started", {})], { content: anonymous, state })[0].sender, null);
});

test("at: fiecare mesaj are at-ul evenimentului care l-a produs (fără ceas nou)", async () => {
  const { game, batches } = playable();
  game.start();
  game.confirmArrival("loc-piata");
  game.requestHint("m-ceas");
  for (const { events, messages } of batches) {
    for (const message of messages) assert.ok(events.some((e) => e.at === message.at), message.id);
  }
  assert.equal(batches.flatMap((b) => b.messages).length, 3);
});

/* ---------- Jurnalul existent ---------- */

test("aceleași chei ca jurnalul naratorului (buildStory): mesajele regulilor nu sunt un al doilea sistem", async () => {
  const { game, batches } = playable();
  game.start();
  game.reportPosition(NEAR_PIATA);
  game.confirmArrival("loc-piata");
  await game.submitMissionAnswer("m-ceas", "gresit");
  await game.submitMissionAnswer("m-ceas", fixture.missions.find((m) => m.id === "m-ceas").answer);
  const story = buildViewModel({ content: game.content, state: game.getState() }).story;
  const fromJournal = new Map(story.entries.map((entry) => [`rule:${entry.key}`, entry.text]));
  const fromEngine = new Map(batches.flatMap((b) => b.messages).map((m) => [m.id, m.text]));
  assert.deepEqual([...fromEngine.keys()].sort(), [...fromJournal.keys()].sort());
  for (const [id, text] of fromEngine) assert.equal(text, fromJournal.get(id), id);
});

/* ---------- M / N: puritate, fără interfață ---------- */

test("puritate: evenimentele, conținutul și starea nu se modifică; jocul nu primește notificări noi", async () => {
  const { game, batches } = playable();
  game.start();
  game.confirmArrival("loc-piata");
  const { events, state } = batches[1];
  const snapshot = structuredClone({ events, content: game.content, state, gameState: game.getState() });
  processGameEvents(events, { content: game.content, state });
  assert.deepEqual({ events, content: game.content, state, gameState: game.getState() }, snapshot);
  assert.equal(batches.length, 2);
  assert.ok(events.every((e) => Object.isFrozen(e) && Object.isFrozen(e.payload)));
});

test("intrări invalide: listă, conținut, stare și GameEvent-uri (forma plată internă nu este acceptată)", () => {
  const state = createInitialState(fixture);
  assert.throws(() => processGameEvents(null, { content, state }), /listă/);
  assert.throws(() => processGameEvents([], { state }), /conținutul/);
  assert.throws(() => processGameEvents([], { content }), /starea/);
  assert.throws(() => processGameEvents([{ type: "adventure_started" }], { content, state }), /GameEvent invalid/);
  assert.throws(() => processGameEvents([{ type: "GAME_STARTED", payload: {}, seq: 1, at: 1 }], { content, state }), /GameEvent invalid/);
});

test("fără interfață (verificare în sursă): doar events.js și game-message.js; fără DOM, stocare, audio, ceas sau motor", async () => {
  const source = await readFile(new URL("../src/js/message-engine.js", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports.sort(), ["./events.js", "./game-message.js"]);
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\b(document|window|localStorage|sessionStorage|navigator|indexedDB|Audio|AudioContext|fetch)\b/);
  assert.doesNotMatch(code, /Date\.now|new Date|Math\.random|crypto/);
  assert.doesNotMatch(code, /\.(subscribe|reportPosition|confirmArrival|requestHint|submitAnswer|setItem|getItem)\(/);
  assert.doesNotMatch(code, /bra[sș]ov|centrala|ghidul/i); // fără texte sau personaje de aventură
});
