/**
 * Rabisco Mágico — backend.
 *
 * Small Express server. One AI endpoint: POST /api/transform.
 *
 * Two AI steps, both server-side only:
 *   1. Interpret (vision): title (<=5 words), phrase (<=18 words) and a
 *      detailed English image prompt, in the child's language (pt/en/es).
 *   2. Generate (image): fal.ai FLUX.2 Pro Edit, conditioned on the drawing.
 *
 * FAL_KEY is read from process.env only. It is never sent to the browser,
 * never logged, and never put in a URL.
 *
 * Access model: only a signed-in parent account can transform. The
 * drawing screen unlocks after the parent signs in, and the 5 free
 * transforms are enforced per parent account (in-memory usage map;
 * replace with a database in production). One transform in flight per
 * account. No auto-retry loop. Failures are friendly and do not
 * consume quota.
 */
"use strict";

const express = require("express");
const path = require("path");
const zlib = require("zlib");

const accounts = require("./lib/accounts");
const stripe = require("./lib/stripe");
const storageModule = require("./lib/storage");
const metrics = require("./lib/metrics");
const blocklist = require("./lib/blocklist");
const outputSafety = require("./lib/output-safety");
const audit = require("./lib/audit");
const shareCard = require("./lib/share-card");
const referrals = require("./lib/referrals");
const logger = require("./lib/logger");
const errorMonitor = require("./lib/errors");

const storage = storageModule.createStorageFromEnv();

const PORT = process.env.PORT || 3000;
const FAL_KEY = process.env.FAL_KEY || "";
const VISION_API_KEY = process.env.VISION_API_KEY || "";
const VISION_PROVIDER = process.env.VISION_PROVIDER || "";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const BASE_URL = (process.env.BASE_URL || "http://localhost:" + PORT).replace(/\/$/, "");

const FAL_ENDPOINT = process.env.FAL_ENDPOINT || "https://fal.run/fal-ai/flux-2-pro/edit";
const FREE_TRANSFORMS = 5;

// ---------------------------------------------------------------------------
// Friendly error messages (child-facing, never technical)
// ---------------------------------------------------------------------------
const MESSAGES = {
  pt: {
    empty: "Desenhe alguma coisa primeiro!",
    rateLimit: "Muita mágica! Espere um pouquinho e tente de novo.",
    denied: "Precisa permitir a mágica para continuar.",
    failed: "Ops, a mágica falhou. Tente de novo!",
    quota: "Suas 5 magias grátis acabaram! Peça para um adulto continuar.",
    signInRequired: "Peça para um adulto entrar com a conta para desenhar.",
    busy: "Já estou fazendo uma mágica! Espere um pouquinho.",
    notConfigured: "A mágica ainda não está ligada. Peça para um adulto verificar.",
    disabled: "A mágica está pausada no momento. Tente de novo mais tarde.",
  },
  en: {
    empty: "Draw something first!",
    rateLimit: "Too much magic! Wait a little and try again.",
    denied: "Magic needs permission to continue.",
    failed: "Oops, the magic failed. Try again!",
    quota: "Your 5 free magic turns are used up! Ask a grown-up to continue.",
    signInRequired: "Ask a grown-up to sign in with the parent account to draw.",
    busy: "I'm already doing some magic! Wait a moment.",
    notConfigured: "The magic isn't switched on yet. Ask a grown-up to check.",
    disabled: "The magic is paused right now. Please try again later.",
  },
  es: {
    empty: "¡Dibuja algo primero!",
    rateLimit: "¡Demasiada magia! Espera un poquito e inténtalo de nuevo.",
    denied: "La magia necesita permiso para continuar.",
    failed: "¡Ups, la magia falló! Inténtalo de nuevo.",
    quota: "¡Tus 5 magias gratis se acabaron! Pídele a un adulto que continúe.",
    signInRequired: "Pídele a un adulto que inicie sesión con la cuenta de padres para dibujar.",
    busy: "¡Ya estoy haciendo magia! Espera un momento.",
    notConfigured: "La magia aún no está encendida. Pídele a un adulto que revise.",
    disabled: "La magia está en pausa por ahora. Inténtalo de nuevo más tarde.",
  },
};

