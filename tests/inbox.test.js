/*
 * M5 — Inbox / Conversation State (D-085, D-086, D-090, D-092): GameMessage[] → istoric persistent + citit / necitit.
 *
 * Inbox-ul are propria cheie (outdoor-escape:inbox:<id-aventură>), separată de Game State; deduplică după
 * GameMessage.id; un mesaj nou intră necitit și devine citit doar prin markMessageRead(id).
 * Integrarea cu interfața (M6) este simulată în teste ca în app.js: abonare → Message Engine → Inbox;
 * starea idle (reset / „Joacă din nou”) golește Inbox-ul odată cu progresul.
 *
 * Aventura: fixture-ul fictiv tests/fixtures/adventure-v2-demo.json.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createInbox, inboxStorageKey, INBOX_VERSION } from "../src/js/inbox.js";
import { createGameMessage, MESSAGE_CATEGORIES } from "../src/js/game-message.js";
import { processGameEvents } from "../src/js/message-engine.js";
import { createGameEvent } from "../src/js/events.js";
import { createGame, createInitialState, GameStatus } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createStorage, storageKey } from "../src/js/storage.js";

const fixture = toAdventureV2(JSON.parse(await readFile(new URL("./fixtures/adventure-v2-demo.json", import.meta.url), "utf8")));
const ADVENTURE = fixture.id;
const NEAR_PIATA = { lat: 0.001, lng: 0.0022, accuracy: 8 };
const AT_PIATA = { lat: 0.001, lng: 0.001, accuracy: 8 };
const FAR = { lat: 0.02, lng: 0.02, accuracy: 8 };
const answerOf = (missionId) => fixture.missions.find((m) => m.id === missionId).answer;

/** „localStorage” în memorie (doar șiruri), cu numărul de scrieri. */
function memoryBackend() {
  const map = new Map();
  const backend = {
    map,
    writes: 0,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { backend.writes += 1; map.set(key, String(value)); },
    removeItem: (key) => { backend.writes += 1; map.delete(key); },
  };
  return backend;
}

const msg = (name, overrides = {}) =>
  createGameMessage({ source: ["test", name], text: `Mesajul ${name}.`, category: "story", ...overrides });
const ids = (entries) => entries.map((m) => m.id);
const newInbox = (backend = memoryBackend()) => ({ backend, inbox: createInbox({ adventureId: ADVENTURE, backend }) });

/* ---------- A–I: ingestie, deduplicare, citit / necitit ---------- */

test("A. Inbox nou: 0 mesaje, 0 necitite; nimic scris în stocare", () => {
  const { inbox, backend } = newInbox();
  assert.deepEqual(inbox.getMessages(), []);
  assert.equal(inbox.unreadCount(), 0);
  assert.deepEqual(inbox.getState(), { version: INBOX_VERSION, messages: [] });
  assert.equal(backend.writes, 0);
});

test("B. un mesaj: intră necitit, cu forma GameMessage + read", () => {
  const { inbox } = newInbox();
  const a = msg("a", { at: 1000, sender: { name: "Ghidul TEST" } });
  const result = inbox.addMessages([a]);
  assert.deepEqual(inbox.getMessages(), [{ ...a, sender: { name: "Ghidul TEST" }, read: false }]);
  assert.deepEqual(result, { added: inbox.getMessages(), unreadCount: 1 });
  assert.equal(inbox.unreadCount(), 1);
});

test("C. mai multe mesaje: toate există, toate necitite", () => {
  const { inbox } = newInbox();
  inbox.addMessages([msg("a"), msg("b"), msg("c")]);
  assert.deepEqual(ids(inbox.getMessages()), ["test:a", "test:b", "test:c"]);
  assert.equal(inbox.unreadCount(), 3);
});

