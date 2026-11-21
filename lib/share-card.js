/**
 * Rabisco Mágico — share-card generator (server-side, pure Node).
 *
 * Builds the 1080x1350 share card WITHOUT any AI call and WITHOUT a
 * canvas library or any new dependency: PNGs are decoded and encoded
 * by hand (zlib is in Node core), images are composited pixel by
 * pixel, and the title / phrase / footer are drawn with a tiny
 * built-in 5x7 bitmap font (accented letters map to their base
 * glyph, so "Coração" renders as "CORACAO" — titles are drawn in
 * capitals, which suits a kids' share card).
 *
 * Layout (1080 x 1350, portrait — Instagram / WhatsApp friendly):
 *   sky-blue background (#2b9be0, the app colour)
 *   title centred at the top
 *   generated image in a white frame (880x880)
 *   original drawing thumbnail, tilted, overlapping the frame's
 *     bottom-right corner
 *   phrase centred under the frame
 *   localised footer at the bottom ("Feito com Rabisco Mágico" /
 *   "Made with Rabisco Mágico" / "Hecho con Rabisco Mágico")
 *
 * Input images must be non-interlaced 8-bit PNGs (RGB, RGBA or
 * greyscale) — exactly what the app produces (512x512 drawing PNG)
 * and what fal.ai returns (PNG output). Anything else throws an
 * Error with code INVALID_IMAGE; the caller turns that into a 400.
 */
"use strict";

const zlib = require("zlib");

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1350;
const FRAME = { x: 90, y: 170, size: 900, image: 880 };
const THUMB_SIZE = 200; // thumbnail image itself, inside a white border

const SKY = [43, 155, 224, 255];
const WHITE = [255, 255, 255, 255];
const SUN = [255, 201, 60, 255];
const INK = [16, 50, 74, 255];

const FOOTER = {
  pt: "Feito com Rabisco Mágico",
  en: "Made with Rabisco Mágico",
  es: "Hecho con Rabisco Mágico",
};

const FALLBACK_TITLE = {
  pt: "Meu desenho magico",
  en: "My magic drawing",
  es: "Mi dibujo magico",
};

// ---------------------------------------------------------------------------
// CRC32 + PNG chunk helpers (same algorithm as the blank-check in server.js)
// ---------------------------------------------------------------------------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
    crc32.table = table;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function invalid(message) {
  const err = new Error(message);
  err.code = "INVALID_IMAGE";
  return err;
}

// ---------------------------------------------------------------------------
// PNG decoding — 8-bit, non-interlaced, colour types 0 (grey), 2 (RGB),
// 6 (RGBA). Returns { width, height, data } with data as RGBA bytes.
// ---------------------------------------------------------------------------
function decodePng(input) {
  const png = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (
    png.length < 8 ||
    !png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    throw invalid("not a PNG");
  }
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
  if (!width || !height) throw invalid("missing IHDR");
  if (bitDepth !== 8) throw invalid("only 8-bit PNGs are supported");
  if (interlace !== 0) throw invalid("interlaced PNGs are not supported");
  if (colorType !== 0 && colorType !== 2 && colorType !== 6) {
    throw invalid("unsupported PNG colour type " + colorType);
  }
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const stride = width * channels;
  let raw;
  try {
    raw = zlib.inflateSync(Buffer.concat(idat));
  } catch (_e) {
    throw invalid("corrupt PNG image data");
  }
  if (raw.length < height * (stride + 1)) throw invalid("truncated PNG image data");
  const out = Buffer.alloc(width * height * 4);
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
      } else if (filter !== 0) {
        throw invalid("unsupported PNG filter " + filter);
      }
      row[x] = v;
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (channels === 1) {
        out[o] = out[o + 1] = out[o + 2] = row[x];
        out[o + 3] = 255;
      } else {
        out[o] = row[x * channels];
        out[o + 1] = row[x * channels + 1];
        out[o + 2] = row[x * channels + 2];
        out[o + 3] = channels === 4 ? row[x * channels + 3] : 255;
      }
    }
    prev = row;
  }
  return { width, height, data: out };
}

