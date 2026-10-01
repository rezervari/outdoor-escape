/*
 * Adventure QA — regulile media (Pasul 2).
 *
 *   QA-M01  fișierul unui asset declarat există                         (error)
 *   QA-M02  extensia corespunde tipului declarat (convenția proiectului) (error)
 *   QA-M03  aceeași cale declarată de mai multe asset-uri               (error)
 *   QA-M04  asset declarat, dar nefolosit de nicio referință            (warning)
 *   QA-M05  calea rămâne în content/adventures/media/<id-aventură>/     (error)
 *   QA-M06  fișier din media/<id-aventură>/ nedeclarat de aventură      (warning)
 *
 * Registrul este cel citit de aplicație: `media.assets` normalizat (media.js), care include și
 * formatul vechi `audio.tracks`. Calea efectivă (`path` = basePath + src) este relativă la
 * fișierul aventurii (resolveMediaUrl), deci se rezolvă față de directorul fișierului JSON.
 *
 * Folosirea unui asset = orice referință validată de schemă: blocurile mission.media
 * (`asset`, `before`, `after`), narrator.messages.<id>.audio și acțiunea play_audio.trackId.
 * Reutilizarea aceluiași asset din mai multe blocuri este mecanismul normal și nu este duplicat.
 *
 * QA-M01 și QA-M06 au nevoie de disc: rulează doar când se cunoaște directorul aventurii (`dir`).
 * Fiecare finding media are `subject` = calea media (pentru excepțiile declarate).
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, join, posix, relative, resolve, sep } from "node:path";

/**
 * QA-M02 — extensiile permise pe tip: CONVENȚIA QA a proiectului (aprobată de proprietar), nu lista
 * formatelor suportate de browsere. Bugetul din TASK_CHALLENGE_SYSTEM_V1.md §8.3 (WebP / JPEG, M4A / MP3)
 * plus formatele deja folosite (SVG, WAV). OGG nu este permis (suport incomplet pe iPhone, §8.3).
 * Comparația nu ține cont de majuscule; calea exactă a fișierului o verifică QA-M01.
 *
 * Tipurile necunoscute (și cele rezervate: video, model3d, ar) nu ajung la această regulă ca o problemă
 * nouă: schema le respinge deja (QA-S01, „media.assets.<id>.type necunoscut / rezervat”), iar
 * `audio.tracks` este întotdeauna „audio”. QA-M02 verifică doar tipurile cunoscute de mai jos.
 */
export const MEDIA_EXTENSIONS = Object.freeze({
  image: Object.freeze([".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"]),
  audio: Object.freeze([".mp3", ".m4a", ".aac", ".wav"]),
});

// Fișiere de sistem create automat de Windows / macOS, care nu sunt media (fișierele „.*” sunt ignorate oricum).
const SYSTEM_FILES = new Set(["thumbs.db", "desktop.ini"]);
const URL_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/** Locul declarației unui asset în fișierul sursă (formatul vechi rămâne în audio.tracks). */
const declaredAt = (asset) => `${asset.legacy === "audio.tracks" ? "audio.tracks" : "media.assets"}.${asset.id}`;

/** true dacă `child` este în `root` (după rezolvare; nu doar prin compararea textelor). */
function isInside(root, child) {
  const rel = relative(root, child);
  return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

/** Toate fișierele de sub `dir`, ca rute relative cu „/”. */
function listFiles(dir, prefix = "") {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith(".") || SYSTEM_FILES.has(name.toLowerCase())) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full, `${prefix}${name}/`));
    else out.push(`${prefix}${name}`);
  }
  return out;
}

/** Id-urile asset-urilor referite de conținut. */
function usedAssetIds(content) {
  const used = new Set();
  for (const mission of content.missions) {
    for (const block of Array.isArray(mission.media) ? mission.media : []) {
      if (block === null || typeof block !== "object") continue;
      for (const key of ["asset", "before", "after"]) if (typeof block[key] === "string") used.add(block[key]);
    }
  }
  for (const message of Object.values(content.narrator.messages)) {
    if (message && typeof message.audio === "string") used.add(message.audio);
  }
  for (const rule of content.events) {
    for (const action of Array.isArray(rule.do) ? rule.do : []) {
      if (action && action.action === "play_audio" && typeof action.trackId === "string") used.add(action.trackId);
    }
  }
  return used;
}

