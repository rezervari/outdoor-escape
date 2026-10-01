# OUTDOOR ESCAPE — EDGE CASES (PLATFORM V1.1)

| | |
| --- | --- |
| **Status** | Specificație orientată spre implementare. **Nu descrie comportament implementat**, cu excepția rândurilor marcate `Azi: IMPLEMENTAT`. |
| **Data** | 2026-09-30 |
| **Arhitectura** | [`13_PLATFORM_V1.1.md`](13_PLATFORM_V1.1.md) · sincronizare: [`15_SESSION_SYNC.md`](15_SESSION_SYNC.md) · decizii D-050 – D-067 în [`04_DECISIONS_LOG.md`](04_DECISIONS_LOG.md) |

Fiecare caz are: **scenariul**, **starea inițială**, **evenimentul**, **comportamentul așteptat**, **starea finală** și **implicația pentru motor**. Linia „Azi” spune ce face codul actual (verificat la commit-ul `a37db75`), ca diferența față de țintă să fie vizibilă.

Termeni: *sesiune* = Adventure Session; *participant* = identitatea de sesiune a unei persoane pe un dispozitiv; *stare comună* = starea logică a sesiunii (`13_PLATFORM_V1.1.md` §4); *coadă locală* = coada persistentă de evenimente (`15_SESSION_SYNC.md` §4).

Principii care se aplică tuturor cazurilor:

1. **Nicio fundătură** (D-006, instrucțiunile proiectului): jucătorul are întotdeauna o cale de continuare sau un mesaj clar despre ce poate face.
2. **Închiderea aplicației nu este părăsire** (D-053).
3. **Rejoin-ul nu creează niciodată o sesiune nouă** (D-053, D-065): link personal de rejoin (normal) sau cod de recuperare (alternativ).
6. **Session este sursa stării** (D-064); Team este doar structura de membri și roluri. În `shared_device` fără backend, starea locală rămâne sursa funcțională.
4. **Nimic nu se pierde offline**: orice acțiune locală ajunge în coada locală și se sincronizează ulterior (D-055, D-056).
5. **Conținutul unei sesiuni active nu se schimbă** (D-057); disponibilitatea checkpoint-urilor este strat operațional separat (D-061).

---

## A. Acces

### A1. Link de invitație deschis prima dată
- **Stare inițială:** sesiune `TEAM_FORMING`; dispozitivul nu are identitate pentru sesiune.
- **Eveniment:** participantul deschide invite link-ul.
- **Comportament așteptat:** se afișează aventura și echipa; participantul își alege numele afișat; se creează identitatea de participant; se salvează local identitatea și se oferă imediat linkul personal de rejoin / codul de recuperare.
- **Stare finală:** participant `joined`; sesiunea rămâne `TEAM_FORMING`.
- **Implicație:** evenimentul `participant_joined` (idempotent pe `participant_id`); identitatea este generată o singură dată per dispozitiv și sesiune.
- **Azi:** neimplementat (nu există invitații; aplicația pornește direct aventura).

### A2. Același link de invitație deschis din nou, pe același dispozitiv
- **Stare inițială:** dispozitivul are deja identitatea salvată pentru sesiune.
- **Eveniment:** redeschiderea invite link-ului.
- **Comportament așteptat:** **rejoin** automat ca același participant; nu se creează un al doilea participant.
- **Stare finală:** neschimbată.
- **Implicație:** la deschiderea unui link, se verifică întâi identitatea locală pentru `session_id`.
- **Azi:** echivalentul local: redeschiderea aplicației restaurează progresul salvat — IMPLEMENTAT.

### A3. Participant nou, echipa încă deschisă
- **Stare inițială:** `TEAM_FORMING` sau `READY`, sub limita de participanți a aventurii.
- **Eveniment:** o persoană nouă deschide invitația.
- **Comportament așteptat:** ca A1; ceilalți participanți văd noul membru după sincronizare. Dacă sesiunea era `READY`, rămâne `READY` (sau revine la `TEAM_FORMING`, după regula aventurii — DESCHIS).
- **Stare finală:** participant adăugat.
- **Implicație:** limita de participanți este configurație a aventurii / pass-ului, nu constantă în motor.

