/*
 * Outdoor Escape — motorul de joc (fără DOM, fără stocare, fără conținut).
 *
 * Stările jocului:  idle → playing → completed
 *
 * Motorul primește:
 * - aventura fără răspunsuri (V1 sau V2; este normalizată cu toAdventureV2);
 * - un validator asincron: check(missionId, input) → Promise<boolean> (D-021);
 * - opțional, o stare salvată (schemaVersion 1 se migrează automat — D-043).
 *
 * Progresul (schemaVersion 2) păstrează stări pe entități, nu o poziție într-o listă:
 * - misiuni:  locked | pending | solved | failed | skipped
 *   (pending = deschisă; solved = singura stare care aduce puncte; failed/skipped închid misiunea);
 * - locații:  locked | unlocked | discovered | completed, plus prezența (outside/near/inside);
 * - parteneri: locked | unlocked; secrete descoperite; regulile de evenimente deja rulate.
 * Traseele sunt separate: main (progresie liniară), bonus și secret (deblocate prin evenimente).
 *
 * Motorul nu redă sunete și nu afișează mesaje: produce „efecte” (takeEffects())
 * pe care interfața le prezintă. Nu știe nimic despre o aventură anume.
 */

import { toAdventureV2 } from "./schema.js";
import { processEvents } from "./events.js";
import { effectiveRadius, evaluateProximity, nextPresence, Presence, Transition, Zone } from "./geo.js";

export const STATE_SCHEMA_VERSION = 2;

export const GameStatus = Object.freeze({
  IDLE: "idle",
  PLAYING: "playing",
  COMPLETED: "completed",
});

/** Stările unei misiuni deschise sau închise (numele păstrat din V1). */
export const ChallengeStatus = Object.freeze({
  PENDING: "pending",
  SOLVED: "solved",
  FAILED: "failed",
  SKIPPED: "skipped",
});

/** Toate stările unei misiuni (V2): ChallengeStatus + locked. */
export const MissionStatus = Object.freeze({ LOCKED: "locked", ...ChallengeStatus });

export const LocationStatus = Object.freeze({
  LOCKED: "locked",
  UNLOCKED: "unlocked",
  DISCOVERED: "discovered",
  COMPLETED: "completed",
});

export const PartnerStatus = Object.freeze({ LOCKED: "locked", UNLOCKED: "unlocked" });

const CLOSED_STATUSES = new Set([ChallengeStatus.SOLVED, ChallengeStatus.FAILED, ChallengeStatus.SKIPPED]);
export const isMissionClosed = (status) => CLOSED_STATUSES.has(status);

const CLOSE_EVENT = {
  [ChallengeStatus.SOLVED]: "mission_completed",
  [ChallengeStatus.FAILED]: "mission_failed",
  [ChallengeStatus.SKIPPED]: "mission_skipped",
};

const MAX_QUEUED_EFFECTS = 50;

const isTimestamp = (value) => typeof value === "number" && Number.isFinite(value);
const mainMissions = (content) => content.missions.filter((mission) => mission.track === "main");

/* ---------- Stare inițială, scor, progres derivat ---------- */

export function createInitialState(adventure) {
  const content = toAdventureV2(adventure);
  const missions = {};
  for (const mission of content.missions) {
    missions[mission.id] = { status: mission.initialStatus, attempts: 0, hintsUsed: 0, startedAt: null, closedAt: null };
  }
  const locations = {};
  for (const location of content.locations) {
    locations[location.id] = { status: location.initialStatus, presence: Presence.OUTSIDE, arrivedAt: null, arrivalSource: null };
  }
  const partners = {};
  for (const partner of content.partners) partners[partner.id] = { status: partner.initialStatus };

  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    adventureId: content.id,
    contentVersion: content.contentVersion ?? null,
    status: GameStatus.IDLE,
    currentMissionId: null,
    missions,
    locations,
    partners,
    secrets: {},
    firedEvents: {},
    score: 0,
    startedAt: null,
    completedAt: null,
    finaleStartedAt: null,
  };
}

/**
 * Scorul, derivat din conținut și progres (valoarea salvată nu este de încredere):
 * puncte ale misiunilor solved + puncte ale secretelor descoperite
 * + award_points din regulile de evenimente deja rulate.
 */
