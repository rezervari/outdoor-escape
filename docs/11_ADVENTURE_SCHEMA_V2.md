# OUTDOOR ESCAPE — SCHEMA AVENTURII V2 ȘI CONTRACTELE MOTORULUI

Stare: implementat (fundația V2). Decizii: D-038 – D-043 în [`04_DECISIONS_LOG.md`](04_DECISIONS_LOG.md). Extensiile Platform V1.1 (pregătite, nevalidate, fără efect în motor): secțiunea 14.
Exemplu complet, fictiv și validat de teste: [`../tests/fixtures/adventure-v2-demo.json`](../tests/fixtures/adventure-v2-demo.json) (nu se publică pe GitHub Pages).

Principiul: **motorul este stabil, conținutul este extensibil.** Motorul nu știe nimic despre un oraș sau o aventură anume; tot ce ține de Brașov (sau de orice altă aventură) vine din JSON. Un test automat verifică faptul că modulele motorului nu menționează nicio aventură.

---

## 0. Stare: implementat vs. pregătit (M-002)

**IMPLEMENTAT** (cod + teste automate; `npm test`):

| Componentă | Unde | Teste |
| --- | --- | --- |
| Schema V2 + validare (inclusiv referințele dintre entități) | `src/js/schema.js`, `src/js/content.js` | `tests/schema.test.js` |
| Migrarea V1 → V2 (conținut, în memorie) și a progresului salvat V1 → V2 | `src/js/schema.js`, `src/js/game.js` | `tests/schema.test.js`, `tests/progress-v2.test.js`, `tests/game.test.js` |
| Modelul de locație (distanță, rază, precizie, near / arrival / leave, exit margin) | `src/js/geo.js`, `src/js/defaults.js` | `tests/geo.test.js` |
| Motorul de evenimente (filtre, acțiuni, `once`, limita lanțurilor) | `src/js/events.js`, `src/js/game.js` | `tests/events.test.js`, `tests/progress-v2.test.js` |
| Progresul V2 (stări pe entități, scor derivat, restaurare) | `src/js/game.js` | `tests/progress-v2.test.js` |
| Teste | `tests/` + fixture fictiv `tests/fixtures/adventure-v2-demo.json` | 63 de teste (M-002); 83 după M-003.1; 128 după M-003.2 |

**IMPLEMENTAT în M-003.1** (GPS real din browser, doar cu pagina activă):

| Componentă | Unde | Teste |
| --- | --- | --- |
| Adaptorul Browser Geolocation (`watchPosition` / `clearWatch`, fără porniri multiple, erori, retry, context securizat) | `src/js/location.js`, opțiunile în `src/js/defaults.js` (`DEFAULT_GEOLOCATION_OPTIONS`) | `tests/location.test.js` (mock `navigator.geolocation`) |
| Integrarea browser → `location.js` → `game.reportPosition` → `geo.js` → evenimente → UI | `src/js/app.js` | `tests/location-integration.test.js` + verificare Chromium cu geolocație emulată (`07_TESTING.md`, 24.2) |
| Starea GPS în interfață (neactivată / caut / activ + precizie / semnal slab / eroare / refuzat / indisponibil) | `src/index.html`, `src/js/app.js`, `src/css/app.css`; calitatea fix-ului: `geo.assessFix` | `tests/location.test.js`, `tests/geo.test.js` |
| Explicația înainte de permisiune + butonul „Activează locația” | `src/index.html`, `src/js/app.js` | manual / Chromium |
| Misiuni de locație în UI: cardul obiectivului, rezolvare la sosire, „Am ajuns” (`confirmArrival` — același mecanism ca GPS-ul) | `src/js/app.js` | `tests/location-integration.test.js` + Chromium |
| Vertical slice UI (TASK 4): modelul interfeței derivat din motor; harta ca suprafață principală cu cardul obiectivului peste ea (D-049-F revizuită); puzzle-ul ca overlay; indicii cu confirmare (D-030); ecranul de rezultat și restartul; Back pentru straturile de interfață (U2, D-035) | `src/js/view-model.js`, `src/js/play-ui.js`, `src/js/app.js`, `src/index.html`, `src/css/app.css`; demo `content/adventures/demo-vertical-slice.json` | `tests/view-model.test.js`, `app-view-model-integration.test.js`, `play-layout.test.js`, `play-ui.test.js`, `result-screen.test.js`, `back-u2.test.js` + verificare în browser (`07_TESTING.md`, secțiunea 27) |

Interfața folosește acum: misiuni-ghicitoare pe traseul principal, indicii (deschise numai după confirmare — D-030), sărire, scor, ecranul de rezultat și — pentru aventurile V2 care au locații — harta ca suprafață principală, cardul obiectivului cu GPS și „Am ajuns”, apoi puzzle-ul într-un overlay peste hartă. Aventura publică `brasov-centrul-vechi` este V1, fără locații: puzzle-ul și indiciile rămân în pagină, iar starea GPS este doar informativă. Fluxul complet se poate încerca pe `src/?adventure=demo-vertical-slice` (fictiv).

**PREGĂTIT, DAR NEIMPLEMENTAT ÎN UI** (există în schemă și/sau în motor, testat doar automat; jucătorul nu îl vede încă):

