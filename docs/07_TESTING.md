# OUTDOOR ESCAPE — TESTING PLAN

## 1. Local browser testing

Test:
- Chrome desktop;
- Chrome Android;
- Safari iPhone where available.

## 2. PWA tests

Verify:
- manifest;
- installability where supported;
- service worker registration;
- cache behavior;
- reload behavior;
- update behavior.

## 3. State persistence

Test:
- close browser;
- reopen;
- refresh;
- lose connection;
- return to previous screen.

Progress must not be lost unexpectedly.

## 4. GPS tests

Test:
- inside radius;
- outside radius;
- poor accuracy;
- denied permission;
- location unavailable;
- slow GPS acquisition.

Never leave the user without a recovery path.

## 5. Puzzle tests

For every puzzle:
- correct answer;
- incorrect answer;
- case differences;
- whitespace;
- accidental input;
- hint 1;
- hint 2;
- answer reveal;
- penalty;
- replay/reload.

## 6. Outdoor tests

Test in actual locations:
- daylight;
- evening;
- crowds;
- weather variation where practical;
- mobile network variation;
- battery impact.

## 7. UX tests

Observe a person who has not seen the app before.

Do not explain the interface.

Record:
- where they hesitate;
- what they misunderstand;
- where they look for the next action;
- where they ask for help.

## 8. Beta acceptance

A beta run is successful only if the team can complete the game without operator intervention.

Record:
- total time;
- completion rate;
- hints used;
- answer reveals;
- abandoned locations;
- GPS problems;
- unclear instructions;
- technical errors.

## 9. Critical bug definition

Critical:
- game cannot start;
- progress is permanently lost;
- a location cannot be completed;
- correct answer is rejected;
- player can bypass major paid access controls;
- application crashes repeatedly.

Critical bugs block release.

---

## 10. Proceduri concrete de testare

Secțiunile 1–9 de mai sus definesc *ce* se testează. Secțiunile 10–17 descriu *cum* se testează. Procedurile pentru aplicație se aplică aplicației existente (scheletul PWA — secțiunea 21 — și motorul — secțiunile 22–25 —, plus interfața vertical slice — secțiunea 27); pentru modificările care ating doar documentația se aplică secțiunea 17.

Reguli:

- Un test este raportat ca `PASS`, `FAIL` sau `NETESTAT`. Un test nerulat nu se raportează niciodată ca `PASS`.
- Fiecare rezultat notează commit-ul testat (`git log -1 --oneline`), dispozitivul, sistemul de operare și browserul cu versiunea lor.
- Testele GPS/PWA pe telefon sunt valide doar într-un context sigur (HTTPS sau `localhost`). Vezi `10_LOCAL_DEVELOPMENT.md`, secțiunile 5–6.

## 11. Pregătirea unei sesiuni de test

1. `git status` — se notează dacă există modificări necomise.
2. `git log -1 --oneline` — se notează commit-ul.
3. Se pornește serverul local (`10_LOCAL_DEVELOPMENT.md`, secțiunea 4) sau se folosește adresa HTTPS aleasă.
4. Pentru un test „de la zero”: se șterg datele site-ului (DevTools → Application → Storage → „Clear site data”).
5. Se deschide un raport de test (șablonul din secțiunea 16).

## 12. Desktop — Chrome (browser principal)

### 12.1 Pornire și consolă

1. Deschide `http://localhost:8000/src/` (D-035).
2. DevTools (`F12`) → Console: nu trebuie să existe erori.
3. DevTools → Network: niciun fișier cu status 404.

### 12.2 PWA

1. DevTools → Application → Manifest: manifestul este citit fără erori, iconițele se afișează.
2. Application → Service workers: service worker-ul este „activated and running”.
3. Application → Cache storage: fișierele aplicației și conținutul jocului sunt în cache.
4. Network → „Offline” → reîncarcă pagina: aplicația se deschide din cache.
5. Actualizare: modifică un fișier, reîncarcă și verifică dacă versiunea nouă apare conform strategiei de actualizare stabilite.

Notă: Lighthouse nu mai are o categorie dedicată PWA. Verificarea se face în panoul Application.

### 12.3 Simulare mobil

1. DevTools → Toggle device toolbar (`Ctrl + Shift + M`).
2. Testează cel puțin o lățime mică (de exemplu 360 px) și una medie (de exemplu 412 px), în portret.
3. Verifică: butoanele sunt suficient de mari, următoarea acțiune este vizibilă fără derulare inutilă, textul se citește.

### 12.4 Simulare GPS

DevTools → meniul `⋮` → More tools → Sensors → Location:

| Caz | Cum se simulează | Rezultat așteptat |
| --- | --- | --- |
| În interiorul razei | coordonate egale cu cele ale locației | locația este confirmată |
| În afara razei | coordonate la câteva sute de metri | mesaj clar + cale de continuare |
| Poziție indisponibilă | Location → „Location unavailable” | mesaj clar + cale de continuare |
| Permisiune refuzată | iconița din bara de adrese → Location → Block, apoi reîncărcare | mesaj clar + cale de continuare |
| Achiziție lentă | Network → throttling + observarea stării de așteptare | indicator de așteptare, fără blocare |

Precizia slabă (valoare `accuracy` mare) nu poate fi simulată exact din panoul Sensors. Se testează pe telefon (secțiunea 13) și prin testele automate existente (`npm test`, D-023): `tests/geo.test.js` și `tests/location-integration.test.js` (vezi secțiunea 24.1).

### 12.5 Persistența progresului

1. Avansează în joc până la un puzzle intermediar.
2. Reîncarcă pagina (`F5`) → jocul continuă din același punct.
3. Închide tab-ul, redeschide adresa → jocul continuă din același punct.
4. Închide complet browserul, redeschide → jocul continuă din același punct.
5. „Clear site data” → jocul pornește de la zero (comportament așteptat).

### 12.6 Alte browsere desktop

Firefox și Edge: se repetă 12.1, 12.3 și 12.5. Diferențele se notează; nu sunt blocante dacă Chrome Android și Safari iPhone funcționează.

## 13. Telefon real — Android (Chrome)

Acces: printr-o metodă cu context sigur din `10_LOCAL_DEVELOPMENT.md`, secțiunea 6.

1. Pornire: aplicația se încarcă; dacă e disponibil, se verifică și consola prin `chrome://inspect`.
2. GPS real: la prima cerere, permisiunea este cerută cu un mesaj clar; se testează „Permite” și, separat, „Blochează”.
3. Offline: pornește jocul, activează modul avion, reîncarcă → aplicația și progresul rămân disponibile.
4. Ecran stins: blochează telefonul 1 minut, apoi 10 minute → la revenire, cronometrul arată timpul corect și GPS-ul se reia.
5. Fundal: treci în altă aplicație și înapoi → starea jocului este neschimbată.
6. Închidere accidentală: închide tab-ul/aplicația din lista de aplicații recente → la redeschidere, progresul este păstrat.
7. Instalare: „Adaugă pe ecranul de pornire” → aplicația pornește din iconiță.
8. Rotire ecran: interfața rămâne utilizabilă.
9. Lizibilitate: test la lumină puternică, cu luminozitatea ecranului la nivel mediu.

## 14. Telefon real — iPhone (Safari)

Acces: doar printr-o adresă HTTPS (GitHub Pages sau tunel). Metoda B (USB) nu există pentru iPhone.

Se repetă pașii 1–9 de la secțiunea 13, cu diferențele:

- consola nu este disponibilă fără Mac; erorile se descriu manual (ce ecran, ce acțiune, ce mesaj);
- permisiunea de localizare se resetează din Setări → Confidențialitate și securitate → Servicii de localizare → Safari Websites;
- după „Add to Home Screen”, aplicația instalată are stocare separată de tab-ul Safari; se testează persistența separat în ambele moduri.

## 15. Teste pe teren (Faza 5)

Se aplică procedurile din secțiunile 13–14 la locațiile reale, plus secțiunea 6 de mai sus. Pentru fiecare locație se notează precizia raportată (`accuracyMeters`), distanța calculată și dacă jucătorul a putut continua.

## 16. Șablon de raport de test

```text
Data:
Tester:
Commit testat (git log -1 --oneline):
Adresă testată (localhost / HTTPS / tunel):
Dispozitiv + sistem de operare:
Browser + versiune:
Mod (tab browser / aplicație instalată):

| ID test | Pași | Rezultat așteptat | Rezultat obținut | PASS / FAIL / NETESTAT | Observații |
|---------|------|-------------------|------------------|------------------------|------------|

Probleme critice (conform secțiunii 9):
Alte observații:
```

## 17. Testarea modificărilor de documentație

Documentația se verifică manual (D-023 acoperă doar testele motorului; verificarea automată a linkurilor rămâne nedecisă):

1. Toate linkurile relative din fișierele modificate duc la fișiere existente.
2. Fișierele sunt în UTF-8.
3. Diacriticele sunt cu virgulă (`ș`, `ț`), nu cu sedilă (`ş`, `ţ`).
4. Numerele deciziilor (`D-xxx`) menționate în documente există în `04_DECISIONS_LOG.md`.
5. `git diff` conține doar modificările intenționate.

## 18. Verificarea publicării pe GitHub Pages (după ce există workflow-ul — D-020)

1. După push pe `main`, tab-ul „Actions” din GitHub arată rularea workflow-ului de publicare ca reușită.
2. Adresa GitHub Pages se deschide prin HTTPS și afișează versiunea din commit-ul publicat.
3. Aplicația se deschide la `https://rezervari.github.io/outdoor-escape/src/`, iar fișierele de conținut se încarcă de la `.../outdoor-escape/content/...` (fără 404 în DevTools → Network; D-035).
4. Nicio cerere nu merge spre `https://rezervari.github.io/` în afara lui `/outdoor-escape/` (semn al unei căi absolute greșite).
5. `docs/` și `tests/` nu sunt accesibile pe site (workflow-ul publică doar aplicația).
6. Service worker-ul se actualizează la noua versiune (secțiunea 12.2, pasul 5).
7. DevTools → Application: cheile din Local Storage și numele din Cache Storage au prefixul `outdoor-escape:` (D-035).

## 19. Validarea răspunsurilor (D-021)

Pe lângă cazurile din secțiunea 5:

1. Răspunsul corect este acceptat și în modul offline (validarea MVP este locală).
2. Motorul obține rezultatul doar prin modulul de validare. Se verifică prin citirea codului la review.
3. Dacă răspunsurile sunt stocate ca hash: răspunsul corect scris cu variațiile permise de normalizare (D-024) produce același rezultat ca forma de referință.
4. Nicio documentație sau interfață nu prezintă hash-ul ca protecție reală a răspunsurilor.

