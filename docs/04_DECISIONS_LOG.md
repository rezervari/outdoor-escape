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
Modul exact de publicare (ce folder se publică) este încă deschis — vezi D-020.

---

## D-015 — Vizibilitatea repository-ului
Status: CONFIRMED (2026-09-29)

Decizie:
Repository-ul GitHub este public.

Consecință:
Tot ce se află în repository poate fi citit de oricine, inclusiv conținutul jocului, dacă este pus în repository. Vezi D-021.

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

## D-020 — Structura publicării pe GitHub Pages
Status: PROPOSED

Context:
GitHub Pages poate publica rădăcina repository-ului, folderul `/docs` sau un artefact produs de un workflow GitHub Actions. `/docs` conține documentația. Structura din `03_ARCHITECTURE.md` are aplicația în `src/` și conținutul în `content/`, foldere separate.

Opțiuni:
- A. Publicarea rădăcinii repository-ului. Simplu, dar publică tot repository-ul, inclusiv `/docs`, iar aplicația ar fi la `/src/`.
- B. Un workflow GitHub Actions care publică doar `src/` și `content/`, fără pas de build (doar copiere). Păstrează structura, dar adaugă un fișier de workflow.
- C. Mutarea aplicației în rădăcină. Schimbă structura din `03_ARCHITECTURE.md`.

Recomandare Claude: B. De decis înainte de scheletul PWA.

---

## D-021 — Răspunsurile puzzle-urilor într-un repository și un site publice
Status: PROPOSED

Context:
Repository-ul este public (D-015), iar orice fișier publicat pe GitHub Pages poate fi descărcat. Dacă răspunsurile sunt în JSON-ul jocului, oricine le poate citi. Hash-ul în browser nu este o barieră de securitate.

Opțiuni:
- A. Acceptat pentru MVP/testare: răspunsurile pot fi găsite de cine le caută.
- B. Conținutul real al jocului este ținut în afara repository-ului public; în repository rămâne doar un joc de test.
- C. Validarea răspunsurilor pe server, într-o fază ulterioară (necesită backend — contrar D-019 acum).

Recomandare Claude: B pentru conținutul real + joc de test în repository; C reevaluat odată cu plățile. De decis înainte de Faza 4.

---

## D-022 — Licența conținutului și statutul documentației
Status: PROPOSED

Întrebări deschise:
- Conținutul rămâne „toate drepturile rezervate” (situația implicită actuală) sau primește o licență explicită?
- Documentația din `/docs` este acoperită de MIT (ca parte a proiectului software) sau este tratată ca și conținut? Unele documente (de exemplu `05_GAME_DESIGN_SPEC.md`) descriu conținutul jocului.
- Numele titularului drepturilor din `LICENSE` trebuie confirmat.

---

## D-023 — Tooling pentru teste automate și validarea documentației
Status: PROPOSED

Propunere:
Rularea de teste automate pentru logica motorului cu test runner-ul inclus în Node.js (`node --test`), fără dependențe în repository. Node ar fi doar unealtă de dezvoltare, nu parte din aplicație. Opțional: verificare automată a linkurilor din documentație.

Până la decizie: validare manuală (`07_TESTING.md`, secțiunea 17).

---

## D-024 — Normalizarea răspunsurilor
Status: PROPOSED

Context:
Literele românești `ș` și `ț` există în două codificări (cu virgulă și cu sedilă). Tastaturile telefoanelor pot produce oricare dintre ele. Un răspuns corect nu trebuie respins (defect critic, `07_TESTING.md` secțiunea 9).

De decis:
- ignorarea majusculelor;
- eliminarea spațiilor de la capete și a spațiilor multiple;
- tratarea diacriticelor (echivalare virgulă/sedilă; acceptarea răspunsurilor fără diacritice);
- numere scrise cu cifre sau cu litere;
- variante acceptate definite per puzzle, în conținut.

---

## D-025 — Cronometru și punctaj
Status: PROPOSED

De decis:
- cronometrul măsoară timpul total de la start sau se poate opri;
- valorile penalizărilor pentru indiciul 1, indiciul 2 și afișarea răspunsului;
- cum se afișează scorul final.

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

---

## D-030 — HINT_USED: eveniment, nu stare
Status: PROPOSED

Context:
`03_ARCHITECTURE.md` listează `HINT_USED` ca stare. Folosirea unui indiciu nu schimbă acțiunile posibile ale jucătorului (puzzle-ul rămâne activ).

Propunere:
Folosirea indiciilor se înregistrează ca date ale puzzle-ului (număr de indicii folosite, penalizare), în starea `PUZZLE_ACTIVE`. Lista stărilor din `03_ARCHITECTURE.md` nu a fost modificată; a fost adăugată doar o notă.

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
