# OUTDOOR ESCAPE PLATFORM V1.1

| | |
| --- | --- |
| **Status** | ARHITECTURĂ DECISĂ — documentație. **Nu descrie funcționalități implementate**, cu excepția celor marcate explicit `IMPLEMENTAT`. |
| **Data** | 2026-09-30 |
| **Decizii** | D-050 – D-062 și D-064 – D-067 (CONFIRMED, arhitectural / neimplementat), D-063 (PROPOSED) în [`04_DECISIONS_LOG.md`](04_DECISIONS_LOG.md) |
| **Documente asociate** | [`14_EDGE_CASES.md`](14_EDGE_CASES.md) (scenarii limită), [`15_SESSION_SYNC.md`](15_SESSION_SYNC.md) (sincronizare), [`11_ADVENTURE_SCHEMA_V2.md`](11_ADVENTURE_SCHEMA_V2.md) §14 (extensii de schemă), [`03_ARCHITECTURE.md`](03_ARCHITECTURE.md) §13 |
| **Bază** | Inspecție read-only a `main` la commit-ul `a37db75` („test: add persistence reload regression coverage”) |

Acest document consolidează arhitectura platformei înainte de continuarea implementării. **Nu pornește niciun milestone** și nu modifică codul. Ce este descris aici ca `DECIS` este o cerință arhitecturală: implementarea viitoare trebuie să o respecte, dar ea nu există încă.

În caz de neconcordanță, jurnalul deciziilor (`04_DECISIONS_LOG.md`) are prioritate, iar acest document trebuie corectat.

---

## 0. Legenda statusurilor

| Status | Sens |
| --- | --- |
| `IMPLEMENTAT` | Există în cod și în teste pe `main` (verificat la 2026-09-30). |
| `PARȚIAL` | O parte există în cod; restul este `DECIS` sau `FUTURE`. Se spune explicit ce parte. |
| `DECIS` | Decizie arhitecturală confirmată (D-050 – D-062). **Neimplementat.** Implementarea viitoare trebuie să o respecte. |
| `PREGĂTIT PENTRU VIITOR` | Structura este descrisă (de exemplu câmpuri de schemă rezervate), dar nu este validată și nu are efect în motor. |
| `FUTURE` | Nu face parte din V1.1. Se introduce doar când există o cerință clară (D-019). Arhitectura nu trebuie să-l împiedice. |
| `DESCHIS` | Întrebare fără decizie (`PROPOSED` în jurnal). Nu se implementează nimic pe baza ei. |

Principiul general rămâne cel din `00_PROJECT_MASTER_CONTEXT.md` și D-019: **nu se introduc backend, autentificare, plăți, dashboard sau WebSocket doar pentru că sunt menționate aici ca viitor.**

---

## 1. Produsele platformei (D-050)

| Produs | Adresă planificată | Primul conținut | Status |
| --- | --- | --- | --- |
| **Walk** | `walk.outdoor-escape.ro` | aventuri pietonale în Brașov: mister, istorie, aventură medievală | DECIS ca produs; adresa: planificată |
| **Bike** | `bike.outdoor-escape.ro` | aventuri cu bicicleta, primul operator: **Funsy Bike** | DECIS ca produs; adresa: planificată |
| **AR** | — (nu este produs separat) | capabilitate transversală, utilizabilă în Walk și Bike | FUTURE |

- Walk și Bike folosesc **același motor** (D-005). Diferențele (profil GPS, reguli de siguranță, durată) vin din configurația aventurii, nu din cod separat.
- Aplicația publicată rămâne deocamdată la `https://rezervari.github.io/outdoor-escape/src/` (D-035). Mutarea pe subdomeniile de mai sus **nu este decisă ca dată și nici ca mod**. Consecință deja documentată în D-035: o adresă nouă (altă origine) înseamnă o aplicație nouă pentru telefon — progresul local, cache-ul și permisiunile nu se transferă. Mutarea trebuie făcută înainte de a exista sesiuni reale, sau împreună cu un mecanism de rejoin pe server (§6).

---

## 2. Modelul de domeniu (D-051)

### 2.1 Entitățile

```text
Route (infrastructură geografică)
  └── Adventure (definiția jocului, construită peste o rută)
        └── Adventure Version (publicată, imuabilă: 1.0, 1.1 …)
              └── Adventure Package (pachetul offline: adventure_id + version)

Purchase / Booking  (FUTURE)
      ↓
Adventure Pass      (dreptul de acces la o participare)
      ↓
Adventure Session   (o rulare concretă, fixată pe o Adventure Version)
      ↓
Team                (exact una per sesiune în V1.1)
      ↓
Participants        (1..n, fiecare cu propriul dispozitiv sau pe un dispozitiv comun)
```