## 20. Redirecționarea din rădăcină (D-036 — după implementare)

Se execută atât local (`http://localhost:8000/`), cât și în producție (`https://rezervari.github.io/outdoor-escape/`), cu aceleași rezultate așteptate.

| ID | Pași | Rezultat așteptat |
| --- | --- | --- |
| R1 | Deschide adresa rădăcinii | Ajunge automat la `.../src/` (local: `http://localhost:8000/src/`; producție: `https://rezervari.github.io/outdoor-escape/src/`) |
| R2 | Deschide rădăcina cu `?test=1#abc` | Ajunge la `.../src/?test=1#abc` (query și hash păstrate) |
| R3 | Pornind de la o altă pagină, deschide rădăcina, apoi apasă „Back” | Browserul revine la pagina anterioară, nu la pagina de redirecționare (și nu intră într-o buclă) |
| R4 | Dezactivează JavaScript (DevTools → Settings → Debugger → Disable JavaScript), deschide rădăcina | `meta refresh` duce la `.../src/` |
| R5 | Verifică linkul vizibil de pe pagina rădăcinii (în pagină sau în DevTools → Elements) și deschide-l | Linkul există și duce la `.../src/` |
| R6 | DevTools → Application pe pagina rădăcinii | Fără manifest, fără service worker înregistrat de această pagină |
| R7 | DevTools → Network la deschiderea rădăcinii | Nicio cerere spre `https://rezervari.github.io/` în afara lui `/outdoor-escape/` |
| R8 | Compară R1–R7 local și în producție | Comportament echivalent |

Notă: `meta refresh` și linkul sunt statice, deci fără JavaScript nu pot păstra query-ul și hash-ul. Comportamentul implementat: fără JavaScript, rădăcina duce la `.../src/` **fără** query și hash (R4). R2 se testează doar cu JavaScript activ.

## 21. Scheletul PWA (fundația tehnică)

Notă: F1, F5 și F8 descriu scheletul inițial (ecranul „fundație tehnică”, cache `v1`). Pentru versiunea actuală, rezultatele așteptate sunt cele din secțiunile 22 și 23; celelalte verificări (manifest, scope, context nesigur, rădăcină, F11) rămân valabile.

Se execută local (`http://localhost:8000/src/`) și, după publicare, în producție (`https://rezervari.github.io/outdoor-escape/src/`). Înainte: „Clear site data” (secțiunea 11).

| ID | Pași | Rezultat așteptat |
| --- | --- | --- |
| F1 | Deschide `src/` | Ecranul „Fundație tehnică / skeleton”; „JavaScript: încărcat” |
| F2 | DevTools → Console și Network | Fără erori, fără 404, nicio cerere în afara bazei (`/` local, `/outdoor-escape/` în producție) |
| F3 | Application → Manifest | Manifest citit fără erori; Start URL și Scope = `.../src/`; Computed App Id = `.../src/`. Avertismentul despre iconuri lipsă este **așteptat** (nu există încă iconuri reale) |
| F4 | Application → Service workers | `sw.js` din `.../src/`, scope `.../src/`, „activated and running”; pe ecran: „Service worker: înregistrat” |
| F5 | Application → Cache storage | Un singur cache al proiectului, `outdoor-escape:shell:v1`, cu exact: `src/`, `index.html`, `manifest.webmanifest`, `css/app.css`, `js/app.js`. Nimic din `content/` |
| F6 | Network → „Offline”, reîncarcă `src/` și `src/?test=1#abc` | Ecranul fundației se deschide din cache |
| F7 | Offline, deschide rădăcina | Poate eșua. Este **așteptat**: rădăcina nu este controlată de service worker (D-036) |
| F8 | Mărește `CACHE_VERSION` în `sw.js` (de ex. `v2`), reîncarcă | Cache-ul `outdoor-escape:shell:v1` dispare, apare `...:v2`. Revino la `v1` după test |
| F9 | Deschide `http://192.168.x.x:8000/src/` de pe alt dispozitiv (context nesigur) | Pagina se afișează; „Service worker: indisponibil (context nesigur...)”; fără erori blocante |
| F10 | Pe pagina rădăcinii, DevTools → Application | Fără manifest; niciun service worker cu scope în rădăcină |
| F11 | După push pe `main` (secțiunea 18) | Pe site există `index.html`, `src/`, `content/`; `.../outdoor-escape/docs/` și `.../outdoor-escape/tests/` dau 404 |

Limitări cunoscute ale fundației:
- aplicația nu este instalabilă până nu există iconuri reale (F3);
- offline este disponibil doar ecranul fundației, după o primă vizită online.

## 22. Motorul de joc v1 (aventura demo)

### 22.1 Teste automate (fără browser)

Din rădăcina repository-ului: `npm test` (sau `node --test`). Node.js 20+. Rezultat așteptat: toate testele `pass`, `fail 0`. Ce acoperă: `tests/README.md` (inclusiv testele fundației V2 — secțiunea 23).

### 22.2 Teste manuale în browser

Se execută la `http://localhost:8000/src/` și, după publicare, la `https://rezervari.github.io/outdoor-escape/src/`. Înainte: „Clear site data” (secțiunea 11).

| ID | Pași | Rezultat așteptat |
| --- | --- | --- |
| G1 | Deschide `src/` | Ecranul de start: „Outdoor Escape”, titlul aventurii [DEMO], descriere, oraș, durată, dificultate, număr de provocări, „Începe aventura” |
| G2 | Console și Network | Fără erori, fără 404; JSON-ul se încarcă de la `.../content/adventures/brasov-centrul-vechi.json` |
| G3 | „Începe aventura” | „Provocarea 1 din 3”, scor 0, câmp de răspuns, „Verifică răspunsul”, „Arată indiciul” |
| G4 | „Verifică răspunsul” cu câmpul gol | Mesaj „Scrie un răspuns…”; nu se trece mai departe |
| G5 | Răspuns greșit (ex. `Cluj`) | „Răspuns incorect…”; scorul nu se schimbă; nu apare „Continuă” |
| G6 | „Arată indiciul”, apoi „Renunță”; din nou „Arată indiciul”, apoi confirmarea „Arată indiciul” | Primul clic afișează doar confirmarea (deschiderea este ireversibilă); „Renunță” o închide fără să deschidă indiciul (Local Storage: `hintsUsed` neschimbat). După confirmare apare textul indiciului; butonul dispare (era ultimul indiciu); scorul nu se schimbă (D-030) |
| G7 | Răspuns corect cu variații (`  BRAȘOV `, `brasov`, `Braşov` cu sedilă) | „Corect! +100 puncte”; scorul crește; apare „Continuă” |
| G8 | F5 după G7, înainte de „Continuă” | Aceeași provocare, marcată corectă, cu „Continuă” |
| G9 | „Continuă”, răspuns trimis cu Enter | Provocarea 2; Enter trimite răspunsul |
| G10 | F5 la provocarea 3 | Progresul și scorul sunt păstrate. Application → Local Storage: cheia `outdoor-escape:game:brasov-centrul-vechi` |
| G11 | „Începe de la capăt” → „Nu”, apoi → „Da, șterge progresul” | „Nu” păstrează jocul; „Da” duce la ecranul de start și șterge cheia din Local Storage |
| G12 | „Sari peste (0 puncte)” la o provocare, apoi F5 înainte și după „Continuă” | Mesaj „Ai sărit…”; scorul nu crește; apare „Continuă”. După F5, provocarea rămâne sărită (Local Storage: `"status":"skipped"`); provocarea nu se numără la „rezolvate” la final |
| G13 | Termină aventura | Ecran final: „Felicitări…”, titlul aventurii, scorul „X din 350 puncte”, „Provocări rezolvate: N din 3”, „Indicii folosite: N”, „Joacă din nou” |
| G14 | F5 pe ecranul final, apoi „Joacă din nou” | Rezultatul rămâne după F5; „Joacă din nou” duce la start și șterge progresul |
| G15 | `src/?adventure=inexistenta` | Ecran „Aventura nu a putut fi încărcată” + „Încearcă din nou”; fără excepții în consolă |
| G16 | Application → Cache storage | Un singur cache shell al proiectului, `outdoor-escape:shell:<CACHE_VERSION>` (valoarea din `src/sw.js`), care conține exact intrările din `SHELL_FILES` din `src/sw.js` — nici mai multe, nici mai puține; niciun cache `outdoor-escape:shell:` cu altă versiune (la momentul actual: `v7`, 21 de intrări: 20 din `src/` + `content/adventures/brasov-centrul-vechi.json`) |
| G17 | După o primă încărcare online: Network → „Offline”, F5 (pe ecranul de start și în timpul jocului) | Aplicația și aventura demo se încarcă din cache; progresul este păstrat; răspunsurile se verifică și offline |
| G19 | `src/?adventure=inexistenta` cu Network → „Offline” | Ecranul de eroare („Verifică conexiunea…”) + „Încearcă din nou” — doar aventura demo este în cache |
| G18 | Simulare mobil 360 px (secțiunea 12.3) | Fără derulare orizontală; butoanele principale pe toată lățimea, cel puțin 48 px înălțime |

Note:
- Secțiunea 21 (F5) descrie cache-ul fundației (`v1`, 5 fișiere). Începând cu motorul v1, rezultatul așteptat este cel din G16.
- Starea `failed` nu poate fi produsă din interfață în această etapă; este acoperită de testele automate (`tests/game.test.js`).
- Workflow-ul (`.github/workflows/deploy-pages.yml`) publică doar `index.html`, `src/` și `content/` (asamblează `_site/` și eșuează dacă apar `docs/`, `tests/` sau `.github/`). F11 se aplică: `.../outdoor-escape/docs/`, `.../outdoor-escape/tests/` și `.../outdoor-escape/tests/fixtures/adventure-v2-demo.json` trebuie să dea 404.

## 23. Fundația V2 (schema, locații, evenimente, progres)

Interfața pentru noile mecanici V2 este parțială. Au interfață: GPS-ul din browser (M-003.1, secțiunea 24), harta (M-003.2, secțiunea 25), misiunile de locație cu „Am ajuns” și interfața vertical slice-ului (TASK 4, secțiunea 27). Nu au încă interfață: audio, naratorul și misiunile bonus / secret / partener / cu timp. Se testează:

### 23.1 Automat — `npm test`

