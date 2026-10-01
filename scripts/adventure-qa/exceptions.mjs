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
]);

/** Excepția care acoperă un finding, sau null. */
export function findException(fileName, finding, exceptions = QA_EXCEPTIONS) {
  if (finding.subject === undefined) return null;
  return exceptions.find((e) => e.file === fileName && e.ruleId === finding.ruleId && e.subject === finding.subject) ?? null;
}