| Mecanică | Ce există deja | Ce lipsește |
| --- | --- | --- |
| Misiuni de locație (`location`) | schemă; motor; **interfață minimă din M-003.1** (obiectiv, stare GPS, „Am ajuns”) | afișarea distanței; conținut real cu locații |
| Misiuni partener (`partner`) | schemă generică (`partners`, `verification`, `reward`, `validity`); `unlock_partner` | interfață; aplicarea `validity`/`reward`; parteneri și coduri reale |
| Misiuni secrete (`secret`, traseul `secret`) | schemă; descoperire prin trecere pe lângă o locație ascunsă; deblocare prin evenimente | interfață pentru misiunile din afara traseului principal |
| Misiuni cu timp (`timed`) | schemă (`timeLimitSeconds`); `startedAt` salvat | aplicarea limitei de timp (D-025, D-028); interfață |
| Game Master / narator (UI) | `narrator.messages`; efecte `message` produse de motor (`takeEffects()`); **jurnalul în interfață** (2026-10-01): mesajele `show_message` ale regulilor rulate, derivate din `firedEvents` (`viewModel.story`), și epilogul `finale.messageId` pe ecranul de rezultat | redarea audio a mesajelor |
| Audio | schemă (`audio.tracks`, text alternativ obligatoriu); efecte `audio` | player, activarea sunetului, cache offline pentru fișiere |
| GPS în fundal / ecran blocat, geofencing | — (M-003.1 acoperă doar pagina activă) | nu este garantat de browser/PWA; D-028 rămâne deschisă |
| Notificări | — | tot |
| Hartă | **implementată în M-003.2 (comisă — `39a6b28`; acceptată de proprietar la 30.09.2026, milestone închis)** — `map-model.js` + `map.js` + Leaflet 1.9.4 local, OSM configurabil; doar afișare (`12_MAP_SPECIFICATION_M-003.2.md`) | test pe telefon cu o aventură reală cu locații (D-049-M) |

## 1. Module

| Modul | Rol | Depinde de |
| --- | --- | --- |
| `src/js/defaults.js` | Singurul loc cu valorile implicite (GPS, progresie, limita lanțurilor de evenimente) | — |
| `src/js/events.js` | Vocabularul închis de evenimente și acțiuni; potrivirea regulilor; procesarea în lanț | — |
| `src/js/geo.js` | Distanțe, zone de proximitate, histerezis. **Nu folosește Geolocation API** | `defaults.js` |
| `src/js/schema.js` | Validarea V2 (inclusiv referințele), conversia V1 → V2, forma normalizată | `defaults.js`, `geo.js`, `events.js` |
| `src/js/content.js` | Încărcarea JSON-ului, validarea după `schemaVersion` | `schema.js` |
| `src/js/answers.js` | Normalizarea și verificarea răspunsurilor (D-021, D-024) | — |
| `src/js/game.js` | Motorul: stări, progres V2, reguli de evenimente, tranziții de locație, migrare | `schema.js`, `events.js`, `geo.js` |
| `src/js/storage.js` | `localStorage`, cheia `outdoor-escape:game:<id>` | — |
| `src/js/location.js` | Adaptorul Browser Geolocation API (M-003.1): pornire/oprire, erori, normalizarea fix-ului. Nu interpretează poziția | `defaults.js` |
| `src/js/map-model.js` | Modelul vizual al hărții (M-003.2, D-048): traducere 1:1 a stărilor existente, fără calcule GPS | — |
| `src/js/map.js` | Harta Leaflet (M-003.2, D-047): strat exclusiv vizual; Leaflet se injectează (testat în Node cu un Leaflet fals) | `defaults.js` |
| `src/js/app.js` | Interfața (orchestrare, ecrane; construiește modelul hărții) | toate |

Toate modulele, cu excepția `app.js`, `location.js` și `map.js`, sunt pure (fără DOM, fără API-uri de browser) și sunt testate cu `node --test`. `location.js` este singurul modul care atinge `navigator.geolocation`; API-ul i se injectează, deci este testat în Node cu un mock. `map.js` este singurul modul care folosește Leaflet (injectat, deci testat în Node cu un Leaflet fals).

## 2. Versiuni și compatibilitate (D-038)

- `schemaVersion: 1` (sau absent) — formatul inițial cu `challenges`. Este acceptat în continuare și **convertit în memorie** la V2 (`upgradeV1ToV2`). Fișierul nu se modifică. Aventura demo `content/adventures/brasov-centrul-vechi.json` rămâne V1.
- `schemaVersion: 2` — formatul descris aici.
- `loadAdventure()` întoarce aventura exact cum este în fișier, după validare; `toAdventureV2()` produce forma normalizată folosită de motor (V1 convertită, valori implicite aplicate). Operația este idempotentă.

Conversia V1 → V2:

| V1 | V2 |
| --- | --- |
| `title`, `city`, `description`, `estimatedTime`, `difficulty` | `meta.*` |
| `challenges[]` | `missions[]` cu `type: "riddle"`, `track: "main"` |
| `challenge.description` | `mission.briefing` |
| `challenge.hint` | `mission.hints: [{ "text": … }]` |
| prima provocare / restul | `initialStatus: "pending"` / `"locked"`, `settings.progression: "linear"` |

## 3. Structura de nivel superior