| Fișier | Acoperă |
| --- | --- |
| `tests/schema.test.js` | validarea V2 (fixture-ul valid, structuri invalide, **referințe invalide**), câmpuri necunoscute permise, vocabularul de tipuri/evenimente, conversia V1 → V2, normalizarea, valorile implicite centrale, încărcarea unei aventuri V2 |
| `tests/geo.test.js` | distanța dintre coordonate, raza, toleranța din precizie, „uncertain” la precizie slabă, near / arrival / leave, **exit margin** (fără oscilații), setări per aventură |
| `tests/events.test.js` | filtrele `where`, `once`, acțiuni aplicate în ordine, evenimente duplicate, **limitarea lanțurilor**, bucle oprite, plafonul absolut |
| `tests/progress-v2.test.js` | forma progresului V2, GPS prin motor, confirmare manuală, sosiri repetate fără efecte duble, acțiuni (deblocări, mesaje, partener, puncte), trasee separate main/bonus/secret, final complet, salvare/restaurare fără re-declanșare, reparare, **migrarea progresului V1**, lipsa logicii specifice unei aventuri în motor |

Aventura folosită: `tests/fixtures/adventure-v2-demo.json` (fictivă, coordonate lângă 0°, 0°).

### 23.2 Manual în browser (regresie + migrare)

| ID | Pași | Rezultat așteptat |
| --- | --- | --- |
| V1 | Testele G1–G19 (secțiunea 22) | Neschimbate față de versiunea anterioară (aventura demo V1 este convertită la încărcare) |
| V2 | Cu progres salvat de versiunea anterioară: DevTools → Application → Local Storage → cheia `outdoor-escape:game:brasov-centrul-vechi` cu o valoare `schemaVersion: 1` (de ex. `{"schemaVersion":1,"adventureId":"brasov-centrul-vechi","status":"playing","currentIndex":1,"score":100,"challenges":{"challenge-01":{"status":"solved","attempts":1,"hintUsed":true},"challenge-02":{"status":"pending","attempts":2,"hintUsed":true},"challenge-03":{"status":"pending","attempts":0,"hintUsed":false}},"startedAt":1790000000000,"completedAt":null}`), apoi F5 | Jocul continuă la „Provocarea 2 din 3”, scor 100, indiciul provocării 2 vizibil. După următoarea acțiune, cheia conține `"schemaVersion":2` și `currentMissionId` |
| V3 | După publicare, deschide `.../outdoor-escape/tests/fixtures/adventure-v2-demo.json` | 404 (fixture-ul nu este publicat) |

## 24. M-003.1 — GPS real din browser (Location Adapter)

Fluxul testat: `navigator.geolocation.watchPosition` → `src/js/location.js` → `game.reportPosition(fix)` → `geo.js` (zone, histerezis) → `events.js` → progres → interfață. Ținta M-003.1: **aplicația deschisă și activă pe telefon** (fără fundal).

### 24.1 Automat — `npm test` (Node, fără browser)

| Fișier | Acoperă |
| --- | --- |
| `tests/location.test.js` | mock minimal `navigator.geolocation` (`tests/helpers/mock-geolocation.js`): API indisponibil (fără `navigator` / fără `geolocation` / context nesigur), `watchPosition` reușit + opțiuni configurabile, `stop` + cleanup (callback-uri întârziate ignorate), `start` duplicat (un singur watcher), permisiune refuzată (inclusiv raportată sincron), erori generice (indisponibil / timeout / necunoscut) + retry fără dubluri, eroare în consumator, metode folosite detașat, `GeolocationPosition` → `{ lat, lng, accuracy, timestamp }`, stările afișate (`describeLocation` + `geo.assessFix`) |
| `tests/location-integration.test.js` | fixture-ul fictiv V2: outside → near → arrived până în reguli (`player_near_location`, `player_arrived`), misiune `location` rezolvată, scor; fix-uri înainte de start (neraportate); poziții duplicate (fără schimbări de stare); plecare + revenire (fără sosire/puncte duble); precizie slabă → `uncertain` → apoi sosire; fallback manual (GPS nesigur, refuzat, indisponibil) prin `confirmArrival`; oprirea urmăririi |
| `tests/geo.test.js` | în plus: `assessFix` folosește exact regula de precizie din `evaluateProximity` |

### 24.2 Browser automat (Chromium headless, geolocație emulată — verificare locală, nu face parte din `npm test`)

Făcut pe o copie locală servită prin HTTP (`localhost`), cu fixture-ul copiat temporar ca `content/adventures/demo-ceasul-oprit.json` **doar în copia servită** (nu în repository, nu publicat). Scriptul nu este în repository (fără dependențe noi).

| ID | Verificare |
| --- | --- |
| L1 | Pornire: panoul „📍 Locația ta” afișează „Locația nu este activată.”, explicația și „Activează locația”; niciun watcher înainte de click |
| L2 | Click → „GPS activ”, „Precizie ~12 m”; exact un watcher |
| L3 | Precizie 150 m → „⚠️ Semnal GPS slab” (pragul vine din `geo.assessFix`) |
| L4 | „Oprește locația” → `clearWatch`, 0 watchers; repornire + click repetat → tot 1 watcher |
| L5 | Aventura publică (V1, fără locații): fix-uri în joc fără erori; mesajul „fără obiective GPS” |
| L6 | Fixture V2: card „Obiectiv”, formular de răspuns ascuns la misiunea `location`; outside → „Ești aproape” → „Ai ajuns la obiectiv! +50”; în progres: `arrivalSource: "gps"`, regulile `ev-aproape-piata`, `ev-sosire-piata`, misiunea `solved` |
| L7 | În obiectiv cu precizie 250 m → nicio sosire, notă „GPS-ul nu poate confirma…”; precizie 10 m → sosire GPS |
| L8 | Permisiune refuzată → „Accesul la locație a fost refuzat.” + „Reîncearcă”; „Am ajuns” → `arrivalSource: "manual"`, aceleași reguli și aceeași rezolvare |
| L9 | API absent → „Acest browser nu oferă acces la locație.” |
| L10 | Timeout simulat → eroare + „Reîncearcă”; o poziție ulterioară → „GPS activ” |
| L11 | Refresh în joc → progresul se restaurează; urmărirea **nu** pornește singură |

Notă (2026-10-02, indicatorul GPS / HUD — D-049-F amendată): verificările de mai sus descriu panoul „📍 Locația ta” la M-003.1. Etichetele butoanelor depind acum de context: pe ecranul de start și fără hartă, panoul afișează „Activează locația” / „Reîncearcă”; în joc, cât timp harta (și HUD-ul de peste ea) este afișată, butoanele din panou sunt ascunse, iar butonul vizibil este în HUD: „Activează” (`gps-off`) sau „Încearcă din nou” (`gps-permission-denied`, `gps-error`); precizia apare în HUD ca „±N m”. Contractul HUD-ului este acoperit de `tests/gps-hud.test.js`.

### 24.3 Manual pe telefon — `https://rezervari.github.io/outdoor-escape/src/` (după publicare)

| ID | Pași | Rezultat așteptat |
| --- | --- | --- |
| P1 | Deschide aplicația | Panoul „📍 Locația ta”: „Locația nu este activată.” + explicația + „Activează locația” |
| P2 | Apasă „Activează locația” | Browserul poate cere permisiunea (nu întotdeauna — dacă a fost deja acordată/refuzată, nu mai apare); apoi „Caut poziția…” |
| P3 | Așteaptă afară | „GPS activ” + „Precizie ~N m” |
| P4 | Intră într-o clădire / între blocuri | Precizia crește; peste 60 m → „⚠️ Semnal GPS slab” |
| P5 | „Oprește locația”, apoi „Activează locația” din nou | Starea revine corect; „Stare tehnică → Geolocație” arată un singur `watchPosition activ` |
| P6 | Refuză permisiunea (setările site-ului), „Reîncearcă” | „Accesul la locație a fost refuzat.”; jocul continuă normal |
| P7 | Începe aventura | Fără erori; aventura publică nu are locații, deci nu apare niciun obiectiv (GPS doar informativ) |

**Limită cunoscută:** pașii „obiectiv de test → near → arrived → evenimente → gameplay” **nu pot fi făcuți pe telefon** cu aventura publică (V1, fără locații), iar aventura publică nu se modifică pentru test. Sunt acoperiți de 24.1 (Node) și 24.2 (Chromium cu geolocație emulată). Testul real pe teren cere o aventură cu coordonate reale (Faza 5).

### 24.4 Fundal, ecran blocat, tab suspendat — ce NU este garantat

| Situație | Comportament real |
| --- | --- |
| Pagina deschisă, activă, ecran aprins | `watchPosition` livrează poziții la intervale decise de browser/sistem (nu fix); fiecare este evaluată |
| Tab schimbat / browser în fundal | Browserele mobile (Safari iOS, Chrome Android) opresc sau rarefiază pozițiile și pot suspenda JavaScript-ul; nicio sosire nu este detectată cât timp pagina nu rulează |
| Telefon blocat | Fără poziții (iOS: garantat oprit; Android: de regulă oprit/suspendat) |
| Revenire în aplicație | Urmărirea continuă (dacă pagina nu a fost descărcată din memorie); prima poziție nouă este evaluată normal; dacă jucătorul a trecut deja prin zonă în fundal, sosirea se confirmă când revine în rază sau cu „Am ajuns” |
| Pagina descărcată / reîncărcată | Progresul se restaurează; urmărirea trebuie reactivată cu „Activează locația” (fără pornire automată). La plecarea de pe pagină (`pagehide`) urmărirea se oprește; la revenirea din bfcache se reia dacă era activă |

Nu există geofencing în fundal și nici notificări: un browser/PWA nu le garantează. „Am ajuns” rămâne mereu calea de rezervă (când aventura o permite).

## 25. M-003.2 — Harta (Leaflet + OpenStreetMap)

Specificația și criteriile de acceptare: [`12_MAP_SPECIFICATION_M-003.2.md`](12_MAP_SPECIFICATION_M-003.2.md), §15. Harta este doar afișare: GPS-ul, sosirea și progresul rămân în `location.js` / `geo.js` / `game.js` (secțiunea 24).

### 25.1 Automat — `npm test` (Node, fără browser, fără rețea)

