/*
 * Outdoor Escape — punctul de intrare JavaScript (fundație).
 *
 * Nu conține logică de joc. Modulele viitoare (stare, GPS, puzzle-uri etc.,
 * vezi docs/03_ARCHITECTURE.md) vor fi module ES separate în js/,
 * importate de aici cu căi relative (ex. import { ... } from "./state.js").
 */

const APP_NAME = "outdoor-escape";

function setStatus(id, text) {
  const element = document.getElementById(id);
  if (element) element.textContent = text;
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    // Ex.: http://192.168.x.x (context nesigur), file://, unele moduri private.
    setStatus("status-sw", window.isSecureContext
      ? "indisponibil în acest browser"
      : "indisponibil (context nesigur — necesită HTTPS sau localhost)");
    return;
  }

  try {
    // Căi relative la src/index.html → src/sw.js, scope src/ (D-035).
    // Nu presupunem că aplicația stă la rădăcina domeniului.
    const registration = await navigator.serviceWorker.register("sw.js", { scope: "./" });
    setStatus("status-sw", "înregistrat (scope: " + new URL(registration.scope).pathname + ")");
  } catch (error) {
    console.warn(`[${APP_NAME}] Înregistrarea service worker-ului a eșuat:`, error);
    setStatus("status-sw", "înregistrare eșuată (aplicația funcționează fără el)");
  }
}

function init() {
  console.info(`[${APP_NAME}] app.js încărcat (fundație).`);
  document.documentElement.dataset.js = "loaded";
  setStatus("status-js", "încărcat");
  registerServiceWorker();
}

// Scripturile type="module" rulează după parsarea documentului.
init();
