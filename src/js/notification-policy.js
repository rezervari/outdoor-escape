/*
 * Outdoor Escape — Notification Policy (Game Communication Layer, M7: D-104, D-105, D-106, D-107).
 *
 *   inbox.addMessages(...).added + cause (tranzacția) + status + contextul interfeței + prezentarea activă
 *       → evaluateNotification → nimic / doar anunț / prezentare nouă / absorbție, gong, anunț
 *
 * Modul PUR, ca inbox-ui.js și play-ui.js: fără DOM, timere, audio, focus, stocare sau ceas. Primește
 * date și întoarce o decizie; aplicarea ei (toast, regiunea live, gong) aparține interfeței (app.js, gong.js).
 * Nu cunoaște regulile de gameplay: nu citește conținutul, misiunile sau Game State (în afara lui `status`).
 *
 * Reguli (D-104):
 * - `added` (întors de Inbox) este singura sursă a mesajelor notificabile. Deduplicarea după id aparține
 *   Inbox-ului (D-092); aici nu există un al doilea mecanism.
 * - `cause` (metadata `cause` a GameEvent-urilor tranzacției) este context runtime: nu intră în GameMessage
 *   și nu se salvează. Singura excepție: cu `cause === "request_hint"`, mesajele `hint` nu se notifică
 *   (indiciul este afișat în puzzle); celelalte mesaje ale tranzacției rămân notificabile.
 * - Un lot (mesajele notificabile ale unei tranzacții) → cel mult o prezentare. Cât timp o prezentare este
 *   activă, un lot nou este absorbit: mesajele se adaugă, importanța devine maximul, fără al doilea gong.
 * - Durata afișării este comportament de interfață, nu se decide aici.
 *
 * Contextul (D-105), evaluat după desenarea tranzacției, în această ordine:
 *   final (`status === "completed"`) → nimic; prezentarea activă se închide
 *   pagină ascunsă / media viewer      → nimic; prezentarea activă rămâne neatinsă (fără amânare, fără coadă)
 *   Inbox deschis                       → doar anunț; nicio prezentare (mesajul este deja în Inbox)
 *   joc normal / puzzle overlay         → prezentare nouă sau absorbție
 *   audio de misiune în redare          → ca mai sus, dar fără gong
 *
 * Gong (D-106): numai la o prezentare nouă; niciodată la absorbție sau fără prezentare.
 * Anunț (D-107): `polite` pentru normal / important, `assertive` pentru urgent (maximul lotului).
 *
 * Prezentarea activă — { messages, importance } sau null — este stare efemeră păstrată de interfață
 * (nesalvată); politica o primește și întoarce următoarea valoare.
 */

export const NotificationOutcome = Object.freeze({
  NONE: "none", // nimic de anunțat sau de afișat
  ANNOUNCE: "announce", // doar anunț pentru cititorul de ecran (Inbox deschis)
  PRESENT: "present", // prezentare nouă (toast), eventual cu gong
  ABSORB: "absorb", // lotul intră în prezentarea activă, fără gong
});

export const Politeness = Object.freeze({ POLITE: "polite", ASSERTIVE: "assertive" });

// Aceleași valori ca GameStatus.COMPLETED (game.js) și MESSAGE_IMPORTANCE (game-message.js), fără importuri:
// politica nu depinde de motor (testele verifică echivalența).
const COMPLETED = "completed";
const HINT_REQUEST = "request_hint";
const IMPORTANCE_ORDER = Object.freeze(["normal", "important", "urgent"]);

const rank = (importance) => Math.max(0, IMPORTANCE_ORDER.indexOf(importance));

/** Importanța maximă a mesajelor (urgent > important > normal), pornind de la `floor`. */
export function maxImportance(messages, floor = "normal") {
  let best = rank(floor);
  for (const message of messages) best = Math.max(best, rank(message.importance));
  return IMPORTANCE_ORDER[best];
}