### A4. Invitație deschisă după LOCKED
- **Stare inițială:** sesiune `LOCKED` sau `ACTIVE`; dispozitivul **nu** are identitate.
- **Eveniment:** deschiderea invite link-ului.
- **Comportament așteptat:** mesaj explicit: echipa a pornit deja; nu se mai pot alătura participanți noi; dacă persoana era deja în echipă, să folosească linkul personal de rejoin sau codul de recuperare (A2 / C8). **Nu** se creează o sesiune nouă și nu se adaugă un participant.
- **Stare finală:** neschimbată.
- **Implicație:** răspunsul serverului distinge clar `team_locked` de `invalid_link`; evenimentul de refuz se poate loga (fără date personale).

### A5. Link invalid
- **Stare inițială:** oricare.
- **Eveniment:** link cu identificator inexistent, trunchiat sau modificat.
- **Comportament așteptat:** ecran de eroare pe înțelesul jucătorului, cu acțiuni: „Verifică linkul”, „Introdu codul de recuperare”, contact operator. Fără sesiune nouă.
- **Stare finală:** fără efect.
- **Implicație:** validarea formatului înainte de orice cerere; niciun detaliu tehnic în mesaj.
- **Azi:** cel mai apropiat echivalent este parametrul `?adventure=<id>`: un id cu format invalid este ignorat (se încarcă aventura implicită), iar un id valid dar inexistent duce la ecranul de eroare cu „Încearcă din nou” — IMPLEMENTAT doar pentru acest parametru; nu există linkuri de sesiune.

### A6. Link expirat
- **Stare inițială:** sesiune `EXPIRED`, `COMPLETED` sau `CANCELLED`; ori Adventure Pass expirat.
- **Eveniment:** deschiderea linkului.
- **Comportament așteptat:** mesaj care spune starea (expirată / finalizată / anulată); pentru `COMPLETED`, rezultatul final rămâne vizibil (read-only), dacă aventura permite. Fără sesiune nouă.
- **Stare finală:** neschimbată.
- **Implicație:** starea terminală este păstrată; fereastra de valabilitate este parametru configurabil (DESCHIS).

---

## B. Continuitatea sesiunii

### B1. Browser închis
- **Stare inițială:** `ACTIVE`, participant cu identitate locală.
- **Eveniment:** browserul este închis.
- **Comportament așteptat:** sesiunea rămâne `ACTIVE`; nimic nu se trimite ca „părăsire”. La redeschidere → restaurarea exactă (checkpoint, provocare, indicii, starea hărții nu contează).
- **Stare finală:** `ACTIVE`, neschimbată.
- **Implicație:** nu se folosește `pagehide` / `beforeunload` pentru a marca părăsirea; evenimentele necorespondente rămân în coada locală.
- **Azi:** progresul local este restaurat după închidere și reload — IMPLEMENTAT (`tests/persistence-reload.test.js`).

### B2. Tab închis
- Ca B1. Alte tab-uri ale aceleiași sesiuni (dacă există) continuă. **Implicație:** starea salvată locală trebuie să fie sigură la scrieri din mai multe tab-uri (ultima scriere nu trebuie să șteargă evenimente din coadă) — de verificat la implementare.

### B3. Reload
- **Comportament așteptat:** restaurare identică; mesajele tranzitorii (ex. „Răspuns incorect”) nu se reafișează; coada locală reia sincronizarea.
- **Azi:** IMPLEMENTAT pentru progresul local (mesajul „Răspuns incorect” nu este salvat, „Corect!” se reconstruiește — `03_ARCHITECTURE.md` §3c). Interfața (TASK 4) se reconstruiește din progresul salvat: un puzzle activ își redeschide overlay-ul, iar indiciile deschise reapar din `hintsUsed`; confirmarea unui indiciu (stare de interfață efemeră, D-030) nu este salvată și nu reapare după reîncărcare, deci nu se consumă nimic. O aventură încheiată rămâne pe ecranul de rezultat.

### B4. Telefon blocat
- **Stare inițială:** `ACTIVE`, GPS activ.
- **Eveniment:** ecranul se blochează.
- **Comportament așteptat:** browserul poate suspenda JavaScript și GPS-ul. La deblocare: GPS-ul se reia, ultima poziție se reevaluează, sincronizarea reia coada. Timpul se calculează din timestamp-uri, nu dintr-un contor în pagină (D-025, D-028).
- **Stare finală:** `ACTIVE`.
- **Implicație:** nicio logică nu presupune rulare continuă. Semnalele audio/haptice în fundal nu sunt garantate (`13_PLATFORM_V1.1.md` §15.2).
- **Azi:** starea se păstrează; urmărirea GPS se oprește la `pagehide` și repornește doar prin „Activează locația” (D-045). Comportamentul complet: D-028 (DESCHIS).

