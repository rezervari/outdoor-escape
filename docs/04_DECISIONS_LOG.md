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
- `SUPERSEDED` — decizie (sau problemă deschisă) înlocuită de o decizie ulterioară, indicată în status. Textul original se păstrează ca istoric; nu se mai aplică. (Adăugat la 2026-09-29, odată cu D-046.)

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

Constrângere (2026-09-30, D-059): pentru aventurile **Bike**, scorul nu poate recompensa viteza sau folosirea telefonului în mers. Orice variantă aleasă aici trebuie să permită dezactivarea timpului ca factor de scor per aventură. Tot aici se decide efectul în scor al unui bypass (D-061). Statusul rămâne PROPOSED.

---

## D-026 — Un telefon sau mai multe per echipă
Status: SUPERSEDED (2026-09-30) — înlocuită de D-054 (anterior: PROPOSED)

Notă (2026-09-30): D-054 decide ambele moduri, `shared_device` și `multi_device`. Un telefon principal per echipă rămâne un mod suportat (`shared_device`), dar nu mai este singura direcție. Observația de mai jos rămâne corectă: `multi_device` cere un server, deci se implementează doar odată cu backend-ul (D-019). Textul original se păstrează ca istoric.

Context:
Sincronizarea progresului între mai multe telefoane ale aceleiași echipe necesită un server (contrar D-019 acum).

Recomandare Claude: pentru MVP, un telefon principal per echipă; ceilalți jucători pot doar urmări.

---

## D-027 — Hărți: furnizor de tile-uri și includerea Leaflet
Status: SUPERSEDED (2026-09-29) — înlocuită de D-046 (anterior: PROPOSED)

Notă (2026-09-29): întrebările de mai jos (dacă MVP-ul are hartă, furnizorul de tile-uri, modul de includere a Leaflet) au primit răspuns în D-046: Leaflet 1.9.4 inclus local, fără CDN; OpenStreetMap standard tiles ca furnizor inițial, configurabil. Textul original se păstrează ca istoric.

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

Notă (2026-09-30): D-051 – D-053 introduc la nivel arhitectural identitatea de sesiune și participant (`sessionId`, `participantId`, echipa), nu doar pentru corporate. Forma exactă a progresului salvat cu sesiuni se decide la implementare, cu migrare automată (principiul D-043).

---

## D-030 — HINT_USED: eveniment, nu stare
Status: CONFIRMED (2026-09-30) — decizie restrânsă (anterior: PROPOSED)

Context:
`03_ARCHITECTURE.md` listează `HINT_USED` ca stare. Folosirea unui indiciu nu schimbă acțiunile posibile ale jucătorului (misiunea rămâne activă).

Propunere (restrânsă la confirmare, 2026-09-30):
Folosirea indiciilor se înregistrează ca date ale misiunii (numărul de indicii folosite), cât timp misiunea este `pending`, nu ca stare separată. Lista stărilor din `03_ARCHITECTURE.md` nu a fost modificată; a fost adăugată doar o notă. Formularea inițială includea și penalizarea și starea `PUZZLE_ACTIVE`; ambele au fost scoase din D-030 (penalizarea → D-025; `PUZZLE_ACTIVE` nu există în modelul implementat, echivalentul este misiunea `pending`).

Decizie (proprietar, 2026-09-30):
- Folosirea unui indiciu **nu** reprezintă o stare a jocului sau a misiunii (nu există `HINT_USED` ca stare).
- Numărul de indicii folosite se păstrează ca dată a misiunii: `hintsUsed` (întreg, în progresul misiunii).
- Folosirea unui indiciu generează evenimentul `hint_requested`.
- Penalizarea pentru folosirea indiciilor **nu** face parte din D-030; rămâne deschisă și se tratează separat în D-025 (PROPOSED).

Notă (2026-09-29; actualizată 2026-09-30): motorul aplică deja această decizie: `hintsUsed` este păstrat în progresul misiunii (V2; progresul V1 cu `hintUsed` este migrat automat la `hintsUsed`), iar fiecare dezvăluire emite `hint_requested`; indiciul nu este o stare separată. Nu există penalizare (D-025).

Extindere (proprietar, 2026-10-01) — confirmarea indiciului (TASK 4, vertical slice):

Regula de produs:
- Deschiderea unui indiciu este **ireversibilă**: un indiciu deschis rămâne deschis pentru acea misiune (`hintsUsed` doar crește).
- Un indiciu se deschide **numai după o confirmare explicită** a jucătorului. Nicio acțiune nu consumă un indiciu fără confirmare.
- Indiciile se deschid pe rând, în ordinea din conținut, până la numărul de indicii definit de aventură (`mission.hints`); peste această limită nu se mai deschide nimic.
- Indiciile se pot cere doar cât timp misiunea este `pending`. Indiciile deja deschise rămân vizibile cât timp misiunea este activă.

Comportamentul interfeței:
- „Arată indiciul” nu deschide indiciul: afișează confirmarea, care spune că deschiderea este ireversibilă și că jucătorul poate renunța.
- Confirmarea se închide fără consum prin „Renunță”, prin tasta Escape și prin butonul Back al telefonului / browserului (D-035, precizarea U2).
- Butonul „Arată indiciul” apare doar dacă mai există un indiciu de deschis; după ultimul, indiciile deschise rămân afișate, fără buton.
- Confirmarea este stare de interfață, efemeră: nu se salvează și nu revine după reîncărcare.

Relația cu motorul:
- Numai confirmarea finală apelează `game.requestHint(missionId)` (→ `hintsUsed + 1`, `hint_requested`). Afișarea confirmării și anularea ei (Renunță / Escape / Back) **nu** modifică starea motorului.
- Ce indicii sunt deschise se derivă exclusiv din `hintsUsed`, inclusiv după reîncărcare; interfața nu păstrează o copie proprie.
- Penalizarea rămâne în afara D-030 (D-025, PROPOSED).

---

## D-031 — Metoda standard de testare pe telefon (HTTPS)
Status: CONFIRMED (2026-10-01) (anterior: PROPOSED)

Opțiuni: vezi `10_LOCAL_DEVELOPMENT.md`, secțiunea 6 (GitHub Pages, redirecționare USB pentru Android, tunel HTTPS, certificat local, flag Chrome).