| Câmp | Obligatoriu | Descriere |
| --- | --- | --- |
| `schemaVersion` | da | `2` |
| `id` | da | id stabil (litere mici, cifre, cratimă). Același format pentru toate id-urile din aventură |
| `contentVersion` | nu | versiunea conținutului (ex. `"1.2.0"`), copiată în progres |
| `language` | nu | ex. `"ro"` |
| `demo` | nu | `true` pentru conținut demonstrativ |
| `meta` | da | `title` (obligatoriu), `city`, `description`, `estimatedTime` (minute), `difficulty`, `tags` |
| `settings` | nu | `progression`, `gps`, `events` (secțiunea 4) |
| `narrator` | nu | `name`, `messages: { <id>: { "text", "audio"? } }` — vocea Game Master-ului |
| `audio` | nu | `basePath`, `tracks: { <id>: { "src", "kind", "transcriptMessage"? } }` |
| `locations` | nu | secțiunea 5 |
| `missions` | da | secțiunea 6; cel puțin o misiune pe traseul `main` |
| `partners` | nu | secțiunea 7 |
| `secrets` | nu | secțiunea 8 |
| `items` | nu | obiecte colecționabile: `[{ "id", "name", "description"?, "icon"? }]`; se obțin prin acțiunea `collect_item` (secțiunea 9) |
| `events` | nu | secțiunea 9 |
| `finale` | nu | `missionId` (misiune principală) + `messageId`; mesajul este afișat ca epilog pe ecranul de rezultat |

Câmpurile necunoscute sunt permise (extensibilitate: media, variante de răspuns, sezoane…). Valorile necunoscute din **listele închise** (tipuri, stări, acțiuni, evenimente, metode) sunt erori, ca greșelile de scriere să fie prinse la validare, nu pe teren.

Toate textele pentru jucător (inclusiv mesajele Game Master-ului) stau în conținut. Motorul nu conține texte narative.

## 4. Setări și valori implicite (D-039)

Definite o singură dată în `src/js/defaults.js`; fiecare aventură le poate suprascrie câmp cu câmp:

```json
"settings": {
  "progression": "linear",
  "gps": { "defaultRadius": 40, "nearDistance": 150, "maxAccuracy": 60, "exitMargin": 20, "allowManualConfirmation": true },
  "events": { "maxChainDepth": 8 }
}
```

| Setare | Implicit | Sens |
| --- | --- | --- |
| `progression` | `"linear"` | Singurul mod suportat: misiunile principale, în ordinea din listă |
| `gps.defaultRadius` | 40 m | Raza unei locații fără `radius` propriu |
| `gps.nearDistance` | 150 m | Sub această distanță jucătorul este „aproape” |
| `gps.maxAccuracy` | 60 m | O poziție mai puțin precisă este „incertă” și nu declanșează nimic |
| `gps.exitMargin` | 20 m | Histerezis la ieșire (împotriva oscilațiilor) |
| `gps.allowManualConfirmation` | `true` | „Am ajuns” ca rezervă (D-006). Când este `true`, sosirea se poate confirma **fără GPS și fără verificarea distanței** — vezi „Confirmarea manuală” (secțiunea 5) |
| `events.maxChainDepth` | 8 | Câte niveluri de reacții în lanț sunt permise (1–32) |

Valorile GPS sunt puncte de plecare; se validează pe teren (Faza 5).

## 5. Locații (D-039)

```json
{
  "id": "loc-piata",
  "name": "Piața cu ceas",
  "type": "start | objective | waypoint | partner | secret | finale",
  "coordinates": { "lat": 0.001, "lng": 0.001 },
  "radius": 40,
  "initialStatus": "locked | unlocked | discovered",
  "hiddenUntilDiscovered": false,
  "fallback": { "instructions": "…", "allowManualConfirmation": true }
}
```

- `coordinates`: WGS84, grade zecimale (formatul Geolocation API). `radius` în metri, mai mic decât `nearDistance`.
- **Stări:** `locked` (necunoscută — „fog of war”; implicit) → `unlocked` (obiectiv vizibil) → `discovered` (jucătorul a ajuns: GPS, manual sau printr-un eveniment) → `completed` (toate misiunile legate de locație sunt închise).
- O locație devine automat `unlocked` când misiunea ei devine activă.
- `hiddenUntilDiscovered: true` → locația începe `locked`, dar este evaluată de GPS: trecerea prin zonă o descoperă. Rezultatul `reportPosition` nu o include până la descoperire (interfața nu o poate dezvălui). Confirmarea manuală nu este permisă pentru locații `locked`.

### Contractul GPS

Motorul primește **observații**, nu folosește API-ul browserului:

```js
game.reportPosition({ lat, lng, accuracy, timestamp })   // de la orice sursă: browser, test, simulare
game.confirmArrival(locationId)                          // „Am ajuns” (rezervă manuală)
```

Reguli (`geo.js`):

1. Precizie lipsă, negativă sau mai mare decât `maxAccuracy` → zona **uncertain**: nu se schimbă nimic; `reportPosition` întoarce `{ uncertain: true, reason: "low_accuracy" }`, iar interfața poate oferi confirmarea manuală.
2. **inside** dacă `distanța ≤ rază + min(precizie, rază / 2)` — toleranța din precizie este limitată la jumătate din rază.
3. **near** dacă `distanța ≤ nearDistance`; altfel **outside**.
4. **Histerezis:** odată „inside”, ieșirea cere `distanța > pragul de intrare + exitMargin`; odată „near”, trecerea la „outside” cere `distanța > nearDistance + exitMargin`.
5. Motorul memorează prezența pe locație (`outside | near | inside`) și produce **tranziții**, nu stări repetate: `player_near_location`, `player_arrived` (+ `location_discovered` la prima sosire), `player_left_area`.

Sursa observațiilor în browser (M-003.1):

