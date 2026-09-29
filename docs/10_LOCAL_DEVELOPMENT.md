# OUTDOOR ESCAPE — DEZVOLTARE LOCALĂ

## 1. Scop

Acest document descrie cum se lucrează local la proiect și cum se testează funcțiile GPS/PWA pe un telefon real.

Stare: în Faza 0 nu există încă cod de aplicație. Secțiunile 4–8 se aplică după ce va exista scheletul PWA. Acolo unde procedura depinde de o decizie încă deschisă, trimiterea este la `04_DECISIONS_LOG.md` (intrările PROPOSED).

## 2. Principii

- Nu există pas de build (D-018). Fișierele din repository sunt exact fișierele servite browserului.
- Nu există backend (D-019). Pentru dezvoltare este suficient un server static local.
- Nu se instalează dependențe în proiect doar pentru dezvoltare fără o justificare documentată.
- Nu se pun secrete în repository. `.env` și `.env.*` sunt excluse prin `.gitignore`.

## 3. Cerințe pe calculator (Windows)

- Git for Windows (inclusiv Git Bash);
- Google Chrome (browserul principal de test, cu DevTools);
- un editor de text;
- **una** dintre variantele de server static de mai jos:
  - Python 3 (modulul `http.server`, inclus în Python), sau
  - Node.js (comanda `npx serve`, fără a adăuga dependențe în repository).

Verificare în Git Bash:

```bash
git --version
python --version   # sau: py --version
node --version     # doar dacă se folosește varianta Node
```

## 4. Pornirea serverului local

Aplicația nu trebuie deschisă direct ca fișier (`file://...`). În modul `file://`, browserele blochează sau limitează modulele JavaScript, încărcarea fișierelor JSON cu `fetch` și service worker-ul.

Serverul se pornește **din rădăcina repository-ului**, astfel încât structura locală să fie identică cu cea publicată (D-035):

```bash
cd "/c/Users/<utilizator>/Documents/Outdoor Escape"

# Varianta Python, doar pe acest calculator:
python -m http.server 8000 --bind 127.0.0.1
# (pe unele instalări Windows: py -m http.server 8000 --bind 127.0.0.1)

# Varianta Node:
npx serve -l 8000 .
```

Apoi, în browser:

- aplicația: `http://localhost:8000/src/`
- conținutul (pentru verificare): `http://localhost:8000/content/...`

Adresa `http://localhost:8000/` (fără `src/`) nu este aplicația.

Oprire: `Ctrl + C` în terminal.

## 5. De ce contează HTTPS („secure context”)

Geolocația și service worker-ul funcționează doar într-un context sigur:

| Adresă | Context sigur? | GPS / service worker |
| --- | --- | --- |
| `http://localhost:8000` | da (excepție pentru localhost) | funcționează |
| `http://127.0.0.1:8000` | da | funcționează |
| `http://192.168.x.x:8000` (IP din rețeaua locală) | **nu** | **nu funcționează** |
| `https://...` cu certificat valid | da | funcționează |
| `file://...` | nu | nu funcționează |

Consecință: un telefon care deschide `http://192.168.x.x:8000` poate afișa pagina, dar **nu** poate testa GPS-ul, service worker-ul, modul offline sau instalarea PWA. Rezultatele unui astfel de test nu sunt valide pentru aceste funcții.

Pe calculator, geolocația reală este aproximativă (bazată pe Wi-Fi/IP). Pentru teste pe desktop se folosesc coordonate simulate (vezi `07_TESTING.md`).

## 6. Testarea pe un telefon real

Metoda standard pentru proiect nu este încă aleasă (D-031, PROPOSED). Opțiunile tehnice sunt:

### A. Adresa HTTPS de pe GitHub Pages

- GitHub Pages servește site-ul prin HTTPS, deci merge pe Android și pe iPhone.
- Adresa aplicației în producție este `https://rezervari.github.io/outdoor-escape/src/` (D-035). Subfolderul `/outdoor-escape/` este impus de GitHub Pages, de aceea toate căile din aplicație sunt relative, nu absolute (`/`).
- Publicarea se face printr-un workflow GitHub Actions (D-020), la push pe `main`, după ce workflow-ul va exista. Progresul unei publicări se vede în tab-ul „Actions” al repository-ului.
- Limitare: fiecare test cere un commit și un push, iar ce se publică este vizibil public.

