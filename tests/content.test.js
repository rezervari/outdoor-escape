import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateAdventure, loadAdventure, adventureUrl, isValidId, AdventureLoadError } from "../src/js/content.js";

const demoPath = new URL("../content/adventures/brasov-centrul-vechi.json", import.meta.url);
const demo = JSON.parse(await readFile(demoPath, "utf8"));

function valid() {
  return structuredClone(demo);
}

test("aventura demo din repository este validă", () => {
  const { valid: ok, errors } = validateAdventure(demo);
  assert.deepEqual(errors, []);
  assert.equal(ok, true);
  assert.equal(demo.id, "brasov-centrul-vechi");
  assert.equal(demo.challenges.length, 3);
  assert.equal(demo.demo, true);
});

test("validateAdventure: respinge structuri greșite", () => {
  assert.equal(validateAdventure(null).valid, false);
  assert.equal(validateAdventure([]).valid, false);

  const cases = [
    (a) => delete a.id,
    (a) => (a.id = "Brasov Vechi"),
    (a) => (a.id = "../secret"),
    (a) => delete a.title,
    (a) => (a.challenges = []),
    (a) => delete a.challenges,
    (a) => (a.challenges[1].id = a.challenges[0].id),
    (a) => delete a.challenges[0].answer,
    (a) => (a.challenges[0].answer = "   "),
    (a) => (a.challenges[0].points = -1),
    (a) => (a.challenges[0].points = "100"),
    (a) => (a.challenges[0].hint = 5),
    (a) => (a.estimatedTime = "60"),
    (a) => (a.schemaVersion = 99),
  ];
  for (const mutate of cases) {
    const adventure = valid();
    mutate(adventure);
    const result = validateAdventure(adventure);
    assert.equal(result.valid, false, mutate.toString());
    assert.ok(result.errors.length > 0);
  }
});

test("validateAdventure: permite câmpuri noi (extensibilitate)", () => {
  const adventure = valid();
  adventure.timeLimit = 90;
  adventure.challenges[0].coordinates = { lat: 45.64, lng: 25.59, radius: 30 };
  adventure.challenges[0].type = "text";
  assert.equal(validateAdventure(adventure).valid, true);
});

test("adventureUrl: cale relativă, compatibilă cu /outdoor-escape/src/", () => {
  const base = "https://rezervari.github.io/outdoor-escape/src/js/content.js";
  assert.equal(adventureUrl("brasov-centrul-vechi", base),
    "https://rezervari.github.io/outdoor-escape/content/adventures/brasov-centrul-vechi.json");
  assert.equal(adventureUrl("x", "http://localhost:8000/src/js/content.js"),
    "http://localhost:8000/content/adventures/x.json");
  assert.equal(isValidId("brasov-centrul-vechi"), true);
  assert.equal(isValidId("../x"), false);
});

function fakeFetch(body, { status = 200, throws = false } = {}) {
  return async () => {
    if (throws) throw new TypeError("Failed to fetch");
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => (typeof body === "string" ? JSON.parse(body) : body),
    };
  };
}

const base = "http://localhost:8000/src/js/content.js";

test("loadAdventure: încarcă aventura validă", async () => {
  const adventure = await loadAdventure("brasov-centrul-vechi", { fetchImpl: fakeFetch(demo), baseUrl: base });
  assert.equal(adventure.title, demo.title);
});

test("loadAdventure: erori tratate cu mesaje clare", async () => {
  const expectError = (promise) => assert.rejects(promise, (error) => {
    assert.ok(error instanceof AdventureLoadError);
    assert.ok(error.message.length > 0);
    return true;
  });
  await expectError(loadAdventure("../x", { fetchImpl: fakeFetch(demo), baseUrl: base }));
  await expectError(loadAdventure("brasov-centrul-vechi", { fetchImpl: fakeFetch(null, { throws: true }), baseUrl: base }));
  await expectError(loadAdventure("brasov-centrul-vechi", { fetchImpl: fakeFetch(null, { status: 404 }), baseUrl: base }));
  await expectError(loadAdventure("brasov-centrul-vechi", { fetchImpl: fakeFetch("{nu e json"), baseUrl: base }));
  await expectError(loadAdventure("brasov-centrul-vechi", { fetchImpl: fakeFetch({ id: "brasov-centrul-vechi" }), baseUrl: base }));
  await expectError(loadAdventure("alt-id", { fetchImpl: fakeFetch(demo), baseUrl: base })); // id diferit
});
