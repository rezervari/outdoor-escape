// Challenge System V1 (NOW): registrul media (media.assets + audio.tracks legacy), blocurile
// image / compare / audio, inputMode numeric, viewer-ul generic (D-072, D-073).
// Aventurile de test sunt FICTIVE: demo-ul content/adventures/demo-challenge-media.json și
// o aventură minimă definită aici (coordonate lângă 0°, 0°). Fără DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";

import { validateAdventure } from "../src/js/content.js";
import { validateAdventureV2, toAdventureV2 } from "../src/js/schema.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";
import { buildViewModel } from "../src/js/view-model.js";
import { describePlayUi, openLayers, planBack, Layer } from "../src/js/play-ui.js";
import {
  MEDIA_ASSET_TYPES,
  RESERVED_MEDIA_ASSET_TYPES,
  MEDIA_BLOCK_TYPES,
  normalizeMediaRegistry,
  resolveMissionMedia,
  resolveMediaUrl,
  listMediaPaths,
  joinMediaPath,
} from "../src/js/media.js";
import { formatTime, compareClip, compareLabels, mediaSignature, audioStatusText, AudioState, viewerTitle, MEDIA_TEXTS } from "../src/js/media-ui.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const json = (path) => JSON.parse(read(path));
const demo = json("../content/adventures/demo-challenge-media.json");
const fixture = json("./fixtures/adventure-v2-demo.json");
const code = (path) => read(path).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

/** Aventură minimă, fictivă, cu câte un exemplu din fiecare capabilitate. */
const base = () => ({
  schemaVersion: 2,
  id: "test-media",
  demo: true,
  meta: { title: "[TEST] Media" },
  narrator: { messages: { transcriere: { text: "Transcript din mesaj." } } },
  media: {
    basePath: "media/test/",
    assets: {
      "img-a": { type: "image", src: "a.webp", alt: "Imaginea A, fictivă." },
      "img-b": { type: "image", src: "b.webp", alt: "Imaginea B, fictivă.", caption: "Legenda B", credit: "Test" },
      "snd-a": { type: "audio", src: "a.m4a", kind: "voice", transcript: "Transcript propriu." },
    },
  },
  audio: { basePath: "media/vechi/", tracks: { "snd-vechi": { src: "v.mp3", kind: "voice", transcriptMessage: "transcriere" } } },
  locations: [{ id: "loc-a", name: "[TEST] A", type: "start", coordinates: { lat: 0.001, lng: 0.001 }, initialStatus: "unlocked" }],
  missions: [
    { id: "m-imagine", type: "riddle", title: "Imagine", briefing: "?", points: 1, locationId: "loc-a", answer: "cerc", media: [{ type: "image", asset: "img-a" }] },
    { id: "m-comparatie", type: "observation", title: "Comparație", briefing: "?", points: 1, locationId: "loc-a", answer: "12", inputMode: "numeric",
      media: [{ type: "compare", before: "img-a", after: "img-b", mode: "slider" }] },
    { id: "m-sunet", type: "riddle", title: "Sunet", briefing: "?", points: 1, locationId: "loc-a", answer: "ecoul",
      media: [{ type: "audio", asset: "snd-a" }, { type: "audio", asset: "snd-vechi", showTranscript: "expanded" }] },
  ],
});

function expectInvalid(mutate, pattern) {
  const data = base();
  mutate(data);
  const { valid, errors } = validateAdventureV2(data);
  assert.equal(valid, false, `ar trebui respinsă: ${mutate}`);
  assert.ok(errors.some((e) => pattern.test(e)), `nicio eroare nu corespunde ${pattern}: ${errors.join(" | ")}`);
}

function clock() {
  let t = 0;
  return () => (t += 1_000);
}

function newGame(source) {
  const content = toAdventureV2(source);
  return createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), now: clock() });
}

const BASE_URL = "https://exemplu.test/outdoor-escape/content/adventures/test-media.json";

/* ---------- Schema ---------- */

