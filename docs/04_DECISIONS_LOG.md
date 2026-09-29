# OUTDOOR ESCAPE — DECISIONS LOG

Use this file for decisions that should remain stable across development.

## D-001 — Product format
Status: CONFIRMED

Decision:
Build the product as a PWA Web-App.

Reason:
Mobile browser access avoids native app installation and reduces development/maintenance overhead.

---

## D-002 — Development platform
Status: CONFIRMED

Decision:
Use GitHub as the source of truth and Claude as the primary development environment.

---

## D-003 — Development model
Status: CONFIRMED

Decision:
The product will initially be developed by one person with AI assistance.

---

## D-004 — MVP technology direction
Status: CONFIRMED

Decision:
Prefer lightweight HTML/CSS/JavaScript PWA architecture before introducing a no-code platform or large framework.

---

## D-005 — Game engine
Status: CONFIRMED

Decision:
Build a reusable game engine rather than a one-off game.

---

## D-006 — GPS
Status: CONFIRMED

Decision:
GPS is an aid to progression and must not be the only recovery path.

---

## D-007 — Content architecture
Status: CONFIRMED

Decision:
Game content must be separated from engine code and represented as structured data where practical.

---

## D-008 — Payment timing
Status: CONFIRMED

Decision:
Payment automation is implemented after the core game loop is stable.

Target technology:
Stripe.

---

## D-009 — Initial city
Status: CONFIRMED

Decision:
The first game is designed for Brașov.

---

## D-010 — Initial game format
Status: WORKING TARGET

2–4 players.
90–120 minutes.
2.5–3.5 km.
8–10 locations.
7–9 puzzles.

These numbers can change after field testing.

---

## D-011 — Historical content
Status: CONFIRMED

Decision:
Real historical/architectural claims must be verified. Fictional story elements must not be presented as factual history.

---

## D-012 — Architecture change protocol
Status: CONFIRMED

Decision:
Claude must flag major architectural changes rather than silently implementing them.

---

## D-013 — Current stage
Status: CONFIRMED

Decision:
The project is currently at pre-development / specification stage.

Next milestone:
repository + context pack + product specification.
