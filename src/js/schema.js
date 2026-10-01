/*
 * Outdoor Escape — schema aventurii V2 (D-038).
 *
 * - validateAdventureV2(data): validare structurală + verificarea referințelor
 *   dintre entități (misiuni, locații, parteneri, secrete, mesaje, sunete).
 * - upgradeV1ToV2(v1): conversia în memorie a unei aventuri schemaVersion 1.
 *   Fișierul V1 nu se modifică (D-038 / D1).
 * - toAdventureV2(data): forma normalizată folosită de motor (V1 sau V2 la intrare;
 *   valori implicite aplicate; registrul media unificat — media.js). Idempotentă.
 *
 * Motorul nu conține conținut: tot ce ține de o aventură anume (oraș, texte,
 * coduri, locații) vine din JSON. Specificația: docs/11_ADVENTURE_SCHEMA_V2.md.
 *
 * Fără DOM și fără API-uri de browser — testabil în Node.
 */

import { resolveSettings } from "./defaults.js";
import { isValidCoordinates } from "./geo.js";
import { EVENT_TYPES, FILTER_KEYS, ACTION_TYPES } from "./events.js";
import {
  AUDIO_KINDS,
  MEDIA_ASSET_TYPES,
  RESERVED_MEDIA_ASSET_TYPES,
  MEDIA_BLOCK_TYPES,
  RESERVED_MEDIA_BLOCK_TYPES,
  COMPARE_MODES,
  TRANSCRIPT_DISPLAY,
  IMAGE_ROLES,
  INPUT_MODES,
  normalizeMediaRegistry,
} from "./media.js";

export const SCHEMA_V1 = 1;
export const SCHEMA_V2 = 2;

// Id stabil: litere mici, cifre și cratimă. Împiedică și căi de tip "../".
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function isValidId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

/* ---------- Vocabular închis ---------- */

export const MISSION_TYPES = Object.freeze(["riddle", "observation", "location", "timed", "partner", "code", "secret"]);
/** Tipuri de misiune care se rezolvă printr-un răspuns (validatorul din answers.js). */
export const ANSWER_MISSION_TYPES = Object.freeze(["riddle", "observation", "timed", "partner", "code", "secret"]);
export const TRACKS = Object.freeze(["main", "bonus", "secret"]);
export const MISSION_INITIAL_STATUSES = Object.freeze(["locked", "pending"]);

export const LOCATION_TYPES = Object.freeze(["start", "objective", "waypoint", "partner", "secret", "finale"]);
export const LOCATION_STATUSES = Object.freeze(["locked", "unlocked", "discovered", "completed"]);
export const LOCATION_INITIAL_STATUSES = Object.freeze(["locked", "unlocked", "discovered"]);

export const PARTNER_STATUSES = Object.freeze(["locked", "unlocked"]);
/** Cum se verifică o interacțiune cu partenerul. Nicio metodă nu presupune un anumit tip de partener. */
export const VERIFICATION_METHODS = Object.freeze(["code", "staff_code", "receipt_code", "password", "qr", "physical_item", "none"]);
export const REWARD_TYPES = Object.freeze(["discount", "clue", "item", "points", "none"]);

// Vocabularul media (inclusiv AUDIO_KINDS) stă în media.js; re-exportat aici pentru compatibilitate.
export { AUDIO_KINDS, MEDIA_ASSET_TYPES, MEDIA_BLOCK_TYPES, COMPARE_MODES, INPUT_MODES };
export const PROGRESSION_MODES = Object.freeze(["linear"]);

/* ---------- Utilitare ---------- */

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isNonEmptyString = (value) => typeof value === "string" && value.trim() !== "";
const isPositiveNumber = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;
const isNonNegativeInteger = (value) => Number.isInteger(value) && value >= 0;
// Cale relativă sigură pentru fișiere media: fără „/” la început, fără „..”, fără schemă (http:, data: …).
const isSafeRelativePath = (value) =>
  isNonEmptyString(value) && !value.startsWith("/") && !value.includes("..") && !/^[a-z][a-z0-9+.-]*:/i.test(value);

/* ---------- Validare V2 ---------- */

/**
 * Validează o aventură schemaVersion 2. Întoarce { valid, errors }.
 * Câmpurile necunoscute sunt permise (extensibilitate); valorile necunoscute
 * din listele închise (tipuri, acțiuni, evenimente) sunt erori.
 */
