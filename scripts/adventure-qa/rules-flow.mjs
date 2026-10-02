/*
 * Adventure QA — regulile de flow / progresie (Pasul 4).
 *
 *   QA-F00  simularea traseului principal cu motorul real (createGame)                (error)
 *   QA-F01  câmpuri de flux pe care schema și motorul le ignoră                        (warning)
 *   QA-F02  misiune principală, alta decât prima, care începe „pending”                (warning)
 *   QA-F03  complete_adventure care poate încheia aventura înaintea traseului main     (error / warning)
 *   QA-F04  regulă de evenimente care nu poate rula niciodată (determinist)            (error)
 *   QA-F05  conținut opțional evident inaccesibil: misiuni bonus / secrete, obiecte,
 *           secrete fără nicio cale de obținere                                        (warning)
 *   QA-F08  contractul narativ al finalului: finale.missionId pe ultima misiune main,
 *           finale complet (missionId + messageId), finale prezent la aventura publicată,
 *           start_finale doar cu finale                                                (warning)
 *
 * Sursa de adevăr este motorul (game.js, events.js):
 * - progresia liniară: misiunile `main`, în ordinea din listă; închiderea uneia o deschide pe
 *   următoarea; „Sari peste” este disponibil pentru orice misiune curentă deschisă;
 * - payload-urile evenimentelor (EVENT_PAYLOAD, mai jos) sunt cele emise de game.js; filtrul
 *   `where` cere egalitate pe fiecare cheie (events.matchesFilter), deci o cheie absentă din
 *   payload nu se potrivește niciodată.
 * QA-F04 raportează doar cazurile pe care motorul le face imposibile în orice partidă cu acest
 * conținut; QA-F05 nu demonstrează accesibilitatea (fără analiză de graf / cicluri — amânată).
 *
 * QA-F00 este asincron (validatorul răspunsurilor este asincron — D-021) și rulează separat
 * (simulateFlow, folosit de runQaFull din rules.mjs); celelalte reguli sunt pure și sincrone.
 * Toate primesc aventura normalizată (toAdventureV2) a unui fișier valid după schemă (QA-S01).
 * Mesajele citează id-urile doar între „…” (mascate pentru aventurile private).
 */

import { createGame, GameStatus, ChallengeStatus, MissionStatus } from "../../src/js/game.js";
import { createLocalValidator, withoutAnswers, answersMatch } from "../../src/js/answers.js";
import { ANSWER_MISSION_TYPES } from "../../src/js/schema.js";
import { CLASSES } from "./classify.mjs";

/**
 * Câmpurile fiecărui eveniment emis de game.js (doar cele care pot apărea în `where`:
 * missionId, locationId, secretId, partnerId). Aceeași listă de evenimente ca events.EVENT_TYPES
 * (verificat de teste).
 */
export const EVENT_PAYLOAD = Object.freeze({
  adventure_started: [],
  adventure_completed: [],
  mission_unlocked: ["missionId", "locationId"],
  mission_started: ["missionId", "locationId"],
  mission_completed: ["missionId", "locationId"],
  mission_failed: ["missionId", "locationId"],
  mission_skipped: ["missionId", "locationId"],
  answer_incorrect: ["missionId", "locationId"],
  hint_requested: ["missionId", "locationId"],
  location_unlocked: ["locationId"],
  player_near_location: ["locationId"],
  player_arrived: ["locationId"],
  player_left_area: ["locationId"],
  location_discovered: ["locationId"],
  location_completed: ["locationId"],
  secret_discovered: ["secretId", "locationId", "missionId"],
  partner_unlocked: ["partnerId", "locationId", "missionId"],
  finale_started: ["missionId"],
});

/** Evenimentele emise pentru o misiune: payload = { missionId: mission.id, locationId: mission.locationId }. */
const MISSION_EVENTS = Object.freeze(["mission_unlocked", "mission_started", "mission_completed", "mission_failed", "mission_skipped", "answer_incorrect", "hint_requested"]);
const CLOSE_EVENTS = Object.freeze(["mission_completed", "mission_failed", "mission_skipped"]);

