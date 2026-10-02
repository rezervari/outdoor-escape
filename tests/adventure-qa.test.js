// Adventure QA — Pasul 1 (QA-S01, QA-S02, QA-S03, clasificarea), Pasul 2 (QA-C02 – C05, QA-M01 – M06)
// Pasul 3 (QA-G02 – G07: GPS și structură), Pasul 4 (QA-F00 – F05: flow / progresie) și QA-F08 (final / epilog).
// Mutațiile folosesc numai date FICTIVE: fixture-ul tests/fixtures/adventure-v2-demo.json și aventuri
// sintetice scrise în directoare temporare (cu fișiere media de test).
// Testele nu conțin id-uri, texte sau date ale aventurilor reale: aventura publicată (D-080)
// este luată din lista unică tests/helpers/published-real-adventures.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { runQa, runQaFull, checkFile, checkDuplicateIds } from "../scripts/adventure-qa/rules.mjs";
import { classifyAdventure, CLASSES } from "../scripts/adventure-qa/classify.mjs";
import { QA_EXCEPTIONS, findException } from "../scripts/adventure-qa/exceptions.mjs";
import { MEDIA_EXTENSIONS } from "../scripts/adventure-qa/rules-media.mjs";
import { checkGps, NEAR_ZERO_DEGREES } from "../scripts/adventure-qa/rules-gps.mjs";
import { EVENT_PAYLOAD, IGNORED_MISSION_FLOW_FIELDS, FLOW_PATHS, playFlowPath, simulateFlow } from "../scripts/adventure-qa/rules-flow.mjs";
import { EVENT_TYPES } from "../src/js/events.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { buildViewModel } from "../src/js/view-model.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { distanceMeters } from "../src/js/geo.js";
import { PUBLISHED_REAL_ADVENTURES } from "./helpers/published-real-adventures.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ADVENTURES_DIR = join(ROOT, "content", "adventures");
const CLI = join(ROOT, "scripts", "qa-adventures.mjs");

const fixtureText = readFileSync(join(ROOT, "tests", "fixtures", "adventure-v2-demo.json"), "utf8");
const fixture = () => JSON.parse(fixtureText);
const FIXTURE_FILE = `${fixture().id}.json`;
const entry = (fileName, data) => ({ fileName, text: typeof data === "string" ? data : JSON.stringify(data) });
const rules = (findings) => findings.map((f) => f.ruleId);

/** Aventură sintetică minimă, validă: o ghicitoare cu răspuns și indiciu, fără media. */
function synthetic(id, extra = {}) {
  return {
    schemaVersion: 2,
    id,
    demo: true,
    meta: { title: "Aventură de test QA" },
    missions: [{ id: "m-unu", type: "riddle", title: "Unu", briefing: "Text de test.", points: 10, answer: "sud", hints: [{ text: "Indiciu de test." }] }],
    ...extra,
  };
}

/** Mutație pe prima misiune a unei aventuri sintetice. */
const withMission = (id, patch) => {
  const data = synthetic(id);
  Object.assign(data.missions[0], patch);
  return data;
};

/**
 * Rulează QA pe o aventură scrisă într-un director temporar, cu fișierele media date
 * ({ "media/<id>/a.svg": "<svg/>" }). Întoarce rezultatul fișierului.
 */
