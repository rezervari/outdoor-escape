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
│       ├── game-message.js modelul GameMessage (M3, pur; fără Message Engine)
│       ├── message-engine.js GameEvent[] → GameMessage[] (M4, pur)
│       ├── inbox.js     starea Inbox / Conversation, separată de Game State (M5)
│       ├── inbox-ui.js  prezentarea panoului „Mesaje” (M6, pur)
│       ├── notification-policy.js politica notificării: added[] → toast / anunț / gong (M7, pur)
│       ├── gong.js      gong-ul notificării, generat cu Web Audio (M7)
│       ├── answers.js   normalizarea și verificarea răspunsurilor
│       ├── location.js  adaptorul Browser Geolocation (M-003.1)
│       ├── map-model.js modelul vizual al hărții (M-003.2, pur)
│       ├── map.js       harta Leaflet, strat exclusiv vizual (M-003.2)
│       ├── view-model.js modelul interfeței, derivat din starea motorului (TASK 4, pur)
│       ├── play-ui.js   panoul puzzle-ului, indiciile, straturile pentru Back (TASK 4, pur)
│       ├── media.js     registrul media unificat, blocurile media rezolvate (Challenge System V1, pur)
│       ├── media-ui.js  desenarea image / compare / audio și a viewer-ului generic (Challenge System V1)
│       └── storage.js   localStorage
├── content/                            conținutul aventurilor (publicat) — numai test / demo (D-034)
│   ├── adventures/brasov-centrul-vechi.json   aventura DEMO (schemaVersion 1, D-037)
│   ├── adventures/demo-vertical-slice.json    aventura DEMO fictivă pentru interfață (schemaVersion 2, TASK 4)
│   ├── adventures/demo-challenge-media.json   aventura DEMO fictivă pentru media (Challenge System V1)
│   ├── adventures/media/demo-challenge-media/ asset-urile de test ale demo-ului (SVG + un WAV generat)
│   └── games/.gitkeep                         gol (D-037)
└── tests/                              teste automate (nu se publică)
    ├── *.test.js
    └── fixtures/adventure-v2-demo.json        aventură V2 fictivă, doar pentru teste (D-042)
