# OUTDOOR ESCAPE — DECISIONS LOG

Use this file for decisions that should remain stable across development.

## D-001 — Product format
Status: CONFIRMED

Decision:
Build the product as a PWA Web-App.

Reason:
Mobile browser access avoids native app installation and reduces development/maintenance overhead.

---

## D-002 — Development platform
Status: CONFIRMED

Decision:
Use GitHub as the source of truth and Claude as the primary development environment.

---

## D-003 — Development model
Status: CONFIRMED

Decision:
The product will initially be developed by one person with AI assistance.

---

## D-004 — MVP technology direction
Status: CONFIRMED

Decision:
Prefer lightweight HTML/CSS/JavaScript PWA architecture before introducing a no-code platform or large framework.

---

## D-005 — Game engine
Status: CONFIRMED

Decision:
Build a reusable game engine rather than a one-off game.

---

## D-006 — GPS
Status: CONFIRMED

Decision:
GPS is an aid to progression and must not be the only recovery path.

---

## D-007 — Content architecture
Status: CONFIRMED

Decision:
Game content must be separated from engine code and represented as structured data where practical.

---

## D-008 — Payment timing
Status: CONFIRMED

Decision:
Payment automation is implemented after the core game loop is stable.

Target technology:
Stripe.

---

## D-009 — Initial city
Status: CONFIRMED

Decision:
The first game is designed for Brașov.

---

## D-010 — Initial game format
Status: WORKING TARGET

2–4 players.
90–120 minutes.
2.5–3.5 km.
8–10 locations.
7–9 puzzles.

These numbers can change after field testing.

---

## D-011 — Historical content
Status: CONFIRMED

Decision:
Real historical/architectural claims must be verified. Fictional story elements must not be presented as factual history.

---

## D-012 — Architecture change protocol
Status: CONFIRMED

Decision:
Claude must flag major architectural changes rather than silently implementing them.

---

## D-013 — Current stage
Status: CONFIRMED

Decision:
The project is currently at pre-development / specification stage.

Next milestone:
repository + context pack + product specification.

---

## Legendă stări (adăugată la 2026-09-29)

- `CONFIRMED` — decizie aprobată de proprietarul proiectului.
- `WORKING TARGET` — țintă de lucru, poate fi ajustată.
- `PROPOSED` — problemă deschisă. **Nu este aprobată.** Nu se implementează nimic pe baza ei până nu este marcată `CONFIRMED` de proprietar. Recomandările notate aici sunt ale lui Claude, nu decizii.

Cuvintele de stare rămân în engleză, pentru consecvență cu intrările D-001–D-013 și pentru a putea fi căutate ușor.

---

## D-014 — Găzduire
Status: CONFIRMED (2026-09-29)

Decizie:
Aplicația va fi găzduită pe GitHub Pages.

Notă:
Modul de publicare este stabilit în D-020 (GitHub Actions).

---

## D-015 — Vizibilitatea repository-ului
Status: CONFIRMED (2026-09-29)

Decizie:
Repository-ul GitHub este public.

Consecință:
Tot ce se află în repository poate fi citit de oricine, inclusiv conținutul jocului, dacă este pus în repository. Vezi D-021 și D-034.

---

## D-016 — Licențe
Status: CONFIRMED (2026-09-29)

Decizie:
- Codul sursă al aplicației este licențiat MIT (`LICENSE`).
- Conținutul jocurilor NU este licențiat MIT și trebuie să rămână identificabil separat ca și conținut al proiectului (`LICENSE-CONTENT.md`).

Rămâne deschis: vezi D-022.

---

## D-017 — Limba documentației
Status: CONFIRMED (2026-09-29)

Decizie:
Documentația proiectului se scrie în limba română.

Notă:
Documentele existente scrise în engleză nu au fost traduse încă. Vezi D-033.

---

## D-018 — Pas de build
Status: CONFIRMED (2026-09-29)

Decizie:
Nu există pas de build. Fișierele din repository sunt servite direct browserului.

---

## D-019 — Backend și plăți în faza actuală
Status: CONFIRMED (2026-09-29)

Decizie:
Nu se implementează backend și nici Stripe în faza actuală. Confirmă D-008 și regulile din `02_CLAUDE_PROJECT_INSTRUCTIONS.md`.

---

