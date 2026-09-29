/*
 * Helper de test (nu este un fișier de test): mock pentru navigator.geolocation.
 * Folosit de tests/location.test.js și tests/location-integration.test.js.
 */

/**
 * Mock minimal pentru navigator.geolocation: memorează watcher-ele și permite
 * emiterea manuală a pozițiilor și a erorilor (coduri standard 1/2/3).
 */
export function mockGeolocation({ syncError = null } = {}) {
  const watches = new Map();
  let nextId = 1;
  return {
    watches,
    cleared: [],
    calls: [],
    watchPosition(success, error, options) {
      const id = nextId++;
      watches.set(id, { success, error, options });
      this.calls.push(options);
      if (syncError) error({ code: syncError, message: "sync" });
      return id;
    },
    clearWatch(id) {
      this.cleared.push(id);
      watches.delete(id);
    },
    emit(position) {
      for (const watch of [...watches.values()]) watch.success(position);
    },
    fail(code) {
      for (const watch of [...watches.values()]) watch.error({ code, message: "mock" });
    },
  };
}

export const position = (lat, lng, accuracy, timestamp = 1_000) => ({
  coords: { latitude: lat, longitude: lng, accuracy, altitude: null, speed: null, heading: null },
  timestamp,
});
