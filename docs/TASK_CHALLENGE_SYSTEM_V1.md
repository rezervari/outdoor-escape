# TASK — CHALLENGE SYSTEM V1 (design tehnic)

| | |
| --- | --- |
| **Status** | Design **revizia 2**, aprobat de proprietar (2026-10-01). D1–D4 sunt înregistrate ca D-070 – D-073 în `04_DECISIONS_LOG.md`. **Partea NOW este implementată** (vezi „Note de implementare” la final); NEXT / FUTURE rămân neimplementate. |
| **Data** | 2026-10-01 |
| **Baza** | design: `main` la `e18abec` + obiecte / variante / jurnal (comise ulterior în `63debe7`); implementarea NOW pornește de la `9cb72b7`. |
| **Citit** | `04_DECISIONS_LOG.md`, `11_ADVENTURE_SCHEMA_V2.md`, `13_PLATFORM_V1.1.md` (§1, §2, §10, §11, §15, §16), `05_GAME_DESIGN_SPEC.md`, `src/js/*.js`, `src/index.html`, `src/css/app.css`, `src/sw.js`, testele, propunerea privată pentru prima aventură reală și JSON-ul ei local |
| **Conținut real** | Acest document este **generic** și nu conține conținutul primei aventuri reale (D-034). Designul concret al celor 8 provocări („Challenge Design V2”) este în `Claude outputs/TASK_CHALLENGE_SYSTEM_V1_PRIVAT.md` (ignorat de Git, D-044). |

Scopul: o fundație generică de provocări multimedia, reutilizabilă de toate aventurile și în orice mod de joc (Walk, Bike, altele), înainte de orice cod nou.

---

## 1. Design principles

1. **Motorul are capabilități; aventura are configurație și conținut.** Nicio capabilitate nu poartă numele unei aventuri, al unui oraș, al unui personaj sau al unui obiect din poveste (extinde D-038, D-051; verificat de testul „motorul nu conține logică specifică unei aventuri”).
2. **Aventura nu este un mod de joc.** Aventura descrie conținutul și regulile; modul de joc (Walk / Bike / …) aparține sesiunii (§2). Aceeași aventură, cu aceleași provocări, poate fi jucată în moduri diferite. Niciun contract nu presupune că o aventură este „pietonală”.
3. **Nu se adaugă tipuri de misiune noi pentru mecanici noi.** O provocare se compune din patru axe independente, fiecare cu un vocabular mic și închis:

   | Axă | Întrebarea | Unde stă azi | Ce se adaugă |
   | --- | --- | --- | --- |
   | **Poarta** (gate) | când devine disponibilă? | progresia liniară, `locationId`, reguli `unlock_mission` | nimic în V1 |
   | **Stimulul** (presentation) | ce vede / aude jucătorul? | `briefing` (text) | `mission.media[]`: blocuri `image`, `compare`, `audio` |
   | **Rezolvarea** (mission resolution) | ce condiție închide misiunea ca rezolvată? | sosirea (`location`), răspunsul (`answer`, `choices`) | `inputMode: "numeric"`; ulterior alte forme de rezolvare (§4) |
   | **Recompensa** (outcome) | ce se întâmplă după? | reguli de evenimente: `show_message`, `collect_item`, `award_points`, `unlock_*` | nimic în V1 |

   `historical_overlay` nu este un tip de misiune: este o misiune `observation` cu un bloc `compare` și o rezolvare prin răspuns.
4. **Fiecare asset multimedia are un rol în gameplay.** Un bloc media există doar dacă rezolvarea depinde de el sau dacă el reduce o ambiguitate reală (ex. care sunt „cele două repere”). Decorul nu justifică un asset.
5. **Lumea reală rămâne sursa rezolvării.** Media orientează privirea; răspunsul se găsește la fața locului (D-060: GPS → observație → provocare → deblocare). O provocare care se poate rezolva din fotografie, de acasă, este un defect de design.
6. **Nicio provocare nu depinde exclusiv de media, de rețea sau de senzori** (analog D-006). Orice imagine are text alternativ, orice voce are transcript, orice senzor viitor (busolă, cameră, AR) are o variantă fără senzor, iar „Sari peste” rămâne disponibil.
7. **Stare derivată, nu duplicată** (D-043). Ce a văzut sau ascultat jucătorul, poziția slider-ului, zoom-ul: stare de interfață, efemeră. Faptele de joc rămân cele existente (stări de misiune, `hintsUsed`, `firedEvents`).
8. **Răspunsurile trec doar prin `answers.js`** (D-021). Rezolvările prin răspuns (text, cifre, alegere, zonă pe imagine, combinație de obiecte) se reduc la un șir trimis validatorului; contractul `check(missionId, input) → Promise<boolean>` nu se schimbă în V1.
9. **Motorul nu redă nimic** (D-040). `game.js` nu știe de imagini sau sunete; blocurile media sunt citite de modelul interfeței și desenate de UI.
10. **Vocabular închis, extensibil aditiv.** Ca listele existente (tipuri, acțiuni, evenimente), tipurile de asset, tipurile de bloc și formele de rezolvare sunt liste închise: o valoare necunoscută este eroare de validare, ca o aventură care cere o capabilitate nouă să nu ruleze pe o aplicație veche. Valorile FUTURE sunt **rezervate** (documentate), dar respinse până la implementare.

---

## 2. Adventure și Play Mode (Walk / Bike)

### 2.1 Separarea

```text
ADVENTURE (conținut + reguli, versionat — D-057)
  locații, misiuni, media, obiecte, evenimente, final
  → nu știe cum se deplasează jucătorii

SESSION / PLAY MODE (o rulare concretă — D-051)
  mode: walk | bike | …
  → profil GPS (D-058), reguli de siguranță (D-059), ritm, avertismente,
    când este permisă interacțiunea cu telefonul

ROUTE (geometrie, Route Health — D-051, D-061)
  → pe ce drum se ajunge între puncte; poate fi diferit pe moduri
```

- **Capabilitățile nu citesc modul de joc.** `historical_overlay`, `audio_clue`, `map_observation` etc. au același contract în Walk și în Bike.
- **Modul de joc poate restrânge prezentarea, nu mecanica.** Exemplu: în Bike, Play Mode poate cere ca o provocare să fie deschisă / ascultată doar într-o stare sigură (§7.1). Provocarea nu se rescrie și nu se duplică.
- **Aventura poate declara compatibilitatea, nu modul.** Opțional, viitor: `meta.playModes: ["walk", "bike"]` (ce moduri au fost testate pe teren pentru această aventură). Este metadată pentru alegerea sesiunii, nu condiție în misiuni.
- **Textele dependente de mod** (ex. un avertisment de siguranță la un punct) nu se pun în `briefing`. Propunere viitoare: `location.safetyNotes: { "bike": "…", "walk": "…" }` — un singur punct, mai multe note; Play Mode alege nota. Înlocuiește propunerea `safetyWarning` (un singur text) din `11_ADVENTURE_SCHEMA_V2.md` §14.3.

### 2.2 Relația cu documentele existente (contradicții de închis)

| Document | Ce spune azi | Ce propune această separare |
| --- | --- | --- |
| D-050 | „Diferențele Walk / Bike vin din configurația aventurii (profil GPS, reguli de siguranță)” | vin din Play Mode al sesiunii; aventura rămâne neutră |
| `11_ADVENTURE_SCHEMA_V2.md` §14.3 | `settings.gpsPolling.profile: "walk" \| "bike"` în aventură; `location.safetyWarning` | profilul GPS aparține Play Mode; nota de siguranță pe mod (`safetyNotes`) |
| `13_PLATFORM_V1.1.md` §1, §15 | Walk și Bike ca produse cu aventuri proprii | produsele rămân (D-050), dar o aventură poate apărea în ambele |

Toate cele trei sunt câmpuri **propuse / neimplementate**, deci nu există cod de schimbat. Contradicția trebuie însă închisă printr-o decizie înainte ca primul câmp de mod să intre în schemă (§12, D1).

### 2.3 Ce înseamnă pentru NOW

- **Nu se implementează Session / Play Mode.** Aplicația are azi o sesiune locală implicită, fără mod; comportamentul rămâne identic pentru toate aventurile.
- **Interdicții de contract în V1:** niciun câmp `walk` / `bike` / `transport` în misiuni sau blocuri media; nicio valoare implicită care presupune mers pe jos în modulele noi; nicio regulă de timp în scor (D-025, D-059).

