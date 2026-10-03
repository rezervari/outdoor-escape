// Bara de progres (M7-C).
// 1. clampPercent / progressPercent (play-ui.js): 0 %, intermediar, 100 %, limitele, valori invalide (fără NaN).
// 2. viewModel.progress.missionsClosed, din motorul real: misiunile principale închise (rezolvate / sărite / eșuate).
// 3. Desenarea (renderProgress din app.js, rulată pe elemente simulate): aceeași valoare pentru lățimea
//    părții completate, poziția etichetei, textul „N%” și aria-valuenow, la fiecare schimbare din joc.
// 4. Verificări în sursă: index.html (progressbar), app.css (--progress, reduced motion, fără ieșiri din container).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { clampPercent, progressPercent } from "../src/js/play-ui.js";
import { buildViewModel, View } from "../src/js/view-model.js";
import { toAdventureV2 } from "../src/js/schema.js";
import { createGame } from "../src/js/game.js";
import { createLocalValidator, withoutAnswers } from "../src/js/answers.js";

// Terminațiile de linie se normalizează: pe Windows (core.autocrlf=true) sursele pot fi CRLF.
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const json = (path) => JSON.parse(read(path));
const html = read("../src/index.html").replace(/<!--[\s\S]*?-->/g, "");
const css = read("../src/css/app.css");
const app = read("../src/js/app.js");
const appCode = app.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

const slice = json("../content/adventures/demo-vertical-slice.json"); // 4 misiuni principale, cu locații
const demoV1 = json("../content/adventures/brasov-centrul-vechi.json"); // 3 provocări, fără locații
const fixture = json("./fixtures/adventure-v2-demo.json"); // misiuni main + bonus + secret

function newGame(source, savedState = null) {
  const content = toAdventureV2(source);
  return createGame({ adventure: withoutAnswers(content), validator: createLocalValidator(content), savedState });
}

const vm = (game) => buildViewModel({ content: game.content, state: game.getState() });
const percentOf = (game) => progressPercent(vm(game).progress);

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

/** Corpul regulii CSS cu selectorul dat exact (prima apariție, în afara @media). */
function rule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(css);
  assert.ok(m, `regula ${selector} lipsește din app.css`);
  return m[1];
}

/* ---------- 1. Normalizarea (play-ui.js) ---------- */

test("0 %: nicio misiune principală închisă", () => {
  assert.equal(progressPercent({ missionsClosed: 0, missionTotal: 4 }), 0);
  assert.equal(progressPercent({ missionsClosed: 0, missionTotal: 1 }), 0);
  assert.equal(clampPercent(0), 0);
});

test("progres intermediar: proporțional, rotunjit la întreg", () => {
  assert.equal(progressPercent({ missionsClosed: 1, missionTotal: 4 }), 25);
  assert.equal(progressPercent({ missionsClosed: 2, missionTotal: 4 }), 50);
  assert.equal(progressPercent({ missionsClosed: 3, missionTotal: 4 }), 75);
  assert.equal(progressPercent({ missionsClosed: 1, missionTotal: 3 }), 33);
  assert.equal(progressPercent({ missionsClosed: 2, missionTotal: 3 }), 67);
  assert.equal(progressPercent({ missionsClosed: 3, missionTotal: 5 }), 60);
});

test("100 %: toate misiunile principale închise", () => {
  assert.equal(progressPercent({ missionsClosed: 4, missionTotal: 4 }), 100);
  assert.equal(progressPercent({ missionsClosed: 1, missionTotal: 1 }), 100);
  assert.equal(clampPercent(100), 100);
});

test("clamp: valorile sub 0 devin 0 %", () => {
  for (const value of [-0.0001, -1, -50, -1e9]) assert.equal(clampPercent(value), 0, String(value));
  assert.equal(progressPercent({ missionsClosed: -2, missionTotal: 4 }), 0);
});

test("clamp: valorile peste 100 devin 100 %", () => {
  for (const value of [100.0001, 101, 250, 1e9]) assert.equal(clampPercent(value), 100, String(value));
  assert.equal(progressPercent({ missionsClosed: 5, missionTotal: 4 }), 100);
});