```text
navigator.geolocation.watchPosition
        ↓  GeolocationPosition
location.js   → { lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy, timestamp }
        ↓  onFix(fix) — fiecare fix, nemodificat, fără deduplicare
app.js        → game.reportPosition(fix)   (doar în starea „playing”)
        ↓
geo.js        → zone, histerezis, tranziții   → events.js → progres → UI
```

- `geo.assessFix(fix, gps)` → `{ usable, reason }`: aceeași regulă de precizie ca `evaluateProximity` (care o folosește intern). Interfața o folosește pentru „semnal slab” fără praguri proprii, inclusiv înainte de începerea jocului sau într-o aventură fără locații.
- Opțiunile `watchPosition` (`enableHighAccuracy`, `timeout`, `maximumAge`) sunt în `defaults.js` (`DEFAULT_GEOLOCATION_OPTIONS`); țin de dispozitiv, nu de aventură.
- La începerea jocului și la trecerea la misiunea următoare, ultima poziție primită este trimisă din nou motorului (browserul nu trimite poziții la interval fix).

Harta (M-003.2) folosește aceleași stări, fără reguli proprii: calitatea afișată pe hartă este traducerea 1:1 a `LocationDisplay` (`gps-ready` → `valid`, `gps-uncertain` → `uncertain`, restul → `none`; `weak` nu este produs), iar raza desenată este `game.getLocation(id).radiusMeters` = `geo.effectiveRadius(location, gps)` — aceeași rază folosită de `evaluateProximity`. Detalii: `12_MAP_SPECIFICATION_M-003.2.md`.

Limitări acceptate (PWA): browserul suspendă JavaScript și GPS-ul în fundal sau cu ecranul blocat (mai ales pe iPhone). Motorul nu presupune urmărire continuă: evaluează fiecare observație primită, iar confirmarea manuală rămâne disponibilă (dacă `allowManualConfirmation` nu este `false`). Coordonatele jucătorului **nu** se salvează (doar stări și momente).

### Confirmarea manuală („Am ajuns”) — `allowManualConfirmation`

Comportamentul actual (documentat, nu modificat):

- **Valoarea efectivă** pentru o locație: `location.fallback.allowManualConfirmation`, altfel `settings.gps.allowManualConfirmation`, altfel `true` (`defaults.js`). Aceeași regulă este folosită în `game.confirmArrival` și în `app.js` (afișarea butonului). O aventură care nu menționează setarea are confirmarea manuală **activă**; singura cale de a o dezactiva este `false` explicit.
- **`true`:** butonul „Am ajuns” apare în cardul obiectivului misiunii curente cât timp jucătorul nu a ajuns, **indiferent de starea GPS** (oprit, refuzat, indisponibil, semnal slab sau activ). `game.confirmArrival(locationId)` nu verifică distanța, fix-ul sau precizia: refuză doar locațiile `locked` / `completed`, prezența deja `inside` și setarea `false`. Sosirea trece prin același `arrive` ca GPS-ul (`arrivalSource: "manual"`): misiunea de tip `location` devine `solved`, **punctele se acordă integral**, regulile `mission_completed` rulează (ex. deblocarea locației și misiunii următoare). Scorul nu face diferența între sosirea GPS și cea manuală. Consecință: o aventură se poate termina complet, cu toate punctele, fără prezență fizică la obiective.
- **`false`:** butonul „Am ajuns” nu este afișat, iar `confirmArrival` întoarce `{ accepted: false, reason: "manual_not_allowed" }`. Sosirea se confirmă doar prin GPS. Atenție la D-006: fără confirmare manuală, un GPS imprecis poate bloca jocul.
- **Intenție:** fallback pentru aventurile **casual** și **demo/testare** (D-006 — GPS-ul nu este singura cale de progres), unde punctele nu dovedesc prezența fizică. Aventura `demo-gps-brasov` folosește intenționat `true`.
- **Aventuri competitive** (clasament, premii, recompense care depind de prezența fizică): comportamentul actual **nu** este suficient. Va fi necesară ulterior o regulă separată de validare GPS; nu este implementată și nu este decisă încă (vezi secțiunea 13).

## 6. Misiuni

```json
{
  "id": "m-ceas",
  "type": "riddle | observation | location | timed | partner | code | secret",
  "track": "main | bonus | secret",
  "title": "…",
  "briefing": "…",
  "locationId": "loc-piata",
  "partnerId": "…",
  "initialStatus": "locked | pending",
  "points": 100,
  "hints": [ { "text": "…" }, { "text": "…" } ],
  "answer": "…",
  "timeLimitSeconds": 180
}
```

- **Stări:** `locked` → `pending` (deschisă) → `solved` | `failed` | `skipped`. Doar `solved` aduce puncte. O misiune închisă nu își mai schimbă starea.
- **Trasee separate:**
  - `main` — progresie liniară: închiderea unei misiuni principale o deschide pe următoarea din listă. Misiunea curentă (`currentMissionId`) este mereu una principală.
  - `bonus` și `secret` — se deschid **doar prin evenimente** și nu schimbă misiunea curentă. O misiune `secret` trebuie să înceapă `locked`.
- **Tipuri:**

| Tip | Cum se rezolvă | Stare |
| --- | --- | --- |
| `riddle`, `observation`, `code` | răspuns (`answer`) | implementat |
| `partner` | răspuns = codul/indiciul primit la partener; cere `partnerId` | implementat ca model; fără partener real |
| `secret` | răspuns; `track: "secret"` | implementat |
| `location` | sosirea la `locationId` (GPS sau manual); fără `answer` | implementat în motor; interfață: cardul obiectivului cu stare GPS și „Am ajuns” (M-003.1), harta și cardul peste hartă (M-003.2, TASK 4); verificat automat și în browser, nevalidat încă pe dispozitive reale cu locații reale |
| `timed` | răspuns + `timeLimitSeconds` | doar schemă și `startedAt`; limita de timp **nu** este aplicată încă (D-025, D-028) |