```

Regulă (CONFIRMED — D-034): `content/` din repository-ul public conține **numai** aventuri de test / demo. Conținutul real al jocurilor comerciale stă într-o sursă separată, neversionată în repository-ul public, și ajunge în producție doar la publicare. Tot ce se publică pe GitHub Pages rămâne lizibil de oricine (D-021).

Excepție (CONFIRMED — D-068): `content/adventures/demo-gps-brasov.json` (`demo: true`) este autorizat explicit ca demo public și conține intenționat coordonate reale din Brașov, pentru testarea GPS-ului și a hărții. Excepția acoperă doar acest demo; nu autorizează publicarea altor aventuri reale sau a conținutului sensibil (`Claude outputs/` rămâne nepublicat) și nu schimbă regula D-034 pentru aventurile reale nepublicate sau comerciale.

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
- Butonul Back (U2, precizare la D-035 — 2026-10-01): fiecare apăsare închide **un singur** strat de interfață deschis, cel de sus — întâi confirmarea indiciului, la apăsarea următoare overlay-ul puzzle-ului. Numai când nu mai este deschis niciun strat, Back revine la comportamentul normal al browserului. Mecanismul este History API al browserului, **fără** schimbarea URL-ului și fără rute noi; nu este routing. Detalii: secțiunea 3c.
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

**Implementat:** schema V2, migrarea V1 → V2 (conținut și progres), modelul de locație, motorul de evenimente, progresul V2, testele; din M-003.1: adaptorul Browser Geolocation (`location.js`), urmărirea poziției cu pagina activă, starea GPS și explicația permisiunii în interfață, obiectivul misiunii curente cu „Am ajuns”. **Pregătit, dar neimplementat:** misiunile partener, secrete și cu timp în UI, interfața naratorului, audio, GPS în fundal / geofencing, notificări în fundal / push (notificarea din aplicație — M7 — este implementată). **Harta (M-003.2):** implementată conform `12_MAP_SPECIFICATION_M-003.2.md` (D-046–D-049) — `map-model.js`, `map.js`, Leaflet 1.9.4 local; comisă (`39a6b28`), acceptată de proprietar la 30.09.2026 — milestone închis. **Vertical slice UI (TASK 4):** harta ca suprafață principală, cu cardul obiectivului peste ea (D-049-F revizuită); puzzle-ul ca overlay; indicii cu confirmare (D-030); ecranul de rezultat; Back pentru straturile de interfață (U2, D-035). Demonstrat pe aventura fictivă `demo-vertical-slice` (`src/?adventure=demo-vertical-slice`). Tabelul complet: `11_ADVENTURE_SCHEMA_V2.md`, secțiunea 0.

### Fișiere

| Fișier | Rol |
| --- | --- |
| `content/adventures/<id>.json` (D-037) | O aventură, `schemaVersion` 1 sau 2. Aventura implicită `brasov-centrul-vechi` este DEMO, V1 (fără locații, fără afirmații istorice). Excepție (D-068): `demo-gps-brasov` este DEMO, V2 (`demo: true`), cu coordonate reale din Brașov, intenționat publice pentru testarea GPS-ului și a hărții. `demo-vertical-slice` este DEMO, V2, fictiv (coordonate lângă 0°, 0°): 2 locații, 4 misiuni (sosire → puzzle → sosire → puzzle), pentru fluxul complet al interfeței (TASK 4). `demo-challenge-media` este DEMO, V2, fictiv (coordonate lângă 0°, 0°), cu asset-uri de test proprii în `content/adventures/media/demo-challenge-media/`: imagine + viewer, comparație slider / toggle, sunet cu transcript, sunet indisponibil (rezervă, prin formatul vechi `audio.tracks`), răspuns numeric, obiecte și jurnal (Challenge System V1). |
| `src/js/content.js` | Încarcă JSON-ul (`fetch`, URL relativ la modul: `../../content/adventures/<id>.json`), îl validează după `schemaVersion` (V1 minim, V2 prin `schema.js`), erori pe înțelesul jucătorului (`AdventureLoadError`). |
| `src/js/schema.js` | Schema V2: vocabular închis, validare cu verificarea referințelor, conversia V1 → V2 în memorie, forma normalizată (`toAdventureV2`). |
| `src/js/defaults.js` | Valorile implicite centrale (GPS, progresie, limita lanțurilor de evenimente) și configurația hărții (M-003.2): `MAP_LIBRARY_VERSION`, `DEFAULT_MAP_TILES` (provider OSM, atribuire), `DEFAULT_MAP_VIEW` (valori strict vizuale). |
| `src/js/events.js` | Modelul de evenimente: liste închise, filtru simplu, `once`, limită de lanț; forma canonică GameEvent (`createGameEvent`: `type`, `payload`, `seq`, `at`, `cause?` — `11_ADVENTURE_SCHEMA_V2.md` §9). |
| `src/js/geo.js` | Modelul de locație: distanță haversine, zone `inside/near/outside/uncertain`, histerezis. Fără Geolocation API. `effectiveRadius(location, gps)` (M-003.2, D-049-D / R2): singura sursă a razei efective, folosită de `evaluateProximity`. |
| `src/js/answers.js` | Singurul modul care citește câmpul `answer` și compară răspunsuri (D-021): `normalizeAnswer`, `answersMatch`, `createLocalValidator` (interfață asincronă `check(missionId, input) → Promise<boolean>`), `withoutAnswers` (V1 și V2). |
| `src/js/game.js` | Motorul: stări, progres V2 pe entități, reguli de evenimente, tranziții de locație, scor derivat, migrarea progresului V1. Fără DOM și fără stocare. Primește aventura **fără răspunsuri** și validatorul. Notifică schimbările prin `subscribe()`: `listener(state, events)` — instantaneul stării și GameEvent-urile tranzacției curente (batch doar runtime, nesalvat, fără reluare la reîncărcare; un listener `(state)` funcționează ca înainte); mesajele/sunetele sunt „efecte” (`takeEffects()`). |
| `src/js/game-message.js` | Modul pur (M3, D-082, D-085, D-087, D-088, D-094): `createGameMessage({ source, text, category, importance?, sender?, at? })` → `{ id, text, category, importance, sender, at }`, înghețat. Un **GameEvent** este faptul produs de motor (runtime); un **GameMessage** este comunicarea prezentabilă jucătorului. `id` = cheia sursei semantice (părțile din `source` unite cu „:”, ex. `rule:ev-start:0`): deterministă, independentă de `GameEvent.seq` și de timp, deci aceeași după reîncărcare. `category` obligatorie (`position` / `gameplay` / `hint` / `story` / `alert`), `importance` implicit `normal`, `sender` `null` sau `{ name }` (dată de conținut). Fără ordine în conversație, acțiuni, audio, citit / necitit, notificare sau persistență. Nu este încă folosit de aplicație: traducerea GameEvent → GameMessage aparține Message Engine (M4). |
| `src/js/message-engine.js` | Message Engine (M4, modul pur; D-082, D-085, D-087, D-092, D-097): `processGameEvents(events, { content, state })` — `GameEvent[]` (batch-ul primit prin `subscribe`) → `GameMessage[]`. Matricea `EVENT_MESSAGE_ROUTES` dă, pentru fiecare dintre cele 18 evenimente, categoria și importanța mesajelor. Textele vin numai din conținut: regulile `show_message` care au rulat (`source` `["rule", rule.id, actionIndex]`, aceeași cheie ca jurnalul `buildStory`, expeditor `narrator.name`) și textul indiciului la `hint_requested` (`["hint", missionId, hintIndex]`); evenimentele fără conținut nu produc mesaj (fără texte generice). Identitatea nu depinde de `seq` sau de timp: re-emiterea GPS și regulile repetabile dau același id. Ordinea = ordinea evenimentelor; un id apare o dată per apel. Nu modifică starea, nu persistă, nu păstrează nimic între apeluri (deduplicarea, citit / necitit și notificarea aparțin stratului Inbox — M5), nu atinge interfața și nu redă audio. Apelat de `app.js` (M6) cu batch-ul fiecărei tranzacții nevide. |
| `src/js/inbox.js` | Starea Inbox / Conversation (M5; D-085, D-086, D-090, D-092, D-100): `createInbox({ adventureId, backend? })` → `getState()`, `getMessages()`, `unreadCount()`, `addMessages(GameMessage[])` → `{ added, unreadCount }`, `markMessageRead(id)` → `true` / `false`, `clear()`. **Sursa de adevăr pentru istoricul comunicării livrate (D-100); `added` este singura sursă a politicii de notificare (D-102, D-104).** **Inbox State ≠ Game State:** cheie proprie `outdoor-escape:inbox:<id>` (aceeași identitate ca progresul, `outdoor-escape:game:<id>`; sesiunile D-064 nu sunt implementate), format `{ version: 1, messages: [{ id, text, category, importance, sender, at, read }] }`. Deduplicare după `GameMessage.id` (un id cunoscut nu se adaugă și nu se modifică — reîncărcare, re-abonare, re-emitere GPS); mesajele noi intră necitite și devin citite doar prin `markMessageRead(id)`, apelat de interfață când mesajul este efectiv vizibil (D-090; fără „marchează tot”); `unreadCount` este derivat, nesalvat; ordinea = ordinea intrării (fără sortare după `at`, fără ceas). Fără câmpuri de notificare / audio. Nu cunoaște motorul, evenimentele sau Message Engine, nu produce GameEvent / GameMessage, nu este sursă de adevăr pentru gameplay; nu se reconstruiește din evenimente (istoricul se păstrează în propria stocare). Reset / „Joacă din nou” (ambele trec prin `game.reset()` → `idle`, când `app.js` șterge progresul): `clear()` golește istoricul aventurii — apelul aparține integrării cu interfața (M6). Stocare lipsă sau blocată → funcționează în memorie, ca `storage.js`. Un singur Inbox per pornire, creat de `app.js` (M6). |
| `src/js/inbox-ui.js` | Modul pur (M6; D-086, D-090), ca `play-ui.js`: `describeInbox(messages, { open, shownAsNew })` → `{ open, unreadCount, empty, items: [{ id, senderName, text, category, importance, isNew }], toMarkRead }`. Expeditorul este doar `message.sender.name` (fără personaje în cod); ordinea = ordinea Inbox-ului. **Citit (D-090):** `toMarkRead` conține mesajele necitite numai cu panoul deschis, iar `app.js` le marchează abia după ce lista este desenată; prima variantă, fără urmărirea zonei vizibile: un mesaj desenat în panoul deschis (cu derulare) este considerat prezentat. `shownAsNew` (efemer) păstrează eticheta „Nou” cât timp panoul rămâne deschis. Fără DOM, fără stare, fără apeluri în Inbox sau motor; textele sunt în `app.js`. |
| `src/js/notification-policy.js` | Notification Policy (M7; D-104 – D-107), modul pur, ca `inbox-ui.js`: `evaluateNotification({ added, cause, status, context, presentation })` → `{ outcome, messages, presentation, gong, announcement }`, cu `outcome` ∈ `none` / `announce` / `present` / `absorb`. Intrarea: `added` (singura sursă a mesajelor noi; deduplicarea rămâne a Inbox-ului), `cause` (context runtime al tranzacției — singura excepție: `request_hint` + mesaje `hint` nu se notifică), `status` (finalul suprimă tot), contextul interfeței după desenare (`inboxOpen`, `viewerOpen`, `puzzleOpen`, `missionAudioPlaying`, `pageHidden`) și prezentarea activă (`{ messages, importance }` sau `null`). Un lot (o tranzacție) → cel mult o prezentare; un lot nou cât prezentarea este activă este absorbit (numărul crește, importanța devine maximul), fără al doilea gong. Anunț `polite` (normal / important) sau `assertive` (urgent). `describeNotification` / `describeAnnouncement` spun ce arată toast-ul și ce se anunță. Fără DOM, timere, audio, focus, stocare sau ceas; durata toast-ului nu se decide aici. |
| `src/js/gong.js` | Gong-ul notificării (M7, D-106): sunet scurt generat cu Web Audio API (oscilatoare; fără fișier audio, fără `<audio>` — `media-ui.js` oprește orice alt `<audio>`, iar gong-ul nu atinge player-ul misiunilor). `createGong()` → `unlock()` (la un gest explicit al jucătorului; creează / reia `AudioContext`, doar în memorie), `play()` (o singură încercare, `Promise<boolean>`; dacă sunetul nu este permis acum, gong-ul se abandonează — singura așteptare este reluarea contextului începută chiar atunci, de cel mult 300 ms), `isUnlocked()`, `stop()` (reset). Nu aruncă excepții; nu cunoaște motorul, mesajele, Inbox-ul sau stocarea. |
| `src/js/storage.js` | Salvare/restaurare/ștergere în `localStorage`, cheia `outdoor-escape:game:<id>` (prefix D-035; cheie confirmată — D-029). Nu aruncă excepții dacă stocarea lipsește. |
| `src/js/location.js` | Adaptorul Browser Geolocation API (M-003.1): verifică disponibilitatea (inclusiv contextul securizat), `watchPosition`/`clearWatch` fără porniri multiple, erori (refuz → oprire; indisponibil/timeout → urmărirea continuă), retry, transformă `GeolocationPosition` în `{ lat, lng, accuracy, timestamp }` și îl transmite mai departe. Nu calculează distanțe, praguri sau tranziții. API-ul se injectează (testabil în Node). |
| `src/js/app.js` | Leagă modulele, afișează ecranele, salvează automat la fiecare schimbare de stare, înregistrează service worker-ul. Trimite fix-urile de la `location.js` în `game.reportPosition` (doar în joc) și afișează starea GPS și obiectivul; nu calculează nimic geo. Pentru hartă (M-003.2): adună datele existente (`game.getLocation`, obiectivul curent, `describeLocation`, fix-ul trackerului), le trece prin `map-model.js` și apelează `map.js`; creează / distruge harta și prinde orice eroare a ei (jocul continuă ca în M-003.1). TASK 4: la fiecare schimbare, reconstruiește modelul interfeței (`view-model.js` + `play-ui.js`) din starea motorului și desenează din el (ecranul, cardul obiectivului, overlay-ul puzzle-ului, indiciile, rezultatul); apelează motorul doar prin API-ul existent (`confirmArrival`, `next`, `submitAnswer`, `requestHint`, `reset`). Păstrează doar stare de interfață efemeră (overlay închis de jucător, confirmarea indiciului), nesalvată. Sincronizează istoricul browserului pentru Back (U2, mai jos). **Comunicarea (M6):** `GameEvent` → Message Engine → `GameMessage` → Inbox → UI. La pornire creează un singur Inbox (`createInbox`, propria stocare); în abonare, după salvarea progresului, trimite doar batch-ul nevid al tranzacției prin `processGameEvents` în `inbox.addMessages` (deduplicarea aparține Inbox-ului; o eroare a comunicării este prinsă și nu oprește jocul). Butonul „Mesaje” (bara de sus, în joc și pe ecranul final) arată `inbox.unreadCount()`; panoul „Mesaje” (dialog în afara `<main>`, ca viewer-ul; strat Back `Layer.INBOX`, închis și cu Escape / „Închide”) desenează lista prin `inbox-ui.js` și abia apoi marchează mesajele desenate ca citite (D-090). Deschiderea panoului nu atinge motorul. `resetEverything()` (singura cale de reset) golește și Inbox-ul; la pornirea fără parcurgere activă (`idle`), istoricul rămas se golește o dată. **Notificarea (M7, D-104 – D-107):** `receiveMessages` întoarce `added`; după `render()`, `notify(added, events[0]?.cause, state.status)` trece lotul prin `notification-policy.js`, cu contextul interfeței de după desenare, și aplică decizia: toast-ul `#notification` (în afara `<main>`, sus, peste joc și peste overlay-ul puzzle-ului, sub panoul „Mesaje” și sub viewer; nu este dialog, nu ia focusul, nu este strat Back; „Deschide” → panoul „Mesaje”, „✕”; normal / important se închid singure după ~6 s, cu pauză la indicator / focus, urgent rămâne), anunțul în regiunea live `#notification-live` (singura pentru mesaje noi) și gong-ul (`gong.js`, deblocat la primul gest explicit, în faza de captură). Prezentarea activă este stare efemeră (nesalvată): deschiderea panoului „Mesaje”, finalul și `resetEverything()` o închid; resetul golește și anunțul și oprește un gong în curs. O eroare a notificării este prinsă și nu oprește jocul. Fără acțiuni pe mesaje sau câmp de răspuns; `#story-panel` rămâne vizual, fără `aria-live` (D-107; retragere treptată, milestone separat — D-101). Granițele comunicării: secțiunea 5. |
| `src/js/view-model.js` | Modul pur (TASK 4): `buildViewModel({ content, state })` — proiecția stării motorului pentru interfață: vizualizarea (`intro` / `travel` / `arrived` / `puzzle` / `solved` / `completed`), misiunea și obiectivul curent, puzzle-ul (întrebare, indicii deschise / disponibile din `hintsUsed`), acțiunile posibile, opririle traseului, sumarul. Nu păstrează stare, nu apelează motorul, nu expune răspunsuri. |
| `src/js/media.js` | Modul pur (Challenge System V1, D-072): vocabularul închis al media (tipuri de asset și de bloc, tipuri rezervate), normalizarea registrului `media.assets` + `audio.tracks` (format vechi) într-un singur registru, rezolvarea blocurilor unei misiuni pentru interfață (URL-uri, text alternativ, transcript, rezervă) și lista fișierelor media ale aventurii. Nu știe ce reprezintă imaginile și nici modul de joc. |
| `src/js/media-ui.js` | Desenarea generică (DOM) a blocurilor `image`, `compare` (slider / toggle), `audio` (player propriu, transcript, rezervă + „Reîncearcă”) și a conținutului viewer-ului (D-073). Doar `textContent` / atribute; nu atinge motorul, stocarea sau GPS-ul. |
| `src/js/play-ui.js` | Modul pur (TASK 4): din modelul interfeței + starea efemeră de interfață descrie panoul puzzle-ului (overlay pentru misiunile cu obiectiv pe hartă, în pagină pentru V1), indiciile și confirmarea (D-030), acțiunea cardului și straturile deschise pentru Back (U2): puzzle, confirmarea indiciului, panoul „Mesaje” (M6, `inboxOpen`, doar în afara ecranului de start), viewer-ul (deasupra tuturor — D-073). Fără DOM, fără stocare, fără apeluri în motor. |
| `src/js/map-model.js` | Modul pur (M-003.2, D-048): traduce prin tabele fixe starea existentă în modelul vizual `{ player: { fix, quality }, locations: [{ id, name, lat, lng, radius, state, visible }], currentObjectiveId }`. Calitatea: `gps-ready` → `valid`, `gps-uncertain` → `uncertain`, restul → `none` (D-049-C). Raza este `radiusMeters` de la motor. Fără importuri, fără calcule GPS. |
| `src/js/map.js` | Strat exclusiv vizual (M-003.2, D-047): singurul modul care folosește Leaflet. API: `createMap({ container, tileConfig, view?, leaflet? })` → `updatePlayer`, `updateLocations`, `setCurrentObjective`, `fitToAdventure`, `centerOnPlayer`, `destroy`; erori `MapError` (`leaflet_unavailable`, `invalid_container`, `invalid_tile_config`). Nu accesează geolocația, nu apelează motorul, nu calculează distanțe/progres. |
| `src/vendor/leaflet/` | Leaflet **1.9.4** (D-046, D-049-A), copiat neschimbat din arhiva oficială `https://github.com/Leaflet/Leaflet/releases/download/v1.9.4/leaflet.zip` (`dist/`). SHA-256: `leaflet.js` `85d455b4522415f6badc42a0e7d17c919d100347d6b8958bd0dc738fdecd6d50`, `leaflet.css` `a7837102824184820dfa198d1ebcd109ff6d0ff9a2672a074b9a1b4d147d04c6`. Fără imaginile implicite (markerii folosesc `divIcon`) și fără `leaflet.js.map`. `.gitattributes` marchează `src/vendor/**` ca `-text -diff`, ca fișierele să rămână identice byte cu byte pe orice sistem. Verificat de `tests/map.test.js`. |

