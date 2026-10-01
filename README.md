# Outdoor Escape

Joc de mister outdoor, jucat pe telefon, în oraș: un „escape room” digital în aer liber.

Echipele (2–4 jucători) urmează o poveste, merg fizic prin oraș, observă detalii reale ale clădirilor și locurilor, rezolvă puzzle-uri, folosesc indicii la nevoie și deblochează pas cu pas locațiile următoare, până la rezolvarea finală. Jocul se joacă fără ca organizatorul să fie prezent.

Primul joc este gândit pentru **Brașov**. Titlul de lucru este „Tainele Breslei Pierdute din Kronstadt” (nu este final).

## Platforma (V1.1 — arhitectură decisă, neimplementată)

Outdoor Escape evoluează spre o platformă cu două produse care folosesc același motor: **Walk** (`walk.outdoor-escape.ro`, aventuri pietonale, inițial în Brașov) și **Bike** (`bike.outdoor-escape.ro`, aventuri cu bicicleta, primul operator: Funsy Bike). AR nu este produs separat, ci o capabilitate viitoare pentru ambele. Adresele sunt planificate; aplicația rămâne deocamdată pe GitHub Pages (mai jos).

Arhitectura V1.1 (rută ≠ aventură ≠ sesiune, echipe și participanți, continuitatea sesiunii, stare comună, offline-first, versiuni de aventură, GPS adaptiv, bypass) este **decisă, dar neimplementată**: [`docs/13_PLATFORM_V1.1.md`](docs/13_PLATFORM_V1.1.md). Backend, plăți, rezervări și dashboard rămân viitoare.

## Stare

**Motorul de joc — fundația V2.** Aplicația este publicată la `https://rezervari.github.io/outdoor-escape/src/` și rulează implicit o aventură **demonstrativă** (`brasov-centrul-vechi`, 3 provocări, fără locații). Implementat: schema de aventură V2, migrarea V1 → V2, modelul de locație, motorul de evenimente, progresul V2 și testele. **M-003.1:** poziția reală a telefonului (Browser Geolocation API, doar cu aplicația deschisă) este conectată la motor: stare GPS, permisiune explicată, obiectivul misiunii și „Am ajuns” ca rezervă. Aventura demo implicită nu are locații, deci pe ea GPS-ul este doar informativ. Excepție acceptată explicit de proprietar (D-068): aventura demo publică `demo-gps-brasov` (`src/?adventure=demo-gps-brasov`, marcată `demo: true`) conține intenționat coordonate reale din Brașov, pentru testarea GPS-ului și a hărții; excepția nu se extinde la alte aventuri reale (D-034). **M-003.2:** harta Leaflet (1.9.4, inclusă local) + OpenStreetMap, doar pentru orientare, afișată în joc numai pentru aventurile cu locații — implementată, comisă și **acceptată de proprietar la 30.09.2026** (milestone închis). **TASK 4 — vertical slice UI:** harta ca suprafață principală cu cardul obiectivului peste ea, puzzle-ul ca overlay, indicii cu confirmare, ecranul de rezultat și butonul Back pentru straturile de interfață, demonstrate pe aventura fictivă `demo-vertical-slice` (`src/?adventure=demo-vertical-slice`); verificat cu `npm test`, în browser pe desktop și pe un telefon Android real (Field Test 1: PASS — `docs/07_TESTING.md` §27.3); testul pe iPhone rămâne de făcut (TASK 5, D-069). Pregătit, dar încă fără interfață: misiunile partener, secrete și cu timp, naratorul, audio, GPS-ul în fundal și notificările — vezi [`docs/11_ADVENTURE_SCHEMA_V2.md`](docs/11_ADVENTURE_SCHEMA_V2.md), secțiunea 0.

Milestone-uri curente:

