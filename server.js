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
 * Quota stub: 5 free transforms per account (in-memory; replace with a
 * database + parent accounts in production). One transform in flight per
 * account. No auto-retry loop. Failures are friendly and do not consume quota.
 */
"use strict";

const express = require("express");
const path = require("path");

const PORT = process.env.PORT || 3000;
const FAL_KEY = process.env.FAL_KEY || "";
const VISION_API_KEY = process.env.VISION_API_KEY || "";
const VISION_PROVIDER = process.env.VISION_PROVIDER || "";

const FAL_ENDPOINT = "https://fal.run/fal-ai/flux-2-pro/edit";
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
    busy: "Já estou fazendo uma mágica! Espere um pouquinho.",
    notConfigured: "A mágica ainda não está ligada. Peça para um adulto verificar.",
  },
  en: {
    empty: "Draw something first!",
    rateLimit: "Too much magic! Wait a little and try again.",
    denied: "Magic needs permission to continue.",
    failed: "Oops, the magic failed. Try again!",
    quota: "Your 5 free magic turns are used up! Ask a grown-up to continue.",
    busy: "I'm already doing some magic! Wait a moment.",
    notConfigured: "The magic isn't switched on yet. Ask a grown-up to check.",
  },
  es: {
    empty: "¡Dibuja algo primero!",
    rateLimit: "¡Demasiada magia! Espera un poquito e inténtalo de nuevo.",
    denied: "La magia necesita permiso para continuar.",
    failed: "¡Ups, la magia falló! Inténtalo de nuevo.",
    quota: "¡Tus 5 magias gratis se acabaron! Pídele a un adulto que continúe.",
    busy: "¡Ya estoy haciendo magia! Espera un momento.",
    notConfigured: "La magia aún no está encendida. Pídele a un adulto que revise.",
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
// Quota stub (in-memory). Production: parent accounts + database.
// ---------------------------------------------------------------------------
const usage = new Map(); // accountId -> { used: number }
const inFlight = new Set(); // accountId

function accountId(req) {
  // Production: derive from the authenticated parent account.
  return String(req.get("x-account-id") || "anonymous");
}

// ---------------------------------------------------------------------------
// Step 1 — Interpret the drawing (vision).
// Provider-agnostic: plug in your vision provider here.
// ---------------------------------------------------------------------------
async function interpretDrawing(imageDataUrl, language) {
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
    console.warn("[rabisco] VISION_PROVIDER set but no vision call wired yet; using fallback.");
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
// App
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, falConfigured: Boolean(FAL_KEY), visionConfigured: Boolean(VISION_API_KEY) });
});

app.post("/api/transform", async (req, res) => {
  const language = langOf(req);
  const image = req.body && req.body.image; // data URL, PNG 512x512
  const account = accountId(req);

  if (!image || typeof image !== "string" || !image.startsWith("data:image/png")) {
    return res.status(400).json({ ok: false, error: "empty", message: msg(req, "empty") });
  }

  const record = usage.get(account) || { used: 0 };
  if (record.used >= FREE_TRANSFORMS) {
    return res.status(402).json({ ok: false, error: "quota", message: msg(req, "quota") });
  }
  if (inFlight.has(account)) {
    return res.status(429).json({ ok: false, error: "busy", message: msg(req, "busy") });
  }

  inFlight.add(account);
  try {
    // Step 1: interpret.
    const vision = await interpretDrawing(image, language);

    // Step 2: generate. (One call only — never auto-retry in a loop.)
    const imageUrl = await generateWithFal(image, vision.prompt_imagem);

    // Only count successful transforms against the quota.
    record.used += 1;
    usage.set(account, record);

    return res.json({
      ok: true,
      titulo: vision.titulo,
      frase: vision.frase,
      imageUrl,
      remaining: FREE_TRANSFORMS - record.used,
    });
  } catch (err) {
    console.error("[rabisco] transform failed:", err && err.code ? err.code : err);
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

app.listen(PORT, () => {
  console.log("Rabisco Mágico listening on http://localhost:" + PORT);
  console.log("fal.ai configured:", Boolean(FAL_KEY));
});
