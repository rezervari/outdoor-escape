/*
 * Adventure QA — regulile pentru misiunile cu răspuns (Pasul 2).
 *
 *   QA-C02  răspunsul este printre `choices`            (error)
 *   QA-C03  `choices` duplicate după normalizare         (error)
 *   QA-C04  `inputMode: "numeric"` → număr întreg ≥ 0    (error)
 *   QA-C05  misiune cu răspuns fără niciun indiciu       (warning)
 *
 * Sursa de adevăr este answers.js, exact cum îl folosește aplicația: o variantă apăsată este
 * pusă în câmpul de răspuns și trimisă ca un răspuns tastat (app.js → answersMatch). QA nu are
 * o normalizare proprie.
 *
 * Primește aventura normalizată (toAdventureV2). Pur: fără disc, fără consolă.
 */

import { answersMatch, normalizeAnswer } from "../../src/js/answers.js";
import { ANSWER_MISSION_TYPES } from "../../src/js/schema.js";

/**
 * Răspunsul numeric, după normalizarea motorului, trebuie să fie scris canonic: „0” sau cifre fără 0
 * la început. Motorul compară texte, nu numere: pentru răspunsul „03”, jucătorul care tastează „3”
 * greșește; „3.0”, „-3” sau „3 4” nu se pot tasta (corect) pe tastatura numerică.
 */
const CANONICAL_INTEGER = /^(0|[1-9][0-9]*)$/;

const isAnswerMission = (mission) => ANSWER_MISSION_TYPES.includes(mission.type) && typeof mission.answer === "string" && mission.answer.trim() !== "";

/**
 * content — aventura normalizată; listKey — „missions” (V2) sau „challenges” (V1), pentru căile din raport.
 * Întoarce findings { ruleId, level, path, message }.
 */
export function checkAnswerMissions(content, { listKey = "missions" } = {}) {
  const findings = [];
  const add = (ruleId, level, path, message) => findings.push({ ruleId, level, path, message });

  content.missions.forEach((mission, index) => {
    if (!isAnswerMission(mission)) return;
    const where = `${listKey}[${index}]`;
    const name = `misiunea „${mission.id}”`;

    if (Array.isArray(mission.choices)) {
      const choices = mission.choices.filter((choice) => typeof choice === "string");
      if (!choices.some((choice) => answersMatch(choice, mission.answer))) {
        add("QA-C02", "error", `${where}.choices`, `${name}: răspunsul nu este printre variante (după normalizarea din answers.js).`);
      }
      const seen = new Map();
      choices.forEach((choice, c) => {
        const key = normalizeAnswer(choice);
        if (seen.has(key)) {
          add("QA-C03", "error", `${where}.choices[${c}]`, `${name}: varianta ${c + 1} este identică cu varianta ${seen.get(key) + 1} după normalizare.`);
        } else {
          seen.set(key, c);
        }
      });
    }

    if (mission.inputMode === "numeric" && !CANONICAL_INTEGER.test(normalizeAnswer(mission.answer))) {
      add("QA-C04", "error", `${where}.answer`, `${name}: inputMode „numeric” cere un răspuns număr întreg ≥ 0, scris fără 0 la început, semn, zecimale sau spații.`);
    }

    if (!Array.isArray(mission.hints) || mission.hints.length === 0) {
      add("QA-C05", "warning", `${where}.hints`, `${name}: misiune cu răspuns fără niciun indiciu.`);
    }
  });
  return findings;
}
