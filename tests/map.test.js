// Teste pentru src/js/map.js (M-003.2 — D-047, D-049) cu Leaflet fals injectat:
// fără browser, fără rețea, fără tile server.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

import { createMap, MapError } from "../src/js/map.js";
import { DEFAULT_MAP_TILES, DEFAULT_MAP_VIEW, MAP_LIBRARY_VERSION } from "../src/js/defaults.js";
import { createFakeLeaflet, createFakeElement } from "./helpers/fake-leaflet.js";

function setup(options = {}) {
  const L = createFakeLeaflet(options);
  const container = createFakeElement();
  const map = createMap({ container, tileConfig: DEFAULT_MAP_TILES, leaflet: L });
  return { L, container, map, leafletMap: L.mapInstance };
}

const A = { id: "a", name: "Piața", lat: 45.6420, lng: 25.5890, radius: 40, state: "available", visible: true };
const B = { id: "b", name: "Poarta", lat: 45.6450, lng: 25.5920, radius: 30, state: "available", visible: true };
const LOCKED = { id: "x", name: "Secret", lat: 45.6400, lng: 25.5800, radius: 20, state: "locked", visible: false };
const fix = (lat = 45.6410, lng = 25.5880, accuracy = 12) => ({ lat, lng, accuracy, timestamp: 1 });

const layersOf = (L, kind) => [...L.mapInstance._layers].filter((layer) => layer.kind === kind);

/* ---------- Creare și erori de inițializare ---------- */

test("create: o hartă, un singur tile layer OSM HTTPS cu atribuire, zoom din rotiță dezactivat", () => {
  const { L, leafletMap } = setup();
  assert.equal(L.count("map"), 1);
  assert.equal(L.count("tileLayer"), 1);
  const [url, options] = L.calls.find((c) => c.name === "tileLayer").args;
  assert.equal(url, "https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  assert.match(options.attribution, /OpenStreetMap/);
  assert.match(options.attribution, /openstreetmap\.org\/copyright/);
  assert.equal(leafletMap.options.scrollWheelZoom, false);
  assert.equal(leafletMap.options.attributionControl, true);
  assert.equal(leafletMap.options.zoomControl, true);
  assert.equal(leafletMap.options.maxZoom, 19);
});

/* ---------- Gesturi (M7-C): pointer tactil → un deget derulează pagina, două degete mută harta ---------- */

// Înlocuiește temporar globalThis.matchMedia; `coarse` = rezultatul pentru "(pointer: coarse)".
// Restaurează valoarea inițială (inclusiv absența ei) după apel.
function withMatchMedia(coarse, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, "matchMedia");
  const original = globalThis.matchMedia;
  if (coarse === undefined) delete globalThis.matchMedia;
  else globalThis.matchMedia = (query) => ({ matches: query === "(pointer: coarse)" ? coarse : false, media: query });
  try {
    return fn();
  } finally {
    if (had) globalThis.matchMedia = original;
    else delete globalThis.matchMedia;
  }
}

function assertUnchangedOptions(options) {
  assert.equal(options.touchZoom, true); // nu "center": pan-ul cu două degete rămâne activ
  assert.equal(options.doubleClickZoom, true);
  assert.equal(options.keyboard, true);
  assert.equal(options.zoomControl, true);
  assert.equal(options.attributionControl, true);
  assert.equal(options.scrollWheelZoom, false);
  assert.equal(options.boxZoom, false);
  assert.equal(options.minZoom, DEFAULT_MAP_VIEW.minZoom);
  assert.equal(options.maxZoom, DEFAULT_MAP_TILES.maxZoom);
}

test("gesturi: pointer coarse (touch) → dragging dezactivat, touchZoom și restul neschimbate", () => {
  const { leafletMap } = withMatchMedia(true, () => setup());
  assert.equal(leafletMap.options.dragging, false);
  assertUnchangedOptions(leafletMap.options);
});

test("gesturi: pointer fine (mouse) → dragging activat, restul neschimbat", () => {
  const { leafletMap } = withMatchMedia(false, () => setup());
  assert.equal(leafletMap.options.dragging, true);
  assertUnchangedOptions(leafletMap.options);
});

test("gesturi: fără matchMedia → dragging activat (comportamentul anterior)", () => {
  const { leafletMap } = withMatchMedia(undefined, () => setup());
  assert.equal(leafletMap.options.dragging, true);
  assertUnchangedOptions(leafletMap.options);
});

