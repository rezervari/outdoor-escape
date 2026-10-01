/*
 * Outdoor Escape — modelul interfeței de joc (TASK 4, pasul 1).
 *
 * Modul PUR de transformare: primește un instantaneu al motorului
 * (conținutul normalizat V2 — game.content — și starea — game.getState())
 * și întoarce un obiect simplu care spune interfeței CE să arate și CE acțiuni
 * sunt posibile. Nu păstrează stare, nu apelează motorul, nu atinge DOM-ul,
 * stocarea, GPS-ul sau navigarea. Motorul rămâne singura sursă de adevăr:
 *
 *   game.content + game.getState()  →  buildViewModel()  →  model pentru UI
 *
 * Nu introduce stări noi ale jocului sau ale misiunilor (D-030: indiciile sunt
 * doar contorul `hintsUsed`). Răspunsurile nu sunt copiate niciodată în model
 * (D-021); interfața primește oricum conținutul fără răspunsuri (withoutAnswers).
 * Textele pentru jucător nu sunt aici: modelul întoarce valori enumerate.
 *
 * Media misiunii (Challenge System V1, D-072) vine rezolvată de media.js: URL-uri, texte
 * alternative, transcript. Modelul nu știe ce reprezintă imaginile și nici în ce mod de joc
 * (Walk / Bike) este jucată aventura (D-070).
 *
 * Separat de map-model.js, care construiește modelul hărții (D-048).
 */

import { GameStatus, ChallengeStatus, MissionStatus, LocationStatus, isMissionClosed, deriveProgress, maxScore, countSolved, collectedItems } from "./game.js";
import { ANSWER_MISSION_TYPES } from "./schema.js";
import { resolveMissionMedia } from "./media.js";

/** Ce vizualizare corespunde stării motorului. */
export const View = Object.freeze({
  INTRO: "intro", // jocul nu a început (idle)
  TRAVEL: "travel", // misiune „location” deschisă: mergi spre obiectiv
  ARRIVED: "arrived", // misiune „location” închisă: checkpoint atins
  PUZZLE: "puzzle", // misiune cu răspuns deschisă
  SOLVED: "solved", // misiune cu răspuns închisă (solved / skipped / failed)
  COMPLETED: "completed", // aventura s-a încheiat
});

/** Acțiunea principală pe care o poate oferi interfața. */
export const PrimaryAction = Object.freeze({
  START: "start", // game.start()
  CONFIRM_ARRIVAL: "confirm_arrival", // game.confirmArrival(locationId)
  SUBMIT_ANSWER: "submit_answer", // game.submitAnswer(input)
  CONTINUE: "continue", // game.next()
  RESTART: "restart", // game.reset() + ștergerea progresului salvat (app.js)
});

/** Ce urmează după misiunea curentă, când ea este închisă (game.next()). */
export const NextKind = Object.freeze({
  OPEN_PUZZLE: "open_puzzle", // următoarea misiune se rezolvă printr-un răspuns
  GO_TO_LOCATION: "go_to_location", // următoarea misiune este o sosire la o locație
  FINISH: "finish", // nu mai există misiuni principale: next() încheie aventura
});

/** Starea unei opriri din indicatorul de progres. */
export const StopStatus = Object.freeze({
  DONE: "done",
  CURRENT: "current",
  UPCOMING: "upcoming",
});

const isAnswerMission = (mission) => ANSWER_MISSION_TYPES.includes(mission.type);

function manualConfirmationAllowed(content, location) {
  return location.fallback?.allowManualConfirmation ?? content.settings?.gps?.allowManualConfirmation ?? false;
}

/**
 * Obiectivul (locația) misiunii curente. Aceeași condiție ca în app.js: doar dacă
 * misiunea are o locație și locația nu mai este „locked”.
 */
function buildObjective(content, state, mission) {
  if (!mission.locationId) return null;
  const location = content.locations.find((l) => l.id === mission.locationId);
  const progress = state.locations[mission.locationId];
  if (!location || !progress || progress.status === LocationStatus.LOCKED) return null;
  const arrived = progress.arrivedAt !== null;
  const coordinates = location.coordinates;
  return {
    locationId: location.id,
    name: location.name || "",
    type: location.type,
    coordinates: coordinates ? { lat: coordinates.lat, lng: coordinates.lng } : null,
    status: progress.status,
    presence: progress.presence,
    arrived,
    arrivalSource: progress.arrivalSource,
    instructions: location.fallback?.instructions || null,
    manualConfirmationAllowed: manualConfirmationAllowed(content, location),
  };
}