| Entitate | Ce este | Ce NU este | Status |
| --- | --- | --- | --- |
| **Route** | Infrastructura geografică: geometria traseului, checkpoint-urile fizice (coordonate, geofence), segmentele, starea de disponibilitate (§12). | Nu conține poveste, provocări sau răspunsuri. | DECIS; neimplementat (azi locațiile stau în fișierul aventurii) |
| **Adventure** | Experiența / jocul construit peste o rută: narațiune, noduri, provocări, indicii, reguli, flux. | Nu este o rulare. Nu conține starea unei echipe. | IMPLEMENTAT ca fișier `content/adventures/<id>.json` (fără `routeId`) |
| **Adventure Version** | O versiune publicată, imuabilă, a unei aventuri (§9). | Nu se modifică după publicare. | PARȚIAL: câmpul `contentVersion` există; fixarea sesiunii pe versiune nu |
| **Adventure Package** | Setul de fișiere necesar unei versiuni pentru a rula offline (§8). | Nu include tile-uri OSM (D-046, D-056). | DECIS; neimplementat |
| **Adventure Pass** | Dreptul de acces la o participare (o echipă, o sesiune). | Nu este o plată și nu este o identitate de utilizator. | DECIS (model); emiterea: FUTURE |
| **Adventure Session** | O rulare concretă a unei aventuri, de către o echipă, pe o versiune fixă (`adventure_id` + `adventure_version` — D-066). **Sursa logică a stării jocului** (D-064). | Nu este aventura. | PARȚIAL (vezi §2.3) |
| **Team** | Structura de membri și roluri asociată unei sesiuni (§3.2). Nu are state machine independent (D-064). | Nu este un cont. Nu este o sursă de stare. | DECIS; neimplementat |
| **Participant** | O persoană (și dispozitivul ei) dintr-o echipă, cu identitate de sesiune și rol. | Nu este un cont de utilizator; nu cere autentificare. | DECIS; neimplementat |

### 2.2 Separări obligatorii

1. **Route ≠ Adventure.** Aceeași rută poate găzdui mai multe aventuri. Exemplu:

   ```text
   Circuit Șirnea (Route)
    ├── Mystery        (Adventure)
    ├── Family         (Adventure)
    ├── Nature         (Adventure)
    └── Treasure Hunt  (Adventure)
   ```

   Motorul nu conține nicio referință la Funsy Bike, Circuitul Șirnea, Brașov sau altă rută/operator (regulă existentă, verificată de un test automat — D-038).

2. **Adventure ≠ Adventure Session.** Aceeași aventură poate avea **simultan** oricâte sesiuni:

   ```text
   Adventure: Misterul Șirnei (v1.0)
   Session 001 → Team A
   Session 002 → Team B
   Session 003 → Team C
   ```

   Fiecare sesiune are, independent: echipa, participanții, progresul, răspunsurile, indiciile folosite, checkpoint-ul curent, starea, timpii, evenimentele și, eventual, ultima poziție GPS (vezi §15 — confidențialitate).

3. **Buyer ≠ Team Leader ≠ Participant.** Roluri distincte conceptual; pot fi aceeași persoană, dar nu obligatoriu (§2.4).

### 2.3 Ce există azi (verificat în cod)

- Starea salvată `outdoor-escape:game:<adventureId>` (D-029, D-043) este, de fapt, o **sesiune locală implicită**: una singură per aventură, per browser. Nu are `sessionId`, echipă sau participanți.
- Consecință: pe **browsere / dispozitive diferite**, fiecare browser are propria rulare independentă. Pe **același browser**, două sesiuni ale aceleiași aventuri nu pot coexista (aceeași cheie).
- Mai multe sesiuni simultane ale aceleiași aventuri pe dispozitive diferite sunt deci posibile deja, dar fără identitate, fără echipă și fără stare comună.
- Tranziția către modelul V1.1 cere o cheie de sesiune (`sessionId`) și nu trebuie să piardă progresul salvat existent (principiul migrării automate, D-043).

### 2.4 Roluri

| Rol | Responsabilitate | Note |
| --- | --- | --- |
| **Buyer** | Obține accesul (cumpără / rezervă). Primește Adventure Pass-ul. | Poate să nu joace deloc (ex. cadou, corporate). FUTURE (plăți/rezervări). |
| **Team Leader** | Formează echipa, trimite invitația, pornește aventura (READY → LOCKED → ACTIVE), poate lua decizii de echipă definite de aventură. | **Nu este single point of failure** (§7). Rolul este transferabil. |
| **Participant** | Joacă: vede starea comună, poate rezolva provocări, poate cere indicii (după regulile aventurii). | Nu se presupune că doar Leader-ul poate rezolva provocări. |
| **Operator** | Operatorul fizic al traseului (ex. Funsy Bike): poate marca un checkpoint indisponibil sau face bypass (§12–13). | Interfața operatorului: FUTURE. |
| **Admin / Content** | Publică versiuni, marchează conținut indisponibil. | Platformă de authoring: FUTURE. |

---

## 3. Lifecycle-uri (D-052)

### 3.1 Adventure Session

```text
CREATED
  ↓
TEAM_FORMING  ──→  CANCELLED
  ↓
READY
  ↓
LOCKED  ──→  (CONTENT DOWNLOAD → VALIDATE PACKAGE → CACHE READY, §8)
  ↓
ACTIVE  ⇄  PAUSED
  ↓
COMPLETED

Stări terminale de excepție (din orice stare nefinală, după reguli):
ABANDONED  ·  EXPIRED  ·  CANCELLED
```

| Stare | Sens | Implementat azi? |
| --- | --- | --- |
| `CREATED` | Sesiunea există (ex. creată dintr-un Adventure Pass), fără participanți. | nu |
| `TEAM_FORMING` | Participanții se pot alătura prin invitație. | nu |
| `READY` | Echipa este completă (după regula aventurii); se poate bloca. | nu |
| `LOCKED` | Echipa este fixată; se descarcă și se validează pachetul offline. | nu |
| `ACTIVE` | Se joacă. | echivalent: `playing` |
| `PAUSED` | Oprită intenționat, reluabilă. | nu |
| `COMPLETED` | Finalizată. | echivalent: `completed` |
| `ABANDONED` | Părăsită explicit de echipă (nu prin închiderea browserului — §6). | nu |
| `EXPIRED` | A depășit fereastra de valabilitate (regulă de configurat). | nu |
| `CANCELLED` | Anulată (ex. de Buyer / operator) înainte de finalizare. | nu |

