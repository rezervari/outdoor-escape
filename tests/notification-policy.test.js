/*
 * M7 — Notification Policy (D-104, D-105, D-106, D-107): modulul pur notification-policy.js.
 *
 * Intrarea: lotul `added` întors de Inbox, `cause` al tranzacției, starea jocului, contextul interfeței
 * (după desenare) și prezentarea activă. Ieșirea: nimic / anunț / prezentare nouă / absorbție, gong, anunț.
 * Mesajele sunt intrări Inbox construite din GameMessage-uri fictive.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  evaluateNotification,
  describeNotification,
  describeAnnouncement,
  notifiableMessages,
  maxImportance,
  NotificationOutcome,
  Politeness,
} from "../src/js/notification-policy.js";
import { createGameMessage, MESSAGE_IMPORTANCE } from "../src/js/game-message.js";
import { GameStatus } from "../src/js/game.js";

const PLAYING = GameStatus.PLAYING;
const entry = (name, overrides = {}) => ({
  ...createGameMessage({ source: ["test", name], text: `Textul complet al mesajului ${name}.`, category: "story", ...overrides }),
  read: false,
});
const story = entry("story", { sender: { name: "Expeditor TEST" } });
const gameplay = entry("gameplay", { category: "gameplay" });
const hint = entry("hint", { category: "hint" });
const important = entry("important", { importance: "important" });
const urgent = entry("urgent", { category: "alert", importance: "urgent" });
const evaluate = (input) => evaluateNotification({ status: PLAYING, cause: "gps_position", context: {}, presentation: null, ...input });

/* ---------- Intrarea ---------- */

test("lot gol: nimic (fără toast, gong sau anunț); prezentarea activă rămâne", () => {
  const none = evaluate({ added: [] });
  assert.equal(none.outcome, NotificationOutcome.NONE);
  assert.equal(none.presentation, null);
  assert.equal(none.gong, false);
  assert.equal(none.announcement, null);
  const active = evaluate({ added: [story] }).presentation;
  assert.equal(evaluate({ added: [], presentation: active }).presentation, active);
});

test("un mesaj: o prezentare nouă cu gong și anunț polite; toast-ul arată expeditorul și textul", () => {
  const decision = evaluate({ added: [story] });
  assert.equal(decision.outcome, NotificationOutcome.PRESENT);
  assert.equal(decision.gong, true);
  assert.deepEqual(decision.presentation, { messages: [story], importance: "normal" });
  assert.equal(decision.announcement.politeness, Politeness.POLITE);
  assert.deepEqual(describeNotification(decision.presentation), {
    count: 1, senderName: "Expeditor TEST", text: story.text, importance: "normal", persistent: false,
  });
  assert.deepEqual(describeAnnouncement(decision.announcement), {
    politeness: "polite", count: 1, items: [{ senderName: "Expeditor TEST", text: story.text }],
  });
});

test("mai multe mesaje în aceeași tranzacție (3, 10): o singură prezentare, cel mult un gong, anunț cu toate textele", () => {
  for (const count of [3, 10]) {
    const added = Array.from({ length: count }, (_, i) => entry(`m${i}`, i % 2 ? { sender: { name: "Expeditor TEST" } } : {}));
    const decision = evaluate({ added });
    assert.equal(decision.outcome, NotificationOutcome.PRESENT);
    assert.equal(decision.gong, true);
    assert.equal(decision.presentation.messages.length, count);
    const toast = describeNotification(decision.presentation);
    assert.equal(toast.count, count);
    assert.equal(toast.text, null); // toast-ul arată numărul, nu textele
    const spoken = describeAnnouncement(decision.announcement);
    assert.equal(spoken.count, count);
    assert.deepEqual(spoken.items.map((item) => item.text), added.map((message) => message.text)); // text integral, în ordine
    assert.deepEqual(spoken.items.map((item) => item.senderName), added.map((m) => (m.sender ? m.sender.name : null)));
  }
});

