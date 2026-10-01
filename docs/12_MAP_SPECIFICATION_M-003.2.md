# M-003.2 — Map Specification

| | |
| --- | --- |
| **Status** | SPECIFICATION APPROVED — IMPLEMENTED — **ACCEPTED — CLOSED** (owner acceptance: 30.09.2026) |
| **Decisions** | D-046, D-047, D-048, D-049 (`04_DECISIONS_LOG.md`) |
| **Milestone** | M-003.2 |
| **Implementation status** | **Implementat și comis (`39a6b28`); acceptat de proprietar la 30.09.2026** — `src/js/map.js`, `src/js/map-model.js`, `src/vendor/leaflet/` (1.9.4), `geo.effectiveRadius` + `game.getLocation().radiusMeters` (R2), teste; verificare: `07_TESTING.md` §25. Milestone-ul este **închis** (§18) |
| **Aprobat** | 2026-09-29, de proprietarul proiectului |
| **Alegeri finale** | D-049-C → `uncertain`; D-049-D → R2; D-049-A, B, C2, E…M în forma din §13 |

Acest document este specificația oficială și completă a hărții (Map V1). Este sursa pentru implementarea M-003.2 și pentru criteriile de acceptare (§15). Deciziile rezumate sunt în `04_DECISIONS_LOG.md` (D-046…D-049). În caz de neconcordanță, jurnalul deciziilor are prioritate, iar acest document trebuie corectat.

Origine: propunerea D-049, revizia 2 (fișier de lucru local `Claude outputs/PROPUNERE_D-049_MAP_V1.md`, ignorat de Git și păstrat doar ca artefact istoric). Conținutul este preluat integral; au fost actualizate doar mențiunile „de aprobat / de ales” pentru a reflecta alegerile aprobate (C → `uncertain`, D → R2), iar riscurile rezolvate sunt marcate „ÎNCHIS”.

Bază tehnică: analiză read-only a `main` (ultimul commit la momentul analizei: „feat: integrate browser geolocation”, M-003.1). Fișiere analizate: `src/index.html`, `src/css/app.css`, `src/js/app.js`, `location.js`, `geo.js`, `game.js`, `schema.js`, `defaults.js`, `src/sw.js`, `.github/workflows/deploy-pages.yml`, conținutul demo, fixture-ul V2, `tests/game.test.js`, `geo.test.js`, `location.test.js`, `location-integration.test.js`, `progress-v2.test.js`, `docs/03`, `04`, `07` §24, `11` §0 și §5, politica tile-urilor OSM (recitită la 2026-09-29).

Deciziile de bază D-046 (tehnologia hărții), D-047 (contractul `map.js`) și D-048 (modelul vizual) sunt fixe. Documentul precizează comportamentul care decurge din ele (D-049).

---

## 0. Principii

1. Harta este **doar orientare**. Nu confirmă sosirea, nu schimbă progresul, nu are acțiuni de joc. „Am ajuns” rămâne în cardul obiectivului.
2. **Îmbunătățire progresivă:** dacă Leaflet, tile-urile sau containerul lipsesc, jocul funcționează exact ca în M-003.1.
3. **O singură sursă de adevăr pentru fiecare regulă.** Harta nu recalculează nimic din ce decid deja `geo.js`, `location.js` sau `game.js`. Nu apare nicio semantică GPS nouă.
4. **Harta nu se luptă cu utilizatorul:** se mișcă singură doar la evenimente discrete, niciodată la un fix GPS obișnuit.
5. Nimic nu se recreează la update: harta, tile layer-ul și markerii se creează o dată și se actualizează incremental.

---

## 1. Arhitectura și contractul `app.js → map-model.js → map.js`

### 1.1 Rolurile

| Modul | Rol | Ce NU face |
| --- | --- | --- |
| `app.js` (existent) | Adună date **deja calculate** de sistemul existent și le transmite; gestionează ciclul de viață al hărții și cele două butoane | nu calculează distanțe, praguri, rază implicită |
| `map-model.js` (nou, pur) | Traduce vocabularul existent în vocabularul D-048 prin **tabele fixe de corespondență** (§2.1, §3.1) | nu importă `game.js`, `geo.js`, `location.js`; nu calculează nimic GPS; nu aplică valori implicite |
| `map.js` (nou) | Singurul modul care atinge Leaflet; desenează modelul D-048; politica de viewport (§5) | nu importă `game.js`, `geo.js`, `location.js`, `navigator.geolocation`; nu apelează `reportPosition` / `confirmArrival`; nu interpretează stări |

### 1.2 Date: `app.js` → `map-model.js`

```js
buildMapModel({
  // Pentru FIECARE locație din adventure.locations, vederea motorului (game.getLocation):
  locations: [
    {
      location: { id, name, coordinates: { lat, lng } },   // din conținutul normalizat
      progress: { status, presence, arrivedAt },            // din progresul motorului
      radiusMeters,                                         // raza efectivă — vine din game.js (D-049-D)
    },
  ],
  // Aceeași condiție pe care o folosește deja cardul „Obiectiv” (renderObjective):
  currentObjectiveLocationId,   // mission.locationId al misiunii curente, dacă locația nu e „locked”; altfel null
  // Rezultatul funcției existente describeLocation(tracker.getState(), assessFix(fix, gps)),
  // calculat deja în app.js prin locationDisplay():
  locationDisplay,              // "gps-off" | "gps-unavailable" | "gps-permission-denied" | "gps-searching" | "gps-error" | "gps-uncertain" | "gps-ready"
  // Ultima observație reținută de location.js (tracker.getState().fix), nemodificată:
  trackerFix,                   // { lat, lng, accuracy, timestamp } | null
})
```

### 1.3 Date: `map-model.js` → `app.js` (modelul D-048, neschimbat)

```js
{
  player: { fix: { lat, lng, accuracy, timestamp } | null, quality: "valid" | "weak" | "uncertain" | "none" },
  locations: [ { id, name, lat, lng, radius, state, visible } ],
  currentObjectiveId: string | null,
}
```

- `player.fix` = `trackerFix` copiat 1:1 (sau `null`). Nu se filtrează după calitate (§2.2).
- `player.quality` = tabelul §2.1.
- `locations[i].radius` = `radiusMeters` primit, **copiat**, fără valoare implicită (§4.1).
- `locations[i].state` / `visible` = tabelul §3.1.
- `currentObjectiveId` = `currentObjectiveLocationId` copiat.

