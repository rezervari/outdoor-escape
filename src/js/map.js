/*
 * Outdoor Escape — harta (M-003.2 — D-046, D-047, D-049).
 *
 * Strat EXCLUSIV VIZUAL: singurul modul care folosește Leaflet. Desenează modelul
 * D-048 primit de la app.js (construit de map-model.js) și nimic altceva.
 *
 * NU accesează API-ul de geolocație al browserului, NU apelează motorul de joc
 * (nici raportarea poziției, nici confirmarea sosirii), NU interpretează poziția,
 * NU calculează distanțe, praguri, rază implicită sau progres și NU scrie în stocare.
 * Stările (`state`, `quality`) vin gata traduse și sunt doar desenate.
 *
 * Leaflet 1.9.4 este inclus local (src/vendor/leaflet/, încărcat de index.html ca
 * `window.L`) și este citit doar în createMap; se poate injecta (`leaflet`) pentru teste.
 * Dacă harta eșuează, jocul continuă ca în M-003.1 (app.js prinde MapError).
 *
 * API (D-047):
 *   const map = createMap({ container, tileConfig, view?, leaflet? })
 *   map.updatePlayer(fix, quality)
 *   map.updateLocations(locations)
 *   map.setCurrentObjective(locationId)
 *   map.fitToAdventure(locations)   → true | false
 *   map.centerOnPlayer()            → true | false
 *   map.destroy()
 * Politica de viewport: docs/12_MAP_SPECIFICATION_M-003.2.md, §5.
 */

import { DEFAULT_MAP_VIEW, MAP_LIBRARY_VERSION } from "./defaults.js";

export class MapError extends Error {
  /** code: "leaflet_unavailable" | "invalid_container" | "invalid_tile_config" */
  constructor(code, message) {
    super(message || code);
    this.name = "MapError";
    this.code = code;
  }
}

const PLAYER_PANE = "oePlayerPane";

// Texte de interfață (nu conținut de aventură).
const STATE_TEXT = {
  available: "",
  near: "ești aproape",
  arrived: "ai ajuns",
  completed: "finalizat",
};

const STATE_SYMBOL = { available: "", near: "", arrived: "✓", completed: "✓" };

// Stilurile de redare ale jucătorului (§2.3). Rândul se alege doar din `quality` + existența fix-ului.
const PLAYER_STYLES = {
  valid: {
    marker: { color: "#ffffff", weight: 3, fillColor: "#1a5fb4", fillOpacity: 1, opacity: 1 },
    circle: { color: "#1a5fb4", weight: 1, opacity: 0.6, fillColor: "#1a5fb4", fillOpacity: 0.1, dashArray: null },
  },
  uncertain: {
    marker: { color: "#1a5fb4", weight: 3, fillColor: "#ffffff", fillOpacity: 1, opacity: 1 },
    circle: { color: "#1a5fb4", weight: 2, opacity: 0.6, fillColor: "#1a5fb4", fillOpacity: 0.06, dashArray: "6 6" },
  },
  stale: {
    marker: { color: "#6b6b6b", weight: 3, fillColor: "#ffffff", fillOpacity: 1, opacity: 1 },
    circle: null, // ultima poziție reținută, calitate „none”: fără cerc (D-049-C2)
  },
};