- M-003.1 — Browser Geolocation: COMPLETED
- M-003.2 — Map: ACCEPTED — CLOSED (acceptat de proprietar la 30.09.2026; D-046–D-049; implementare `39a6b28`; testul pe telefon cu locații reale a fost amânat explicit prin D-049-M și nu este un criteriu ratat)
- TASK 4 — Vertical slice UI: FROZEN (`37f4450`; Field Test 1 Android: PASS — `docs/07_TESTING.md` §27.3)
- TASK 5 — Field Test 2: Real-Coordinate GPS & Cross-Device Validation: DECIS, neînceput (D-069; metoda: D-031; checklist: `docs/07_TESTING.md` §28; fără cod nou; cere publicarea pe GitHub Pages — D-020)

Traseul, locațiile și puzzle-urile jocului real nu sunt finale până nu sunt verificate pe teren.

## Cum va funcționa (țintă MVP)

- aplicație web progresivă (PWA), deschisă din browserul telefonului, fără instalare obligatorie;
- un motor de joc reutilizabil: fiecare joc nou înseamnă conținut și configurație noi, nu o aplicație nouă;
- conținutul jocului (poveste, locații, puzzle-uri, indicii, media) este păstrat separat de codul motorului, în fișiere JSON;
- GPS-ul ajută la progres, dar nu blochează niciodată jucătorul: există mereu o cale de continuare;
- progresul se păstrează local, astfel încât jocul poate fi reluat după închiderea browserului;
- aproximativ 90–120 de minute, 2,5–3,5 km, 8–10 locații, 7–9 puzzle-uri, câte două indicii pe puzzle (ținte de lucru, pot fi ajustate după testele pe teren).

## Tehnologie

- HTML, CSS și JavaScript, fără framework și **fără pas de build**;
- Web App Manifest și Service Worker;
- conținut în JSON;
- Browser Geolocation API; Leaflet 1.9.4 (inclus local, fără CDN) + OpenStreetMap standard tiles, doar pentru orientare;
- găzduire statică pe **GitHub Pages**, publicată printr-un workflow GitHub Actions care publică doar fișierele aplicației (fără framework de build).

Deocamdată **nu** există backend, plăți (Stripe), conturi de utilizator sau analytics. Acestea vor fi introduse doar când vor exista cerințe clare. Vezi [`docs/04_DECISIONS_LOG.md`](docs/04_DECISIONS_LOG.md).

## Structura repository-ului

```text
/
├── index.html           redirecționare către src/ (nu este aplicația)
├── src/                 aplicația: HTML, CSS, module JavaScript, manifest, service worker
├── content/adventures/  conținutul aventurilor (JSON) — numai test / demo; conținutul real stă separat (D-034)
├── tests/               teste automate (node --test) și fixture-uri
├── docs/                documentația proiectului (00–15)
├── .github/workflows/   publicarea pe GitHub Pages (doar index.html, src/, content/)
├── package.json         doar pentru `npm test` (fără dependențe)
├── LICENSE              licența MIT pentru codul aplicației
└── LICENSE-CONTENT.md   conținutul jocurilor NU este licențiat MIT
```

Detalii: [`docs/03_ARCHITECTURE.md`](docs/03_ARCHITECTURE.md) și [`docs/11_ADVENTURE_SCHEMA_V2.md`](docs/11_ADVENTURE_SCHEMA_V2.md).

Teste: `npm test` (Node.js 20+, fără `npm install`).

## Documentație