/**
 * Poate motorul emite evenimentul `on` pentru misiune? (game.js)
 * - mission_unlocked: unlockMission cere starea „locked”, iar o misiune nu revine niciodată la „locked”;
 * - mission_started: startMission este apelat doar pentru misiunile principale (start, next);
 * - answer_incorrect: submitMissionAnswer ignoră misiunile „location”;
 * - hint_requested: requestHint întoarce null pentru o misiune fără indicii.
 */
function canEmit(on, mission) {
  if (on === "mission_unlocked") return mission.initialStatus === MissionStatus.LOCKED;
  if (on === "mission_started") return mission.track === "main";
  if (on === "answer_incorrect") return ANSWER_MISSION_TYPES.includes(mission.type);
  if (on === "hint_requested") return mission.hints.length > 0;
  return true;
}

const CANNOT_EMIT = {
  mission_unlocked: "începe „pending”, deci nu trece niciodată prin „locked” → „pending”",
  mission_started: "nu este pe traseul main (doar misiunile principale devin curente)",
  answer_incorrect: "este de tip „location” (fără răspuns)",
  hint_requested: "nu are indicii",
};

/** Câmpuri care par să descrie flow-ul, dar pe care schema și motorul nu le citesc. */
export const IGNORED_MISSION_FLOW_FIELDS = Object.freeze(["dependsOn", "after", "join", "requires", "prerequisites", "unlockAfter", "locked", "next"]);
const PROPOSED_GRAPH_FIELDS = Object.freeze(["after", "join"]);
export const IGNORED_TOP_LEVEL_FLOW_FIELDS = Object.freeze({
  epilogue: "epilogul este mesajul narrator.messages[finale.messageId]",
  skip: "„Sari peste” este o acțiune a jucătorului, nu un câmp al aventurii",
  final: "finalul se declară prin `finale` (missionId + messageId)",
});

const has = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const whereOf = (rule) => (rule.where && typeof rule.where === "object" ? rule.where : {});
const matches = (where, payload) => Object.keys(where).every((key) => payload[key] === where[key]);

/* ---------- QA-F04 (folosit și de QA-F03, QA-F05) ---------- */

/**
 * Regulile care nu pot rula niciodată: Map<index regulă, { path, message }>.
 * Două treceri: secret_discovered / partner_unlocked depind de acțiunile din regulile
 * care pot rula (prima trecere); fără propagare mai departe (conservator).
 */
