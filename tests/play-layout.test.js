// Structura ecranului de joc (TASK 4, pasul 3): harta ca suprafață principală,
// cardul obiectivului peste hartă, „Am ajuns” în card. Verificări în sursă, fără browser.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const html = readFileSync(new URL("../src/index.html", import.meta.url), "utf8").replace(/<!--[\s\S]*?-->/g, "");
const css = readFileSync(new URL("../src/css/app.css", import.meta.url), "utf8");
const app = readFileSync(new URL("../src/js/app.js", import.meta.url), "utf8");

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

const contains = (outerId, innerId) => element(outerId).includes(`id="${innerId}"`);

test("cardul obiectivului stă în scena hărții, după container, dar NU în containerul Leaflet", () => {
  const stage = element("map-stage");
  assert.ok(contains("map-panel", "map-stage"));
  assert.ok(stage.indexOf('id="map-container"') < stage.indexOf('id="objective"'), "cardul vine după hartă (deasupra ei)");
  // Leaflet controlează conținutul containerului: acesta rămâne gol.
  assert.match(element("map-container"), /^<div\b[^>]*>\s*<\/div>$/);
});

test("cardul conține numele, tipul (locație), starea, instrucțiunile și „Am ajuns”", () => {
  for (const id of ["objective-name", "objective-status", "objective-instructions", "btn-arrived"]) {
    assert.ok(contains("objective", id), `#${id} trebuie să fie în card`);
  }
  assert.match(element("objective"), /class="objective-kicker">[^<]*Locație</);
  assert.match(element("btn-arrived"), />\s*Am ajuns\s*</);
});

test("butoanele și textele hărții rămân în afara hărții (D-049-F), sub ea", () => {
  for (const id of ["btn-map-center", "btn-map-fit", "map-caption", "objective-gps-note"]) {
    assert.ok(contains("map-panel", id), `#${id} este în panoul hărții`);
    assert.ok(!contains("map-stage", id), `#${id} nu acoperă harta`);
  }
});

test("pe ecranul de joc, harta vine imediat după antetul de progres, înaintea misiunii și a formularului", () => {
  const play = element("screen-play");
  const at = (id) => play.indexOf(`id="${id}"`);
  assert.ok(at("challenge-progress") < at("map-panel"));
  assert.ok(at("map-panel") < at("challenge-title"));
  assert.ok(at("challenge-title") < at("answer-form"));
});

test("suprapunerea cardului se aplică doar când harta există (data-map=\"on\")", () => {
  const overlay = /\.map-stage\[data-map="on"\] \.objective \{([^}]*)\}/.exec(css);
  assert.ok(overlay, "regula de suprapunere lipsește");
  assert.match(overlay[1], /position:\s*absolute/);
  // Nicio altă regulă nu poziționează cardul absolut (fără hartă, cardul rămâne în fluxul paginii).
  assert.equal(css.match(/\.objective[^{]*\{[^}]*position:\s*absolute/g).length, 1);
  assert.match(element("map-stage"), /data-map="off"/);
});

/* ---------- Overlay-ul puzzle-ului (TASK 4, pasul 4) ---------- */

test("overlay-ul puzzle-ului există, ascuns inițial, cu titlu, întrebare, formular, feedback, „Continuă” și „Închide”", () => {
  const panel = element("puzzle-panel");
  assert.match(panel, /^<section\b[^>]*\bhidden\b/);
  for (const id of ["puzzle-title", "puzzle-question", "puzzle-location", "answer-form", "answer-input", "btn-check",
    "feedback", "btn-next", "btn-puzzle-close"]) {
    assert.ok(contains("puzzle-panel", id), `#${id} trebuie să fie în panoul puzzle-ului`);
  }
  assert.match(element("btn-puzzle-close"), />\s*Închide\s*</);
  // Un singur formular de răspuns în pagină.
  assert.equal(html.split("<form").length - 1, 1);
});