test("D. același id de două ori (în batch-uri diferite sau în același batch) → o singură intrare", () => {
  const { inbox, backend } = newInbox();
  inbox.addMessages([msg("a")]);
  const writes = backend.writes;
  const again = inbox.addMessages([msg("a")]);
  assert.deepEqual(again, { added: [], unreadCount: 1 });
  assert.equal(backend.writes, writes); // fără schimbare, fără scriere
  inbox.addMessages([msg("b"), msg("b", { text: "Altă variantă." })]);
  assert.deepEqual(ids(inbox.getMessages()), ["test:a", "test:b"]);
  assert.equal(inbox.getMessages()[1].text, "Mesajul b.");
  assert.equal(inbox.unreadCount(), 2);
});

test("E. același batch procesat de două ori → fără duplicate", () => {
  const { inbox } = newInbox();
  const batch = [msg("a"), msg("b"), msg("c")];
  inbox.addMessages(batch);
  const before = inbox.getState();
  assert.deepEqual(inbox.addMessages(batch).added, []);
  assert.deepEqual(inbox.getState(), before);
});

test("F. markMessageRead: mesajul devine citit, unreadCount scade; starea se salvează", () => {
  const { inbox, backend } = newInbox();
  inbox.addMessages([msg("a"), msg("b")]);
  assert.equal(inbox.markMessageRead("test:a"), true);
  assert.deepEqual(inbox.getMessages().map((m) => [m.id, m.read]), [["test:a", true], ["test:b", false]]);
  assert.equal(inbox.unreadCount(), 1);
  assert.equal(JSON.parse(backend.map.get(inboxStorageKey(ADVENTURE))).messages[0].read, true);
});

test("G. markMessageRead de două ori este idempotent (a doua oară: false, fără scriere)", () => {
  const { inbox, backend } = newInbox();
  inbox.addMessages([msg("a")]);
  inbox.markMessageRead("test:a");
  const state = inbox.getState();
  const writes = backend.writes;
  assert.equal(inbox.markMessageRead("test:a"), false);
  assert.deepEqual(inbox.getState(), state);
  assert.equal(backend.writes, writes);
});

test("H. markMessageRead pentru un id necunoscut: false, fără schimbare; un argument care nu e id → eroare", () => {
  const { inbox, backend } = newInbox();
  inbox.addMessages([msg("a")]);
  const state = inbox.getState();
  const writes = backend.writes;
  assert.equal(inbox.markMessageRead("test:necunoscut"), false);
  assert.deepEqual(inbox.getState(), state);
  assert.equal(backend.writes, writes);
  for (const bad of [undefined, null, 1, { id: "test:a" }]) assert.throws(() => inbox.markMessageRead(bad), /id-ul unui mesaj/);
});

test("I. un mesaj citit rămâne citit când același id sosește din nou (fără reset la necitit)", () => {
  const { inbox } = newInbox();
  inbox.addMessages([msg("a", { at: 1000 })]);
  inbox.markMessageRead("test:a");
  const result = inbox.addMessages([msg("a", { at: 9000, text: "Text nou." })]);
  assert.deepEqual(result, { added: [], unreadCount: 0 });
  assert.deepEqual(inbox.getMessages(), [{ ...msg("a", { at: 1000 }), read: true }]);
});

/* ---------- J–L: persistență ---------- */

test("J. persistență: o instanță nouă peste aceeași stocare încarcă mesajele și starea citit", () => {
  const backend = memoryBackend();
  const first = createInbox({ adventureId: ADVENTURE, backend });
  first.addMessages([msg("a"), msg("b")]);
  first.markMessageRead("test:a");
  const second = createInbox({ adventureId: ADVENTURE, backend });
  assert.deepEqual(second.getState(), first.getState());
  assert.deepEqual(JSON.parse(backend.map.get(inboxStorageKey(ADVENTURE))), {
    version: 1,
    messages: first.getMessages().map((m) => ({ ...m })),
  });
});

test("K. necititele rămân necitite după reîncărcare", () => {
  const backend = memoryBackend();
  createInbox({ adventureId: ADVENTURE, backend }).addMessages([msg("a")]);
  assert.equal(createInbox({ adventureId: ADVENTURE, backend }).unreadCount(), 1);
});