## D-020 — Publicarea pe GitHub Pages prin GitHub Actions
Status: CONFIRMED (2026-09-29)

Decizie:
- Aplicația se publică pe GitHub Pages printr-un workflow GitHub Actions.
- Repository-ul păstrează o structură normală și curată: `docs/`, `src/`, `content/`, `tests/` etc.
- Nu se introduce un framework de build doar pentru publicare (vezi D-018).
- Workflow-ul publică doar fișierele statice de care aplicația are nevoie (codul aplicației și conținutul jocurilor). Nu publică `docs/`, `tests/` sau alte fișiere de lucru.

Consecințe:
- Fișierul de workflow (în `.github/workflows/`) va fi creat odată cu scheletul PWA, nu în faza de documentație.
- În setările repository-ului (Settings → Pages), sursa de publicare va trebui setată pe „GitHub Actions”. Este un pas manual al proprietarului.
- Odată ce workflow-ul există, fiecare push pe `main` poate publica o versiune nouă a site-ului public (vezi `06_GIT_WORKFLOW.md`).
- Structura site-ului publicat și regulile pentru căi sunt stabilite în D-035.

Opțiuni analizate anterior: publicarea rădăcinii repository-ului; workflow GitHub Actions (aleasă); mutarea aplicației în rădăcină.

---

## D-021 — Validarea răspunsurilor la puzzle-uri
Status: CONFIRMED (2026-09-29)

Decizie:
- Pentru MVP, răspunsurile sunt verificate în browser (client-side).
- Se poate folosi hash pentru comparare/ascundere, dar hash-ul **nu** este o barieră de securitate.
- Motorul de joc trebuie proiectat astfel încât validarea răspunsurilor să poată fi mutată ulterior pe server fără rescrierea motorului.
- În faza de fundație nu se introduce backend și nici sistem de validare pe server (vezi D-019).

Consecințe pentru arhitectură (detaliate în `03_ARCHITECTURE.md`, secțiunea „Validarea răspunsurilor”):
- validarea este izolată într-un singur modul; restul motorului nu compară și nu citește direct răspunsurile;
- interfața modulului este asincronă, ca o implementare viitoare pe server să o poată înlocui;
- orice jucător hotărât poate afla răspunsurile din fișierele publicate; acesta este un risc acceptat pentru MVP.

Rămân deschise: normalizarea răspunsurilor (D-024), formatul exact al răspunsurilor în conținut (text sau hash, stabilit odată cu D-024) și locul în care stă conținutul real al jocului (D-034).

---

## D-022 — Licența conținutului și statutul documentației
Status: PROPOSED

Întrebări deschise:
- Conținutul rămâne „toate drepturile rezervate” (situația implicită actuală) sau primește o licență explicită?
- Documentația din `/docs` este acoperită de MIT (ca parte a proiectului software) sau este tratată ca și conținut? Unele documente (de exemplu `05_GAME_DESIGN_SPEC.md`) descriu conținutul jocului.
- Numele titularului drepturilor din `LICENSE` trebuie confirmat.

---

## D-023 — Tooling pentru teste automate și validarea documentației
Status: CONFIRMED (2026-09-29) — pentru testele motorului

Propunere:
Rularea de teste automate pentru logica motorului cu test runner-ul inclus în Node.js (`node --test`), fără dependențe în repository. Node ar fi doar unealtă de dezvoltare, nu parte din aplicație. Opțional: verificare automată a linkurilor din documentație.

Până la decizie: validare manuală (`07_TESTING.md`, secțiunea 17).

Notă (2026-09-29): la cererea proprietarului, odată cu motorul de joc v1, s-au adăugat teste `node --test` în `tests/` și un `package.json` fără dependențe (doar `"type": "module"` și `npm test`). Confirmat de proprietar (2026-09-29): se păstrează `node --test`, fără framework suplimentar de testare. Verificarea automată a linkurilor din documentație rămâne nedecisă.

---

## D-024 — Normalizarea răspunsurilor
Status: CONFIRMED (2026-09-29) — comportamentul actual

Context:
Literele românești `ș` și `ț` există în două codificări (cu virgulă și cu sedilă). Tastaturile telefoanelor pot produce oricare dintre ele. Un răspuns corect nu trebuie respins (defect critic, `07_TESTING.md` secțiunea 9).

