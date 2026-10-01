// Adventure QA — Pasul 1 (QA-S01, QA-S02, QA-S03, clasificarea) și Pasul 2 (QA-C02 – C05, QA-M01 – M06).
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
