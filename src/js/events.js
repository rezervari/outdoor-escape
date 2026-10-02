/*
 * Outdoor Escape — modelul de evenimente (D-040).
 *
 * Reguli declarative din conținut:
 *   { "id", "on": <tip eveniment>, "where": { <filtru> }, "once": true, "do": [ <acțiuni> ] }
 *
 * - `on` și `do[].action` provin din liste ÎNCHISE (mai jos). Nu există expresii.
 * - `where` = egalitate simplă pe câmpurile evenimentului (missionId, locationId,
 *   secretId, partnerId). Toate câmpurile din `where` trebuie să corespundă.
 * - `once` este true implicit: regula rulează o singură dată pe joc.
 * - Acțiunile pot produce alte evenimente; lanțul este limitat (maxChainDepth):
 *   evenimentele inițiale au adâncimea 0; regulile rulează doar pentru evenimente
 *   cu adâncimea < maxChainDepth.
 *
 * Modulul nu știe ce fac acțiunile: le aplică printr-o funcție primită
 * (applyAction), furnizată de motor (game.js). Nu folosește DOM sau API-uri de browser.
 *
 * Două forme ale aceluiași eveniment:
 * - forma internă, plată: { type, missionId, locationId, … } — produsă de mutațiile motorului
 *   și citită de reguli (`on` / `where`); neschimbată;
 * - GameEvent (D-082, D-083): { type, payload, seq, at, cause? } — forma canonică a faptului
 *   procesat, construită de createGameEvent pentru fiecare eveniment din `processed`.
 *   Nu conține text, nu cunoaște interfața și nu este un mesaj (D-085). Nu se salvează.
 */

/** Tipurile de evenimente pe care motorul le poate emite. */
export const EVENT_TYPES = Object.freeze([
  "adventure_started",
  "adventure_completed",
  "mission_unlocked",
  "mission_started",
  "mission_completed",
  "mission_failed",
  "mission_skipped",
  "answer_incorrect",
  "hint_requested",
  "location_unlocked",
  "player_near_location",
  "player_arrived",
  "player_left_area",
  "location_discovered",
  "location_completed",
  "secret_discovered",
  "partner_unlocked",
  "finale_started",
]);

/** Câmpurile după care se poate filtra în `where`, cu entitatea la care trimit. */
export const FILTER_KEYS = Object.freeze({
  missionId: "missions",
  locationId: "locations",
  secretId: "secrets",
  partnerId: "partners",
});

/**
 * Acțiunile permise și parametrii lor obligatorii.
 * Valoarea unui parametru: numele colecției la care trimite (verificat de schema.js)
 * sau "points" pentru un întreg pozitiv.
 */
export const ACTION_TYPES = Object.freeze({
  show_message: { messageId: "messages" },
  play_audio: { trackId: "tracks" },
  unlock_mission: { missionId: "missions" },
  complete_mission: { missionId: "missions" },
  fail_mission: { missionId: "missions" },
  unlock_location: { locationId: "locations" },
  discover_location: { locationId: "locations" },
  discover_secret: { secretId: "secrets" },
  unlock_partner: { partnerId: "partners" },
  award_points: { points: "points" },
  collect_item: { itemId: "items" },
  start_finale: {},
  complete_adventure: {},
});

/** Limită absolută de siguranță pentru un singur dispatch, indiferent de adâncime. */
export const MAX_EVENTS_PER_DISPATCH = 200;

/** Chei de prezentare: aparțin unui mesaj sau interfeței, nu unui fapt de joc (D-082, D-085). */
const PRESENTATION_KEYS = Object.freeze(["text", "html", "message", "audio", "sender", "senderId", "category", "importance", "actions"]);

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isSimpleValue = (value) => value === null || value === undefined || ["string", "number", "boolean"].includes(typeof value);

/**
 * Construiește un GameEvent: { type, payload, seq, at, cause? } (obiect și payload înghețate).
 *
 * - type:    din EVENT_TYPES (vocabularul canonic — D-083);
 * - payload: câmpurile faptului (ex. missionId, locationId, source), numai valori simple;
 *            fără chei de prezentare (text, HTML, audio, expeditor, categorie, acțiuni);
 * - seq:     ordinea evenimentului în runtime (întreg ≥ 1); nu este un id persistent;
 * - at:      momentul procesării, după ceasul motorului (`now`);
 * - cause:   opțional — comanda sau observația care a produs evenimentul (ex. "submit_answer").
 *
 * Funcție pură. Aruncă o eroare dacă un câmp nu respectă contractul (eroare de program).
 */