/** Misiunea cu răspuns: întrebarea, starea și indiciile (fără răspuns). */
function buildPuzzle(mission, progress) {
  const hints = mission.hints || [];
  const used = Math.min(progress.hintsUsed, hints.length);
  const pending = progress.status === ChallengeStatus.PENDING;
  return {
    missionId: mission.id,
    type: mission.type,
    title: mission.title,
    question: mission.briefing,
    // Variantele de răspuns afișate ca butoane (mission.choices); null = răspuns tastat.
    choices: Array.isArray(mission.choices) ? [...mission.choices] : null,
    // Tastatura răspunsului tastat (D-072): doar indiciu pentru telefon; verificarea rămâne în answers.js.
    inputMode: mission.inputMode === "numeric" ? "numeric" : "text",
    points: mission.points,
    status: progress.status,
    available: pending,
    solved: progress.status === ChallengeStatus.SOLVED,
    closed: isMissionClosed(progress.status),
    attempts: progress.attempts,
    hints: {
      total: hints.length,
      used,
      remaining: hints.length - used,
      // Indiciile deschise rămân deschise (D-030: hintsUsed doar crește).
      opened: hints.slice(0, used).map((hint, index) => ({ index, text: hint.text })),
      canRequest: pending && used < hints.length,
    },
  };
}

/** Ce urmează după misiunea curentă. Aceeași precondiție ca game.next(). */
function buildNext(state, main, index) {
  const current = main[index];
  const following = main[index + 1] || null;
  const closed = isMissionClosed(state.missions[current.id].status);
  if (!following) return { kind: NextKind.FINISH, missionId: null, locationId: null, available: closed };
  return {
    kind: following.type === "location" ? NextKind.GO_TO_LOCATION : NextKind.OPEN_PUZZLE,
    missionId: following.id,
    locationId: following.locationId ?? null,
    available: closed && state.missions[following.id].status !== MissionStatus.LOCKED,
  };
}

/**
 * Opririle traseului principal: locațiile misiunilor „main”, în ordinea misiunilor.
 * Numele unei locații încă blocate nu este expus.
 */
function buildStops(content, state, currentLocationId) {
  const ids = [];
  for (const mission of content.missions) {
    if (mission.track === "main" && mission.locationId && !ids.includes(mission.locationId)) ids.push(mission.locationId);
  }
  return ids.map((id) => {
    const location = content.locations.find((l) => l.id === id);
    const progress = state.locations[id];
    const locked = !progress || progress.status === LocationStatus.LOCKED;
    let status = StopStatus.UPCOMING;
    if (progress?.status === LocationStatus.COMPLETED) status = StopStatus.DONE;
    else if (id === currentLocationId) status = StopStatus.CURRENT;
    return { locationId: id, name: locked ? null : location?.name || "", status };
  });
}

/**
 * Jurnalul naratorului: mesajele `show_message` ale regulilor deja declanșate.
 * Se derivă din starea salvată (`firedEvents`: id-ul regulii → momentul declanșării),
 * nu din efectele trecătoare ale motorului (takeEffects), deci rezistă la reîncărcare.
 * Ordinea: momentul declanșării, apoi ordinea regulilor și a acțiunilor din conținut.
 * `epilogue` este mesajul `finale.messageId`, doar după încheierea aventurii.
 */
function buildStory(content, state) {
  const messages = content.narrator?.messages || {};
  const fired = state.firedEvents || {};
  const entries = [];
  (content.events || []).forEach((rule, ruleIndex) => {
    const at = fired[rule.id];
    if (at === undefined) return;
    (rule.do || []).forEach((action, actionIndex) => {
      if (action.action !== "show_message") return;
      const text = messages[action.messageId]?.text;
      if (!text) return;
      entries.push({ key: `${rule.id}:${actionIndex}`, messageId: action.messageId, text, at, order: ruleIndex * 1000 + actionIndex });
    });
  });
  entries.sort((a, b) => a.at - b.at || a.order - b.order);
  const finaleId = content.finale?.messageId;
  const epilogue = state.status === GameStatus.COMPLETED && finaleId ? messages[finaleId]?.text || null : null;
  return {
    narratorName: content.narrator?.name || null,
    entries: entries.map(({ key, messageId, text, at }) => ({ key, messageId, text, at })),
    epilogue,
  };
}

