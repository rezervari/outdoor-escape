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

/*
 * Harta (M-003.2 — D-046, D-049-J). Configurație de afișare, separată de logica jocului
 * și de schema aventurii. Schimbarea providerului de tile-uri = altă valoare aici.
 * Nimic de aici nu influențează GPS-ul, progresul sau evenimentele.
 */

/** Versiunea Leaflet inclusă local în src/vendor/leaflet/ (pin exact, D-046). */
export const MAP_LIBRARY_VERSION = "1.9.4";

/**
 * Providerul de tile-uri: OpenStreetMap standard tiles (HTTPS), doar utilizare interactivă
 * normală — fără prefetch, fără descărcare în bloc, fără cache offline (politica OSM).
 * Atribuirea este obligatorie și rămâne vizibilă pe hartă.
 */
export const DEFAULT_MAP_TILES = Object.freeze({
  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
});

/** Valori strict vizuale pentru hartă (docs/12_MAP_SPECIFICATION_M-003.2.md, §5 și §12). */
export const DEFAULT_MAP_VIEW = Object.freeze({
  minZoom: 3,
  fitPadding: 48, // px — marginea la încadrarea obiectivelor
  maxFitZoom: 17, // zoom maxim la încadrările automate
  playerZoom: 17, // „Centrează pe mine” când zoom-ul curent < centerKeepZoomFrom
  centerKeepZoomFrom: 15, // „Centrează pe mine” păstrează zoom-ul curent dacă este cel puțin atât
  accuracyCircleMax: 1000, // m — peste această precizie cercul nu se desenează (limită DOAR de desen)
  tileErrorThreshold: 3, // erori consecutive de tile, fără nicio reușită, până la mesajul „fundal indisponibil”
});

/*
 * Indicatorul GPS de peste hartă (HUD — D-049-F, amendamentul din 2026-10-02).
 * Praguri STRICT de afișare: numărul de bare desenate din `accuracy` (metri). Nu sunt
 * „puterea semnalului” (browserul nu o oferă) și nu au nicio legătură cu pragurile de joc
 * (`settings.gps.maxAccuracy`, raza, histerezisul) sau cu `accuracyCircleMax`.
 * Ordinea contează: primul prag pe care precizia nu îl depășește dă numărul de bare.
 */
export const DEFAULT_GPS_HUD = Object.freeze({
  levels: Object.freeze([
    Object.freeze({ maxAccuracy: 5, bars: 5, tone: "good" }),
    Object.freeze({ maxAccuracy: 10, bars: 4, tone: "good" }),
    Object.freeze({ maxAccuracy: 20, bars: 3, tone: "fair" }),
    Object.freeze({ maxAccuracy: 40, bars: 2, tone: "weak" }),
  ]),
  fallback: Object.freeze({ bars: 1, tone: "poor" }), // precizie peste ultimul prag
});