---

## 3. Capability inventory

Legendă status: **EXISTĂ** = implementat (inclusiv modificările locale necomise ale proprietarului); **NOW** = necesar pentru prima aventură reală; **NEXT** = generic și util, nu e necesar în V1; **FUTURE** = cere hardware / API / backend / decizii mari.

| Capability | Purpose | Status | Reusable | Dependencies |
| --- | --- | --- | --- | --- |
| `text_briefing` | narațiune + instrucțiune, pe mai multe rânduri | EXISTĂ | toate aventurile | — |
| `narrator_message` | mesaje ale Game Master-ului, jurnal, epilog | EXISTĂ (local) | toate | reguli `show_message`, `finale.messageId` |
| `arrival` | rezolvare prin sosire la un punct real (GPS sau „Am ajuns”) | EXISTĂ | toate | `geo.js`, `location.js`, D-006 |
| `text_answer` | rezolvare prin răspuns tastat, normalizat | EXISTĂ | toate | `answers.js`, D-024 |
| `choice` | rezolvare prin variantă aleasă (2–6) | EXISTĂ (local) | toate | `mission.choices`, `answers.js` |
| `item_collection` | obiecte obținute ca recompensă, inventar | EXISTĂ (local) | toate | `items`, `collect_item`, derivare din `firedEvents` |
| `numeric_answer` | tastatură numerică pentru coduri / numărători | **NOW** | toate | `inputMode` (propus în schema §14.3) |
| `media_assets` | registru generic de asset-uri cu metadate pe tip | **NOW** (`image`, `audio`) | toate | schemă; compatibil cu `audio.tracks` |
| `image_observation` | imagine care orientează observația (schiță, detaliu, fotografie adnotată, document) | **NOW** | toate | `media_assets`, `mission.media[]` |
| `historical_overlay` | comparație trecut / prezent (slider sau comutare) | **NOW** | toate aventurile cu arhivă | bloc `compare`, licențe, D-011 |
| `audio_clue` | voce / sunet cu transcript obligatoriu | **NOW** | toate | asset `audio`, player |
| `media_viewer` | vizualizare pe tot ecranul, generică (fotografie, arhivă, hartă, document) | **NOW** | toate | strat nou pentru Back (D-035 / U2) |
| `media_fallback` | text alternativ + „Reîncearcă” când un asset nu se încarcă | **NOW** | toate | `alt` / transcript |
| `map_observation` | orientare / navigare prin raționament: harta live, o schiță, relieful, soarele | **NOW** (compus: `image` + `choice` / `arrival` + harta existentă) | toate | M-003.2 |
| `visual_discovery` (în lumea reală) | „găsește pe teren detaliul din imagine” | **NOW** (compus: `image` + răspuns) | toate | `image_observation` |
| `visual_discovery` (hotspot) | rezolvare prin atingerea zonei corecte pe o imagine | NEXT | toate | formă de rezolvare `hotspot` |
| `item_combination` | rezolvare prin alegerea / ordonarea obiectelor | NEXT | toate | formă de rezolvare `items`, `item_collected` |
| `item_media` | imagine proprie pentru obiect; straturi suprapuse | NEXT | toate | `media_assets`, `items[].image`, bloc `layers` |
| `map_area` | zonă de căutare pe harta live în loc de pin exact | NEXT | toate | revizuirea D-048 (modelul hărții) |
| `acknowledge` | rezolvare fără răspuns (pas narativ, „Continuă”) | NEXT | toate | regulă nouă de închidere în `game.js` |
| `hint_media` / `hint_delay` | indiciu cu imagine; indiciu după N secunde | NEXT | toate | `hints[].media`, `delaySeconds` (§14.3) |
| `answer_variants` | mai multe răspunsuri acceptate | NEXT | toate | D-024 (deschis) |
| `media_offline_package` | pre-descărcarea tuturor asset-urilor unei aventuri | NEXT | toate (critic în Bike) | D-056, registrul `media_assets` |
| `composite_resolution` | rezolvare prin mai multe condiții (ex. sosire + răspuns, 3 descoperiri din 5) | FUTURE | toate | stare nouă, migrare (D-043) |
| `narrative_choice` | alegere fără variantă greșită, cu consecințe | FUTURE | toate | flux graf (D-062), stare nouă |
| `device_orientation` | rezolvare prin direcția reală a telefonului (busolă / bearing) | FUTURE | toate | DeviceOrientation, adaptor nou, permisiune iOS |
| `evidence` (`photo_evidence`) | dovadă: fotografie, cod fizic, QR, validare de operator | FUTURE | toate | cameră, stocare, confidențialitate, D-060 |
| `feedback_audio_haptic` | sunet / vibrație la rezolvare | FUTURE | toate | D-059, teste pe dispozitive |
| `media_video`, `media_3d` | asset-uri video / 3D | FUTURE | toate | tip de asset rezervat |
| `ar_scan` | AR peste imaginea camerei | FUTURE | toate | D-050 (`ar` rezervat), cameră, WebXR |

**Concluzie:** pentru prima aventură reală sunt necesare **șase capabilități noi**: `media_assets` (`image`, `audio`), blocurile `image` / `compare` / `audio` (`image_observation`, `historical_overlay`, `audio_clue`), `media_viewer`, `media_fallback` și `numeric_answer`. Restul mecanicilor NOW (`map_observation`, descoperirea pe teren, obiectele, alegerile) se obțin compunând ce există deja.

### 3.1 Fișele capabilităților

Câmpurile fiecărei fișe: **Scop · Input (JSON) · UI · Interacțiune · Rezultat · Evenimente · Persistență · Reutilizare · Extensibilitate**. La „Reutilizare”, exemplul pentru prima aventură reală indică doar numărul provocării din documentul privat (§10); conținutul nu este reprodus aici. Exemplele sunt date pe mod de joc (Walk / Bike), dar contractul este același.

#### `media_assets` — NOW

- **Scop:** un singur registru pentru tot ce nu este text: imagini, sunete, ulterior video / 3D / AR. Permite validarea referințelor, creditarea și, ulterior, lista completă pentru pachetul offline.
- **Input:** `media.assets.<id>` cu `type` și metadate pe tip (§5.1).
- **UI:** niciunul direct; asset-urile apar prin blocuri, viewer, mesaje, obiecte.
- **Interacțiune / Rezultat / Evenimente:** —.
- **Persistență:** nimic (conținut, nu stare).
- **Reutilizare:** toate provocările cu media, în orice aventură și mod.
- **Extensibilitate:** tipurile `video`, `model3d`, `ar` sunt rezervate; un tip nou = metadate noi, fără schimbarea blocurilor existente.

#### `image_observation` — NOW

- **Scop:** imaginea îndreaptă privirea spre ceva real (schiță, detaliu decupat, fotografie adnotată care fixează limitele observației, scan de document). Rezolvă ambiguitatea „ce anume număr / unde mă uit”.
- **Input:** `media: [{ "type": "image", "asset", "caption?", "label?" }]`.
- **UI:** imaginea în panoul provocării, sub `briefing`; atingerea o deschide în `media_viewer`.
- **Interacțiune:** privește imaginea, caută corespondentul în jur, rezolvă (text / cifre / alegere).
- **Rezultat:** rezolvare prin răspuns (`answers.js`) → misiunea `solved`.
- **Evenimente:** existente (`mission_completed`, `answer_incorrect`, `hint_requested`).
- **Persistență:** nimic nou.
- **Reutilizare:** prima aventură — privat #2, #5; Walk sau Bike — fotografia unui marcaj: „ce număr are borna de lângă podeț?”.
- **Extensibilitate:** `label` leagă imaginea de o variantă din `choices` (galerie); NEXT: rezolvarea `hotspot` pe aceeași imagine, fără schimbarea blocului.

#### `historical_overlay` — NOW