### 1.4 Apeluri: `app.js` → `map.js`

La fiecare notificare `game.subscribe` / `tracker.subscribe` (unde `app.js` redesenează deja interfața), cât timp harta există, în această ordine:

```js
map.updateLocations(model.locations);
map.updatePlayer(model.player.fix, model.player.quality);
map.setCurrentObjective(model.currentObjectiveId);
```

Ordinea contează: la schimbarea obiectivului, recentrarea (§5) folosește poziția și locațiile deja actualizate.
Butoanele: „Centrează pe mine” → `map.centerOnPlayer()`; „Vezi obiectivele” → `map.fitToAdventure(model.locations)`.

### 1.5 `map.js` → `app.js`

- `createMap(...)` întoarce instanța sau aruncă `MapError` cu `code` ∈ `leaflet_unavailable | invalid_container | invalid_tile_config`.
- `centerOnPlayer()` / `fitToAdventure()` întorc `true` / `false` (dacă au avut ce afișa).
- Nimic altceva: fără callback-uri, fără evenimente către joc.

### 1.6 API `map.js` (D-047, precizat)

```js
const map = createMap({ container, tileConfig, view?, leaflet? });
map.updatePlayer(fix, quality);
map.updateLocations(locations);
map.setCurrentObjective(locationId);
map.fitToAdventure(locations);
map.centerOnPlayer();
map.destroy();
```

- Metodele aparțin instanței întoarse de `createMap`. Toate sunt idempotente. După `destroy()`, nu mai fac nimic.
- `view` (opțional, implicit `DEFAULT_MAP_VIEW`) și `leaflet` (opțional, implicit `globalThis.L`, injectabil în teste, ca `geolocation` în `location.js`) sunt extensii aditive. Semnătura D-047 rămâne validă.

---

## 2. Jucătorul: calitatea GPS vs. ultima poziție afișabilă

Sunt **două informații independente** și se documentează separat:

- **Calitatea GPS** (`player.quality`): ce spune **deja** sistemul M-003.1 despre GPS, acum.
- **Ultima poziție afișabilă** (`player.fix`): ce observație reține **deja** `location.js` în acest moment. Nu e o stare GPS, ci o dată de afișat.

### 2.1 Calitatea — traducere 1:1 din `LocationDisplay` (M-003.1)

M-003.1 are o singură funcție care decide starea afișată: `describeLocation(trackerState, assessFix(fix, gps))` din `location.js`. Pragul `maxAccuracy` se aplică doar în `geo.assessFix`. `map-model.js` preia rezultatul, fără alt calcul:

| `LocationDisplay` (existent) | Când apare (existent) | `quality` D-048 |
| --- | --- | --- |
| `gps-ready` | tracker `active` + `assessFix.usable` | `valid` |
| `gps-uncertain` | tracker `active` + `assessFix` neutilizabil (`low_accuracy`: precizie > `maxAccuracy`, lipsă sau negativă; sau `invalid_fix`) — textul actual pentru jucător: „⚠️ Semnal GPS slab” | **`uncertain`** *(D-049-C, aprobat)* |
| `gps-off`, `gps-unavailable`, `gps-permission-denied`, `gps-searching`, `gps-error` | tracker fără poziție utilizabilă acum | `none` |
| — | **nicio stare M-003.1 nu produce `weak`** | `weak` nu este produs în V1 |

**Decizie aprobată (D-049-C): `gps-uncertain` → `uncertain`.** Contextul deciziei: M-003.1 are o singură categorie de „poziție neutilizabilă” (`gps-uncertain`). D-048 are două nume (`weak`, `uncertain`). Ca să le separăm, ar trebui un prag nou, deci o semantică GPS nouă, ceea ce este interzis. S-a ales **`gps-uncertain` → `uncertain`**, pentru că același nume apare deja în `Zone.UNCERTAIN`, în `LocationDisplay.UNCERTAIN`, în `reportPosition` (`{ uncertain: true }`) și în `11_ADVENTURE_SCHEMA_V2.md` §5. Textul „Semnal GPS slab” este doar formularea pentru jucător. `weak` rămâne valoare validă a contractului, **neprodusă în V1**. Dacă apare vreodată, `map.js` o desenează exact ca `uncertain` (nu îi dă un sens propriu). Alternativa respinsă (`gps-uncertain` → `weak`, `uncertain` neprodus) era echivalentă tehnic. A contat consecvența numelor cu codul existent.

### 2.2 Ultima poziție afișabilă — comportament de afișare

- `player.fix` = `tracker.getState().fix`, exact cum îl reține astăzi `location.js`: îl setează la fiecare poziție, îl **păstrează** la `timeout` / `position_unavailable` și îl șterge la `stop`, la refuz și la o nouă pornire. `map-model.js` nu decide când se păstrează sau se uită o poziție.
- `timestamp` nu este folosit de hartă pentru nicio decizie (fără reguli de „vechime”).

### 2.3 Ce desenează `map.js` (tabel de redare, nu stare GPS)

| `quality` | `fix` | Marker jucător | Cerc de acuratețe | Text sub hartă (în afara hărții, generat de `app.js`) |
| --- | --- | --- | --- | --- |
| `valid` | prezent | punct albastru plin, 16 px, contur alb 3 px | raza = `accuracy`, umplere 10% | „Poziția ta · precizie ~N m” |
| `uncertain` (și `weak`) | prezent | punct albastru **gol** (doar contur) | contur **punctat**, umplere 6% | „Semnal GPS slab — poziția de pe hartă poate fi greșită cu ~N m” |
| `none` | prezent | punct **gri**, gol, cu eticheta „ultima poziție” | **fără cerc** | „Ultima poziție primită — GPS-ul nu transmite acum poziția” *(D-049-C2)* |
| `none` | `null` | niciun marker | niciun cerc | după `locationDisplay` (§7) |

