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

Neacoperit de Field Test 1: iPhone / Safari (secțiunea 14), starea service worker-ului pe telefon, modul offline, ecranul blocat, aplicația în fundal, instalarea pe ecranul de pornire și ceilalți pași din secțiunea 13. Metoda standard de testare pe telefon rămâne nedecisă (D-031, PROPOSED); acest test a folosit varianta B din `10_LOCAL_DEVELOPMENT.md` §6.
