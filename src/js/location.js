/*
 * Outdoor Escape — adaptorul pentru Browser Geolocation API (M-003.1).
 *
 * Singurul modul care atinge navigator.geolocation. Responsabilități:
 * - verifică disponibilitatea API-ului (inclusiv contextul securizat);
 * - pornește / oprește urmărirea (watchPosition / clearWatch), fără porniri multiple;
 * - transformă GeolocationPosition în observația cerută de geo.js:
 *     { lat, lng, accuracy, timestamp }
 * - transmite fiecare observație mai departe (onFix), FĂRĂ să o interpreteze;
 * - expune starea tehnică pentru interfață și tratează erorile (cu retry).
 *
 * NU calculează distanțe, raze, praguri de precizie sau tranziții: acestea
 * sunt în geo.js (modelul) și game.js (reportPosition). NU știe nimic despre
 * o aventură anume. Nu salvează coordonatele (D-043).
 *
 * API-ul browserului se poate injecta (`geolocation`), deci modulul se testează
 * în Node cu un mock minimal.
 */

import { DEFAULT_GEOLOCATION_OPTIONS } from "./defaults.js";

/** Starea tehnică a urmăririi. */
export const TrackerStatus = Object.freeze({
  IDLE: "idle", // neactivată (sau oprită)
  UNSUPPORTED: "unsupported", // API indisponibil în acest mediu
  SEARCHING: "searching", // urmărirea a pornit, încă nu a sosit nicio poziție
  ACTIVE: "active", // cel puțin o poziție primită; urmărirea continuă
  ERROR: "error", // poziție indisponibilă / timeout; urmărirea continuă, retry posibil
  DENIED: "denied", // permisiune refuzată; urmărirea este oprită
});

/** Codurile GeolocationPositionError (valori standard). */
const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

/** Marcaj intern: watchPosition este chiar acum în curs de apel. */
const PENDING = Symbol("pending");

const ERROR_NAMES = { [PERMISSION_DENIED]: "permission_denied", [POSITION_UNAVAILABLE]: "position_unavailable", [TIMEOUT]: "timeout" };

/**
 * Starea afișată jucătorului — combină starea tehnică (acest modul) cu evaluarea
 * observației făcută de geo.js (assessFix). Nu conține praguri proprii.
 */
export const LocationDisplay = Object.freeze({
  OFF: "gps-off",
  UNAVAILABLE: "gps-unavailable",
  PERMISSION_DENIED: "gps-permission-denied",
  SEARCHING: "gps-searching",
  ERROR: "gps-error",
  UNCERTAIN: "gps-uncertain",
  READY: "gps-ready",
});

/** GeolocationPosition → observație pentru geo.js, sau null dacă lipsesc coordonatele. */
export function positionToFix(position) {
  const coords = position && position.coords;
  if (!coords || typeof coords.latitude !== "number" || typeof coords.longitude !== "number") return null;
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: typeof coords.accuracy === "number" ? coords.accuracy : NaN, // lipsă → geo.js o tratează ca incertă
    timestamp: typeof position.timestamp === "number" ? position.timestamp : Date.now(),
  };
}

/** De ce nu se poate folosi API-ul (sau null dacă se poate). */
export function unavailableReason({ geolocation, secureContext }) {
  if (secureContext === false) return "insecure_context";
  if (!geolocation || typeof geolocation.watchPosition !== "function") return "no_geolocation";
  return null;
}

function defaultGeolocation() {
  try {
    return globalThis.navigator ? globalThis.navigator.geolocation || null : null;
  } catch {
    return null;
  }
}

/**
 * Creează adaptorul.
 *   geolocation   — implicit navigator.geolocation (injectabil pentru teste)
 *   secureContext — implicit globalThis.isSecureContext (undefined în Node = necunoscut)
 *   options       — suprascrie DEFAULT_GEOLOCATION_OPTIONS (enableHighAccuracy, timeout, maximumAge)
 *   onFix(fix)    — primește fiecare observație validă, nemodificată
 */
