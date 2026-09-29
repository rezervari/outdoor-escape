/*
 * Outdoor Escape — motorul de joc (fără DOM, fără stocare, fără conținut).
 *
 * Stări:  idle → playing → completed
 *
 * Motorul primește:
 * - aventura fără răspunsuri (vezi answers.js: withoutAnswers);
 * - un validator cu interfață asincronă: check(challengeId, input) → Promise<boolean>
 *   (D-021 — motorul nu compară și nu citește răspunsuri);
 * - opțional, o stare salvată anterior.
 *
 * Interfața (app.js) afișează starea și apelează acțiunile.
 * Persistența se face din afară, prin subscribe() (vezi app.js + storage.js).
 *
 * Progresul fiecărei provocări: pending | solved | failed | skipped.
 * - pending: deschisă (se poate răspunde, folosi indiciul, sări, eșua);
 * - solved:  rezolvată corect — singura stare care aduce puncte;
 * - failed:  închisă fără rezolvare (0 puncte); nicio acțiune din interfață
 *            nu o produce încă — pregătită pentru reguli viitoare;
 * - skipped: jucătorul a sărit peste ea (0 puncte, nu este rezolvată).
 * failed și skipped închid provocarea: jocul poate continua.
 * Folosirea indiciului este o dată a provocării, nu o stare (D-030).
 * Scorul = suma punctelor provocărilor rezolvate corect. Fără penalizări (D-025).
 */

export const STATE_SCHEMA_VERSION = 1;

export const GameStatus = Object.freeze({
  IDLE: "idle",
  PLAYING: "playing",
  COMPLETED: "completed",
});

export const ChallengeStatus = Object.freeze({
  PENDING: "pending",
  SOLVED: "solved",
  FAILED: "failed",
  SKIPPED: "skipped",
});

function emptyChallengeProgress() {
  return { status: ChallengeStatus.PENDING, attempts: 0, hintUsed: false };
}

export function createInitialState(adventure) {
  const challenges = {};
  for (const challenge of adventure.challenges) {
    challenges[challenge.id] = emptyChallengeProgress();
  }
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    adventureId: adventure.id,
    status: GameStatus.IDLE,
    currentIndex: 0,
    score: 0,
    challenges,
    startedAt: null,
    completedAt: null,
  };
}

/** Suma punctelor provocărilor rezolvate corect. */
export function calculateScore(adventure, challengesProgress) {
  let score = 0;
  for (const challenge of adventure.challenges) {
    if (challengesProgress[challenge.id]?.status === ChallengeStatus.SOLVED) {
      score += challenge.points;
    }
  }
  return score;
}

export function countSolved(adventure, challengesProgress) {
  return adventure.challenges.filter(
    (challenge) => challengesProgress[challenge.id]?.status === ChallengeStatus.SOLVED
  ).length;
}

/**
 * Reconstruiește o stare validă dintr-o stare salvată.
 * Întoarce null dacă starea salvată nu aparține acestei aventuri sau este
 * într-un format necunoscut (caz în care jocul pornește de la zero).
 * Tolerează modificări de conținut: provocările noi pornesc ca „pending”,
 * cele eliminate sunt ignorate, iar scorul se recalculează din conținut.
 */
export function restoreState(adventure, saved) {
  if (!saved || typeof saved !== "object") return null;
  if (saved.schemaVersion !== STATE_SCHEMA_VERSION) return null;
  if (saved.adventureId !== adventure.id) return null;
  if (!Object.values(GameStatus).includes(saved.status)) return null;

  const state = createInitialState(adventure);
  const savedChallenges = saved.challenges && typeof saved.challenges === "object" ? saved.challenges : {};
  for (const challenge of adventure.challenges) {
    const entry = savedChallenges[challenge.id];
    if (!entry || typeof entry !== "object") continue;
    state.challenges[challenge.id] = {
      status: Object.values(ChallengeStatus).includes(entry.status) ? entry.status : ChallengeStatus.PENDING,
      attempts: Number.isInteger(entry.attempts) && entry.attempts >= 0 ? entry.attempts : 0,
      hintUsed: entry.hintUsed === true,
    };
  }

  const lastIndex = adventure.challenges.length - 1;
  const index = Number.isInteger(saved.currentIndex) ? saved.currentIndex : 0;
  state.currentIndex = Math.min(Math.max(index, 0), lastIndex);
  state.status = saved.status;
  state.startedAt = typeof saved.startedAt === "number" ? saved.startedAt : null;
  state.completedAt = typeof saved.completedAt === "number" ? saved.completedAt : null;
  state.score = calculateScore(adventure, state.challenges);
  return state;
}

