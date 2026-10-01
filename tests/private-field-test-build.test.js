// Build-ul privat de field test (D-079) vs. build-ul public (GitHub Pages, D-020).
// Teste GENERICE: nu conțin id-uri, texte sau date ale aventurilor private; acestea sunt
// descoperite la rulare (content/adventures/private-*.json). Fără ele, partea privată este sărită.
// Excepție explicită: aventurile reale publicate pe GitHub Pages prin D-080 (tests/helpers/published-real-adventures.js).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { toAdventureV2 } from "../src/js/schema.js";
import { listMediaPaths } from "../src/js/media.js";
import { PUBLISHED_REAL_ADVENTURES } from "./helpers/published-real-adventures.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const SCRIPT = join(ROOT, "scripts", "build-private-field-test-site.mjs");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");
const privateAdventures = readdirSync(join(ROOT, "content/adventures")).filter((name) => /^private-.+\.json$/.test(name)).map((name) => name.slice(0, -5)).sort();
/** Un fișier al unei aventuri publicate explicit (D-080). */
const isPublishedRealFile = (file) => PUBLISHED_REAL_ADVENTURES.some((id) => file === `content/adventures/${id}.json` || file.startsWith(`content/adventures/media/${id}/`));

let gitAvailable = true;
try {
  execFileSync("git", ["--version"], { cwd: ROOT, stdio: "ignore" });
} catch {
  gitAvailable = false;
}
const git = (args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8" });
const ignored = (path) => spawnSync("git", ["check-ignore", "-q", path], { cwd: ROOT }).status === 0;

function build(adventure, out) {
  return spawnSync(process.execPath, [SCRIPT, "--adventure", adventure, "--out", out], { cwd: ROOT, encoding: "utf8" });
}

/** Toate fișierele de sub `base`, ca rute relative cu „/”. */
function tree(base, dir = base) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...tree(base, full));
    else out.push(relative(base, full).split(sep).join("/"));
  }
  return out.sort();
}

