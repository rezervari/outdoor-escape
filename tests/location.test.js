import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createLocationTracker,
  positionToFix,
  unavailableReason,
  describeLocation,
  TrackerStatus,
  LocationDisplay,
} from "../src/js/location.js";
import { DEFAULT_GEOLOCATION_OPTIONS, DEFAULT_SETTINGS } from "../src/js/defaults.js";
import { assessFix, evaluateProximity, Zone } from "../src/js/geo.js";
import { mockGeolocation, position } from "./helpers/mock-geolocation.js";


test("positionToFix: GeolocationPosition → { lat, lng, accuracy, timestamp }", () => {
  assert.deepEqual(positionToFix(position(45.64, 25.59, 12, 1234)), { lat: 45.64, lng: 25.59, accuracy: 12, timestamp: 1234 });
  // Precizie lipsă → NaN (geo.js o tratează ca incertă); fără coordonate → null.
  assert.ok(Number.isNaN(positionToFix({ coords: { latitude: 1, longitude: 2 }, timestamp: 1 }).accuracy));
  assert.equal(positionToFix({ coords: {} }), null);
  assert.equal(positionToFix(null), null);
  // Fix-ul produs respectă contractul geo.js.
  const fix = positionToFix(position(0, 0, 10));
  assert.equal(evaluateProximity({ coordinates: { lat: 0, lng: 0 }, radius: 40 }, fix).zone, Zone.INSIDE);
});

test("Geolocation API indisponibil: fără navigator / fără geolocation / context nesigur", () => {
  assert.equal(unavailableReason({ geolocation: null }), "no_geolocation");
  assert.equal(unavailableReason({ geolocation: {} }), "no_geolocation");
  assert.equal(unavailableReason({ geolocation: mockGeolocation(), secureContext: false }), "insecure_context");
  assert.equal(unavailableReason({ geolocation: mockGeolocation(), secureContext: true }), null);

  // În Node nu există navigator.geolocation: implicit → indisponibil, fără excepții.
  const tracker = createLocationTracker();
  assert.equal(tracker.supported, false);
  assert.equal(tracker.start(), false);
  assert.equal(tracker.getState().status, TrackerStatus.UNSUPPORTED);
  assert.equal(tracker.getState().watching, false);
  assert.equal(describeLocation(tracker.getState(), null), LocationDisplay.UNAVAILABLE);

  const insecure = createLocationTracker({ geolocation: mockGeolocation(), secureContext: false });
  insecure.start();
  assert.equal(insecure.getState().reason, "insecure_context");
});

test("watchPosition reușit: stări, opțiuni configurabile, transmiterea fix-ului", () => {
  const geo = mockGeolocation();
  const received = [];
  const statuses = [];
  const tracker = createLocationTracker({ geolocation: geo, onFix: (fix) => received.push(fix), options: { timeout: 5000 } });
  tracker.subscribe((s) => statuses.push(s.status));
  assert.equal(tracker.getState().status, TrackerStatus.IDLE);

  assert.equal(tracker.start(), true);
  assert.equal(geo.watches.size, 1);
  assert.deepEqual(geo.calls[0], { ...DEFAULT_GEOLOCATION_OPTIONS, timeout: 5000 });
  assert.equal(tracker.getState().status, TrackerStatus.SEARCHING);
  assert.equal(tracker.getState().watching, true);

  geo.emit(position(45.1, 25.2, 9, 42));
  assert.deepEqual(received, [{ lat: 45.1, lng: 25.2, accuracy: 9, timestamp: 42 }]);
  assert.equal(tracker.getState().status, TrackerStatus.ACTIVE);
  assert.deepEqual(tracker.getState().fix, received[0]);
  // Adaptorul nu deduce zone: transmite fiecare fix, inclusiv duplicatele (deduplicarea e în geo/game).
  geo.emit(position(45.1, 25.2, 9, 43));
  assert.equal(received.length, 2);
  assert.ok(statuses.includes(TrackerStatus.SEARCHING) && statuses.includes(TrackerStatus.ACTIVE));
});

test("stop + cleanup: clearWatch, fără callback-uri întârziate", () => {
  const geo = mockGeolocation();
  const received = [];
  const tracker = createLocationTracker({ geolocation: geo, onFix: (fix) => received.push(fix) });
  tracker.start();
  const [watch] = [...geo.watches.values()];
  geo.emit(position(1, 1, 5));
  tracker.stop();
  assert.deepEqual(geo.cleared, [1]);
  assert.equal(geo.watches.size, 0);
  assert.equal(tracker.getState().status, TrackerStatus.IDLE);
  assert.equal(tracker.getState().fix, null);
  assert.equal(tracker.getState().watching, false);
  // Un callback întârziat al urmăririi oprite este ignorat.
  watch.success(position(2, 2, 5));
  watch.error({ code: 1 });
  assert.equal(received.length, 1);
  assert.equal(tracker.getState().status, TrackerStatus.IDLE);
  // stop() repetat sau fără start: sigur.
  tracker.stop();
  createLocationTracker({ geolocation: geo }).stop();
  assert.deepEqual(geo.cleared, [1]);
});

