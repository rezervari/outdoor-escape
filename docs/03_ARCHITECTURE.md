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
│   └── workflows/
│       └── deploy-pages.yml (publicare pe GitHub Pages — D-020, creat)
├── index.html              (doar redirecționare către src/ — D-036, creat; NU este aplicația)
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

Stare (motorul de joc v1): pe lângă scheletul PWA (secțiunea 3b), există modulele `src/js/answers.js`, `content.js`, `game.js`, `storage.js`, aventura demo `content/adventures/brasov-centrul-vechi.json`, testele automate din `tests/` și `package.json` (doar pentru teste). Conținutul stă în `content/adventures/<id>.json` (CONFIRMED — D-037); `content/games/` este gol (`.gitkeep`). Modulele `state.js`, `router.js`, `gps.js`, `timer.js`, `puzzles.js`, `hints.js` și `src/assets/` nu există. Detalii: secțiunea 3c.

Notă (CONFIRMED — D-020): site-ul se publică printr-un workflow GitHub Actions care publică doar fișierele statice necesare aplicației (codul din `src/` și conținutul din `content/`), fără `docs/` și `tests/`, fără framework de build. Site-ul publicat păstrează structura repository-ului (CONFIRMED — vezi D-035 și secțiunea 3a).

## 3a. URL-uri și căi (CONFIRMED — D-035)

| | Producție (GitHub Pages) | Local |
| --- | --- | --- |
| Rădăcina (doar redirecționare, D-036) | `https://rezervari.github.io/outdoor-escape/` | `http://localhost:8000/` |
| Aplicația | `https://rezervari.github.io/outdoor-escape/src/` | `http://localhost:8000/src/` |
| Conținutul | `https://rezervari.github.io/outdoor-escape/content/...` | `http://localhost:8000/content/...` |

Diferența dintre `/` și `/src/`:
- `/src/` este aplicația: `index.html` al jocului, manifestul PWA, service worker-ul, CSS/JS. Aici se instalează PWA-ul și aici indică toate intrările oficiale (coduri QR, linkuri, instrucțiuni pentru jucători).
- `/` (rădăcina) conține doar `index.html` din rădăcina repository-ului, care redirecționează către `src/` (D-036). Nu are manifest, nu înregistrează service worker, nu conține logică de joc și nu este garantat offline.

Comportamentul rădăcinii (CONFIRMED — D-036):
- redirecționare cu `location.replace()` către calea relativă `src/`, păstrând parametrii de query și hash-ul;
- `meta refresh` ca rezervă;
- link vizibil către `src/` ca rezervă;
- același comportament local și în producție.

Reguli:
- Toate căile sunt relative; nicio cale nu începe cu `/`. Din `src/`, conținutul se accesează prin `../content/...`.
- Manifestul PWA (`manifest.webmanifest`) și service worker-ul (`sw.js`) stau lângă `index.html`, în `src/`.
- Pentru MVP nu există routing bazat pe URL; ecranul afișat rezultă din starea internă a jocului. Dacă va fi nevoie ulterior, se folosește hash routing.
- Cheile din `localStorage`, numele cache-urilor (Cache API) și orice alte chei persistente au prefixul proiectului (de exemplu `outdoor-escape:`). Domeniul `rezervari.github.io` este comun tuturor site-urilor GitHub Pages ale contului.
- Workflow-ul de publicare copiază structura necesară (`src/`, `content/` și `index.html` din rădăcină — D-036) fără transformări de căi și fără build system.

Motivare: aceeași structură relativă local și online înseamnă că ce funcționează la `localhost` funcționează și pe GitHub Pages, fără cod dependent de mediu.

## 3b. Scheletul PWA (fundația tehnică)

Scheletul conține doar infrastructura tehnică. Nu conține motor de joc, GPS, hărți, puzzle-uri, validare, progres salvat sau conținut.

| Fișier | Rol |
| --- | --- |
| `index.html` (rădăcină) | Redirecționare către `src/` (D-036). `location.replace("src/" + location.search + location.hash)`; `meta refresh` către `src/` doar în `<noscript>`; link vizibil către `src/`. Fără manifest, fără service worker. |
| `src/index.html` | Punctul de intrare al aplicației. Ecran minimal marcat „fundație tehnică”, cu starea JavaScript și a service worker-ului. |
| `src/manifest.webmanifest` | Manifest minim. `start_url` și `scope` sunt `"./"`, deci se rezolvă relativ la manifest: `.../outdoor-escape/src/`. Nume și descriere provizorii. |
| `src/sw.js` | Service worker minim (vezi mai jos). |
| `src/js/app.js` | Modul ES. Confirmă încărcarea și înregistrează service worker-ul cu cale relativă (`sw.js`, scope `./`). Modulele viitoare se importă de aici cu căi relative. |
| `src/css/app.css` | Stiluri minime, mobile-first. Nu este designul final. |
| `.github/workflows/deploy-pages.yml` | Publicare pe GitHub Pages (D-020). |