test("schema: media.assets (image, audio), blocurile image / compare / audio și inputMode numeric sunt valide", () => {
  assert.deepEqual(validateAdventureV2(base()), { valid: true, errors: [] });
  assert.deepEqual([...MEDIA_ASSET_TYPES], ["image", "audio"]);
  assert.deepEqual([...MEDIA_BLOCK_TYPES], ["image", "compare", "audio"]);
});

test("schema: demo-ul fictiv demo-challenge-media este valid, demo și fără coordonate reale", () => {
  assert.deepEqual(validateAdventure(demo), { valid: true, errors: [] });
  assert.equal(demo.demo, true);
  for (const location of demo.locations) {
    assert.ok(Math.abs(location.coordinates.lat) < 0.01 && Math.abs(location.coordinates.lng) < 0.01, "coordonate lângă 0°, 0°");
  }
});

test("schema: audio.tracks (format vechi) rămâne acceptat, inclusiv în fixture-ul existent", () => {
  assert.equal(validateAdventureV2(fixture).valid, true);
  const data = base();
  delete data.media;
  data.missions = [data.missions[2]];
  data.missions[0].media = [{ type: "audio", asset: "snd-vechi" }];
  assert.deepEqual(validateAdventureV2(data), { valid: true, errors: [] });
});

test("schema: tipurile de asset rezervate (video, model3d, ar) sunt respinse explicit; tipurile necunoscute la fel", () => {
  for (const type of RESERVED_MEDIA_ASSET_TYPES) {
    expectInvalid((a) => (a.media.assets["img-a"].type = type), new RegExp(`„${type}” este rezervat`));
  }
  expectInvalid((a) => (a.media.assets["img-a"].type = "gif"), /type necunoscut: „gif”/);
  expectInvalid((a) => delete a.media.assets["img-a"].type, /type necunoscut/);
});

test("schema: blocurile rezervate și necunoscute sunt respinse", () => {
  expectInvalid((a) => (a.missions[0].media[0] = { type: "video", asset: "img-a" }), /„video” este rezervat/);
  expectInvalid((a) => (a.missions[0].media[0] = { type: "ar" }), /„ar” este rezervat/);
  expectInvalid((a) => (a.missions[0].media[0] = { type: "historical_overlay", before: "img-a", after: "img-b" }), /type necunoscut: „historical_overlay”/);
  expectInvalid((a) => (a.missions[0].media = { type: "image" }), /media trebuie să fie o listă/);
});

test("schema: asset lipsă sau de tip greșit", () => {
  expectInvalid((a) => (a.missions[0].media[0].asset = "img-lipsa"), /referință inexistentă „img-lipsa”/);
  expectInvalid((a) => delete a.missions[0].media[0].asset, /media\[0\]\.asset lipsește/);
  expectInvalid((a) => (a.missions[0].media[0].asset = "snd-a"), /este de tip „audio”, nu „image”/);
  expectInvalid((a) => (a.missions[2].media[0].asset = "img-a"), /este de tip „image”, nu „audio”/);
});

test("schema: configurație compare invalidă", () => {
  expectInvalid((a) => (a.missions[1].media[0].after = "img-a"), /before și after trebuie să fie imagini diferite/);
  expectInvalid((a) => (a.missions[1].media[0].mode = "fade"), /mode necunoscut: „fade”/);
  expectInvalid((a) => delete a.missions[1].media[0].after, /media\[0\]\.after lipsește/);
  expectInvalid((a) => (a.missions[1].media[0].before = "snd-a"), /before: „snd-a” este de tip „audio”/);
  expectInvalid((a) => (a.missions[1].media[0].labels = "A/B"), /labels trebuie să fie un obiect/);
});