- Punctul gri este strict o **afișare** a datei pe care `location.js` o reține deja. Nu schimbă `quality`, nu produce evenimente și nu apare în joc.
- Fix cu coordonate nedesenabile (nefinite sau în afara intervalelor): nu se desenează nimic (validare de intrare, nu regulă GPS). `console.warn` o singură dată.
- `accuracy` nefinită sau negativă: fără cerc.
- Update: `setLatLng` / `setRadius` / `setStyle` (ultimul doar la schimbarea rândului din tabel). Aceleași date → zero apeluri Leaflet.
- Markerul jucătorului: `interactive: false`, `aria-hidden`, deasupra markerilor de locații. Fără animație de puls.
- **Accuracy foarte mare:** cercul se desenează cu raza reală până la `DEFAULT_MAP_VIEW.accuracyCircleMax` (1000 m). Peste, fără cerc și cu textul „Precizie foarte slabă (~N m)”. Este o **limită doar de desen**. Nu influențează `quality`, progresul sau `geo.js` *(D-049-I)*.
- Cercul de acuratețe **nu intră niciodată** în încadrare (fit) sau în calculul de zoom.

---

## 3. Markerii locațiilor

### 3.1 Starea D-048 — traducere 1:1 din progresul motorului

Motorul: `status` ∈ `locked | unlocked | discovered | completed`, `presence` ∈ `outside | near | inside`, `arrivedAt`. Evaluare în ordine:

| Progres (existent) | `state` | `visible` |
| --- | --- | --- |
| `status === "completed"` | `completed` | true |
| `status === "discovered"` sau `arrivedAt !== null` | `arrived` | true |
| `status === "unlocked"` și `presence === "near"` | `near` | true |
| `status === "unlocked"` | `available` | true |
| `status === "locked"` (inclusiv `hiddenUntilDiscovered`) | `locked` | **false** |

- Tabelul doar redenumește stări pe care motorul le-a decis deja. `presence` vine exclusiv din `geo.js` / `game.reportPosition`.
- `discovered` printr-un eveniment (`discover_location`), fără sosire fizică, apare ca `arrived` *(D-049-B)*.
- `lat` / `lng` = `location.coordinates`. `radius` = `radiusMeters` din `game.js` (§4.1).
- Locațiile `visible: false` nu se desenează **niciodată** („fog of war”, D-049-H).

### 3.2 Aspect (formă + simbol + culoare, nu doar culoare)