| Fișier | Acoperă |
| --- | --- |
| `tests/map-model.test.js` | forma modelului D-048; calitatea (`gps-ready` → `valid`, `gps-uncertain` → `uncertain`, restul → `none`; `weak` neprodus); stările locațiilor (D-049-B; `locked` → `visible: false`); `currentObjectiveId`; raza copiată de la motor; lipsa fix-ului; ultima poziție cu `none`; fără distanțe / câmpuri GPS; verificare în sursă (fără importuri, fără praguri GPS); integrare cu `game.getLocation` pe fixture |
| `tests/map.test.js` | `map.js` cu Leaflet fals injectat (`tests/helpers/fake-leaflet.js`): creare (OSM HTTPS + atribuire, rotița dezactivată), `MapError` (`leaflet_unavailable`, `invalid_container`, `invalid_tile_config`), jucător (valid / uncertain / weak / none, cerc de acuratețe, limita de 1000 m, coordonate invalide), locații (doar vizibile, stări distincte, `aria-label`, obiectiv curent, escapare HTML), cercul obiectivului, viewport (prima afișare, primul fix, pan manual + 20 de fix-uri, schimbarea obiectivului = o recentrare, „Centrează pe mine” = o centrare, „Vezi obiectivele”), banner tile-uri, `destroy`, zero apeluri pentru același model, verificare în sursă, versiunea 1.9.4 și SHA-256 din `03_ARCHITECTURE.md` |
| `tests/location-radius.test.js` | `geo.effectiveRadius` = raza din `evaluateProximity` = `game.getLocation().radiusMeters` (D-049-D / R2), cu și fără `radius` în conținut |

### 25.2 Browser automat (Chromium headless, geolocație emulată — verificare locală, nu face parte din `npm test`)

Ca la 24.2: copie locală servită prin HTTP (`localhost`), cu fixture-ul copiat temporar ca `content/adventures/demo-ceasul-oprit.json` **doar în copia servită**. Tile-urile `tile.openstreetmap.org` sunt interceptate de script și servite local (niciun trafic către OSM în timpul testelor). Scriptul nu este în repository (fără dependențe noi). Viewport-uri: desktop 1280×800 și mobil 360×640.

| ID | Verificare |
| --- | --- |
| H1 | Aventura publică (V1, fără locații), desktop + mobil: fără panou de hartă, zero cereri de tile, nicio hartă Leaflet creată; GPS-ul M-003.1 funcționează |
| H2 | Fixture: fără hartă pe ecranul de start; în joc, o singură hartă; doar locația vizibilă apare (locked și ascunsă nu); obiectivul curent evidențiat + etichetă; cercul razei; prima afișare = o mișcare; atribuire OSM vizibilă; marker focalizabil cu `aria-label`; cereri de tile HTTPS, fără parametri, cu Referer |
| H3 | „Activează locația”: marker jucător + cerc de acuratețe; primul fix = exact o mișcare (jucător + obiectiv); stare „near” venită din motor |
| H4 | 20 de fix-uri → 0 mișcări; pan manual + 20 de fix-uri → 0 mișcări, centrul neschimbat; zoom manual păstrat |
| H5 | Precizie 1500 m → fără cerc, text „precizie foarte slabă”, punct gol; 150 m → cerc punctat |
| H6 | „Centrează pe mine” = exact o mișcare; fix-urile următoare → 0 mișcări (fără follow) |
| H7 | Sosire GPS decisă de motor (`arrivalSource: "gps"`, regulile `ev-aproape-piata`, `ev-sosire-piata`); cercul obiectivului dispare; misiune nouă cu același obiectiv → 0 mișcări; schimbarea obiectivului → exact o recentrare; apoi 20 de fix-uri → 0 mișcări; „Am ajuns” funcționează; nicio coordonată în `localStorage` |
| H8 | Reset → harta distrusă; reintrare → o singură hartă |
| H9 | Mobil 360×640: „Am ajuns” vizibil fără derulare (în cardul obiectivului suprapus peste hartă — D-049-F revizuită la 2026-10-01; anterior: deasupra hărții); hartă ≥ 200 px, fără scroll orizontal; butoane ≥ 48 px, sub hartă; atribuire neacoperită; zoom +/- ≥ 44 px |
| H10 | `prefers-reduced-motion`: animațiile Leaflet dezactivate |
| H11 | Tile-uri indisponibile: banner, markerii rămân, GPS-ul nu raportează eroare; bannerul dispare când tile-urile revin |
| H12 | `leaflet.js` blocat: „Harta nu este disponibilă acum”, fără erori necapturate, sosirea GPS funcționează; progresul și regulile rulate sunt identice cu rularea cu hartă |
| H13 | Permisiune refuzată: mesajul M-003.1, harta arată obiectivele fără jucător, „Am ajuns” rezolvă misiunea |
| H14 | Service worker (`CACHE_VERSION` curent din `src/sw.js` — `v7` la 2026-10-01; la M-003.2: `v6`): cache-ul conține `map.js`, `map-model.js`, Leaflet; niciun tile în cache; offline după o vizită: aplicația și Leaflet pornesc din cache; offline în timpul jocului: banner, jocul continuă |

### 25.3 Manual pe telefon

Nu se poate face încă cu obiective: aventura publică nu are locații (D-049-M). Pe aventura publică se verifică doar că harta **nu** apare și că M-003.1 funcționează ca înainte (24.3). Testul pe teren cere o aventură cu coordonate reale.

## 26. Platform V1.1 — scenarii de testat (arhitectură decisă, neimplementată)

Nu există încă funcționalități V1.1 de testat. Scenariile limită care vor deveni teste la implementare (acces, continuitate, echipă, conectivitate, GPS, conținut, joc) sunt în [`14_EDGE_CASES.md`](14_EDGE_CASES.md); cele de sincronizare în [`15_SESSION_SYNC.md`](15_SESSION_SYNC.md) §13. Pentru fiecare funcționalitate se testează calea normală și calea de eșec / recuperare.

Regresia existentă rămâne `npm test` (132 de teste verzi la 2026-09-30, înainte de orice implementare V1.1; 221 la 2026-10-01, după vertical slice-ul TASK 4 — secțiunea 27).

## 27. TASK 4 — Vertical slice UI (hartă, puzzle, indicii, rezultat, Back)

Aventura fictivă `content/adventures/demo-vertical-slice.json` (`src/?adventure=demo-vertical-slice`): 2 locații lângă 0°, 0°, 4 misiuni (sosire → puzzle cu 2 indicii → sosire → puzzle cu 1 indiciu), scor maxim 350. Coordonatele nu pot fi atinse fizic: sosirea se confirmă cu „Am ajuns” (sau cu geolocație emulată, secțiunea 12.4). Deciziile: D-030 (extinderea din 2026-10-01), D-035 (precizarea U2), D-049-F (revizuită).

### 27.1 Automat — `npm test`

| Fișier | Acoperă |
| --- | --- |
| `tests/view-model.test.js` | demo-ul (valid, fictiv, parcurgere completă); modelul interfeței: înainte / după sosire, puzzle, indicii (D-030), rezolvare, locația 2, final, V1, fără răspunsuri, puritate |
| `tests/app-view-model-integration.test.js` | modulele încărcate de `app.js` sunt toate în `SHELL_FILES`; echivalența condițiilor de afișare cu regulile anterioare pe 4 aventuri |
| `tests/play-layout.test.js` | structura ecranului: hartă înaintea misiunii, card peste hartă (nu în containerul Leaflet), overlay-ul puzzle-ului, indiciile și confirmarea în panou, `inert`, răspunsuri absente din HTML, handler-ele care apelează motorul |
| `tests/play-ui.test.js` | panoul puzzle-ului (overlay / în pagină), închidere și redeschidere, indicii și confirmare (consum doar la confirmare, epuizare, reîncărcare), V1 |
| `tests/result-screen.test.js` | finalizarea (`completed`) și rezultatul derivat din motor, 350/350 și cu indicii, reîncărcare după final, restart cu `game.reset()`, V1 |
| `tests/back-u2.test.js` | Back (U2) pe un istoric simulat: confirmare → overlay → navigarea normală, URL neschimbat, starea jocului neschimbată, redeschidere, reîncărcare (inclusiv cu confirmarea deschisă), butoane / Escape, „Continuă” și final, Forward, V1 |

### 27.2 Manual în browser

Verificat la 2026-10-01 într-un browser Chromium pe desktop (server local `127.0.0.1`), la 360×640 și 1280×800, cu butonul Back al browserului. Pe telefon real Android (inclusiv Back fizic): Field Test 1, secțiunea 27.3 — PASS. **Netestat încă:** iPhone (gest swipe-back iOS) și instalarea service worker-ului `v7` (browserul de pe desktop nu permite service workers; în Field Test 1 starea service worker-ului nu a fost consemnată).

| ID | Pași | Rezultat așteptat |
| --- | --- | --- |
| VS1 | „Începe aventura” pe demo | Harta ocupă ecranul sub antet; cardul „[DEMO] Punctul A” peste hartă, cu „Am ajuns” vizibil fără derulare; atribuirea OSM vizibilă |
| VS2 | „Am ajuns” | Cardul arată sosirea; scorul crește; apare „Deschide provocarea”; harta rămâne |
| VS3 | „Deschide provocarea” | Overlay peste hartă: locația, titlul, întrebarea, formularul, „Închide”; harta dedesubt nu reacționează la atingeri |
| VS4 | Răspuns greșit | Feedback „incorect”; puzzle-ul rămâne activ, overlay-ul deschis |
| VS5 | „Arată indiciul” → „Renunță”; apoi Escape pe confirmare | Confirmarea se închide de fiecare dată fără consum (`hintsUsed` neschimbat); puzzle-ul rămâne deschis |
| VS6 | „Arată indiciul” → confirmare, de două ori (puzzle 1) | Indiciile 1 și 2 apar pe rând și rămân vizibile; după al doilea, butonul dispare; formularul rămâne |
| VS7 | Răspuns corect | „Corect!”, fără penalizare pentru indicii; „Continuă” în overlay |
| VS8 | „Continuă” → „Am ajuns” → puzzle 2 → răspuns corect → „Vezi rezultatul” | Ecranul de rezultat: titlul aventurii, 350 din 350, 4 din 4, indiciile folosite; niciun overlay, card sau formular rămas; pagina se derulează normal |
| VS9 | F5 cu puzzle-ul activ (și un indiciu deschis); F5 pe rezultat | Overlay-ul revine cu indiciul deschis și același număr disponibil; rezultatul rămâne identic |
| VS10 | „Joacă din nou” | Ecranul de start; progresul șters; după start, din nou Punctul A |
| VS11 | Back cu confirmarea indiciului deschisă | Se închide doar confirmarea; puzzle-ul rămâne; `hintsUsed` neschimbat; URL neschimbat |
| VS12 | Back cu overlay-ul deschis | Overlay-ul se închide; harta activă; puzzle-ul rămâne activ (se poate redeschide); scor și misiune neschimbate; URL neschimbat |
| VS13 | Back fără overlay / confirmare deschisă | Navigarea normală a browserului (pagina anterioară), dintr-un singur Back |
| VS14 | V1 (`src/`): „Arată indiciul”, apoi Back | Confirmarea (în pagină) se închide fără consum; fluxul V1 continuă normal (secțiunea 22.2) |