test("harta rămâne în DOM și în afara overlay-ului (overlay-ul stă peste ea, nu o înlocuiește)", () => {
  assert.ok(!contains("puzzle-panel", "map-container"));
  assert.ok(!contains("puzzle-panel", "map-panel"));
  assert.ok(!contains("map-panel", "puzzle-panel"));
  assert.ok(contains("screen-play", "map-container") && contains("screen-play", "puzzle-panel"));
  // Deschiderea overlay-ului nu ascunde și nu distruge harta.
  const setOverlay = /function setOverlayOpen\(open\) \{([\s\S]*?)\n  \}/.exec(app)[1];
  assert.doesNotMatch(setOverlay, /map-container|map-panel|destroyMap|\.destroy\(/);
  // Overlay-ul acoperă tot viewport-ul, peste straturile Leaflet (izolate, z-index ≤ 1000).
  const overlay = /\.puzzle-panel\[data-mode="overlay"\] \{([^}]*)\}/.exec(css)[1];
  assert.match(overlay, /position:\s*fixed/);
  assert.match(overlay, /inset:\s*0/);
  assert.ok(Number(/z-index:\s*(\d+)/.exec(overlay)[1]) > 1000);
});

test("cât timp overlay-ul este deschis, restul paginii (inclusiv harta) este inert", () => {
  const setOverlay = /function setOverlayOpen\(open\) \{([\s\S]*?)\n  \}/.exec(app)[1];
  assert.match(setOverlay, /sibling\.inert = open/);
  assert.match(setOverlay, /aria-modal/);
});

test("răspunsul corect nu ajunge în pagină: nu e în HTML, iar panoul se scrie doar cu textContent din model", () => {
  for (const file of ["demo-vertical-slice", "brasov-centrul-vechi", "demo-gps-brasov"]) {
    const adventure = JSON.parse(readFileSync(new URL(`../content/adventures/${file}.json`, import.meta.url), "utf8"));
    for (const mission of adventure.missions || adventure.challenges) {
      // Răspunsurile de 1–2 caractere (ex. „3”) apar inevitabil în orice text; se verifică doar cele distinctive.
      if (mission.answer?.length >= 3) assert.ok(!html.includes(mission.answer), `${file}: răspunsul apare în index.html`);
    }
  }
  assert.doesNotMatch(app, /innerHTML|insertAdjacentHTML|outerHTML/);
  const renderPuzzle = /function renderPuzzle\(viewModel\) \{([\s\S]*?)\n  \}/.exec(app)[1];
  assert.match(renderPuzzle, /describePlayUi|currentPlayUi/);
  assert.doesNotMatch(renderPuzzle, /answer\b|\.answer/);
});

test("trimiterea răspunsului și „Continuă” trec prin motor; „Închide” nu atinge jocul", () => {
  const submit = /\$\("answer-form"\)\.addEventListener\("submit", async \(event\) => \{([\s\S]*?)\n  \}\);/.exec(app)[1];
  assert.match(submit, /game\.submitAnswer\(input\.value\)/);
  assert.match(submit, /render\(\)/);
  const advance = /function advance\(\) \{([\s\S]*?)\n  \}/.exec(app)[1];
  assert.match(advance, /game\.next\(\)/);
  const close = /function closePuzzleOverlay\(\) \{([\s\S]*?)\n  \}/.exec(app)[1];
  assert.doesNotMatch(close, /game\.(?!content)/);
  assert.doesNotMatch(close, /storage|localStorage/);
});

test("toate id-urile folosite de app.js există în index.html, o singură dată", () => {
  const used = new Set([...app.matchAll(/\$\("([a-z0-9-]+)"\)/g)].map((m) => m[1]));
  assert.ok(used.has("map-stage") && used.has("objective") && used.has("btn-arrived"));
  for (const id of used) {
    const count = html.split(`id="${id}"`).length - 1;
    assert.equal(count, 1, `#${id} apare de ${count} ori în index.html`);
  }
});

test("„Am ajuns” folosește modelul derivat din motor, fără stare locală de sosire", () => {
  const handler = /\$\("btn-arrived"\)\.addEventListener\("click", \(\) => \{([\s\S]*?)\n  \}\);/.exec(app);
  assert.ok(handler, "handler-ul „Am ajuns” lipsește");
  assert.match(handler[1], /currentViewModel\(\)/);
  assert.match(handler[1], /game\.confirmArrival\(objective\.locationId\)/);
  assert.doesNotMatch(handler[1], /arrived\s*=|hasArrived|dataset\.presence|\.hidden\s*=/);
});