export function validateAdventureV2(data) {
  const errors = [];
  const err = (message) => errors.push(message);

  if (!isObject(data)) return { valid: false, errors: ["Aventura trebuie să fie un obiect JSON."] };
  if (data.schemaVersion !== SCHEMA_V2) err(`schemaVersion trebuie să fie ${SCHEMA_V2}.`);
  if (!isValidId(data.id)) err("id lipsește sau nu este valid (litere mici, cifre, cratimă).");
  if (data.contentVersion !== undefined && !isNonEmptyString(data.contentVersion)) err("contentVersion trebuie să fie text.");
  if (data.language !== undefined && !isNonEmptyString(data.language)) err("language trebuie să fie text.");
  if (data.demo !== undefined && typeof data.demo !== "boolean") err("demo trebuie să fie true/false.");

  // meta
  if (!isObject(data.meta)) {
    err("meta lipsește.");
  } else {
    const meta = data.meta;
    if (!isNonEmptyString(meta.title)) err("meta.title lipsește.");
    for (const key of ["city", "description", "difficulty"]) {
      if (meta[key] !== undefined && typeof meta[key] !== "string") err(`meta.${key} trebuie să fie text.`);
    }
    if (meta.estimatedTime !== undefined && !isPositiveNumber(meta.estimatedTime)) {
      err("meta.estimatedTime trebuie să fie un număr pozitiv (minute).");
    }
    if (meta.tags !== undefined && !(Array.isArray(meta.tags) && meta.tags.every((tag) => typeof tag === "string"))) {
      err("meta.tags trebuie să fie o listă de texte.");
    }
  }

  // settings
  if (data.settings !== undefined) {
    if (!isObject(data.settings)) {
      err("settings trebuie să fie un obiect.");
    } else {
      const { progression, gps, events } = data.settings;
      if (progression !== undefined && !PROGRESSION_MODES.includes(progression)) {
        err(`settings.progression necunoscut: „${progression}” (permis: ${PROGRESSION_MODES.join(", ")}).`);
      }
      if (gps !== undefined) {
        if (!isObject(gps)) {
          err("settings.gps trebuie să fie un obiect.");
        } else {
          for (const key of ["defaultRadius", "nearDistance", "maxAccuracy"]) {
            if (gps[key] !== undefined && !isPositiveNumber(gps[key])) err(`settings.gps.${key} trebuie să fie un număr pozitiv (metri).`);
          }
          if (gps.exitMargin !== undefined && !(typeof gps.exitMargin === "number" && Number.isFinite(gps.exitMargin) && gps.exitMargin >= 0)) {
            err("settings.gps.exitMargin trebuie să fie un număr ≥ 0 (metri).");
          }
          if (gps.allowManualConfirmation !== undefined && typeof gps.allowManualConfirmation !== "boolean") {
            err("settings.gps.allowManualConfirmation trebuie să fie true/false.");
          }
        }
      }
      if (events !== undefined) {
        if (!isObject(events)) err("settings.events trebuie să fie un obiect.");
        else if (events.maxChainDepth !== undefined && !(Number.isInteger(events.maxChainDepth) && events.maxChainDepth >= 1 && events.maxChainDepth <= 32)) {
          err("settings.events.maxChainDepth trebuie să fie un întreg între 1 și 32.");
        }
      }
    }
  }
  const settings = resolveSettings(isObject(data.settings) ? data.settings : {});

  // Colecții: id-uri unice, păstrate pentru verificarea referințelor.
  // `tracks` = toate sunetele (audio.tracks + media.assets de tip „audio”): ținta referințelor
  // narrator.messages[].audio și play_audio.trackId. `media` = toate asset-urile din media.assets.
  const ids = { missions: new Set(), locations: new Set(), partners: new Set(), secrets: new Set(), items: new Set(), messages: new Set(), tracks: new Set(), media: new Set() };

  function collectArray(key, required) {
    const value = data[key];
    if (value === undefined) {
      if (required) err(`${key} trebuie să fie o listă cu cel puțin un element.`);
      return [];
    }
    if (!Array.isArray(value) || (required && value.length === 0)) {
      err(`${key} trebuie să fie o listă${required ? " cu cel puțin un element" : ""}.`);
      return [];
    }
    value.forEach((item, index) => {
      if (!isObject(item)) return;
      if (!isValidId(item.id)) err(`${key}[${index}].id lipsește sau nu este valid.`);
      else if (ids[key].has(item.id)) err(`${key}[${index}].id „${item.id}” este duplicat.`);
      else ids[key].add(item.id);
    });
    return value;
  }

  const locations = collectArray("locations", false);
  const missions = collectArray("missions", true);
  const partners = collectArray("partners", false);
  const secrets = collectArray("secrets", false);
  const items = collectArray("items", false);

  // narrator.messages și audio.tracks sunt dicționare: cheia este id-ul.
  const messages = collectDictionary("narrator", "messages");
  const tracks = collectDictionary("audio", "tracks");
  const mediaAssets = collectMediaAssets();

  // media.assets: dicționar, ca audio.tracks. Id-urile sunt unice în ambele registre (devin unul singur).
  function collectMediaAssets() {
    const media = data.media;
    if (media === undefined) return {};
    if (!isObject(media)) {
      err("media trebuie să fie un obiect.");
      return {};
    }
    if (media.basePath !== undefined && !isSafeRelativePath(media.basePath)) {
      err("media.basePath trebuie să fie o cale relativă (fără „/” la început, fără „..”).");
    }
    const dict = media.assets;
    if (dict === undefined) return {};
    if (!isObject(dict)) {
      err("media.assets trebuie să fie un obiect { id: … }.");
      return {};
    }
    for (const [id, asset] of Object.entries(dict)) {
      if (!isValidId(id)) err(`media.assets: id invalid „${id}”.`);
      else if (ids.tracks.has(id)) err(`media.assets.${id}: id-ul există deja în audio.tracks (registrul media este unic).`);
      else {
        ids.media.add(id);
        if (isObject(asset) && asset.type === "audio") ids.tracks.add(id);
      }
    }
    return dict;
  }

  function collectDictionary(parentKey, key) {
    const parent = data[parentKey];
    if (parent === undefined) return {};
    if (!isObject(parent)) {
      err(`${parentKey} trebuie să fie un obiect.`);
      return {};
    }
    const dict = parent[key];
    if (dict === undefined) return {};
    if (!isObject(dict)) {
      err(`${parentKey}.${key} trebuie să fie un obiect { id: … }.`);
      return {};
    }
    for (const id of Object.keys(dict)) {
      if (!isValidId(id)) err(`${parentKey}.${key}: id invalid „${id}”.`);
      else ids[key].add(id);
    }
    return dict;
  }

  const ref = (collection, value, where) => {
    if (value === undefined) return;
    if (!ids[collection].has(value)) err(`${where}: referință inexistentă „${value}” (${collection}).`);
  };

  // narrator
  if (isObject(data.narrator) && data.narrator.name !== undefined && typeof data.narrator.name !== "string") {
    err("narrator.name trebuie să fie text.");
  }
  for (const [id, message] of Object.entries(messages)) {
    const where = `narrator.messages.${id}`;
    if (!isObject(message)) {
      err(`${where} trebuie să fie un obiect { text }.`);
      continue;
    }
    if (!isNonEmptyString(message.text)) err(`${where}.text lipsește (textul este obligatoriu, inclusiv ca alternativă la audio).`);
    ref("tracks", message.audio, `${where}.audio`);
  }

  // audio
  if (isObject(data.audio) && data.audio.basePath !== undefined && !isSafeRelativePath(data.audio.basePath)) {
    err("audio.basePath trebuie să fie o cale relativă (fără „/” la început, fără „..”).");
  }
  for (const [id, track] of Object.entries(tracks)) {
    const where = `audio.tracks.${id}`;
    if (!isObject(track)) {
      err(`${where} trebuie să fie un obiect { src, kind }.`);
      continue;
    }
    if (!isSafeRelativePath(track.src)) err(`${where}.src trebuie să fie o cale relativă.`);
    if (!AUDIO_KINDS.includes(track.kind)) err(`${where}.kind necunoscut: „${track.kind}”.`);
    ref("messages", track.transcriptMessage, `${where}.transcriptMessage`);
    if (track.kind === "voice" && track.transcriptMessage === undefined) {
      err(`${where}: sunetele cu voce trebuie să aibă transcriptMessage (text alternativ).`);
    }
  }

  // media.assets: tipul decide metadatele obligatorii. Tipurile rezervate sunt respinse explicit (D-072).
  const assetType = (id) => (isObject(mediaAssets[id]) ? mediaAssets[id].type : tracks[id] !== undefined ? "audio" : undefined);
  for (const [id, asset] of Object.entries(mediaAssets)) {
    const where = `media.assets.${id}`;
    if (!isObject(asset)) {
      err(`${where} trebuie să fie un obiect { type, src, … }.`);
      continue;
    }
    if (RESERVED_MEDIA_ASSET_TYPES.includes(asset.type)) {
      err(`${where}.type „${asset.type}” este rezervat și nu este implementat încă (permis: ${MEDIA_ASSET_TYPES.join(", ")}).`);
      continue;
    }
    if (!MEDIA_ASSET_TYPES.includes(asset.type)) {
      err(`${where}.type necunoscut: „${asset.type}” (permis: ${MEDIA_ASSET_TYPES.join(", ")}).`);
      continue;
    }
    if (!isSafeRelativePath(asset.src)) err(`${where}.src trebuie să fie o cale relativă.`);
    for (const key of ["caption", "credit", "title"]) {
      if (asset[key] !== undefined && typeof asset[key] !== "string") err(`${where}.${key} trebuie să fie text.`);
    }
    if (asset.type === "image") {
      if (!isNonEmptyString(asset.alt)) err(`${where}.alt lipsește (textul alternativ al imaginii este obligatoriu).`);
      if (asset.role !== undefined && !IMAGE_ROLES.includes(asset.role)) err(`${where}.role necunoscut: „${asset.role}”.`);
      for (const key of ["width", "height"]) {
        if (asset[key] !== undefined && !isPositiveNumber(asset[key])) err(`${where}.${key} trebuie să fie un număr pozitiv (pixeli).`);
      }
      if (asset.provenance !== undefined && !isObject(asset.provenance)) err(`${where}.provenance trebuie să fie un obiect.`);
      // Imaginile de arhivă cer sursa și licența (D-011; cercetarea istorică este o fază separată).
      if (asset.role === "archival" && !(isObject(asset.provenance) && isNonEmptyString(asset.provenance.credit) && isNonEmptyString(asset.provenance.license))) {
        err(`${where}: o imagine „archival” cere provenance.credit și provenance.license.`);
      }
    } else if (asset.type === "audio") {
      if (asset.kind !== undefined && !AUDIO_KINDS.includes(asset.kind)) err(`${where}.kind necunoscut: „${asset.kind}”.`);
      if (asset.transcript !== undefined && !isNonEmptyString(asset.transcript)) err(`${where}.transcript trebuie să fie un text nevid.`);
      if (asset.transcript !== undefined && asset.transcriptMessage !== undefined) err(`${where}: folosește transcript SAU transcriptMessage, nu ambele.`);
      ref("messages", asset.transcriptMessage, `${where}.transcriptMessage`);
      if (asset.kind === "voice" && asset.transcript === undefined && asset.transcriptMessage === undefined) {
        err(`${where}: sunetele cu voce trebuie să aibă transcript sau transcriptMessage (text alternativ).`);
      }
    }
  }

  /** Blocurile media ale unei misiuni (mission.media). */
  function validateMediaBlocks(blocks, where) {
    if (!Array.isArray(blocks)) return err(`${where} trebuie să fie o listă de blocuri.`);
    const expectAsset = (id, type, at) => {
      if (!isNonEmptyString(id)) return err(`${at} lipsește.`);
      const actual = assetType(id);
      if (actual === undefined) return err(`${at}: referință inexistentă „${id}” (media.assets).`);
      if (actual !== type) err(`${at}: „${id}” este de tip „${actual}”, nu „${type}”.`);
    };
    blocks.forEach((block, b) => {
      const at = `${where}[${b}]`;
      if (!isObject(block)) return err(`${at} trebuie să fie un obiect { type, … }.`);
      if (RESERVED_MEDIA_BLOCK_TYPES.includes(block.type)) {
        return err(`${at}.type „${block.type}” este rezervat și nu este implementat încă (permis: ${MEDIA_BLOCK_TYPES.join(", ")}).`);
      }
      if (!MEDIA_BLOCK_TYPES.includes(block.type)) return err(`${at}.type necunoscut: „${block.type}” (permis: ${MEDIA_BLOCK_TYPES.join(", ")}).`);
      for (const key of ["alt", "caption", "credit", "label", "title"]) {
        if (block[key] !== undefined && typeof block[key] !== "string") err(`${at}.${key} trebuie să fie text.`);
      }
      if (block.type === "image") {
        expectAsset(block.asset, "image", `${at}.asset`);
      } else if (block.type === "audio") {
        expectAsset(block.asset, "audio", `${at}.asset`);
        if (block.showTranscript !== undefined && !TRANSCRIPT_DISPLAY.includes(block.showTranscript)) {
          err(`${at}.showTranscript necunoscut: „${block.showTranscript}” (permis: ${TRANSCRIPT_DISPLAY.join(", ")}).`);
        }
      } else if (block.type === "compare") {
        expectAsset(block.before, "image", `${at}.before`);
        expectAsset(block.after, "image", `${at}.after`);
        if (isNonEmptyString(block.before) && block.before === block.after) err(`${at}: before și after trebuie să fie imagini diferite.`);
        if (block.mode !== undefined && !COMPARE_MODES.includes(block.mode)) {
          err(`${at}.mode necunoscut: „${block.mode}” (permis: ${COMPARE_MODES.join(", ")}).`);
        }
        if (block.labels !== undefined) {
          if (!isObject(block.labels)) err(`${at}.labels trebuie să fie un obiect { before, after }.`);
          else for (const key of ["before", "after"]) {
            if (block.labels[key] !== undefined && typeof block.labels[key] !== "string") err(`${at}.labels.${key} trebuie să fie text.`);
          }
        }
      }
    });
  }

  // locations
  locations.forEach((location, index) => {
    const where = `locations[${index}]`;
    if (!isObject(location)) return err(`${where} trebuie să fie un obiect.`);
    if (!isNonEmptyString(location.name)) err(`${where}.name lipsește.`);
    if (!LOCATION_TYPES.includes(location.type)) err(`${where}.type necunoscut: „${location.type}”.`);
    if (!isValidCoordinates(location.coordinates)) err(`${where}.coordinates trebuie să fie { lat, lng } în grade zecimale valide.`);
    if (location.radius !== undefined && !isPositiveNumber(location.radius)) err(`${where}.radius trebuie să fie un număr pozitiv (metri).`);
    const radius = location.radius ?? settings.gps.defaultRadius;
    if (isPositiveNumber(radius) && isPositiveNumber(settings.gps.nearDistance) && radius >= settings.gps.nearDistance) {
      err(`${where}: raza (${radius} m) trebuie să fie mai mică decât nearDistance (${settings.gps.nearDistance} m).`);
    }
    if (location.initialStatus !== undefined && !LOCATION_INITIAL_STATUSES.includes(location.initialStatus)) {
      err(`${where}.initialStatus necunoscut: „${location.initialStatus}”.`);
    }
    if (location.hiddenUntilDiscovered !== undefined && typeof location.hiddenUntilDiscovered !== "boolean") {
      err(`${where}.hiddenUntilDiscovered trebuie să fie true/false.`);
    }
    if (location.hiddenUntilDiscovered === true && location.initialStatus !== undefined && location.initialStatus !== "locked") {
      err(`${where}: o locație ascunsă (hiddenUntilDiscovered) trebuie să înceapă „locked”.`);
    }
    if (location.fallback !== undefined) {
      if (!isObject(location.fallback)) err(`${where}.fallback trebuie să fie un obiect.`);
      else {
        if (location.fallback.instructions !== undefined && typeof location.fallback.instructions !== "string") {
          err(`${where}.fallback.instructions trebuie să fie text.`);
        }
        if (location.fallback.allowManualConfirmation !== undefined && typeof location.fallback.allowManualConfirmation !== "boolean") {
          err(`${where}.fallback.allowManualConfirmation trebuie să fie true/false.`);
        }
      }
    }
  });

  // missions
  let firstMain = null;
  missions.forEach((mission, index) => {
    const where = `missions[${index}]`;
    if (!isObject(mission)) return err(`${where} trebuie să fie un obiect.`);
    const track = mission.track ?? "main";
    if (!MISSION_TYPES.includes(mission.type)) err(`${where}.type necunoscut: „${mission.type}”.`);
    if (!TRACKS.includes(track)) err(`${where}.track necunoscut: „${mission.track}”.`);
    if (track === "main" && firstMain === null) firstMain = mission;
    if (!isNonEmptyString(mission.title)) err(`${where}.title lipsește.`);
    if (!isNonEmptyString(mission.briefing)) err(`${where}.briefing lipsește.`);
    if (!isNonNegativeInteger(mission.points)) err(`${where}.points trebuie să fie un întreg ≥ 0.`);
    if (mission.initialStatus !== undefined && !MISSION_INITIAL_STATUSES.includes(mission.initialStatus)) {
      err(`${where}.initialStatus necunoscut: „${mission.initialStatus}”.`);
    }
    if (track === "secret" && mission.initialStatus === "pending") {
      err(`${where}: o misiune secretă trebuie să înceapă „locked” (se deblochează printr-un eveniment).`);
    }
    if (mission.type === "secret" && track !== "secret") err(`${where}: type „secret” cere track „secret”.`);

    ref("locations", mission.locationId, `${where}.locationId`);
    ref("partners", mission.partnerId, `${where}.partnerId`);
    if (mission.type === "location" && mission.locationId === undefined) err(`${where}: o misiune „location” cere locationId.`);
    if (mission.type === "partner" && mission.partnerId === undefined) err(`${where}: o misiune „partner” cere partnerId.`);

    if (ANSWER_MISSION_TYPES.includes(mission.type) && !isNonEmptyString(mission.answer)) err(`${where}.answer lipsește.`);
    if (mission.type === "location" && mission.answer !== undefined) err(`${where}: o misiune „location” nu are answer.`);
    // choices: variantele afișate ca butoane; varianta aleasă este trimisă ca răspuns (validat de answers.js).
    if (mission.choices !== undefined) {
      if (!ANSWER_MISSION_TYPES.includes(mission.type)) err(`${where}.choices este permis doar pentru misiunile cu răspuns.`);
      else if (!Array.isArray(mission.choices) || mission.choices.length < 2 || mission.choices.length > 6
        || !mission.choices.every(isNonEmptyString) || new Set(mission.choices).size !== mission.choices.length) {
        err(`${where}.choices trebuie să fie o listă de 2–6 texte nevide, diferite.`);
      }
    }
    // inputMode: tastatura răspunsului tastat (indiciu pentru telefon; verificarea rămâne în answers.js).
    if (mission.inputMode !== undefined) {
      if (!ANSWER_MISSION_TYPES.includes(mission.type)) err(`${where}.inputMode este permis doar pentru misiunile cu răspuns.`);
      else if (!INPUT_MODES.includes(mission.inputMode)) err(`${where}.inputMode necunoscut: „${mission.inputMode}” (permis: ${INPUT_MODES.join(", ")}).`);
      else if (mission.choices !== undefined && mission.inputMode !== "text") err(`${where}: inputMode „${mission.inputMode}” nu se folosește împreună cu choices.`);
    }
    // media: blocurile afișate de misiune (orice tip de misiune, inclusiv „location”).
    if (mission.media !== undefined) validateMediaBlocks(mission.media, `${where}.media`);
    if (mission.type === "timed" && !(Number.isInteger(mission.timeLimitSeconds) && mission.timeLimitSeconds > 0)) {
      err(`${where}.timeLimitSeconds trebuie să fie un întreg pozitiv pentru o misiune „timed”.`);
    }
    if (mission.hints !== undefined) {
      if (!Array.isArray(mission.hints)) err(`${where}.hints trebuie să fie o listă.`);
      else mission.hints.forEach((hint, h) => {
        if (!isObject(hint) || !isNonEmptyString(hint.text)) err(`${where}.hints[${h}].text lipsește.`);
      });
    }
  });
  if (missions.length > 0 && firstMain === null) err("missions: trebuie să existe cel puțin o misiune cu track „main”.");
  if (firstMain && firstMain.initialStatus === "locked") err("Prima misiune principală nu poate începe „locked” (jocul nu ar putea porni).");

  // partners — model generic: categoria este text liber.
  partners.forEach((partner, index) => {
    const where = `partners[${index}]`;
    if (!isObject(partner)) return err(`${where} trebuie să fie un obiect.`);
    if (!isNonEmptyString(partner.name)) err(`${where}.name lipsește.`);
    if (!isNonEmptyString(partner.category)) err(`${where}.category lipsește (text liber: cafe, museum, shop …).`);
    ref("locations", partner.locationId, `${where}.locationId`);
    ref("missions", partner.missionId, `${where}.missionId`);
    if (partner.initialStatus !== undefined && !PARTNER_STATUSES.includes(partner.initialStatus)) {
      err(`${where}.initialStatus necunoscut: „${partner.initialStatus}”.`);
    }
    if (!isObject(partner.verification)) err(`${where}.verification lipsește.`);
    else if (!VERIFICATION_METHODS.includes(partner.verification.method)) {
      err(`${where}.verification.method necunoscut: „${partner.verification.method}”.`);
    }
    if (partner.reward !== undefined && !(isObject(partner.reward) && REWARD_TYPES.includes(partner.reward.type))) {
      err(`${where}.reward.type necunoscut.`);
    }
    if (partner.validity !== undefined) {
      const { from, until } = isObject(partner.validity) ? partner.validity : {};
      if (from !== undefined && !DATE_PATTERN.test(String(from))) err(`${where}.validity.from trebuie să fie AAAA-LL-ZZ.`);
      if (until !== undefined && !DATE_PATTERN.test(String(until))) err(`${where}.validity.until trebuie să fie AAAA-LL-ZZ.`);
      if (DATE_PATTERN.test(String(from)) && DATE_PATTERN.test(String(until)) && from > until) err(`${where}.validity: from este după until.`);
    }
    // Legătura partener ↔ misiune trebuie să fie consecventă în ambele sensuri.
    const linked = missions.find((mission) => isObject(mission) && mission.id === partner.missionId);
    if (linked && linked.partnerId !== partner.id) {
      err(`${where}.missionId „${partner.missionId}” trebuie să aibă partnerId „${partner.id}” (legătura este în ambele sensuri).`);
    }
  });

  // secrets
  secrets.forEach((secret, index) => {
    const where = `secrets[${index}]`;
    if (!isObject(secret)) return err(`${where} trebuie să fie un obiect.`);
    if (!isNonEmptyString(secret.title)) err(`${where}.title lipsește.`);
    ref("locations", secret.locationId, `${where}.locationId`);
    ref("missions", secret.missionId, `${where}.missionId`);
    if (secret.points !== undefined && !isNonNegativeInteger(secret.points)) err(`${where}.points trebuie să fie un întreg ≥ 0.`);
  });

  // items (obiecte colecționabile): se obțin prin acțiunea collect_item a unei reguli.
  items.forEach((item, index) => {
    const where = `items[${index}]`;
    if (!isObject(item)) return err(`${where} trebuie să fie un obiect.`);
    if (!isNonEmptyString(item.name)) err(`${where}.name lipsește.`);
    if (item.description !== undefined && typeof item.description !== "string") err(`${where}.description trebuie să fie text.`);
    if (item.icon !== undefined && typeof item.icon !== "string") err(`${where}.icon trebuie să fie text.`);
  });

  // events
  const events = data.events === undefined ? [] : data.events;
  if (!Array.isArray(events)) err("events trebuie să fie o listă.");
  const eventIds = new Set();
  (Array.isArray(events) ? events : []).forEach((rule, index) => {
    const where = `events[${index}]`;
    if (!isObject(rule)) return err(`${where} trebuie să fie un obiect.`);
    if (!isValidId(rule.id)) err(`${where}.id lipsește sau nu este valid.`);
    else if (eventIds.has(rule.id)) err(`${where}.id „${rule.id}” este duplicat.`);
    else eventIds.add(rule.id);
    if (!EVENT_TYPES.includes(rule.on)) err(`${where}.on necunoscut: „${rule.on}”.`);
    if (rule.once !== undefined && typeof rule.once !== "boolean") err(`${where}.once trebuie să fie true/false.`);
    if (rule.where !== undefined) {
      if (!isObject(rule.where)) err(`${where}.where trebuie să fie un obiect.`);
      else for (const [key, value] of Object.entries(rule.where)) {
        if (!Object.prototype.hasOwnProperty.call(FILTER_KEYS, key)) err(`${where}.where: filtru necunoscut „${key}”.`);
        else ref(FILTER_KEYS[key], value, `${where}.where.${key}`);
      }
    }
    if (!Array.isArray(rule.do) || rule.do.length === 0) {
      err(`${where}.do trebuie să fie o listă cu cel puțin o acțiune.`);
      return;
    }
    rule.do.forEach((action, a) => {
      const at = `${where}.do[${a}]`;
      if (!isObject(action) || !Object.prototype.hasOwnProperty.call(ACTION_TYPES, action.action)) {
        return err(`${at}: acțiune necunoscută „${isObject(action) ? action.action : action}”.`);
      }
      for (const [param, collection] of Object.entries(ACTION_TYPES[action.action])) {
        if (collection === "points") {
          if (!(Number.isInteger(action[param]) && action[param] > 0)) err(`${at}.${param} trebuie să fie un întreg pozitiv.`);
        } else if (action[param] === undefined) {
          err(`${at}.${param} lipsește.`);
        } else {
          ref(collection, action[param], `${at}.${param}`);
        }
      }
      // Punctele acordate de o regulă repetabilă s-ar aduna la infinit.
      if (action.action === "award_points" && rule.once === false) err(`${at}: award_points nu este permis într-o regulă cu once: false.`);
    });
  });

  // finale
  if (data.finale !== undefined) {
    if (!isObject(data.finale)) err("finale trebuie să fie un obiect.");
    else {
      ref("missions", data.finale.missionId, "finale.missionId");
      ref("messages", data.finale.messageId, "finale.messageId");
      const finaleMission = missions.find((mission) => isObject(mission) && mission.id === data.finale.missionId);
      if (finaleMission && (finaleMission.track ?? "main") !== "main") err("finale.missionId trebuie să fie o misiune principală.");
    }
  }

  return { valid: errors.length === 0, errors };
}