De decis:
- ignorarea majusculelor;
- eliminarea spațiilor de la capete și a spațiilor multiple;
- tratarea diacriticelor (echivalare virgulă/sedilă; acceptarea răspunsurilor fără diacritice);
- numere scrise cu cifre sau cu litere;
- variante acceptate definite per puzzle, în conținut.

Notă (2026-09-29): implementare provizorie în `src/js/answers.js`, la cererea proprietarului: majuscule ignorate; spații de la capete eliminate și spații multiple reduse; diacritice eliminate (inclusiv variantele cu sedilă), deci și răspunsurile fără diacritice sunt acceptate. NU sunt implementate: numere în litere, variante per puzzle, eliminarea punctuației, fuzzy matching.

Confirmat de proprietar (2026-09-29): comportamentul actual se păstrează (majuscule ignorate, spații inutile ignorate, diacritice românești normalizate, `ş/ș` și `ţ/ț` echivalente, fără fuzzy matching). Rămân nedecise: numerele scrise în litere și variantele de răspuns per puzzle.

---

## D-025 — Cronometru și punctaj
Status: PROPOSED

De decis:
- cronometrul măsoară timpul total de la start sau se poate opri;
- valorile penalizărilor pentru indiciul 1, indiciul 2 și afișarea răspunsului;
- cum se afișează scorul final.

Notă (2026-09-29): motorul v1 calculează scorul ca sumă a punctelor provocărilor rezolvate corect, fără penalizări și fără cronometru. Sunt salvate `startedAt`/`completedAt` (timestamp-uri), fără afișare.

Notă tehnică: timpul trebuie calculat din momente salvate (timestamp), nu dintr-un contor care rulează în pagină, pentru că browserul poate suspenda pagina (vezi D-028).

---

## D-026 — Un telefon sau mai multe per echipă
Status: PROPOSED

Context:
Sincronizarea progresului între mai multe telefoane ale aceleiași echipe necesită un server (contrar D-019 acum).

Recomandare Claude: pentru MVP, un telefon principal per echipă; ceilalți jucători pot doar urmări.

---

## D-027 — Hărți: furnizor de tile-uri și includerea Leaflet
Status: PROPOSED

Context:
Serverele de tile-uri OpenStreetMap au o politică de utilizare care limitează folosirea intensivă sau comercială. Leaflet poate fi inclus direct în repository sau încărcat de pe un CDN; varianta locală funcționează mai bine offline.

De decis: dacă MVP-ul are nevoie de hartă, ce furnizor de tile-uri se folosește și cum se include Leaflet.

---

## D-028 — Comportament cu ecranul stins sau aplicația în fundal
Status: PROPOSED

Context:
Cu ecranul stins sau aplicația în fundal, browserele suspendă JavaScript și urmărirea GPS (în special pe iPhone).

De decis:
- timpul se calculează din timestamp-uri salvate;
- dacă se folosește Screen Wake Lock API pentru a ține ecranul aprins (consum de baterie);
- cum se reia GPS-ul la revenirea în aplicație.

---

## D-029 — Schema progresului salvat local
Status: PROPOSED

Propunere:
- progresul salvat include un număr de versiune a schemei, pentru migrări viitoare;
- câmpuri pregătite pentru sesiuni corporate (de exemplu `sessionId`, `teamId`, `eventId`), goale în MVP, fără infrastructură corporate;
- `localStorage` inițial (conform `03_ARCHITECTURE.md`).

Notă (2026-09-29): motorul v1 salvează progresul cu `schemaVersion: 1` (vezi `03_ARCHITECTURE.md`, secțiunea 3c). Câmpurile pentru sesiuni corporate NU au fost adăugate. Statusul rămâne PROPOSED.

Confirmat de proprietar (2026-09-29): cheia de stocare `outdoor-escape:game:<id>` (conformă cu D-035). Restul propunerii (versiunea schemei, câmpuri corporate) rămâne PROPOSED.

Notă (2026-09-29): versiunea schemei progresului și migrarea automată sunt acum decise în D-043 (`schemaVersion: 2`). Câmpurile corporate rămân PROPOSED.

---

## D-030 — HINT_USED: eveniment, nu stare
Status: PROPOSED

Context:
`03_ARCHITECTURE.md` listează `HINT_USED` ca stare. Folosirea unui indiciu nu schimbă acțiunile posibile ale jucătorului (puzzle-ul rămâne activ).

