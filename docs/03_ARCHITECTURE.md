# OUTDOOR ESCAPE — TECHNICAL ARCHITECTURE

## 1. Architecture objective

Build a lightweight, reusable PWA game engine capable of running multiple city mystery games.

## 2. Initial stack

Frontend:
- HTML
- CSS
- JavaScript

PWA:
- Web App Manifest
- Service Worker

Content:
- JSON

Map:
- Leaflet where a map is actually useful
- OpenStreetMap tiles subject to usage/licensing requirements

Location:
- Browser Geolocation API

Persistence:
- localStorage initially
- IndexedDB only if actual requirements justify it

Hosting:
- GitHub Pages (CONFIRMED — vezi D-014 în 04_DECISIONS_LOG.md)
- Publicare prin GitHub Actions, fără framework de build (CONFIRMED — vezi D-020)
- Aplicația: `https://rezervari.github.io/outdoor-escape/src/` (CONFIRMED — vezi D-035)

Version control:
- GitHub

AI development:
- Claude

## 3. Suggested repository structure

/
├── .github/
│   └── workflows/          (workflow de publicare pe GitHub Pages — D-020, încă necreat)
├── README.md
├── LICENSE                 (MIT — doar codul aplicației, vezi D-016)
├── LICENSE-CONTENT.md      (conținutul jocului — NU este MIT)
├── docs/
│   ├── 00_PROJECT_MASTER_CONTEXT.md
│   ├── 01_ROADMAP_AND_PHASES.md
│   ├── 02_CLAUDE_PROJECT_INSTRUCTIONS.md
│   ├── 03_ARCHITECTURE.md
│   ├── 04_DECISIONS_LOG.md
│   ├── 05_GAME_DESIGN_SPEC.md
│   ├── 06_GIT_WORKFLOW.md
│   ├── 07_TESTING.md
│   ├── 08_CLAUDE_START_PROMPT.md
│   ├── 09_CLAUDE_PROMPT_TEMPLATES.md
│   ├── 10_LOCAL_DEVELOPMENT.md
│   └── README_CONTEXT_PACK.md
│
├── src/
│   ├── index.html
│   ├── css/
│   ├── js/
│   │   ├── app.js
│   │   ├── state.js
│   │   ├── router.js
│   │   ├── gps.js
│   │   ├── timer.js
│   │   ├── puzzles.js
│   │   ├── hints.js
│   │   └── storage.js
│   ├── assets/
│   │   ├── images/
│   │   └── audio/
│   ├── manifest.webmanifest
│   └── sw.js
│
├── content/
│   └── games/
│       └── game-001/
│           ├── game.json
│           ├── locations.json
│           ├── puzzles.json
│           └── media/
│
└── tests/

This is a starting structure, not an instruction to create every file immediately.

Notă (CONFIRMED — D-020): site-ul se publică printr-un workflow GitHub Actions care publică doar fișierele statice necesare aplicației (codul din `src/` și conținutul din `content/`), fără `docs/` și `tests/`, fără framework de build. Site-ul publicat păstrează structura repository-ului (CONFIRMED — vezi D-035 și secțiunea 3a).

## 3a. URL-uri și căi (CONFIRMED — D-035)

| | Producție (GitHub Pages) | Local |
| --- | --- | --- |
| Aplicația | `https://rezervari.github.io/outdoor-escape/src/` | `http://localhost:8000/src/` |
| Conținutul | `https://rezervari.github.io/outdoor-escape/content/...` | `http://localhost:8000/content/...` |

Reguli:
- Toate căile sunt relative; nicio cale nu începe cu `/`. Din `src/`, conținutul se accesează prin `../content/...`.
- Manifestul PWA (`manifest.webmanifest`) și service worker-ul (`sw.js`) stau lângă `index.html`, în `src/`.
- Pentru MVP nu există routing bazat pe URL; ecranul afișat rezultă din starea internă a jocului. Dacă va fi nevoie ulterior, se folosește hash routing.
- Cheile din `localStorage`, numele cache-urilor (Cache API) și orice alte chei persistente au prefixul proiectului (de exemplu `outdoor-escape:`). Domeniul `rezervari.github.io` este comun tuturor site-urilor GitHub Pages ale contului.
- Workflow-ul de publicare copiază structura necesară (`src/`, `content/`) fără transformări de căi și fără build system.

