/*
 * Outdoor Escape — desenarea blocurilor media (Challenge System V1, D-072, D-073).
 *
 * Primește blocurile deja rezolvate de media.js (prin view-model.js / play-ui.js) și
 * construiește elementele DOM: imagine, comparație (slider / comutare), player audio cu
 * transcript și rezervă, conținutul viewer-ului pe tot ecranul. Este GENERIC: nu știe ce
 * reprezintă imaginile (fotografie, arhivă, hartă, document), din ce aventură vin sau în ce
 * mod de joc se joacă aventura. Nu apelează motorul și nu păstrează stare de joc.
 *
 * Textele din conținut intră doar prin textContent / atribute (fără innerHTML).
 * Funcțiile pure de la început sunt testate în Node; restul cere un DOM.
 */

/** Textele interfeței media (nu sunt conținut de aventură). */
export const MEDIA_TEXTS = Object.freeze({
  open: "Mărește",
  imageUnavailable: "Imaginea nu s-a putut încărca.",
  retry: "Reîncearcă",
  compareGroup: "Comparație între două imagini",
  compareSlider: "Cât din prima imagine se vede",
  compareDefaultBefore: "Imaginea A",
  compareDefaultAfter: "Imaginea B",
  play: "▶ Ascultă",
  pause: "⏸ Pauză",
  transcript: "Transcript",
  audioUnavailable: "Sunetul nu s-a putut încărca.",
  audioUnavailableWithText: "Sunetul nu s-a putut încărca. Textul este mai jos.",
  zoomIn: "Mărește imaginea",
  zoomOut: "Potrivește pe ecran",
  viewerFallbackTitle: "Imagine",
});

/** Starea player-ului audio, pentru textul de stare. */
export const AudioState = Object.freeze({
  IDLE: "idle",
  LOADING: "loading",
  PLAYING: "playing",
  PAUSED: "paused",
  ENDED: "ended",
  ERROR: "error",
});

const AUDIO_STATUS = Object.freeze({
  idle: "",
  loading: "Se încarcă…",
  playing: "Se redă",
  paused: "Pauză",
  ended: "Gata",
  error: "",
});

/** „m:ss” pentru un număr de secunde; „--:--” dacă durata nu este cunoscută. */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "--:--";
  const total = Math.floor(seconds);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** Textul de stare al player-ului. */
export function audioStatusText(state) {
  return AUDIO_STATUS[state] ?? "";
}

/** Decuparea primei imagini într-o comparație „slider”: procentul (0–100) vizibil din stânga. */
export function compareClip(value) {
  const percent = Math.min(100, Math.max(0, Number(value)));
  return `inset(0 ${100 - (Number.isFinite(percent) ? percent : 50)}% 0 0)`;
}

/** Etichetele unei comparații: din conținut sau implicite (neutre — nu presupun „trecut / prezent”). */
export function compareLabels(block) {
  return {
    before: block?.labels?.before || MEDIA_TEXTS.compareDefaultBefore,
    after: block?.labels?.after || MEDIA_TEXTS.compareDefaultAfter,
  };
}

/**
 * Semnătura unei liste de blocuri: dacă nu s-a schimbat, elementele existente se păstrează
 * (un sunet care se redă nu se oprește și slider-ul nu revine la mijloc la fiecare desenare).
 */
export function mediaSignature(scope, blocks) {
  const parts = (blocks || []).map((block) => {
    if (block.type === "image") return `image:${block.key}:${block.image.url}`;
    if (block.type === "compare") return `compare:${block.key}:${block.mode}:${block.before.url}:${block.after.url}`;
    if (block.type === "audio") return `audio:${block.key}:${block.audio.url}`;
    return `${block.type}:${block.key}`;
  });
  return `${scope || ""}|${parts.join("|")}`;
}

/* ---------- DOM ---------- */

function el(doc, tag, className, text) {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
}

function button(doc, className, text) {
  const node = el(doc, "button", `button ${className}`, text);
  node.type = "button";
  return node;
}

/** Oprește toate sunetele dintr-un element (înainte de a-l goli sau ascunde). */
export function pauseMedia(root) {
  if (!root) return;
  for (const audio of root.querySelectorAll("audio")) audio.pause();
}