// ---------------------------------------------------------------------------
// PNG encoding — RGBA buffer -> PNG Buffer (colour type 6, filter 0).
// ---------------------------------------------------------------------------
function encodePng(width, height, rgba) {
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0;
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Tiny 5x7 bitmap font. Each glyph is 7 rows of 5 bits ("#" = on).
// Lowercase and accented letters map to the uppercase / base glyph.
// ---------------------------------------------------------------------------
const GLYPHS = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  0: ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  1: ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  2: ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  3: ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  4: ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  5: ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  6: ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  7: ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  8: ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  9: ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00110", "00100", "00000", "00100"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "#": ["01010", "01010", "11111", "01010", "11111", "01010", "01010"],
  "@": ["01110", "10001", "10111", "10101", "10110", "10000", "01110"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  _: ["00000", "00000", "00000", "00000", "00000", "00000", "11111"],
  $: ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
};

const ACCENT_MAP = {
  Á: "A", À: "A", Â: "A", Ã: "A", Ä: "A",
  É: "E", È: "E", Ê: "E", Ë: "E",
  Í: "I", Ì: "I", Î: "I", Ï: "I",
  Ó: "O", Ò: "O", Ô: "O", Õ: "O", Ö: "O",
  Ú: "U", Ù: "U", Û: "U", Ü: "U",
  Ç: "C", Ñ: "N",
};

function glyphFor(ch) {
  const upper = ch.toUpperCase();
  if (GLYPHS[upper]) return GLYPHS[upper];
  if (ACCENT_MAP[upper]) return GLYPHS[ACCENT_MAP[upper]];
  return null; // unknown character: blank space
}

function textWidth(text, scale) {
  return text.length * 6 * scale - scale; // 5px glyph + 1px gap, per char
}

function wrapText(text, scale, maxWidth) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? line + " " + word : word;
    if (textWidth(candidate, scale) <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// ---------------------------------------------------------------------------
// Pixel helpers on the card canvas (RGBA Buffer, CARD_WIDTH wide)
// ---------------------------------------------------------------------------
function newCanvas() {
  const data = Buffer.alloc(CARD_WIDTH * CARD_HEIGHT * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = SKY[0]; data[i + 1] = SKY[1]; data[i + 2] = SKY[2]; data[i + 3] = 255;
  }
  return data;
}

function setPixel(canvas, x, y, rgba) {
  if (x < 0 || y < 0 || x >= CARD_WIDTH || y >= CARD_HEIGHT) return;
  const o = (y * CARD_WIDTH + x) * 4;
  const a = rgba[3] / 255;
  canvas[o] = Math.round(rgba[0] * a + canvas[o] * (1 - a));
  canvas[o + 1] = Math.round(rgba[1] * a + canvas[o + 1] * (1 - a));
  canvas[o + 2] = Math.round(rgba[2] * a + canvas[o + 2] * (1 - a));
  canvas[o + 3] = 255;
}

function fillRect(canvas, x, y, w, h, rgba) {
  for (let yy = Math.max(0, y); yy < Math.min(CARD_HEIGHT, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(CARD_WIDTH, x + w); xx++) {
      setPixel(canvas, xx, yy, rgba);
    }
  }
}

function fillCircle(canvas, cx, cy, r, rgba) {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) setPixel(canvas, x, y, rgba);
    }
  }
}

function drawText(canvas, text, cx, y, scale, rgba) {
  const upper = String(text).toUpperCase();
  const w = textWidth(upper, scale);
  let x = Math.round(cx - w / 2);
  for (const ch of upper) {
    const glyph = glyphFor(ch);
    if (glyph) {
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if (glyph[row][col] === "1") {
            fillRect(canvas, x + col * scale, y + row * scale, scale, scale, rgba);
          }
        }
      }
    }
    x += 6 * scale;
  }
}

function drawTextLines(canvas, lines, cx, y, scale, lineHeight, rgba) {
  lines.forEach((line, i) => drawText(canvas, line, cx, y + i * lineHeight, scale, rgba));
}

/** Draw src (decoded PNG) scaled to cover the dest rect, centred. */
function drawImageCover(canvas, src, dx, dy, dw, dh) {
  const scale = Math.max(dw / src.width, dh / src.height);
  const sw = dw / scale;
  const sh = dh / scale;
  const sx0 = (src.width - sw) / 2;
  const sy0 = (src.height - sh) / 2;
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(src.height - 1, Math.max(0, Math.floor(sy0 + (y / dh) * sh)));
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(src.width - 1, Math.max(0, Math.floor(sx0 + (x / dw) * sw)));
      const so = (sy * src.width + sx) * 4;
      setPixel(canvas, dx + x, dy + y, [src.data[so], src.data[so + 1], src.data[so + 2], src.data[so + 3]]);
    }
  }
}

/**
 * Draw src rotated by `angleRad` around its centre, inside a white
 * frame. The frame (with a soft offset shadow) is drawn first; the
 * image is sampled with inverse rotation, nearest neighbour.
 */
