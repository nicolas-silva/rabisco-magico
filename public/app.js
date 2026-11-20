/* Rabisco Mágico — front-end.
 * Drawing engine: Pointer Events, strokes stored as data, quadratic-curve
 * smoothing, dot on tap, canvas at devicePixelRatio (max 3).
 * Gallery: last 8 works in localStorage. No child personal data is stored.
 */
"use strict";

const COLORS = ["#111111","#ff3b30","#ff9500","#ffcc00","#34c759","#00a86b","#1e90ff","#0a3d91","#8e5cd9","#ff5fa2","#8b5a2b","#9aa3ad"];

const I18N = {
  pt: {
    title: "Rabisco Mágico", hint: "Desenhe com o dedo! Depois toque em Transformar",
    transform: "✨ Transformar", clearWarn: "Toque de novo para apagar tudo",
    loading: "Fazendo mágica… Estou descobrindo o que você desenhou",
    download: "Baixar", share: "Compartilhar", drawAnother: "Desenhar outro",
    continue: "Continuar", galleryTitle: "Galeria",
    galleryEmpty: "Suas obras transformadas aparecem aqui.",
    empty: "Desenhe alguma coisa primeiro!", failed: "Ops, a mágica falhou. Tente de novo!",
  },
  en: {
    title: "Rabisco Mágico", hint: "Draw with your finger! Then tap Transform",
    transform: "✨ Transform", clearWarn: "Tap again to erase everything",
    loading: "Doing magic… I'm finding out what you drew",
    download: "Download", share: "Share", drawAnother: "Draw another",
    continue: "Keep drawing", galleryTitle: "Gallery",
    galleryEmpty: "Your transformed artworks will appear here.",
    empty: "Draw something first!", failed: "Oops, the magic failed. Try again!",
  },
  es: {
    title: "Rabisco Mágico", hint: "¡Dibuja con el dedo! Después toca Transformar",
    transform: "✨ Transformar", clearWarn: "Toca de nuevo para borrar todo",
    loading: "Haciendo magia… Estoy descubriendo lo que dibujaste",
    download: "Descargar", share: "Compartir", drawAnother: "Dibujar otro",
    continue: "Seguir dibujando", galleryTitle: "Galería",
    galleryEmpty: "Tus obras transformadas aparecerán aquí.",
    empty: "¡Dibuja algo primero!", failed: "¡Ups, la magia falló! Inténtalo de nuevo.",
  },
};

const $ = (id) => document.getElementById(id);
const canvas = $("board");
const ctx = canvas.getContext("2d");

// ---------------------------------------------------------------------------
// Language: device language first, then the picker, remembered on the device.
// ---------------------------------------------------------------------------
let lang = "pt";
function detectLanguage() {
  const saved = localStorage.getItem("rabisco-lang");
  if (saved && I18N[saved]) return saved;
  const nav = (navigator.language || "pt").toLowerCase();
  if (nav.startsWith("en")) return "en";
  if (nav.startsWith("es")) return "es";
  return "pt";
}
function applyLanguage() {
  document.documentElement.lang = lang === "pt" ? "pt-BR" : lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (I18N[lang][key]) el.textContent = I18N[lang][key];
  });
  $("lang-picker").value = lang;
}

// ---------------------------------------------------------------------------
// Drawing engine — strokes are data: { color, width, eraser, points: [[x,y]] }
// in CSS coordinates, so undo and resize never lose work.
// ---------------------------------------------------------------------------
let strokes = [];
let currentStroke = null;
let activePointerId = null; // one finger at a time
let color = "#111111";
let brushSize = 14;
let eraser = false;
let dpr = 1;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  dpr = Math.min(window.devicePixelRatio || 1, 3);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  redraw();
}

function redraw() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const s of strokes) drawStroke(s);
  if (currentStroke) drawStroke(currentStroke);
}

function drawStroke(s) {
  if (!s.points.length) return;
  ctx.strokeStyle = s.eraser ? "#ffffff" : s.color;
  ctx.lineWidth = s.eraser ? s.width * 1.6 : s.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  if (s.points.length === 1) {
    // A tap without dragging draws a dot.
    const [x, y] = s.points[0];
    ctx.arc(x, y, ctx.lineWidth / 2, 0, Math.PI * 2);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
    return;
  }
  ctx.moveTo(s.points[0][0], s.points[0][1]);
  for (let i = 1; i < s.points.length - 1; i++) {
    // Quadratic smoothing between midpoints.
    const mx = (s.points[i][0] + s.points[i + 1][0]) / 2;
    const my = (s.points[i][1] + s.points[i + 1][1]) / 2;
    ctx.quadraticCurveTo(s.points[i][0], s.points[i][1], mx, my);
  }
  const last = s.points[s.points.length - 1];
  ctx.lineTo(last[0], last[1]);
  ctx.stroke();
}

function pointFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  return [e.clientX - rect.left, e.clientY - rect.top];
}

