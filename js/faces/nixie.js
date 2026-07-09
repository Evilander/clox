/* NIXIE — cold-war era nixie tube clock. Glass tubes on a walnut base,
 * faint unlit cathode stack behind the lit digit, honeycomb anode mesh,
 * warm orange glow, neon-dot separators. */
"use strict";

(() => {
  // Honeycomb mesh is static per tube size — render once to an offscreen
  // canvas instead of stroking ~200 hexagons every frame.
  let meshCache = { key: "", canvas: null };

  function mesh(w, h) {
    const key = `${Math.round(w)}x${Math.round(h)}`;
    if (meshCache.key === key) return meshCache.canvas;
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w));
    c.height = Math.max(2, Math.round(h));
    const g = c.getContext("2d");
    g.strokeStyle = "rgba(10, 8, 6, 0.55)";
    g.lineWidth = Math.max(1, w * 0.008);
    const r = w / 10;
    const dy = r * 1.5, dx = r * Math.sqrt(3);
    for (let row = -1; row * dy < h + r * 2; row++) {
      for (let col = -1; col * dx < w + r * 2; col++) {
        const x = col * dx + (row % 2 ? dx / 2 : 0);
        const y = row * dy;
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = Math.PI / 6 + (i / 6) * Math.PI * 2;
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
          i ? g.lineTo(px, py) : g.moveTo(px, py);
        }
        g.closePath();
        g.stroke();
      }
    }
    meshCache = { key, canvas: c };
    return c;
  }

  function tube(ctx, x, y, w, h, digit) {
    const domeR = w * 0.48;
    const glassTop = y - w * 0.30;

    // Glass envelope.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, glassTop + domeR);
    ctx.arc(x + w / 2, glassTop + domeR, domeR, Math.PI, 0);
    ctx.lineTo(x + w, y + h);
    ctx.closePath();

    let g = ctx.createLinearGradient(x, 0, x + w, 0);
    g.addColorStop(0, "rgba(120, 130, 140, 0.10)");
    g.addColorStop(0.18, "rgba(200, 210, 220, 0.03)");
    g.addColorStop(0.5, "rgba(60, 70, 80, 0.05)");
    g.addColorStop(0.85, "rgba(200, 210, 220, 0.045)");
    g.addColorStop(1, "rgba(120, 130, 140, 0.10)");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(190, 205, 220, 0.16)";
    ctx.lineWidth = Math.max(1, w * 0.02);
    ctx.stroke();
    ctx.clip(); // everything inside the glass from here on

    const font = `${h * 0.86}px Georgia, "Times New Roman", serif`;
    const cxp = x + w / 2, cyp = y + h * 0.56;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font;

    // Unlit cathode stack: all ten digits, barely visible.
    ctx.lineWidth = Math.max(1, h * 0.012);
    ctx.strokeStyle = "rgba(150, 120, 100, 0.055)";
    for (let n = 0; n <= 9; n++) {
      if (String(n) === digit) continue;
      ctx.strokeText(String(n), cxp, cyp);
    }

    // Lit digit: layered glow, wire stroke, hot core.
    ctx.shadowColor = "#ff5a00";
    ctx.shadowBlur = h * 0.22;
    ctx.strokeStyle = "#ff7a1a";
    ctx.lineWidth = Math.max(1.5, h * 0.022);
    ctx.strokeText(digit, cxp, cyp);
    ctx.strokeText(digit, cxp, cyp);
    ctx.shadowBlur = h * 0.06;
    ctx.strokeStyle = "#ffc98f";
    ctx.lineWidth = Math.max(1, h * 0.010);
    ctx.strokeText(digit, cxp, cyp);
    ctx.shadowBlur = 0;

    // Ambient orange wash inside the glass.
    g = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, h * 0.75);
    g.addColorStop(0, "rgba(255, 110, 20, 0.16)");
    g.addColorStop(1, "rgba(255, 110, 20, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, glassTop, w, y + h - glassTop);

    // Anode mesh in front of the digit.
    ctx.globalAlpha = 0.5;
    ctx.drawImage(mesh(w, h), x, y);
    ctx.globalAlpha = 1;

    // Glass highlight streak.
    g = ctx.createLinearGradient(x, 0, x + w * 0.4, 0);
    g.addColorStop(0, "rgba(255, 255, 255, 0.10)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x + w * 0.06, glassTop + w * 0.1, w * 0.16, y + h - glassTop - w * 0.2);
    ctx.restore();

    // Socket under the tube.
    const sh = h * 0.10;
    let sg = ctx.createLinearGradient(0, y + h, 0, y + h + sh);
    sg.addColorStop(0, "#1b1611");
    sg.addColorStop(1, "#0c0a07");
    ctx.fillStyle = sg;
    U.roundRect(ctx, x - w * 0.06, y + h - sh * 0.2, w * 1.12, sh, sh * 0.3);
    ctx.fill();
  }

  function neonDots(ctx, x, y, h, on) {
    for (const fy of [0.36, 0.64]) {
      ctx.beginPath();
      ctx.arc(x, y + h * fy, h * 0.045, 0, U.TAU);
      if (on) {
        ctx.shadowColor = "#ff5a00";
        ctx.shadowBlur = h * 0.10;
        ctx.fillStyle = "#ff8a30";
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(150, 100, 70, 0.15)";
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  CLOX.register({
    id: "nixie",
    name: "Nixie · IN-18",

    draw(ctx, W, H, d, settings) {
      const t = U.timeParts(d, settings.h24);

      // Dark room, faint warm spill.
      ctx.fillStyle = "#070605";
      ctx.fillRect(0, 0, W, H);
      let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
      g.addColorStop(0, "rgba(120, 60, 15, 0.14)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const digits = (settings.h24 ? U.pad2(t.H) : U.pad2(t.h)) + U.pad2(t.m)
        + (settings.seconds ? U.pad2(t.s) : "");
      const groups = digits.length / 2;

      let th = Math.min(H * 0.42, W * 0.28);            // tube height
      let tw = th * 0.60;
      let inGap = tw * 0.18, groupGap = tw * 0.55;
      const total = () =>
        groups * (tw * 2 + inGap) + (groups - 1) * groupGap;
      const maxW = W * 0.86;
      if (total() > maxW) {
        const k = maxW / total();
        th *= k; tw *= k; inGap *= k; groupGap *= k;
      }

      const x0 = (W - total()) / 2;
      const y0 = (H - th) / 2;

      // Walnut base under all tubes.
      const bx = x0 - tw * 0.5, bw = total() + tw, by = y0 + th + th * 0.06, bh = th * 0.16;
      g = ctx.createLinearGradient(0, by, 0, by + bh);
      g.addColorStop(0, "#4a2f1b");
      g.addColorStop(0.15, "#3a2413");
      g.addColorStop(1, "#20130a");
      ctx.fillStyle = g;
      U.roundRect(ctx, bx, by, bw, bh, bh * 0.25);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 190, 120, 0.08)";
      ctx.fillRect(bx + bh * 0.2, by, bw - bh * 0.4, Math.max(1, bh * 0.05));

      // Tubes + separators.
      let x = x0;
      for (let gi = 0; gi < groups; gi++) {
        tube(ctx, x, y0, tw, th, digits[gi * 2]);
        x += tw + inGap;
        tube(ctx, x, y0, tw, th, digits[gi * 2 + 1]);
        x += tw;
        if (gi < groups - 1) {
          neonDots(ctx, x + groupGap / 2, y0, th, t.ms < 500);
          x += groupGap;
        }
      }

      // Vignette.
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.72);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
