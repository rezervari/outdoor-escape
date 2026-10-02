/*
 * M7 — gong-ul notificării (D-106): src/js/gong.js cu un AudioContext simulat (fără browser).
 *
 * Verifică: deblocarea la gest, gong reușit, context indisponibil / eșuat, reluare refuzată sau prea
 * lentă (abandon, fără redare amânată), stop() la reset și faptul că nicio metodă nu aruncă excepții.
 * Când sună gong-ul (audio de misiune, absorbție) decide politica: tests/notification-policy.test.js
 * și tests/notification-ui.test.js.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createGong } from "../src/js/gong.js";

/** AudioContext simulat: noduri care își înregistrează pornirea / oprirea. */
class FakeAudioContext {
  constructor({ state = "running", resume = "resolve" } = {}) {
    this.state = state;
    this.resumeMode = resume; // "resolve" | "reject" | "pending" | "throw"
    this.currentTime = 0;
    this.destination = { kind: "destination" };
    this.oscillators = [];
    this.resumeCalls = 0;
    this.pendingResume = null;
  }
  resume() {
    this.resumeCalls += 1;
    if (this.resumeMode === "throw") throw new Error("resume");
    if (this.resumeMode === "reject") return Promise.reject(new Error("NotAllowedError"));
    if (this.resumeMode === "pending") return new Promise((resolve) => (this.pendingResume = () => { this.state = "running"; resolve(); }));
    this.state = "running";
    return Promise.resolve();
  }
  createGain() {
    const param = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
    return { gain: param, connect() {}, disconnect() {} };
  }
  createOscillator() {
    const oscillator = {
      type: null, frequency: { value: 0 }, started: null, stoppedAt: null, stopped: false,
      connect() {}, disconnect() {},
      start(time) { this.started = time; },
      stop(time) { if (time === undefined) this.stopped = true; else this.stoppedAt = time; },
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }
}

const factory = (options) => {
  const created = [];
  const createContext = () => {
    const context = new FakeAudioContext(options);
    created.push(context);
    return context;
  };
  return { created, createContext };
};

test("fără gest: play() nu creează context și nu sună", async () => {
  const { created, createContext } = factory();
  const gong = createGong({ createContext });
  assert.equal(await gong.play(), false);
  assert.equal(created.length, 0);
  assert.equal(gong.isUnlocked(), false);
});

test("deblocare la gest: un singur context, păstrat doar în memorie; apoi gong-ul sună", async () => {
  const { created, createContext } = factory();
  const gong = createGong({ createContext });
  assert.equal(gong.unlock(), true);
  assert.equal(gong.unlock(), true);
  assert.equal(created.length, 1);
  assert.equal(await gong.play(), true);
  const [context] = created;
  assert.ok(context.oscillators.length > 0);
  for (const oscillator of context.oscillators) {
    assert.equal(oscillator.type, "sine");
    assert.equal(oscillator.started, 0);
    assert.ok(oscillator.stoppedAt > 0 && oscillator.stoppedAt <= 1.5, "gong scurt");
  }
});

test("context suspendat la gest: reluarea pornește în gest; gong-ul sună dacă reluarea reușește la timp", async () => {
  const { created, createContext } = factory({ state: "suspended", resume: "pending" });
  let clock = 0;
  const gong = createGong({ createContext, now: () => clock });
  assert.equal(gong.unlock(), false); // reluarea este asincronă
  const playing = gong.play();
  clock += 50;
  created[0].pendingResume();
  assert.equal(await playing, true);
  assert.equal(gong.isUnlocked(), true);
});

test("reluare prea lentă: gong-ul se abandonează (fără redare amânată)", async () => {
  const { created, createContext } = factory({ state: "suspended", resume: "pending" });
  let clock = 0;
  const gong = createGong({ createContext, now: () => clock });
  gong.unlock();
  const playing = gong.play();
  clock += 5_000; // contextul pornește abia la un gest ulterior
  created[0].pendingResume();
  assert.equal(await playing, false);
  assert.equal(created[0].oscillators.length, 0);
});

test("autoplay blocat (reluare refuzată / excepție): fără gong, fără excepție, fără reîncercare automată", async () => {
  for (const resume of ["reject", "throw"]) {
    const { created, createContext } = factory({ state: "suspended", resume });
    const gong = createGong({ createContext });
    assert.doesNotThrow(() => gong.unlock());
    assert.equal(await gong.play(), false);
    assert.equal(created[0].oscillators.length, 0);
    const calls = created[0].resumeCalls;
    await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(created[0].resumeCalls, calls, "nicio reluare fără o nouă cerere");
  }
});

test("Web Audio indisponibil sau contextul nu poate fi creat: fără gong, fără excepție", async () => {
  for (const createContext of [() => null, () => { throw new Error("NotSupportedError"); }]) {
    const gong = createGong({ createContext });
    assert.equal(gong.unlock(), false);
    assert.equal(await gong.play(), false);
    assert.doesNotThrow(() => gong.stop());
  }
});

test("eroare la generarea sunetului: false, fără excepție, nimic rămas pornit", async () => {
  const { created, createContext } = factory();
  const gong = createGong({ createContext });
  gong.unlock();
  created[0].createOscillator = () => { throw new Error("InvalidStateError"); };
  assert.equal(await gong.play(), false);
});

test("stop() (reset): oprește gong-ul în curs și anulează o încercare neterminată", async () => {
  const { created, createContext } = factory();
  const gong = createGong({ createContext });
  gong.unlock();
  await gong.play();
  gong.stop();
  assert.ok(created[0].oscillators.every((oscillator) => oscillator.stopped));

  const slow = factory({ state: "suspended", resume: "pending" });
  const second = createGong({ createContext: slow.createContext, now: () => 0 });
  second.unlock();
  const playing = second.play();
  second.stop(); // reset înainte ca reluarea să se termine
  slow.created[0].pendingResume();
  assert.equal(await playing, false);
  assert.equal(slow.created[0].oscillators.length, 0);
});

test("o încercare reușită = un singur sunet (un set de oscilatoare), inclusiv când reluarea se termină în fereastră", async () => {
  const immediate = factory();
  const now = createGong({ createContext: immediate.createContext });
  now.unlock();
  assert.equal(await now.play(), true);
  const partials = immediate.created[0].oscillators.length;
  assert.ok(partials > 0);

  const delayed = factory({ state: "suspended", resume: "pending" });
  let clock = 0;
  const later = createGong({ createContext: delayed.createContext, now: () => clock });
  later.unlock(); // reluarea pornită de gest
  const playing = later.play(); // aceeași reluare, încă neterminată
  clock += 299; // în fereastră
  delayed.created[0].pendingResume();
  assert.equal(await playing, true);
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(delayed.created[0].oscillators.length, partials, "un singur sunet");
});

test("reluare care nu se termină niciodată: niciun sunet, nicio excepție, nicio reluare suplimentară", async () => {
  const { created, createContext } = factory({ state: "suspended", resume: "pending" });
  let clock = 0;
  const gong = createGong({ createContext, now: () => clock });
  gong.unlock();
  const calls = created[0].resumeCalls;
  const playing = gong.play(); // nu se va termina: contextul nu pornește
  clock += 60_000;
  const settled = await Promise.race([playing.then(() => "settled"), new Promise((resolve) => setTimeout(() => resolve("pending"), 20))]);
  assert.equal(settled, "pending"); // nimic nu așteaptă această încercare (app.js nu face await)
  assert.equal(created[0].oscillators.length, 0);
  assert.equal(created[0].resumeCalls, calls + 1, "o singură cerere de reluare pentru această încercare");
});

test("după abandon (fereastra depășită) nu există reîncercare: niciun sunet ulterior, nicio cerere nouă de reluare", async () => {
  const { created, createContext } = factory({ state: "suspended", resume: "pending" });
  let clock = 0;
  const gong = createGong({ createContext, now: () => clock });
  gong.unlock();
  const playing = gong.play();
  clock += 301; // fereastra depășită
  created[0].pendingResume(); // contextul pornește abia acum (ex. la un gest ulterior)
  assert.equal(await playing, false);
  const calls = created[0].resumeCalls;
  await new Promise((resolve) => setTimeout(resolve, 20));
  assert.equal(created[0].oscillators.length, 0);
  assert.equal(created[0].resumeCalls, calls);
  assert.equal(gong.isUnlocked(), true); // o prezentare NOUĂ ar suna; cea abandonată nu revine
});

test("fiecare play() este o încercare separată: gong-ul nu se repetă singur", async () => {
  const { created, createContext } = factory();
  const gong = createGong({ createContext });
  gong.unlock();
  await gong.play();
  const count = created[0].oscillators.length;
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.equal(created[0].oscillators.length, count);
});

test("sursa: Web Audio, fără <audio>, motor, mesaje, Inbox, stocare sau fișiere audio", async () => {
  const source = await readFile(new URL("../src/js/gong.js", import.meta.url), "utf8");
  assert.deepEqual([...source.matchAll(/^import .* from "(.+)";$/gm)], []);
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(code, /new Audio\b|createElement\(|querySelector|document\.|localStorage|sessionStorage|fetch\(|\.mp3|\.ogg|\.wav/);
  assert.doesNotMatch(code, /game|inbox|message|notified|gongPlayed|audioPlayed/i);
  assert.match(code, /createOscillator\(\)/);
});
