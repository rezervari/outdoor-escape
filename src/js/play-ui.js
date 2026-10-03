/*
 * Outdoor Escape — prezentarea ecranului de joc (TASK 4, pasul 4).
 *
 * Modul PUR: primește modelul interfeței (view-model.js) și două informații efemere
 * de interfață — misiunea al cărei overlay a fost închis de jucător (dismissedMissionId)
 * și misiunea pentru care se cere confirmarea unui indiciu (hintConfirmMissionId) — și
 * spune ce trebuie arătat: panoul puzzle-ului (overlay sau în pagină), indiciile și
 * acțiunea din cardul obiectivului.
 *
 * A treia informație efemeră (Challenge System V1, D-073): blocul media deschis în viewer
 * (viewerKey). Viewer-ul este generic: arată orice bloc vizual al misiunii curente.
 *
 * Nu apelează motorul, nu atinge DOM-ul și nu păstrează stare. Starea jocului (inclusiv
 * indiciile deschise) vine exclusiv din viewModel; cele două informații efemere nu spun
 * nimic despre joc și nu se salvează. Textele sunt în app.js.
 */

import { View, NextKind } from "./view-model.js";

/** Acțiunea secundară a cardului obiectivului („Am ajuns” are butonul propriu). */
export const CardAction = Object.freeze({
  OPEN_PUZZLE: "open_puzzle", // redeschide overlay-ul puzzle-ului curent (fără apel în motor)
  CONTINUE: "continue", // game.next()
});

/**
 * Indiciile puzzle-ului curent, proiectate din viewModel.puzzle.hints (D-030: `hintsUsed`
 * din motor). `confirming` este singura parte de interfață: confirmarea cerută înainte de
 * deschidere. Ea nu consumă nimic; numai confirmarea finală apelează motorul (app.js).
 */
function describeHints(viewModel, hintConfirmMissionId) {
  const { puzzle, actions, mission } = viewModel;
  const hints = puzzle ? puzzle.hints : null;
  const canRequest = Boolean(actions.requestHint && hints && hints.canRequest);
  return {
    // Zona de indicii: doar cât timp puzzle-ul este activ și are indicii (ca înainte în V1).
    visible: Boolean(puzzle && puzzle.available && hints.total > 0),
    total: hints ? hints.total : 0,
    used: hints ? hints.used : 0,
    remaining: hints ? hints.remaining : 0,
    opened: hints ? hints.opened : [],
    canRequest,
    nextNumber: canRequest ? hints.used + 1 : null, // al câtelea indiciu s-ar deschide
    confirming: Boolean(canRequest && mission && hintConfirmMissionId === mission.id),
  };
}

/* ---------- Back (U2): straturile UI deschise și intrările de istoric ---------- */

/** Straturile UI care se închid cu Back, de jos în sus. */
export const Layer = Object.freeze({
  PUZZLE: "puzzle", // overlay-ul puzzle-ului (doar pentru misiunile cu obiectiv pe hartă)
  HINT_CONFIRM: "hint_confirm", // confirmarea indiciului (D-030), în overlay sau în pagină (V1)
  INBOX: "inbox", // panoul „Mesaje” (M6, D-086): istoricul comunicării, sub viewer
  VIEWER: "viewer", // media_viewer (D-073): imaginea / comparația pe tot ecranul, deasupra tuturor
});

/** Straturile deschise acum, de jos în sus (din describePlayUi). */
export function openLayers(playUi) {
  const layers = [];
  if (playUi.puzzle.open) layers.push(Layer.PUZZLE);
  if (playUi.hints.confirming) layers.push(Layer.HINT_CONFIRM);
  if (playUi.inbox?.open) layers.push(Layer.INBOX);
  if (playUi.viewer?.open) layers.push(Layer.VIEWER);
  return layers;
}