function langOf(req) {
  const l = String((req.body && req.body.language) || "pt").toLowerCase();
  if (l.startsWith("en")) return "en";
  if (l.startsWith("es")) return "es";
  return "pt";
}

function msg(req, key) {
  return (MESSAGES[langOf(req)] || MESSAGES.pt)[key];
}

// ---------------------------------------------------------------------------
// Free-transform quota per parent account (in-memory). Production:
// move this into the account record in the durable store.
// ---------------------------------------------------------------------------
const usage = new Map(); // parent accountId -> { used: number }
const inFlight = new Set(); // accountId
let visionOverride = null; // test-only: set via _testSetVisionOverride

// ---------------------------------------------------------------------------
// Step 1 — Interpret the drawing (vision).
// Provider-agnostic: plug in your vision provider here.
// ---------------------------------------------------------------------------
async function interpretDrawing(imageDataUrl, language) {
  // Test-only override (see _testSetVisionOverride below): lets tests
  // feed a chosen title/phrase through the real transform flow, e.g. a
  // blocklisted one, without a real vision provider.
  if (visionOverride) return visionOverride(imageDataUrl, language);
  // TODO: wire a real vision call here when VISION_API_KEY is set.
  // Expected contract: POST to your vision provider with the 512x512 PNG
  // and a system prompt asking for JSON:
  //   { "titulo": "<=5 words>", "frase": "<=18 words, in <language>>",
  //     "prompt_imagem": "<detailed English image prompt: every element,
  //      its colour and its position, photographic style, no text>" }
  // If your provider is OpenAI/Anthropic, send the image as an image input
  // and parse the JSON from the response. Keep the provider key server-side.
  if (VISION_API_KEY && VISION_PROVIDER) {
    // Placeholder for the real call — deliberately not implemented here
    // so the server starts and runs without a vision key.
    // Replace this branch with the provider call described above.
    logger.warn("vision_not_wired");
  }

  // Generic fallback (clearly marked): no vision key, so we cannot know
  // what the child drew. The image prompt asks the model to interpret the
  // sketch itself, respecting shapes, colours and positions.
  const fallback = {
    pt: { titulo: "Meu desenho mágico", frase: "Olha só o que o seu desenho virou!" },
    en: { titulo: "My magic drawing", frase: "Look what your drawing turned into!" },
    es: { titulo: "Mi dibujo mágico", frase: "¡Mira en qué se convirtió tu dibujo!" },
  };
  const t = fallback[language] || fallback.pt;
  return {
    titulo: t.titulo,
    frase: t.frase,
    prompt_imagem:
      "A photorealistic scene that faithfully interprets the child's hand " +
      "drawing: keep every element, its colour, its size and its position " +
      "exactly as drawn. Yellow circle at the top becomes a warm sun, green " +
      "scribbles at the bottom become grass, and so on. Full background, " +
      "directional light, soft shadows, volume and depth. No cartoon outlines, " +
      "no text in the image.",
    visionUsed: Boolean(VISION_API_KEY),
  };
}

// ---------------------------------------------------------------------------
// Step 2 — Generate the realistic scene with fal.ai FLUX.2 Pro Edit.
// ---------------------------------------------------------------------------
async function generateWithFal(imageDataUrl, imagePrompt) {
  if (!FAL_KEY) {
    const err = new Error("FAL_KEY is not configured");
    err.code = "NOT_CONFIGURED";
    throw err;
  }

  // fal accepts the drawing as a data URI in image_urls for edit models.
  // If fal ever rejects data URIs, upload the PNG to object storage first
  // and pass the public URL instead (TODO).
  const res = await fetch(FAL_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: "Key " + FAL_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: imagePrompt,
      image_urls: [imageDataUrl],
      image_size: "auto",
      safety_tolerance: "2",
      enable_safety_checker: true,
      output_format: "png",
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error("fal.ai request failed: " + res.status + " " + text.slice(0, 200));
    err.code = res.status === 429 ? "RATE_LIMIT" : "FAL_FAILED";
    err.status = res.status;
    throw err;
  }

  const data = await res.json();
  const url = data && data.images && data.images[0] && data.images[0].url;
  if (!url) {
    const err = new Error("fal.ai returned no image");
    err.code = "FAL_FAILED";
    throw err;
  }
  return url;
}