- `hints`: se dezvăluie pe rând (`hintsUsed`); fiecare dezvăluire emite `hint_requested`. Fără penalizări (D-025). În interfață, un indiciu se deschide numai după confirmarea jucătorului; anularea confirmării nu atinge motorul (D-030, extinderea din 2026-10-01).
- `answer`: verificat doar prin `answers.js` (D-021, D-024). Motorul primește aventura fără răspunsuri.
- `choices` (opțional, doar pentru misiunile cu răspuns): 2–6 texte nevide, diferite. Interfața le afișează ca butoane în locul câmpului de text; varianta aleasă este trimisă ca răspuns prin aceeași verificare (`answers.js`, cu normalizarea D-024), deci `answer` trebuie să corespundă uneia dintre variante după normalizare. Schema nu face această verificare (doar `answers.js` citește răspunsurile — D-021).
- Rândurile noi din `briefing`, din indicii, din `fallback.instructions` și din mesajele naratorului sunt păstrate la afișare.

## 7. Parteneri

```json
{
  "id": "partner-contact",
  "name": "…",
  "category": "text liber: cafe, restaurant, museum, shop, hotel, gallery …",
  "locationId": "…",
  "missionId": "…",
  "initialStatus": "locked | unlocked",
  "verification": { "method": "code | staff_code | receipt_code | password | qr | physical_item | none", "instructions": "…" },
  "reward": { "type": "discount | clue | item | points | none", "description": "…" },
  "validity": { "from": "AAAA-LL-ZZ", "until": "AAAA-LL-ZZ" }
}
```

- Model **generic**: `category` este text liber; motorul nu tratează diferit o cafenea, un muzeu sau un hotel.
- Partenerul descrie relația; misiunea asociată (`type: "partner"`) descrie jocul. Legătura este verificată în ambele sensuri (`partner.missionId` ↔ `mission.partnerId`).
- Starea `unlocked` se obține prin acțiunea `unlock_partner` (emite `partner_unlocked`).
- `validity` și `reward` sunt doar descrise; nu sunt aplicate. Fără plăți și fără verificarea automată a cumpărăturii. Codurile reale de partener sunt conținut real și nu se pun în repository-ul public (D-034, CONFIRMED).

## 8. Secrete

```json
{ "id": "secret-pasaj", "title": "…", "description": "…", "locationId": "…", "missionId": "…", "points": 25 }
```

Descoperiri separate de traseul principal (acțiunea `discover_secret`, eveniment `secret_discovered`). Punctele unui secret se adaugă la descoperire. O misiune secretă asociată se deschide explicit, printr-o regulă (`unlock_mission`).

## 9. Evenimente (D-040)

```json
{
  "id": "ev-cafenea-deblocata",
  "on": "mission_completed",
  "where": { "missionId": "m-ceas" },
  "once": true,
  "do": [
    { "action": "unlock_location", "locationId": "loc-cafenea" },
    { "action": "unlock_mission", "missionId": "m-rapid" },
    { "action": "show_message", "messageId": "contact-intro" }
  ]
}
```

**Evenimente (`on`)** — listă închisă:

| Eveniment | Câmpuri | Emis când |
| --- | --- | --- |
| `adventure_started` | — | `start()` |
| `adventure_completed` | — | după ultima misiune principală sau prin `complete_adventure` |
| `mission_unlocked` | `missionId`, `locationId` | o misiune trece din `locked` în `pending` |
| `mission_started` | `missionId`, `locationId` | o misiune principală devine curentă |
| `mission_completed` / `mission_failed` / `mission_skipped` | `missionId`, `locationId` | misiunea se închide |
| `answer_incorrect` | `missionId`, `locationId` | răspuns greșit |
| `hint_requested` | `missionId`, `locationId`, `hintIndex` | un indiciu este dezvăluit |
| `location_unlocked` | `locationId` | locația devine vizibilă |
| `player_near_location` | `locationId`, `source`, `distanceMeters`, `accuracyMeters` | tranziție spre „near” |
| `player_arrived` | `locationId`, `source` (`gps`/`manual`), … | tranziție spre „inside” sau confirmare manuală |
| `player_left_area` | `locationId`, `source`, … | ieșire din zonă (după exitMargin) |
| `location_discovered` | `locationId`, `source` | prima descoperire |
| `location_completed` | `locationId` | toate misiunile locației sunt închise |
| `secret_discovered` | `secretId`, `locationId`, `missionId` | `discover_secret` |
| `partner_unlocked` | `partnerId`, `locationId`, `missionId` | `unlock_partner` |
| `finale_started` | `missionId` | misiunea `finale.missionId` devine curentă sau `start_finale` |

**Filtru (`where`)**: egalitate simplă pe `missionId`, `locationId`, `secretId`, `partnerId`; toate cheile trebuie să corespundă. Fără expresii.

**Acțiuni (`do`)** — listă închisă: `show_message {messageId}`, `play_audio {trackId}`, `unlock_mission {missionId}`, `complete_mission {missionId}`, `fail_mission {missionId}`, `unlock_location {locationId}`, `discover_location {locationId}`, `discover_secret {secretId}`, `unlock_partner {partnerId}`, `award_points {points, reason?}`, `collect_item {itemId}`, `start_finale`, `complete_adventure`.

