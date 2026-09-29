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
| `game.test.js` | `src/js/game.js` | stările `idle → playing → completed`, răspuns corect/incorect/gol, indiciu, stările provocărilor `solved`/`failed`/`skipped` (inclusiv restaurarea lor după refresh), calculul scorului, restaurarea după refresh, resetarea |

Interfața (DOM) nu este testată automat aici. Procedura manuală din browser: [`../docs/07_TESTING.md`](../docs/07_TESTING.md), secțiunea 22.

Directorul `tests/` nu ar trebui publicat pe GitHub Pages (D-020). Vezi nota despre workflow din `07_TESTING.md`, secțiunea 22.