// ---------------------------------------------------------------------------
// Blank-drawing check (server-side, no image library).
// Decodes a non-interlaced 8-bit RGB/RGBA PNG and reports true when every
// pixel is white (or fully transparent). Unparseable input returns null,
// which the handler treats as an invalid image.
// ---------------------------------------------------------------------------
function pngCrc32(buf) {
  let table = pngCrc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    pngCrc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function isBlankPng(dataUrl) {
  try {
    const base64 = dataUrl.split(",", 2)[1];
    if (!base64) return null;
    const png = Buffer.from(base64, "base64");
    if (png.length < 8 || !png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return null;
    let offset = 8;
    let width = 0;
    let height = 0;
    let bitDepth = 0;
    let colorType = 0;
    let interlace = 0;
    const idat = [];
    while (offset + 8 <= png.length) {
      const len = png.readUInt32BE(offset);
      const type = png.toString("ascii", offset + 4, offset + 8);
      const data = png.subarray(offset + 8, offset + 8 + len);
      if (type === "IHDR") {
        width = data.readUInt32BE(0);
        height = data.readUInt32BE(4);
        bitDepth = data[8];
        colorType = data[9];
        interlace = data[12];
      } else if (type === "IDAT") {
        idat.push(data);
      } else if (type === "IEND") {
        break;
      }
      offset += 12 + len;
    }
    if (!width || !height || bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) return null;
    const channels = colorType === 6 ? 4 : 3;
    const stride = width * channels;
    const raw = zlib.inflateSync(Buffer.concat(idat));
    if (raw.length < height * (stride + 1)) return null;
    let prev = Buffer.alloc(stride);
    for (let y = 0; y < height; y++) {
      const filter = raw[y * (stride + 1)];
      const row = Buffer.from(raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)));
      for (let x = 0; x < stride; x++) {
        const a = x >= channels ? row[x - channels] : 0;
        const b = prev[x];
        const c = x >= channels ? prev[x - channels] : 0;
        let v = row[x];
        if (filter === 1) v = (v + a) & 0xff;
        else if (filter === 2) v = (v + b) & 0xff;
        else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
        else if (filter === 4) {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
          v = (v + pred) & 0xff;
        } else if (filter !== 0) return null;
        row[x] = v;
      }
      for (let x = 0; x < width; x++) {
        const r = row[x * channels];
        const g = row[x * channels + 1];
        const b = row[x * channels + 2];
        const alpha = channels === 4 ? row[x * channels + 3] : 255;
        if (alpha !== 0 && (r !== 255 || g !== 255 || b !== 255)) return false;
      }
      prev = row;
    }
    return true;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();

// Request ids + structured access log (Batch 5). Every request gets a
// random id (response header X-Request-Id) so a log line, an audit
// event and an error-monitor entry can be joined. The log line carries
// only method/path/status/duration — never a body, a key, or a drawing.
const crypto = require("crypto");
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader("X-Request-Id", req.id);
  const started = Date.now();
  res.on("finish", () => {
    const fields = { requestId: req.id, method: req.method, path: req.path, status: res.statusCode, durationMs: Date.now() - started };
    if (req.path === "/api/health") logger.debug("http_request", fields);
    else logger.info("http_request", fields);
  });
  next();
});