- Nu toate stările trebuie implementate deodată. Starea actuală a motorului (`idle → playing → completed`) este un subset: `idle` ≈ „sesiune locală încă nepornită”.
- **Închiderea browserului, a tab-ului sau a aplicației nu este o tranziție de stare** (§6).
- Parametrii de timp (după cât timp o sesiune devine `EXPIRED`, cât poate dura `PAUSED`) sunt **configurabili**; valorile nu sunt decise (DESCHIS).

### 3.2 Team

```text
TEAM FORMING → READY → LOCKED → ACTIVE → COMPLETED
```

Aceste stări sunt o **vedere derivată din starea sesiunii** (D-064), nu un state machine independent al echipei. Team este structura de membri și roluri a sesiunii.

Plus stări de excepție (conceptual: echipă dizolvată înainte de start, echipă fără participanți activi). Lista exactă se stabilește la implementare.

După `LOCKED`:

- nu mai intră participanți noi;
- invite link-ul **nu** creează o altă sesiune;
- orice încercare ulterioară de join este tratată **explicit**: dacă persoana are deja identitate în sesiune → rejoin (§6); altfel → mesaj clar „Echipa a pornit deja; nu se mai pot alătura participanți noi” (fără sesiune nouă și fără participant nou). Scenariile: `14_EDGE_CASES.md`, secțiunea A.

### 3.3 Relația dintre cele două lifecycle-uri

În V1.1, o sesiune are exact o echipă, iar stările de formare (`TEAM_FORMING`, `READY`, `LOCKED`) apar în ambele. **Decis (D-064):** Adventure Session este sursa logică a stării jocului; starea echipei se derivă din ea, ca să nu existe două stări care se pot contrazice.

- `multi_device`: starea canonică este derivată din evenimentele acceptate de server (`15_SESSION_SYNC.md`).
- `shared_device`: starea locală rămâne sursa funcțională cât timp nu există backend (ca azi).

### 3.4 Participant (conceptual)

- Apartenența: `joined` → `left` (explicit) sau `removed` (de Leader / operator, dacă se va permite).
- Conectivitatea nu este o stare de apartenență: „nu a mai fost văzut de X minute” este o informație derivată (`last_seen`), nu o ieșire din echipă.
- Un participant care dispare accidental **rămâne membru** și poate reveni (§6).

---

## 4. Shared Team State (D-054)

Cerință V1.1: toți participanții aceleiași echipe aparțin aceleiași Adventure Session și văd **aceeași stare logică**.

```text
Participant A rezolvă CP3
      ↓
CHALLENGE_SOLVED (eveniment)
      ↓
SESSION STATE UPDATED
      ↓
CP4 UNLOCKED
      ↓
Participant B vede CP4 unlocked (după sincronizare)
```

- Starea comună conține: progresul pe noduri/misiuni, răspunsurile acceptate, indiciile dezvăluite (când sunt `shared`), checkpoint-ul curent, starea sesiunii, evenimentele relevante.
- Starea **locală** a unui dispozitiv (poziția GPS brută, ecranul deschis, preferința de sunet) nu face parte din starea comună.
- **Indicii:** dacă aventura definește indiciile ca `shared`, un indiciu folosit de un participant este vizibil (și contorizat) pentru toată echipa. Dacă sunt `per_participant`, rămân locale. Denumirea exactă a setării: `11_ADVENTURE_SCHEMA_V2.md` §14 (PREGĂTIT PENTRU VIITOR).
- Mecanismul (evenimente, coadă locală, sincronizare, idempotență): [`15_SESSION_SYNC.md`](15_SESSION_SYNC.md).

### 4.1 Moduri de dispozitiv

| Mod | Sens |
| --- | --- |
| `shared_device` | Un singur telefon conduce experiența echipei. Funcționează fără server (ca azi). |
| `multi_device` | Fiecare participant folosește propriul dispozitiv; toate reflectă aceeași stare comună, atunci când aventura este configurată astfel. |

- Nu se presupune că Leader-ul este singurul care poate rezolva provocări.
- `multi_device` **necesită** un serviciu de sincronizare persistent (backend). Backend-ul este FUTURE (D-019). Până atunci, singurul mod funcțional este `shared_device` — un comportament deja compatibil cu codul actual.
- D-026 („un telefon principal per echipă”, PROPOSED) este **SUPERSEDED** de D-054: `shared_device` rămâne un mod suportat, dar nu mai este singura direcție.

---

## 5. Sincronizarea stării (D-055)

WebSocket **nu** este obligatoriu. Direcția arhitecturală:

```text
Local UI
   ↓
Optimistic update
   ↓
Local event queue (persistentă)
   ↓
HTTP sync / short polling
   ↓
Persistent session state (server)
```

Cerințe: retry, protecție la evenimente duplicate (idempotență), consistență eventuală, reconectare, sincronizare după revenirea conexiunii. WebSocket (sau SSE) poate fi adăugat ulterior doar dacă este justificat de măsurători. Detalii complete: [`15_SESSION_SYNC.md`](15_SESSION_SYNC.md).

