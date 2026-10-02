/*
 * M6 — integrarea GameEvent → Message Engine → Inbox → panoul „Mesaje” (D-082, D-086, D-090, D-092).
 *
 * 1. inbox-ui.js (pur): ce se desenează și ce devine citit.
 * 2. Orchestrarea din app.js, reprodusă fără DOM (ca în back-u2.test.js): abonarea cu batch-ul
 *    tranzacției, Inbox-ul unic, deschiderea panoului (desenare → apoi citit), resetul, reîncărcarea.
 * 3. Verificări în sursă: app.js face exact aceeași orchestrare; index.html are panoul și butonul.
 *
 * Aventura: fixture-ul fictiv tests/fixtures/adventure-v2-demo.json.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describeInbox } from "../src/js/inbox-ui.js";
import { describePlayUi, openLayers, planBack, Layer } from "../src/js/play-ui.js";
import { buildViewModel, View } from "../src/js/view-model.js";
import { createInbox, inboxStorageKey } from "../src/js/inbox.js";
import { processGameEvents } from "../src/js/message-engine.js";
import { createGameMessage, MESSAGE_CATEGORIES } from "../src/js/game-message.js";
import { createGame, GameStatus } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createStorage, storageKey } from "../src/js/storage.js";

const fixture = toAdventureV2(JSON.parse(await readFile(new URL("./fixtures/adventure-v2-demo.json", import.meta.url), "utf8")));
const ID = fixture.id;
const NEAR_PIATA = { lat: 0.001, lng: 0.0022, accuracy: 8 };
const AT_PIATA = { lat: 0.001, lng: 0.001, accuracy: 8 };
const FAR = { lat: 0.02, lng: 0.02, accuracy: 8 };
const source = async (path) => (await readFile(new URL(path, import.meta.url), "utf8"));
const appSource = await source("../src/js/app.js");
const html = (await source("../src/index.html")).replace(/<!--[\s\S]*?-->/g, "");

function memoryBackend() {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

const entry = (name, overrides = {}, read = false) => ({
  ...createGameMessage({ source: ["test", name], text: `Mesajul ${name}.`, category: "story", ...overrides }),
  read,
});

/* ---------- 1. inbox-ui.js (pur) ---------- */

test("M. Inbox gol: stare goală, 0 necitite, nimic de marcat", () => {
  assert.deepEqual(describeInbox([], { open: true }), { open: true, unreadCount: 0, empty: true, items: [], toMarkRead: [] });
  assert.equal(describeInbox([]).open, false);
});

test("listă: ordinea Inbox-ului, expeditorul doar din message.sender, „nou” = necitit", () => {
  const messages = [entry("a", { sender: { name: "Ghidul TEST" } }, true), entry("b", { category: "hint" })];
  const ui = describeInbox(messages);
  assert.equal(ui.unreadCount, 1);
  assert.equal(ui.empty, false);
  assert.deepEqual(ui.items, [
    { id: "test:a", senderName: "Ghidul TEST", text: "Mesajul a.", category: "story", importance: "normal", isNew: false },
    { id: "test:b", senderName: null, text: "Mesajul b.", category: "hint", importance: "normal", isNew: true },
  ]);
});

test("E. D-090: nimic nu devine citit cu panoul închis; deschis → doar mesajele necitite din listă", () => {
  const messages = [entry("a", {}, true), entry("b"), entry("c")];
  assert.deepEqual(describeInbox(messages, { open: false }).toMarkRead, []);
  assert.deepEqual(describeInbox(messages, { open: true }).toMarkRead, ["test:b", "test:c"]);
  // După marcare, mesajele afișate ca noi rămân „nou” cât timp panoul e deschis (stare efemeră).
  const after = describeInbox(messages.map((m) => ({ ...m, read: true })), { open: true, shownAsNew: ["test:b", "test:c"] });
  assert.deepEqual(after.items.map((i) => i.isNew), [false, true, true]);
  assert.deepEqual(after.toMarkRead, []);
});

