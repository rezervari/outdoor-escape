# Outdoor Escape

Joc de mister outdoor, jucat pe telefon, în oraș: un „escape room” digital în aer liber.

Echipele (2–4 jucători) urmează o poveste, merg fizic prin oraș, observă detalii reale ale clădirilor și locurilor, rezolvă puzzle-uri, folosesc indicii la nevoie și deblochează pas cu pas locațiile următoare, până la rezolvarea finală. Jocul se joacă fără ca organizatorul să fie prezent.

Primul joc este gândit pentru **Brașov**. Titlul de lucru este „Tainele Breslei Pierdute din Kronstadt” (nu este final).

## Stare

**Faza 0 — fundația proiectului.** Nu există încă cod de aplicație.

Repository-ul conține deocamdată documentația, deciziile și specificațiile de bază. Traseul, locațiile și puzzle-urile nu sunt finale până nu sunt verificate pe teren.

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
- Browser Geolocation API; Leaflet + OpenStreetMap doar unde o hartă este cu adevărat utilă;
- găzduire statică pe **GitHub Pages**, publicată printr-un workflow GitHub Actions care publică doar fișierele aplicației (fără framework de build).

Deocamdată **nu** există backend, plăți (Stripe), conturi de utilizator sau analytics. Acestea vor fi introduse doar când vor exista cerințe clare. Vezi [`docs/04_DECISIONS_LOG.md`](docs/04_DECISIONS_LOG.md).

## Structura repository-ului

Acum:

```text
/
├── README.md
├── LICENSE              licența MIT pentru codul aplicației
├── LICENSE-CONTENT.md   conținutul jocurilor NU este licențiat MIT
├── .gitignore
└── docs/                documentația proiectului
```

Structura planificată pentru aplicație (`src/`, `content/`, `tests/`) este descrisă în [`docs/03_ARCHITECTURE.md`](docs/03_ARCHITECTURE.md) și nu a fost creată încă.

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
| [`README_CONTEXT_PACK.md`](docs/README_CONTEXT_PACK.md) | ordinea de citire a documentației |

Documentația nouă se scrie în limba română (D-017). Unele documente existente sunt încă în engleză.

## Dezvoltare locală

Vezi [`docs/10_LOCAL_DEVELOPMENT.md`](docs/10_LOCAL_DEVELOPMENT.md). Pe scurt: nu există build, fișierele se servesc cu un server static local, iar funcțiile GPS/PWA pe un telefon real necesită HTTPS.

Adresele aplicației, după ce va exista (D-035):

- local: `http://localhost:8000/src/`
- producție: `https://rezervari.github.io/outdoor-escape/src/`

Rădăcina (`http://localhost:8000/`, respectiv `https://rezervari.github.io/outdoor-escape/`) doar redirecționează către `src/` (D-036). Codurile QR, linkurile oficiale și instrucțiunile pentru jucători indică direct adresa cu `/src/`.

## Securitate

Nu se pun în repository chei API secrete, chei Stripe secrete, parole sau alte date confidențiale. Repository-ul este **public**.

Orice fișier publicat pe GitHub Pages (inclusiv conținutul JSON al jocului) poate fi citit de oricine. În MVP, răspunsurile la puzzle-uri sunt verificate în browser (D-021). Hash-ul poate ascunde răspunsurile de o privire superficială, dar nu este o barieră de securitate. Motorul este proiectat astfel încât validarea să poată fi mutată ulterior pe server. Accesul plătit va trebui validat pe server într-o fază ulterioară.

## Licență

- **Codul aplicației:** licența MIT — vezi [`LICENSE`](LICENSE).
- **Conținutul jocurilor** (poveste, puzzle-uri, răspunsuri, indicii, trasee, media): **nu** este acoperit de licența MIT; toate drepturile sunt rezervate — vezi [`LICENSE-CONTENT.md`](LICENSE-CONTENT.md).
