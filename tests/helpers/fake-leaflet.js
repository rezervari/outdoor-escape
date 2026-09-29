/*
 * Leaflet fals, minimal, pentru testele map.js în Node (fără browser, fără rețea).
 * Implementează doar metodele folosite de src/js/map.js și înregistrează fiecare apel
 * în `calls`, ca testele să poată număra creările, actualizările și mișcările hărții.
 */

function createEmitter(target) {
  const handlers = new Map();
  target.on = (type, fn) => {
    if (!handlers.has(type)) handlers.set(type, new Set());
    handlers.get(type).add(fn);
    return target;
  };
  target.off = (type, fn) => {
    if (type === undefined) handlers.clear();
    else if (fn === undefined) handlers.delete(type);
    else handlers.get(type)?.delete(fn);
    return target;
  };
  target.fire = (type, data = {}) => {
    for (const fn of [...(handlers.get(type) || [])]) fn({ type, ...data });
    return target;
  };
  target.listenerCount = () => [...handlers.values()].reduce((sum, set) => sum + set.size, 0);
  return target;
}

export function createFakeElement(tag = "div") {
  const attributes = new Map();
  const element = {
    nodeType: 1,
    tagName: tag.toUpperCase(),
    isConnected: true,
    hidden: false,
    textContent: "",
    className: "",
    dataset: {},
    style: {},
    children: [],
    parentNode: null,
    setAttribute: (name, value) => attributes.set(name, String(value)),
    getAttribute: (name) => (attributes.has(name) ? attributes.get(name) : null),
    appendChild(child) {
      element.children.push(child);
      child.parentNode = element;
      return child;
    },
    removeChild(child) {
      element.children = element.children.filter((c) => c !== child);
      child.parentNode = null;
      return child;
    },
  };
  return element;
}

export function createFakeLeaflet({ version = "1.9.4" } = {}) {
  const calls = [];
  const log = (name, ...args) => calls.push({ name, args });
  let mapInstance = null;

  function makeLayer(kind, latlng, options = {}) {
    const layer = createEmitter({
      kind,
      latlng,
      options: { ...options },
      map: null,
      element: createFakeElement(),
      popup: null,
      tooltip: null,
    });
    layer.addTo = (map) => {
      log(`${kind}.addTo`);
      map._layers.add(layer);
      layer.map = map;
      return layer;
    };
    layer.remove = () => {
      log(`${kind}.remove`);
      if (layer.map) layer.map._layers.delete(layer);
      layer.map = null;
      return layer;
    };
    layer.getElement = () => layer.element;
    layer.getLatLng = () => layer.latlng;
    layer.setLatLng = (value) => {
      log(`${kind}.setLatLng`, value);
      layer.latlng = value;
      return layer;
    };
    layer.setRadius = (value) => {
      log(`${kind}.setRadius`, value);
      layer.options.radius = value;
      return layer;
    };
    layer.setStyle = (style) => {
      log(`${kind}.setStyle`, style);
      Object.assign(layer.options, style);
      return layer;
    };
    layer.setIcon = (icon) => {
      log(`${kind}.setIcon`, icon);
      layer.options.icon = icon;
      layer.element = createFakeElement(); // Leaflet recreează elementul iconului
      return layer;
    };
    layer.setZIndexOffset = (value) => {
      log(`${kind}.setZIndexOffset`, value);
      layer.options.zIndexOffset = value;
      return layer;
    };
    layer.bindPopup = (content) => {
      log(`${kind}.bindPopup`, content);
      layer.popup = content;
      return layer;
    };
    layer.setPopupContent = (content) => {
      log(`${kind}.setPopupContent`, content);
      layer.popup = content;
      return layer;
    };
    layer.bindTooltip = (content, opts) => {
      log(`${kind}.bindTooltip`, content, opts);
      layer.tooltip = { content, opts };
      return layer;
    };
    layer.unbindTooltip = () => {
      log(`${kind}.unbindTooltip`);
      layer.tooltip = null;
      return layer;
    };
    return layer;
  }

  const L = {
    version,
    calls,
    get mapInstance() {
      return mapInstance;
    },
    map(container, options) {
      log("map", options);
      const map = createEmitter({
        container,
        options,
        center: null,
        zoom: undefined,
        _layers: new Set(),
        panes: {},
        removed: false,
      });
      container._leaflet_id = 1;
      map.setView = (center, zoom, opts) => {
        log("map.setView", center, zoom, opts);
        map.fire("movestart");
        if (zoom !== map.zoom) map.fire("zoomstart");
        map.center = center;
        map.zoom = zoom;
        map.fire("moveend");
        return map;
      };
      map.fitBounds = (bounds, opts) => {
        log("map.fitBounds", bounds, opts);
        map.fire("movestart");
        map.fire("zoomstart");
        map.center = bounds.points[0];
        map.zoom = opts?.maxZoom;
        map.fire("moveend");
        return map;
      };
      map.getZoom = () => map.zoom;
      map.createPane = (name) => {
        log("map.createPane", name);
        map.panes[name] = createFakeElement();
        return map.panes[name];
      };
      map.hasLayer = (layer) => map._layers.has(layer);
      map.remove = () => {
        log("map.remove");
        map.removed = true;
        map._layers.clear();
        map.off();
        delete container._leaflet_id;
        return map;
      };
      // Simulează un gest al utilizatorului (pan cu degetul).
      map.userPan = () => {
        map.fire("dragstart");
        map.fire("movestart");
        map.center = [0, 0];
        map.fire("moveend");
      };
      mapInstance = map;
      return map;
    },
    tileLayer(url, options) {
      log("tileLayer", url, options);
      return makeLayer("tileLayer", null, { url, ...options });
    },
    marker(latlng, options) {
      log("marker", latlng, options);
      return makeLayer("marker", latlng, options);
    },
    circleMarker(latlng, options) {
      log("circleMarker", latlng, options);
      return makeLayer("circleMarker", latlng, options);
    },
    circle(latlng, options) {
      log("circle", latlng, options);
      return makeLayer("circle", latlng, options);
    },
    divIcon(options) {
      log("divIcon", options);
      return { divIcon: true, options };
    },
    latLngBounds(points) {
      return { points };
    },
    DomUtil: {
      create(tag, className, parent) {
        const element = createFakeElement(tag);
        element.className = className;
        if (parent) parent.appendChild(element);
        return element;
      },
    },
  };

  /** Numărul de apeluri cu un anumit nume, începând de la indexul `from`. */
  L.count = (name, from = 0) => calls.slice(from).filter((call) => call.name === name).length;
  /** Numărul de mișcări ale hărții (setView + fitBounds) începând de la `from`. */
  L.moves = (from = 0) => calls.slice(from).filter((call) => call.name === "map.setView" || call.name === "map.fitBounds").length;
  return L;
}
