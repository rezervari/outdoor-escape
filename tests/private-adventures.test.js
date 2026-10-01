// Aventurile reale LOCALE (content/adventures/private-*.json, ignorate de Git — D-034).
// Testele sunt GENERICE: descoperă fișierele la rulare și nu conțin nimic din conținutul lor
// (id, texte, răspunsuri, coordonate). Fără fișiere private (ex. o clonă publică), sunt sărite.
//   1. structură — schemă, locații, misiuni, media, obiecte, variante, final, referințe;
//   2. flow — start → final, obiecte, rezolvare, sărire, reîncărcare;
//   3. confidențialitate — conținutul privat nu apare în fișierele urmărite de Git;
//      excepție: aventurile publicate explicit (D-080), pentru care se verifică publicarea exactă.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";

import { validateAdventure } from "../src/js/content.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createGame, GameStatus } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers, normalizeAnswer } from "../src/js/answers.js";
import { buildViewModel } from "../src/js/view-model.js";
import { listMediaPaths, resolveMissionMedia } from "../src/js/media.js";
import { PUBLISHED_REAL_ADVENTURES } from "./helpers/published-real-adventures.js";

const root = new URL("../", import.meta.url);
const adventuresDir = new URL("content/adventures/", root);
const files = readdirSync(adventuresDir).filter((name) => /^private-.+\.json$/.test(name)).sort();
const skip = files.length === 0 ? "nu există aventuri private locale (content/adventures/private-*.json)" : false;

const load = (name) => JSON.parse(readFileSync(new URL(name, adventuresDir), "utf8"));

function clock() {
  let t = 0;
  return () => (t += 1_000);
}

function newGame(source, savedState = null) {
  const content = toAdventureV2(source);
  return createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), savedState, now: clock() });
}

const mainMissions = (content) => content.missions.filter((m) => m.track === "main");
const isAnswerMission = (mission) => typeof mission.answer === "string";

/**
 * Parcurge traseul principal. `solve(mission)` decide pentru fiecare provocare cu răspuns:
 * "solve" (răspunsul corect), "skip" (Sari peste) sau "wrong-then-solve" (greșit, indiciu, corect).
 */
async function play(source, { solve = () => "solve", stopAfter = Infinity, game = newGame(source) } = {}) {
  const content = toAdventureV2(source);
  if (game.getState().status === GameStatus.IDLE) game.start();
  for (const [index, mission] of mainMissions(content).entries()) {
    if (index >= stopAfter) break;
    if (game.getState().currentMissionId !== mission.id) continue; // deja parcursă (după reîncărcare)
    if (game.getState().missions[mission.id].status === "pending") {
      if (mission.type === "location") {
        assert.deepEqual(game.confirmArrival(mission.locationId), { accepted: true }, mission.id);
      } else if (isAnswerMission(mission)) {
        const mode = solve(mission);
        if (mode === "skip") game.skipMission(mission.id);
        else {
          if (mode === "wrong-then-solve") {
            assert.deepEqual(await game.submitAnswer("__raspuns-gresit__"), { result: "incorrect" }, mission.id);
            if (mission.hints.length > 0) assert.equal(typeof game.requestHint(mission.id), "string");
          }
          assert.deepEqual(await game.submitAnswer(mission.answer), { result: "correct" }, mission.id);
        }
      }
    }
    game.next();
  }
  return game;
}