test("schema: metadatele pe tip (alt, transcript, archival) și căile sigure", () => {
  expectInvalid((a) => delete a.media.assets["img-a"].alt, /alt lipsește/);
  expectInvalid((a) => (a.media.assets["img-a"].role = "istoric"), /role necunoscut/);
  expectInvalid((a) => (a.media.assets["img-a"].role = "archival"), /archival” cere provenance\.credit și provenance\.license/);
  const archival = base();
  archival.media.assets["img-a"].role = "archival";
  archival.media.assets["img-a"].provenance = { credit: "ASSET TO SOURCE", license: "ASSET TO SOURCE", factsVerified: false };
  assert.equal(validateAdventureV2(archival).valid, true);
  expectInvalid((a) => delete a.media.assets["snd-a"].transcript, /sunetele cu voce trebuie să aibă transcript/);
  expectInvalid((a) => (a.media.assets["snd-a"].transcriptMessage = "transcriere"), /transcript SAU transcriptMessage/);
  expectInvalid((a) => (a.media.assets["snd-a"].kind = "podcast"), /kind necunoscut/);
  expectInvalid((a) => (a.media.assets["img-a"].src = "../secret.webp"), /src trebuie să fie o cale relativă/);
  expectInvalid((a) => (a.media.assets["img-a"].src = "/img.webp"), /src trebuie să fie o cale relativă/);
  expectInvalid((a) => (a.media.assets["img-a"].src = "https://exemplu.test/a.webp"), /src trebuie să fie o cale relativă/);
  expectInvalid((a) => (a.media.basePath = "../alt/"), /media\.basePath/);
});

test("schema: registrul este unic — același id în media.assets și audio.tracks este respins", () => {
  expectInvalid((a) => (a.media.assets["snd-vechi"] = { type: "audio", src: "x.m4a" }), /există deja în audio\.tracks/);
});

test("schema: referințele audio existente (narator, play_audio) acceptă asset-uri audio din media.assets, nu imagini", () => {
  const data = base();
  data.narrator.messages.intro = { text: "Intro.", audio: "snd-a" };
  data.events = [{ id: "ev-sunet", on: "adventure_started", do: [{ action: "play_audio", trackId: "snd-a" }] }];
  assert.deepEqual(validateAdventureV2(data), { valid: true, errors: [] });
  expectInvalid((a) => (a.narrator.messages.intro = { text: "Intro.", audio: "img-a" }), /narrator\.messages\.intro\.audio/);
});

test("schema: inputMode — doar pe misiuni cu răspuns, doar text / numeric, nu împreună cu choices", () => {
  expectInvalid((a) => (a.missions[1].inputMode = "decimal"), /inputMode necunoscut: „decimal”/);
  expectInvalid((a) => {
    a.missions.push({ id: "m-loc", type: "location", title: "L", briefing: "L", points: 0, locationId: "loc-a", inputMode: "numeric" });
  }, /inputMode este permis doar pentru misiunile cu răspuns/);
  expectInvalid((a) => (a.missions[0].choices = ["CERC", "PĂTRAT"]) && (a.missions[0].inputMode = "numeric"), /nu se folosește împreună cu choices/);
});

/* ---------- Normalizare: un singur registru ---------- */

test("normalizare: media.assets primește id și path (basePath + src); toAdventureV2 rămâne idempotent", () => {
  const content = toAdventureV2(base());
  assert.equal(content.media.assets["img-a"].path, "media/test/a.webp");
  assert.equal(content.media.assets["img-a"].id, "img-a");
  assert.equal(toAdventureV2(content), content);
  assert.deepEqual(normalizeMediaRegistry(content), content.media); // a doua normalizare nu schimbă nimic
  assert.equal(joinMediaPath("media/x", "a.webp"), "media/x/a.webp");
  assert.equal(joinMediaPath(undefined, "a.webp"), "a.webp");
});

