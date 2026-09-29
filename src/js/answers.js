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
 * Exemple: "Brașov", " BRAȘOV ", "brasov", "Braşov" → "brasov".
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

/**
 * Validator local (MVP): păstrează răspunsurile într-o închidere (closure),
 * indexate după id-ul provocării.
 * Interfață: check(challengeId, input) → Promise<boolean>.
 */
export function createLocalValidator(adventure) {
  const expectedById = new Map();
  for (const challenge of adventure.challenges) {
    expectedById.set(challenge.id, challenge.answer);
  }
  return {
    async check(challengeId, input) {
      if (!expectedById.has(challengeId)) {
        throw new Error(`Provocare necunoscută: ${challengeId}`);
      }
      return answersMatch(input, expectedById.get(challengeId));
    },
  };
}

/**
 * Copie a aventurii fără răspunsuri, pentru motor și interfață.
 * Motorul nu are nevoie de răspunsuri; validarea trece doar prin validator.
 */
export function withoutAnswers(adventure) {
  return {
    ...adventure,
    challenges: adventure.challenges.map(({ answer, ...rest }) => rest),
  };
}