### 27.3 Telefon real — Field Test 1 (Android)

Raport în formatul secțiunii 16. Pașii sunt identificați `FT1-F0` … `FT1-F21` (prefixul `FT1-` evită confuzia cu ID-urile `F1`–`F11` din secțiunea 21).

```text
Data: 2026-10-01
Tester: proprietarul proiectului
Commit testat (git log -1 --oneline): 37f4450 feat: complete TASK 4 vertical slice
Adresă testată: http://localhost:8000/src/?adventure=demo-vertical-slice
  (server static local; telefonul conectat prin USB, port redirecționat cu ADB reverse
   port forwarding → originea este localhost, deci context sigur — 10_LOCAL_DEVELOPMENT.md §6.B)
Dispozitiv + sistem de operare: Google Pixel 9 Pro XL, Android
Browser + versiune: Chrome (versiunea nu a fost consemnată)
Mod: tab browser
GPS: real (permisiunea de localizare acordată în Chrome)
```

| ID test | Pași | Rezultat așteptat | Rezultat obținut | PASS / FAIL / NETESTAT | Observații |
| --- | --- | --- | --- | --- | --- |
| FT1-F0 | Date de site șterse; deschiderea URL-ului de test | Ecranul de start al aventurii demo | ca așteptat | PASS | |
| FT1-F1 | „Activează locația” → permite | Stare GPS activă (sau semnal slab), cu precizie | ca așteptat | PASS | GPS real |
| FT1-F2 | „Începe aventura” | Harta ca suprafață principală; cardul „[DEMO] Punctul A” peste hartă; „Am ajuns” vizibil; atribuirea OSM vizibilă | ca așteptat | PASS | |
| FT1-F3 | „Vezi obiectivele” | Harta revine la obiectiv | ca așteptat | PASS | |
| FT1-F4 | Sosirea la Punctul A | Cardul arată sosirea; scorul 50; „Deschide provocarea” | ca așteptat | PASS | sosire declanșată manual prin „Am ajuns” — vezi observația 1 |
| FT1-F5 | „Deschide provocarea” | Overlay-ul puzzle-ului peste hartă | ca așteptat | PASS | |
| FT1-F6 | Răspuns greșit | Feedback „incorect”; puzzle-ul rămâne deschis | ca așteptat | PASS | |
| FT1-F7 | „Arată indiciul” | Doar confirmarea (ireversibilitate), fără consum | ca așteptat | PASS | |
| FT1-F8 | **Back fizic** cu confirmarea deschisă | Se închide doar confirmarea; puzzle-ul rămâne | ca așteptat | PASS | |
| FT1-F9 | **Back fizic** cu overlay-ul deschis | Overlay-ul se închide; harta activă; puzzle-ul poate fi redeschis | ca așteptat | PASS | |
| FT1-F10 | Redeschidere → indiciu confirmat | Indiciul 1 vizibil; „1 din 2” disponibil | ca așteptat | PASS | |
| FT1-F11 | Reîncărcare în puzzle, după indiciu | Overlay-ul revine cu indiciul deschis; GPS-ul se reactivează manual (D-045) | ca așteptat | PASS | |
| FT1-F12 | Al doilea indiciu confirmat | Ambele indicii vizibile; butonul dispare | ca așteptat | PASS | |
| FT1-F13 | Răspuns corect la puzzle-ul 1 | „Corect!”; „Continuă” în overlay | ca așteptat | PASS | |
| FT1-F14 | „Continuă” | Obiectivul B; scorul 150 | scorul 150, obiectivul B afișat corect | PASS | |
| FT1-F15 | Reîncărcare | Obiectivul B curent; scorul 150 | scorul și progresul păstrate | PASS | |
| FT1-F16 | Sosirea la B, apoi reîncărcare | Starea „ai ajuns” la B rămâne | sosirea la B și starea aferentă păstrate | PASS | sosire declanșată manual prin „Am ajuns” — vezi observația 1 |
| FT1-F17 | Puzzle-ul 2: indiciu confirmat, răspuns `2DEMO` | „Corect! +150 puncte”; „Vezi rezultatul” | răspuns acceptat, +150 puncte | PASS | |
| FT1-F18 | „Vezi rezultatul” | Rezultatul: 350 din 350, 4 din 4, indiciile folosite | 350/350, 4/4 provocări, 3 indicii folosite | PASS | fără penalizări (D-025) |
| FT1-F19 | Reîncărcare pe rezultat | Rezultatul identic | rezultatul final păstrat | PASS | |
| FT1-F20 | **Back fizic** fără overlay / confirmare deschisă | Navigarea normală a browserului (pagina anterioară) | revenire la pagina anterioară din istoricul browserului | PASS | conform D-035 / U2 |
| FT1-F21 | „Joacă din nou” | Ecranul de start; progresul șters; după start, din nou Punctul A | sesiune nouă: scorul 0, primul obiectiv, niciun indiciu consumat | PASS | vezi observația 4 |

Rezultat: **FT1-F0 … FT1-F21: 22/22 PASS.** Probleme critice (secțiunea 9): niciuna. Nu au fost identificate probleme funcționale.

Observații:

1. **GPS și sosirea.**
   - Arrival flow: PASS — sosirea la ambele obiective (FT1-F4, FT1-F16) a fost declanșată manual prin „Am ajuns” (rezerva standard, D-006).
   - GPS-ul real a fost activ și funcțional pe dispozitiv (permisiune, poziție, precizie), dar coordonatele fictive ale aventurii demo (lângă 0°, 0°) nu pot fi atinse fizic, deci nu permit validarea fizică a pragului de sosire. Sosirea declanșată de poziția fizică reală rămâne de verificat cu o aventură cu locații reale (D-049-M).
2. **Persistența după reîncărcare.** Puzzle-ul activ cu indiciul deschis (FT1-F11), scorul și obiectivul curent (FT1-F15), sosirea la B (FT1-F16) și rezultatul final (FT1-F19) au fost restaurate exact din progresul salvat.
3. **Back fizic (U2 / D-035).** Primul Back a închis doar confirmarea indiciului, următorul overlay-ul puzzle-ului (FT1-F8, FT1-F9); fără straturi deschise, Back a fost navigarea normală a browserului (FT1-F20).
4. **Reset.** „Joacă din nou” (în raportul testerului: „Joacă un joc nou”) a pornit o sesiune nouă, cu progresul la 0, primul obiectiv și fără indicii consumate.

Neacoperit de Field Test 1: iPhone / Safari (secțiunea 14), starea service worker-ului pe telefon, modul offline, ecranul blocat, aplicația în fundal, instalarea pe ecranul de pornire și ceilalți pași din secțiunea 13. La data testului, metoda standard de testare pe telefon era nedecisă (D-031, PROPOSED — confirmată ulterior, la 2026-10-01); acest test a folosit varianta B din `10_LOCAL_DEVELOPMENT.md` §6. Golurile rămase se acoperă în TASK 5 (secțiunea 28).

## 28. TASK 5 — Field Test 2: Real-Coordinate GPS & Cross-Device Validation

Status: **în curs** (D-069, 2026-10-01). Executat: FT2-E3 pe Android — PASS (secțiunea 28.5). Celelalte puncte sunt `NETESTAT` până la rulare.

Scope și excluderi: D-069. Fără cod nou. Validează versiunea **publicată** pe GitHub Pages (D-031), cu codul de la TASK 4 (`37f4450`) sau ulterior, pe Android și pe iPhone / Safari. USB / ADB servește doar pentru consolă. Nu se modifică Engine V2, schema, contractele dintre module, `src/sw.js`, interfața sau `demo-gps-brasov.json`. Defectele găsite nu se repară în TASK 5.

Aventura: `src/?adventure=demo-gps-brasov` (demo public, coordonate reale — D-068; fișierul nu se modifică). Are 3 misiuni `location`: Start → Bariera → Magazin, la aproximativ 160 m și 220 m distanță. Raza 40 m, `maxAccuracy` 60 m, `exitMargin` 20 m, `allowManualConfirmation: true`, scor maxim 200.

Raportul se face în formatul secțiunii 16, cu ID-urile `FT2-…`, separat pentru fiecare dispozitiv. Un `FAIL` care arată un defect devine un task de corectare separat. Un rezultat care confirmă o limită documentată nu este un defect.

Legendă: **OBL** = obligatoriu · **OPȚ** = opțional · **EXCLUS** = blocat de o decizie `PROPOSED`, nu intră în TASK 5.

### 28.1 Deja validat în Field Test 1 (nu se repetă ca obiectiv)

Harta ca suprafață principală, cardul peste hartă, atribuirea OSM, „Vezi obiectivele”, sosirea manuală („Am ajuns”, D-006), overlay-ul puzzle-ului, indiciile cu confirmare (D-030), Back fizic (U2 / D-035), persistența după reîncărcare, rezultatul și „Joacă din nou”. Toate au fost validate pe Android, prin USB, cu coordonate fictive (secțiunea 27.3).

### 28.2 Precondiții

1. Pregătirea dispozitivului Android destinat FT2, înainte de publicarea versiunii FT2: dispozitivul accesează versiunea publicată actuală, cât timp service worker-ul `v6` este versiunea relevantă, astfel încât `v6` să fie instalat. Datele aplicației de pe acest dispozitiv nu se șterg înainte de FT2-E3.
2. Codul TASK 4 este publicat pe GitHub Pages (push pe `main` la cererea explicită a proprietarului — D-020). Verificarea publicării se face conform secțiunii 18.
3. Se notează commit-ul publicat, dispozitivul, sistemul de operare, browserul cu versiunea și bateria la start.

### 28.3 Checklist