test("L. cititele rămân citite după reîncărcare", () => {
  const backend = memoryBackend();
  const inbox = createInbox({ adventureId: ADVENTURE, backend });
  inbox.addMessages([msg("a")]);
  inbox.markMessageRead("test:a");
  const reloaded = createInbox({ adventureId: ADVENTURE, backend });
  assert.equal(reloaded.unreadCount(), 0);
  assert.equal(reloaded.getMessages()[0].read, true);
  // Reîncărcarea nu scrie și nu schimbă nimic.
  const writes = backend.writes;
  createInbox({ adventureId: ADVENTURE, backend });
  assert.equal(backend.writes, writes);
});

test("cheia Inbox-ului este separată de cea a progresului și depinde de aventură", () => {
  assert.equal(inboxStorageKey(ADVENTURE), `outdoor-escape:inbox:${ADVENTURE}`);
  assert.notEqual(inboxStorageKey(ADVENTURE), storageKey(ADVENTURE));
  const backend = memoryBackend();
  createInbox({ adventureId: "aventura-a", backend }).addMessages([msg("a")]);
  assert.deepEqual(createInbox({ adventureId: "aventura-b", backend }).getMessages(), []);
  assert.throws(() => createInbox({ backend }), /id-ul aventurii/);
});

/* ---------- N–P: identitate, categorii, ordine ---------- */

test("N. aceeași identitate indiferent de seq, at sau ordinea procesării", () => {
  const { inbox } = newInbox();
  const content = withoutAnswers(fixture);
  const state = createInitialState(fixture);
  state.firedEvents["ev-sosire-piata"] = 1;
  const arrived = (seq, at) => createGameEvent("player_arrived", { locationId: "loc-piata", source: "gps" }, { seq, at });
  inbox.addMessages(processGameEvents([arrived(1, 1000)], { content, state }));
  inbox.addMessages(processGameEvents([arrived(999, 50_000)], { content, state }));
  assert.deepEqual(ids(inbox.getMessages()), ["rule:ev-sosire-piata:0"]);
  assert.equal(inbox.getMessages()[0].at, 1000); // prima apariție rămâne

  const reversed = newInbox().inbox;
  reversed.addMessages([msg("b"), msg("a")]);
  reversed.addMessages([msg("a"), msg("b")]);
  assert.deepEqual(ids(reversed.getMessages()), ["test:b", "test:a"]);
});

test("O. toate categoriile coexistă într-o singură listă (categoria este doar un filtru, nu un folder)", () => {
  const { inbox, backend } = newInbox();
  inbox.addMessages(MESSAGE_CATEGORIES.map((category) => msg(category, { category })));
  assert.deepEqual(inbox.getMessages().map((m) => m.category), [...MESSAGE_CATEGORIES]);
  const saved = JSON.parse(backend.map.get(inboxStorageKey(ADVENTURE)));
  assert.deepEqual(Object.keys(saved).sort(), ["messages", "version"]);
  assert.equal(saved.messages.length, 5);
  assert.deepEqual(inbox.getMessages().filter((m) => m.category === "hint").map((m) => m.id), ["test:hint"]);
});

test("P. ordinea: ordinea intrării în Inbox, nu at-ul; mesajele cu același at își păstrează ordinea", () => {
  const { inbox } = newInbox();
  inbox.addMessages([msg("tarziu", { at: 9000 }), msg("fara-timp")]);
  inbox.addMessages([msg("devreme", { at: 1000 }), msg("egal-1", { at: 5000 }), msg("egal-2", { at: 5000 })]);
  assert.deepEqual(ids(inbox.getMessages()), ["test:tarziu", "test:fara-timp", "test:devreme", "test:egal-1", "test:egal-2"]);
  assert.equal(inbox.getMessages()[1].at, null); // Inbox-ul nu generează timpi
});

/* ---------- Q: reset ---------- */

