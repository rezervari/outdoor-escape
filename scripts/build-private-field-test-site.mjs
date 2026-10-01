#!/usr/bin/env node
/*
 * Outdoor Escape — build PRIVAT pentru field test (D-079).
 *
 * Generează un folder static, ignorat de Git, cu aplicația + O SINGURĂ aventură, pentru
 * încărcarea directă (Direct Upload) într-un proiect Cloudflare Pages protejat de
 * Cloudflare Access. NU este build-ul public: GitHub Pages rămâne neschimbat
 * (.github/workflows/deploy-pages.yml publică doar fișierele urmărite de Git).
 *
 * Utilizare (din rădăcina repository-ului):
 *   node scripts/build-private-field-test-site.mjs --adventure <id> [--out <folder>]
 *
 * Allowlist (nimic altceva nu este copiat):
 *   index.html                                  redirecționarea către src/ (D-036)
 *   src/                                        aplicația (motorul neschimbat)
 *   content/adventures/<id>.json                aventura cerută
 *   content/adventures/<cale media>             DOAR fișierele media referite de aventură
 *   content/adventures/<aventura implicită>.json  cerută de service worker (SHELL_FILES), publică
 *   _headers                                    antete Cloudflare Pages (noindex, fără cache partajat)
 *
 * Verificări (scriptul eșuează la orice problemă, fără să modifice fișierele sursă):
 *   - aventura există, este validă (același validator ca aplicația) și are id-ul cerut;
 *   - toate fișierele media referite există și stau sub content/adventures/media/;
 *   - pentru o aventură „private-*”: JSON-ul, media și folderul de ieșire sunt ignorate de Git,
 *     iar niciun fișier privat nu este urmărit de Git (D-034);
 *   - toate fișierele din SHELL_FILES (sw.js) există în build.
 *
 * Fără dependențe, fără credențiale, fără rețea. Nu publică nimic: upload-ul este manual
 * (docs/16_PRIVATE_FIELD_TEST.md).
 */

import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { execFileSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_OUT = "private-field-test";
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function parseArgs(argv) {
  const args = { adventure: null, out: DEFAULT_OUT };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--adventure") args.adventure = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--help" || argv[i] === "-h") args.help = true;
    else fail(`Argument necunoscut: ${argv[i]}`);
  }
  return args;
}