test("J. toate cele 5 categorii se afișează în aceeași listă; K. expeditorul vine din date", () => {
  const messages = MESSAGE_CATEGORIES.map((category, i) => entry(category, { category, sender: i % 2 ? { name: `Expeditor ${i}` } : null }));
  const ui = describeInbox(messages, { open: true });
  assert.deepEqual(ui.items.map((i) => i.category), [...MESSAGE_CATEGORIES]);
  assert.deepEqual(ui.items.map((i) => i.senderName), [null, "Expeditor 1", null, "Expeditor 3", null]);
});

test("Back (U2): stratul „Mesaje” se închide cu Back; ordinea D-073 (viewer deasupra); nu există pe ecranul de start", () => {
  const vm = (view) => ({ view, puzzle: null, actions: {}, next: null, objective: null, mission: null });
  assert.deepEqual(openLayers(describePlayUi(vm(View.TRAVEL), { inboxOpen: true })), [Layer.INBOX]);
  assert.deepEqual(openLayers(describePlayUi(vm(View.COMPLETED), { inboxOpen: true })), [Layer.INBOX]);
  assert.deepEqual(openLayers(describePlayUi(vm(View.INTRO), { inboxOpen: true })), []);
  assert.deepEqual(openLayers(describePlayUi(vm(View.TRAVEL))), []);
  assert.deepEqual(Object.values(Layer), ["puzzle", "hint_confirm", "inbox", "viewer"]);
  assert.deepEqual(planBack([Layer.INBOX], 0), { close: [Layer.INBOX] });
});

/* ---------- 2. Orchestrarea din app.js, fără DOM ---------- */

/**
 * O inițializare a aplicației, ca startGame + setupGameUi: progres + un singur Inbox peste același
 * backend; abonarea (salvare, batch-ul tranzacției → Message Engine → Inbox, redesenare); panoul
 * „Mesaje” (desenare → apoi citit); resetEverything. `dom` = mesajele desenate în panoul deschis.
 */
function bootApp(backend, clock = { value: 1_000 }) {
  const storage = createStorage(backend);
  const game = createGame({
    adventure: withoutAnswers(fixture),
    validator: createLocalValidator(fixture),
    savedState: storage.loadGame(ID),
    now: () => (clock.value += 1_000),
  });
  const inbox = createInbox({ adventureId: ID, backend });
  if (game.getState().status === GameStatus.IDLE) inbox.clear();

  const app = { game, inbox, inboxOpen: false, shownAsNew: [], dom: null, badge: 0, engineCalls: 0, notifications: 0 };
  app.render = () => {
    const viewModel = buildViewModel({ content: game.content, state: game.getState() });
    if (!describePlayUi(viewModel, { inboxOpen: app.inboxOpen }).inbox.open) app.inboxOpen = false;
    const ui = describeInbox(inbox.getMessages(), { open: app.inboxOpen, shownAsNew: app.shownAsNew });
    app.dom = ui.open ? ui.items : null; // „DOM”: lista desenată în panoul afișat
    for (const id of ui.toMarkRead) {
      inbox.markMessageRead(id);
      app.shownAsNew.push(id);
    }
    app.badge = inbox.unreadCount();
    app.view = viewModel.view;
  };
  game.subscribe((state, events) => {
    app.notifications += 1;
    if (state.status === GameStatus.IDLE) storage.resetGame(ID);
    else storage.saveGame(ID, state);
    if (events.length > 0) {
      app.engineCalls += 1;
      inbox.addMessages(processGameEvents(events, { content: game.content, state }));
    }
    app.render();
  });
  app.openInbox = () => { app.inboxOpen = true; app.shownAsNew = []; app.render(); };
  app.closeInbox = () => { app.inboxOpen = false; app.shownAsNew = []; app.render(); };
  app.reset = () => {
    storage.resetGame(ID);
    inbox.clear();
    app.inboxOpen = false;
    app.shownAsNew = [];
    game.reset();
  };
  app.render();
  return app;
}

const ids = (app) => app.inbox.getMessages().map((m) => [m.id, m.read]);

test("A / B. runtime: start → GameEvent → Message Engine → Inbox → număr de necitite în interfață", () => {
  const app = bootApp(memoryBackend());
  assert.equal(app.badge, 0);
  app.game.start();
  assert.deepEqual(ids(app), [["rule:ev-start:0", false]]);
  assert.equal(app.badge, 1);
  assert.equal(app.dom, null); // panoul închis: nimic desenat, nimic citit
  app.game.reportPosition(NEAR_PIATA);
  assert.equal(app.badge, 2);
});