export function calculateScore(adventure, missionsProgress, { secrets = {}, firedEvents = {} } = {}) {
  const content = toAdventureV2(adventure);
  let score = 0;
  for (const mission of content.missions) {
    if (missionsProgress[mission.id]?.status === ChallengeStatus.SOLVED) score += mission.points;
  }
  for (const secret of content.secrets) {
    if (secrets[secret.id]) score += secret.points || 0;
  }
  for (const rule of content.events) {
    if (!Object.prototype.hasOwnProperty.call(firedEvents, rule.id)) continue;
    for (const action of rule.do) {
      if (action.action === "award_points") score += action.points;
    }
  }
  return score;
}

/** Totalul punctelor care se pot obține: toate misiunile, secretele și award_points. */
export function maxScore(adventure) {
  const content = toAdventureV2(adventure);
  const missions = content.missions.reduce((sum, m) => sum + m.points, 0);
  const secrets = content.secrets.reduce((sum, s) => sum + (s.points || 0), 0);
  const awards = content.events.reduce(
    (sum, rule) => sum + rule.do.reduce((acc, a) => acc + (a.action === "award_points" ? a.points : 0), 0),
    0
  );
  return missions + secrets + awards;
}

/** Numărul misiunilor rezolvate pe un traseu (implicit „main”). */
export function countSolved(adventure, missionsProgress, track = "main") {
  return toAdventureV2(adventure).missions.filter(
    (mission) => mission.track === track && missionsProgress[mission.id]?.status === ChallengeStatus.SOLVED
  ).length;
}

/**
 * Obiectele obținute: acțiunile collect_item din regulile deja rulate, în ordinea rulării
 * (apoi ordinea din conținut). Fără duplicate. Derivate, ca scorul: nu se salvează separat.
 */
export function collectedItems(adventure, firedEvents = {}) {
  const content = toAdventureV2(adventure);
  const found = [];
  content.events.forEach((rule, order) => {
    if (!Object.prototype.hasOwnProperty.call(firedEvents, rule.id)) return;
    for (const action of rule.do) {
      if (action.action === "collect_item") found.push({ itemId: action.itemId, at: firedEvents[rule.id], order });
    }
  });
  found.sort((a, b) => a.at - b.at || a.order - b.order);
  const ids = [];
  for (const { itemId } of found) if (!ids.includes(itemId)) ids.push(itemId);
  return ids;
}

/**
 * Listele derivate din progres (nu se salvează separat, ca să existe o singură sursă de adevăr).
 */
export function deriveProgress(adventure, state) {
  const content = toAdventureV2(adventure);
  const byStatus = (status) => content.missions.filter((m) => state.missions[m.id]?.status === status).map((m) => m.id);
  const locationIds = (predicate) => content.locations.filter((l) => state.locations[l.id] && predicate(state.locations[l.id])).map((l) => l.id);
  return {
    status: state.status,
    currentMissionId: state.currentMissionId,
    completedMissions: byStatus(ChallengeStatus.SOLVED),
    failedMissions: byStatus(ChallengeStatus.FAILED),
    skippedMissions: byStatus(ChallengeStatus.SKIPPED),
    openMissions: byStatus(ChallengeStatus.PENDING),
    hintsUsed: content.missions.reduce((sum, m) => sum + (state.missions[m.id]?.hintsUsed || 0), 0),
    unlockedLocations: locationIds((l) => l.status !== LocationStatus.LOCKED),
    visitedLocations: locationIds((l) => l.arrivedAt !== null),
    completedLocations: locationIds((l) => l.status === LocationStatus.COMPLETED),
    discoveredSecrets: content.secrets.filter((s) => state.secrets[s.id]).map((s) => s.id),
    unlockedPartners: content.partners.filter((p) => state.partners[p.id]?.status === PartnerStatus.UNLOCKED).map((p) => p.id),
    triggeredEvents: Object.keys(state.firedEvents),
    collectedItems: collectedItems(content, state.firedEvents),
    score: calculateScore(content, state.missions, state),
  };
}

/* ---------- Migrare și restaurare ---------- */

/**
 * Migrează o stare salvată schemaVersion 1 (currentIndex + challenges) în forma V2.
 * Nu validează identitatea aventurii (vezi restoreState). Rezultatul trece apoi prin sanitizare.
 */
