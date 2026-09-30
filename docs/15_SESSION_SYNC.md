# OUTDOOR ESCAPE — SESSION SYNC (PLATFORM V1.1)

| | |
| --- | --- |
| **Status** | ARHITECTURĂ DECISĂ (D-054, D-055, D-056, D-064, D-065, D-066). **Neimplementat.** Nu există backend (D-019); acest document descrie contractul pe care îl va respecta implementarea. |
| **Data** | 2026-09-30 |
| **Documente asociate** | [`13_PLATFORM_V1.1.md`](13_PLATFORM_V1.1.md) §4–§9 · [`14_EDGE_CASES.md`](14_EDGE_CASES.md) secțiunile B și D · [`11_ADVENTURE_SCHEMA_V2.md`](11_ADVENTURE_SCHEMA_V2.md) (evenimentele motorului, progresul salvat) |

Numele de câmpuri și de evenimente din acest document sunt **orientative**: fixează semantica, nu formatul final. Formatul exact se stabilește la implementare, cu o decizie în jurnal.

---

## 1. Obiectiv

Toți participanții aceleiași Adventure Session văd aceeași stare logică a aventurii (**shared team state**), inclusiv în zone cu conexiune instabilă (Șirnea / Fundata), fără ca jocul să depindă de o conexiune permanentă.

Cerințe (D-055): retry, protecție la duplicate, consistență eventuală, reconectare, sincronizare după revenirea conexiunii. WebSocket **nu** este cerință V1.

---

## 2. Arhitectura

```text
┌──────────── dispozitiv ────────────┐
│ UI                                  │
│  ↓ acțiune (răspuns, indiciu, sosire)│
│ Motor local (game.js)               │
│  ↓ optimistic update                │
│ Stare locală (persistată)           │
│  ↓                                  │
│ Coadă locală de evenimente          │──── HTTP sync / short polling ────→ ┌──────── server (FUTURE) ────────┐
│ (persistentă, ordonată)             │←─── evenimente acceptate + stare ── │ Jurnal de evenimente per sesiune │
└─────────────────────────────────────┘                                     │ Stare persistentă a sesiunii     │
                                                                             └──────────────────────────────────┘
```

- **Adventure Session este sursa logică a stării jocului** (D-064); Team nu are stare proprie.
- **Sursa de adevăr** pentru o sesiune `multi_device` este **jurnalul de evenimente acceptate de server**, ordonat după `server_seq`. Starea sesiunii este derivată din el (același principiu ca azi: se salvează faptele, restul se derivă — D-043).
- În `shared_device` fără server, sursa funcțională rămâne starea locală (comportamentul actual — D-064).
- **Identificarea sesiunii:** o sesiune reală are obligatoriu `session_id` legat de `adventure_id` + `adventure_version` (versiunea publicată, imuabilă — D-066). Perechea este fixată la crearea sesiunii și nu se schimbă pe durata ei.
- Motorul rămâne independent de transport: primește evenimente / acțiuni și produce stare, ca azi (D-040). Sincronizarea este un modul separat, nu logică în motor.

---

## 3. Evenimente

### 3.1 Forma unui eveniment de sesiune

```json
{
  "event_id": "…",
  "session_id": "…",
  "participant_id": "…",
  "device_id": "…",
  "type": "challenge_solved",
  "payload": { "missionId": "m-03" },
  "adventure_id": "…",
  "adventure_version": "1.0",
  "client_seq": 42,
  "client_time": "2026-09-30T10:15:00Z",
  "server_seq": null,
  "server_time": null
}
```

| Câmp | Rol |
| --- | --- |
| `event_id` | Identificator unic, generat pe dispozitiv (ex. UUID). Cheia de idempotență. |
| `session_id`, `participant_id`, `device_id` | Cine și unde. `device_id` permite distingerea dispozitivelor aceluiași participant (rejoin). |
| `type`, `payload` | Ce s-a întâmplat. |
| `adventure_id`, `adventure_version` | **Obligatorii.** Identifică aventura și versiunea fixă a sesiunii (D-057, D-066). Serverul refuză un eveniment pentru altă aventură sau versiune decât a sesiunii. |
| `client_seq` | Ordinea locală, crescătoare per dispozitiv. |
| `client_time` | Ora dispozitivului — informativă (ceasurile telefoanelor pot fi greșite). |
| `server_seq`, `server_time` | Atribuite de server la acceptare. `server_seq` este **ordinea autoritativă** a sesiunii în `multi_device`. |

### 3.2 Categorii

