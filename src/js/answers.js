/*
 * Outdoor Escape — validarea răspunsurilor (D-021).
 *
 * Singurul modul care citește câmpul `answer` din conținut și care compară
 * răspunsuri. Motorul (game.js) nu vede răspunsurile: primește doar un
 * „validator” cu interfață asincronă, ca o implementare viitoare pe server
 * să o poată înlocui fără schimbări în motor.
 *
 * Nu folosește DOM sau API-uri de browser, deci poate fi testat în Node.
 */

// Semne diacritice combinate (după descompunerea NFD).
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Normalizează un răspuns pentru comparare (tolerant, fără fuzzy matching):
 * - elimină spațiile de la capete și reduce spațiile multiple la unul;
 * - ignoră majusculele;
 * - elimină diacriticele românești (ă â î ș ț), inclusiv variantele
 *   cu sedilă (ş ţ) produse de unele tastaturi.
 * Nu elimină punctuația și nu tratează greșelile de scriere.
 *
 * Exemple: "Piață", " PIAȚĂ ", "piata", "Piaţă" (cu sedilă) → "piata".
 */
export function normalizeAnswer(value) {
  if (typeof value !== "string") return "";
  return value
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Compară răspunsul jucătorului cu răspunsul de referință, după normalizare. */
export function answersMatch(input, expected) {
  const normalizedInput = normalizeAnswer(input);
  if (normalizedInput === "") return false;
  return normalizedInput === normalizeAnswer(expected);
}

// Lista de misiuni: V2 („missions”) sau V1 („challenges”).
function answerItemsKey(adventure) {
  return Array.isArray(adventure.missions) ? "missions" : "challenges";
}

/**
 * Validator local (MVP): păstrează răspunsurile într-o închidere (closure),
 * indexate după id-ul misiunii (V2) sau al provocării (V1).
 * Interfață: check(missionId, input) → Promise<boolean>.
 * Misiunile fără răspuns (ex. „location”) nu sunt înregistrate.
 */
export function createLocalValidator(adventure) {
  const expectedById = new Map();
  for (const item of adventure[answerItemsKey(adventure)] || []) {
    if (typeof item.answer === "string") expectedById.set(item.id, item.answer);
  }
  return {
    async check(missionId, input) {
      if (!expectedById.has(missionId)) {
        throw new Error(`Misiune necunoscută sau fără răspuns: ${missionId}`);
      }
      return answersMatch(input, expectedById.get(missionId));
    },
  };
}

/**
 * Copie a aventurii fără răspunsuri, pentru motor și interfață (V1 sau V2).
 * Motorul nu are nevoie de răspunsuri; validarea trece doar prin validator.
 */
export function withoutAnswers(adventure) {
  const key = answerItemsKey(adventure);
  return {
    ...adventure,
    [key]: (adventure[key] || []).map(({ answer, ...rest }) => rest),
  };
}