export function migrateStateV1(adventure, saved) {
  const content = toAdventureV2(adventure);
  const state = createInitialState(content);
  if (saved.status === GameStatus.IDLE) return state;

  const main = mainMissions(content);
  const rawIndex = Number.isInteger(saved.currentIndex) ? saved.currentIndex : 0;
  const index = Math.min(Math.max(rawIndex, 0), main.length - 1);
  const old = saved.challenges && typeof saved.challenges === "object" ? saved.challenges : {};

  main.forEach((mission, i) => {
    const entry = old[mission.id] && typeof old[mission.id] === "object" ? old[mission.id] : {};
    let status = Object.values(ChallengeStatus).includes(entry.status) ? entry.status : ChallengeStatus.PENDING;
    // În V1 toate provocările viitoare erau „pending”; în V2 ele sunt încă blocate.
    if (i > index && status === ChallengeStatus.PENDING) status = MissionStatus.LOCKED;
    state.missions[mission.id] = {
      status,
      attempts: Number.isInteger(entry.attempts) && entry.attempts >= 0 ? entry.attempts : 0,
      hintsUsed: entry.hintUsed === true ? 1 : 0,
      startedAt: null,
      closedAt: null,
    };
  });

  state.status = saved.status;
  state.currentMissionId = main[index].id;
  state.startedAt = isTimestamp(saved.startedAt) ? saved.startedAt : null;
  state.completedAt = isTimestamp(saved.completedAt) ? saved.completedAt : null;
  return state;
}

/** Păstrează doar valorile valide pentru entitățile care există în conținut. */
function sanitizeState(content, source) {
  const state = createInitialState(content);
  if (source.status === GameStatus.IDLE) return state;

  for (const mission of content.missions) {
    const entry = source.missions?.[mission.id];
    if (!entry || typeof entry !== "object") continue;
    state.missions[mission.id] = {
      status: Object.values(MissionStatus).includes(entry.status) ? entry.status : mission.initialStatus,
      attempts: Number.isInteger(entry.attempts) && entry.attempts >= 0 ? entry.attempts : 0,
      hintsUsed: Number.isInteger(entry.hintsUsed) ? Math.min(Math.max(entry.hintsUsed, 0), mission.hints.length) : 0,
      startedAt: isTimestamp(entry.startedAt) ? entry.startedAt : null,
      closedAt: isTimestamp(entry.closedAt) ? entry.closedAt : null,
    };
  }
  for (const location of content.locations) {
    const entry = source.locations?.[location.id];
    if (!entry || typeof entry !== "object") continue;
    state.locations[location.id] = {
      status: Object.values(LocationStatus).includes(entry.status) ? entry.status : location.initialStatus,
      presence: Object.values(Presence).includes(entry.presence) ? entry.presence : Presence.OUTSIDE,
      arrivedAt: isTimestamp(entry.arrivedAt) ? entry.arrivedAt : null,
      arrivalSource: typeof entry.arrivalSource === "string" ? entry.arrivalSource : null,
    };
  }
  for (const partner of content.partners) {
    const entry = source.partners?.[partner.id];
    if (entry && Object.values(PartnerStatus).includes(entry.status)) state.partners[partner.id] = { status: entry.status };
  }
  for (const secret of content.secrets) {
    const entry = source.secrets?.[secret.id];
    if (entry && isTimestamp(entry.discoveredAt)) state.secrets[secret.id] = { discoveredAt: entry.discoveredAt };
  }
  for (const rule of content.events) {
    const at = source.firedEvents?.[rule.id];
    if (isTimestamp(at)) state.firedEvents[rule.id] = at;
  }

  const main = mainMissions(content);
  // Progresie liniară: prima misiune principală neînchisă trebuie să fie deschisă
  // (ex. progres V1 migrat în care misiunea curentă era deja sărită).
  if (content.settings.progression === "linear") {
    const frontier = main.find((m) => !isMissionClosed(state.missions[m.id].status));
    if (frontier && state.missions[frontier.id].status === MissionStatus.LOCKED) {
      state.missions[frontier.id].status = ChallengeStatus.PENDING;
    }
  }
  state.status = source.status;
  state.currentMissionId = main.some((m) => m.id === source.currentMissionId)
    ? source.currentMissionId
    : (main.find((m) => !isMissionClosed(state.missions[m.id].status)) || main[main.length - 1]).id;
  state.startedAt = isTimestamp(source.startedAt) ? source.startedAt : null;
  state.completedAt = isTimestamp(source.completedAt) ? source.completedAt : null;
  state.finaleStartedAt = isTimestamp(source.finaleStartedAt) ? source.finaleStartedAt : null;
  state.score = calculateScore(content, state.missions, state);
  return state;
}