test("duplicate: un id deja cunoscut nu ajunge în `added` (Inbox), deci nu există notificare; politica nu deduplică", () => {
  // Inbox-ul întoarce added = [] pentru un mesaj repetat: nimic.
  assert.equal(evaluate({ added: [] }).outcome, NotificationOutcome.NONE);
  // Politica nu are un al doilea mecanism: ce primește în `added` este notificat ca atare.
  const decision = evaluate({ added: [story], presentation: evaluate({ added: [story] }).presentation });
  assert.equal(decision.outcome, NotificationOutcome.ABSORB);
});

test("request_hint + hint: fără notificare, fără gong, fără anunț", () => {
  const decision = evaluate({ added: [hint], cause: "request_hint" });
  assert.equal(decision.outcome, NotificationOutcome.NONE);
  assert.deepEqual(decision.messages, []);
  assert.equal(decision.gong, false);
  assert.equal(decision.announcement, null);
  assert.equal(decision.presentation, null);
});

test("request_hint + hint + alt mesaj: doar indiciul este scos; mesajul non-hint se notifică", () => {
  const decision = evaluate({ added: [hint, gameplay], cause: "request_hint" });
  assert.equal(decision.outcome, NotificationOutcome.PRESENT);
  assert.deepEqual(decision.messages, [gameplay]);
  assert.deepEqual(decision.presentation.messages, [gameplay]);
  assert.equal(decision.gong, true);
  assert.deepEqual(notifiableMessages([hint, gameplay], "request_hint"), [gameplay]);
});

test("hint fără request_hint (altă cauză) și request_hint fără hint: notificabile — doar combinația este excepția", () => {
  assert.equal(evaluate({ added: [hint], cause: "gps_position" }).outcome, NotificationOutcome.PRESENT);
  assert.equal(evaluate({ added: [hint], cause: null }).outcome, NotificationOutcome.PRESENT);
  assert.equal(evaluate({ added: [story], cause: "request_hint" }).outcome, NotificationOutcome.PRESENT);
});

test("categoria nu decide singură: position / gameplay / story / alert sunt notificabile, cu orice cauză", () => {
  for (const category of ["position", "gameplay", "story", "alert"]) {
    for (const cause of ["start", "submit_answer", "request_hint", "skip_mission", "fail_mission", "next", "gps_position", "confirm_arrival"]) {
      assert.equal(evaluate({ added: [entry(category, { category })], cause }).outcome, NotificationOutcome.PRESENT, `${category} / ${cause}`);
    }
  }
});

test("importanța: normal și important → polite, toast temporar; urgent → assertive, toast persistent; toate cu gong", () => {
  const cases = [
    [entry("normal"), "normal", Politeness.POLITE, false],
    [important, "important", Politeness.POLITE, false],
    [urgent, "urgent", Politeness.ASSERTIVE, true],
  ];
  for (const [message, importance, politeness, persistent] of cases) {
    const decision = evaluate({ added: [message] });
    assert.equal(decision.outcome, NotificationOutcome.PRESENT);
    assert.equal(decision.gong, true, importance);
    assert.equal(decision.presentation.importance, importance);
    assert.equal(decision.announcement.politeness, politeness);
    assert.equal(describeNotification(decision.presentation).persistent, persistent);
  }
  // Lotul ia importanța maximă: urgent > important > normal.
  assert.equal(evaluate({ added: [entry("a"), urgent, important] }).presentation.importance, "urgent");
  assert.equal(evaluate({ added: [entry("a"), important] }).announcement.politeness, Politeness.POLITE);
  assert.equal(maxImportance([]), "normal");
  assert.equal(maxImportance([important], "urgent"), "urgent");
  assert.deepEqual([...MESSAGE_IMPORTANCE], ["normal", "important", "urgent"]); // aceeași ordine ca modelul
});

/* ---------- Contextul (D-105) ---------- */