Propunere:
Folosirea indiciilor se înregistrează ca date ale puzzle-ului (număr de indicii folosite, penalizare), în starea `PUZZLE_ACTIVE`. Lista stărilor din `03_ARCHITECTURE.md` nu a fost modificată; a fost adăugată doar o notă.

Notă (2026-09-29): motorul v1 aplică deja această idee: indiciul este marcat `hintUsed` în progresul provocării, nu este o stare separată.

---

## D-031 — Metoda standard de testare pe telefon (HTTPS)
Status: PROPOSED

Opțiuni: vezi `10_LOCAL_DEVELOPMENT.md`, secțiunea 6 (GitHub Pages, redirecționare USB pentru Android, tunel HTTPS, certificat local, flag Chrome).

Recomandare Claude: redirecționare USB pentru testele rapide pe Android; GitHub Pages pentru iPhone și pentru testele de acceptanță.

---

## D-032 — Formatul codurilor de acces pentru MVP
Status: PROPOSED

De decis: formatul codurilor de test (lungime, caractere, fără caractere ușor de confundat precum `0`/`O`, `1`/`I`) și unde sunt păstrate. Validarea sigură a accesului plătit rămâne pe server, într-o fază ulterioară (`03_ARCHITECTURE.md`, secțiunea 6).

---

## D-033 — Traducerea documentelor existente în română
Status: PROPOSED

Context:
D-017 stabilește româna ca limbă a documentației. Documentele 00–09 și `README_CONTEXT_PACK.md` sunt încă în engleză; `04_DECISIONS_LOG.md`, `03_ARCHITECTURE.md` și `07_TESTING.md` conțin acum ambele limbi.

De decis: dacă și când se traduc documentele existente. Traducerea ar trebui făcută separat, fără schimbări de conținut, pentru a putea fi verificată ușor în diff.

Notă conexă: `README.md` și `.gitignore` au terminații de linie Windows (CRLF), iar documentele din `/docs` au terminații Unix (LF). Un fișier `.gitattributes` ar putea uniformiza acest lucru. De decis separat.

---

## D-034 — Conținutul real al jocului în repository-ul public
Status: PROPOSED

Context:
Repository-ul este public (D-015), iar validarea se face în browser (D-021). Dacă traseul, puzzle-urile și răspunsurile jocului real se află în repository, oricine le poate citi, fără să cumpere jocul. Această problemă făcea parte din vechea formulare a D-021 și nu a fost acoperită de decizia confirmată.

Opțiuni:
- A. Conținutul real stă în repository-ul public (risc de spoilere acceptat).
- B. În repository-ul public stă doar un joc de test; conținutul real stă separat (de exemplu într-un repository privat) și ajunge în site doar la publicare.
- C. Se decide mai târziu, înainte de Faza 4.

Notă: chiar și cu B, fișierele publicate pe GitHub Pages pot fi citite de oricine (D-021).

Recomandare Claude: B. De decis înainte de Faza 4 (integrarea jocului real).

---

## D-035 — Structura site-ului publicat, URL-uri și căi
Status: CONFIRMED (2026-09-29) — Varianta B

Decizie:
Site-ul publicat păstrează structura repository-ului. Aplicația și conținutul au aceeași poziție relativă local și online:

| | Producție (GitHub Pages) | Local |
| --- | --- | --- |
| Aplicația | `https://rezervari.github.io/outdoor-escape/src/` | `http://localhost:8000/src/` |
| Conținutul | `https://rezervari.github.io/outdoor-escape/content/...` | `http://localhost:8000/content/...` |

Reguli tehnice asociate (CONFIRMED):
1. Toate căile aplicației sunt relative. Nu se folosesc căi absolute care încep cu `/`.
2. Pentru MVP nu există routing bazat pe URL. Starea aplicației este gestionată intern; dacă va fi nevoie ulterior, se poate folosi hash routing (`#...`).
3. `localStorage`, Cache API și orice alte chei persistente au un prefix propriu proiectului (de exemplu `outdoor-escape:`).
4. Manifestul PWA și service worker-ul stau lângă `index.html`, în `src/`.
5. Nu se introduce build system doar pentru publicare (confirmă D-018 și D-020).
6. Workflow-ul GitHub Actions publică structura necesară fără transformări de căi.