canvas.addEventListener("pointerdown", (e) => {
  if (activePointerId !== null) return; // ignore a second finger mid-stroke
  activePointerId = e.pointerId;
  canvas.setPointerCapture(e.pointerId);
  currentStroke = { color, width: brushSize, eraser, points: [pointFromEvent(e)] };
  $("hint").hidden = true;
  redraw();
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerId !== activePointerId || !currentStroke) return;
  const pts = currentStroke.points;
  const p = pointFromEvent(e);
  const last = pts[pts.length - 1];
  // getCoalescedEvents when available: smoother strokes, less lag.
  const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  for (const ev of events) {
    const q = pointFromEvent(ev);
    if (q[0] !== last[0] || q[1] !== last[1]) pts.push(q);
  }
  void p;
  redraw();
});
function endStroke(e) {
  if (e.pointerId !== activePointerId || !currentStroke) return;
  strokes.push(currentStroke);
  currentStroke = null;
  activePointerId = null;
  redraw();
}
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);
canvas.addEventListener("touchmove", (e) => e.preventDefault(), { passive: false });

new ResizeObserver(resizeCanvas).observe(canvas);

// ---------------------------------------------------------------------------
// Palette, brushes, eraser, undo, clear-all (two taps within 2.5s).
// ---------------------------------------------------------------------------
const paletteEl = $("palette");
COLORS.forEach((c, i) => {
  const b = document.createElement("button");
  b.className = "swatch" + (i === 0 ? " active" : "");
  b.style.background = c;
  b.setAttribute("aria-label", c);
  b.addEventListener("click", () => {
    color = c; eraser = false;
    $("btn-eraser").classList.remove("active");
    paletteEl.querySelectorAll(".swatch").forEach((s) => s.classList.remove("active"));
    b.classList.add("active");
  });
  paletteEl.appendChild(b);
});

document.querySelectorAll("#brushes [data-size]").forEach((b) => {
  b.addEventListener("click", () => {
    brushSize = Number(b.getAttribute("data-size"));
    eraser = false;
    $("btn-eraser").classList.remove("active");
    document.querySelectorAll("#brushes [data-size]").forEach((x) => x.classList.remove("active"));
    b.classList.add("active");
  });
});
$("btn-eraser").addEventListener("click", () => {
  eraser = true;
  $("btn-eraser").classList.add("active");
});

$("btn-undo").addEventListener("click", () => {
  strokes.pop();
  if (!strokes.length) $("hint").hidden = false;
  redraw();
});

let clearArmedAt = 0;
$("btn-clear").addEventListener("click", () => {
  const now = Date.now();
  if (now - clearArmedAt < 2500) {
    strokes = [];
    $("hint").hidden = false;
    $("clear-warn").hidden = true;
    clearArmedAt = 0;
    redraw();
  } else {
    clearArmedAt = now;
    $("clear-warn").hidden = false;
    setTimeout(() => { $("clear-warn").hidden = true; }, 2500);
  }
});

// ---------------------------------------------------------------------------
// Screens
// ---------------------------------------------------------------------------
function show(id) {
  ["screen-draw", "screen-loading", "screen-result", "screen-gallery"].forEach((s) => {
    $(s).hidden = s !== id;
  });
}

// Export the drawing as a 512x512 PNG (white background, content centred).
function exportDrawing() {
  const out = document.createElement("canvas");
  out.width = 512; out.height = 512;
  const octx = out.getContext("2d");
  octx.fillStyle = "#ffffff";
  octx.fillRect(0, 0, 512, 512);
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(512 / rect.width, 512 / rect.height);
  const w = rect.width * scale, h = rect.height * scale;
  octx.drawImage(canvas, (512 - w) / 2, (512 - h) / 2, w, h);
  return out.toDataURL("image/png");
}

// ---------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------
let lastWork = null; // { titulo, frase, imageUrl, thumb }

$("btn-transform").addEventListener("click", async () => {
  if (!strokes.length) {
    alert(I18N[lang].empty);
    return;
  }
  const thumb = exportDrawing();
  show("screen-loading");
  $("result-error").hidden = true;
  try {
    const res = await fetch("/api/transform", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: thumb, language: lang }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || I18N[lang].failed);
    lastWork = { titulo: data.titulo, frase: data.frase, imageUrl: data.imageUrl, thumb };
    $("result-title").textContent = data.titulo;
    $("result-phrase").textContent = data.frase;
    $("result-image").src = data.imageUrl;
    $("result-thumb").src = thumb;
    saveToGallery(lastWork);
    show("screen-result");
  } catch (err) {
    $("result-error").textContent = err.message || I18N[lang].failed;
    $("result-error").hidden = false;
    show("screen-draw"); // drawing is kept, the child can retry
  }
});

// ---------------------------------------------------------------------------
// Download (1024x1024, original thumbnail inset) and Share (1080x1350 card).
// ---------------------------------------------------------------------------
function fileNameBase() {
  return (lastWork ? lastWork.titulo : "rabisco-magico")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "rabisco-magico";
}