Detalii de implementare:

- `meta refresh` stă în `<noscript>`, ca să nu concureze cu `location.replace()`: dacă ambele ar rula, `meta refresh` ar putea înlocui navigarea care păstrează query-ul și hash-ul. Fără JavaScript, `meta refresh` și linkul duc la `src/`, dar **fără** query și hash (sunt statice).
- Manifestul **nu** are câmpul `id`. Conform specificației, `id` se rezolvă față de originea domeniului, nu față de manifest: `"id": "./"` ar deveni `https://rezervari.github.io/`, o identitate comună tuturor site-urilor contului. Fără `id`, identitatea aplicației este `start_url` (`.../outdoor-escape/src/`). Verificat în Chromium.
- Manifestul **nu** are încă iconuri, pentru că nu există iconuri reale. Consecință: aplicația **nu** este instalabilă în Chrome (Chrome cere iconuri de cel puțin 144 px). Se adaugă când există iconurile.
- `app.js` tratează lipsa service worker-ului (context nesigur, `file://`, unele moduri private) și eșecul înregistrării: aplicația afișează starea și continuă fără service worker.

### Service worker — ce este și ce NU este offline în această etapă

- Scope: `src/` (fișierul stă în `src/`, D-035). Rădăcina nu este controlată.
- La instalare pune în cache doar fișierele fundației: `./`, `index.html`, `manifest.webmanifest`, `css/app.css`, `js/app.js`.
- Pentru aceste fișiere: rețea mai întâi, cache ca rezervă. Când rețeaua răspunde, copia din cache se actualizează. Navigarea către `src/?...` folosește intrarea `./`.
- Orice altă cerere nu este interceptată: `../content/`, alte domenii, cereri non-GET, fișiere care nu sunt în listă.
- Nume cache: `outdoor-escape:shell:<versiune>` (D-035). La o versiune nouă (`CACHE_VERSION` în `sw.js`), cache-urile vechi cu prefixul `outdoor-escape:shell:` sunt șterse la activare. Cache-urile altor site-uri de pe același domeniu nu sunt atinse.
- Service worker-ul nou se activează imediat (`skipWaiting` + `clients.claim`). În fundație nu există stare de joc care să fie afectată; comportamentul la actualizare în timpul unui joc se stabilește odată cu motorul (Faza 3).

Offline în această etapă: doar ecranul fundației se poate redeschide fără rețea, după o primă vizită online. Conținutul jocurilor, media și rădăcina **nu** sunt disponibile offline. (Actualizat pentru motorul v1: vezi secțiunea 3c — aventura demo este acum în cache.) Nu există încă o strategie offline pentru joc (secțiunea 8).

## 3c. Motorul de joc v1 (fără GPS, hartă, cronometru sau backend)

Prima versiune funcțională a motorului. Conținutul este separat de cod: aventura stă într-un fișier JSON, iar codul nu conține texte sau răspunsuri de joc.

### Fișiere

| Fișier | Rol |
| --- | --- |
| `content/adventures/<id>.json` (D-037) | O aventură: date generale + lista de provocări. Aventura actuală este DEMO (fără locații reale, fără afirmații istorice). |
| `src/js/content.js` | Încarcă JSON-ul (`fetch`, URL relativ la modul: `../../content/adventures/<id>.json`), validare minimă, erori pe înțelesul jucătorului (`AdventureLoadError`). |
| `src/js/answers.js` | Singurul modul care citește câmpul `answer` și compară răspunsuri (D-021): `normalizeAnswer`, `answersMatch`, `createLocalValidator` (interfață asincronă `check(challengeId, input) → Promise<boolean>`), `withoutAnswers`. |
| `src/js/game.js` | Motorul: stări, progres, scor. Fără DOM și fără stocare. Primește aventura **fără răspunsuri** și validatorul. Notifică schimbările prin `subscribe()`. |
| `src/js/storage.js` | Salvare/restaurare/ștergere în `localStorage`, cheia `outdoor-escape:game:<id>` (prefix D-035; cheie confirmată — D-029). Nu aruncă excepții dacă stocarea lipsește. |
| `src/js/app.js` | Leagă modulele, afișează ecranele, salvează automat la fiecare schimbare de stare, înregistrează service worker-ul. |

Fluxul la pornire: `app.js` → `loadAdventure(id)` → `createLocalValidator(aventură)` + `withoutAnswers(aventură)` → `createGame({ adventure, validator, savedState })` → interfața. Aventura implicită este `brasov-centrul-vechi`; pentru teste se poate cere alta cu `src/?adventure=<id>` (id-ul este validat: litere mici, cifre, cratimă).

### Formatul aventurii (schemaVersion 1)