Recomandare Claude (la propunere): redirecționare USB pentru testele rapide pe Android; GitHub Pages pentru iPhone și pentru testele de acceptanță.

Decizie (proprietar, 2026-10-01; odată cu D-069 — TASK 5):
- **Metoda standard** pentru testele pe telefon (inclusiv Field Test 2) este versiunea publicată pe GitHub Pages (HTTPS, `https://rezervari.github.io/outdoor-escape/src/`, D-035).
- **Android:** se testează versiunea publicată. USB / ADB se folosește doar pentru depanare și consolă (`chrome://inspect`); nu este metoda standard de acces pentru testele pe teren.
- **iPhone / Safari:** testarea se face exclusiv prin URL-ul HTTPS publicat pe GitHub Pages.
- **Tunelul HTTPS către serverul local (varianta C) nu se folosește:** serverul local servește rădăcina repository-ului (`10_LOCAL_DEVELOPMENT.md`, secțiunea 4) și ar expune fișiere care nu trebuie publicate (inclusiv `Claude outputs/` — D-034, D-044).
- Testele pe teren (Field Test 2) testează versiunea publicată, nu serverul local. Publicarea înseamnă push pe `main` și se tratează ca release (D-020, `06_GIT_WORKFLOW.md`).

Notă: Field Test 1 (`07_TESTING.md` §27.3) a fost făcut înainte de această decizie, prin redirecționare USB (varianta B); rezultatul lui rămâne valabil așa cum a fost consemnat.

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

Notă (2026-09-30) — situația actuală a terminațiilor de linie (nota conexă de mai sus rămâne ca istoric; nu mai este factuală):
- Repository-ul stochează fișierele text cu LF (inclusiv `README.md` și `.gitignore`).
- Pe Windows, `core.autocrlf=true` poate produce CRLF în working tree și avertismentele Git „LF will be replaced by CRLF”; acestea sunt locale și nu schimbă conținutul stocat.
- `src/vendor/leaflet/**` rămâne protejat intenționat prin `.gitattributes` (`-text -diff`), ca fișierele Leaflet să rămână identice byte cu byte (D-046, D-049-A).
- În acest moment nu există o problemă funcțională; o decizie privind uniformizarea globală a terminațiilor de linie nu este necesară pentru UI/UX și rămâne, eventual, de luat separat.

---

## D-034 — Conținutul real al jocului în repository-ul public
Status: CONFIRMED (2026-09-30) — Varianta B (anterior: PROPOSED)

Context:
Repository-ul este public (D-015), iar validarea se face în browser (D-021). Dacă traseul, puzzle-urile și răspunsurile jocului real se află în repository, oricine le poate citi, fără să cumpere jocul. Această problemă făcea parte din vechea formulare a D-021 și nu a fost acoperită de decizia confirmată.

Opțiuni:
- A. Conținutul real stă în repository-ul public (risc de spoilere acceptat).
- B. În repository-ul public stă doar un joc de test; conținutul real stă separat (de exemplu într-un repository privat) și ajunge în site doar la publicare.
- C. Se decide mai târziu, înainte de Faza 4.

Notă: chiar și cu B, fișierele publicate pe GitHub Pages pot fi citite de oricine (D-021).

Recomandare Claude: B. De decis înainte de Faza 4 (integrarea jocului real).

Decizie (proprietar, 2026-09-30) — Varianta B:
- Repository-ul public conține **doar** jocuri / conținut de test și demo.
- Conținutul real al jocurilor comerciale (poveste, traseu, locații, puzzle-uri, răspunsuri, indicii, coduri de partener, media) este păstrat **separat** de repository-ul public și este introdus în producție **doar la publicare**.
- **Limită explicită:** orice conținut publicat efectiv pe GitHub Pages poate fi citit de oricine (D-021). Separarea protejează conținutul real **înainte** de publicare (în repository, în istoricul Git, în pull request-uri), **nu după** publicare.

Regula tehnică rezultată:
- `content/` din repository-ul public = **numai** conținut de test / demo (marcat `demo: true`; fără traseu, răspunsuri sau coduri reale). Fixture-urile din `tests/fixtures/` rămân fictive (D-042).
- Conținutul real al jocurilor = sursă separată, **neversionată** în repository-ul public.

Nu se decid și nu se implementează acum: forma sursei separate (de exemplu un repository privat), mecanismul prin care conținutul real ajunge în producție la publicare și managementul conținutului real. Acestea se stabilesc printr-o decizie ulterioară, înainte de integrarea jocului real (Faza 4). Codul aplicației nu se schimbă prin această decizie.

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

Precizare (proprietar, 2026-10-01) — butonul Back (U2, TASK 4):

Comportament (pentru jucător):
- Back închide stratul de interfață deschis cel mai de sus, în ordinea: (1) confirmarea indiciului, (2) overlay-ul puzzle-ului. Un Back închide un singur strat.
- Închiderea unui strat prin Back are același efect ca butonul lui de închidere („Renunță”, „Închide”): **nu** modifică starea jocului (misiune, scor, indicii, progres salvat). Puzzle-ul închis rămâne activ și poate fi redeschis.
- Dacă nu este deschis niciun strat, Back are comportamentul normal al browserului.
- URL-ul nu se schimbă.

Mecanism:
- Se folosește History API al browserului: fiecare strat deschis are o intrare internă în istoric, fără URL nou și fără rută nouă. Aceasta **nu** este routing bazat pe URL: regula 2 rămâne valabilă.
- Starea de navigare a straturilor nu este stare de joc: nu ajunge în motor și nu se salvează în `localStorage`.
- Detaliile tehnice: `03_ARCHITECTURE.md`, secțiunea 3c.

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

Notă (2026-09-30): rămâne valabilă și în Platform V1.1. „Eventuala poziție GPS” a unei sesiuni și monitorizarea live (FUTURE) cer o decizie separată de confidențialitate înainte de orice implementare (`13_PLATFORM_V1.1.md` §15.3). Sincronizarea transmite fapte (ex. sosirea la un checkpoint), nu coordonate (`15_SESSION_SYNC.md` §3.2).

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
Status: CONFIRMED (2026-09-29) — implementată și validată în M-003.1 (comisă și publicată: „feat: integrate browser geolocation”)

