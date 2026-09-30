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

## 3. Structura repository-ului

Structura actuală (motorul V2, fundația):

```text
/
├── .github/workflows/deploy-pages.yml  publicare pe GitHub Pages (D-020) — publică doar index.html, src/, content/
├── index.html                          doar redirecționare către src/ (D-036); NU este aplicația
├── package.json                        doar pentru `npm test` (fără dependențe, D-023)
├── README.md, LICENSE, LICENSE-CONTENT.md
├── docs/                               documentația (00–15); nu se publică
├── src/                                aplicația (publicată)
│   ├── index.html, manifest.webmanifest, sw.js
│   ├── css/app.css
│   ├── vendor/leaflet/  Leaflet 1.9.4 inclus local (leaflet.js, leaflet.css, LICENSE — D-046)
│   └── js/
│       ├── app.js       interfața (orchestrare, ecranele, DOM-ul aplicației)
│       ├── content.js   încărcare + validare după schemaVersion
│       ├── schema.js    schema V2, validare, conversie V1 → V2
│       ├── defaults.js  valorile implicite centrale
│       ├── events.js    modelul de evenimente (reguli declarative)
│       ├── geo.js       modelul de locație (distanțe, zone, histerezis)
│       ├── game.js      motorul (stări, progres V2, migrare)
│       ├── answers.js   normalizarea și verificarea răspunsurilor
│       ├── location.js  adaptorul Browser Geolocation (M-003.1)
│       ├── map-model.js modelul vizual al hărții (M-003.2, pur)
│       ├── map.js       harta Leaflet, strat exclusiv vizual (M-003.2)
│       └── storage.js   localStorage
├── content/                            conținutul aventurilor (publicat)
│   ├── adventures/brasov-centrul-vechi.json   aventura DEMO (schemaVersion 1, D-037)
│   └── games/.gitkeep                         gol (D-037)
└── tests/                              teste automate (nu se publică)
    ├── *.test.js
    └── fixtures/adventure-v2-demo.json        aventură V2 fictivă, doar pentru teste (D-042)
```

Planul inițial (module `state.js`, `router.js`, `gps.js`, `timer.js`, `puzzles.js`, `hints.js`, `src/assets/`, `content/games/game-001/` cu mai multe fișiere) a fost înlocuit de structura de mai sus (D-037, D-038). Modulele pentru GPS-ul browserului, hartă și audio se adaugă în etapele lor.

Detalii: secțiunea 3c și [`11_ADVENTURE_SCHEMA_V2.md`](11_ADVENTURE_SCHEMA_V2.md).

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

Notă istorică: această secțiune descrie scheletul inițial (commit „Add Outdoor Escape MVP”). Ecranul „fundație tehnică” a fost înlocuit de interfața jocului, iar lista de fișiere din cache a crescut — starea actuală este în secțiunea 3c. Regulile de mai jos (scope, căi relative, prefixul cache-ului, redirecționarea din rădăcină, manifestul fără `id`) rămân valabile.

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

## 3c. Motorul de joc (fundația V2)

Conținutul este separat de cod: aventura stă într-un fișier JSON, iar codul nu conține texte, răspunsuri sau logică specifică unei aventuri. Motorul V1 (provocări liniare) a fost extins în fundația V2: misiuni pe trasee, locații, evenimente, parteneri, secrete. Specificația completă a schemei și a contractelor: [`11_ADVENTURE_SCHEMA_V2.md`](11_ADVENTURE_SCHEMA_V2.md).

**Implementat:** schema V2, migrarea V1 → V2 (conținut și progres), modelul de locație, motorul de evenimente, progresul V2, testele; din M-003.1: adaptorul Browser Geolocation (`location.js`), urmărirea poziției cu pagina activă, starea GPS și explicația permisiunii în interfață, obiectivul misiunii curente cu „Am ajuns”. **Pregătit, dar neimplementat:** misiunile partener, secrete și cu timp în UI, interfața naratorului, audio, GPS în fundal / geofencing, notificări. **Harta (M-003.2):** implementată conform `12_MAP_SPECIFICATION_M-003.2.md` (D-046–D-049) — `map-model.js`, `map.js`, Leaflet 1.9.4 local; comisă (`39a6b28`), acceptată de proprietar la 30.09.2026 — milestone închis. Tabelul complet: `11_ADVENTURE_SCHEMA_V2.md`, secțiunea 0.

### Fișiere