test("matricea D-105: toast / gong / anunț pentru fiecare context", () => {
  const rows = [
    // context, outcome, gong, anunț
    [{}, NotificationOutcome.PRESENT, true, Politeness.POLITE], // joc normal
    [{ puzzleOpen: true }, NotificationOutcome.PRESENT, true, Politeness.POLITE], // puzzle overlay
    [{ missionAudioPlaying: true }, NotificationOutcome.PRESENT, false, Politeness.POLITE], // doar gong-ul tace
    [{ puzzleOpen: true, missionAudioPlaying: true }, NotificationOutcome.PRESENT, false, Politeness.POLITE],
    [{ inboxOpen: true }, NotificationOutcome.ANNOUNCE, false, Politeness.POLITE], // doar anunț
    [{ viewerOpen: true }, NotificationOutcome.NONE, false, null],
    [{ pageHidden: true }, NotificationOutcome.NONE, false, null],
  ];
  for (const [context, outcome, gong, politeness] of rows) {
    const decision = evaluate({ added: [story], context });
    const label = JSON.stringify(context);
    assert.equal(decision.outcome, outcome, label);
    assert.equal(decision.gong, gong, label);
    assert.equal(decision.announcement ? decision.announcement.politeness : null, politeness, label);
    assert.equal(decision.presentation !== null, outcome === NotificationOutcome.PRESENT, label); // toast doar la prezentare
  }
  // Final: nimic.
  const final = evaluate({ added: [story], status: GameStatus.COMPLETED });
  assert.equal(final.outcome, NotificationOutcome.NONE);
  assert.equal(final.gong, false);
  assert.equal(final.announcement, null);
});

test("Inbox deschis: fără toast și gong; anunț polite (assertive pentru urgent); o prezentare activă se închide", () => {
  const active = evaluate({ added: [story] }).presentation;
  const decision = evaluate({ added: [gameplay], context: { inboxOpen: true }, presentation: active });
  assert.equal(decision.outcome, NotificationOutcome.ANNOUNCE);
  assert.equal(decision.presentation, null);
  assert.equal(decision.gong, false);
  assert.equal(evaluate({ added: [urgent], context: { inboxOpen: true } }).announcement.politeness, Politeness.ASSERTIVE);
});

test("viewer deschis / pagină ascunsă: lotul nu este prezentat; prezentarea activă rămâne neatinsă (fără amânare)", () => {
  const active = evaluate({ added: [story] }).presentation;
  for (const context of [{ viewerOpen: true }, { pageHidden: true }, { viewerOpen: true, inboxOpen: true }]) {
    const decision = evaluate({ added: [gameplay, urgent], context, presentation: active });
    assert.equal(decision.outcome, NotificationOutcome.NONE);
    assert.equal(decision.presentation, active); // aceeași prezentare, nemodificată (fără absorbție)
    assert.equal(decision.gong, false);
    assert.equal(decision.announcement, null);
  }
  // După închiderea viewer-ului nu se reia nimic: un lot gol nu produce nimic.
  assert.equal(evaluate({ added: [], presentation: null }).outcome, NotificationOutcome.NONE);
});

/* ---------- Prezentarea și absorbția (D-104) ---------- */

test("absorbție: o prezentare activă primește lotul nou — fără al doilea toast, fără al doilea gong; anunț doar pentru lotul nou", () => {
  const first = evaluate({ added: [story] });
  const second = evaluate({ added: [gameplay, hint], presentation: first.presentation });
  assert.equal(second.outcome, NotificationOutcome.ABSORB);
  assert.equal(second.gong, false);
  assert.deepEqual(second.presentation.messages, [story, gameplay, hint]);
  assert.equal(describeNotification(second.presentation).count, 3);
  assert.deepEqual(second.announcement.messages, [gameplay, hint]);
  assert.equal(first.presentation.messages.length, 1, "prezentarea primită nu se modifică");
});

