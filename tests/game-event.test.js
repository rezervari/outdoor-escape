/*
 * M1 — GameEvent (D-082, D-083, D-085): forma canonică { type, payload, seq, at, cause? }
 * a evenimentelor procesate de motor. Se verifică contractul și comportamentul lui
 * processEvents (ordine, once, maxChainDepth, lanțuri), nu detalii interne.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createGameEvent, processEvents, EVENT_TYPES, MAX_EVENTS_PER_DISPATCH } from "../src/js/events.js";

const meta = { seq: 1, at: 1000 };

/* ---------- createGameEvent: contractul ---------- */

test("createGameEvent: type + payload + seq + at; obiect înghețat", () => {
  const event = createGameEvent("mission_completed", { missionId: "m-1", locationId: "loc-a" }, meta);
  assert.deepEqual(event, { type: "mission_completed", payload: { missionId: "m-1", locationId: "loc-a" }, seq: 1, at: 1000 });
  assert.ok(Object.isFrozen(event));
  assert.ok(Object.isFrozen(event.payload));
});

test("createGameEvent: doar vocabularul existent de evenimente (D-083)", () => {
  for (const type of EVENT_TYPES) assert.equal(createGameEvent(type, {}, meta).type, type);
  for (const type of ["MISSION_COMPLETED", "PLAYER_ARRIVED", "game_started", "", undefined]) {
    assert.throws(() => createGameEvent(type, {}, meta), /tip necunoscut/);
  }
});

test("createGameEvent: seq este un întreg ≥ 1", () => {
  assert.equal(createGameEvent("adventure_started", {}, { seq: 123, at: 0 }).seq, 123);
  for (const seq of [0, -1, 1.5, "1", null, undefined]) {
    assert.throws(() => createGameEvent("adventure_started", {}, { seq, at: 0 }), /seq/);
  }
});

test("createGameEvent: at este un moment numeric", () => {
  assert.equal(createGameEvent("adventure_started", {}, { seq: 1, at: 1790000000000 }).at, 1790000000000);
  for (const at of [undefined, null, NaN, Infinity, "2026-10-02"]) {
    assert.throws(() => createGameEvent("adventure_started", {}, { seq: 1, at }), /at/);
  }
});

test("createGameEvent: cause este opțional; când există, este un text nevid", () => {
  assert.equal(Object.hasOwn(createGameEvent("hint_requested", { missionId: "m-1" }, meta), "cause"), false);
  assert.equal(createGameEvent("hint_requested", { missionId: "m-1" }, { ...meta, cause: "request_hint" }).cause, "request_hint");
  for (const cause of ["", 1, null, {}]) {
    assert.throws(() => createGameEvent("hint_requested", { missionId: "m-1" }, { ...meta, cause }), /cause/);
  }
});

test("createGameEvent: payload-ul rămâne intact (aceleași chei și valori; intrarea nu se modifică)", () => {
  const payload = { locationId: "loc-a", source: "gps", distanceMeters: 12.5, accuracyMeters: 8, missionId: undefined };
  const event = createGameEvent("player_arrived", payload, meta);
  assert.deepEqual(event.payload, payload);
  assert.deepEqual(Object.keys(event.payload), Object.keys(payload));
  assert.notEqual(event.payload, payload);
  assert.equal(Object.isFrozen(payload), false);
  assert.throws(() => { event.payload.locationId = "loc-b"; }, TypeError);
});

test("createGameEvent: fără text, HTML, audio, expeditor sau obiecte de interfață (D-082, D-085)", () => {
  for (const key of ["text", "html", "message", "audio", "sender", "senderId", "category", "importance", "actions"]) {
    assert.throws(() => createGameEvent("mission_completed", { missionId: "m-1", [key]: "x" }, meta), /nu aparține/, key);
  }
  // Doar valori simple: fără obiecte (ex. un mesaj), liste, funcții sau noduri de interfață.
  class Element {}
  for (const value of [{ text: "Bravo!" }, ["a"], () => {}, new Element(), new Date(0)]) {
    assert.throws(() => createGameEvent("mission_completed", { missionId: "m-1", extra: value }, meta), /valoare simplă/);
  }
  for (const payload of [null, undefined, "m-1", [], new Element()]) {
    assert.throws(() => createGameEvent("mission_completed", payload, meta), /obiect simplu/);
  }
});