Istoric: înregistrată inițial ca PROPOSED („de confirmat de proprietar la review”), când implementarea era doar locală și necomisă. Confirmată de proprietar după review-ul, testarea și publicarea M-003.1. Conținutul deciziei de mai jos este neschimbat.

Decizie (formularea din momentul propunerii):
- `src/js/location.js` este singurul modul care atinge `navigator.geolocation`: `watchPosition`/`clearWatch`, fără porniri multiple, erori, retry, context securizat. Transformă poziția în `{ lat, lng, accuracy, timestamp }` și o transmite nemodificată; nu calculează distanțe, praguri sau tranziții. `geo.js` rămâne pur.
- Fluxul: `location.js` → `app.js` → `game.reportPosition(fix)` (contractul M-002, neschimbat), doar când jocul este „playing”. La start și la misiunea următoare, ultima poziție primită este retrimisă.
- Adăugare **aditivă** în `geo.js`: `assessFix(fix, gps)` — regula de precizie extrasă din `evaluateProximity` (care o folosește intern, comportament identic). Motiv: interfața trebuie să afișeze „semnal slab” și când nu există locații evaluate (ecranul de start, aventură fără locații), iar `reportPosition` nu acoperă aceste cazuri; fără `assessFix` pragul ar fi fost duplicat în UI.
- Opțiunile `watchPosition` (`enableHighAccuracy: true`, `timeout: 20000`, `maximumAge: 5000`) sunt în `defaults.js` (`DEFAULT_GEOLOCATION_OPTIONS`), separat de `settings.gps` al aventurii: țin de dispozitiv, nu de conținut.
- Urmărirea pornește doar prin „Activează locația” (după explicație), nu automat, nici după refresh. Se oprește la `pagehide`.
- Doar pagina activă. Fără fundal, geofencing, notificări, hartă (M-003.2).
- „Am ajuns” folosește `game.confirmArrival` (același `arrive` ca GPS-ul).

Detalii și limite: `11_ADVENTURE_SCHEMA_V2.md` (secțiunile 0 și 5), `07_TESTING.md` (secțiunea 24).

---

## D-046 — Tehnologia hărții
Status: CONFIRMED (2026-09-29) — înlocuiește D-027