### B5. Browser / aplicație ucisă de sistem
- Ca B1: nu există diferență pentru sesiune. **Implicație:** toate scrierile esențiale (starea, coada) sunt persistate imediat, nu la închidere.

### B6. Schimbarea dispozitivului
- **Stare inițială:** participant pe telefonul A; sesiune `ACTIVE`.
- **Eveniment:** deschide linkul personal de rejoin pe telefonul B (mecanismul normal) sau, dacă nu are linkul, introduce codul de recuperare (mecanismul alternativ — D-065).
- **Comportament așteptat:** B devine același participant, cu același rol, în aceeași sesiune; starea sesiunii se descarcă de pe server; dacă pachetul offline pentru `adventure_id` + `adventure_version` ale sesiunii nu există pe B, se descarcă (cu avertisment dacă semnalul e slab). Telefonul A, dacă revine, rămâne valid sau este invalidat (politică DESCHIS — de ales la implementare; în ambele cazuri fără pierdere de progres).
- **Stare finală:** același participant, alt dispozitiv.
- **Implicație:** identitatea participantului nu este legată de dispozitiv; evenimentele de pe A încă nesincronizate se vor sincroniza când A revine (idempotență).
- **Azi:** neimplementat (cere backend).

### B7. Date de browser șterse
- Ca B6, pe același telefon. Singura cale: linkul personal de rejoin sau, în lipsa lui, codul de recuperare (D-065). **Implicație:** evenimentele din coada locală care nu au fost sincronizate înainte de ștergere se pierd — riscul trebuie redus prin sincronizare frecventă când există rețea.
- **Azi:** progresul se pierde (doar `localStorage`).

### B8. Rejoin (general)
- **Comportament așteptat:** rejoin-ul — prin linkul personal sau prin codul de recuperare (D-065) — identifică participantul existent și îl duce la **sesiunea existentă**; restaurează sesiunea, echipa, identitatea, rolul, progresul, checkpoint-ul curent, provocarea curentă, indiciile și evenimentele relevante. **Nu creează** o sesiune nouă, chiar dacă sesiunea locală lipsește.
- **Implicație:** starea finală pe dispozitiv = starea sesiunii derivată din evenimentele acceptate de server (D-064) + evenimentele locale încă nesincronizate (reaplicate idempotent).

### B9. Rejoin al Leader-ului
- **Stare inițială:** Leader-ul a pierdut accesul; ceilalți joacă.
- **Eveniment:** Leader-ul revine (același dispozitiv, link personal de rejoin sau cod de recuperare).
- **Comportament așteptat:** își recapătă rolul, **dacă** rolul nu a fost transferat între timp; altfel revine ca participant.
- **Implicație:** rolul este stare a sesiunii (D-064), nu a dispozitivului și nu a unei stări separate a echipei.

---

## C. Echipă

Team este structura de membri și roluri a sesiunii, fără state machine propriu (D-064): toate schimbările de mai jos sunt evenimente ale **sesiunii**.

### C1. Participant întârziat
- **Stare inițială:** sesiune `ACTIVE` (deci `LOCKED` trecut).
- **Eveniment:** o persoană care nu s-a alăturat înainte de blocare vrea să intre.
- **Comportament așteptat:** ca A4 — nu se adaugă participanți noi. Opțiunea practică: joacă pe dispozitivul unui coechipier (`shared_device`). O excepție controlată (ex. operatorul permite) este FUTURE.
- **Implicație:** regula de blocare este strictă în motor; eventualele excepții vin doar din acțiuni de operator, auditate.

### C2. Leader indisponibil
- **Stare inițială:** `ACTIVE`, `multi_device`; Leader-ul nu mai sincronizează.
- **Comportament așteptat:** ceilalți participanți continuă să joace normal (Leader-ul nu este single point of failure). Acțiunile rezervate Leader-ului (ex. pauză) rămân indisponibile până la revenire sau transfer.
- **Implicație:** nicio acțiune de joc nu cere Leader-ul; lista acțiunilor rezervate este minimă și configurabilă.

### C3. Transferul rolului de Leader
- **Eveniment:** Leader-ul transferă rolul, sau operatorul îl transferă (FUTURE: transfer automat după absență — DESCHIS).
- **Comportament așteptat:** noul Leader este vizibil tuturor după sincronizare; un singur Leader în orice moment.
- **Implicație:** evenimentul `leader_transferred`; la conflict (două transferuri concurente) câștigă ordinea acceptată de server (`15_SESSION_SYNC.md` §7).