test("gesturi: matchMedia restaurat după teste", () => {
  const before = { had: Object.prototype.hasOwnProperty.call(globalThis, "matchMedia"), value: globalThis.matchMedia };
  withMatchMedia(true, () => {});
  withMatchMedia(undefined, () => {});
  assert.equal(Object.prototype.hasOwnProperty.call(globalThis, "matchMedia"), before.had);
  assert.equal(globalThis.matchMedia, before.value);
});

test("fallback: Leaflet lipsă → MapError leaflet_unavailable", () => {
  const container = createFakeElement();
  for (const leaflet of [undefined, null, {}, { map() {} }]) {
    assert.throws(() => createMap({ container, tileConfig: DEFAULT_MAP_TILES, leaflet }),
      (e) => e instanceof MapError && e.code === "leaflet_unavailable");
  }
});

test("fallback: container invalid → MapError invalid_container", () => {
  const L = createFakeLeaflet();
  const detached = createFakeElement();
  detached.isConnected = false;
  for (const container of [undefined, null, {}, { nodeType: 3 }, detached]) {
    assert.throws(() => createMap({ container, tileConfig: DEFAULT_MAP_TILES, leaflet: L }),
      (e) => e instanceof MapError && e.code === "invalid_container");
  }
  const busy = createFakeElement();
  createMap({ container: busy, tileConfig: DEFAULT_MAP_TILES, leaflet: L });
  assert.throws(() => createMap({ container: busy, tileConfig: DEFAULT_MAP_TILES, leaflet: L }),
    (e) => e.code === "invalid_container"); // are deja o hartă
});

test("fallback: tileConfig fără atribuire / fără HTTPS → MapError invalid_tile_config", () => {
  const L = createFakeLeaflet();
  for (const tileConfig of [undefined, {}, { urlTemplate: DEFAULT_MAP_TILES.urlTemplate },
    { ...DEFAULT_MAP_TILES, attribution: "  " }, { ...DEFAULT_MAP_TILES, urlTemplate: "http://tile.example/{z}/{x}/{y}.png" }]) {
    assert.throws(() => createMap({ container: createFakeElement(), tileConfig, leaflet: L }),
      (e) => e instanceof MapError && e.code === "invalid_tile_config");
  }
});

/* ---------- Jucătorul ---------- */

test("updatePlayer: valid → punct plin + cerc de acuratețe; fix-uri succesive reutilizează aceleași layere", () => {
  const { L, map } = setup();
  map.updatePlayer(fix(), "valid");
  assert.equal(L.count("circleMarker"), 1);
  assert.equal(L.count("circle"), 1);
  const [marker] = layersOf(L, "circleMarker");
  assert.equal(marker.options.fillColor, "#1a5fb4");
  assert.equal(marker.options.interactive, false);
  assert.equal(marker.element.getAttribute("aria-hidden"), "true");
  const [circle] = layersOf(L, "circle");
  assert.equal(circle.options.radius, 12);

  for (let i = 1; i <= 5; i += 1) map.updatePlayer(fix(45.641 + i * 0.0001), "valid");
  assert.equal(L.count("circleMarker"), 1, "markerul nu este recreat");
  assert.equal(L.count("circle"), 1, "cercul nu este recreat");
  assert.equal(L.count("tileLayer"), 1, "tile layer-ul nu este recreat");
  assert.equal(L.count("map"), 1);
  assert.equal(L.count("circleMarker.setLatLng"), 5);
});

test("updatePlayer: același fix de două ori → zero apeluri Leaflet", () => {
  const { L, map } = setup();
  map.updatePlayer(fix(), "valid");
  const before = L.calls.length;
  map.updatePlayer(fix(), "valid");
  map.updatePlayer({ ...fix() }, "valid");
  assert.equal(L.calls.length, before);
});

test("updatePlayer: uncertain și weak → punct gol + cerc punctat (weak desenat exact ca uncertain)", () => {
  for (const quality of ["uncertain", "weak"]) {
    const { L, map } = setup();
    map.updatePlayer(fix(45.641, 25.588, 150), quality);
    const [marker] = layersOf(L, "circleMarker");
    const [circle] = layersOf(L, "circle");
    assert.equal(marker.options.fillColor, "#ffffff", quality);
    assert.equal(circle.options.dashArray, "6 6", quality);
    assert.equal(circle.options.radius, 150);
  }
});