Motivare: în zone ca Șirnea / Fundata conexiunea mobilă poate fi instabilă; un canal permanent nu poate fi premisa jocului.

---

## 6. Session Continuity și Rejoin (D-053)

**Cerință arhitecturală obligatorie.** Închiderea accidentală a browserului, a tab-ului sau a aplicației **nu** înseamnă părăsirea aventurii.

```text
ACTIVE SESSION
     ↓
browser închis / tab închis / telefon blocat / app ucisă
     ↓
sesiunea rămâne ACTIVE
     ↓
participantul revine
     ↓
REJOIN
     ↓
restaurarea exactă a stării
```

Se restaurează: sesiunea, echipa, identitatea participantului, rolul, progresul, checkpoint-ul curent, provocarea curentă, starea jocului, indiciile, evenimentele relevante.

### 6.1 Niveluri de continuitate

| Situație | Mecanism | Status |
| --- | --- | --- |
| Reload / tab închis / browser închis, același browser | Progres salvat local (`localStorage`) și restaurat la pornire | **IMPLEMENTAT** pentru sesiunea locală (teste: `tests/persistence-reload.test.js`, `tests/progress-v2.test.js`) |
| Telefon blocat, aplicație în fundal | Starea nu se pierde; JavaScript/GPS pot fi suspendate de browser (D-028) | PARȚIAL: starea se păstrează; comportamentul în fundal rămâne D-028 (DESCHIS) |
| Date de browser șterse / alt browser / alt telefon | **Rejoin persistent** (D-065): link personal de rejoin (normal) sau cod de recuperare (alternativ), validate pe server | DECIS; necesită backend (FUTURE) |
| Leader-ul își pierde dispozitivul | Rejoin al Leader-ului sau transfer de rol (§7) | DECIS; necesită backend (FUTURE) |

### 6.2 Reguli

- Nu ne bazăm **exclusiv** pe `localStorage`: acesta rămâne un cache local al identității și al stării, nu sursa de adevăr în modul `multi_device`.
- Mecanisme de rejoin (D-065): **link personal de rejoin** — mecanismul normal; **cod de recuperare** — mecanism alternativ / de recuperare. Ambele identifică participantul existent și îl readuc în sesiunea existentă. Formatul exact al codului (scurt, ușor de dictat, fără caractere confundabile — în spiritul D-032) rămâne pentru implementare.
- Rejoin-ul duce **întotdeauna la sesiunea existentă**. Nu creează niciodată o sesiune nouă.
- Identitatea de participant nu este un cont și nu cere autentificare. Tokenul de rejoin este un secret per participant, **nu** o cheie de serviciu: nu se pune în cod, nu se pune în repository și nu se loghează.
- Linkurile de rejoin intră sub regulile D-035: aceeași origine, căi relative, parametrii se păstrează la redirecționarea din rădăcină (D-036).

---

## 7. Team Leader (D-053)

- Leader-ul **nu** este single point of failure. Dacă închide browserul, schimbă dispozitivul sau pierde temporar accesul, sesiunea continuă, iar ceilalți participanți pot juca în continuare (în `multi_device`).
- Acțiunile rezervate Leader-ului se limitează la cele de organizare (formare, pornire, blocare, eventual pauză). Rezolvarea provocărilor nu este rezervată Leader-ului.
- Arhitectura trebuie să permită ulterior **transferul rolului** (voluntar sau de către operator). Regulile de transfer automat (ex. după cât timp de absență): DESCHIS.

---

## 8. Offline First și Adventure Package (D-056)

Outdoor Escape se proiectează **offline-capable**, nu „online cu fallback”.

### 8.1 Fluxul înainte de START

```text
READY / LOCKED
      ↓
CONTENT DOWNLOAD      (cât timp există conectivitate bună)
      ↓
VALIDATE PACKAGE      (toate fișierele prezente, versiune corectă, integritate)
      ↓
CACHE READY
      ↓
START
```

### 8.2 În timpul jocului, fără internet

```text
GPS → LOCAL GAME ENGINE → LOCAL STATE → LOCAL EVENT QUEUE
```

La revenirea conexiunii: `LOCAL EVENTS → SYNC → SERVER` (`15_SESSION_SYNC.md`).

### 8.3 Conținutul pachetului

| Inclus în pachet | Exclus din pachet |
| --- | --- |
| conținutul aventurii (versiunea fixă) | **tile-urile OpenStreetMap standard** — interzis de D-046 și de politica OSM (fără prefetch, bulk download sau stocare offline) |
| conținutul provocărilor (fără răspunsuri în clar, când se folosește hash — §10) | fișiere pentru alte aventuri sau alte versiuni |
| imagini, audio, instrucțiuni | orice resursă din afara zonei și a nevoilor aventurii |
| geometria rutei și geofence-urile checkpoint-urilor (date proprii, nu tile-uri) | |
| alte asset-uri necesare aventurii | |

