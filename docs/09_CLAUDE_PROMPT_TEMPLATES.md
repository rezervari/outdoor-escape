# OUTDOOR ESCAPE — CLAUDE PROMPT TEMPLATES

Use these templates as controlled operating prompts. Replace bracketed values.

## 1. Feature request

We are currently in [PHASE].

Before making changes:
1. Read the relevant files in /docs.
2. Inspect the current repository state.
3. Identify dependencies and affected files.

Task:
Implement [FEATURE].

Scope:
- [ALLOWED FILES / DIRECTORIES]

Constraints:
- Do not modify unrelated files.
- Do not change architecture unless explicitly approved.
- Do not add dependencies without explaining why.
- Preserve existing behavior.

First return:
1. implementation plan;
2. files that will change;
3. risks/edge cases;
4. tests to run.

Do not implement until I confirm the plan.

---

## 2. Bug fix

We are in [PHASE].

Bug:
[EXACT BUG]

Environment:
[DEVICE / BROWSER / OS]

Expected:
[EXPECTED BEHAVIOR]

Actual:
[ACTUAL BEHAVIOR]

Relevant evidence:
[ERROR / SCREENSHOT / LOG]

Read:
- 03_ARCHITECTURE.md
- 04_DECISIONS_LOG.md
- relevant source files

First diagnose the likely cause.

Then propose the smallest isolated fix.

Do not refactor unrelated code.

---

## 3. GPS failure

Phase:
[PHASE]

Location:
[LOCATION ID]

Observed:
- reported accuracy: [X] m
- distance: [X] m
- device: [DEVICE]
- browser: [BROWSER]

Expected:
The player should not become permanently blocked.

Check:
- GPS permission state;
- accuracy handling;
- retry logic;
- radius configuration;
- fallback path.

Propose a minimal fix before implementing.

---

## 4. Game content integration

Game:
[GAME ID]

Location:
[LOCATION ID]

Provide:
- narrative text;
- puzzle;
- answer;
- hint 1;
- hint 2;
- penalty;
- coordinates;
- radius;
- fallback verification.

First validate the structure against 05_GAME_DESIGN_SPEC.md.

Do not invent historical facts.

---

## 5. Architecture change proposal

I want to consider:
[PROPOSED CHANGE]

Do not implement it.

Analyze:
1. current architecture;
2. affected components;
3. benefits;
4. risks;
5. migration cost;
6. whether it is necessary now;
7. effect on future multi-game support.

Return a recommendation and wait for approval.

---

## 6. Pre-commit review

Review the current working tree.

Check:
- unintended changes;
- secrets;
- unnecessary dependencies;
- console errors;
- broken links;
- PWA issues;
- mobile UX regressions;
- documentation drift;
- tests.

Do not modify files.

Return:
- blockers;
- warnings;
- clean items;
- exact commands/tests I should run.

---

## 7. Release review

Before release, inspect:
- git status;
- git diff;
- build/deploy configuration;
- PWA manifest;
- service worker;
- production URLs;
- payment configuration if applicable;
- secret exposure;
- mobile behavior.

Do not deploy or push unless explicitly instructed.

---

## 8. Context synchronization

Review the implementation against /docs.

Identify:
- decisions implemented but undocumented;
- documentation that no longer matches code;
- architecture drift;
- obsolete assumptions.

Do not make changes yet.

Return a proposed documentation update list.