Fluxul la pornire: `app.js` → `loadAdventure(id)` → `toAdventureV2(...)` → `createLocalValidator(aventură)` + `withoutAnswers(aventură)` → `createGame({ adventure, validator, savedState })` → interfața. Aventura implicită este `brasov-centrul-vechi`; pentru teste se poate cere alta cu `src/?adventure=<id>` (id-ul este validat: litere mici, cifre, cratimă).

Fluxul interfeței (TASK 4): `game.getState()` → `view-model.js` → `play-ui.js` (+ starea efemeră de interfață) → desenare. Motorul rămâne singura sursă de adevăr: nicio acțiune de interfață nu modifică starea jocului altfel decât prin API-ul motorului, iar după reîncărcare interfața se reconstruiește integral din progresul salvat (un puzzle activ își redeschide overlay-ul; confirmarea indiciului nu revine).

Butonul Back (U2 — precizarea la D-035, extinsă de D-073): fiecare strat de interfață deschis (overlay-ul puzzle-ului, confirmarea indiciului, viewer-ul media — deasupra celorlalte) are o intrare în istoricul browserului, adăugată cu `history.pushState(state, "")` — fără URL, deci adresa nu se schimbă. Adâncimea straturilor stă în `history.state.oeLayers` (stare de navigare, nu de joc; nu se salvează). După fiecare desenare, istoricul se aliniază la straturile deschise (un strat închis din interfață își retrage intrarea, deci Back nu trebuie apăsat în plus); la `popstate`, se închide stratul de interfață de sus corespunzător unei singure reveniri, cu aceeași funcție ca butonul lui de închidere, fără apeluri în motor. Fără straturi deschise nu există intrări ale aplicației, iar Back este navigarea normală a browserului. Deciziile (ce strat se închide, câte intrări se adaugă / retrag) sunt funcții pure în `play-ui.js`, testate în `tests/back-u2.test.js`. Notificarea (toast-ul M7) nu este strat: nu adaugă intrări de istoric și nu este închisă de Back sau Escape (D-105).

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
- Misiuni: `locked` → `pending` → `solved` | `failed` | `skipped`, plus `attempts`, `hintsUsed`, `startedAt`, `closedAt`. Indiciile sunt date, nu stări (D-030, CONFIRMED).
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