- Identificare: **`adventure_id` + `adventure_version`** (aceeași pereche care identifică versiunea sesiunii — D-066). Numele cache-ului urmează D-035 (prefixul proiectului), de exemplu `outdoor-escape:package:<adventure_id>:<version>` (formă orientativă, de fixat la implementare).
- Nu se presupune descărcarea tile-urilor lumii. Cache-ul este limitat la zona și resursele aventurii.
- **Harta offline:** fără conexiune, harta (strat de orientare, D-046) poate să nu aibă fundal; jocul continuă cu geofence-urile, instrucțiunile și „Am ajuns” (principiul M-003.2: harta nu este necesară progresului). O hartă offline cu un provider care permite explicit acest lucru este **DESCHIS** (D-063).
- Service worker-ul trebuie să poată servi pachetul offline pentru o versiune anume, fără să îl înlocuiască în timpul unei sesiuni active (§9).

### 8.4 Ce există azi

| | Status |
| --- | --- |
| Service worker network-first pentru shell + Leaflet local + aventura demo `brasov-centrul-vechi` (`CACHE_VERSION` `v6`) | IMPLEMENTAT |
| Cache per aventură / per versiune, descărcare înainte de START, validarea pachetului | DECIS; neimplementat |
| Media, audio în cache | neimplementat (nu există încă media) |

Atenție la comportamentul actual: strategia **network-first** încarcă, când există rețea, cea mai nouă versiune a fișierului aventurii. Este corectă pentru shell, dar **incompatibilă cu fixarea versiunii unei sesiuni** (§9). Se corectează în milestone-ul care implementează pachetul.

Riscuri de testat pe dispozitive reale: cota de stocare, ștergerea automată a datelor site-ului de către browser (în special Safari/iOS), comportamentul la actualizarea service worker-ului în timpul unei sesiuni (limitarea cunoscută din `03_ARCHITECTURE.md` §3c).

---

## 9. Adventure Versioning (D-057)

- O sesiune rulează pe o **versiune fixă** a aventurii. O Adventure Session reală este legată **obligatoriu** de `adventure_id` + `adventure_version`, unde `adventure_version` este versiunea publicată și imuabilă pe care rulează (D-066).

  ```text
  Adventure → Published Version 1.0 → Session 001 folosește 1.0
  Adventure → Published Version 1.1 → sesiunile noi folosesc 1.1
  ```

- O versiune publicată este **imuabilă**. Orice schimbare de conținut = versiune nouă.
- Conținutul unei sesiuni active **nu se modifică retrospectiv**.
- Starea de disponibilitate a checkpoint-urilor (§12) **nu este conținut**: este un strat operațional peste rută și se poate schimba în timpul unei sesiuni fără a încălca imuabilitatea versiunii.
- În schemă: `contentVersion` (existent, opțional) este versiunea aventurii din V1.1 (`version` din exemplul conceptual). Poate rămâne opțional în schema actuală până la implementarea completă a versionării (D-066); obligația de versiune se aplică Session, nu fișierelor de conținut existente. `schemaVersion` rămâne versiunea **formatului** (1 sau 2), nu a conținutului. Detalii: `11_ADVENTURE_SCHEMA_V2.md` §14.

Ce există azi: `contentVersion` este opțional și este copiat în progres, dar la restaurare nu este comparat. Restaurarea este „tolerantă” (entitățile noi pornesc din starea inițială, cele eliminate sunt ignorate — `11_ADVENTURE_SCHEMA_V2.md` §11), deci o sesiune locală continuă pe conținutul nou. Acest comportament rămâne valabil pentru dezvoltare și demo, dar **nu** satisface D-057 pentru sesiuni reale.

---

## 10. Discovery, validarea provocărilor și integritatea (D-060)

### 10.1 Discovery în două niveluri

```text
GPS CONFIRMS PRESENCE
        ↓
DISCOVERY / OBSERVATION
        ↓
CHALLENGE
        ↓
UNLOCK
```

GPS-ul singur nu este întotdeauna dovada finală a descoperirii. Corespondența cu schema actuală: prezența = locația (`player_arrived`), observația / provocarea = o misiune `observation` / `riddle` / `code` legată de locație. Misiunile de tip `location` (rezolvate la sosire) rămân permise pentru aventuri casual; nu sunt suficiente acolo unde integritatea contează.

### 10.2 Validarea răspunsurilor

**MVP (valabil azi, D-021):** validare locală în browser, izolată în `answers.js`, cu interfață asincronă. Azi răspunsurile sunt în **text clar** în conținut (hash-ul nu este implementat).

**Pregătit (D-060):** pentru răspunsurile sensibile la cheat, conținutul poate stoca:

```text
answer_hash = SHA-256(normalized_answer)
```

iar clientul compară hash-ul răspunsului normalizat (normalizarea D-024 se aplică înainte de hash).

> **Hash-ul în client NU reprezintă securitate anti-cheat reală.** Un utilizator tehnic poate inspecta aplicația, poate reproduce mecanismul și poate încerca răspunsurile scurte automat.

| Scop | Mecanism |
| --- | --- |
| funcționare offline, integritate de bază, reducerea expunerii răspunsului în clar | validare locală / hash (MVP) |
| scor competitiv, Treasure Hunt, clasamente, rezultate comerciale, anti-cheat real | **validare pe server ca autoritate** (FUTURE; cere backend și o variantă pentru semnal slab) |

### 10.3 GPS spoofing

GPS-ul nu este singura dovadă pentru aventurile unde integritatea contează. Mecanisme suplimentare posibile, alese per aventură / per checkpoint:

- cod fizic;
- cod QR;
- provocare de observație;
- obiect din lumea reală;
- validare de către operator.

