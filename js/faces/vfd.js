/* VFD — vacuum fluorescent display, hi-fi component style. Cyan-green
 * phosphor seven-segment digits behind dark glass, heater filament
 * wires, phosphor persistence on digit changes, weekday indicator row,
 * cached dot-matrix texture. */
"use strict";

(() => {
  // Panel background + dot matrix are static per size — cache them.
  let panelCache = { key: "", canvas: null };
  function releasePanelCache() {
    if (panelCache.canvas) {
      panelCache.canvas.width = 0;
      panelCache.canvas.height = 0;
    }
    panelCache = { key: "", canvas: null };
  }

  function panel(pw, ph, dh) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${Math.round(pw)}x${Math.round(ph)}@${dpr}`;
    if (panelCache.key === key) return panelCache.canvas;
    releasePanelCache();
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(pw * dpr));
    c.height = Math.max(2, Math.round(ph * dpr));
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);

    let gr = g.createLinearGradient(0, 0, 0, ph);
    gr.addColorStop(0, "#0a1214");
    gr.addColorStop(0.5, "#050b0d");
    gr.addColorStop(1, "#080f11");
    g.fillStyle = gr;
    U.roundRect(g, 0, 0, pw, ph, dh * 0.08);
    g.fill();
    g.strokeStyle = "rgba(140, 240, 225, 0.10)";
    g.lineWidth = Math.max(1, dh * 0.008);
    U.roundRect(g, 0.5, 0.5, pw - 1, ph - 1, dh * 0.08);
    g.stroke();
    // Top edge highlight.
    g.fillStyle = "rgba(255, 255, 255, 0.05)";
    g.fillRect(dh * 0.08, 0, pw - dh * 0.16, Math.max(1, dh * 0.008));
    // Dot-matrix texture.
    g.save();
    U.roundRect(g, 0, 0, pw, ph, dh * 0.08);
    g.clip();
    g.fillStyle = "rgba(120, 220, 205, 0.025)";
    const dot = Math.max(2, Math.round(dh * 0.02));
    for (let yy = 0; yy < ph; yy += dot * 3) {
      for (let xx = 0; xx < pw; xx += dot * 3) {
        g.fillRect(xx, yy, dot, dot);
      }
    }
    g.restore();
    panelCache = { key, canvas: c };
    return c;
  }

  // Per-cell previous character, for the phosphor persistence.
  const glowPrev = {};
  function ghostFor(key, ch, now) {
    let g = glowPrev[key];
    if (!g) { glowPrev[key] = { ch, prev: null, t0: -1e9 }; return null; }
    if (g.ch !== ch) { g.prev = g.ch; g.ch = ch; g.t0 = now; }
    const age = now - g.t0;
    if (age < 140 && g.prev && g.prev !== " " && g.prev !== ":") {
      return { ch: g.prev, a: 0.5 * (1 - age / 140) };
    }
    return null;
  }

  CLOX.register({
    id: "vfd",
    name: "VFD · Hi-Fi",

    leave() {
      releasePanelCache();
    },

    draw(ctx, W, H, d, settings, now) {
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
      const chassisPadX = dh * 0.42;
      const chassisPadY = dh * 0.30;
      const cx0 = px - chassisPadX;
      const cy0 = py - chassisPadY;
      const cw = pw + chassisPadX * 2;
      const ch = ph + chassisPadY * 2;

      // Hi-fi receiver chassis around the glass module.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.72)";
      ctx.shadowBlur = dh * 0.22;
      ctx.shadowOffsetY = dh * 0.06;
      g = ctx.createLinearGradient(0, cy0, 0, cy0 + ch);
      g.addColorStop(0, "#171d21");
      g.addColorStop(0.12, "#222a2f");
      g.addColorStop(0.52, "#101519");
      g.addColorStop(1, "#06090b");
      ctx.fillStyle = g;
      U.roundRect(ctx, cx0, cy0, cw, ch, dh * 0.11);
      ctx.fill();
      ctx.restore();
      g = ctx.createLinearGradient(cx0, 0, cx0 + cw, 0);
      g.addColorStop(0, "rgba(0, 0, 0, 0.45)");
      g.addColorStop(0.14, "rgba(255, 255, 255, 0.055)");
      g.addColorStop(0.50, "rgba(255, 255, 255, 0.010)");
      g.addColorStop(0.86, "rgba(255, 255, 255, 0.035)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = g;
      U.roundRect(ctx, cx0, cy0, cw, ch, dh * 0.11);
      ctx.fill();
      const rackY = cy0 + ch - dh * 0.16;
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      for (let i = 0; i < 18; i++) {
        const vx = cx0 + cw * 0.18 + (cw * 0.64 / 17) * i;
        U.roundRect(ctx, vx, rackY, dh * 0.020, dh * 0.07, dh * 0.008);
        ctx.fill();
      }
      for (const [fx, fy] of [[0.035, 0.12], [0.965, 0.12], [0.035, 0.88], [0.965, 0.88]]) {
        const bx = cx0 + cw * fx, by = cy0 + ch * fy;
        g = ctx.createRadialGradient(bx - dh * 0.015, by - dh * 0.015, 0, bx, by, dh * 0.055);
        g.addColorStop(0, "#4b555a");
        g.addColorStop(1, "#070a0c");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, dh * 0.048, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.65)";
        ctx.lineWidth = Math.max(1, dh * 0.009);
        ctx.beginPath();
        ctx.moveTo(bx - dh * 0.030, by + dh * 0.012);
        ctx.lineTo(bx + dh * 0.030, by - dh * 0.012);
        ctx.stroke();
      }
      ctx.drawImage(panel(pw, ph, dh), px, py, pw, ph);

      ctx.save();
      U.roundRect(ctx, px, py, pw, ph, dh * 0.08);
      ctx.clip();

      // Heater filament wires stretched across the digit area.
      ctx.strokeStyle = "rgba(255, 150, 90, 0.05)";
      ctx.lineWidth = 1;
      for (const fy of [0.25, 0.5, 0.75]) {
        ctx.beginPath();
        ctx.moveTo(x0 - gap, y0 + dh * fy);
        ctx.lineTo(x0 + layout.total + gap, y0 + dh * fy);
        ctx.stroke();
        ctx.fillStyle = "rgba(255, 170, 110, 0.12)";
        ctx.fillRect(x0 - gap - 1, y0 + dh * fy - 1, 2, 2);
        ctx.fillRect(x0 + layout.total + gap - 1, y0 + dh * fy - 1, 2, 2);
      }

      const opt = {
        t: dh * 0.10,
        on: "#8dfff0",
        off: "rgba(90, 220, 200, 0.05)",
        core: "#eafffb",
        glow: dh * 0.13,
        glowColor: "#12ffd8"
      };
      const ghostOpt = Object.assign({}, opt, {
        off: "rgba(0, 0, 0, 0)", core: null, glow: opt.glow * 0.4
      });

      // Digits (colons stay solid — VFD clocks rarely blink), with a
      // slight per-tube brightness drift and persistence on changes.
      let x = x0, di = 0;
      for (const cell of layout.cells) {
        if (cell.ch === ":") {
          U.drawSegColon(ctx, x, y0, cell.w, dh, opt, true);
        } else {
          const gh = ghostFor(`c${di}`, cell.ch, now);
          if (gh) {
            ctx.save();
            ctx.globalAlpha *= gh.a;
            U.drawSevenSeg(ctx, gh.ch, x, y0, dw, dh, ghostOpt);
            ctx.restore();
          }
          ctx.save();
          ctx.globalAlpha *= 0.96 + 0.04 * Math.sin(now * 0.013 + di * 3.3);
          U.drawSevenSeg(ctx, cell.ch, x, y0, dw, dh, opt);
          ctx.restore();
          di++;
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
        if (i < 6) {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(120, 220, 205, 0.15)";
          ctx.beginPath();
          ctx.arc(dx + span / 12, rowY, 1.5, 0, U.TAU);
          ctx.fill();
        }
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
      // Beveled smoked glass reflections over the active phosphor.
      g = ctx.createLinearGradient(px + pw * 0.05, py, px + pw * 0.62, py + ph);
      g.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      g.addColorStop(0.18, "rgba(255, 255, 255, 0.025)");
      g.addColorStop(0.34, "rgba(255, 255, 255, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.08)");
      ctx.fillStyle = g;
      ctx.fillRect(px, py, pw, ph);
      g = ctx.createRadialGradient(px + pw * 0.5, py + ph * 0.5, ph * 0.25, px + pw * 0.5, py + ph * 0.5, pw * 0.55);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.30)");
      ctx.fillStyle = g;
      ctx.fillRect(px, py, pw, ph);
      ctx.restore();

      // Vignette.
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