/**
 * Reconstruiește o stare validă dintr-o stare salvată (schemaVersion 1 sau 2).
 * Întoarce null dacă starea nu aparține acestei aventuri sau are un format necunoscut
 * (jocul pornește atunci de la zero). Tolerează modificări de conținut: entitățile noi
 * pornesc din starea inițială, cele eliminate sunt ignorate, scorul se recalculează.
 */
export function restoreState(adventure, saved) {
  if (!saved || typeof saved !== "object") return null;
  const content = toAdventureV2(adventure);
  if (saved.adventureId !== content.id) return null;
  if (!Object.values(GameStatus).includes(saved.status)) return null;
  if (saved.schemaVersion === 1) return sanitizeState(content, migrateStateV1(content, saved));
  if (saved.schemaVersion === STATE_SCHEMA_VERSION) return sanitizeState(content, saved);
  return null;
}

/* ---------- Motorul ---------- */

export function createGame({ adventure, validator, savedState = null, now = () => Date.now() }) {
  if (!validator || typeof validator.check !== "function") {
    throw new Error("createGame: lipsește validatorul.");
  }

  const content = toAdventureV2(adventure);
  const main = mainMissions(content);
  const missionById = new Map(content.missions.map((m) => [m.id, m]));
  const locationById = new Map(content.locations.map((l) => [l.id, l]));
  const secretById = new Map(content.secrets.map((s) => [s.id, s]));
  const partnerById = new Map(content.partners.map((p) => [p.id, p]));

  let state = restoreState(content, savedState) || createInitialState(content);
  let checking = false;
  const listeners = new Set();
  let effectsQueue = [];
  // Ultimul `seq` al unui GameEvent: ordinea evenimentelor în această rulare (nu se salvează).
  let lastEventSeq = 0;

  function getState() {
    return structuredClone(state);
  }

  /** `events` — GameEvent-urile tranzacției care a produs starea (fiecare listener primește copia lui). */
  function commit(nextState, events = []) {
    state = nextState;
    for (const listener of listeners) listener(getState(), [...events]);
  }

  function requirePlaying(action) {
    if (state.status !== GameStatus.PLAYING) {
      throw new Error(`${action}: jocul nu este în desfășurare (stare: ${state.status}).`);
    }
  }

  /* --- Mutații pe o copie de lucru (draft). Fiecare întoarce evenimentele produse.
         Toate sunt idempotente: fără schimbare de stare, fără eveniment. --- */

  function unlockLocation(ctx, locationId) {
    const entry = ctx.draft.locations[locationId];
    if (!entry || entry.status !== LocationStatus.LOCKED) return [];
    entry.status = LocationStatus.UNLOCKED;
    return [{ type: "location_unlocked", locationId }];
  }

  function discoverLocation(ctx, locationId, source) {
    const entry = ctx.draft.locations[locationId];
    if (!entry || (entry.status !== LocationStatus.LOCKED && entry.status !== LocationStatus.UNLOCKED)) return [];
    entry.status = LocationStatus.DISCOVERED;
    return [{ type: "location_discovered", locationId, source }, ...checkLocationCompleted(ctx, locationId)];
  }

  /** O locație descoperită devine „completed” când toate misiunile ei sunt închise. */
  function checkLocationCompleted(ctx, locationId) {
    const entry = ctx.draft.locations[locationId];
    if (!entry || entry.status !== LocationStatus.DISCOVERED) return [];
    const open = content.missions.some(
      (m) => m.locationId === locationId && !isMissionClosed(ctx.draft.missions[m.id].status)
    );
    if (open) return [];
    entry.status = LocationStatus.COMPLETED;
    return [{ type: "location_completed", locationId }];
  }

  function unlockMission(ctx, missionId) {
    const entry = ctx.draft.missions[missionId];
    const mission = missionById.get(missionId);
    if (!entry || entry.status !== MissionStatus.LOCKED) return [];
    entry.status = ChallengeStatus.PENDING;
    if (mission.track !== "main" && entry.startedAt === null) entry.startedAt = now();
    const events = [{ type: "mission_unlocked", missionId, locationId: mission.locationId }];
    if (mission.locationId) {
      events.push(...unlockLocation(ctx, mission.locationId));
      // Misiune de tip „location” deblocată după ce jucătorul a ajuns deja acolo.
      if (mission.type === "location" && ctx.draft.locations[mission.locationId]?.arrivedAt !== null) {
        events.push(...closeMission(ctx, missionId, ChallengeStatus.SOLVED));
      }
    }
    return events;
  }

  /** Progresie liniară: prima misiune principală neînchisă devine disponibilă. */
  function unlockNextMain(ctx) {
    if (content.settings.progression !== "linear") return [];
    const frontier = main.find((m) => !isMissionClosed(ctx.draft.missions[m.id].status));
    return frontier ? unlockMission(ctx, frontier.id) : [];
  }

  function closeMission(ctx, missionId, status) {
    const entry = ctx.draft.missions[missionId];
    const mission = missionById.get(missionId);
    if (!entry || entry.status !== ChallengeStatus.PENDING) return [];
    entry.status = status;
    entry.closedAt = now();
    const events = [{ type: CLOSE_EVENT[status], missionId, locationId: mission.locationId }];
    if (mission.track === "main") events.push(...unlockNextMain(ctx));
    if (mission.locationId) events.push(...checkLocationCompleted(ctx, mission.locationId));
    return events;
  }

  function startFinale(ctx) {
    if (ctx.draft.finaleStartedAt !== null) return [];
    ctx.draft.finaleStartedAt = now();
    return [{ type: "finale_started", missionId: content.finale?.missionId }];
  }

  /** Misiunea devine cea curentă (doar misiuni principale). */
  function startMission(ctx, missionId) {
    const entry = ctx.draft.missions[missionId];
    const mission = missionById.get(missionId);
    ctx.draft.currentMissionId = missionId;
    const events = [];
    if (entry.status === ChallengeStatus.PENDING && entry.startedAt === null) {
      entry.startedAt = now();
      events.push({ type: "mission_started", missionId, locationId: mission.locationId });
    }
    if (mission.locationId) events.push(...unlockLocation(ctx, mission.locationId));
    if (content.finale?.missionId === missionId) events.push(...startFinale(ctx));
    return events;
  }

  function arrive(ctx, locationId, source, details = {}) {
    const entry = ctx.draft.locations[locationId];
    const events = [{ type: "player_arrived", locationId, source, ...details }];
    if (entry.arrivedAt === null) {
      entry.arrivedAt = now();
      entry.arrivalSource = source;
    }
    events.push(...discoverLocation(ctx, locationId, source));
    for (const mission of content.missions) {
      if (mission.type === "location" && mission.locationId === locationId) {
        events.push(...closeMission(ctx, mission.id, ChallengeStatus.SOLVED));
      }
    }
    return events;
  }

  function discoverSecret(ctx, secretId) {
    if (ctx.draft.secrets[secretId]) return [];
    const secret = secretById.get(secretId);
    ctx.draft.secrets[secretId] = { discoveredAt: now() };
    return [{ type: "secret_discovered", secretId, locationId: secret.locationId, missionId: secret.missionId }];
  }

  function unlockPartner(ctx, partnerId) {
    const entry = ctx.draft.partners[partnerId];
    const partner = partnerById.get(partnerId);
    if (!entry || entry.status !== PartnerStatus.LOCKED) return [];
    entry.status = PartnerStatus.UNLOCKED;
    return [{ type: "partner_unlocked", partnerId, locationId: partner.locationId, missionId: partner.missionId }];
  }

  function completeAdventure(ctx) {
    if (ctx.draft.status === GameStatus.COMPLETED) return [];
    ctx.draft.status = GameStatus.COMPLETED;
    ctx.draft.completedAt = now();
    return [{ type: "adventure_completed" }];
  }

  /** Acțiunile din regulile de evenimente (lista închisă din events.js). */
  function applyAction(ctx, action) {
    switch (action.action) {
      case "show_message": {
        const message = content.narrator.messages[action.messageId];
        ctx.effects.push({ type: "message", messageId: action.messageId, text: message?.text ?? "", audio: message?.audio ?? null });
        return [];
      }
      case "play_audio":
        ctx.effects.push({ type: "audio", trackId: action.trackId });
        return [];
      case "award_points":
        // Punctele se derivă din regulile rulate (calculateScore); aici doar anunțăm interfața.
        ctx.effects.push({ type: "points", points: action.points, reason: action.reason ?? null });
        return [];
      case "collect_item":
        // Obiectele obținute se derivă din regulile rulate (firedEvents), ca punctele; aici doar anunțăm interfața.
        ctx.effects.push({ type: "item", itemId: action.itemId });
        return [];
      case "unlock_mission": return unlockMission(ctx, action.missionId);
      case "complete_mission": return closeMission(ctx, action.missionId, ChallengeStatus.SOLVED);
      case "fail_mission": return closeMission(ctx, action.missionId, ChallengeStatus.FAILED);
      case "unlock_location": return unlockLocation(ctx, action.locationId);
      case "discover_location": return discoverLocation(ctx, action.locationId, "event");
      case "discover_secret": return discoverSecret(ctx, action.secretId);
      case "unlock_partner": return unlockPartner(ctx, action.partnerId);
      case "start_finale": return startFinale(ctx);
      case "complete_adventure": return completeAdventure(ctx);
      default:
        // Conținutul este validat; o acțiune necunoscută aici înseamnă o eroare de program.
        throw new Error(`Acțiune necunoscută: ${action.action}`);
    }
  }

  /**
   * Execută o schimbare pe o copie a stării, procesează evenimentele (reguli din conținut)
   * și salvează rezultatul o singură dată. `change(ctx)` întoarce evenimentele inițiale
   * sau null (nimic de schimbat → nu se face commit).
   * `cause` — comanda sau observația care a pornit tranzacția (metadata `cause` a GameEvent-urilor).
   */
  function transact(cause, change, base = state) {
    const ctx = { draft: structuredClone(base), effects: [] };
    const initialEvents = change(ctx);
    if (initialEvents === null) return null;
    const result = processEvents(initialEvents, {
      rules: content.events,
      alreadyFired: ctx.draft.firedEvents,
      maxChainDepth: content.settings.events.maxChainDepth,
      now,
      lastSeq: lastEventSeq,
      cause,
      applyAction: (action) => applyAction(ctx, action),
    });
    lastEventSeq += result.events.length;
    Object.assign(ctx.draft.firedEvents, result.fired);
    if (result.truncated) ctx.effects.push({ type: "warning", code: "event_chain_limit" });
    ctx.draft.score = calculateScore(content, ctx.draft.missions, ctx.draft);
    effectsQueue = [...effectsQueue, ...ctx.effects].slice(-MAX_QUEUED_EFFECTS);
    commit(ctx.draft, result.events);
    return result;
  }

  function missionView(missionId) {
    const mission = missionById.get(missionId);
    if (!mission) return null;
    const progress = state.missions[missionId];
    return { mission, progress: { ...progress, hintUsed: progress.hintsUsed > 0 } };
  }

  function getCurrentMission() {
    if (state.status !== GameStatus.PLAYING || !state.currentMissionId) return null;
    const view = missionView(state.currentMissionId);
    const index = main.findIndex((m) => m.id === state.currentMissionId);
    return { ...view, index, total: main.length, isLast: index === main.length - 1 };
  }

  function resolveMissionId(missionId) {
    return missionId ?? state.currentMissionId;
  }

  async function submitMissionAnswer(missionId, input) {
    requirePlaying("submitAnswer");
    const id = resolveMissionId(missionId);
    const mission = missionById.get(id);
    if (!mission) throw new Error(`Misiune necunoscută: ${id}`);
    if (checking || state.missions[id].status !== ChallengeStatus.PENDING || mission.type === "location") {
      return { result: "ignored" };
    }
    if (typeof input !== "string" || input.trim() === "") return { result: "empty" };

    checking = true;
    let correct;
    try {
      correct = await validator.check(id, input);
    } finally {
      checking = false;
    }
    // Starea s-ar fi putut schimba în timpul verificării (ex. reset, eveniment).
    if (state.status !== GameStatus.PLAYING || state.missions[id].status !== ChallengeStatus.PENDING) {
      return { result: "ignored" };
    }

    transact("submit_answer", (ctx) => {
      ctx.draft.missions[id].attempts += 1;
      return correct
        ? closeMission(ctx, id, ChallengeStatus.SOLVED)
        : [{ type: "answer_incorrect", missionId: id, locationId: mission.locationId }];
    });
    return { result: correct ? "correct" : "incorrect" };
  }

  function requestHint(missionId) {
    requirePlaying("useHint");
    const id = resolveMissionId(missionId);
    const mission = missionById.get(id);
    if (!mission || mission.hints.length === 0) return null;
    const entry = state.missions[id];
    if (entry.status === MissionStatus.LOCKED) return null;
    if (entry.hintsUsed < mission.hints.length) {
      transact("request_hint", (ctx) => {
        ctx.draft.missions[id].hintsUsed += 1;
        return [{ type: "hint_requested", missionId: id, locationId: mission.locationId, hintIndex: ctx.draft.missions[id].hintsUsed - 1 }];
      });
    }
    return mission.hints[state.missions[id].hintsUsed - 1].text;
  }

  function closeByPlayer(missionId, status, action) {
    requirePlaying(action);
    const id = resolveMissionId(missionId);
    if (!missionById.has(id) || state.missions[id].status !== ChallengeStatus.PENDING) return;
    transact(status === ChallengeStatus.SKIPPED ? "skip_mission" : "fail_mission", (ctx) => closeMission(ctx, id, status));
  }

  function isLocationEvaluated(location) {
    const entry = state.locations[location.id];
    if (entry.status === LocationStatus.COMPLETED) return false;
    return entry.status !== LocationStatus.LOCKED || location.hiddenUntilDiscovered === true;
  }

  return {
    /** Aventura așa cum a fost primită (compatibilitate). */
    adventure,
    /** Aventura normalizată V2, fără răspunsuri. */
    content,

    getState,

    /**
     * listener(state, events) la fiecare commit (o singură notificare per tranzacție):
     * - state:  instantaneul stării (ca getState());
     * - events: GameEvent-urile produse de acea tranzacție, în ordinea procesării
     *           ([] pentru o tranzacție fără evenimente și pentru reset()).
     * Batch-ul este doar runtime: nu se salvează și nu se reia la abonare sau după reîncărcare.
     * Un listener cu un singur parametru (state) funcționează ca înainte.
     */
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Efectele produse de reguli (mesaje, audio, puncte, avertismente); golește coada. */
    takeEffects() {
      const effects = effectsQueue;
      effectsQueue = [];
      return effects;
    },

    getCurrentMission,

    /** Compatibilitate V1: aceeași informație, cu misiunea în câmpul `challenge`. */
    getCurrentChallenge() {
      const current = getCurrentMission();
      return current && { ...current, challenge: current.mission };
    },

    getMission: missionView,

    /** Misiunile deschise (pending) de pe toate traseele. */
    getOpenMissions() {
      return content.missions.filter((m) => state.missions[m.id].status === ChallengeStatus.PENDING).map((m) => missionView(m.id));
    },

    /**
     * Locația din conținut, progresul ei și raza efectivă (metri) folosită de motor
     * (geo.effectiveRadius — D-049-D / R2; câmp aditiv pentru afișarea pe hartă).
     */
    getLocation(locationId) {
      const location = locationById.get(locationId);
      return location
        ? { location, progress: { ...state.locations[locationId] }, radiusMeters: effectiveRadius(location, content.settings.gps) }
        : null;
    },

    /** score / maxScore (toate punctele care se pot obține) / misiuni principale rezolvate. */
    getSummary() {
      return {
        score: state.score,
        maxScore: maxScore(content),
        solved: countSolved(content, state.missions, "main"),
        total: main.length,
      };
    },

    getProgressSummary() {
      return deriveProgress(content, state);
    },

    start() {
      if (state.status === GameStatus.PLAYING) return;
      const fresh = createInitialState(content);
      fresh.status = GameStatus.PLAYING;
      fresh.startedAt = now();
      transact("start", (ctx) => [{ type: "adventure_started" }, ...startMission(ctx, main[0].id)], fresh);
    },

    /**
     * Verifică răspunsul pentru misiunea curentă.
     * Întoarce { result: "correct" | "incorrect" | "empty" | "ignored" }.
     */
    submitAnswer(input) {
      return submitMissionAnswer(null, input);
    },

    /** Verifică răspunsul pentru orice misiune deschisă (ex. bonus, secret, partener). */
    submitMissionAnswer,

    /** Următorul indiciu al misiunii curente (fără penalizare). Întoarce textul sau null. */
    useHint() {
      return requestHint(null);
    },

    requestHint,

    skipChallenge() {
      closeByPlayer(null, ChallengeStatus.SKIPPED, "skipChallenge");
    },

    failChallenge() {
      closeByPlayer(null, ChallengeStatus.FAILED, "failChallenge");
    },

    skipMission(missionId) {
      closeByPlayer(missionId, ChallengeStatus.SKIPPED, "skipMission");
    },

    failMission(missionId) {
      closeByPlayer(missionId, ChallengeStatus.FAILED, "failMission");
    },

    /** Trece la următoarea misiune principală sau finalizează aventura. */
    next() {
      requirePlaying("next");
      const currentId = state.currentMissionId;
      if (state.missions[currentId].status === ChallengeStatus.PENDING) {
        throw new Error("next: misiunea curentă nu este încă închisă.");
      }
      const index = main.findIndex((m) => m.id === currentId);
      const following = main[index + 1];
      if (following && state.missions[following.id].status === MissionStatus.LOCKED) {
        throw new Error(`next: misiunea „${following.id}” este încă blocată.`);
      }
      transact("next", (ctx) => (following ? startMission(ctx, following.id) : completeAdventure(ctx)));
    },

    /**
     * Primește o observație GPS { lat, lng, accuracy, timestamp? } (de la orice sursă)
     * și produce tranzițiile: aproape / a ajuns / a plecat. O observație „incertă”
     * nu schimbă nimic: interfața poate oferi confirmarea manuală.
     */
    reportPosition(fix) {
      requirePlaying("reportPosition");
      const results = [];
      let uncertain = false;
      let reason = null;
      const pending = [];

      for (const location of content.locations) {
        if (!isLocationEvaluated(location)) continue;
        // Locațiile ascunse încă nedescoperite sunt evaluate, dar nu apar în rezultat
        // (interfața nu trebuie să le poată dezvălui).
        const visible = state.locations[location.id].status !== LocationStatus.LOCKED;
        const proximity = evaluateProximity(location, fix, content.settings.gps);
        if (proximity.zone === Zone.UNCERTAIN) {
          uncertain = true;
          reason = proximity.reason;
          if (visible) results.push({ locationId: location.id, zone: proximity.zone, transitions: [] });
          continue;
        }
        const previous = state.locations[location.id].presence;
        const { presence, transitions } = nextPresence(previous, proximity);
        if (visible) results.push({ locationId: location.id, zone: proximity.zone, distanceMeters: proximity.distanceMeters, presence, transitions });
        if (presence !== previous || transitions.length > 0) pending.push({ location, presence, transitions, proximity });
      }

      if (pending.length > 0) {
        transact("gps_position", (ctx) => {
          const events = [];
          for (const { location, presence, transitions, proximity } of pending) {
            ctx.draft.locations[location.id].presence = presence;
            const details = { distanceMeters: proximity.distanceMeters, accuracyMeters: proximity.accuracyMeters };
            for (const transition of transitions) {
              if (transition === Transition.NEAR) events.push({ type: "player_near_location", locationId: location.id, source: "gps", ...details });
              if (transition === Transition.ARRIVED) events.push(...arrive(ctx, location.id, "gps", details));
              if (transition === Transition.LEFT) events.push({ type: "player_left_area", locationId: location.id, source: "gps", ...details });
            }
          }
          return events;
        });
      }
      return { uncertain, reason, results };
    },

    /**
     * Confirmare manuală „Am ajuns” (rezervă când GPS-ul nu confirmă — D-006).
     * Nu este permisă pentru locații încă blocate (inclusiv cele ascunse).
     */
    confirmArrival(locationId) {
      requirePlaying("confirmArrival");
      const location = locationById.get(locationId);
      if (!location) throw new Error(`Locație necunoscută: ${locationId}`);
      const entry = state.locations[locationId];
      if (entry.status === LocationStatus.LOCKED) return { accepted: false, reason: "locked" };
      if (entry.status === LocationStatus.COMPLETED) return { accepted: false, reason: "completed" };
      const allowed = location.fallback?.allowManualConfirmation ?? content.settings.gps.allowManualConfirmation;
      if (!allowed) return { accepted: false, reason: "manual_not_allowed" };
      if (entry.presence === Presence.INSIDE) return { accepted: false, reason: "already_inside" };
      transact("confirm_arrival", (ctx) => {
        ctx.draft.locations[locationId].presence = Presence.INSIDE;
        return arrive(ctx, locationId, "manual");
      });
      return { accepted: true };
    },

    /** Readuce jocul la starea inițială (idle). Ștergerea din stocare se face în app.js. */
    reset() {
      effectsQueue = [];
      commit(createInitialState(content));
    },
  };
}