test("normalizare: audio.tracks devine asset „audio” în același registru (o singură cale pentru audio)", () => {
  const content = toAdventureV2(base());
  assert.deepEqual(
    { type: content.media.assets["snd-vechi"].type, path: content.media.assets["snd-vechi"].path, legacy: content.media.assets["snd-vechi"].legacy },
    { type: "audio", path: "media/vechi/v.mp3", legacy: "audio.tracks" }
  );
  // Fixture-ul existent: toate pistele vechi sunt în registrul unificat.
  const fromFixture = toAdventureV2(fixture);
  for (const id of Object.keys(fixture.audio.tracks)) assert.equal(fromFixture.media.assets[id].type, "audio", id);
  // Aventurile fără media: registru gol, fără erori.
  assert.deepEqual(toAdventureV2(json("../content/adventures/brasov-centrul-vechi.json")).media.assets, {});
  // Consumatorii citesc doar media.assets (nu audio.tracks).
  for (const file of ["view-model.js", "media-ui.js", "play-ui.js", "app.js"]) {
    assert.doesNotMatch(code(`../src/js/${file}`), /\.tracks\b|audio\.basePath/, `${file} nu citește formatul vechi`);
  }
});

test("listMediaPaths: lista completă și deterministă a fișierelor (baza unui pachet offline ulterior)", () => {
  const paths = listMediaPaths(toAdventureV2(demo));
  assert.equal(paths.length, new Set(paths).size);
  assert.ok(paths.every((path) => path.startsWith("media/demo-challenge-media/")));
  // Toate fișierele demo-ului există, în afară de cel lipsă intenționat (misiunea F, rezerva audio).
  const missing = paths.filter((path) => !existsSync(new URL(`../content/adventures/${path}`, import.meta.url)));
  assert.deepEqual(missing, ["media/demo-challenge-media/lipsa-intentionat.wav"]);
});

/* ---------- View-model: media rezolvată, fără răspunsuri ---------- */

test("view-model: blocurile media ajung la UI cu URL-uri rezolvate, texte alternative și transcript", async () => {
  const game = newGame(base());
  game.start();
  const vm = () => buildViewModel({ content: game.content, state: game.getState(), mediaBaseUrl: BASE_URL });

  const [image] = vm().mission.media;
  assert.equal(image.type, "image");
  assert.equal(image.image.url, "https://exemplu.test/outdoor-escape/content/adventures/media/test/a.webp");
  assert.equal(image.image.alt, "Imaginea A, fictivă.");
  assert.equal(image.fallbackText, "Imaginea A, fictivă.");
  assert.equal(image.viewable, true);

  await game.submitAnswer("cerc");
  game.next();
  {
    const [compare] = vm().mission.media;
    assert.equal(compare.type, "compare");
    assert.equal(compare.mode, "slider");
    assert.equal(compare.after.caption, "Legenda B");
    assert.equal(compare.after.credit, "Test");
    assert.equal(vm().puzzle.inputMode, "numeric");

    await game.submitAnswer("12");
    game.next();
    const [own, legacy] = vm().mission.media;
    assert.equal(own.transcript, "Transcript propriu.");
    assert.equal(own.audio.url, "https://exemplu.test/outdoor-escape/content/adventures/media/test/a.m4a");
    assert.equal(legacy.transcript, "Transcript din mesaj."); // transcriptMessage → narrator.messages
    assert.equal(legacy.showTranscript, "expanded");
    assert.equal(legacy.audio.url, "https://exemplu.test/outdoor-escape/content/adventures/media/vechi/v.mp3");
    assert.equal(legacy.viewable, false);
    assert.equal(vm().puzzle.inputMode, "text");
  }
});

test("view-model: fără mediaBaseUrl, căile rămân relative la fișierul aventurii; misiunile fără media au []", () => {
  const content = toAdventureV2(base());
  assert.equal(resolveMissionMedia(content, content.missions[0].media)[0].image.url, "media/test/a.webp");
  assert.equal(resolveMediaUrl("media/a.webp", "http://localhost:8000/content/adventures/x.json"), "http://localhost:8000/content/adventures/media/a.webp");
  const game = newGame(json("../content/adventures/demo-vertical-slice.json"));
  game.start();
  assert.deepEqual(buildViewModel({ content: game.content, state: game.getState() }).mission.media, []);
});

