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
  start_finale: {},
  complete_adventure: {},
});

/** Limită absolută de siguranță pentru un singur dispatch, indiferent de adâncime. */
export const MAX_EVENTS_PER_DISPATCH = 200;

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
 * Întoarce:
 *   fired     — { ruleId: timestamp } pentru regulile rulate acum;
 *   processed — evenimentele procesate, în ordine;
 *   truncated — true dacă lanțul a fost oprit de maxChainDepth sau de limita de siguranță.
 */
export function processEvents(initialEvents, { rules = [], alreadyFired = {}, maxChainDepth = 8, now = Date.now, applyAction }) {
  const fired = {};
  const processed = [];
  let truncated = false;
  const queue = (initialEvents || []).map((event) => ({ event, depth: 0 }));

  while (queue.length > 0) {
    if (processed.length >= MAX_EVENTS_PER_DISPATCH) {
      truncated = true;
      break;
    }
    const { event, depth } = queue.shift();
    processed.push(event);

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

  return { fired, processed, truncated };
}