export function createGame({ adventure, validator, savedState = null, now = () => Date.now() }) {
  if (!validator || typeof validator.check !== "function") {
    throw new Error("createGame: lipsește validatorul.");
  }

  let state = restoreState(adventure, savedState) || createInitialState(adventure);
  let checking = false;
  const listeners = new Set();

  function commit(nextState) {
    state = nextState;
    for (const listener of listeners) listener(getState());
  }

  function getState() {
    return structuredClone(state);
  }

  function currentChallenge() {
    return adventure.challenges[state.currentIndex];
  }

  function currentProgress() {
    return state.challenges[currentChallenge().id];
  }

  function withChallengeProgress(changes) {
    const id = currentChallenge().id;
    const challenges = { ...state.challenges, [id]: { ...state.challenges[id], ...changes } };
    return { ...state, challenges, score: calculateScore(adventure, challenges) };
  }

  function requirePlaying(action) {
    if (state.status !== GameStatus.PLAYING) {
      throw new Error(`${action}: jocul nu este în desfășurare (stare: ${state.status}).`);
    }
  }

  return {
    adventure,

    getState,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Provocarea curentă, cu progresul ei, sau null dacă jocul nu rulează. */
    getCurrentChallenge() {
      if (state.status !== GameStatus.PLAYING) return null;
      return {
        challenge: currentChallenge(),
        progress: { ...currentProgress() },
        index: state.currentIndex,
        total: adventure.challenges.length,
        isLast: state.currentIndex === adventure.challenges.length - 1,
      };
    },

    getSummary() {
      return {
        score: state.score,
        maxScore: adventure.challenges.reduce((sum, challenge) => sum + challenge.points, 0),
        solved: countSolved(adventure, state.challenges),
        total: adventure.challenges.length,
      };
    },

    start() {
      if (state.status === GameStatus.PLAYING) return;
      const fresh = createInitialState(adventure);
      commit({ ...fresh, status: GameStatus.PLAYING, startedAt: now() });
    },

    /**
     * Verifică răspunsul pentru provocarea curentă.
     * Întoarce { result: "correct" | "incorrect" | "empty" | "ignored" }.
     * „ignored”: provocarea este deja închisă sau o verificare este în curs.
     */
    async submitAnswer(input) {
      requirePlaying("submitAnswer");
      if (checking || currentProgress().status !== ChallengeStatus.PENDING) return { result: "ignored" };
      if (typeof input !== "string" || input.trim() === "") return { result: "empty" };

      const challengeId = currentChallenge().id;
      checking = true;
      let correct;
      try {
        correct = await validator.check(challengeId, input);
      } finally {
        checking = false;
      }
      // Starea s-ar fi putut schimba în timpul verificării (ex. reset).
      if (state.status !== GameStatus.PLAYING || currentChallenge().id !== challengeId ||
          currentProgress().status !== ChallengeStatus.PENDING) {
        return { result: "ignored" };
      }

      const attempts = currentProgress().attempts + 1;
      commit(withChallengeProgress(correct ? { attempts, status: ChallengeStatus.SOLVED } : { attempts }));
      return { result: correct ? "correct" : "incorrect" };
    },

    /** Afișează indiciul provocării curente (fără penalizare). Întoarce textul sau null. */
    useHint() {
      requirePlaying("useHint");
      const hint = currentChallenge().hint;
      if (typeof hint !== "string" || hint === "") return null;
      if (!currentProgress().hintUsed) commit(withChallengeProgress({ hintUsed: true }));
      return hint;
    },

    /** Cale de continuare: sare peste provocarea curentă (skipped, 0 puncte). */
    skipChallenge() {
      requirePlaying("skipChallenge");
      if (currentProgress().status !== ChallengeStatus.PENDING) return;
      commit(withChallengeProgress({ status: ChallengeStatus.SKIPPED }));
    },

    /** Închide provocarea curentă ca nerezolvată (failed, 0 puncte). Nefolosit încă de interfață. */
    failChallenge() {
      requirePlaying("failChallenge");
      if (currentProgress().status !== ChallengeStatus.PENDING) return;
      commit(withChallengeProgress({ status: ChallengeStatus.FAILED }));
    },

    /** Trece la provocarea următoare sau finalizează aventura. */
    next() {
      requirePlaying("next");
      if (currentProgress().status === ChallengeStatus.PENDING) {
        throw new Error("next: provocarea curentă nu este încă închisă.");
      }
      if (state.currentIndex >= adventure.challenges.length - 1) {
        commit({ ...state, status: GameStatus.COMPLETED, completedAt: now() });
      } else {
        commit({ ...state, currentIndex: state.currentIndex + 1 });
      }
    },

    /** Readuce jocul la starea inițială (idle). Ștergerea din stocare se face în app.js. */
    reset() {
      commit(createInitialState(adventure));
    },
  };
}