QR-ul **nu** este obligatoriu pentru toate aventurile. Atenție: confirmarea manuală „Am ajuns” acordă azi punctele integral fără verificarea distanței (`11_ADVENTURE_SCHEMA_V2.md` §5); aventurile competitive vor avea nevoie de o regulă separată (deja semnalată acolo, DESCHIS).

---

## 11. GPS adaptiv și baterie (D-058)

### 11.1 Principiu

```text
departe de checkpoint  → polling mai rar
aproape de checkpoint  → polling mai frecvent
```

Factori: consumul bateriei, precizia GPS, capabilitățile dispozitivului, mișcarea, distanța față de rută, distanța față de checkpoint, raza geofence-ului.

- **Nicio valoare nu este fixată în arhitectură** (30 s, 60 s, 2 s, 5 s etc.). Toate sunt parametri configurabili, optimizați prin testare reală (Faza 5). Locul lor: valorile implicite în `defaults.js` (ca `DEFAULT_GEOLOCATION_OPTIONS`, D-045), eventual suprascrise per profil de aventură (Walk / Bike) — denumirile: `11_ADVENTURE_SCHEMA_V2.md` §14.
- Constrângere tehnică: Browser Geolocation API nu are un parametru de „interval”. Frecvența se poate controla doar indirect (oprirea / repornirea `watchPosition`, `getCurrentPosition` la intervale, `maximumAge`, `enableHighAccuracy`). Eficiența reală a fiecărei variante trebuie măsurată pe Android și iPhone.
- Regulile de zonă (`inside/near/outside/uncertain`, histerezis — D-039) **nu se schimbă**; strategia adaptivă decide doar **cât de des** se cer observații.

### 11.2 Baterie (important pentru Bike: 3–4 ore)

- fără polling continuu la frecvență maximă;
- frecvență redusă când precizia nu este necesară;
- frecvență crescută doar în apropierea checkpoint-ului;
- minimizarea procesării și a render-ului inutil (ex. harta nu se redesenează la fiecare fix — deja regulă M-003.2);
- folosirea cache-ului local (pachetul offline) în loc de rețea.

Status: GPS-ul actual (M-003.1) folosește `watchPosition` cu opțiuni fixe, doar cu pagina activă — IMPLEMENTAT. Strategia adaptivă: DECIS; neimplementat. Fundal / ecran stins: D-028 (DESCHIS).

---

## 12. Route Health (D-061)

Fiecare checkpoint / segment are o stare de disponibilitate:

```text
ACTIVE  ·  UNAVAILABLE  ·  BYPASSED
```

Cauze posibile pentru `UNAVAILABLE`: lucrări, acces blocat, obiectiv închis, vreme, situație de siguranță, intervenția operatorului.

- Disponibilitatea aparține **rutei** (infrastructură), nu aventurii: toate aventurile de pe aceeași rută o văd.
- Este un strat operațional, separat de versiunea aventurii (§9).
- Offline: pachetul conține starea cunoscută la descărcare; actualizările ajung la sincronizare. Un dispozitiv offline poate afla prea târziu că un punct e închis — de aceea bypass-ul trebuie să fie posibil și local (§13).

Status: DECIS; neimplementat. Nu există azi nicio stare de disponibilitate.

---

## 13. Skip și Bypass (D-061)

Motorul trebuie să permită **bypass-ul unui checkpoint**, astfel încât aventura să continue:

```text
Checkpoint unavailable → BYPASS → Adventure continues
```

| Tip | Cine / ce îl declanșează | Exemplu |
| --- | --- | --- |
| `AUTOMATIC SKIP` | motorul, după o regulă (ex. checkpoint marcat `UNAVAILABLE` la sincronizare) | punct închis anunțat înainte ca echipa să ajungă |
| `OPERATOR SKIP` | operatorul (ex. Funsy Bike), pentru o sesiune sau pentru rută | drum blocat de o furtună |
| `ADMIN / CONTENT SKIP` | administratorul de conținut | obiectiv închis permanent până la o versiune nouă |

- Fiecare bypass produce un **eveniment de audit** cu: checkpoint, tip, motiv, sursa (actor), momentul, sesiunea. Evenimentul este păstrat în istoricul sesiunii și sincronizat.
- **Bypass ≠ skip de jucător.** „Sari peste” (misiune `skipped`, 0 puncte) există azi și este o alegere a jucătorului — IMPLEMENTAT. Bypass-ul este o decizie operațională, independentă de jucător — DECIS; neimplementat.
- Efectul în scor al unui bypass: DESCHIS (legat de D-025).

---

## 14. Flux liniar vs. graf; rutare dinamică (D-062)

```text
Linear:   CP1 → CP2 → CP3 → CP4

Graph:              CP2
                   /   \
          CP1 ────       ─── CP5
                   \   /
                    CP3
```

Model conceptual `flow.type: linear | graph`.

- Primele aventuri pot fi strict liniare.
- Motorul trebuie proiectat astfel încât graful / ramificarea să poată fi introduse **fără refactorizare fundamentală**.
- Azi: `settings.progression` acceptă doar `"linear"`; motorul folosește `currentMissionId` (o singură misiune curentă) — IMPLEMENTAT (liniar). Evenimentele (`unlock_mission`, `unlock_location`) permit deja deblocări în afara ordinii, dar doar pe traseele `bonus` / `secret`.
- Cerințe de proiectare pentru graf (DECIS, neimplementat): progresul se exprimă prin starea nodurilor (există deja: stări pe entități, D-043), nu printr-un index; „nodurile deschise” pot fi mai multe simultan; condițiile de îmbinare (toate / oricare dintre predecesori) se declară în conținut; bypass-ul unui nod (§13) trebuie să poată satisface condiția de îmbinare.