`collect_item` (adăugată 2026-10-01): marchează obiectul `itemId` (din `items`) ca obținut. Ca punctele din `award_points`, obiectele obținute **nu** se salvează separat: se derivă din regulile rulate (`firedEvents`) prin `collectedItems(adventure, firedEvents)` din `game.js`, în ordinea rulării, fără duplicate (`getProgressSummary().collectedItems`, `viewModel.items`). Motorul emite și efectul `{ type: "item", itemId }`. Un obiect legat de rezolvarea unei misiuni (`mission_completed`) nu se obține dacă misiunea este sărită; conținutul trebuie să ofere o cale de continuare (D-006).

**Protecții:**

- `once` este `true` implicit: regula rulează o singură dată pe joc; regulile rulate se salvează în progres (`firedEvents`), deci nu se repetă nici după refresh.
- `award_points` nu este permis într-o regulă cu `once: false`.
- Acțiunile sunt idempotente: o acțiune care nu schimbă starea nu emite eveniment (a doua `complete_mission` pe aceeași misiune nu face nimic).
- **Lanțuri:** evenimentele inițiale au adâncimea 0; regulile rulează doar pentru evenimente cu adâncimea < `maxChainDepth`. Evenimentele de la limită rămân înregistrate (s-au petrecut), dar nu mai declanșează reguli, iar interfața primește un efect `warning: event_chain_limit`. Plafon absolut de siguranță: 200 de evenimente per acțiune.

**Efecte:** motorul nu afișează și nu redă nimic. `show_message`, `play_audio` și `award_points` produc efecte (`game.takeEffects()` → `[{ type: "message", messageId, text, audio }, { type: "audio", trackId }, { type: "points", points, reason }]`) pe care interfața le prezintă. Redarea audio (după activarea explicită a sunetului) este o etapă ulterioară.

## 10. Audio

```json
"audio": {
  "basePath": "cale/relativa/",
  "tracks": { "voice-intro": { "src": "intro.mp3", "kind": "voice | sfx | music", "transcriptMessage": "intro" } }
}
```

- Căi relative, fără „/” la început, fără „..”, fără adrese externe.
- Sunetele cu voce (`kind: "voice"`) trebuie să aibă `transcriptMessage` — text alternativ obligatoriu.
- Nu există încă player audio, activare a sunetului sau cache pentru fișiere audio (etapă ulterioară: autoplay blocat de browsere, strategie offline).

## 11. Progresul salvat (D-043)

Cheia rămâne `outdoor-escape:game:<id>`. Forma V2:

```json
{
  "schemaVersion": 2,
  "adventureId": "…",
  "contentVersion": "0.1.0",
  "status": "idle | playing | completed",
  "currentMissionId": "m-ceas",
  "missions":  { "<id>": { "status": "locked | pending | solved | failed | skipped", "attempts": 1, "hintsUsed": 1, "startedAt": 0, "closedAt": null } },
  "locations": { "<id>": { "status": "locked | unlocked | discovered | completed", "presence": "outside | near | inside", "arrivedAt": 0, "arrivalSource": "gps | manual" } },
  "partners":  { "<id>": { "status": "locked | unlocked" } },
  "secrets":   { "<id>": { "discoveredAt": 0 } },
  "firedEvents": { "<ruleId>": 0 },
  "score": 150,
  "startedAt": 0,
  "completedAt": null,
  "finaleStartedAt": null
}
```

- Se salvează **faptele**; listele cerute de produs sunt **derivate** (`game.getProgressSummary()`): `completedMissions`, `failedMissions`, `skippedMissions`, `openMissions`, `hintsUsed`, `unlockedLocations`, `visitedLocations`, `completedLocations`, `discoveredSecrets`, `unlockedPartners`, `triggeredEvents`, `score`. `collectedClues` nu există încă (nu există o entitate „clue”).
- **Scorul** este derivat: misiuni `solved` + puncte ale secretelor descoperite + `award_points` din regulile rulate. Valoarea salvată este informativă și se recalculează la restaurare.
- **Restaurare tolerantă:** entitățile noi pornesc din starea inițială, cele eliminate sunt ignorate, valorile invalide sunt reparate, iar în progresia liniară prima misiune principală neînchisă este deschisă.
- **Migrare V1 → V2** (automată, fără pierderi): `challenges` → `missions`, `hintUsed` → `hintsUsed` (0/1), `currentIndex` → `currentMissionId`; provocările de după cea curentă, încă nerezolvate, devin `locked`, iar următoarea în progresie este deschisă. O stare cu altă versiune sau pentru altă aventură este ignorată (jocul pornește de la zero).

## 12. API-ul motorului (`createGame`)

Compatibil cu versiunea anterioară: `start`, `submitAnswer`, `useHint`, `skipChallenge`, `failChallenge`, `next`, `reset`, `getState`, `subscribe`, `getSummary`, `getCurrentChallenge` (alias pentru `getCurrentMission`).

Nou în M-002: `content` (aventura normalizată), `getCurrentMission`, `getMission`, `getOpenMissions`, `getLocation`, `getProgressSummary`, `takeEffects`, `submitMissionAnswer(missionId, input)`, `requestHint(missionId?)`, `skipMission`, `failMission`, `reportPosition(fix)`, `confirmArrival(locationId)`.

Adăugat 2026-10-01 (aditiv): `getProgressSummary().collectedItems` și funcția exportată `collectedItems(adventure, firedEvents)`.

