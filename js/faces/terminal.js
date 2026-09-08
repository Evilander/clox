/* TERMINAL — green-phosphor CRT. A boot sequence types out, then the time
 * renders as chunky 5×7 pixel-block digits with scanlines, a slow refresh
 * band, subtle flicker, phosphor retention ghosting, idle diagnostics, and
 * a blinking block cursor — the whole scene barrel-warped like a curved
 * tube and masked with rounded corners. */
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

  const DIAG_LINES = [
    "> MEM 640K OK", "> SIGNAL LOCKED 60HZ", "> PHOSPHOR NOMINAL",
    "> BURN-IN GUARD ACTIVE", "> ALL DAEMONS SLEEPING", "> COFFEE NOT FOUND"
  ];

  const hash = (i) => {
    const x = Math.sin(i * 157.3 + 71.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // Boot animation restarts whenever the face was not drawn for a while.
  let bootT0 = null, lastDraw = -1e9;

  // Idle diagnostic line: fires at most once per minute.
  let diag = { key: -1, startedAt: 0, lineIdx: 0 };

  // Phosphor retention: remembers the previous glyph at each character cell
  // so a changed digit leaves a fading ghost behind it.
  let prevTimeStr = "";
  let ghostChar = [], ghostT0 = [];

  function updateRetention(str, now) {
    if (str.length !== prevTimeStr.length) {
      ghostChar = new Array(str.length).fill(null);
      ghostT0 = new Array(str.length).fill(-1e9);
    } else {
      for (let i = 0; i < str.length; i++) {
        if (str[i] !== prevTimeStr[i]) { ghostChar[i] = prevTimeStr[i]; ghostT0[i] = now; }
      }
    }
    prevTimeStr = str;
    const ghosts = [];
    for (let i = 0; i < str.length; i++) {
      const age = now - ghostT0[i];
      if (ghostChar[i] && age >= 0 && age < 300) {
        ghosts.push({ i, ch: ghostChar[i], alpha: 0.5 * (1 - age / 300) });
      }
    }
    return ghosts;
  }

  function cellOffsets(str, px) {
    const offs = [];
    let cx = 0;
    for (let i = 0; i < str.length; i++) { offs.push(cx); cx += 6.4 * px; }
    return offs;
  }

  function drawGlyph(ctx, ch, x, y, px) {
    const gl = FONT5x7[ch] ?? FONT5x7[" "];
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (gl[r][c] === "1") ctx.fillRect(x + c * px, y + r * px, px * 0.86, px * 0.86);
      }
    }
  }

  function blockText(ctx, str, x, y, px, color, blur) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    ctx.fillStyle = color;
    const offs = cellOffsets(str, px);
    for (let i = 0; i < str.length; i++) drawGlyph(ctx, str[i], x + offs[i], y, px);
    ctx.restore();
  }

  // Offscreen scene buffer: everything except the final vignette/tube mask
  // is drawn here at logical size, then blitted through the barrel-warp
  // slice loop below. Canvas/context are reused across frames (only the
  // transform is reset) to avoid per-frame allocation.
  let bufCache = { key: "", canvas: null, ctx: null, dpr: 1 };
  function releaseBufCache() {
    if (bufCache.canvas) {
      bufCache.canvas.width = 0;
      bufCache.canvas.height = 0;
    }
    bufCache = { key: "", canvas: null, ctx: null, dpr: 1 };
  }

  function getBuf(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
    if (bufCache.key !== key) {
      releaseBufCache();
      const c = document.createElement("canvas");
      c.width = Math.max(2, Math.round(w * dpr));
      c.height = Math.max(2, Math.round(h * dpr));
      bufCache = { key, canvas: c, ctx: c.getContext("2d"), dpr };
    }
    bufCache.ctx.setTransform(bufCache.dpr, 0, 0, bufCache.dpr, 0, 0);
    return bufCache;
  }

  /* Fills the sharp corner square minus its inscribed quarter-circle,
   * i.e. the wedge a rounded-corner tube mask removes. (sx,sy) is the
   * screen corner; (qx,qy) point inward, toward the canvas interior. */
  function cornerWedge(ctx, sx, sy, r, qx, qy) {
    const bx = Math.min(sx, sx + qx * r), by = Math.min(sy, sy + qy * r);
    ctx.save();
    ctx.beginPath();
    ctx.rect(bx, by, r, r);
    ctx.clip();
    ctx.fillStyle = "#000";
    ctx.fillRect(bx, by, r, r);
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(sx + qx * r, sy + qy * r, r, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  }

  function tubeCorners(ctx, W, H) {
    const r = Math.min(W, H) * 0.06;
    cornerWedge(ctx, 0, 0, r, 1, 1);
    cornerWedge(ctx, W, 0, r, -1, 1);
    cornerWedge(ctx, 0, H, r, 1, -1);
    cornerWedge(ctx, W, H, r, -1, -1);
  }

  CLOX.register({
    id: "terminal",
    name: "Terminal · CRT",

    leave() {
      releaseBufCache();
    },

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);
      // Gallery previews refresh slowly — never let them restart the boot.
      if (!settings.preview && now - lastDraw > 500) bootT0 = now;
      lastDraw = now;
      const boot = now - bootT0;

      // Phosphor flicker: deterministic pseudo-noise from the clock.
      const flick = 0.95 + 0.05 *
        (0.6 + 0.4 * Math.sin(now * 0.037) * Math.sin(now * 0.0093 + 2));

      // Plastic CRT shell and inset curved screen.
      let g = ctx.createRadialGradient(W / 2, H * 0.38, 0, W / 2, H * 0.52, Math.max(W, H) * 0.78);
      g.addColorStop(0, "#202523");
      g.addColorStop(0.55, "#0b0f0d");
      g.addColorStop(1, "#010201");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const bodyW = Math.min(W * 0.92, H * 1.62);
      const bodyH = Math.min(H * 0.86, bodyW * 0.66);
      const bodyX = (W - bodyW) / 2;
      const bodyY = (H - bodyH) / 2;
      const bezel = bodyH * 0.075;
      const screenX = bodyX + bodyW * 0.075;
      const screenY = bodyY + bodyH * 0.115;
      const screenW = bodyW * 0.85;
      const screenH = bodyH * 0.70;
      const standW = bodyW * 0.32;
      const standH = bodyH * 0.14;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.70)";
      ctx.shadowBlur = bodyH * 0.10;
      ctx.shadowOffsetY = bodyH * 0.04;
      g = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
      g.addColorStop(0, "#2d342f");
      g.addColorStop(0.12, "#1a211e");
      g.addColorStop(0.72, "#0b100e");
      g.addColorStop(1, "#060806");
      ctx.fillStyle = g;
      U.roundRect(ctx, bodyX, bodyY, bodyW, bodyH, bezel);
      ctx.fill();
      ctx.restore();
      g = ctx.createLinearGradient(bodyX, 0, bodyX + bodyW, 0);
      g.addColorStop(0, "rgba(0, 0, 0, 0.42)");
      g.addColorStop(0.14, "rgba(255, 255, 255, 0.045)");
      g.addColorStop(0.50, "rgba(255, 255, 255, 0.006)");
      g.addColorStop(0.86, "rgba(255, 255, 255, 0.030)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = g;
      U.roundRect(ctx, bodyX, bodyY, bodyW, bodyH, bezel);
      ctx.fill();
      for (let i = 0; i < 18; i++) {
        const vx = bodyX + bodyW * 0.14 + i * bodyW * 0.027;
        ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
        U.roundRect(ctx, vx, bodyY + bodyH * 0.84, bodyW * 0.012, bodyH * 0.055, bodyW * 0.003);
        ctx.fill();
      }
      g = ctx.createLinearGradient(0, bodyY + bodyH, 0, bodyY + bodyH + standH);
      g.addColorStop(0, "#0a0d0b");
      g.addColorStop(1, "#030403");
      ctx.fillStyle = g;
      U.roundRect(ctx, W / 2 - standW / 2, bodyY + bodyH * 0.94, standW, standH, standH * 0.20);
      ctx.fill();
      ctx.fillStyle = "rgba(78, 255, 135, 0.38)";
      ctx.shadowColor = "#2bff7a";
      ctx.shadowBlur = bezel * 0.25;
      ctx.font = `700 ${bezel * 0.34}px Consolas, "Courier New", monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("CLOX-220", bodyX + bodyW * 0.075, bodyY + bodyH * 0.055);
      ctx.shadowBlur = 0;

      g = ctx.createRadialGradient(screenX + screenW / 2, screenY + screenH / 2, screenH * 0.10,
        screenX + screenW / 2, screenY + screenH / 2, screenH * 0.82);
      g.addColorStop(0, "#061009");
      g.addColorStop(1, "#010302");
      ctx.fillStyle = g;
      U.roundRect(ctx, screenX, screenY, screenW, screenH, bezel * 0.42);
      ctx.fill();

      const buf = getBuf(screenW, screenH);
      const bctx = buf.ctx;

      bctx.fillStyle = "#020604";
      bctx.fillRect(0, 0, screenW, screenH);
      g = bctx.createRadialGradient(screenW / 2, screenH / 2, 0, screenW / 2, screenH / 2, Math.max(screenW, screenH) * 0.62);
      g.addColorStop(0, `rgba(20, 90, 45, ${0.16 * flick})`);
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, screenW, screenH);

      const P1 = `rgba(66, 255, 130, ${flick})`;
      const P1dim = `rgba(66, 255, 130, ${0.55 * flick})`;
      const margin = Math.min(screenW, screenH) * 0.08;
      const lineH = Math.max(18, Math.min(screenW, screenH) * 0.032);
      bctx.font = `${lineH * 0.72}px Consolas, "Courier New", monospace`;
      bctx.textAlign = "left";
      bctx.textBaseline = "top";

      // Boot lines type out at ~45 chars/sec (22ms/char).
      let budget = Math.floor(boot / 22);
      let y = margin;
      bctx.shadowColor = "#2bff7a";
      bctx.shadowBlur = lineH * 0.25;
      bctx.fillStyle = P1dim;
      for (const line of BOOT) {
        if (budget <= 0) break;
        bctx.fillText(line.slice(0, budget), margin, y);
        budget -= line.length + 1;
        y += lineH;
      }
      bctx.shadowBlur = 0;

      // Big pixel-block time, once the boot text has finished.
      let py = 0;
      if (boot > BOOT_CHARS * 22 + 250) {
        const hs = settings.h24 ? U.pad2(t.H) : String(t.h).padStart(2, " ");
        const str = hs + ":" + U.pad2(t.m) + (settings.seconds ? ":" + U.pad2(t.s) : "");
        const ghosts = updateRetention(str, now);
        const cols = str.length * 6.4 - 1.4;
        let px = Math.min((screenW * 0.84) / cols, (screenH * 0.32) / 7);
        const bw = cols * px;
        const bx = (screenW - bw) / 2, by = screenH * 0.40;

        if (ghosts.length) {
          const offs = cellOffsets(str, px);
          bctx.save();
          for (const gh of ghosts) {
            bctx.fillStyle = `rgba(66, 255, 130, ${gh.alpha})`;
            drawGlyph(bctx, gh.ch, bx + offs[gh.i], by, px);
          }
          bctx.restore();
        }
        blockText(bctx, str, bx, by, px, P1, px * 1.1);

        // Date + status line under the digits.
        bctx.font = `${lineH * 0.72}px Consolas, "Courier New", monospace`;
        bctx.shadowColor = "#2bff7a";
        bctx.shadowBlur = lineH * 0.25;
        bctx.fillStyle = P1dim;
        const dateStr = `${U.DAYS[t.day]} ${U.MONTHS[t.month]} ${U.pad2(t.date)}` +
          (settings.h24 ? "" : (t.pm ? "  [PM]" : "  [AM]"));
        bctx.fillText(dateStr, bx, by + px * 7 + lineH);

        // Prompt with blinking block cursor.
        py = by + px * 7 + lineH * 2.4;
        bctx.fillText(">", margin, py);
        if (t.ms < 500) {
          bctx.fillStyle = P1;
          bctx.fillRect(margin + lineH * 0.9, py, lineH * 0.5, lineH * 0.78);
        }
        bctx.shadowBlur = 0;

        // Idle diagnostics: a status line types itself out under the prompt
        // once per minute, deterministically, then dwells and fades.
        if (t.s === 17 && hash(t.m * 7 + t.H) < 0.35) {
          const key = t.H * 60 + t.m;
          if (diag.key !== key) {
            diag = { key, startedAt: now, lineIdx: Math.floor(hash(key + 0.5) * DIAG_LINES.length) };
          }
        }
        if (diag.key >= 0) {
          const line = DIAG_LINES[diag.lineIdx];
          const elapsed = now - diag.startedAt;
          const typeDur = line.length * 30;
          if (elapsed >= 0 && elapsed < typeDur + 4000 + 2000) {
            const shown = line.slice(0, Math.min(line.length, Math.floor(elapsed / 30)));
            let alpha = 1;
            if (elapsed > typeDur + 4000) alpha = U.clamp(1 - (elapsed - typeDur - 4000) / 2000, 0, 1);
            bctx.save();
            bctx.shadowColor = "#2bff7a";
            bctx.shadowBlur = lineH * 0.2;
            bctx.fillStyle = `rgba(66, 255, 130, ${0.7 * alpha})`;
            bctx.fillText(shown, margin, py + lineH * 1.3);
            bctx.restore();
          }
        }
      }

      // Scanlines.
      bctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      const step = Math.max(3, Math.round(screenH / 320));
      for (let sy = 0; sy < screenH; sy += step * 2) {
        bctx.fillRect(0, sy, screenW, step);
      }

      // Slow vertical refresh band (8s period).
      const bandY = ((now % 8000) / 8000) * (screenH * 1.3) - screenH * 0.15;
      g = bctx.createLinearGradient(0, bandY - screenH * 0.06, 0, bandY + screenH * 0.06);
      g.addColorStop(0, "rgba(120, 255, 170, 0)");
      g.addColorStop(0.5, "rgba(120, 255, 170, 0.045)");
      g.addColorStop(1, "rgba(120, 255, 170, 0)");
      bctx.fillStyle = g;
      bctx.fillRect(0, bandY - screenH * 0.06, screenW, screenH * 0.12);

      // Barrel-warp blit: the flat scene bulges outward like a curved tube.
      ctx.save();
      U.roundRect(ctx, screenX, screenY, screenW, screenH, bezel * 0.42);
      ctx.clip();
      const SLICES = 28;
      for (let i = 0; i < SLICES; i++) {
        const ny = ((i + 0.5) / SLICES) * 2 - 1;
        const sy = (i / SLICES) * screenH, sh = screenH / SLICES;
        const xInset = screenW * 0.018 * ny * ny;
        const destW = screenW - 2 * xInset;
        const yWarp = 1 - 0.015 * ny * ny;
        const dy = screenH / 2 + (sy - screenH / 2) * yWarp;
        const dh = sh * yWarp;
        ctx.drawImage(
          buf.canvas,
          0, sy * buf.dpr, screenW * buf.dpr, sh * buf.dpr,
          screenX + xInset, screenY + dy, destW, dh
        );
      }

      // Curved-tube vignette.
      g = ctx.createRadialGradient(screenX + screenW / 2, screenY + screenH / 2, Math.min(screenW, screenH) * 0.32,
        screenX + screenW / 2, screenY + screenH / 2, Math.max(screenW, screenH) * 0.72);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.62)");
      ctx.fillStyle = g;
      ctx.fillRect(screenX, screenY, screenW, screenH);

      // Convex glass reflections on the CRT face.
      g = ctx.createLinearGradient(screenX + screenW * 0.10, screenY, screenX + screenW * 0.78, screenY + screenH);
      g.addColorStop(0, "rgba(185, 255, 210, 0.13)");
      g.addColorStop(0.17, "rgba(185, 255, 210, 0.025)");
      g.addColorStop(0.30, "rgba(185, 255, 210, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.10)");
      ctx.fillStyle = g;
      ctx.fillRect(screenX, screenY, screenW, screenH);
      ctx.restore();

      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.82);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
