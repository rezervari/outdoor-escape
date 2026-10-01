# OUTDOOR ESCAPE — FIELD TEST PRIVAT (Cloudflare Pages + Cloudflare Access)

| | |
| --- | --- |
| **Decizie** | D-079 (excepție temporară pentru field testing; D-034 rămâne regula) |
| **Scop** | o aventură reală (privată) jucată de pe telefon, prin internet mobil, fără laptop, cu același motor |
| **Nu este** | deployment-ul public al produsului. Publicul rămâne GitHub Pages (D-020), fără conținut privat |

Acest document este **generic**: nu conține id-ul aventurii, adresa autorizată sau alte date private. Valorile concrete stau într-un document privat din `Claude outputs/` (ignorat de Git). Mai jos: `<id>` = id-ul aventurii private (`private-…`), `<proiect>` = numele proiectului Cloudflare Pages, `<adresa-autorizată>` = singura adresă de e-mail permisă.

**Cine face ce:**

| Pas | Automatizat de proiect | Manual, în Cloudflare Dashboard |
| --- | --- | --- |
| Build privat (allowlist, verificări D-034) | ✅ `scripts/build-private-field-test-site.mjs` | — |
| Teste: publicul nu conține conținut privat; build-ul conține tot ce trebuie | ✅ `npm test` (`tests/private-field-test-build.test.js`) | — |
| Cont, Zero Trust, metoda de login | — | ✅ |
| Proiectul Pages și upload-ul | — | ✅ |
| Aplicațiile și politica Access | — | ✅ |
| Verificarea protecției fără login | — (comenzi de copiat, mai jos) | ✅ rulezi tu comenzile |
| Ștergerea după test | ✅ folderul local | ✅ proiect + aplicații Access |

Scriptul nu conține credențiale, nu folosește rețeaua și nu publică nimic.

---

## A. Generarea build-ului privat

Din rădăcina repository-ului:

```bash
node scripts/build-private-field-test-site.mjs --adventure <id>
```

Rezultat: folderul `private-field-test/` (ignorat de Git), recreat de la zero la fiecare rulare, cu **doar**:

- `index.html` (redirecționarea către `src/`, D-036) și `src/` (aplicația, copiată identic);
- `content/adventures/<id>.json` și **doar** fișierele media referite de aventură;
- aventura implicită a aplicației (`content/adventures/brasov-centrul-vechi.json`, publică), cerută de service worker;
- `_headers` (antete Cloudflare Pages: `noindex`, fără cache partajat pentru `content/`).

Scriptul **eșuează** dacă: aventura lipsește sau nu e validă; lipsește un fișier media; JSON-ul, media sau folderul de ieșire **nu** sunt ignorate de Git; un fișier privat este urmărit de Git. Nu modifică fișierele sursă și nu atinge workflow-ul public.

## B. Ce se încarcă în Cloudflare Pages

**Conținutul** folderului `private-field-test/` — rădăcina lui devine rădăcina site-ului (`index.html` la rădăcină, `src/`, `content/`, `_headers`). Nimic altceva din repository.

## C. Configurarea Cloudflare (manual, în această ordine)

Denumirile din dashboard se pot schimba în timp; dacă un meniu are alt nume, caută funcția echivalentă. **Nu încărca build-ul privat înainte de pasul C5.**

1. **Cont și Zero Trust.** Creează / folosește un cont Cloudflare. Deschide **Zero Trust**, alege numele echipei (team domain, `<echipă>.cloudflareaccess.com`) și planul **Free**. Notă: Cloudflare poate cere o metodă de plată chiar și pentru planul gratuit — de verificat la configurare.
2. **Metoda de login.** Zero Trust → **Settings → Authentication → Login methods**: asigură-te că **One-time PIN** este activ (cod trimis pe e-mail).
3. **Proiectul Pages, cu un upload INOFENSIV.** Workers & Pages → **Create → Pages → Upload assets** (Direct Upload). Nume de proiect **nedescriptiv** (fără numele aventurii; numele `*.pages.dev` sunt vizibile public în jurnalele de certificate). Încarcă un folder cu un singur `index.html` care conține doar textul „placeholder”. După deploy, notează adresa de producție `https://<proiect>.pages.dev` (dacă numele e ocupat, Cloudflare îl poate modifica — folosește adresa afișată).
4. **Aplicația Access (self-hosted) care acoperă TOATE adresele proiectului.** Zero Trust → **Access → Applications → Add an application → Self-hosted**:
   - nume: de exemplu „OE field test”;
   - **Session Duration: 24 hours** (acoperă un field test de 2–4 ore, cu marjă);
   - domenii (public hostnames), fără cale (tot site-ul):
     - `<proiect>.pages.dev` — adresa de producție;
     - `*.<proiect>.pages.dev` — adresele fiecărui deployment (`<hash>.<proiect>.pages.dev`) și ale ramurilor / previzualizărilor.
     Dacă dashboard-ul nu acceptă ambele în aceeași aplicație, creează **două aplicații** cu aceeași politică. Protejarea doar a adresei de producție **nu** protejează automat adresele de deployment / preview.
   - login: doar **One-time PIN**.
   - (Opțional, suplimentar) Pages → proiect → Settings → **Enable access policy** — protejează previzualizările, dar **nu** înlocuiește aplicația pentru adresa de producție.
