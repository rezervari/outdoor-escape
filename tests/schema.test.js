import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateAdventureV2, upgradeV1ToV2, toAdventureV2, MISSION_TYPES, TRACKS } from "../src/js/schema.js";
import { validateAdventure, loadAdventure } from "../src/js/content.js";
import { DEFAULT_SETTINGS, resolveSettings } from "../src/js/defaults.js";
import { EVENT_TYPES } from "../src/js/events.js";

const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const fixture = await readJson("./fixtures/adventure-v2-demo.json");
const demoV1 = await readJson("../content/adventures/brasov-centrul-vechi.json");
const copy = () => structuredClone(fixture);

function expectInvalid(mutate, pattern) {
  const adventure = copy();
  mutate(adventure);
  const { valid, errors } = validateAdventureV2(adventure);
  assert.equal(valid, false, `ar trebui respinsă: ${mutate}`);
  if (pattern) assert.ok(errors.some((e) => pattern.test(e)), `nicio eroare nu corespunde ${pattern}: ${errors.join(" | ")}`);
}

test("V2: fixture-ul fictiv este valid și acoperă toate secțiunile", () => {
  const { valid, errors } = validateAdventureV2(fixture);
  assert.deepEqual(errors, []);
  assert.equal(valid, true);
  for (const key of ["meta", "settings", "narrator", "audio", "locations", "missions", "partners", "secrets", "events", "finale"]) {
    assert.ok(fixture[key], `lipsește ${key}`);
  }
  assert.deepEqual(new Set(fixture.missions.map((m) => m.track ?? "main")), new Set(TRACKS));
});

test("V2: validateAdventure (content.js) alege validatorul după schemaVersion", () => {
  assert.equal(validateAdventure(fixture).valid, true);
  assert.equal(validateAdventure(demoV1).valid, true);
  assert.equal(validateAdventure({ ...copy(), schemaVersion: 3 }).valid, false);
});

test("V2: structuri invalide", () => {
  expectInvalid((a) => delete a.meta, /meta lipsește/);
  expectInvalid((a) => delete a.meta.title, /meta\.title/);
  expectInvalid((a) => (a.id = "Aventura Mea"), /id/);
  expectInvalid((a) => (a.missions = []), /missions/);
  expectInvalid((a) => (a.missions[1].type = "quiz"), /type necunoscut/);
  expectInvalid((a) => (a.missions[1].track = "side"), /track necunoscut/);
  expectInvalid((a) => (a.missions[1].points = -5), /points/);
  expectInvalid((a) => delete a.missions[1].answer, /answer lipsește/);
  expectInvalid((a) => (a.missions[0].answer = "x"), /„location” nu are answer/);
  expectInvalid((a) => delete a.missions[3].timeLimitSeconds, /timeLimitSeconds/);
  expectInvalid((a) => (a.missions[1].hints = [{ text: "" }]), /hints\[0\]/);
  expectInvalid((a) => (a.missions[1].id = a.missions[0].id), /duplicat/);
  expectInvalid((a) => (a.missions[4].initialStatus = "pending"), /secretă trebuie să înceapă „locked”/);
  expectInvalid((a) => (a.missions[0].initialStatus = "locked"), /Prima misiune principală/);
  expectInvalid((a) => (a.missions.forEach((m) => (m.track = "bonus"))), /cel puțin o misiune cu track „main”/);
  expectInvalid((a) => (a.locations[0].coordinates = { lat: 91, lng: 0 }), /coordinates/);
  expectInvalid((a) => (a.locations[0].coordinates = { lat: "45", lng: 25 }), /coordinates/);
  expectInvalid((a) => (a.locations[0].radius = 0), /radius/);
  expectInvalid((a) => (a.locations[0].radius = 200), /mai mică decât nearDistance/);
  expectInvalid((a) => (a.locations[0].type = "cafe"), /type necunoscut/);
  expectInvalid((a) => (a.locations[2].initialStatus = "unlocked"), /ascunsă/);
  expectInvalid((a) => (a.settings.gps.maxAccuracy = -1), /maxAccuracy/);
  expectInvalid((a) => (a.settings.progression = "free"), /progression/);
  expectInvalid((a) => (a.settings.events = { maxChainDepth: 100 }), /maxChainDepth/);
  expectInvalid((a) => (a.partners[0].verification.method = "telepathy"), /verification\.method/);
  expectInvalid((a) => delete a.partners[0].category, /category/);
  expectInvalid((a) => (a.partners[0].validity = { from: "2026-12-31", until: "2026-01-01" }), /validity/);
  expectInvalid((a) => (a.audio.tracks["voice-intro"].src = "../secret.mp3"), /src/);
  expectInvalid((a) => (a.audio.tracks["voice-intro"].src = "https://example.com/a.mp3"), /src/);
  expectInvalid((a) => delete a.audio.tracks["voice-intro"].transcriptMessage, /text alternativ/);
  expectInvalid((a) => (a.narrator.messages.intro.text = ""), /text lipsește/);
  expectInvalid((a) => (a.events[0].on = "player_teleported"), /on necunoscut/);
  expectInvalid((a) => (a.events[0].do = []), /cel puțin o acțiune/);
  expectInvalid((a) => (a.events[0].do[0].action = "run_script"), /acțiune necunoscută/);
  expectInvalid((a) => (a.events[2].where = { city: "x" }), /filtru necunoscut/);
  expectInvalid((a) => (a.events[0].once = "da"), /once/);
  expectInvalid((a) => (a.events[1].id = a.events[0].id), /duplicat/);
});

