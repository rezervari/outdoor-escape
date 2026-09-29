import { test } from "node:test";
import assert from "node:assert/strict";
import { matchesFilter, selectRules, processEvents, MAX_EVENTS_PER_DISPATCH } from "../src/js/events.js";

test("matchesFilter: egalitate simplă pe toate cheile din `where`", () => {
  const event = { type: "player_arrived", locationId: "loc-a", source: "gps" };
  assert.equal(matchesFilter(undefined, event), true);
  assert.equal(matchesFilter({}, event), true);
  assert.equal(matchesFilter({ locationId: "loc-a" }, event), true);
  assert.equal(matchesFilter({ locationId: "loc-b" }, event), false);
  assert.equal(matchesFilter({ locationId: "loc-a", missionId: "m-1" }, event), false); // toate cheile
});

test("selectRules: tipul evenimentului, filtrul și `once`", () => {
  const rules = [
    { id: "r1", on: "mission_completed", where: { missionId: "m-1" }, once: true, do: [] },
    { id: "r2", on: "mission_completed", once: true, do: [] },
    { id: "r3", on: "mission_completed", where: { missionId: "m-2" }, do: [] }, // once implicit
    { id: "r4", on: "hint_requested", once: false, do: [] },
  ];
  const event = { type: "mission_completed", missionId: "m-1" };
  assert.deepEqual(selectRules(rules, event).map((r) => r.id), ["r1", "r2"]);
  assert.deepEqual(selectRules(rules, event, { r1: 1 }).map((r) => r.id), ["r2"]); // r1 a rulat deja
  assert.deepEqual(selectRules(rules, { type: "mission_completed", missionId: "m-2" }, { r3: 1 }).map((r) => r.id), ["r2"]);
  // once: false → rulează din nou.
  assert.deepEqual(selectRules(rules, { type: "hint_requested" }, { r4: 1 }).map((r) => r.id), ["r4"]);
});

test("processEvents: acțiuni aplicate în ordine, cu evenimentul declanșator", () => {
  const applied = [];
  const rules = [
    { id: "r1", on: "adventure_started", do: [{ action: "show_message", messageId: "intro" }, { action: "unlock_mission", missionId: "m-2" }] },
  ];
  const result = processEvents([{ type: "adventure_started" }], {
    rules,
    now: () => 42,
    applyAction: (action, { rule, event }) => {
      applied.push([rule.id, event.type, action.action]);
      return [];
    },
  });
  assert.deepEqual(applied, [["r1", "adventure_started", "show_message"], ["r1", "adventure_started", "unlock_mission"]]);
  assert.deepEqual(result.fired, { r1: 42 });
  assert.equal(result.truncated, false);
  assert.deepEqual(result.processed.map((e) => e.type), ["adventure_started"]);
});

test("processEvents: reacții în lanț și evenimente duplicate în același dispatch", () => {
  // r1: mission_completed(m-1) → complete m-2 ; r2: mission_completed(m-2) → mesaj.
  // r3 (once) ascultă orice mission_completed: trebuie să ruleze o singură dată.
  const completed = new Set(["m-1"]);
  const rules = [
    { id: "r1", on: "mission_completed", where: { missionId: "m-1" }, do: [{ action: "complete_mission", missionId: "m-2" }] },
    { id: "r2", on: "mission_completed", where: { missionId: "m-2" }, do: [{ action: "show_message", messageId: "gata" }] },
    { id: "r3", on: "mission_completed", do: [{ action: "show_message", messageId: "o-singura-data" }] },
  ];
  const messages = [];
  const result = processEvents([{ type: "mission_completed", missionId: "m-1" }], {
    rules,
    applyAction: (action) => {
      if (action.action === "show_message") messages.push(action.messageId);
      if (action.action === "complete_mission" && !completed.has(action.missionId)) {
        completed.add(action.missionId);
        return [{ type: "mission_completed", missionId: action.missionId }];
      }
      return []; // idempotent: a doua completare nu emite nimic
    },
  });
  assert.deepEqual(messages, ["o-singura-data", "gata"]);
  assert.deepEqual(Object.keys(result.fired).sort(), ["r1", "r2", "r3"]);
  assert.equal(result.processed.length, 2);
});

test("processEvents: limita lanțurilor oprește reacțiile, nu înregistrarea evenimentelor", () => {
  // Lanț: m-0 → m-1 → m-2 → … (fiecare regulă o completează pe următoarea).
  const rules = Array.from({ length: 10 }, (_, i) => ({
    id: `r${i}`, on: "mission_completed", where: { missionId: `m-${i}` }, do: [{ action: "complete_mission", missionId: `m-${i + 1}` }],
  }));
  const completed = [];
  const apply = (action) => {
    completed.push(action.missionId);
    return [{ type: "mission_completed", missionId: action.missionId }];
  };
  const result = processEvents([{ type: "mission_completed", missionId: "m-0" }], { rules, maxChainDepth: 3, applyAction: apply });
  assert.deepEqual(completed, ["m-1", "m-2", "m-3"]); // 3 niveluri de reguli
  assert.equal(result.truncated, true);
  assert.deepEqual(Object.keys(result.fired), ["r0", "r1", "r2"]);
  assert.deepEqual(result.processed.map((e) => e.missionId), ["m-0", "m-1", "m-2", "m-3"]);

  const full = processEvents([{ type: "mission_completed", missionId: "m-0" }], { rules, maxChainDepth: 20, applyAction: () => [] });
  assert.equal(full.truncated, false);
});

test("processEvents: o buclă cu reguli repetabile este oprită de limită", () => {
  // Două reguli once: false care se declanșează reciproc la nesfârșit.
  const rules = [
    { id: "ping", on: "hint_requested", once: false, do: [{ action: "echo" }] },
  ];
  let calls = 0;
  const result = processEvents([{ type: "hint_requested" }], {
    rules,
    maxChainDepth: 5,
    applyAction: () => {
      calls += 1;
      return [{ type: "hint_requested" }];
    },
  });
  assert.equal(calls, 5);
  assert.equal(result.truncated, true);

  // Chiar și cu o limită de adâncime mare, plafonul absolut oprește procesarea.
  const flood = processEvents([{ type: "hint_requested" }], {
    rules,
    maxChainDepth: 10_000,
    applyAction: () => [{ type: "hint_requested" }, { type: "hint_requested" }],
  });
  assert.equal(flood.truncated, true);
  assert.equal(flood.processed.length, MAX_EVENTS_PER_DISPATCH);
});