/** Textul de sub o imagine: eticheta, legenda și creditul. */
function caption(doc, { label, caption: text, credit }) {
  if (!label && !text && !credit) return null;
  const figcaption = el(doc, "figcaption", "media-caption");
  if (label) figcaption.append(el(doc, "strong", "media-label", label));
  if (text) figcaption.append(el(doc, "span", "media-caption-text", text));
  if (credit) figcaption.append(el(doc, "small", "media-credit", credit));
  return figcaption;
}

/** O imagine care, dacă nu se încarcă, este înlocuită de textul ei alternativ + „Reîncearcă”. */
function imageWithFallback(doc, image, { className = "media-image", onError } = {}) {
  const img = el(doc, "img", className);
  img.alt = image.alt || "";
  img.decoding = "async";
  img.loading = "lazy";
  if (image.width && image.height) {
    img.width = image.width;
    img.height = image.height;
  }
  img.src = image.url;
  if (onError) img.addEventListener("error", onError);
  return img;
}

function fallbackBox(doc, message, text, onRetry) {
  const box = el(doc, "div", "media-fallback");
  box.setAttribute("role", "status");
  box.append(el(doc, "p", "media-fallback-message", message));
  if (text) box.append(el(doc, "p", "media-fallback-text text-block", text));
  const retry = button(doc, "button-secondary media-retry", MEDIA_TEXTS.retry);
  retry.addEventListener("click", onRetry);
  box.append(retry);
  box.hidden = true;
  return box;
}

function renderImage(doc, block, { onOpen }) {
  const figure = el(doc, "figure", "media media-image-block");
  figure.dataset.key = block.key;
  const open = button(doc, "media-open", null);
  open.setAttribute("aria-label", `${MEDIA_TEXTS.open}: ${block.image.alt || block.label || ""}`.trim());
  const fallback = fallbackBox(doc, MEDIA_TEXTS.imageUnavailable, block.fallbackText, () => {
    fallback.hidden = true;
    open.hidden = false;
    img.src = block.image.url; // o nouă cerere pentru aceeași adresă
  });
  const img = imageWithFallback(doc, block.image, {
    onError: () => {
      open.hidden = true;
      fallback.hidden = false;
    },
  });
  open.append(img);
  if (onOpen) open.addEventListener("click", () => onOpen(block.key, open));
  else open.disabled = true;
  figure.append(open, fallback);
  const text = caption(doc, { label: block.label, caption: block.image.caption, credit: block.image.credit });
  if (text) figure.append(text);
  return figure;
}

/**
 * Comparația a două imagini. „slider”: a doua imagine dedesubt, prima deasupra, decupată după
 * un control de tip range (atingerea nu se luptă cu derularea paginii). „toggle”: două butoane.
 */
export function renderCompare(doc, block, { onOpen = null, large = false } = {}) {
  const figure = el(doc, "figure", `media media-compare${large ? " media-compare-large" : ""}`);
  figure.dataset.key = block.key;
  figure.dataset.mode = block.mode;
  figure.setAttribute("role", "group");
  figure.setAttribute("aria-label", MEDIA_TEXTS.compareGroup);
  const labels = compareLabels(block);

  const stage = el(doc, "div", "media-compare-stage");
  const failed = new Set();
  const fallback = fallbackBox(doc, MEDIA_TEXTS.imageUnavailable, block.fallbackText, () => {
    failed.clear();
    fallback.hidden = true;
    stage.hidden = false;
    before.src = block.before.url;
    after.src = block.after.url;
  });
  const onError = (which) => () => {
    failed.add(which);
    stage.hidden = true;
    fallback.hidden = false;
  };
  const after = imageWithFallback(doc, block.after, { className: "media-compare-after", onError: onError("after") });
  const before = imageWithFallback(doc, block.before, { className: "media-compare-before", onError: onError("before") });
  stage.append(after, before);
  const tagBefore = el(doc, "span", "media-compare-tag media-compare-tag-before", labels.before);
  const tagAfter = el(doc, "span", "media-compare-tag media-compare-tag-after", labels.after);
  stage.append(tagBefore, tagAfter);
  figure.append(stage, fallback);

  const controls = el(doc, "div", "media-compare-controls");
  if (block.mode === "toggle") {
    stage.dataset.show = "before";
    const choose = (side) => {
      stage.dataset.show = side;
      showBefore.setAttribute("aria-pressed", String(side === "before"));
      showAfter.setAttribute("aria-pressed", String(side === "after"));
    };
    const showBefore = button(doc, "button-secondary media-toggle", labels.before);
    const showAfter = button(doc, "button-secondary media-toggle", labels.after);
    showBefore.addEventListener("click", () => choose("before"));
    showAfter.addEventListener("click", () => choose("after"));
    controls.append(showBefore, showAfter);
    choose("before");
  } else {
    const range = el(doc, "input", "media-compare-range");
    range.type = "range";
    range.min = "0";
    range.max = "100";
    range.step = "1";
    range.value = "50";
    range.setAttribute("aria-label", `${MEDIA_TEXTS.compareSlider}: ${labels.before} / ${labels.after}`);
    const apply = () => {
      before.style.clipPath = compareClip(range.value);
      range.setAttribute("aria-valuetext", `${range.value}% ${labels.before}`);
    };
    range.addEventListener("input", apply);
    apply();
    controls.append(range);
  }
  if (onOpen) {
    const open = button(doc, "button-secondary media-open-compare", MEDIA_TEXTS.open);
    open.addEventListener("click", () => onOpen(block.key, open));
    controls.append(open);
  }
  figure.append(controls);
  const text = caption(doc, { caption: block.caption });
  if (text) figure.append(text);
  return figure;
}