test("V2: referințe invalide între entități", () => {
  expectInvalid((a) => (a.missions[1].locationId = "loc-inexistenta"), /missions\[1\]\.locationId: referință inexistentă/);
  expectInvalid((a) => (a.missions[2].partnerId = "partener-inexistent"), /partnerId: referință inexistentă/);
  expectInvalid((a) => (a.partners[0].locationId = "nicaieri"), /partners\[0\]\.locationId/);
  expectInvalid((a) => (a.partners[0].missionId = "m-ceas"), /legătura este în ambele sensuri/);
  expectInvalid((a) => (a.partners[0].missionId = "m-lipsa"), /partners\[0\]\.missionId: referință inexistentă/);
  expectInvalid((a) => (a.secrets[0].locationId = "nicaieri"), /secrets\[0\]\.locationId/);
  expectInvalid((a) => (a.narrator.messages.intro.audio = "track-lipsa"), /narrator\.messages\.intro\.audio/);
  expectInvalid((a) => (a.audio.tracks["voice-intro"].transcriptMessage = "mesaj-lipsa"), /transcriptMessage/);
  expectInvalid((a) => (a.events[2].where.locationId = "nicaieri"), /where\.locationId/);
  expectInvalid((a) => (a.events[0].do[0].messageId = "mesaj-lipsa"), /do\[0\]\.messageId/);
  expectInvalid((a) => (a.events[4].do[1] = { action: "unlock_mission", missionId: "m-lipsa" }), /missionId: referință inexistentă/);
  expectInvalid((a) => (a.events[4].do[1] = { action: "unlock_mission" }), /missionId lipsește/);
  expectInvalid((a) => (a.events[5].do[0] = { action: "discover_secret", secretId: "s-lipsa" }), /secretId/);
  expectInvalid((a) => (a.events[0].do[0] = { action: "play_audio", trackId: "track-lipsa" }), /trackId/);
  expectInvalid((a) => (a.events[0].do[0] = { action: "award_points", points: 0 }), /points trebuie să fie un întreg pozitiv/);
  expectInvalid((a) => (a.events[1].do.push({ action: "award_points", points: 10 })), /once: false/);
  expectInvalid((a) => (a.finale.missionId = "m-lipsa"), /finale\.missionId/);
  expectInvalid((a) => (a.finale.missionId = "m-rapid"), /misiune principală/);
});

test("V2: câmpurile necunoscute sunt permise (extensibilitate)", () => {
  const adventure = copy();
  adventure.meta.season = "iarna-2027";
  adventure.locations[0].media = { image: "piata.jpg" };
  adventure.missions[1].acceptedAnswers = ["7.15"];
  adventure.partners[0].contact = { phone: "—" };
  assert.deepEqual(validateAdventureV2(adventure).errors, []);
});