## 13. Ce NU este implementat în această etapă

Vezi tabelul din secțiunea 0. În plus, nu există: GPS în fundal / geofencing, hartă offline (harta online este implementată în M-003.2), audio, notificări, parteneri reali și coduri reale, plăți, backend, cache offline pentru mai multe aventuri sau pentru audio, validarea GPS a prezenței pentru aventuri competitive (confirmarea manuală acordă punctele fără verificarea distanței — secțiunea 5, „Confirmarea manuală”).

Nu există nici elementele Platform V1.1: sesiuni cu identitate, echipe, participanți, rejoin, stare comună / sincronizare, pachet offline per versiune, fixarea sesiunii pe versiune, GPS adaptiv, Route Health / bypass, flux graf, `answerHash` — vezi secțiunea 14 și `13_PLATFORM_V1.1.md` §17.

## 14. Extensii Platform V1.1 (PREGĂTIT PENTRU VIITOR)

Stare: **documentat, nevalidat, fără efect în motor.** Decizii: D-051, D-053 – D-062 în [`04_DECISIONS_LOG.md`](04_DECISIONS_LOG.md). Arhitectura: [`13_PLATFORM_V1.1.md`](13_PLATFORM_V1.1.md).

Această secțiune arată cum se integrează cerințele V1.1 în schema V2 **fără a rupe compatibilitatea**. Numele câmpurilor noi sunt **provizorii**; se fixează (și se adaugă în `schema.js`) doar în milestone-ul care implementează funcționalitatea respectivă, cu o decizie în jurnal.

### 14.1 Reguli de compatibilitate

1. Aventurile V1 și V2 existente rămân valide, fără modificări. Conversia V1 → V2 nu se schimbă.
2. Toate câmpurile noi sunt **opționale**. O aventură fără ele se comportă exact ca azi (liniar, `shared_device`, fără pachet offline dedicat).
3. Se păstrează convențiile existente: câmpuri în **camelCase**, id-uri cu litere mici, cifre și cratimă (`isValidId`). Exemplul conceptual V1.1 (snake_case, id-uri cu `_`) este tradus în aceste convenții, nu invers.
4. Nu se introduce o structură paralelă pentru ce există deja: coordonatele rămân în `locations[]`, provocările în `missions[]`, modul de progresie în `settings.progression`, versiunea conținutului în `contentVersion`.
5. Verificat la 2026-09-30 (rulare locală a `validateAdventureV2` pe o copie a fixture-ului): câmpurile noi de mai jos sunt **acceptate și ignorate** de validatorul actual (câmpuri necunoscute permise), iar `settings.progression: "graph"` este **respins** (lista închisă conține doar `linear`). Acesta este comportamentul dorit până la implementare: o aventură-graf nu poate rula pe un motor liniar.
6. Dacă noile câmpuri cer `schemaVersion: 3` sau rămân opționale în V2: DESCHIS (de decis la primul milestone care le implementează).

### 14.2 Corespondența exemplului conceptual V1.1 cu schema V2

| Exemplu conceptual V1.1 | Schema V2 (existent sau propus) | Status |
| --- | --- | --- |
| `id` | `id` | existent |
| `version` (`"1.0"`) | `contentVersion` | existent (opțional); devine obligatoriu pentru aventurile publicate (D-057) — regulă viitoare |
| `title` | `meta.title` | existent |
| `route_id` | `routeId` | propus |
| `start_condition { type: "geofence", lat, lng, radius_meters }` | o locație `type: "start"` (coordonate + `radius`) + `startCondition: { "type": "geofence" \| "manual", "locationId": "…" }` | locația: existentă; `startCondition`: propus |
| `nodes[]` | `locations[]` (prezența fizică) + `missions[]` cu `locationId` (discovery / provocare) | existent |
| `node.geofence { lat, lng, radius_meters }` | `location.coordinates { lat, lng }` + `location.radius` | existent (D-039) |
| `node.name` | `location.name` | existent |
| `node.safety_warning` | `location.safetyWarning` | propus |
| `node.discovery.text` | misiune `type: "observation"` legată de locație (`briefing`) sau `location.discovery.text` | misiunea: existentă; câmpul pe locație: propus |
| `challenge.type: "numeric_input"` | misiune `riddle` / `code` + `inputMode: "numeric"` (indiciu pentru tastatura telefonului, nu regulă de validare) | `inputMode`: propus |
| `challenge.question` | `mission.briefing` | existent |
| `challenge.answer_hash` | `mission.answerHash` + `answerHashAlgorithm: "sha-256"`; hash-ul se calculează pe răspunsul **normalizat** (D-024). Doar `answers.js` îl citește (D-021) | propus (azi: `answer` în text clar) |
| `hints[].delay_seconds` | `mission.hints[].delaySeconds` (indiciul devine disponibil după N secunde de la deschiderea misiunii; timpul din timestamp-uri — D-025, D-028) | propus |
| `flow.type: linear \| graph` | `settings.progression: "linear" \| "graph"` | `linear`: existent; `graph`: propus |

### 14.3 Câmpuri propuse (provizorii)

**Nivel superior și `settings`:**

```json
{
  "contentVersion": "1.0",
  "routeId": "route-circuit-exemplu",
  "startCondition": { "type": "geofence", "locationId": "start" },
  "settings": {
    "progression": "linear",
    "session": {
      "deviceMode": "shared_device | multi_device | either",
      "hints": "shared | per_participant",
      "maxParticipants": 4
    },
    "gpsPolling": { "profile": "walk | bike" },
    "integrity": "casual | verified"
  },
  "offline": {
    "assets": ["media/intro.jpg", "audio/intro.mp3"]
  }
}
```

