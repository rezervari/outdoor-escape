// Adventure QA — Pasul 1 (QA-S01, QA-S02, QA-S03) și clasificarea aventurilor.
// Mutațiile folosesc numai fixture-ul FICTIV tests/fixtures/adventure-v2-demo.json.
// Testele nu conțin id-uri, texte sau date ale aventurilor reale: aventura publicată (D-080)
// este luată din lista unică tests/helpers/published-real-adventures.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { runQa, checkFile, checkDuplicateIds } from "../scripts/adventure-qa/rules.mjs";
import { classifyAdventure, CLASSES } from "../scripts/adventure-qa/classify.mjs";
import { PUBLISHED_REAL_ADVENTURES } from "./helpers/published-real-adventures.js";

const ROOT = fileURLToPath(new URL("../", import.meta.url));
const ADVENTURES_DIR = join(ROOT, "content", "adventures");
const CLI = join(ROOT, "scripts", "qa-adventures.mjs");

const fixtureText = readFileSync(join(ROOT, "tests", "fixtures", "adventure-v2-demo.json"), "utf8");
const fixture = () => JSON.parse(fixtureText);
const FIXTURE_FILE = `${fixture().id}.json`;
const entry = (fileName, data) => ({ fileName, text: typeof data === "string" ? data : JSON.stringify(data) });
const rules = (findings) => findings.map((f) => f.ruleId);

/* ---------- Toate aventurile din repository ---------- */

test("QA: toate fișierele content/adventures/*.json trec QA-S01, QA-S02 și QA-S03", () => {
  const names = readdirSync(ADVENTURES_DIR).filter((name) => name.endsWith(".json"));
  assert.ok(names.length > 0);
  const { results, summary } = runQa(names.map((fileName) => ({ fileName, text: readFileSync(join(ADVENTURES_DIR, fileName), "utf8") })));
  assert.equal(summary.files, names.length);
  for (const result of results) assert.deepEqual(result.findings, [], `${result.label}: ${result.findings.map((f) => f.message).join(" | ")}`);
  assert.equal(summary.errors, 0);
  // Fișierele urmărite din repository nu sunt anomalii.
  assert.ok(results.every((r) => r.classification !== CLASSES.ANOMALY), results.map((r) => `${r.label}: ${r.classification}`).join(", "));
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

test("CLI: repository-ul actual → exit 0 (implicit, --public-only, --strict)", () => {
  for (const args of [[], ["--public-only"], ["--strict"]]) {
    const run = runCli(...args);
    assert.equal(run.status, 0, `${args.join(" ")}\n${run.stdout}${run.stderr}`);
    assert.match(run.stdout, /Rezultat: PASS/);
  }
  // --public-only nu raportează aventurile private locale.
  assert.doesNotMatch(runCli("--public-only").stdout, /aventura privată|private-local/);
});

test("CLI: un singur fișier — raportat singur, comparat (QA-S03) cu toate content/adventures/*.json", () => {
  const dir = mkdtempSync(join(tmpdir(), "oe-qa-"));
  try {
    // Fișier valid, din afara repository-ului → PASS, doar el în raport.
    const good = join(dir, FIXTURE_FILE);
    writeFileSync(good, fixtureText);
    const single = runCli(good);
    assert.equal(single.status, 0, single.stdout);
    assert.match(single.stdout, /PASS\s+demo-ceasul-oprit\.json/);
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