test("V2: vocabularul acoperă tipurile de misiuni și evenimentele cerute", () => {
  for (const type of ["riddle", "observation", "location", "timed", "partner", "code", "secret"]) assert.ok(MISSION_TYPES.includes(type), type);
  for (const type of ["mission_started", "mission_completed", "mission_failed", "player_near_location", "player_arrived",
    "player_left_area", "hint_requested", "secret_discovered", "partner_unlocked", "finale_started", "adventure_completed"]) {
    assert.ok(EVENT_TYPES.includes(type), type);
  }
});

test("V1 → V2: conversie la încărcare, fără a modifica obiectul original", () => {
  const before = structuredClone(demoV1);
  const upgraded = upgradeV1ToV2(demoV1);
  assert.deepEqual(demoV1, before);
  assert.equal(upgraded.schemaVersion, 2);
  assert.equal(upgraded.upgradedFrom, 1);
  assert.equal(upgraded.id, demoV1.id);
  assert.equal(upgraded.meta.title, demoV1.title);
  assert.equal(upgraded.meta.city, demoV1.city);
  assert.equal(upgraded.meta.estimatedTime, demoV1.estimatedTime);
  assert.equal(upgraded.missions.length, 3);
  const [first, second] = upgraded.missions;
  assert.equal(first.type, "riddle");
  assert.equal(first.track, "main");
  assert.equal(first.briefing, demoV1.challenges[0].description);
  assert.deepEqual(first.hints, [{ text: demoV1.challenges[0].hint }]);
  assert.equal(first.answer, demoV1.challenges[0].answer);
  assert.equal(first.initialStatus, "pending");
  assert.equal(second.initialStatus, "locked");
  // Rezultatul conversiei este o aventură V2 validă.
  assert.deepEqual(validateAdventureV2(upgraded).errors, []);
});

test("toAdventureV2: normalizare idempotentă, cu valori implicite", () => {
  const v2 = toAdventureV2(demoV1);
  assert.equal(toAdventureV2(v2), v2);
  assert.deepEqual(v2.locations, []);
  assert.deepEqual(v2.events, []);
  assert.deepEqual(v2.settings, resolveSettings({ progression: "linear" }));

  const fromFixture = toAdventureV2(fixture);
  assert.equal(fromFixture.events.every((rule) => typeof rule.once === "boolean"), true);
  assert.equal(fromFixture.events.find((r) => r.id === "ev-raspuns-gresit").once, false);
  assert.equal(fromFixture.missions.find((m) => m.id === "m-rapid").initialStatus, "locked");
  assert.equal(fromFixture.partners[0].initialStatus, "locked");
});

test("valori implicite GPS: centrale și suprascrise per aventură", () => {
  assert.equal(DEFAULT_SETTINGS.gps.defaultRadius, 40);
  assert.equal(DEFAULT_SETTINGS.gps.nearDistance, 150);
  assert.equal(DEFAULT_SETTINGS.gps.maxAccuracy, 60);
  assert.equal(DEFAULT_SETTINGS.gps.exitMargin, 20);
  assert.equal(DEFAULT_SETTINGS.gps.allowManualConfirmation, true);
  assert.equal(Object.isFrozen(DEFAULT_SETTINGS.gps), true);

  const custom = resolveSettings({ gps: { maxAccuracy: 30 } });
  assert.equal(custom.gps.maxAccuracy, 30);
  assert.equal(custom.gps.defaultRadius, 40); // restul rămân implicite
  assert.equal(resolveSettings(undefined).gps.nearDistance, 150);
});

test("loadAdventure: încarcă și validează o aventură V2", async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => copy() });
  const base = "http://localhost:8000/src/js/content.js";
  const adventure = await loadAdventure(fixture.id, { fetchImpl, baseUrl: base });
  assert.equal(adventure.schemaVersion, 2);

  const broken = copy();
  broken.missions[1].locationId = "nicaieri";
  const badFetch = async () => ({ ok: true, status: 200, json: async () => broken });
  await assert.rejects(loadAdventure(fixture.id, { fetchImpl: badFetch, baseUrl: base }), (error) => {
    assert.equal(error.name, "AdventureLoadError");
    assert.ok(error.details.some((d) => /referință inexistentă/.test(d)));
    return true;
  });
});