- **Scop:** comparația trecut / prezent din același unghi; jucătorul observă ce s-a schimbat sau ce a rămas.
- **Input:** `{ "type": "compare", "before", "after", "mode": "slider" | "toggle", "labels?" }`; imaginea veche cu `role: "archival"` și metadatele de proveniență (§5.1).
- **UI:** `slider` — imaginile suprapuse, o bară trasă orizontal (accesibilă și cu tastatura); `toggle` — un buton „Atunci / Acum”. `slider` cere imagini aliniate; `toggle` tolerează diferențe de cadru. Ambele se pot deschide în viewer.
- **Interacțiune:** compară imaginile și realitatea, apoi rezolvă.
- **Rezultat:** rezolvare prin răspuns. Comparația nu validează nimic.
- **Evenimente:** existente; nu există `slider_moved` (§6.3).
- **Persistență:** nimic nou.
- **Reutilizare:** prima aventură — privat #3 (`slider`), #7 (`toggle`); orice mod — belvedere cu fotografia veche a văii.
- **Extensibilitate:** `mode` este listă închisă extensibilă (ex. `"fade"`); NEXT: `layers` (N straturi); FUTURE: aceeași pereche de imagini ca sursă pentru `ar` (imaginea veche peste cameră).

#### `audio_clue` — NOW

- **Scop:** informația vine printr-o voce sau un sunet: mesajul unui personaj, mai multe voci care se contrazic, un sunet de recunoscut.
- **Input:** `media: [{ "type": "audio", "asset", "showTranscript" }]`; asset `type: "audio"` cu `transcriptMessage` (obligatoriu pentru `kind: "voice"`). Mesajele naratorului: `narrator.messages.<id>.audio` (există).
- **UI:** player nativ (`<audio controls>`), fără autoplay; transcriptul sub player, pliat sau desfășurat.
- **Interacțiune:** apasă „Play” sau citește transcriptul; rezolvă.
- **Rezultat:** rezolvare prin răspuns.
- **Evenimente:** existente; acțiunea existentă `play_audio` produce efectul `audio`, redat doar după un gest al jucătorului.
- **Persistență:** nimic nou.
- **Reutilizare:** prima aventură — privat #1, #4; orice mod — mesajul unui personaj la un checkpoint. În Bike: regula de stare sigură (§7.1).
- **Extensibilitate:** subtitrare sincronizată; FUTURE: TTS ca alternativă (D-059).

#### `media_viewer` — NOW

- **Scop:** orice asset vizual se poate vedea în detaliu pe un ecran mic: fotografie, fotografie de arhivă, hartă / schiță, document scanat, ulterior alte tipuri compatibile.
- **Input:** un asset vizual (azi `type: "image"`, orice `role`) sau un bloc `compare`. Viewer-ul nu depinde de aventură, de misiune sau de rolul asset-ului; `role` decide doar ce metadate se afișează (ex. creditul unei imagini de arhivă).
- **UI:** strat peste tot ecranul, zoom nativ (pinch), `caption` și `credit`, buton „Închide”.
- **Interacțiune:** deschide din orice loc care afișează un asset vizual (blocuri, cardul obiectivului; NEXT: inventar, indicii, mesaje), mărește, închide (inclusiv cu Back).
- **Rezultat / Evenimente / Persistență:** niciunul (strat de interfață, ca overlay-ul puzzle-ului).
- **Reutilizare:** orice aventură și mod.
- **Extensibilitate:** `video`, document multi-pagină, comparație pe tot ecranul: noi „renderere” pe tip de asset, același strat.

#### `media_fallback` — NOW

- **Scop:** o provocare nu se blochează când un asset lipsește (rețea, format, eroare).
- **Input:** `alt` (imagine), transcript (voce), `caption`.
- **UI:** în locul asset-ului: textul alternativ + „Reîncearcă” (o nouă cerere, fără reîncărcarea paginii).
- **Interacțiune / Rezultat:** rezolvarea rămâne posibilă din text, indicii sau „Sari peste”.
- **Evenimente / Persistență:** niciunul.
- **Reutilizare:** toate asset-urile.
- **Extensibilitate:** după pachetul offline (NEXT), „Reîncearcă” citește întâi din cache.

#### `map_observation` — NOW (compus)

- **Scop:** orientare și navigare **prin raționament**: jucătorul își deduce direcția sau drumul din harta live (nord sus), dintr-o schiță / hartă desenată, din relief sau soare. Nu folosește senzorul de direcție al telefonului.
- **Input:** bloc `image` (schiță, hartă desenată) pe o misiune cu răspuns (`choices`) sau pe o misiune `location` (drumul spre punct) + harta existentă (M-003.2).
- **UI:** schița în panoul provocării sau în cardul obiectivului („Vezi schița”, deschisă în viewer); harta live neschimbată.
- **Interacțiune:** corelează schița / harta cu terenul; alege direcția sau merge.
- **Rezultat:** rezolvare prin alegere (`answers.js`) sau prin sosire (`arrival`).
- **Evenimente:** existente.
- **Persistență:** nimic nou.
- **Reutilizare:** prima aventură — privat #2 (direcție), #6 (drum după hartă desenată); orice mod — răscruce: „spre vârful din stânga sau spre pădure?”.
- **Extensibilitate:** NEXT `map_area` (zonă pe harta live); conținutul `map_observation` rămâne valid ca rezervă pentru `device_orientation`.

#### `visual_discovery` — în lumea reală NOW, hotspot NEXT

- **Scop:** „găsește detaliul” — pe teren (pornind de la o imagine) sau pe o imagine (pornind de la teren).
- **Input:** NOW — blocuri `image` (detaliu sau galerie A/B/C) + `choices` / răspuns; NEXT — rezolvarea `hotspot` (§4.3).
- **UI:** NOW — imaginile + variantele; NEXT — atingerea pe imagine, cu marcaj al punctului atins.
- **Interacțiune:** caută, compară, alege / atinge.
- **Rezultat:** rezolvare prin răspuns (id-ul regiunii este un text ca oricare altul).
- **Evenimente:** existente; o atingere greșită = `answer_incorrect`.
- **Persistență:** nimic nou (`attempts` crește).
- **Reutilizare:** prima aventură — privat #5; orice mod — „unde este marcajul pe fotografia largă a pădurii?”.
- **Extensibilitate:** forme `rect` / `circle`, apoi `polygon`; mai multe regiuni corecte = variante de răspuns (D-024); „3 din 5” = `composite_resolution` (FUTURE).

#### `numeric_answer` — NOW

- **Scop:** coduri, numărători, ani, fără tastatura de text.
- **Input:** `"inputMode": "numeric"` pe orice misiune rezolvată prin răspuns tastat.
- **UI:** câmpul de răspuns cu `inputmode="numeric"`.
- **Interacțiune:** tastează cifrele.
- **Rezultat / Evenimente / Persistență:** neschimbate (`answers.js` compară textul normalizat).
- **Reutilizare:** prima aventură — privat #3, #6, #8; orice mod — codul final la întoarcerea la bază.
- **Extensibilitate:** `inputMode` rămâne indiciu de tastatură; regulile de format nu aparțin acestui câmp.

#### `choice` și `text_answer` — EXISTĂ

- **Scop:** rezolvare prin variantă aleasă / text tastat. **Input:** `choices` (2–6) / `answer`.
- **UI / Interacțiune:** butoane / câmp text (implementat). **Rezultat:** `answers.js`. **Evenimente:** `mission_completed`, `answer_incorrect`. **Persistență:** `attempts`.
- **Reutilizare:** prima aventură — privat #1, #2, #4, #5, #7; orice checkpoint, orice mod.
- **Extensibilitate:** NEXT — variante cu imagine (`choices` ca obiecte `{ label, asset }`, aditiv); FUTURE — `narrative_choice`.

#### `item_collection` — EXISTĂ (local)

- **Scop:** recompensă tangibilă și memorie a drumului; sursa datelor pentru final.
- **Input:** `items[]` + acțiunea `collect_item`.
- **UI:** panoul „Ce ați găsit” (joc și final).
- **Interacțiune:** niciuna (obiectul vine ca recompensă).
- **Rezultat:** obiectul apare în `viewModel.items`.
- **Evenimente:** azi doar efectul `item`; NEXT — `item_collected`.
- **Persistență:** derivată din `firedEvents`.
- **Reutilizare:** prima aventură — privat #3, #5, #6, #7; orice mod — fragmente adunate pe circuit.
- **Extensibilitate:** `items[].image` (NEXT); convenția `mission_skipped → collect_item` (§5.4) pentru obiectele necesare finalului.

