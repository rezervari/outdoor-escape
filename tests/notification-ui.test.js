/*
 * M7 — integrarea notificării (D-104 – D-107): GameEvent → Message Engine → Inbox.addMessages → added
 * → render → Notification Policy → toast / anunț / gong.
 *
 * 1. Orchestrarea din app.js, reprodusă fără DOM (ca în inbox-ui.test.js): prezentarea activă, gong-ul
 *    simulat și anunțurile sunt numărate; contextul interfeței (viewer, audio de misiune, pagină ascunsă)
 *    este setat de test, Inbox-ul deschis vine din „interfață”.
 * 2. Verificări în sursă: app.js, index.html, app.css, sw.js.
 *
 * Aventura: fixture-ul fictiv tests/fixtures/adventure-v2-demo.json.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { evaluateNotification, describeAnnouncement, describeNotification, NotificationOutcome } from "../src/js/notification-policy.js";
import { createGong } from "../src/js/gong.js";
import { describeInbox } from "../src/js/inbox-ui.js";
import { describePlayUi } from "../src/js/play-ui.js";
import { buildViewModel, View } from "../src/js/view-model.js";
import { createInbox } from "../src/js/inbox.js";
import { processGameEvents } from "../src/js/message-engine.js";
import { createGame, GameStatus } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createStorage } from "../src/js/storage.js";

const fixture = toAdventureV2(JSON.parse(await readFile(new URL("./fixtures/adventure-v2-demo.json", import.meta.url), "utf8")));
const ID = fixture.id;
const NEAR_PIATA = { lat: 0.001, lng: 0.0022, accuracy: 8 };
const FAR = { lat: 0.02, lng: 0.02, accuracy: 8 };
const answer = (id) => fixture.missions.find((m) => m.id === id).answer;
const source = async (path) => (await readFile(new URL(path, import.meta.url), "utf8"));
const appSource = await source("../src/js/app.js");
const html = (await source("../src/index.html")).replace(/<!--[\s\S]*?-->/g, "");
const css = await source("../src/css/app.css");
const sw = await source("../src/sw.js");

function memoryBackend() {
  const map = new Map();
  return { map, getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
}

/** O pornire a aplicației, ca în app.js: abonare → Inbox → desenare → notificare. */
function bootApp(backend, { gong: gongBehavior = "ok", clock = { value: 1_000 }, player = null } = {}) {
  const storage = createStorage(backend);
  const game = createGame({
    adventure: withoutAnswers(fixture),
    validator: createLocalValidator(fixture),
    savedState: storage.loadGame(ID),
    now: () => (clock.value += 1_000),
  });
  const inbox = createInbox({ adventureId: ID, backend });
  if (game.getState().status === GameStatus.IDLE) inbox.clear();

  const app = {
    game, inbox, inboxOpen: false, shownAsNew: [], view: null,
    context: { viewerOpen: false, missionAudioPlaying: false, pageHidden: false, puzzleOpen: false },
    presentation: null, presentations: 0, gongs: 0, announcements: [], errors: [],
  };
  const gong = {
    play() {
      app.gongs += 1;
      if (player) return player.play(); // gong.js real (AudioContext simulat)
      if (gongBehavior === "fail") return Promise.resolve(false); // autoplay blocat: gong abandonat
      return Promise.resolve(true);
    },
    stop() {
      if (player) player.stop();
    },
  };
  app.render = () => {
    const viewModel = buildViewModel({ content: game.content, state: game.getState() });
    if (!describePlayUi(viewModel, { inboxOpen: app.inboxOpen }).inbox.open) app.inboxOpen = false;
    const ui = describeInbox(inbox.getMessages(), { open: app.inboxOpen, shownAsNew: app.shownAsNew });
    for (const id of ui.toMarkRead) {
      inbox.markMessageRead(id);
      app.shownAsNew.push(id);
    }
    app.view = viewModel.view;
  };
  app.notify = (added, cause, status) => {
    try {
      const decision = evaluateNotification({ added, cause, status, context: { ...app.context, inboxOpen: app.inboxOpen }, presentation: app.presentation });
      if (decision.announcement) app.announcements.push(describeAnnouncement(decision.announcement));
      if (decision.outcome === NotificationOutcome.PRESENT) app.presentations += 1;
      app.presentation = decision.presentation;
      if (decision.gong) gong.play();
    } catch (error) {
      app.errors.push(error);
    }
  };
  game.subscribe((state, events) => {
    if (state.status === GameStatus.IDLE) storage.resetGame(ID);
    else storage.saveGame(ID, state);
    const added = events.length > 0 ? inbox.addMessages(processGameEvents(events, { content: game.content, state })).added : [];
    app.render();
    app.notify(added, events[0]?.cause ?? null, state.status);
  });
  app.closeToast = () => { app.presentation = null; }; // „✕” sau închiderea automată (interfață)
  app.openInbox = () => { app.presentation = null; app.inboxOpen = true; app.shownAsNew = []; app.render(); };
  app.closeInbox = () => { app.inboxOpen = false; app.shownAsNew = []; app.render(); };
  app.reset = () => {
    storage.resetGame(ID);
    inbox.clear();
    app.inboxOpen = false;
    app.shownAsNew = [];
    app.presentation = null; // resetNotifications(): prezentarea, anunțul și gong-ul în curs
    gong.stop();
    game.reset();
  };
  app.render();
  return app;
}