test("view-model: cheia de răspuns nu ajunge în model (aventura de test: răspunsurile nu apar în niciun text)", async () => {
  // În aventura de test, răspunsurile („cerc”, „12”, „ecoul”) nu apar în texte sau media:
  // dacă ar apărea în model, ar fi o scurgere a cheii de răspuns.
  const source = base();
  const answers = source.missions.map((m) => m.answer);
  const game = newGame(source);
  game.start();
  for (let step = 0; step < 3; step += 1) {
    const vm = buildViewModel({ content: game.content, state: game.getState(), mediaBaseUrl: BASE_URL });
    const text = JSON.stringify(vm).toLowerCase();
    for (const answer of answers) {
      // Un răspuns numeric se caută ca valoare JSON întreagă („"12"”), ca să nu fie confundat cu cifre din alte texte.
      const needle = /^\d+$/.test(answer) ? `"${answer}"` : answer;
      assert.ok(!text.includes(needle), `răspunsul „${answer}” apare în model`);
    }
    assert.ok(!/"answer"\s*:/.test(text), "câmpul answer apare în model");
    await game.submitAnswer(answers[step]);
    game.next();
  }
});

test("view-model: demo-ul complet — niciun câmp answer în model, la nicio misiune", async () => {
  // În demo, transcriptul unei provocări audio conține intenționat cuvântul căutat (sunetul ESTE indiciul):
  // asta este conținut, nu o scurgere. Se verifică deci absența cheii de răspuns.
  const content = toAdventureV2(demo);
  const game = newGame(demo);
  game.start();
  const seen = [];
  for (let step = 0; step < 20 && game.getState().status === "playing"; step += 1) {
    const vm = buildViewModel({ content: game.content, state: game.getState(), mediaBaseUrl: BASE_URL });
    seen.push(vm);
    assert.ok(!/"answer"\s*:/.test(JSON.stringify(vm)), "câmpul answer apare în model");
    const mission = content.missions.find((m) => m.id === vm.mission.id);
    if (mission.type === "location") game.confirmArrival(mission.locationId);
    else await game.submitAnswer(mission.answer);
    game.next();
  }
  assert.equal(game.getState().status, "completed");
  assert.ok(seen.some((vm) => vm.mission.media.some((b) => b.type === "compare" && b.mode === "toggle")));
});

test("demo complet prin motor: imagine, comparații, sunete, numeric, obiecte, jurnal — fără cod specific", async () => {
  const content = toAdventureV2(demo);
  const game = newGame(demo);
  game.start();
  for (const mission of content.missions) {
    if (mission.type === "location") game.confirmArrival(mission.locationId);
    else assert.deepEqual(await game.submitAnswer(mission.answer), { result: "correct" }, mission.id);
    game.next();
  }
  const summary = game.getProgressSummary();
  assert.equal(game.getState().status, "completed");
  assert.deepEqual(summary.collectedItems, ["fragment-a", "fragment-b"]);
  assert.equal(game.getSummary().score, game.getSummary().maxScore);
  const story = buildViewModel({ content: game.content, state: game.getState() }).story;
  assert.equal(story.epilogue, content.narrator.messages.final.text);
});

test("răspunsul numeric folosește aceeași verificare (answers.js): textul cifrelor, normalizat", async () => {
  const game = newGame(base());
  game.start();
  await game.submitAnswer("cerc");
  game.next();
  assert.deepEqual(await game.submitAnswer(" 12 "), { result: "correct" });
});

/* ---------- play-ui: plasarea media și viewer-ul (strat Back) ---------- */

async function demoAt(missionId) {
  const content = toAdventureV2(demo);
  const game = newGame(demo);
  game.start();
  for (const mission of content.missions) {
    if (mission.id === missionId) break;
    if (mission.type === "location") game.confirmArrival(mission.locationId);
    else await game.submitAnswer(mission.answer);
    game.next();
  }
  return game;
}

const ui = (game, options = {}) => describePlayUi(buildViewModel({ content: game.content, state: game.getState() }), options);