#### `item_combination` — NEXT

- **Scop:** obiectele devin instrumentul rezolvării (ordonare, alegere, suprapunere).
- **Input:** rezolvarea `items` (§4.3); bloc `layers` din obiectele obținute.
- **UI:** inventarul devine selectabil; ordinea aleasă se vede.
- **Interacțiune:** alege și ordonează obiecte, trimite.
- **Rezultat:** id-urile unite prin virgulă → `answers.js`.
- **Evenimente:** existente + `item_collected`.
- **Persistență:** nimic nou (selecția este efemeră).
- **Reutilizare:** prima aventură — privat #8 (azi în varianta NOW, cod tastat); orice mod — fragmentele de hartă puse în ordine la final.
- **Extensibilitate:** `select: "set"` (fără ordine); combinații parțiale doar prin `composite_resolution` (FUTURE).

#### `device_orientation` — FUTURE

- **Scop:** rezolvare prin direcția reală în care este îndreptat telefonul (busolă / bearing).
- **Input:** rezolvarea `bearing` (§4.4), cu `tolerance` și `fallbackChoices`.
- **UI:** indicator de direcție, după permisiunea senzorului (iOS cere gest + permisiune).
- **Interacțiune:** îndreaptă telefonul spre reper, confirmă.
- **Rezultat:** unghiul, comparat cu toleranță (extensie de contract în `answers.js`).
- **Evenimente:** existente.
- **Persistență:** nimic nou.
- **Reutilizare:** prima aventură — upgrade posibil pentru privat #2; orice mod — „îndreaptă telefonul spre vârful pe care îl vezi în fotografie”.
- **Extensibilitate:** `fallbackChoices` = conținutul `map_observation`; adaptor de senzor separat (G12).

#### `narrative_choice`, `evidence`, `ar_scan` — FUTURE

- **`narrative_choice`:** alegere fără variantă greșită, cu consecințe; eveniment `choice_selected { missionId, choiceId }`; cere stare nouă și flux graf (D-062). Reutilizare: două finaluri; alegerea între două bucle de traseu.
- **`evidence`:** fotografie făcută de jucător, cod fizic, QR, validare de operator (D-060). Fotografia nu se poate valida local fiabil; cere decizie de confidențialitate. Reutilizare: fotografia echipei la final; dovadă la un checkpoint competitiv.
- **`ar_scan`:** bloc / asset `ar` rezervat (D-050). Reutilizare: imaginea de arhivă peste cameră la un belvedere.
- Pentru toate: varianta fără senzor / cameră rămâne obligatorie (principiul 6); `meta.requires` (FUTURE) anunță cerința la start.

---

## 4. Mission resolution

### 4.1 Conceptul

**Mission resolution** = condiția care închide o misiune ca `solved`. Este o noțiune generică a motorului, separată de ce vede jucătorul (stimulul) și de ce se întâmplă după (recompensa). Stările de închidere rămân cele existente: `solved` (rezolvată), `skipped` (sărită de jucător), `failed` (eșuată, prin regulă).

| Formă de rezolvare | Condiția | Validare | Status |
| --- | --- | --- | --- |
| `arrival` | sosirea la `locationId` (GPS sau „Am ajuns”) | `geo.js` / `confirmArrival` | EXISTĂ (`type: "location"`) |
| `answer` — text | textul tastat corespunde | `answers.js` | EXISTĂ |
| `answer` — numeric | idem, cu tastatură numerică | `answers.js` | **NOW** (`inputMode`) |
| `answer` — choice | varianta aleasă corespunde | `answers.js` | EXISTĂ (`choices`) |
| `hotspot` (discovery pe imagine) | regiunea atinsă corespunde | `answers.js` (id de regiune) | NEXT |
| `items` (combinație) | obiectele alese / ordonate corespund | `answers.js` (id-uri) | NEXT |
| `acknowledge` | jucătorul confirmă că a citit / ascultat | fără validare | NEXT (regulă nouă în `game.js`) |
| `bearing` (device orientation) | direcția telefonului în toleranță | `answers.js` cu toleranță (contract extins) | FUTURE |
| `evidence` | fotografie / cod fizic / QR / operator | local sau server (D-060) | FUTURE |
| `composite` | mai multe condiții (`all` / `any` / „k din n”) | combinația formelor de mai sus | FUTURE (stare parțială salvată) |

„Observation”, „discovery”, „orientation” sunt **experiențe** (ce face jucătorul în lumea reală); forma de rezolvare spune doar **cum se verifică** rezultatul. Aceeași observație se poate rezolva prin cifre, prin alegere sau, mai târziu, prin hotspot.

### 4.2 Cum se exprimă azi (NOW) — fără câmp nou de rezolvare

În V1 forma de rezolvare se **deduce** din câmpurile existente, ca să nu se schimbe contractele implementate:

| Câmpuri existente | Rezolvarea dedusă |
| --- | --- |
| `type: "location"` + `locationId` | `arrival` |
| `answer` + `choices` | `answer` / choice |
| `answer` + `inputMode: "numeric"` | `answer` / numeric |
| `answer` | `answer` / text |

O funcție pură (ex. `missionResolution(mission)`, în stratul de model al interfeței) poate întoarce forma dedusă, ca UI-ul să nu repete condițiile. Motorul (`game.js`) nu se schimbă în V1.

### 4.3 Forma explicită viitoare (NEXT) — `resolution`

Când apare prima formă care cere configurație proprie, se introduce un câmp explicit, **aditiv**:

```json
{
  "type": "observation",
  "media": [ { "type": "image", "asset": "img-fatada-larga" } ],
  "resolution": {
    "kind": "hotspot",
    "media": 0,
    "regions": [
      { "id": "r-stanga", "shape": "rect", "x": 0.08, "y": 0.30, "w": 0.18, "h": 0.22 },
      { "id": "r-centru", "shape": "rect", "x": 0.41, "y": 0.18, "w": 0.15, "h": 0.20 },
      { "id": "r-dreapta", "shape": "circle", "x": 0.80, "y": 0.45, "r": 0.07 }
    ]
  },
  "answer": "r-centru"
}
```

```json
{ "type": "code", "resolution": { "kind": "items", "select": "ordered", "count": 3 }, "answer": "fragment-c,fragment-b,fragment-a" }
```

- `hotspot`: coordonate normalizate (0–1) față de imagine. Atingerea se traduce în interfață în id-ul regiunii, trimis ca răspuns. Geometria nu este răspunsul; răspunsul rămâne în `answer`, citit doar de `answers.js`.
- `items`: interfața trimite id-urile obiectelor alese, unite prin virgulă.
- **Compatibilitate:** câmpurile V1 (`choices`, `inputMode`, `type: "location"`) rămân valide pentru totdeauna și sunt echivalente cu `resolution: { kind: "answer", input: "choice" | "numeric" | "text" }` / `{ kind: "arrival" }`. `toAdventureV2` poate normaliza forma scurtă în forma explicită (ca V1 → V2). O misiune care declară ambele forme contradictoriu este eroare de validare.

### 4.4 Forme FUTURE

```json
{ "resolution": { "kind": "bearing", "tolerance": 20, "fallbackChoices": ["N", "E", "S", "V"] }, "answer": "180" }
{ "resolution": { "kind": "composite", "mode": "all", "parts": [ { "kind": "arrival" }, { "kind": "answer" } ] } }
{ "resolution": { "kind": "evidence", "method": "photo | code | qr | operator" } }
```

- `bearing` — comparație cu toleranță (extensie a validatorului) + adaptor de senzor.
- `composite` — singura formă care cere **stare parțială** salvată (ce condiții sunt deja îndeplinite) → migrare a progresului (D-043). „O misiune = o condiție” rămâne regula V1 doar pentru că V1 nu are nevoie de stare nouă, nu ca limită de arhitectură.
- `evidence` — reutilizează vocabularul existent `partner.verification.method` / `location.proof.method` (schema §14.3), unde se suprapune.

---

## 5. Generic data contracts

Exemplele sunt **fictive**. Numele câmpurilor sunt **propuse**; se fixează în `schema.js` doar la implementare, cu o decizie în jurnal (regula din schema §14).

### 5.1 Registrul media — `media.assets` (NOW)