const unread = (app) => app.inbox.unreadCount();

test("intro (start): o prezentare, un gong, anunț polite cu expeditorul și textul complet", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  assert.equal(app.presentations, 1);
  assert.equal(app.gongs, 1);
  assert.equal(describeNotification(app.presentation).count, 1);
  assert.deepEqual(app.announcements, [{
    politeness: "polite", count: 1, items: [{ senderName: fixture.narrator.name, text: fixture.narrator.messages.intro.text }],
  }]);
  assert.equal(unread(app), 1); // toast-ul nu marchează nimic ca citit
});

test("absorbție: o tranzacție nouă cât toast-ul este activ → aceeași prezentare, fără al doilea gong", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  app.game.reportPosition(NEAR_PIATA); // mesaj de poziție, altă tranzacție
  assert.equal(app.presentations, 1);
  assert.equal(app.gongs, 1);
  assert.equal(describeNotification(app.presentation).count, 2);
  assert.equal(app.announcements.length, 2); // fiecare lot este anunțat o dată
  assert.equal(unread(app), 2);
});

test("GPS: reintrarea produce același id → added gol → fără notificare și fără gong; apropiere / sosire = loturi normale", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  app.closeToast();
  app.game.reportPosition(NEAR_PIATA);
  assert.equal(app.presentations, 2);
  app.closeToast();
  const [presentations, gongs, announcements] = [app.presentations, app.gongs, app.announcements.length];
  app.game.reportPosition(FAR);
  app.game.reportPosition(NEAR_PIATA); // reintrare
  assert.equal(app.presentations, presentations);
  assert.equal(app.gongs, gongs);
  assert.equal(app.announcements.length, announcements);
  assert.equal(app.presentation, null);
});

test("indiciu cerut (request_hint + hint): în Inbox, necitit, dar fără toast, gong sau anunț", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  app.game.confirmArrival("loc-piata");
  app.closeToast();
  const [presentations, gongs, announcements, before] = [app.presentations, app.gongs, app.announcements.length, unread(app)];
  app.game.requestHint("m-ceas");
  assert.equal(app.inbox.getMessages().at(-1).category, "hint");
  assert.equal(unread(app), before + 1);
  assert.equal(app.presentations, presentations);
  assert.equal(app.gongs, gongs);
  assert.equal(app.announcements.length, announcements);
});

test("răspuns greșit cu mesaj din conținut: prima dată notificat; repetat (același id) nimic", async () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  app.game.confirmArrival("loc-piata");
  app.closeToast();
  const gongs = app.gongs;
  await app.game.submitMissionAnswer("m-ceas", "răspuns greșit");
  assert.equal(app.inbox.getMessages().at(-1).id, "rule:ev-raspuns-gresit:0");
  assert.equal(app.gongs, gongs + 1);
  app.closeToast();
  await app.game.submitMissionAnswer("m-ceas", "alt răspuns greșit");
  assert.equal(app.gongs, gongs + 1);
  assert.equal(app.presentation, null);
});

test("audio de misiune în redare: toast și anunț, fără gong", () => {
  const app = bootApp(memoryBackend());
  app.context.missionAudioPlaying = true;
  app.game.start();
  assert.equal(app.presentations, 1);
  assert.equal(app.gongs, 0);
  assert.equal(app.announcements.length, 1);
});