/**
 * După o desenare: câte intrări de istoric trebuie adăugate (`push`) sau retrase (`back`)
 * ca istoricul să aibă exact câte o intrare pentru fiecare strat deschis. null = nimic.
 * Fără straturi deschise nu rămâne nicio intrare: Back revine la navigarea normală.
 */
export function planHistorySync(layerCount, entries) {
  if (layerCount > entries) return { push: layerCount - entries };
  if (layerCount < entries) return { back: entries - layerCount };
  return null;
}

/**
 * La `popstate` (Back / Forward în aceeași pagină): ce straturi se închid, de sus în jos
 * (`close`), sau câte intrări rămase fără strat se retrag (`back`, ex. după Forward). null = nimic.
 */
export function planBack(layers, entries) {
  if (layers.length > entries) return { close: layers.slice(entries).reverse() };
  if (layers.length < entries) return { back: entries - layers.length };
  return null;
}

/**
 *   viewModel             — buildViewModel(...)
 *   dismissedMissionId    — misiunea al cărei overlay a fost închis (sau null)
 *   hintConfirmMissionId  — misiunea pentru care este afișată confirmarea indiciului (sau null)
 *   viewerKey             — cheia blocului media deschis în viewer (sau null)
 *   inboxOpen             — panoul „Mesaje” este deschis (M6; stare efemeră de interfață)
 * Puzzle-ul se arată ca overlay când misiunea are un obiectiv pe hartă; altfel
 * (ex. aventuri V1 fără locații) rămâne în pagină, ca înainte.
 * Media misiunii stă în panoul puzzle-ului (misiuni cu răspuns) sau în pagină (misiuni „location”).
 */
export function describePlayUi(viewModel, { dismissedMissionId = null, hintConfirmMissionId = null, viewerKey = null, inboxOpen = false } = {}) {
  const { view, puzzle, actions, next, objective, mission } = viewModel;
  const overlay = Boolean(puzzle && objective);
  const dismissed = Boolean(overlay && mission && dismissedMissionId === mission.id);
  const visible = Boolean(puzzle) && !dismissed;

  let cardAction = null;
  if (view === View.ARRIVED && actions.continue) cardAction = CardAction.CONTINUE;
  else if (dismissed && actions.submitAnswer) cardAction = CardAction.OPEN_PUZZLE;
  else if (dismissed && actions.continue) cardAction = CardAction.CONTINUE;

  const blocks = mission?.media || [];
  const placement = puzzle ? "puzzle" : "page";
  const mediaVisible = blocks.length > 0 && (placement === "page" || visible);
  // Viewer-ul se deschide doar pentru un bloc vizual al misiunii curente, vizibil acum.
  const viewerBlock = mediaVisible && viewerKey ? blocks.find((block) => block.key === viewerKey && block.viewable) || null : null;

  return {
    media: { placement, visible: mediaVisible, blocks },
    viewer: { open: Boolean(viewerBlock), block: viewerBlock },
    puzzle: {
      visible,
      mode: overlay ? "overlay" : "inline",
      open: overlay && visible, // overlay-ul acoperă scena (harta rămâne dedesubt)
      title: puzzle ? puzzle.title : null,
      question: puzzle ? puzzle.question : null,
      locationName: overlay ? objective.name : null,
      status: puzzle ? puzzle.status : null,
      solved: Boolean(puzzle && puzzle.solved),
      showForm: actions.submitAnswer,
      inputMode: puzzle ? puzzle.inputMode : "text",
      showContinue: actions.continue,
    },
    hints: describeHints(viewModel, hintConfirmMissionId),
    // Panoul „Mesaje” există cât timp există o parcurgere (în joc sau încheiată), nu pe ecranul de start.
    inbox: { open: Boolean(inboxOpen) && view !== View.INTRO },
    cardAction,
    nextKind: next ? next.kind : null,
    isFinish: Boolean(next && next.kind === NextKind.FINISH),
  };
}

/** Acțiunea butonului din indicatorul GPS: metoda existentă a adaptorului location.js. */
export const GpsHudAction = Object.freeze({
  START: "start", // tracker.start()
  RETRY: "retry", // tracker.retry()
});