### C4. Participant care pleacă explicit
- **Eveniment:** „Părăsește echipa” (acțiune explicită, cu confirmare).
- **Comportament așteptat:** participantul devine `left`; progresul echipei **rămâne**; contribuțiile lui rămân în istoric. Dacă era Leader, rolul trebuie transferat înainte sau automat (DESCHIS).
- **Implicație:** plecarea unui participant nu schimbă starea sesiunii; ultimul participant care pleacă explicit poate duce sesiunea la `ABANDONED` (cu confirmare).

### C5. Participant care dispare accidental
- **Comportament așteptat:** rămâne membru; ceilalți pot vedea „nevăzut de X min” (informație derivată), fără efect asupra jocului. Poate reveni oricând (B1–B8).
- **Implicație:** nu există timeout care îl scoate din echipă.

---

## D. Conectivitate

### D1. Internet pierdut în timpul jocului
- **Stare inițială:** `ACTIVE`, pachet offline `CACHE READY`.
- **Comportament așteptat:** jocul continuă local: GPS → motor local → stare locală → coadă locală. Un indicator discret arată „offline — progresul se salvează pe telefon”. Harta poate rămâne fără fundal (tile-urile OSM nu sunt în pachet — D-056); jocul nu depinde de ea.
- **Stare finală:** `ACTIVE`; coada crește.
- **Implicație:** validarea locală (D-021 / hash) permite continuarea provocărilor offline; validările care cer server (competitiv — FUTURE) trebuie să aibă o variantă pentru lipsa rețelei.

### D2. Internet restabilit
- **Comportament așteptat:** coada se trimite în ordine; starea comună se actualizează; eventualele conflicte se rezolvă după regulile din `15_SESSION_SYNC.md` §7; utilizatorul nu trebuie să facă nimic.
- **Implicație:** declanșare la evenimentul `online`, la revenirea în pagină și periodic (nu doar la `online`, care nu este fiabil).

### D3. Conexiune intermitentă
- **Comportament așteptat:** trimiteri în loturi mici, cu retry și backoff; niciun blocaj al interfeței în așteptarea serverului (optimistic UI).
- **Implicație:** timeouts scurte, configurabile; nicio acțiune de joc nu așteaptă confirmarea serverului, cu excepția celor care cer explicit autoritatea serverului (FUTURE).

### D4. Start offline
- **Stare inițială:** `LOCKED`, pachetul **descărcat și validat**, fără rețea la START.
- **Comportament așteptat:** START este permis; `session_started` intră în coadă. Dacă pachetul **nu** este gata: START este blocat cu explicație și opțiunea „Reîncearcă descărcarea”; în lipsa totală a pachetului nu se poate juca (nu există conținut).
- **Implicație:** starea „pachet gata” se verifică local, pe baza `adventure_id` + `adventure_version` ale sesiunii (D-066).

### D5. Retry al sincronizării
- **Comportament așteptat:** același eveniment poate fi trimis de mai multe ori fără efect dublu.
- **Implicație:** fiecare eveniment are `event_id` unic, generat pe dispozitiv; serverul îl acceptă o singură dată (`15_SESSION_SYNC.md` §6).

### D6. Evenimente duplicate
- **Scenariu:** același eveniment ajunge de două ori (retry, două tab-uri, rejoin), sau doi participanți rezolvă aceeași provocare aproape simultan.
- **Comportament așteptat:** duplicatul exact (`event_id` identic) este ignorat. Două rezolvări diferite ale aceleiași provocări: prima acceptată de server câștigă; a doua devine no-op (provocarea e deja `solved`), fără puncte duble.
- **Implicație:** acțiunile motorului sunt idempotente (principiu existent — D-040); `award_points` rămâne interzis în reguli repetabile.

---

## E. GPS

### E1. Permisiune refuzată
- **Comportament așteptat:** explicație clară; jocul continuă cu „Am ajuns” (dacă aventura permite), observații și coduri fizice. Nicio fundătură.
- **Azi:** IMPLEMENTAT (stare „refuzat”, urmărirea se oprește, „Am ajuns” disponibil — M-003.1).

### E2. GPS indisponibil
- **Comportament așteptat:** ca E1; urmărirea reîncearcă fără să blocheze interfața.
- **Azi:** IMPLEMENTAT (indisponibil / timeout → urmărirea continuă — D-045).