test("puzzle overlay: toast permis, cu gong", async () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  app.game.confirmArrival("loc-piata");
  app.closeToast();
  app.context.puzzleOpen = true;
  const gongs = app.gongs;
  await app.game.submitMissionAnswer("m-ceas", answer("m-ceas")); // mesajul de după răspunsul corect
  assert.equal(describeNotification(app.presentation).count, 1);
  assert.equal(app.gongs, gongs + 1);
});

test("Inbox deschis: mesajul este desenat și citit; fără toast și gong; anunț polite", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  app.openInbox(); // închide prezentarea activă
  assert.equal(app.presentation, null);
  const [presentations, gongs] = [app.presentations, app.gongs];
  app.game.reportPosition(NEAR_PIATA);
  assert.equal(app.presentations, presentations);
  assert.equal(app.gongs, gongs);
  assert.equal(app.presentation, null);
  assert.equal(app.announcements.at(-1).politeness, "polite");
  assert.equal(unread(app), 0); // D-090: desenat cu panoul deschis → citit
});

test("viewer deschis / pagină ascunsă: nimic acum și nimic după închidere sau revenire; mesajul rămâne necitit", () => {
  for (const key of ["viewerOpen", "pageHidden"]) {
    const app = bootApp(memoryBackend());
    app.game.start();
    app.closeToast();
    const [presentations, gongs, announcements] = [app.presentations, app.gongs, app.announcements.length];
    app.context[key] = true;
    app.game.reportPosition(NEAR_PIATA);
    app.context[key] = false;
    app.render(); // viewer închis / pagină vizibilă: o desenare nu notifică
    assert.equal(app.presentations, presentations, key);
    assert.equal(app.gongs, gongs, key);
    assert.equal(app.announcements.length, announcements, key);
    assert.equal(unread(app), 2, key);
  }
});

test("viewer deschis peste o prezentare activă: prezentarea nu se modifică (fără absorbție)", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  const active = app.presentation;
  app.context.viewerOpen = true;
  app.game.reportPosition(NEAR_PIATA);
  assert.equal(app.presentation, active);
});

test("final: tranzacția care încheie aventura nu notifică; prezentarea activă se închide; mesajele rămân în Inbox", async () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  app.game.confirmArrival("loc-piata");
  await app.game.submitMissionAnswer("m-ceas", answer("m-ceas"));
  app.game.next();
  await app.game.submitMissionAnswer("m-contact", answer("m-contact"));
  app.game.next();
  assert.notEqual(app.presentation, null); // un toast încă activ înainte de final
  const [gongs, announcements] = [app.gongs, app.announcements.length];
  await app.game.submitMissionAnswer("m-final", answer("m-final")); // show_message + complete_adventure
  assert.equal(app.view, View.COMPLETED);
  assert.equal(app.presentation, null);
  assert.equal(app.gongs, gongs);
  assert.equal(app.announcements.length, announcements);
  assert.equal(app.inbox.getMessages().at(-1).id, "rule:ev-final:1");
  assert.equal(app.inbox.getMessages().at(-1).read, false);
});

test("reîncărcare: Inbox și necitit restaurate; fără toast, gong sau anunț", () => {
  const backend = memoryBackend();
  const clock = { value: 1_000 };
  const first = bootApp(backend, { clock });
  first.game.start();
  first.game.reportPosition(NEAR_PIATA);
  const second = bootApp(backend, { clock }); // „reload”
  assert.equal(second.inbox.unreadCount(), 2);
  assert.equal(second.presentation, null);
  assert.equal(second.presentations, 0);
  assert.equal(second.gongs, 0);
  assert.deepEqual(second.announcements, []);
  second.game.reportPosition(NEAR_PIATA); // aceeași stare observată din nou
  assert.equal(second.gongs, 0);
});

test("reset + parcurgere nouă: prezentarea se golește; mesajele sunt din nou noi → toast și gong", () => {
  const app = bootApp(memoryBackend());
  app.game.start();
  app.reset();
  assert.equal(app.presentation, null);
  assert.equal(app.view, View.INTRO);
  const gongs = app.gongs;
  app.game.start();
  assert.equal(app.gongs, gongs + 1);
  assert.equal(describeNotification(app.presentation).count, 1);
});