test("capetele (1 %, 99 %): rotunjirea nu arată 0 % după primul pas și nici 100 % înainte de final", () => {
  assert.equal(clampPercent(0.2), 1);
  assert.equal(clampPercent(0.5), 1);
  assert.equal(clampPercent(1), 1);
  assert.equal(clampPercent(99), 99);
  assert.equal(clampPercent(99.5), 99);
  assert.equal(clampPercent(99.99), 99);
  assert.equal(progressPercent({ missionsClosed: 1, missionTotal: 300 }), 1); // 0,33 %
  assert.equal(progressPercent({ missionsClosed: 299, missionTotal: 300 }), 99); // 99,67 %
});

test("valori invalide: null (bara rămâne ascunsă), niciodată NaN", () => {
  for (const value of [NaN, Infinity, -Infinity, undefined, null, "50", {}, true, [50]]) {
    assert.equal(clampPercent(value), null, String(value));
  }
  const invalid = [
    null,
    undefined,
    {},
    { missionsClosed: 1 },
    { missionTotal: 4 },
    { missionsClosed: NaN, missionTotal: 4 },
    { missionsClosed: "1", missionTotal: 4 },
    { missionsClosed: 1, missionTotal: 0 },
    { missionsClosed: 0, missionTotal: 0 },
    { missionsClosed: 1, missionTotal: -3 },
    { missionsClosed: 1, missionTotal: NaN },
    { missionsClosed: 1, missionTotal: Infinity },
    { missionsClosed: Infinity, missionTotal: 4 },
  ];
  for (const progress of invalid) assert.equal(progressPercent(progress), null, JSON.stringify(progress));
});

test("pentru orice total: un întreg 0–100, monoton, 0 doar la început și 100 doar la final", () => {
  for (let total = 1; total <= 60; total++) {
    let previous = -1;
    for (let closed = -2; closed <= total + 2; closed++) {
      const percent = progressPercent({ missionsClosed: closed, missionTotal: total });
      assert.ok(Number.isInteger(percent) && percent >= 0 && percent <= 100, `${closed}/${total} → ${percent}`);
      assert.ok(percent >= previous, `monoton: ${closed}/${total}`);
      assert.equal(percent === 0, closed <= 0, `0 % ⇔ nimic închis: ${closed}/${total}`);
      assert.equal(percent === 100, closed >= total, `100 % ⇔ totul închis: ${closed}/${total}`);
      previous = percent;
    }
  }
});

/* ---------- 2. Sursa valorii: viewModel.progress (motorul real) ---------- */

test("demo-vertical-slice: procentul urmează misiunile principale închise, de la 0 % la 100 %", async () => {
  const game = newGame(slice);
  const steps = [];
  const record = (step) => {
    const { progress } = vm(game);
    steps.push([step, progress.missionsClosed, progress.missionTotal, progressPercent(progress)]);
  };
  record("idle");
  game.start();
  record("start");
  game.confirmArrival("loc-demo-1");
  record("sosire 1");
  game.next();
  record("puzzle 1 deschis");
  assert.deepEqual(await game.submitAnswer("greșit"), { result: "incorrect" });
  record("răspuns greșit");
  assert.deepEqual(await game.submitAnswer("omed"), { result: "correct" });
  record("puzzle 1 rezolvat");
  game.next();
  game.confirmArrival("loc-demo-2");
  record("sosire 2");
  game.next();
  assert.deepEqual(await game.submitAnswer("2demo"), { result: "correct" });
  record("puzzle 2 rezolvat");
  game.next();
  record("completed");
  assert.deepEqual(steps, [
    ["idle", 0, 4, 0],
    ["start", 0, 4, 0],
    ["sosire 1", 1, 4, 25],
    ["puzzle 1 deschis", 1, 4, 25],
    ["răspuns greșit", 1, 4, 25],
    ["puzzle 1 rezolvat", 2, 4, 50],
    ["sosire 2", 3, 4, 75],
    ["puzzle 2 rezolvat", 4, 4, 100], // încă în joc („Vezi rezultatul”): bara este plină
    ["completed", 4, 4, 100],
  ]);
});

