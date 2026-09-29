import { test } from "node:test";
import assert from "node:assert/strict";
import { createStorage, storageKey } from "../src/js/storage.js";

function memoryBackend() {
  const map = new Map();
  return {
    map,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: (key) => map.delete(key),
  };
}

test("storageKey: prefixul proiectului (D-035)", () => {
  assert.equal(storageKey("brasov-centrul-vechi"), "outdoor-escape:game:brasov-centrul-vechi");
});

test("saveGame / loadGame / resetGame", () => {
  const backend = memoryBackend();
  const storage = createStorage(backend);
  const state = { status: "playing", currentIndex: 1, score: 100, challenges: { c1: { status: "solved" } } };

  assert.equal(storage.loadGame("a"), null);
  assert.equal(storage.saveGame("a", state), true);
  assert.deepEqual(storage.loadGame("a"), state);
  assert.equal(storage.loadGame("b"), null); // aventurile sunt separate

  assert.equal(storage.resetGame("a"), true);
  assert.equal(storage.loadGame("a"), null);
});

test("date corupte → null, fără excepție", () => {
  const backend = memoryBackend();
  backend.setItem(storageKey("a"), "{corupt");
  const storage = createStorage(backend);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(storage.loadGame("a"), null);
  } finally {
    console.warn = originalWarn;
  }
});

test("localStorage indisponibil sau care aruncă excepții → jocul continuă", () => {
  const none = createStorage(null);
  assert.equal(none.available, false);
  assert.equal(none.saveGame("a", {}), false);
  assert.equal(none.loadGame("a"), null);
  assert.equal(none.resetGame("a"), false);

  const failing = {
    getItem() { throw new Error("SecurityError"); },
    setItem() { throw new Error("QuotaExceededError"); },
    removeItem() { throw new Error("SecurityError"); },
  };
  const storage = createStorage(failing);
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(storage.saveGame("a", {}), false);
    assert.equal(storage.loadGame("a"), null);
    assert.equal(storage.resetGame("a"), false);
  } finally {
    console.warn = originalWarn;
  }
});