| Categorie | Exemple | Partajat cu echipa? |
| --- | --- | --- |
| Sesiune / echipă | `participant_joined`, `participant_left`, `leader_transferred`, `session_locked`, `session_started`, `session_paused`, `session_resumed`, `session_completed`, `session_abandoned` | da |
| Progres | `challenge_solved`, `answer_incorrect`, `hint_revealed`, `mission_skipped`, `checkpoint_arrived`, `checkpoint_bypassed` | da |
| Operațional | `checkpoint_availability_changed` (Route Health) | da (vine de la server) |
| Local | fix-uri GPS, starea hărții, preferința de sunet | **nu** — nu se sincronizează (D-043) |

Evenimentele de progres corespund evenimentelor existente ale motorului (`mission_completed`, `hint_requested`, `player_arrived` … — `11_ADVENTURE_SCHEMA_V2.md` §9). Corespondența exactă se fixează la implementare, fără redenumirea evenimentelor motorului.

**Fix-urile GPS nu sunt evenimente de sesiune.** Se sincronizează doar **faptul** (ex. `checkpoint_arrived`, cu `source: gps | manual`), nu coordonatele.

---

## 4. Coada locală

- Persistentă (supraviețuiește reload-ului, închiderii browserului, uciderii aplicației — `14_EDGE_CASES.md` B1–B5). Stocarea exactă (`localStorage` sau IndexedDB) se decide la implementare; `03_ARCHITECTURE.md` §2 permite IndexedDB „doar dacă cerințele o justifică” — o coadă de evenimente cu scrieri frecvente este un candidat pentru această justificare.
- Ordonată după `client_seq`.
- Un eveniment rămâne în coadă până la confirmarea serverului (`ack` cu `event_id`).
- Cheile folosesc prefixul proiectului (D-035), de exemplu `outdoor-escape:queue:<session_id>` (orientativ).
- Scrierea în coadă și actualizarea stării locale se fac împreună (aceeași operație logică), ca o închidere bruscă să nu lase starea locală înaintea cozii sau invers.

---

## 5. Optimistic UI

1. Participantul face o acțiune (ex. răspunde corect).
2. Motorul local aplică acțiunea imediat: provocarea devine `solved`, următorul nod se deblochează local.
3. Evenimentul intră în coadă.
4. UI-ul nu așteaptă serverul.
5. La confirmare, nimic vizibil nu se schimbă (cazul normal).
6. Dacă serverul respinge sau ordonează altfel (conflict — §7), starea locală este **reconstruită** din evenimentele acceptate + evenimentele locale rămase, iar UI-ul se actualizează fără pierderi.

Validarea locală a răspunsurilor (D-021 / hash — `13_PLATFORM_V1.1.md` §10) face pasul 2 posibil offline. Pentru aventurile unde serverul este autoritatea (competitiv — FUTURE), pasul 2 poate marca rezultatul ca „în așteptarea confirmării”.

---

## 6. Retry și idempotență

- **Trimitere:** în loturi mici, în ordinea `client_seq`, prin HTTP.
- **Retry:** exponential backoff cu jitter și plafon; parametrii (primul interval, plafonul) sunt **configurabili**, nefixați în arhitectură.
- **Declanșatori:** acțiune nouă, revenirea paginii în prim-plan (`visibilitychange`), evenimentul `online`, un timer periodic cât timp coada nu este goală. Evenimentul `online` singur nu este de încredere.
- **Idempotență pe server:** un `event_id` deja acceptat nu se mai aplică; serverul răspunde cu același `ack`. Retry-urile, două tab-uri și rejoin-ul nu produc efecte duble (`14_EDGE_CASES.md` D5, D6).
- **Idempotență în motor:** acțiunile sunt deja idempotente (D-040): o acțiune care nu schimbă starea nu emite eveniment; o misiune închisă nu își mai schimbă starea; `award_points` nu este permis în reguli repetabile.

---

## 7. Consistență eventuală și conflicte

Ordinea de adevăr = `server_seq`. Reguli de rezolvare (aplicate deterministic, identic pe server și pe dispozitive):

| Conflict | Regulă |
| --- | --- |
| Doi participanți rezolvă aceeași provocare | Primul eveniment acceptat câștigă; al doilea devine no-op (fără puncte duble). |
| Rezolvare offline + bypass de operator pentru același nod | Nodul închis primul (după `server_seq`) rămâne închis; al doilea eveniment devine no-op. Evenimentul de audit al bypass-ului se păstrează. |
| Două cereri „indiciul următor” simultane | Indiciile se identifică prin index; dezvăluirea indexului N este idempotentă — nu se dezvăluie două indicii. |
| Două transferuri de Leader simultane | Ultimul acceptat de server determină Leader-ul; toți văd rezultatul după sincronizare. |
| Eveniment pentru altă versiune de aventură | Respins (D-057); dispozitivul trebuie să reîncarce pachetul corect. |
| Eveniment după `COMPLETED` / `EXPIRED` / `CANCELLED` | Acceptat doar ca istoric, fără efect asupra stării (regula exactă: la implementare). |