// Stripe webhook FIRST, with a raw body — express.json() would consume
// the body and break the HMAC signature verification.
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), (req, res) => {
  let event;
  try {
    event = stripe.parseWebhookEvent(req.body, req.get("stripe-signature"));
  } catch (err) {
    if (err && err.code === "NOT_CONFIGURED") {
      return res.status(503).json({ ok: false, error: "not_configured" });
    }
    return res.status(400).json({ ok: false, error: "invalid_signature" });
  }
  const obj = (event && event.data && event.data.object) || {};
  const meta = obj.metadata || {};
  if (event.type === "checkout.session.completed" && meta.accountId && meta.product) {
    const granted = accounts.grantPurchase(meta.accountId, meta.product, obj.subscription || null);
    logger.info("stripe_webhook_checkout_completed", { product: String(meta.product || ""), granted: Boolean(granted) });
  } else if (event.type === "customer.subscription.deleted" && meta.accountId) {
    accounts.revokeSubscription(meta.accountId, obj.id || null);
    logger.info("stripe_webhook_subscription_deleted");
  }
  return res.json({ received: true });
});

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));
// Serve locally stored gallery thumbnails (device keeps only URLs).
app.use("/gallery-files", express.static(path.join(__dirname, "data", "gallery")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, falConfigured: Boolean(FAL_KEY), visionConfigured: Boolean(VISION_API_KEY) });
});

// Hydrate parent accounts from the durable store on first use. On a
// cold serverless instance this loads the persisted accounts/tokens
// before any parent route runs; afterwards it is a no-op. Static files
// and /api/health above do not need it.
app.use((req, res, next) => {
  accounts.init().then(() => next()).catch(() => next());
});

// Resolve the parent account from the session token, if the device sent one.
function parentAccount(req) {
  const token = req.get("x-parent-session");
  if (!token) return null;
  return accounts.getAccountBySession(token);
}

function requireParent(req, res) {
  const parent = parentAccount(req);
  if (!parent) {
    res.status(401).json({ ok: false, error: "parent_required", message: "Parent sign-in required." });
    return null;
  }
  return parent;
}

// ---------------------------------------------------------------------------
// Parent accounts (magic link by email — lib/email.js; stub when no
// RESEND_API_KEY is configured, in which case the parent pastes the
// token from the code field instead).
// ---------------------------------------------------------------------------
app.post("/api/parent/signup", async (req, res) => {
  try {
    const result = await accounts.requestMagicLink(req.body && req.body.email, langOf(req));
    // The token is NEVER returned here — it travels by email (or, in
    // stub mode, via the test-only helper / pasted code field).
    return res.json({ ok: true, emailSent: result.emailSent, stub: result.stub });
  } catch (err) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }
});

app.post("/api/parent/verify", async (req, res) => {
  const result = await accounts.verifyMagicLink(req.body && req.body.token);
  if (!result) return res.status(401).json({ ok: false, error: "invalid_token" });
  return res.json({ ok: true, sessionToken: result.sessionToken, account: result.account });
});

app.get("/api/parent/me", (req, res) => {
  const parent = requireParent(req, res);
  if (!parent) return;
  const record = usage.get(parent.id) || { used: 0 };
  return res.json({
    ok: true,
    account: parent,
    freeRemaining: Math.max(0, FREE_TRANSFORMS - record.used),
  });
});

// Free-transform quota for the signed-in parent, so the drawing screen
// can show how many free transforms are left. Parent session required:
// there is no anonymous quota any more — drawing (and therefore
// transforming) is only possible after a parent signs in. Returns counts
// only — no account ids, emails or keys. Paid plans have a separate
// entitlement; this endpoint reports the 5-free quota only.
app.get("/api/quota", (req, res) => {
  const parent = requireParent(req, res);
  if (!parent) return;
  const record = usage.get(parent.id) || { used: 0 };
  return res.json({
    ok: true,
    freeTotal: FREE_TRANSFORMS,
    used: record.used,
    left: Math.max(0, FREE_TRANSFORMS - record.used),
  });
});