export function deadRules(content) {
  const dead = new Map();
  const missionPayload = (m) => ({ missionId: m.id, locationId: m.locationId });

  content.events.forEach((rule, index) => {
    const where = whereOf(rule);
    const allowed = EVENT_PAYLOAD[rule.on] ?? [];
    const absent = Object.keys(where).filter((key) => !allowed.includes(key));
    if (absent.length > 0) {
      dead.set(index, {
        path: `events[${index}].where.${absent[0]}`,
        message: `regula „${rule.id}” filtrează după ${absent.join(", ")}, câmp pe care evenimentul „${rule.on}” nu îl are; nu poate rula niciodată.`,
      });
      return;
    }
    if (MISSION_EVENTS.includes(rule.on)) {
      const matching = content.missions.filter((m) => matches(where, missionPayload(m)));
      if (matching.length === 0) {
        const mission = content.missions.find((m) => m.id === where.missionId);
        const detail = mission
          ? `misiunea „${mission.id}” ${mission.locationId ? `are locationId „${mission.locationId}”` : "nu are locationId"}, nu „${where.locationId}”`
          : `nicio misiune nu are locationId „${where.locationId}”`;
        dead.set(index, { path: `events[${index}].where`, message: `regula „${rule.id}”: ${detail}; nu poate rula niciodată.` });
        return;
      }
      if (!matching.some((m) => canEmit(rule.on, m))) {
        const detail = matching.length === 1
          ? `misiunea „${matching[0].id}” ${CANNOT_EMIT[rule.on]}`
          : `nicio misiune care corespunde filtrului nu poate emite „${rule.on}” (${CANNOT_EMIT[rule.on]})`;
        dead.set(index, { path: `events[${index}].on`, message: `regula „${rule.id}”: ${detail}; nu poate rula niciodată.` });
      }
      return;
    }
    if (rule.on === "finale_started" && has(where, "missionId") && where.missionId !== content.finale?.missionId) {
      dead.set(index, {
        path: `events[${index}].where.missionId`,
        message: `regula „${rule.id}”: finale_started are missionId = finale.missionId (${content.finale?.missionId ? `„${content.finale.missionId}”` : "absent"}), nu „${where.missionId}”; nu poate rula niciodată.`,
      });
    }
  });

  // A doua trecere: secretele și partenerii se obțin doar prin acțiuni (discover_secret, unlock_partner).
  const produced = (action, key) => new Set(content.events.flatMap((rule, index) =>
    dead.has(index) ? [] : rule.do.filter((a) => a.action === action).map((a) => a[key])));
  const discovered = produced("discover_secret", "secretId");
  const unlocked = produced("unlock_partner", "partnerId");
  const firstPass = new Set(dead.keys());

  content.events.forEach((rule, index) => {
    if (firstPass.has(index)) return;
    const where = whereOf(rule);
    if (rule.on === "secret_discovered") {
      const candidates = content.secrets.filter((s) => matches(where, { secretId: s.id, locationId: s.locationId, missionId: s.missionId }));
      if (!candidates.some((s) => discovered.has(s.id))) {
        dead.set(index, {
          path: `events[${index}].on`,
          message: candidates.length === 0
            ? `regula „${rule.id}”: niciun secret nu corespunde filtrului; nu poate rula niciodată.`
            : `regula „${rule.id}”: nicio acțiune discover_secret (într-o regulă care poate rula) nu produce ${candidates.length === 1 ? `secretul „${candidates[0].id}”` : "secretele filtrate"}; nu poate rula niciodată.`,
        });
      }
    }
    if (rule.on === "partner_unlocked") {
      const candidates = content.partners.filter((p) => matches(where, { partnerId: p.id, locationId: p.locationId, missionId: p.missionId }));
      // unlockPartner emite doar pentru un partener încă „locked”.
      if (!candidates.some((p) => p.initialStatus === "locked" && unlocked.has(p.id))) {
        dead.set(index, {
          path: `events[${index}].on`,
          message: candidates.length === 0
            ? `regula „${rule.id}”: niciun partener nu corespunde filtrului; nu poate rula niciodată.`
            : `regula „${rule.id}”: nicio acțiune unlock_partner (într-o regulă care poate rula) nu deblochează ${candidates.length === 1 ? `partenerul „${candidates[0].id}”` : "partenerii filtrați"} dintr-o stare „locked”; nu poate rula niciodată.`,
        });
      }
    }
  });
  return dead;
}

/* ---------- QA-F03 ---------- */

/**
 * complete_adventure încheie imediat aventura (game.completeAdventure). Prematur = aventura se poate
 * încheia cât timp o misiune principală nu a fost închisă.
 *   ERROR   — demonstrabil din structură: adventure_started; finale_started cu finale.missionId pe o
 *             misiune principală care nu este ultima (cele de după ea nu mai devin curente);
 *             evenimente de misiune pentru o misiune principală, în afara închiderii ultimei;
 *             mission_started pe ultima: se emite doar pentru o misiune „pending”, în aceeași tranzacție
 *             în care devine curentă, deci jucătorul nu o mai poate juca;
 *   WARNING — momentul depinde de jucător (locații, secrete, parteneri, misiuni bonus / secrete,
 *             start_finale fără finale.missionId) sau există o partidă validă care se încheie normal:
 *             finale_started pe ultima misiune (ex. o misiune „location” deja rezolvată prin sosire
 *             înainte să devină curentă); answer_incorrect / hint_requested pe ultima (jucătorul a jucat-o;
 *             regula o poate închide, ex. fail_mission); mission_unlocked pe ultima, dacă este „location”
 *             (unlockMission o rezolvă imediat când sosirea era deja înregistrată). Pe ultima misiune cu
 *             răspuns, mission_unlocked rămâne ERROR: deblocarea și regula sunt în aceeași tranzacție;
 *   nimic   — închiderea ultimei misiuni principale; adventure_completed (deja încheiată).
 */