5. **Politica (doar adresa autorizată).** În aplicația de la pasul 4: politică cu **Action: Allow**, **Include → Emails → `<adresa-autorizată>`**. Nicio altă regulă `Include`; **nu** folosi „Everyone”, domenii de e-mail sau „Any valid service token”.
6. **Verificarea protecției pe placeholder** (secțiunea E). Abia când trece, mergi mai departe.
7. **Upload-ul build-ului privat.** Pages → proiect → **Create deployment** (deployment de producție) → încarcă folderul `private-field-test/` generat la pasul A.
8. **Verificarea finală a protecției** pentru JSON și media (secțiunea E), inclusiv pe adresa deployment-ului nou (`<hash>.<proiect>.pages.dev`, vizibilă în lista Deployments).

## D. Limitarea accesului la o singură adresă

- Politica din C5 este singura politică a aplicației / aplicațiilor din C4.
- Login-ul este doar One-time PIN: Cloudflare trimite un cod pe `<adresa-autorizată>`; o altă adresă nu primește acces.
- Nu crea service tokens, reguli „Bypass” sau excepții de cale (path) pentru `content/`, `src/` sau alte foldere.

## E. Verificarea protecției fără login

**Nu este suficient ca pagina principală să ceară login.** Se verifică separat JSON-ul și cel puțin un fișier media, pe adresa de producție și pe adresa unui deployment.

Fără login (din terminal; pe Windows funcționează `curl.exe`):

```bash
curl -sI "https://<proiect>.pages.dev/content/adventures/<id>.json"
curl -sI "https://<proiect>.pages.dev/content/adventures/<cale-media-din-aventură>"
curl -sI "https://<hash>.<proiect>.pages.dev/content/adventures/<id>.json"
curl -sI "https://<proiect>.pages.dev/src/"
```

Rezultat corect pentru **fiecare**: răspuns de redirecționare (`302`) cu `Location:` către `https://<echipă>.cloudflareaccess.com/…` (pagina de login), **nu** `200` cu conținut. Un `200` cu `content-type: application/json` (sau tipul fișierului media) înseamnă **expunere**: șterge imediat deployment-ul (H) și corectează Access.

Pe telefon: o fereastră privată / incognito, fără login, pe adresa JSON-ului → trebuie să apară pagina de login Cloudflare Access, nu textul aventurii.

## F. Deschiderea aventurii pe Android / iPhone

1. În browser (Chrome pe Android, Safari pe iPhone): `https://<proiect>.pages.dev/src/?adventure=<id>`.
2. Pagina Cloudflare Access: introdu `<adresa-autorizată>` → primești un cod pe e-mail → introdu codul.
3. Se deschide aplicația, pe aventura privată. „Activează locația” → permite locația (HTTPS, deci GPS-ul funcționează).
4. **Nu instala** aplicația pe ecranul de start pentru field test (în special pe iPhone, aplicația instalată are stocare și cookie-uri separate de Safari): joacă din tab-ul browserului.
5. Progresul se salvează pe telefon (`localStorage`, pe domeniul proiectului).

## G. Dacă sesiunea Access expiră

- Simptom: ecranul „Aventura nu a putut fi încărcată” sau imagini / sunete care nu se mai încarcă.
- Reîncarcă pagina; dacă apare pagina de login, autentifică-te din nou (cod pe e-mail). **Progresul rămâne** pe telefon.
- Dacă reîncărcarea nu duce la login: deschide din nou `https://<proiect>.pages.dev/src/?adventure=<id>`.
- Cu durata de 24 h (C4), expirarea în timpul unui test de 2–4 ore apare doar dacă testul începe aproape de expirarea unei sesiuni vechi: autentifică-te din nou chiar înainte de plecare.
- Fără internet mobil, aventura nu se poate (re)încărca: JSON-ul și media nu sunt în pachet offline (Adventure Package rămâne milestone separat).

## H. Ștergerea completă după field test

1. Cloudflare: Workers & Pages → proiect → **Settings → Delete project** (șterge toate deployment-urile și adresele `*.pages.dev`).
2. Zero Trust → Access → Applications → șterge aplicația / aplicațiile din C4.
3. Verifică: adresele din E nu mai răspund cu conținut.
4. Local: șterge folderul `private-field-test/` (`rm -rf private-field-test`; se poate regenera oricând).
5. Telefon: șterge datele site-ului `<proiect>.pages.dev` (setările browserului).
6. Notează în jurnal (D-079) data ștergerii.
