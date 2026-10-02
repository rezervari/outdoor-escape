/*
 * Outdoor Escape — starea Inbox / Conversation (Game Communication Layer, M5: D-085, D-086, D-090, D-092).
 *
 *   GameMessage[] (Message Engine, M4) → addMessages → Inbox State (istoricul comunicării + citit / necitit)
 *
 * Inbox State este separat de Game State: propria cheie de stocare, propriul format; motorul nu știe de el,
 * iar Inbox-ul nu cunoaște motorul, evenimentele sau interfața. Nu este sursă de adevăr pentru gameplay (D-084).
 *
 * Stocare (cheia decisă în M5 — D-090, prefix D-035):
 *   outdoor-escape:inbox:<id-aventură>  →  { version: 1, messages: [{ id, text, category, importance, sender, at, read }] }
 * Aceeași identitate ca progresul (outdoor-escape:game:<id-aventură>): o singură parcurgere per aventură
 * și browser, ca Game State; sesiunile (D-064) nu sunt implementate.
 *
 * Reguli:
 * - Deduplicare (D-092): după GameMessage.id, singura identitate. Un id deja cunoscut nu se adaugă din nou
 *   și nu se modifică (text, at, read rămân cele existente), indiferent de seq, at sau ordinea procesării.
 * - Citit / necitit (D-090): un mesaj nou intră necitit; devine citit doar prin markMessageRead(id),
 *   apelat de interfață când mesajul este efectiv vizibil. Nu există „marchează tot”.
 * - unreadCount este derivat din mesaje; nu se salvează.
 * - Ordinea: ordinea intrării în Inbox (ordinea batch-urilor și, în batch, ordinea Message Engine).
 *   `at` rămâne dată de afișare: nu se folosește pentru identitate sau ordonare, iar Inbox-ul nu are ceas.
 * - clear(): golește istoricul aventurii — pentru „Începe de la capăt” / „Joacă din nou”, care readuc
 *   jocul la idle și îi șterg progresul; apelul aparține integrării cu interfața (M6).
 * Fără câmpuri de notificare sau audio: existența mesajului, starea citit și notificarea sunt separate (D-089, D-091).
 *
 * localStorage poate lipsi sau arunca excepții: Inbox-ul continuă în memorie, fără salvare (ca storage.js).
 * Backend-ul se poate injecta (getItem / setItem / removeItem).
 */

import { MESSAGE_CATEGORIES, MESSAGE_IMPORTANCE } from "./game-message.js";

export const INBOX_VERSION = 1;
export const INBOX_PREFIX = "outdoor-escape:inbox:";

export function inboxStorageKey(adventureId) {
  return INBOX_PREFIX + adventureId;
}

const MESSAGE_KEYS = Object.freeze(["id", "text", "category", "importance", "sender", "at"]);
// Forma id-urilor produse de createGameMessage: părți fără spații și fără „:”, unite cu „:”.
const MESSAGE_ID = /^[^\s:]+(?::[^\s:]+)*$/;

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const isNonEmptyText = (value) => typeof value === "string" && value.trim() !== "";
const isSender = (sender) =>
  sender === null || (isPlainObject(sender) && Object.keys(sender).length === 1 && isNonEmptyText(sender.name));

/** Motivul pentru care valoarea nu este un GameMessage (forma M3), sau null. */
function messageProblem(message, keys = MESSAGE_KEYS) {
  if (!isPlainObject(message)) return "nu este un obiect";
  const extra = Object.keys(message).filter((key) => !keys.includes(key));
  if (extra.length > 0) return `câmpuri din afara modelului: ${extra.join(", ")}`;
  if (typeof message.id !== "string" || !MESSAGE_ID.test(message.id)) return "id invalid";
  if (!isNonEmptyText(message.text)) return "text invalid";
  if (!MESSAGE_CATEGORIES.includes(message.category)) return "categorie invalidă";
  if (!MESSAGE_IMPORTANCE.includes(message.importance)) return "importanță invalidă";
  if (!isSender(message.sender)) return "sender invalid";
  if (message.at !== null && !Number.isFinite(message.at)) return "at invalid";
  return null;
}

/** O intrare a Inbox-ului: mesajul + `read`, înghețată (copie, fără referințe la datele primite). */
const entryOf = (message, read) =>
  Object.freeze({
    id: message.id,
    text: message.text,
    category: message.category,
    importance: message.importance,
    sender: message.sender === null ? null : Object.freeze({ name: message.sender.name }),
    at: message.at,
    read,
  });