**Rutare dinamică** — se separă:

| Aspect | Unde stă |
| --- | --- |
| geometria rutei | Route |
| progresia aventurii | Adventure (flux) + Session (stare) |
| disponibilitatea checkpoint-urilor | Route Health (§12) |
| ordinea checkpoint-urilor | Adventure (flux), nu geometria |

Un checkpoint poate fi dezactivat fără rescrierea întregii rute.

---

## 15. Bike: siguranță, audio și haptic (D-059)

### 15.1 Bike Safety Loop (regulă de design)

```text
PEDALEAZĂ → OBSERVĂ → AJUNGI LA PUNCT → OPREȘTE → FOLOSEȘTE TELEFONUL
→ REZOLVĂ → DEBLOCHEAZĂ → PUNE TELEFONUL DEOPARTE → CONTINUĂ
```

Nu se introduc mecanisme care recompensează:

- viteza;
- folosirea telefonului în mers;
- interacțiunea cu telefonul în timpul deplasării.

Consecințe pentru decizii deschise: în aventurile Bike, timpul nu este factor de scor (constrângere pentru D-025); misiunile `timed` nu se folosesc pe segmentele parcurse în mers. Fiecare checkpoint Bike are un avertisment de siguranță în conținut (`safety_warning` în exemplul conceptual — `11_ADVENTURE_SCHEMA_V2.md` §14).

### 15.2 Audio / haptic ca funcționalitate de siguranță

Posibile semnale: beep, vibrație, text-to-speech, prompt audio. Exemplu: „Te apropii de Checkpoint 3. Oprește când este în siguranță.”

- Sunt funcționalități de **siguranță / UX**, nu mecanici de joc.
- **Risc tehnic, de testat pe dispozitive reale:** browserul nu garantează redarea audio în fundal sau cu ecranul stins; autoplay-ul este blocat până la o interacțiune; vibrația nu este disponibilă în toate browserele (în special Safari pe iPhone); vocile text-to-speech diferă între dispozitive. Nu se presupune niciun comportament până nu este verificat pe Android și iPhone.
- Status: FUTURE (după D-028). Schema are deja `audio` cu text alternativ obligatoriu (M-002), fără player.

### 15.3 Confidențialitate

D-043 rămâne valabilă: coordonatele și traseul jucătorului **nu se salvează**. „Eventuala poziție GPS” a unei sesiuni (§2.2) și monitorizarea live (FUTURE) cer o decizie separată de confidențialitate (ce se transmite, cui, cât timp se păstrează) înainte de orice implementare (`03_ARCHITECTURE.md` §10).

### 15.4 Joc cu sau fără închiriere (D-067)

Aceeași Adventure Bike poate fi oferită comercial în două variante:

| Variantă | Sens |
| --- | --- |
| `GAME_ONLY` | participantul folosește bicicleta proprie |
| `GAME_PLUS_BIKE_RENTAL` | bicicleta este furnizată printr-un partener / operator (ex. Funsy Bike) |

- Adventure și Route **nu depind** de închirierea bicicletei; varianta comercială nu schimbă conținutul, versiunea sau motorul.
- Nu se introduc acum entități `Product`, `Booking`, `RentalProvider` etc.; rămân pentru faza comercială ulterioară (FUTURE).
- Funsy Bike nu se hardcodează în motor (D-051).

---

## 16. Conținut: Funsy Bike și Walk

| | Ce este stabilit | Ce NU este stabilit |
| --- | --- | --- |
| **Bike — Funsy Bike** | Primul operator. Prima rută: zona Fundata / Șirnea; plecare de la Funsy Bike; circuit de aproximativ 20 km; aproximativ 3–4 ore; revenire la Funsy Bike. | Punctele și traseul exact — **trebuie validate pe teren** înainte de implementarea conținutului. |
| **Walk — Brașov** | Prima direcție: mister, istorie, aventură medievală. | Numele aventurii și traseul — **nu sunt DECIDED** (titlul de lucru din `05_GAME_DESIGN_SPEC.md` rămâne „WORKING TITLE — NOT FINAL”). Locațiile candidate trebuie validate. |

- Nimic din tabelul de mai sus nu se pune în motor (D-038, D-051).
- Exemplul conceptual „Misterul Șirnei” (`11_ADVENTURE_SCHEMA_V2.md` §14) are **coordonate ilustrative, nevalidate** și un punct („Ursa Mică”) folosit doar ca exemplu. Nu este conținut real și nu conține afirmații istorice verificate (D-011).

---

## 17. Tabel: MVP vs. viitor (verificat în repository la 2026-09-30)