function git(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** true dacă Git ignoră calea (relativă la rădăcină). */
function isIgnored(path) {
  try {
    git(["check-ignore", "-q", path]);
    return true;
  } catch {
    return false;
  }
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...listFiles(full));
    else out.push(full);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.adventure) {
    console.log("Utilizare: node scripts/build-private-field-test-site.mjs --adventure <id> [--out <folder>]");
    process.exit(args.help ? 0 : 1);
  }
  const id = args.adventure;
  if (!ID_PATTERN.test(id)) fail(`Id de aventură invalid: „${id}”.`);
  const isPrivate = id.startsWith("private-");

  // Folderul de ieșire: în interiorul repository-ului, nu rădăcina și nu un folder sursă.
  // Folderul de ieșire: oriunde în afara folderelor sursă (ex. implicit private-field-test/, sau un folder temporar).
  const out = resolve(ROOT, args.out);
  const outRel = relative(ROOT, out);
  if (outRel === "") fail("Folderul de ieșire nu poate fi rădăcina repository-ului.");
  const outInsideRepo = !outRel.startsWith("..") && !/^[a-z]:/i.test(outRel);
  const protectedDirs = ["src", "content", "docs", "tests", "scripts", ".github", ".git", ".claude", "Claude outputs"];
  if (outInsideRepo && protectedDirs.some((dir) => outRel === dir || outRel.startsWith(dir + sep))) {
    fail(`Folderul de ieșire „${outRel}” este un folder sursă.`);
  }

  // Aventura: aceeași validare ca aplicația.
  const jsonRel = `content/adventures/${id}.json`;
  const jsonPath = join(ROOT, jsonRel);
  if (!existsSync(jsonPath)) fail(`Lipsește ${jsonRel}.`);
  const { validateAdventure } = await import(pathToFileURL(join(ROOT, "src/js/content.js")).href);
  const { toAdventureV2 } = await import(pathToFileURL(join(ROOT, "src/js/schema.js")).href);
  const { listMediaPaths } = await import(pathToFileURL(join(ROOT, "src/js/media.js")).href);
  let data;
  try {
    data = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch (error) {
    fail(`${jsonRel} nu este JSON valid: ${error.message}`);
  }
  const { valid, errors } = validateAdventure(data);
  if (!valid) fail(`Aventura nu este validă:\n  ${errors.join("\n  ")}`);
  if (data.id !== id) fail(`Id-ul din fișier („${data.id}”) diferă de cel cerut.`);

  const mediaPaths = listMediaPaths(toAdventureV2(data));
  for (const path of mediaPaths) {
    if (!path.startsWith("media/") || path.includes("..")) fail(`Cale media neașteptată: ${path}`);
    if (!existsSync(join(ROOT, "content/adventures", path))) fail(`Lipsește fișierul media content/adventures/${path}.`);
  }

  // D-034: conținutul privat nu este și nu devine urmărit de Git.
  if (isPrivate) {
    if (!isIgnored(jsonRel)) fail(`${jsonRel} NU este ignorat de Git. Oprit (D-034).`);
    for (const path of mediaPaths) {
      if (!isIgnored(`content/adventures/${path}`)) fail(`content/adventures/${path} NU este ignorat de Git. Oprit (D-034).`);
    }
    const tracked = git(["ls-files", "content/adventures"]).split("\n").filter(Boolean);
    const leaked = tracked.filter((file) => file.includes("/private-") || file.includes("media/private-"));
    if (leaked.length) fail(`Fișiere private urmărite de Git: ${leaked.join(", ")}. Oprit (D-034).`);
    if (outInsideRepo && !isIgnored(`${outRel.split(sep).join("/")}/index.html`)) {
      fail(`Folderul de ieșire „${outRel}” NU este ignorat de Git. Adaugă-l în .gitignore sau folosește ${DEFAULT_OUT}/.`);
    }
  }

  // Aventura implicită a aplicației este cerută de service worker (SHELL_FILES): fără ea, instalarea eșuează.
  const sw = readFileSync(join(ROOT, "src/sw.js"), "utf8");
  const shellList = sw.match(/const SHELL_FILES = \[([\s\S]*?)\];/);
  if (!shellList) fail("Nu am găsit SHELL_FILES în src/sw.js.");
  const shellFiles = [...shellList[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
  const shellContent = shellFiles.filter((file) => file.startsWith("../content/")).map((file) => file.slice(3));
  for (const file of shellContent) {
    if (file.includes("/private-") || !/^content\/adventures\/[a-z0-9-]+\.json$/.test(file)) fail(`Intrare neașteptată în SHELL_FILES: ${file}`);
    if (!existsSync(join(ROOT, file))) fail(`Lipsește ${file} (cerut de SHELL_FILES).`);
  }

  // Build: folderul se recreează de la zero.
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  const copy = (rel) => {
    const target = join(out, rel);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(join(ROOT, rel), target, { recursive: true });
  };
  copy("index.html");
  copy("src");
  copy(jsonRel);
  for (const path of mediaPaths) copy(`content/adventures/${path}`);
  for (const file of shellContent) copy(file);

  // Antete Cloudflare Pages: fără indexare, fără cache partajat pentru conținut. Protecția reală este Access.
  writeFileSync(join(out, "_headers"), [
    "# Cloudflare Pages (D-079). Protecția este Cloudflare Access, nu aceste antete.",
    "/*",
    "  X-Robots-Tag: noindex, nofollow",
    "  Referrer-Policy: same-origin",
    "/content/*",
    "  Cache-Control: private, no-store",
    "",
  ].join("\n"));

  // Verificare finală: fișierele shell există; nimic din afara allowlist-ului.
  for (const file of shellFiles.filter((f) => !f.startsWith("../") && f !== "./")) {
    if (!existsSync(join(out, "src", file))) fail(`Build incomplet: lipsește src/${file}.`);
  }
  const files = listFiles(out).map((file) => relative(out, file).split(sep).join("/")).sort();
  const allowed = (file) =>
    file === "index.html" || file === "_headers" || file.startsWith("src/") || file === jsonRel ||
    shellContent.includes(file) || mediaPaths.some((path) => file === `content/adventures/${path}`);
  const extra = files.filter((file) => !allowed(file));
  if (extra.length) fail(`Fișiere în afara allowlist-ului: ${extra.join(", ")}`);

  const bytes = files.reduce((sum, file) => sum + statSync(join(out, file)).size, 0);
  console.log(`✔ Build privat generat în ${outInsideRepo ? outRel : out}/ (${files.length} fișiere, ${(bytes / 1024).toFixed(0)} KB)`);
  console.log(`  aventura: ${jsonRel}`);
  console.log(`  media: ${mediaPaths.length} fișiere`);
  console.log(`  deschidere după upload: https://<proiect>.pages.dev/src/?adventure=${id}`);
  console.log("  Upload-ul și Cloudflare Access sunt pași manuali: docs/16_PRIVATE_FIELD_TEST.md");
}

main().catch((error) => fail(error.stack || String(error)));