```json
"media": {
  "basePath": "media/demo-exemplu/",
  "assets": {
    "img-schita-traseu": {
      "type": "image",
      "src": "schita-traseu.webp",
      "alt": "Schiță desenată de mână: o stradă cu o săgeată spre dreapta și un X lângă a doua casă.",
      "role": "map",
      "width": 1280,
      "height": 960,
      "credit": "Ilustrație proprie"
    },
    "img-arhiva-piata": {
      "type": "image",
      "src": "arhiva-piata.webp",
      "alt": "Fotografie veche, alb-negru: o piață cu trei case cu frontoane.",
      "role": "archival",
      "provenance": {
        "credit": "ASSET TO SOURCE",
        "license": "ASSET TO SOURCE",
        "sourceUrl": "ASSET TO SOURCE",
        "factsVerified": false
      }
    },
    "voce-personaj": {
      "type": "audio",
      "src": "voce-personaj.m4a",
      "kind": "voice",
      "transcriptMessage": "mesaj-personaj",
      "durationSeconds": 20
    }
  }
}
```

**Metadate comune:** `type` (obligatoriu), `src` (cale relativă sigură), `credit?`.

**Metadate pe tip:**

| `type` | Obligatoriu | Opțional | Status |
| --- | --- | --- | --- |
| `image` | `alt` | `role` (`photo` \| `archival` \| `map` \| `document` \| `illustration`), `width`, `height`, `provenance` | NOW |
| `audio` | pentru `kind: "voice"`: `transcript` (text) sau `transcriptMessage` (mesaj) | `kind` (`voice` \| `sfx` \| `music` — lista existentă), `title`, `durationSeconds` | NOW |
| `video` | rezervat (ex. `poster`, `captions`) | — | FUTURE |
| `model3d` | rezervat | — | FUTURE |
| `ar` | rezervat (D-050) | — | FUTURE |

Reguli propuse:

- `basePath` și `src`: aceleași reguli ca `audio.basePath` azi (`isSafeRelativePath`: fără `/` la început, fără `..`, fără schemă). Calea se rezolvă relativ la fișierul aventurii (`content/adventures/`). Aplicația nu încarcă niciodată media de pe alt domeniu.
- `role` este **descriptiv**: decide ce metadate afișează viewer-ul, nu comportamentul jocului.
- `role: "archival"` cere `provenance` (`credit`, `license`, `sourceUrl`, `factsVerified`). Valorile `ASSET TO SOURCE` sunt permise în conținutul local de lucru și interzise la publicare (verificare la review, eventual test de conținut). `factsVerified: false` interzice ca textele aventurii să prezinte detaliile imaginii ca fapte istorice (D-011).
- **Compatibilitate cu `audio.tracks`** (există în schemă, folosit de fixture-ul de test): rămâne valid. La normalizare (`toAdventureV2`), fiecare `audio.tracks.<id>` devine `media.assets.<id>` cu `type: "audio"` (cu `audio.basePath` aplicat). Id-urile trebuie să fie unice în ambele registre. Referințele existente (`narrator.messages.<id>.audio`, `play_audio.trackId`) se rezolvă în registrul unificat și trebuie să indice un asset `audio`. Conținutul nou folosește doar `media.assets`.
- Tipurile rezervate (`video`, `model3d`, `ar`) sunt **respinse** de validator până la implementare (principiul 10).

### 5.2 Blocuri media în misiune — `mission.media[]` (NOW)

Listă ordonată de blocuri, afișate deasupra rezolvării. Permisă pe **orice** tip de misiune, inclusiv `location` (ex. schița drumului în cardul obiectivului).

```json
{
  "id": "m-comparatie",
  "type": "observation",
  "track": "main",
  "title": "Atunci și acum",
  "briefing": "Comparați fotografia veche cu ce vedeți în fața voastră.\nCâte frontoane au rămas la fel?",
  "locationId": "loc-piata",
  "media": [
    { "type": "compare", "before": "img-arhiva-piata", "after": "img-azi-piata", "mode": "slider", "labels": { "before": "Atunci", "after": "Acum" } },
    { "type": "image", "asset": "img-detaliu", "caption": "Detaliul încercuit", "label": "A" },
    { "type": "audio", "asset": "voce-personaj", "showTranscript": "collapsed" }
  ],
  "inputMode": "numeric",
  "answer": "2",
  "points": 100,
  "hints": [ { "text": "Mutați slider-ul încet, de la stânga la dreapta." } ]
}
```

| `type` | Câmpuri | Asset cerut | Status |
| --- | --- | --- | --- |
| `image` | `asset`, `caption?`, `label?` | `image` | NOW |
| `compare` | `before`, `after`, `mode: "slider" \| "toggle"`, `labels?` | `image` × 2 | NOW |
| `audio` | `asset`, `showTranscript: "collapsed" \| "expanded"` | `audio` | NOW |
| `layers` | `source: "collected_items"` sau `assets[]` | `image` | NEXT |
| `map_area` | `locationId`, `radius` | — | NEXT (D-048 revizuită) |
| `video` / `model3d` / `ar` | rezervate | tipul corespunzător | FUTURE |

O „galerie” nu este un tip separat: sunt mai multe blocuri `image` cu `label`. Un bloc care indică un asset de tip nepotrivit (ex. `image` → asset `audio`) este eroare de validare.

### 5.3 Obiecte — EXISTĂ; extensie NEXT

```json
"items": [
  { "id": "fragment-a", "name": "Fragmentul A", "description": "…", "icon": "🧩", "image": "img-fragment-a" }
]
```

`image` (NEXT) trimite în `media.assets`; permite inventar vizual, deschiderea în viewer și blocul `layers`.

### 5.4 Exemplu complet de compoziție (fictiv)

„Locație → comparație trecut/prezent → observație → obiect”:

```json
"missions": [
  { "id": "m-sosire-piata", "type": "location", "track": "main", "title": "Piața", "briefing": "Mergeți în piață.", "locationId": "loc-piata", "points": 0 },
  { "id": "m-atunci-acum", "type": "observation", "track": "main", "title": "Atunci și acum", "briefing": "…", "locationId": "loc-piata",
    "media": [ { "type": "compare", "before": "img-arhiva-piata", "after": "img-azi-piata", "mode": "slider" } ],
    "inputMode": "numeric", "answer": "2", "points": 100 }
],
"events": [
  { "id": "ev-fragment-a", "on": "mission_completed", "where": { "missionId": "m-atunci-acum" },
    "do": [ { "action": "collect_item", "itemId": "fragment-a" }, { "action": "show_message", "messageId": "fragment-gasit" } ] },
  { "id": "ev-fragment-a-sarit", "on": "mission_skipped", "where": { "missionId": "m-atunci-acum" },
    "do": [ { "action": "collect_item", "itemId": "fragment-a" } ] }
]
```

A doua regulă este o **convenție de conținut** recomandată (D-006): dacă obiectul este necesar mai târziu, sărirea misiunii îl dă oricum (0 puncte), ca finalul să nu devină fundătură. Motorul permite deja asta.

---

## 6. Event model

### 6.1 Evenimentele existente acoperă provocările

Nu se introduc `challenge_started` / `challenge_resolved`: ar duplica evenimentele de misiune (D-041 — terminologia din cod este „mission”).

| Moment al provocării | Eveniment existent |
| --- | --- |
| provocarea devine disponibilă | `mission_unlocked` |
| provocarea devine curentă | `mission_started` |
| jucătorul ajunge la punct | `player_near_location`, `player_arrived`, `location_discovered` |
| încercare greșită | `answer_incorrect` |
| indiciu | `hint_requested` |
| rezolvată / sărită / eșuată | `mission_completed` / `mission_skipped` / `mission_failed` |
| final | `finale_started`, `adventure_completed` |

Orice formă de rezolvare (§4) se termină cu același `mission_completed`; o încercare greșită, indiferent de formă, produce `answer_incorrect`. Regulile din conținut nu trebuie să știe cum a fost rezolvată misiunea.

### 6.2 Evenimente noi propuse (NEXT / FUTURE)

