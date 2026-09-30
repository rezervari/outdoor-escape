# OUTDOOR ESCAPE — PROJECT MASTER CONTEXT

> **Notă (2026-09-30):** arhitectura consolidată a platformei este descrisă în [`13_PLATFORM_V1.1.md`](13_PLATFORM_V1.1.md) — **OUTDOOR ESCAPE PLATFORM V1.1** (produsele Walk și Bike, rută ≠ aventură ≠ sesiune, echipe, continuitate, stare comună, offline-first, versiuni; decizii D-050 – D-063). Acest document rămâne contextul de produs inițial; unde V1.1 este mai specific, V1.1 are prioritate.

## 1. Project identity

Working name: Outdoor Escape
Product concept: Digital Outdoor Escape Room / City Mystery Hunt
Initial city: Brașov, Romania
Primary delivery: PWA Web-App
Development environment: GitHub + Claude
Developer model: single-person development, with AI-assisted implementation
Primary language for the product: Romanian initially
Target users: tourists, couples, small groups, friends, and later corporate/team-building groups.

## 2. Core product idea

The product is a self-guided outdoor mystery game played physically in the city and digitally through a mobile-first web application.

A player:
1. purchases access;
2. receives a unique game/team access code;
3. opens the PWA on a phone;
4. follows a narrative;
5. physically walks to locations;
6. observes details in the real environment;
7. solves puzzles;
8. uses hints when necessary;
9. unlocks subsequent locations;
10. reaches a final resolution.

The product must work without the operator being physically present.

## 3. Product principles

- Mobile first.
- No native mobile app for the MVP.
- No installation requirement.
- Browser-based PWA.
- Designed for independent play.
- Robust in real-world conditions.
- GPS is an aid, not the only progression mechanism.
- Game content must be separated from application code.
- The same game engine must support multiple future games.
- Avoid unnecessary infrastructure during MVP.
- Keep operating costs low.
- GitHub is the source of truth for code and documentation.
- Claude is the primary AI development environment.
- Human approval is required before destructive or production-affecting changes.

## 4. Initial MVP target

One complete playable game in Brașov.

Target:
- 2–4 players per team.
- Approximately 90–120 minutes.
- Approximately 2.5–3.5 km.
- Approximately 8–10 physical locations.
- Approximately 7–9 puzzles.
- Two progressive hints per puzzle.
- Optional "I am stuck / show answer" mechanism.
- Time/scoring system.
- Mobile-first interface.
- Progress persistence.
- Basic offline resilience.
- Unique access code.
- Payment integration planned, but payment should not block early game testing.

## 5. Initial thematic direction

Possible working theme:
"Tainele Breslei Pierdute din Kronstadt"

This is a working concept, not a final locked title.

The story should use real places, historical atmosphere and verifiable historical/architectural facts. Fictional elements must be clearly part of the game narrative and must not be presented as historical fact.

Potential area:
- Piața Sfatului
- Biserica Neagră
- Strada Sforii
- Poarta Șchei
- Aleea După Ziduri
- Turnul Negru
- Turnul Alb
- other suitable central locations after field validation

No route is considered final until physically checked.

## 6. Technology direction

Preferred MVP direction:
- HTML
- CSS
- JavaScript
- PWA manifest
- Service Worker
- GitHub repository
- GitHub Pages or equivalent static deployment where technically appropriate (confirmat: GitHub Pages prin GitHub Actions — D-014, D-020)
- Leaflet + OpenStreetMap for map presentation where needed
- Browser Geolocation API
- localStorage / IndexedDB for local progress as appropriate
- JSON-based game content

Backend/payment/authentication components should be introduced only when actually required.

Potential later components:
- serverless API
- database
- Stripe
- automated access-code issuance
- analytics
- admin interface
- leaderboard

Do not introduce these prematurely.

## 7. Important GPS principle

GPS must never be the sole mechanism that can permanently block a player.

Preferred progression:
GPS proximity check
→ visual confirmation / observation
→ puzzle
→ answer validation
→ next location

The application should tolerate normal GPS inaccuracies.

## 8. Product architecture principle

The application is a reusable GAME ENGINE.

Future games should be content/configuration, not separate applications.

Conceptual structure:

GAME ENGINE
├── Game 001 — Brașov mystery
├── Game 002 — another Brașov mystery
├── Game 003 — Brașov night game
└── future cities/games

Game content should be stored separately from UI and engine logic.

## 9. GitHub principle

GitHub is the source of truth.

Preferred workflow:
1. inspect current state;
2. make a small logical change;
3. inspect diff;
4. test locally;
5. commit;
6. verify status;
7. push to origin;
8. verify deployed result.

Avoid large uncontrolled changes.

The repository should contain both code and project documentation.

## 10. Claude principle

Claude should receive project context before implementation.

Claude must:
- read the context files;
- respect architecture decisions;
- not silently change architecture;
- not introduce libraries without justification;
- not overwrite working files unnecessarily;
- explain important changes;
- keep documentation synchronized with decisions;
- flag conflicts instead of inventing assumptions.

## 11. Definition of MVP success

The MVP is successful when an external test group can:
- purchase or receive access;
- open the game on a normal smartphone;
- understand the instructions without assistance;
- complete the route;
- solve the puzzles;
- use hints;
- recover after closing/reopening the browser;
- reach the final;
- complete the game without operator intervention.

Technical elegance is secondary to reliable real-world playability.

## 12. Current project status

Stage: concept / pre-development.

No production application architecture is considered implemented yet.

Next objective:
create the repository, documentation/context pack, development rules, and product specification before substantial coding.

Notă (2026-09-30): secțiunea de mai sus este istorică. Stare actuală: motorul de joc (fundația V2) este implementat și publicat; M-003.1 (Browser Geolocation) este finalizat; M-003.2 (hartă) este implementat, comis și acceptat de proprietar la 30.09.2026 (milestone închis). Arhitectura Platform V1.1 este decisă, dar neimplementată. Tabelul complet IMPLEMENTAT / DECIS / FUTURE: `13_PLATFORM_V1.1.md` §17.
