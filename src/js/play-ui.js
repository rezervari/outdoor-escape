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
  VIEWER: "viewer", // media_viewer (D-073): imaginea / comparația pe tot ecranul, deasupra tuturor
});

/** Straturile deschise acum, de jos în sus (din describePlayUi). */
export function openLayers(playUi) {
  const layers = [];
  if (playUi.puzzle.open) layers.push(Layer.PUZZLE);
  if (playUi.hints.confirming) layers.push(Layer.HINT_CONFIRM);
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
 * Puzzle-ul se arată ca overlay când misiunea are un obiectiv pe hartă; altfel
 * (ex. aventuri V1 fără locații) rămâne în pagină, ca înainte.
 * Media misiunii stă în panoul puzzle-ului (misiuni cu răspuns) sau în pagină (misiuni „location”).
 */
export function describePlayUi(viewModel, { dismissedMissionId = null, hintConfirmMissionId = null, viewerKey = null } = {}) {
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
    cardAction,
    nextKind: next ? next.kind : null,
    isFinish: Boolean(next && next.kind === NextKind.FINISH),
  };
}
