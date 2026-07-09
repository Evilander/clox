/* VFD — vacuum fluorescent display, hi-fi component style. Cyan-green
 * phosphor seven-segment digits behind dark glass, weekday indicator
 * row, faint dot-matrix texture. */
"use strict";

CLOX.register({
  id: "vfd",
  name: "VFD · Hi-Fi",

  draw(ctx, W, H, d, settings) {
    const t = U.timeParts(d, settings.h24);

    // Deep blue-black with a cool ambient glow.
    ctx.fillStyle = "#02070a";
    ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    g.addColorStop(0, "rgba(10, 90, 85, 0.16)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // ---- Layout ----
    const hs = settings.h24 ? U.pad2(t.H) : String(t.h).padStart(2, " ");
    const main = hs + ":" + U.pad2(t.m) + (settings.seconds ? ":" + U.pad2(t.s) : "");

    let dh = Math.min(H * 0.34, W * 0.24);
    const widthFor = (dhh) =>
      U.segLayout(main, dhh * 0.56, dhh, dhh * 0.14).total;
    const maxW = W * 0.78;
    if (widthFor(dh) > maxW) dh *= maxW / widthFor(dh);
    const dw = dh * 0.56, gap = dh * 0.14;

    const layout = U.segLayout(main, dw, dh, gap);
    const x0 = (W - layout.total) / 2;
    const y0 = (H - dh) / 2;

    // Dark glass panel behind the display, like a receiver front.
    const padX = dh * 0.5, padY = dh * 0.42;
    const px = x0 - padX, py = y0 - padY;
    const pw = layout.total + padX * 2, ph = dh + padY * 2;
    g = ctx.createLinearGradient(0, py, 0, py + ph);
    g.addColorStop(0, "#0a1214");
    g.addColorStop(0.5, "#050b0d");
    g.addColorStop(1, "#080f11");
    ctx.fillStyle = g;
    U.roundRect(ctx, px, py, pw, ph, dh * 0.08);
    ctx.fill();
    ctx.strokeStyle = "rgba(140, 240, 225, 0.10)";
    ctx.lineWidth = Math.max(1, dh * 0.008);
    U.roundRect(ctx, px, py, pw, ph, dh * 0.08);
    ctx.stroke();
    // Top edge highlight.
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillRect(px + dh * 0.08, py, pw - dh * 0.16, Math.max(1, dh * 0.008));

    // Dot-matrix texture inside the panel.
    ctx.save();
    U.roundRect(ctx, px, py, pw, ph, dh * 0.08);
    ctx.clip();
    ctx.fillStyle = "rgba(120, 220, 205, 0.025)";
    const dot = Math.max(2, Math.round(dh * 0.02));
    for (let yy = py; yy < py + ph; yy += dot * 3) {
      for (let xx = px; xx < px + pw; xx += dot * 3) {
        ctx.fillRect(xx, yy, dot, dot);
      }
    }

    const opt = {
      t: dh * 0.10,
      on: "#8dfff0",
      off: "rgba(90, 220, 200, 0.05)",
      core: "#eafffb",
      glow: dh * 0.13,
      glowColor: "#12ffd8"
    };

    // Digits (colons stay solid — VFD clocks rarely blink).
    let x = x0;
    for (const cell of layout.cells) {
      if (cell.ch === ":") {
        U.drawSegColon(ctx, x, y0, cell.w, dh, opt, true);
      } else {
        U.drawSevenSeg(ctx, cell.ch, x, y0, dw, dh, opt);
      }
      x += cell.w + gap;
    }

    // Weekday indicator row across the top of the panel.
    const fs = Math.max(11, dh * 0.075);
    ctx.font = `600 ${fs}px "Segoe UI", sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    const rowY = py + padY * 0.42;
    const span = pw * 0.72;
    for (let i = 0; i < 7; i++) {
      const dx = px + pw / 2 - span / 2 + (span / 6) * i;
      if (i === t.day) {
        ctx.shadowColor = opt.glowColor;
        ctx.shadowBlur = fs * 0.9;
        ctx.fillStyle = opt.on;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(120, 220, 205, 0.10)";
      }
      ctx.fillText(U.DAYS[i], dx, rowY);
    }
    ctx.shadowBlur = 0;

    // Date + AM/PM on the bottom edge of the panel.
    const rowY2 = py + ph - padY * 0.42;
    ctx.fillStyle = "rgba(141, 255, 240, 0.55)";
    ctx.shadowColor = opt.glowColor;
    ctx.shadowBlur = fs * 0.5;
    ctx.textAlign = "left";
    ctx.fillText(`${U.MONTHS[t.month]} ${U.pad2(t.date)}`, px + padX * 0.5, rowY2);
    if (!settings.h24) {
      ctx.textAlign = "right";
      ctx.fillText(t.pm ? "PM" : "AM", px + pw - padX * 0.5, rowY2);
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Vignette.
    g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
});