Motivare pe scurt:
- Cu aceeași structură local și online, căile relative (de exemplu `../content/...` din `src/`) funcționează identic în ambele medii, fără cod care verifică mediul și fără transformări la publicare.
- Căile absolute ar indica spre `https://rezervari.github.io/...`, în afara proiectului (subfolderul `/outdoor-escape/` este impus de GitHub Pages).
- GitHub Pages nu poate redirecționa adrese inexistente către `index.html`; routing-ul bazat pe URL ar da 404 la reîncărcare.
- Domeniul `rezervari.github.io` este comun tuturor site-urilor GitHub Pages ale contului, deci stocarea, cache-ul și permisiunile sunt partajate; prefixul evită coliziunile.
- Cu manifestul și service worker-ul în `src/`, aplicația instalată pornește din `src/`, iar service worker-ul controlează paginile din `src/`. Poate păstra în cache și fișierele din `content/`.

Consecințe acceptate:
- URL-ul pentru jucători conține `/src/`. Codurile QR și linkurile trebuie să indice direct spre `.../outdoor-escape/src/`.
- Schimbarea ulterioară a adresei aplicației (alt folder sau domeniu propriu) ar face ca telefoanele să vadă o aplicație nouă. Progresul salvat și permisiunile nu s-ar transfera.

Stabilit ulterior:
- comportamentul adresei `https://rezervari.github.io/outdoor-escape/` (rădăcina) — vezi D-036.

Opțiuni analizate: A — aplicația în rădăcina site-ului (`.../outdoor-escape/`), cu căi diferite local și online; B — aceeași structură ca repository-ul (aleasă).

---

## D-036 — Comportamentul rădăcinii GitHub Pages
Status: CONFIRMED (2026-09-29)

Context:
D-035 publică aplicația la `/outdoor-escape/src/`. Fără un fișier în rădăcină, `https://rezervari.github.io/outdoor-escape/` ar da 404. GitHub Pages nu are redirecționări pe server.

Decizie:
- În rădăcina repository-ului există un `index.html`, publicat la `https://rezervari.github.io/outdoor-escape/`.
- `index.html` redirecționează automat către `/outdoor-escape/src/`.
- Redirecționarea folosește o cale relativă către `src/`.
- Se păstrează eventualii parametri de query și hash.
- Se folosește `location.replace()`, astfel încât rădăcina să nu rămână în istoricul „Back”.
- Se adaugă `meta refresh` ca rezervă.
- Se păstrează un link vizibil către `src/`, ca rezervă pentru cazul în care redirecționarea nu funcționează.
- `index.html` nu are manifest și nu înregistrează service worker.
- Fișierul este copiat neschimbat de workflow-ul GitHub Actions.
- Local, `http://localhost:8000/` are același comportament și redirecționează către `/src/`.
- Codurile QR, linkurile oficiale și instrucțiunile pentru jucători indică direct `/outdoor-escape/src/`.

Consecințe:
- `index.html` din rădăcină nu face parte din aplicație și nu conține logică de joc. Aplicația rămâne în `src/`.
- Workflow-ul publică, pe lângă `src/` și `content/`, și `index.html` din rădăcină (D-020, D-035).
- Rădăcina nu este controlată de service worker (care stă în `src/`, D-035), deci nu este garantat că funcționează offline. Acesta este motivul pentru care intrările oficiale indică direct `/src/`.
- Pagina nu poate fi instalată ca PWA (nu are manifest). Instalarea se face din `/src/`.
- Testele de efectuat după implementare: `07_TESTING.md`, secțiunea 20.

Opțiuni analizate: A — redirecționare (aleasă); B — pagină de intrare cu link; C — fără fișier în rădăcină (404).

---

## D-037 — Structura conținutului: `content/adventures/` sau `content/games/`
Status: CONFIRMED (2026-09-29)

Context:
`03_ARCHITECTURE.md` și instrucțiunile proiectului sugerează `content/games/game-001/` cu fișiere separate (`game.json`, `locations.json`, `puzzles.json`, `media/`). La cererea proprietarului, motorul v1 folosește un singur fișier per aventură: `content/adventures/<id>.json`. `content/games/` a rămas gol (doar `.gitkeep`).