| Fișier | Rol |
| --- | --- |
| `content/adventures/<id>.json` (D-037) | O aventură, `schemaVersion` 1 sau 2. Aventura actuală este DEMO, V1 (fără locații reale, fără afirmații istorice). |
| `src/js/content.js` | Încarcă JSON-ul (`fetch`, URL relativ la modul: `../../content/adventures/<id>.json`), îl validează după `schemaVersion` (V1 minim, V2 prin `schema.js`), erori pe înțelesul jucătorului (`AdventureLoadError`). |
| `src/js/schema.js` | Schema V2: vocabular închis, validare cu verificarea referințelor, conversia V1 → V2 în memorie, forma normalizată (`toAdventureV2`). |
| `src/js/defaults.js` | Valorile implicite centrale (GPS, progresie, limita lanțurilor de evenimente) și configurația hărții (M-003.2): `MAP_LIBRARY_VERSION`, `DEFAULT_MAP_TILES` (provider OSM, atribuire), `DEFAULT_MAP_VIEW` (valori strict vizuale). |
| `src/js/events.js` | Modelul de evenimente: liste închise, filtru simplu, `once`, limită de lanț. |
| `src/js/geo.js` | Modelul de locație: distanță haversine, zone `inside/near/outside/uncertain`, histerezis. Fără Geolocation API. `effectiveRadius(location, gps)` (M-003.2, D-049-D / R2): singura sursă a razei efective, folosită de `evaluateProximity`. |
| `src/js/answers.js` | Singurul modul care citește câmpul `answer` și compară răspunsuri (D-021): `normalizeAnswer`, `answersMatch`, `createLocalValidator` (interfață asincronă `check(missionId, input) → Promise<boolean>`), `withoutAnswers` (V1 și V2). |
| `src/js/game.js` | Motorul: stări, progres V2 pe entități, reguli de evenimente, tranziții de locație, scor derivat, migrarea progresului V1. Fără DOM și fără stocare. Primește aventura **fără răspunsuri** și validatorul. Notifică schimbările prin `subscribe()`; mesajele/sunetele sunt „efecte” (`takeEffects()`). |
| `src/js/storage.js` | Salvare/restaurare/ștergere în `localStorage`, cheia `outdoor-escape:game:<id>` (prefix D-035; cheie confirmată — D-029). Nu aruncă excepții dacă stocarea lipsește. |
| `src/js/location.js` | Adaptorul Browser Geolocation API (M-003.1): verifică disponibilitatea (inclusiv contextul securizat), `watchPosition`/`clearWatch` fără porniri multiple, erori (refuz → oprire; indisponibil/timeout → urmărirea continuă), retry, transformă `GeolocationPosition` în `{ lat, lng, accuracy, timestamp }` și îl transmite mai departe. Nu calculează distanțe, praguri sau tranziții. API-ul se injectează (testabil în Node). |
| `src/js/app.js` | Leagă modulele, afișează ecranele, salvează automat la fiecare schimbare de stare, înregistrează service worker-ul. Trimite fix-urile de la `location.js` în `game.reportPosition` (doar în joc) și afișează starea GPS și obiectivul; nu calculează nimic geo. Pentru hartă (M-003.2): adună datele existente (`game.getLocation`, obiectivul curent, `describeLocation`, fix-ul trackerului), le trece prin `map-model.js` și apelează `map.js`; creează / distruge harta și prinde orice eroare a ei (jocul continuă ca în M-003.1). |
| `src/js/map-model.js` | Modul pur (M-003.2, D-048): traduce prin tabele fixe starea existentă în modelul vizual `{ player: { fix, quality }, locations: [{ id, name, lat, lng, radius, state, visible }], currentObjectiveId }`. Calitatea: `gps-ready` → `valid`, `gps-uncertain` → `uncertain`, restul → `none` (D-049-C). Raza este `radiusMeters` de la motor. Fără importuri, fără calcule GPS. |
| `src/js/map.js` | Strat exclusiv vizual (M-003.2, D-047): singurul modul care folosește Leaflet. API: `createMap({ container, tileConfig, view?, leaflet? })` → `updatePlayer`, `updateLocations`, `setCurrentObjective`, `fitToAdventure`, `centerOnPlayer`, `destroy`; erori `MapError` (`leaflet_unavailable`, `invalid_container`, `invalid_tile_config`). Nu accesează geolocația, nu apelează motorul, nu calculează distanțe/progres. |
| `src/vendor/leaflet/` | Leaflet **1.9.4** (D-046, D-049-A), copiat neschimbat din arhiva oficială `https://github.com/Leaflet/Leaflet/releases/download/v1.9.4/leaflet.zip` (`dist/`). SHA-256: `leaflet.js` `85d455b4522415f6badc42a0e7d17c919d100347d6b8958bd0dc738fdecd6d50`, `leaflet.css` `a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6`. Fără imaginile implicite (markerii folosesc `divIcon`) și fără `leaflet.js.map`. `.gitattributes` marchează `src/vendor/**` ca `-text -diff`, ca fișierele să rămână identice byte cu byte pe orice sistem. Verificat de `tests/map.test.js`. |