function checkCompleteAdventure(content, dead, add) {
  const main = content.missions.filter((m) => m.track === "main");
  const last = main[main.length - 1];
  content.events.forEach((rule, index) => {
    if (dead.has(index)) return;
    rule.do.forEach((action, a) => {
      if (action.action !== "complete_adventure") return;
      const path = `events[${index}].do[${a}]`;
      const subject = `events.${rule.id}`;
      const name = `regula „${rule.id}” (${rule.on})`;
      if (rule.on === "adventure_completed") return;
      if (rule.on === "adventure_started") {
        return add("QA-F03", "error", path, `${name}: complete_adventure la pornire încheie aventura înainte de orice misiune.`, subject);
      }
      if (rule.on === "finale_started") {
        const finaleId = content.finale?.missionId;
        if (!finaleId) return add("QA-F03", "warning", path, `${name}: finale_started vine doar din start_finale; momentul nu se poate verifica static.`, subject);
        return finaleId !== last?.id
          ? add("QA-F03", "error", path, `${name}: finale_started se emite cel târziu când misiunea „${finaleId}” devine curentă, deci misiunile principale de după ea nu mai sunt jucate.`, subject)
          : add("QA-F03", "warning", path, `${name}: finale_started se emite când ultima misiune „${finaleId}” devine curentă; dacă nu era deja închisă (ex. prin sosire), complete_adventure o încheie înainte să fie jucată.`, subject);
      }
      if (MISSION_EVENTS.includes(rule.on)) {
        const where = whereOf(rule);
        const candidates = content.missions.filter((m) => matches(where, { missionId: m.id, locationId: m.locationId }) && canEmit(rule.on, m));
        const premature = candidates.filter((m) => m.track === "main" && !(CLOSE_EVENTS.includes(rule.on) && m === last));
        if (premature.length > 0) {
          // WARNING: hint_requested pe o misiune „location” (emis doar prin API-ul motorului, nu din interfață);
          // pe ultima misiune: answer_incorrect, hint_requested și mission_unlocked pe „location” (vezi comentariul funcției).
          const isWarning = (m) =>
            (rule.on === "hint_requested" && (m.type === "location" || m === last))
            || (rule.on === "answer_incorrect" && m === last)
            || (rule.on === "mission_unlocked" && m === last && m.type === "location");
          const shown = premature.find((m) => !isWarning(m)) ?? premature[0];
          if (!isWarning(shown)) {
            return add("QA-F03", "error", path, `${name}: aventura se poate încheia înainte ca misiunea principală „${shown.id}” să fie închisă${last ? ` (ultima este „${last.id}”)` : ""}.`, subject);
          }
          return rule.on === "mission_unlocked"
            ? add("QA-F03", "warning", path, `${name}: deblocarea ultimei misiuni „${shown.id}” încheie aventura înainte ca ea să devină curentă; partida continuă normal doar dacă jucătorul ajunsese deja la locația ei.`, subject)
            : add("QA-F03", "warning", path, `${name}: un eveniment al misiunii principale „${shown.id}” încheie aventura cât timp ea este deschisă (rămâne nerezolvată dacă regula nu o închide).`, subject);
        }
        if (candidates.some((m) => m.track !== "main")) {
          return add("QA-F03", "warning", path, `${name}: complete_adventure legat de o misiune din afara traseului main; momentul nu se poate verifica static.`, subject);
        }
        return;
      }
      add("QA-F03", "warning", path, `${name}: complete_adventure legat de un eveniment de locație / secret / partener; momentul nu se poate verifica static.`, subject);
    });
  });
}

/* ---------- QA-F08 ---------- */

/**
 * Contractul narativ al finalului, așa cum îl folosește motorul (game.js, view-model.js):
 * - finale.missionId: singurul efect este finale_started, emis când misiunea devine curentă;
 *   pe altă misiune decât ultima main, „finalul” începe înaintea misiunilor de după ea;
 * - finale.messageId: epilogul de pe ecranul de rezultat (afișat la orice încheiere);
 * - start_finale: emite finale_started; fără finale, fără missionId și fără epilog.
 * Referințele invalide (misiune / mesaj inexistent, misiune non-main) sunt erori de schemă (QA-S01),
 * iar regulile QA-F rulează doar pe aventuri valide, deci nu se dublează. Încheierea prematură
 * rămâne la QA-F00 / QA-F03; regulile moarte (QA-F04) nu sunt raportate și aici.
 */