| Funcționalitate | Status | Detalii |
| --- | --- | --- |
| Adventure Engine | **IMPLEMENTAT** (fundația V2, liniar) | schemă V2, evenimente, progres pe entități, GPS cu pagina activă (M-003.1), hartă (M-003.2, comisă, acceptată de proprietar la 30.09.2026 — închisă); 132 de teste `node --test` verzi (rulate la 2026-09-30) |
| Adventure Session | PARȚIAL / DECIS | sesiune locală implicită, una per aventură per browser; `sessionId`, lifecycle-ul complet, Session ca sursă a stării (D-064), legarea de `adventure_id` + `adventure_version` (D-066): DECIS |
| Team | DECIS | neimplementat |
| Participant | DECIS | neimplementat |
| Buyer / Team Leader / Participant (roluri) | DECIS | neimplementat |
| Adventure Pass | DECIS (model) | emiterea depinde de Payments / Booking (FUTURE) |
| Session continuity | PARȚIAL / DECIS | același browser: IMPLEMENTAT (reload, închidere); alt browser / telefon / date șterse: DECIS, cere backend |
| Rejoin (link personal + cod de recuperare, D-065) | DECIS | cere backend |
| Shared state | DECIS | cere backend pentru `multi_device` |
| Multi-device | DECIS / arhitectural | `shared_device` funcționează azi (un telefon); `multi_device`: neimplementat |
| Sincronizare (event queue, HTTP) | DECIS / arhitectural | neimplementat; `15_SESSION_SYNC.md` |
| Offline content (Adventure Package) | DECIS / arhitectural | azi: shell + demo în cache, network-first |
| Adventure versioning | PARȚIAL / DECIS | `contentVersion` există; fixarea sesiunii: neimplementat |
| Adaptive GPS | DECIS / arhitectural | azi: `watchPosition` cu opțiuni fixe |
| Route ≠ Adventure (`routeId`, geometrie) | DECIS | PREGĂTIT PENTRU VIITOR în schemă (§14 din `11`) |
| Route Health / Bypass | DECIS | neimplementat; skip de jucător: IMPLEMENTAT |
| Flow graph | DECIS (engine pregătit conceptual) | azi doar `linear` |
| Answer hash | PREGĂTIT PENTRU VIITOR | azi text clar, validare locală (D-021) |
| Audio / haptic de siguranță | FUTURE | risc tehnic de testat |
| Payments | FUTURE | D-008, D-019 |
| Booking | FUTURE | |
| Backend | FUTURE | repository-ul actual nu are backend (D-019) |
| Operator dashboard | FUTURE | |
| Live monitoring | FUTURE | cere și decizie de confidențialitate (§15.3) |
| WhatsApp integration | FUTURE | |
| AR | FUTURE | capabilitate transversală, nu produs |
| Analytics | FUTURE | Faza 7 |
| Authoring platform | FUTURE | Faza 10 |
| Harta offline | DESCHIS (D-063) | tile-urile OSM sunt excluse (D-046) |

---

## 18. Contradicții găsite și cum au fost tratate (2026-09-30)

| # | Contradicție | Rezolvare |
| --- | --- | --- |
| 1 | V1.1 cere „relevant map data” offline; D-046 + politica OSM interzic prefetch / stocare offline de tile-uri. | Decizia proprietarului: tile-urile OSM **sunt excluse** din pachet; D-046 rămâne neschimbată; harta offline cu alt provider = D-063 (PROPOSED). |
| 2 | D-026 (PROPOSED: un telefon per echipă) vs. `multi_device` (V1.1). | Decizia proprietarului: D-054 CONFIRMED, D-026 SUPERSEDED. `shared_device` rămâne mod suportat. |
| 3 | Numerotare: `12_MAP_SPECIFICATION_M-003.2.md` exista deja. | Decizia proprietarului: documentele noi sunt `13_PLATFORM_V1.1.md`, `14_EDGE_CASES.md`, `15_SESSION_SYNC.md`. |
| 4 | Documentația spunea că M-003.2 este „necomisă”; git log arată commit-ul `39a6b28` („feat: implement M-003.2 map”). | Decizia proprietarului: corectat doar faptul („comisă”); statusul „pending owner review” rămâne. Ulterior: M-003.2 acceptat de proprietar și închis la 30.09.2026. |
| 5 | Restaurarea tolerantă + network-first aplică conținut nou unei sesiuni locale în curs; D-057 cere versiune fixă. | Nu este o contradicție între documente, ci o diferență între codul actual și arhitectura decisă. Documentată ca neimplementată (§8.4, §9). |
| 6 | D-025 / `00` §4 menționează „time/scoring system”; Bike Safety Loop interzice recompensarea vitezei. | Documentată ca constrângere pentru D-025 (Bike: timpul nu e factor de scor); D-025 rămâne PROPOSED. |
| 7 | „Eventuala poziție GPS” a sesiunii / live monitoring vs. D-043 (nu se salvează coordonatele). | D-043 rămâne valabilă; orice stocare/transmitere de poziție cere decizie separată (§15.3). |
| 8 | `00_PROJECT_MASTER_CONTEXT.md` §12 („concept / pre-development”) și D-013 erau depășite. | Adăugată o notă datată în `00`; D-013 păstrată ca istoric. |

---

## 19. Decizii deschise legate de V1.1

- D-063 — harta offline (provider cu licență offline sau fără hartă offline).
- Rejoin: formatul exact al codului de recuperare (legat de D-032). Mecanismul: decis în D-065.
- Parametrii de timp ai sesiunii (`EXPIRED`, `PAUSED`).
- Transferul automat al rolului de Leader.
- Efectul bypass-ului în scor (D-025).
- Confidențialitatea poziției în sesiune și în monitorizarea live (§15.3, D-043).
- Mutarea pe `walk.` / `bike.outdoor-escape.ro` (D-035).
- D-028 (fundal / ecran stins), D-025 (cronometru și scor), D-034 (conținut real în repository public) — rămân deschise, neschimbate.