### E3. Precizie slabă
- **Comportament așteptat:** poziția este „uncertain” și nu declanșează nimic; se afișează „semnal slab”; confirmarea manuală rămâne disponibilă.
- **Azi:** IMPLEMENTAT (`maxAccuracy`, `geo.assessFix` — D-039, D-045).

### E4. GPS spoofing
- **Scenariu:** poziție falsificată pentru a „ajunge” fără prezență fizică.
- **Comportament așteptat:** pentru aventuri casual, acceptat ca risc (aceleași puncte ca „Am ajuns”). Pentru aventuri unde integritatea contează: GPS-ul nu este singura dovadă — se cere o dovadă suplimentară configurată per checkpoint (cod fizic, QR, observație, obiect real, operator) și, în viitor, validare pe server.
- **Implicație:** nivelul de integritate este configurație a aventurii / checkpoint-ului (`11_ADVENTURE_SCHEMA_V2.md` §14), nu un comportament global.
- **Azi:** nicio protecție; confirmarea manuală acordă punctele integral (`11_ADVENTURE_SCHEMA_V2.md` §5).

### E5. Deviere de la rută
- **Comportament așteptat:** informativ (ex. „Ești la X m de traseu”), fără blocare și fără penalizare. În Bike, fără cerința de a folosi telefonul în mers: semnal audio/haptic doar dacă este disponibil și sigur (D-059).
- **Implicație:** necesită geometria rutei (Route) — DECIS, neimplementat; frecvența verificării urmează GPS-ul adaptiv (D-058).

### E6. Fals pozitiv la geofence
- **Scenariu:** GPS-ul raportează „inside” fără ca jucătorul să fie la checkpoint (reflexii, precizie optimistă).
- **Comportament așteptat:** sosirea deblochează doar **discovery / observația**, nu direct deblocarea finală (modelul în două niveluri — D-060). Provocarea bazată pe observație nu poate fi rezolvată fără prezență reală.
- **Implicație:** în conținutul V1.1, checkpoint-urile importante combină locația cu o provocare de observație; histerezisul existent (D-039) reduce oscilațiile.

---

## F. Conținut

### F1. Checkpoint indisponibil
- **Stare inițială:** checkpoint `ACTIVE`; sesiune `ACTIVE`.
- **Eveniment:** checkpoint marcat `UNAVAILABLE` (operator / admin / regulă).
- **Comportament așteptat:** la sincronizare, sesiunea primește noua stare; checkpoint-ul devine `BYPASSED` pentru acea sesiune (automat sau după confirmare, după regula aventurii); aventura continuă cu nodul următor. Mesaj clar pentru echipă.
- **Stare finală:** checkpoint `BYPASSED` în sesiune; evenimentul de audit salvat.
- **Implicație:** disponibilitatea este strat operațional (Route Health), separat de versiunea aventurii; progresul trebuie să accepte bypass ca închidere a nodului.

### F2. Rută blocată
- Ca F1, pentru un segment. **Comportament așteptat:** instrucțiuni alternative de deplasare, dacă există în conținut / de la operator; altfel bypass al checkpoint-urilor afectate. **Implicație:** separarea geometrie / progresie / disponibilitate / ordine (D-062).

### F3. Obiectiv închis
- **Scenariu:** echipa ajunge și constată că obiectivul (ex. o clădire) este închis.
- **Comportament așteptat:** calea standard de rezervă a checkpoint-ului (instrucțiuni alternative sau posibilitatea de „Sari peste”); raportarea către operator este FUTURE.
- **Implicație:** fiecare checkpoint are o rezervă definită în conținut (câmpul `fallback` existent).

### F4. Bypass de operator
- **Comportament așteptat:** operatorul face bypass pentru o sesiune; evenimentul `checkpoint_bypassed` (tip `OPERATOR SKIP`, motiv, actor, moment) ajunge la sesiune la următoarea sincronizare. Dacă echipa rezolvase deja nodul offline, rezolvarea are prioritate (nodul este deja închis; bypass-ul devine no-op).
- **Implicație:** un nod închis nu își mai schimbă starea (regulă existentă pentru misiuni).

