/*
 * Outdoor Escape — punctul de intrare JavaScript.
 *
 * Leagă modulele între ele și desenează interfața minimă:
 * - content.js — încarcă și validează aventura (JSON din ../content/, schema V1 sau V2);
 * - schema.js  — conversia V1 → V2 și forma normalizată pentru motor;
 * - answers.js — validarea răspunsurilor (D-021);
 * - game.js    — motorul de joc (stări, scor, progres);
 * - storage.js — salvarea progresului în localStorage.
 *
 * Nu conține logică de joc și nici conținut de joc.
 * Toate căile sunt relative (D-035).
 */

import { loadAdventure, isValidId } from "./content.js";
import { toAdventureV2 } from "./schema.js";
import { createLocalValidator, withoutAnswers } from "./answers.js";
import { createGame, GameStatus, ChallengeStatus } from "./game.js";
import { createStorage } from "./storage.js";

const APP_NAME = "outdoor-escape";
const DEFAULT_ADVENTURE_ID = "brasov-centrul-vechi";

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

    $("challenge-progress").textContent = `Provocarea ${index + 1} din ${total}`;
    $("current-score").textContent = String(game.getSummary().score);
    $("challenge-title").textContent = challenge.title;
    $("challenge-description").textContent = challenge.briefing;

    // După închiderea provocării (inclusiv după refresh), mesajul vine din progres.
    let message = feedback;
    if (!message && progress.status === ChallengeStatus.SOLVED) {
      message = { kind: "correct", text: `Corect! +${challenge.points} puncte.` };
    } else if (!message && progress.status === ChallengeStatus.SKIPPED) {
      message = { kind: "skipped", text: "Ai sărit peste această provocare (0 puncte)." };
    } else if (!message && progress.status === ChallengeStatus.FAILED) {
      message = { kind: "failed", text: "Provocarea nu a fost rezolvată (0 puncte)." };
    }
    const feedbackEl = $("feedback");
    feedbackEl.hidden = !message;
    feedbackEl.textContent = message ? message.text : "";
    feedbackEl.dataset.kind = message ? message.kind : "";

    $("answer-form").hidden = closed;
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
