/*
 * Outdoor Escape — valori implicite centrale ale motorului.
 *
 * Singurul loc în care sunt definite valorile implicite. Fiecare aventură le
 * poate suprascrie în `settings` (vezi docs/11_ADVENTURE_SCHEMA_V2.md).
 * Valorile GPS sunt confirmate ca implicite configurabile (D-039) și trebuie
 * validate pe teren (Faza 5).
 */

export const DEFAULT_SETTINGS = Object.freeze({
  // Singurul mod de progresie suportat acum: misiunile principale, în ordinea din conținut.
  progression: "linear",
  gps: Object.freeze({
    defaultRadius: 40, // m — raza unei locații fără `radius` propriu
    nearDistance: 150, // m — sub această distanță jucătorul este „aproape”
    maxAccuracy: 60, // m — o poziție cu precizie mai slabă este „incertă” și nu declanșează nimic
    exitMargin: 20, // m — histerezis: ieșirea cere depășirea pragului de intrare cu această marjă
    allowManualConfirmation: true, // „Am ajuns” ca rezervă când GPS-ul nu confirmă (D-006)
  }),
  events: Object.freeze({
    maxChainDepth: 8, // câte niveluri de reacții în lanț sunt permise
  }),
});

/** Setările efective: implicitele, suprascrise câmp cu câmp de `settings` din aventură. */
export function resolveSettings(settings = {}) {
  const source = settings && typeof settings === "object" ? settings : {};
  return {
    progression: source.progression ?? DEFAULT_SETTINGS.progression,
    gps: { ...DEFAULT_SETTINGS.gps, ...(source.gps || {}) },
    events: { ...DEFAULT_SETTINGS.events, ...(source.events || {}) },
  };
}

/**
 * Opțiunile pentru navigator.geolocation.watchPosition (M-003.1).
 * Țin de dispozitiv/browser, nu de aventură, deci nu sunt în `settings`.
 * Pragurile de joc (precizie, rază, histerezis) rămân în DEFAULT_SETTINGS.gps.
 */
export const DEFAULT_GEOLOCATION_OPTIONS = Object.freeze({
  enableHighAccuracy: true, // GPS-ul telefonului, nu doar Wi-Fi/celular (consum mai mare de baterie)
  timeout: 20000, // ms — cât așteaptă browserul o poziție înainte de eroarea TIMEOUT
  maximumAge: 5000, // ms — cât de veche poate fi o poziție din cache-ul browserului
});