function qaOnDisk(data, { files = {}, fileName = `${data.id}.json` } = {}) {
  const dir = mkdtempSync(join(tmpdir(), "oe-qa-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), content);
    }
    writeFileSync(join(dir, fileName), JSON.stringify(data));
    return runQa([{ fileName, dir, text: JSON.stringify(data) }]).results[0];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Regulile active (fără excepțiile declarate) ale unui rezultat, opțional filtrate după prefix. */
const active = (result, prefix = "QA-") => result.findings.filter((f) => !f.waived && f.ruleId.startsWith(prefix));
const activeRules = (result, prefix) => rules(active(result, prefix));

/** Aventură sintetică cu media: o imagine și un sunet, ambele folosite de misiune. */
function withMedia(id, assets, blocks) {
  return synthetic(id, {
    media: { basePath: `media/${id}/`, assets },
    missions: [{ ...synthetic(id).missions[0], media: blocks }],
  });
}
const IMG = (src) => ({ type: "image", src, alt: "Imagine de test" });
const SND = (src) => ({ type: "audio", src, kind: "sfx" });

/* ---------- Toate aventurile din repository ---------- */

const repoQa = () => {
  const names = readdirSync(ADVENTURES_DIR).filter((name) => name.endsWith(".json"));
  return { names, ...runQa(names.map((fileName) => ({ fileName, dir: ADVENTURES_DIR, text: readFileSync(join(ADVENTURES_DIR, fileName), "utf8") }))) };
};

test("QA: toate fișierele content/adventures/*.json trec QA-S01, QA-S02 și QA-S03", () => {
  const { names, results, summary } = repoQa();
  assert.ok(names.length > 0);
  assert.equal(summary.files, names.length);
  for (const result of results) {
    const structural = result.findings.filter((f) => /^QA-S0/.test(f.ruleId));
    assert.deepEqual(structural, [], `${result.label}: ${structural.map((f) => f.message).join(" | ")}`);
  }
  // Fișierele urmărite din repository nu sunt anomalii.
  assert.ok(results.every((r) => r.classification !== CLASSES.ANOMALY), results.map((r) => `${r.label}: ${r.classification}`).join(", "));
});

test("QA: aventurile din repository nu au erori (în afara excepțiilor declarate); avertismentele sunt permise", () => {
  const { results, summary } = repoQa();
  const errors = results.flatMap((r) => r.findings.filter((f) => f.level === "error" && !f.waived).map((f) => `${r.label}: ${f.ruleId} ${f.message}`));
  assert.deepEqual(errors, []);
  assert.equal(summary.errors, 0);
  // Fiecare excepție declarată este folosită (nu rămân excepții vechi, fără obiect).
  const waived = results.flatMap((r) => r.findings.filter((f) => f.waived).map((f) => `${r.fileName}|${f.ruleId}|${f.subject}`));
  assert.deepEqual(waived.sort(), QA_EXCEPTIONS.map((e) => `${e.file}|${e.ruleId}|${e.subject}`).sort());
});

/* ---------- QA-S01 ---------- */

test("QA-S01: fixture-ul fictiv trece; JSON invalid → eroare", () => {
  assert.deepEqual(checkFile(entry(FIXTURE_FILE, fixtureText)).findings, []);
  const broken = checkFile(entry(FIXTURE_FILE, "{ \"id\": "));
  assert.equal(broken.data, undefined);
  assert.deepEqual(rules(broken.findings), ["QA-S01"]);
  assert.equal(broken.findings[0].level, "error");
  assert.match(broken.findings[0].message, /^JSON invalid/);
});

test("QA-S01: BOM-ul UTF-8 este acceptat (ca response.json() din browser)", () => {
  assert.deepEqual(checkFile(entry(FIXTURE_FILE, String.fromCharCode(0xfeff) + fixtureText)).findings, []);
});

test("QA-S01: erorile validatorului existent (schema.js) devin findings, fără o copie a schemei", () => {
  const data = fixture();
  delete data.meta.title;
  data.missions[0].points = -1;
  const { findings } = checkFile(entry(FIXTURE_FILE, data));
  assert.ok(findings.length >= 2);
  assert.ok(findings.every((f) => f.ruleId === "QA-S01" && f.level === "error"));
  assert.ok(findings.some((f) => /meta\.title/.test(f.message)));
  assert.ok(findings.some((f) => /missions\[0\]\.points/.test(f.message)));
});

/* ---------- QA-S02 ---------- */

test("QA-S02: id-ul diferit de numele fișierului → eroare", () => {
  const { findings } = checkFile(entry("alt-nume.json", fixture()));
  assert.deepEqual(rules(findings), ["QA-S02"]);
  assert.equal(findings[0].level, "error");
  assert.equal(findings[0].path, "id");
});

/* ---------- QA-S03 ---------- */

test("QA-S03: același id în două fișiere → eroare pe ambele, cu celălalt fișier numit", () => {
  const { results, summary } = runQa([entry(FIXTURE_FILE, fixture()), entry("copie-demo.json", fixture())]);
  const byFile = Object.fromEntries(results.map((r) => [r.fileName, r]));
  assert.ok(rules(byFile[FIXTURE_FILE].findings).includes("QA-S03"));
  assert.ok(rules(byFile["copie-demo.json"].findings).includes("QA-S03"));
  assert.match(byFile[FIXTURE_FILE].findings.find((f) => f.ruleId === "QA-S03").message, /copie-demo\.json/);
  assert.equal(byFile[FIXTURE_FILE].status, "ERROR");
  assert.equal(summary.failedFiles, 2);
  // Funcția separată: fără duplicate → nimic.
  assert.equal(checkDuplicateIds([{ fileName: "a.json", id: "a" }, { fileName: "b.json", id: "b" }]).size, 0);
});

test("QA-S03: cu `targets`, se raportează doar fișierul cerut, dar duplicatele se caută în toate", () => {
  const { results } = runQa([entry(FIXTURE_FILE, fixture()), entry("copie-demo.json", fixture())], { targets: [FIXTURE_FILE] });
  assert.deepEqual(results.map((r) => r.fileName), [FIXTURE_FILE]);
  assert.ok(rules(results[0].findings).includes("QA-S03"));
});

/* ---------- Clasificare ---------- */

test("clasificare: public-demo", () => {
  assert.equal(classifyAdventure(FIXTURE_FILE, fixture()), CLASSES.PUBLIC_DEMO);
});

test("clasificare: published-real — lista unică D-080, indiferent de prefixul „private-”", () => {
  assert.ok(PUBLISHED_REAL_ADVENTURES.length > 0);
  for (const id of PUBLISHED_REAL_ADVENTURES) {
    assert.equal(classifyAdventure(`${id}.json`, { id }), CLASSES.PUBLISHED_REAL);
    assert.equal(classifyAdventure(`${id}.json`, undefined), CLASSES.PUBLISHED_REAL);
  }
  assert.equal(classifyAdventure("exemplu.json", {}, { published: ["exemplu"] }), CLASSES.PUBLISHED_REAL);
});

test("clasificare: private-local — „private-*.json” nepublicat, chiar dacă JSON-ul este invalid", () => {
  assert.equal(classifyAdventure("private-exemplu.json", { id: "private-exemplu" }), CLASSES.PRIVATE_LOCAL);
  assert.equal(classifyAdventure("private-exemplu.json", undefined), CLASSES.PRIVATE_LOCAL);
});

test("clasificare: anomaly — nume public fără demo: true sau JSON necitibil", () => {
  const data = fixture();
  delete data.demo;
  assert.equal(classifyAdventure("aventura-noua.json", data), CLASSES.ANOMALY);
  assert.equal(classifyAdventure("aventura-noua.json", { ...data, demo: false }), CLASSES.ANOMALY);
  assert.equal(classifyAdventure("aventura-noua.json", undefined), CLASSES.ANOMALY);
});

/* ---------- Confidențialitate în rezultat ---------- */

test("aventurile private locale apar ca „aventura privată #N”, fără nume de fișier și fără valorile citate", () => {
  const data = { ...fixture(), id: "private-exemplu-secret", demo: false };
  const { results } = runQa([entry("private-exemplu.json", data), entry("private-alt.json", "{ nu este json")]);
  assert.deepEqual(results.map((r) => r.label), ["aventura privată #1", "aventura privată #2"]);
  const text = JSON.stringify(results.map((r) => ({ label: r.label, findings: r.findings })));
  assert.doesNotMatch(text, /exemplu-secret|nu este json/);
  assert.ok(results.every((r) => r.status === "ERROR"));
});

test("aventurile private locale: id-urile din dicționare (mesaje, sunete, media) nu apar în mesajele schemei", () => {
  const data = { ...fixture(), id: "private-exemplu", demo: false };
  data.narrator.messages["mesaj-ascuns"] = { text: "" };
  data.media = { assets: { "imagine-ascunsa": { type: "image", src: "/absolut.svg" } } };
  const { results } = runQa([entry("private-exemplu.json", data)]);
  const messages = results[0].findings.map((f) => f.message);
  assert.ok(messages.some((m) => m.includes("narrator.messages.…")), messages.join(" | "));
  assert.ok(messages.some((m) => m.includes("media.assets.…")), messages.join(" | "));
  assert.doesNotMatch(messages.join(" | "), /mesaj-ascuns|imagine-ascunsa|private-exemplu/);
  // Aceleași erori, nemascate, pentru o aventură publică (conținut public).
  const publicResult = runQa([entry(FIXTURE_FILE, { ...data, id: fixture().id, demo: true })]).results[0];
  assert.match(publicResult.findings.map((f) => f.message).join(" | "), /media\.assets\.imagine-ascunsa/);
});

/* ---------- CLI ---------- */

const runCli = (...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: "utf8" });

test("CLI: repository-ul actual → exit 0 (implicit, --public-only); --strict → 1 doar dacă există avertismente", () => {
  for (const args of [[], ["--public-only"]]) {
    const run = runCli(...args);
    assert.equal(run.status, 0, `${args.join(" ")}\n${run.stdout}${run.stderr}`);
    assert.match(run.stdout, /Rezultat: PASS/);
  }
  const { summary } = repoQa();
  const strict = runCli("--strict");
  assert.equal(strict.status, summary.warnings > 0 ? 1 : 0, strict.stdout);
  // --public-only nu raportează aventurile private locale.
  assert.doesNotMatch(runCli("--public-only").stdout, /aventura privată|private-local/);
});

test("CLI: un singur fișier — raportat singur, comparat (QA-S03) cu toate content/adventures/*.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "oe-qa-"));
  try {
    // Fișier valid, din afara repository-ului → PASS, doar el în raport.
    const good = join(dir, "test-qa-valid.json");
    writeFileSync(good, JSON.stringify(synthetic("test-qa-valid")));
    const single = runCli(good);
    assert.equal(single.status, 0, single.stdout);
    assert.match(single.stdout, /PASS\s+test-qa-valid\.json/);
    assert.match(single.stdout, /1 fișier\b/);

    // id ≠ nume de fișier → QA-S02.
    const bad = join(dir, "aventura-gresita.json");
    writeFileSync(bad, fixtureText);
    const run = runCli(bad);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stdout, /ERROR\s+aventura-gresita\.json/);
    assert.match(run.stdout, /QA-S02/);
    assert.match(run.stdout, /Rezultat: FAIL/);

    // Id-ul unei aventuri existente din content/adventures/, sub alt nume → QA-S03 numește fișierul din repository.
    const demoText = readFileSync(join(ADVENTURES_DIR, "demo-vertical-slice.json"), "utf8");
    const copy = join(dir, "copie-demo.json");
    writeFileSync(copy, demoText);
    const duplicate = runCli(copy);
    assert.equal(duplicate.status, 1, duplicate.stdout);
    assert.match(duplicate.stdout, /QA-S03.*demo-vertical-slice\.json/);
    assert.doesNotMatch(duplicate.stdout, /ERROR\s+demo-vertical-slice\.json/, "doar fișierul cerut este raportat");

    // Același nume ca un fișier din repository = versiunea care îl înlocuiește → nu este duplicat.
    const replacement = join(dir, "demo-vertical-slice.json");
    writeFileSync(replacement, demoText);
    assert.equal(runCli(replacement).status, 0);

    // Fișier din repository dat explicit.
    assert.equal(runCli(join(ADVENTURES_DIR, "demo-gps-brasov.json")).status, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  assert.equal(runCli("--necunoscut").status, 2);
});

/* ---------- Pasul 2 · QA-C02 – C05: misiunile cu răspuns ---------- */

test("QA-C02: răspunsul printre variante (după normalizarea din answers.js) → PASS", () => {
  const plain = qaOnDisk(withMission("test-qa-c02-ok", { choices: ["Nord", "Sud", "Est"] }));
  assert.deepEqual(activeRules(plain, "QA-C"), []);
  // Aceeași normalizare ca motorul: majuscule, spații, diacritice.
  const normalized = qaOnDisk(withMission("test-qa-c02-diacritice", { answer: "Piață", choices: ["piata", "Turn"] }));
  assert.deepEqual(activeRules(normalized, "QA-C"), []);
});

test("QA-C02: răspunsul lipsește din variante → ERROR, cu calea misiunii", () => {
  const result = qaOnDisk(withMission("test-qa-c02-lipsa", { choices: ["Nord", "Est"] }));
  const [finding] = active(result, "QA-C02");
  assert.equal(finding.level, "error");
  assert.equal(finding.path, "missions[0].choices");
  assert.equal(result.status, "ERROR");
});

test("QA-C03: variante identice după normalizare → ERROR; variante distincte → PASS", () => {
  const duplicate = qaOnDisk(withMission("test-qa-c03-dup", { choices: ["Sud", " sud ", "Nord"] }));
  const [finding] = active(duplicate, "QA-C03");
  assert.equal(finding.level, "error");
  assert.equal(finding.path, "missions[0].choices[1]");
  assert.deepEqual(activeRules(qaOnDisk(withMission("test-qa-c03-maj", { choices: ["Sud", "SUD"] })), "QA-C03"), ["QA-C03"]);
  assert.deepEqual(activeRules(qaOnDisk(withMission("test-qa-c03-ok", { choices: ["Sud", "Nord", "Est"] })), "QA-C03"), []);
});

test("QA-C04: răspuns numeric valid (întreg ≥ 0, formă canonică) → PASS", () => {
  for (const answer of ["0", "7", "42", "1906", " 42 "]) {
    const result = qaOnDisk(withMission("test-qa-c04-ok", { answer, inputMode: "numeric" }));
    assert.deepEqual(activeRules(result, "QA-C04"), [], answer);
  }
});

test("QA-C04: răspuns numeric invalid sau ambiguu → ERROR", () => {
  for (const answer of ["03", "3.0", "-3", "3,5", "abc", "3 4"]) {
    const result = qaOnDisk(withMission("test-qa-c04-gresit", { answer, inputMode: "numeric" }));
    const [finding] = active(result, "QA-C04");
    assert.ok(finding, answer);
    assert.equal(finding.level, "error");
    assert.equal(finding.path, "missions[0].answer");
  }
  // Fără inputMode numeric, regula nu se aplică.
  assert.deepEqual(activeRules(qaOnDisk(withMission("test-qa-c04-text", { answer: "03" })), "QA-C04"), []);
});

test("QA-C05: misiune cu răspuns fără indiciu → WARNING (nu eroare); misiunea „location” nu are nevoie", () => {
  const result = qaOnDisk(withMission("test-qa-c05", { hints: [] }));
  const [finding] = active(result, "QA-C05");
  assert.equal(finding.level, "warning");
  assert.equal(finding.path, "missions[0].hints");
  assert.equal(result.status, "WARNING");

  const location = synthetic("test-qa-c05-loc", {
    locations: [{ id: "l-unu", name: "Loc", type: "objective", coordinates: { lat: 0.001, lng: 0.001 } }],
  });
  location.missions.push({ id: "m-loc", type: "location", title: "Loc", briefing: "Text.", points: 0, locationId: "l-unu" });
  assert.deepEqual(activeRules(qaOnDisk(location), "QA-C05"), []);
});

/* ---------- Pasul 2 · QA-M01 – M06: media ---------- */

const ID = "test-qa-media";
const OK_FILES = { [`media/${ID}/a.svg`]: "<svg/>", [`media/${ID}/b.wav`]: "RIFF" };
const okMedia = () => withMedia(ID, { "img-a": IMG("a.svg"), "snd-b": SND("b.wav") },
  [{ type: "image", asset: "img-a" }, { type: "audio", asset: "snd-b" }]);

test("QA-M01: media existentă → PASS (nicio regulă activă)", () => {
  const result = qaOnDisk(okMedia(), { files: OK_FILES });
  assert.deepEqual(active(result), []);
  assert.equal(result.status, "PASS");
});

test("QA-M01: media lipsă → ERROR; majusculele trebuie să fie exacte (GitHub Pages)", () => {
  const missing = qaOnDisk(okMedia(), { files: { [`media/${ID}/a.svg`]: "<svg/>" } });
  const [finding] = active(missing, "QA-M01");
  assert.equal(finding.level, "error");
  assert.equal(finding.path, "media.assets.snd-b");
  assert.equal(finding.subject, `media/${ID}/b.wav`);

  const wrongCase = qaOnDisk(okMedia(), { files: { [`media/${ID}/A.svg`]: "<svg/>", [`media/${ID}/b.wav`]: "RIFF" } });
  assert.ok(activeRules(wrongCase, "QA-M01").includes("QA-M01"));
});

test("QA-M01: formatul vechi audio.tracks este verificat la fel (registrul unificat)", () => {
  const data = okMedia();
  data.audio = { basePath: `media/${ID}/`, tracks: { "voce-veche": { src: "lipsa.wav", kind: "sfx" } } };
  data.events = [{ id: "r-sunet", on: "adventure_started", do: [{ action: "play_audio", trackId: "voce-veche" }] }];
  const [finding] = active(qaOnDisk(data, { files: OK_FILES }), "QA-M01");
  assert.equal(finding.path, "audio.tracks.voce-veche");
});

/** QA-M02 în memorie (fără fișiere): un singur asset folosit de misiune. */
const m02 = (type, src) => {
  const asset = type === "image" ? IMG(src) : SND(src);
  const data = withMedia(ID, { "asset-x": asset }, [{ type, asset: "asset-x" }]);
  return runQa([entry(`${ID}.json`, data)]).results[0];
};

test("QA-M02: extensiile permise pe tip (convenția proiectului) → PASS, inclusiv cu majuscule", () => {
  for (const ext of ["svg", "png", "jpg", "jpeg", "webp", "gif", "avif", "SVG", "Jpg"]) {
    assert.deepEqual(active(m02("image", `x.${ext}`)), [], `image .${ext}`);
  }
  for (const ext of ["wav", "mp3", "m4a", "aac", "MP3"]) {
    assert.deepEqual(active(m02("audio", `x.${ext}`)), [], `audio .${ext}`);
  }
  assert.deepEqual(MEDIA_EXTENSIONS, {
    image: [".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".avif"],
    audio: [".mp3", ".m4a", ".aac", ".wav"],
  });
});

test("QA-M02: extensie nepotrivită cu tipul, .ogg, necunoscută sau lipsă → ERROR", () => {
  for (const [type, src] of [
    ["image", "x.wav"], // sunet declarat imagine
    ["audio", "x.svg"], // imagine declarată sunet
    ["audio", "x.ogg"], // OGG nu este permis
    ["audio", "x.OGG"],
    ["image", "x.bmp"], // necunoscută
    ["image", "x.svg.txt"],
    ["audio", "x"], // fără extensie
  ]) {
    const [finding] = active(m02(type, src));
    assert.ok(finding, `${type} ${src}`);
    assert.equal(finding.ruleId, "QA-M02");
    assert.equal(finding.level, "error");
    assert.equal(finding.path, "media.assets.asset-x");
  }
  // Formatul vechi audio.tracks este „audio”: aceeași regulă.
  const legacy = synthetic(ID, { audio: { basePath: `media/${ID}/`, tracks: { "snd-vechi": { src: "x.ogg", kind: "sfx" } } } });
  legacy.events = [{ id: "r-sunet", on: "adventure_started", do: [{ action: "play_audio", trackId: "snd-vechi" }] }];
  assert.deepEqual(activeRules(runQa([entry(`${ID}.json`, legacy)]).results[0], "QA-M02"), ["QA-M02"]);
});

test("QA-M02: un tip media necunoscut sau rezervat este respins deja de schemă (QA-S01), nu duplicat de QA-M02", () => {
  for (const type of ["video", "document"]) {
    const data = withMedia(ID, { "asset-x": { type, src: "x.mp4" } }, []);
    const result = runQa([entry(`${ID}.json`, data)]).results[0];
    assert.ok(active(result, "QA-S01").some((f) => /media\.assets\.asset-x\.type/.test(f.message)), type);
    assert.deepEqual(activeRules(result, "QA-M02"), [], type);
  }
});

test("QA-M03: aceeași cale declarată de două asset-uri → ERROR; reutilizarea aceluiași asset → PASS", () => {
  const duplicate = withMedia(ID, { "img-a": IMG("a.svg"), "img-a-copie": IMG("a.svg") },
    [{ type: "compare", before: "img-a", after: "img-a-copie" }]);
  const [finding] = active(qaOnDisk(duplicate, { files: OK_FILES }), "QA-M03");
  assert.equal(finding.level, "error");
  assert.equal(finding.path, "media.assets.img-a-copie");

  // Același fișier declarat în media.assets și în audio.tracks: tot duplicat de declarație.
  const crossRegistry = okMedia();
  crossRegistry.audio = { basePath: `media/${ID}/`, tracks: { "snd-vechi": { src: "b.wav", kind: "sfx" } } };
  crossRegistry.events = [{ id: "r-sunet", on: "adventure_started", do: [{ action: "play_audio", trackId: "snd-vechi" }] }];
  assert.deepEqual(activeRules(qaOnDisk(crossRegistry, { files: OK_FILES }), "QA-M03"), ["QA-M03"]);

  // Același asset folosit de două misiuni: mecanismul normal, nu duplicat.
  const reused = okMedia();
  reused.missions.push({ ...reused.missions[0], id: "m-doi", media: [{ type: "image", asset: "img-a" }] });
  assert.deepEqual(activeRules(qaOnDisk(reused, { files: OK_FILES }), "QA-M03"), []);
});

test("QA-M04: asset declarat, dar nefolosit → WARNING; folosirea prin narator sau play_audio contează", () => {
  const unused = withMedia(ID, { "img-a": IMG("a.svg"), "snd-b": SND("b.wav") }, [{ type: "image", asset: "img-a" }]);
  const [finding] = active(qaOnDisk(unused, { files: OK_FILES }), "QA-M04");
  assert.equal(finding.level, "warning");
  assert.equal(finding.path, "media.assets.snd-b");

  const viaNarrator = structuredClone(unused);
  viaNarrator.narrator = { messages: { intro: { text: "Mesaj de test.", audio: "snd-b" } } };
  assert.deepEqual(activeRules(qaOnDisk(viaNarrator, { files: OK_FILES }), "QA-M04"), []);

  const viaEvent = structuredClone(unused);
  viaEvent.events = [{ id: "r-sunet", on: "adventure_started", do: [{ action: "play_audio", trackId: "snd-b" }] }];
  assert.deepEqual(activeRules(qaOnDisk(viaEvent, { files: OK_FILES }), "QA-M04"), []);
});

test("QA-M05: cale în afara directorului media al aventurii → ERROR (rezolvare de cale, nu doar text)", () => {
  const outside = (basePath, src) => {
    const data = withMedia(ID, { "img-x": IMG(src) }, [{ type: "image", asset: "img-x" }]);
    data.media.basePath = basePath;
    return qaOnDisk(data, { files: { "media/alta-aventura/x.svg": "<svg/>", "x.svg": "<svg/>", [`media/${ID}-copie/x.svg`]: "<svg/>" } });
  };
  for (const [basePath, src] of [
    [`media/${ID}/`, "../alta-aventura/x.svg"], // urcă în alt folder (respins și de schemă)
    ["", "/absolut/x.svg"], // cale absolută (respinsă și de schemă)
    ["/absolut/", "x.svg"], // basePath absolut (respins și de schemă)
    ["media/alta-aventura/", "x.svg"], // folderul altei aventuri: permis de schemă, respins de QA
    ["", "x.svg"], // direct în content/adventures/
    [`media/${ID}-copie/`, "x.svg"], // prefix asemănător, alt folder
  ]) {
    const result = outside(basePath, src);
    const [finding] = active(result, "QA-M05");
    assert.ok(finding, `${basePath}${src}`);
    assert.equal(finding.level, "error");
    assert.equal(finding.path, "media.assets.img-x");
    assert.deepEqual(activeRules(result, "QA-M01"), [], "o cale respinsă nu mai este căutată pe disc");
  }
  // Subfolder în directorul aventurii: permis.
  const nested = withMedia(ID, { "img-a": IMG("imagini/a.svg") }, [{ type: "image", asset: "img-a" }]);
  assert.deepEqual(active(qaOnDisk(nested, { files: { [`media/${ID}/imagini/a.svg`]: "<svg/>" } })), []);
});

test("QA-M06: fișier nedeclarat în directorul media al aventurii → WARNING; alte aventuri și fișierele de sistem sunt ignorate", () => {
  const files = {
    ...OK_FILES,
    [`media/${ID}/orfan.svg`]: "<svg/>",
    [`media/${ID}/sub/orfan2.wav`]: "RIFF",
    [`media/${ID}/.gitkeep`]: "",
    [`media/${ID}/Thumbs.db`]: "",
    "media/alta-aventura/strain.svg": "<svg/>",
  };
  const result = qaOnDisk(okMedia(), { files });
  const orphans = active(result, "QA-M06");
  assert.deepEqual(orphans.map((f) => f.subject).sort(), [`media/${ID}/orfan.svg`, `media/${ID}/sub/orfan2.wav`]);
  assert.ok(orphans.every((f) => f.level === "warning"));
  assert.equal(result.status, "WARNING");
  // Fără folder media propriu: nimic de raportat.
  assert.deepEqual(activeRules(qaOnDisk(synthetic("test-qa-fara-media"), { files: { "media/alta-aventura/strain.svg": "<svg/>" } }), "QA-M06"), []);
});

test("QA-M01 / M06 au nevoie de disc: fără `dir`, nu rulează (text verificat în memorie)", () => {
  const { results } = runQa([entry(`${ID}.json`, okMedia())]);
  assert.deepEqual(activeRules(results[0], "QA-M01"), []);
  assert.deepEqual(activeRules(results[0], "QA-M06"), []);
});

/* ---------- Pasul 2 · excepții declarate și confidențialitate ---------- */

test("excepții declarate: potrivire exactă (fișier + regulă + subiect); finding-ul rămâne vizibil, dar nu se numără", () => {
  const exceptions = [{ file: `${ID}.json`, ruleId: "QA-M01", subject: `media/${ID}/b.wav`, reason: "test" }];
  assert.ok(findException(`${ID}.json`, { ruleId: "QA-M01", subject: `media/${ID}/b.wav` }, exceptions));
  assert.equal(findException("alt-fisier.json", { ruleId: "QA-M01", subject: `media/${ID}/b.wav` }, exceptions), null);
  assert.equal(findException(`${ID}.json`, { ruleId: "QA-M04", subject: `media/${ID}/b.wav` }, exceptions), null);
  assert.equal(findException(`${ID}.json`, { ruleId: "QA-M01", subject: `media/${ID}/c.wav` }, exceptions), null);

  // Excepția reală din repository: vizibilă, cu motiv, fără să blocheze.
  const { results } = repoQa();
  const waived = results.flatMap((r) => r.findings.filter((f) => f.waived));
  assert.equal(waived.length, QA_EXCEPTIONS.length);
  assert.ok(waived.every((f) => f.level === "error" && typeof f.waived === "string" && f.waived.length > 0));
  assert.notEqual(results.find((r) => r.fileName === QA_EXCEPTIONS[0].file).status, "ERROR");
});

test("aventurile private locale: finding-urile media și de răspuns nu expun id-ul, folderul, căile sau id-urile asset-urilor", () => {
  const id = "private-test-qa-ascuns";
  const data = withMedia(id, { "img-secreta": IMG("a.svg"), "snd-secret": SND("lipsa.wav") }, [{ type: "image", asset: "img-secreta" }]);
  data.demo = false;
  data.missions[0].choices = ["Nord", "Est"];
  const result = qaOnDisk(data, { files: { [`media/${id}/a.svg`]: "<svg/>", [`media/${id}/orfan-secret.svg`]: "<svg/>" } });
  assert.equal(result.label, "aventura privată #1");
  assert.deepEqual([...new Set(activeRules(result))].sort(), ["QA-C02", "QA-M01", "QA-M04", "QA-M06"]);
  const text = JSON.stringify(result.findings);
  assert.doesNotMatch(text, /test-qa-ascuns|img-secreta|snd-secret|lipsa\.wav|orfan-secret|m-unu/);
  assert.ok(result.findings.every((f) => f.subject === undefined), "subiectul (calea) nu este păstrat pentru private");
});

/* ---------- Pasul 2 · --strict ---------- */

test("CLI --strict: un avertisment (QA-C05) → exit 0 implicit, exit 1 cu --strict", () => {
  const dir = mkdtempSync(join(tmpdir(), "oe-qa-"));
  try {
    const file = join(dir, "test-qa-strict.json");
    writeFileSync(file, JSON.stringify(withMission("test-qa-strict", { hints: [] })));
    const normal = runCli(file);
    assert.equal(normal.status, 0, normal.stdout);
    assert.match(normal.stdout, /WARNING\s+test-qa-strict\.json/);
    assert.match(normal.stdout, /W QA-C05/);
    assert.match(normal.stdout, /Rezultat: PASS \(0 erori, 1 avertismente/);
    const strict = runCli(file, "--strict");
    assert.equal(strict.status, 1, strict.stdout);
    assert.match(strict.stdout, /Rezultat: FAIL/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------- Pasul 3 · QA-G02 – G07: GPS și structură ---------- */

const BASE = { lat: 0.001, lng: 0.001 }; // coordonate fictive, lângă 0°, 0°
const LOC = (id, coordinates = BASE, extra = {}) => ({
  id, name: `Loc ${id}`, type: "objective", coordinates: { ...coordinates }, radius: 20,
  fallback: { instructions: "Instrucțiuni de rezervă de test." }, ...extra,
});
const GO = (id, locationId, extra = {}) => ({ id, type: "location", title: "Mergi", briefing: "Text de test.", points: 0, locationId, ...extra });
const RIDDLE = (id, extra = {}) => ({ id, type: "riddle", title: "Ghicitoare", briefing: "Text de test.", points: 10, answer: "sud", hints: [{ text: "Indiciu de test." }], ...extra });

/** Aventură GPS sintetică: implicit, câte o misiune „location” pentru fiecare locație. */
function gpsAdventure(id, locations, { missions = locations.map((l, i) => GO(`m-${i + 1}`, l.id)), ...extra } = {}) {
  return { schemaVersion: 2, id, demo: true, meta: { title: "Aventură GPS de test QA" }, locations, missions, ...extra };
}
const gpsQa = (data, fileName = `${data.id}.json`) => runQa([entry(fileName, data)]).results[0];

/**
 * Punctul spre nord, la cea mai mică latitudine pentru care geo.distanceMeters(from, punct) ≥ meters
 * (aceeași formulă ca motorul; ajustat până la limita reprezentabilă). Pentru 40 m dă exact 40 (zone tangente).
 */
function north(meters, from = BASE) {
  let lat = from.lat + ((meters / 6371008.8) * 180) / Math.PI;
  while (distanceMeters(from, { lat, lng: from.lng }) < meters) lat += Math.abs(lat) * Number.EPSILON;
  return { lat, lng: from.lng };
}

/* QA-G02 */

test("QA-G02: confirmarea manuală implicită + instrucțiuni → PASS; settings / location stabilesc valoarea efectivă", () => {
  const ok = gpsQa(gpsAdventure("test-qa-g02-ok", [LOC("l-a")]));
  assert.deepEqual(active(ok), []);
  assert.equal(ok.status, "PASS");

  const settingsOff = gpsQa(gpsAdventure("test-qa-g02-settings", [LOC("l-a")], { settings: { gps: { allowManualConfirmation: false } } }));
  const [off] = active(settingsOff, "QA-G02");
  assert.equal(off.level, "error");
  assert.equal(off.path, "settings.gps.allowManualConfirmation");
  assert.equal(settingsOff.status, "ERROR");

  const locationOn = gpsAdventure("test-qa-g02-loc-on", [LOC("l-a", BASE, { fallback: { instructions: "Text.", allowManualConfirmation: true } })],
    { settings: { gps: { allowManualConfirmation: false } } });
  assert.deepEqual(activeRules(gpsQa(locationOn), "QA-G02"), []);

  const locationOff = gpsAdventure("test-qa-g02-loc-off", [LOC("l-a", BASE, { fallback: { instructions: "Text.", allowManualConfirmation: false } })],
    { settings: { gps: { allowManualConfirmation: true } } });
  const [offLocal] = active(gpsQa(locationOff), "QA-G02");
  assert.equal(offLocal.level, "error");
  assert.equal(offLocal.path, "locations[0].fallback.allowManualConfirmation");
});

test("QA-G02: fallback.instructions lipsă, gol sau doar spații → ERROR", () => {
  for (const [label, fallback] of [
    ["fără fallback", undefined],
    ["fără instructions", { allowManualConfirmation: true }],
    ["gol", { instructions: "" }],
    ["un spațiu", { instructions: " " }],
    ["spații albe", { instructions: " \n\t " }],
  ]) {
    const location = LOC("l-a");
    if (fallback === undefined) delete location.fallback;
    else location.fallback = fallback;
    const findings = active(gpsQa(gpsAdventure("test-qa-g02-instr", [location])), "QA-G02");
    assert.deepEqual(findings.map((f) => [f.level, f.path]), [["error", "locations[0].fallback.instructions"]], label);
  }
});

test("QA-G02: excluse — locația ascunsă, locația folosită doar de o misiune cu răspuns, aventura V1 fără locații", () => {
  const hidden = LOC("l-ascuns", BASE, { hiddenUntilDiscovered: true, fallback: { allowManualConfirmation: false } });
  assert.deepEqual(activeRules(gpsQa(gpsAdventure("test-qa-g02-ascuns", [hidden])), "QA-G02"), []);

  const answerOnly = LOC("l-raspuns");
  delete answerOnly.fallback;
  const viaRiddle = gpsAdventure("test-qa-g02-raspuns", [answerOnly], { missions: [RIDDLE("m-1", { locationId: "l-raspuns" })] });
  assert.deepEqual(active(gpsQa(viaRiddle)), []);

  const v1 = {
    schemaVersion: 1, id: "test-qa-g02-v1", demo: true, title: "Aventură V1 de test",
    challenges: [{ id: "c-unu", title: "Unu", description: "Text de test.", answer: "sud", hint: "Indiciu de test.", points: 10 }],
  };
  const v1Result = gpsQa(v1);
  assert.deepEqual(active(v1Result), []);
  assert.equal(v1Result.status, "PASS");
});

test("QA-G02 / QA-G07: demo-gps-brasov — excepția D-068, vizibilă (waived) și fără să blocheze", () => {
  const { results } = repoQa();
  const brasov = results.find((r) => r.fileName === "demo-gps-brasov.json");
  assert.notEqual(brasov.status, "ERROR");
  for (const ruleId of ["QA-G02", "QA-G07"]) {
    const findings = brasov.findings.filter((f) => f.ruleId === ruleId);
    assert.equal(findings.length, 3, ruleId);
    assert.ok(findings.every((f) => f.level === "error" && /^D-068/.test(f.waived)), ruleId);
  }
  assert.deepEqual(active(brasov, "QA-G"), []);
});

/* QA-G03 */

test("QA-G03: misiune principală fără locationId într-o aventură cu locații → WARNING (inclusiv track implicit)", () => {
  for (const extra of [{}, { track: "main" }]) {
    const data = gpsAdventure("test-qa-g03", [LOC("l-a")], { missions: [GO("m-1", "l-a"), RIDDLE("m-2", extra)] });
    const result = gpsQa(data);
    assert.deepEqual(active(result, "QA-G03").map((f) => [f.level, f.path]), [["warning", "missions[1].locationId"]]);
    assert.equal(result.status, "WARNING");
  }
});

test("QA-G03: nu se aplică misiunilor bonus / secrete, aventurilor fără locații și misiunii „location” fără locationId (QA-S01)", () => {
  const sideTracks = gpsAdventure("test-qa-g03-side", [LOC("l-a")], {
    missions: [
      GO("m-1", "l-a"),
      RIDDLE("m-bonus", { track: "bonus" }),
      RIDDLE("m-secret", { type: "secret", track: "secret", initialStatus: "locked" }),
    ],
  });
  const sideResult = gpsQa(sideTracks);
  assert.deepEqual(active(sideResult, "QA-S01"), []);
  assert.deepEqual(activeRules(sideResult, "QA-G03"), []);

  assert.deepEqual(activeRules(gpsQa(synthetic("test-qa-g03-fara-locatii")), "QA-G"), []);

  const noTarget = gpsAdventure("test-qa-g03-s01", [LOC("l-a")], { missions: [GO("m-1", "l-a"), GO("m-2")] });
  delete noTarget.missions[1].locationId;
  const s01 = gpsQa(noTarget);
  assert.ok(active(s01, "QA-S01").some((f) => /missions\[1\].*locationId/.test(f.message)));
  assert.deepEqual(activeRules(s01, "QA-G03"), []);
});

/* QA-G04 */

const g04 = (b) => activeRules(gpsQa(gpsAdventure("test-qa-g04", [LOC("l-a"), LOC("l-b", b)])), "QA-G04");

test("QA-G04: locații la < 1 m (geo.distanceMeters) → WARNING, cu recomandarea de a reutiliza locationId", () => {
  const [finding] = active(gpsQa(gpsAdventure("test-qa-g04-identic", [LOC("l-a"), LOC("l-b")])), "QA-G04");
  assert.equal(finding.level, "warning");
  assert.equal(finding.path, "locations[1].coordinates");
  assert.match(finding.message, /„l-a” și „l-b”/);
  assert.match(finding.message, /reutilizează același locationId/);
  assert.deepEqual(g04({ lat: BASE.lat + 1e-7, lng: BASE.lng }), ["QA-G04"], "diferență foarte mică (~1 cm)");
});

test("QA-G04: exact 1 m, 5 m, 50 m sau o singură locație → fără QA-G04", () => {
  // Exact 1 m după geo.distanceMeters (căutat numeric; de la latitudinea 0 diferența nu pierde precizie).
  const a = { lat: 0, lng: 0.001 };
  const b = { lat: 0.00000899320363724538, lng: 0.001 };
  assert.equal(distanceMeters(a, b), 1);
  assert.deepEqual(activeRules(gpsQa(gpsAdventure("test-qa-g04-prag", [LOC("l-a", a), LOC("l-b", b)])), "QA-G04"), [], "exact pragul");
  assert.deepEqual(activeRules(gpsQa(gpsAdventure("test-qa-g04-sub", [LOC("l-a", a), LOC("l-b", { lat: 0.0000089932, lng: 0.001 })])), "QA-G04"), ["QA-G04"], "sub prag");
  assert.deepEqual(g04(north(5)), []);
  assert.deepEqual(g04(north(50)), []);
  assert.deepEqual(activeRules(gpsQa(gpsAdventure("test-qa-g04-una", [LOC("l-a")])), "QA-G04"), []);
});

/* QA-G05 */

const g05 = (a, b, extra) => active(gpsQa(gpsAdventure("test-qa-g05", [a, b], extra)), "QA-G05");

test("QA-G05: zone disjuncte sau exact tangente → fără avertisment; suprapunere de 1 m → WARNING", () => {
  assert.deepEqual(g05(LOC("l-a"), LOC("l-b", north(100))), [], "disjuncte (20 + 20 < 100)");
  const tangent = north(40);
  assert.equal(distanceMeters(BASE, tangent), 40);
  assert.deepEqual(g05(LOC("l-a"), LOC("l-b", tangent)), [], "tangente: distanța = suma razelor");
  const [finding] = g05(LOC("l-a"), LOC("l-b", north(39)));
  assert.equal(finding.level, "warning");
  assert.equal(finding.path, "locations[1].coordinates");
  assert.match(finding.message, /„l-a” și „l-b”/);
});

test("QA-G05: raza efectivă = radius propriu, altfel settings.gps.defaultRadius (implicit 40 m)", () => {
  const noRadius = (id, coordinates) => {
    const location = LOC(id, coordinates);
    delete location.radius;
    return location;
  };
  // Implicit: 40 + 40.
  assert.equal(g05(noRadius("l-a"), noRadius("l-b", north(79))).length, 1);
  assert.deepEqual(g05(noRadius("l-a"), noRadius("l-b", north(81))), []);
  // defaultRadius personalizat: 25 + 25.
  const custom = { settings: { gps: { defaultRadius: 25 } } };
  assert.equal(g05(noRadius("l-a"), noRadius("l-b", north(49)), custom).length, 1);
  assert.deepEqual(g05(noRadius("l-a"), noRadius("l-b", north(51)), custom), []);
  // Raze diferite: 10 + 60; radius propriu are prioritate față de defaultRadius.
  const small = LOC("l-a", BASE, { radius: 10 });
  assert.equal(g05(small, LOC("l-b", north(69), { radius: 60 })).length, 1);
  assert.deepEqual(g05(small, LOC("l-b", north(71), { radius: 60 })), []);
  assert.deepEqual(g05(small, LOC("l-b", north(31)), custom), [], "10 + 20 < 31");
});

test("QA-G05: toate perechile, fără perechea unei locații cu ea însăși", () => {
  assert.deepEqual(activeRules(gpsQa(gpsAdventure("test-qa-g05-una", [LOC("l-a")])), "QA-G05"), []);
  const three = gpsAdventure("test-qa-g05-trei", [LOC("l-a"), LOC("l-b", north(30)), LOC("l-c", north(60))]);
  const messages = active(gpsQa(three), "QA-G05").map((f) => f.message);
  // a–b și b–c (30 m < 20 + 20); a–c (60 m) nu.
  assert.equal(messages.length, 2, messages.join(" | "));
  assert.ok(messages.some((m) => /„l-a” și „l-b”/.test(m)) && messages.some((m) => /„l-b” și „l-c”/.test(m)));
});

/* QA-G06 / QA-G07 */

/** Regulile coordonatelor pentru o locație în (lat, lng), cu clasificarea dată (direct pe checkGps). */
const coordinateRules = (lat, lng, classification) =>
  rules(checkGps(toAdventureV2(gpsAdventure("test-qa-coord", [LOC("l-a", { lat, lng })])), { classification }).filter((f) => /^QA-G0[67]$/.test(f.ruleId)));

test("QA-G06: aventură care nu este public-demo, lângă 0°, 0° (< 0,01°) → ERROR; exact 0,01° și 0,02° → PASS", () => {
  assert.equal(NEAR_ZERO_DEGREES, 0.01);
  for (const classification of [CLASSES.PUBLISHED_REAL, CLASSES.PRIVATE_LOCAL, CLASSES.ANOMALY]) {
    for (const value of [0, 0.001, 0.0099, -0.0099]) assert.deepEqual(coordinateRules(value, value, classification), ["QA-G06"], `${classification} ${value}`);
    for (const value of [0.01, 0.02, 45.6]) assert.deepEqual(coordinateRules(value, value, classification), [], `${classification} ${value}`);
    assert.deepEqual(coordinateRules(0.001, 0.02, classification), [], `${classification}: doar una dintre coordonate lângă 0`);
  }
});

test("QA-G06: anomaly și private-local prin runQa → ERROR; pentru private, mesajul este mascat; fără locații → PASS", () => {
  const anomaly = gpsAdventure("test-qa-g06-anomalie", [LOC("l-a")]);
  delete anomaly.demo;
  const anomalyResult = gpsQa(anomaly);
  assert.equal(anomalyResult.classification, CLASSES.ANOMALY);
  const [finding] = active(anomalyResult, "QA-G06");
  assert.equal(finding.level, "error");
  assert.equal(finding.path, "locations[0].coordinates");
  assert.equal(anomalyResult.status, "ERROR");

  const secret = gpsAdventure("private-test-qa-g06", [LOC("l-ascunsa-g06")]);
  secret.demo = false;
  const privateResult = gpsQa(secret);
  assert.equal(privateResult.label, "aventura privată #1");
  assert.deepEqual(activeRules(privateResult, "QA-G"), ["QA-G06"]);
  assert.doesNotMatch(JSON.stringify(privateResult.findings), /l-ascunsa-g06|private-test-qa-g06/);
  assert.ok(privateResult.findings.every((f) => f.subject === undefined));

  const noLocations = synthetic("private-test-qa-g06-gol");
  noLocations.demo = false;
  assert.deepEqual(activeRules(gpsQa(noLocations), "QA-G"), []);
});

test("QA-G07: public-demo — lângă 0°, 0° → PASS; exact 0,01° sau coordonate reale → ERROR; fără locații → PASS", () => {
  for (const value of [0.001, 0.0099, -0.0099]) assert.deepEqual(coordinateRules(value, value, CLASSES.PUBLIC_DEMO), [], String(value));
  assert.deepEqual(coordinateRules(0.01, 0.01, CLASSES.PUBLIC_DEMO), ["QA-G07"]);
  assert.deepEqual(coordinateRules(45.6, 25.6, CLASSES.PUBLIC_DEMO), ["QA-G07"]);
  assert.deepEqual(coordinateRules(0.001, 25.6, CLASSES.PUBLIC_DEMO), ["QA-G07"]);

  const real = gpsQa(gpsAdventure("test-qa-g07", [LOC("l-a", { lat: 45.6, lng: 25.6 })]));
  assert.equal(real.classification, CLASSES.PUBLIC_DEMO);
  const [finding] = active(real, "QA-G07");
  assert.equal(finding.level, "error");
  assert.equal(finding.path, "locations[0].coordinates");
  assert.equal(real.status, "ERROR");

  assert.deepEqual(activeRules(gpsQa(synthetic("test-qa-g07-fara-locatii")), "QA-G"), []);
});

test("QA-G07: o copie a demo-gps-brasov sub alt nume nu moștenește excepția D-068 (CLI → exit 1)", () => {
  const copy = JSON.parse(readFileSync(join(ADVENTURES_DIR, "demo-gps-brasov.json"), "utf8"));
  copy.id = "test-qa-copie-gps";
  const result = gpsQa(copy);
  assert.equal(active(result, "QA-G07").length, 3);
  assert.equal(active(result, "QA-G02").length, 3);
  assert.ok(result.findings.every((f) => !f.waived));

  const dir = mkdtempSync(join(tmpdir(), "oe-qa-"));
  try {
    const file = join(dir, "test-qa-copie-gps.json");
    writeFileSync(file, JSON.stringify(copy));
    const run = runCli(file);
    assert.equal(run.status, 1, run.stdout);
    assert.match(run.stdout, /E QA-G07/);
    // Originalul: excepțiile declarate sunt afișate, nu ascunse.
    const original = runCli(join(ADVENTURES_DIR, "demo-gps-brasov.json"));
    assert.equal(original.status, 0, original.stdout);
    assert.match(original.stdout, /~ QA-G07 .*excepție declarată: D-068/);
    assert.match(original.stdout, /~ QA-G02 .*excepție declarată: D-068/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

/* ---------- Pasul 4 · QA-F00 – F05: flow / progresie ---------- */

/** Aventură de flow sintetică: misiuni principale (RIDDLE / GO) și opțional reguli, secrete, obiecte. */
const flowAdventure = (id, missions, extra = {}) => ({ schemaVersion: 2, id, demo: true, meta: { title: "Aventură flow de test QA" }, missions, ...extra });
const MAIN3 = () => [RIDDLE("m-1"), RIDDLE("m-2"), RIDDLE("m-3")];
const BONUS = (id, extra = {}) => RIDDLE(id, { track: "bonus", ...extra });
const MSG = { narrator: { messages: { m: { text: "Mesaj de test." } } } };
const SHOW = { action: "show_message", messageId: "m" };
const END = { action: "complete_adventure" };
const RULE = (id, on, where, ...actions) => ({ id, on, ...(where ? { where } : {}), do: actions.length ? actions : [SHOW] });
const PARTNER = (extra = {}) => ({ id: "p-a", name: "Partener de test", category: "test", missionId: "m-p", verification: { method: "none" }, ...extra });
const flowQa = (data, fileName = `${data.id}.json`) => runQa([entry(fileName, data)]).results[0];
const flowQaFull = async (data, fileName = `${data.id}.json`) => (await runQaFull([entry(fileName, data)])).results[0];
/** Findings ale unei reguli: [nivel, cale]. */
const levels = (result, ruleId) => active(result, ruleId).map((f) => [f.level, f.path]);
/** Regula `ruleId` a rulat pe vreunul dintre traseele simulării? (confirmare cu motorul real) */
async function firesInEngine(data, ruleId) {
  const content = toAdventureV2(data);
  for (const path of FLOW_PATHS) {
    const { game } = await playFlowPath(content, path);
    if (Object.prototype.hasOwnProperty.call(game.getState().firedEvents, ruleId)) return true;
  }
  return false;
}

test("QA-F04: EVENT_PAYLOAD acoperă exact lista de evenimente a motorului (events.EVENT_TYPES)", () => {
  assert.deepEqual(Object.keys(EVENT_PAYLOAD).sort(), [...EVENT_TYPES].sort());
});

test("QA-F: fixture-ul fictiv și aventurile din repository nu au findings de flow (inclusiv simularea QA-F00)", async () => {
  assert.deepEqual(active(await flowQaFull(fixture(), FIXTURE_FILE), "QA-F"), []);
  const names = readdirSync(ADVENTURES_DIR).filter((name) => name.endsWith(".json"));
  const { results, summary } = await runQaFull(names.map((fileName) => ({ fileName, dir: ADVENTURES_DIR, text: readFileSync(join(ADVENTURES_DIR, fileName), "utf8") })));
  assert.deepEqual(results.flatMap((r) => active(r, "QA-F").map((f) => `${r.label}: ${f.ruleId}`)), []);
  assert.equal(summary.errors, 0);
});

/* QA-F00 */

test("QA-F00: traseu liniar valid (ghicitori, „location”, variante, indicii) → toate cele trei trasee ajung la completed", async () => {
  const data = flowAdventure("test-qa-f00-ok", [
    GO("m-go", "l-a"),
    RIDDLE("m-1", { choices: ["nord", "sud"] }),
    RIDDLE("m-2", { hints: [] }),
    RIDDLE("m-3", { locationId: "l-a" }),
  ], { locations: [LOC("l-a")] });
  assert.deepEqual(await simulateFlow(toAdventureV2(data)), []);
  for (const path of FLOW_PATHS) {
    const { game, visited, problems } = await playFlowPath(toAdventureV2(data), path);
    assert.deepEqual(problems, [], path);
    assert.equal(game.getState().status, "completed", path);
    assert.deepEqual([...visited], ["m-go", "m-1", "m-2", "m-3"], path);
  }
  // Traseul „skip” chiar sare; „wrong-then-solve” face câte două încercări la misiunile cu răspuns.
  assert.equal((await playFlowPath(toAdventureV2(data), "skip")).game.getState().missions["m-1"].status, "skipped");
  assert.equal((await playFlowPath(toAdventureV2(data), "wrong-then-solve")).game.getState().missions["m-3"].attempts, 2);
});

test("QA-F00: complete_adventure prematur → ERROR „nu devine niciodată curentă” pentru misiunile rămase", async () => {
  const data = flowAdventure("test-qa-f00-prematur", MAIN3(), { events: [RULE("r-end", "mission_completed", { missionId: "m-1" }, END)] });
  const result = await flowQaFull(data);
  const f00 = active(result, "QA-F00");
  assert.deepEqual(f00.map((f) => [f.level, f.path]), [["error", "missions[1]"], ["error", "missions[2]"]]);
  // Pe traseul „skip” regula nu rulează (mission_skipped, nu mission_completed).
  assert.match(f00[0].message, /„m-2” nu devine niciodată curentă.*\(trasee: solve, wrong-then-solve\)/);
  assert.equal(result.status, "ERROR");
});

test("QA-F00: excepție a motorului sau traseu care nu se încheie → ERROR (motor înlocuit doar în test)", async () => {
  const content = toAdventureV2(flowAdventure("test-qa-f00-exceptie", MAIN3()));
  const throwing = (options) => ({ ...createGame(options), next() { throw new Error("next: misiunea „m-2” este încă blocată."); } });
  const thrown = await simulateFlow(content, { engine: throwing });
  assert.equal(thrown.length, 1);
  assert.equal(thrown[0].level, "error");
  assert.match(thrown[0].message, /excepție la next\(\) \(misiunea curentă „m-1”\): „next: misiunea "m-2" este încă blocată\.” \(trasee: solve, skip, wrong-then-solve\)/);

  const stuck = (options) => ({ ...createGame(options), next() {} });
  const notCompleted = await simulateFlow(content, { engine: stuck });
  assert.deepEqual(notCompleted.map((f) => f.message.replace(/ \(trasee.*/, "")), ["traseul principal nu ajunge la „completed” (stare finală: „playing”)"]);
});

test("QA-F00: caz limită — „location” fără confirmare manuală: simularea folosește „Sari peste” (QA-G02 raportează separat)", async () => {
  const data = flowAdventure("test-qa-f00-fara-manual", [GO("m-go", "l-a"), RIDDLE("m-1")], {
    locations: [LOC("l-a", BASE, { fallback: { instructions: "Text de test.", allowManualConfirmation: false } })],
  });
  const result = await flowQaFull(data);
  assert.deepEqual(activeRules(result, "QA-F"), []);
  assert.deepEqual(activeRules(result, "QA-G02"), ["QA-G02"]);
  assert.equal((await playFlowPath(toAdventureV2(data), "solve")).game.getState().missions["m-go"].status, "skipped");
});

test("QA-F00: fără false positive — fail_mission la un răspuns greșit, aventură V1, schemă invalidă (simularea nu rulează)", async () => {
  const failing = flowAdventure("test-qa-f00-fail", MAIN3(), { events: [RULE("r-fail", "answer_incorrect", { missionId: "m-1" }, { action: "fail_mission", missionId: "m-1" })] });
  assert.deepEqual(activeRules(await flowQaFull(failing), "QA-F"), []);
  assert.equal((await playFlowPath(toAdventureV2(failing), "wrong-then-solve")).game.getState().missions["m-1"].status, "failed");

  const v1 = { id: "test-qa-f00-v1", title: "V1 de test", demo: true, challenges: [
    { id: "c-1", title: "Unu", description: "Text de test.", answer: "sud", points: 10 },
    { id: "c-2", title: "Doi", description: "Text de test.", answer: "nord", points: 10 },
  ] };
  assert.deepEqual(activeRules(await flowQaFull(v1), "QA-F"), []);

  const invalid = flowAdventure("test-qa-f00-invalid", [RIDDLE("m-1", { initialStatus: "locked" })], { events: [RULE("r", "adventure_started", null, END)] });
  const result = await flowQaFull(invalid);
  assert.ok(activeRules(result, "QA-S01").length > 0);
  assert.deepEqual(activeRules(result, "QA-F"), []);
});

test("QA-F00: aventură privată locală — mesajele nu expun id-urile misiunilor sau ale regulilor", async () => {
  const data = flowAdventure("private-test-qa-f00", MAIN3(), { events: [RULE("r-end", "adventure_started", null, END)] });
  const result = await flowQaFull(data, "private-test-qa-f00.json");
  assert.equal(result.label, "aventura privată #1");
  assert.deepEqual(activeRules(result, "QA-F").sort(), ["QA-F00", "QA-F00", "QA-F00", "QA-F03"]);
  assert.doesNotMatch(active(result, "QA-F").map((f) => f.message).join(" "), /m-1|m-2|m-3|r-end/);
});

/* QA-F01 */

test("QA-F01: fiecare câmp de flux ignorat pe o misiune → WARNING; after / join menționează D-062 (graph)", () => {
  for (const key of IGNORED_MISSION_FLOW_FIELDS) {
    const result = flowQa(flowAdventure(`test-qa-f01-${key.toLowerCase()}`, [RIDDLE("m-1"), RIDDLE("m-2", { [key]: key === "locked" ? true : ["m-1"] })]));
    assert.deepEqual(levels(result, "QA-F01"), [["warning", `missions[1].${key}`]], key);
    const message = active(result, "QA-F01")[0].message;
    if (key === "after" || key === "join") assert.match(message, /PROPUS pentru settings\.progression „graph” \(D-062\).*„linear”/);
    else assert.doesNotMatch(message, /D-062/);
  }
});

test("QA-F01: epilogue / skip / final la nivel superior → WARNING; V1 (challenges) verificat la fel", () => {
  const result = flowQa(flowAdventure("test-qa-f01-sus", MAIN3(), { epilogue: "x", skip: true, final: "m-3" }));
  assert.deepEqual(levels(result, "QA-F01"), [["warning", "epilogue"], ["warning", "skip"], ["warning", "final"]]);
  const v1 = { id: "test-qa-f01-v1", title: "V1", demo: true, challenges: [{ id: "c-1", title: "Unu", description: "Text de test.", answer: "sud", points: 1, dependsOn: [] }] };
  assert.deepEqual(levels(flowQa(v1), "QA-F01"), [["warning", "challenges[0].dependsOn"]]);
});

test("QA-F01: fără false positive — alte câmpuri necunoscute (notes, _local) și câmpurile cunoscute nu sunt raportate", () => {
  const data = flowAdventure("test-qa-f01-curat", [RIDDLE("m-1", { notes: "x", _local: { a: 1 }, initialStatus: "pending" }), RIDDLE("m-2")], {
    ...MSG, notes: "x", finale: { missionId: "m-2", messageId: "m" },
  });
  assert.deepEqual(activeRules(flowQa(data), "QA-F"), []);
});

/* QA-F02 */

test("QA-F02: o misiune principală, alta decât prima, cu initialStatus „pending” → WARNING", () => {
  const result = flowQa(flowAdventure("test-qa-f02", [RIDDLE("m-1"), RIDDLE("m-2"), RIDDLE("m-3", { initialStatus: "pending" })]));
  assert.deepEqual(levels(result, "QA-F02"), [["warning", "missions[2].initialStatus"]]);
});

test("QA-F02: nu se raportează prima misiune main (chiar după un bonus), bonusurile „pending” sau „locked” explicit", () => {
  const data = flowAdventure("test-qa-f02-ok", [BONUS("b-1", { initialStatus: "pending" }), RIDDLE("m-1", { initialStatus: "pending" }), RIDDLE("m-2", { initialStatus: "locked" })]);
  assert.deepEqual(activeRules(flowQa(data), "QA-F02"), []);
  assert.deepEqual(activeRules(flowQa(flowAdventure("test-qa-f02-una", [RIDDLE("m-1")])), "QA-F"), []);
});

/* QA-F03 */

test("QA-F03: valid — complete_adventure la închiderea ultimei misiuni main; lipsa lui nu este o problemă", () => {
  for (const on of ["mission_completed", "mission_failed", "mission_skipped"]) {
    assert.deepEqual(activeRules(flowQa(flowAdventure("test-qa-f03-ok", MAIN3(), { events: [RULE("r", on, { missionId: "m-3" }, END)] })), "QA-F"), [], on);
  }
  assert.deepEqual(activeRules(flowQa(flowAdventure("test-qa-f03-fara", MAIN3())), "QA-F"), []);
  // adventure_completed: aventura este deja încheiată.
  assert.deepEqual(activeRules(flowQa(flowAdventure("test-qa-f03-dupa", MAIN3(), { events: [RULE("r", "adventure_completed", null, END)] })), "QA-F03"), []);
  // O singură misiune main, regulă fără filtru: închiderea ei este și ultima.
  assert.deepEqual(activeRules(flowQa(flowAdventure("test-qa-f03-una", [RIDDLE("m-1")], { events: [RULE("r", "mission_completed", null, END)] })), "QA-F"), []);
});

test("QA-F03: ERROR pentru fiecare categorie de eveniment care încheie aventura înaintea traseului main", () => {
  const cases = [
    ["adventure_started", null],
    ["mission_completed", { missionId: "m-1" }],
    ["mission_failed", { missionId: "m-2" }],
    ["mission_skipped", { missionId: "m-1" }],
    ["mission_completed", null], // fără filtru: rulează la închiderea primei misiuni
    ["mission_started", { missionId: "m-3" }], // ultima: F03.2, demonstrat cu motorul mai jos
    ["mission_unlocked", { missionId: "m-2" }],
    ["answer_incorrect", { missionId: "m-1" }],
    ["hint_requested", { missionId: "m-2" }],
  ];
  for (const [on, where] of cases) {
    const result = flowQa(flowAdventure("test-qa-f03-err", MAIN3(), { events: [RULE("r-end", on, where, END)] }));
    assert.deepEqual(levels(result, "QA-F03"), [["error", "events[0].do[0]"]], `${on} ${JSON.stringify(where)}`);
    assert.deepEqual(activeRules(result, "QA-F04"), [], `${on}: nu este o regulă moartă`);
  }
});

test("QA-F03: finale_started — ERROR pe o misiune care nu este ultima; WARNING pe ultima sau doar prin start_finale", () => {
  const finale = (missionId) => flowAdventure("test-qa-f03-finale", MAIN3(), { ...MSG, finale: { missionId, messageId: "m" }, events: [RULE("r", "finale_started", null, END)] });
  assert.deepEqual(levels(flowQa(finale("m-2")), "QA-F03"), [["error", "events[0].do[0]"]]);
  assert.deepEqual(levels(flowQa(finale("m-3")), "QA-F03"), [["warning", "events[0].do[0]"]]);
  const viaAction = flowAdventure("test-qa-f03-start-finale", MAIN3(), {
    events: [RULE("r-start", "mission_completed", { missionId: "m-3" }, { action: "start_finale" }), RULE("r", "finale_started", null, END)],
  });
  assert.deepEqual(levels(flowQa(viaAction), "QA-F03"), [["warning", "events[1].do[0]"]]);
});

/*
 * Severitatea QA-F03 pentru ultima misiune principală, stabilită cu motorul real (createGame + API-urile
 * folosite de interfață). „Jucabilă” = o stare salvată (commit) în care jocul este „playing”, misiunea
 * este curentă și „pending”: doar atunci jucătorul poate acționa. Dacă motorul se schimbă, aceste teste
 * cad și severitatea trebuie reevaluată.
 */
function engineRun(data) {
  assert.deepEqual(checkFile(entry(`${data.id}.json`, data)).findings, [], "aventura de test este validă");
  const content = toAdventureV2(data);
  let clock = 0;
  const game = createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), now: () => (clock += 1000) });
  const states = [];
  game.subscribe((state) => states.push(state));
  const playable = (id) => states.some((s) => s.status === "playing" && s.currentMissionId === id && s.missions[id].status === "pending");
  return { game, playable, mission: (id) => game.getState().missions[id], fired: (ruleId) => Object.prototype.hasOwnProperty.call(game.getState().firedEvents, ruleId) };
}
/** Rezolvă misiunile m-1 și m-2 ca jucătorul (răspuns corect + Continuă). */
async function solveFirstTwo(game) {
  for (let i = 0; i < 2; i++) {
    assert.deepEqual(await game.submitAnswer("sud"), { result: "correct" });
    game.next();
  }
}
const FINAL_LOC = (extra = {}) => LOC("l-f", north(500), { initialStatus: "unlocked", ...extra });
const GO_FINAL = GO("m-3", "l-f", { points: 5 });

test("QA-F03.1 (motor): finale_started pe ultima misiune — o partidă validă poate continua până la completed → WARNING", async () => {
  const rule = RULE("r", "finale_started", null, END);
  // Traseul obișnuit: ultima misiune devine curentă și aventura se încheie în aceeași tranzacție.
  const usual = engineRun(flowAdventure("test-qa-f031-a", MAIN3(), { ...MSG, finale: { missionId: "m-3", messageId: "m" }, events: [rule] }));
  usual.game.start();
  await solveFirstTwo(usual.game);
  assert.equal(usual.game.getState().status, "completed");
  assert.equal(usual.mission("m-3").status, "pending");
  assert.equal(usual.playable("m-3"), false);

  // Configurație validă: ultima misiune este „location”, locația este vizibilă de la început, iar jucătorul
  // ajunge acolo (GPS) înainte. Misiunea se rezolvă la deblocare (sosire deja înregistrată); finale_started
  // se emite la next() chiar dacă misiunea este închisă → completed, cu toate misiunile principale închise.
  const data = flowAdventure("test-qa-f031-b", [RIDDLE("m-1"), RIDDLE("m-2"), GO_FINAL], { ...MSG, locations: [FINAL_LOC()], finale: { missionId: "m-3", messageId: "m" }, events: [rule] });
  assert.deepEqual(levels(flowQa(data), "QA-F03"), [["warning", "events[0].do[0]"]]);
  const early = engineRun(data);
  early.game.start();
  const fix = early.game.reportPosition({ ...FINAL_LOC().coordinates, accuracy: 5 });
  assert.deepEqual(fix.results.find((r) => r.locationId === "l-f").transitions, ["arrived"]);
  assert.equal(early.mission("m-3").status, "locked", "sosirea nu închide o misiune încă blocată");
  await solveFirstTwo(early.game);
  assert.equal(early.fired("r"), true);
  assert.equal(early.game.getState().status, "completed");
  assert.equal(early.mission("m-3").status, "solved");
  assert.equal(early.game.getState().locations["l-f"].arrivalSource, "gps");
  assert.deepEqual(early.game.getProgressSummary().completedMissions, ["m-1", "m-2", "m-3"]);
});

test("QA-F03.2 (motor): mission_started pe ultima misiune — nicio partidă în care jucătorul o mai joacă → ERROR", async () => {
  const where = { missionId: "m-3" };
  // Cazul ERROR: regula rulează exact când m-3 devine curentă; aventura se încheie în aceeași tranzacție.
  const data = flowAdventure("test-qa-f032-a", MAIN3(), { events: [RULE("r", "mission_started", where, END)] });
  assert.deepEqual(levels(flowQa(data), "QA-F03"), [["error", "events[0].do[0]"]]);
  const usual = engineRun(data);
  usual.game.start();
  await solveFirstTwo(usual.game);
  assert.equal(usual.fired("r"), true);
  assert.equal(usual.game.getState().status, "completed");
  assert.equal(usual.mission("m-3").status, "pending");
  assert.equal(usual.playable("m-3"), false);

  // Contra-exemple încercate: niciunul nu dă o partidă în care regula rulează și m-3 este jucată și închisă.
  // a) m-3 rezolvată înainte de a deveni curentă (sosire anticipată): mission_started nu se mai emite.
  const early = engineRun(flowAdventure("test-qa-f032-b", [RIDDLE("m-1"), RIDDLE("m-2"), GO_FINAL], { locations: [FINAL_LOC()], events: [RULE("r", "mission_started", where, END)] }));
  early.game.start();
  early.game.reportPosition({ ...FINAL_LOC().coordinates, accuracy: 5 });
  await solveFirstTwo(early.game);
  assert.equal(early.mission("m-3").status, "solved");
  assert.equal(early.fired("r"), false);
  // b) m-3 deschisă de la început și rezolvată prin API înainte: nici atunci mission_started nu se emite.
  const pending = engineRun(flowAdventure("test-qa-f032-c", [RIDDLE("m-1"), RIDDLE("m-2"), RIDDLE("m-3", { initialStatus: "pending" })], { events: [RULE("r", "mission_started", where, END)] }));
  pending.game.start();
  assert.deepEqual(await pending.game.submitMissionAnswer("m-3", "sud"), { result: "correct" });
  await solveFirstTwo(pending.game);
  assert.equal(pending.fired("r"), false);
  // c) aceeași regulă închide m-3 (complete_mission): completed, dar m-3 nu a fost jucată (0 încercări, fără stare jucabilă).
  const closed = engineRun(flowAdventure("test-qa-f032-d", MAIN3(), { events: [RULE("r", "mission_started", where, { action: "complete_mission", missionId: "m-3" }, END)] }));
  closed.game.start();
  await solveFirstTwo(closed.game);
  assert.equal(closed.game.getState().status, "completed");
  assert.equal(closed.mission("m-3").status, "solved");
  assert.equal(closed.mission("m-3").attempts, 0);
  assert.equal(closed.playable("m-3"), false);
});

test("QA-F03.3 (motor): answer_incorrect pe ultima misiune — răspunsul greșit nu o închide; partida poate continua normal → WARNING", async () => {
  const where = { missionId: "m-3" };
  // Comportamentul motorului la un răspuns greșit: misiunea rămâne „pending”, se emite answer_incorrect.
  const plain = engineRun(flowAdventure("test-qa-f033-a", MAIN3(), { ...MSG, events: [RULE("r", "answer_incorrect", where)] }));
  plain.game.start();
  await solveFirstTwo(plain.game);
  assert.deepEqual(await plain.game.submitAnswer("nord"), { result: "incorrect" });
  assert.equal(plain.fired("r"), true);
  assert.equal(plain.mission("m-3").status, "pending");
  assert.deepEqual(await plain.game.submitAnswer("sud"), { result: "correct" });
  plain.game.next();
  assert.equal(plain.game.getState().status, "completed");

  // Configurație validă cu complete_adventure: „o singură încercare la final” — m-3 a fost jucată,
  // regula o închide (fail_mission), apoi încheie aventura → toate misiunile principale închise.
  const data = flowAdventure("test-qa-f033-b", MAIN3(), { events: [RULE("r", "answer_incorrect", where, { action: "fail_mission", missionId: "m-3" }, END)] });
  assert.deepEqual(levels(flowQa(data), "QA-F03"), [["warning", "events[0].do[1]"]]);
  const strict = engineRun(data);
  strict.game.start();
  await solveFirstTwo(strict.game);
  assert.equal(strict.playable("m-3"), true);
  assert.deepEqual(await strict.game.submitAnswer("nord"), { result: "incorrect" });
  assert.equal(strict.game.getState().status, "completed");
  assert.equal(strict.mission("m-3").status, "failed");
  assert.equal(strict.mission("m-3").attempts, 1);
  // Răspuns corect din prima: regula nu rulează, finalul este cel obișnuit.
  const lucky = engineRun(data);
  lucky.game.start();
  await solveFirstTwo(lucky.game);
  assert.deepEqual(await lucky.game.submitAnswer("sud"), { result: "correct" });
  lucky.game.next();
  assert.equal(lucky.fired("r"), false);
  assert.equal(lucky.game.getState().status, "completed");

  // Pe o misiune care nu este ultima rămâne ERROR: m-3 nu mai devine curentă.
  const middle = flowAdventure("test-qa-f033-c", MAIN3(), { events: [RULE("r", "answer_incorrect", { missionId: "m-2" }, { action: "fail_mission", missionId: "m-2" }, END)] });
  assert.deepEqual(levels(flowQa(middle), "QA-F03"), [["error", "events[0].do[1]"]]);
});

/** Rezolvă m-1 (+ Continuă) și m-2; aventura se încheie în tranzacția lui m-2, deci next() este refuzat. */
async function solveUntilM2(game) {
  assert.deepEqual(await game.submitAnswer("sud"), { result: "correct" });
  game.next();
  assert.deepEqual(await game.submitAnswer("sud"), { result: "correct" });
  assert.throws(() => game.next(), /nu este în desfășurare/);
}

test("QA-F03.4 (motor): mission_unlocked pe ultima misiune — ERROR dacă e cu răspuns; WARNING dacă e „location” (poate fi rezolvată prin sosire anticipată)", async () => {
  const where = { missionId: "m-3" };
  // Ultima misiune cu răspuns: deblocarea are loc în tranzacția care închide m-2; regula încheie aventura
  // înainte ca m-3 să devină curentă, iar după aceea next() nu mai este permis.
  const riddle = flowAdventure("test-qa-f034-a", MAIN3(), { events: [RULE("r", "mission_unlocked", where, END)] });
  assert.deepEqual(levels(flowQa(riddle), "QA-F03"), [["error", "events[0].do[0]"]]);
  const blocked = engineRun(riddle);
  blocked.game.start();
  assert.deepEqual(await blocked.game.submitAnswer("sud"), { result: "correct" });
  blocked.game.next();
  assert.equal(blocked.mission("m-3").status, "locked", "înainte de eveniment");
  assert.deepEqual(await blocked.game.submitAnswer("sud"), { result: "correct" });
  assert.equal(blocked.fired("r"), true);
  assert.equal(blocked.game.getState().status, "completed");
  assert.equal(blocked.game.getState().currentMissionId, "m-2");
  assert.equal(blocked.mission("m-3").status, "pending");
  assert.equal(blocked.playable("m-3"), false);
  assert.throws(() => blocked.game.next(), /nu este în desfășurare/);
  // Singura cale de a evita momentul deblocării — m-3 deschisă de la început — face regula moartă (QA-F04).
  const open = flowAdventure("test-qa-f034-b", [RIDDLE("m-1"), RIDDLE("m-2"), RIDDLE("m-3", { initialStatus: "pending" })], { events: [RULE("r", "mission_unlocked", where, END)] });
  assert.deepEqual(activeRules(flowQa(open), "QA-F0"), ["QA-F02", "QA-F04"]);

  // Ultima misiune „location”, cu locația vizibilă de la început: jucătorul ajunge acolo (GPS) înainte.
  // La închiderea lui m-2, m-3 se deblochează și se rezolvă în aceeași operație (sosirea era înregistrată),
  // apoi regula încheie aventura → completed, cu toate misiunile principale închise.
  const data = flowAdventure("test-qa-f034-c", [RIDDLE("m-1"), RIDDLE("m-2"), GO_FINAL], { locations: [FINAL_LOC()], events: [RULE("r", "mission_unlocked", where, END)] });
  assert.deepEqual(levels(flowQa(data), "QA-F03"), [["warning", "events[0].do[0]"]]);
  const early = engineRun(data);
  early.game.start();
  early.game.reportPosition({ ...FINAL_LOC().coordinates, accuracy: 5 });
  assert.equal(early.mission("m-3").status, "locked", "sosirea nu închide o misiune încă blocată");
  await solveUntilM2(early.game);
  assert.equal(early.fired("r"), true);
  assert.equal(early.game.getState().status, "completed");
  assert.equal(early.mission("m-3").status, "solved");
  assert.equal(early.game.getState().locations["l-f"].arrivalSource, "gps");
  assert.deepEqual(early.game.getProgressSummary().completedMissions, ["m-1", "m-2", "m-3"]);
  // Fără sosire anticipată, aceeași aventură se încheie înainte ca m-3 să devină curentă: QA-F00 (simularea,
  // fără sosiri anticipate) o raportează separat ca ERROR — regula QA-F00 nu este schimbată aici.
  const usual = engineRun(data);
  usual.game.start();
  await solveUntilM2(usual.game);
  assert.equal(usual.game.getState().status, "completed");
  assert.equal(usual.mission("m-3").status, "pending");
  assert.deepEqual(levels(await flowQaFull(data), "QA-F00"), [["error", "missions[2]"]]);

  // Pe o misiune care nu este ultima rămâne ERROR, inclusiv pentru „location”.
  const middle = flowAdventure("test-qa-f034-d", [RIDDLE("m-1"), GO("m-2", "l-f"), RIDDLE("m-3")], { locations: [FINAL_LOC()], events: [RULE("r", "mission_unlocked", { missionId: "m-2" }, END)] });
  assert.deepEqual(levels(flowQa(middle), "QA-F03"), [["error", "events[0].do[0]"]]);
});

test("QA-F03.5 (motor): hint_requested pe ultima misiune — indiciul nu o închide; partida poate continua normal → WARNING", async () => {
  const where = { missionId: "m-3" };
  // Comportamentul motorului la un indiciu: hintsUsed +1, se emite hint_requested, misiunea rămâne „pending”.
  const plain = engineRun(flowAdventure("test-qa-f035-a", MAIN3(), { ...MSG, events: [RULE("r", "hint_requested", where)] }));
  plain.game.start();
  await solveFirstTwo(plain.game);
  assert.equal(plain.mission("m-3").status, "pending", "înainte de eveniment");
  assert.equal(typeof plain.game.requestHint("m-3"), "string");
  assert.equal(plain.fired("r"), true);
  assert.equal(plain.mission("m-3").status, "pending");
  assert.equal(plain.mission("m-3").hintsUsed, 1);
  assert.deepEqual(await plain.game.submitAnswer("sud"), { result: "correct" });
  plain.game.next();
  assert.equal(plain.game.getState().status, "completed");

  // Configurație validă cu complete_adventure: m-3 este jucabilă, jucătorul cere un indiciu,
  // regula o închide (fail_mission) și încheie aventura → toate misiunile principale închise.
  const data = flowAdventure("test-qa-f035-b", MAIN3(), { events: [RULE("r", "hint_requested", where, { action: "fail_mission", missionId: "m-3" }, END)] });
  assert.deepEqual(levels(flowQa(data), "QA-F03"), [["warning", "events[0].do[1]"]]);
  const strict = engineRun(data);
  strict.game.start();
  await solveFirstTwo(strict.game);
  assert.equal(strict.playable("m-3"), true);
  strict.game.requestHint("m-3");
  assert.equal(strict.game.getState().status, "completed");
  assert.equal(strict.mission("m-3").status, "failed");
  assert.equal(strict.mission("m-3").hintsUsed, 1);
  // Fără indiciu: regula nu rulează, finalul este cel obișnuit.
  const noHint = engineRun(data);
  noHint.game.start();
  await solveFirstTwo(noHint.game);
  assert.deepEqual(await noHint.game.submitAnswer("sud"), { result: "correct" });
  noHint.game.next();
  assert.equal(noHint.fired("r"), false);
  assert.equal(noHint.game.getState().status, "completed");

  // Pe o misiune care nu este ultima rămâne ERROR: m-3 nu mai devine curentă.
  const middle = flowAdventure("test-qa-f035-c", MAIN3(), { events: [RULE("r", "hint_requested", { missionId: "m-2" }, { action: "fail_mission", missionId: "m-2" }, END)] });
  assert.deepEqual(levels(flowQa(middle), "QA-F03"), [["error", "events[0].do[1]"]]);
});

test("QA-F03: WARNING pentru declanșatori care depind de jucător (locație, secret, bonus, hint pe „location”)", () => {
  const base = { locations: [LOC("l-a")], secrets: [{ id: "s-a", title: "Secret de test" }] };
  const cases = [
    [RULE("r", "player_arrived", { locationId: "l-a" }, END)],
    [RULE("r", "location_completed", { locationId: "l-a" }, END)],
    [RULE("r", "secret_discovered", { secretId: "s-a" }, END), RULE("r-d", "adventure_started", null, { action: "discover_secret", secretId: "s-a" })],
    [RULE("r", "mission_completed", { missionId: "b-1" }, END), RULE("r-u", "adventure_started", null, { action: "unlock_mission", missionId: "b-1" })],
  ];
  for (const events of cases) {
    const result = flowQa(flowAdventure("test-qa-f03-warn", [GO("m-go", "l-a"), ...MAIN3(), BONUS("b-1")], { ...base, events }));
    assert.deepEqual(levels(result, "QA-F03"), [["warning", "events[0].do[0]"]], events[0].on);
  }
  const hintOnLocation = flowAdventure("test-qa-f03-hint-loc", [GO("m-go", "l-a", { hints: [{ text: "Indiciu de test." }] }), RIDDLE("m-1")], {
    locations: [LOC("l-a")], events: [RULE("r", "hint_requested", { missionId: "m-go" }, END)],
  });
  assert.deepEqual(levels(flowQa(hintOnLocation), "QA-F03"), [["warning", "events[0].do[0]"]]);
});

test("QA-F03: o regulă moartă (QA-F04) nu este raportată și de QA-F03", () => {
  const result = flowQa(flowAdventure("test-qa-f03-moarta", MAIN3(), { secrets: [{ id: "s-a", title: "S" }], events: [RULE("r", "mission_completed", { secretId: "s-a" }, END)] }));
  assert.deepEqual(activeRules(result, "QA-F03"), []);
  assert.deepEqual(activeRules(result, "QA-F04"), ["QA-F04"]);
});

/* QA-F04 */

/** Cazurile invalide QA-F04: [nume, aventură, cale]. Fiecare este confirmat și cu motorul (regula „r” nu rulează). */
const F04_INVALID = () => [
  ["1 · cheie absentă din payload (secretId pe mission_completed)",
    flowAdventure("t", MAIN3(), { ...MSG, secrets: [{ id: "s-a", title: "S" }], events: [RULE("r", "mission_completed", { secretId: "s-a" })] }), "events[0].where.secretId"],
  ["1 · orice filtru pe adventure_started",
    flowAdventure("t", MAIN3(), { ...MSG, locations: [LOC("l-a")], events: [RULE("r", "adventure_started", { locationId: "l-a" })] }), "events[0].where.locationId"],
  ["1 · missionId pe player_arrived",
    flowAdventure("t", [GO("m-go", "l-a"), RIDDLE("m-1")], { ...MSG, locations: [LOC("l-a")], events: [RULE("r", "player_arrived", { locationId: "l-a", missionId: "m-go" })] }), "events[0].where.missionId"],
  ["2 · missionId + locationId incompatibile",
    flowAdventure("t", [GO("m-go", "l-a"), RIDDLE("m-1", { locationId: "l-a" }), RIDDLE("m-2", { locationId: "l-b" })], {
      ...MSG, locations: [LOC("l-a"), LOC("l-b", north(500))], events: [RULE("r", "mission_completed", { missionId: "m-1", locationId: "l-b" })] }), "events[0].where"],
  ["2 · locationId pe o misiune fără locație",
    flowAdventure("t", [GO("m-go", "l-a"), RIDDLE("m-1")], { ...MSG, locations: [LOC("l-a")], events: [RULE("r", "mission_completed", { missionId: "m-1", locationId: "l-a" })] }), "events[0].where"],
  ["3 · mission_unlocked pe prima misiune main („pending”)",
    flowAdventure("t", MAIN3(), { ...MSG, events: [RULE("r", "mission_unlocked", { missionId: "m-1" })] }), "events[0].on"],
  ["3 · mission_unlocked pe un bonus „pending”",
    flowAdventure("t", [...MAIN3(), BONUS("b-1", { initialStatus: "pending" })], { ...MSG, events: [RULE("r", "mission_unlocked", { missionId: "b-1" })] }), "events[0].on"],
  ["4 · mission_started pe un bonus",
    flowAdventure("t", [...MAIN3(), BONUS("b-1")], { ...MSG, events: [
      RULE("r-u", "adventure_started", null, { action: "unlock_mission", missionId: "b-1" }), RULE("r", "mission_started", { missionId: "b-1" })] }), "events[1].on"],
  ["4 · mission_started pe o locație fără misiuni main",
    flowAdventure("t", [...MAIN3(), BONUS("b-1", { locationId: "l-a" })], { ...MSG, locations: [LOC("l-a")], events: [
      RULE("r-u", "adventure_started", null, { action: "unlock_mission", missionId: "b-1" }), RULE("r", "mission_started", { locationId: "l-a" })] }), "events[1].on"],
  ["5 · answer_incorrect pe o misiune „location”",
    flowAdventure("t", [GO("m-go", "l-a"), RIDDLE("m-1")], { ...MSG, locations: [LOC("l-a")], events: [RULE("r", "answer_incorrect", { missionId: "m-go" })] }), "events[0].on"],
  ["6 · hint_requested pe o misiune fără indicii",
    flowAdventure("t", [RIDDLE("m-1", { hints: [] }), RIDDLE("m-2")], { ...MSG, events: [RULE("r", "hint_requested", { missionId: "m-1" })] }), "events[0].on"],
  ["7 · finale_started cu alt missionId decât finale.missionId",
    flowAdventure("t", MAIN3(), { ...MSG, finale: { missionId: "m-3", messageId: "m" }, events: [RULE("r", "finale_started", { missionId: "m-2" })] }), "events[0].where.missionId"],
  ["7 · finale_started cu missionId, fără finale",
    flowAdventure("t", MAIN3(), { ...MSG, events: [
      RULE("r-s", "mission_completed", { missionId: "m-3" }, { action: "start_finale" }), RULE("r", "finale_started", { missionId: "m-3" })] }), "events[1].where.missionId"],
  ["8 · secret_discovered fără discover_secret",
    flowAdventure("t", MAIN3(), { ...MSG, secrets: [{ id: "s-a", title: "S" }], events: [RULE("r", "secret_discovered", { secretId: "s-a" })] }), "events[0].on"],
  ["8 · discover_secret doar într-o regulă moartă",
    flowAdventure("t", MAIN3(), { ...MSG, secrets: [{ id: "s-a", title: "S" }], events: [
      RULE("r-mort", "mission_unlocked", { missionId: "m-1" }, { action: "discover_secret", secretId: "s-a" }), RULE("r", "secret_discovered", { secretId: "s-a" })] }),
    ["events[0].on", "events[1].on"]], // „r-mort” (subregula 3) și, prin ea, „r”
  ["9 · partner_unlocked fără unlock_partner",
    flowAdventure("t", [RIDDLE("m-1"), RIDDLE("m-p", { type: "partner", partnerId: "p-a" })], { ...MSG, partners: [PARTNER()], events: [RULE("r", "partner_unlocked", { partnerId: "p-a" })] }), "events[0].on"],
  ["9 · unlock_partner pe un partener deja „unlocked”",
    flowAdventure("t", [RIDDLE("m-1"), RIDDLE("m-p", { type: "partner", partnerId: "p-a" })], { ...MSG, partners: [PARTNER({ initialStatus: "unlocked" })], events: [
      RULE("r-u", "adventure_started", null, { action: "unlock_partner", partnerId: "p-a" }), RULE("r", "partner_unlocked", { partnerId: "p-a" })] }), "events[1].on"],
];

test("QA-F04: fiecare subregulă — ERROR pe calea așteptată; confirmat cu motorul: regula nu rulează pe niciun traseu", async () => {
  for (const [name, data, path] of F04_INVALID()) {
    const result = flowQa({ ...data, id: "test-qa-f04" }, "test-qa-f04.json");
    assert.deepEqual(activeRules(result, "QA-S01"), [], `${name}: schema validă`);
    assert.deepEqual(levels(result, "QA-F04"), [path].flat().map((p) => ["error", p]), name);
    assert.equal(await firesInEngine(data, "r"), false, `${name}: motorul nu rulează regula`);
  }
});

test("QA-F04: perechile valide nu sunt raportate și chiar rulează în motor", async () => {
  const valid = [
    ["missionId pe mission_completed", flowAdventure("t", MAIN3(), { ...MSG, events: [RULE("r", "mission_completed", { missionId: "m-1" })] })],
    ["missionId + locationId compatibile", flowAdventure("t", [GO("m-go", "l-a"), RIDDLE("m-1", { locationId: "l-a" })], {
      ...MSG, locations: [LOC("l-a")], events: [RULE("r", "mission_completed", { missionId: "m-1", locationId: "l-a" })] })],
    ["mission_unlocked pe a doua misiune main", flowAdventure("t", MAIN3(), { ...MSG, events: [RULE("r", "mission_unlocked", { missionId: "m-2" })] })],
    ["mission_started pe o misiune main", flowAdventure("t", MAIN3(), { ...MSG, events: [RULE("r", "mission_started", { missionId: "m-3" })] })],
    ["answer_incorrect pe o ghicitoare", flowAdventure("t", MAIN3(), { ...MSG, events: [RULE("r", "answer_incorrect", { missionId: "m-2" })] })],
    ["hint_requested pe o misiune cu indicii", flowAdventure("t", MAIN3(), { ...MSG, events: [RULE("r", "hint_requested", { missionId: "m-2" })] })],
    ["finale_started = finale.missionId", flowAdventure("t", MAIN3(), { ...MSG, finale: { missionId: "m-3", messageId: "m" }, events: [RULE("r", "finale_started", { missionId: "m-3" })] })],
    ["secret_discovered cu discover_secret", flowAdventure("t", MAIN3(), { ...MSG, secrets: [{ id: "s-a", title: "S" }], events: [
      RULE("r-d", "mission_completed", { missionId: "m-1" }, { action: "discover_secret", secretId: "s-a" }), RULE("r", "secret_discovered", { secretId: "s-a" })] })],
    ["partner_unlocked cu unlock_partner", flowAdventure("t", [RIDDLE("m-1"), RIDDLE("m-p", { type: "partner", partnerId: "p-a" })], { ...MSG, partners: [PARTNER()], events: [
      RULE("r-u", "mission_started", { missionId: "m-p" }, { action: "unlock_partner", partnerId: "p-a" }), RULE("r", "partner_unlocked", { partnerId: "p-a" })] })],
  ];
  for (const [name, data] of valid) {
    const result = flowQa({ ...data, id: "test-qa-f04-ok" }, "test-qa-f04-ok.json");
    assert.deepEqual(activeRules(result, "QA-S01"), [], `${name}: schema validă`);
    assert.deepEqual(activeRules(result, "QA-F"), [], name);
    assert.equal(await firesInEngine(data, "r"), true, `${name}: motorul rulează regula`);
  }
});

test("QA-F04: caz limită — hint_requested pe o misiune „location” cu indicii și answer_incorrect fără filtru nu sunt raportate", () => {
  // requestHint nu verifică tipul misiunii: motorul poate emite evenimentul (prin API, nu din interfață).
  const data = flowAdventure("test-qa-f04-hint-loc", [GO("m-go", "l-a", { hints: [{ text: "Indiciu de test." }] }), RIDDLE("m-1")], {
    ...MSG, locations: [LOC("l-a")], events: [RULE("r", "hint_requested", { missionId: "m-go" })],
  });
  assert.deepEqual(activeRules(flowQa(data), "QA-F04"), []);
  // Fără filtru: answer_incorrect într-o aventură care are și ghicitori → poate rula.
  const mixed = flowAdventure("test-qa-f04-fara-filtru", [GO("m-go", "l-a"), RIDDLE("m-1")], { ...MSG, locations: [LOC("l-a")], events: [RULE("r", "answer_incorrect", null)] });
  assert.deepEqual(activeRules(flowQa(mixed), "QA-F04"), []);
});

/* QA-F05 */

test("QA-F05: bonus / secret „locked” fără unlock_mission → WARNING; cu unlock → PASS", () => {
  const without = flowAdventure("test-qa-f05", [...MAIN3(), BONUS("b-1"), RIDDLE("s-1", { type: "secret", track: "secret" })]);
  assert.deepEqual(levels(flowQa(without), "QA-F05"), [["warning", "missions[3]"], ["warning", "missions[4]"]]);
  const withUnlock = flowAdventure("test-qa-f05-ok", [...MAIN3(), BONUS("b-1")], { events: [RULE("r", "mission_completed", { missionId: "m-1" }, { action: "unlock_mission", missionId: "b-1" })] });
  assert.deepEqual(activeRules(flowQa(withUnlock), "QA-F"), []);
  // Un bonus care începe „pending” nu are nevoie de deblocare.
  assert.deepEqual(activeRules(flowQa(flowAdventure("test-qa-f05-pending", [...MAIN3(), BONUS("b-1", { initialStatus: "pending" })])), "QA-F05"), []);
});

test("QA-F05: deblocarea doar dintr-o regulă moartă (QA-F04) → WARNING; complete_mission nu deblochează", () => {
  const deadOnly = flowAdventure("test-qa-f05-mort", [...MAIN3(), BONUS("b-1")], { events: [RULE("r", "mission_unlocked", { missionId: "m-1" }, { action: "unlock_mission", missionId: "b-1" })] });
  assert.deepEqual(levels(flowQa(deadOnly), "QA-F05"), [["warning", "missions[3]"]]);
  const completeOnly = flowAdventure("test-qa-f05-complete", [...MAIN3(), BONUS("b-1")], { events: [RULE("r", "mission_completed", { missionId: "m-1" }, { action: "complete_mission", missionId: "b-1" })] });
  assert.deepEqual(levels(flowQa(completeOnly), "QA-F05"), [["warning", "missions[3]"]]);
});

test("QA-F05: secret fără discover_secret și obiect fără collect_item → WARNING; cu acțiunea → PASS", () => {
  const data = flowAdventure("test-qa-f05-entitati", MAIN3(), { secrets: [{ id: "s-a", title: "S" }], items: [{ id: "o-a", name: "Obiect de test" }] });
  assert.deepEqual(levels(flowQa(data), "QA-F05"), [["warning", "items[0]"], ["warning", "secrets[0]"]]);
  data.events = [RULE("r", "mission_completed", { missionId: "m-2" }, { action: "discover_secret", secretId: "s-a" }, { action: "collect_item", itemId: "o-a" })];
  assert.deepEqual(activeRules(flowQa(data), "QA-F"), []);
});

test("QA-F05: fără analiză de graf — un ciclu indirect (b-1 ↔ b-2) NU este raportat în această etapă", () => {
  const cycle = flowAdventure("test-qa-f05-ciclu", [...MAIN3(), BONUS("b-1"), BONUS("b-2")], { events: [
    RULE("r-1", "mission_completed", { missionId: "b-1" }, { action: "unlock_mission", missionId: "b-2" }),
    RULE("r-2", "mission_completed", { missionId: "b-2" }, { action: "unlock_mission", missionId: "b-1" }),
  ] });
  assert.deepEqual(activeRules(flowQa(cycle), "QA-F"), []);
});

/* ---------- QA-F08: contractul narativ al finalului ---------- */

const FINALE = (finale, extra = {}) => flowAdventure("test-qa-f08", MAIN3(), { ...MSG, ...(finale === undefined ? {} : { finale }), ...extra });

test("QA-F08 (motor): finale.missionId produce doar finale_started; finale.messageId este epilogul, la orice încheiere", async () => {
  // Finalul pe prima misiune: finale_started la start, jocul continuă normal, epilogul apare la sfârșit.
  const early = engineRun(FINALE({ missionId: "m-1", messageId: "m" }));
  early.game.start();
  assert.notEqual(early.game.getState().finaleStartedAt, null);
  await solveFirstTwo(early.game);
  assert.deepEqual(await early.game.submitAnswer("sud"), { result: "correct" });
  early.game.next();
  assert.equal(early.game.getState().status, "completed");
  assert.equal(buildViewModel({ content: early.game.content, state: early.game.getState() }).story.epilogue, "Mesaj de test.");
  // Fără messageId: aceeași încheiere, fără epilog.
  const silent = engineRun(FINALE({ missionId: "m-3" }));
  silent.game.start();
  await solveFirstTwo(silent.game);
  await silent.game.submitAnswer("sud");
  silent.game.next();
  assert.equal(silent.game.getState().status, "completed");
  assert.equal(buildViewModel({ content: silent.game.content, state: silent.game.getState() }).story.epilogue, null);
});

test("QA-F08.1: finale pe ultima misiune main → fără finding (și cu un bonus după ea; fixture-ul fictiv)", () => {
  assert.deepEqual(activeRules(flowQa(FINALE({ missionId: "m-3", messageId: "m" })), "QA-F"), []);
  const withBonus = flowAdventure("test-qa-f08-bonus", [...MAIN3(), BONUS("b-1", { initialStatus: "pending" })], { ...MSG, finale: { missionId: "m-3", messageId: "m" } });
  assert.deepEqual(activeRules(flowQa(withBonus), "QA-F08"), []);
  assert.deepEqual(activeRules(flowQa(fixture(), FIXTURE_FILE), "QA-F08"), []);
});

test("QA-F08.1: finale pe prima sau pe o misiune intermediară → WARNING pe finale.missionId", () => {
  for (const missionId of ["m-1", "m-2"]) {
    const result = flowQa(FINALE({ missionId, messageId: "m" }));
    assert.deepEqual(levels(result, "QA-F08"), [["warning", "finale.missionId"]], missionId);
    assert.match(active(result, "QA-F08")[0].message, new RegExp(`„${missionId}” nu este ultima misiune principală \\(„m-3”\\)`));
    assert.equal(result.status, "WARNING");
    // Fără complete_adventure, nu este o finalizare prematură: QA-F00 / QA-F03 nu raportează nimic.
    assert.deepEqual(activeRules(result, "QA-F03"), []);
  }
});

test("QA-F08.2: finale {} / doar missionId / doar messageId → WARNING (niciodată ERROR)", () => {
  const cases = [
    [{}, [["warning", "finale"]]],
    [{ missionId: "m-3" }, [["warning", "finale.messageId"]]],
    [{ messageId: "m" }, [["warning", "finale.missionId"]]],
    // Fără messageId și nu pe ultima misiune: cele două probleme sunt raportate separat.
    [{ missionId: "m-1" }, [["warning", "finale.messageId"], ["warning", "finale.missionId"]]],
  ];
  for (const [finale, expected] of cases) {
    const result = flowQa(FINALE(finale));
    assert.deepEqual(activeRules(result, "QA-S01"), [], `${JSON.stringify(finale)}: schema validă`);
    assert.deepEqual(levels(result, "QA-F08"), expected, JSON.stringify(finale));
  }
});

test("QA-F08.2: finale absent → WARNING doar pentru published-real; demo, private-local și anomaly → fără F08", () => {
  const publishedId = PUBLISHED_REAL_ADVENTURES[0];
  const published = (finale) => runQa([entry(`${publishedId}.json`, flowAdventure(publishedId, MAIN3(), { ...MSG, ...(finale ? { finale } : {}) }))]).results[0];
  assert.equal(published().classification, CLASSES.PUBLISHED_REAL);
  assert.deepEqual(levels(published(), "QA-F08"), [["warning", "finale"]]);
  assert.deepEqual(activeRules(published({ missionId: "m-3", messageId: "m" }), "QA-F08"), []);

  const demo = flowQa(FINALE(undefined));
  assert.equal(demo.classification, CLASSES.PUBLIC_DEMO);
  assert.deepEqual(activeRules(demo, "QA-F"), []);
  const privateLocal = runQa([entry("private-test-qa-f08.json", flowAdventure("private-test-qa-f08", MAIN3()))]).results[0];
  assert.equal(privateLocal.classification, CLASSES.PRIVATE_LOCAL);
  assert.deepEqual(activeRules(privateLocal, "QA-F08"), []);
  const anomaly = runQa([entry("test-qa-f08-anomalie.json", { ...flowAdventure("test-qa-f08-anomalie", MAIN3()), demo: false })]).results[0];
  assert.equal(anomaly.classification, CLASSES.ANOMALY);
  assert.deepEqual(activeRules(anomaly, "QA-F08"), []);
});

test("QA-F08.3: start_finale fără finale → WARNING; cu finale sau într-o regulă moartă (QA-F04) → fără F08", () => {
  const startFinale = (on, where) => RULE("r-sf", on, where, { action: "start_finale" });
  const without = flowQa(FINALE(undefined, { events: [startFinale("mission_completed", { missionId: "m-3" })] }));
  assert.deepEqual(levels(without, "QA-F08"), [["warning", "events[0].do[0]"]]);
  assert.match(active(without, "QA-F08")[0].message, /„r-sf” folosește start_finale, dar aventura nu are finale/);

  const withFinale = flowQa(FINALE({ missionId: "m-3", messageId: "m" }, { events: [startFinale("mission_completed", { missionId: "m-3" })] }));
  assert.deepEqual(activeRules(withFinale, "QA-F"), []);
  // Regula nu poate rula (mission_unlocked pe prima misiune, „pending”): o raportează doar QA-F04.
  const dead = flowQa(FINALE(undefined, { events: [startFinale("mission_unlocked", { missionId: "m-1" })] }));
  assert.deepEqual(activeRules(dead, "QA-F"), ["QA-F04"]);
});

test("QA-F08: referințele invalide rămân la QA-S01, fără duplicare F08", () => {
  const invalid = [
    { missionId: "m-lipsa", messageId: "m" },
    { missionId: "m-3", messageId: "lipsa" },
    { missionId: "m-1", messageId: "lipsa" }, // ar fi și „nu este ultima”, dar schema este invalidă
    null,
  ];
  for (const finale of invalid) {
    const result = flowQa(FINALE(finale));
    assert.ok(activeRules(result, "QA-S01").length > 0, JSON.stringify(finale));
    assert.deepEqual(activeRules(result, "QA-F08"), [], JSON.stringify(finale));
  }
  const bonus = flowQa(flowAdventure("test-qa-f08-bonus-final", [...MAIN3(), BONUS("b-1")], { ...MSG, finale: { missionId: "b-1", messageId: "m" } }));
  assert.match(active(bonus, "QA-S01").map((f) => f.message).join(" "), /finale\.missionId trebuie să fie o misiune principală/);
  assert.deepEqual(activeRules(bonus, "QA-F08"), []);
});

test("QA-F08: aventură privată locală — mesajele nu expun id-urile misiunilor", () => {
  const result = runQa([entry("private-test-qa-f08b.json", flowAdventure("private-test-qa-f08b", MAIN3(), { ...MSG, finale: { missionId: "m-1", messageId: "m" } }))]).results[0];
  assert.deepEqual(levels(result, "QA-F08"), [["warning", "finale.missionId"]]);
  assert.doesNotMatch(active(result, "QA-F08")[0].message, /m-1|m-3/);
});
