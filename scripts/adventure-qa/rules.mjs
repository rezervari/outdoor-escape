/*
 * Adventure QA — regulile.
 *
 *   QA-S01  JSON parsabil + validateAdventure() fără erori (validatorul aplicației, nu o copie);
 *   QA-S02  id-ul din fișier = numele fișierului (loadAdventure refuză altfel aventura);
 *   QA-S03  același id în mai multe fișiere;
 *   QA-C02 – QA-C05  misiunile cu răspuns (rules-content.mjs);
 *   QA-M01 – QA-M06  media (rules-media.mjs).
 *
 * Funcțiile întorc findings structurate
 *   { ruleId, level: "error" | "warning", path, message, subject?, waived? }
 * și nu scriu în consolă (asta face scripts/qa-adventures.mjs). Singurele citiri de pe disc sunt
 * ale regulilor media (QA-M01, QA-M06), numai când intrarea are `dir`.
 * Un finding acoperit de o excepție declarată (exceptions.mjs) rămâne în raport, cu `waived`,
 * dar nu se numără.
 *
 * Confidențialitate (D-034): pentru o aventură `private-local`, eticheta este „aventura privată #N”
 * (nu numele fișierului), iar valorile citate din mesaje („…”), id-urile din căi și numele
 * folderului media sunt mascate. Nicio regulă nu include în mesaj texte de poveste sau răspunsuri.
 */

import { validateAdventure } from "../../src/js/content.js";
import { toAdventureV2, SCHEMA_V2 } from "../../src/js/schema.js";
import { CLASSES, classifyAdventure, fileStem } from "./classify.mjs";
import { checkAnswerMissions } from "./rules-content.mjs";
import { checkMedia } from "./rules-media.mjs";
import { findException } from "./exceptions.mjs";

export const LEVELS = Object.freeze({ ERROR: "error", WARNING: "warning" });

const finding = (ruleId, level, path, message) => ({ ruleId, level, path, message });

const BOM = 0xfeff;
const stripBom = (text) => (text.charCodeAt(0) === BOM ? text.slice(1) : text);

/** JSON.parse tolerant la BOM (ca response.json() din browser). */
export function parseAdventure(text) {
  try {
    return { data: JSON.parse(stripBom(String(text))) };
  } catch (error) {
    return { error };
  }
}

/** QA-S01 + QA-S02 pentru un singur fișier. Întoarce { data, findings }; `data` lipsește dacă JSON-ul este invalid. */
export function checkFile({ fileName, text }) {
  const parsed = parseAdventure(text);
  if (parsed.error) {
    return { data: undefined, findings: [finding("QA-S01", LEVELS.ERROR, null, `JSON invalid: ${parsed.error.message}`)] };
  }
  const { data } = parsed;
  const findings = [];
  const { errors } = validateAdventure(data);
  for (const message of errors) findings.push(finding("QA-S01", LEVELS.ERROR, null, `schemă: ${message}`));

  const isObject = data !== null && typeof data === "object" && !Array.isArray(data);
  if (isObject && typeof data.id === "string" && data.id !== fileStem(fileName)) {
    findings.push(finding("QA-S02", LEVELS.ERROR, "id", `id-ul din fișier („${data.id}”) diferă de numele fișierului („${fileStem(fileName)}”).`));
  }
  return { data, findings };
}

/**
 * QA-S03: id-uri folosite de mai multe fișiere.
 * entries — [{ fileName, id, label }]; întoarce Map<fileName, findings[]>.
 */
export function checkDuplicateIds(entries) {
  const byId = new Map();
  for (const entry of entries) {
    if (typeof entry.id !== "string" || entry.id === "") continue;
    if (!byId.has(entry.id)) byId.set(entry.id, []);
    byId.get(entry.id).push(entry);
  }
  const result = new Map();
  for (const [id, group] of byId) {
    if (group.length < 2) continue;
    for (const entry of group) {
      const others = group.filter((other) => other !== entry).map((other) => other.label ?? other.fileName);
      const list = result.get(entry.fileName) ?? [];
      list.push(finding("QA-S03", LEVELS.ERROR, "id", `id-ul „${id}” este folosit și de: ${others.join(", ")}.`));
      result.set(entry.fileName, list);
    }
  }
  return result;
}