function checkFinale(content, { classification, dead, add }) {
  const { finale } = content;
  if (!finale) {
    if (classification === CLASSES.PUBLISHED_REAL) {
      add("QA-F08", "warning", "finale", "aventura publicată nu are finale: finale_started nu se emite la o misiune, iar ecranul de rezultat nu are epilog.", "finale");
    }
    content.events.forEach((rule, index) => {
      if (dead.has(index)) return;
      rule.do.forEach((action, a) => {
        if (action.action !== "start_finale") return;
        add("QA-F08", "warning", `events[${index}].do[${a}]`, `regula „${rule.id}” folosește start_finale, dar aventura nu are finale: finale_started se emite fără missionId, iar ecranul de rezultat nu are epilog.`, `events.${rule.id}.start_finale`);
      });
    });
    return;
  }
  const hasMission = finale.missionId !== undefined;
  const hasMessage = finale.messageId !== undefined;
  if (!hasMission && !hasMessage) {
    add("QA-F08", "warning", "finale", "finale nu are nici missionId, nici messageId: finale_started nu se emite la o misiune, iar ecranul de rezultat nu are epilog.", "finale");
    return;
  }
  if (!hasMission) add("QA-F08", "warning", "finale.missionId", "finale nu are missionId: finale_started nu se emite la pornirea unei misiuni (doar prin start_finale).", "finale.missionId");
  if (!hasMessage) add("QA-F08", "warning", "finale.messageId", "finale nu are messageId: ecranul de rezultat nu afișează niciun epilog.", "finale.messageId");
  const main = content.missions.filter((m) => m.track === "main");
  const last = main[main.length - 1];
  if (hasMission && last && finale.missionId !== last.id) {
    add("QA-F08", "warning", "finale.missionId", `finale.missionId „${finale.missionId}” nu este ultima misiune principală („${last.id}”): finale_started se emite când ea devine curentă, înaintea misiunilor principale de după ea.`, "finale.missionId");
  }
}

/* ---------- QA-F01 – QA-F05, QA-F08 (statice) ---------- */

/**
 * content — aventura normalizată; data — JSON-ul din fișier (QA-F01 citește câmpurile așa cum sunt scrise);
 * listKey — „missions” (V2) sau „challenges” (V1); classification — clasa fișierului (classify.mjs, pentru QA-F08).
 * Întoarce findings { ruleId, level, path, message, subject }.
 */
