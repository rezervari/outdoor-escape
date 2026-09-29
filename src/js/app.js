/*
 * Outdoor Escape — punctul de intrare JavaScript.
 *
 * Leagă modulele între ele și desenează interfața minimă:
 * - content.js — încarcă și validează aventura (JSON din ../content/, schema V1 sau V2);
 * - schema.js  — conversia V1 → V2 și forma normalizată pentru motor;
 * - answers.js — validarea răspunsurilor (D-021);
 * - game.js    — motorul de joc (stări, scor, progres);
 * - storage.js — salvarea progresului în localStorage;
 * - location.js — adaptorul Geolocation API (poziția reală → game.reportPosition).
 *
 * Nu conține logică de joc și nici conținut de joc. Nu calculează distanțe,
 * praguri de precizie sau tranziții GPS: le primește interpretate de la
 * geo.js / game.js (M-003.1).
 * Toate căile sunt relative (D-035).
 */

import { loadAdventure, isValidId } from "./content.js";
import { toAdventureV2 } from "./schema.js";
import { createLocalValidator, withoutAnswers } from "./answers.js";
import { createGame, GameStatus, ChallengeStatus } from "./game.js";
import { createStorage } from "./storage.js";
import { assessFix } from "./geo.js";
import { createLocationTracker, describeLocation, LocationDisplay } from "./location.js";

const APP_NAME = "outdoor-escape";
const DEFAULT_ADVENTURE_ID = "brasov-centrul-vechi";

const PRESENCE_LABELS = {
  inside: "✓ Ai ajuns la obiectiv.",
  near: "Ești aproape de obiectiv.",
  outside: "Mergi spre obiectiv.",
};

const DIFFICULTY_LABELS = { easy: "ușoară", medium: "medie", hard: "dificilă" };

const $ = (id) => document.getElementById(id);

function setStatus(id, text) {
  const element = $(id);
  if (element) element.textContent = text;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    // Ex.: http://192.168.x.x (context nesigur), file://, unele moduri private.
    setStatus("status-sw", window.isSecureContext
      ? "indisponibil în acest browser"
      : "indisponibil (context nesigur — necesită HTTPS sau localhost)");
    return;
  }

  try {
    // Căi relative la src/index.html → src/sw.js, scope src/ (D-035).
    // Nu presupunem că aplicația stă la rădăcina domeniului.
    const registration = await navigator.serviceWorker.register("sw.js", { scope: "./" });
    setStatus("status-sw", "înregistrat (scope: " + new URL(registration.scope).pathname + ")");
  } catch (error) {
    console.warn(`[${APP_NAME}] Înregistrarea service worker-ului a eșuat:`, error);
    setStatus("status-sw", "înregistrare eșuată (aplicația funcționează fără el)");
  }
}

/* ---------- Interfață ---------- */

const SCREENS = ["screen-loading", "screen-error", "screen-start", "screen-play", "screen-end"];

function showScreen(id) {
  for (const screen of SCREENS) $(screen).hidden = screen !== id;
}

function showError(message) {
  $("error-message").textContent = message;
  showScreen("screen-error");
}

// Id-ul aventurii: implicit cea demo; ?adventure=<id> pentru teste.
function requestedAdventureId() {
  const fromQuery = new URLSearchParams(location.search).get("adventure");
  return fromQuery && isValidId(fromQuery) ? fromQuery : DEFAULT_ADVENTURE_ID;
}