`SHELL_FILES` include modulele din `js/` (inclusiv `schema.js`, `defaults.js`, `events.js`, `geo.js`, `location.js`, `map-model.js`, `map.js`, `view-model.js`, `play-ui.js`, `media.js`, `media-ui.js`, `game-message.js`, `message-engine.js`, `inbox.js`, `inbox-ui.js`, `notification-policy.js`, `gong.js`), Leaflet local (`vendor/leaflet/leaflet.js`, `vendor/leaflet/leaflet.css`) și aventura demo `../content/adventures/brasov-centrul-vechi.json` (aceeași strategie network-first; 29 de intrări: 28 din `src/` + 1 din `content/`). `CACHE_VERSION` = `v13` (M7-C, indicatorul GPS / HUD: doar fișiere existente modificate, niciun modul nou; anterior `v12`, M7: `notification-policy.js`, `gong.js`; `v11`, M6: `message-engine.js`, `inbox.js`, `inbox-ui.js` încărcate de `app.js`; `v10`, Game Communication Layer M1–M3: GameEvent în `events.js` / `game.js`, `game-message.js`; `v9`, Challenge System V1: `media.js`, `media-ui.js`; `v8`: obiecte, variante, jurnal; `v7`, TASK 4: `view-model.js`, `play-ui.js`; `v6`, M-003.2: harta și Leaflet; `v5`, M-003.1: `location.js`). Fișierele media ale aventurilor **nu** sunt în cache (pre-descărcarea lor aparține pachetului aventurii — D-056). Aventura `demo-vertical-slice` nu este în cache (ca orice altă aventură în afara celei implicite). Tile-urile hărții (alt domeniu) **nu** sunt interceptate și nu sunt puse în cache (politica OSM, D-046); cache-urile mai vechi cu prefixul `outdoor-escape:shell:` se șterg la activare. După o primă încărcare reușită, un refresh fără rețea încarcă aplicația și aventura demo din cache. Orice modul nou din `js/` trebuie adăugat în `SHELL_FILES` (cu versiune nouă a cache-ului), altfel aplicația nu pornește offline. Alte aventuri (sau alt conținut din `content/`) nu sunt puse în cache: fără rețea, ele duc la ecranul de eroare cu „Încearcă din nou”, iar progresul salvat rămâne intact.

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