/* ---------- processEvents: GameEvent-uri pentru evenimentele procesate ---------- */

test("processEvents: evenimentele existente se procesează ca înainte; fiecare are un GameEvent, în aceeași ordine", () => {
  const rules = [{ id: "r1", on: "mission_completed", where: { missionId: "m-1" }, do: [{ action: "unlock_location", locationId: "loc-b" }] }];
  const initial = { type: "mission_completed", missionId: "m-1", locationId: "loc-a" };
  const result = processEvents([initial], {
    rules,
    now: () => 42,
    applyAction: () => [{ type: "location_unlocked", locationId: "loc-b" }],
  });
  // Forma internă (citită de reguli) rămâne neschimbată.
  assert.deepEqual(result.processed, [initial, { type: "location_unlocked", locationId: "loc-b" }]);
  assert.deepEqual(initial, { type: "mission_completed", missionId: "m-1", locationId: "loc-a" });
  assert.deepEqual(result.fired, { r1: 42 });
  assert.equal(result.truncated, false);
  assert.deepEqual(result.events, [
    { type: "mission_completed", payload: { missionId: "m-1", locationId: "loc-a" }, seq: 1, at: 42 },
    { type: "location_unlocked", payload: { locationId: "loc-b" }, seq: 2, at: 42 },
  ]);
});

test("processEvents: lanțurile de evenimente funcționează; seq urmează ordinea procesării (lățime întâi)", () => {
  // adventure_started → m-a, m-b ; m-a → m-c. Ordinea: start, m-a, m-b, m-c.
  const rules = [
    { id: "r-start", on: "adventure_started", do: [{ action: "unlock_mission", missionId: "m-a" }, { action: "unlock_mission", missionId: "m-b" }] },
    { id: "r-a", on: "mission_unlocked", where: { missionId: "m-a" }, do: [{ action: "unlock_mission", missionId: "m-c" }] },
  ];
  const apply = (action) => [{ type: "mission_unlocked", missionId: action.missionId }];
  const result = processEvents([{ type: "adventure_started" }], { rules, applyAction: apply });
  assert.deepEqual(Object.keys(result.fired).sort(), ["r-a", "r-start"]);
  assert.deepEqual(
    result.events.map((e) => [e.seq, e.type, e.payload.missionId]),
    [[1, "adventure_started", undefined], [2, "mission_unlocked", "m-a"], [3, "mission_unlocked", "m-b"], [4, "mission_unlocked", "m-c"]]
  );
  assert.deepEqual(result.events[0].payload, {});
});

test("processEvents: seq continuă de la lastSeq (ordinea din runtime, între dispatch-uri)", () => {
  const first = processEvents([{ type: "adventure_started" }, { type: "mission_started", missionId: "m-1" }], { applyAction: () => [] });
  assert.deepEqual(first.events.map((e) => e.seq), [1, 2]);
  const lastSeq = first.events.at(-1).seq;
  const second = processEvents([{ type: "hint_requested", missionId: "m-1", hintIndex: 0 }], { lastSeq, applyAction: () => [] });
  assert.deepEqual(second.events.map((e) => e.seq), [3]);
  assert.deepEqual(second.events[0].payload, { missionId: "m-1", hintIndex: 0 });
});

test("processEvents: at vine din ceasul injectat și nu este după momentul regulilor rulate", () => {
  let tick = 0;
  const rules = [{ id: "r1", on: "adventure_started", do: [{ action: "unlock_mission", missionId: "m-1" }] }];
  const result = processEvents([{ type: "adventure_started" }], {
    rules,
    now: () => (tick += 1000),
    applyAction: () => [{ type: "mission_unlocked", missionId: "m-1" }],
  });
  assert.ok(result.events.every((e) => Number.isFinite(e.at) && e.at <= result.fired.r1));
  assert.ok(result.events.every((e, i) => i === 0 || e.at >= result.events[i - 1].at));
});