function drawImageRotated(canvas, src, cx, cy, size, border, angleRad, rgba) {
  const half = size / 2 + border;
  // Soft shadow: the frame shifted down-right, slightly transparent.
  fillRect(canvas, Math.round(cx - half + 8), Math.round(cy - half + 10), half * 2, half * 2, [0, 0, 0, 60]);
  fillRect(canvas, Math.round(cx - half), Math.round(cy - half), half * 2, half * 2, rgba);
  const cos = Math.cos(-angleRad);
  const sin = Math.sin(-angleRad);
  for (let y = -size / 2; y < size / 2; y++) {
    for (let x = -size / 2; x < size / 2; x++) {
      const rx = x * cos - y * sin;
      const ry = x * sin + y * cos;
      const sx = Math.floor(((rx + size / 2) / size) * src.width);
      const sy = Math.floor(((ry + size / 2) / size) * src.height);
      if (sx < 0 || sy < 0 || sx >= src.width || sy >= src.height) continue;
      const so = (sy * src.width + sx) * 4;
      setPixel(canvas, Math.round(cx + x), Math.round(cy + y),
        [src.data[so], src.data[so + 1], src.data[so + 2], src.data[so + 3]]);
    }
  }
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------
function parseImageInput(value, name) {
  if (value === null || value === undefined || value === "") return null;
  if (Buffer.isBuffer(value)) return decodePng(value);
  if (typeof value === "string") {
    const m = value.match(/^data:image\/png;base64,(.+)$/);
    if (!m) throw invalid(name + " must be a PNG data URL or a PNG Buffer");
    return decodePng(Buffer.from(m[1], "base64"));
  }
  throw invalid(name + " must be a PNG data URL or a PNG Buffer");
}

function langKey(language) {
  const l = String(language || "pt").toLowerCase();
  if (l.startsWith("en")) return "en";
  if (l.startsWith("es")) return "es";
  return "pt";
}

/**
 * Build the 1080x1350 share card.
 *
 *   generateShareCard({
 *     image: Buffer | "data:image/png;base64,..."  (generated scene, required),
 *     thumb: Buffer | data URL | null              (original drawing, optional),
 *     titulo: string, frase: string, language: "pt" | "en" | "es",
 *   }) -> Buffer (PNG bytes)
 *
 * Throws Error(code INVALID_IMAGE) on a bad image, Error(code
 * MISSING_IMAGE) when no generated image is supplied.
 */
function generateShareCard({ image, thumb, titulo, frase, language } = {}) {
  if (!image) {
    const err = new Error("generated image is required");
    err.code = "MISSING_IMAGE";
    throw err;
  }
  const scene = parseImageInput(image, "image");
  const drawing = thumb ? parseImageInput(thumb, "thumb") : null;
  const lang = langKey(language);
  const title = String(titulo || "").trim() || FALLBACK_TITLE[lang];
  const phrase = String(frase || "").trim();

  const canvas = newCanvas();

  // Decorative sun, top-left corner (kept clear of the centred title).
  fillCircle(canvas, 52, 52, 30, SUN);
  fillCircle(canvas, 1028, 52, 18, SUN);

  // Title, centred, wrapped to at most 2 lines.
  const titleLines = wrapText(title, 7, CARD_WIDTH - 220).slice(0, 2);
  drawTextLines(canvas, titleLines, CARD_WIDTH / 2, 44, 7, 56, WHITE);

  // White frame + generated image.
  fillRect(canvas, FRAME.x, FRAME.y, FRAME.size, FRAME.size, WHITE);
  drawImageCover(canvas, scene, FRAME.x + 10, FRAME.y + 10, FRAME.image, FRAME.image);

  // Original drawing, tilted, overlapping the frame's bottom-right corner.
  if (drawing) {
    drawImageRotated(canvas, drawing, FRAME.x + FRAME.size - 130, FRAME.y + FRAME.size - 60,
      THUMB_SIZE, 12, 0.07, WHITE);
  }

  // Phrase under the frame.
  if (phrase) {
    const phraseLines = wrapText(phrase, 4, CARD_WIDTH - 140).slice(0, 2);
    drawTextLines(canvas, phraseLines, CARD_WIDTH / 2, 1115, 4, 36, WHITE);
  }

  // Localised footer.
  drawText(canvas, FOOTER[lang], CARD_WIDTH / 2, 1285, 4, WHITE);

  return encodePng(CARD_WIDTH, CARD_HEIGHT, canvas);
}

module.exports = {
  generateShareCard,
  decodePng,
  encodePng,
  parseImageInput,
  footerText: (language) => FOOTER[langKey(language)],
  CARD_WIDTH,
  CARD_HEIGHT,
};