test("C. duplicate: reintrarea GPS și același batch procesat din nou nu adaugă mesaje și nu cresc numărul", () => {
  const app = bootApp(memoryBackend());
  const batches = [];
  app.game.subscribe((state, events) => batches.push({ state, events }));
  app.game.start();
  app.game.reportPosition(NEAR_PIATA);
  app.game.reportPosition(FAR);
  app.game.reportPosition(NEAR_PIATA); // același id ca prima apropiere
  assert.deepEqual(ids(app), [["rule:ev-start:0", false], ["rule:ev-aproape-piata:0", false]]);
  assert.equal(app.badge, 2);
  const { state, events } = batches[0];
  app.inbox.addMessages(processGameEvents(events, { content: app.game.content, state })); // același batch, a doua oară
  assert.equal(app.inbox.getMessages().length, 2);
  assert.equal(app.inbox.unreadCount(), 2);
});

test("batch gol (ex. near → outside): fără Message Engine, fără schimbări în Inbox; redesenarea are loc", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  app.game.reportPosition(NEAR_PIATA);
  const before = app.inbox.getState();
  const calls = app.engineCalls;
  const notifications = app.notifications;
  app.game.reportPosition(FAR); // tranzacție fără evenimente
  assert.equal(app.notifications, notifications + 1);
  assert.equal(app.engineCalls, calls);
  assert.deepEqual(app.inbox.getState(), before);
});

test("D. deschiderea panoului nu produce GameEvent / GameMessage și nu schimbă starea jocului", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  const state = app.game.getState();
  const [notifications, calls, count] = [app.notifications, app.engineCalls, app.inbox.getMessages().length];
  app.openInbox();
  app.closeInbox();
  app.openInbox();
  assert.deepEqual(app.game.getState(), state);
  assert.equal(app.notifications, notifications);
  assert.equal(app.engineCalls, calls);
  assert.equal(app.inbox.getMessages().length, count);
});

test("E. citit: doar după ce mesajul este desenat în panoul deschis; închis → noile mesaje rămân necitite", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  assert.deepEqual(ids(app), [["rule:ev-start:0", false]]);
  app.openInbox();
  assert.deepEqual(app.dom.map((i) => [i.id, i.isNew]), [["rule:ev-start:0", true]]); // desenat, marcat „nou”
  assert.deepEqual(ids(app), [["rule:ev-start:0", true]]); // apoi citit
  assert.equal(app.badge, 0);
  app.closeInbox();
  app.game.reportPosition(NEAR_PIATA); // panoul închis: mesajul nou rămâne necitit
  assert.deepEqual(ids(app), [["rule:ev-start:0", true], ["rule:ev-aproape-piata:0", false]]);
  assert.equal(app.badge, 1);
  app.openInbox();
  assert.deepEqual(app.dom.map((i) => [i.id, i.isNew]), [["rule:ev-start:0", false], ["rule:ev-aproape-piata:0", true]]);
  assert.equal(app.badge, 0);
  // Un mesaj care sosește cu panoul deschis este desenat imediat, deci citit.
  app.game.reportPosition(AT_PIATA);
  assert.equal(app.dom.at(-1).id, "rule:ev-sosire-piata:0");
  assert.equal(app.badge, 0);
});

test("F / G. reîncărcare: citit și necitit se păstrează; nimic nu se regenerează sau marchează", () => {
  const backend = memoryBackend();
  const clock = { value: 1_000 };
  const first = bootApp(backend, clock);
  first.game.start();
  first.openInbox(); // intro citit
  first.closeInbox();
  first.game.reportPosition(NEAR_PIATA); // necitit
  const before = first.inbox.getState();

  const second = bootApp(backend, clock); // „reload”
  assert.equal(second.game.getState().status, GameStatus.PLAYING);
  assert.deepEqual(second.inbox.getState(), before);
  assert.deepEqual(ids(second), [["rule:ev-start:0", true], ["rule:ev-aproape-piata:0", false]]);
  assert.equal(second.badge, 1);
  assert.equal(second.notifications, 0); // reîncărcarea nu produce tranzacții
});

