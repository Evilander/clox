/* REDLINE — retro 80s red LED alarm clock.
 * Big italic seven-segment digits, unlit ghost segments, red bloom,
 * blinking colon, PM/ALARM indicators, smoked-acrylic window. */
"use strict";

CLOX.register({
  id: "redline",
  name: "Redline · 80s LED",

  draw(ctx, W, H, d, settings) {
    const t = U.timeParts(d, settings.h24);

    // Room-dark background with a faint warm glow bleeding from the display.
    ctx.fillStyle = "#040001";
    ctx.fillRect(0, 0, W, H);
    let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
    g.addColorStop(0, "rgba(140, 12, 4, 0.22)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // ---- Layout ----
    const hs = settings.h24 ? U.pad2(t.H) : String(t.h).padStart(2, " ");
    const main = hs + ":" + U.pad2(t.m);

    let dh = Math.min(H * 0.46, W * 0.3);      // main digit height
    let dw = dh * 0.58;
    let gap = dh * 0.15;
    const secScale = 0.42;

    const widthFor = (dhh) => {
      const dww = dhh * 0.58, gg = dhh * 0.15;
      let wsum = U.segLayout(main, dww, dhh, gg).total;
      if (settings.seconds) {
        wsum += gg * 2 + U.segLayout(U.pad2(t.s), dww * secScale, dhh * secScale, gg * secScale).total;
      }
      return wsum;
    };
    const maxW = W * 0.84;
    if (widthFor(dh) > maxW) {
      dh *= maxW / widthFor(dh);
      dw = dh * 0.58;
      gap = dh * 0.15;
    }

    const layout = U.segLayout(main, dw, dh, gap);
    const secLayout = settings.seconds
      ? U.segLayout(U.pad2(t.s), dw * secScale, dh * secScale, gap * secScale)
      : null;
    const totalW = layout.total + (secLayout ? gap * 2 + secLayout.total : 0);
    const x0 = (W - totalW) / 2;
    const y0 = (H - dh) / 2;

    const opt = {
      t: dh * 0.115,
      on: "#ff2e1c",
      off: "rgba(255, 70, 45, 0.065)",
      core: "#ffb49e",
      glow: dh * 0.16,
      glowColor: "#ff1a00"
    };

    const colonOn = t.ms < 500;

    const drawDisplay = (ghost) => {
      let x = x0;
      for (const cell of layout.cells) {
        if (cell.ch === ":") {
          U.drawSegColon(ctx, x, y0, cell.w, dh, opt, colonOn);
        } else {
          U.drawSevenSeg(ctx, cell.ch, x, y0, dw, dh, opt);
        }
        x += cell.w + gap;
      }
      if (secLayout) {
        const so = Object.assign({}, opt, {
          t: opt.t * secScale, glow: opt.glow * secScale
        });
        let sx = x0 + layout.total + gap * 2;
        const sy = y0 + dh * (1 - secScale);        // baseline-aligned
        for (const cell of secLayout.cells) {
          U.drawSevenSeg(ctx, cell.ch, sx, sy, dw * secScale, dh * secScale, so);
          sx += cell.w + gap * secScale;
        }
      }
      // Indicators: PM lit dot (12h mode) + ALARM ghost, like a clock radio.
      if (!ghost) {
        const fs = Math.max(11, dh * 0.06);
        ctx.font = `600 ${fs}px "Segoe UI", sans-serif`;
        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        // Keep the indicator block on-screen even when digits span most
        // of the width (the skew shifts x left near the bottom).
        const ix = Math.max(fs * 4.2, x0 - gap * 1.4);
        if (!settings.h24) {
          ctx.fillStyle = t.pm ? opt.on : opt.off;
          ctx.shadowColor = opt.glowColor;
          ctx.shadowBlur = t.pm ? fs * 0.8 : 0;
          ctx.fillText("PM", ix, y0 + dh * 0.12);
          ctx.shadowBlur = 0;
          ctx.fillStyle = t.pm ? opt.off : opt.on;
          ctx.shadowBlur = t.pm ? 0 : fs * 0.8;
          ctx.fillText("AM", ix, y0 + dh * 0.12 + fs * 1.5);
          ctx.shadowBlur = 0;
        }
        ctx.fillStyle = opt.off;
        ctx.fillText("ALARM", ix, y0 + dh * 0.88);
        ctx.textAlign = "left";
      }
    };

    // Italic skew around display center, like slanted clock-radio digits.
    const cx = W / 2, cy = H / 2;
    const skew = () => {
      ctx.translate(cx, cy);
      ctx.transform(1, 0, -0.085, 1, 0, 0);
      ctx.translate(-cx, -cy);
    };
    ctx.save();
    skew();
    drawDisplay(false);
    ctx.restore();

    // Faint floor reflection. Skew is applied inside the flipped space so
    // the reflection's slant mirrors the display instead of drifting left.
    ctx.save();
    ctx.globalAlpha = 0.055;
    ctx.translate(0, (y0 + dh) * 2 + dh * 0.08);
    ctx.scale(1, -1);
    skew();
    drawDisplay(true);
    ctx.restore();

    // Smoked-acrylic window band with a top edge highlight.
    const bandY = y0 - dh * 0.22, bandH = dh * 1.44;
    g = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
    g.addColorStop(0, "rgba(255, 255, 255, 0.045)");
    g.addColorStop(0.12, "rgba(255, 255, 255, 0.012)");
    g.addColorStop(0.5, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.16)");
    ctx.fillStyle = g;
    ctx.fillRect(0, bandY, W, bandH);
    ctx.fillStyle = "rgba(255, 120, 90, 0.05)";
    ctx.fillRect(0, bandY, W, Math.max(1, dh * 0.006));

    // Subtle scanlines across the window band.
    ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
    const step = Math.max(3, Math.round(H / 360));
    for (let y = bandY; y < bandY + bandH; y += step * 2) {
      ctx.fillRect(0, y, W, step * 0.7);
    }

    // Vignette.
    g = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.75);
    g.addColorStop(0, "rgba(0, 0, 0, 0)");
    g.addColorStop(1, "rgba(0, 0, 0, 0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
});
