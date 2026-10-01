// Adventure QA — Pasul 1 (QA-S01, QA-S02, QA-S03, clasificarea), Pasul 2 (QA-C02 – C05, QA-M01 – M06)
// și Pasul 3 (QA-G02 – G07: GPS și structură).
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

import { runQa, checkFile, checkDuplicateIds } from "../scripts/adventure-qa/rules.mjs";
import { classifyAdventure, CLASSES } from "../scripts/adventure-qa/classify.mjs";
import { QA_EXCEPTIONS, findException } from "../scripts/adventure-qa/exceptions.mjs";
import { MEDIA_EXTENSIONS } from "../scripts/adventure-qa/rules-media.mjs";
import { checkGps, NEAR_ZERO_DEGREES } from "../scripts/adventure-qa/rules-gps.mjs";
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