test("start duplicat: un singur watcher", () => {
  const geo = mockGeolocation();
  const tracker = createLocationTracker({ geolocation: geo });
  assert.equal(tracker.start(), true);
  assert.equal(tracker.start(), false);
  assert.equal(tracker.start(), false);
  assert.equal(geo.calls.length, 1);
  assert.equal(geo.watches.size, 1);
  // Și după primirea unei poziții.
  geo.emit(position(1, 1, 5));
  assert.equal(tracker.start(), false);
  assert.equal(geo.calls.length, 1);
});

test("permisiune refuzată: urmărirea se oprește; retry repornește", () => {
  const geo = mockGeolocation();
  const tracker = createLocationTracker({ geolocation: geo });
  tracker.start();
  geo.fail(1); // PERMISSION_DENIED
  assert.equal(tracker.getState().status, TrackerStatus.DENIED);
  assert.equal(tracker.getState().watching, false);
  assert.equal(geo.watches.size, 0);
  assert.equal(describeLocation(tracker.getState(), null), LocationDisplay.PERMISSION_DENIED);

  // Utilizatorul a schimbat permisiunea în browser → retry.
  assert.equal(tracker.retry(), true);
  assert.equal(geo.watches.size, 1);
  assert.equal(tracker.getState().status, TrackerStatus.SEARCHING);
  geo.emit(position(1, 1, 5));
  assert.equal(tracker.getState().status, TrackerStatus.ACTIVE);
});

test("refuz raportat sincron în watchPosition: fără watcher rămas activ", () => {
  const geo = mockGeolocation({ syncError: 1 });
  const tracker = createLocationTracker({ geolocation: geo });
  tracker.start();
  assert.equal(tracker.getState().status, TrackerStatus.DENIED);
  assert.equal(tracker.getState().watching, false);
  assert.equal(geo.watches.size, 0);
});

test("erori generice (indisponibil / timeout / necunoscut): urmărirea continuă, retry fără dubluri", () => {
  const geo = mockGeolocation();
  const received = [];
  const tracker = createLocationTracker({ geolocation: geo, onFix: (f) => received.push(f) });
  tracker.start();
  geo.fail(2); // POSITION_UNAVAILABLE
  assert.equal(tracker.getState().status, TrackerStatus.ERROR);
  assert.equal(tracker.getState().error, "position_unavailable");
  assert.equal(tracker.getState().watching, true);
  assert.equal(describeLocation(tracker.getState(), null), LocationDisplay.ERROR);
  geo.fail(3); // TIMEOUT
  assert.equal(tracker.getState().error, "timeout");
  geo.fail(99);
  assert.equal(tracker.getState().error, "unknown");

  // Browserul revine singur cu o poziție → activ.
  geo.emit(position(1, 1, 5));
  assert.equal(tracker.getState().status, TrackerStatus.ACTIVE);
  assert.equal(received.length, 1);

  // Retry după eroare: vechiul watcher este curățat, rămâne unul singur.
  geo.fail(3);
  tracker.retry();
  assert.equal(geo.watches.size, 1);
  assert.deepEqual(geo.cleared, [1]);
  assert.equal(geo.calls.length, 2);

  // watchPosition care aruncă excepție → eroare, fără watcher.
  const broken = createLocationTracker({ geolocation: { watchPosition() { throw new Error("x"); }, clearWatch() {} } });
  assert.equal(broken.start(), false);
  assert.equal(broken.getState().status, TrackerStatus.ERROR);
  assert.equal(broken.getState().watching, false);
});

test("o eroare în consumatorul onFix nu oprește urmărirea", () => {
  const geo = mockGeolocation();
  const tracker = createLocationTracker({ geolocation: geo, onFix: () => { throw new Error("consumator"); } });
  const originalError = console.error;
  console.error = () => {};
  try {
    tracker.start();
    geo.emit(position(1, 1, 5));
  } finally {
    console.error = originalError;
  }
  assert.equal(tracker.getState().status, TrackerStatus.ACTIVE);
  assert.equal(tracker.getState().watching, true);
});

test("describeLocation: precizie bună / slabă decisă de geo.assessFix (fără praguri proprii)", () => {
  const gps = DEFAULT_SETTINGS.gps;
  const active = (accuracy) => ({ status: TrackerStatus.ACTIVE, fix: { lat: 0, lng: 0, accuracy } });
  assert.equal(describeLocation(active(12), assessFix(active(12).fix, gps)), LocationDisplay.READY);
  assert.equal(describeLocation(active(gps.maxAccuracy), assessFix(active(gps.maxAccuracy).fix, gps)), LocationDisplay.READY);
  assert.equal(describeLocation(active(gps.maxAccuracy + 1), assessFix(active(gps.maxAccuracy + 1).fix, gps)), LocationDisplay.UNCERTAIN);
  assert.equal(describeLocation({ status: TrackerStatus.IDLE }, null), LocationDisplay.OFF);
  assert.equal(describeLocation({ status: TrackerStatus.SEARCHING }, null), LocationDisplay.SEARCHING);
});

test("metodele pot fi folosite detașat (ex. handler de click): start / stop / retry", () => {
  const geo = mockGeolocation();
  const { start, stop, retry, getState } = createLocationTracker({ geolocation: geo, secureContext: true });
  assert.equal(start(), true);
  geo.fail(1);
  assert.equal(getState().status, TrackerStatus.DENIED);
  assert.equal(retry(), true);
  assert.equal(geo.watches.size, 1);
  stop();
  assert.equal(geo.watches.size, 0);
  assert.equal(getState().status, TrackerStatus.IDLE);
});
