# CLAUDE.md — Outdoor Escape

Reguli de lucru pentru Claude Code în acest repository. Detaliile stau în `docs/` (ordinea de citire: `docs/README_CONTEXT_PACK.md`); aici sunt doar regulile care nu se pot deduce din cod și care trebuie respectate în fiecare sesiune.

## 1. Working tree-ul proprietarului (regulă absolută)

- La începutul fiecărei sesiuni: `git status`. Orice modificare necomisă care exista înainte de sesiune aparține proprietarului.
- Nu modifica, nu reformata, nu restaura, nu șterge și nu suprascrie aceste fișiere și nu le include într-un commit, decât dacă sarcina curentă o cere explicit.
- Fără cerere explicită în sarcina curentă NU rula: `git reset`, `git restore`, `git checkout` (pentru recuperarea fișierelor), `git clean`, `git stash`, `git rebase`, `git pull`, `git push`, `git commit`.
- La commit (doar când este cerut): `git add <fișiere>` explicit, niciodată `git add -A` / `git add .` / `git commit -a`.
- Push pe `main` = publicare pe GitHub Pages (D-020). Se tratează ca release (`docs/06_GIT_WORKFLOW.md`).

## 2. Conținutul real al aventurilor (D-034 — CONFIRMED)

Repository-ul este **public** (D-015). `content/` și `tests/fixtures/` conțin **numai** conținut de test / demo (`demo: true`, fictiv).

Conținutul real al jocurilor comerciale (poveste, traseu, locații, puzzle-uri, răspunsuri, indicii, coduri de partener, media):

- nu intră în repository, în commit-uri, în PR-uri, în `docs/`, în codul public sau pe GitHub Pages;
- nu se expune prin servere locale accesibile din rețea sau prin tuneluri publice fără decizia explicită a proprietarului;
- o sarcină care ar necesita acces la conținut real **nu** este autorizată implicit — întreabă.

`Claude outputs/` (ignorat de Git, D-044) conține surse sensibile, nu documentație publică. Nu copia nimic de acolo în fișiere versionate și nu cita conținutul real în răspunsuri care ajung în repository. Pentru sarcinile demo / fictive folosește numai conținut fictiv (coordonate lângă 0°, 0° ca în fixture-ul existent, fără afirmații istorice — D-011). Singura excepție autorizată este `content/adventures/demo-gps-brasov.json` (`demo: true`), care poate conține coordonate reale din Brașov, intenționat publice (D-068); D-068 nu autorizează alte aventuri reale sau alte coordonate reale.

## 3. Arhitectura și Engine V2

Engine V2 (schema V2, motorul, contractele dintre module, D-038 – D-049) este baseline-ul. Platform V1.1 (D-050 – D-067) este **decisă, dar neimplementată**.

Oprește-te și prezintă problema + opțiunile (fără să implementezi) dacă soluția ar cere:

- schimbarea arhitecturii, a schemei sau a contractelor dintre componente (ex. `map.js` / `map-model.js` / `location.js` / `geo.js` / `game.js` / `answers.js`);
- modificarea comportamentului Engine V2;
- schimbarea unei decizii documentate sau implementarea pe baza unei decizii `PROPOSED`;
- backend, autentificare, plăți, WebSocket, dependențe noi sau pas de build (D-018, D-019).

Nu „îmbunătăți” arhitectura doar pentru că vezi o posibilitate. Contradicțiile dintre documente se raportează; nu se rezolvă singur prin editarea documentației. În caz de neconcordanță, `docs/04_DECISIONS_LOG.md` are prioritate.

## 4. Capcane tehnice

- Motorul nu conține texte, id-uri sau logică specifice unei aventuri / rute / operator (test automat — D-038, D-051).
- Căi relative, niciodată cu `/` la început; chei persistente și cache-uri cu prefixul `outdoor-escape:` (D-035).
- Modul nou în `src/js/` → adăugat în `SHELL_FILES` din `src/sw.js` + `CACHE_VERSION` mărit; altfel aplicația nu pornește offline.
- `src/vendor/leaflet/` se păstrează byte cu byte (SHA-256 verificat de teste, D-046 / D-049-A).
- Doar `answers.js` citește răspunsurile (D-021); doar `location.js` atinge `navigator.geolocation` (D-045); doar `map.js` folosește Leaflet (D-047).
- Nu se salvează coordonatele jucătorului (D-043).
- GPS-ul nu poate bloca jucătorul: „Am ajuns” rămâne calea de rezervă (D-006).

## 5. Teste și raportare

- `npm test` (Node.js 20+, fără `npm install`, fără dependențe). Toate testele trebuie să rămână verzi.
- Nu raporta un test ca rulat dacă nu a fost rulat (`PASS` / `FAIL` / `NETESTAT`).
- Pentru schimbări semnificative raportează: ce s-a schimbat, de ce, fișiere, teste rulate, limitări, pasul următor (`docs/02_CLAUDE_PROJECT_INSTRUCTIONS.md`).
- Documentația nouă în română, UTF-8, diacritice cu virgulă (`ș`, `ț`), nu cu sedilă.
