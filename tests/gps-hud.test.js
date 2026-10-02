// Indicatorul GPS de peste hartă (HUD — D-049-F, amendamentul din 2026-10-02).
// 1. describeGpsHud (play-ui.js): stările și barele, din starea existentă a adaptorului location.js.
// 2. Butoanele „Activează” / „Încearcă din nou”: același tracker, fără al doilea watchPosition.
// 3. Verificări în sursă: index.html, app.css, app.js, jurnalul deciziilor.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeGpsHud, gpsHudLevel, GpsHudAction } from "../src/js/play-ui.js";
import { createLocationTracker, describeLocation, LocationDisplay, TrackerStatus } from "../src/js/location.js";
import { assessFix } from "../src/js/geo.js";
import { DEFAULT_GPS_HUD, DEFAULT_SETTINGS, DEFAULT_MAP_VIEW } from "../src/js/defaults.js";
import { mockGeolocation, position } from "./helpers/mock-geolocation.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const html = read("../src/index.html").replace(/<!--[\s\S]*?-->/g, "");
const css = read("../src/css/app.css");
const app = read("../src/js/app.js");
const appCode = app.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
const decisions = read("../docs/04_DECISIONS_LOG.md");

/** HTML-ul complet al elementului cu id-ul dat (tag de deschidere → tag de închidere pereche). */
function element(id) {
  const open = new RegExp(`<([a-z]+)\\b[^>]*\\bid="${id}"[^>]*>`).exec(html);
  assert.ok(open, `#${id} lipsește din index.html`);
  const tag = open[1];
  const re = new RegExp(`<${tag}\\b|</${tag}>`, "g");
  re.lastIndex = open.index + open[0].length;
  let depth = 1;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    depth += m[0].startsWith("</") ? -1 : 1;
    if (depth === 0) return html.slice(open.index, m.index + m[0].length);
  }
  throw new Error(`#${id} nu este închis`);
}

const openTag = (id) => new RegExp(`<[a-z]+\\b[^>]*\\bid="${id}"[^>]*>`).exec(html)[0];
const hud = (display, accuracy) =>
  describeGpsHud(display, accuracy === undefined ? null : { lat: 0, lng: 0, accuracy, timestamp: 1 }, DEFAULT_GPS_HUD);

/** Tracker real (location.js) cu geolocație simulată și starea afișată calculată ca în app.js. */
function trackerWithMock(mockOptions) {
  const geolocation = mockGeolocation(mockOptions);
  const tracker = createLocationTracker({ geolocation, secureContext: true });
  const display = () => {
    const s = tracker.getState();
    return describeLocation(s, s.fix ? assessFix(s.fix, DEFAULT_SETTINGS.gps) : null);
  };
  const currentHud = () => describeGpsHud(display(), tracker.getState().fix, DEFAULT_GPS_HUD);
  return { geolocation, tracker, display, currentHud };
}

/* ---------- 1. Stările ---------- */

test("gps-off: 0 bare, gri, fără precizie, butonul „Activează” (tracker.start)", () => {
  assert.deepEqual(hud(LocationDisplay.OFF), {
    state: "gps-off", bars: 0, tone: "none", accuracy: null, searching: false, action: GpsHudAction.START,
  });
});

test("gps-searching: 0 bare, căutare, fără buton și fără precizie", () => {
  const h = hud(LocationDisplay.SEARCHING);
  assert.equal(h.bars, 0);
  assert.equal(h.tone, "none");
  assert.equal(h.searching, true);
  assert.equal(h.action, null);
  assert.equal(h.accuracy, null);
});

test("gps-ready, precizie ≤ 5 m: 5 bare, verde, ±X m", () => {
  for (const accuracy of [0, 3, 5]) {
    assert.deepEqual(
      (({ bars, tone, accuracy: a, action }) => ({ bars, tone, a, action }))(hud(LocationDisplay.READY, accuracy)),
      { bars: 5, tone: "good", a: accuracy, action: null },
    );
  }
});