for (const name of files.length ? files : ["(niciuna)"]) {
  const source = skip ? null : load(name);
  const content = skip ? null : toAdventureV2(source);
  const label = skip ? name : `aventura privată #${files.indexOf(name) + 1}`;
  // D-080: publicată explicit pe GitHub Pages (fișierele ei sunt urmărite de Git).
  const published = !skip && PUBLISHED_REAL_ADVENTURES.includes(source.id);
  const publishedFile = (file) => PUBLISHED_REAL_ADVENTURES.some((id) => file === `content/adventures/${id}.json` || file.startsWith(`content/adventures/media/${id}/`));

  /* ---------- 1. Structură ---------- */

  test(`${label} · structură: schemă V2 validă, id privat, conținut nemarcat ca demo`, { skip }, () => {
    assert.deepEqual(validateAdventure(source), { valid: true, errors: [] });
    assert.equal(`${source.id}.json`, name);
    assert.notEqual(source.demo, true);
  });

  test(`${label} · structură: fiecare locație are coordonate, instrucțiuni în cuvinte și „Am ajuns” (D-006)`, { skip }, () => {
    for (const location of content.locations) {
      assert.ok(Number.isFinite(location.coordinates?.lat) && Number.isFinite(location.coordinates?.lng), location.id);
      assert.ok(typeof location.fallback?.instructions === "string" && location.fallback.instructions.trim() !== "", `${location.id}: fallback.instructions`);
      const manual = location.fallback?.allowManualConfirmation ?? content.settings.gps.allowManualConfirmation;
      assert.equal(manual, true, `${location.id}: confirmarea manuală trebuie să rămână disponibilă`);
    }
    // Fiecare provocare de pe traseu este legată de o locație (sosire → provocare).
    for (const mission of mainMissions(content)) assert.ok(mission.locationId, `${mission.id}: locationId`);
  });

  test(`${label} · structură: variantele conțin răspunsul; indiciile există; inputMode numeric doar pentru cifre`, { skip }, () => {
    for (const mission of content.missions.filter(isAnswerMission)) {
      if (mission.choices) {
        assert.ok(mission.choices.map(normalizeAnswer).includes(normalizeAnswer(mission.answer)), `${mission.id}: răspunsul nu este printre variante`);
      }
      if (mission.inputMode === "numeric") assert.match(normalizeAnswer(mission.answer), /^\d+$/, `${mission.id}: răspuns numeric`);
      assert.ok(mission.hints.length > 0, `${mission.id}: cel puțin un indiciu`);
    }
  });

  test(`${label} · structură: media — fișierele există local, sunt sub media/private-*/ și fiecare bloc se rezolvă`, { skip }, () => {
    for (const path of listMediaPaths(content)) {
      assert.match(path, /^media\/private-[a-z0-9-]+\//, `${path}: media privată stă în content/adventures/media/private-<id>/`);
      assert.ok(existsSync(new URL(path, adventuresDir)), `${path}: fișier lipsă`);
    }
    for (const mission of content.missions.filter((m) => Array.isArray(m.media))) {
      assert.equal(resolveMissionMedia(content, mission.media).length, mission.media.length, `${mission.id}: bloc nerezolvat`);
    }
    // Imaginile de arhivă nu își declară faptele ca verificate fără sursă și licență reale.
    for (const asset of Object.values(content.media.assets)) {
      if (asset.role === "archival" && asset.provenance?.factsVerified === true) {
        assert.doesNotMatch(`${asset.provenance.credit} ${asset.provenance.license}`, /ASSET TO SOURCE/, `${asset.id}: fapte verificate fără sursă`);
      }
    }
  });

  test(`${label} · structură: obiectele se pot obține; finalul este ultima misiune principală, cu epilog`, { skip }, () => {
    const collectable = new Set(content.events.flatMap((rule) => rule.do.filter((a) => a.action === "collect_item").map((a) => a.itemId)));
    for (const item of content.items) assert.ok(collectable.has(item.id), `${item.id}: nicio regulă nu îl dă`);
    const main = mainMissions(content);
    assert.equal(content.finale?.missionId, main[main.length - 1].id);
    assert.ok(content.narrator.messages[content.finale.messageId]?.text, "epilogul există");
    // Obiectele date la rezolvarea unei provocări se dau și la sărirea ei (anti-fundătură), dacă aventura folosește convenția.
    const onSkip = new Set(content.events.filter((r) => r.on === "mission_skipped").flatMap((r) => r.do.filter((a) => a.action === "collect_item").map((a) => `${r.where?.missionId}:${a.itemId}`)));
    for (const rule of content.events.filter((r) => r.on === "mission_completed" && r.where?.missionId)) {
      for (const action of rule.do.filter((a) => a.action === "collect_item")) {
        const key = `${rule.where.missionId}:${action.itemId}`;
        if (onSkip.size > 0 && !onSkip.has(key)) {
          // Excepție permisă: obiecte doar de poveste, ale căror provocări nu dau cifre / date pentru final.
          assert.ok(!/\d/.test(content.items.find((i) => i.id === action.itemId)?.name || ""), `${key}: obiect cu cifră fără regulă la sărire`);
        }
      }
    }
  });

  /* ---------- 2. Flow ---------- */

  test(`${label} · flow: start → final cu toate provocările rezolvate; toate obiectele; scor maxim; epilog`, { skip }, async () => {
    const game = await play(source);
    assert.equal(game.getState().status, GameStatus.COMPLETED);
    assert.deepEqual(new Set(game.getProgressSummary().collectedItems), new Set(content.items.map((i) => i.id)));
    assert.equal(game.getSummary().score, game.getSummary().maxScore);
    const vm = buildViewModel({ content: game.content, state: game.getState() });
    assert.equal(vm.story.epilogue, content.narrator.messages[content.finale.messageId].text);
    assert.ok(vm.story.entries.length > 0, "jurnalul are mesaje");
  });

  test(`${label} · flow: răspuns greșit + indiciu nu blochează nimic`, { skip }, async () => {
    const game = await play(source, { solve: () => "wrong-then-solve" });
    assert.equal(game.getState().status, GameStatus.COMPLETED);
    const answered = content.missions.filter(isAnswerMission).map((m) => game.getState().missions[m.id]);
    assert.ok(answered.every((m) => m.status === "solved" && m.attempts === 2));
  });

  test(`${label} · flow: sărirea tuturor provocărilor în afara finalului nu blochează finalul (0 puncte pentru cele sărite)`, { skip }, async () => {
    const finaleId = content.finale.missionId;
    const game = await play(source, { solve: (mission) => (mission.id === finaleId ? "solve" : "skip") });
    assert.equal(game.getState().status, GameStatus.COMPLETED);
    const finale = content.missions.find((m) => m.id === finaleId);
    assert.equal(game.getSummary().score, finale.points, "doar finalul aduce puncte");
    // Obiectele date la sărire sunt în inventar.
    const fromSkip = content.events.filter((r) => r.on === "mission_skipped").flatMap((r) => r.do.filter((a) => a.action === "collect_item").map((a) => a.itemId));
    for (const itemId of fromSkip) assert.ok(game.getProgressSummary().collectedItems.includes(itemId), itemId);
  });

  test(`${label} · flow: reîncărcarea la jumătate păstrează misiunea, obiectele și jurnalul`, { skip }, async () => {
    const half = Math.floor(mainMissions(content).length / 2);
    const first = await play(source, { stopAfter: half });
    const saved = JSON.parse(JSON.stringify(first.getState())); // ca în localStorage
    const before = buildViewModel({ content: first.content, state: first.getState() });
    const reloaded = newGame(source, saved);
    const after = buildViewModel({ content: reloaded.content, state: reloaded.getState() });
    assert.equal(after.mission.id, before.mission.id);
    assert.deepEqual(after.items, before.items);
    assert.deepEqual(after.story.entries.map((e) => e.key), before.story.entries.map((e) => e.key));
    assert.deepEqual(after.mission.media, before.mission.media);
    const done = await play(source, { game: reloaded });
    assert.equal(done.getState().status, GameStatus.COMPLETED);
  });

  test(`${label} · flow: revenirea la o locație deja parcursă nu schimbă nimic`, { skip }, async () => {
    const game = await play(source, { stopAfter: 4 });
    const visited = content.locations.find((l) => game.getState().locations[l.id].status === "completed");
    assert.ok(visited, "există o locație parcursă");
    const before = JSON.stringify(game.getState());
    assert.deepEqual(game.confirmArrival(visited.id), { accepted: false, reason: "completed" });
    game.reportPosition({ lat: visited.coordinates.lat, lng: visited.coordinates.lng, accuracy: 5 });
    assert.equal(JSON.stringify(game.getState()), before);
  });

  /* ---------- 3. Confidențialitate ---------- */

  test(`${label} · confidențialitate: fișierul și media privată sunt ignorate de Git`, { skip: skip || (published && "publicată explicit (D-080)") }, (t) => {
    let git;
    try {
      git = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
      git(["--version"]);
    } catch {
      t.skip("git indisponibil");
      return;
    }
    assert.doesNotThrow(() => git(["check-ignore", "-q", `content/adventures/${name}`]), `${name} nu este ignorat de Git`);
    for (const path of listMediaPaths(content)) {
      assert.doesNotThrow(() => git(["check-ignore", "-q", `content/adventures/${path}`]), `${path} nu este ignorat de Git`);
    }
    const tracked = git(["ls-files", "content/adventures"]).split("\n");
    assert.ok(!tracked.some((file) => file.includes("private-") && !publishedFile(file)), "un fișier privat (nepublicat) este urmărit de Git");
  });

  test(`${label} · confidențialitate: textele, răspunsurile și id-ul nu apar în fișierele urmărite de Git`, { skip: skip || (published && "publicată explicit (D-080)") }, (t) => {
    let tracked;
    try {
      tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
    } catch {
      t.skip("git indisponibil");
      return;
    }
    // Fragmente distinctive: id, titlu, mesaje, briefing-uri, nume de locații și obiecte, răspunsuri lungi.
    const fragments = new Set([source.id, content.meta.title]);
    const add = (text, min = 24) => {
      if (typeof text !== "string") return;
      const line = text.split("\n").map((part) => part.trim()).find((part) => part.length >= min);
      if (line) fragments.add(line.slice(0, 48));
    };
    for (const message of Object.values(content.narrator.messages)) add(message.text);
    for (const mission of content.missions) add(mission.briefing);
    for (const location of content.locations) add(location.fallback?.instructions);
    for (const item of content.items) add(item.description, 16);
    for (const mission of content.missions.filter(isAnswerMission)) if (mission.answer.length >= 6) fragments.add(mission.answer);
    const textFile = /\.(js|json|md|html|css|webmanifest|txt|yml|yaml|svg)$/i;
    for (const file of tracked.filter((f) => textFile.test(f))) {
      const path = new URL(file, root);
      if (!existsSync(path) || statSync(path).size > 2_000_000) continue;
      const text = readFileSync(path, "utf8").toLowerCase();
      for (const fragment of fragments) {
        assert.ok(!text.includes(fragment.toLowerCase()), `${file} conține un fragment din aventura privată`);
      }
    }
  });

  test(`${label} · publicare (D-080): exact JSON-ul și media referite sunt urmărite de Git, nimic altceva din folderul ei`, { skip: skip || (!published && "nu este publicată") }, (t) => {
    let tracked;
    try {
      tracked = execFileSync("git", ["ls-files", "content/adventures"], { cwd: root, encoding: "utf8" }).split("\n").filter(Boolean);
    } catch {
      t.skip("git indisponibil");
      return;
    }
    assert.ok(tracked.includes(`content/adventures/${name}`), `${name} nu este urmărit de Git (D-080)`);
    const expectedMedia = listMediaPaths(content).map((path) => `content/adventures/${path}`).sort();
    for (const file of expectedMedia) assert.ok(tracked.includes(file), `${file} lipsește din Git (D-080)`);
    const mediaDir = `content/adventures/media/${source.id}/`;
    assert.deepEqual(tracked.filter((file) => file.startsWith(mediaDir)).sort(), expectedMedia, "în Git sunt fișiere media nereferite de aventură");
  });
}