// ---------------------------------------------------------------------------
// Stripe checkout (test mode only) — parents only, behind the parental gate
// ---------------------------------------------------------------------------
app.post("/api/checkout/:product", async (req, res) => {
  const parent = requireParent(req, res);
  if (!parent) return;
  const product = req.params.product; // "family" | "pack"
  if (product !== "family" && product !== "pack") {
    return res.status(400).json({ ok: false, error: "unknown_product" });
  }
  const billing = product === "family" ? String((req.body && req.body.billing) || "monthly") : "once";
  try {
    const session = await stripe.createCheckoutSession({
      product,
      billing,
      accountId: parent.id,
      successUrl: BASE_URL + "/?paid=1",
      cancelUrl: BASE_URL + "/?cancelled=1",
    });
    return res.json({ ok: true, url: session.url, sessionId: session.id });
  } catch (err) {
    if (err && err.code === "NOT_CONFIGURED") {
      return res.status(503).json({ ok: false, error: "stripe_not_configured" });
    }
    if (err && err.code === "PRICE_NOT_CONFIGURED") {
      return res.status(503).json({ ok: false, error: "price_not_configured" });
    }
    errorMonitor.capture(err, { route: "POST /api/checkout/:product", method: req.method, requestId: req.id });
    logger.error("checkout_failed", { requestId: req.id, code: err && err.code ? String(err.code) : "checkout_failed" });
    return res.status(502).json({ ok: false, error: "checkout_failed" });
  }
});

// ---------------------------------------------------------------------------
// Gallery deletion (parent only) — wipes every stored work for the account
// ---------------------------------------------------------------------------
app.delete("/api/gallery", async (req, res) => {
  const parent = requireParent(req, res);
  if (!parent) return;
  try {
    const deleted = await storage.deleteAccountGallery(parent.id);
    audit.logEvent({
      accountId: parent.id,
      action: audit.ACTIONS.GALLERY_DELETED,
      outcome: "success",
      costUsd: 0,
      reason: "parent_request",
    });
    return res.json({ ok: true, deleted });
  } catch (err) {
    audit.logEvent({
      accountId: parent.id,
      action: audit.ACTIONS.GALLERY_DELETE_FAILED,
      outcome: "failed",
      costUsd: 0,
      reason: (err && err.code) || "delete_failed",
    });
    errorMonitor.capture(err, { route: "DELETE /api/gallery", method: req.method, requestId: req.id });
    logger.error("gallery_delete_failed", { requestId: req.id, code: err && err.code ? String(err.code) : "delete_failed" });
    return res.status(500).json({ ok: false, error: "delete_failed" });
  }
});

app.get("/api/gallery", async (req, res) => {
  const parent = requireParent(req, res);
  if (!parent) return;
  try {
    // ?q= searches titles + phrases; favourites list first by default.
    const works = await storage.listWorks(parent.id, {
      query: req.query.q || "",
      favouritesFirst: req.query.favouritesFirst !== "0",
    });
    return res.json({ ok: true, works });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "gallery_failed" });
  }
});

// Toggle a work's favourite flag (parent only). Body: { favourite: bool }.
app.patch("/api/gallery/:workId/favourite", async (req, res) => {
  const parent = requireParent(req, res);
  if (!parent) return;
  const favourite = Boolean(req.body && req.body.favourite);
  try {
    const updated = await storage.setFavourite(parent.id, req.params.workId, favourite);
    if (!updated) return res.status(404).json({ ok: false, error: "work_not_found" });
    audit.logEvent({
      accountId: parent.id,
      action: audit.ACTIONS.WORK_FAVOURITED,
      outcome: "success",
      costUsd: 0,
      reason: favourite ? "favourited" : "unfavourited",
      workId: req.params.workId,
    });
    return res.json({ ok: true, id: req.params.workId, favourite });
  } catch (err) {
    return res.status(500).json({ ok: false, error: "favourite_failed" });
  }
});

