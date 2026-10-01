/*
 * Adventure QA — clasificarea unui fișier de aventură (D-034, D-068, D-080).
 *
 *   public-demo     conținut demonstrativ public: nume fără „private-”, `demo: true`;
 *   published-real  aventură reală publicată explicit (D-080) — lista unică din
 *                   tests/helpers/published-real-adventures.js (nu se duplică aici);
 *   private-local   aventură reală locală: „private-*.json”, nepublicată (ignorată de Git);
 *   anomaly         orice altceva (ex. nume public fără `demo: true` sau JSON necitibil).
 *
 * Clasificarea depinde doar de numele fișierului și de conținutul parsat, nu de Git:
 * starea Git (urmărit / ignorat) este verificată de testele de confidențialitate existente
 * și, ulterior, de regulile de publicare QA-L*. Pur: fără sistem de fișiere, fără consolă.
 */

import { PUBLISHED_REAL_ADVENTURES } from "../../tests/helpers/published-real-adventures.js";

export const CLASSES = Object.freeze({
  PUBLIC_DEMO: "public-demo",
  PUBLISHED_REAL: "published-real",
  PRIVATE_LOCAL: "private-local",
  ANOMALY: "anomaly",
});

const PRIVATE_FILE = /^private-.+\.json$/;

/** Id-ul așteptat al unei aventuri: numele fișierului fără „.json”. */
export function fileStem(fileName) {
  return fileName.replace(/\.json$/i, "");
}

/**
 * fileName — numele fișierului (fără director), ex. „demo-gps-brasov.json”
 * data     — conținutul parsat sau `undefined` dacă JSON-ul nu a putut fi citit
 */
export function classifyAdventure(fileName, data, { published = PUBLISHED_REAL_ADVENTURES } = {}) {
  if (published.includes(fileStem(fileName))) return CLASSES.PUBLISHED_REAL;
  if (PRIVATE_FILE.test(fileName)) return CLASSES.PRIVATE_LOCAL;
  if (data !== null && typeof data === "object" && !Array.isArray(data) && data.demo === true) return CLASSES.PUBLIC_DEMO;
  return CLASSES.ANOMALY;
}