Decizie:
- Motorul de hartă este **Leaflet**, versiune fixată **1.9.4** (pin exact; o versiune nouă cere o decizie nouă).
- Leaflet este **inclus local** în repository, **fără CDN** și fără pas de build (D-018).
- Providerul de tile-uri este **configurabil** (configurație, nu cod de joc). Providerul inițial: **OpenStreetMap standard tiles** (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`).
- **Atribuirea obligatorie** a providerului este afișată vizibil pe hartă, permanent.
- Fără API key pentru implementarea inițială.
- Fără hărți offline, fără prefetch, fără descărcare în bloc (bulk download) de tile-uri.
- Harta este **strat de vizualizare / orientare**. Nu influențează progresul jocului. Nu există routing și nici navigație turn-by-turn.
- Providerul trebuie să poată fi schimbat ulterior **fără modificarea logicii jocului**.
- Dacă harta sau providerul de tile-uri nu funcționează, jocul continuă să funcționeze ca în M-003.1 (GPS, cardul obiectivului, „Am ajuns”).
- Nu se modifică algoritmul GPS și nici schema locațiilor.

Constrângere operațională (politica OpenStreetMap pentru tile-uri — nu este logică de joc):
- atribuire vizibilă și neacoperită;
- tile-urile standard sunt folosite doar pentru utilizare interactivă normală: se cer doar tile-urile zonei privite de jucător;
- fără prefetch, fără bulk download, fără stocare offline de tile-uri; nu se construiește niciun mecanism care descarcă preventiv o zonă (nici în service worker);
- cache-ul HTTP al browserului respectă headerele providerului: fără parametri anti-cache, fără `Cache-Control: no-cache`; service worker-ul nu interceptează tile-urile;
- browserul trimite Referer-ul implicit: nu se setează o `Referrer-Policy` restrictivă;
- serviciul OSM standard nu are garanții de disponibilitate (SLA); înainte de o lansare comercială, providerul se reevaluează, doar prin configurație.

---

## D-047 — Contractul modulului `map.js`
Status: CONFIRMED (2026-09-29)

Decizie:
`src/js/map.js` este **exclusiv strat vizual**: singurul modul care folosește Leaflet și desenează modelul primit (D-048).

API:

```js
createMap({ container, tileConfig })   // întoarce instanța hărții

updatePlayer(fix, quality)
updateLocations(locations)
setCurrentObjective(locationId)
fitToAdventure(locations)
centerOnPlayer()
destroy()
```

`map.js`:
- nu accesează `navigator.geolocation`;
- nu apelează `game.reportPosition()`;
- nu apelează `game.confirmArrival()`;
- nu interpretează stările GPS (`near`, `inside`, `arrived`, `outside`, calitatea poziției): le primește deja traduse și doar le desenează;
- nu conține logică de progres;
- nu conține reguli de business (praguri, distanțe, rază implicită).

`geo.js` și `game.js` rămân sursele de adevăr pentru GPS și progres; `location.js` rămâne singurul modul care atinge `navigator.geolocation` (D-045).

Precizări aprobate în D-049: metodele aparțin instanței întoarse de `createMap`; `createMap` acceptă opțional `view` și `leaflet` (injectabil pentru teste) și aruncă `MapError` (`leaflet_unavailable` | `invalid_container` | `invalid_tile_config`).

---

## D-048 — Modelul vizual transmis hărții
Status: CONFIRMED (2026-09-29)

Decizie:
Harta primește doar acest model:

```js
{
  player: {
    fix: { lat, lng, accuracy, timestamp },   // sau null
    quality                                   // "valid" | "weak" | "uncertain" | "none"
  },
  locations: [
    { id, name, lat, lng, radius, state, visible }
  ],
  currentObjectiveId                          // sau null
}
```

- Modelul este construit de `src/js/map-model.js`, modul pur, care **traduce** stările existente ale motorului și ale adaptorului de locație. Nu calculează nimic GPS.
- `map.js` nu devine sursă de adevăr: nu deduce stări, nu păstrează progres, nu modifică jocul.
- Calitatea GPS este **tradusă din starea existentă** (M-003.1). Nu se introduce nicio regulă GPS nouă. Corespondența exactă este fixată în D-049.
- `distanceMeters` **nu face parte** din contractul hărții în M-003.2.
- Nu se transmit către `map.js`: `game`, `geo`, `location.js`, `navigator.geolocation`, reguli GPS sau formule de distanță.

---

## D-049 — Comportamentul vizual și UX al hărții (Map V1)
Status: CONFIRMED (2026-09-29) — specificație aprobată; implementarea M-003.2 a fost făcută și comisă (`39a6b28`, „feat: implement M-003.2 map”) și trimisă în review-ul proprietarului (actualizat 2026-09-30; anterior: „implementarea M-003.2 NU a început”). **M-003.2 ACCEPTAT și ÎNCHIS de proprietar la 30.09.2026** (review manual finalizat; testul pe telefon cu locații reale rămâne amânat conform D-049-M, nu este un criteriu ratat)

Specificația completă (cu cele 30 de criterii de acceptare): [`12_MAP_SPECIFICATION_M-003.2.md`](12_MAP_SPECIFICATION_M-003.2.md). Propunerea originală (`Claude outputs/PROPUNERE_D-049_MAP_V1.md`, ignorată de Git, D-044) rămâne doar ca artefact local istoric. Deciziile esențiale sunt rezumate mai jos.

Alegerile proprietarului: D-049-C → `uncertain`; D-049-D → R2; celelalte (A…M) în forma din revizia 2.

Decizii:
- **A — Leaflet:** 1.9.4, inclus local în `src/vendor/leaflet/` (`leaflet.js`, `leaflet.css`, `LICENSE`), încărcat cu `<script defer>` înainte de `app.js`, adăugat în `SHELL_FILES` al service worker-ului. Versiunea și suma SHA-256 se notează în `03_ARCHITECTURE.md` la implementare.
- **B — Stările locațiilor** (traducere 1:1 din progresul motorului, în ordine):
  `completed` → `completed`; `discovered` sau `arrivedAt` setat → `arrived`; `unlocked` + prezență `near` → `near`; `unlocked` → `available`; `locked` → `locked` cu `visible: false`. O locație descoperită printr-un eveniment, fără sosire fizică, apare ca `arrived`.
- **C — Calitatea GPS** (traducere 1:1 din `LocationDisplay`, rezultatul existent `describeLocation(trackerState, geo.assessFix(...))`):
  `gps-ready` → `valid`; `gps-uncertain` → **`uncertain`** (termenul final); `gps-off` / `gps-unavailable` / `gps-permission-denied` / `gps-searching` / `gps-error` → `none`. `weak` rămâne valoare validă a contractului D-048, dar **nu este produsă în V1** (M-003.1 nu are o astfel de stare); dacă apare, se desenează ca `uncertain`. Textul pentru jucător rămâne „Semnal GPS slab”.
- **C2 — Ultima poziție reținută:** `player.fix` este exact ultima observație pe care `location.js` o reține deja. Dacă `quality` este `none`, dar există un fix (ex. `gps-error` după o poziție primită), harta îl arată ca punct gri „ultima poziție”, fără cerc de acuratețe. Este **doar comportament vizual**, nu o stare GPS: nu schimbă `quality`, progresul sau evenimentele. Harta nu folosește `timestamp` pentru nicio decizie.
- **D — Raza:** raza efectivă desenată **provine din motor**, nu din `map-model.js` sau `map.js` (care nu aplică valori implicite). Varianta aleasă: **R2** — la implementare, `geo.js` primește un export **aditiv** `effectiveRadius(location, gps)`, folosit intern de `evaluateProximity` (comportament identic, ca precedentul `assessFix` din D-045). `game.js` îl expune aditiv ca `getLocation(id).radiusMeters`. Algoritmul GPS nu se schimbă. Copia preexistentă din validarea din `schema.js` rămâne în afara M-003.2.
- **E — Schimbarea obiectivului:** o singură recentrare (încadrare pe noul obiectiv + jucător, dacă există poziție), chiar dacă utilizatorul făcuse pan. Fix-urile GPS ulterioare actualizează doar markerul.
- **F — Poziția în ecran (revizuită 2026-10-01, TASK 4 / U1 — map-first):**
  - Pe ecranul de joc, harta este **suprafața principală**: stă imediat după antetul de progres, înaintea conținutului misiunii, și ocupă cea mai mare parte a ecranului vizibil. Pe telefon ocupă toată lățimea.
  - Cardul obiectivului (nume, stare, instrucțiuni, „Am ajuns” și acțiunea de după sosire) este **suprapus peste hartă**. Cardul și containerul hărții sunt elemente surori; cardul **nu** este introdus în containerul Leaflet (Leaflet controlează exclusiv conținutul containerului), iar contractul `map.js` (D-047) nu se schimbă.
  - Dacă harta nu există sau nu poate fi creată, cardul revine în fluxul normal al paginii (jocul funcționează fără hartă).
  - În timpul overlay-ului puzzle-ului, harta rămâne montată (nu este ascunsă sau distrusă), vizibilă sub overlay și inactivă (nu primește atingeri sau focus).
  - Atribuirea OpenStreetMap rămâne permanent vizibilă și neacoperită de card (D-046).
  - „Centrează pe mine”, „Vezi obiectivele” și textele despre poziție / GPS rămân sub hartă, în afara ei.
  - Înălțimea hărții este responsive, legată de viewport; valorile exacte pe breakpoint-uri sunt o specificație tehnică ulterioară și nu fac parte din această decizie. Rămâne valabil criteriul 27 din `12_MAP_SPECIFICATION_M-003.2.md` (la 360×640 px, „Am ajuns” vizibil fără derulare; harta ≥ 200 px; butoane ≥ 48 px).
  - **Deschis (U1b):** cardul poate acoperi parțial harta, inclusiv obiectivul, pe ecrane mici. Încadrarea hărții care ține cont de card nu este decisă; o soluție care ar cere modificarea contractului `map.js` (D-047) necesită o decizie separată.
  - *Formularea anterioară (2026-09-29, înlocuită la 2026-10-01):* „după cardul obiectivului, înălțime `clamp(200px, 40vh, 360px)`. Butoanele «Centrează pe mine» și «Vezi obiectivele» stau sub hartă, în afara ei.”
- **G — „Centrează pe mine”:** o singură centrare, **fără urmărire continuă**. Harta nu se mișcă niciodată la un fix GPS obișnuit.
- **H — Locațiile `locked`** (inclusiv `hiddenUntilDiscovered`) nu sunt afișate niciodată.
- **I — Precizie > 1000 m:** cercul de acuratețe nu se desenează. Este o limită doar de desen, fără efect asupra jocului. Cercul de acuratețe nu influențează niciodată zoom-ul.
- **J — Configurația hărții** este în `defaults.js` (`DEFAULT_MAP_TILES`, `DEFAULT_MAP_VIEW`), nu în `settings` / schema aventurii.
- **K — Harta apare** doar pe ecranul de joc și doar când aventura are cel puțin o locație.
- **L — `map-model.js`** este modul pur de transformare, testat cu `node --test`. `leaflet` este injectabil în `createMap`, pentru teste fără dependențe.
- **M — Testare:** testele automate (`node --test`) și testarea automată în Chromium (geolocație emulată, fixture copiat temporar doar în copia servită local, ca `07_TESTING.md` §24.2) fac parte din M-003.2. Testarea pe telefon cu o aventură reală cu locații este **amânată**: cere conținut cu coordonate reale, în afara M-003.2.

Principiu general: harta **nu afectează progresul**. Cercul obiectivului este doar reprezentare vizuală; sosirea este decisă exclusiv de `geo.js` / `game.js`, iar „Am ajuns” rămâne rezerva (D-006).

Fișiere de modificat la implementare: `src/js/map.js` (nou), `src/js/map-model.js` (nou), `src/vendor/leaflet/` (nou), `src/index.html`, `src/css/app.css`, `src/js/app.js`, `src/js/defaults.js`, `src/sw.js` (`CACHE_VERSION` `v6`), `src/js/game.js` (doar `radiusMeters`, aditiv), `src/js/geo.js` (doar `effectiveRadius`, aditiv), teste noi (testele existente rămân nemodificate), documentația.

---

## D-050 — Outdoor Escape Platform V1.1: produse
Status: CONFIRMED (2026-09-30) — arhitectural; neimplementat

Decizie:
- Platforma are două produse publice planificate care folosesc **același motor**: **Walk** (`walk.outdoor-escape.ro`, aventuri pietonale, inițial în Brașov) și **Bike** (`bike.outdoor-escape.ro`, aventuri cu bicicleta, primul operator: Funsy Bike).
- **AR** nu este produs separat, ci o capabilitate transversală viitoare, utilizabilă în Walk și Bike.
- Diferențele Walk / Bike vin din configurația aventurii (profil GPS, reguli de siguranță), nu din cod separat (D-005).

Neschimbat: aplicația rămâne la adresa din D-035. Data și modul mutării pe subdomenii nu sunt decise; consecințele D-035 (altă origine = aplicație nouă, fără progres și permisiuni transferate) se aplică.

Documentul principal: [`13_PLATFORM_V1.1.md`](13_PLATFORM_V1.1.md).

---

## D-051 — Modelul de domeniu: Route, Adventure, Session, Pass, roluri
Status: CONFIRMED (2026-09-30) — arhitectural; neimplementat

Decizie:
- **Route ≠ Adventure.** Ruta este infrastructura geografică; aventura este experiența construită peste o rută. Aceeași rută poate găzdui mai multe aventuri.
- **Adventure ≠ Adventure Session.** Aventura este definiția jocului; sesiunea este o rulare concretă de către o echipă. Aceeași aventură poate avea simultan oricâte sesiuni, fiecare cu echipă, participanți, progres, răspunsuri, indicii, checkpoint, stare, timpi și evenimente proprii.
- **Buyer ≠ Team Leader ≠ Participant.** Roluri distincte conceptual; pot coincide, dar nu obligatoriu.
- **Adventure Pass** = dreptul de acces la o participare. Model: Purchase / Booking → Adventure Pass → Adventure Session → Team → Participants. Plățile și rezervările rămân viitoare (D-008, D-019); arhitectura trebuie să permită modelul.
- Motorul nu conține referințe la Funsy Bike, Circuitul Șirnea sau altă rută / operator (extinde regula din D-038).

Stare în cod: există doar aventura (fișier JSON) și o sesiune locală implicită, una per aventură per browser (`outdoor-escape:game:<id>`).

---

## D-052 — Lifecycle-ul sesiunii și al echipei
Status: CONFIRMED (2026-09-30) — arhitectural; neimplementat

Decizie:
- Sesiune: `CREATED`, `TEAM_FORMING`, `READY`, `LOCKED`, `ACTIVE`, `PAUSED`, `COMPLETED`, `ABANDONED`, `EXPIRED`, `CANCELLED`. Nu toate trebuie implementate deodată.
- Echipă: `TEAM FORMING → READY → LOCKED → ACTIVE → COMPLETED`, plus stări de excepție.
- După `LOCKED`: nu mai intră participanți noi; invite link-ul nu creează o altă sesiune; încercările ulterioare de join sunt tratate explicit.
- Stările jocului implementate (`idle → playing → completed`) rămân neschimbate până la implementare.

Rămân deschise: parametrii de timp (`EXPIRED`, `PAUSED`), lista stărilor de excepție ale echipei. Sursa unică a stării: închisă de D-064 (Session; stările echipei sunt derivate).

---

## D-053 — Session Continuity, Rejoin și Team Leader
Status: CONFIRMED (2026-09-30) — cerință arhitecturală obligatorie; parțial implementat (doar continuitatea locală)

Decizie:
- Închiderea accidentală a browserului, a tab-ului sau a aplicației **nu** înseamnă părăsirea aventurii. Sesiunea rămâne activă; la revenire se restaurează sesiunea, echipa, identitatea, rolul, progresul, checkpoint-ul și provocarea curentă, starea jocului, indiciile și evenimentele relevante.
- Nu ne bazăm exclusiv pe `localStorage`. Arhitectura permite un rejoin persistent: link personal de rejoin, cod de recuperare sau o combinație.
- Rejoin-ul duce la sesiunea existentă; nu creează niciodată o sesiune nouă.
- Team Leader-ul nu este single point of failure; sesiunea continuă fără el. Arhitectura permite ulterior transferul rolului.

Implementat azi: continuitatea în același browser (reload / închidere — `tests/persistence-reload.test.js`). Rejoin pe alt browser / telefon: cere backend (FUTURE, D-019).

Rămân deschise: formatul exact al codului de recuperare (legat de D-032); regulile transferului automat al rolului. Mecanismul de rejoin: închis de D-065 (link personal + cod de recuperare).

---

## D-054 — Shared Team State; `shared_device` și `multi_device`
Status: CONFIRMED (2026-09-30) — arhitectural; neimplementat — înlocuiește D-026

Decizie:
- Toți participanții aceleiași echipe aparțin aceleiași sesiuni și văd aceeași stare logică (ex. o provocare rezolvată de A deblochează checkpoint-ul următor și pentru B).
- Un indiciu folosit se reflectă pentru toată echipa atunci când aventura îl definește ca `shared`.
- O aventură poate suporta modurile `shared_device` (un telefon conduce experiența) și `multi_device` (fiecare participant pe propriul dispozitiv, aceeași stare comună).
- Nu se presupune că Leader-ul este singurul care poate rezolva provocări.

Consecință: `multi_device` cere un serviciu de sincronizare persistent (backend, FUTURE). Până atunci, singurul mod funcțional este `shared_device`.

---

## D-055 — Sincronizarea stării
Status: CONFIRMED (2026-09-30) — arhitectural; neimplementat

Decizie:
- Direcția: UI local → optimistic update → coadă locală de evenimente → HTTP sync / short polling → stare persistentă a sesiunii.
- WebSocket **nu** este cerință V1; poate fi introdus ulterior doar dacă este justificat.
- Mecanismul trebuie să permită: retry, protecție la evenimente duplicate (idempotență pe `event_id`), consistență eventuală, reconectare, sincronizare după revenirea conexiunii.

Specificație: [`15_SESSION_SYNC.md`](15_SESSION_SYNC.md).

---

## D-056 — Offline First și Adventure Package
Status: CONFIRMED (2026-09-30) — arhitectural; neimplementat

Decizie:
- Outdoor Escape se proiectează offline-capable, nu „online cu fallback”.
- Înainte de START (cu conectivitate bună): `READY / LOCKED → CONTENT DOWNLOAD → VALIDATE PACKAGE → CACHE READY → START`.
- Pachetul (identificat prin `adventure_id` + `version`) conține conținutul aventurii și al provocărilor, imagini, audio, instrucțiuni, geometria rutei și geofence-urile, alte asset-uri necesare.
- **Tile-urile OpenStreetMap standard nu fac parte din pachet** (alegerea proprietarului, 2026-09-30): D-046 rămâne neschimbată (fără prefetch, bulk download sau stocare offline de tile-uri). Fără conexiune, harta poate rămâne fără fundal; jocul nu depinde de ea.
- Cache-ul este limitat la zona și resursele aventurii.
- Fără internet în timpul jocului: GPS → motor local → stare locală → coadă locală; la revenire: sincronizare.

Stare în cod: service worker network-first pentru shell, Leaflet local și aventura demo (`CACHE_VERSION` `v7` — actualizat 2026-10-01, TASK 4; anterior `v6`). Network-first pentru conținut este incompatibil cu D-057 și se schimbă în milestone-ul care implementează pachetul.

Deschis: harta offline cu alt provider — D-063.

---

## D-057 — Adventure Versioning
Status: CONFIRMED (2026-09-30) — arhitectural; parțial pregătit (`contentVersion`)

Decizie:
- O sesiune rulează pe o versiune fixă a aventurii. Sesiunile noi folosesc cea mai nouă versiune publicată.
- O versiune publicată este imuabilă; conținutul unei sesiuni active nu se modifică retrospectiv.
- În schemă, versiunea aventurii este `contentVersion` (existent, opțional); `schemaVersion` rămâne versiunea formatului.
- Starea de disponibilitate a checkpoint-urilor (D-061) nu este conținut și se poate schimba în timpul unei sesiuni.

Stare în cod: `contentVersion` este copiat în progres, dar nu este comparat la restaurare; restaurarea tolerantă aplică conținutul nou unei sesiuni locale existente. Se corectează la implementarea sesiunilor / pachetului.

Precizat pentru Session în D-066 (`adventure_id` + `adventure_version` obligatorii pentru o Session reală).

---

## D-058 — GPS adaptiv și strategia de baterie
Status: CONFIRMED (2026-09-30) — arhitectural; neimplementat

Decizie:
- Frecvența observațiilor GPS este adaptivă: mai rară departe de checkpoint, mai deasă aproape de el. Factori: baterie, precizie, capabilitățile dispozitivului, mișcare, distanța față de rută și de checkpoint, raza geofence-ului.
- **Nicio valoare nu este fixată în arhitectură**; toate sunt parametri configurabili, optimizați prin testare reală.
- Pentru Bike (3–4 ore): fără polling continuu la frecvență maximă; minimizarea procesării și a render-ului inutil; folosirea cache-ului local.
- Regulile de zonă (D-039) nu se schimbă; strategia decide doar cât de des se cer observații.

Constrângere tehnică: Geolocation API nu are parametru de interval; controlul este indirect și trebuie măsurat pe Android și iPhone. Legătură: D-028 (fundal / ecran stins) rămâne deschisă.

---

## D-059 — Bike Safety Loop; audio și haptic de siguranță
Status: CONFIRMED (2026-09-30) — regulă de design; audio/haptic neimplementat

Decizie:
- Bucla Bike: pedalează → observă → ajungi la punct → oprește → folosește telefonul → rezolvă → deblochează → pune telefonul deoparte → continuă.
- Nu se introduc mecanisme care recompensează viteza, folosirea telefonului în mers sau interacțiunea cu telefonul în timpul deplasării (constrângere pentru D-025).
- Beep, vibrație, text-to-speech și prompturi audio sunt posibile funcționalități de **siguranță / UX**, nu mecanici de joc.
- Nu se presupune că browserul poate reda audio în fundal sau cu ecranul oprit pe toate dispozitivele; limitările sunt risc tehnic de testat pe dispozitive reale.

---

## D-060 — Discovery, validarea provocărilor și integritatea
Status: CONFIRMED (2026-09-30) — arhitectural; hash neimplementat

Decizie:
- Modelul în două niveluri: GPS confirmă prezența → discovery / observație → provocare → deblocare. GPS-ul singur nu este întotdeauna dovada finală.
- Pentru răspunsuri sensibile la cheat, conținutul poate folosi `answer_hash = SHA-256(normalized_answer)`, comparat în client. **Hash-ul în client nu reprezintă securitate anti-cheat reală** (confirmă D-021).
- MVP: validare locală / hash pentru funcționare offline, integritate de bază și reducerea expunerii răspunsului în clar.
- Viitor: validarea pe server devine autoritatea pentru scor competitiv, Treasure Hunt, clasamente, rezultate comerciale, anti-cheat real.
- GPS-ul nu este singura dovadă acolo unde integritatea contează: cod fizic, QR, observație, obiect real, validare de operator. QR-ul nu este obligatoriu pentru toate aventurile.

Stare în cod: răspunsurile sunt în text clar, validate local prin `answers.js`.

---

## D-061 — Route Health, Skip și Bypass
Status: CONFIRMED (2026-09-30) — arhitectural; neimplementat (skip de jucător: implementat)

Decizie:
- Fiecare checkpoint / segment are o stare de disponibilitate: `ACTIVE`, `UNAVAILABLE`, `BYPASSED` (cauze: lucrări, acces blocat, obiectiv închis, vreme, siguranță, intervenția operatorului). Starea aparține rutei (strat operațional), nu versiunii aventurii.
- Motorul trebuie să permită bypass-ul unui checkpoint, astfel încât aventura să continue. Tipuri: `AUTOMATIC SKIP`, `OPERATOR SKIP`, `ADMIN / CONTENT SKIP`.
- Fiecare bypass păstrează un eveniment de audit (checkpoint, tip, motiv, actor, moment, sesiune).
- Bypass-ul este distinct de „Sari peste” (skip de jucător, misiune `skipped`, 0 puncte — implementat).

Deschis: efectul bypass-ului în scor (D-025).

---

## D-062 — Flux liniar și graf; rutare dinamică
Status: CONFIRMED (2026-09-30) — arhitectural; doar `linear` implementat

Decizie:
- Motorul nu este limitat la flux strict liniar. Model conceptual `flow.type: linear | graph`, reprezentat în schemă prin `settings.progression` (azi doar `"linear"`).
- Primele aventuri pot fi liniare; motorul trebuie proiectat astfel încât graful / ramificarea să poată fi introduse fără refactorizare fundamentală.
- Se separă: geometria rutei, progresia aventurii, disponibilitatea checkpoint-urilor, ordinea checkpoint-urilor. Un checkpoint poate fi dezactivat fără rescrierea rutei.

Extensii de schemă propuse (provizorii): `11_ADVENTURE_SCHEMA_V2.md` §14.

---

## D-063 — Harta offline
Status: PROPOSED

Context:
Platform V1.1 cere un pachet offline care include „relevant map data”. D-046 (CONFIRMED) și politica OpenStreetMap interzic prefetch-ul, descărcarea în bloc și stocarea offline a tile-urilor standard OSM. Proprietarul a ales (2026-09-30): tile-urile OSM sunt excluse din pachet; D-046 rămâne neschimbată (vezi D-056).

De decis:
- dacă este nevoie de o hartă offline (în special pentru Bike, în zone fără semnal);
- dacă da: un provider care permite explicit utilizarea offline (tile-uri proprii / self-hosted generate din date OSM cu licența respectată, sau un provider comercial cu licență offline), cu costurile și atribuirea aferente;
- ce se descarcă (doar zona rutei, nivelurile de zoom necesare).

Până la decizie: fără conexiune, harta rămâne fără fundal; jocul continuă prin geofence-uri, instrucțiuni, geometria rutei și „Am ajuns” (principiul M-003.2).

---

## D-064 — Adventure Session ca sursă a stării
Status: CONFIRMED (2026-09-30) — arhitectural / neimplementat

Decizie:
- **Adventure Session** este sursa logică a stării jocului.
- În `multi_device`, starea canonică este derivată din evenimentele acceptate de server (ordinea: `server_seq` — `15_SESSION_SYNC.md` §7).
- **Team** este structura de membri și roluri asociată unei Session; **nu are un state machine independent**. Stările de echipă din D-052 (`TEAM FORMING → READY → LOCKED → ACTIVE → COMPLETED`) sunt o vedere derivată din starea sesiunii, nu o a doua sursă de stare.
- În `shared_device`, starea locală rămâne sursa funcțională cât timp nu există backend (comportamentul actual).

Precizează D-052 (închide recomandarea deschisă din `13_PLATFORM_V1.1.md` §3.3) și D-054. Nu schimbă modelul de evenimente din D-055.

---

## D-065 — Rejoin: link personal și cod de recuperare
Status: CONFIRMED (2026-09-30) — arhitectural / neimplementat

Decizie:
- Mecanismul normal de rejoin este un **personal rejoin link**.
- Există și un **recovery code**, ca mecanism alternativ / de recuperare (ex. linkul nu mai este disponibil).
- Ambele identifică **participantul existent** și îl readuc în **Session existentă**, cu același rol.
- Rejoin-ul **nu creează niciodată** o Session nouă (confirmă D-053).
- Formatul exact al recovery code rămâne pentru implementare (legat de D-032).

Precizează D-053 (închide întrebarea „link, cod sau ambele”). Necesită backend pentru rejoin pe alt browser / telefon (FUTURE, D-019).

---

## D-066 — Versionarea Session
Status: CONFIRMED (2026-09-30) — arhitectural / neimplementat

Decizie:
- O Adventure Session reală este legată **obligatoriu** de `adventure_id` + `adventure_version`.
- `adventure_version` este versiunea publicată și imuabilă pe care rulează Session.
- `contentVersion` poate rămâne **opțional** în schema actuală (`11_ADVENTURE_SCHEMA_V2.md`) până la implementarea completă a versionării.
- Distincția nu schimbă D-057; o face explicită pentru Session.

Stare în cod: sesiunea locală implicită (`outdoor-escape:game:<id>`) nu este încă o Session reală în sensul acestei decizii (`contentVersion` este copiat în progres, dar necomparat — D-057).

---

## D-067 — Bike: joc fără închiriere
Status: CONFIRMED (2026-09-30) — arhitectural / neimplementat

Decizie:
- Aceeași Adventure Bike poate fi oferită comercial în două variante:
  - `GAME_ONLY` — participantul folosește bicicleta proprie;
  - `GAME_PLUS_BIKE_RENTAL` — bicicleta este furnizată printr-un partener / operator.
- Adventure și Route **nu depind** de închirierea bicicletei.
- Nu se introduc acum entități `Product`, `Booking`, `RentalProvider` etc.; acestea rămân pentru faza comercială ulterioară (D-008, D-019).
- Funsy Bike nu se hardcodează în motor (confirmă D-051).

---

## D-068 — Excepție pentru demo-ul GPS public (Public demo GPS exception)
Status: CONFIRMED (2026-09-30)

Context:
D-034 (CONFIRMED) cere ca `content/` din repository-ul public să conțină numai conținut de test / demo. Aventura `content/adventures/demo-gps-brasov.json` (`schemaVersion` 2, `demo: true`) este publicată pe GitHub Pages și folosește coordonate reale din Brașov, necesare pentru testarea GPS-ului și a hărții pe teren. Documentația afirma, contradictoriu, că demo-ul public nu are locații reale.

Decizie (proprietar, 2026-09-30):
- `content/adventures/demo-gps-brasov.json` este autorizat explicit ca demo public și poate conține coordonate reale din Brașov.
- Coordonatele reale din acest fișier sunt **intenționat publice**, pentru testarea / demonstrarea GPS-ului și a hărții.
- Fișierul trebuie să rămână clar identificabil ca demo: `demo: true` (și titlul marcat „[DEMO GPS]”).

Scope:
- Doar acest demo / conținut marcat `demo: true`.
- Excepția **nu** se extinde automat la alte aventuri, la alte locații reale sau la conținut real (poveste, traseu comercial, puzzle-uri, răspunsuri, indicii, coduri de partener, media).
- Excepția **nu** autorizează publicarea altor aventuri reale sau a conținutului sensibil. `Claude outputs/` rămâne sensibil și nu se publică (D-044).

Relația cu D-034:
Aceasta este o excepție explicită pentru demo-ul public și **nu** modifică regula generală D-034: conținutul real al aventurilor nepublicate, inclusiv al aventurilor care urmează să fie publicate comercial, rămâne în afara repository-ului public.

Nu se schimbă: motorul, schema V2, aplicația, conținutul fișierului `demo-gps-brasov.json` și testele.

---

## D-069 — TASK 5: Field Test 2 — Real-Coordinate GPS & Cross-Device Validation
Status: CONFIRMED (2026-10-01) — TASK 5: ÎN CURS (FT2-E3 Android: PASS, `07_TESTING.md` §28.5; restul punctelor: neexecutate)

Context:
TASK 4 (vertical slice UI, `37f4450`) este înghețat, iar Field Test 1 pe Android a trecut (22/22 PASS, `07_TESTING.md` §27.3). Field Test 1 a folosit coordonate fictive, deci nu a validat sosirea declanșată de poziția GPS reală. Nu au fost validate nici service worker-ul și cache-ul pe telefon, modul offline, ecranul blocat / fundalul și iPhone-ul. Testul hărții pe telefon cu locații reale a fost amânat explicit prin D-049-M.

Decizie (proprietar, 2026-10-01):
- Următorul task oficial este **TASK 5 — Field Test 2: Real-Coordinate GPS & Cross-Device Validation**.
- Scope (fără cod nou; codul testat este cel de la TASK 4 sau ulterior, publicat):
  - sosirea determinată de GPS-ul real (nu de „Am ajuns”) pe `demo-gps-brasov` (`src/?adventure=demo-gps-brasov`);
  - harta și markerii la locații reale;
  - Android pe teren;
  - service worker / cache pe telefon;
  - modul offline, în limitele implementării actuale;
  - ecranul blocat / aplicația în fundal **doar ca observație** a comportamentului documentat (`07_TESTING.md` §24.4, D-045), fără criterii noi;
  - iPhone / Safari.
- Metoda de acces: D-031 (versiunea publicată pe GitHub Pages, pe Android și iPhone).
- Checklist-ul și raportul: `07_TESTING.md` §28.

Relații:
- **D-049-M:** TASK 5 face testul pe telefon cu locații reale, amânat în M-003.2.
- **D-068:** singurele coordonate reale folosite sunt cele din `demo-gps-brasov` (demo public). Fișierul nu se modifică, iar excepția nu se extinde la alte aventuri sau la conținut real (D-034).
- **D-020:** TASK 5 cere publicarea pe GitHub Pages a codului de la TASK 4 (push pe `main` = release, `06_GIT_WORKFLOW.md`). Publicarea este o precondiție a testului, nu un rezultat al Field Test 2. Push-ul este un pas separat, făcut numai la cererea explicită a proprietarului.
- **D-031:** metoda de testare pe telefon pentru TASK 5.

În afara TASK 5:
- cod nou;
- modificări la Engine V2, la schemă, la contracte, la `src/sw.js` sau la interfață;
- modificarea `demo-gps-brasov.json`, alte coordonate reale sau conținut real;
- harta offline (D-063, PROPOSED);
- criterii sau implementare pentru fundal / ecran stins (D-028, PROPOSED);
- cronometrul (D-025, PROPOSED);
- Adventure Package (D-056), GPS adaptiv (D-058);
- Platform V1.1 (Session, Team, Rejoin, sincronizare, `multi_device`, bypass, flux graf);
- backend, plăți, coduri de acces, analytics.

Un `FAIL` care arată un defect devine un task de corectare separat. Un rezultat care confirmă o limită documentată nu este un defect.

Nu se schimbă: D-025, D-028, D-063, motorul, schema V2, aplicația, conținutul și testele.