/* ---------- Indicii în panoul puzzle-ului (TASK 4, pasul 5 — D-030) ---------- */

/** Corpul handler-ului de clic pentru #id (funcție inline sau numită). */
function clickHandler(id) {
  const m = new RegExp(`\\$\\("${id}"\\)\\.addEventListener\\("click", (?:\\(\\) => \\{([\\s\\S]*?)\\n  \\}\\)|([A-Za-z]+)\\))`).exec(app);
  assert.ok(m, `handler-ul pentru #${id} lipsește`);
  if (m[1] !== undefined) return m[1];
  return new RegExp(`function ${m[2]}\\(\\) \\{([\\s\\S]*?)\\n  \\}`).exec(app)[1];
}

test("indiciile și confirmarea sunt în panoul puzzle-ului (overlay pentru V2, în pagină pentru V1)", () => {
  for (const id of ["hint-area", "hint-status", "hint-list", "btn-hint", "hint-confirm", "btn-hint-cancel", "btn-hint-confirm"]) {
    assert.ok(contains("puzzle-panel", id), `#${id} trebuie să fie în panoul puzzle-ului`);
  }
  // Niciun alt marcaj de indiciu în afara panoului (o singură implementare).
  const outside = html.replace(element("puzzle-panel"), "");
  assert.doesNotMatch(outside, /id="(?:hint-[a-z-]+|btn-hint[a-z-]*)"/);
  assert.match(element("hint-area"), /^<div\b[^>]*\bhidden\b/);
  assert.match(element("hint-confirm"), /^<div\b[^>]*\bhidden\b/);
  assert.match(element("hint-confirm"), /role="alertdialog"/);
  assert.match(element("hint-confirm"), /ireversibil/);
  assert.match(element("btn-hint-cancel"), />\s*Renunță\s*</);
  assert.match(element("btn-hint"), />\s*Arată indiciul\s*</);
});

test("D-030: doar confirmarea finală apelează motorul; „Arată indiciul” și „Renunță” nu", () => {
  assert.doesNotMatch(clickHandler("btn-hint"), /game\.(?!content)/);
  assert.doesNotMatch(clickHandler("btn-hint-cancel"), /game\.(?!content)/);
  assert.match(clickHandler("btn-hint-confirm"), /game\.requestHint\(viewModel\.puzzle\.missionId\)/);
  // Niciun alt loc din aplicație nu deschide indicii.
  assert.equal(app.match(/game\.(?:requestHint|useHint)\(/g).length, 1);
});

test("indiciile se desenează din model, doar cu textContent; formularul nu este atins", () => {
  const render = /function renderHints\(viewModel\) \{([\s\S]*?)\n  \}/.exec(app)[1];
  assert.match(render, /currentPlayUi\(viewModel\)/);
  assert.match(render, /\.textContent = /);
  assert.doesNotMatch(render, /innerHTML|insertAdjacentHTML|outerHTML/);
  assert.doesNotMatch(render, /answer-form|answer-input|btn-check/);
  // Nicio stare de tip „indiciu deschis” în interfață și nicio persistență proprie.
  const code = app.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /hintOpened|hintsOpened|openedHints\s*=/);
  assert.doesNotMatch(code, /\b(?:local|session)Storage\s*[.[]/); // persistența rămâne doar în storage.js
});

test("Escape închide întâi confirmarea indiciului, apoi overlay-ul (aceeași ordine ca Back — U2)", () => {
  const keydown = /document\.addEventListener\("keydown", \(event\) => \{([\s\S]*?)\n  \}\);/.exec(app)[1];
  assert.ok(keydown.indexOf("cancelHintConfirm") < keydown.indexOf("closePuzzleOverlay"));
  // Istoricul este folosit doar de mecanismul Back (U2, tests/back-u2.test.js), fără replaceState.
  assert.doesNotMatch(app, /replaceState/);
});