test("updatePlayer: none + fix → punct gri fără cerc; none + null → nimic", () => {
  const { L, map } = setup();
  map.updatePlayer(fix(), "valid");
  map.updatePlayer(fix(), "none");
  const [marker] = layersOf(L, "circleMarker");
  assert.equal(marker.options.color, "#6b6b6b");
  assert.equal(layersOf(L, "circle").length, 0, "fără cerc pentru ultima poziție");
  map.updatePlayer(null, "none");
  assert.equal(layersOf(L, "circleMarker").length, 0);
  assert.equal(layersOf(L, "circle").length, 0);
});

test("updatePlayer: accuracy > 1000 m → fără cerc; cercul nu influențează zoom-ul", () => {
  const { L, map, leafletMap } = setup();
  map.updatePlayer(fix(45.641, 25.588, 1000), "uncertain");
  assert.equal(layersOf(L, "circle").length, 1, "exact 1000 m se desenează");
  map.updatePlayer(fix(45.641, 25.588, 1001), "uncertain");
  assert.equal(layersOf(L, "circle").length, 0);
  map.updatePlayer(fix(45.641, 25.588, 5000), "valid");
  assert.equal(layersOf(L, "circle").length, 0);
  // Toate mișcările au folosit zoom-uri fixe din configurație, nu raza cercului.
  for (const call of L.calls.filter((c) => c.name === "map.setView")) {
    assert.ok([DEFAULT_MAP_VIEW.playerZoom, DEFAULT_MAP_VIEW.maxFitZoom].includes(call.args[1]));
  }
  assert.equal(leafletMap.zoom, DEFAULT_MAP_VIEW.playerZoom);
});

test("updatePlayer: coordonate nedesenabile / accuracy invalidă", () => {
  const { L, map } = setup();
  map.updatePlayer({ lat: NaN, lng: 25, accuracy: 5 }, "valid");
  map.updatePlayer({ lat: 95, lng: 25, accuracy: 5 }, "valid");
  assert.equal(L.count("circleMarker"), 0);
  map.updatePlayer({ lat: 45.64, lng: 25.59, accuracy: NaN }, "uncertain");
  assert.equal(layersOf(L, "circleMarker").length, 1);
  assert.equal(layersOf(L, "circle").length, 0);
});

/* ---------- Locațiile ---------- */

test("updateLocations: doar locațiile vizibile; locked (inclusiv ascunse) nu se desenează niciodată", () => {
  const { L, map } = setup();
  map.updateLocations([A, LOCKED, { ...B, visible: false, state: "available" }]);
  assert.equal(L.count("marker"), 1);
  assert.deepEqual(layersOf(L, "marker")[0].latlng, [A.lat, A.lng]);
  map.updateLocations([A, { ...LOCKED, visible: true }]); // stare locked, chiar marcată vizibil → tot nedesenată
  assert.equal(layersOf(L, "marker").length, 1);
});

test("updateLocations: același model de două ori → zero apeluri; o stare schimbată → doar acel marker", () => {
  const { L, map } = setup();
  map.updateLocations([A, B]);
  map.setCurrentObjective("a");
  const before = L.calls.length;
  map.updateLocations([{ ...A }, { ...B }]);
  map.setCurrentObjective("a");
  assert.equal(L.calls.length, before, "zero operații pentru același model");

  map.updateLocations([A, { ...B, state: "near" }]);
  const iconCalls = L.calls.slice(before).filter((c) => c.name === "marker.setIcon");
  assert.equal(iconCalls.length, 1);
  assert.equal(L.count("marker"), 2, "niciun marker recreat");
});