const OBJECTIVE_CIRCLE_STYLE = {
  color: "#1d6b36",
  weight: 2,
  opacity: 0.9,
  dashArray: "6 6",
  fillColor: "#1d6b36",
  fillOpacity: 0.08,
  interactive: false,
};

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function isDrawablePoint(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/** Rândul de redare al jucătorului: `weak` se desenează exact ca `uncertain` (D-049-C). */
function playerStyleKey(quality) {
  if (quality === "valid") return "valid";
  if (quality === "uncertain" || quality === "weak") return "uncertain";
  return "stale";
}

function locationLabel(name, state, isCurrent) {
  const suffix = STATE_TEXT[state] ? ` — ${STATE_TEXT[state]}` : "";
  if (isCurrent) return `Obiectivul curent: ${name}${suffix}`;
  if (state === "completed") return `Obiectiv finalizat: ${name}`;
  return `Obiectiv: ${name}${suffix}`;
}

function isValidContainer(container) {
  if (!container || typeof container !== "object" || container.nodeType !== 1) return false;
  if (container.isConnected === false) return false;
  if (container.dataset && container.dataset.oeMap === "active") return false; // are deja o hartă
  if (container._leaflet_id !== undefined) return false;
  return true;
}

function prefersReducedMotion() {
  try {
    return typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/**
 * Pointer principal tactil (telefon / tabletă): un deget derulează pagina, harta se mută cu două
 * degete (TouchZoom nativ Leaflet). Fără `matchMedia` (ex. Node) → false: comportamentul anterior.
 */
function prefersCoarsePointer() {
  try {
    return typeof globalThis.matchMedia === "function" && globalThis.matchMedia("(pointer: coarse)").matches === true;
  } catch {
    return false;
  }
}

export function createMap({ container, tileConfig, view = DEFAULT_MAP_VIEW, leaflet = globalThis.L } = {}) {
  const L = leaflet;
  if (!L || typeof L.map !== "function" || typeof L.tileLayer !== "function" || typeof L.divIcon !== "function") {
    throw new MapError("leaflet_unavailable", "Leaflet nu este încărcat.");
  }
  if (!isValidContainer(container)) {
    throw new MapError("invalid_container", "Containerul hărții lipsește, nu este în pagină sau are deja o hartă.");
  }
  const tiles = tileConfig || {};
  if (typeof tiles.urlTemplate !== "string" || !tiles.urlTemplate.startsWith("https://")
    || typeof tiles.attribution !== "string" || tiles.attribution.trim() === "") {
    throw new MapError("invalid_tile_config", "Configurația tile-urilor trebuie să aibă urlTemplate HTTPS și atribuire.");
  }
  const cfg = { ...DEFAULT_MAP_VIEW, ...(view || {}) };
  if (L.version && L.version !== MAP_LIBRARY_VERSION) {
    console.warn(`[outdoor-escape] Leaflet ${L.version} încărcat; versiunea fixată este ${MAP_LIBRARY_VERSION}.`);
  }

  const reduced = prefersReducedMotion();
  const map = L.map(container, {
    zoomControl: true,
    attributionControl: true,
    dragging: !prefersCoarsePointer(), // touch: fără pan cu un deget → touch-action: pan-x pan-y (vendor CSS)
    touchZoom: true, // NU "center": păstrează pan-ul cu două degete
    doubleClickZoom: true,
    keyboard: true,
    scrollWheelZoom: false,
    boxZoom: false,
    minZoom: cfg.minZoom,
    maxZoom: tiles.maxZoom,
    zoomAnimation: !reduced,
    fadeAnimation: !reduced,
    markerZoomAnimation: !reduced,
  });
  if (container.dataset) container.dataset.oeMap = "active";

  // Stratul de tile-uri: creat o singură dată. Doar tile-urile zonei vizibile (comportamentul
  // standard Leaflet); fără prefetch, fără parametri anti-cache, fără stocare proprie.
  const tileLayer = L.tileLayer(tiles.urlTemplate, {
    attribution: tiles.attribution,
    maxZoom: tiles.maxZoom,
    minZoom: cfg.minZoom,
  });
  tileLayer.addTo(map);

  const playerPane = map.createPane(PLAYER_PANE);
  if (playerPane && playerPane.style) playerPane.style.zIndex = "640"; // deasupra markerilor (600), sub popup-uri (700)

  // Bannerul „fundal indisponibil” (în hartă, sus). Ascuns implicit.
  const banner = L.DomUtil.create("div", "oe-map-banner", container);
  banner.hidden = true;
  banner.textContent = "Fundalul hărții nu se poate încărca (conexiune slabă?). Obiectivele și poziția rămân afișate.";

  let tileErrors = 0;
  function onTileError() {
    tileErrors += 1;
    if (tileErrors >= cfg.tileErrorThreshold && banner.hidden) banner.hidden = false;
  }
  function onTileLoad() {
    tileErrors = 0;
    if (!banner.hidden) banner.hidden = true;
  }
  tileLayer.on("tileerror", onTileError);
  tileLayer.on("tileload", onTileLoad);

  // --- Politica de viewport (§5) ---
  // Mișcările făcute de cod folosesc `animate: false`, deci evenimentele lor sunt sincrone și
  // pot fi deosebite de gesturile utilizatorului prin contorul `programmatic`.
  let programmatic = 0;
  let hasView = false;
  let hadFirstFix = false;
  let userMoved = false;
  let objectiveInitialized = false;
  let lastObjectiveId = null;

  function moveByCode(fn) {
    programmatic += 1;
    try {
      fn();
    } finally {
      programmatic -= 1;
    }
    hasView = true;
  }
  function onUserMove() {
    if (programmatic === 0) userMoved = true;
  }
  map.on("movestart", onUserMove);
  map.on("zoomstart", onUserMove);
  map.on("dragstart", onUserMove);

  function fitPoints(points) {
    if (points.length === 0) return false;
    if (points.length === 1) {
      moveByCode(() => map.setView(points[0], cfg.maxFitZoom, { animate: false }));
    } else {
      moveByCode(() => map.fitBounds(L.latLngBounds(points), { padding: [cfg.fitPadding, cfg.fitPadding], maxZoom: cfg.maxFitZoom, animate: false }));
    }
    return true;
  }

  // --- Jucătorul ---
  let playerMarker = null;
  let accuracyCircle = null;
  let lastPlayerKey = null; // "lat|lng|accuracy|style" desenat ultima dată
  let lastPlayerStyle = null;
  let playerPoint = null; // [lat, lng] desenat, sau null
  let warnedPlayer = false;

  function removePlayer() {
    if (playerMarker && map.hasLayer(playerMarker)) playerMarker.remove();
    if (accuracyCircle && map.hasLayer(accuracyCircle)) accuracyCircle.remove();
    playerPoint = null;
    lastPlayerKey = null;
  }

  function updatePlayer(fix, quality) {
    if (destroyed) return;
    if (!fix) {
      if (lastPlayerKey !== null || playerPoint) removePlayer();
      return;
    }
    if (!isDrawablePoint(fix.lat, fix.lng)) {
      if (!warnedPlayer) {
        console.warn("[outdoor-escape] Poziția jucătorului are coordonate nedesenabile; markerul nu este afișat.");
        warnedPlayer = true;
      }
      if (lastPlayerKey !== null || playerPoint) removePlayer();
      return;
    }
    const styleKey = playerStyleKey(quality);
    const style = PLAYER_STYLES[styleKey];
    const accuracy = fix.accuracy;
    const circleVisible = Boolean(style.circle) && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= cfg.accuracyCircleMax;
    const key = `${fix.lat}|${fix.lng}|${circleVisible ? accuracy : "-"}|${styleKey}`;
    if (key === lastPlayerKey) return; // aceleași date → zero apeluri Leaflet

    const point = [fix.lat, fix.lng];
    if (!playerMarker) {
      playerMarker = L.circleMarker(point, { ...style.marker, radius: 8, pane: PLAYER_PANE, interactive: false, className: "oe-player" });
      lastPlayerStyle = styleKey;
    } else {
      playerMarker.setLatLng(point);
      if (lastPlayerStyle !== styleKey) playerMarker.setStyle(style.marker);
    }
    if (!map.hasLayer(playerMarker)) {
      playerMarker.addTo(map);
      const el = playerMarker.getElement && playerMarker.getElement();
      if (el) el.setAttribute("aria-hidden", "true");
    }

    if (circleVisible) {
      if (!accuracyCircle) {
        accuracyCircle = L.circle(point, { ...style.circle, radius: accuracy, interactive: false, className: "oe-accuracy" });
      } else {
        accuracyCircle.setLatLng(point);
        accuracyCircle.setRadius(accuracy);
        if (lastPlayerStyle !== styleKey) accuracyCircle.setStyle(style.circle);
      }
      if (!map.hasLayer(accuracyCircle)) {
        accuracyCircle.addTo(map);
        const el = accuracyCircle.getElement && accuracyCircle.getElement();
        if (el) el.setAttribute("aria-hidden", "true");
      }
    } else if (accuracyCircle && map.hasLayer(accuracyCircle)) {
      accuracyCircle.remove();
    }

    lastPlayerStyle = styleKey;
    lastPlayerKey = key;
    playerPoint = point;

    // Prima afișare / primul fix afișabil (§5.2). Fix-urile următoare nu mișcă harta.
    if (!hasView) {
      hadFirstFix = true;
      moveByCode(() => map.setView(point, cfg.playerZoom, { animate: false }));
    } else if (!hadFirstFix) {
      hadFirstFix = true;
      if (!userMoved) {
        const objective = currentObjectivePoint();
        if (objective) fitPoints([point, objective]);
        else moveByCode(() => map.setView(point, cfg.playerZoom, { animate: false }));
      }
    }
  }

  // --- Locațiile ---
  const markers = new Map(); // id → { marker, loc, isCurrent, key, label }
  const warnedLocations = new Set();
  let currentId = null;
  let objectiveCircle = null;
  let objectiveCircleKey = null;

  function currentObjectivePoint() {
    const entry = currentId !== null ? markers.get(currentId) : null;
    return entry ? [entry.loc.lat, entry.loc.lng] : null;
  }

  function makeIcon(loc, isCurrent) {
    const classes = ["oe-pin", `oe-pin--${loc.state}`];
    if (isCurrent) classes.push("oe-pin--current");
    const symbol = STATE_SYMBOL[loc.state] || "";
    const completedSmall = loc.state === "completed" && !isCurrent;
    return L.divIcon({
      className: "oe-marker",
      html: `<span class="${classes.join(" ")}" aria-hidden="true"><span class="oe-pin__symbol">${escapeHtml(symbol)}</span></span>`,
      iconSize: [44, 44],
      iconAnchor: completedSmall ? [22, 22] : [22, 44],
      popupAnchor: [0, completedSmall ? -14 : -40],
      tooltipAnchor: [0, completedSmall ? -14 : -40],
    });
  }

  function applyAria(entry) {
    const el = entry.marker.getElement && entry.marker.getElement();
    if (el) el.setAttribute("aria-label", entry.label);
  }

  function markerKey(loc, isCurrent) {
    return `${loc.state}|${loc.name}|${loc.lat}|${loc.lng}|${isCurrent ? 1 : 0}`;
  }

  function zIndexFor(loc, isCurrent) {
    if (isCurrent) return 1000;
    return loc.state === "completed" ? -100 : 0;
  }

  function renderMarker(id, loc) {
    const isCurrent = id === currentId;
    const key = markerKey(loc, isCurrent);
    const label = locationLabel(loc.name, loc.state, isCurrent);
    const existing = markers.get(id);
    if (existing && existing.key === key) {
      existing.loc = loc;
      return;
    }
    if (!existing) {
      const marker = L.marker([loc.lat, loc.lng], { icon: makeIcon(loc, isCurrent), keyboard: true, zIndexOffset: zIndexFor(loc, isCurrent) });
      marker.bindPopup(escapeHtml(label));
      const entry = { marker, loc, isCurrent, key, label, tooltip: false };
      if (isCurrent) {
        marker.bindTooltip(escapeHtml(loc.name), { permanent: true, direction: "top", className: "oe-objective-label" });
        entry.tooltip = true;
      }
      marker.addTo(map);
      applyAria(entry);
      markers.set(id, entry);
      return;
    }
    const e = existing;
    if (e.loc.lat !== loc.lat || e.loc.lng !== loc.lng) e.marker.setLatLng([loc.lat, loc.lng]);
    if (e.loc.state !== loc.state || e.loc.name !== loc.name || e.isCurrent !== isCurrent) {
      e.marker.setIcon(makeIcon(loc, isCurrent));
      e.marker.setZIndexOffset(zIndexFor(loc, isCurrent));
      e.marker.setPopupContent(escapeHtml(label));
      if (isCurrent && (!e.tooltip || e.loc.name !== loc.name)) {
        if (e.tooltip) e.marker.unbindTooltip();
        e.marker.bindTooltip(escapeHtml(loc.name), { permanent: true, direction: "top", className: "oe-objective-label" });
        e.tooltip = true;
      } else if (!isCurrent && e.tooltip) {
        e.marker.unbindTooltip();
        e.tooltip = false;
      }
    }
    e.loc = loc;
    e.isCurrent = isCurrent;
    e.key = key;
    e.label = label;
    applyAria(e);
  }

  function updateObjectiveCircle() {
    const entry = currentId !== null ? markers.get(currentId) : null;
    const loc = entry ? entry.loc : null;
    const show = Boolean(loc) && (loc.state === "available" || loc.state === "near") && Number.isFinite(loc.radius) && loc.radius > 0;
    const key = show ? `${loc.lat}|${loc.lng}|${loc.radius}` : null;
    if (key === objectiveCircleKey) return;
    if (!show) {
      if (objectiveCircle && map.hasLayer(objectiveCircle)) objectiveCircle.remove();
    } else if (!objectiveCircle) {
      objectiveCircle = L.circle([loc.lat, loc.lng], { ...OBJECTIVE_CIRCLE_STYLE, radius: loc.radius, className: "oe-objective-radius" });
      objectiveCircle.addTo(map);
    } else {
      objectiveCircle.setLatLng([loc.lat, loc.lng]);
      objectiveCircle.setRadius(loc.radius);
      if (!map.hasLayer(objectiveCircle)) objectiveCircle.addTo(map);
    }
    objectiveCircleKey = key;
  }

  function drawableLocations(locations) {
    const result = [];
    for (const loc of Array.isArray(locations) ? locations : []) {
      if (!loc || loc.visible !== true || loc.state === "locked") continue;
      if (!isDrawablePoint(loc.lat, loc.lng)) {
        if (!warnedLocations.has(loc.id)) {
          console.warn(`[outdoor-escape] Locația „${loc.id}” are coordonate nedesenabile și nu este afișată pe hartă.`);
          warnedLocations.add(loc.id);
        }
        continue;
      }
      result.push(loc);
    }
    return result;
  }

  function updateLocations(locations) {
    if (destroyed) return;
    const visible = drawableLocations(locations);
    const wanted = new Map(visible.map((loc) => [loc.id, loc]));
    for (const [id, entry] of markers) {
      if (!wanted.has(id)) {
        entry.marker.remove();
        markers.delete(id);
      }
    }
    for (const [id, loc] of wanted) renderMarker(id, loc);
    updateObjectiveCircle();
    if (!hasView && visible.length > 0) fitPoints(visible.map((loc) => [loc.lat, loc.lng]));
  }

  function setCurrentObjective(locationId) {
    if (destroyed) return;
    const id = locationId ?? null;
    if (id !== currentId) {
      const previous = currentId;
      currentId = id;
      for (const changed of [previous, id]) {
        const entry = changed !== null ? markers.get(changed) : null;
        if (entry) renderMarker(changed, entry.loc);
      }
      updateObjectiveCircle();
    }
    // D-049-E: la schimbarea obiectivului (alt id, non-null), o singură recentrare.
    // Primul obiectiv al hărții nu este o „schimbare”: prima afișare încadrează locațiile (§5.2).
    if (id === null) return;
    if (!objectiveInitialized) {
      if (markers.has(id)) {
        objectiveInitialized = true;
        lastObjectiveId = id;
      }
      return;
    }
    if (id === lastObjectiveId) return;
    const objective = currentObjectivePoint();
    if (!objective) return; // încă nevizibil: recentrarea se face când apare
    lastObjectiveId = id;
    userMoved = false;
    fitPoints(playerPoint ? [objective, playerPoint] : [objective]);
  }

  function fitToAdventure(locations) {
    if (destroyed) return false;
    const points = drawableLocations(locations).map((loc) => [loc.lat, loc.lng]);
    return fitPoints(points);
  }

  function centerOnPlayer() {
    if (destroyed || !playerPoint) return false;
    const zoom = typeof map.getZoom === "function" ? map.getZoom() : undefined;
    const target = Number.isFinite(zoom) && zoom >= cfg.centerKeepZoomFrom ? zoom : cfg.playerZoom;
    moveByCode(() => map.setView(playerPoint, target, { animate: false }));
    return true;
  }

  let destroyed = false;
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    try {
      tileLayer.off("tileerror", onTileError);
      tileLayer.off("tileload", onTileLoad);
      map.remove(); // Leaflet șterge și toate listenerele hărții
    } finally {
      if (banner && banner.parentNode) banner.parentNode.removeChild(banner);
      if (container.dataset) delete container.dataset.oeMap;
      markers.clear();
      playerMarker = null;
      accuracyCircle = null;
      objectiveCircle = null;
      playerPoint = null;
    }
  }

  return {
    updatePlayer,
    updateLocations,
    setCurrentObjective,
    fitToAdventure,
    centerOnPlayer,
    destroy,
  };
}
