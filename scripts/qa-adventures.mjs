#!/usr/bin/env node
/*
 * Outdoor Escape — Adventure QA (verificarea aventurilor înainte de publicare).
 *
 * Utilizare (din rădăcina repository-ului):
 *   node scripts/qa-adventures.mjs                 toate content/adventures/*.json
 *   node scripts/qa-adventures.mjs <fișier.json>   doar acel fișier
 *   node scripts/qa-adventures.mjs --public-only   fără aventurile private locale în raport
 *   node scripts/qa-adventures.mjs --strict        avertismentele produc și ele exit code 1
 *
 * QA-S03 (id unic) compară întotdeauna cu toate content/adventures/*.json, indiferent de opțiuni.
 * Un fișier din afara content/adventures/ este verificat ca și cum ar fi copiat acolo: înlocuiește
 * fișierul cu același nume (dacă există) și este comparat cu toate celelalte.
 * Fișierul cerut și --public-only filtrează doar raportul; regulile rămân aceleași.
 *
 * Exit code: 0 = fără erori (și fără avertismente cu --strict); 1 = probleme găsite; 2 = utilizare greșită.
 * Regulile stau în scripts/adventure-qa/rules.mjs (inclusiv QA-F00, simularea traseului cu motorul real);
 * scriptul doar citește fișierele și afișează rezultatul.
 * Nu afișează texte de poveste sau răspunsuri; aventurile private apar ca „aventura privată #N”.
 * Fără dependențe; nu modifică niciun fișier.
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { runQaFull } from "./adventure-qa/rules.mjs";
import { CLASSES, classifyAdventure } from "./adventure-qa/classify.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ADVENTURES_DIR = join(ROOT, "content", "adventures");

function usage(message) {
  if (message) console.error(`✖ ${message}`);
  console.error("Utilizare: node scripts/qa-adventures.mjs [fișier.json] [--public-only] [--strict]");
  process.exit(2);
}

function parseArgs(argv) {
  const args = { file: null, publicOnly: false, strict: false };
  for (const arg of argv) {
    if (arg === "--public-only") args.publicOnly = true;
    else if (arg === "--strict") args.strict = true;
    else if (arg === "--help" || arg === "-h") usage();
    else if (arg.startsWith("--")) usage(`Argument necunoscut: ${arg}`);
    else if (args.file === null) args.file = arg;
    else usage("Se acceptă un singur fișier.");
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));

const read = (dir, fileName) => ({ fileName, dir, text: readFileSync(join(dir, fileName), "utf8") });
let entries = readdirSync(ADVENTURES_DIR).filter((name) => name.toLowerCase().endsWith(".json")).map((name) => read(ADVENTURES_DIR, name));
let reported = entries.map((entry) => entry.fileName);

if (args.file !== null) {
  const path = resolve(args.file);
  if (!existsSync(path) || !statSync(path).isFile()) usage(`Fișierul nu există: ${args.file}`);
  if (!path.toLowerCase().endsWith(".json")) usage("Fișierul trebuie să fie .json.");
  const target = basename(path);
  const sameDir = (a, b) => (process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (!sameDir(dirname(path), ADVENTURES_DIR)) {
    entries = [...entries.filter((entry) => entry.fileName !== target), read(dirname(path), target)];
  }
  reported = [target];
}

// --public-only: aventurile private locale nu apar în raport (sunt totuși comparate pentru QA-S03).
if (args.publicOnly) reported = reported.filter((name) => classifyAdventure(name, undefined) !== CLASSES.PRIVATE_LOCAL);
const targets = reported;

const { results, summary } = await runQaFull(entries, { targets });

console.log(`Adventure QA — ${summary.files} ${summary.files === 1 ? "fișier" : "fișiere"}${args.publicOnly ? " (fără aventurile private locale)" : ""}${args.strict ? " · --strict" : ""}\n`);
const width = Math.max(0, ...results.map((r) => r.label.length));
const active = (result, level) => result.findings.filter((f) => f.level === level && !f.waived).length;
for (const result of results) {
  const counts = `${active(result, "error")} erori, ${active(result, "warning")} avertismente`;
  console.log(`${result.status.padEnd(8)} ${result.label.padEnd(width)}  [${result.classification}]  ${counts}`);
  for (const f of result.findings) {
    const mark = f.waived ? "~" : f.level === "error" ? "E" : "W";
    console.log(`  ${mark} ${f.ruleId}${f.path ? `  ${f.path}` : ""}  ${f.message}${f.waived ? `  [excepție declarată: ${f.waived}]` : ""}`);
  }
}

const failed = summary.errors > 0 || (args.strict && summary.warnings > 0);
const waived = summary.waived > 0 ? `; ${summary.waived} ${summary.waived === 1 ? "excepție declarată" : "excepții declarate"}` : "";
console.log(`\nRezultat: ${failed ? "FAIL" : "PASS"} (${summary.errors} erori, ${summary.warnings} avertismente${waived}; ${summary.failedFiles} fișiere cu erori)`);
console.log("Legendă: E = eroare, W = avertisment (blochează doar cu --strict), ~ = excepție declarată (scripts/adventure-qa/exceptions.mjs).");
process.exit(failed ? 1 : 0);