test("markerii: stări distincte prin clasă/simbol, etichetă accesibilă, obiectivul curent evidențiat", () => {
  const { L, map } = setup();
  const locations = [
    { ...A, state: "available" },
    { ...B, state: "near" },
    { id: "c", name: "Turn", lat: 45.643, lng: 25.590, radius: 40, state: "arrived", visible: true },
    { id: "d", name: "Zid", lat: 45.644, lng: 25.591, radius: 40, state: "completed", visible: true },
  ];
  map.updateLocations(locations);
  map.setCurrentObjective("a");
  const markers = layersOf(L, "marker");
  const html = markers.map((m) => m.options.icon.options.html);
  assert.match(html[0], /oe-pin--available/);
  assert.match(html[0], /oe-pin--current/);
  assert.match(html[1], /oe-pin--near/);
  assert.match(html[2], /oe-pin--arrived/);
  assert.match(html[2], /✓/);
  assert.match(html[3], /oe-pin--completed/);
  assert.equal(new Set(html).size, 4);
  assert.equal(markers[0].element.getAttribute("aria-label"), "Obiectivul curent: Piața");
  assert.equal(markers[1].element.getAttribute("aria-label"), "Obiectiv: Poarta — ești aproape");
  assert.equal(markers[3].element.getAttribute("aria-label"), "Obiectiv finalizat: Zid");
  assert.ok(markers[0].tooltip && markers[0].tooltip.opts.permanent, "eticheta permanentă cu numele");
  assert.equal(markers[1].tooltip, null);
  assert.equal(markers[0].options.zIndexOffset, 1000);
  // Popup-ul are doar text (fără butoane / acțiuni de joc).
  assert.ok(!/<button|onclick/i.test(markers[0].popup));
});

test("numele din conținut sunt escapate în HTML", () => {
  const { L, map } = setup();
  map.updateLocations([{ ...A, name: '<img src=x onerror="alert(1)">' }]);
  map.setCurrentObjective("a");
  const [marker] = layersOf(L, "marker");
  assert.ok(!marker.popup.includes("<img"));
  assert.ok(!marker.tooltip.content.includes("<img"));
});

test("cercul obiectivului: doar pentru obiectivul curent available/near, dispare la arrived", () => {
  const { L, map } = setup();
  map.updateLocations([A, B]);
  assert.equal(layersOf(L, "circle").length, 0, "fără obiectiv curent, fără cerc");
  map.setCurrentObjective("a");
  let circles = layersOf(L, "circle");
  assert.equal(circles.length, 1);
  assert.equal(circles[0].options.radius, A.radius);
  assert.equal(circles[0].options.interactive, false);
  map.updateLocations([{ ...A, state: "near" }, B]);
  assert.equal(layersOf(L, "circle").length, 1);
  map.updateLocations([{ ...A, state: "arrived" }, B]);
  assert.equal(layersOf(L, "circle").length, 0);
  map.updateLocations([{ ...A, state: "completed" }, { ...B }]);
  map.setCurrentObjective("b");
  circles = layersOf(L, "circle");
  assert.equal(circles.length, 1);
  assert.equal(circles[0].options.radius, B.radius);
  map.updateLocations([{ ...A, state: "completed" }, { ...B, radius: null }]);
  assert.equal(layersOf(L, "circle").length, 0, "rază invalidă → fără cerc");
});

/* ---------- Viewport (D-049-E, G) ---------- */

test("prima afișare încadrează locațiile vizibile; primul obiectiv nu este o „schimbare”", () => {
  const { L, map } = setup();
  map.updateLocations([A, B, LOCKED]);
  map.setCurrentObjective("a");
  assert.equal(L.moves(), 1);
  const fitCall = L.calls.find((c) => c.name === "map.fitBounds");
  assert.deepEqual(fitCall.args[0].points, [[A.lat, A.lng], [B.lat, B.lng]]);
  assert.equal(fitCall.args[1].maxZoom, DEFAULT_MAP_VIEW.maxFitZoom);
});

test("primul fix încadrează jucător + obiectiv doar dacă utilizatorul nu a mișcat harta", () => {
  const first = setup();
  first.map.updateLocations([A, B]);
  first.map.setCurrentObjective("a");
  const mark = first.L.calls.length;
  first.map.updatePlayer(fix(), "valid");
  assert.equal(first.L.moves(mark), 1);
  const call = first.L.calls.slice(mark).find((c) => c.name === "map.fitBounds");
  assert.deepEqual(call.args[0].points, [[45.641, 25.588], [A.lat, A.lng]]);

  const second = setup();
  second.map.updateLocations([A, B]);
  second.map.setCurrentObjective("a");
  second.leafletMap.userPan();
  const mark2 = second.L.calls.length;
  second.map.updatePlayer(fix(), "valid");
  assert.equal(second.L.moves(mark2), 0, "utilizatorul a mișcat harta: nicio recentrare");
});