test("misiunile sărite și cele eșuate sunt închise: avansează bara (V1, fără locații)", async () => {
  const game = newGame(demoV1);
  game.start();
  assert.equal(percentOf(game), 0);
  game.skipChallenge();
  assert.equal(percentOf(game), 33);
  game.next();
  assert.equal(percentOf(game), 33);
  game.failChallenge();
  assert.equal(percentOf(game), 67);
  game.next();
  const last = toAdventureV2(demoV1).missions.at(-1);
  assert.deepEqual(await game.submitAnswer(last.answer), { result: "correct" });
  assert.equal(percentOf(game), 100);
  assert.equal(vm(game).progress.missionsClosed, 3);
});

test("doar traseul principal: misiunile bonus / secrete închise nu schimbă bara", () => {
  const game = newGame(fixture);
  game.start();
  const content = game.content;
  const main = content.missions.filter((m) => m.track === "main");
  const others = content.missions.filter((m) => m.track !== "main");
  assert.ok(others.length > 0, "fixture-ul are misiuni în afara traseului principal");
  const state = JSON.parse(JSON.stringify(game.getState()));
  for (const mission of others) state.missions[mission.id].status = "solved";
  const progress = buildViewModel({ content, state }).progress;
  assert.equal(progress.missionTotal, main.length);
  assert.equal(progress.missionsClosed, 0);
  assert.equal(progressPercent(progress), 0);
});

