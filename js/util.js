/* clox shared utilities + face registry.
 * Classic script (no ESM) so the app runs from file:// with no server. */
"use strict";

window.CLOX = window.CLOX || {
  faces: [],
  register(face) { this.faces.push(face); }
};

const U = (() => {
  const TAU = Math.PI * 2;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOutCubic = t =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const easeOutBack = t => {
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* Time decomposition. h respects the 12/24h setting; fs/fm/fh are
   * fractional (ms-continuous) seconds/minutes/hours for sweep motion. */
  function timeParts(d, h24) {
    const H = d.getHours();
    const m = d.getMinutes();
    const s = d.getSeconds();
    const ms = d.getMilliseconds();
    const fs = s + ms / 1000;
    const fm = m + fs / 60;
    const fh = (H % 12) + fm / 60;
    return {
      H, m, s, ms, fs, fm, fh,
      h: h24 ? H : (H % 12) || 12,
      pm: H >= 12,
      day: d.getDay(),
      date: d.getDate(),
      month: d.getMonth()
    };
  }

  const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",
                  "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  const pad2 = n => String(n).padStart(2, "0");

  /* ---------- Seven-segment display renderer ----------
   * Shared by the REDLINE (LED) and VFD faces. Digits are drawn as
   * classic hexagonal segments with visible unlit "ghost" segments,
   * which is what sells the vintage-display look. */

  const SEG_MAP = {
    "0": "abcdef", "1": "bc", "2": "abdeg", "3": "abcdg", "4": "bcfg",
    "5": "acdfg", "6": "acdefg", "7": "abc", "8": "abcdefg", "9": "abcdfg",
    "-": "g", " ": ""
  };

  function segHex(ctx, x1, y1, x2, y2, t) {
    const ht = t / 2;
    ctx.beginPath();
    if (y1 === y2) {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + ht, y1 - ht);
      ctx.lineTo(x2 - ht, y1 - ht);
      ctx.lineTo(x2, y1);
      ctx.lineTo(x2 - ht, y1 + ht);
      ctx.lineTo(x1 + ht, y1 + ht);
    } else {
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + ht, y1 + ht);
      ctx.lineTo(x1 + ht, y2 - ht);
      ctx.lineTo(x1, y2);
      ctx.lineTo(x1 - ht, y2 - ht);
      ctx.lineTo(x1 - ht, y1 + ht);
    }
    ctx.closePath();
  }

  /* Segment endpoints for a digit cell at (x, y) sized w×h. */
  function segLines(x, y, w, h, t) {
    const ht = t / 2, g = t * 0.38;
    const L = x + ht, R = x + w - ht;
    const T = y + ht, M = y + h / 2, B = y + h - ht;
    return {
      a: [L + g, T, R - g, T],
      b: [R, T + g, R, M - g * 0.7],
      c: [R, M + g * 0.7, R, B - g],
      d: [L + g, B, R - g, B],
      e: [L, M + g * 0.7, L, B - g],
      f: [L, T + g, L, M - g * 0.7],
      g: [L + g, M, R - g, M]
    };
  }

  /* Draw one seven-seg digit. opt: { t, on, off, glow, glowColor, core } */
  function drawSevenSeg(ctx, ch, x, y, w, h, opt) {
    const lines = segLines(x, y, w, h, opt.t);
    const lit = SEG_MAP[ch] ?? "";

    ctx.save();
    ctx.shadowBlur = 0;
    ctx.fillStyle = opt.off;
    for (const k of "abcdefg") {
      segHex(ctx, ...lines[k], opt.t);
      ctx.fill();
    }
    ctx.shadowColor = opt.glowColor;
    ctx.shadowBlur = opt.glow;
    ctx.fillStyle = opt.on;
    for (const k of lit) {
      segHex(ctx, ...lines[k], opt.t);
      ctx.fill();
      ctx.fill(); // double fill = brighter bloom
    }
    if (opt.core) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = opt.core;
      for (const k of lit) {
        const [x1, y1, x2, y2] = lines[k];
        const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
        segHex(ctx,
          cx + (x1 - cx) * 0.62, cy + (y1 - cy) * 0.62,
          cx + (x2 - cx) * 0.62, cy + (y2 - cy) * 0.62,
          opt.t * 0.45);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* Colon between digit cells: two dots, optionally blinked off. */
  function drawSegColon(ctx, x, y, w, h, opt, on) {
    const r = opt.t * 0.55;
    ctx.save();
    for (const fy of [0.32, 0.68]) {
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h * fy, r, 0, TAU);
      if (on) {
        ctx.shadowColor = opt.glowColor;
        ctx.shadowBlur = opt.glow;
        ctx.fillStyle = opt.on;
        ctx.fill();
        ctx.fill();
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = opt.off;
        ctx.fill();
      }
    }
    ctx.restore();
  }

  /* Lay out a string of digits/colons; returns cells for custom passes.
   * Each char is 'd' (digit width) or ':' (narrower). */
  function segLayout(str, digitW, digitH, gap) {
    const colonW = digitW * 0.42;
    let total = 0;
    const cells = [];
    for (const ch of str) {
      const cw = ch === ":" ? colonW : digitW;
      cells.push({ ch, x: total, w: cw });
      total += cw + gap;
    }
    total -= gap;
    return { cells, total, digitH };
  }

  return {
    TAU, clamp, lerp, easeOutCubic, easeInOutCubic, easeOutBack,
    roundRect, timeParts, DAYS, MONTHS, pad2,
    drawSevenSeg, drawSegColon, segLayout
  };
})();