De decis:
- denumirea: „adventure” sau „game” (în cod, conținut și documentație);
- un singur fișier per aventură sau un folder per aventură (`content/adventures/<id>/adventure.json` + `media/`), necesar când apar imagini;
- ștergerea lui `content/games/.gitkeep` după alegere.

Recomandare Claude (anterioară deciziei): folder per aventură (`content/adventures/<id>/adventure.json` + `media/`) și ștergerea lui `content/games/`.

Decizie (proprietar, 2026-09-29):
- se păstrează `content/adventures/<id>.json` (un fișier per aventură);
- conținutul nu se mută în `content/games/`.

Rămân deschise, pentru o etapă ulterioară: structura când apar media per aventură și soarta directorului gol `content/games/`.

---

## D-038 — Schema aventurii V2 și compatibilitatea cu V1
Status: CONFIRMED (2026-09-29) — D1

Decizie:
- Aplicația acceptă aventuri `schemaVersion: 1` și `schemaVersion: 2`.
- V1 este convertită în V2 **în memorie**, la încărcare (`upgradeV1ToV2` / `toAdventureV2` în `src/js/schema.js`); fișierul V1 nu se modifică.
- Aventura demo `content/adventures/brasov-centrul-vechi.json` rămâne V1 deocamdată.
- Schema V2: `meta`, `settings`, `narrator`, `audio`, `locations`, `missions`, `partners`, `secrets`, `events`, `finale`. Id-uri stabile, legate prin referințe verificate la validare. Câmpuri necunoscute permise; valori necunoscute din listele închise = erori.
- Motorul nu conține logică sau texte specifice unei aventuri (verificat de un test automat).

Specificație: `11_ADVENTURE_SCHEMA_V2.md`.

---

## D-039 — Modelul de locație și GPS
Status: CONFIRMED (2026-09-29) — D2

Decizie:
- Coordonate `{ lat, lng }` (WGS84, grade zecimale), distanțe și rază în metri.
- Valori implicite **configurabile** (nu fixate în motor), definite central în `src/js/defaults.js` și suprascrise per aventură în `settings.gps`: `defaultRadius` 40 m, `nearDistance` 150 m, `maxAccuracy` 60 m, `exitMargin` 20 m, `allowManualConfirmation` true.
- Precizie peste `maxAccuracy` → „uncertain” (nu declanșează nimic). „Inside” dacă distanța ≤ rază + min(precizie, rază/2). Histerezis cu `exitMargin` la ieșire.
- Confirmarea manuală („Am ajuns”) este rezerva standard (D-006).
- Motorul este **independent de Geolocation API**: primește observații (`reportPosition`) și produce tranziții/evenimente. GPS-ul browserului se implementează într-o etapă ulterioară.

Rămân deschise: validarea valorilor pe teren (Faza 5), comportamentul în fundal / ecran stins (D-028).

---

## D-040 — Limbajul evenimentelor
Status: CONFIRMED (2026-09-29) — D3

Decizie:
- Regulă = eveniment (`on`) + filtru simplu (`where`, egalitate) + acțiuni (`do`), din liste închise. Fără expresii și fără mini-limbaj de programare.
- `once` este true implicit; regulile rulate se salvează în progres.
- Reacțiile în lanț sunt limitate (`settings.events.maxChainDepth`, implicit 8, maxim 32) și există un plafon absolut per acțiune.
- Acțiunile sunt idempotente; `award_points` nu este permis în reguli repetabile.
- Motorul nu afișează și nu redă nimic: produce efecte pentru interfață.

Prioritate: predictibilitate și testabilitate.

---

## D-041 — Terminologie: „mission”
Status: CONFIRMED (2026-09-29) — D4

Decizie:
- În cod și în schema V2 se folosește `mission`.
- Textele prezentate jucătorului vin din conținut / interfață și se decid ulterior. Terminologia de produs nu se fixează în motor.

Notă: pentru compatibilitate, API-ul motorului păstrează numele V1 (`getCurrentChallenge`, `skipChallenge`, `ChallengeStatus`) ca alias-uri.

---

## D-042 — Fixture-uri de test
Status: CONFIRMED (2026-09-29) — D5

Decizie:
- Aventurile fictive folosite de teste stau în `tests/fixtures/` (ex. `adventure-v2-demo.json`).
- Nu se publică pe GitHub Pages: workflow-ul copiază doar `index.html`, `src/` și `content/` (verificat prin rularea locală a pasului de asamblare).