```json
{
  "schemaVersion": 1,
  "id": "brasov-centrul-vechi",
  "demo": true,
  "city": "Brașov",
  "title": "…",
  "description": "…",
  "estimatedTime": 60,
  "difficulty": "easy",
  "challenges": [
    { "id": "challenge-01", "title": "…", "description": "…", "hint": "…", "answer": "…", "points": 100 }
  ]
}
```

Obligatorii: `id`, `title`, `challenges` (cel puțin una); pentru fiecare provocare `id` (unic), `title`, `description`, `answer`, `points` (întreg ≥ 0). Opționale: `schemaVersion`, `demo`, `city`, `description`, `estimatedTime` (minute), `difficulty` (`easy`/`medium`/`hard`), `hint`.

Câmpurile necunoscute sunt permise, ca formatul să poată fi extins fără a strica validarea: coordonate, imagini, mai multe indicii, variante de răspuns, tipuri de provocări, obiective, timp limită, recompense. Niciunul nu este implementat încă.

Id-urile (`id` al aventurii și al provocărilor) trebuie să rămână stabile: progresul salvat este legat de ele.

### Stări și progres

- Starea jocului: `idle` → `playing` → `completed`. „Joacă din nou” / „Începe de la capăt” readuc jocul la `idle` și șterg progresul salvat.
- Fiecare provocare are progresul `pending` | `solved` | `failed` | `skipped`, plus `attempts` și `hintUsed`. Indiciul este o dată, nu o stare (în spiritul D-030).
  - `solved` — rezolvată corect; singura stare care aduce puncte și care se numără la „provocări rezolvate”.
  - `skipped` — jucătorul a apăsat „Sari peste (0 puncte)”: 0 puncte, nu este rezolvată, jocul continuă.
  - `failed` — închisă fără rezolvare, 0 puncte. Motorul o suportă (`failChallenge()`), dar nicio acțiune din interfață nu o produce încă; este pregătită pentru reguli viitoare (de exemplu număr maxim de încercări).
- O provocare `pending` poate deveni `solved`, `skipped` sau `failed`; o provocare închisă nu își mai schimbă starea. Trecerea la următoarea provocare cere închiderea celei curente. Toate trei stările se salvează și se restaurează după refresh.
- Scorul = suma `points` pentru provocările `solved` (`failed` și `skipped` = 0). Nu există penalizări (D-025 rămâne deschisă). Scorul se recalculează din conținut la restaurare; valoarea salvată nu este de încredere.
- Starea salvată: `{ schemaVersion, adventureId, status, currentIndex, score, challenges: { <id>: { status, attempts, hintUsed } }, startedAt, completedAt }`. O stare salvată pentru altă aventură sau altă versiune de schemă este ignorată (jocul pornește de la zero). Provocările noi din conținut pornesc ca `pending`; cele eliminate sunt ignorate.
- Mesajul „Răspuns incorect” nu este salvat: după refresh, provocarea nerezolvată apare fără mesaj. Mesajul „Corect!” / „sărită” se reconstruiește din progres.

Această listă simplă de stări nu înlocuiește modelul din secțiunea 4 (locații, GPS, final); acela va fi integrat când se adaugă locațiile.

### Normalizarea răspunsurilor (CONFIRMED — D-024)

Înainte de comparare, ambele texte trec prin: descompunere Unicode (NFD) și eliminarea semnelor diacritice (acoperă `ă â î ș ț` și variantele cu sedilă `ş ţ`), litere mici, spațiile multiple reduse la unul, spațiile de la capete eliminate. Nu se elimină punctuația, nu se echivalează numerele scrise în litere și nu există fuzzy matching. Răspunsul gol nu este niciodată corect.

### Service worker

`SHELL_FILES` include noile module și aventura demo `../content/adventures/brasov-centrul-vechi.json` (aceeași strategie network-first). `CACHE_VERSION` = `v3`; cache-urile mai vechi cu prefixul `outdoor-escape:shell:` se șterg la activare. După o primă încărcare reușită, un refresh fără rețea încarcă aplicația și aventura demo din cache. Alte aventuri (sau alt conținut din `content/`) nu sunt puse în cache: fără rețea, ele duc la ecranul de eroare cu „Încearcă din nou”, iar progresul salvat rămâne intact.

Limitare cunoscută (actualizări): service worker-ul folosește `fetch()` obișnuit, deci trece prin cache-ul HTTP al browserului (pe GitHub Pages, de obicei câteva minute). Imediat după o publicare nouă, un browser care a vizitat recent site-ul poate combina un `index.html` nou cu module JavaScript vechi. Se rezolvă singur la expirarea cache-ului HTTP; o soluție (URL-uri versionate sau `cache: "no-cache"` în service worker) este de decis separat.

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

Stare: în scheletul PWA doar fișierele fundației sunt în cache (secțiunea 3b). Conținutul jocului și media nu sunt încă în cache.

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