### F5. Versiunea aventurii actualizată în timpul unei sesiuni active
- **Stare inițială:** sesiune pe versiunea 1.0; se publică 1.1.
- **Comportament așteptat:** sesiunea continuă pe 1.0 până la final; pachetul 1.0 nu este înlocuit; sesiunile noi folosesc 1.1. O corecție urgentă de siguranță se face prin Route Health / bypass, nu prin schimbarea conținutului sesiunii.
- **Stare finală:** sesiune neschimbată.
- **Implicație:** o sesiune reală este legată obligatoriu de `adventure_id` + `adventure_version` (versiunea publicată, imuabilă — D-066); progresul salvat le reține; service worker-ul nu înlocuiește pachetul unei sesiuni active; restaurarea verifică versiunea.
- **Azi:** **diferit** — network-first încarcă conținutul nou, iar restaurarea tolerantă îl aplică progresului existent (`13_PLATFORM_V1.1.md` §8.4, §9).

---

## G. Joc

### G1. Răspuns greșit
- **Comportament așteptat:** mesaj „incorect”, fără blocare; contorul de încercări crește; evenimentul `answer_incorrect` (local, sincronizat).
- **Azi:** IMPLEMENTAT (mesajul nu este salvat; `attempts` crește).

### G2. Răspuns repetat
- **Scenariu:** același răspuns trimis de două ori (dublu tap, retry, doi participanți).
- **Comportament așteptat:** dacă provocarea e deja rezolvată → no-op, fără puncte duble. Dacă e același răspuns greșit → poate fi contorizat o singură dată per `event_id`.
- **Implicație:** idempotență pe `event_id` + stare închisă imuabilă.

### G3. Indiciu folosit
- **Comportament așteptat:** indiciul se dezvăluie; dacă indiciile sunt `shared`, toată echipa îl vede după sincronizare și contorul este comun; dacă sunt `per_participant`, rămâne local. Două cereri simultane pentru „următorul indiciu” nu dezvăluie două indicii (se dezvăluie indiciul cu indexul cerut, idempotent pe index).
- **Azi:** IMPLEMENTAT local (`hintsUsed`, `hint_requested` cu `hintIndex`, fără penalizări — D-025). În interfață, indiciul se deschide numai după confirmare; „Renunță”, Escape și Back anulează fără consum (D-030, extinderea din 2026-10-01).

### G4. Provocare sărită
- **Comportament așteptat:** „Sari peste” închide provocarea ca `skipped`, 0 puncte, jocul continuă. Nu se confundă cu bypass (F1, F4).
- **Azi:** IMPLEMENTAT.

### G5. Sesiune pusă pe pauză
- **Comportament așteptat:** `ACTIVE → PAUSED` prin acțiune explicită (Leader / regulă); timpul de joc (dacă se măsoară) exclude pauza, calculat din timestamp-uri; GPS-ul se poate opri pentru baterie.
- **Implicație:** pauza este stare a sesiunii (comună), nu a dispozitivului.

### G6. Sesiune reluată
- **Comportament așteptat:** `PAUSED → ACTIVE`; se verifică pachetul offline și versiunea; GPS-ul se reactivează la cerere.

### G7. Sesiune abandonată
- **Comportament așteptat:** doar prin acțiune explicită, cu confirmare (sau prin regulă de operator); **niciodată** din cauza închiderii aplicației. Starea finală `ABANDONED` păstrează progresul pentru istoric.

### G8. Sesiune expirată
- **Comportament așteptat:** după fereastra de valabilitate (parametru configurabil, DESCHIS) → `EXPIRED`; la deschidere, mesaj clar (A6). Evenimentele locale încă nesincronizate sunt totuși acceptate pentru istoric, dacă au timestamp anterior expirării (regulă de confirmat la implementare).

### G9. Aventură finalizată
- **Comportament așteptat:** `COMPLETED`; rezultatul final este vizibil tuturor participanților; nu mai sunt acceptate acțiuni de joc (doar citire). Coada locală se golește prin sincronizare.
- **Azi:** IMPLEMENTAT local (`completed`, „Joacă din nou” resetează progresul local).

---

## H. Testare

Fiecare caz de mai sus devine, la implementarea funcționalității corespunzătoare:

- un test automat (`node --test`) pentru logica pură (motor, coadă, idempotență, versiune);
- un test manual sau în Chromium pentru comportamentul din browser;
- un test pe teren (Faza 5) pentru GPS, conectivitate și baterie.

Conform instrucțiunilor proiectului, fiecare funcționalitate se testează pe **calea normală** și pe **calea de eșec / recuperare**. Niciun test din acest document nu a fost încă rulat pentru comportamentul V1.1 (nu există implementare).