### B. Android: redirecționare de port prin USB (Chrome)

1. Pe telefon: activează „Opțiuni pentru dezvoltatori” și „Depanare USB”.
2. Conectează telefonul la calculator prin USB.
3. Pe calculator, în Chrome: `chrome://inspect/#devices` → „Port forwarding” → `8000` → `localhost:8000`.
4. Pe telefon, în Chrome: `http://localhost:8000/src/`.

Telefonul vede adresa ca `localhost`, deci GPS-ul și service worker-ul funcționează. Aceeași conexiune permite vederea consolei telefonului în DevTools. Metoda nu funcționează pentru iPhone.

### C. Tunel HTTPS temporar

Un serviciu de tunel (de exemplu Cloudflare Tunnel sau ngrok) oferă o adresă HTTPS publică temporară către serverul local. Funcționează pe Android și iPhone.

Limitare: serverul local devine accesibil public cât timp tunelul este pornit, iar tunelul este un serviciu terț. Se oprește imediat după test.

### D. Certificat HTTPS local (de exemplu mkcert)

Posibil, dar certificatul trebuie instalat și marcat ca de încredere pe fiecare telefon. Pe iPhone pașii sunt mai complicați. Nerecomandat ca metodă inițială.

### E. Android: flag Chrome pentru o adresă nesigură

`chrome://flags/#unsafely-treat-insecure-origin-as-secure` permite marcarea unei adrese `http://192.168.x.x:8000` ca sigură, doar pe acel telefon. Este o setare de dezvoltare, se folosește temporar și nu reproduce exact condițiile reale.

### Particularități iPhone

- Pe iPhone toate browserele folosesc motorul Safari (WebKit); testul se face în Safari.
- Consola de depanare pentru iPhone necesită un Mac (Safari → Web Inspector). Fără Mac, observațiile se notează manual.
- O aplicație adăugată pe ecranul principal („Add to Home Screen”) are stocare separată de tab-ul Safari: progresul dintr-un tab nu apare în aplicația instalată și invers.
- Permisiunea de localizare: Setări → Confidențialitate și securitate → Servicii de localizare → Safari Websites.

## 7. Service worker în timpul dezvoltării

Un service worker poate servi fișiere vechi din cache după o modificare. În Chrome DevTools → Application:

- Service workers → „Update on reload” în timpul dezvoltării;
- Service workers → „Unregister” pentru a porni curat;
- Storage → „Clear site data” pentru a șterge cache-ul și progresul salvat.

Pe telefon: se șterg datele site-ului din setările browserului.

Numele cache-urilor și cheile din `localStorage` au prefixul proiectului (`outdoor-escape:`, D-035). Pe `localhost`, stocarea este separată de cea din producție. Strategia de versionare a cache-ului se stabilește când se implementează service worker-ul (Faza 3).

## 8. Rețea și firewall pe Windows

- Varianta cu `--bind 127.0.0.1` nu expune serverul în rețea (recomandat).
- Dacă serverul este expus în rețeaua locală, Windows poate cere permisiune în firewall. Se permite doar pentru rețele private, nu publice.
- Adresa IP a calculatorului: `ipconfig` (în Command Prompt sau PowerShell).

## 9. Fluxul Git

Pentru commit, push și verificarea stării se urmează `06_GIT_WORKFLOW.md`. Înainte de orice sesiune de test, notează commit-ul testat:

```bash
git status
git log -1 --oneline
```

## 10. Validarea documentației

Deocamdată nu există tooling de validare în repository (D-023, PROPOSED). Verificări manuale minime înainte de commit:

- linkurile relative dintre documente duc la fișiere existente;
- fișierele sunt salvate în UTF-8;
- diacriticele sunt cele corecte, cu virgulă: `ș` și `ț` (nu `ş`/`ţ`, cu sedilă);
- `git diff` conține doar modificările intenționate.