export function checkFlow(content, data, { listKey = "missions", classification } = {}) {
  const findings = [];
  const add = (ruleId, level, path, message, subject) => findings.push({ ruleId, level, path, message, subject });

  // QA-F01 — doar câmpurile candidate; celelalte câmpuri necunoscute rămân permise (D-038).
  const rawMissions = Array.isArray(data[listKey]) ? data[listKey] : [];
  rawMissions.forEach((mission, index) => {
    if (mission === null || typeof mission !== "object") return;
    for (const key of IGNORED_MISSION_FLOW_FIELDS) {
      if (!has(mission, key)) continue;
      const why = PROPOSED_GRAPH_FIELDS.includes(key)
        ? "este PROPUS pentru settings.progression „graph” (D-062) și nu are efect în „linear”"
        : "nu este citit de schemă sau de motor (progresia este ordinea misiunilor main; deblocarea se face prin initialStatus și reguli unlock_mission)";
      add("QA-F01", "warning", `${listKey}[${index}].${key}`, `misiunea „${mission.id}”: câmpul ${key} ${why}; este ignorat.`, `missions.${mission.id}.${key}`);
    }
  });
  for (const [key, hint] of Object.entries(IGNORED_TOP_LEVEL_FLOW_FIELDS)) {
    if (has(data, key)) add("QA-F01", "warning", key, `câmpul de nivel superior ${key} nu este citit de schemă sau de motor (${hint}); este ignorat.`, key);
  }

  // QA-F02 — misiunea deschisă de la început nu este curentă și nu apare în interfață.
  if (content.settings.progression === "linear") {
    let mainIndex = 0;
    content.missions.forEach((mission, index) => {
      if (mission.track !== "main") return;
      if (mainIndex++ > 0 && mission.initialStatus === ChallengeStatus.PENDING) {
        add("QA-F02", "warning", `${listKey}[${index}].initialStatus`, `misiunea principală „${mission.id}” nu este prima, dar începe „pending”: e deschisă înainte să devină curentă (invizibilă în interfață; o misiune „location” se poate rezolva înainte de vreme).`, `missions.${mission.id}.initialStatus`);
      }
    });
  }

  const dead = deadRules(content);
  // QA-F04
  for (const [index, { path, message }] of dead) add("QA-F04", "error", path, message, `events.${content.events[index].id}`);
  // QA-F03
  checkCompleteAdventure(content, dead, add);

  // QA-F05 — doar cazurile evident moarte: nicio acțiune într-o regulă care poate rula.
  const produced = (action, key) => new Set(content.events.flatMap((rule, index) =>
    dead.has(index) ? [] : rule.do.filter((a) => a.action === action).map((a) => a[key])));
  const unlockable = produced("unlock_mission", "missionId");
  const collectable = produced("collect_item", "itemId");
  const discoverable = produced("discover_secret", "secretId");
  content.missions.forEach((mission, index) => {
    if (mission.track === "main" || mission.initialStatus !== MissionStatus.LOCKED || unlockable.has(mission.id)) return;
    add("QA-F05", "warning", `${listKey}[${index}]`, `misiunea „${mission.id}” (traseul ${mission.track}) începe „locked” și nicio acțiune unlock_mission (într-o regulă care poate rula) nu o deblochează: rămâne inaccesibilă, iar punctele ei intră în scorul maxim.`, `missions.${mission.id}`);
  });
  content.items.forEach((item, index) => {
    if (collectable.has(item.id)) return;
    add("QA-F05", "warning", `items[${index}]`, `obiectul „${item.id}” nu se poate obține: nicio acțiune collect_item (într-o regulă care poate rula) nu îl dă.`, `items.${item.id}`);
  });
  content.secrets.forEach((secret, index) => {
    if (discoverable.has(secret.id)) return;
    add("QA-F05", "warning", `secrets[${index}]`, `secretul „${secret.id}” nu se poate descoperi: nicio acțiune discover_secret (într-o regulă care poate rula) nu îl produce.`, `secrets.${secret.id}`);
  });

  // QA-F08
  checkFinale(content, { classification, dead, add });
  return findings;
}

/* ---------- QA-F00 (simulare, asincron) ---------- */

export const FLOW_PATHS = Object.freeze(["solve", "skip", "wrong-then-solve"]);
const WRONG_INPUTS = Object.freeze(["__qa-raspuns-gresit__", "__qa-raspuns-gresit-2__"]);

const isAnswerMission = (mission) => ANSWER_MISSION_TYPES.includes(mission.type) && typeof mission.answer === "string";

/** Un răspuns sigur greșit: o variantă greșită (dacă există), altfel un text care nu se potrivește. */
function wrongInput(mission) {
  return [...(Array.isArray(mission.choices) ? mission.choices : []), ...WRONG_INPUTS]
    .find((input) => typeof input === "string" && !answersMatch(input, mission.answer));
}

/**
 * Parcurge traseul principal pe un traseu (solve | skip | wrong-then-solve), ca interfața:
 * misiunea curentă se închide (sosire, răspuns sau „Sari peste”), apoi game.next().
 * - „location”: confirmArrival (regula efectivă a motorului); dacă este refuzată → skipMission;
 * - cu răspuns: solve → răspunsul declarat; skip → skipMission; wrong-then-solve → un răspuns greșit,
 *   un indiciu (dacă există), apoi răspunsul declarat (o regulă poate închide misiunea între timp).
 * Întoarce { game, visited, problems }. `engine` permite testelor să înlocuiască createGame.
 */