/** Intrările valide dintr-un Inbox salvat (lipsă / format necunoscut → []; intrări invalide sau repetate → ignorate). */
function restoreMessages(saved) {
  if (!isPlainObject(saved) || saved.version !== INBOX_VERSION || !Array.isArray(saved.messages)) return [];
  const ids = new Set();
  const messages = [];
  for (const entry of saved.messages) {
    if (messageProblem(entry, [...MESSAGE_KEYS, "read"]) !== null || typeof entry.read !== "boolean" || ids.has(entry.id)) continue;
    ids.add(entry.id);
    messages.push(entryOf(entry, entry.read));
  }
  return messages;
}

function defaultBackend() {
  try {
    return globalThis.localStorage || null;
  } catch {
    // Unele browsere aruncă excepție chiar la accesarea localStorage.
    return null;
  }
}

/**
 * Inbox-ul unei aventuri, încărcat din stocare la creare.
 * Operațiile care schimbă starea o salvează imediat; cele fără schimbare nu scriu nimic.
 */
export function createInbox({ adventureId, backend = defaultBackend() } = {}) {
  if (!isNonEmptyText(adventureId)) throw new Error("createInbox: lipsește id-ul aventurii.");
  const key = inboxStorageKey(adventureId);

  function load() {
    if (!backend) return [];
    try {
      const raw = backend.getItem(key);
      return raw === null ? [] : restoreMessages(JSON.parse(raw));
    } catch (error) {
      console.warn("[outdoor-escape] Inbox-ul salvat nu a putut fi citit:", error);
      return [];
    }
  }

  function persist() {
    if (!backend) return false;
    try {
      backend.setItem(key, JSON.stringify({ version: INBOX_VERSION, messages }));
      return true;
    } catch (error) {
      console.warn("[outdoor-escape] Inbox-ul nu a putut fi salvat:", error);
      return false;
    }
  }

  let messages = load();
  const unreadCount = () => messages.filter((message) => !message.read).length;

  return {
    /** Starea Inbox-ului: { version, messages } (intrări înghețate, în ordinea intrării). */
    getState() {
      return { version: INBOX_VERSION, messages: [...messages] };
    },

    /** Mesajele, în ordinea intrării în Inbox. */
    getMessages() {
      return [...messages];
    },

    /** Numărul mesajelor necitite (derivat). */
    unreadCount,

    /**
     * Adaugă mesajele noi (după id), necitite. Un id cunoscut — din Inbox sau mai devreme în același
     * batch — este ignorat. Validează tot batch-ul înainte de orice schimbare.
     * Întoarce { added: intrările noi, în ordine, unreadCount }.
     */
    addMessages(incoming) {
      if (!Array.isArray(incoming)) throw new Error("Inbox: addMessages primește o listă de GameMessage.");
      incoming.forEach((message, index) => {
        const problem = messageProblem(message);
        if (problem) throw new Error(`Inbox: mesajul ${index} nu este un GameMessage valid (${problem}).`);
      });
      const known = new Set(messages.map((message) => message.id));
      const added = [];
      for (const message of incoming) {
        if (known.has(message.id)) continue;
        known.add(message.id);
        added.push(entryOf(message, false));
      }
      if (added.length > 0) {
        messages = [...messages, ...added];
        persist();
      }
      return { added, unreadCount: unreadCount() };
    },

    /** Marchează mesajul ca citit. Întoarce true dacă s-a schimbat ceva (false: deja citit sau id necunoscut). */
    markMessageRead(id) {
      if (typeof id !== "string") throw new Error("Inbox: markMessageRead primește id-ul unui mesaj.");
      const index = messages.findIndex((message) => message.id === id);
      if (index === -1 || messages[index].read) return false;
      messages = messages.map((message, i) => (i === index ? entryOf(message, true) : message));
      persist();
      return true;
    },

    /** Golește istoricul aventurii și îl șterge din stocare (reset / „Joacă din nou”). */
    clear() {
      messages = [];
      if (!backend) return false;
      try {
        backend.removeItem(key);
        return true;
      } catch (error) {
        console.warn("[outdoor-escape] Inbox-ul nu a putut fi șters:", error);
        return false;
      }
    },
  };
}
