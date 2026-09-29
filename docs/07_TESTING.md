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

Până la stabilirea unui tooling (D-023, PROPOSED):

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

Notă: `meta refresh` și linkul sunt statice, deci fără JavaScript nu pot păstra query-ul și hash-ul. Rezultatul așteptat pentru R2 fără JavaScript trebuie clarificat înainte de implementare.