test("Q. clear(): istoricul se golește și cheia se șterge; un mesaj care revine este din nou necitit", () => {
  const backend = memoryBackend();
  backend.map.set(storageKey(ADVENTURE), "{\"progres\":true}");
  const inbox = createInbox({ adventureId: ADVENTURE, backend });
  inbox.addMessages([msg("a")]);
  inbox.markMessageRead("test:a");
  assert.equal(inbox.clear(), true);
  assert.deepEqual(inbox.getMessages(), []);
  assert.equal(backend.map.has(inboxStorageKey(ADVENTURE)), false);
  assert.equal(backend.map.get(storageKey(ADVENTURE)), "{\"progres\":true}"); // progresul nu este atins
  inbox.addMessages([msg("a")]);
  assert.equal(inbox.unreadCount(), 1);
});

/* ---------- Validare și stocare ---------- */

test("validare: doar GameMessage-uri valide (forma M3); batch-ul este atomic", () => {
  const { inbox, backend } = newInbox();
  const valid = msg("a");
  for (const bad of [null, "text", 42, [], {}, { ...valid, id: undefined }, { ...valid, text: "" }, { ...valid, text: 1 }]) {
    assert.throws(() => inbox.addMessages([bad]), /GameMessage valid/);
  }
  for (const id of ["", "a b", ":a", "a:", "a::b", 7]) assert.throws(() => inbox.addMessages([{ ...valid, id }]), /id invalid/);
  for (const key of ["read", "notified", "actions", "seq", "persistent"]) {
    assert.throws(() => inbox.addMessages([{ ...valid, [key]: true }]), /din afara modelului/, key);
  }
  assert.throws(() => inbox.addMessages([{ ...valid, category: "reward" }]), /categorie/);
  assert.throws(() => inbox.addMessages([{ ...valid, importance: "high" }]), /importanță/);
  for (const sender of [{}, { name: "" }, { name: "X", avatar: "x.png" }, "X"]) assert.throws(() => inbox.addMessages([{ ...valid, sender }]), /sender/);
  assert.throws(() => inbox.addMessages([{ ...valid, at: "acum" }]), /at invalid/);
  for (const notAList of [null, valid, "x"]) assert.throws(() => inbox.addMessages(notAList), /listă/);
  // Un mesaj invalid în batch: nimic nu se adaugă, nimic nu se scrie.
  assert.throws(() => inbox.addMessages([msg("b"), { ...valid, text: "" }]), /mesajul 1/);
  assert.deepEqual(inbox.getMessages(), []);
  assert.equal(backend.writes, 0);
});

test("stocare: date corupte, versiune necunoscută, intrări invalide sau repetate; backend indisponibil", (t) => {
  t.mock.method(console, "warn", () => {});
  const key = inboxStorageKey(ADVENTURE);
  const load = (raw) => {
    const backend = memoryBackend();
    backend.map.set(key, raw);
    return createInbox({ adventureId: ADVENTURE, backend }).getMessages();
  };
  const entry = { ...msg("a"), read: true };
  assert.deepEqual(load("{corupt"), []);
  assert.deepEqual(load(JSON.stringify({ version: 2, messages: [entry] })), []);
  assert.deepEqual(load(JSON.stringify({ messages: [entry] })), []);
  assert.deepEqual(
    load(JSON.stringify({ version: 1, messages: [entry, { ...entry, text: "dublură" }, { ...msg("b"), read: "da" }, { ...msg("c") }, null, { ...msg("d"), read: false }] })),
    [entry, { ...msg("d"), read: false }]
  );

  // Fără backend sau cu un backend care aruncă: Inbox-ul funcționează în memorie, fără excepții.
  const memoryOnly = createInbox({ adventureId: ADVENTURE, backend: null });
  memoryOnly.addMessages([msg("a")]);
  assert.equal(memoryOnly.markMessageRead("test:a"), true);
  assert.equal(memoryOnly.clear(), false);
  const broken = { getItem: () => { throw new Error("blocat"); }, setItem: () => { throw new Error("plin"); }, removeItem: () => { throw new Error("blocat"); } };
  const fragile = createInbox({ adventureId: ADVENTURE, backend: broken });
  assert.deepEqual(fragile.addMessages([msg("a")]).unreadCount, 1);
  assert.equal(fragile.clear(), false);
  assert.deepEqual(fragile.getMessages(), []);
});