Fluxul la pornire: `app.js` → `loadAdventure(id)` → `toAdventureV2(...)` → `createLocalValidator(aventură)` + `withoutAnswers(aventură)` → `createGame({ adventure, validator, savedState })` → interfața. Aventura implicită este `brasov-centrul-vechi`; pentru teste se poate cere alta cu `src/?adventure=<id>` (id-ul este validat: litere mici, cifre, cratimă).

### Formatul V1 (schemaVersion 1 — acceptat în continuare, convertit la încărcare)

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

Formatul V2 (misiuni, locații, evenimente, audio, parteneri, secrete) și conversia V1 → V2: [`11_ADVENTURE_SCHEMA_V2.md`](11_ADVENTURE_SCHEMA_V2.md).

Id-urile (aventură, misiuni, locații etc.) trebuie să rămână stabile: progresul salvat este legat de ele.

### Stări și progres

- Starea jocului: `idle` → `playing` → `completed`. „Joacă din nou” / „Începe de la capăt” readuc jocul la `idle` și șterg progresul salvat.
- Misiuni: `locked` → `pending` → `solved` | `failed` | `skipped`, plus `attempts`, `hintsUsed`, `startedAt`, `closedAt`. Indiciile sunt date, nu stări (în spiritul D-030).
  - `solved` — singura stare care aduce puncte și care se numără la „rezolvate”.
  - `skipped` — „Sari peste (0 puncte)”: 0 puncte, nu este rezolvată, jocul continuă.
  - `failed` — închisă fără rezolvare, 0 puncte (`failChallenge()` / `failMission()` / acțiunea `fail_mission`); interfața nu o produce încă.
- Progresia principală este liniară, după `currentMissionId` (nu după un index): închiderea misiunii curente o deschide pe următoarea principală. Misiunile `bonus` și `secret` se deschid doar prin evenimente și nu schimbă misiunea curentă.
- Locații, parteneri, secrete și regulile de evenimente rulate au propriile stări în progres (forma completă: `11_ADVENTURE_SCHEMA_V2.md`, secțiunea 11).
- Scorul este derivat din conținut și progres (misiuni `solved` + secrete + `award_points`); valoarea salvată nu este de încredere. Nu există penalizări (D-025 rămâne deschisă).
- Starea salvată are `schemaVersion: 2`. Progresul salvat de versiunea anterioară (`schemaVersion: 1`, cu `currentIndex` și `challenges`) este **migrat automat** (D-043). O stare pentru altă aventură sau cu altă versiune este ignorată.
- Mesajul „Răspuns incorect” nu este salvat: după refresh, misiunea nerezolvată apare fără mesaj. Mesajul „Corect!” / „sărită” se reconstruiește din progres.

### Normalizarea răspunsurilor (CONFIRMED — D-024)

Înainte de comparare, ambele texte trec prin: descompunere Unicode (NFD) și eliminarea semnelor diacritice (acoperă `ă â î ș ț` și variantele cu sedilă `ş ţ`), litere mici, spațiile multiple reduse la unul, spațiile de la capete eliminate. Nu se elimină punctuația, nu se echivalează numerele scrise în litere și nu există fuzzy matching. Răspunsul gol nu este niciodată corect.

### Service worker

`SHELL_FILES` include toate modulele din `js/` (inclusiv `schema.js`, `defaults.js`, `events.js`, `geo.js`, `location.js`, `map-model.js`, `map.js`), Leaflet local (`vendor/leaflet/leaflet.js`, `vendor/leaflet/leaflet.css`) și aventura demo `../content/adventures/brasov-centrul-vechi.json` (aceeași strategie network-first; 19 intrări). `CACHE_VERSION` = `v6` (M-003.2: harta și Leaflet; anterior `v5`, M-003.1: `location.js`). Tile-urile hărții (alt domeniu) **nu** sunt interceptate și nu sunt puse în cache (politica OSM, D-046); cache-urile mai vechi cu prefixul `outdoor-escape:shell:` se șterg la activare. După o primă încărcare reușită, un refresh fără rețea încarcă aplicația și aventura demo din cache. Orice modul nou din `js/` trebuie adăugat în `SHELL_FILES` (cu versiune nouă a cache-ului), altfel aplicația nu pornește offline. Alte aventuri (sau alt conținut din `content/`) nu sunt puse în cache: fără rețea, ele duc la ecranul de eroare cu „Încearcă din nou”, iar progresul salvat rămâne intact.

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

Notă (2026-09-29): modelul **implementat** nu folosește această listă de stări. Jocul are doar `idle → playing → completed`; restul (a ajuns la locație, misiune activă, indiciu folosit, locație finalizată, final) este reprezentat ca stări ale entităților (misiuni, locații) și ca evenimente (`player_arrived`, `mission_started`, `hint_requested`, `location_completed`, `finale_started` …) — vezi secțiunea 3c și `11_ADVENTURE_SCHEMA_V2.md`. Lista de mai sus rămâne ca referință istorică.

