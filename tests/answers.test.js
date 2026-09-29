import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAnswer, answersMatch, createLocalValidator, withoutAnswers } from "../src/js/answers.js";

test("normalizeAnswer: majuscule, spații și diacritice", () => {
  for (const variant of ["Brașov", "brasov", "BRAȘOV", "BRASOV", "  Brașov  ", "braşov", "BRAŞOV"]) {
    assert.equal(normalizeAnswer(variant), "brasov", variant);
  }
  assert.equal(normalizeAnswer("  Piața   Sfatului \t"), "piata sfatului");
  assert.equal(normalizeAnswer("ăâîșț ĂÂÎȘȚ şţŞŢ"), "aaist aaist stst"); // ș/ț cu virgulă și cu sedilă
  assert.equal(normalizeAnswer(" arici "), "arici"); // spațiu neseparabil
});

test("normalizeAnswer: valori care nu sunt text", () => {
  assert.equal(normalizeAnswer(undefined), "");
  assert.equal(normalizeAnswer(null), "");
  assert.equal(normalizeAnswer(3), "");
});

test("answersMatch: nu face fuzzy matching", () => {
  assert.equal(answersMatch("Brasov", "Brașov"), true);
  assert.equal(answersMatch("Brasovv", "Brașov"), false);
  assert.equal(answersMatch("Bra sov", "Brașov"), false);
  assert.equal(answersMatch("brașov.", "Brașov"), false); // punctuația nu este eliminată
  assert.equal(answersMatch("", ""), false); // răspunsul gol nu este niciodată corect
  assert.equal(answersMatch("   ", "x"), false);
  assert.equal(answersMatch("3", "3"), true);
  assert.equal(answersMatch("trei", "3"), false); // numerele în litere: nedecis (D-024)
});

const adventure = {
  id: "t",
  title: "T",
  challenges: [
    { id: "c1", title: "1", description: "d", answer: "Brașov", points: 100 },
    { id: "c2", title: "2", description: "d", answer: "3", points: 50, hint: "h" },
  ],
};

test("createLocalValidator: interfață asincronă", async () => {
  const validator = createLocalValidator(adventure);
  const pending = validator.check("c1", "BRASOV");
  assert.ok(pending instanceof Promise);
  assert.equal(await pending, true);
  assert.equal(await validator.check("c1", "Cluj"), false);
  assert.equal(await validator.check("c2", " 3 "), true);
  await assert.rejects(validator.check("inexistent", "x"));
});

test("withoutAnswers: elimină răspunsurile, fără a modifica originalul", () => {
  const stripped = withoutAnswers(adventure);
  for (const challenge of stripped.challenges) assert.equal("answer" in challenge, false);
  assert.equal(stripped.challenges[1].hint, "h");
  assert.equal(adventure.challenges[0].answer, "Brașov");
});