test("H / I. reset: progres + Inbox goale, 0 necitite, panoul închis; noua parcurgere primește din nou intro-ul, necitit", () => {
  const backend = memoryBackend();
  const app = bootApp(backend);
  app.game.start();
  app.openInbox();
  app.reset();
  assert.equal(app.view, View.INTRO);
  assert.deepEqual(app.inbox.getMessages(), []);
  assert.equal(app.badge, 0);
  assert.equal(app.inboxOpen, false);
  assert.equal(backend.map.has(inboxStorageKey(ID)), false);
  assert.equal(backend.map.has(storageKey(ID)), false);
  app.game.start();
  assert.deepEqual(ids(app), [["rule:ev-start:0", false]]);
  assert.equal(app.badge, 1);
});

test("pornire fără parcurgere activă: istoricul rămas se golește; cu o parcurgere activă se păstrează", () => {
  const stale = memoryBackend();
  createInbox({ adventureId: ID, backend: stale }).addMessages([createGameMessage({ source: ["rule", "ev-start", 0], text: "Vechi.", category: "story" })]);
  const fresh = bootApp(stale); // fără progres salvat → idle
  assert.equal(fresh.game.getState().status, GameStatus.IDLE);
  assert.deepEqual(fresh.inbox.getMessages(), []);
  fresh.game.start();
  assert.deepEqual(ids(fresh), [["rule:ev-start:0", false]]); // nu „deja citit” dintr-o parcurgere veche

  const active = memoryBackend();
  bootApp(active).game.start();
  assert.equal(bootApp(active).inbox.getMessages().length, 1);
});

test("ecranul final: panoul există și după încheiere (mesajul de final rămâne accesibil)", async () => {
  const app = bootApp(memoryBackend());
  const answer = (id) => fixture.missions.find((m) => m.id === id).answer;
  app.game.start();
  app.game.confirmArrival("loc-piata");
  await app.game.submitMissionAnswer("m-ceas", answer("m-ceas"));
  app.game.next();
  await app.game.submitMissionAnswer("m-contact", answer("m-contact"));
  app.game.next();
  await app.game.submitMissionAnswer("m-final", answer("m-final"));
  assert.equal(app.view, View.COMPLETED);
  assert.equal(app.inbox.getMessages().at(-1).id, "rule:ev-final:1");
  app.openInbox();
  assert.equal(app.dom.at(-1).text, fixture.narrator.messages.finale.text);
  assert.equal(app.badge, 0);
});

/* ---------- 3. Sursa: app.js și index.html ---------- */

const fn = (name) => new RegExp(`function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}`).exec(appSource)[1];