Principii:

- Operațiile de progres sunt **monotone** (o stare închisă nu se redeschide), ceea ce face convergența simplă.
- Nicio regulă nu depinde de `client_time` (ceasurile pot fi greșite); timpii afișați folosesc `server_time` când există.

---

## 8. Multi-device

- `multi_device`: fiecare dispozitiv are propria coadă și propria stare locală; toate converg spre starea serverului.
- Citirea stării comune: **short polling** HTTP (ex. „dă-mi evenimentele după `server_seq` X”), cu intervalul **configurabil** și adaptat: mai des când echipa este activă și conexiunea bună, mai rar pe baterie / semnal slab.
- `shared_device`: un singur dispozitiv; sincronizarea este opțională (utilă pentru rejoin și, în viitor, pentru monitorizare). Funcționează complet fără server.
- WebSocket / SSE: pot înlocui polling-ul ulterior, doar dacă măsurătorile o justifică. Contractul de evenimente de mai sus nu se schimbă.

---

## 9. Offline

- Jocul rulează complet local după `CACHE READY` (`13_PLATFORM_V1.1.md` §8): motor local, stare locală, coadă locală.
- Fără conexiune, starea comună **nu** se actualizează între dispozitive: participanții pot vedea temporar stări diferite. Interfața arată discret „offline — se sincronizează când revine semnalul”.
- În `multi_device` fără conexiune, doi participanți pot rezolva independent aceeași provocare; la sincronizare se aplică §7.
- Recomandare de UX (nu cerință tehnică): în zone cunoscute ca fără semnal, aventura poate recomanda ca echipa să joace pe un singur dispozitiv pe acel segment.

---

## 10. Reconectare și rejoin

1. La revenirea conexiunii: se trimite coada (§6), apoi se cer evenimentele după ultimul `server_seq` cunoscut.
2. Starea locală se reconstruiește: stare de server + evenimente locale neconfirmate.
3. La **rejoin** pe un dispozitiv nou (`14_EDGE_CASES.md` B6–B9), prin linkul personal de rejoin sau prin codul de recuperare (D-065): se identifică participantul existent, se descarcă starea sesiunii de pe server (nu se creează o sesiune nouă), se verifică / se descarcă pachetul offline pentru `adventure_id` + `adventure_version` ale sesiunii, apoi jocul continuă din checkpoint-ul curent.
4. Un dispozitiv vechi care revine după ce participantul a făcut rejoin pe altul își trimite coada (idempotent) și primește starea curentă. Dacă rămâne valid sau nu: DESCHIS (`14_EDGE_CASES.md` B6).

---

## 11. Securitate și confidențialitate

- Tokenul de rejoin / participant este secret per participant, nu cheie de serviciu. Nu se pune în repository, în cod sau în loguri.
- Nicio cheie secretă în frontend (instrucțiunile proiectului, D-019).
- Nu se sincronizează coordonate (D-043). Monitorizarea live (FUTURE) cere o decizie separată de confidențialitate.
- Validarea locală / hash nu este anti-cheat (D-021, D-060); autoritatea pentru rezultate competitive va fi serverul (FUTURE).

---

## 12. Ce există azi

| | Status |
| --- | --- |
| Stare locală salvată și restaurată (`outdoor-escape:game:<id>`) | IMPLEMENTAT |
| Evenimente în motor (listă închisă, idempotente, `once`, limită de lanț) | IMPLEMENTAT (D-040) — nu sunt persistate ca jurnal, ci ca stări + `firedEvents` |
| Validator asincron înlocuibil (pregătit pentru server) | IMPLEMENTAT (D-021) |
| Coadă locală, `event_id`, sincronizare HTTP, server, polling, rejoin | DECIS; neimplementat |
| WebSocket | nu este cerință (FUTURE opțional) |

---

## 13. Testare (la implementare)

- Automat (`node --test`, fără rețea): idempotența pe `event_id`, ordonarea, reconstrucția stării din jurnal + coadă, fiecare regulă din §7.
- Browser: offline / online simulat, reload în timpul trimiterii, două tab-uri.
- Teren: segmente fără semnal (Șirnea / Fundata), două telefoane în aceeași echipă, schimbarea telefonului în mijlocul aventurii.
- Pentru fiecare: calea normală și calea de eșec / recuperare (`14_EDGE_CASES.md` §H).