export function createGameEvent(type, payload, { seq, at, cause } = {}) {
  if (!EVENT_TYPES.includes(type)) throw new Error(`GameEvent: tip necunoscut: ${type}`);
  if (!isPlainObject(payload)) throw new Error(`GameEvent ${type}: payload trebuie să fie un obiect simplu.`);
  for (const [key, value] of Object.entries(payload)) {
    if (PRESENTATION_KEYS.includes(key)) throw new Error(`GameEvent ${type}: „${key}” nu aparține unui eveniment.`);
    if (!isSimpleValue(value)) throw new Error(`GameEvent ${type}: payload.${key} trebuie să fie o valoare simplă.`);
  }
  if (!Number.isInteger(seq) || seq < 1) throw new Error(`GameEvent ${type}: seq trebuie să fie un întreg ≥ 1.`);
  if (!Number.isFinite(at)) throw new Error(`GameEvent ${type}: at trebuie să fie un moment (număr).`);
  if (cause !== undefined && (typeof cause !== "string" || cause === "")) {
    throw new Error(`GameEvent ${type}: cause trebuie să fie un text nevid.`);
  }
  const event = { type, payload: Object.freeze({ ...payload }), seq, at };
  if (cause !== undefined) event.cause = cause;
  return Object.freeze(event);
}

/** true dacă evenimentul corespunde filtrului `where` (egalitate pe fiecare cheie). */
export function matchesFilter(where, event) {
  if (!where) return true;
  return Object.keys(where).every((key) => event[key] === where[key]);
}

/** Regulile care ar rula pentru eveniment, ținând cont de `once` și de regulile deja rulate. */
export function selectRules(rules, event, alreadyFired = {}) {
  return (rules || []).filter(
    (rule) =>
      rule.on === event.type &&
      matchesFilter(rule.where, event) &&
      !(rule.once !== false && Object.prototype.hasOwnProperty.call(alreadyFired, rule.id))
  );
}

/**
 * Procesează evenimentele inițiale și toate reacțiile lor, în ordine (lățime întâi).
 *
 * applyAction(action, { rule, event }) → array de evenimente noi (sau nimic).
 * Acțiunile trebuie să fie idempotente: o acțiune care nu schimbă starea nu emite eveniment.
 *
 * lastSeq — ultimul `seq` folosit deja în runtime (implicit 0); evenimentele primesc lastSeq + 1, + 2, …
 * cause   — opțional, aceeași cauză pentru toate evenimentele acestui dispatch (inclusiv reacțiile).
 *
 * Întoarce:
 *   fired     — { ruleId: timestamp } pentru regulile rulate acum;
 *   processed — evenimentele procesate, în ordine (forma internă, plată);
 *   events    — aceleași evenimente, în aceeași ordine, ca GameEvent (createGameEvent);
 *   truncated — true dacă lanțul a fost oprit de maxChainDepth sau de limita de siguranță.
 */
export function processEvents(initialEvents, { rules = [], alreadyFired = {}, maxChainDepth = 8, now = Date.now, lastSeq = 0, cause, applyAction }) {
  const fired = {};
  const processed = [];
  const events = [];
  let truncated = false;
  const queue = (initialEvents || []).map((event) => ({ event, depth: 0 }));
  // Un singur moment pentru tot dispatch-ul (evenimentele lui se produc în aceeași tranzacție).
  const at = queue.length > 0 ? now() : null;

  while (queue.length > 0) {
    if (processed.length >= MAX_EVENTS_PER_DISPATCH) {
      truncated = true;
      break;
    }
    const { event, depth } = queue.shift();
    processed.push(event);
    const { type, ...payload } = event;
    events.push(createGameEvent(type, payload, { seq: lastSeq + processed.length, at, cause }));

    const matching = selectRules(rules, event, { ...alreadyFired, ...fired });
    // Evenimentul de la adâncimea maxChainDepth rămâne înregistrat (s-a petrecut),
    // dar nu mai declanșează reguli: așa se oprește un lanț prea lung sau o buclă.
    if (depth >= maxChainDepth) {
      if (matching.length > 0) truncated = true;
      continue;
    }
    for (const rule of matching) {
      fired[rule.id] = now();
      for (const action of rule.do) {
        const emitted = applyAction(action, { rule, event }) || [];
        for (const next of emitted) queue.push({ event: next, depth: depth + 1 });
      }
    }
  }

  return { fired, processed, events, truncated };
}
