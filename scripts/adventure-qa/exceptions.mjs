/*
 * Adventure QA — excepții declarate explicit.
 *
 * O excepție nu ascunde problema: finding-ul rămâne în raport, marcat „excepție declarată”
 * cu motivul de mai jos, dar nu se numără ca eroare / avertisment. Se potrivește exact pe
 * fișier + regulă + subiect (ex. calea media), deci nu acoperă alte cazuri.
 */

export const QA_EXCEPTIONS = Object.freeze([
  Object.freeze({
    file: "demo-challenge-media.json",
    ruleId: "QA-M01",
    subject: "media/demo-challenge-media/lipsa-intentionat.wav",
    reason: "lipsă intenționat: demonstrează rezerva audio (misiunea F; verificat în tests/challenge-media.test.js)",
  }),
  // demo-gps-brasov este înghețat (D-068, D-069): coordonate reale intenționat publice, fără fallback.instructions.
  // Confirmarea manuală rămâne activă. Excepțiile sunt pe acest fișier; o copie sub alt nume nu le moștenește.
  ...["start", "bariera", "magazin"].flatMap((id) => [
    Object.freeze({
      file: "demo-gps-brasov.json",
      ruleId: "QA-G02",
      subject: `locations.${id}.fallback.instructions`,
      reason: "D-068: demo GPS public înghețat (D-069), fără fallback.instructions; „Am ajuns” rămâne activ",
    }),
    Object.freeze({
      file: "demo-gps-brasov.json",
      ruleId: "QA-G07",
      subject: `locations.${id}.coordinates`,
      reason: "D-068: coordonate reale din Brașov, intenționat publice în demo-ul GPS",
    }),
  ]),
]);

/** Excepția care acoperă un finding, sau null. */
export function findException(fileName, finding, exceptions = QA_EXCEPTIONS) {
  if (finding.subject === undefined) return null;
  return exceptions.find((e) => e.file === fileName && e.ruleId === finding.ruleId && e.subject === finding.subject) ?? null;
}