/**
 * Valorile `LocationDisplay` (location.js) folosite de indicator — aceleași șiruri, ca traducerea
 * din map-model.js (D-049-C); modulul rămâne fără alte importuri.
 */
const GPS_OFF = "gps-off";
const GPS_SEARCHING = "gps-searching";
const GPS_ERROR = "gps-error";
const GPS_PERMISSION_DENIED = "gps-permission-denied";
const GPS_UNCERTAIN = "gps-uncertain";
const GPS_READY = "gps-ready";

/**
 * Numărul de bare (0–5) și tonul lor, DOAR din `accuracy`.
 *   hud — pragurile de afișare (app.js: DEFAULT_GPS_HUD din defaults.js)
 */
export function gpsHudLevel(accuracy, hud) {
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy < 0) return { bars: 0, tone: "none" };
  const level = hud.levels.find((l) => accuracy <= l.maxAccuracy) || hud.fallback;
  return { bars: level.bars, tone: level.tone };
}

/**
 * Indicatorul GPS de peste hartă (HUD — D-049-F, amendamentul din 2026-10-02). Pur vizual:
 * traduce starea afișată existentă (describeLocation → LocationDisplay) și precizia ultimei
 * observații reținute de location.js. Nu introduce o a doua stare GPS și nu decide nimic
 * despre joc. Textele sunt în app.js.
 *   display — LocationDisplay (app.js: locationDisplay())
 *   fix     — tracker.getState().fix (sau null)
 *   hud     — pragurile de afișare (DEFAULT_GPS_HUD), separate de pragurile de joc
 */
export function describeGpsHud(display, fix, hud) {
  const located = display === GPS_READY || display === GPS_UNCERTAIN;
  const accuracy = located && fix && typeof fix.accuracy === "number" && Number.isFinite(fix.accuracy) && fix.accuracy >= 0
    ? Math.round(fix.accuracy)
    : null;
  const { bars, tone } = located ? gpsHudLevel(fix ? fix.accuracy : NaN, hud) : { bars: 0, tone: "none" };
  let action = null;
  if (display === GPS_OFF) action = GpsHudAction.START;
  else if (display === GPS_PERMISSION_DENIED || display === GPS_ERROR) action = GpsHudAction.RETRY;
  return {
    state: display,
    bars,
    tone,
    accuracy, // metri rotunjiți, sau null (fără poziție / precizie necunoscută)
    searching: display === GPS_SEARCHING,
    action, // gps-unavailable: niciun buton (API indisponibil sau context nesigur)
  };
}

/* ---------- Bara de progres (M7-C) ---------- */

/**
 * Normalizează un procent pentru afișare: întreg între 0 și 100. Rotunjirea nu ajunge la capete
 * decât dacă valoarea chiar este acolo (0,4 → 1, 99,6 → 99): bara nu pare goală după primul pas
 * și nu pare completă înainte de final. Valoare nenumerică sau nefinită → null (nu se afișează).
 */
export function clampPercent(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  if (value <= 0) return 0;
  if (value >= 100) return 100;
  return Math.min(99, Math.max(1, Math.round(value)));
}

/**
 * Procentul barei de progres, din viewModel.progress: misiunile principale închise (`missionsClosed`)
 * din total (`missionTotal`). Singura valoare folosită de app.js pentru lățimea părții completate,
 * poziția etichetei, textul „N%” și aria-valuenow. null = nu există o valoare validă (bara rămâne
 * ascunsă, ca înainte de M7-C); fără NaN.
 */
export function progressPercent(progress) {
  const closed = progress ? progress.missionsClosed : undefined;
  const total = progress ? progress.missionTotal : undefined;
  if (typeof closed !== "number" || !Number.isFinite(closed)) return null;
  if (typeof total !== "number" || !Number.isFinite(total) || total <= 0) return null;
  return clampPercent((closed / total) * 100);
}