| Eveniment | Câmpuri | Când | Status |
| --- | --- | --- | --- |
| `item_collected` | `itemId` | acțiunea `collect_item` schimbă starea (prima obținere) | NEXT — reguli „când ai obiectul X, se deschide Y”; cere `itemId` în `FILTER_KEYS` |
| `choice_selected` | `missionId`, `choiceId` | `narrative_choice` | FUTURE (D-062) |
| `resolution_progress` | `missionId`, `partId` | o condiție dintr-o rezolvare `composite` este îndeplinită | FUTURE |

### 6.3 Ce NU devine eveniment de motor

`media_played`, `media_viewed`, `media_failed`, `slider_moved`, `zoomed`: interacțiuni de interfață. Motorul nu redă și nu afișează nimic (D-040), iar progresul nu trebuie să depindă de apăsarea „Play” (transcriptul este cale egală). Analytics este în afara fazei actuale (D-069). Dacă o aventură va avea nevoie de „deblocare după ascultare”, aceasta este rezolvarea `acknowledge` (NEXT), nu un eveniment media.

### 6.4 Efecte pentru interfață

Rămân cele existente (`message`, `audio`, `points`, `item`, `warning`). `play_audio` devine utilizabilă odată cu player-ul: efectul `audio` este redat doar după un gest al jucătorului.

---

## 7. Persistence model

**NOW: nicio formă nouă a progresului salvat.** `schemaVersion` al progresului rămâne 2; cheia rămâne `outdoor-escape:game:<id>`.

| Informație | Unde stă | Supraviețuiește reload-ului |
| --- | --- | --- |
| provocare deschisă / rezolvată / sărită | `missions[id].status` | da (există) |
| încercări, indicii deschise | `missions[id].attempts`, `hintsUsed` | da (există) |
| sosirea la punct | `locations[id].arrivedAt`, `arrivalSource` | da (există) |
| obiecte obținute | derivate din `firedEvents` (`collectedItems`) | da (există, local) |
| mesaje primite, epilog | derivate din `firedEvents` (`viewModel.story`) | da (există, local) |
| ce asset a fost văzut / ascultat, ce asset a eșuat | — | nu (efemer, intenționat) |
| poziția slider-ului, zoom, viewer deschis, poziția în audio | stare de interfață | nu (ca D-030: confirmarea indiciului) |
| zona atinsă greșit pe un hotspot (NEXT) | — | nu; o atingere greșită = `answer_incorrect` (+1 `attempts`) |

**Ce ar cere stare nouă** (de aceea nu e NOW): `composite` (condițiile îndeplinite), `narrative_choice` (varianta aleasă), `evidence` (fișiere / dovezi; decizie de confidențialitate — D-043, `13_PLATFORM_V1.1.md` §15.3), modul de joc al sesiunii (Play Mode, §2). Toate cer migrare automată (principiul D-043).

### 7.1 Audio în Bike — regula de siguranță

- `audio_clue` este o mecanică permisă în orice mod de joc.
- **Regulă:** în Bike, conținutul audio de gameplay se consumă numai într-o **stare sigură** (bicicleta oprită, la checkpoint). Structura „sosire → provocare” asigură deja că provocarea se deschide după sosire; player-ul nu pornește niciodată singur.
- Dacă implementarea Bike o va cere, Play Mode poate adăuga o poartă de prezentare („Ești oprit în siguranță?” înaintea provocării) — **fără** schimbarea provocării și fără sistem complet de siguranță acum.
- Prompturile audio / vibrația de **siguranță** („te apropii de checkpoint, oprește”) rămân funcționalitate de UX, separată de gameplay (D-059). Formularea D-059 („audio … nu mecanici de joc”) trebuie precizată în acest sens (§12, D2).

---

## 8. Multimedia model

### 8.1 Definire și referințe

```text
media.assets (image, audio; FUTURE: video, model3d, ar)
   ▲  referite prin id din:
   ├─ mission.media[]            (NOW)
   ├─ narrator.messages[].audio  (există; acum se rezolvă în registrul unificat)
   ├─ play_audio.trackId         (există; idem)
   ├─ items[].image              (NEXT)
   ├─ hints[].media              (NEXT)
   └─ audio.tracks (legacy)  ──► normalizat în media.assets
```

- Validarea verifică referințele și tipul asset-ului (ca azi pentru mesaje și sunete).
- `answers.js` nu este atins: media nu conține răspunsuri. Regulă de conținut: numele fișierelor și `alt` nu dezvăluie răspunsul.

### 8.2 Ce se suportă în V1

| Element | V1 (NOW) | Mai târziu |
| --- | --- | --- |
| imagine statică în misiune | da | — |
| vizualizare pe tot ecranul + zoom | da: `media_viewer` generic, zoom nativ | video, document multi-pagină, comparație pe tot ecranul |
| galerie | da, ca blocuri `image` cu `label` | carusel |
| comparație două imagini | da: `compare` (`slider` / `toggle`) | `layers` (NEXT) |
| audio player + transcript | da: `<audio controls>`, pornit de jucător; transcript obligatoriu pentru voce | subtitrare sincronizată, TTS |
| hartă | harta existentă + schițe / hărți desenate ca imagini (`role: "map"`) | `map_area` (NEXT) |
| document | ca imagine (`role: "document"`) | format dedicat, dacă e nevoie |
| animație | nu | doar dacă are rol în gameplay |
| feedback vizual | există (corect / greșit) | — |
| feedback audio / haptic | nu | FUTURE (D-059) |

### 8.3 Încărcare, rețea, rezervă (V1)

- **V1 poate cere conexiune.** Imaginile unei misiuni se cer la afișarea misiunii (`loading="lazy"`, `decoding="async"`); audio cu `preload="none"` până la „Play”. Din același site, căi relative (D-035).
- **Cache:** doar cache-ul HTTP al browserului. Service worker-ul **nu** pune media în cache în V1 și nu se implementează pachet offline.
- **Rezervă:** asset nedisponibil → `alt` / transcript + „Reîncearcă” (`media_fallback`). Misiunea rămâne rezolvabilă din text, indicii sau „Sari peste”.
- **Buget orientativ** (de validat pe teren): imagini WebP (rezervă JPEG), latura mare ≤ 1600 px, ≤ 300 KB; voce AAC/M4A sau MP3 mono, ≤ 60 s, ≤ 1 MB. OGG nu se folosește (suport incomplet pe iPhone).
- **Shell:** orice modul JS nou intră în `SHELL_FILES` cu `CACHE_VERSION` mărit (CLAUDE.md §4).

### 8.4 Offline ulterior — cerință de design (NEXT, D-056)

Trebuie să se poată **pre-descărca toate asset-urile unei aventuri** înainte de start, pentru joc complet offline (critic pentru trasee cu semnal slab și pentru Bike). Ce trebuie să garanteze V1 de acum, ca pachetul să fie posibil fără refactor:

1. **Lista completă și enumerabilă:** orice fișier media folosit de aventură este declarat în `media.assets` (inclusiv cele normalizate din `audio.tracks`). Niciun fișier nu este referit doar dintr-un text sau dintr-un CSS. Manifestul pachetului = JSON-ul aventurii + `media.assets` (+ `offline.assets` din schema §14.3, dacă se păstrează, pentru alte fișiere).
2. **Căi relative, același site:** pachetul se poate pune în Cache API cu aceleași URL-uri.
3. **Mărimi declarabile:** `width` / `height` / `durationSeconds` (și, la implementare, eventual `bytes`) permit estimarea pachetului înainte de descărcare.
4. **Încărcare printr-un singur punct:** UI-ul obține URL-ul unui asset printr-o funcție unică de rezolvare; pachetul o va putea înlocui cu citirea din cache.
5. Tile-urile hărții rămân în afara pachetului (D-046, D-056, D-063).

### 8.5 Media și conținutul real

- Media aventurilor comerciale este **conținut real** (D-034 o numește explicit). Nu intră în repository, în commit-uri sau pe GitHub Pages.
- Pentru dezvoltare locală este nevoie de un loc ignorat de Git (ex. `content/media/private-<id>/`, după modelul `content/adventures/private-*.json`) — decizie de proces (§12, D4). Nu blochează implementarea generică: demo-ul de test folosește media fictivă, proprie.
- **Conținut istoric:** cercetarea, sursele și licențierea asset-urilor istorice sunt o **fază separată**, după implementarea capabilităților. Până atunci, documentele de design folosesc marcajele `ASSET TO SOURCE` (material de găsit și licențiat), `ASSET TO CREATE` (material propriu) și `FACT TO VERIFY` (orice detaliu istoric). Nu se inventează afirmații istorice (D-011); textele descriu doar ce se vede în imagine.