test("play-ui: media stă în pagină pentru misiunile „location” și în panoul puzzle-ului pentru cele cu răspuns", async () => {
  const travel = await demoAt("m-sosire-poarta");
  assert.equal(ui(travel).media.placement, "page");
  assert.equal(ui(travel).media.visible, true);
  const puzzle = await demoAt("m-b-stele");
  assert.equal(ui(puzzle).media.placement, "puzzle");
  assert.equal(ui(puzzle).media.blocks[0].type, "compare");
  assert.equal(ui(puzzle).puzzle.inputMode, "numeric");
  // Overlay închis cu „Închide”: media puzzle-ului nu este vizibilă, iar viewer-ul nu se poate deschide.
  const dismissed = ui(puzzle, { dismissedMissionId: "m-b-stele", viewerKey: "media-0" });
  assert.equal(dismissed.media.visible, false);
  assert.equal(dismissed.viewer.open, false);
});

test("play-ui: viewer-ul se deschide doar pentru blocuri vizuale și este stratul de sus (Back îl închide primul)", async () => {
  const game = await demoAt("m-e-document");
  const open = ui(game, { viewerKey: "media-0" });
  assert.equal(open.viewer.open, true);
  assert.equal(open.viewer.block.type, "image");
  assert.deepEqual(openLayers(open), [Layer.PUZZLE, Layer.VIEWER]);
  assert.deepEqual(planBack(openLayers(open), 1), { close: [Layer.VIEWER] });
  const withHint = ui(game, { viewerKey: "media-0", hintConfirmMissionId: "m-e-document" });
  assert.deepEqual(openLayers(withHint), [Layer.PUZZLE, Layer.VIEWER]); // misiunea E nu are indicii
  assert.equal(ui(game, { viewerKey: "media-9" }).viewer.open, false); // bloc inexistent

  const audio = await demoAt("m-d-ecou");
  assert.equal(ui(audio, { viewerKey: "media-0" }).viewer.open, false); // sunetul nu se deschide în viewer

  const travel = await demoAt("m-sosire-poarta");
  assert.deepEqual(openLayers(ui(travel, { viewerKey: "media-0" })), [Layer.VIEWER]); // fără overlay
});

test("play-ui: viewer + confirmarea indiciului — ordinea straturilor: puzzle, confirmare, viewer", async () => {
  const game = await demoAt("m-a-panou");
  const layers = openLayers(ui(game, { viewerKey: "media-0", hintConfirmMissionId: "m-a-panou" }));
  assert.deepEqual(layers, [Layer.PUZZLE, Layer.HINT_CONFIRM, Layer.VIEWER]);
  assert.deepEqual(planBack(layers, 0), { close: [Layer.VIEWER, Layer.HINT_CONFIRM, Layer.PUZZLE] });
});

/* ---------- media-ui: funcțiile pure ---------- */

test("media-ui: timp, decupare, etichete neutre, stare, semnătură", () => {
  assert.equal(formatTime(0), "0:00");
  assert.equal(formatTime(75.9), "1:15");
  assert.equal(formatTime(NaN), "--:--");
  assert.equal(compareClip(30), "inset(0 70% 0 0)");
  assert.equal(compareClip(150), "inset(0 0% 0 0)");
  assert.equal(compareClip("x"), "inset(0 50% 0 0)");
  // Etichetele implicite nu presupun „trecut / prezent” (compare este generic).
  assert.deepEqual(compareLabels({}), { before: MEDIA_TEXTS.compareDefaultBefore, after: MEDIA_TEXTS.compareDefaultAfter });
  assert.doesNotMatch(JSON.stringify(compareLabels({})), /atunci|acum|istoric|vechi/i);
  assert.deepEqual(compareLabels({ labels: { before: "1", after: "2" } }), { before: "1", after: "2" });
  assert.equal(audioStatusText(AudioState.LOADING), "Se încarcă…");
  assert.equal(audioStatusText(AudioState.ERROR), "");
  const blocks = resolveMissionMedia(toAdventureV2(base()), base().missions[1].media);
  assert.equal(mediaSignature("m", blocks), mediaSignature("m", blocks));
  assert.notEqual(mediaSignature("m", blocks), mediaSignature("alt", blocks));
  assert.equal(viewerTitle(resolveMissionMedia(toAdventureV2(base()), base().missions[0].media)[0]), "Imaginea A, fictivă.");
});