test("precizie 6–10 m: 4 bare, verde", () => {
  for (const accuracy of [5.4, 6, 10]) assert.deepEqual(gpsHudLevel(accuracy, DEFAULT_GPS_HUD), { bars: 4, tone: "good" });
  assert.equal(hud(LocationDisplay.READY, 8).bars, 4);
});

test("precizie 11–20 m: 3 bare, galben", () => {
  for (const accuracy of [10.2, 11, 20]) assert.deepEqual(gpsHudLevel(accuracy, DEFAULT_GPS_HUD), { bars: 3, tone: "fair" });
  assert.deepEqual((({ bars, tone, accuracy: a }) => ({ bars, tone, a }))(hud(LocationDisplay.READY, 12)), { bars: 3, tone: "fair", a: 12 });
});

test("precizie 21–40 m: 2 bare, portocaliu", () => {
  for (const accuracy of [21, 33, 40]) assert.deepEqual(gpsHudLevel(accuracy, DEFAULT_GPS_HUD), { bars: 2, tone: "weak" });
  assert.equal(hud(LocationDisplay.READY, 35).tone, "weak");
});

test("precizie > 40 m: 1 bară, roșu (și în starea gps-uncertain)", () => {
  for (const accuracy of [40.1, 59, 500, 5000]) assert.deepEqual(gpsHudLevel(accuracy, DEFAULT_GPS_HUD), { bars: 1, tone: "poor" });
  const h = hud(LocationDisplay.UNCERTAIN, 75);
  assert.deepEqual([h.bars, h.tone, h.accuracy, h.action], [1, "poor", 75, null]);
});

test("precizie NaN / lipsă / negativă: 0 bare, gri, precizie necunoscută", () => {
  for (const accuracy of [NaN, Infinity, -1, null, "12"]) {
    assert.deepEqual(gpsHudLevel(accuracy, DEFAULT_GPS_HUD), { bars: 0, tone: "none" });
  }
  const h = hud(LocationDisplay.UNCERTAIN, NaN);
  assert.deepEqual([h.bars, h.tone, h.accuracy], [0, "none", null]);
  assert.deepEqual([hud(LocationDisplay.READY).bars, hud(LocationDisplay.READY).accuracy], [0, null]); // fără fix
});

test("gps-error: 0 bare (chiar cu ultima poziție reținută), „Încearcă din nou” (tracker.retry)", () => {
  const h = hud(LocationDisplay.ERROR, 8);
  assert.deepEqual([h.bars, h.tone, h.accuracy, h.action], [0, "none", null, GpsHudAction.RETRY]);
});

test("gps-permission-denied: 0 bare, „Încearcă din nou” (tracker.retry)", () => {
  const h = hud(LocationDisplay.PERMISSION_DENIED);
  assert.deepEqual([h.bars, h.tone, h.accuracy, h.action], [0, "none", null, GpsHudAction.RETRY]);
});

test("gps-unavailable: niciun buton (API indisponibil sau context nesigur)", () => {
  const h = hud(LocationDisplay.UNAVAILABLE);
  assert.deepEqual([h.bars, h.action], [0, null]);
  // Prin adaptorul real: context nesigur → gps-unavailable → fără buton.
  const tracker = createLocationTracker({ geolocation: mockGeolocation(), secureContext: false });
  tracker.start();
  const s = tracker.getState();
  assert.equal(describeGpsHud(describeLocation(s, null), s.fix, DEFAULT_GPS_HUD).action, null);
});