---

## 9. Composition model

### 9.1 Regula

```text
POARTĂ           STIMUL (0..n blocuri)        REZOLVARE (o formă, §4)        RECOMPENSĂ (reguli)
progresie /  →   text + image / compare /  →  arrival / answer (text,     →  collect_item, show_message,
locationId        audio                        numeric, choice)               award_points, unlock_*
                                               NEXT: hotspot, items, ack
                                               FUTURE: bearing, evidence,
                                               composite
```

În V1 o misiune are **o** formă de rezolvare. Secvențele mai lungi se obțin din **mai multe misiuni consecutive pe aceeași locație** (structura „sosire → provocare”) și din reguli de evenimente. Când va fi nevoie de mai multe condiții pe aceeași misiune, forma `composite` (FUTURE) o permite fără schimbarea celorlalte forme.

### 9.2 Corespondența combinațiilor cerute

| Combinație | Cum se exprimă |
| --- | --- |
| location → historical_overlay → observation → collect_item | M1 `location` → M2 `observation` cu `media: [compare]` + `inputMode: numeric` → regulă `mission_completed` → `collect_item` |
| location → audio_clue → choice → collect_item | M1 `location` → M2 `riddle` cu `media: [audio]` + `choices` → regulă → `collect_item` |
| location → map_observation → visual_discovery → item_collection | M1 `location` → M2 `riddle` cu `media: [image (schiță)]` + `choices` (direcția) → M3 `observation` cu `media: [image (detaliu)]` → regulă → `collect_item` |
| drum după o hartă desenată | M1 `location` cu `media: [image (role: map)]` — schița apare în cardul obiectivului |
| combinația finală de obiecte | NOW: `code` + inventarul afișat; NEXT: rezolvarea `items` și blocul `layers` |

### 9.3 Variante analizate și respinse pentru V1

- **`challenge.steps[]` (mai mulți pași într-o misiune):** ar cere index de pas salvat, evenimente noi și schimbarea `view-model.js` / `game.js`. Misiunile consecutive dau același rezultat; `composite` acoperă ulterior cazurile reale.
- **Tipuri de misiune per mecanică (`historical_overlay`, `audio_clue` ca `mission.type`):** ar dubla validarea și ar bloca combinațiile.
- **Câmp `mode: "bike"` pe misiuni sau blocuri:** încalcă separarea Adventure / Play Mode (§2).

---

## 10. Prima aventură reală — Challenge Design V2

**Conținutul acestei secțiuni este privat (D-034, CLAUDE.md §2)** și se află în `Claude outputs/TASK_CHALLENGE_SYSTEM_V1_PRIVAT.md`: cele 8 provocări reproiectate, cu marcajele `ASSET TO SOURCE` / `ASSET TO CREATE` / `FACT TO VERIFY` / `[TEREN]`.

Rezumat generic (fără conținut real):

| # | Mecanica principală | Capabilități | Rezolvare | Status |
| --- | --- | --- | --- | --- |
| 1 | cifru + mesaj vocal de început | `text_answer`, `audio_clue` (narator) | answer / text | NOW |
| 2 | orientare: schiță + harta live | `map_observation`, `image_observation`, `choice` | answer / choice | NOW (`device_orientation`: FUTURE) |
| 3 | trecut / prezent, numărare | `historical_overlay` (slider), `numeric_answer`, `item_collection` | answer / numeric | NOW |
| 4 | trei mesaje vocale contradictorii, logică | `audio_clue` × 3, `choice` | answer / choice | NOW |
| 5 | „care dintre cele trei detalii e aici?” | `visual_discovery` (pe teren), galerie, `choice`, `item_collection` | answer / choice | NOW (hotspot: NEXT) |
| 6 | drum după o hartă desenată, apoi observație | `map_observation`, `numeric_answer`, `item_collection` | arrival, apoi answer / numeric | NOW (`map_area`: NEXT) |
| 7 | trecut / prezent în mulțime, alegere | `historical_overlay` (toggle), `choice`, `item_collection` | answer / choice | NOW |
| 8 | sinteză: obiectele adunate dau codul | `item_collection`, `numeric_answer` | answer / numeric | NOW (`item_combination`: NEXT) |

Provocările nu conțin nimic specific modului de joc; aceeași aventură ar putea fi oferită și în alt mod, dacă traseul o permite (decizie de produs, nu de cod).

---

## 11. Exemple de reutilizare în Bike

Exemple **fictive** (fără rute, operatori sau coordonate reale). Contractele sunt identice cu Walk; Play Mode Bike adaugă doar regulile de siguranță (§2, §7.1): provocarea se deschide după sosire, interacțiunea are loc cu bicicleta oprită, timpul nu intră în scor (D-025, D-059).

1. **`historical_overlay` la un punct de belvedere.** Misiune `location` → misiune `observation` cu `compare` (fotografia veche a văii / azi, același unghi): „Câte acoperișuri roșii vedeți azi în zona încercuită?”.
2. **`audio_clue` la un checkpoint.** Misiune `riddle` cu un bloc `audio` (personaj fictiv, cu transcript) și `choices`; ascultată cu bicicleta oprită.
3. **`map_observation` la o răscruce.** Schiță + harta live + `choices` („spre vârful din stânga sau spre pădure?”). În FUTURE, `device_orientation` poate folosi aceleași variante ca `fallbackChoices`.
4. **`item_collection` pe tot circuitul + cod la întoarcere.** Fiecare checkpoint dă un fragment (`collect_item`, plus regula pe `mission_skipped`); la final, `code` cu `inputMode: "numeric"`.
5. **`visual_discovery` la un marcaj de traseu.** Imagine cu un detaliu decupat: „Ce număr are borna de lângă podeț?”; NEXT: același detaliu ca `hotspot`.

Aceeași aventură fictivă de mai sus poate fi jucată și pe jos, fără nicio modificare a provocărilor; diferă doar Play Mode (profil GPS, note de siguranță) și, eventual, ruta.

---

## 12. Roadmap NOW / NEXT / FUTURE și engine gaps

### 12.1 NOW — Challenge System V1 (implementare generică)

1. `media.assets` cu tipurile `image` și `audio` + metadatele pe tip + validare (căi sigure, `alt`, `transcriptMessage`, `provenance` pentru `archival`, tipuri rezervate respinse, id-uri unice).
2. Compatibilitate: `audio.tracks` normalizat în `media.assets`; `narrator.messages[].audio` și `play_audio.trackId` rezolvate în registrul unificat. Fixture-ul și testele existente rămân valide.
3. `mission.media[]` cu blocurile `image`, `compare` (`slider` / `toggle`), `audio` + validare (referințe, tip potrivit).
4. `inputMode: "numeric"`.
5. Model pur: forma de rezolvare dedusă (§4.2) și blocurile media cu URL-uri rezolvate printr-un singur punct, fără răspunsuri, în `viewModel.puzzle` și în obiectiv.
6. UI: imagine, comparație, player + transcript, galerie, `media_viewer` generic (strat Back), `media_fallback` (`alt` / transcript + „Reîncearcă”).
7. `sw.js`: modulele noi în `SHELL_FILES` + `CACHE_VERSION`. Fără media în cache, fără pachet offline.
8. Teste `node --test`: schemă, referințe, căi nesigure respinse, tipuri rezervate respinse, compatibilitatea `audio.tracks`, modelul fără răspunsuri, aventuri fără `media` neschimbate, neutralitatea motorului (inclusiv: niciun `walk` / `bike` în modulele noi); o aventură demo fictivă cu media proprie.
9. Documentație la implementare: `11_ADVENTURE_SCHEMA_V2.md`, decizii noi în jurnal.
10. Precondiție: comiterea modificărilor locale existente (`items`, `choices`, jurnal) — designul se sprijină pe ele.

### 12.2 NEXT

`item_collected` + filtrul `itemId`; câmpul explicit `resolution` cu `hotspot` și `items`; `acknowledge`; `items[].image` + `layers`; `map_area` (revizuirea D-048); `hints[].delaySeconds` și `hints[].media`; variante de răspuns (D-024); imagini în mesajele naratorului; `media_offline_package` (D-056); `meta.playModes` și `location.safetyNotes` odată cu Play Mode.