// ---------------------------------------------------------------------------
// Share card (server-side, no AI call, no quota): POST /api/share-card
// Body: { image, imageUrl, thumb?, titulo?, frase?, language? }.
// image is a PNG data URL; imageUrl is a PNG URL the server fetches
// itself (the browser often cannot — the generated image is
// cross-origin — so the server fetches it: no CORS problem there).
// thumb is the original drawing as a PNG data URL (optional).
// Returns the 1080x1350 PNG. Bad images -> 400, never a 500.
// ---------------------------------------------------------------------------
async function fetchPngForShareCard(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.includes("image/png")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > 5 * 1024 * 1024) return null;
    return buf;
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

app.post("/api/share-card", async (req, res) => {
  try {
    let image = req.body && req.body.image;
    if (!image && req.body && req.body.imageUrl) {
      image = await fetchPngForShareCard(String(req.body.imageUrl));
      if (!image) return res.status(400).json({ ok: false, error: "invalid_image" });
    }
    const png = shareCard.generateShareCard({
      image,
      thumb: req.body && req.body.thumb,
      titulo: req.body && req.body.titulo,
      frase: req.body && req.body.frase,
      language: langOf(req),
    });
    res.type("image/png");
    return res.send(png);
  } catch (err) {
    if (err && (err.code === "INVALID_IMAGE" || err.code === "MISSING_IMAGE")) {
      return res.status(400).json({ ok: false, error: "invalid_image" });
    }
    errorMonitor.capture(err, { route: "POST /api/share-card", method: req.method, requestId: req.id });
    logger.error("share_card_failed", { requestId: req.id, code: err && err.code ? String(err.code) : "share_card_failed" });
    return res.status(500).json({ ok: false, error: "share_card_failed" });
  }
});

// ---------------------------------------------------------------------------
// Referral / invite codes (stub — no payment changes, no email sent)
// ---------------------------------------------------------------------------
app.get("/api/referral/code", (req, res) => {
  const parent = requireParent(req, res);
  if (!parent) return;
  const code = referrals.getOrCreateReferralCode(parent.id);
  return res.json({ ok: true, code, ...referrals.getReferralStats(parent.id) });
});

app.post("/api/referral/redeem", (req, res) => {
  const parent = requireParent(req, res);
  if (!parent) return;
  const result = referrals.redeemReferralCode(req.body && req.body.code, parent.id);
  if (!result.ok) {
    const status = result.error === "invalid_code" ? 404 : result.error === "already_redeemed" ? 409 : 400;
    return res.status(status).json({ ok: false, error: result.error });
  }
  audit.logEvent({
    accountId: parent.id,
    action: audit.ACTIONS.REFERRAL_REDEEMED,
    outcome: "success",
    costUsd: 0,
    reason: "referral_bonus",
    workId: null,
  });
  return res.json({ ok: true, bonusGranted: result.bonusGranted });
});

// ---------------------------------------------------------------------------
// Cost dashboard (admin only, env token) — in-memory MOCK data, labelled
// ---------------------------------------------------------------------------
// Error monitor (admin only, same token as the dashboard). Returns the
// in-memory captured errors, newest last; no child data is ever in here.
app.get("/api/admin/errors", (req, res) => {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ ok: false, error: "admin_not_configured" });
  }
  if (req.get("x-admin-token") !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  return res.json({ ok: true, count: errorMonitor.count(), errors: errorMonitor.getErrors() });
});

app.get("/api/admin/dashboard", (req, res) => {
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ ok: false, error: "admin_not_configured" });
  }
  if (req.get("x-admin-token") !== ADMIN_TOKEN) {
    return res.status(401).json({ ok: false, error: "unauthorized" });
  }
  let totalFreeUsed = 0;
  for (const r of usage.values()) totalFreeUsed += r.used;
  return res.json({
    ok: true,
    dashboard: metrics.getDashboard({ accounts: usage.size, totalFreeUsed }),
    auditEvents: audit.count(),
    errorCount: errorMonitor.count(),
    stripeConfigured: stripe.stripeConfigured(),
    storageBackend: storage.backend,
  });
});

