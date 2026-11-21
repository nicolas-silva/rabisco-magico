/**
 * Rabisco Mágico — synthetic kid-style drawings generator.
 *
 * Generates 20 messy, kid-style scribble PNGs (512x512) programmatically
 * into benchmark/drawings-synthetic/ (gitignored) — NO real kids'
 * drawings, NO API calls. The drawings are deliberately imperfect:
 * wobbly lines, uneven shapes, off-centre layouts, like a real child
 * drew them with a finger.
 *
 * Run:  npm run drawings
 * Output: benchmark/drawings-synthetic/D01.png … D20.png + metadata.csv
 *         (drawing_id, age_band, subject, dominant_colours, description)
 *         matching the columns of benchmark/scoring-sheet.csv.
 *
 * Pure Node, no dependencies. Seeded RNG (mulberry32) so the output is
 * deterministic — run it twice, get the same 20 drawings.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const W = 512;
const H = 512;
const OUT = path.join(__dirname, "..", "benchmark", "drawings-synthetic");

// --- Seeded RNG ------------------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Tiny raster canvas (RGB, white background) ----------------------------
class Canvas {
  constructor(seed) {
    this.pixels = Buffer.alloc(W * H * 3, 255);
    this.rng = mulberry32(seed);
  }
  set(x, y, c) {
    const xi = Math.round(x);
    const yi = Math.round(y);
    if (xi < 0 || yi < 0 || xi >= W || yi >= H) return;
    const o = (yi * W + xi) * 3;
    this.pixels[o] = c[0]; this.pixels[o + 1] = c[1]; this.pixels[o + 2] = c[2];
  }
  dot(x, y, r, c) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) this.set(x + dx, y + dy, c);
      }
    }
  }
  // Wobbly "kid" line: straight segments with jitter + variable width.
  line(x0, y0, x1, y1, width, c) {
    const steps = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0) / 6));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const jx = (this.rng() - 0.5) * 7;
      const jy = (this.rng() - 0.5) * 7;
      const wobble = 1 + (this.rng() - 0.5) * 1.6;
      this.dot(x0 + (x1 - x0) * t + jx, y0 + (y1 - y0) * t + jy, Math.max(1, (width / 2) * wobble), c);
    }
  }
  // Filled, slightly lopsided circle (scribbled edge).
  circle(cx, cy, r, width, c, fill) {
    const steps = 48;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const rr = r * (1 + (this.rng() - 0.5) * 0.16);
      this.dot(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, width / 2, c);
    }
    if (fill) {
      for (let y = -r; y <= r; y += 2) {
        for (let x = -r; x <= r; x += 2) {
          if (x * x + y * y < r * r * 0.85) this.dot(cx + x, cy + y, 2, fill);
        }
      }
    }
  }
  rect(x, y, w, h, width, c, fill) {
    if (fill) {
      for (let yy = y + 3; yy < y + h - 3; yy += 3) {
        for (let xx = x + 3; xx < x + w - 3; xx += 3) this.dot(xx, yy, 2, fill);
      }
    }
    this.line(x, y, x + w, y, width, c);
    this.line(x + w, y, x + w, y + h, width, c);
    this.line(x + w, y + h, x, y + h, width, c);
    this.line(x, y + h, x, y, width, c);
  }
  triangle(x0, y0, x1, y1, x2, y2, width, c, fill) {
    if (fill) {
      // Rough fill: horizontal scanlines between the edges.
      const minY = Math.min(y0, y1, y2);
      const maxY = Math.max(y0, y1, y2);
      for (let y = minY + 3; y < maxY - 3; y += 3) {
        const xs = [];
        for (const [ax, ay, bx, by] of [[x0, y0, x1, y1], [x1, y1, x2, y2], [x2, y2, x0, y0]]) {
          if ((ay <= y && by > y) || (by <= y && ay > y)) {
            xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
          }
        }
        if (xs.length >= 2) {
          const lo = Math.min(...xs);
          const hi = Math.max(...xs);
          for (let x = lo + 3; x < hi - 3; x += 3) this.dot(x, y, 2, fill);
        }
      }
    }
    this.line(x0, y0, x1, y1, width, c);
    this.line(x1, y1, x2, y2, width, c);
    this.line(x2, y2, x0, y0, width, c);
  }
  arc(cx, cy, r, a0, a1, width, c) {
    const steps = 40;
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps;
      this.dot(cx + Math.cos(a) * r, cy + Math.sin(a) * r, width / 2, c);
    }
  }
  // Grass / scribble patch: many short random strokes.
  scribble(x0, y0, x1, y1, strokes, width, c) {
    for (let i = 0; i < strokes; i++) {
      const x = x0 + this.rng() * (x1 - x0);
      const y = y0 + this.rng() * (y1 - y0);
      this.line(x, y, x + (this.rng() - 0.5) * 40, y + (this.rng() - 0.5) * 30, width, c);
    }
  }
  toPng() {
    const raw = Buffer.alloc(H * (W * 3 + 1));
    for (let y = 0; y < H; y++) {
      raw[y * (W * 3 + 1)] = 0;
      this.pixels.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
    }
    const crcTable = crcTableCache.table || (crcTableCache.table = makeCrcTable());
    const chunk = (type, data) => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length);
      const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(crc32(td, crcTable));
      return Buffer.concat([len, td, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(W, 0);
    ihdr.writeUInt32BE(H, 4);
    ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", ihdr),
      chunk("IDAT", zlib.deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
}
const crcTableCache = {};
function makeCrcTable() {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
}
function crc32(buf, table) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// --- Palette (kid crayons) --------------------------------------------------
const BLACK = [17, 17, 17];
const RED = [255, 59, 48];
const ORANGE = [255, 149, 0];
const YELLOW = [255, 204, 0];
const GREEN = [52, 199, 89];
const DARK_GREEN = [0, 128, 64];
const BLUE = [30, 144, 255];
const DARK_BLUE = [10, 61, 145];
const PURPLE = [142, 92, 217];
const PINK = [255, 95, 162];
const BROWN = [139, 90, 43];
const SKY = [120, 200, 240];

// --- The 20 scenes ----------------------------------------------------------
function sun(cv, x, y, r) {
  cv.circle(x, y, r, 8, YELLOW, YELLOW);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    cv.line(x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6),
      x + Math.cos(a) * (r + 34), y + Math.sin(a) * (r + 34), 7, YELLOW);
  }
}
function grass(cv) {
  cv.scribble(20, 420, 492, 490, 60, 7, GREEN);
  cv.line(16, 452, 496, 448, 6, DARK_GREEN);
}

const SCENES = [
  { id: "D01", age: "4-5", subject: "sun/sky", colours: "yellow;blue", desc: "Big yellow sun top-left, blue sky scribbles", draw(cv) { sun(cv, 120, 110, 55); cv.scribble(40, 220, 470, 380, 26, 7, SKY); } },
  { id: "D02", age: "4-5", subject: "house", colours: "red;brown;yellow", desc: "Square house, triangle roof, door, small sun", draw(cv) { sun(cv, 420, 80, 38); cv.rect(120, 220, 220, 180, 9, BLACK); cv.triangle(100, 225, 230, 120, 360, 225, 9, RED, RED); cv.rect(210, 300, 60, 100, 8, BROWN); cv.rect(150, 250, 45, 45, 7, BLUE); } },
  { id: "D03", age: "4-5", subject: "grass/flowers", colours: "green;pink;yellow", desc: "Green grass scribbles, three flowers", draw(cv) { grass(cv); for (const [x, c] of [[120, PINK], [260, RED], [390, PURPLE]]) { cv.line(x, 420, x, 330, 7, DARK_GREEN); cv.circle(x, 310, 26, 7, c, c); cv.circle(x, 310, 10, 5, YELLOW, YELLOW); } } },
  { id: "D04", age: "4-5", subject: "car", colours: "red;black;blue", desc: "Red car side view, two wheels, window", draw(cv) { cv.rect(90, 250, 320, 90, 9, RED, RED); cv.rect(150, 190, 160, 65, 8, RED, RED); cv.rect(170, 205, 55, 40, 6, BLUE); cv.circle(160, 350, 38, 8, BLACK, BLACK); cv.circle(350, 350, 38, 8, BLACK, BLACK); cv.line(60, 390, 460, 390, 6, BLACK); } },
  { id: "D05", age: "4-5", subject: "cat", colours: "orange;black", desc: "Orange cat face, triangle ears, whiskers, body", draw(cv) { cv.circle(256, 200, 90, 9, ORANGE, ORANGE); cv.triangle(190, 140, 170, 60, 240, 120, 8, ORANGE, ORANGE); cv.triangle(320, 140, 340, 60, 270, 120, 8, ORANGE, ORANGE); cv.dot(220, 190, 8, BLACK); cv.dot(292, 190, 8, BLACK); cv.line(180, 210, 120, 195, 5, BLACK); cv.line(180, 225, 120, 235, 5, BLACK); cv.line(332, 210, 392, 195, 5, BLACK); cv.line(332, 225, 392, 235, 5, BLACK); cv.circle(256, 400, 80, 8, ORANGE); cv.line(330, 420, 420, 340, 8, ORANGE); } },
  { id: "D06", age: "4-5", subject: "rainbow", colours: "red;orange;yellow;green;blue;purple", desc: "Rainbow arcs over green grass", draw(cv) { grass(cv); const cols = [RED, ORANGE, YELLOW, GREEN, BLUE, PURPLE]; cols.forEach((c, i) => cv.arc(256, 430, 210 - i * 22, Math.PI, 2 * Math.PI, 14, c)); } },
  { id: "D07", age: "6-8", subject: "tree", colours: "brown;green;red", desc: "Tree with brown trunk, green canopy, red apples", draw(cv) { cv.rect(230, 300, 50, 140, 9, BROWN, BROWN); cv.circle(256, 220, 110, 9, GREEN, GREEN); cv.circle(180, 260, 60, 8, GREEN, GREEN); cv.circle(330, 260, 60, 8, GREEN, GREEN); for (const [x, y] of [[200, 200], [300, 180], [260, 260], [180, 290]]) cv.dot(x, y, 12, RED); grass(cv); } },
  { id: "D08", age: "6-8", subject: "boat", colours: "blue;brown;red", desc: "Sailboat on wavy sea, sun", draw(cv) { sun(cv, 90, 80, 40); cv.line(256, 330, 256, 170, 9, BROWN); cv.triangle(256, 175, 256, 320, 370, 320, 8, RED, RED); cv.triangle(250, 190, 250, 320, 160, 320, 8, YELLOW, YELLOW); cv.line(120, 350, 400, 350, 9, BROWN); cv.arc(120, 400, 40, 0, Math.PI, 7, BLUE); cv.arc(260, 410, 40, 0, Math.PI, 7, BLUE); cv.arc(390, 400, 40, 0, Math.PI, 7, BLUE); } },
  { id: "D09", age: "6-8", subject: "fish", colours: "orange;blue", desc: "Orange fish, triangle tail, bubbles, seaweed", draw(cv) { cv.circle(240, 256, 90, 9, ORANGE, ORANGE); cv.triangle(320, 256, 420, 190, 420, 320, 8, ORANGE, ORANGE); cv.dot(190, 230, 10, BLACK); cv.arc(250, 280, 30, 0.3, 2.4, 6, RED); for (const [x, y, r] of [[400, 120, 12], [430, 90, 9], [380, 70, 14]]) cv.circle(x, y, r, 5, BLUE); cv.scribble(60, 380, 140, 480, 12, 6, GREEN); } },
  { id: "D10", age: "6-8", subject: "family/people", colours: "black;red;blue", desc: "Three stick figures (tall, medium, small), sun", draw(cv) { sun(cv, 430, 80, 36); const fig = (x, h, c) => { cv.circle(x, 300 - h, 26, 8, c); cv.line(x, 274 - h, x, 360 - h + 60, 8, c); cv.line(x, 300 - h + 30, x - 40, 330 - h + 30, 7, c); cv.line(x, 300 - h + 30, x + 40, 330 - h + 30, 7, c); cv.line(x, 360 - h + 60, x - 30, 440, 7, c); cv.line(x, 360 - h + 60, x + 30, 440, 7, c); }; fig(130, 130, RED); fig(256, 90, BLUE); fig(370, 45, GREEN); cv.line(40, 445, 480, 445, 6, BLACK); } },
  { id: "D11", age: "6-8", subject: "butterfly", colours: "purple;pink;yellow", desc: "Butterfly, two big wings, antennae, flowers below", draw(cv) { cv.line(256, 180, 256, 340, 9, BLACK); cv.circle(256, 170, 22, 7, BLACK, BLACK); cv.line(246, 150, 220, 110, 6, BLACK); cv.line(266, 150, 292, 110, 6, BLACK); cv.circle(170, 230, 62, 8, PURPLE, PURPLE); cv.circle(342, 230, 62, 8, PINK, PINK); cv.circle(185, 300, 45, 7, YELLOW, YELLOW); cv.circle(327, 300, 45, 7, YELLOW, YELLOW); grass(cv); } },
  { id: "D12", age: "6-8", subject: "snowman", colours: "black;orange;red", desc: "Three-circle snowman, carrot nose, hat, scarf", draw(cv) { cv.circle(256, 390, 85, 9, BLACK); cv.circle(256, 270, 62, 9, BLACK); cv.circle(256, 175, 45, 9, BLACK); cv.triangle(256, 175, 256, 190, 320, 182, 7, ORANGE, ORANGE); cv.dot(240, 165, 6, BLACK); cv.dot(272, 165, 6, BLACK); cv.rect(220, 105, 72, 25, 8, BLACK, BLACK); cv.rect(232, 60, 48, 48, 8, BLACK, BLACK); cv.line(200, 235, 312, 235, 9, RED); cv.scribble(30, 440, 480, 490, 20, 6, SKY); } },
  { id: "D13", age: "6-8", subject: "rocket", colours: "red;blue;orange", desc: "Rocket going up, flame, stars", draw(cv) { cv.rect(216, 180, 80, 170, 9, RED, RED); cv.triangle(216, 185, 296, 185, 256, 100, 9, BLUE, BLUE); cv.circle(256, 240, 22, 7, BLUE, BLUE); cv.triangle(216, 350, 180, 410, 216, 380, 8, RED, RED); cv.triangle(296, 350, 332, 410, 296, 380, 8, RED, RED); cv.scribble(230, 400, 290, 470, 16, 7, ORANGE); for (const [x, y] of [[90, 100], [420, 140], [120, 300], [400, 320]]) cv.dot(x, y, 7, YELLOW); } },
  { id: "D14", age: "6-8", subject: "castle", colours: "grey;brown;red", desc: "Castle with two towers, flag, door", draw(cv) { cv.rect(130, 220, 250, 180, 9, BROWN); cv.rect(100, 140, 70, 260, 9, BROWN); cv.rect(340, 140, 70, 260, 9, BROWN); for (const x of [100, 130, 160, 340, 370, 400]) cv.rect(x, 118, 22, 24, 6, BROWN, BROWN); cv.line(375, 140, 375, 80, 6, BLACK); cv.triangle(375, 80, 375, 105, 415, 92, 6, RED, RED); cv.rect(225, 320, 60, 80, 8, BLACK); cv.circle(280, 360, 5, 4, YELLOW); grass(cv); } },
  { id: "D15", age: "9-10", subject: "dragon (fantasy)", colours: "green;red;orange", desc: "Green dragon, wings, long tail, fire breath", draw(cv) { cv.circle(200, 280, 70, 9, GREEN, GREEN); cv.circle(130, 230, 42, 8, GREEN, GREEN); cv.triangle(110, 195, 100, 150, 140, 180, 7, GREEN, GREEN); cv.triangle(150, 195, 150, 150, 175, 185, 7, GREEN, GREEN); cv.triangle(260, 240, 340, 160, 330, 280, 8, GREEN, GREEN); cv.triangle(240, 300, 320, 380, 270, 320, 8, GREEN, GREEN); cv.line(260, 300, 400, 380, 8, GREEN); cv.scribble(60, 210, 110, 250, 12, 7, ORANGE); cv.dot(120, 220, 7, RED); grass(cv); } },
  { id: "D16", age: "9-10", subject: "beach", colours: "yellow;blue;red", desc: "Beach: sun, sea lines, sand, striped umbrella", draw(cv) { sun(cv, 90, 80, 45); cv.line(20, 280, 492, 280, 7, BLUE); cv.arc(120, 300, 34, 0, Math.PI, 6, BLUE); cv.arc(300, 305, 34, 0, Math.PI, 6, BLUE); cv.scribble(20, 380, 492, 490, 40, 7, YELLOW); cv.line(340, 380, 340, 250, 8, BROWN); cv.triangle(260, 255, 420, 255, 340, 190, 8, RED, RED); cv.triangle(300, 255, 380, 255, 340, 190, 8, YELLOW, YELLOW); } },
  { id: "D17", age: "9-10", subject: "train", colours: "blue;red;black", desc: "Train engine + carriage, smoke circles, track", draw(cv) { cv.rect(80, 200, 180, 130, 9, BLUE, BLUE); cv.rect(280, 220, 150, 110, 9, RED, RED); cv.rect(100, 220, 50, 45, 7, SKY); cv.circle(140, 350, 30, 8, BLACK, BLACK); cv.circle(220, 350, 30, 8, BLACK, BLACK); cv.circle(340, 350, 30, 8, BLACK, BLACK); cv.line(50, 390, 470, 390, 8, BLACK); cv.line(50, 410, 470, 410, 8, BLACK); for (const [x, y, r] of [[130, 150, 22], [150, 105, 28], [180, 65, 34]]) cv.circle(x, y, r, 6, BLACK); } },
  { id: "D18", age: "9-10", subject: "dog", colours: "brown;black", desc: "Brown dog side view, floppy ear, tail, four legs", draw(cv) { cv.circle(350, 210, 55, 9, BROWN, BROWN); cv.triangle(330, 170, 315, 110, 360, 155, 8, BROWN, BROWN); cv.dot(365, 200, 8, BLACK); cv.circle(230, 280, 75, 9, BROWN, BROWN); cv.line(400, 240, 450, 180, 9, BROWN); for (const x of [180, 220, 260, 300]) cv.line(x, 330, x, 410, 9, BROWN); cv.line(60, 415, 480, 415, 6, BLACK); } },
  { id: "D19", age: "9-10", subject: "sparse: sun + line", colours: "yellow", desc: "VERY SPARSE: one small sun and a single ground line", draw(cv) { sun(cv, 130, 110, 32); cv.line(60, 420, 460, 420, 6, BLACK); } },
  { id: "D20", age: "9-10", subject: "sparse: two figures", colours: "black", desc: "VERY SPARSE: two stick figures, nothing else", draw(cv) { const fig = (x) => { cv.circle(x, 200, 24, 8, BLACK); cv.line(x, 224, x, 330, 8, BLACK); cv.line(x, 250, x - 35, 285, 7, BLACK); cv.line(x, 250, x + 35, 285, 7, BLACK); cv.line(x, 330, x - 28, 420, 7, BLACK); cv.line(x, 330, x + 28, 420, 7, BLACK); }; fig(180); fig(330); } },
];

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const rows = ["drawing_id,age_band,subject,dominant_colours,description"];
  for (const scene of SCENES) {
    const seed = Number(scene.id.slice(1)) * 7919 + 13;
    const cv = new Canvas(seed);
    scene.draw(cv);
    fs.writeFileSync(path.join(OUT, scene.id + ".png"), cv.toPng());
    const esc = (s) => '"' + String(s).replace(/"/g, '""') + '"';
    rows.push([scene.id, scene.age, esc(scene.subject), esc(scene.colours), esc(scene.desc)].join(","));
  }
  fs.writeFileSync(path.join(OUT, "metadata.csv"), rows.join("\n") + "\n");
  console.log("Wrote " + SCENES.length + " synthetic drawings to " + OUT);
  console.log("Age bands: 4-5 x6, 6-8 x8, 9-10 x6 (incl. 2 very sparse).");
}

if (require.main === module) main();
module.exports = { SCENES, OUT };