### 12.3 FUTURE

Session / Play Mode complet (cu backend, D-051 – D-055); `composite_resolution`; `narrative_choice` (D-062); `device_orientation`; `evidence` / `photo_evidence`; feedback audio / haptic și TTS (D-059); asset-uri `video` / `model3d`; `ar_scan` (D-050); `meta.requires` (capabilități cerute de aventură).

### 12.4 Faze separate (nu cod)

Cercetarea și licențierea asset-urilor istorice; producția asset-urilor proprii (schițe, fotografii, voci); verificarea pe teren a provocărilor.

### 12.5 Engine gaps

„Motor” = stratul generic (`schema.js`, `view-model.js`, `play-ui.js`, `app.js`, `answers.js`, `game.js`). **Pentru NOW, `game.js`, `events.js` și `answers.js` nu se schimbă.**

| # | Gap | De ce | Generic? | Alte aventuri | Acum? |
| --- | --- | --- | --- | --- | --- |
| G1 | `media.assets` (tipuri + metadate) + validare + normalizarea `audio.tracks` | registru unic, validat, enumerabil pentru offline | da | toate | **NOW** |
| G2 | `mission.media[]` (`image`, `compare`, `audio`) + validare | stimul multimedia fără tipuri noi | da | toate | **NOW** |
| G3 | `inputMode: "numeric"` | coduri / numărători pe telefon | da | toate | **NOW** |
| G4 | Model: rezolvarea dedusă + media rezolvată, fără răspunsuri | UI-ul nu citește conținutul brut | da | toate | **NOW** |
| G5 | UI media + `media_fallback` | jucătorul vede / aude stimulul; nu se blochează | da | toate | **NOW** |
| G6 | `media_viewer` ca strat Back | Back închide viewer-ul, nu pagina | da | toate | **NOW** (extinde D-035 / U2) |
| G7 | Loc privat pentru media reală + `.gitignore` | D-034 | proces | toate cele comerciale | înainte de primul asset real |
| G8 | `item_collected` + `itemId` | reguli pe obiecte | da | toate | NEXT |
| G9 | `resolution` explicit (`hotspot`, `items`) | descoperire pe imagine, combinații | da | toate | NEXT |
| G10 | `acknowledge` | pași narativi | da | toate | NEXT — regulă nouă în `game.js` |
| G11 | `map_area` | indicii de hartă fără pin | da | toate | NEXT — schimbă D-048 |
| G12 | `device_orientation`: adaptor senzor + toleranță în `answers.js` | `bearing` | da | toate | FUTURE |
| G13 | Pachet offline pentru media | trasee fără semnal | da | toate, critic în Bike | NEXT (D-056) |
| G14 | `composite` / `narrative_choice` + stare nouă | rezolvări multiple, alegeri | da | toate | FUTURE |
| G15 | Play Mode în sesiune | separarea Adventure / mod | da | toate | FUTURE (doar documentat acum) |
| G16 | `evidence`, `video`, `model3d`, `ar` | dovezi, media avansată | da | toate | FUTURE |

Riscuri tehnice de verificat la implementare: pinch-zoom în viewer pe iPhone (Safari), `<audio>` cu ecranul blocat (D-028), memoria la imagini mari pe telefoane modeste, lizibilitatea comparației în soare.

---

## 13. Decizii

### 13.1 Ajustări aprobate de proprietar la revizia 1 (2026-10-01), incluse aici

1. Capabilitățile nu depind de modul de deplasare; separarea Adventure (conținut / reguli) ↔ Session / Play Mode (walk / bike) — §2.
2. „Un singur răspuns” nu este limită de arhitectură; conceptul generic **mission resolution** — §4.
3. `map_observation` (NOW) separat de `device_orientation` (FUTURE) — §3.
4. Registru generic `media.assets` cu metadate pe tip; tipurile FUTURE doar rezervate — §5.1.
5. `media_viewer` generic — §3.1.
6. `ASSET TO SOURCE` / `FACT TO VERIFY`; cercetarea istorică este o fază separată — §8.5.
7. Audio gameplay în Bike permis doar în stare sigură, fără sistem de siguranță acum — §7.1.
8. Media V1 poate cere conexiune, cu rezervă; pre-descărcarea completă documentată ca cerință ulterioară — §8.3, §8.4.
9. Challenge Design V2 rămâne privat.

### 13.2 De închis înainte de cod

| # | Decizie | Recomandare |
| --- | --- | --- |
| D1 | Înregistrarea separării Adventure / Play Mode în jurnal și precizarea D-050 + marcarea `settings.gpsPolling.profile` / `safetyWarning` din schema §14.3 ca înlocuite de Play Mode / `safetyNotes` (doar documentație; nu există cod) | da, ca decizie nouă care precizează D-050 |
| D2 | Precizarea D-059: audio de gameplay permis în Bike numai în stare sigură; prompturile de siguranță rămân UX | da |
| D3 | Contractul media: `media.assets` unificat, `audio.tracks` păstrat ca formă veche normalizată, referințele existente rezolvate în registrul unificat; tipuri rezervate respinse; `inputMode: "numeric"` | da |
| D4 | Extinderea precizării D-035 / U2: `media_viewer` devine strat închis de Back (ordinea: viewer, confirmarea indiciului, overlay-ul puzzle-ului — cel mai de sus se închide primul) | da |

Toate patru pot fi înregistrate împreună, în `04_DECISIONS_LOG.md`, la începutul task-ului de implementare.

### 13.3 Nu blochează codul generic

- Locul local al media reale (`content/media/private-<id>/`?) și testarea pe teren a conținutului real, când D-031 cere versiunea publicată, iar D-034 interzice publicarea lui (problema există deja pentru JSON-ul privat).
- Cine produce vocile; sursele și licențele imaginilor de arhivă (faza separată).
- Ordinea NEXT (recomandare: `item_collected` → `resolution` cu `hotspot` → `items` / `layers` → `map_area` → pachet offline).

---

**Ce am verificat:** documentele și codul enumerate în antet; `npm test` (240/240 PASS) pe working tree-ul curent.
**Ce NU am modificat:** codul, motorul, schema, interfața, testele, service worker-ul, aventurile, `04_DECISIONS_LOG.md`, `11_ADVENTURE_SCHEMA_V2.md`. Nu am făcut commit.

---

## Note de implementare — NOW (2026-10-01)

Implementarea urmează acest document, cu următoarele precizări (forma finală este în `11_ADVENTURE_SCHEMA_V2.md` §10):

- **Blocurile media** folosesc câmpul `type` (nu `kind`): `{ "type": "image" | "compare" | "audio", … }`. `kind` rămâne doar câmpul unui asset audio (`voice` / `sfx` / `music`). Blocurile audio trimit la asset prin `asset` (nu `track`).
- **Asset-urile audio** pot avea transcript propriu (`transcript`, text) sau, ca în formatul vechi, `transcriptMessage` (un mesaj al naratorului) — nu ambele.
- **`audio.tracks`** este normalizat în `media.assets` (`normalizeMediaRegistry`, `media.js`); referințele `narrator.messages[].audio` și `play_audio.trackId` acceptă orice asset `audio` din registrul unificat.
- **Locul fișierelor:** căile media sunt relative la fișierul aventurii și nu pot conține „..”, deci media unei aventuri stă sub `content/adventures/` (demo-ul: `content/adventures/media/demo-challenge-media/`). Pentru media reală, locul local ignorat de Git (ex. `content/adventures/media/private-<id>/`) rămâne decizia deschisă din §13.3.
- **Etichetele implicite** ale unei comparații sunt neutre („Imaginea A” / „Imaginea B”): codul nu presupune „trecut / prezent”.
- **Rezolvarea** se deduce din câmpurile existente (§4.2); câmpul explicit `resolution` nu a fost introdus.
- **Module noi:** `src/js/media.js` (pur) și `src/js/media-ui.js` (DOM). `game.js`, `events.js` și `answers.js` nu au fost modificate. `CACHE_VERSION` = `v9`.
- **Demo fictiv:** `content/adventures/demo-challenge-media.json` (`src/?adventure=demo-challenge-media`). **Teste:** `tests/challenge-media.test.js`.
