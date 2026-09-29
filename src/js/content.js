/*
 * Outdoor Escape — încărcarea și validarea conținutului aventurilor.
 *
 * Conținutul stă în content/adventures/<id>.json, în afara lui src/ (D-007).
 * URL-ul se calculează relativ la acest fișier (src/js/content.js), deci
 * funcționează identic la http://localhost:8000/src/ și la
 * https://rezervari.github.io/outdoor-escape/src/ (D-035).
 *
 * validateAdventure() nu folosește API-uri de browser și poate fi testată în Node.
 */

export const SUPPORTED_SCHEMA_VERSION = 1;

// Id stabil: litere mici, cifre și cratimă. Împiedică și căi de tip "../".
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class AdventureLoadError extends Error {
  constructor(message, { cause, details } = {}) {
    super(message);
    this.name = "AdventureLoadError";
    this.cause = cause;
    this.details = details || [];
  }
}

export function isValidId(value) {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim() !== "";
}

/**
 * Validare minimă a structurii. Câmpurile necunoscute sunt permise, ca
 * formatul să poată fi extins (coordonate, imagini, indicii multiple etc.).
 * Întoarce { valid, errors }.
 */
export function validateAdventure(data) {
  const errors = [];

  if (data === null || typeof data !== "object" || Array.isArray(data)) {
    return { valid: false, errors: ["Aventura trebuie să fie un obiect JSON."] };
  }

  if (data.schemaVersion !== undefined && data.schemaVersion !== SUPPORTED_SCHEMA_VERSION) {
    errors.push(`schemaVersion ${data.schemaVersion} nu este suportată (se așteaptă ${SUPPORTED_SCHEMA_VERSION}).`);
  }
  if (!isValidId(data.id)) errors.push("id lipsește sau nu este valid (litere mici, cifre, cratimă).");
  if (!isNonEmptyString(data.title)) errors.push("title lipsește.");
  if (data.description !== undefined && typeof data.description !== "string") {
    errors.push("description trebuie să fie text.");
  }
  if (data.city !== undefined && typeof data.city !== "string") errors.push("city trebuie să fie text.");
  if (data.difficulty !== undefined && typeof data.difficulty !== "string") {
    errors.push("difficulty trebuie să fie text.");
  }
  if (data.estimatedTime !== undefined &&
      !(typeof data.estimatedTime === "number" && Number.isFinite(data.estimatedTime) && data.estimatedTime > 0)) {
    errors.push("estimatedTime trebuie să fie un număr pozitiv (minute).");
  }

  if (!Array.isArray(data.challenges) || data.challenges.length === 0) {
    errors.push("challenges trebuie să fie o listă cu cel puțin o provocare.");
    return { valid: false, errors };
  }

  const seenIds = new Set();
  data.challenges.forEach((challenge, index) => {
    const where = `challenges[${index}]`;
    if (challenge === null || typeof challenge !== "object" || Array.isArray(challenge)) {
      errors.push(`${where} trebuie să fie un obiect.`);
      return;
    }
    if (!isValidId(challenge.id)) {
      errors.push(`${where}.id lipsește sau nu este valid.`);
    } else if (seenIds.has(challenge.id)) {
      errors.push(`${where}.id „${challenge.id}” este duplicat.`);
    } else {
      seenIds.add(challenge.id);
    }
    if (!isNonEmptyString(challenge.title)) errors.push(`${where}.title lipsește.`);
    if (!isNonEmptyString(challenge.description)) errors.push(`${where}.description lipsește.`);
    if (!isNonEmptyString(challenge.answer)) errors.push(`${where}.answer lipsește.`);
    if (challenge.hint !== undefined && typeof challenge.hint !== "string") {
      errors.push(`${where}.hint trebuie să fie text.`);
    }
    if (!(Number.isInteger(challenge.points) && challenge.points >= 0)) {
      errors.push(`${where}.points trebuie să fie un număr întreg ≥ 0.`);
    }
  });

  return { valid: errors.length === 0, errors };
}

/** URL-ul fișierului unei aventuri, relativ la acest modul. */
export function adventureUrl(adventureId, baseUrl = import.meta.url) {
  return new URL(`../../content/adventures/${adventureId}.json`, baseUrl).href;
}

/**
 * Încarcă și validează o aventură. Aruncă AdventureLoadError cu un mesaj
 * pe înțelesul jucătorului; detaliile tehnice sunt în `details`/`cause`.
 */
export async function loadAdventure(adventureId, { fetchImpl = globalThis.fetch, baseUrl } = {}) {
  if (!isValidId(adventureId)) {
    throw new AdventureLoadError("Aventura cerută nu există.", { details: [`id invalid: ${adventureId}`] });
  }

  const url = adventureUrl(adventureId, baseUrl);
  let response;
  try {
    response = await fetchImpl(url, { cache: "no-cache" });
  } catch (error) {
    throw new AdventureLoadError(
      "Aventura nu a putut fi descărcată. Verifică conexiunea la internet și încearcă din nou.",
      { cause: error }
    );
  }

  if (!response.ok) {
    throw new AdventureLoadError(
      response.status === 404 ? "Aventura cerută nu există." : "Aventura nu a putut fi descărcată. Încearcă din nou.",
      { details: [`HTTP ${response.status} pentru ${url}`] }
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new AdventureLoadError("Fișierul aventurii este deteriorat.", { cause: error });
  }

  const { valid, errors } = validateAdventure(data);
  if (!valid) {
    throw new AdventureLoadError("Fișierul aventurii nu are formatul așteptat.", { details: errors });
  }
  if (data.id !== adventureId) {
    throw new AdventureLoadError("Fișierul aventurii nu are formatul așteptat.", {
      details: [`id din fișier („${data.id}”) diferă de id-ul cerut („${adventureId}”).`],
    });
  }
  return data;
}