/** Mesajele notificabile ale lotului: toate, mai puțin indiciile cerute de jucător (D-104). */
export function notifiableMessages(added, cause = null) {
  return added.filter((message) => !(cause === HINT_REQUEST && message.category === "hint"));
}

const politenessOf = (importance) => (importance === "urgent" ? Politeness.ASSERTIVE : Politeness.POLITE);

const presentationOf = (messages, importance) => Object.freeze({ messages: Object.freeze([...messages]), importance });

const decisionOf = (outcome, messages, presentation, { gong = false, announce = false } = {}) =>
  Object.freeze({
    outcome,
    messages: Object.freeze([...messages]),
    presentation,
    gong,
    announcement: announce
      ? Object.freeze({ politeness: politenessOf(maxImportance(messages)), messages: Object.freeze([...messages]) })
      : null,
  });

/**
 * Decizia pentru lotul unei tranzacții.
 *   added        — inbox.addMessages(...).added (intrări Inbox: id, text, category, importance, sender, at, read)
 *   cause        — events[0].cause (aceeași pentru toate evenimentele tranzacției) sau null
 *   status       — starea jocului după tranzacție (GameStatus)
 *   context      — { inboxOpen, viewerOpen, puzzleOpen, missionAudioPlaying, pageHidden }, după desenare
 *   presentation — prezentarea activă ({ messages, importance }) sau null
 * Întoarce { outcome, messages (notificabile), presentation (următoarea), gong, announcement }.
 */
export function evaluateNotification({ added = [], cause = null, status = null, context = {}, presentation = null } = {}) {
  if (!Array.isArray(added)) throw new Error("evaluateNotification: added trebuie să fie lista întoarsă de inbox.addMessages().");
  const messages = notifiableMessages(added, cause);

  // Finalul are prioritate (D-105, D-103): fără toast, gong sau anunț; prezentarea activă se închide.
  if (status === COMPLETED) return decisionOf(NotificationOutcome.NONE, messages, null);
  if (messages.length === 0) return decisionOf(NotificationOutcome.NONE, messages, presentation);
  // Pagină ascunsă sau viewer deschis: lotul nu este prezentat nici acum, nici mai târziu.
  if (context.pageHidden || context.viewerOpen) return decisionOf(NotificationOutcome.NONE, messages, presentation);
  // Inbox deschis: mesajul este deja prezentat acolo (citit conform D-090); doar anunțul.
  if (context.inboxOpen) return decisionOf(NotificationOutcome.ANNOUNCE, messages, null, { announce: true });

  if (presentation) {
    const absorbed = presentationOf([...presentation.messages, ...messages], maxImportance(messages, presentation.importance));
    return decisionOf(NotificationOutcome.ABSORB, messages, absorbed, { announce: true });
  }
  // Joc normal sau puzzle overlay: o prezentare nouă; gong-ul tace cât timp se redă audio de misiune.
  return decisionOf(NotificationOutcome.PRESENT, messages, presentationOf(messages, maxImportance(messages)), {
    gong: !context.missionAudioPlaying,
    announce: true,
  });
}

/** Ce arată toast-ul: un mesaj (expeditor + text) sau numărul mesajelor; `persistent` pentru urgent. */
export function describeNotification(presentation) {
  if (!presentation) return null;
  const { messages, importance } = presentation;
  const single = messages.length === 1 ? messages[0] : null;
  return {
    count: messages.length,
    senderName: single && single.sender ? single.sender.name : null,
    text: single ? single.text : null,
    importance,
    persistent: importance === "urgent",
  };
}

/** Ce se anunță: nivelul și, pentru fiecare mesaj al lotului, expeditorul și textul integral. */
export function describeAnnouncement(announcement) {
  if (!announcement) return null;
  return {
    politeness: announcement.politeness,
    count: announcement.messages.length,
    items: announcement.messages.map((message) => ({
      senderName: message.sender ? message.sender.name : null,
      text: message.text,
    })),
  };
}