test("audio blocat: gong-ul se abandonează; toast-ul, anunțul, Inbox-ul și jocul continuă", () => {
  const app = bootApp(memoryBackend(), { gong: "fail" });
  app.game.start();
  assert.equal(app.presentations, 1);
  assert.equal(app.announcements.length, 1);
  assert.equal(unread(app), 1);
  assert.deepEqual(app.errors, []);
  app.game.confirmArrival("loc-piata");
  assert.equal(app.game.getState().status, GameStatus.PLAYING);
});

/* ---------- Gong-ul real (gong.js) cu un AudioContext simulat ---------- */

/** AudioContext simulat: pornește „suspendat”; reluarea se termină când testul o cere. Numără sunetele. */
function fakeAudio() {
  const audio = { contexts: [], sounds: 0 };
  audio.createContext = () => {
    const context = {
      state: "suspended", currentTime: 0, destination: {}, pending: [],
      resume() { return new Promise((resolve) => context.pending.push(() => { context.state = "running"; resolve(); })); },
      // Un sunet = ieșirea lui conectată la `destination` (o dată per gong).
      createGain: () => ({
        gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect(target) { if (target === context.destination) audio.sounds += 1; },
        disconnect() {},
      }),
      createOscillator: () => {
        context.oscillators += 1;
        return { frequency: {}, connect() {}, disconnect() {}, start() {}, stop() {} };
      },
      oscillators: 0,
    };
    audio.contexts.push(context);
    return context;
  };
  audio.startContext = () => { for (const finish of audio.contexts.at(-1).pending.splice(0)) finish(); };
  return audio;
}
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));

test("gong real: primul gest + intro în fereastra de pornire → un singur sunet; absorbția, duplicatele și re-randarea nu mai sună", async () => {
  const audio = fakeAudio();
  let now = 0;
  const player = createGong({ createContext: audio.createContext, now: () => now });
  const app = bootApp(memoryBackend(), { player });
  player.unlock(); // gestul „Începe aventura” (faza de captură), înaintea acțiunii butonului
  app.game.start(); // intro → prezentare nouă → play() cât contextul încă pornește
  now += 120; // contextul pornește în fereastra de 300 ms
  audio.startContext();
  await tick();
  assert.equal(audio.sounds, 1);
  // Fiecare sunet = un set de oscilatoare; un set nou ar însemna un gong nou.
  const oscillators = audio.contexts[0].oscillators;
  app.game.reportPosition(NEAR_PIATA); // absorbit în aceeași prezentare
  app.render(); // re-randare
  app.game.reportPosition(FAR);
  app.game.reportPosition(NEAR_PIATA); // reintrare: același id → added gol
  await tick();
  assert.equal(audio.contexts[0].oscillators, oscillators);
  assert.equal(app.gongs, 1, "play() apelat o singură dată (doar la prezentarea nouă)");
});

test("gong real: contextul nu pornește în fereastră → abandon, fără reîncercare; reîncărcarea nu reia nimic", async () => {
  const backend = memoryBackend();
  const audio = fakeAudio();
  let now = 0;
  const player = createGong({ createContext: audio.createContext, now: () => now });
  const app = bootApp(backend, { player });
  player.unlock();
  app.game.start();
  now += 5_000; // contextul pornește mult mai târziu (ex. la un gest ulterior)
  audio.startContext();
  await tick();
  assert.equal(audio.sounds, 0);
  assert.notEqual(app.presentation, null, "toast-ul rămâne: eșecul audio nu este eșecul notificării");
  await tick();
  assert.equal(audio.sounds, 0, "nicio reîncercare");

  const reloadAudio = fakeAudio();
  const reloaded = bootApp(backend, { player: createGong({ createContext: reloadAudio.createContext }) }); // „reload”
  reloaded.render();
  await tick();
  assert.equal(reloadAudio.contexts.length, 0); // niciun gest, nicio prezentare → niciun context, niciun sunet
  assert.equal(reloaded.gongs, 0);
});