| ID | Verificare | Rezultat așteptat | Marcaj |
| --- | --- | --- | --- |
| FT2-A1 | Adresa publicată servește commit-ul notat (rularea din „Actions” și secțiunea 18) | nu este servită versiunea veche (pre-TASK 4, `CACHE_VERSION` `v6`) | OBL |
| FT2-A2 | Date de site șterse, apoi deschiderea adresei | ecranul de start al demo-ului GPS | OBL |
| FT2-B1 | „Activează locația” → Permite, afară | GPS activ, precizia afișată | OBL |
| FT2-B2 | Apropierea de Start **fără** „Am ajuns” | starea „aproape”, apoi sosirea decisă de motor în rază (precizie ≤ 60 m); scorul 50; obiectivul următor este Bariera | OBL |
| FT2-B3 | La fel pentru Bariera și Magazin | sosiri automate; aventura se încheie; rezultatul 200/200, 3/3 | OBL |
| FT2-B4 | La fiecare locație: precizia raportată, distanța aproximativă la sosire, condițiile | date notate (secțiunea 15); fără prag numeric | OBL |
| FT2-B5 | După sosire: ieșire din rază și reintrare | nicio dublare de puncte sau de evenimente (histerezis) | OBL |
| FT2-B6 | Semnal slab (lângă sau în clădire) | „Semnal GPS slab” peste 60 m; nicio sosire falsă; „Am ajuns” disponibil | OBL |
| FT2-B7 | Permisiune refuzată, apoi „Încearcă din nou” din indicatorul GPS de pe hartă (în joc; pe ecranul de start butonul din panou este „Reîncearcă”) | mesaj clar; obiectivele pe hartă fără jucător; „Am ajuns” rezolvă misiunea (H13, D-006) | OBL |
| FT2-B8 | Reîncărcare pe traseu, online | progresul restaurat; GPS-ul se reactivează manual (D-045) | OPȚ |
| FT2-B9 | Nicio coordonată a jucătorului în `localStorage` (consola prin USB / ADB) | D-043 respectată | OBL pe Android (consola prin USB / ADB, D-031); N/A pe iPhone (fără Mac) |
| FT2-C1 | Tile-uri OSM și atribuire | H2 | OBL |
| FT2-C2 | Markerul jucătorului și cercul de acuratețe la poziția reală | H3, H5 | OBL |
| FT2-C3 | Obiectivul curent evidențiat, cercul razei; locațiile `locked` ascunse | H2, D-049-B | OBL |
| FT2-C4 | Primul fix produce o singură mișcare a hărții; fix-urile următoare nu o mișcă; pan (pe telefon, cu două degete în versiunea care include amendamentul D-049 privind gesturile (2026-10-02, secțiunea 31); în versiunile anterioare: un deget) sau zoom manual se păstrează | H3, H4 | OBL |
| FT2-C5 | „Centrează pe mine” produce o singură centrare; „Vezi obiectivele” funcționează | H6 | OBL |
| FT2-C6 | După sosire, cercul obiectivului dispare; obiectivul nou produce o singură recentrare | H7 | OBL |
| FT2-C7 | Atribuirea neacoperită; „Am ajuns” vizibil fără derulare; lizibil în soare | H9, secțiunea 13.9 | OBL |
| FT2-C8 | Rotirea ecranului | interfața rămâne utilizabilă | OPȚ |
| FT2-D1 | Parcurgere completă pe stradă (Android) | fără blocaje (secțiunea 9) | OBL |
| FT2-D2 | Bateria la start și la final, durata | observație, fără prag (D-058) | OPȚ |
| FT2-D3 | Închidere din aplicațiile recente, apoi redeschidere | progresul păstrat | OPȚ |
| FT2-D4 | Instalare pe ecranul de pornire, pornire din iconiță | aplicația pornește | OPȚ |
| FT2-E1 | Starea service worker-ului (rândul din aplicație sau consola) | înregistrat și activ | OBL |
| FT2-E2 | Cache Storage | `outdoor-escape:shell:v7`: shell, module, Leaflet, `brasov-centrul-vechi.json`; fără tile-uri; fără `demo-gps-brasov.json` (nu este în `SHELL_FILES`) | OBL pe Android (consola prin USB / ADB, D-031); N/A pe iPhone (fără Mac) |
| FT2-E3 | Pe dispozitivul Android pregătit la 28.2, punctul 1, după publicarea versiunii FT2, fără ștergerea datelor și înainte de FT2-A2: redeschiderea aplicației | service worker-ul `v7` activ; cache-ul `v6` șters (secțiunea 18.6); interfața TASK 4 afișată | OBL |
| FT2-F1 | Datele mobile oprite în timpul jocului, fără reîncărcare | jocul și sosirea GPS continuă; harta afișează bannerul pentru tile-uri, markerii rămân (H11, H14) | OBL |
| FT2-F2 | Offline: reîncărcarea aventurii implicite `src/` (în cache) | aplicația și progresul pornesc din cache (secțiunea 13.3) | OBL |
| FT2-F3 | Offline: reîncărcarea `?adventure=demo-gps-brasov` | limită cunoscută: aventura nu este în cache și nu se încarcă; se notează mesajul; progresul rămâne (D-056, neimplementat) | OPȚ (observație) |
| FT2-F4 | Harta offline cu fundal | — | EXCLUS (D-063) |
| FT2-G1 | Ecran blocat 1 min, apoi 10 min, pe traseu | conform secțiunii 24.4: starea neschimbată; la revenire, urmărirea continuă sau se reactivează manual | OPȚ (observație) |
| FT2-G2 | Altă aplicație, apoi înapoi | idem | OPȚ (observație) |
| FT2-G3 | Trecerea prin rază cu ecranul blocat | nicio sosire în fundal; confirmare la revenire sau cu „Am ajuns” | OPȚ (observație) |
| FT2-G4 | Criterii pentru fundal / ecran stins, Wake Lock; cronometrul | — | EXCLUS (D-028, D-025) |
| FT2-H1 | iPhone / Safari: pașii A, B1–B7, C1–C7, E1, F1, F2 | ca pe Android; erorile se descriu manual (fără Mac) | OBL |
| FT2-H2 | iPhone / Safari, `src/?adventure=demo-vertical-slice`: pașii VS1–VS14 (secțiunea 27.2), inclusiv Back prin gestul swipe (VS11–VS13) | ca în secțiunea 27.2 | OBL |
| FT2-H3 | iPhone: „Add to Home Screen” (stocare separată) | persistența testată separat în ambele moduri (secțiunea 14) | OPȚ |
| FT2-H4 | iPhone: ecran blocat / fundal | observație (pe iOS, GPS-ul este oprit — secțiunea 24.4) | OPȚ (observație) |

### 28.4 Gol de acoperire acceptat

Limitare cunoscută, nu defect al TASK 5. Combinația „sosire GPS reală → overlay puzzle” nu poate fi verificată end-to-end cu `demo-gps-brasov`: demo-ul are doar misiuni `location`. Verificarea ar cere modificarea demo-ului sau un alt demo cu coordonate reale (neautorizat de D-068), ceea ce este în afara TASK 5. Motorul tratează identic sosirea GPS și cea manuală (D-045), iar overlay-ul după sosirea manuală a fost validat în Field Test 1.

### 28.5 Rezultate

Raport în formatul secțiunii 16. Se completează pe măsură ce punctele sunt rulate.

```text
Data: 2026-10-01
Tester: proprietarul proiectului
Commit testat (git log -1 --oneline): 58a78d3 docs: register TASK 5 Field Test 2
  (publicat prin push pe main; origin/main = 58a78d3)
Adresă testată: https://rezervari.github.io/outdoor-escape/src/ (GitHub Pages, D-031)
Dispozitiv + sistem de operare: Google Pixel 9 Pro XL, Android
Browser + versiune: Chrome 154.0.8037.59
Mod: tab browser
Consolă: USB / ADB, doar pentru depanare / DevTools (D-031)
```

Precondiții (secțiunea 28.2):

- Punctul 1: înainte de push, pagina publică servea `v6`. Pe dispozitiv, în DevTools → Console, `caches.keys()` a returnat `["outdoor-escape:shell:v6"]`.
- Punctul 2: cele 9 commit-uri locale au fost publicate (`git push origin main`; `origin/main` = `58a78d3`). Versiunea publică servește `v7`.

| ID test | Pași | Rezultat așteptat | Rezultat obținut | PASS / FAIL / NETESTAT | Observații |
| --- | --- | --- | --- | --- | --- |
| FT2-E3 | Pe dispozitivul pregătit la 28.2, punctul 1, după publicarea versiunii FT2, fără ștergerea datelor și înainte de FT2-A2: redeschiderea aplicației | service worker-ul `v7` activ; cache-ul `v6` șters; interfața TASK 4 afișată | Service worker nou: sursa `sw.js`, starea `#1221 activated and is running`, primit la 01/10/2026 13:34:05. `caches.keys()` → `["outdoor-escape:shell:v7"]` (`v6` eliminat). Pe `src/?adventure=demo-vertical-slice` (v7) s-a confirmat vizual interfața TASK 4: harta, fluxul „Am ajuns”, puzzle-ul | PASS | Fără Clear Storage, fără ștergerea cache-ului, fără Unregister; codul și `demo-gps-brasov` nemodificate în timpul verificării |

Domeniul FT2-E3: rezultatul confirmă **upgrade-ul service worker-ului și al cache-ului (`v6` → `v7`)** și disponibilitatea interfeței TASK 4 pe versiunea publicată. Nu confirmă **persistența progresului unei sesiuni de joc existente înainte de upgrade**, care nu a fost verificată. Progresul din Field Test 1 era pe `http://localhost:8000` (altă origine, cu stocare separată de GitHub Pages — `10_LOCAL_DEVELOPMENT.md` §7), nu în sesiunea publică `v6`, deci nu a trecut prin acest upgrade.

## 29. M6 — Mesajele (GameEvent → Message Engine → Inbox → panoul „Mesaje”)

Lanțul de comunicare în aplicație (D-082, D-085, D-086, D-090, D-092): batch-ul fiecărei tranzacții nevide → `processGameEvents` → `inbox.addMessages`; butonul „Mesaje” cu numărul de necitite; panoul „Mesaje” (doar citire). Fără audio, notificări, acțiuni sau câmp de răspuns.

### 29.1 Automat — `npm test`