test("după un pan manual, 20 de fix-uri noi nu mișcă harta", () => {
  const { L, map, leafletMap } = setup();
  map.updateLocations([A, B]);
  map.setCurrentObjective("a");
  map.updatePlayer(fix(), "valid");
  leafletMap.userPan();
  const mark = L.calls.length;
  for (let i = 0; i < 20; i += 1) map.updatePlayer(fix(45.641 + i * 0.0002, 25.588, 10 + i), i % 3 ? "valid" : "uncertain");
  assert.equal(L.moves(mark), 0);
});

test("fix-uri obișnuite nu mișcă harta nici fără pan (fără follow mode)", () => {
  const { L, map } = setup();
  map.updateLocations([A, B]);
  map.setCurrentObjective("a");
  map.updatePlayer(fix(), "valid");
  const mark = L.calls.length;
  for (let i = 0; i < 20; i += 1) map.updatePlayer(fix(45.60 + i * 0.01, 25.5), "valid"); // chiar și departe
  assert.equal(L.moves(mark), 0);
});

test("schimbarea obiectivului → exact o recentrare (și după pan); următoarele 20 de fix-uri → zero mișcări", () => {
  const { L, map, leafletMap } = setup();
  map.updateLocations([A, B]);
  map.setCurrentObjective("a");
  map.updatePlayer(fix(), "valid");
  leafletMap.userPan();
  const mark = L.calls.length;
  map.updateLocations([{ ...A, state: "completed" }, B]);
  map.setCurrentObjective("b");
  map.setCurrentObjective("b"); // același id: nicio mișcare suplimentară
  map.updateLocations([{ ...A, state: "completed" }, B]);
  assert.equal(L.moves(mark), 1);
  const call = L.calls.slice(mark).find((c) => c.name === "map.fitBounds");
  assert.deepEqual(call.args[0].points, [[B.lat, B.lng], [45.641, 25.588]], "obiectivul nou + jucătorul");
  const mark2 = L.calls.length;
  for (let i = 0; i < 20; i += 1) map.updatePlayer(fix(45.641 + i * 0.0001), "valid");
  assert.equal(L.moves(mark2), 0);
});

test("obiectivul devine null → nicio mișcare; revenirea la un obiectiv nou → o recentrare", () => {
  const { L, map } = setup();
  map.updateLocations([A, B]);
  map.setCurrentObjective("a");
  const mark = L.calls.length;
  map.setCurrentObjective(null);
  assert.equal(L.moves(mark), 0);
  map.setCurrentObjective("b");
  assert.equal(L.moves(mark), 1);
});

test("„Centrează pe mine”: exact o centrare, fără urmărire; false fără poziție", () => {
  const { L, map, leafletMap } = setup();
  map.updateLocations([A, B]);
  assert.equal(map.centerOnPlayer(), false);
  map.updatePlayer(fix(), "valid");
  leafletMap.userPan();
  leafletMap.zoom = 12;
  const mark = L.calls.length;
  assert.equal(map.centerOnPlayer(), true);
  assert.equal(L.moves(mark), 1);
  const call = L.calls.slice(mark).find((c) => c.name === "map.setView");
  assert.deepEqual(call.args[0], [45.641, 25.588]);
  assert.equal(call.args[1], DEFAULT_MAP_VIEW.playerZoom, "zoom < 15 → 17");
  const mark2 = L.calls.length;
  for (let i = 0; i < 20; i += 1) map.updatePlayer(fix(45.641 + i * 0.001), "valid");
  assert.equal(L.moves(mark2), 0, "fără follow mode");
  leafletMap.zoom = 16;
  map.centerOnPlayer();
  assert.equal(L.calls.at(-1).args[1], 16, "zoom ≥ 15 păstrat");
});

test("fitToAdventure: încadrează doar locațiile vizibile, fără jucător; false fără locații", () => {
  const { L, map } = setup();
  assert.equal(map.fitToAdventure([]), false);
  assert.equal(map.fitToAdventure([LOCKED]), false);
  map.updatePlayer(fix(44, 26), "valid");
  const mark = L.calls.length;
  assert.equal(map.fitToAdventure([A, B, LOCKED]), true);
  const call = L.calls.slice(mark).find((c) => c.name === "map.fitBounds");
  assert.deepEqual(call.args[0].points, [[A.lat, A.lng], [B.lat, B.lng]]);
  assert.equal(map.fitToAdventure([A]), true);
  assert.equal(L.calls.at(-1).name, "map.setView");
});