test("intrările sunt înghețate, fără câmpuri de notificare; datele primite nu sunt modificate", () => {
  const { inbox } = newInbox();
  const input = { ...msg("a", { sender: { name: "Ghidul TEST" } }), sender: { name: "Ghidul TEST" } };
  const snapshot = structuredClone(input);
  inbox.addMessages([input]);
  input.sender.name = "Altcineva";
  assert.deepEqual(input, { ...snapshot, sender: { name: "Altcineva" } });
  const [entry] = inbox.getMessages();
  assert.deepEqual(Object.keys(entry).sort(), ["at", "category", "id", "importance", "read", "sender", "text"]);
  assert.equal(entry.sender.name, "Ghidul TEST");
  assert.ok(Object.isFrozen(entry) && Object.isFrozen(entry.sender));
  assert.throws(() => { entry.read = true; }, TypeError);
  inbox.getMessages().push("intrus");
  assert.equal(inbox.getMessages().length, 1);
});

test("izolare (în sursă): doar game-message.js; fără motor, evenimente, Message Engine, DOM, audio sau ceas", async () => {
  const source = await readFile(new URL("../src/js/inbox.js", import.meta.url), "utf8");
  const imports = [...source.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./game-message.js"]);
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\b(document|window|navigator|Audio|AudioContext|Notification|fetch)\b/);
  assert.doesNotMatch(code, /Date\.now|new Date|Math\.random|crypto/);
  assert.doesNotMatch(code, /notified|notification|audioPlayed|gong/i);
});

/* ---------- Integrare cu M2 + M4 (simulează integrarea viitoare din app.js) ---------- */

/** O inițializare a aplicației: progres + Inbox peste același backend; abonarea ca în app.js. */
function bootApp(backend, clock) {
  const storage = createStorage(backend);
  const game = createGame({
    adventure: withoutAnswers(fixture),
    validator: createLocalValidator(fixture),
    savedState: storage.loadGame(ADVENTURE),
    now: () => (clock.value += 1_000),
  });
  const inbox = createInbox({ adventureId: ADVENTURE, backend });
  const added = [];
  game.subscribe((state, events) => {
    if (state.status === GameStatus.IDLE) {
      storage.resetGame(ADVENTURE);
      inbox.clear(); // reset / „Joacă din nou”: istoricul comunicării se golește odată cu progresul
      return;
    }
    storage.saveGame(ADVENTURE, state);
    added.push(...inbox.addMessages(processGameEvents(events, { content: game.content, state })).added);
  });
  return { game, inbox, storage, added };
}

async function playToTheEnd({ game }) {
  game.start(); // intro
  game.reportPosition(NEAR_PIATA); // apropiere
  game.reportPosition(FAR);
  game.reportPosition(NEAR_PIATA); // reintrare: același mesaj
  game.reportPosition(AT_PIATA); // sosire
  await game.submitMissionAnswer("m-ceas", "gresit-1"); // răspuns greșit
  await game.submitMissionAnswer("m-ceas", "gresit-2"); // același mesaj (M4, once: false)
  game.requestHint("m-ceas"); // indiciu
  await game.submitMissionAnswer("m-ceas", answerOf("m-ceas")); // progres: contactul
  game.next();
  await game.submitMissionAnswer("m-contact", answerOf("m-contact"));
  game.next();
  await game.submitMissionAnswer("m-final", answerOf("m-final")); // final
}

const FULL_HISTORY = [
  ["rule:ev-start:0", "story"],
  ["rule:ev-aproape-piata:0", "position"],
  ["rule:ev-sosire-piata:0", "position"],
  ["rule:ev-raspuns-gresit:0", "gameplay"],
  ["hint:m-ceas:0", "hint"],
  ["rule:ev-cafenea-deblocata:2", "gameplay"],
  ["rule:ev-final:1", "gameplay"],
];