/* ---------- Compatibilitate V1 → V2 ---------- */

/**
 * Convertește structural o aventură V1 în V2 (fără validare, fără a modifica obiectul primit).
 * Răspunsurile sunt păstrate doar dacă există (o aventură fără răspunsuri rămâne fără).
 */
export function upgradeV1ToV2(v1) {
  const missions = (v1.challenges || []).map((challenge, index) => {
    const mission = {
      id: challenge.id,
      type: "riddle",
      track: "main",
      title: challenge.title,
      briefing: challenge.description,
      initialStatus: index === 0 ? "pending" : "locked",
      points: challenge.points,
      hints: typeof challenge.hint === "string" && challenge.hint !== "" ? [{ text: challenge.hint }] : [],
    };
    if (challenge.answer !== undefined) mission.answer = challenge.answer;
    return mission;
  });

  const meta = { title: v1.title };
  for (const key of ["city", "description", "estimatedTime", "difficulty"]) {
    if (v1[key] !== undefined) meta[key] = v1[key];
  }

  const upgraded = {
    schemaVersion: SCHEMA_V2,
    upgradedFrom: SCHEMA_V1,
    id: v1.id,
    meta,
    settings: { progression: "linear" },
    missions,
  };
  if (v1.demo !== undefined) upgraded.demo = v1.demo;
  return upgraded;
}