test("pragurile HUD sunt separate de pragurile de joc și de limita cercului de precizie", () => {
  assert.equal(DEFAULT_SETTINGS.gps.maxAccuracy, 60);
  assert.equal(DEFAULT_MAP_VIEW.accuracyCircleMax, 1000);
  assert.deepEqual(DEFAULT_GPS_HUD.levels.map((l) => [l.maxAccuracy, l.bars]), [[5, 5], [10, 4], [20, 3], [40, 2]]);
  assert.deepEqual(DEFAULT_GPS_HUD.fallback, { bars: 1, tone: "poor" });
  assert.ok(Object.isFrozen(DEFAULT_GPS_HUD) && Object.isFrozen(DEFAULT_GPS_HUD.levels));
  // Același fix (45 m): pentru joc rămâne utilizabil (≤ 60 m), HUD-ul arată doar 1 bară — nicio influență reciprocă.
  const fix = { lat: 0, lng: 0, accuracy: 45, timestamp: 1 };
  assert.equal(assessFix(fix, DEFAULT_SETTINGS.gps).usable, true);
  assert.equal(describeGpsHud(LocationDisplay.READY, fix, DEFAULT_GPS_HUD).bars, 1);
});

test("HUD-ul nu modifică intrarea (pur)", () => {
  const fix = Object.freeze({ lat: 0, lng: 0, accuracy: 12, timestamp: 1 });
  assert.deepEqual(describeGpsHud(LocationDisplay.READY, fix, DEFAULT_GPS_HUD), describeGpsHud(LocationDisplay.READY, fix, DEFAULT_GPS_HUD));
  assert.equal(fix.accuracy, 12);
});

/* ---------- 2. Butoanele: același adaptor, fără al doilea watcher ---------- */

test("„Activează” → tracker.start(): un singur watchPosition, apoi căutare și poziție cu bare", () => {
  const { geolocation, tracker, currentHud } = trackerWithMock();
  assert.equal(currentHud().action, GpsHudAction.START);
  assert.equal(tracker.start(), true); // ce face handlerul butonului
  assert.equal(geolocation.calls.length, 1);
  assert.equal(currentHud().searching, true);
  assert.equal(currentHud().action, null);
  geolocation.emit(position(0, 0, 12));
  assert.deepEqual([currentHud().state, currentHud().bars, currentHud().accuracy], ["gps-ready", 3, 12]);
  geolocation.emit(position(0, 0, 75)); // peste maxAccuracy (60): incert pentru joc, 1 bară în HUD
  assert.deepEqual([currentHud().state, currentHud().bars], ["gps-uncertain", 1]);
});

test("„Încearcă din nou” → tracker.retry(): după refuz sau eroare, repornește același watcher", () => {
  const { geolocation, tracker, currentHud } = trackerWithMock();
  tracker.start();
  geolocation.fail(1); // PERMISSION_DENIED
  assert.equal(tracker.getState().status, TrackerStatus.DENIED);
  assert.equal(currentHud().action, GpsHudAction.RETRY);
  tracker.retry();
  assert.equal(geolocation.calls.length, 2);
  assert.equal(geolocation.watches.size, 1, "un singur watcher activ după retry");

  geolocation.fail(3); // TIMEOUT → gps-error, urmărirea continuă
  assert.equal(currentHud().state, "gps-error");
  assert.equal(currentHud().action, GpsHudAction.RETRY);
  tracker.retry();
  assert.equal(geolocation.watches.size, 1);
});

test("refuz memorat de browser: retry nu simulează o permisiune acordată", () => {
  const { geolocation, tracker, currentHud } = trackerWithMock({ syncError: 1 });
  tracker.start();
  assert.equal(currentHud().state, "gps-permission-denied");
  tracker.retry();
  assert.equal(currentHud().state, "gps-permission-denied");
  assert.equal(currentHud().bars, 0);
  assert.equal(geolocation.watches.size, 0);
});