test("integrare M4 → M5: intro, apropiere, sosire, răspuns greșit, indiciu, progres, final — fără transformări", async () => {
  const app = bootApp(memoryBackend(), { value: 1_000 });
  await playToTheEnd(app);
  assert.equal(app.game.getState().status, GameStatus.COMPLETED);
  assert.deepEqual(app.inbox.getMessages().map((m) => [m.id, m.category]), FULL_HISTORY);
  assert.deepEqual(ids(app.added), FULL_HISTORY.map(([id]) => id)); // fiecare intrare adăugată o singură dată
  assert.equal(app.inbox.unreadCount(), FULL_HISTORY.length);
  assert.equal(app.inbox.getMessages().at(-1).text, fixture.narrator.messages.finale.text);
});

test("reîncărcare: progresul și Inbox-ul se restaurează independent; fără duplicate, fără schimbarea stării citit", async () => {
  const backend = memoryBackend();
  const clock = { value: 1_000 };
  const first = bootApp(backend, clock);
  first.game.start();
  first.game.reportPosition(AT_PIATA);
  first.inbox.markMessageRead("rule:ev-start:0");
  first.inbox.markMessageRead("rule:ev-sosire-piata:0");
  first.game.reportPosition(FAR); // plecare
  const before = first.inbox.getState();

  // „Închiderea paginii”: rămâne doar backend-ul.
  const second = bootApp(backend, clock);
  assert.equal(second.game.getState().locations["loc-piata"].status, "discovered");
  assert.deepEqual(second.inbox.getState(), before); // nimic regenerat, nimic marcat
  assert.equal(second.inbox.unreadCount(), 0);
  assert.deepEqual(second.added, []);

  // Reintrare GPS după reîncărcare: același id, deja citit → nicio intrare nouă.
  second.game.reportPosition(AT_PIATA);
  assert.deepEqual(second.inbox.getState(), before);
  assert.deepEqual(second.added, []);

  // Un fapt nou după reîncărcare intră normal, necitit.
  await second.game.submitMissionAnswer("m-ceas", "gresit");
  assert.deepEqual(ids(second.added), ["rule:ev-raspuns-gresit:0"]);
  assert.equal(second.inbox.unreadCount(), 1);
});

test("reset / „Joacă din nou”: progresul și istoricul comunicării se golesc împreună; noua parcurgere pornește necitită", async () => {
  const backend = memoryBackend();
  const app = bootApp(backend, { value: 1_000 });
  await playToTheEnd(app);
  for (const message of app.inbox.getMessages()) app.inbox.markMessageRead(message.id);

  app.game.reset(); // ca resetEverything() din app.js
  assert.equal(backend.map.has(storageKey(ADVENTURE)), false);
  assert.equal(backend.map.has(inboxStorageKey(ADVENTURE)), false);
  assert.deepEqual(app.inbox.getMessages(), []);

  app.game.start();
  assert.deepEqual(app.inbox.getMessages().map((m) => [m.id, m.read]), [["rule:ev-start:0", false]]);
});

test("M. izolarea de Game State: Inbox-ul nu apare în stare, nu o modifică și nu produce evenimente", async () => {
  const backend = memoryBackend();
  const app = bootApp(backend, { value: 1_000 });
  const notifications = [];
  app.game.subscribe((state, events) => notifications.push(events));
  app.game.start();
  const state = app.game.getState();
  assert.deepEqual(Object.keys(state).sort(), Object.keys(createInitialState(fixture)).sort());
  for (const key of ["messages", "messageIds", "inbox", "unreadMessages", "read"]) assert.equal(key in state, false, key);

  app.inbox.markMessageRead("rule:ev-start:0");
  app.inbox.addMessages([msg("extra")]);
  app.inbox.clear();
  assert.deepEqual(app.game.getState(), state); // starea jocului neschimbată
  assert.equal(notifications.length, 1); // doar tranzacția start(); Inbox-ul nu emite nimic
  const saved = JSON.parse(backend.map.get(storageKey(ADVENTURE)));
  assert.deepEqual(Object.keys(saved).sort(), Object.keys(createInitialState(fixture)).sort());
});
