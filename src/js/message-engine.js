/*
 * Outdoor Escape — Message Engine (Game Communication Layer, M4: D-082, D-085, D-087, D-088, D-092, D-097).
 *
 *   GameEvent[] (batch-ul unei tranzacții — subscribe, M2) → processGameEvents → GameMessage[] (M3)
 *
 * Decide ce eveniment produce un mesaj și cu ce text, categorie, importanță, expeditor și sursă stabilă.
 * Textele vin numai din conținut; modulul nu conține texte, personaje sau logică specifică unei aventuri.
 *
 * Mesajele (ambele din conținut):
 * 1. Regulile cu `show_message` (narrator.messages): pentru fiecare eveniment, regulile din conținut
 *    care îl ascultă (`on` + `where`, aceeași potrivire ca motorul) și care au rulat (`state.firedEvents`).
 *    source = ["rule", rule.id, actionIndex] — aceeași cheie ca jurnalul naratorului (buildStory),
 *    deci același mesaj logic, nu un al doilea. Expeditor: narrator.name (dată de conținut — D-094).
 * 2. hint_requested: textul indiciului deschis (mission.hints[hintIndex]).
 *    source = ["hint", missionId, hintIndex] — `hintIndex` corespunde faptului salvat `hintsUsed`.
 * Un eveniment fără conținut de comunicare nu produce mesaj: fără texte generice (forma șabloanelor
 * rămâne deschisă — D-082). Epilogul (finale.messageId) nu este mapat: relația cu ecranul final
 * rămâne deschisă (D-086).
 *
 * Identitate (D-085, D-092, D-097): sursa nu conține seq, at sau ceas. Același fapt semantic → același id:
 * o nouă apropiere / sosire GPS produce același id ca prima, o regulă repetabilă (once: false) același id
 * la fiecare rulare. Un id apare cel mult o dată în rezultatul unui apel, la primul eveniment care îl produce;
 * între apeluri nu se păstrează nimic. Ce s-a afișat deja, citit / necitit și notificarea aparțin stratului
 * Inbox (M5), care recunoaște mesajele după id.
 *
 * Ordinea: ordinea evenimentelor din batch (ordinea procesării); pentru un eveniment, întâi mesajul lui
 * propriu (indiciul), apoi mesajele regulilor, în ordinea din conținut. Nimic nu se sortează.
 *
 * Pur: nu modifică evenimentele, conținutul sau starea; fără DOM, stocare, audio, ceas sau apeluri în motor.
 */

import { matchesFilter } from "./events.js";
import { createGameMessage } from "./game-message.js";

const route = (category, own = null) => Object.freeze({ category, importance: "normal", own });

/**
 * Matricea eveniment → mesaje, pentru toate tipurile din EVENT_TYPES:
 * - category / importance: ale mesajelor produse de eveniment (conținutul nu le declară încă — D-087, D-088);
 * - own: mesajul propriu al evenimentului, dacă există ("hint" = textul indiciului); altfel doar regulile.
 */
export const EVENT_MESSAGE_ROUTES = Object.freeze({
  adventure_started: route("story"),
  adventure_completed: route("story"),
  finale_started: route("story"),
  mission_unlocked: route("gameplay"),
  mission_started: route("gameplay"),
  mission_completed: route("gameplay"),
  mission_failed: route("gameplay"),
  mission_skipped: route("gameplay"),
  answer_incorrect: route("gameplay"),
  hint_requested: route("hint", "hint"),
  location_unlocked: route("gameplay"),
  location_completed: route("gameplay"),
  player_near_location: route("position"),
  player_arrived: route("position"),
  player_left_area: route("position"),
  location_discovered: route("position"),
  secret_discovered: route("story"),
  partner_unlocked: route("gameplay"),
});

const isText = (value) => typeof value === "string" && value.trim() !== "";
const isGameEvent = (event) =>
  event !== null && typeof event === "object" && typeof event.payload === "object" && event.payload !== null && Number.isFinite(event.at);

/** Mesajul propriu al lui hint_requested: textul indiciului deschis. */
function hintMessages(event, content, { category, importance }) {
  const { missionId, hintIndex } = event.payload;
  const mission = (content.missions || []).find((m) => m.id === missionId);
  const text = mission?.hints?.[hintIndex]?.text;
  if (!isText(text)) return [];
  return [createGameMessage({ source: ["hint", missionId, hintIndex], text, category, importance, at: event.at })];
}

/** Mesajele `show_message` ale regulilor care ascultă evenimentul și au rulat. */
function ruleMessages(event, content, state, { category, importance }) {
  const fired = state.firedEvents || {};
  const texts = content.narrator?.messages || {};
  const sender = isText(content.narrator?.name) ? { name: content.narrator.name } : null;
  const messages = [];
  for (const rule of content.events || []) {
    if (rule.on !== event.type || !matchesFilter(rule.where, event.payload)) continue;
    if (!Object.prototype.hasOwnProperty.call(fired, rule.id)) continue; // regula nu a rulat (ex. lanț oprit)
    (rule.do || []).forEach((action, actionIndex) => {
      if (action.action !== "show_message") return;
      const text = texts[action.messageId]?.text;
      if (!isText(text)) return;
      messages.push(createGameMessage({ source: ["rule", rule.id, actionIndex], text, category, importance, sender, at: event.at }));
    });
  }
  return messages;
}

/**
 * GameEvent[] → GameMessage[].
 * content — aventura normalizată, fără răspunsuri (game.content);
 * state   — instantaneul stării după tranzacție (primul argument al listenerului subscribe).
 */
export function processGameEvents(events, { content, state } = {}) {
  if (!Array.isArray(events)) throw new Error("processGameEvents: events trebuie să fie o listă de GameEvent.");
  if (!content || typeof content !== "object") throw new Error("processGameEvents: lipsește conținutul (game.content).");
  if (!state || typeof state !== "object") throw new Error("processGameEvents: lipsește starea jocului.");

  const messages = [];
  const ids = new Set(); // unicitate în rezultatul acestui apel; nu se păstrează între apeluri
  for (const event of events) {
    const eventRoute = EVENT_MESSAGE_ROUTES[event?.type];
    if (!eventRoute || !isGameEvent(event)) throw new Error(`processGameEvents: GameEvent invalid: ${event?.type}`);
    const produced = [
      ...(eventRoute.own === "hint" ? hintMessages(event, content, eventRoute) : []),
      ...ruleMessages(event, content, state, eventRoute),
    ];
    for (const message of produced) {
      if (ids.has(message.id)) continue;
      ids.add(message.id);
      messages.push(message);
    }
  }
  return messages;
}