Notă (CONFIRMED — D-030, 2026-09-30): `HINT_USED` nu este o stare. Folosirea unui indiciu nu schimbă ce poate face jucătorul (misiunea rămâne `pending`); numărul de indicii folosite se păstrează ca dată a misiunii (`hintsUsed`), iar fiecare dezvăluire emite evenimentul `hint_requested`. Penalizarea pentru indicii nu face parte din D-030 și rămâne deschisă în D-025. Lista de mai sus rămâne neschimbată, ca referință istorică.

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

### Comunicarea cu jucătorul: granițele (D-084, D-100 – D-107)

Lanțul implementat (M1 – M7): `Game Engine → GameEvent[] (subscribe) → Message Engine → GameMessage[] → Inbox.addMessages() → added[] → (după desenare) Notification Policy → toast + anunț + gong`; istoricul se citește în panoul „Mesaje”. Conținutul decide **ce** se spune (`show_message`, `narrator.messages`, indiciile); motorul, Message Engine, Inbox-ul și interfața decid **când** și **cum** se livrează.

| Strat | Ce este | Sursa de adevăr / datele | Persistă? | Decizii |
| --- | --- | --- | --- | --- |
| Game State | progresul și starea jocului | `game.js` | da — `outdoor-escape:game:<id>` | D-043, D-084 |
| Inbox | istoricul comunicării **livrate**: GameMessage-urile (text, metadate) și starea citit / necitit | `inbox.js`, alimentat de Message Engine | da — `outdoor-escape:inbox:<id>`, separat; se golește odată cu progresul | D-090, D-092, D-100 |
| Gameplay UI | informație contextuală pentru acțiunea curentă: obiectivul, puzzle-ul, indiciile deschise, feedback-ul imediat („Corect!”), starea GPS, erorile tehnice | derivată din Game State (`view-model.js`, `play-ui.js`) + stare efemeră în `app.js` | nu — se reconstruiește din stare | D-082 (precizarea M0.5B), D-086, D-096 |
| Story Journal (`#story-panel`) | jurnalul naratorului, derivat din `firedEvents` + conținut; păstrat temporar, **doar vizual** (fără `aria-live`) | `buildStory()` în `view-model.js` | derivat | D-086, D-101 (retragere treptată, milestone separat), D-107 |
| Notification | reacția **efemeră** a interfeței la mesajele **nou adăugate** în Inbox (`inbox.addMessages(...).added`): toast + anunț pentru cititoarele de ecran (singurul anunț al mesajelor noi) | `notification-policy.js` (decizia, pur) + `app.js` (toast, `#notification-live`) | nu | D-089, D-102, D-104, D-105, D-107 |
| Audio / gong | efect efemer al notificării, în stratul UI / Notification: cel mult un gong per prezentare, niciodată fără toast | `gong.js` (Web Audio) | nu | D-091, D-098, D-102, D-106 |
| Finale / Epilogue | experiența de încheiere (`finale.messageId`, ecranul final) | conținut, afișat pe ecranul final | derivat | D-103 |

