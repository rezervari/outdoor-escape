/*
 * Outdoor Escape — modelul vizual al hărții (M-003.2 — D-048, D-049).
 *
 * Modul PUR de transformare: primește date deja calculate de sistemul existent
 * (game.js / location.js / geo.js, prin app.js) și le traduce, prin tabele fixe,
 * în modelul D-048 transmis lui map.js:
 *
 *   {
 *     player: { fix: { lat, lng, accuracy, timestamp } | null, quality },
 *     locations: [ { id, name, lat, lng, radius, state, visible } ],
 *     currentObjectiveId,
 *   }
 *
 * NU importă game.js, geo.js sau location.js. NU calculează distanțe, praguri,
 * prezență sau raza implicită și NU introduce nicio regulă GPS: raza vine gata
 * calculată de motor (game.getLocation().radiusMeters — D-049-D / R2), iar calitatea
 * este traducerea 1:1 a stării afișate existente (describeLocation — D-049-C).
 * Nu are efecte secundare și nu atinge DOM-ul, Leaflet-ul sau stocarea.
 */

/** Valorile `quality` din contractul D-048. `weak` este valid, dar nu este produs în V1. */
export const MapQuality = Object.freeze({
  VALID: "valid",
  WEAK: "weak",
  UNCERTAIN: "uncertain",
  NONE: "none",
});

/** Stările vizuale ale locațiilor (D-048). */
export const MapLocationState = Object.freeze({
  LOCKED: "locked",
  AVAILABLE: "available",
  NEAR: "near",
  ARRIVED: "arrived",
  COMPLETED: "completed",
});

/**
 * D-049-C: traducerea 1:1 a valorilor `LocationDisplay` (location.js, M-003.1).
 * Orice altă valoare (gps-off, gps-unavailable, gps-permission-denied,
 * gps-searching, gps-error sau necunoscută) → "none".
 */
const QUALITY_BY_DISPLAY = Object.freeze({
  "gps-ready": MapQuality.VALID,
  "gps-uncertain": MapQuality.UNCERTAIN,
});

export function qualityFromDisplay(locationDisplay) {
  return Object.prototype.hasOwnProperty.call(QUALITY_BY_DISPLAY, locationDisplay)
    ? QUALITY_BY_DISPLAY[locationDisplay]
    : MapQuality.NONE;
}

/**
 * D-049-B: traducerea 1:1 a progresului unei locații (game.js) în starea vizuală.
 * Evaluare în ordine; nu interpretează poziția (prezența vine din geo.js / game.js).
 */
export function locationStateFromProgress(progress) {
  const p = progress || {};
  if (p.status === "completed") return MapLocationState.COMPLETED;
  if (p.status === "discovered" || (p.arrivedAt !== null && p.arrivedAt !== undefined)) return MapLocationState.ARRIVED;
  if (p.status === "unlocked" && p.presence === "near") return MapLocationState.NEAR;
  if (p.status === "unlocked") return MapLocationState.AVAILABLE;
  return MapLocationState.LOCKED; // "locked" (inclusiv hiddenUntilDiscovered) sau necunoscut
}

/** Copia observației reținute de location.js (sau null). Nicio filtrare după calitate. */
function copyFix(fix) {
  if (!fix || typeof fix !== "object") return null;
  return { lat: fix.lat, lng: fix.lng, accuracy: fix.accuracy, timestamp: fix.timestamp };
}

/**
 * Construiește modelul D-048.
 *   locations — pentru fiecare locație: vederea motorului { location, progress, radiusMeters }
 *               (game.getLocation), în ordinea din conținut
 *   currentObjectiveLocationId — calculat de app.js cu aceeași condiție ca cardul „Obiectiv”
 *   locationDisplay — rezultatul existent describeLocation(...) (LocationDisplay)
 *   trackerFix — tracker.getState().fix (sau null)
 */
export function buildMapModel({
  locations = [],
  currentObjectiveLocationId = null,
  locationDisplay = null,
  trackerFix = null,
} = {}) {
  const views = Array.isArray(locations) ? locations : [];
  return {
    player: {
      fix: copyFix(trackerFix),
      quality: qualityFromDisplay(locationDisplay),
    },
    locations: views
      .filter((view) => view && view.location)
      .map(({ location, progress, radiusMeters }) => {
        const state = locationStateFromProgress(progress);
        const coordinates = location.coordinates || {};
        return {
          id: location.id,
          name: location.name || "",
          lat: coordinates.lat,
          lng: coordinates.lng,
          radius: radiusMeters ?? null, // raza efectivă a motorului, copiată (fără valoare implicită aici)
          state,
          visible: state !== MapLocationState.LOCKED,
        };
      }),
    currentObjectiveId: currentObjectiveLocationId ?? null,
  };
}