Motivare: aceeași structură relativă local și online înseamnă că ce funcționează la `localhost` funcționează și pe GitHub Pages, fără cod dependent de mediu.

## 4. Game state model

The application should have explicit states.

Example:

NEW
→ READY
→ PLAYING
→ AT_LOCATION
→ PUZZLE_ACTIVE
→ HINT_USED
→ PUZZLE_SOLVED
→ LOCATION_COMPLETE
→ PLAYING
→ FINAL
→ COMPLETE

Error/recovery states should be handled without losing progress.

Notă (PROPOSED — vezi D-030, neaprobat): `HINT_USED` descrie mai degrabă un eveniment decât o stare. Folosirea unui indiciu nu schimbă ce poate face jucătorul (puzzle-ul rămâne activ), ci modifică datele puzzle-ului (câte indicii au fost folosite, penalizarea). Propunerea este ca indiciile să fie înregistrate ca date/evenimente în starea `PUZZLE_ACTIVE`, nu ca stare separată. Lista de mai sus rămâne neschimbată până la aprobare.

## 5. Separation of concerns

Engine:
- state;
- navigation;
- timer;
- GPS;
- persistence;
- validation;
- UI components.

Content:
- narrative;
- locations;
- puzzles;
- hints;
- answers;
- penalties;
- coordinates;
- media.

Business:
- purchase;
- access;
- codes;
- analytics.

These layers should not become unnecessarily coupled.

## 6. Access-code architecture

MVP can initially support test codes stored outside production payment flow.

Production model:
payment confirmation
→ secure server-side code generation
→ code record
→ player activation.

Never trust a frontend-only secret to authorize paid access.

## 6a. Validarea răspunsurilor (CONFIRMED — D-021)

Pentru MVP, răspunsurile se verifică în browser. Motorul trebuie să permită mutarea ulterioară a validării pe server fără rescrierea lui.

Cerințe:
- Validarea este izolată într-un singur modul (de exemplu `puzzles.js` sau un modul dedicat). Restul motorului (stări, UI, indicii, cronometru) nu compară răspunsuri și nu citește direct câmpurile cu răspunsuri din conținut.
- Motorul trimite modulului identificatorul puzzle-ului și textul introdus de jucător și primește un rezultat (corect/incorect).
- Interfața este asincronă (rezultatul vine ca `Promise`), chiar dacă implementarea MVP este locală. Astfel, o implementare viitoare care întreabă un server poate înlocui implementarea locală fără schimbări în motor.
- Implementarea MVP poate compara text normalizat sau hash-uri. Normalizarea se aplică înainte de comparare/hash (regulile — D-024, PROPOSED).
- Semnătura exactă a interfeței se stabilește în Faza 3.

Limite acceptate:
- Hash-ul nu este o barieră de securitate. Răspunsurile scurte pot fi ghicite prin încercări automate, iar codul și conținutul sunt publice.
- Validarea locală funcționează și offline. O validare viitoare pe server va avea nevoie de conexiune și de o variantă de rezervă pentru semnal slab; aceasta se proiectează atunci, nu acum.
- În faza de fundație nu există backend, API sau validare pe server (D-019).

## 7. GPS architecture

A location object should contain:
- latitude;
- longitude;
- acceptable radius;
- optional fallback instructions.

The GPS module should expose a simple result such as:

{
  "insideRadius": true,
  "distanceMeters": 18,
  "accuracyMeters": 12
}

The game engine decides what that result means.

## 8. Offline strategy

At minimum:
- cache application shell;
- cache game content;
- cache critical images;
- preserve local progress.

Do not promise complete offline functionality until it has been tested.

## 9. Accessibility

Minimum:
- readable text;
- strong contrast;
- large controls;
- keyboard accessibility where relevant;
- no information conveyed only by color;
- visible focus states;
- clear error messages.

## 10. Privacy

Collect the minimum necessary data.

Location should be used for gameplay and should not automatically be stored remotely unless there is a clear product requirement.

Analytics should avoid unnecessary personal data.

## 11. Performance

Target:
- fast first load;
- small JS bundle;
- optimized images;
- lazy loading for non-critical media;
- minimal dependencies.

Real-world mobile performance matters more than desktop benchmarks.

## 12. Future extensibility

Possible later modules:
- Stripe;
- backend API;
- database;
- admin CMS;
- multilingual content;
- leaderboard;
- team competitions;
- corporate mode.

These are not part of the initial technical foundation unless required.