| Fișier | Conținut |
| --- | --- |
| [`00_PROJECT_MASTER_CONTEXT.md`](docs/00_PROJECT_MASTER_CONTEXT.md) | contextul general al produsului |
| [`01_ROADMAP_AND_PHASES.md`](docs/01_ROADMAP_AND_PHASES.md) | fazele de dezvoltare |
| [`02_CLAUDE_PROJECT_INSTRUCTIONS.md`](docs/02_CLAUDE_PROJECT_INSTRUCTIONS.md) | reguli de lucru pentru Claude |
| [`03_ARCHITECTURE.md`](docs/03_ARCHITECTURE.md) | arhitectura tehnică |
| [`04_DECISIONS_LOG.md`](docs/04_DECISIONS_LOG.md) | decizii confirmate și propuse |
| [`05_GAME_DESIGN_SPEC.md`](docs/05_GAME_DESIGN_SPEC.md) | specificația de game design |
| [`06_GIT_WORKFLOW.md`](docs/06_GIT_WORKFLOW.md) | fluxul de lucru Git |
| [`07_TESTING.md`](docs/07_TESTING.md) | planul și procedurile de testare |
| [`08_CLAUDE_START_PROMPT.md`](docs/08_CLAUDE_START_PROMPT.md) | promptul inițial pentru Claude |
| [`09_CLAUDE_PROMPT_TEMPLATES.md`](docs/09_CLAUDE_PROMPT_TEMPLATES.md) | șabloane de prompturi |
| [`10_LOCAL_DEVELOPMENT.md`](docs/10_LOCAL_DEVELOPMENT.md) | dezvoltare locală și testare pe telefon (HTTPS) |
| [`11_ADVENTURE_SCHEMA_V2.md`](docs/11_ADVENTURE_SCHEMA_V2.md) | schema aventurii V2 și contractele motorului |
| [`12_MAP_SPECIFICATION_M-003.2.md`](docs/12_MAP_SPECIFICATION_M-003.2.md) | specificația hărții (M-003.2, D-046–D-049) și criteriile de acceptare |
| [`13_PLATFORM_V1.1.md`](docs/13_PLATFORM_V1.1.md) | **Outdoor Escape Platform V1.1** — arhitectura consolidată (D-050–D-063) |
| [`14_EDGE_CASES.md`](docs/14_EDGE_CASES.md) | scenarii limită V1.1, orientate spre implementare |
| [`15_SESSION_SYNC.md`](docs/15_SESSION_SYNC.md) | sincronizarea stării sesiunii (evenimente, coadă locală, offline) |
| [`README_CONTEXT_PACK.md`](docs/README_CONTEXT_PACK.md) | ordinea de citire a documentației |

Documentația nouă se scrie în limba română (D-017). Unele documente existente sunt încă în engleză.

## Dezvoltare locală

Vezi [`docs/10_LOCAL_DEVELOPMENT.md`](docs/10_LOCAL_DEVELOPMENT.md). Pe scurt: nu există build, fișierele se servesc cu un server static local, iar funcțiile GPS/PWA pe un telefon real necesită HTTPS.

Adresele aplicației (D-035):

- local: `http://localhost:8000/src/`
- producție: `https://rezervari.github.io/outdoor-escape/src/`

Rădăcina (`http://localhost:8000/`, respectiv `https://rezervari.github.io/outdoor-escape/`) doar redirecționează către `src/` (D-036). Codurile QR, linkurile oficiale și instrucțiunile pentru jucători indică direct adresa cu `/src/`.

## Securitate

Nu se pun în repository chei API secrete, chei Stripe secrete, parole sau alte date confidențiale. Repository-ul este **public**.

Orice fișier publicat pe GitHub Pages (inclusiv conținutul JSON al jocului) poate fi citit de oricine. În MVP, răspunsurile la puzzle-uri sunt verificate în browser (D-021). Hash-ul poate ascunde răspunsurile de o privire superficială, dar nu este o barieră de securitate. Motorul este proiectat astfel încât validarea să poată fi mutată ulterior pe server. Accesul plătit va trebui validat pe server într-o fază ulterioară.

## Licență

- **Codul aplicației:** licența MIT — vezi [`LICENSE`](LICENSE).
- **Conținutul jocurilor** (poveste, puzzle-uri, răspunsuri, indicii, trasee, media): **nu** este acoperit de licența MIT; toate drepturile sunt rezervate — vezi [`LICENSE-CONTENT.md`](LICENSE-CONTENT.md).