/* ---------- Interfața (verificări în sursă) ---------- */

const html = read("../src/index.html").replace(/<!--[\s\S]*?-->/g, "");

test("index.html: containerele media și viewer-ul generic (dialog modal, în afara <main>)", () => {
  assert.match(html, /id="mission-media"[^>]*hidden/);
  const panel = html.slice(html.indexOf('id="puzzle-panel"'), html.indexOf('id="answer-form"'));
  assert.ok(panel.includes('id="puzzle-media"'), "media puzzle-ului stă în panou, înaintea formularului");
  const afterMain = html.slice(html.indexOf("</main>"));
  assert.match(afterMain, /id="media-viewer"[^>]*role="dialog"[^>]*aria-modal="true"[^>]*hidden/);
  assert.ok(afterMain.includes('id="btn-viewer-close"'));
  assert.match(html, /id="answer-input"[^>]*inputmode="text"/);
});

test("media-ui.js / media.js: fără innerHTML, fără motor, fără stocare sau GPS", () => {
  for (const file of ["media-ui.js", "media.js"]) {
    const source = code(`../src/js/${file}`);
    for (const token of ["innerHTML", "insertAdjacentHTML", "outerHTML", "game.", "localStorage", "navigator.geolocation", "fetch("]) {
      assert.ok(!source.includes(token), `${file} nu trebuie să conțină „${token}”`);
    }
  }
  assert.doesNotMatch(code("../src/js/media.js"), /\bdocument\.|\bwindow\./); // modul pur (rolul „document” este doar o valoare)
  assert.deepEqual([...code("../src/js/media.js").matchAll(/from\s+"([^"]+)"/g)], []);
});

test("app.js: viewer-ul este un strat Back (închis primul), Escape în aceeași ordine, fără efect în motor", () => {
  const app = code("../src/js/app.js");
  const popstate = /window\.addEventListener\("popstate", \(\) => \{([\s\S]*?)\n  \}\);/.exec(app)[1];
  assert.ok(popstate.indexOf("closeViewer") < popstate.indexOf("cancelHintConfirm"));
  const escape = /document\.addEventListener\("keydown", \(event\) => \{([\s\S]*?)\n  \}\);/.exec(app)[1];
  assert.ok(escape.indexOf("closeViewer") < escape.indexOf("cancelHintConfirm"));
  for (const name of ["openViewer", "closeViewer", "renderViewer"]) {
    const body = new RegExp(`function ${name}\\([^)]*\\) \\{([\\s\\S]*?)\\n  \\}`).exec(app)[1];
    assert.doesNotMatch(body, /game\.(?!content)|storage|localStorage/, `${name} nu atinge motorul sau stocarea`);
  }
});

/* ---------- Neutralitate: fără aventură anume, fără Walk / Bike ---------- */

test("modulele noi și cele atinse nu conțin aventuri, personaje sau moduri de deplasare", () => {
  for (const file of ["media.js", "media-ui.js", "view-model.js", "play-ui.js", "schema.js", "game.js", "events.js", "answers.js", "app.js"]) {
    const source = code(`../src/js/${file}`);
    // app.js alege doar id-ul demo-ului implicit (aceeași excepție ca testul existent de neutralitate).
    const checked = file === "app.js" ? source.replace('"brasov-centrul-vechi"', '""') : source;
    assert.doesNotMatch(checked, /t[aâ]mpa|semnalul|\bmara\b|bra[sș]ov/i, `${file}: conținut de aventură`);
    assert.doesNotMatch(source, /\bwalk\b|\bbike\b|bicicl|pieton/i, `${file}: ramură Walk / Bike`);
  }
  // Motorul nu știe de media: nimic nou în game.js.
  assert.doesNotMatch(code("../src/js/game.js"), /media|compare|inputMode/);
});
