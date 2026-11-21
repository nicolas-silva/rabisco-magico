/**
 * Rabisco Mágico — parent magic-link email (Resend).
 *
 * Sends the sign-in link by email via the Resend API using plain fetch —
 * no new dependencies. When RESEND_API_KEY is absent, this module sends
 * nothing and reports { sent: false, stub: true }; the caller keeps the
 * old stub behaviour (the token is created, the parent pastes it from
 * the test hatch / the code field until email is wired).
 *
 * The token and the parent's email address are NEVER logged. Log lines
 * carry only the outcome (sent / failed / stub) and, on failure, the
 * HTTP status from Resend.
 *
 * Env:
 *   RESEND_API_KEY  — Resend API key (re_...). Required to send.
 *   RESEND_API_URL  — override for tests (default https://api.resend.com/emails).
 *   EMAIL_FROM      — sender, e.g. "Rabisco Mágico <noreply@rabisco-magico.app>".
 *                     Production needs a domain verified in Resend; the
 *                     default is a placeholder, not a working sender.
 *   APP_BASE_URL    — public base URL of the app (falls back to BASE_URL,
 *                     then https://rabisco-magico.vercel.app). The magic
 *                     link is <base>/?token=<token>.
 */
"use strict";

const logger = require("./logger");

const DEFAULT_FROM = "Rabisco Mágico <noreply@rabisco-magico.app>";
const DEFAULT_BASE_URL = "https://rabisco-magico.vercel.app";

const SUBJECTS = {
  "pt-BR": "Seu link de acesso — Rabisco Mágico",
  en: "Your sign-in link — Rabisco Mágico",
  es: "Tu enlace de acceso — Rabisco Mágico",
};

function baseUrl() {
  return (process.env.APP_BASE_URL || process.env.BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function magicLink(token) {
  return baseUrl() + "/?token=" + encodeURIComponent(token);
}

function normaliseLanguage(language) {
  const l = String(language || "").toLowerCase();
  if (l.startsWith("en")) return "en";
  if (l.startsWith("es")) return "es";
  return "pt-BR"; // server.js langOf() returns "pt"; anything else defaults to pt-BR
}

function bodies(language, link) {
  const lang = normaliseLanguage(language);
  const text = {
    "pt-BR": {
      subject: SUBJECTS["pt-BR"],
      hello: "Olá!",
      line1: "Toque no link abaixo para entrar na área dos pais do Rabisco Mágico.",
      line2: "O link vale por 15 minutos e só pode ser usado uma vez.",
      ignore: "Se você não pediu este link, pode ignorar este e-mail.",
      button: "Entrar na área dos pais",
    },
    en: {
      subject: SUBJECTS.en,
      hello: "Hello!",
      line1: "Tap the link below to sign in to the Rabisco Mágico parents' area.",
      line2: "The link works for 15 minutes and can only be used once.",
      ignore: "If you didn't ask for this link, you can ignore this email.",
      button: "Sign in to the parents' area",
    },
    es: {
      subject: SUBJECTS.es,
      hello: "¡Hola!",
      line1: "Toca el enlace de abajo para entrar en el área de padres de Rabisco Mágico.",
      line2: "El enlace vale 15 minutos y solo se puede usar una vez.",
      ignore: "Si no pediste este enlace, puedes ignorar este correo.",
      button: "Entrar en el área de padres",
    },
  }[lang];
  return {
    subject: text.subject,
    text:
      text.hello + "\n\n" + text.line1 + "\n" + link + "\n\n" + text.line2 + "\n" + text.ignore,
    html:
      "<p>" + text.hello + "</p>" +
      "<p>" + text.line1 + "</p>" +
      "<p><a href=\"" + link + "\">" + text.button + "</a></p>" +
      "<p>" + text.line2 + "</p>" +
      "<p>" + text.ignore + "</p>",
  };
}

/**
 * Send a magic-link email. Returns { sent: true } on success,
 * { sent: false, stub: true } when no API key is configured,
 * { sent: false, error: <code> } when Resend rejects the send.
 * Never throws for a Resend failure — the caller reports emailSent:false.
 */
async function sendMagicLink(email, token, language) {
  const apiKey = process.env.RESEND_API_KEY || "";
  if (!apiKey) {
    logger.info("magic_link_email_stub", {});
    return { sent: false, stub: true };
  }
  const link = magicLink(token);
  const { subject, text, html } = bodies(language || "pt-BR", link);
  const apiUrl = process.env.RESEND_API_URL || "https://api.resend.com/emails";
  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: email,
        subject,
        text,
        html,
      }),
    });
    if (!res.ok) {
      logger.warn("magic_link_email_failed", { status: res.status });
      return { sent: false, error: "resend_" + res.status };
    }
    logger.info("magic_link_email_sent", {});
    return { sent: true };
  } catch (err) {
    logger.warn("magic_link_email_failed", { error: "fetch_failed" });
    return { sent: false, error: "fetch_failed" };
  }
}

module.exports = { sendMagicLink, magicLink, baseUrl };