/** Obiectele obținute (collect_item), în ordinea obținerii, cu textele din conținut. */
function buildItems(content, state) {
  const byId = new Map((content.items || []).map((item) => [item.id, item]));
  return collectedItems(content, state.firedEvents || {})
    .filter((id) => byId.has(id))
    .map((id) => {
      const item = byId.get(id);
      return { id, name: item.name, description: item.description || null, icon: item.icon || null };
    });
}

/**
 * Construiește modelul interfeței.
 *   content      — aventura normalizată V2 (game.content)
 *   state        — starea motorului (game.getState())
 *   mediaBaseUrl — URL-ul fișierului aventurii, față de care se rezolvă căile media (opțional)
 */
export function buildViewModel({ content, state, mediaBaseUrl = null }) {
  const main = content.missions.filter((m) => m.track === "main");
  const summary = {
    score: state.score,
    maxScore: maxScore(content),
    solved: countSolved(content, state.missions, "main"),
    total: main.length,
    hintsUsed: deriveProgress(content, state).hintsUsed,
  };
  const base = {
    status: state.status,
    view: View.INTRO,
    primaryAction: null,
    mission: null,
    objective: null,
    puzzle: null,
    next: null,
    actions: { confirmArrival: false, submitAnswer: false, requestHint: false, skip: false, continue: false },
    progress: { missionIndex: null, missionTotal: main.length, stops: buildStops(content, state, null) },
    summary,
    story: buildStory(content, state),
    items: buildItems(content, state),
  };

  if (state.status === GameStatus.IDLE) return { ...base, primaryAction: PrimaryAction.START };
  if (state.status === GameStatus.COMPLETED) return { ...base, view: View.COMPLETED, primaryAction: PrimaryAction.RESTART };

  const index = main.findIndex((m) => m.id === state.currentMissionId);
  if (index === -1) return base; // stare imposibilă după restoreState; interfața rămâne neutră
  const mission = main[index];
  const progress = state.missions[mission.id];
  const pending = progress.status === ChallengeStatus.PENDING;
  const objective = buildObjective(content, state, mission);
  const puzzle = isAnswerMission(mission) ? buildPuzzle(mission, progress) : null;
  const next = buildNext(state, main, index);

  let view;
  if (mission.type === "location") view = pending ? View.TRAVEL : View.ARRIVED;
  else view = pending ? View.PUZZLE : View.SOLVED;

  // Aceleași condiții ca game.confirmArrival (fără să o apelăm).
  const canConfirmArrival = Boolean(
    objective && !objective.arrived && objective.manualConfirmationAllowed
      && objective.status !== LocationStatus.COMPLETED && objective.presence !== "inside"
  );

  const actions = {
    confirmArrival: canConfirmArrival,
    submitAnswer: Boolean(puzzle && puzzle.available),
    requestHint: Boolean(puzzle && puzzle.hints.canRequest),
    skip: pending,
    continue: next.available,
  };

  let primaryAction = null;
  if (view === View.TRAVEL) primaryAction = canConfirmArrival ? PrimaryAction.CONFIRM_ARRIVAL : null;
  else if (view === View.PUZZLE) primaryAction = PrimaryAction.SUBMIT_ANSWER;
  else if (next.available) primaryAction = PrimaryAction.CONTINUE;

  return {
    ...base,
    view,
    primaryAction,
    mission: {
      id: mission.id,
      type: mission.type,
      title: mission.title,
      briefing: mission.briefing,
      points: mission.points,
      status: progress.status,
      index,
      total: main.length,
      isLast: index === main.length - 1,
      // Blocurile media ale misiunii (image / compare / audio), rezolvate; [] fără media.
      media: resolveMissionMedia(content, mission.media, { baseUrl: mediaBaseUrl }),
    },
    objective,
    puzzle,
    next,
    actions,
    progress: { missionIndex: index, missionTotal: main.length, stops: buildStops(content, state, objective?.locationId ?? mission.locationId ?? null) },
  };
}