function setupGameUi(game, storage) {
  const adventure = game.content; // forma normalizată V2 (fără răspunsuri)
  const meta = adventure.meta;
  let feedback = null; // { kind: "correct" | "incorrect" | "empty" | "skipped" | "failed", text }

  /* --- Locația (M-003.1): browser → location.js → game.reportPosition → geo.js → evenimente --- */

  const isPlaying = () => game.getState().status === GameStatus.PLAYING;

  // Fiecare observație merge nemodificată în motor; tranzițiile le decide geo.js.
  function reportFix(fix) {
    if (!isPlaying()) return; // pe ecranul de start doar afișăm starea GPS
    game.reportPosition(fix);
  }

  const tracker = createLocationTracker({ onFix: reportFix });

  // O misiune nouă poate debloca o locație: ultima poziție cunoscută este evaluată imediat,
  // fără să așteptăm următorul fix (browserul nu trimite poziții la interval fix).
  function reportLastFix() {
    const { status, fix } = tracker.getState();
    if (status === "active" && fix) reportFix(fix);
  }

  function locationDisplay() {
    const { fix } = tracker.getState();
    return describeLocation(tracker.getState(), fix ? assessFix(fix, adventure.settings.gps) : null);
  }

  function renderLocation() {
    const trackerState = tracker.getState();
    const display = locationDisplay();
    const accuracy = trackerState.fix && Number.isFinite(trackerState.fix.accuracy)
      ? `Precizie ~${Math.round(trackerState.fix.accuracy)} m`
      : "";
    const texts = {
      [LocationDisplay.OFF]: ["Locația nu este activată.", ""],
      [LocationDisplay.UNAVAILABLE]: [
        trackerState.reason === "insecure_context"
          ? "Locația nu este disponibilă: pagina trebuie deschisă prin HTTPS."
          : "Acest browser nu oferă acces la locație.",
        "Poți continua cu „Am ajuns” la fiecare obiectiv.",
      ],
      [LocationDisplay.PERMISSION_DENIED]: [
        "Accesul la locație a fost refuzat.",
        "Îl poți permite din setările browserului pentru acest site, apoi apasă „Reîncearcă”. Poți continua și fără GPS, cu „Am ajuns”.",
      ],
      [LocationDisplay.SEARCHING]: ["Caut poziția…", "Poate dura până la un minut, mai ales între clădiri."],
      [LocationDisplay.ERROR]: [
        "⚠️ Poziția nu poate fi determinată acum.",
        "Ieși într-un loc mai deschis sau apasă „Reîncearcă”. Poți continua cu „Am ajuns”.",
      ],
      [LocationDisplay.UNCERTAIN]: [
        "⚠️ Semnal GPS slab",
        `${accuracy} — prea slabă pentru confirmarea automată. Apropie-te de obiectiv sau ieși într-un loc deschis.`,
      ],
      [LocationDisplay.READY]: ["GPS activ", accuracy],
    };
    const [status, detail] = texts[display];
    const panel = $("location-panel");
    panel.dataset.state = display;
    $("location-status").textContent = status;
    $("location-detail").textContent = detail;
    $("location-detail").hidden = !detail;
    $("location-intro").hidden = display !== LocationDisplay.OFF;
    $("location-no-objectives").hidden = adventure.locations.length > 0;
    $("btn-location-start").hidden = display !== LocationDisplay.OFF;
    $("btn-location-retry").hidden = !(display === LocationDisplay.PERMISSION_DENIED || display === LocationDisplay.ERROR);
    $("btn-location-stop").hidden = !trackerState.watching;
    setStatus("status-geo", `${trackerState.status}${trackerState.watching ? " (watchPosition activ)" : ""}${trackerState.reason ? " — " + trackerState.reason : ""}`);
  }

  // Cardul obiectivului misiunii curente. Prezența și sosirea vin din progresul motorului.
  function renderObjective() {
    const current = game.getCurrentMission();
    const locationId = current?.mission.locationId;
    const view = locationId ? game.getLocation(locationId) : null;
    const box = $("objective");
    if (!view || view.progress.status === "locked") {
      box.hidden = true;
      return;
    }
    const { location, progress } = view;
    const arrived = progress.arrivedAt !== null;
    const allowManual = location.fallback?.allowManualConfirmation ?? adventure.settings.gps.allowManualConfirmation;
    const display = locationDisplay();

    box.hidden = false;
    box.dataset.presence = arrived ? "inside" : progress.presence;
    $("objective-name").textContent = location.name || "";
    $("objective-status").textContent = arrived ? PRESENCE_LABELS.inside : PRESENCE_LABELS[progress.presence] || PRESENCE_LABELS.outside;
    const instructions = location.fallback?.instructions || "";
    $("objective-instructions").textContent = instructions;
    $("objective-instructions").hidden = arrived || !instructions;

    let note = "";
    if (!arrived) {
      if (!allowManual) note = "Sosirea se confirmă doar prin GPS.";
      else if (display === LocationDisplay.READY) note = "GPS-ul confirmă automat sosirea. Dacă ești acolo și nu se confirmă, apasă „Am ajuns”.";
      else if (display === LocationDisplay.OFF) note = "Activează locația (mai jos) pentru confirmare automată sau apasă „Am ajuns” când ajungi.";
      else note = "GPS-ul nu poate confirma acum poziția. Dacă ești la obiectiv, apasă „Am ajuns”.";
    }
    $("objective-gps-note").textContent = note;
    $("objective-gps-note").hidden = !note;
    $("btn-arrived").hidden = arrived || !allowManual;
  }

  tracker.subscribe(() => {
    renderLocation();
    if (isPlaying()) renderObjective();
  });

  function renderStart() {
    $("adventure-title").textContent = meta.title;
    $("adventure-description").textContent = meta.description || "";
    $("adventure-city").textContent = meta.city || "—";
    $("adventure-time").textContent = meta.estimatedTime ? `aprox. ${meta.estimatedTime} minute` : "—";
    $("adventure-difficulty").textContent = DIFFICULTY_LABELS[meta.difficulty] || meta.difficulty || "—";
    $("adventure-count").textContent = String(game.getSummary().total); // misiunile principale
    showScreen("screen-start");
  }

  function renderPlay() {
    const current = game.getCurrentMission();
    const { mission: challenge, progress, index, total, isLast } = current;
    const closed = progress.status !== ChallengeStatus.PENDING;
    const isLocationMission = challenge.type === "location"; // se rezolvă doar la sosire

    $("challenge-progress").textContent = `Provocarea ${index + 1} din ${total}`;
    $("current-score").textContent = String(game.getSummary().score);
    $("challenge-title").textContent = challenge.title;
    $("challenge-description").textContent = challenge.briefing;

    // După închiderea provocării (inclusiv după refresh), mesajul vine din progres.
    let message = feedback;
    if (!message && progress.status === ChallengeStatus.SOLVED) {
      message = isLocationMission
        ? { kind: "correct", text: `Ai ajuns la obiectiv! +${challenge.points} puncte.` }
        : { kind: "correct", text: `Corect! +${challenge.points} puncte.` };
    } else if (!message && progress.status === ChallengeStatus.SKIPPED) {
      message = { kind: "skipped", text: "Ai sărit peste această provocare (0 puncte)." };
    } else if (!message && progress.status === ChallengeStatus.FAILED) {
      message = { kind: "failed", text: "Provocarea nu a fost rezolvată (0 puncte)." };
    }
    const feedbackEl = $("feedback");
    feedbackEl.hidden = !message;
    feedbackEl.textContent = message ? message.text : "";
    feedbackEl.dataset.kind = message ? message.kind : "";

    $("answer-form").hidden = closed || isLocationMission;
    $("btn-skip").hidden = closed;
    $("btn-next").hidden = !closed;
    $("btn-next").textContent = isLast ? "Vezi rezultatul" : "Continuă";

    // Indiciile se dezvăluie pe rând; toate cele dezvăluite rămân vizibile.
    const hints = challenge.hints;
    const revealed = hints.slice(0, progress.hintsUsed).map((hint, i) =>
      hints.length === 1 ? `Indiciu: ${hint.text}` : `Indiciul ${i + 1}: ${hint.text}`
    );
    $("hint-area").hidden = hints.length === 0 || closed;
    $("btn-hint").hidden = progress.hintsUsed >= hints.length;
    $("hint-text").hidden = revealed.length === 0;
    $("hint-text").textContent = revealed.join("\n");

    renderObjective();
    showScreen("screen-play");
  }

  function renderEnd() {
    const summary = game.getSummary();
    $("end-score").textContent = `${summary.score} din ${summary.maxScore} puncte`;
    $("end-solved").textContent = `${summary.solved} din ${summary.total}`;
    showScreen("screen-end");
  }

  function render() {
    const { status } = game.getState();
    if (status === GameStatus.PLAYING) renderPlay();
    else if (status === GameStatus.COMPLETED) renderEnd();
    else renderStart();
    $("location-panel").hidden = status === GameStatus.COMPLETED;
    renderLocation();
  }

  function hideResetConfirm() {
    $("reset-confirm").hidden = true;
    $("btn-reset").hidden = false;
  }

  function focusAnswer() {
    const input = $("answer-input");
    if (!input.closest("[hidden]")) input.focus();
  }

  function resetEverything() {
    storage.resetGame(adventure.id);
    feedback = null;
    $("answer-input").value = "";
    hideResetConfirm();
    game.reset();
  }

  // Salvare automată la fiecare schimbare de stare, apoi redesenare.
  game.subscribe((state) => {
    if (state.status === GameStatus.IDLE) storage.resetGame(adventure.id);
    else storage.saveGame(adventure.id, state);
    render();
  });

  $("btn-start").addEventListener("click", () => {
    feedback = null;
    game.start();
    reportLastFix();
    focusAnswer();
  });

  $("answer-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = $("answer-input");
    const button = $("btn-check");
    button.disabled = true;
    // Misiunea este reținută înainte de verificare: un eveniment poate încheia aventura.
    const mission = game.getCurrentMission()?.mission;
    try {
      const { result } = await game.submitAnswer(input.value);
      if (result === "correct") {
        feedback = { kind: "correct", text: `Corect! +${mission.points} puncte.` };
        input.value = "";
      } else if (result === "incorrect") {
        feedback = { kind: "incorrect", text: "Răspuns incorect. Mai încearcă sau folosește indiciul." };
        input.select();
      } else if (result === "empty") {
        feedback = { kind: "empty", text: "Scrie un răspuns înainte de verificare." };
        input.focus();
      }
      render();
      if (result === "correct") $("btn-next").focus();
    } catch (error) {
      console.error(`[${APP_NAME}] Verificarea răspunsului a eșuat:`, error);
      feedback = { kind: "incorrect", text: "Răspunsul nu a putut fi verificat. Încearcă din nou." };
      render();
    } finally {
      button.disabled = false;
    }
  });

  $("btn-hint").addEventListener("click", () => {
    game.useHint();
  });

  $("btn-skip").addEventListener("click", () => {
    feedback = null;
    game.skipChallenge();
  });

  $("btn-next").addEventListener("click", () => {
    feedback = null;
    $("answer-input").value = "";
    game.next();
    reportLastFix();
    focusAnswer();
  });

  $("btn-reset").addEventListener("click", () => {
    $("btn-reset").hidden = true;
    $("reset-confirm").hidden = false;
    $("btn-reset-no").focus();
  });
  $("btn-reset-no").addEventListener("click", hideResetConfirm);
  $("btn-reset-yes").addEventListener("click", resetEverything);

  $("btn-replay").addEventListener("click", resetEverything);

  // Pornirea urmăririi doar la cererea explicită a jucătorului (dialogul de permisiune este al browserului).
  $("btn-location-start").addEventListener("click", () => tracker.start());
  $("btn-location-retry").addEventListener("click", () => tracker.retry());
  $("btn-location-stop").addEventListener("click", () => tracker.stop());

  // „Am ajuns”: același mecanism de sosire ca GPS-ul (game.confirmArrival → arrive → evenimente).
  $("btn-arrived").addEventListener("click", () => {
    const locationId = game.getCurrentMission()?.mission.locationId;
    if (!locationId) return;
    const { accepted, reason } = game.confirmArrival(locationId);
    if (!accepted) console.info(`[${APP_NAME}] Confirmarea manuală nu a fost acceptată: ${reason}`);
  });

  // Curățenie la părăsirea paginii: nu lăsăm un watcher activ. Dacă pagina revine din
  // bfcache (înapoi/înainte), urmărirea pornită anterior de jucător este reluată
  // (permisiunea a fost deja cerută printr-o acțiune explicită).
  let resumeOnShow = false;
  window.addEventListener("pagehide", () => {
    resumeOnShow = tracker.getState().watching;
    tracker.stop();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && resumeOnShow) tracker.start();
    resumeOnShow = false;
  });

  render();
}