Notă (2026-09-30, D-052): Platform V1.1 adaugă un lifecycle al **sesiunii** (`CREATED → TEAM_FORMING → READY → LOCKED → ACTIVE ⇄ PAUSED → COMPLETED`, plus `ABANDONED` / `EXPIRED` / `CANCELLED`) și unul al **echipei**, deasupra stărilor jocului. Stările jocului implementate (`idle → playing → completed`) rămân neschimbate; lifecycle-ul sesiunii este DECIS, neimplementat — `13_PLATFORM_V1.1.md` §3.

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
- Implementarea MVP poate compara text normalizat sau hash-uri. Normalizarea se aplică înainte de comparare/hash (regulile — D-024, CONFIRMED).
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

Notă (2026-09-29, D-039): contractul implementat este în `11_ADVENTURE_SCHEMA_V2.md`, secțiunea 5. Locația are `coordinates: { lat, lng }`, `radius` (metri) și `fallback`. `geo.js` întoarce `{ zone: inside | near | outside | uncertain, distanceMeters, accuracyMeters, radiusMeters, … }`; motorul primește observații prin `reportPosition(fix)` și produce tranziții (`player_near_location`, `player_arrived`, `player_left_area`). Confirmarea manuală: `confirmArrival(locationId)`. Motorul nu folosește Geolocation API.

Actualizare M-003.1: sursa observațiilor din browser este `src/js/location.js` (adaptor), conectat în `app.js` la `game.reportPosition(fix)`. Fluxul și limitele (doar pagina activă, fără fundal): `11_ADVENTURE_SCHEMA_V2.md`, secțiunea 5, și `07_TESTING.md`, secțiunea 24.

## 8. Offline strategy

At minimum:
- cache application shell;
- cache game content;
- cache critical images;
- preserve local progress.

Do not promise complete offline functionality until it has been tested.

Stare: în scheletul PWA doar fișierele fundației sunt în cache (secțiunea 3b). Conținutul jocului și media nu sunt încă în cache.

Actualizare (2026-09-30): starea curentă a cache-ului este în secțiunea 3c (shell, Leaflet local și aventura demo, network-first). Direcția decisă pentru V1.1 este **offline-first** cu un **Adventure Package** identificat prin `adventure_id` + `version`, descărcat și validat înainte de START; tile-urile OpenStreetMap sunt excluse din pachet (D-046, D-056). DECIS, neimplementat — `13_PLATFORM_V1.1.md` §8 și `15_SESSION_SYNC.md` §9.

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

## 13. Platform V1.1 (arhitectură decisă — 2026-09-30)

Documentul principal: [`13_PLATFORM_V1.1.md`](13_PLATFORM_V1.1.md) (D-050 – D-063). Rezumat pentru arhitectura tehnică:

| Aspect | Direcție V1.1 | Stare în cod |
| --- | --- | --- |
| Model de domeniu | Route ≠ Adventure ≠ Adventure Session; Adventure Pass; Team; Participant; roluri Buyer / Team Leader / Participant | doar Adventure (fișier JSON) + o sesiune locală implicită per aventură, per browser |
| Continuitate | închiderea aplicației nu este părăsire; rejoin persistent (link personal / cod de recuperare) către sesiunea existentă | continuitate locală (același browser) implementată |
| Stare comună | `shared_device` / `multi_device`; evenimente, coadă locală, optimistic UI, HTTP sync / short polling; WebSocket neobligatoriu — [`15_SESSION_SYNC.md`](15_SESSION_SYNC.md) | neimplementat; `multi_device` cere backend (FUTURE, D-019) |
| Offline | Adventure Package (`adventure_id` + `version`), fără tile-uri OSM | shell + demo în cache |
| Versiuni | sesiune fixată pe o versiune publicată, imuabilă (`contentVersion`) | `contentVersion` copiat în progres, necomparat |
| GPS | polling adaptiv, parametri configurabili, fără valori fixate în arhitectură | `watchPosition` cu opțiuni fixe (D-045) |
| Rută | Route Health (`ACTIVE / UNAVAILABLE / BYPASSED`), bypass auditat, flux `linear` / `graph` | doar `linear`; skip de jucător implementat |

Scenariile limită: [`14_EDGE_CASES.md`](14_EDGE_CASES.md). Extensiile de schemă (pregătite, nevalidate): [`11_ADVENTURE_SCHEMA_V2.md`](11_ADVENTURE_SCHEMA_V2.md) §14.

Regulile din secțiunile anterioare rămân valabile. În special: nu se introduce backend, autentificare, plăți sau WebSocket înainte ca un milestone să le ceară explicit (D-019).