test("missionsClosed folosește aceeași regulă ca motorul (isMissionClosed) și același total ca „Provocarea X din Y”", () => {
  const game = newGame(slice);
  game.start();
  const { progress, mission } = vm(game);
  assert.equal(progress.missionTotal, game.getCurrentMission().total);
  assert.equal(progress.missionTotal, mission.total);
  const viewModelSource = read("../src/js/view-model.js");
  assert.match(viewModelSource, /const missionsClosed = main\.filter\(\(m\) => isMissionClosed\(/);
  assert.equal(viewModelSource.match(/missionsClosed =/g).length, 1, "o singură numărare");
});

test("reîncărcare: bara se reconstruiește din progresul salvat, cu același procent", async () => {
  const game = newGame(slice);
  game.start();
  game.confirmArrival("loc-demo-1");
  game.next();
  await game.submitAnswer("omed");
  const saved = JSON.parse(JSON.stringify(game.getState()));
  const reloaded = newGame(slice, saved);
  assert.equal(percentOf(reloaded), 50);
  assert.deepEqual(vm(reloaded).progress, vm(game).progress);
});

/* ---------- 3. Desenarea: renderProgress din app.js, pe elemente simulate ---------- */

/** Elemente minime: doar ce folosește renderProgress (hidden, style.setProperty, textContent, atribute). */
function fakeElements() {
  const make = () => {
    const attributes = new Map();
    const props = new Map();
    return {
      hidden: true,
      textContent: "",
      style: { setProperty: (name, value) => props.set(name, String(value)), getPropertyValue: (name) => props.get(name) ?? "" },
      setAttribute: (name, value) => attributes.set(name, String(value)),
      getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    };
  };
  return { "progress-meter": make(), "progress-label": make(), "progress-track": make(), "progress-fill": make() };
}

/** renderProgress exact cum este în app.js, legat de elementele simulate și de progressPercent din play-ui.js. */
function loadRenderProgress(elements) {
  const m = /\n  function renderProgress\(progress\) \{\n[\s\S]*?\n  \}\n/.exec(app);
  assert.ok(m, "renderProgress lipsește din app.js");
  const $ = (id) => {
    assert.ok(elements[id], `renderProgress folosește #${id}, care nu este simulat`);
    return elements[id];
  };
  return new Function("$", "progressPercent", `${m[0]}\nreturn renderProgress;`)($, progressPercent);
}

/** Ce arată bara după desenare: aceeași valoare trebuie să apară peste tot. */
function shown(elements) {
  return {
    hidden: elements["progress-meter"].hidden,
    width: elements["progress-meter"].style.getPropertyValue("--progress"),
    label: elements["progress-label"].textContent,
    ariaNow: elements["progress-track"].getAttribute("aria-valuenow"),
  };
}

test("procentul, partea completată și aria-valuenow vin din aceeași valoare, la fiecare schimbare din joc", async () => {
  const elements = fakeElements();
  const renderProgress = loadRenderProgress(elements);
  const game = newGame(slice);
  const seen = [];
  const draw = () => {
    const { progress } = vm(game);
    renderProgress(progress);
    const percent = progressPercent(progress);
    assert.deepEqual(shown(elements), { hidden: false, width: `${percent}%`, label: `${percent}%`, ariaNow: String(percent) });
    seen.push(percent);
  };
  game.subscribe(draw); // același flux ca app.js: desenare după fiecare schimbare de stare
  game.start();
  game.confirmArrival("loc-demo-1");
  game.next();
  await game.submitAnswer("omed");
  game.next();
  game.confirmArrival("loc-demo-2");
  game.next();
  await game.submitAnswer("2demo");
  assert.deepEqual([...new Set(seen)], [0, 25, 50, 75, 100]);
  assert.equal(seen.at(-1), 100);
});

test("valoare invalidă: bara se ascunde, fără NaN în text, lățime sau aria-valuenow", () => {
  const elements = fakeElements();
  const renderProgress = loadRenderProgress(elements);
  renderProgress({ missionsClosed: 2, missionTotal: 4 });
  assert.deepEqual(shown(elements), { hidden: false, width: "50%", label: "50%", ariaNow: "50" });
  for (const progress of [{ missionsClosed: NaN, missionTotal: 4 }, { missionsClosed: 1, missionTotal: 0 }, null]) {
    renderProgress(progress);
    const now = shown(elements);
    assert.equal(now.hidden, true);
    assert.ok(!/NaN|undefined|Infinity/.test(JSON.stringify(now)), JSON.stringify(now));
  }
  renderProgress({ missionsClosed: 5, missionTotal: 4 }); // peste total → 100 %
  assert.deepEqual(shown(elements), { hidden: false, width: "100%", label: "100%", ariaNow: "100" });
  renderProgress({ missionsClosed: -1, missionTotal: 4 }); // sub 0 → 0 %
  assert.deepEqual(shown(elements), { hidden: false, width: "0%", label: "0%", ariaNow: "0" });
});

test("app.js: renderPlay desenează bara din viewModel.progress, fără alt calcul al procentului", () => {
  assert.match(appCode, /import \{[^}]*\bprogressPercent\b[^}]*\} from "\.\/play-ui\.js";/);
  const body = (re, name) => {
    const m = re.exec(appCode);
    assert.ok(m, `${name} lipsește din app.js`);
    return m[1];
  };
  const renderPlay = body(/\n  function renderPlay\(viewModel\) \{([\s\S]*?)\n  \}\n/, "renderPlay");
  const renderProgress = body(/\n  function renderProgress\(progress\) \{([\s\S]*?)\n  \}\n/, "renderProgress");
  assert.match(renderPlay, /renderProgress\(viewModel\.progress\);/);
  // Procentul se calculează doar în play-ui.js: app.js nu împarte, nu înmulțește și nu rotunjește valori de progres.
  assert.equal(appCode.match(/progressPercent\(/g).length, 1);
  assert.doesNotMatch(appCode, /missionsClosed|missionTotal/);
  assert.doesNotMatch(renderPlay + renderProgress, /[*/]\s*100\b|Math\.(round|floor|ceil|min|max)\(/);
});

/* ---------- 4. Structura și stilul (verificări în sursă) ---------- */

test("index.html: bara stă în antetul de progres, după „Provocarea X din Y”, înaintea hărții", () => {
  const play = element("screen-play");
  const at = (id) => play.indexOf(`id="${id}"`);
  assert.ok(at("challenge-progress") < at("progress-meter"));
  assert.ok(at("progress-meter") < at("map-panel"));
  const header = /<div class="play-header">([\s\S]*?)<section id="map-panel"/.exec(play);
  assert.ok(header && header[1].includes('id="progress-meter"'), "bara este în .play-header");
  // Structura: eticheta + pista, cu partea completată în pistă.
  assert.ok(element("progress-meter").includes('id="progress-label"'));
  assert.ok(element("progress-meter").includes('id="progress-track"'));
  assert.ok(element("progress-track").includes('id="progress-fill"'));
  assert.match(openTag("progress-meter"), /\bclass="progress-meter"/);
  assert.match(openTag("progress-track"), /\bclass="progress-track"/);
  assert.match(openTag("progress-fill"), /\bclass="progress-fill"/);
  // Ascunsă până la prima desenare: niciun „NaN%” sau „%” gol înainte de app.js.
  assert.match(openTag("progress-meter"), /\bhidden\b/);
});

test("accesibilitate: un singur progressbar, 0–100, cu nume; procentul vizual nu dublează anunțul", () => {
  assert.equal(html.match(/role="progressbar"/g).length, 1);
  const track = openTag("progress-track");
  assert.match(track, /role="progressbar"/);
  assert.match(track, /aria-valuemin="0"/);
  assert.match(track, /aria-valuemax="100"/);
  assert.match(track, /aria-valuenow="0"/);
  assert.match(track, /aria-label="[^"]+"/);
  assert.match(openTag("progress-label"), /aria-hidden="true"/);
  // Nu este regiune live: schimbările nu se anunță a doua oară (notificările au #notification-live).
  assert.doesNotMatch(element("progress-meter"), /aria-live|role="status"|role="alert"/);
});

test("app.css: lățimea și poziția etichetei folosesc aceeași variabilă --progress", () => {
  assert.match(rule(".progress-fill"), /width:\s*var\(--progress\);/);
  const label = rule(".progress-label");
  assert.match(label, /left:\s*var\(--progress\);/);
  assert.match(label, /transform:\s*translateX\(calc\(-1 \* var\(--progress\)\)\);/);
  assert.match(label, /white-space:\s*nowrap;/);
  assert.match(rule(".progress-meter"), /--progress:\s*0%;/);
  assert.match(rule(".progress-track"), /overflow:\s*hidden;/);
  // Pe toată lățimea antetului, fără lățime fixă (nu poate produce derulare orizontală).
  assert.match(rule(".progress-meter"), /flex:\s*1 1 100%;/);
  assert.doesNotMatch(rule(".progress-meter") + rule(".progress-track") + label, /(?<![-\w])width:\s*\d/);
});

test("poziția etichetei (left: p; translateX(-p)): rămâne în container și deasupra capătului părții completate", () => {
  for (const containerWidth of [288, 328, 343, 640]) { // 320 px, 360 px, 375 px, desktop (fără marginile paginii)
    for (const labelWidth of [17, 24, 34]) { // „0%”, „25%”, „100%” la 0,75rem
      for (let p = 0; p <= 100; p++) {
        const left = (p / 100) * containerWidth - (p / 100) * labelWidth;
        const fillEnd = (p / 100) * containerWidth;
        assert.ok(left >= 0 && left + labelWidth <= containerWidth + 1e-9, `${p}% în ${containerWidth}px`);
        assert.ok(fillEnd >= left - 1e-9 && fillEnd <= left + labelWidth + 1e-9, `${p}%: eticheta acoperă capătul`);
      }
    }
  }
});

test("culorile vin din paleta existentă: partea completată = verdele de succes, pista = gri-ul barelor inactive", () => {
  const fill = /background:\s*(#[0-9a-f]{6});/i.exec(rule(".progress-fill"))[1];
  const track = /background:\s*(#[0-9a-f]{6});/i.exec(rule(".progress-track"))[1];
  assert.notEqual(fill.toLowerCase(), track.toLowerCase());
  assert.match(rule('.feedback[data-kind="correct"]'), new RegExp(`border-color:\\s*${fill}`, "i"));
  assert.match(rule(".gps-hud__bar"), new RegExp(`background:\\s*${track}`, "i"));
});

test("animație discretă doar pe lățime / poziție, oprită cu prefers-reduced-motion", () => {
  assert.match(rule(".progress-fill"), /transition:\s*width 0\.3s ease;/);
  assert.match(rule(".progress-label"), /transition:\s*left 0\.3s ease, transform 0\.3s ease;/);
  const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)].map((m) => m[1]);
  const block = reduced.find((body) => body.includes(".progress-fill"));
  assert.ok(block, "lipsește regula reduced-motion pentru bară");
  assert.match(block, /\.progress-label,\s*\.progress-fill\s*\{\s*transition:\s*none;\s*\}/);
  assert.doesNotMatch(rule(".progress-fill") + rule(".progress-label") + rule(".progress-track"), /animation/);
});