| Fișier | Acoperă |
| --- | --- |
| `tests/game-event.test.js`, `tests/game-event-subscribe.test.js` | modelul GameEvent (M1) și expunerea prin `subscribe((state, events) => …)` (M2) |
| `tests/game-message.test.js`, `tests/message-engine.test.js` | modelul GameMessage (M3) și Message Engine (M4) |
| `tests/inbox.test.js` | starea Inbox (M5): deduplicare, citit / necitit, persistență separată, reset |
| `tests/inbox-ui.test.js` | M6: `inbox-ui.js`, stratul Back `Layer.INBOX`, orchestrarea din `app.js` reprodusă fără DOM (runtime, număr de necitite, duplicate, batch gol, deschidere fără efect în joc, citit după desenare, reîncărcare, reset, parcurgere nouă, pornire `idle`, ecranul final) și verificări în sursă (`app.js`, `index.html`) |

### 29.2 Browser — smoke test

Verificat la 2026-10-02 în browserul din aplicația desktop Claude (Chromium), server local `127.0.0.1:8000`, la ~422×734 (layout de telefon) și 1280×800 (desktop, verificat prin dimensiuni măsurate în DOM). Geolocația a fost simulată în pagină (metodele `navigator.geolocation` înlocuite doar în tab-ul de test). Aventuri fictive: `demo-challenge-media`, `demo-vertical-slice`.

| ID | Pași | Rezultat așteptat | Rezultat |
| --- | --- | --- | --- |
| M6-1 | Pornirea aplicației | service worker `v11` activ, 27 de intrări (inclusiv `message-engine.js`, `inbox.js`, `inbox-ui.js`), `v10` șters; butonul „Mesaje” ascuns pe ecranul de start | PASS |
| M6-2 | „Începe aventura” (`demo-challenge-media`) | mesajul de introducere în Inbox, necitit; butonul „Mesaje 1”, `aria-label` „Mesaje, 1 necitit” | PASS |
| M6-3 | Focus pe „Mesaje”, Enter | panoul se deschide (dialog, `<main>` inert, focus pe titlu, o intrare de istoric); mesajul cu expeditorul și categoria; devine citit după desenare; numărul dispare | PASS |
| M6-4 | Escape | panoul se închide, focusul revine pe „Mesaje”, intrarea de istoric se retrage | PASS |
| M6-5 | „Activează locația” + poziții simulate (aproape, apoi la Poartă) | sosire GPS, misiunea rezolvată; fără mesaj nou (conținutul nu are text pentru sosire) | PASS |
| M6-6 | Puzzle A: indiciu (confirmat), răspuns corect; puzzle B: răspuns corect | mesajul indiciului, apoi fragmentul A, necitite; numărul crește la 2; jurnalul (`#story-panel`) continuă să funcționeze | PASS |
| M6-7 | Reîncărcare fără deschiderea panoului | numărul rămâne 2; introducerea rămâne citită; fără duplicate | PASS |
| M6-8 | „Mesaje” → listă (layout de telefon: foaie pe tot ecranul) | 3 mesaje în ordinea sosirii; cele noi marcate „Nou”; toate citite după afișare | PASS |
| M6-9 | Back al browserului cu panoul deschis | panoul se închide; URL neschimbat; focus pe „Mesaje” | PASS |
| M6-10 | Reîncărcare | toate mesajele rămân citite | PASS |
| M6-11 | „Începe de la capăt” → confirmare | progresul și Inbox-ul șterse împreună (ambele chei absente); ecranul de start fără „Mesaje” | PASS |
| M6-12 | „Începe aventura” din nou | introducerea apare ca mesaj nou, necitit (1) | PASS |
| M6-13 | `demo-vertical-slice` (fără narator): „Mesaje” | starea goală „Nu ai mesaje încă.” | PASS |
| M6-14 | Indiciu → final → ecranul de rezultat | „Mesaje 1” disponibil pe ecranul final; „Joacă din nou” șterge progresul și Inbox-ul | PASS |
| M6-15 | Desktop 1280×800 | insigna și „Mesaje” pe același rând; panoul centrat (foaie 640 px); fără derulare orizontală | PASS |
| M6-16 | Consola | fără erori | PASS |

**Netestat încă:** telefon real (Android / iOS), cititor de ecran, publicarea pe GitHub Pages.

## 30. M7 — Notificarea și gong-ul (D-104 – D-107)

Lanțul: `inbox.addMessages(...).added` → `render()` → Notification Policy (`notification-policy.js`) → toast `#notification` + anunț `#notification-live` + gong (`gong.js`, Web Audio). Jurnalul (`#story-panel`) rămâne doar vizual (D-107).

### 30.1 Automat — `npm test`

| Fișier | Acoperă |
| --- | --- |
| `tests/notification-policy.test.js` | modulul pur: lot gol, un mesaj, 3 / 10 mesaje (o prezentare, cel mult un gong, anunț cu toate textele), duplicate (doar Inbox-ul deduplică), `request_hint` + `hint` (și combinația cu un mesaj non-hint), categorii fără reguli speciale, importanța (normal / important → `polite`, urgent → `assertive` + persistent, maximul lotului), matricea de context D-105 (joc, puzzle, audio de misiune, Inbox, viewer, pagină ascunsă, final), absorbția (fără al doilea gong, escaladarea importanței, fără gong după un gong ratat), finalul închide prezentarea, puritate și verificări în sursă |
| `tests/gong.test.js` | `gong.js` cu `AudioContext` simulat: fără gest nu sună, deblocare la gest (un singur context, în memorie), gong reușit, reluare la timp / prea lentă (abandon, fără redare amânată), autoplay blocat, Web Audio indisponibil, eroare la generare, `stop()` la reset, fără repetare, fără `<audio>` / fișiere / stocare |
| `tests/notification-ui.test.js` | orchestrarea din `app.js` reprodusă fără DOM (fixture-ul fictiv): intro, absorbție, reintrare GPS, indiciu cerut, răspuns greșit repetat, audio de misiune, puzzle, Inbox deschis, viewer / pagină ascunsă, final, reîncărcare, reset + parcurgere nouă, audio blocat; în sursă: `notify` după `render`, doar din `added` / `cause` / `status` / context, un singur `gong.play()` (doar din decizie), fără stare persistentă, toast-ul nu este strat Back / Escape, `index.html` (toast și regiune live în afara `<main>`, jurnal fără `aria-live`), `app.css` (z-index, 44 px), `sw.js` |
| `tests/inbox-ui.test.js` | actualizat pentru M7: abonarea se termină cu `render()` → `notify(...)`; `app.js` nu folosește direct API-uri audio, notificările browserului, Push sau vibrații (sunetul trece numai prin `gong.js`) |

### 30.2 Browser — smoke test

Verificat la 2026-10-02 în browserul din aplicația desktop Claude (Chromium), server local (`localhost:8000`), aventura fictivă `demo-challenge-media`: layout de telefon (panoul, 422×734), emulare telefon 375×700 (touch) și 1280×800 (desktop; geometrie măsurată în DOM). Gong-ul a fost verificat prin numărarea oscilatoarelor create (instrumentare în pagină), nu prin ascultare. Unele contexte nu pot primi un mesaj prin interfață cu conținutul existent (viewer sau panoul „Mesaje” deschis, audio de misiune pe o misiune cu mesaj): tranzacția a fost simulată în pagină (clic programatic pe varianta de răspuns, respectiv un `<audio>` silențios adăugat doar pentru test).

| ID | Pași | Rezultat așteptat | Rezultat |
| --- | --- | --- | --- |
| M7-1 | Pornirea aplicației | service worker `v12` activ, `v11` șters; `#story-latest` fără `aria-live`; `#notification-live` în afara `<main>` | PASS |
| M7-2 | „Începe aventura” (primul gest) | toast „Ghidul demo” + începutul textului; anunț `polite` cu expeditorul și textul complet; gong (contextul audio deblocat de același gest, `running`); focusul nu se mută; „Mesaje 1” | PASS |
| M7-3 | Așteptare | toast-ul se închide singur după ~6 s | PASS |
| M7-4 | „Am ajuns” (fără mesaj în conținut) | nimic: fără toast, gong sau anunț | PASS |
| M7-5 | Puzzle A: indiciu (confirmat) | indiciul afișat în puzzle, cu focus; în Inbox necitit („Mesaje 2”); fără toast, gong sau anunț | PASS |
| M7-6 | Puzzle B: răspuns corect (mesaj nou), overlay deschis | toast peste overlay, gong, anunț; focusul rămâne pe „Continuă”; toast-ul și regiunea live nu sunt inerte | PASS |
| M7-7 | Intro + puzzle B la mai puțin de 6 s | aceeași prezentare: „2 mesaje noi”, un singur gong, al doilea lot anunțat; istoricul are o singură intrare (puzzle-ul) | PASS |
| M7-8 | Indicatorul mouse-ului pe toast | toast-ul rămâne peste 6 s | PASS |
| M7-9 | Escape cu toast vizibil | se închide overlay-ul (stratul de sus); toast-ul rămâne | PASS |
| M7-10 | „Deschide” din toast, peste puzzle | panoul „Mesaje” peste puzzle (2 straturi), toast închis, mesaje citite; Escape → panoul se închide, focus pe titlul puzzle-ului | PASS |
| M7-11 | Viewer deschis + mesaj nou (simulat) | fără toast, gong sau anunț; „Mesaje” +1; toast-ul inert sub viewer; după închidere nu se reia nimic | PASS |
| M7-12 | Panoul „Mesaje” deschis + mesaj nou (simulat) | mesajul apare în listă „Nou” și devine citit; fără toast și gong; anunț `polite` | PASS |
| M7-13 | Audio de misiune în redare + mesaj nou (simulat) | toast și anunț, fără gong; sunetul continuă | PASS |
| M7-14 | Pagina raportată `hidden` de browser | mesaj în Inbox, necitit; fără toast, gong sau anunț; nimic reluat ulterior | PASS (vezi observația) |
| M7-15 | Final („Vezi rezultatul”) | fără toast, gong sau anunț; regiunea live golită; focus pe titlul rezultatului; „Mesaje” cu necititele | PASS |
| M7-16 | „Joacă din nou” → „Începe aventura” | toast și gong pentru intro din nou; după reset regiunea live este goală | PASS |
| M7-17 | Reîncărcare | fără toast, gong sau anunț; „Mesaje” restaurat | PASS |
| M7-18 | Telefon 375×700 | toast pe un rând (351×87), „Deschide” 100×44, „✕” 45×44; acoperă doar antetul puzzle-ului; câmpul de răspuns (y 480–528) și „Continuă” rămân libere; fără derulare orizontală | PASS |
| M7-19 | Desktop 1280×800 | toast 640×65, aliniat cu foaia puzzle-ului; fără derulare orizontală | PASS |
| M7-20 | Consola | fără erori ale aplicației | PASS (vezi observația) |