async function startGame() {
  showScreen("screen-loading");
  const storage = createStorage();
  setStatus("status-storage", storage.available ? "localStorage" : "indisponibilă (progresul nu se salvează)");

  const adventureId = requestedAdventureId();
  let adventure;
  try {
    // V1 sau V2 în fișier; motorul lucrează cu forma V2 (conversie în memorie — D-038).
    adventure = toAdventureV2(await loadAdventure(adventureId));
  } catch (error) {
    console.error(`[${APP_NAME}] Încărcarea aventurii „${adventureId}” a eșuat:`, error, error.details || "");
    showError(error.name === "AdventureLoadError" ? error.message : "A apărut o eroare neașteptată.");
    return;
  }

  // Motorul primește aventura fără răspunsuri; validarea trece prin validator (D-021).
  const game = createGame({
    adventure: withoutAnswers(adventure),
    validator: createLocalValidator(adventure),
    savedState: storage.loadGame(adventure.id),
  });
  setupGameUi(game, storage);
}

function init() {
  console.info(`[${APP_NAME}] app.js încărcat.`);
  document.documentElement.dataset.js = "loaded";
  setStatus("status-js", "încărcat");
  $("btn-retry").addEventListener("click", () => location.reload());
  registerServiceWorker();
  startGame();
}

// Scripturile type="module" rulează după parsarea documentului.
init();