function shellFiles() {
  const list = read("src/sw.js").match(/const SHELL_FILES = \[([\s\S]*?)\];/)[1];
  return [...list.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

/* ---------- Build-ul public (GitHub Pages) ---------- */

test("public: workflow-ul GitHub Pages publică doar index.html, src și content urmărite de Git, fără nimic privat", () => {
  const workflow = read(".github/workflows/deploy-pages.yml");
  assert.match(workflow, /cp -R index\.html src content _site\//);
  assert.match(workflow, /actions\/checkout@/); // publică ce este în Git, nu working tree-ul local
  assert.doesNotMatch(workflow, /private|field-test|cloudflare/i);
});

test("public: niciun fișier privat (în afara celor publicate explicit, D-080) sau build privat nu este urmărit de Git", { skip: !gitAvailable && "git indisponibil" }, () => {
  const tracked = git(["ls-files"]).split("\n").filter(Boolean);
  const published = tracked.filter((file) => file === "index.html" || file.startsWith("src/") || file.startsWith("content/"));
  assert.ok(published.length > 0);
  assert.deepEqual(published.filter((file) => /(^|\/)private-/.test(file) && !isPublishedRealFile(file)), [], "fișier privat (nepublicat) în allowlist-ul public");
  // Nimic privat în afara folderului content/ (Claude outputs, build-ul privat, configurarea locală).
  assert.deepEqual(tracked.filter((file) => /^(Claude outputs|private-field-test)\//.test(file) || file === ".claude/launch.json"), []);
  assert.deepEqual(tracked.filter((file) => file.startsWith("private-field-test/")), [], "build-ul privat este urmărit de Git");
});

test("public: .gitignore protejează JSON-ul privat, media privată și folderul de build privat", { skip: !gitAvailable && "git indisponibil" }, () => {
  assert.ok(ignored("content/adventures/private-exemplu.json"));
  assert.ok(ignored("content/adventures/media/private-exemplu/a.webp"));
  assert.ok(ignored("private-field-test/index.html"));
  assert.ok(ignored("private-field-test/content/adventures/private-exemplu.json"));
  // Conținutul public nu este ignorat din greșeală.
  assert.ok(!ignored("content/adventures/media/demo-challenge-media/panou.svg"));
  assert.ok(!ignored("src/index.html"));
});

/* ---------- Scriptul de build ---------- */

test("script: fără credențiale, fără rețea, fără id de aventură privată în sursă", () => {
  const source = read("scripts/build-private-field-test-site.mjs");
  assert.doesNotMatch(source, /fetch\(|https?:\/\/(?!<proiect>)|token|password|parol|api[_-]?key|secret/i);
  assert.doesNotMatch(source, /private-[a-z0-9]+-[a-z0-9-]+\.json/); // doar șablonul „private-*”, niciun id real
});

test("script: refuză un id invalid, o aventură inexistentă și ieșirea într-un folder sursă", () => {
  const out = mkdtempSync(join(tmpdir(), "oe-field-"));
  try {
    assert.notEqual(build("../x", out).status, 0);
    assert.match(build("nu-exista-aventura", out).stderr, /Lipsește content\/adventures\/nu-exista-aventura\.json/);
    assert.match(build("demo-vertical-slice", "src").stderr, /folder sursă/);
    assert.match(build("demo-vertical-slice", ".").stderr, /rădăcina/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("script: eșuează dacă lipsește un fișier media referit (demo cu media lipsă intenționat)", () => {
  const out = mkdtempSync(join(tmpdir(), "oe-field-"));
  try {
    const result = build("demo-challenge-media", out);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Lipsește fișierul media/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test("script: build-ul conține exact allowlist-ul (aplicația + o aventură + aventura cerută de service worker)", () => {
  const out = mkdtempSync(join(tmpdir(), "oe-field-"));
  try {
    const result = build("demo-vertical-slice", out);
    assert.equal(result.status, 0, result.stderr);
    const built = tree(out);
    for (const file of shellFiles().filter((f) => f !== "./")) {
      const rel = file.startsWith("../") ? file.slice(3) : `src/${file}`;
      assert.ok(built.includes(rel), `lipsește ${rel}`);
    }
    assert.ok(built.includes("index.html") && built.includes("_headers") && built.includes("content/adventures/demo-vertical-slice.json"));
    for (const file of built) {
      assert.ok(file === "index.html" || file === "_headers" || file.startsWith("src/") || file.startsWith("content/adventures/"), `în afara allowlist-ului: ${file}`);
      assert.doesNotMatch(file, /^(docs|tests|scripts|\.git|\.github|\.claude|Claude outputs)\//);
    }
    // Alte aventuri (în afara celei cerute și a celei din SHELL_FILES) nu sunt copiate.
    const adventures = built.filter((file) => /^content\/adventures\/[^/]+\.json$/.test(file));
    const shellAdventures = shellFiles().filter((f) => f.startsWith("../content/")).map((f) => f.slice(3));
    assert.deepEqual(adventures.sort(), [...new Set(["content/adventures/demo-vertical-slice.json", ...shellAdventures])].sort());
    // src/ este copiat identic (motorul nu se schimbă pentru field test).
    for (const file of built.filter((f) => f.startsWith("src/"))) {
      assert.ok(readFileSync(join(out, file)).equals(readFileSync(join(ROOT, file))), `${file} diferă de sursă`);
    }
    assert.match(readFileSync(join(out, "_headers"), "utf8"), /X-Robots-Tag: noindex/);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

/* ---------- Build-ul privat (doar dacă există aventuri private locale) ---------- */

for (const id of privateAdventures.length ? privateAdventures : ["(niciuna)"]) {
  const skip = privateAdventures.length === 0 ? "nu există aventuri private locale" : false;
  const label = skip ? id : `aventura privată #${privateAdventures.indexOf(id) + 1}`;

  // Scriptul de field test privat (D-079) refuză, intenționat, o aventură ale cărei fișiere sunt urmărite de Git.
  const publishedSkip = PUBLISHED_REAL_ADVENTURES.includes(id) && "publicată pe GitHub Pages (D-080), nu prin build-ul privat";
  test(`privat · ${label}: build-ul conține JSON-ul și toate fișierele media, nimic din alte aventuri private`, { skip: skip || publishedSkip }, () => {
    const out = mkdtempSync(join(tmpdir(), "oe-field-"));
    try {
      const result = build(id, out);
      assert.equal(result.status, 0, result.stderr);
      const built = tree(out);
      assert.ok(built.includes(`content/adventures/${id}.json`));
      const media = listMediaPaths(toAdventureV2(JSON.parse(read(`content/adventures/${id}.json`))));
      for (const path of media) assert.ok(built.includes(`content/adventures/${path}`), `lipsește media ${path}`);
      const otherPrivate = built.filter((file) => /(^|\/)private-/.test(file) && !file.includes(id));
      assert.deepEqual(otherPrivate, [], "conținut din altă aventură privată");
      const mediaFiles = built.filter((file) => file.startsWith("content/adventures/media/"));
      assert.equal(mediaFiles.length, media.length, "doar fișierele media referite");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  test(`privat · ${label}: JSON-ul și media sunt ignorate de Git, deci absente din build-ul public`, { skip: skip || publishedSkip || (!gitAvailable && "git indisponibil") }, () => {
    assert.ok(ignored(`content/adventures/${id}.json`));
    const media = listMediaPaths(toAdventureV2(JSON.parse(read(`content/adventures/${id}.json`))));
    for (const path of media) assert.ok(ignored(`content/adventures/${path}`), path);
    assert.ok(existsSync(join(ROOT, "content/adventures", `${id}.json`)));
  });
}