export function createLocationTracker({
  geolocation = defaultGeolocation(),
  secureContext = globalThis.isSecureContext,
  options = {},
  onFix = () => {},
} = {}) {
  const watchOptions = { ...DEFAULT_GEOLOCATION_OPTIONS, ...options };
  const listeners = new Set();
  let watchId = null;
  let generation = 0; // ignoră callback-uri întârziate de la o urmărire deja oprită
  let state = { status: TrackerStatus.IDLE, reason: null, error: null, fix: null };

  function setState(patch) {
    state = { ...state, ...patch };
    const snapshot = getState();
    for (const listener of listeners) listener(snapshot);
  }

  function getState() {
    return { ...state, fix: state.fix ? { ...state.fix } : null, watching: watchId !== null && watchId !== PENDING, options: { ...watchOptions } };
  }

  function clear() {
    if (watchId !== null && watchId !== PENDING) {
      try {
        geolocation.clearWatch(watchId);
      } catch (error) {
        console.warn("[outdoor-escape] clearWatch a eșuat:", error);
      }
    }
    watchId = null;
    generation += 1;
  }

  function handlePosition(token, position) {
    if (token !== generation) return;
    const fix = positionToFix(position);
    if (!fix) return; // poziție fără coordonate: nimic de transmis
    setState({ status: TrackerStatus.ACTIVE, reason: null, error: null, fix });
    try {
      onFix(fix);
    } catch (error) {
      // O eroare în consumator nu trebuie să oprească urmărirea.
      console.error("[outdoor-escape] Procesarea poziției a eșuat:", error);
    }
  }

  function handleError(token, error) {
    if (token !== generation) return;
    const code = error && error.code;
    const name = ERROR_NAMES[code] || "unknown";
    if (code === PERMISSION_DENIED) {
      clear(); // fără permisiune urmărirea nu mai are sens; retry o repornește
      setState({ status: TrackerStatus.DENIED, reason: name, error: name, fix: null });
      return;
    }
    // POSITION_UNAVAILABLE / TIMEOUT: urmărirea rămâne activă; browserul poate reveni cu poziții.
    setState({ status: TrackerStatus.ERROR, reason: name, error: name });
  }

  function start() {
    if (watchId !== null) return false; // fără watchers multipli
    const reason = unavailableReason({ geolocation, secureContext });
    if (reason) {
      setState({ status: TrackerStatus.UNSUPPORTED, reason, error: null, fix: null });
      return false;
    }
    generation += 1;
    const token = generation;
    let id;
    watchId = PENDING; // blochează un start() reintrant în timpul apelului
    setState({ status: TrackerStatus.SEARCHING, reason: null, error: null, fix: null });
    try {
      id = geolocation.watchPosition(
        (position) => handlePosition(token, position),
        (error) => handleError(token, error),
        watchOptions
      );
    } catch (error) {
      console.warn("[outdoor-escape] watchPosition a eșuat:", error);
      watchId = null;
      setState({ status: TrackerStatus.ERROR, reason: "unknown", error: "unknown", fix: null });
      return false;
    }
    if (token !== generation) {
      // Urmărirea a fost oprită chiar în timpul apelului (ex. refuz memorat, raportat sincron).
      try {
        geolocation.clearWatch(id);
      } catch {
        /* nimic de făcut */
      }
      return true;
    }
    watchId = id;
    setState({}); // notifică `watching: true`
    return true;
  }

  function stop() {
    const wasActive = watchId !== null || state.status !== TrackerStatus.IDLE;
    clear();
    if (wasActive) setState({ status: TrackerStatus.IDLE, reason: null, error: null, fix: null });
  }

  return {
    /** true dacă API-ul poate fi folosit în acest mediu. */
    get supported() {
      return unavailableReason({ geolocation, secureContext }) === null;
    },

    getState,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /**
     * Pornește urmărirea. Întoarce true dacă a pornit acum, false dacă rula deja
     * sau API-ul nu este disponibil. Trebuie apelată dintr-o acțiune a utilizatorului
     * la prima folosire (dialogul de permisiune este al browserului).
     */
    start,

    /** Oprește urmărirea și uită ultima poziție. Sigur de apelat oricând. */
    stop,

    /** Oprește și repornește urmărirea (după eroare sau permisiune schimbată). */
    retry() {
      stop();
      return start();
    },
  };
}

/**
 * Starea de afișat: starea tehnică + evaluarea ultimei observații de către geo.js.
 *   trackerState — tracker.getState()
 *   quality      — geo.assessFix(fix, gps) pentru ultima observație, sau null
 */
export function describeLocation(trackerState, quality) {
  switch (trackerState.status) {
    case TrackerStatus.UNSUPPORTED: return LocationDisplay.UNAVAILABLE;
    case TrackerStatus.DENIED: return LocationDisplay.PERMISSION_DENIED;
    case TrackerStatus.SEARCHING: return LocationDisplay.SEARCHING;
    case TrackerStatus.ERROR: return LocationDisplay.ERROR;
    case TrackerStatus.ACTIVE:
      if (!quality) return LocationDisplay.SEARCHING;
      return quality.usable ? LocationDisplay.READY : LocationDisplay.UNCERTAIN;
    default: return LocationDisplay.OFF;
  }
}
