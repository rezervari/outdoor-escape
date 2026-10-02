/*
 * Outdoor Escape — modelul GameMessage (Game Communication Layer, D-082, D-085, D-087, D-088, D-094).
 *
 * GameEvent  = un fapt produs de motor (events.js): { type, payload, seq, at, cause? }.
 * GameMessage = o comunicare prezentabilă jucătorului, rezultată dintr-un fapt sau din conținut:
 *   { id, text, category, importance, sender, at }
 *
 * - id:         identitatea stabilă a mesajului = cheia sursei semantice (D-085, D-092).
 *               Se calculează determinist din `source` (părți unite cu „:”), ex.
 *               ["mission_completed", "m-1"] → "mission_completed:m-1",
 *               ["rule", "ev-start", 0]      → "rule:ev-start:0".
 *               Nu depinde de GameEvent.seq (ordine de runtime), de `at` sau de ceas:
 *               aceeași sursă logică dă același id, inclusiv după reîncărcare.
 * - text:       text simplu, nevid (nu HTML, nu DOM); interfața îl afișează ca text.
 * - category:   obligatorie, din MESSAGE_CATEGORIES (D-087); nu se deduce în interfață.
 * - importance: din MESSAGE_IMPORTANCE (D-088), implicit "normal"; independentă de categorie.
 * - sender:     null sau { name } — dată de conținut (ex. narrator.name), fără logică de personaj (D-094).
 * - at:         momentul semantic al mesajului (ex. GameEvent.at) sau null; nu face parte din identitate.
 *
 * Nu fac parte (încă) din model: ordinea în conversație, acțiunile (MessageAction — D-093),
 * audio, citit / necitit, notificarea, persistența. Câmpurile necunoscute sunt respinse.
 *
 * Funcție pură: fără DOM, stocare, ceas, motor sau interfață. Nu modifică datele primite.
 */

/** Categoriile inițiale (D-087); id-uri tehnice, nu texte afișate. */
export const MESSAGE_CATEGORIES = Object.freeze(["position", "gameplay", "hint", "story", "alert"]);

/** Nivelurile de importanță (D-088). */
export const MESSAGE_IMPORTANCE = Object.freeze(["normal", "important", "urgent"]);

const INPUT_KEYS = Object.freeze(["source", "text", "category", "importance", "sender", "at"]);
const SENDER_KEYS = Object.freeze(["name"]);
const SOURCE_SEPARATOR = ":";

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isNonEmptyText = (value) => typeof value === "string" && value.trim() !== "";
// O parte a sursei: un id fără spații și fără separator (ex. "m-1", "mission_completed") sau un index ≥ 0.
const isSourcePart = (value) =>
  (typeof value === "string" && /^[^\s:]+$/.test(value)) || (Number.isInteger(value) && value >= 0);

function messageId(source) {
  if (!Array.isArray(source) || source.length === 0) {
    throw new Error("GameMessage: source trebuie să fie o listă nevidă (sursa semantică a mesajului).");
  }
  for (const part of source) {
    if (!isSourcePart(part)) throw new Error(`GameMessage: parte invalidă în source: ${String(part)}`);
  }
  return source.join(SOURCE_SEPARATOR);
}

function copySender(sender) {
  if (sender === null) return null;
  if (!isPlainObject(sender)) throw new Error("GameMessage: sender trebuie să fie null sau { name }.");
  for (const key of Object.keys(sender)) {
    if (!SENDER_KEYS.includes(key)) throw new Error(`GameMessage: sender.${key} nu face parte din model.`);
  }
  if (!isNonEmptyText(sender.name)) throw new Error("GameMessage: sender.name trebuie să fie un text nevid.");
  return Object.freeze({ name: sender.name });
}

/**
 * Construiește un GameMessage înghețat: { id, text, category, importance, sender, at }.
 * Aruncă o eroare dacă datele nu respectă contractul (eroare de program).
 */
export function createGameMessage(input) {
  if (!isPlainObject(input)) throw new Error("GameMessage: datele trebuie să fie un obiect.");
  for (const key of Object.keys(input)) {
    if (!INPUT_KEYS.includes(key)) throw new Error(`GameMessage: „${key}” nu face parte din model.`);
  }
  const { source, text, category, importance = "normal", sender = null, at = null } = input;

  const id = messageId(source);
  if (!isNonEmptyText(text)) throw new Error(`GameMessage ${id}: text trebuie să fie un text nevid.`);
  if (!MESSAGE_CATEGORIES.includes(category)) throw new Error(`GameMessage ${id}: categorie necunoscută: ${category}`);
  if (!MESSAGE_IMPORTANCE.includes(importance)) throw new Error(`GameMessage ${id}: importanță necunoscută: ${importance}`);
  if (at !== null && !Number.isFinite(at)) throw new Error(`GameMessage ${id}: at trebuie să fie un moment (număr) sau null.`);

  return Object.freeze({ id, text, category, importance, sender: copySender(sender), at });
}