test("app.js: un singur Inbox la pornire; abonarea trimite doar batch-ul nevid prin Message Engine în Inbox (apoi desenare și notificare — M7)", () => {
  assert.equal(appSource.match(/createInbox\(/g).length, 1);
  assert.match(appSource, /const inbox = createInbox\(\{ adventureId: adventure\.id \}\);\s*setupGameUi\(game, storage, inbox\);/);
  const subscribe = /game\.subscribe\(\(state, events\) => \{([\s\S]*?)\n  \}\);/.exec(appSource)[1];
  assert.match(subscribe, /const added = events\.length > 0 \? receiveMessages\(state, events\) : \[\];\s*render\(\);\s*notify\(added, events\[0\]\?\.cause \?\? null, state\.status\);/);
  const receive = fn("receiveMessages");
  assert.match(receive, /inbox\.addMessages\(processGameEvents\(events, \{ content: game\.content, state \}\)\)/);
  assert.doesNotMatch(receive, /markMessageRead|firedEvents|getMessages/);
  assert.equal(appSource.match(/processGameEvents\(/g).length, 1); // nu la randare, nu din evenimente istorice
});

test("app.js: citit doar în renderInbox, după desenarea listei; deschiderea / închiderea nu ating motorul", () => {
  assert.equal(appSource.match(/markMessageRead\(/g).length, 1);
  const render = fn("renderInbox");
  assert.ok(render.indexOf("replaceChildren") < render.indexOf("markMessageRead"), "lista se desenează înainte de marcare");
  assert.ok(render.indexOf("panel.hidden = !ui.open") < render.indexOf("markMessageRead"), "panoul se afișează înainte de marcare");
  assert.match(fn("renderInboxBadge"), /inbox\.unreadCount\(\)/);
  for (const name of ["openInbox", "closeInbox", "renderInbox", "inboxItem", "renderInboxBadge"]) {
    assert.doesNotMatch(fn(name), /game\.(?!content)|storage\.|localStorage|innerHTML/, name);
  }
  assert.doesNotMatch(fn("inboxItem"), /\.id\b/, "id-ul mesajului nu se afișează");
});

test("app.js: reset — inbox.clear() doar în resetEverything și la pornirea fără parcurgere activă", () => {
  assert.equal(appSource.match(/inbox\.clear\(\)/g).length, 2);
  assert.match(fn("resetEverything"), /storage\.resetGame\(adventure\.id\);\s*inbox\.clear\(\);\s*inboxOpen = false;/);
  assert.match(appSource, /if \(game\.getState\(\)\.status === GameStatus\.IDLE\) inbox\.clear\(\);/);
});

test("app.js: Back și Escape închid panoul (viewer → Mesaje → confirmare → overlay)", () => {
  const popstate = /window\.addEventListener\("popstate", \(\) => \{([\s\S]*?)\n  \}\);/.exec(appSource)[1];
  assert.ok(popstate.indexOf("closeViewer") < popstate.indexOf("closeInbox"));
  assert.ok(popstate.indexOf("closeInbox") < popstate.indexOf("cancelHintConfirm"));
  const escape = /document\.addEventListener\("keydown", \(event\) => \{([\s\S]*?)\n  \}\);/.exec(appSource)[1];
  assert.ok(escape.indexOf("closeViewer") < escape.indexOf("closeInbox"));
  assert.ok(escape.indexOf("closeInbox") < escape.indexOf("cancelHintConfirm"));
});

test("L. fără personaje în interfață: expeditorul vine doar din message.sender; audio doar prin gong.js (M7), fără notificări de browser", async () => {
  const inboxUi = await source("../src/js/inbox-ui.js");
  assert.deepEqual([...inboxUi.matchAll(/^import .* from "(.+)";$/gm)], []);
  const withoutComments = (code) => code.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  for (const code of [inboxUi, fn("inboxItem"), fn("renderInbox")].map(withoutComments)) {
    assert.doesNotMatch(code, /centrala|ghidul|narrator|characterId|personaj/i);
  }
  assert.match(inboxUi, /message\.sender \? message\.sender\.name : null/);
  // M7: notificarea din aplicație este toast + anunț; sunetul trece numai prin gong.js (Web Audio).
  // app.js nu folosește direct API-urile audio, notificările browserului, Push sau vibrațiile.
  assert.doesNotMatch(appSource, /new Audio\b|AudioContext|\bnew Notification\(|Notification\.(requestPermission|permission)|\.showNotification\(|pushManager|PushManager|vibrate\(/);
});

test("index.html: butonul „Mesaje” (accesibil, cu numărul de necitite) și panoul dialog în afara <main>, ascunse inițial", () => {
  assert.match(html, /<button type="button" class="button button-secondary inbox-toggle" id="btn-inbox"\s+aria-haspopup="dialog" aria-controls="inbox-panel" hidden>/);
  assert.match(html, /id="inbox-unread" class="inbox-unread" hidden/);
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  assert.ok(main.includes('id="btn-inbox"'));
  assert.ok(!main.includes('id="inbox-panel"'), "panoul stă în afara <main> (ca viewer-ul)");
  assert.match(html, /<div id="inbox-panel" class="inbox-panel" role="dialog" aria-modal="true" aria-labelledby="inbox-title" hidden>/);
  assert.match(html, /id="btn-inbox-close">Închide</);
  assert.match(html, /id="inbox-empty" class="inbox-empty" hidden>Nu ai mesaje încă\.</);
  assert.ok(html.includes('id="story-panel"'), "jurnalul existent rămâne");
});
