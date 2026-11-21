/* Rabisco Mágico — front-end.
 * Drawing engine: Pointer Events, strokes stored as data, quadratic-curve
 * smoothing, dot on tap, canvas at devicePixelRatio (max 3).
 * Gallery: last 8 works in localStorage. No child personal data is stored.
 */
"use strict";

const COLORS = ["#111111","#ff3b30","#ff9500","#ffcc00","#34c759","#00a86b","#1e90ff","#0a3d91","#8e5cd9","#ff5fa2","#8b5a2b","#9aa3ad"];
// Human colour names for the swatch labels — a screen reader announcing
// "#ff3b30" tells a child nothing. (Portuguese names; the palette is
// visual first, and the names match the app's default language.)
const COLOR_NAMES = ["Preto","Vermelho","Laranja","Amarelo","Verde claro","Verde","Azul claro","Azul escuro","Roxo","Rosa","Marrom","Cinza"];

const I18N = {
  pt: {
    title: "Rabisco Mágico", hint: "Desenhe com o dedo! Depois toque em Transformar",
    transform: "✨ Transformar", clearWarn: "Toque de novo para apagar tudo",
    loading: "Fazendo mágica… Estou descobrindo o que você desenhou",
    download: "Baixar", share: "Compartilhar", drawAnother: "Desenhar outro",
    continue: "Continuar", galleryTitle: "Galeria",
    galleryEmpty: "Suas obras transformadas aparecem aqui.",
    gallerySearch: "Buscar pelo título…", galleryFavourites: "⭐ Favoritas",
    galleryFavouritesOnly: "⭐ Só favoritas",
    empty: "Desenhe alguma coisa primeiro!", failed: "Ops, a mágica falhou. Tente de novo!",
    parentsTitle: "Área dos pais", gateIntro: "Só para adultos: responda para continuar.",
    gateWrong: "Ops, tente outra pergunta!",
    parentIntro: "Entre com seu e-mail para gerenciar o plano e a galeria.",
    parentEmail: "E-mail", sendLink: "Enviar link de acesso",
    linkSent: "Enviamos um link para o seu e-mail. Toque nele para entrar.",
    tokenLabel: "Código do link (enquanto o e-mail não está ligado)",
    verifyToken: "Entrar com o código", signInFirst: "Informe um e-mail válido.",
    invalidToken: "Código inválido ou expirado. Peça outro link.",
    planFree: "Plano gratuito", planFamily: "Plano Família", planPack: "Pacote Mágico",
    freeLeft: "magias grátis restantes", packLeft: "magias do pacote restantes",
    familyLeft: "magias da Família restantes neste mês",
    buyFamilyMonthly: "Família — A$7,99/mês", buyFamilyYearly: "Família — A$54,99/ano",
    buyPack: "Pacote Mágico — A$4,99 (30 magias)",
    deleteGallery: "Apagar toda a galeria",
    deleteGalleryConfirm: "Toque de novo para apagar TODA a galeria. Não dá para desfazer.",
    deleteGalleryDone: "Galeria apagada.",
    deleteGalleryFailed: "Não consegui apagar a galeria. Tente de novo.",
    checkoutFailed: "Não consegui abrir o pagamento. Tente de novo.",
    installApp: "Instalar o app no celular", signOut: "Sair",
  },
  en: {
    title: "Rabisco Mágico", hint: "Draw with your finger! Then tap Transform",
    transform: "✨ Transform", clearWarn: "Tap again to erase everything",
    loading: "Doing magic… I'm finding out what you drew",
    download: "Download", share: "Share", drawAnother: "Draw another",
    continue: "Keep drawing", galleryTitle: "Gallery",
    galleryEmpty: "Your transformed artworks will appear here.",
    gallerySearch: "Search by title…", galleryFavourites: "⭐ Favourites",
    galleryFavouritesOnly: "⭐ Favourites only",
    empty: "Draw something first!", failed: "Oops, the magic failed. Try again!",
    parentsTitle: "Parents' area", gateIntro: "Adults only: answer to continue.",
    gateWrong: "Oops, try another question!",
    parentIntro: "Sign in with your email to manage the plan and gallery.",
    parentEmail: "Email", sendLink: "Send sign-in link",
    linkSent: "We sent a link to your email. Tap it to sign in.",
    tokenLabel: "Link code (while email sending is not wired yet)",
    verifyToken: "Sign in with the code", signInFirst: "Please enter a valid email.",
    invalidToken: "Invalid or expired code. Ask for a new link.",
    planFree: "Free plan", planFamily: "Family plan", planPack: "Magic Pack",
    freeLeft: "free magic turns left", packLeft: "pack magic turns left",
    familyLeft: "Family magic turns left this month",
    buyFamilyMonthly: "Family — A$7.99/month", buyFamilyYearly: "Family — A$54.99/year",
    buyPack: "Magic Pack — A$4.99 (30 turns)",
    deleteGallery: "Delete the whole gallery",
    deleteGalleryConfirm: "Tap again to delete the WHOLE gallery. This cannot be undone.",
    deleteGalleryDone: "Gallery deleted.",
    deleteGalleryFailed: "Could not delete the gallery. Try again.",
    checkoutFailed: "Could not open checkout. Try again.",
    installApp: "Install the app on your phone", signOut: "Sign out",
  },
  es: {
    title: "Rabisco Mágico", hint: "¡Dibuja con el dedo! Después toca Transformar",
    transform: "✨ Transformar", clearWarn: "Toca de nuevo para borrar todo",
    loading: "Haciendo magia… Estoy descubriendo lo que dibujaste",
    download: "Descargar", share: "Compartir", drawAnother: "Dibujar otro",
    continue: "Seguir dibujando", galleryTitle: "Galería",
    galleryEmpty: "Tus obras transformadas aparecerán aquí.",
    gallerySearch: "Buscar por título…", galleryFavourites: "⭐ Favoritas",
    galleryFavouritesOnly: "⭐ Solo favoritas",
    empty: "¡Dibuja algo primero!", failed: "¡Ups, la magia falló! Inténtalo de nuevo.",
    parentsTitle: "Área de padres", gateIntro: "Solo para adultos: responde para continuar.",
    gateWrong: "¡Ups, intenta otra pregunta!",
    parentIntro: "Inicia sesión con tu correo para gestionar el plan y la galería.",
    parentEmail: "Correo electrónico", sendLink: "Enviar enlace de acceso",
    linkSent: "Te enviamos un enlace a tu correo. Tócalo para entrar.",
    tokenLabel: "Código del enlace (mientras el correo no está conectado)",
    verifyToken: "Entrar con el código", signInFirst: "Escribe un correo válido.",
    invalidToken: "Código inválido o vencido. Pide otro enlace.",
    planFree: "Plan gratuito", planFamily: "Plan Familiar", planPack: "Paquete Mágico",
    freeLeft: "magias gratis restantes", packLeft: "magias del paquete restantes",
    familyLeft: "magias familiares restantes este mes",
    buyFamilyMonthly: "Familiar — A$7,99/mes", buyFamilyYearly: "Familiar — A$54,99/año",
    buyPack: "Paquete Mágico — A$4,99 (30 magias)",
    deleteGallery: "Borrar toda la galería",
    deleteGalleryConfirm: "Toca de nuevo para borrar TODA la galería. No se puede deshacer.",
    deleteGalleryDone: "Galería borrada.",
    deleteGalleryFailed: "No pude borrar la galería. Inténtalo de nuevo.",
    checkoutFailed: "No pude abrir el pago. Inténtalo de nuevo.",
    installApp: "Instalar la app en el teléfono", signOut: "Cerrar sesión",
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
  $("gallery-search").placeholder = I18N[lang].gallerySearch;
  updateFavouritesFilterLabel();
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
  b.setAttribute("aria-label", "Cor " + COLOR_NAMES[i]);
  b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
  b.addEventListener("click", () => {
    color = c; eraser = false;
    $("btn-eraser").classList.remove("active");
    $("btn-eraser").setAttribute("aria-pressed", "false");
    paletteEl.querySelectorAll(".swatch").forEach((s) => { s.classList.remove("active"); s.setAttribute("aria-pressed", "false"); });
    b.classList.add("active");
    b.setAttribute("aria-pressed", "true");
  });
  paletteEl.appendChild(b);
});