async function loadImage(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  return img;
}

async function buildDownloadCanvas() {
  const img = await loadImage(lastWork.imageUrl);
  const thumbImg = await loadImage(lastWork.thumb);
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 1024;
  const x = c.getContext("2d");
  x.drawImage(img, 0, 0, 1024, 1024);
  // Original thumbnail, bottom-right: 280px, white frame, shadow, ~0.07 rad.
  x.save();
  x.translate(1024 - 150, 1024 - 150);
  x.rotate(0.07);
  x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 16;
  x.fillStyle = "#ffffff";
  x.fillRect(-154, -154, 308, 308);
  x.shadowColor = "transparent";
  x.drawImage(thumbImg, -140, -140, 280, 280);
  x.restore();
  return c;
}

$("btn-download").addEventListener("click", async () => {
  if (!lastWork) return;
  const c = await buildDownloadCanvas();
  const a = document.createElement("a");
  a.href = c.toDataURL("image/png");
  a.download = fileNameBase() + ".png";
  a.click();
});

$("btn-share").addEventListener("click", async () => {
  if (!lastWork) return;
  const img = await loadImage(lastWork.imageUrl);
  const thumbImg = await loadImage(lastWork.thumb);
  const c = document.createElement("canvas");
  c.width = 1080; c.height = 1350;
  const x = c.getContext("2d");
  x.fillStyle = "#2b9be0"; x.fillRect(0, 0, 1080, 1350);
  x.fillStyle = "#ffffff"; x.font = "700 56px Fredoka, sans-serif"; x.textAlign = "center";
  x.fillText(lastWork.titulo, 540, 90);
  x.fillStyle = "#ffffff"; x.fillRect(90, 130, 900, 900);
  x.drawImage(img, 100, 140, 880, 880);
  x.save();
  x.translate(900, 940); x.rotate(0.07);
  x.shadowColor = "rgba(0,0,0,.35)"; x.shadowBlur = 12;
  x.fillStyle = "#ffffff"; x.fillRect(-90, -90, 180, 180);
  x.shadowColor = "transparent";
  x.drawImage(thumbImg, -80, -80, 160, 160);
  x.restore();
  x.fillStyle = "#ffffff"; x.font = "600 34px Fredoka, sans-serif";
  x.fillText(lastWork.frase, 540, 1100, 940);
  x.font = "600 28px Fredoka, sans-serif";
  x.fillText("Feito com Rabisco Mágico", 540, 1300);
  const blob = await new Promise((resolve) => c.toBlob(resolve, "image/png"));
  const file = new File([blob], fileNameBase() + "-para-amigos.png", { type: "image/png" });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    await navigator.share({ files: [file] });
  } else {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file.name;
    a.click();
  }
});

$("btn-again").addEventListener("click", () => {
  strokes = [];
  $("hint").hidden = false;
  redraw();
  show("screen-draw");
});
$("btn-continue").addEventListener("click", () => show("screen-draw"));

// ---------------------------------------------------------------------------
// Gallery — last 8 works, device only (localStorage).
// ---------------------------------------------------------------------------
function loadGallery() {
  try { return JSON.parse(localStorage.getItem("rabisco-obras") || "[]"); }
  catch { return []; }
}
function saveToGallery(work) {
  const items = loadGallery();
  items.unshift({ t: work.titulo, l: work.frase, imagemURL: work.imageUrl, thumb: work.thumb, d: Date.now() });
  try { localStorage.setItem("rabisco-obras", JSON.stringify(items.slice(0, 8))); } catch { /* storage full — keep newest only */ }
}
function renderGallery() {
  const items = loadGallery();
  const grid = $("gallery-grid");
  grid.innerHTML = "";
  $("gallery-empty").hidden = items.length > 0;
  for (const item of items) {
    const fig = document.createElement("figure");
    const img = document.createElement("img");
    img.src = item.imagemURL; img.alt = item.t;
    const cap = document.createElement("figcaption");
    cap.textContent = item.t;
    fig.append(img, cap);
    fig.addEventListener("click", () => {
      lastWork = { titulo: item.t, frase: item.l, imageUrl: item.imagemURL, thumb: item.thumb };
      $("result-title").textContent = item.t;
      $("result-phrase").textContent = item.l;
      $("result-image").src = item.imagemURL;
      $("result-thumb").src = item.thumb;
      show("screen-result");
    });
    grid.appendChild(fig);
  }
}
$("btn-gallery").addEventListener("click", () => { renderGallery(); show("screen-gallery"); });
$("btn-gallery-back").addEventListener("click", () => show("screen-draw"));

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
$("lang-picker").addEventListener("change", (e) => {
  lang = e.target.value;
  localStorage.setItem("rabisco-lang", lang);
  applyLanguage();
});
lang = detectLanguage();
applyLanguage();
resizeCanvas();