/**
 * Forma normalizată V2 folosită de motor: V1 este convertită, iar valorile
 * implicite sunt aplicate (liste goale, setări, track, hints, stări inițiale).
 */
export function toAdventureV2(data) {
  if (data && data.normalized === true) return data;
  const source = data && data.schemaVersion === SCHEMA_V2 ? data : upgradeV1ToV2(data || {});

  const missions = (source.missions || []).map((mission) => ({
    ...mission,
    track: mission.track ?? "main",
    hints: Array.isArray(mission.hints) ? mission.hints : [],
  }));
  // Stare inițială implicită: prima misiune principală „pending”, restul „locked”.
  const firstMainId = missions.find((mission) => mission.track === "main")?.id;
  for (const mission of missions) {
    if (mission.initialStatus === undefined) mission.initialStatus = mission.id === firstMainId ? "pending" : "locked";
  }

  return {
    ...source,
    normalized: true,
    meta: { ...(source.meta || {}) },
    settings: resolveSettings(source.settings),
    narrator: { name: source.narrator?.name, messages: { ...(source.narrator?.messages || {}) } },
    audio: { basePath: source.audio?.basePath, tracks: { ...(source.audio?.tracks || {}) } },
    // Registrul media unificat: media.assets + audio.tracks (format vechi), fiecare asset cu `path`.
    // Motorul și interfața citesc doar acest registru (D-072).
    media: normalizeMediaRegistry(source),
    // Implicit „locked” (fog of war): o locație devine vizibilă când misiunea ei devine activă.
    locations: (source.locations || []).map((location) => ({ ...location, initialStatus: location.initialStatus ?? "locked" })),
    missions,
    partners: (source.partners || []).map((partner) => ({ ...partner, initialStatus: partner.initialStatus ?? "locked" })),
    secrets: source.secrets || [],
    items: source.items || [],
    events: (source.events || []).map((rule) => ({ ...rule, once: rule.once !== false })),
    finale: source.finale || null,
  };
}