/**
 * Mascarea pentru aventurile private locale: valorile citate („…”), id-urile din dicționare,
 * care apar necitate în căile mesajelor schemei (ex. „media.assets.<id>.src”), și numele
 * folderului media („media/<id>/”).
 */
export function redact(message) {
  return message
    .replace(/„[^”]*”/g, "„…”")
    .replace(/\b(narrator\.messages|audio\.tracks|media\.assets)\.[a-z0-9]+(?:-[a-z0-9]+)*/g, "$1.…")
    .replace(/\bmedia\/[^/\s]+\//g, "media/…/");
}

/**
 * Regulile de conținut și media (Pasul 2) pentru un fișier cu JSON citibil.
 * Rulează pe forma normalizată folosită de motor (toAdventureV2); dacă structura este atât de
 * greșită încât normalizarea eșuează, QA-S01 raportează deja problema și regulile sunt sărite.
 */
export function checkContent({ fileName, dir }, data) {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return [];
  let content;
  try {
    content = toAdventureV2(data);
  } catch {
    return [];
  }
  const listKey = data.schemaVersion === SCHEMA_V2 ? "missions" : "challenges";
  return [
    ...checkAnswerMissions(content, { listKey }),
    ...checkMedia(content, { id: fileStem(fileName), dir }),
  ];
}

/** Excepțiile declarate: finding-ul rămâne, marcat `waived` (motivul), și nu se numără. */
function applyExceptions(fileName, findings) {
  return findings.map((f) => {
    const exception = findException(fileName, f);
    return exception ? { ...f, waived: exception.reason } : f;
  });
}

const counts = (findings, level) => findings.filter((f) => f.level === level && !f.waived).length;

/**
 * Rulează toate regulile pe un set de fișiere.
 *
 *   entries — [{ fileName, text, dir? }]: fișierele cunoscute (pentru QA-S03 trebuie incluse toate
 *             fișierele din content/adventures/, nu doar cele raportate); `dir` = directorul fișierului,
 *             necesar regulilor care verifică discul (QA-M01, QA-M06);
 *   targets — numele fișierelor raportate (implicit toate). Nu schimbă regulile, doar raportarea.
 *
 * Întoarce { results: [{ fileName, label, classification, findings, status }], summary }.
 */
export function runQa(entries, { targets } = {}) {
  const sorted = [...entries].sort((a, b) => a.fileName.localeCompare(b.fileName));
  let privateCount = 0;
  const checked = sorted.map((entry) => {
    const { data, findings } = checkFile(entry);
    const classification = classifyAdventure(entry.fileName, data);
    const isPrivate = classification === CLASSES.PRIVATE_LOCAL;
    const label = isPrivate ? `aventura privată #${++privateCount}` : entry.fileName;
    const id = data !== null && typeof data === "object" && !Array.isArray(data) ? data.id : undefined;
    return { entry, fileName: entry.fileName, label, classification, isPrivate, id, data, findings };
  });

  const duplicates = checkDuplicateIds(checked);
  const wanted = targets ? new Set(targets) : null;
  const results = checked
    .filter((item) => !wanted || wanted.has(item.fileName))
    .map(({ entry, fileName, label, classification, isPrivate, data, findings }) => {
      const all = applyExceptions(fileName, [...findings, ...(duplicates.get(fileName) ?? []), ...checkContent(entry, data)]);
      const safe = isPrivate
        ? all.map(({ subject, ...f }) => ({
          ...f,
          path: f.path == null ? f.path : redact(f.path),
          message: f.ruleId === "QA-S01" && f.message.startsWith("JSON invalid") ? "JSON invalid." : redact(f.message),
        }))
        : all;
      const errors = counts(safe, LEVELS.ERROR);
      const warnings = counts(safe, LEVELS.WARNING);
      return { fileName, label, classification, findings: safe, status: errors > 0 ? "ERROR" : warnings > 0 ? "WARNING" : "PASS" };
    });

  const total = (level) => results.reduce((sum, r) => sum + counts(r.findings, level), 0);
  return {
    results,
    summary: {
      files: results.length,
      errors: total(LEVELS.ERROR),
      warnings: total(LEVELS.WARNING),
      waived: results.reduce((sum, r) => sum + r.findings.filter((f) => f.waived).length, 0),
      failedFiles: results.filter((r) => r.status === "ERROR").length,
    },
  };
}