app.post("/api/transform", async (req, res) => {
  const language = langOf(req);
  const image = req.body && req.body.image; // data URL, PNG 512x512
  // Parent sign-in is required to draw at all: no session, no
  // transform, no AI call, no quota consumed.
  const parent = parentAccount(req);
  if (!parent) {
    return res.status(401).json({ ok: false, error: "parent_required", message: msg(req, "signInRequired") });
  }
  const account = parent.id;

  if (metrics.killSwitchOn()) {
    return res.status(503).json({ ok: false, error: "disabled", message: msg(req, "disabled") });
  }

  if (!image || typeof image !== "string" || !image.startsWith("data:image/png")) {
    return res.status(400).json({ ok: false, error: "empty", message: msg(req, "empty") });
  }

  // Server-side blank check: an all-white board is an empty drawing, and a
  // PNG we cannot decode is an invalid image. Both are rejected before any
  // AI call, so they never consume quota or cost money.
  // The client may also send strokeCount: 0 for an untouched board.
  if ((req.body && req.body.strokeCount === 0) || isBlankPng(image) !== false) {
    return res.status(400).json({ ok: false, error: "empty", message: msg(req, "empty") });
  }

  // Paid-plan entitlement (Family cap / Magic Pack balance). Free plans
  // fall through to the 5-free quota below.
  const entitlement = accounts.checkTransform(parent.id);
  if (!entitlement.allowed) {
    return res.status(402).json({ ok: false, error: "quota", message: msg(req, "quota") });
  }

  const record = usage.get(account) || { used: 0 };
  // A parent with pack / bonus transforms left is not bound by the
  // 5-free quota (referral bonuses are spent like pack transforms).
  const hasPaidBalance =
    parent.plan !== "free" || parent.packTransforms > 0 || parent.bonusTransforms > 0;
  if (!hasPaidBalance) {
    if (record.used >= FREE_TRANSFORMS) {
      return res.status(402).json({ ok: false, error: "quota", message: msg(req, "quota") });
    }
  }
  if (inFlight.has(account)) {
    return res.status(429).json({ ok: false, error: "busy", message: msg(req, "busy") });
  }

  inFlight.add(account);
  metrics.recordAttempt();
  try {
    // Step 1: interpret.
    const vision = await interpretDrawing(image, language);

    // Safety layer 1 — blocklist on the vision-generated title + phrase,
    // BEFORE the image call: a hit costs nothing, charges no quota, keeps
    // the drawing, and the work is never saved or shown. The child sees
    // the same friendly failure as any other generation problem.
    const blocked = blocklist.checkTitleAndPhrase(vision.titulo, vision.frase);
    if (blocked.blocked) {
      metrics.recordFailure();
      audit.logEvent({
        accountId: account,
        action: audit.ACTIONS.TRANSFORM_BLOCKED_BLOCKLIST,
        outcome: "blocked",
        costUsd: 0,
        reason: "blocklist:" + blocked.categories.join(","),
      });
      return res.status(502).json({ ok: false, error: "failed", message: msg(req, "failed") });
    }

    // Step 2: generate. (One call only — never auto-retry in a loop.)
    const imageUrl = await generateWithFal(image, vision.prompt_imagem);

    // Safety layer 2 — output-image check on the GENERATED image,
    // before it is shown or saved. Stub by default (see
    // lib/output-safety.js): the wiring and the fail-closed behaviour
    // are real, the judgement is a stub until a provider is wired.
    // A fail costs the generation (already made) but charges no quota
    // and saves nothing.
    const safety = await outputSafety.checkOutputImage(imageUrl);
    if (!safety.safe) {
      metrics.recordFailure();
      audit.logEvent({
        accountId: account,
        action: audit.ACTIONS.TRANSFORM_BLOCKED_OUTPUT_SAFETY,
        outcome: "blocked",
        costUsd: metrics.COST_PER_TRANSFORM_USD,
        reason: "output_safety:" + safety.reason,
      });
      return res.status(502).json({ ok: false, error: "failed", message: msg(req, "failed") });
    }

    // Only count successful transforms against the quota.
    if (hasPaidBalance) {
      accounts.consumeTransform(parent.id);
    } else {
      record.used += 1;
      usage.set(account, record);
    }
    metrics.recordSuccess();

    // Store the work server-side (URL only — the device keeps URLs).
    // Best effort: a storage failure must never fail a transform.
    // Every work belongs to a parent account and is kept until the
    // parent deletes it (no anonymous works any more).
    let workId = null;
    try {
      const saved = await storage.saveWork(
        account,
        {
          titulo: vision.titulo,
          frase: vision.frase,
          imageUrl,
          thumb: image,
        },
        { autoPurge: false }
      );
      workId = saved.id;
    } catch (err) {
      logger.warn("gallery_storage_failed", { requestId: req.id, code: err && err.code ? String(err.code) : "storage_failed" });
    }

    audit.logEvent({
      accountId: account,
      action: audit.ACTIONS.TRANSFORM_SUCCESS,
      outcome: "success",
      costUsd: metrics.COST_PER_TRANSFORM_USD,
      reason: null,
      workId,
    });

    const remaining = hasPaidBalance
      ? accounts.checkTransform(parent.id).remaining
      : FREE_TRANSFORMS - record.used;
    return res.json({
      ok: true,
      titulo: vision.titulo,
      frase: vision.frase,
      imageUrl,
      workId,
      remaining,
    });
  } catch (err) {
    metrics.recordFailure();
    audit.logEvent({
      accountId: account,
      action: audit.ACTIONS.TRANSFORM_FAILED,
      outcome: "failed",
      costUsd: 0,
      reason: (err && err.code) || "failed",
    });
    errorMonitor.capture(err, { route: "POST /api/transform", method: req.method, requestId: req.id });
    logger.error("transform_failed", { requestId: req.id, code: err && err.code ? String(err.code) : "failed" });
    if (err && err.code === "NOT_CONFIGURED") {
      return res.status(503).json({ ok: false, error: "not_configured", message: msg(req, "notConfigured") });
    }
    if (err && err.code === "RATE_LIMIT") {
      return res.status(429).json({ ok: false, error: "rate_limit", message: msg(req, "rateLimit") });
    }
    return res.status(502).json({ ok: false, error: "failed", message: msg(req, "failed") });
  } finally {
    inFlight.delete(account);
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    logger.info("server_started", { port: PORT, falConfigured: Boolean(FAL_KEY), visionConfigured: Boolean(VISION_API_KEY) });
  });
}

// Export the Express app itself as the module value (Vercel's Express
// handling requires the default export to be a function/server), with the
// helpers tests use attached as properties so `const { app } =
// require('./server.js')` keeps working.
module.exports = app;
module.exports.app = app;
module.exports.isBlankPng = isBlankPng;
module.exports.interpretDrawing = interpretDrawing;
module.exports.generateWithFal = generateWithFal;
module.exports.FREE_TRANSFORMS = FREE_TRANSFORMS;
module.exports.accounts = accounts;
module.exports.storage = storage;
module.exports.metrics = metrics;
module.exports.blocklist = blocklist;
module.exports.outputSafety = outputSafety;
module.exports.audit = audit;
module.exports.shareCard = shareCard;
module.exports.referrals = referrals;
module.exports.logger = logger;
module.exports.errorMonitor = errorMonitor;
module.exports._testSetVisionOverride = function (fn) {
  visionOverride = typeof fn === "function" ? fn : null;
};
module.exports._testReset = function () {
  usage.clear();
  inFlight.clear();
  visionOverride = null;
  accounts._testReset();
  referrals._testReset();
  metrics._testReset();
  audit._testReset();
  blocklist._testReset();
  errorMonitor._testReset();
};