Observații:
- Browserul din aplicație a raportat `document.visibilityState === "hidden"` după o reîncărcare din script și sub emularea 1280×800 scalată, deși panoul era afișat; aceste situații au fost folosite ca verificări reale pentru „pagină ascunsă” (M7-14). Geometria desktop (M7-19) a fost măsurată afișând temporar toast-ul, doar pentru inspecție.
- Singura eroare din consolă a provenit din scriptul de test (clic programatic pe „Continuă”, ascuns, cu provocarea încă deschisă — motorul a refuzat corect), nu din aplicație.

### 30.3 Netestat încă

- telefon real (Android / iOS): tastatura virtuală peste toast, sunetul real, butonul de silențios iOS (Web Audio), poziția sub notch / bara de adrese;
- cititor de ecran real (VoiceOver / TalkBack / NVDA), inclusiv anunțul regiunii live din afara unui dialog `aria-modal` (puzzle, panoul „Mesaje”);
- `important` / `urgent` în browser: conținutul nu le poate produce încă (Message Engine dă `normal`); acoperite de testele automate;
- autoplay blocat real (Chromium a permis sunetul după gest); acoperit de `tests/gong.test.js` și `tests/notification-ui.test.js`;
- toast activ în momentul finalului (conținutul demo nu are un mesaj imediat înainte de final); acoperit de testele automate;
- Back (butonul browserului) apăsat cu toast vizibil: verificat indirect (toast-ul nu adaugă intrări de istoric; Escape folosește aceeași cale de închidere);
- publicarea pe GitHub Pages.

## 31. M7-C — Gesturile hărții pe ecran tactil (D-049, amendamentul privind gesturile din 2026-10-02)

Pe ecran tactil, un deget derulează pagina (și peste hartă), iar harta se mută și se mărește cu două degete; pe desktop, drag-ul cu mouse-ul rămâne. Se schimbă `src/js/map.js`: `dragging: !prefersCoarsePointer()` (`matchMedia("(pointer: coarse)")`, citit o dată la `createMap`); `touchZoom: true` (nu `"center"`). În `src/sw.js` se mărește doar `CACHE_VERSION` (`v13` → `v14`, fișier existent modificat), fără altă schimbare. Fără handlere proprii de gesturi și fără modificări în `app.css`, `src/vendor/leaflet/`, GPS sau motor. Specificația: `12_MAP_SPECIFICATION_M-003.2.md` §6.

### 31.1 Automat — `npm test`

| Fișier | Acoperă |
| --- | --- |
| `tests/map.test.js` | actualizat pentru gesturile hărții (4 teste „gesturi:”): pointer `coarse` → `dragging: false`; pointer fin și fără `matchMedia` → `dragging: true` (comportamentul anterior); în toate cazurile `touchZoom: true` (nu `"center"`), `doubleClickZoom`, `keyboard`, `zoomControl`, `attributionControl` activate, `scrollWheelZoom: false`, `boxZoom: false`, `minZoom` / `maxZoom` neschimbate; `globalThis.matchMedia` restaurat după fiecare test. Gesturile nu sunt simulate în testele unitare |

La 2026-10-02: `npm test` — 575 de teste, 571 PASS, 4 sărite (aventurile private, D-080), 0 FAIL; `tests/map.test.js` — 32/32 PASS (inclusiv suma SHA-256 a Leaflet din vendor). `npm run qa` — 0 erori, 4 avertismente, 7 excepții declarate (preexistente).

### 31.2 Browser — emulare (nu este validare fizică)

Verificat la 2026-10-02 în browserul din aplicația desktop Claude (Chromium), server local (`localhost:8000`), aventura fictivă `demo-vertical-slice`: desktop (pointer fin) și emulare telefon 375×812 (touch, pointer `coarse`). Gesturile tactile au fost simulate în pagină cu evenimente `TouchEvent` sintetice: acestea verifică reacția Leaflet, nu derularea nativă a paginii.

| ID | Pași | Rezultat așteptat | Rezultat |
| --- | --- | --- | --- |
| HGB-1 | Desktop: containerul hărții | `leaflet-touch-drag` prezent, `touch-action: none` (ca înainte) | PASS |
| HGB-2 | Desktop: drag cu mouse-ul, butoanele +/-, clic pe marker | harta se deplasează; zoom 17 → 18 → 17; popup-ul obiectivului | PASS |
| HGB-3 | Telefon 375×812: containerul hărții | `leaflet-touch-drag` absent, `touch-action: pan-x pan-y` | PASS |
| HGB-4 | Un deget (sintetic) peste hartă | harta nu se mișcă; Leaflet nu anulează evenimentele (browserul poate derula pagina) | PASS |
| HGB-5 | Două degete (sintetic), deplasare | harta se mută cu deplasarea degetelor | PASS (vezi observația) |
| HGB-6 | Pinch (sintetic) | zoom 17 → 19 (= `maxZoom`) | PASS (vezi observația) |
| HGB-7 | Tap pe marker, butonul + | popup-ul obiectivului; zoom 17 → 18 | PASS |
| HGB-8 | Layout | HUD sus-dreapta, cardul obiectivului jos, bannerul ascuns, harta 636 px; fără derulare orizontală | PASS |

Observație: la început, browserul din aplicație a raportat pagina ca `hidden`, deci `requestAnimationFrame` nu rula și Leaflet nu aplica mișcările de pinch / pan; HGB-5 și HGB-6 au fost repetate după ce pagina a devenit vizibilă.

### 31.3 Telefon real — Android

Raport în formatul secțiunii 16. Testul a folosit un server HTTP local, cu telefonul conectat prin ADB, nu metoda standard D-031 (versiunea publicată), pentru că modificarea nu este publicată; versiunea publicată rămâne în 31.4.

```text
Data: 2026-10-02 (data raportului)
Tester: proprietarul proiectului
Commit testat: neconsemnat de tester
Adresă testată: server HTTP local, telefonul conectat prin ADB (raportul proprietarului: „local HTTP
  server and the deployed game build”); conexiunea exactă, URL-ul și aventura nu au fost consemnate
Dispozitiv + sistem de operare: telefon Android (modelul nu a fost consemnat)
Browser + versiune: neconsemnat
Mod: neconsemnat
GPS: real
```

| ID test | Pași | Rezultat așteptat | Rezultat obținut | PASS / FAIL / NETESTAT | Observații |
| --- | --- | --- | --- | --- | --- |
| HG-1 | Un deget, derulare verticală pornită peste hartă | pagina se derulează; harta și markerii nu se mișcă; fără derulare orizontală | ca așteptat | PASS | |
| HG-2 | Un deget, gest predominant orizontal peste hartă | harta nu se mută; fără derulare orizontală sau salt de layout | ca așteptat | PASS | |
| HG-3 | Două degete, deplasare în aceeași direcție | harta se mută; pagina nu se derulează în locul ei; HUD-ul și cardul rămân pe loc | ca așteptat | PASS | |
| HG-4 | Pinch out / pinch in | zoom-ul hărții se schimbă; pagina nu se mărește; markerii rămân corect poziționați | ca așteptat | PASS | |
| HG-5 | Pinch + deplasare simultan | zoom și pan simultan, fără salturi; pagina nu se mișcă neașteptat | ca așteptat | PASS | |
| HG-6 | Un deget derulează pagina; în timpul derulării se adaugă al doilea deget | comportamentul se consemnează exact | pagina poate continua să se miște, iar harta începe și ea să se miște | ACCEPTAT de proprietar (nu PASS formal) | vezi observația 1 |
| HG-7A | Tap pe marker, înainte și după pan cu două degete | popup-ul se deschide și se închide | ca așteptat | PASS | |
| HG-7B | Butoanele Leaflet +/- | zoom-ul se schimbă | ca așteptat | PASS | |
| HG-8 | GPS real, indicatorul GPS (HUD), „Centrează pe mine” | o singură centrare, fără urmărire continuă; HUD-ul neschimbat | ca așteptat | PASS | |
| HG-9 | Vizibilitatea și utilizarea HUD-ului și a cardului obiectivului | rămân pe poziție și utilizabile în timpul gesturilor | ca așteptat | PASS | |
| HG-10 | Bannerul hărții | nu este afectat de gesturi și nu blochează derularea | fără problemă blocantă | OK raportat de proprietar (nu PASS formal) | vezi observația 2 |
| HG-11 | Portret / peisaj | gesturile funcționează în ambele orientări | ca așteptat | PASS | |
| HG-12 | Controale tactile și accesibilitate de bază | markerul se activează prin tap; butoanele de zoom utilizabile; nimic inaccesibil din cauza gesturilor | ca așteptat | PASS | |

Rezultat: **HG-1 … HG-12 (13 verificări): 11 PASS, 0 FAIL.** HG-6 acceptat de proprietar (observația 1); HG-10 raportat „OK / no blocking issue” (observația 2). Probleme critice (secțiunea 9): niciuna raportată. Nu a fost necesară nicio corecție de cod.

Observații:

1. **Al doilea deget în timpul derulării (HG-6).** Când al doilea deget este pus după ce pagina a început deja să se deruleze, pagina poate continua să se miște, iar harta începe și ea să se miște. Proprietarul a judecat comportamentul natural și acceptabil (2026-10-02): nu se corectează și nu se introduce un recunoscător de gesturi propriu (D-049, amendamentul privind gesturile din 2026-10-02).
2. **Bannerul (HG-10).** Proprietarul a raportat „OK / no blocking issue”, nu un PASS formal. Nu s-a consemnat dacă bannerul a apărut efectiv în timpul testului (apare doar după erori repetate la încărcarea tile-urilor).

### 31.4 Netestat încă

- iPhone / Safari: toate verificările HG (portret și peisaj), inclusiv interacțiunea cu gestul swipe-back de pe margine (secțiunea 14; FT2-H1, FT2-H2);
- versiunea publicată pe GitHub Pages (metoda standard pentru testele pe telefon, D-031; după publicare);
- double-tap pe hartă (zoom Leaflet) pe ecran tactil, după amendament;
- dispozitive hibride (pointer principal fin + ecran tactil: conform codului, un deget mută harta, ca înainte — neverificat) și schimbarea pointerului după crearea hărții (`matchMedia` este citit o singură dată);
- emularea de telefon din DevTools (secțiunea 12.3): se așteaptă pointer `coarse`, deci drag-ul cu mouse-ul nu mai mută harta (după reîncărcarea paginii cu emularea activă) — neverificat;
- cititor de ecran real (VoiceOver / TalkBack).
