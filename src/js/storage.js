/*
 * Outdoor Escape — persistența locală a progresului (localStorage).
 *
 * Cheia are prefixul proiectului (D-035), pentru că domeniul
 * rezervari.github.io este comun tuturor site-urilor contului:
 *   outdoor-escape:game:<id-aventură>
 *
 * localStorage poate lipsi sau poate arunca excepții (mod privat, cotă
 * depășită, stocare blocată). În aceste cazuri jocul continuă fără
 * salvare; funcțiile nu aruncă excepții.
 *
 * Backend-ul se poate injecta (orice obiect cu getItem/setItem/removeItem),
 * deci modulul poate fi testat în Node.
 */

export const STORAGE_PREFIX = "outdoor-escape:game:";

export function storageKey(adventureId) {
  return STORAGE_PREFIX + adventureId;
}

function defaultBackend() {
  try {
    return globalThis.localStorage || null;
  } catch {
    // Unele browsere aruncă excepție chiar la accesarea localStorage.
    return null;
  }
}

export function createStorage(backend = defaultBackend()) {
  return {
    /** true dacă salvarea este posibilă (backend disponibil). */
    get available() {
      return backend !== null;
    },

    /** Salvează starea. Întoarce true la succes. */
    saveGame(adventureId, state) {
      if (!backend) return false;
      try {
        backend.setItem(storageKey(adventureId), JSON.stringify(state));
        return true;
      } catch (error) {
        console.warn("[outdoor-escape] Progresul nu a putut fi salvat:", error);
        return false;
      }
    },

    /** Citește starea salvată sau null (lipsă sau date corupte). */
    loadGame(adventureId) {
      if (!backend) return null;
      try {
        const raw = backend.getItem(storageKey(adventureId));
        if (raw === null) return null;
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (error) {
        console.warn("[outdoor-escape] Progresul salvat nu a putut fi citit:", error);
        return null;
      }
    },

    /** Șterge progresul aventurii. Întoarce true la succes. */
    resetGame(adventureId) {
      if (!backend) return false;
      try {
        backend.removeItem(storageKey(adventureId));
        return true;
      } catch (error) {
        console.warn("[outdoor-escape] Progresul nu a putut fi șters:", error);
        return false;
      }
    },
  };
}
