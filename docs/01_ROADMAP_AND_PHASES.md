# OUTDOOR ESCAPE — DEVELOPMENT ROADMAP

## Phase 0 — Project foundation

Goal: establish a controlled development environment.

Deliverables:
- GitHub repository.
- README.
- project context files.
- Claude project instructions.
- architecture document.
- decisions log.
- roadmap.
- folder structure.
- initial Git workflow.
- local development instructions.

Exit criteria:
- repository exists;
- local clone works;
- first clean commit exists;
- Claude has the context pack;
- no game code is written yet unless needed for a skeleton.

---

## Phase 1 — Product specification

Goal: define exactly what the MVP must do.

Deliverables:
- player journey.
- game states.
- screen inventory.
- puzzle mechanics.
- hint rules.
- scoring rules.
- GPS rules.
- access-code concept.
- error/recovery behavior.
- accessibility/mobile requirements.

Exit criteria:
A developer can understand the complete player journey without guessing.

---

## Phase 2 — Game design

Goal: design the first playable Brașov game.

Deliverables:
- final working title.
- story.
- route.
- locations.
- puzzle chain.
- answers.
- two hints per puzzle.
- penalties.
- final reveal.
- historical fact verification list.
- field-testing checklist.

Exit criteria:
The complete game can be played on paper before the software exists.

---

## Phase 3 — PWA technical foundation

Goal: build the reusable engine.

Deliverables:
- responsive mobile UI.
- PWA manifest.
- service worker.
- application shell.
- game state machine.
- JSON content loader.
- local progress persistence.
- timer.
- answer validation.
- hints.
- basic GPS module.
- error/recovery handling.

Exit criteria:
A local test game can be completed from start to finish.

---

## Phase 4 — First real game integration

Goal: put the Brașov game into the engine.

Deliverables:
- all real locations.
- real puzzles.
- real media.
- GPS coordinates/radii.
- narrative.
- final sequence.

Exit criteria:
Complete game can be played outdoors.

---

## Phase 5 — Field testing

Goal: validate real-world behavior.

Tests:
- daylight.
- evening.
- Android.
- iPhone.
- weak signal.
- GPS inaccuracies.
- browser reload.
- accidental closure.
- battery consumption.
- route ambiguity.
- puzzle difficulty.
- accessibility.
- time distribution.

Test groups:
- internal solo run;
- controlled friends/family run;
- independent beta groups.

Exit criteria:
No critical blocker remains.

---

## Phase 6 — Access and monetization

Goal: allow real customers to obtain access automatically.

Potential flow:

Landing page
→ checkout
→ payment confirmation
→ unique team code
→ game URL
→ game initialization.

Candidate payment system:
Stripe.

Do not implement payment before the game loop is stable.

---

## Phase 7 — Analytics and operations

Track only useful events.

Examples:
- game_started
- location_unlocked
- puzzle_attempted
- hint_1_used
- hint_2_used
- answer_revealed
- location_completed
- game_completed
- game_abandoned

Avoid collecting unnecessary personal data.

---

## Phase 8 — B2C launch

Initial offer:
one game / one team / 2–4 players.

Marketing channels:
- website/SEO;
- hotel/pension partnerships;
- QR materials;
- social media;
- local tourism ecosystem;
- paid tests.

---

## Phase 9 — B2B / corporate

Possible features:
- multiple team codes;
- simultaneous starts;
- competitive scoring;
- team leaderboard;
- corporate reporting.

These are post-MVP features.

---

## Phase 10 — Game platform

Once the first game works reliably:
- multiple games;
- game selection;
- admin/content management;
- reusable location/puzzle components;
- multilingual content;
- additional cities.

---

## Notă — Platform V1.1 (2026-09-30)

Arhitectura consolidată (`13_PLATFORM_V1.1.md`, D-050 – D-063) nu schimbă ordinea fazelor și nu pornește niciun milestone. Ea stabilește cerințe pe care fazele viitoare trebuie să le respecte:

- produsele Walk (Brașov) și Bike (Funsy Bike, Fundata / Șirnea) folosesc același motor;
- sesiuni, echipe, participanți, rejoin, stare comună și `multi_device` cer un backend; acesta se introduce doar într-un milestone care îl cere explicit (D-019);
- pachetul offline, versiunile de aventură, GPS-ul adaptiv, Route Health / bypass și fluxul graf sunt DECISE, dar neimplementate;
- rutele și locațiile reale (Walk și Bike) se validează pe teren înainte de conținutul final (Faza 2, Faza 5).

Planificarea acestor elemente pe faze / milestone-uri este o decizie a proprietarului, încă nefăcută.
