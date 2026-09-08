/* REDLINE — retro 80s red LED alarm clock.
 * Big italic seven-segment digits, unlit ghost segments, red bloom,
 * blinking colon, PM/ALARM indicators, segment afterglow on changes,
 * multiplex shimmer, clock-radio enclosure, smoked-acrylic window. */
"use strict";

(() => {
  // Per-cell previous character, for the brief LED afterglow on changes.
  const glowPrev = {};
  function ghostFor(key, ch, now) {
    let g = glowPrev[key];
    if (!g) { glowPrev[key] = { ch, prev: null, t0: -1e9 }; return null; }
    if (g.ch !== ch) { g.prev = g.ch; g.ch = ch; g.t0 = now; }
    const age = now - g.t0;
    if (age < 180 && g.prev && g.prev !== " " && g.prev !== ":") {
      return { ch: g.prev, a: 0.55 * (1 - age / 180) };
    }
    return null;
  }

  CLOX.register({
    id: "redline",
    name: "Redline · 80s LED",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);

      // Room-dark background with a faint warm glow bleeding from the display.
      ctx.fillStyle = "#040001";
      ctx.fillRect(0, 0, W, H);
      let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
      g.addColorStop(0, "rgba(140, 12, 4, 0.22)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      g = ctx.createLinearGradient(0, H * 0.52, 0, H);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(0.42, "rgba(20, 5, 3, 0.24)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.78)");
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.46, W, H * 0.54);

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

      // ---- Clock-radio enclosure the display sits in ----
      const caseW = Math.min(W * 0.94, Math.max(totalW + dh * 1.15, W * 0.70));
      const caseX = W / 2 - caseW / 2;
      const caseY = y0 - dh * 0.45, caseH = dh * 1.9;
      const footY = caseY + caseH - dh * 0.02;
      g = ctx.createRadialGradient(W / 2, footY, dh * 0.15, W / 2, footY + dh * 0.18, caseW * 0.58);
      g.addColorStop(0, "rgba(0, 0, 0, 0.62)");
      g.addColorStop(0.65, "rgba(0, 0, 0, 0.20)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(caseX - dh * 0.35, footY - dh * 0.12, caseW + dh * 0.7, dh * 0.54);
      // Snooze bar on top.
      g = ctx.createLinearGradient(0, caseY - dh * 0.09, 0, caseY + dh * 0.04);
      g.addColorStop(0, "#272126");
      g.addColorStop(0.45, "#171217");
      g.addColorStop(1, "#090708");
      ctx.fillStyle = g;
      U.roundRect(ctx, W / 2 - caseW * 0.15, caseY - dh * 0.085, caseW * 0.30, dh * 0.12, dh * 0.035);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
      ctx.fillRect(W / 2 - caseW * 0.15 + dh * 0.03, caseY - dh * 0.075, caseW * 0.30 - dh * 0.06, Math.max(1, dh * 0.008));
      // Body.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = dh * 0.18;
      ctx.shadowOffsetY = dh * 0.05;
      g = ctx.createLinearGradient(0, caseY, 0, caseY + caseH);
      g.addColorStop(0, "#161215");
      g.addColorStop(0.12, "#100d0f");
      g.addColorStop(1, "#0b0909");
      ctx.fillStyle = g;
      U.roundRect(ctx, caseX, caseY, caseW, caseH, dh * 0.12);
      ctx.fill();
      ctx.restore();
      // Plastic bevels: top lip, side falloff, and a recessed acrylic bay.
      g = ctx.createLinearGradient(0, caseY, 0, caseY + caseH);
      g.addColorStop(0, "rgba(255, 255, 255, 0.08)");
      g.addColorStop(0.08, "rgba(255, 255, 255, 0.018)");
      g.addColorStop(0.72, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.36)");
      ctx.fillStyle = g;
      U.roundRect(ctx, caseX, caseY, caseW, caseH, dh * 0.12);
      ctx.fill();
      g = ctx.createLinearGradient(caseX, 0, caseX + caseW, 0);
      g.addColorStop(0, "rgba(0, 0, 0, 0.46)");
      g.addColorStop(0.08, "rgba(255, 255, 255, 0.025)");
      g.addColorStop(0.50, "rgba(255, 255, 255, 0)");
      g.addColorStop(0.92, "rgba(255, 255, 255, 0.018)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.54)");
      ctx.fillStyle = g;
      U.roundRect(ctx, caseX, caseY, caseW, caseH, dh * 0.12);
      ctx.fill();
      const bayX = Math.max(caseX + dh * 0.12, x0 - dh * 0.25);
      const bayY = y0 - dh * 0.30;
      const bayW = Math.min(caseX + caseW - bayX - dh * 0.12, totalW + dh * 0.50);
      const bayH = dh * 1.58;
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
      ctx.shadowBlur = dh * 0.06;
      ctx.shadowOffsetY = dh * 0.025;
      g = ctx.createLinearGradient(0, bayY, 0, bayY + bayH);
      g.addColorStop(0, "#030202");
      g.addColorStop(0.40, "#080304");
      g.addColorStop(1, "#010101");
      ctx.fillStyle = g;
      U.roundRect(ctx, bayX, bayY, bayW, bayH, dh * 0.055);
      ctx.fill();
      ctx.restore();
      // Speaker grille, left side.
      const slotH = dh * 0.9, slotY = caseY + (caseH - slotH) / 2;
      for (let i = 0; i < 8; i++) {
        const sx = caseX + dh * 0.22 + i * dh * 0.085;
        ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
        U.roundRect(ctx, sx, slotY, dh * 0.038, slotH, dh * 0.02);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        ctx.fillRect(sx + dh * 0.038, slotY, 1, slotH);
      }
      ctx.fillStyle = "rgba(255, 80, 45, 0.045)";
      U.roundRect(ctx, caseX + dh * 0.11, slotY - dh * 0.08, dh * 0.78, slotH + dh * 0.16, dh * 0.035);
      ctx.fill();
      // Model text, bottom-right of the case.
      ctx.font = `500 ${Math.max(10, dh * 0.055)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fillText("ELECTRONIC ALARM · CLOX", caseX + caseW - dh * 0.25, caseY + caseH - dh * 0.13);
      ctx.textAlign = "left";

      const opt = {
        t: dh * 0.115,
        on: "#ff2e1c",
        off: "rgba(255, 70, 45, 0.065)",
        core: "#ffb49e",
        glow: dh * 0.16,
        glowColor: "#ff1a00"
      };
      const ghostOpt = Object.assign({}, opt, {
        off: "rgba(0, 0, 0, 0)", core: null, glow: opt.glow * 0.5
      });

      const colonOn = t.ms < 500;
      // Multiplex shimmer: each digit position breathes on its own phase.
      const shimmer = (idx) =>
        0.965 + 0.035 * Math.sin(now * 0.017 + idx * 2.1) * Math.sin(now * 0.0071 + idx);

      const drawDisplay = (ghost) => {
        let x = x0, di = 0;
        for (const cell of layout.cells) {
          if (cell.ch === ":") {
            U.drawSegColon(ctx, x, y0, cell.w, dh, opt, colonOn);
          } else {
            const gh = ghostFor(`m${di}`, cell.ch, now);
            if (gh) {
              ctx.save();
              ctx.globalAlpha *= gh.a;
              U.drawSevenSeg(ctx, gh.ch, x, y0, dw, dh, ghostOpt);
              ctx.restore();
            }
            ctx.save();
            ctx.globalAlpha *= shimmer(di);
            U.drawSevenSeg(ctx, cell.ch, x, y0, dw, dh, opt);
            ctx.restore();
            di++;
          }
          x += cell.w + gap;
        }
        if (secLayout) {
          const so = Object.assign({}, opt, {
            t: opt.t * secScale, glow: opt.glow * secScale
          });
          const sgo = Object.assign({}, so, {
            off: "rgba(0, 0, 0, 0)", core: null, glow: so.glow * 0.5
          });
          let sx = x0 + layout.total + gap * 2;
          const sy = y0 + dh * (1 - secScale);        // baseline-aligned
          let si = 0;
          for (const cell of secLayout.cells) {
            const gh = ghostFor(`s${si}`, cell.ch, now);
            if (gh) {
              ctx.save();
              ctx.globalAlpha *= gh.a;
              U.drawSevenSeg(ctx, gh.ch, sx, sy, dw * secScale, dh * secScale, sgo);
              ctx.restore();
            }
            ctx.save();
            ctx.globalAlpha *= shimmer(di + si);
            U.drawSevenSeg(ctx, cell.ch, sx, sy, dw * secScale, dh * secScale, so);
            ctx.restore();
            sx += cell.w + gap * secScale;
            si++;
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
      // The reflection dies away with distance from the case.
      const refY = y0 + dh + dh * 0.04;
      g = ctx.createLinearGradient(0, refY, 0, refY + dh * 1.1);
      g.addColorStop(0, "rgba(4, 0, 1, 0)");
      g.addColorStop(1, "rgba(4, 0, 1, 1)");
      ctx.fillStyle = g;
      ctx.fillRect(0, refY, W, dh * 1.2);

      // Smoked-acrylic window band with a top edge highlight.
      const bandY = y0 - dh * 0.22, bandH = dh * 1.44;
      g = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
      g.addColorStop(0, "rgba(255, 255, 255, 0.045)");
      g.addColorStop(0.12, "rgba(255, 255, 255, 0.012)");
      g.addColorStop(0.5, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.16)");
      ctx.fillStyle = g;
      ctx.fillRect(caseX, bandY, caseW, bandH);
      ctx.fillStyle = "rgba(255, 120, 90, 0.05)";
      ctx.fillRect(caseX, bandY, caseW, Math.max(1, dh * 0.006));
      ctx.save();
      U.roundRect(ctx, bayX, bandY, bayW, bandH, dh * 0.055);
      ctx.clip();
      g = ctx.createLinearGradient(bayX + bayW * 0.08, bandY, bayX + bayW * 0.62, bandY + bandH);
      g.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      g.addColorStop(0.18, "rgba(255, 255, 255, 0.025)");
      g.addColorStop(0.30, "rgba(255, 255, 255, 0)");
      g.addColorStop(0.74, "rgba(255, 85, 45, 0.035)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.12)");
      ctx.fillStyle = g;
      ctx.fillRect(bayX, bandY, bayW, bandH);
      ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
      ctx.beginPath();
      ctx.ellipse(bayX + bayW * 0.33, bandY + bandH * 0.12, bayW * 0.32, bandH * 0.10, -0.08, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      // Subtle scanlines across the window band.
      ctx.fillStyle = "rgba(0, 0, 0, 0.10)";
      const step = Math.max(3, Math.round(H / 360));
      for (let y = bandY; y < bandY + bandH; y += step * 2) {
        ctx.fillRect(caseX, y, caseW, step * 0.7);
      }

      // Vignette.
      g = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