/* ---------- Tile-uri și ciclu de viață ---------- */

test("tile-uri indisponibile → banner după 3 erori consecutive; dispare la primul tile încărcat", () => {
  const { L, container } = setup();
  const tiles = [...L.mapInstance._layers].find((l) => l.kind === "tileLayer");
  const banner = container.children.find((c) => c.className === "oe-map-banner");
  assert.equal(banner.hidden, true);
  tiles.fire("tileerror");
  tiles.fire("tileerror");
  assert.equal(banner.hidden, true);
  tiles.fire("tileerror");
  assert.equal(banner.hidden, false);
  assert.match(banner.textContent, /Fundalul hărții nu se poate încărca/);
  tiles.fire("tileload");
  assert.equal(banner.hidden, true);
});

test("destroy: harta eliminată, 0 listeneri, idempotent; metodele devin no-op; containerul poate primi o hartă nouă", () => {
  const { L, map, container, leafletMap } = setup();
  map.updateLocations([A, B]);
  map.updatePlayer(fix(), "valid");
  map.destroy();
  assert.equal(leafletMap.removed, true);
  assert.equal(leafletMap.listenerCount(), 0);
  assert.equal(container.children.length, 0, "bannerul este eliminat");
  map.destroy(); // a doua oară: fără erori
  assert.equal(L.count("map.remove"), 1);
  const before = L.calls.length;
  map.updatePlayer(fix(), "valid");
  map.updateLocations([A]);
  map.setCurrentObjective("a");
  assert.equal(map.centerOnPlayer(), false);
  assert.equal(map.fitToAdventure([A]), false);
  assert.equal(L.calls.length, before);
  const again = createMap({ container, tileConfig: DEFAULT_MAP_TILES, leaflet: L });
  assert.equal(L.count("map"), 2);
  again.destroy();
});

/* ---------- Arhitectură și versiune ---------- */

test("map.js nu atinge GPS-ul, motorul sau stocarea și nu conține reguli GPS (verificare în sursă)", () => {
  const source = readFileSync(new URL("../src/js/map.js", import.meta.url), "utf8");
  for (const token of ["navigator.geolocation", "geolocation", "reportPosition", "confirmArrival", "evaluateProximity",
    "distanceMeters", "assessFix", "defaultRadius", "maxAccuracy", "nearDistance", "localStorage", "sessionStorage",
    "caches", "fetch(", "unpkg", "jsdelivr", "cdnjs", "maplibre"]) {
    assert.ok(!source.toLowerCase().includes(token.toLowerCase()), `map.js nu trebuie să conțină „${token}”`);
  }
  const imports = [...source.matchAll(/^import .* from "(.+)";$/gm)].map((m) => m[1]);
  assert.deepEqual(imports, ["./defaults.js"]);
});

test("Leaflet inclus local: antet 1.9.4 și SHA-256 egal cu cel documentat în 03_ARCHITECTURE.md", () => {
  const js = readFileSync(new URL("../src/vendor/leaflet/leaflet.js", import.meta.url));
  const css = readFileSync(new URL("../src/vendor/leaflet/leaflet.css", import.meta.url));
  assert.match(js.subarray(0, 200).toString("utf8"), /Leaflet 1\.9\.4\b/);
  assert.equal(MAP_LIBRARY_VERSION, "1.9.4");
  const docs = readFileSync(new URL("../docs/03_ARCHITECTURE.md", import.meta.url), "utf8");
  for (const buffer of [js, css]) {
    const sha = createHash("sha256").update(buffer).digest("hex");
    assert.ok(docs.includes(sha), `suma ${sha} trebuie să fie în docs/03_ARCHITECTURE.md`);
  }
});

test("versiune Leaflet diferită → doar avertisment, harta se creează", () => {
  const warnings = [];
  const original = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    const { L } = setup({ version: "2.0.0" });
    assert.equal(L.count("map"), 1);
  } finally {
    console.warn = original;
  }
  assert.ok(warnings.some((w) => w.includes("2.0.0")));
});