---

## D-043 — Progresul salvat V2 și migrarea automată
Status: CONFIRMED (2026-09-29) — D6

Decizie:
- Progresul salvat are `schemaVersion: 2`: `currentMissionId` (în locul lui `currentIndex`) și stări pe entități (misiuni, locații, parteneri, secrete, reguli rulate). Cheia rămâne `outdoor-escape:game:<id>`.
- Listele cerute de produs (misiuni rezolvate/eșuate/sărite, locații vizitate, secrete, evenimente declanșate) sunt **derivate** din aceste stări; scorul este derivat din conținut.
- Progresul `schemaVersion: 1` se migrează automat, fără a cere jucătorului să o ia de la zero.
- Nu se salvează coordonatele sau traseul jucătorului.

Forma completă și regulile de migrare: `11_ADVENTURE_SCHEMA_V2.md`, secțiunea 11.

---

## D-044 — Închiderea M-002: reguli confirmate
Status: CONFIRMED (2026-09-29)

Decizie (confirmată de proprietar după implementarea M-002):
- `src/sw.js`: modificarea din M-002 constă doar în adăugarea modulelor V2 (`defaults.js`, `events.js`, `geo.js`, `schema.js`) în `SHELL_FILES` și în trecerea `CACHE_VERSION` de la `v3` la `v4`. Strategia de cache nu s-a schimbat. Se păstrează.
- `pending` rămâne starea internă a unei misiuni disponibile (compatibilitate cu motorul V1 și cu progresul salvat).
- Se păstrează regulile introduse în M-002:
  - legătura partener ↔ misiune este verificată în ambele sensuri (`partner.missionId` ↔ `mission.partnerId`);
  - o misiune de tip `location` se rezolvă la sosire (GPS sau confirmare manuală);
  - o locație devine vizibilă (`unlocked`) când misiunea asociată devine activă;
  - o locație ascunsă (`hiddenUntilDiscovered`) nu apare în rezultatul `reportPosition` până la descoperire (este totuși evaluată, ca trecerea prin zonă să o poată descoperi).
- `Claude outputs/` (fișiere de lucru generate de Claude) este ignorat de Git.

Stare implementat / pregătit: `11_ADVENTURE_SCHEMA_V2.md`, secțiunea 0.


---

## D-045 — M-003.1: adaptorul Browser Geolocation
Status: PROPOSED (2026-09-29) — de confirmat de proprietar la review

Decizie propusă (implementată local, necomisă):
- `src/js/location.js` este singurul modul care atinge `navigator.geolocation`: `watchPosition`/`clearWatch`, fără porniri multiple, erori, retry, context securizat. Transformă poziția în `{ lat, lng, accuracy, timestamp }` și o transmite nemodificată; nu calculează distanțe, praguri sau tranziții. `geo.js` rămâne pur.
- Fluxul: `location.js` → `app.js` → `game.reportPosition(fix)` (contractul M-002, neschimbat), doar când jocul este „playing”. La start și la misiunea următoare, ultima poziție primită este retrimisă.
- Adăugare **aditivă** în `geo.js`: `assessFix(fix, gps)` — regula de precizie extrasă din `evaluateProximity` (care o folosește intern, comportament identic). Motiv: interfața trebuie să afișeze „semnal slab” și când nu există locații evaluate (ecranul de start, aventură fără locații), iar `reportPosition` nu acoperă aceste cazuri; fără `assessFix` pragul ar fi fost duplicat în UI.
- Opțiunile `watchPosition` (`enableHighAccuracy: true`, `timeout: 20000`, `maximumAge: 5000`) sunt în `defaults.js` (`DEFAULT_GEOLOCATION_OPTIONS`), separat de `settings.gps` al aventurii: țin de dispozitiv, nu de conținut.
- Urmărirea pornește doar prin „Activează locația” (după explicație), nu automat, nici după refresh. Se oprește la `pagehide`.
- Doar pagina activă. Fără fundal, geofencing, notificări, hartă (M-003.2).
- „Am ajuns” folosește `game.confirmArrival` (același `arrive` ca GPS-ul).

Detalii și limite: `11_ADVENTURE_SCHEMA_V2.md` (secțiunile 0 și 5), `07_TESTING.md` (secțiunea 24).