test("gong real: resetul în fereastra de pornire anulează încercarea; parcurgerea nouă are propriul gong", async () => {
  const audio = fakeAudio();
  let now = 0;
  const player = createGong({ createContext: audio.createContext, now: () => now });
  const app = bootApp(memoryBackend(), { player });
  player.unlock();
  app.game.start(); // încercare în curs
  app.reset(); // resetNotifications() → gong.stop()
  now += 50;
  audio.startContext(); // contextul pornește în fereastră, dar încercarea a fost anulată
  await tick();
  assert.equal(audio.sounds, 0);
  app.game.start(); // parcurgere nouă: contextul rulează acum
  await tick();
  assert.equal(audio.sounds, 1);
});

/* ---------- 2. Sursa ---------- */

const fn = (name) => new RegExp(`function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}`).exec(appSource)[1];

test("app.js: notificarea primește doar `added`, `cause`, `status` și contextul de după desenare; gong doar din decizie", () => {
  const notify = fn("notify");
  assert.match(notify, /evaluateNotification\(\{ added, cause, status, context: notificationContext\(\), presentation: notification \}\)/);
  assert.doesNotMatch(notify, /firedEvents|unreadCount|getMessages|getState|storage|\.id\b/);
  assert.match(notify, /if \(decision\.gong\) gong\.play\(\);/);
  assert.match(notify, /catch \(error\)/); // o eroare a notificării nu oprește jocul
  assert.equal(appSource.match(/gong\.play\(/g).length, 1);
  assert.match(fn("receiveMessages"), /return inbox\.addMessages\(processGameEvents\(events, \{ content: game\.content, state \}\)\)\.added;/);
  const render = /function render\(\) \{([\s\S]*?)\n  \}/.exec(appSource)[1];
  assert.equal(appSource.match(/\bnotify\(/g).length, 2); // definiția + abonarea; nu din render
  assert.doesNotMatch(render, /notify\(|evaluateNotification/);
  assert.ok(render.indexOf("renderInbox(viewModel)") < render.indexOf("renderNotificationLayer()"));
  assert.ok(render.indexOf("renderNotificationLayer()") < render.indexOf("syncHistory(viewModel)"));
});

test("app.js: contextul vine din interfață (Inbox, viewer, puzzle, audio de misiune, pagină ascunsă)", () => {
  const context = fn("notificationContext");
  for (const key of ["inboxOpen", "viewerOpen: viewerKey !== null", "puzzleOpen: overlayOpen", "missionAudioPlaying", 'pageHidden: document.visibilityState === "hidden"']) {
    assert.ok(context.includes(key), key);
  }
  assert.match(context, /querySelectorAll\("audio"\)\]\.some\(\(audio\) => !audio\.paused && !audio\.ended\)/);
});

test("app.js: fără stare persistentă de notificare; reset și Inbox închid prezentarea; toast-ul nu este strat Back / Escape", () => {
  assert.doesNotMatch(appSource, /notified|gongPlayed|audioPlayed|notificationPlayed/);
  assert.doesNotMatch(appSource, /saveGame\([^)]*notification|setItem\([^)]*notification/i);
  assert.match(fn("resetEverything"), /inboxShownAsNew = \[\];\s*resetNotifications\(\);/);
  assert.match(fn("resetNotifications"), /closeNotification\(\);\s*clearAnnouncement\(\);\s*gong\.stop\(\);/);
  assert.match(fn("openInbox"), /closeNotification\(\);/);
  const popstate = /window\.addEventListener\("popstate", \(\) => \{([\s\S]*?)\n  \}\);/.exec(appSource)[1];
  const escape = /document\.addEventListener\("keydown", \(event\) => \{([\s\S]*?)\n  \}\);/.exec(appSource)[1];
  assert.doesNotMatch(popstate, /otification/);
  assert.doesNotMatch(escape, /otification/);
  assert.doesNotMatch(fn("showNotification"), /focus\(|inert|pushState/); // nu ia focusul, nu blochează nimic
  assert.match(fn("renderNotificationLayer"), /\$\("notification-live"\)\.inert = false;/);
});

test("app.js: toast temporar pentru normal / important, persistent pentru urgent; anunțul cu text integral", () => {
  assert.match(fn("restartNotificationTimer"), /describeNotification\(notification\)\.persistent\) return;/);
  assert.match(fn("restartNotificationTimer"), /setTimeout\(closeNotification, NOTIFICATION_DISMISS_MS\)/);
  const text = fn("announcementText");
  assert.match(text, /Mesaj nou de la \$\{senderName\}: \$\{text\}/);
  assert.match(text, /newMessagesLabel\(count\)/);
  assert.match(fn("announce"), /live\.setAttribute\("aria-live", pendingAnnouncement\.politeness\)/);
  assert.doesNotMatch(fn("announce"), /focus\(/);
});

test("app.js: sunetul se deblochează la primul gest explicit (captură), doar în memorie", () => {
  assert.match(appSource, /const AUDIO_UNLOCK_EVENTS = \["pointerdown", "pointerup", "keydown", "click"\];/);
  assert.match(appSource, /for \(const type of AUDIO_UNLOCK_EVENTS\) document\.addEventListener\(type, unlockAudio, true\);/);
  assert.match(fn("unlockAudio"), /gong\.unlock\(\)/);
  assert.doesNotMatch(fn("unlockAudio"), /storage|localStorage/);
});

test("index.html: toast-ul și regiunea live în afara <main>; toast-ul nu este dialog; jurnalul fără aria-live (D-107)", () => {
  const main = html.slice(html.indexOf("<main"), html.indexOf("</main>"));
  const afterMain = html.slice(html.indexOf("</main>"));
  assert.ok(!main.includes('id="notification"') && afterMain.includes('id="notification"'));
  const toast = /<div id="notification"[^>]*>/.exec(html)[0];
  assert.match(toast, /hidden/);
  assert.doesNotMatch(toast, /role=|aria-modal|aria-live|tabindex/);
  assert.match(afterMain, /<div id="notification-live" class="visually-hidden" aria-live="polite" aria-atomic="true"><\/div>/);
  assert.doesNotMatch(/<div id="notification-live"[^>]*>/.exec(html)[0], /hidden(?!")|inert/);
  assert.match(html, /id="btn-notification-open"[^>]*aria-controls="inbox-panel"/);
  assert.match(html, /id="btn-notification-close"[^>]*aria-label="Închide notificarea"/);
  // Jurnalul rămâne, doar vizual: nicio regiune live în panoul lui.
  const story = html.slice(html.indexOf('id="story-panel"'), html.indexOf("</section>", html.indexOf('id="story-panel"')));
  assert.ok(story.includes('id="story-latest"'));
  assert.doesNotMatch(story, /aria-live|role="status"|role="alert"/);
  assert.equal((html.match(/id="notification-live"/g) || []).length, 1);
});

test("app.css: toast fix, sus, între overlay-ul puzzle-ului (2000) și panoul „Mesaje” (2500); ținte de 44 px", () => {
  const block = (selector) => new RegExp(`\\n${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} \\{([^}]*)\\}`).exec(css)[1];
  const toast = block(".notification");
  assert.match(toast, /position: fixed;/);
  assert.match(toast, /top: max\(0\.5rem, env\(safe-area-inset-top\)\);/);
  const z = Number(/z-index: (\d+);/.exec(toast)[1]);
  assert.ok(z > 2000 && z < 2500, `z-index ${z}`);
  assert.match(block(".notification-actions .button"), /min-height: 2\.75rem;\s*min-width: 2\.75rem;/);
  assert.match(block(".visually-hidden"), /position: absolute;[\s\S]*clip-path: inset\(50%\);/);
  // M7-C.1: peste overlay-ul puzzle-ului, toast-ul pornește de la marginea stângă a foii și se oprește înaintea
  // butonului „Închide” (rezervă în rem); z-index-ul rămâne peste overlay; butoanele rămân interactive.
  const overlay = block('html[data-overlay="open"] .notification');
  assert.match(overlay, /right: auto;/);
  assert.match(overlay, /left: max\(0\.75rem, calc\(\(100% - 40rem\) \/ 2\)\);/);
  assert.match(overlay, /width: calc\(min\(100% - 1\.5rem, 40rem\) - var\(--puzzle-close-reserve\)\);/);
  assert.ok(Number(/--puzzle-close-reserve: ([\d.]+)rem;/.exec(overlay)[1]) >= 8, "rezervă pentru „Închide” (~7rem) + spațiere");
  assert.doesNotMatch(overlay, /z-index/);
  assert.doesNotMatch(css, /\.notification[^{]*\{[^}]*pointer-events:\s*none/);
});

test("sw.js: modulele noi sunt în SHELL_FILES", () => {
  const list = sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/)[1];
  assert.ok(list.includes('"js/notification-policy.js"'));
  assert.ok(list.includes('"js/gong.js"'));
});