| `state` | Marker | `aria-label` |
| --- | --- | --- |
| `available` | pin verde închis (#1f3a2e), contur alb, 32 px | „Obiectiv: {nume}” |
| `near` | ca `available` + inel exterior | „Obiectiv: {nume} — ești aproape” |
| `arrived` | pin verde (#1d6b36) cu „✓” | „Obiectiv: {nume} — ai ajuns” |
| `completed` | cerc gri 24 px cu „✓”, sub ceilalți | „Obiectiv finalizat: {nume}” |
| **obiectiv curent** (orice stare de mai sus) | pin 44 px, contur chihlimbar (#d98e04), deasupra tuturor, etichetă permanentă cu numele | „Obiectivul curent: {nume} — {stare}” |

- Zonă de atingere ≥ 44×44 px. Markerii sunt focalizabili cu tastatura.
- Tap pe marker → popup cu nume + stare în text. **Fără butoane**, fără `confirmArrival`.
- Etichetele stărilor sunt texte de interfață în `map.js`. Numele vin din model. `map.js` nu conține texte ale vreunei aventuri.

---

## 4. Raza și cercul obiectivului

### 4.1 Sursa de adevăr pentru `radius` (D-049-D)

Situația actuală: `radius` este opțional în conținut. Raza efectivă (`radius` propriu sau `settings.gps.defaultRadius`) este decisă în `geo.evaluateProximity`, care o întoarce ca `radiusMeters`. `schema.js` conține, **separat și deja existent**, o copie folosită doar la validare (`schema.js:227`).

Regula D-049: **nici `map-model.js`, nici `map.js` nu aplică valoarea implicită.** Modelul primește raza efectivă gata calculată, de la motor.

Necesitate de implementare ulterioară (**nu se face acum**) — ajustare aditivă în `game.js`:

```js
getLocation(locationId) → { location, progress, radiusMeters }   // câmp nou, aditiv
```

cu `radiusMeters` obținut **din `geo.js`**, fără a rescrie regula:

- **Varianta R1 (respinsă):** `radiusMeters = evaluateProximity(location, null, content.settings.gps).radiusMeters`. Pe ramura „fix invalid”, `evaluateProximity` întoarce deja `radiusMeters` (`geo.js:94`), înainte de orice calcul de distanță. Ar fi cerut un test nou care să fixeze acest comportament (azi testat doar pe ramura cu fix valid, `geo.test.js:66–68`). Dezavantaj: se bazează pe o ramură secundară a funcției.
- **Varianta R2 — APROBATĂ (D-049-D):** export aditiv `effectiveRadius(location, gps)` în `geo.js`, folosit intern de `evaluateProximity` (ca precedentul `assessFix` din M-003.1), apelat din `game.js`: `radiusMeters = effectiveRadius(location, content.settings.gps)`. Regula razei implicite are astfel o singură sursă de adevăr în cod rulat de joc (`geo.js`). Algoritmul GPS nu se schimbă; testele existente din `geo.test.js` trebuie să treacă nemodificate.

Cu varianta aprobată: comportament GPS neschimbat. `getLocation` e folosit azi doar de `app.js:159`, iar niciun test nu compară rezultatul complet. Câmpul nou nu schimbă testele existente.
Copia din `schema.js` (validare) rămâne ca înainte. Este o duplicare **preexistentă**, în afara M-003.2 (§12).

### 4.2 Cercul obiectivului

- Se desenează **doar pentru obiectivul curent**, cât timp starea lui este `available` sau `near`. Dispare la `arrived` / `completed`.
- `L.circle(radius)`, contur verde punctat, umplere 8%, `interactive: false`, sub markeri. Rază nefinită / ≤ 0 → fără cerc; markerul rămâne.
- Este **exclusiv reprezentare vizuală**. Sosirea este decisă de `geo.js` (rază + toleranță de precizie + histerezis), deci confirmarea poate avea loc puțin în afara cercului. Nicio componentă nu compară poziția cu cercul. Cercul nu influențează progresul, stările sau textele.

---

## 5. Zoom și centrare — politica de viewport (în `map.js`)

Starea internă: `userMoved` (a făcut utilizatorul pan/zoom de la ultima mișcare automată?), `hadFirstFix`, `lastObjectiveId`. Mișcările făcute de cod sunt marcate cu un flag, ca să nu fie confundate cu gesturile utilizatorului.

### 5.1 Regula D-049-E (fixă)

```text
schimbare obiectiv  (setCurrentObjective cu alt id, non-null — urmare a unei acțiuni a jucătorului, ex. „Continuă”)
        ↓
o singură recentrare  (încadrare: noul obiectiv + jucătorul, dacă există fix; zoom ≤ 17)
        ↓           — se aplică și dacă utilizatorul făcuse pan înainte
fix-uri GPS ulterioare
        ↓
doar actualizarea markerului  (niciun pan, niciun zoom)
```

Dacă utilizatorul face pan după recentrare, harta nu îl urmărește la fixurile următoare. Singura excepție este butonul „Centrează pe mine” (§5.2).

### 5.2 Tabelul complet

| Eveniment | Comportament |
| --- | --- |
| **Crearea hărții** | locații vizibile → `fitToAdventure` (padding 48 px, zoom ≤ 17); altfel fix afișabil → centrare pe jucător, zoom 17 |
| **Primul fix afișabil** (în viața hărții) | doar dacă `userMoved === false`: obiectiv curent → încadrare jucător + obiectiv; altfel centrare pe jucător. Dacă utilizatorul a mișcat deja harta → nimic |
| **Fix-uri următoare** | doar markerul și cercul. **Nicio mișcare**, niciodată |
| **Schimbarea obiectivului** | regula D-049-E (§5.1); resetează `userMoved` |
| **Același obiectiv, altă stare** (near → arrived) | doar restilizare |
| **Obiectivul devine `null`** | nicio mișcare |
| **„Centrează pe mine”** | **o singură** centrare pe jucător: păstrează zoom-ul dacă ≥ 15, altfel 17. Nu pornește urmărire continuă *(D-049-G)*. Dezactivat dacă nu există fix afișabil |
| **„Vezi obiectivele”** | `fitToAdventure(locații vizibile)` (fără jucător). Dezactivat dacă nu există locații vizibile |
| **Refresh / revenire în joc** | ca la creare. Viewport-ul nu se salvează (D-043) |
| **Rotire / redimensionare** | Leaflet recalculează (`trackResize`); `invalidateSize()` la afișarea unui container ascuns anterior |

`fitToAdventure([])` și `centerOnPlayer()` fără fix întorc `false` și nu mișcă harta.

---

## 6. Pan / zoom manual

- `dragging`, `touchZoom`, `doubleClickZoom`, `keyboard`: activate. `zoomControl`: activat, butoanele +/- mărite la 44 px. `scrollWheelZoom: false` (pe desktop, rotița derulează pagina). `boxZoom: false`. `minZoom: 3`, `maxZoom: 19`. Fără `maxBounds`.
- Harta nu revine niciodată singură după un gest, cu excepția evenimentelor din §5.2 (schimbarea obiectivului, butoanele).
- Derularea paginii pe mobil: harta ocupă ≤ ~40% din înălțime, deci pagina rămâne derulabilă din afara ei. Fără pluginuri „two-finger pan”.

---

## 7. Stările fără GPS (ce vede jucătorul)

Harta există doar pe `screen-play` și doar dacă aventura are **cel puțin o locație** în conținut.

| `locationDisplay` | Marker | Text sub hartă | „Centrează pe mine” |
| --- | --- | --- | --- |
| `gps-off` | — | „Poziția ta nu apare pe hartă: locația nu este activată (butonul „Activează locația” este mai jos).” | dezactivat |
| `gps-unavailable` / `gps-permission-denied` | — | „Poziția ta nu apare pe hartă. Folosește indicațiile obiectivului și „Am ajuns”.” | dezactivat |
| `gps-searching` | — | „Caut poziția…” | dezactivat |
| `gps-error` fără fix reținut | — | „Poziția nu poate fi determinată acum.” | dezactivat |
| `gps-error` cu fix reținut | punct gri (§2.3) | „Ultima poziție primită — GPS-ul nu transmite acum poziția” | activ |
| `gps-uncertain` | punct gol + cerc punctat | „Semnal GPS slab — …” | activ |
| `gps-ready` | punct plin + cerc | „Poziția ta · precizie ~N m” | activ |
| nicio locație vizibilă și niciun fix | **placeholder**, fără Leaflet, fără tile-uri | „Harta apare când ai un obiectiv sau când locația este activă.” | dezactivat |

- Textul de sub hartă **nu** este `aria-live`. Panoul „📍 Locația ta” rămâne sursa anunțurilor GPS.
- Panoul „📍 Locația ta” și cardul „Obiectiv” rămân neschimbate.

---

## 8. Responsive / mobile

Revizuit la 2026-10-01 (D-049-F revizuită — TASK 4 / U1, map-first):

- Poziție: în `screen-play`, harta este **suprafața principală**: imediat după antetul de progres, **înaintea** conținutului misiunii *(D-049-F)*. Formularul de răspuns este în overlay-ul puzzle-ului, nu sub hartă.
- Cardul obiectivului `#objective` (cu „Am ajuns”) este **suprapus peste hartă**, jos. Cardul și containerul hărții (`#map-container`) sunt elemente surori în `#map-stage`; cardul **nu** este copilul containerului Leaflet. Fără hartă (necreată sau eșuată), cardul revine în fluxul normal al paginii.
- Înălțimea hărții este **responsive**, legată de viewport (valorile curente sunt în `src/css/app.css`; valorile pe breakpoint-uri nu sunt fixate în această specificație). Minimum 200 px și criteriul 27 rămân valabile. Pe telefon (< 600 px), harta ocupă toată lățimea ecranului; altfel, lățimea `.container`.
- În timpul overlay-ului puzzle-ului, harta rămâne montată (nu este ascunsă sau distrusă), vizibilă sub overlay și inactivă (nu primește atingeri sau focus).
- Atribuirea OpenStreetMap rămâne permanent vizibilă și **neacoperită de card** (D-046, criteriul 25).
- **Deschis (U1b):** cardul poate acoperi parțial harta, inclusiv obiectivul, pe ecrane mici; încadrarea care ține cont de card nu este decisă (o soluție care ar schimba contractul D-047 cere o decizie separată).
- *Formularea anterioară (înlocuită la 2026-10-01):* „Poziție: în `screen-play`, imediat după cardul `#objective` (cu «Am ajuns»), înaintea formularului de răspuns. Lățime 100% din `.container` (max. 40rem); înălțime `clamp(200px, 40vh, 360px)`; minimum 200 px.” Conturul `#1f3a2e` 2 px și colțurile rotunjite rămân (pe telefon, fără contur lateral).
- „Centrează pe mine” și „Vezi obiectivele” sunt **în afara hărții**, pe un rând sub ea (≥ 48 px), împreună cu textele despre poziție / GPS. Nu acoperă harta, atribuirea sau alte controale.
- Pe hartă stau doar: zoom +/- (sus-stânga), atribuirea (jos-dreapta, permanentă), eticheta obiectivului curent și, la erori, bannerul de tile-uri (sus).
- Harta este ascunsă pe start / încărcare / eroare / final *(D-049-K)*. Se creează la prima nevoie și se distruge la ieșirea din joc.

---

## 9. Accesibilitate

- Container: `role="region"`, `aria-label="Harta aventurii"`, `aria-describedby` → textul de sub hartă. Harta e focalizabilă, iar săgețile mută harta.
- Butoane `<button>` reale, text vizibil, `disabled` + motiv în text.
- Markerii locațiilor sunt focalizabili, cu `aria-label` (§3.2). Markerul jucătorului și cercurile au `aria-hidden`.
- **Harta nu este singura sursă de informație:** numele obiectivului, starea, instrucțiunile de rezervă și „Am ajuns” rămân în cardul obiectivului. Jocul se poate juca integral fără hartă.
- Stările se disting și prin formă, simbol, mărime și text, nu doar prin culoare. Contururi albe pentru lumină puternică. Focus `3px solid #d98e04`.
- `prefers-reduced-motion: reduce` → `zoomAnimation`, `fadeAnimation`, `markerZoomAnimation` false.

---

## 10. Performanță

- `L.map` și `L.tileLayer` se creează **o singură dată**, în `createMap`. Nicio metodă de update nu le recreează.
- `updatePlayer`: obiecte create la primul fix afișabil, apoi doar `setLatLng` / `setRadius` / `setStyle`. Fără fix → obiectele sunt scoase de pe hartă și refolosite ulterior.
- `updateLocations`: diff pe `id`. Se adaugă doar markerii noi, se actualizează doar cei cu `state` / nume / coordonate / „curent” schimbate, se elimină cei dispăruți sau `visible: false`. Același model de două ori → zero operații DOM.
- Fără throttling (≈1 fix/s, operații idempotente).
- `destroy()`: `map.off()`, `map.remove()`, golește referințele. Idempotent. Nu rămân listeneri sau timere.

---

## 11. Erori

| Eroare | Comportament |
| --- | --- |
| **Leaflet lipsă** | `MapError("leaflet_unavailable")` → `app.js` afișează „Harta nu este disponibilă acum. Folosește indicațiile obiectivului și „Am ajuns”.” Jocul = M-003.1 |
| **Tile provider indisponibil / offline** | după `tileErrorThreshold` (3) erori consecutive fără nicio reușită → banner „Fundalul hărții nu se poate încărca (conexiune slabă?). Obiectivele și poziția rămân afișate.” Dispare la primul `tileload`. Fără retry propriu (Leaflet cere tile-uri doar la pan/zoom) |
| **Container invalid** (nu e `HTMLElement`, nu e în document, are deja o hartă) | `MapError("invalid_container")` → panoul hărții se ascunde, jocul continuă |
| **Container ascuns la creare** | harta nu se creează cât timp panoul e ascuns; `invalidateSize()` la afișare |
| **`tileConfig` invalid** (fără `urlTemplate` sau fără `attribution`) | `MapError("invalid_tile_config")` → ca mai sus |
| **Coordonate nedesenabile — jucător** | niciun marker, `console.warn` o dată |
| **Coordonate nedesenabile — locație** | locația este ignorată, celelalte se desenează; `console.warn` o dată per id |
| **Lipsa locațiilor** | aventură fără locații → fără panou de hartă; locații existente dar niciuna vizibilă și fără fix → placeholder |
| **Excepție neașteptată într-o metodă** | `app.js` prinde, loghează, apelează `destroy()` și afișează „Harta nu este disponibilă acum”. Nu se propagă în `render()` |

„Stare tehnică” primește rândul „Hartă” (`status-map`), completat de `app.js` din ciclul de viață: `inactivă | activă | indisponibilă (cod)`.

---

## 12. OpenStreetMap și providerul de tile-uri

Principii (politica OSM recitită pe 2026-09-29):

- **Atribuirea este vizibilă** permanent, în colțul hărții (controlul standard Leaflet, jos-dreapta): „© OpenStreetMap contributors”, cu link spre `https://www.openstreetmap.org/copyright`. Nu se ascunde în spatele unui buton și nu este acoperită de alte elemente.
- **Tile-urile standard sunt folosite doar pentru utilizare interactivă normală:** se cer doar tile-urile zonei pe care jucătorul o privește.
- **Fără prefetch**, fără bulk download, fără stocare offline de tile-uri. **Nu construim niciun mecanism** care descarcă preventiv o zonă (nici la startul aventurii, nici în service worker). Nu mărim `keepBuffer` și nu folosim pluginuri de „edge buffer”.
- **Cache-ul HTTP al browserului respectă headerele providerului.** Nu adăugăm parametri anti-cache în URL, nu setăm `Cache-Control: no-cache`, iar `sw.js` nu interceptează cererile cross-origin (comportament existent).
- **Referer:** browserul îl trimite implicit. Nu setăm `Referrer-Policy` restrictiv și nici `referrerPolicy: "no-referrer"` pe tile layer. User-Agent-ul este al browserului; o pagină web nu îl poate schimba, iar asta este acceptat de politică pentru aplicațiile web.
- URL HTTPS: `https://tile.openstreetmap.org/{z}/{x}/{y}.png`, `maxZoom` 19.
- **Providerul rămâne configurabil:** `DEFAULT_MAP_TILES` în `defaults.js` (`urlTemplate`, `attribution`, `maxZoom`). Schimbarea providerului = altă configurație, fără schimbarea logicii *(D-049-J)*.
- Nu transformăm politica în logică de aplicație. Conformitatea vine din configurație, din comportamentul standard Leaflet și din lipsa oricărui mecanism de descărcare.

Configurația propusă:

```js
export const DEFAULT_MAP_TILES = Object.freeze({
  urlTemplate: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
});

export const DEFAULT_MAP_VIEW = Object.freeze({
  minZoom: 3,
  fitPadding: 48,          // px
  maxFitZoom: 17,          // zoom maxim la încadrările automate
  playerZoom: 17,          // „Centrează pe mine” când zoom-ul curent < 15
  accuracyCircleMax: 1000, // m — limită DOAR de desen (§2.3)
  tileErrorThreshold: 3,   // erori consecutive de tile până la banner
});
```

---

## 13. Deciziile D-049 (formulare finală)

| ID | Decizie | Status |
| --- | --- | --- |
| **D-049-A** | Leaflet **1.9.4** (pin exact), inclus local în `src/vendor/leaflet/` (`leaflet.js` minificat, `leaflet.css`, `LICENSE`), fără CDN. Încărcat cu `<script defer>` înainte de `app.js`, adăugat în `SHELL_FILES`. Versiunea și suma SHA-256 a fișierelor se notează în `03_ARCHITECTURE.md`. Upgrade doar prin decizie nouă | APROBAT |
| **D-049-B** | Stările locațiilor se traduc 1:1 după tabelul §3.1. `discovered` fără sosire fizică → `arrived` | APROBAT |
| **D-049-C** | Calitatea se traduce 1:1 din `LocationDisplay` (§2.1). `gps-uncertain` → **`uncertain`**. `weak` e valid în contract, dar neprodus în V1 (desenat ca `uncertain`) | **APROBAT — `uncertain`** |
| **D-049-C2** | Ultima poziție reținută de `location.js` cu `quality: none` se afișează ca punct gri „ultima poziție”, fără cerc. Comportament de afișare, nu stare GPS | APROBAT |
| **D-049-D** | Raza efectivă vine din motor (`game.getLocation().radiusMeters`, obținută din `geo.js`). `map-model.js` / `map.js` nu aplică valori implicite | **APROBAT — R2** (`effectiveRadius` aditiv în `geo.js`, expus de `game.js` ca `radiusMeters`; §4.1) |
| **D-049-E** | La schimbarea obiectivului: o singură recentrare, chiar dacă utilizatorul făcuse pan. Fix-urile ulterioare actualizează doar markerul (§5.1) | APROBAT |
| **D-049-F** | *Revizuită 2026-10-01 (TASK 4 / U1):* harta este suprafața principală, înaintea conținutului misiunii; cardul obiectivului este suprapus peste hartă (element soră, nu în containerul Leaflet); harta rămâne montată și inactivă sub overlay-ul puzzle-ului; atribuirea OSM neacoperită; înălțime responsive; butoanele sub hartă. U1b (card vs. obiectiv) rămâne deschis. *Anterior:* harta după cardul obiectivului, înălțime `clamp(200px, 40vh, 360px)` | APROBAT (revizuit) |
| **D-049-G** | „Centrează pe mine” = o singură centrare, fără mod de urmărire continuă în V1 | APROBAT |
| **D-049-H** | Locațiile `visible: false` (`locked`, inclusiv cele ascunse) nu se desenează niciodată | APROBAT |
| **D-049-I** | Cercul de acuratețe nu se desenează peste 1000 m. Limită doar de desen, fără efect asupra jocului | APROBAT |
| **D-049-J** | Configurația hărții stă în `defaults.js` (`DEFAULT_MAP_TILES`, `DEFAULT_MAP_VIEW`), nu în `settings` / schemă | APROBAT |
| **D-049-K** | Harta apare doar pe ecranul de joc și doar pentru aventuri cu cel puțin o locație | APROBAT |
| **D-049-L** | Modul separat `map-model.js` (pur, testat cu `node --test`). `leaflet` este injectabil în `createMap` (teste cu Leaflet fals, fără dependențe) | APROBAT |
| **D-049-M** | Testarea hărții cu obiective: automat (Node) + Chromium local cu geolocație emulată și fixture copiat temporar în copia servită (ca `07_TESTING.md` §24.2). Testul pe telefon cu obiective reale se amână: cere conținut cu coordonate reale, în afara M-003.2 | APROBAT |

---

## 14. Fișiere — etapa de implementare (NU acum)

### 14.1 Vor fi create
- `src/js/map.js`
- `src/js/map-model.js`
- `src/vendor/leaflet/leaflet.js`, `src/vendor/leaflet/leaflet.css`, `src/vendor/leaflet/LICENSE` (1.9.4)
- `tests/map-model.test.js`
- `tests/map.test.js` + `tests/helpers/fake-leaflet.js`
- `tests/location-radius.test.js` — `getLocation().radiusMeters` egal cu raza din `geo.js`, cu și fără `radius` în conținut și egal cu `geo.effectiveRadius(...)` (R2); plus un test că `evaluateProximity(...).radiusMeters` folosește aceeași valoare

### 14.2 Vor fi modificate
- `src/index.html` — `<link>` `leaflet.css`, `<script defer>` `leaflet.js`, `#map-panel` (container, text, 2 butoane), rândul „Hartă” în „Stare tehnică”
- `src/css/app.css` — panou, markeri, butoane +/-, banner, reduced-motion
- `src/js/app.js` — datele pentru `buildMapModel`, ciclul de viață al hărții, butoanele, prinderea erorilor
- `src/js/defaults.js` — `DEFAULT_MAP_TILES`, `DEFAULT_MAP_VIEW` (aditiv)
- `src/sw.js` — `SHELL_FILES` + `js/map.js`, `js/map-model.js`, `vendor/leaflet/leaflet.js`, `vendor/leaflet/leaflet.css`; `CACHE_VERSION` `v5` → `v6`
- `src/js/game.js` — **doar** câmpul aditiv `radiusMeters` în `getLocation()` (D-049-D, aprobat)
- `src/js/geo.js` — **doar** exportul aditiv `effectiveRadius(location, gps)`, folosit intern de `evaluateProximity` (D-049-D, R2 aprobat); comportament neschimbat
- Documentație la implementare: `03_ARCHITECTURE.md` (module, Leaflet 1.9.4 + SHA-256, service worker), `11_ADVENTURE_SCHEMA_V2.md` §0 și §5 (tabelul de corespondență a calității), `07_TESTING.md` (§25 nou), `README.md`, `tests/README.md`, acest document (starea implementării). *(Închiderea deciziilor — D-045 confirmată, D-046…D-049 adăugate, D-027 marcată `SUPERSEDED` în `04_DECISIONS_LOG.md` — este deja făcută, înainte de implementare.)*

### 14.3 NU se modifică
- `src/js/location.js`, `events.js`, `schema.js`, `answers.js`, `content.js`, `storage.js`
- `src/js/geo.js`: nimic în afara exportului aditiv `effectiveRadius` (R2)
- orice regulă GPS, algoritmul de proximitate, histerezisul, pragurile din `DEFAULT_SETTINGS.gps`
- schema aventurii, `content/**`, `tests/fixtures/**`
- **testele existente** (doar fișiere de test noi)
- `.github/workflows/deploy-pages.yml` (copiază deja tot `src/`), `package.json` (fără dependențe npm), `index.html` din rădăcină, `manifest.webmanifest`

---

## 15. Criterii de acceptare finale

**Arhitectură și surse de adevăr**
1. `map.js` nu conține `navigator.geolocation`, `reportPosition`, `confirmArrival`, `evaluateProximity`, `distanceMeters`, `assessFix`, `defaultRadius`, `maxAccuracy` și nu importă `game.js` / `geo.js` / `location.js` (verificare automată în sursă).
2. `map-model.js` nu importă `game.js` / `geo.js` / `location.js` și nu conține `defaultRadius`, `maxAccuracy` sau alte praguri GPS (verificare automată).
3. `git diff` pe `location.js`, `events.js`, `schema.js`, conținut, fixture-uri și testele existente este gol. `geo.js` are doar exportul aditiv `effectiveRadius(location, gps)`, folosit intern de `evaluateProximity`, fără schimbare de comportament (R2). `game.js` are doar câmpul aditiv `radiusMeters`.
4. Toate cele 83 de teste existente trec **nemodificate**. Testele noi rulează cu `node --test`, fără dependențe.
5. `leaflet.js` servit are antetul versiunii 1.9.4, iar suma SHA-256 corespunde celei din documentație.

**Calitate și ultima poziție**
6. `map-model.js` produce `quality` exact după tabelul §2.1 pentru fiecare valoare `LocationDisplay` (test parametrizat). `weak` nu este produs.
7. `player.fix` este identic cu `tracker.getState().fix` (inclusiv `null`), pentru toate stările trackerului.
8. Redare: `valid` → punct plin + cerc; `uncertain` / `weak` → punct gol + cerc punctat; `none` + fix → punct gri fără cerc; `none` + `null` → nimic.
9. Fix-uri succesive → același obiect marker (`setLatLng`), zero recreări. Același fix → zero apeluri Leaflet.
10. `accuracy` > 1000 m → fără cerc + text „Precizie foarte slabă”. Cercul de acuratețe nu influențează niciun zoom.

**Rază și locații**
11. `radius` din model = `geo.effectiveRadius(...)` = `evaluateProximity(...).radiusMeters` pentru aceeași locație, cu și fără `radius` în conținut și cu `defaultRadius` suprascris în `settings.gps`.
12. Locațiile `locked` (inclusiv `hiddenUntilDiscovered`) nu apar niciodată pe hartă.
13. `available` / `near` / `arrived` / `completed` / „curent” se disting prin formă sau simbol. Obiectivul curent are eticheta cu numele.
14. Același model de două ori → zero operații DOM. O singură stare schimbată → doar acel marker se actualizează.
15. Cercul obiectivului apare doar pentru obiectivul curent `available` / `near`. Aceeași secvență de fix-uri produce aceleași evenimente de joc cu hartă și fără hartă.

**Viewport (D-049-E, G)**
16. Prima afișare încadrează locațiile vizibile. Primul fix încadrează jucător + obiectiv doar dacă utilizatorul nu a mișcat harta.
17. După un pan manual, 20 de fix-uri noi nu mișcă harta.
18. „Continuă” către alt obiectiv → exact o recentrare (inclusiv după un pan anterior). Următoarele 20 de fix-uri → zero mișcări.
19. „Centrează pe mine” → exact o centrare. Fix-urile următoare nu mișcă harta. Butonul este dezactivat fără fix.

**Stări, erori, recuperare**
20. Cu GPS neactivat, refuzat sau indisponibil: harta arată obiectivele, iar aventura se termină complet cu „Am ajuns”.
21. Cu `leaflet.js` blocat: mesajul „Harta nu este disponibilă acum”. Jocul funcționează identic cu M-003.1, fără erori necapturate.
22. Cu tile-urile blocate: bannerul apare, markerii rămân, iar bannerul dispare când tile-urile revin.
23. Container invalid / `tileConfig` fără atribuire → `MapError` cu codul corect.
24. Aventura demo publică (fără locații): fără panou de hartă și zero cereri către `tile.openstreetmap.org`.

**OSM**
25. Atribuirea cu link este permanent vizibilă și neacoperită, la 360×640 px.
26. Cererile de tile folosesc HTTPS și nu au parametri anti-cache. Paginile nu au `Referrer-Policy` restrictiv. `sw.js` nu interceptează tile-urile. Nu există cod care cere tile-uri în afara zonei vizibile.

**UX, accesibilitate, ciclu de viață**
27. La 360×640 px, „Am ajuns” este vizibil fără să derulezi peste hartă. Harta are ≥ 200 px înălțime. Butoanele au ≥ 48 px și sunt în afara hărții.
28. Markerii locațiilor sunt focalizabili cu `aria-label`. Cu `prefers-reduced-motion` nu există animații. Textul de sub hartă nu este `aria-live`.
29. Reset / final → `destroy()`: 0 listeneri rămași. Reintrarea creează o singură hartă. Un `destroy()` repetat nu produce erori.
30. Offline, după o vizită anterioară: aplicația și Leaflet pornesc din cache (`v6`), harta arată banner pe fundal gri, jocul funcționează. Nicio coordonată nu este salvată în `localStorage`.

---

## 16. Riscuri și neclarități rămase

| # | Subiect | De ce rămâne deschis |
| --- | --- | --- |
| R-1 | ~~D-049-C: `weak` vs `uncertain`~~ | **ÎNCHIS** — aprobat `uncertain` (2026-09-29) |
| R-2 | ~~D-049-D: R1 vs R2~~ | **ÎNCHIS** — aprobat R2 (2026-09-29): export aditiv `effectiveRadius` în `geo.js` + `radiusMeters` aditiv în `game.js` |
| R-3 | Duplicarea preexistentă a razei implicite în `schema.js:227` (validare) | În afara M-003.2. De tratat separat (după R2, validarea ar putea folosi același helper, printr-o decizie separată) |
| R-4 | Conținutul exact al pachetului Leaflet 1.9.4 (fișiere, dimensiune, suma SHA-256) și ordinea `defer` / `module` pe iOS Safari | Nu se poate verifica fără descărcarea Leaflet, interzisă în această etapă. Se verifică la începutul implementării |
| R-5 | ~~Jurnalul deciziilor în urmă~~ | **ÎNCHIS** (2026-09-29) — D-045 `CONFIRMED`; D-046–D-049 adăugate; D-027 `SUPERSEDED` de D-046 |
| R-6 | Harta nu poate fi văzută pe telefon cu obiective reale | Aventura publică nu are locații, iar conținutul nu se modifică în M-003.2 (D-049-M) |
| R-7 | Serviciul OSM standard nu are SLA; utilizarea comercială sau intensivă poate fi restricționată | Acceptat pentru dezvoltare (D-046). Înainte de lansarea comercială, providerul se reevaluează doar prin configurație |

---

## 17. Istoric: modificări între revizia 1 și revizia 2 a propunerii

| Subiect | Revizia 1 | Revizia 2 |
| --- | --- | --- |
| Semantica `uncertain` | propunea `uncertain` = „tracker în eroare cu poziția păstrată” (semantică nouă) | **eliminat.** Calitatea este traducerea 1:1 a `LocationDisplay` existent. `gps-error` → `none`. `gps-uncertain` → `uncertain` (sau `weak`, la alegerea proprietarului). Nicio stare GPS nouă |
| `weak` | = precizie > `maxAccuracy` | nu are sursă în M-003.1 → valid în contract, **neprodus în V1**; neclaritate declarată (R-1) |
| Ultima poziție | amestecată în definiția calității | separată explicit: `player.fix` = ce reține deja `location.js`. Punctul gri este **comportament de afișare** (D-049-C2) |
| Calculul calității | `map-model.js` combina tracker + `assessFix` | `map-model.js` primește `locationDisplay` deja calculat de `describeLocation` și nu mai atinge `assessFix` |
| `radius` | `map-model.js` aplica `?? defaultRadius` (a treia sursă) | **eliminat.** Raza efectivă vine din `game.getLocation().radiusMeters`, obținută din `geo.js` (R1/R2); necesitate de implementare notată, nimic modificat acum |
| D-049-E | recentrare la schimbarea obiectivului, propusă | **fixată** cu diagrama cerută: o singură recentrare, apoi doar markerul |
| D-049-G | „Centrează pe mine” pornea un mod de urmărire | **o singură centrare**, fără urmărire continuă (consecvent cu „fără recentrare la fiecare fix”) |
| OSM | câteva note în §1.2 și în conflicte | secțiune dedicată (§12), aliniată cu politica OSM recitită; fără logică de aplicație |
| Leaflet | 1.9.4 recomandat | **pin exact** 1.9.4 + SHA-256 documentat (D-049-A) |
| Contract | descris sumar | §1.2–§1.5: datele exacte între `app.js`, `map-model.js` și `map.js`, plus ordinea apelurilor |
| Criterii de acceptare | 25 | 30, cu teste pentru sursa unică a razei, maparea calității, D-049-E / G și OSM |
| Fișiere | `game.js` neatins | `game.js` listat ca modificare **aditivă condiționată** (`radiusMeters`); `geo.js` doar cu R2 |

---

---

## 18. Starea documentului

- 2026-09-29 — propunerea D-049 (revizia 1, revizia 2) analizată de proprietar.
- 2026-09-29 — D-049 aprobat: C → `uncertain`, D → R2, restul în forma din §13. D-045 confirmată; D-046…D-049 înregistrate în `04_DECISIONS_LOG.md`; D-027 marcată `SUPERSEDED` de D-046.
- 2026-09-29 — specificația mutată în `docs/` ca document oficial (acest fișier).

- 2026-09-29 — implementarea M-003.2 realizată (necomisă, în review): 128 de teste `node --test` verzi (83 existente, nemodificate + 45 noi), verificare Chromium automată (`07_TESTING.md` §25). Rezultatul pe criterii (§15) este raportat proprietarului pentru review; testul pe telefon cu locații reale rămâne amânat (D-049-M).

- 2026-09-30 — constatat la consolidarea V1.1: implementarea este comisă (`39a6b28`, „feat: implement M-003.2 map”). Statusul rămâne „pending owner review”.

- 2026-09-30 — **owner acceptance:** review-ul manual al proprietarului este finalizat („Am făcut toate testele. Este ok, inclusiv testele din zilele trecute. Funcționează corect toate.”). M-003.2 este **ACCEPTAT** și **ÎNCHIS**. Criteriile de acceptare rămân cele 30 din §15. La închidere, suita completă `node --test` are **132 de teste, toate verzi** — acesta este totalul actual al suitei, care include cele 128 de la implementarea M-003.2 (§18, 2026-09-29) și testele de regresie adăugate ulterior; nu toate sunt teste introduse de M-003.2. Testul pe telefon cu o aventură reală cu locații a fost amânat explicit prin D-049-M și nu este un criteriu ratat.

**M-003.2 este implementat, comis (`39a6b28`), acceptat de proprietar la 30.09.2026 și închis.**