document.querySelectorAll("#brushes [data-size]").forEach((b) => {
  b.addEventListener("click", () => {
    brushSize = Number(b.getAttribute("data-size"));
    eraser = false;
    $("btn-eraser").classList.remove("active");
    document.querySelectorAll("#brushes [data-size]").forEach((x) => { x.classList.remove("active"); x.setAttribute("aria-pressed", "false"); });
    b.classList.add("active");
    b.setAttribute("aria-pressed", "true");
  });
});
$("btn-eraser").addEventListener("click", () => {
  eraser = true;
  $("btn-eraser").classList.add("active");
  $("btn-eraser").setAttribute("aria-pressed", "true");
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
  ["screen-draw", "screen-loading", "screen-result", "screen-gallery", "screen-gate", "screen-parents"].forEach((s) => {
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
  $("btn-transform").disabled = true;
  $("btn-transform").setAttribute("aria-busy", "true");
  const thumb = exportDrawing();
  show("screen-loading");
  $("result-error").hidden = true;
  try {
    const res = await fetch("/api/transform", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(parentSession() ? { "x-parent-session": parentSession() } : {}),
      },
      body: JSON.stringify({ image: thumb, language: lang, strokeCount: strokes.length }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || I18N[lang].failed);
    lastWork = { titulo: data.titulo, frase: data.frase, imageUrl: data.imageUrl, thumb, workId: data.workId || null };
    $("result-title").textContent = data.titulo;
    $("result-phrase").textContent = data.frase;
    $("result-image").src = data.imageUrl;
    $("result-image").alt = data.titulo;
    $("result-thumb").src = thumb;
    $("result-thumb").alt = data.titulo + " — desenho original";
    saveToGallery(lastWork);
    show("screen-result");
  } catch (err) {
    $("result-error").textContent = err.message || I18N[lang].failed;
    $("result-error").hidden = false;
    show("screen-draw"); // drawing is kept, the child can retry
  } finally {
    $("btn-transform").disabled = false;
    $("btn-transform").removeAttribute("aria-busy");
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
  // Prefer the server-side share card (1080x1350, same layout): it
  // fetches the generated image itself, so a cross-origin image
  // cannot taint the canvas. Fall back to the client canvas below.
  try {
    const res = await fetch("/api/share-card", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl: lastWork.imageUrl,
        thumb: lastWork.thumb,
        titulo: lastWork.titulo,
        frase: lastWork.frase,
        language: lang,
      }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const file = new File([blob], fileNameBase() + "-para-amigos.png", { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
      }
      return;
    }
  } catch (_e) { /* fall through to the client-side card */ }
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
// Gallery — last 8 works, device only (localStorage), with favourites
// (star toggle, favourites first) and search by title. When a work
// also exists server-side (workId + parent session), the star syncs
// to the server too (best effort — the local flag is the source of
// truth on the device).
// ---------------------------------------------------------------------------
let galleryFavouritesOnly = false;
function updateFavouritesFilterLabel() {
  const btn = $("btn-gallery-favourites");
  btn.textContent = galleryFavouritesOnly ? I18N[lang].galleryFavouritesOnly : I18N[lang].galleryFavourites;
  btn.classList.toggle("active", galleryFavouritesOnly);
  btn.setAttribute("aria-pressed", String(galleryFavouritesOnly));
}
function normaliseSearch(text) {
  return String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function loadGallery() {
  try { return JSON.parse(localStorage.getItem("rabisco-obras") || "[]"); }
  catch { return []; }
}
function saveGallery(items) {
  try { localStorage.setItem("rabisco-obras", JSON.stringify(items.slice(0, 8))); } catch { /* storage full — keep newest only */ }
}
function saveToGallery(work) {
  const items = loadGallery();
  items.unshift({ t: work.titulo, l: work.frase, imagemURL: work.imageUrl, thumb: work.thumb, d: Date.now(), fav: false, workId: work.workId || null });
  saveGallery(items);
}
async function toggleFavourite(item) {
  item.fav = !item.fav;
  saveGallery(loadGallery().map((it) => (it.d === item.d && it.t === item.t ? item : it)));
  // Sync to the server when this work lives there too.
  if (item.workId && parentSession()) {
    try {
      await fetch("/api/gallery/" + encodeURIComponent(item.workId) + "/favourite", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-parent-session": parentSession() },
        body: JSON.stringify({ favourite: item.fav }),
      });
    } catch (_e) { /* local flag already saved; server sync is best effort */ }
  }
  renderGallery();
}
function openResult(item) {
  lastWork = { titulo: item.t, frase: item.l, imageUrl: item.imagemURL, thumb: item.thumb, workId: item.workId || null };
  $("result-title").textContent = item.t;
  $("result-phrase").textContent = item.l;
  $("result-image").src = item.imagemURL;
  $("result-image").alt = item.t;
  $("result-thumb").src = item.thumb;
  $("result-thumb").alt = item.t + " — desenho original";
  show("screen-result");
}

function renderGallery() {
  const query = normaliseSearch($("gallery-search").value).trim();
  let items = loadGallery();
  if (query) items = items.filter((item) => normaliseSearch(item.t + " " + (item.l || "")).includes(query));
  if (galleryFavouritesOnly) items = items.filter((item) => item.fav);
  items = [...items].sort((a, b) => (Boolean(a.fav) !== Boolean(b.fav) ? (a.fav ? -1 : 1) : b.d - a.d));
  const grid = $("gallery-grid");
  grid.innerHTML = "";
  $("gallery-empty").hidden = items.length > 0;
  for (const item of items) {
    const fig = document.createElement("figure");
    if (item.fav) fig.classList.add("favourite");
    // Gallery tiles are clickable: make them keyboard-openable too.
    fig.tabIndex = 0;
    fig.setAttribute("role", "button");
    fig.setAttribute("aria-label", "Ver " + item.t);
    const img = document.createElement("img");
    img.src = item.imagemURL; img.alt = item.t;
    const cap = document.createElement("figcaption");
    cap.textContent = item.t;
    const star = document.createElement("button");
    star.className = "fav-btn";
    star.textContent = item.fav ? "⭐" : "☆";
    star.setAttribute("aria-label", item.fav ? "Remover dos favoritos" : "Marcar como favorita");
    star.addEventListener("click", (e) => { e.stopPropagation(); toggleFavourite(item); });
    fig.append(img, cap, star);
    fig.addEventListener("click", () => openResult(item));
    fig.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openResult(item); }
    });
    grid.appendChild(fig);
  }
}
$("gallery-search").addEventListener("input", renderGallery);
$("btn-gallery-favourites").addEventListener("click", () => {
  galleryFavouritesOnly = !galleryFavouritesOnly;
  updateFavouritesFilterLabel();
  renderGallery();
});
$("btn-gallery").addEventListener("click", () => { renderGallery(); show("screen-gallery"); });
$("btn-gallery-back").addEventListener("click", () => show("screen-draw"));

// ---------------------------------------------------------------------------
// Parental gate + parent panel.
// The gate is a simple adult check (maths question). It guards signup,
// payment, settings and gallery deletion. No child accounts exist.
// ---------------------------------------------------------------------------
function parentSession() {
  try { return localStorage.getItem("rabisco-parent-session") || ""; }
  catch { return ""; }
}
function setParentSession(token) {
  try {
    if (token) localStorage.setItem("rabisco-parent-session", token);
    else localStorage.removeItem("rabisco-parent-session");
  } catch { /* private mode — session just won't persist */ }
}

function newGateQuestion() {
  const a = 2 + Math.floor(Math.random() * 8);
  const b = 2 + Math.floor(Math.random() * 8);
  const answer = a + b;
  const options = new Set([answer]);
  while (options.size < 3) options.add(answer + (Math.floor(Math.random() * 7) - 3) || answer + 4);
  const shuffled = [...options].sort(() => Math.random() - 0.5);
  $("gate-question").textContent = a + " + " + b + " = ?";
  $("gate-error").hidden = true;
  const box = $("gate-answers");
  box.innerHTML = "";
  for (const opt of shuffled) {
    const btn = document.createElement("button");
    btn.className = "btn gate-answer";
    btn.textContent = String(opt);
    btn.addEventListener("click", () => {
      if (opt === answer) {
        renderParentPanel();
        show("screen-parents");
      } else {
        $("gate-error").textContent = I18N[lang].gateWrong;
        $("gate-error").hidden = false;
        newGateQuestion();
      }
    });
    box.appendChild(btn);
  }
}

$("btn-parents").addEventListener("click", () => { newGateQuestion(); show("screen-gate"); });
$("btn-gate-back").addEventListener("click", () => show("screen-draw"));
$("btn-parents-back").addEventListener("click", () => show("screen-draw"));

async function renderParentPanel() {
  $("parent-error").hidden = true;
  $("link-sent").hidden = true;
  $("delete-note").hidden = true;
  const session = parentSession();
  if (!session) {
    $("parent-signed-out").hidden = false;
    $("parent-signed-in").hidden = true;
    return;
  }
  try {
    const res = await fetch("/api/parent/me", { headers: { "x-parent-session": session } });
    const data = await res.json();
    if (!data.ok) throw new Error("not signed in");
    const acc = data.account;
    const planName = acc.plan === "family" ? I18N[lang].planFamily
      : acc.plan === "pack" ? I18N[lang].planPack : I18N[lang].planFree;
    const left = acc.plan === "family"
      ? (acc.familyMonthlyCap - acc.familyUsedThisMonth) + " " + I18N[lang].familyLeft
      : acc.plan === "pack"
        ? acc.packTransforms + " " + I18N[lang].packLeft
        : data.freeRemaining + " " + I18N[lang].freeLeft;
    $("parent-status").textContent = acc.email + " — " + planName + " — " + left;
    $("parent-signed-out").hidden = true;
    $("parent-signed-in").hidden = false;
  } catch (_e) {
    setParentSession("");
    $("parent-signed-out").hidden = false;
    $("parent-signed-in").hidden = true;
  }
}

$("btn-send-link").addEventListener("click", async () => {
  const email = $("parent-email").value.trim();
  if (!email || !email.includes("@")) {
    $("parent-error").textContent = I18N[lang].signInFirst;
    $("parent-error").hidden = false;
    return;
  }
  try {
    const res = await fetch("/api/parent/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error("signup failed");
    $("link-sent").hidden = false;
    $("parent-error").hidden = true;
  } catch (_e) {
    $("parent-error").textContent = I18N[lang].failed;
    $("parent-error").hidden = false;
  }
});

$("btn-verify-token").addEventListener("click", async () => {
  const token = $("parent-token").value.trim();
  if (!token) return;
  try {
    const res = await fetch("/api/parent/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error("invalid token");
    setParentSession(data.sessionToken);
    renderParentPanel();
  } catch (_e) {
    $("parent-error").textContent = I18N[lang].invalidToken;
    $("parent-error").hidden = false;
  }
});

async function startCheckout(product, billing) {
  try {
    const res = await fetch("/api/checkout/" + product, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-parent-session": parentSession() },
      body: JSON.stringify({ billing }),
    });
    const data = await res.json();
    if (!data.ok || !data.url) throw new Error("checkout failed");
    window.location.href = data.url; // Stripe Checkout (test mode)
  } catch (_e) {
    $("parent-error").textContent = I18N[lang].checkoutFailed;
    $("parent-error").hidden = false;
  }
}
$("btn-buy-family-monthly").addEventListener("click", () => startCheckout("family", "monthly"));
$("btn-buy-family-yearly").addEventListener("click", () => startCheckout("family", "yearly"));
$("btn-buy-pack").addEventListener("click", () => startCheckout("pack", "once"));

let deleteArmedAt = 0;
$("btn-delete-gallery").addEventListener("click", async () => {
  const now = Date.now();
  if (now - deleteArmedAt < 5000) {
    deleteArmedAt = 0;
    try {
      const res = await fetch("/api/gallery", {
        method: "DELETE",
        headers: { "x-parent-session": parentSession() },
      });
      const data = await res.json();
      if (!data.ok) throw new Error("delete failed");
      try { localStorage.removeItem("rabisco-obras"); } catch { /* ignore */ }
      $("delete-note").textContent = I18N[lang].deleteGalleryDone;
      $("delete-note").hidden = false;
    } catch (_e) {
      $("delete-note").textContent = I18N[lang].deleteGalleryFailed;
      $("delete-note").hidden = false;
    }
  } else {
    deleteArmedAt = now;
    $("delete-note").textContent = I18N[lang].deleteGalleryConfirm;
    $("delete-note").hidden = false;
    setTimeout(() => { $("delete-note").hidden = true; }, 5000);
  }
});

$("btn-sign-out").addEventListener("click", () => {
  setParentSession("");
  renderParentPanel();
});

// ---------------------------------------------------------------------------
// PWA: service worker + install prompt (button lives in the parent panel)
// ---------------------------------------------------------------------------
let deferredInstallPrompt = null;
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => { /* offline shell is best-effort */ });
}
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  $("btn-install").hidden = false;
});
$("btn-install").addEventListener("click", async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => {});
  deferredInstallPrompt = null;
  $("btn-install").hidden = true;
});

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
