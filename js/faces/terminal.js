/* TERMINAL — green-phosphor CRT. A boot sequence types out, then the time
 * renders as chunky 5×7 pixel-block digits with scanlines, a slow refresh
 * band, subtle flicker, and a blinking block cursor. */
"use strict";

(() => {
  const FONT5x7 = {
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
    "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
    ":": ["00000", "00100", "00000", "00000", "00100", "00000", "00000"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"]
  };

  const BOOT = [
    "CLOX TERMINAL v1.0 -- VT-220 COMPATIBLE",
    "(C) 1984 CLOX SYSTEMS. ALL RIGHTS RESERVED.",
    "",
    "> SET DISPLAY.MODE = CLOCK",
    "MODE ACCEPTED. PHOSPHOR WARM. RENDERING..."
  ];
  const BOOT_CHARS = BOOT.reduce((n, l) => n + l.length + 1, 0);

  // Boot animation restarts whenever the face was not drawn for a while.
  let bootT0 = null, lastDraw = -1e9;

  function blockText(ctx, str, x, y, px, color, blur) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    let cx = x;
    for (const ch of str) {
      const gl = FONT5x7[ch] ?? FONT5x7[" "];
      const wCells = ch === ":" ? 5 : 5;
      for (let r = 0; r < 7; r++) {
        for (let c = 0; c < 5; c++) {
          if (gl[r][c] === "1") {
            ctx.fillRect(cx + c * px, y + r * px, px * 0.86, px * 0.86);
          }
        }
      }
      cx += (wCells + 1.4) * px;
    }
    ctx.restore();
    return cx - x;
  }

  CLOX.register({
    id: "terminal",
    name: "Terminal · CRT",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);
      if (now - lastDraw > 500) bootT0 = now;
      lastDraw = now;
      const boot = now - bootT0;

      // Phosphor flicker: deterministic pseudo-noise from the clock.
      const flick = 0.95 + 0.05 *
        (0.6 + 0.4 * Math.sin(now * 0.037) * Math.sin(now * 0.0093 + 2));

      ctx.fillStyle = "#020604";
      ctx.fillRect(0, 0, W, H);
      let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.62);
      g.addColorStop(0, `rgba(20, 90, 45, ${0.16 * flick})`);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const P1 = `rgba(66, 255, 130, ${flick})`;
      const P1dim = `rgba(66, 255, 130, ${0.55 * flick})`;
      const margin = Math.min(W, H) * 0.08;
      const lineH = Math.max(18, Math.min(W, H) * 0.032);
      ctx.font = `${lineH * 0.72}px Consolas, "Courier New", monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";

      // Boot lines type out at ~28 chars/sec.
      let budget = Math.floor(boot / 22);
      let y = margin;
      ctx.shadowColor = "#2bff7a";
      ctx.shadowBlur = lineH * 0.25;
      ctx.fillStyle = P1dim;
      for (const line of BOOT) {
        if (budget <= 0) break;
        ctx.fillText(line.slice(0, budget), margin, y);
        budget -= line.length + 1;
        y += lineH;
      }
      ctx.shadowBlur = 0;

      // Big pixel-block time, once the boot text has finished.
      if (boot > BOOT_CHARS * 22 + 250) {
        const hs = settings.h24 ? U.pad2(t.H) : String(t.h).padStart(2, " ");
        const str = hs + ":" + U.pad2(t.m) + (settings.seconds ? ":" + U.pad2(t.s) : "");
        const cols = str.length * 6.4 - 1.4;
        let px = Math.min((W * 0.84) / cols, (H * 0.30) / 7);
        const bw = cols * px;
        const bx = (W - bw) / 2, by = H * 0.40;
        blockText(ctx, str, bx, by, px, P1, px * 1.1);

        // Date + status line under the digits.
        ctx.font = `${lineH * 0.72}px Consolas, "Courier New", monospace`;
        ctx.shadowColor = "#2bff7a";
        ctx.shadowBlur = lineH * 0.25;
        ctx.fillStyle = P1dim;
        const dateStr = `${U.DAYS[t.day]} ${U.MONTHS[t.month]} ${U.pad2(t.date)}` +
          (settings.h24 ? "" : (t.pm ? "  [PM]" : "  [AM]"));
        ctx.fillText(dateStr, bx, by + px * 7 + lineH);

        // Prompt with blinking block cursor.
        const py = by + px * 7 + lineH * 2.4;
        ctx.fillText(">", margin, py);
        if (t.ms < 500) {
          ctx.fillStyle = P1;
          ctx.fillRect(margin + lineH * 0.9, py, lineH * 0.5, lineH * 0.78);
        }
        ctx.shadowBlur = 0;
      }

      // Scanlines.
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      const step = Math.max(3, Math.round(H / 320));
      for (let sy = 0; sy < H; sy += step * 2) {
        ctx.fillRect(0, sy, W, step);
      }

      // Slow vertical refresh band (8s period).
      const bandY = ((now % 8000) / 8000) * (H * 1.3) - H * 0.15;
      g = ctx.createLinearGradient(0, bandY - H * 0.06, 0, bandY + H * 0.06);
      g.addColorStop(0, "rgba(120, 255, 170, 0)");
      g.addColorStop(0.5, "rgba(120, 255, 170, 0.045)");
      g.addColorStop(1, "rgba(120, 255, 170, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, bandY - H * 0.06, W, H * 0.12);

      // Curved-tube vignette.
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.32, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.62)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