test("nu există al doilea watcher: un singur tracker, butoanele HUD apelează metodele lui", () => {
  assert.equal(appCode.match(/createLocationTracker\(/g).length, 1);
  assert.ok(!/\.watchPosition\(/.test(appCode), "app.js nu apelează direct watchPosition");
  assert.ok(!appCode.includes("navigator.geolocation"));
  assert.ok(!/setInterval\(/.test(appCode), "fără polling");
  assert.match(appCode, /\$\("btn-gps-hud-start"\)\.addEventListener\("click", \(\) => tracker\.start\(\)\);/);
  assert.match(appCode, /\$\("btn-gps-hud-retry"\)\.addEventListener\("click", \(\) => tracker\.retry\(\)\);/);
  assert.equal(appCode.match(/btn-gps-hud-start"\)\.addEventListener/g).length, 1);
  assert.equal(appCode.match(/btn-gps-hud-retry"\)\.addEventListener/g).length, 1);
  // Al doilea start este refuzat de adaptor (fără watchers multipli).
  const { geolocation, tracker } = trackerWithMock();
  tracker.start();
  assert.equal(tracker.start(), false);
  assert.equal(geolocation.calls.length, 1);
});

test("HUD-ul se redesenează din abonarea existentă la tracker (renderMap), fără alt mecanism", () => {
  assert.match(appCode, /renderGpsHud\(\);\s*\}/, "apelat la finalul renderMap");
  assert.match(appCode, /describeGpsHud\(locationDisplay\(\), tracker\.getState\(\)\.fix, DEFAULT_GPS_HUD\)/);
  assert.equal(appCode.match(/tracker\.subscribe\(/g).length, 1);
});

/* ---------- 3. Structură, accesibilitate, stil ---------- */

test("HUD-ul este în #map-stage, frate al #map-container, NU în containerul Leaflet", () => {
  const stage = element("map-stage");
  assert.ok(stage.includes('id="gps-hud"'));
  assert.ok(!element("map-container").includes("gps-hud"));
  assert.ok(stage.indexOf('id="map-container"') < stage.indexOf('id="gps-hud"'));
  assert.ok(stage.indexOf('id="gps-hud"') < stage.indexOf('id="objective"'));
});

test("regresie: #map-container rămâne gol (Leaflet îi controlează conținutul)", () => {
  assert.match(element("map-container"), /^<div\b[^>]*>\s*<\/div>$/);
});

test("HUD-ul nu este regiune live; #location-status rămâne regiunea de status", () => {
  const box = element("gps-hud");
  assert.ok(!/aria-live|role="(status|alert|log)"/.test(box), "fără aria-live / role=status în HUD");
  assert.ok(!/gps-hud[^\n]*aria-live/.test(appCode));
  assert.match(openTag("location-status"), /role="status"/);
  assert.match(openTag("location-status"), /aria-live="polite"/);
  // Ascuns doar vizual în modul HUD, niciodată cu display:none.
  assert.ok(!/#location-status[^{]*\{[^}]*display:\s*none/.test(css));
  assert.ok(!/\.location-status[^{]*\{[^}]*display:\s*none/.test(css));
  assert.match(css, /\.location-panel\[data-hud="on"\] \.location-status \{[^}]*clip-path: inset\(50%\)/);
});

test("butoanele HUD sunt <button> reale, cu etichetă clară care conține textul vizibil", () => {
  const start = element("btn-gps-hud-start");
  const retry = element("btn-gps-hud-retry");
  assert.match(start, /^<button type="button"[^>]*aria-label="Activează locația"[^>]*>Activează<\/button>$/);
  assert.match(retry, /^<button type="button"[^>]*aria-label="Încearcă din nou activarea locației"[^>]*>Încearcă din nou<\/button>$/);
  assert.ok(!/tabindex="-1"/.test(start + retry), "focusabile cu tastatura");
  const box = element("gps-hud");
  assert.match(box, /<svg\b[^>]*aria-hidden="true"[^>]*focusable="false"/);
  assert.match(box, /class="gps-hud__bars" aria-hidden="true"/);
  assert.match(box, /id="gps-hud-text" class="visually-hidden"/);
  assert.match(openTag("gps-hud"), /role="group"/);
});

test("textul accesibil descrie starea, nu doar culoarea", () => {
  assert.match(app, /`Locație activă, \$\{precision\}\.`/);
  assert.match(app, /`precizie aproximativă \$\{hud\.accuracy\} metri`/);
  assert.match(app, /"Locația nu este activă\."/);
  assert.match(appCode, /\$\("gps-hud-text"\)\.textContent = gpsHudText\(hud\)/);
});

test("fără furt de focus: HUD-ul primește focus doar când butonul apăsat dispare", () => {
  const focusCalls = appCode.match(/box\.focus\(\)/g) || [];
  assert.equal(focusCalls.length, 1);
  assert.match(appCode, /if \(focused && focused !== box && focused\.hidden\) box\.focus\(\);/);
  assert.match(openTag("gps-hud"), /tabindex="-1"/);
});

test("prefers-reduced-motion: animația de căutare se oprește", () => {
  assert.match(css, /\.gps-hud\[data-state="gps-searching"\] \.gps-hud__wave \{\s*animation:/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\) \{\s*\.gps-hud__wave \{\s*animation: none !important;/);
  // Singura animație a HUD-ului este cea de căutare.
  assert.equal((css.match(/\.gps-hud[^{]*\{[^}]*animation: gps-hud-search/g) || []).length, 1);
});

test("poziționare: sus-dreapta, peste hartă; bannerul hărții mutat doar prin CSS", () => {
  const rule = /\.gps-hud \{([^}]*)\}/.exec(css)[1];
  assert.match(rule, /position:\s*absolute/);
  assert.match(rule, /top:\s*0\.5rem/);
  assert.match(rule, /right:\s*0\.5rem/);
  assert.match(css, /\.map-stage\[data-map="on"\] \.oe-map-banner \{[^}]*top:\s*3\.25rem/);
  // Cardul obiectivului (singurul element poziționat absolut dintre .objective) lasă loc HUD-ului.
  assert.match(css, /\.map-stage\[data-map="on"\] \.objective \{[^}]*max-height: calc\(100% - 5rem\)/);
});

test("panoul „Locația ta” rămâne; în modul HUD nu dublează butoanele de activare", () => {
  for (const id of ["location-panel", "location-status", "location-detail", "location-intro", "btn-location-start", "btn-location-retry", "btn-location-stop"]) {
    assert.ok(element(id));
  }
  assert.match(appCode, /\$\("location-panel"\)\.dataset\.hud = shown \? "on" : "off";/);
  assert.match(css, /\.location-panel\[data-hud="on"\] #btn-location-start,/);
  assert.ok(!/\[data-hud="on"\][^{]*#btn-location-stop/.test(css), "„Oprește locația” rămâne vizibil");
});

test("textele: fără „(mai jos)” și fără precizia repetată sub hartă", () => {
  assert.ok(!app.includes("Activează locația (mai jos)"));
  assert.ok(!app.includes("este mai jos"));
  const caption = /function mapCaption\(model\) \{([\s\S]*?)\n  \}/.exec(app)[1];
  assert.ok(!/precizie ~/.test(caption), "precizia în metri o arată HUD-ul");
});

test("regresie: D-049-F amendată, cu decizia originală păstrată", () => {
  const f = decisions.slice(decisions.indexOf("- **F — Poziția în ecran"), decisions.indexOf("- **G — "));
  assert.ok(f.includes("„Centrează pe mine”, „Vezi obiectivele” și textele despre poziție / GPS rămân sub hartă, în afara ei."));
  assert.ok(f.includes("*Formularea anterioară (2026-09-29, înlocuită la 2026-10-01):*"));
  assert.ok(f.includes("**Amendament ulterior (2026-10-02"));
  assert.ok(f.includes("„Informațiile GPS operaționale pot fi afișate compact peste hartă printr-un HUD dedicat. HUD-ul nu transformă harta într-un container pentru controale Leaflet sau elemente de gameplay. Informațiile explicative și detaliile complete despre locație rămân în afara hărții.”"));
  assert.ok(f.indexOf("Formularea anterioară") < f.indexOf("Amendament ulterior"));
});