- `settings.session` — D-054. `deviceMode` spune ce moduri permite aventura; `hints` spune dacă indiciile sunt comune echipei.
- `settings.gpsPolling` — D-058. Doar alegerea unui **profil**; valorile concrete (intervale, praguri de distanță) stau în `defaults.js`, ca opțiunile `watchPosition` de azi (D-045), și **nu sunt fixate în arhitectură**.
- `settings.integrity` — D-060. `casual`: comportamentul de azi (GPS sau „Am ajuns”). `verified`: checkpoint-urile cer o dovadă suplimentară (`location.proof`), iar confirmarea manuală nu acordă singură punctele. Regula exactă: DESCHIS (legat de secțiunea 5, „Aventuri competitive”).
- `offline.assets` — D-056. Lista explicită a fișierelor din pachet (căi relative, aceleași reguli ca `audio.basePath`). **Nu** conține tile-uri de hartă (D-046).

**Locații:**

```json
{
  "id": "cp-01",
  "type": "objective",
  "coordinates": { "lat": 0.001, "lng": 0.001 },
  "radius": 20,
  "safetyWarning": "Oprește bicicleta pe marginea drumului înainte de a debloca!",
  "proof": { "method": "gps | code | qr | observation | physical_item | operator" },
  "bypass": { "allowed": true, "instructions": "…" }
}
```

- `safetyWarning` — D-059; afișat înainte de interacțiunea cu telefonul la checkpoint.
- `proof.method` — D-060; reutilizează vocabularul existent din `partner.verification.method` acolo unde se suprapune.
- `bypass` — D-061; spune dacă și cum se poate trece peste checkpoint. **Starea de disponibilitate** (`ACTIVE / UNAVAILABLE / BYPASSED`) **nu** stă în conținut: este strat operațional al rutei (Route Health), ca să se poată schimba fără o versiune nouă.

**Misiuni (flux graf — D-062):**

```json
{ "id": "m-05", "track": "main", "after": ["m-02", "m-03"], "join": "all | any" }
```

- `after` / `join` au sens doar cu `settings.progression: "graph"`. În `linear`, ordinea rămâne ordinea din listă (comportamentul actual).
- Progresul pe entități (secțiunea 11) se păstrează; în graf pot exista mai multe misiuni principale deschise simultan, deci `currentMissionId` devine insuficient — schimbarea formei progresului se decide la implementare, cu migrare automată (principiul D-043).

**Rezervat:** `ar` (capabilitate AR viitoare, D-050) — fără structură definită.

### 14.4 Ce NU intră în schema aventurii

| Informație | Unde stă | Motiv |
| --- | --- | --- |
| Geometria rutei, starea de disponibilitate a checkpoint-urilor | Route / Route Health | aceeași rută servește mai multe aventuri (D-051, D-061) |
| Sesiune, echipă, participanți, roluri, rejoin | Adventure Session (stare, nu conținut) | aceeași aventură are multe sesiuni simultane (D-051) |
| Adventure Pass, cumpărare, rezervare | business (FUTURE) | `03_ARCHITECTURE.md` §5 |
| Tile-uri de hartă | providerul configurat (D-046) | politica OSM; harta offline: D-063 |
| Valori concrete de polling GPS | `defaults.js` | țin de dispozitiv și de testarea pe teren (D-058) |

### 14.5 Exemplu conceptual V1.1 tradus în convențiile V2

**Ilustrativ.** Coordonatele sunt aproximative și **nevalidate**; „Ursa Mică” este doar un nume de exemplu; textele nu sunt conținut real și nu conțin afirmații istorice (D-011). Traseul Funsy Bike / Șirnea se validează pe teren înainte de orice conținut real (`13_PLATFORM_V1.1.md` §16).

```json
{
  "schemaVersion": 2,
  "id": "adv-sirnea-mystery-01",
  "contentVersion": "1.0",
  "routeId": "route-sirnea-circuit",
  "meta": { "title": "Misterul Șirnei" },
  "startCondition": { "type": "geofence", "locationId": "start" },
  "settings": { "progression": "linear" },
  "locations": [
    { "id": "start", "name": "Start", "type": "start", "coordinates": { "lat": 45.421, "lng": 25.332 }, "radius": 30, "initialStatus": "unlocked" },
    {
      "id": "cp-01-ursa-mica",
      "name": "Punctul de observație Ursa Mică",
      "type": "objective",
      "coordinates": { "lat": 45.425, "lng": 25.338 },
      "radius": 20,
      "safetyWarning": "Oprește bicicleta pe marginea drumului înainte de a debloca!"
    }
  ],
  "missions": [
    {
      "id": "m-01-anul-gravat",
      "type": "code",
      "track": "main",
      "title": "Placa memorială",
      "briefing": "Caută anul gravat pe placa memorială de lângă intrare. Care este anul gravat?",
      "locationId": "cp-01-ursa-mica",
      "inputMode": "numeric",
      "answerHash": "…",
      "answerHashAlgorithm": "sha-256",
      "hints": [ { "text": "Uită-te în partea stângă a porții.", "delaySeconds": 180 } ],
      "points": 100
    }
  ]
}
```

Notă: cu validatorul actual, acest exemplu **nu** trece validarea, pentru că misiunea de tip `code` cere `answer` (nu există încă suport pentru `answerHash`). Este un exemplu de formă, nu un fișier de conținut.