/** Player audio: Ascultă / Pauză, starea încărcării, progresul, transcript, rezervă + „Reîncearcă”. */
function renderAudio(doc, block) {
  const box = el(doc, "div", "media media-audio");
  box.dataset.key = block.key;
  if (block.audio.title) box.append(el(doc, "p", "media-audio-title", block.audio.title));

  const audio = el(doc, "audio");
  audio.preload = "none"; // nimic nu se descarcă până la „Ascultă”
  audio.src = block.audio.url;

  const row = el(doc, "div", "media-audio-controls");
  const toggle = button(doc, "button-secondary media-audio-toggle", MEDIA_TEXTS.play);
  const status = el(doc, "span", "media-audio-status");
  status.setAttribute("role", "status");
  const progress = el(doc, "progress", "media-audio-progress");
  progress.max = 1;
  progress.value = 0;
  const time = el(doc, "span", "media-audio-time", `${formatTime(0)} / ${formatTime(NaN)}`);
  row.append(toggle, progress, time, status);

  let transcript = null;
  if (block.transcript) {
    transcript = el(doc, "details", "media-transcript");
    transcript.open = block.showTranscript === "expanded";
    transcript.append(el(doc, "summary", null, MEDIA_TEXTS.transcript), el(doc, "p", "text-block", block.transcript));
  }

  const fallback = el(doc, "div", "media-fallback");
  fallback.setAttribute("role", "status");
  fallback.append(el(doc, "p", "media-fallback-message", block.transcript ? MEDIA_TEXTS.audioUnavailableWithText : MEDIA_TEXTS.audioUnavailable));
  const retry = button(doc, "button-secondary media-retry", MEDIA_TEXTS.retry);
  fallback.append(retry);
  fallback.hidden = true;

  const setState = (state) => {
    box.dataset.state = state;
    status.textContent = audioStatusText(state);
    toggle.textContent = state === AudioState.PLAYING || state === AudioState.LOADING ? MEDIA_TEXTS.pause : MEDIA_TEXTS.play;
    toggle.setAttribute("aria-pressed", String(state === AudioState.PLAYING || state === AudioState.LOADING));
    const failed = state === AudioState.ERROR;
    fallback.hidden = !failed;
    row.hidden = failed;
    if (failed && transcript) transcript.open = true; // transcriptul devine calea principală
  };
  const fail = () => setState(AudioState.ERROR);
  const play = () => {
    // Un singur sunet odată, în toată pagina.
    for (const other of doc.querySelectorAll("audio")) if (other !== audio) other.pause();
    setState(AudioState.LOADING);
    const attempt = audio.play();
    if (attempt && typeof attempt.catch === "function") {
      attempt.catch(() => {
        if (audio.error) fail();
        else setState(AudioState.PAUSED); // ex. redarea a fost întreruptă de o pauză
      });
    }
  };

  toggle.addEventListener("click", () => (audio.paused ? play() : audio.pause()));
  retry.addEventListener("click", () => {
    audio.load(); // o nouă încercare de încărcare
    play();
  });
  audio.addEventListener("waiting", () => setState(AudioState.LOADING));
  audio.addEventListener("playing", () => setState(AudioState.PLAYING));
  audio.addEventListener("pause", () => {
    if (box.dataset.state !== AudioState.ERROR && !audio.ended) setState(AudioState.PAUSED);
  });
  audio.addEventListener("ended", () => setState(AudioState.ENDED));
  audio.addEventListener("error", fail);
  const updateTime = () => {
    const duration = audio.duration;
    progress.max = Number.isFinite(duration) && duration > 0 ? duration : 1;
    progress.value = Number.isFinite(duration) && duration > 0 ? audio.currentTime : 0;
    time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(duration)}`;
  };
  audio.addEventListener("timeupdate", updateTime);
  audio.addEventListener("loadedmetadata", updateTime);
  audio.addEventListener("durationchange", updateTime);

  box.append(audio, row, fallback);
  if (transcript) box.append(transcript);
  setState(AudioState.IDLE);
  return box;
}

/**
 * Desenează lista de blocuri într-un container. Dacă semnătura nu s-a schimbat, nu face nimic
 * (elementele, inclusiv sunetul care se redă, rămân). `onOpen(key, opener)` deschide viewer-ul.
 */
export function renderMediaList(container, blocks, { scope = "", onOpen = null } = {}) {
  const doc = container.ownerDocument;
  const signature = mediaSignature(scope, blocks);
  container.hidden = !blocks || blocks.length === 0;
  if (container.dataset.signature === signature) return;
  pauseMedia(container);
  container.dataset.signature = signature;
  container.replaceChildren(...(blocks || []).map((block) => {
    if (block.type === "image") return renderImage(doc, block, { onOpen });
    if (block.type === "compare") return renderCompare(doc, block, { onOpen });
    if (block.type === "audio") return renderAudio(doc, block);
    return el(doc, "p", "media-fallback-text", block.fallbackText || "");
  }));
}

/** Titlul viewer-ului: eticheta, legenda sau un text neutru. */
export function viewerTitle(block) {
  if (!block) return "";
  if (block.type === "image") return block.label || block.image.caption || block.image.alt || MEDIA_TEXTS.viewerFallbackTitle;
  if (block.type === "compare") {
    const labels = compareLabels(block);
    return block.caption || `${labels.before} / ${labels.after}`;
  }
  return MEDIA_TEXTS.viewerFallbackTitle;
}

/**
 * Conținutul viewer-ului pe tot ecranul pentru un bloc vizual (imagine sau comparație).
 * Imaginea: potrivită pe ecran, cu „Mărește imaginea” (dimensiune dublă, derulabilă) și pinch-zoom nativ.
 */
export function renderViewerContent(body, block) {
  const doc = body.ownerDocument;
  if (!block) {
    body.replaceChildren();
    return;
  }
  if (block.type === "compare") {
    body.replaceChildren(renderCompare(doc, block, { large: true }));
    return;
  }
  const stage = el(doc, "div", "viewer-stage");
  stage.dataset.zoom = "fit";
  const fallback = fallbackBox(doc, MEDIA_TEXTS.imageUnavailable, block.fallbackText, () => {
    fallback.hidden = true;
    stage.hidden = false;
    img.src = block.image.url;
  });
  const img = imageWithFallback(doc, block.image, {
    className: "viewer-image",
    onError: () => {
      stage.hidden = true;
      fallback.hidden = false;
    },
  });
  img.loading = "eager";
  stage.append(img);
  const zoom = button(doc, "button-secondary viewer-zoom", MEDIA_TEXTS.zoomIn);
  zoom.setAttribute("aria-pressed", "false");
  zoom.addEventListener("click", () => {
    const zoomed = stage.dataset.zoom !== "in";
    stage.dataset.zoom = zoomed ? "in" : "fit";
    zoom.textContent = zoomed ? MEDIA_TEXTS.zoomOut : MEDIA_TEXTS.zoomIn;
    zoom.setAttribute("aria-pressed", String(zoomed));
  });
  const figure = el(doc, "figure", "media viewer-figure");
  figure.append(stage, fallback);
  const text = caption(doc, { label: null, caption: block.image.caption, credit: block.image.credit });
  if (text) figure.append(text);
  body.replaceChildren(zoom, figure);
}
