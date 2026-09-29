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

Secțiunile 1–9 de mai sus definesc *ce* se testează. Secțiunile 10–17 descriu *cum* se testează. Procedurile pentru aplicație se aplică după ce există scheletul PWA; până atunci se aplică doar secțiunea 17 (documentație).

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

Precizia slabă (valoare `accuracy` mare) nu poate fi simulată exact din panoul Sensors. Se testează pe telefon (secțiunea 13) sau prin teste automate, când vor exista (D-023).

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
| G6 | „Arată indiciul” | Apare textul indiciului; butonul dispare; scorul nu se schimbă |
| G7 | Răspuns corect cu variații (`  BRAȘOV `, `brasov`, `Braşov` cu sedilă) | „Corect! +100 puncte”; scorul crește; apare „Continuă” |
| G8 | F5 după G7, înainte de „Continuă” | Aceeași provocare, marcată corectă, cu „Continuă” |
| G9 | „Continuă”, răspuns trimis cu Enter | Provocarea 2; Enter trimite răspunsul |
| G10 | F5 la provocarea 3 | Progresul și scorul sunt păstrate. Application → Local Storage: cheia `outdoor-escape:game:brasov-centrul-vechi` |
| G11 | „Începe de la capăt” → „Nu”, apoi → „Da, șterge progresul” | „Nu” păstrează jocul; „Da” duce la ecranul de start și șterge cheia din Local Storage |
| G12 | „Sari peste (0 puncte)” la o provocare, apoi F5 înainte și după „Continuă” | Mesaj „Ai sărit…”; scorul nu crește; apare „Continuă”. După F5, provocarea rămâne sărită (Local Storage: `"status":"skipped"`); provocarea nu se numără la „rezolvate” la final |
| G13 | Termină aventura | Ecran final: „Felicitări…”, scorul „X din 350 puncte”, „Provocări rezolvate: N din 3”, „Joacă din nou” |
| G14 | F5 pe ecranul final, apoi „Joacă din nou” | Rezultatul rămâne după F5; „Joacă din nou” duce la start și șterge progresul |
| G15 | `src/?adventure=inexistenta` | Ecran „Aventura nu a putut fi încărcată” + „Încearcă din nou”; fără excepții în consolă |
| G16 | Application → Cache storage | Doar `outdoor-escape:shell:v4`, cu fișierele din `SHELL_FILES` (14 intrări: 13 din `src/` + `content/adventures/brasov-centrul-vechi.json`) |
| G17 | După o primă încărcare online: Network → „Offline”, F5 (pe ecranul de start și în timpul jocului) | Aplicația și aventura demo se încarcă din cache; progresul este păstrat; răspunsurile se verifică și offline |
| G19 | `src/?adventure=inexistenta` cu Network → „Offline” | Ecranul de eroare („Verifică conexiunea…”) + „Încearcă din nou” — doar aventura demo este în cache |
| G18 | Simulare mobil 360 px (secțiunea 12.3) | Fără derulare orizontală; butoanele principale pe toată lățimea, cel puțin 48 px înălțime |

Note:
- Secțiunea 21 (F5) descrie cache-ul fundației (`v1`, 5 fișiere). Începând cu motorul v1, rezultatul așteptat este cel din G16.
- Starea `failed` nu poate fi produsă din interfață în această etapă; este acoperită de testele automate (`tests/game.test.js`).
- Workflow-ul (`.github/workflows/deploy-pages.yml`) publică doar `index.html`, `src/` și `content/` (asamblează `_site/` și eșuează dacă apar `docs/`, `tests/` sau `.github/`). F11 se aplică: `.../outdoor-escape/docs/`, `.../outdoor-escape/tests/` și `.../outdoor-escape/tests/fixtures/adventure-v2-demo.json` trebuie să dea 404.

## 23. Fundația V2 (schema, locații, evenimente, progres)

Fundația V2 nu are încă interfață pentru noile mecanici (GPS din browser, hartă, audio, misiuni de locație/bonus/secret/partener). Se testează:

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