/**
 * content — aventura normalizată (toAdventureV2)
 * id      — id-ul aventurii (numele fișierului): directorul permis este media/<id>/
 * dir     — directorul fișierului JSON; fără el, QA-M01 și QA-M06 nu rulează
 */
export function checkMedia(content, { id, dir } = {}) {
  const findings = [];
  const add = (ruleId, level, path, subject, message) => findings.push({ ruleId, level, path, subject, message });

  // Fără director (ex. text verificat în memorie), căile se rezolvă față de o rădăcină virtuală.
  const base = dir ? resolve(dir) : resolve(sep, "adventure-qa-virtual");
  const allowedPrefix = `media/${id}/`;
  const allowedRoot = resolve(base, "media", id);
  const assets = Object.values(content.media.assets).filter((asset) => typeof asset.path === "string" && asset.path !== "");

  // QA-M05 (+ calea normalizată, folosită de celelalte reguli)
  const contained = [];
  for (const asset of assets) {
    const inside = !URL_SCHEME.test(asset.path) && !isAbsolute(asset.path) && isInside(allowedRoot, resolve(base, asset.path));
    if (!inside) {
      add("QA-M05", "error", declaredAt(asset), asset.path,
        `„${asset.path}” iese din directorul media al aventurii („${allowedPrefix}”).`);
      continue;
    }
    contained.push({ asset, key: posix.normalize(asset.path.split("\\").join("/")), file: resolve(base, asset.path) });
  }

  // QA-M01 — cu majusculele exacte: GitHub Pages face diferența, chiar dacă discul local (Windows) nu.
  if (dir) {
    for (const { asset, key, file } of contained) {
      const exact = existsSync(file) && statSync(file).isFile() && readdirSync(dirname(file)).includes(basename(file));
      if (!exact) add("QA-M01", "error", declaredAt(asset), key, `fișier media lipsă: „${key}”.`);
    }
  }

  // QA-M02 — după calea declarată (indiferent de QA-M05); tipurile necunoscute sunt ale schemei (QA-S01).
  for (const asset of assets) {
    const allowed = MEDIA_EXTENSIONS[asset.type];
    if (!allowed) continue;
    const extension = posix.extname(asset.path.split("\\").join("/")).toLowerCase();
    if (!allowed.includes(extension)) {
      add("QA-M02", "error", declaredAt(asset), asset.path,
        `extensia „${extension || "(lipsă)"}” nu este permisă pentru tipul „${asset.type}” (permis: ${allowed.join(", ")}).`);
    }
  }

  // QA-M03: aceeași cale, declarată de două asset-uri diferite.
  const firstByPath = new Map();
  for (const { asset, key } of contained) {
    const first = firstByPath.get(key);
    if (first) add("QA-M03", "error", declaredAt(asset), key, `„${key}” este declarat și de „${declaredAt(first)}” (un fișier = un asset; reutilizarea se face prin id).`);
    else firstByPath.set(key, asset);
  }

  // QA-M04
  const used = usedAssetIds(content);
  for (const asset of assets) {
    if (!used.has(asset.id)) add("QA-M04", "warning", declaredAt(asset), asset.path, `asset declarat, dar nefolosit: „${asset.id}”.`);
  }

  // QA-M06: doar directorul acestei aventuri.
  if (dir && existsSync(allowedRoot) && statSync(allowedRoot).isDirectory()) {
    const declared = new Set(contained.map(({ key }) => key));
    for (const rel of listFiles(allowedRoot)) {
      const key = `${allowedPrefix}${rel}`;
      if (!declared.has(key)) add("QA-M06", "warning", allowedPrefix, key, `fișier nedeclarat în aventură: „${key}”.`);
    }
  }
  return findings;
}