export async function playFlowPath(content, path, { engine = createGame } = {}) {
  let clock = 0;
  const game = engine({ adventure: withoutAnswers(content), validator: createLocalValidator(content), now: () => (clock += 1000) });
  const main = content.missions.filter((m) => m.track === "main");
  const byId = new Map(content.missions.map((m) => [m.id, m]));
  const visited = new Set();
  const problems = [];
  const isPending = (id) => game.getState().missions[id]?.status === ChallengeStatus.PENDING;
  let step = "start()";
  let missionId = null;

  try {
    game.start();
    for (let guard = 0; game.getState().status === GameStatus.PLAYING; guard++) {
      // Fiecare pas închide misiunea curentă și avansează (next) sau încheie aventura.
      if (guard > main.length) break;
      missionId = game.getState().currentMissionId;
      visited.add(missionId);
      const mission = byId.get(missionId);
      if (isPending(missionId)) {
        if (mission.type === "location") {
          if (path !== "skip") {
            step = "confirmArrival()";
            game.confirmArrival(mission.locationId);
          }
        } else if (isAnswerMission(mission) && path !== "skip") {
          if (path === "wrong-then-solve") {
            step = "submitAnswer(greșit)";
            await game.submitAnswer(wrongInput(mission));
            if (isPending(missionId) && mission.hints.length > 0) {
              step = "requestHint()";
              game.requestHint(missionId);
            }
          }
          if (isPending(missionId)) {
            step = "submitAnswer()";
            const { result } = await game.submitAnswer(mission.answer);
            if (result !== "correct" && isPending(missionId)) problems.push({ kind: "answer-rejected", missionId });
          }
        }
        if (game.getState().status === GameStatus.PLAYING && isPending(missionId)) {
          step = "skipMission()";
          game.skipMission(missionId);
        }
      }
      if (game.getState().status !== GameStatus.PLAYING) break;
      if (game.getState().missions[missionId]?.status === MissionStatus.LOCKED || isPending(missionId)) {
        problems.push({ kind: "open", missionId });
        break;
      }
      step = "next()";
      game.next();
    }
  } catch (error) {
    problems.push({ kind: "exception", step, missionId, error });
  }

  const final = game.getState().status;
  // O excepție sau o misiune rămasă deschisă explică deja de ce traseul nu s-a încheiat.
  if (final !== GameStatus.COMPLETED && problems.every((p) => p.kind === "answer-rejected")) problems.push({ kind: "not-completed", status: final });
  if (final === GameStatus.COMPLETED) {
    for (const mission of main) if (!visited.has(mission.id)) problems.push({ kind: "never-current", missionId: mission.id });
  }
  return { game, visited, problems };
}

/** Textul unei excepții, citat o singură dată (mascat integral pentru aventurile private). */
const quoteError = (error) => `„${String(error?.message ?? error).replace(/[„”]/g, "\"")}”`;

/**
 * QA-F00: cele trei trasee; aceeași problemă pe mai multe trasee este raportată o singură dată.
 * content — aventura normalizată (cu răspunsuri: validatorul local le citește prin answers.js).
 */
export async function simulateFlow(content, { listKey = "missions", engine } = {}) {
  const grouped = new Map();
  for (const path of FLOW_PATHS) {
    const { problems } = await playFlowPath(content, path, { engine });
    for (const problem of problems) {
      const key = `${problem.kind}|${problem.missionId ?? ""}|${problem.step ?? ""}`;
      if (!grouped.has(key)) grouped.set(key, { problem, paths: [] });
      grouped.get(key).paths.push(path);
    }
  }
  const indexOf = (id) => content.missions.findIndex((m) => m.id === id);
  const findings = [];
  for (const { problem, paths } of grouped.values()) {
    const where = problem.missionId != null && indexOf(problem.missionId) >= 0 ? `${listKey}[${indexOf(problem.missionId)}]` : null;
    const on = `(trasee: ${paths.join(", ")})`;
    const mission = problem.missionId != null ? `„${problem.missionId}”` : "—";
    const message = {
      exception: () => `motorul a aruncat o excepție la ${problem.step} (misiunea curentă ${mission}): ${quoteError(problem.error)} ${on}.`,
      "not-completed": () => `traseul principal nu ajunge la „completed” (stare finală: „${problem.status}”) ${on}.`,
      "never-current": () => `misiunea principală ${mission} nu devine niciodată curentă: aventura se încheie înainte ${on}.`,
      open: () => `misiunea curentă ${mission} rămâne deschisă: nici sosirea / răspunsul, nici „Sari peste” nu o închid ${on}.`,
      "answer-rejected": () => `răspunsul declarat al misiunii ${mission} nu este acceptat de validator (answers.js); misiunea se poate doar sări ${on}.`,
    }[problem.kind]();
    findings.push({ ruleId: "QA-F00", level: "error", path: where, message, subject: `flow.${problem.kind}.${problem.missionId ?? ""}` });
  }
  return findings;
}
