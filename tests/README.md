# tests/

Teste automate pentru logica motorului de joc, rulate cu test runner-ul inclus în Node.js (`node --test`). Nu există dependențe: nu se rulează `npm install` și nu există `node_modules/`.

Stare: CONFIRMED — D-023 în [`../docs/04_DECISIONS_LOG.md`](../docs/04_DECISIONS_LOG.md). Nu se introduce un framework suplimentar de testare.

## Rulare

Din rădăcina repository-ului (Git Bash):

```bash
node --test
# sau
npm test
```

Necesită Node.js 20 sau mai nou. `package.json` din rădăcină există doar pentru `"type": "module"` (modulele din `src/js/` sunt module ES) și pentru comanda `npm test`; nu este folosit de aplicația publicată.

## Ce se testează

| Fișier | Modul testat | Ce acoperă |
| --- | --- | --- |
| `answers.test.js` | `src/js/answers.js` | normalizarea răspunsurilor (majuscule, spații, diacritice cu virgulă și cu sedilă), compararea fără fuzzy matching, validatorul asincron, eliminarea răspunsurilor din aventură |
| `content.test.js` | `src/js/content.js` | validitatea aventurii demo din `content/adventures/`, validarea minimă a structurii, căile relative compatibile cu `/outdoor-escape/src/`, erorile de încărcare (rețea, 404, JSON stricat, format greșit) |
| `storage.test.js` | `src/js/storage.js` | cheia `outdoor-escape:game:<id>`, salvare/restaurare/resetare, date corupte, `localStorage` indisponibil |
| `game.test.js` | `src/js/game.js` | stările `idle → playing → completed`, răspuns corect/incorect/gol, indiciu, stările `solved`/`failed`/`skipped` (inclusiv după refresh), calculul scorului, restaurarea, resetarea — pe aventura demo V1 |
| `schema.test.js` | `src/js/schema.js`, `defaults.js`, `content.js` | validarea V2 (structură și referințe între entități), extensibilitate, conversia V1 → V2, valorile implicite centrale, încărcarea V2 |
| `geo.test.js` | `src/js/geo.js` | distanțe, rază, precizie („uncertain”), near / arrival / leave, exit margin, `assessFix` (aceeași regulă ca `evaluateProximity`) |
| `events.test.js` | `src/js/events.js` | filtre, `once`, acțiuni, duplicate, limitarea lanțurilor și a buclelor |
| `location.test.js` | `src/js/location.js` | adaptorul Geolocation cu mock `navigator.geolocation` (`helpers/mock-geolocation.js`): API indisponibil / context nesigur, permisiune refuzată (inclusiv sincron), erori generice, `watchPosition` reușit, `stop` și cleanup, start duplicat, retry, `GeolocationPosition` → fix, starea afișată |
| `location-integration.test.js` | `location.js` + `game.js` + `geo.js` + `events.js` | browser (mock) → `reportPosition`: outside → near → arrived până în regulile de evenimente și progres, precizie bună/slabă („uncertain”), fallback manual (GPS nesigur, refuzat, indisponibil), poziții duplicate, tranziții repetate, oprire |
| `map-model.test.js` | `src/js/map-model.js` | modelul hărții (D-048): forma modelului, calitatea (`gps-ready` → `valid`, `gps-uncertain` → `uncertain`, restul → `none`, `weak` neprodus), stările locațiilor (locked → invizibil), obiectivul curent, raza copiată de la motor, lipsa fix-ului, fără distanțe / reguli GPS (inclusiv verificare în sursă), integrare cu `game.getLocation` |
| `map.test.js` | `src/js/map.js` | harta cu un Leaflet fals (`helpers/fake-leaflet.js`, fără browser și fără rețea): creare, erori de inițializare (`MapError`), jucător (valid / uncertain / weak / none, cerc de acuratețe, limita de 1000 m), locații (doar vizibile, stări, aria-label, obiectiv curent, escapare HTML), cercul obiectivului, viewport (prima afișare, primul fix, pan manual, schimbarea obiectivului, „Centrează pe mine”, „Vezi obiectivele”), banner tile-uri, `destroy`, idempotență (zero apeluri la același model), verificare în sursă, versiunea și SHA-256 Leaflet |
| `location-radius.test.js` | `src/js/geo.js`, `src/js/game.js` | raza efectivă — o singură sursă (D-049-D / R2): `effectiveRadius`, folosită de `evaluateProximity` și expusă de `game.getLocation().radiusMeters` |
| `progress-v2.test.js` | `src/js/game.js` | progresul V2 pe fixture-ul fictiv: GPS prin motor, confirmare manuală, evenimente, trasee main/bonus/secret, final, salvare/restaurare, migrarea progresului V1, lipsa logicii specifice unei aventuri |

## Fixture-uri

`fixtures/adventure-v2-demo.json` — aventură V2 **fictivă** (coordonate inventate lângă 0°, 0°), folosită doar de teste (D-042). Nu este publicată pe GitHub Pages și nu apare în aplicație.

Interfața (DOM) nu este testată automat aici. Procedura manuală din browser: [`../docs/07_TESTING.md`](../docs/07_TESTING.md), secțiunea 22; harta (verificare Chromium): secțiunea 25.

Directorul `tests/` nu este publicat pe GitHub Pages: workflow-ul publică doar `index.html`, `src/` și `content/` (D-020, D-042).