test("absorbție: importanța crește la maxim (anunțul lotului urgent este assertive), nu scade; tot fără gong", () => {
  const normal = evaluate({ added: [story] }).presentation;
  const escalated = evaluate({ added: [urgent], presentation: normal });
  assert.equal(escalated.presentation.importance, "urgent");
  assert.equal(escalated.announcement.politeness, Politeness.ASSERTIVE);
  assert.equal(escalated.gong, false);
  assert.equal(describeNotification(escalated.presentation).persistent, true);
  const after = evaluate({ added: [gameplay], presentation: escalated.presentation });
  assert.equal(after.presentation.importance, "urgent");
  assert.equal(after.announcement.politeness, Politeness.POLITE); // anunțul lotului nou: importanța lui
  assert.equal(after.gong, false);
});

test("absorbție cu audio de misiune pornit sau după un gong nereușit: tot fără gong (un gong per prezentare)", () => {
  const silent = evaluate({ added: [story], context: { missionAudioPlaying: true } });
  assert.equal(silent.gong, false);
  const absorbed = evaluate({ added: [gameplay], presentation: silent.presentation, context: {} });
  assert.equal(absorbed.outcome, NotificationOutcome.ABSORB);
  assert.equal(absorbed.gong, false);
});

test("fără prezentare activă (închisă de jucător, automat sau la deschiderea Inbox-ului): lotul următor începe o prezentare nouă", () => {
  const decision = evaluate({ added: [gameplay], presentation: null });
  assert.equal(decision.outcome, NotificationOutcome.PRESENT);
  assert.equal(decision.gong, true);
});

/* ---------- Finalizarea ---------- */

test("completed: fără toast, gong sau anunț, inclusiv pentru mesajele tranzacției finale; prezentarea activă se închide", () => {
  const active = evaluate({ added: [story] }).presentation;
  for (const added of [[gameplay], [], [urgent]]) {
    const decision = evaluate({ added, status: GameStatus.COMPLETED, presentation: active });
    assert.equal(decision.outcome, NotificationOutcome.NONE);
    assert.equal(decision.presentation, null);
    assert.equal(decision.gong, false);
    assert.equal(decision.announcement, null);
  }
  // Finalul are prioritate în fața oricărui context.
  const inbox = evaluate({ added: [story], status: GameStatus.COMPLETED, context: { inboxOpen: true } });
  assert.equal(inbox.outcome, NotificationOutcome.NONE);
  assert.equal(inbox.announcement, null);
});

/* ---------- Puritate ---------- */

test("puritate: nu modifică intrarea, același input → același output, rezultat înghețat", () => {
  const added = [story, gameplay];
  const snapshot = structuredClone(added);
  const input = { added, cause: "next", status: PLAYING, context: { puzzleOpen: true }, presentation: null };
  const a = evaluateNotification(input);
  const b = evaluateNotification(input);
  assert.deepEqual(a, b);
  assert.deepEqual(added, snapshot);
  assert.ok(Object.isFrozen(a) && Object.isFrozen(a.presentation) && Object.isFrozen(a.announcement));
  assert.throws(() => evaluateNotification({ added: null }), /added/);
});

test("sursa: fără importuri, DOM, timere, audio, focus, stocare sau ceas; fără texte sau personaje de aventură", async () => {
  const source = await readFile(new URL("../src/js/notification-policy.js", import.meta.url), "utf8");
  assert.deepEqual([...source.matchAll(/^import .* from "(.+)";$/gm)], []);
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /\b(document|window|navigator|localStorage|sessionStorage|setTimeout|setInterval|requestAnimationFrame|Audio|AudioContext|focus|fetch)\b/);
  assert.doesNotMatch(code, /Date\.now|new Date|performance\.|Math\.random/);
  assert.doesNotMatch(code, /firedEvents|unreadCount|getMessages|markMessageRead|\.id\b/); // fără altă sursă decât `added`
  assert.doesNotMatch(code, /narrator|ghidul|centrala|missionId|locationId/i);
  assert.match(code, /const COMPLETED = "completed"/);
  assert.equal(GameStatus.COMPLETED, "completed");
});