Reguli care decurg din decizii:
- Inbox-ul nu controlează gameplay-ul, nu produce GameEvent și nu se reconstruiește din `firedEvents` sau din evenimente (D-100). Game State nu conține mesaje sau citit / necitit.
- `unread` ≠ notificare; un mesaj existent ≠ notificare în așteptare. Numărul de necitite este indicatorul persistent al Inbox-ului, nu o notificare (D-102).
- Doar mesajele **nou adăugate** pot produce o notificare. Re-randarea, re-abonarea, re-emiterea GPS (același id, deduplicat de Inbox) și reîncărcarea nu produc notificări (D-092, D-097, D-102).
- Reîncărcare: Game State și Inbox se restaurează; Gameplay UI se reconstruiește; notificarea și gong-ul nu se reiau.
- Reset / „Joacă din nou” (`resetEverything()`): Game State, Inbox, Gameplay UI și orice stare efemeră de notificare / audio se golesc împreună.
- Nu orice text afișat devine GameMessage: feedback-ul imediat, erorile tehnice și starea GPS rămân Gameplay UI (D-082, D-085).
- Jurnalul și Inbox-ul pot conține aceleași mesaje de narator (aceeași identitate) cât timp coexistă; jurnalul nu se modifică până la milestone-ul de retragere (D-101).
- Epilogul (`finale.messageId`) nu este implicit GameMessage; o regulă `show_message` cu același text produce separat un GameMessage normal — roluri diferite, nu duplicare (D-103).

Notification și gong-ul (M7) sunt implementate **în aceste granițe** (D-104 – D-107):
- Intrarea politicii: `added` (singura sursă), `cause` al tranzacției (context runtime; doar excepția `request_hint` + `hint`), `status`, contextul interfeței după desenare și prezentarea activă. Notificarea nu se deduce din `firedEvents`, Game State, jurnal, `unreadCount`, re-randare, reîncărcare sau starea GPS.
- O tranzacție → cel mult o prezentare; un lot nou cât prezentarea este activă se absoarbe, fără al doilea gong. GPS-ul nu are reguli proprii: identitatea mesajului + deduplicarea Inbox-ului împiedică repetarea.
- Contextul: joc normal și puzzle overlay → toast + gong + anunț; audio de misiune în redare → toast + anunț, fără gong; Inbox deschis → doar anunț; media viewer deschis, pagină ascunsă, final → nimic (fără amânare, fără coadă).
- `normal` / `important` → toast temporar, anunț `polite`; `urgent` → toast până la închidere, anunț `assertive`; niciodată modal, focus sau strat Back.
- Eșecul audio nu este eșecul notificării și nici al jocului: gong-ul se abandonează, toast-ul și anunțul rămân.

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