test("processEvents: cause este opțional și se aplică tuturor evenimentelor dispatch-ului", () => {
  const rules = [{ id: "r1", on: "player_arrived", do: [{ action: "discover_location", locationId: "loc-a" }] }];
  const apply = () => [{ type: "location_discovered", locationId: "loc-a", source: "event" }];

  const gps = processEvents([{ type: "player_arrived", locationId: "loc-a", source: "gps" }], { rules, cause: "gps_position", applyAction: apply });
  assert.deepEqual(gps.events.map((e) => e.cause), ["gps_position", "gps_position"]);
  // `cause` este metadata; câmpul existent `source` rămâne în payload, neschimbat.
  assert.equal(gps.events[0].payload.source, "gps");

  const plain = processEvents([{ type: "player_arrived", locationId: "loc-a", source: "manual" }], { rules, applyAction: apply });
  assert.equal(plain.events.length, 2);
  assert.ok(plain.events.every((e) => !Object.hasOwn(e, "cause")));
});

test("processEvents: GameEvent-urile nu conțin text sau metadate de interfață", () => {
  const rules = [{ id: "r1", on: "mission_completed", do: [{ action: "show_message", messageId: "bravo" }] }];
  const result = processEvents([{ type: "mission_completed", missionId: "m-1", locationId: "loc-a" }], {
    rules,
    cause: "submit_answer",
    applyAction: () => [],
  });
  for (const event of result.events) {
    assert.deepEqual(Object.keys(event).sort(), ["at", "cause", "payload", "seq", "type"]);
    assert.ok(Object.values(event.payload).every((value) => typeof value !== "object" || value === null));
  }
  // Un eveniment intern care ar purta text de interfață este respins.
  assert.throws(
    () => processEvents([{ type: "mission_completed", missionId: "m-1", text: "Bravo!" }], { applyAction: () => [] }),
    /nu aparține/
  );
});

test("processEvents: `once` funcționează ca înainte (în același dispatch și între dispatch-uri)", () => {
  const rules = [{ id: "r-once", on: "mission_completed", do: [{ action: "show_message", messageId: "x" }] }];
  let calls = 0;
  const apply = () => {
    calls += 1;
    return [];
  };
  const first = processEvents(
    [{ type: "mission_completed", missionId: "m-1" }, { type: "mission_completed", missionId: "m-2" }],
    { rules, now: () => 7, applyAction: apply }
  );
  assert.equal(calls, 1);
  assert.deepEqual(first.fired, { "r-once": 7 });
  assert.equal(first.events.length, 2); // ambele evenimente s-au petrecut

  const again = processEvents([{ type: "mission_completed", missionId: "m-3" }], { rules, alreadyFired: first.fired, applyAction: apply });
  assert.equal(calls, 1);
  assert.deepEqual(again.fired, {});
  assert.equal(again.events.length, 1);
});

test("processEvents: maxChainDepth oprește reacțiile; evenimentul de la limită are tot GameEvent", () => {
  const rules = Array.from({ length: 10 }, (_, i) => ({
    id: `r${i}`, on: "mission_completed", where: { missionId: `m-${i}` }, do: [{ action: "complete_mission", missionId: `m-${i + 1}` }],
  }));
  const apply = (action) => [{ type: "mission_completed", missionId: action.missionId }];
  const result = processEvents([{ type: "mission_completed", missionId: "m-0" }], { rules, maxChainDepth: 3, lastSeq: 10, applyAction: apply });
  assert.equal(result.truncated, true);
  assert.deepEqual(Object.keys(result.fired), ["r0", "r1", "r2"]);
  assert.deepEqual(result.events.map((e) => [e.seq, e.payload.missionId]), [[11, "m-0"], [12, "m-1"], [13, "m-2"], [14, "m-3"]]);

  // Plafonul absolut: GameEvent doar pentru evenimentele procesate efectiv.
  const flood = processEvents([{ type: "hint_requested" }], {
    rules: [{ id: "ping", on: "hint_requested", once: false, do: [{ action: "echo" }] }],
    maxChainDepth: 10_000,
    applyAction: () => [{ type: "hint_requested" }, { type: "hint_requested" }],
  });
  assert.equal(flood.truncated, true);
  assert.equal(flood.events.length, MAX_EVENTS_PER_DISPATCH);
  assert.equal(flood.events.at(-1).seq, MAX_EVENTS_PER_DISPATCH);
});
