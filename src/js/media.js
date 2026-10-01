/*
 * Outdoor Escape — registrul media (Challenge System V1, D-072).
 *
 * Modul PUR (fără DOM, fără rețea): vocabularul închis al media, normalizarea
 * registrului și rezolvarea blocurilor media ale unei misiuni pentru interfață.
 *
 *   conținut brut  →  normalizeMediaRegistry()  →  media.assets unificat (toAdventureV2)
 *                  →  resolveMissionMedia()      →  blocuri gata de desenat (view-model.js)
 *
 * - `media.assets[id]` este singurul registru citit de motor și de interfață.
 *   Formatul vechi `audio.tracks` este convertit aici în asset-uri `type: "audio"`
 *   (o singură cale pentru audio).
 * - Un asset nu știe în ce aventură, misiune sau mod de joc este folosit. `role`
 *   (ex. „archival”) este doar descriptiv: decide ce metadate se afișează, nu comportamentul.
 * - URL-ul unui asset se obține printr-un singur punct (resolveMediaUrl), ca un pachet
 *   offline ulterior (D-056) să-l poată înlocui fără schimbări în restul codului.
 * - Media nu conține răspunsuri (D-021).
 */

/** Tipurile de asset implementate. */
export const MEDIA_ASSET_TYPES = Object.freeze(["image", "audio"]);
/** Tipuri de asset rezervate (FUTURE): respinse de validator până la implementare. */
export const RESERVED_MEDIA_ASSET_TYPES = Object.freeze(["video", "model3d", "ar"]);

/** Blocurile media pe care le poate afișa o misiune. */
export const MEDIA_BLOCK_TYPES = Object.freeze(["image", "compare", "audio"]);
/** Blocuri rezervate (FUTURE): respinse de validator până la implementare. */
export const RESERVED_MEDIA_BLOCK_TYPES = Object.freeze(["video", "model3d", "ar"]);

