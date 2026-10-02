/*
 * Outdoor Escape — gong-ul notificării (M7, D-106): un sunet scurt și discret, generat cu Web Audio API.
 *
 * Efect de interfață, nimic mai mult: nu cunoaște motorul, mesajele, Inbox-ul, notificările sau stocarea;
 * nu păstrează nimic între reîncărcări. Când sună o decide Notification Policy (notification-policy.js).
 * Nu folosește <audio>: media-ui.js oprește orice alt <audio> din pagină, iar gong-ul nu trebuie să
 * atingă player-ul misiunilor (și nici player-ul pe el). Fără fișier audio și fără biblioteci.
 *
 * - unlock(): la un gest explicit al jucătorului (browserele permit sunetul numai după un gest) creează
 *   sau reia AudioContext-ul. Starea „deblocat” există doar în memorie. Întoarce true dacă sunetul este permis.
 * - play(): O SINGURĂ încercare. Dacă sunetul nu este permis acum (fără gest încă, context suspendat,
 *   eroare), gong-ul se abandonează: fără reîncercare și fără redare amânată. Singura așteptare este
 *   reluarea contextului începută chiar atunci (ex. gestul care a pornit aventura): gong-ul sună doar dacă
 *   reluarea se încheie în cel mult GONG.graceMs; altfel se abandonează. Întoarce Promise<boolean>.
 * - stop(): oprește un gong în curs și anulează o încercare neterminată (reset).
 * Nicio metodă nu aruncă excepții: eșecul audio nu este eșecul notificării și nici al jocului.
 */

const GONG = Object.freeze({
  base: 392, // Hz — se aude și pe difuzoarele mici ale telefoanelor
  partials: Object.freeze([[1, 1], [2.01, 0.35], [2.76, 0.22], [5.4, 0.06]]), // [raport, nivel]: timbru de clopot / gong
  volume: 0.16,
  attack: 0.008, // s
  duration: 1.1, // s
  graceMs: 300,
});

function defaultCreateContext() {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  return AudioContextClass ? new AudioContextClass() : null;
}

const defaultNow = () => (globalThis.performance ? globalThis.performance.now() : Date.now());

export function createGong({ createContext = defaultCreateContext, now = defaultNow } = {}) {
  let context = null;
  let unavailable = false; // Web Audio lipsește sau contextul nu a putut fi creat: fără gong în această sesiune
  let generation = 0; // stop() invalidează încercările neterminate
  const sounding = new Set();

  const isRunning = () => context !== null && context.state === "running";

  function ensureContext() {
    if (context || unavailable) return context;
    try {
      context = createContext() || null;
    } catch {
      context = null;
    }
    if (!context) unavailable = true;
    return context;
  }

  // O singură cerere de reluare; rezultatul: contextul rulează (true) sau nu (false). Nu aruncă.
  function resume() {
    try {
      const attempt = context.resume();
      if (!attempt || typeof attempt.then !== "function") return Promise.resolve(isRunning());
      return attempt.then(() => isRunning(), () => false);
    } catch {
      return Promise.resolve(false);
    }
  }

  function stop() {
    generation += 1;
    for (const oscillator of sounding) {
      try {
        oscillator.stop();
      } catch {
        // deja oprit
      }
    }
    sounding.clear();
  }

  function sound() {
    try {
      const start = context.currentTime;
      const end = start + GONG.duration;
      const output = context.createGain();
      output.gain.setValueAtTime(0.0001, start);
      output.gain.exponentialRampToValueAtTime(GONG.volume, start + GONG.attack);
      output.gain.exponentialRampToValueAtTime(0.0001, end);
      output.connect(context.destination);
      for (const [ratio, level] of GONG.partials) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.type = "sine";
        oscillator.frequency.value = GONG.base * ratio;
        gain.gain.value = level;
        oscillator.connect(gain);
        gain.connect(output);
        oscillator.onended = () => {
          sounding.delete(oscillator);
          try {
            oscillator.disconnect();
            gain.disconnect();
          } catch {
            // nodurile pot fi deja deconectate
          }
        };
        sounding.add(oscillator);
        oscillator.start(start);
        oscillator.stop(end);
      }
      return true;
    } catch {
      stop();
      return false;
    }
  }

  return {
    /** La un gest explicit al jucătorului. true = sunetul este permis acum. */
    unlock() {
      try {
        if (!ensureContext()) return false;
        if (isRunning()) return true;
        resume(); // în gestul jucătorului; contextul pornește asincron
        return isRunning();
      } catch {
        return false;
      }
    },

    /** true dacă sunetul este permis acum (contextul rulează). */
    isUnlocked: () => isRunning(),

    /** O singură încercare de a reda gong-ul; Promise<boolean> (true = a sunat). Nu aruncă. */
    play() {
      try {
        if (!context) return Promise.resolve(false); // fără gest încă (sau Web Audio indisponibil)
        if (isRunning()) return Promise.resolve(sound());
        const requested = now();
        const attempt = generation;
        return resume()
          .then((running) => running && attempt === generation && now() - requested <= GONG.graceMs && sound())
          .catch(() => false);
      } catch {
        return Promise.resolve(false);
      }
    },

    /** Oprește un gong în curs și anulează o încercare neterminată. */
    stop() {
      try {
        stop();
      } catch {
        // nimic de oprit
      }
    },
  };
}