export const COMPARE_MODES = Object.freeze(["slider", "toggle"]);
export const TRANSCRIPT_DISPLAY = Object.freeze(["collapsed", "expanded"]);
/** Rolul descriptiv al unei imagini (nu schimbă comportamentul jocului). */
export const IMAGE_ROLES = Object.freeze(["photo", "archival", "map", "document", "illustration"]);
/** Tipul unui sunet (aceeași listă ca formatul vechi audio.tracks). */
export const AUDIO_KINDS = Object.freeze(["voice", "sfx", "music"]);
/** Tastatura cerută pentru un răspuns tastat (doar indiciu pentru telefon, nu regulă de validare). */
export const INPUT_MODES = Object.freeze(["text", "numeric"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/** Calea unui asset, relativă la fișierul aventurii: basePath + src. */
export function joinMediaPath(basePath, src) {
  if (typeof src !== "string") return "";
  if (typeof basePath !== "string" || basePath === "") return src;
  return basePath.endsWith("/") ? basePath + src : `${basePath}/${src}`;
}

/**
 * Registrul unificat: media.assets (cu media.basePath) + audio.tracks (cu audio.basePath),
 * fiecare asset cu `id` și `path`. Idempotent: un asset care are deja `path` nu este recalculat,
 * iar un id deja prezent nu este suprascris (validarea interzice id-urile duplicate).
 */
export function normalizeMediaRegistry(source = {}) {
  const assets = {};
  const media = isObject(source.media) ? source.media : {};
  for (const [id, asset] of Object.entries(isObject(media.assets) ? media.assets : {})) {
    if (!isObject(asset)) continue;
    assets[id] = { ...asset, id, path: asset.path ?? joinMediaPath(media.basePath, asset.src) };
  }
  // Formatul vechi: audio.tracks devine asset „audio”. Câmpurile lui (src, kind,
  // transcriptMessage) au același sens în registrul unificat.
  const audio = isObject(source.audio) ? source.audio : {};
  for (const [id, track] of Object.entries(isObject(audio.tracks) ? audio.tracks : {})) {
    if (!isObject(track) || assets[id]) continue;
    assets[id] = { ...track, type: "audio", id, path: joinMediaPath(audio.basePath, track.src), legacy: "audio.tracks" };
  }
  return { basePath: media.basePath, assets };
}

/**
 * URL-ul unui asset: calea este relativă la fișierul aventurii (D-035, căi relative).
 * Fără `baseUrl` (ex. teste), întoarce calea relativă.
 */
export function resolveMediaUrl(path, baseUrl) {
  if (!baseUrl) return path;
  return new URL(path, baseUrl).href;
}

const textOrNull = (value) => (typeof value === "string" && value.trim() !== "" ? value : null);

function imageView(asset, overrides, baseUrl) {
  return {
    assetId: asset.id,
    url: resolveMediaUrl(asset.path, baseUrl),
    alt: textOrNull(overrides.alt) ?? textOrNull(asset.alt) ?? "",
    caption: textOrNull(overrides.caption) ?? textOrNull(asset.caption),
    credit: textOrNull(overrides.credit) ?? textOrNull(asset.credit) ?? textOrNull(asset.provenance?.credit),
    role: asset.role ?? null,
    width: Number.isFinite(asset.width) ? asset.width : null,
    height: Number.isFinite(asset.height) ? asset.height : null,
  };
}

/** Transcriptul unui sunet: textul propriu (`transcript`) sau mesajul indicat (`transcriptMessage`). */
function transcriptOf(asset, messages) {
  return textOrNull(asset.transcript) ?? textOrNull(messages?.[asset.transcriptMessage]?.text);
}

/**
 * Blocurile media ale unei misiuni, rezolvate pentru interfață: URL-uri, texte alternative,
 * transcript și informația de rezervă (`fallbackText`). Blocurile care trimit la asset-uri
 * inexistente sau nepotrivite sunt ignorate (conținutul este validat înainte).
 *
 *   content  — aventura normalizată (toAdventureV2), fără răspunsuri
 *   blocks   — mission.media
 *   baseUrl  — URL-ul fișierului aventurii (opțional)
 */
export function resolveMissionMedia(content, blocks, { baseUrl } = {}) {
  const assets = content?.media?.assets || {};
  const messages = content?.narrator?.messages || {};
  const asset = (id, type) => (assets[id] && assets[id].type === type ? assets[id] : null);
  const resolved = [];
  (Array.isArray(blocks) ? blocks : []).forEach((block, index) => {
    if (!isObject(block)) return;
    const key = `media-${index}`;
    if (block.type === "image") {
      const image = asset(block.asset, "image");
      if (!image) return;
      const view = imageView(image, block, baseUrl);
      resolved.push({ key, type: "image", label: textOrNull(block.label), image: view, fallbackText: view.alt, viewable: true });
    } else if (block.type === "compare") {
      const before = asset(block.before, "image");
      const after = asset(block.after, "image");
      if (!before || !after) return;
      const beforeView = imageView(before, {}, baseUrl);
      const afterView = imageView(after, {}, baseUrl);
      resolved.push({
        key,
        type: "compare",
        mode: COMPARE_MODES.includes(block.mode) ? block.mode : "slider",
        labels: { before: textOrNull(block.labels?.before), after: textOrNull(block.labels?.after) },
        caption: textOrNull(block.caption),
        before: beforeView,
        after: afterView,
        fallbackText: [beforeView.alt, afterView.alt].filter(Boolean).join("\n"),
        viewable: true,
      });
    } else if (block.type === "audio") {
      const sound = asset(block.asset, "audio");
      if (!sound) return;
      const transcript = transcriptOf(sound, messages);
      resolved.push({
        key,
        type: "audio",
        audio: {
          assetId: sound.id,
          url: resolveMediaUrl(sound.path, baseUrl),
          title: textOrNull(block.title) ?? textOrNull(sound.title),
          kind: sound.kind ?? null,
        },
        transcript,
        showTranscript: block.showTranscript === "expanded" ? "expanded" : "collapsed",
        fallbackText: transcript,
        viewable: false,
      });
    }
  });
  return resolved;
}

/** Lista tuturor fișierelor media ale unei aventuri (căi relative, fără duplicate) — baza unui pachet offline ulterior. */
export function listMediaPaths(content) {
  const paths = Object.values(content?.media?.assets || {}).map((asset) => asset.path).filter(Boolean);
  return [...new Set(paths)];
}
