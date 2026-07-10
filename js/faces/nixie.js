/* NIXIE — cold-war era nixie tube clock. Wire cathode digits with a
 * layered plasma corona (soft halo → orange sheath → white-hot core),
 * unlit cathodes stacked behind AND in front of the lit digit, per-tube
 * flicker, honeycomb anode mesh, getter spot on the dome, walnut base. */
"use strict";

(() => {
  const hash = (i) => {
    const x = Math.sin(i * 157.3 + 71.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // Honeycomb mesh is static per tube size — render once to an offscreen
  // canvas instead of stroking ~200 hexagons every frame.
  let meshCache = { key: "", canvas: null };

  function mesh(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
    if (meshCache.key === key) return meshCache.canvas;
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w * dpr));
    c.height = Math.max(2, Math.round(h * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.strokeStyle = "rgba(8, 6, 5, 0.6)";
    g.lineWidth = Math.max(1, w * 0.007);
    const r = w / 13;
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

  // Walnut base grain is also static per size — cache it the same way.
  let grainCache = { key: "", canvas: null };

  function grain(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
    if (grainCache.key === key) return grainCache.canvas;
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(w * dpr));
    c.height = Math.max(2, Math.round(h * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.lineWidth = 1;
    const rows = 18, steps = 12;
    for (let i = 0; i < rows; i++) {
      const fy = (i + 0.5) / rows * h;
      g.strokeStyle = i % 2 ? "rgba(255, 200, 130, 0.03)" : "rgba(0, 0, 0, 0.10)";
      g.beginPath();
      for (let s = 0; s <= steps; s++) {
        const x = (s / steps) * w;
        const y = fy + (hash(i * 13.7 + s) - 0.5) * h * 0.06;
        s ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
    grainCache = { key, canvas: c };
    return c;
  }

  const font = (h) => `300 ${h * 0.82}px "Segoe UI Light", "Segoe UI", Arial, sans-serif`;

  // Per-tube crossfade state, keyed by tube index: when a digit changes,
  // the old one lingers as a fading cathode beneath the new one's render.
  const tubeState = new Map();
  const FADE_MS = 260, BLOOM_MS = 120;

  function tube(ctx, x, y, w, h, digit, idx, now) {
    const domeR = w * 0.48;
    const glassTop = y - w * 0.30;

    // Plasma shimmer: each tube breathes on its own rhythm.
    const flick = 0.90 + 0.10 *
      (0.5 + 0.5 * Math.sin(now * 0.011 + idx * 17.3) * Math.sin(now * 0.0037 + idx * 5.1));

    let st = tubeState.get(idx);
    if (!st) {
      st = { digit, prev: null, t0: -Infinity };
      tubeState.set(idx, st);
    } else if (st.digit !== digit) {
      st.prev = st.digit;
      st.digit = digit;
      st.t0 = now;
    }
    const since = now - st.t0;
    const fadeP = U.clamp(since / FADE_MS, 0, 1);
    const showFade = st.prev !== null && since < FADE_MS;
    const bloomK = since < BLOOM_MS ? 1 + 0.5 * (1 - U.clamp(since / BLOOM_MS, 0, 1)) : 1;

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

    const cxp = x + w / 2, cyp = y + h * 0.56;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = font(h);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";

    // Deep ambient neon wash filling the glass around the cathode.
    g = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, h * 0.85);
    g.addColorStop(0, `rgba(255, 88, 8, ${0.26 * flick})`);
    g.addColorStop(0.5, `rgba(220, 50, 5, ${0.10 * flick})`);
    g.addColorStop(1, "rgba(200, 40, 0, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, glassTop, w, y + h - glassTop);

    // Unlit cathode stack BEHIND the lit digit: dark wires against glow.
    ctx.lineWidth = Math.max(1, h * 0.013);
    ctx.strokeStyle = "rgba(105, 70, 52, 0.13)";
    for (let n = 0; n <= 9; n++) {
      if (String(n) === digit) continue;
      ctx.strokeText(String(n), cxp, cyp);
    }

    // Cathode crossfade: the just-replaced digit lingers as a fading lit
    // cathode beneath the new one (sheath + core only, no halo — stays
    // cheap since the seconds tubes change every second).
    if (showFade) {
      ctx.save();
      ctx.globalAlpha = flick * (1 - fadeP);
      ctx.shadowColor = "#ff8c28";
      ctx.shadowBlur = h * 0.10;
      ctx.strokeStyle = "#ff8c28";
      ctx.lineWidth = Math.max(1.5, h * 0.027);
      ctx.strokeText(st.prev, cxp, cyp);
      ctx.shadowColor = "#ffb060";
      ctx.shadowBlur = h * 0.03;
      ctx.strokeStyle = "#ffedd2";
      ctx.lineWidth = Math.max(1, h * 0.011);
      ctx.strokeText(st.prev, cxp, cyp);
      ctx.restore();
    }

    // The burning digit — layered corona around a wire core. bloomK adds
    // a brief extra flare for the first BLOOM_MS after it lights.
    // 1. Wide soft halo.
    ctx.save();
    ctx.globalAlpha = flick;
    ctx.shadowColor = "#ff3800";
    ctx.shadowBlur = h * 0.30 * bloomK;
    ctx.strokeStyle = "rgba(255, 78, 5, 0.85)";
    ctx.lineWidth = Math.max(2, h * 0.052);
    ctx.strokeText(digit, cxp, cyp);
    ctx.strokeText(digit, cxp, cyp);
    // 2. Orange plasma sheath.
    ctx.shadowBlur = h * 0.10 * bloomK;
    ctx.strokeStyle = "#ff8c28";
    ctx.lineWidth = Math.max(1.5, h * 0.027);
    ctx.strokeText(digit, cxp, cyp);
    // 3. White-hot wire core.
    ctx.shadowColor = "#ffb060";
    ctx.shadowBlur = h * 0.03 * bloomK;
    ctx.strokeStyle = "#ffedd2";
    ctx.lineWidth = Math.max(1, h * 0.011);
    ctx.strokeText(digit, cxp, cyp);
    ctx.restore();

    // Unlit cathodes IN FRONT of the glow: crisp dark silhouettes that
    // partially occlude the burning digit — the signature nixie depth cue.
    ctx.lineWidth = Math.max(1, h * 0.014);
    ctx.strokeStyle = "rgba(26, 14, 8, 0.40)";
    ctx.strokeText(String((+digit + 3) % 10), cxp, cyp);
    ctx.strokeStyle = "rgba(26, 14, 8, 0.26)";
    ctx.strokeText(String((+digit + 7) % 10), cxp, cyp);

    // Anode mesh in front of the stack.
    ctx.globalAlpha = 0.55;
    ctx.drawImage(mesh(w, h), x, y, w, h);
    ctx.globalAlpha = 1;

    // Gas glows in front of the mesh too — volumetric halo over everything.
    g = ctx.createRadialGradient(cxp, cyp, 0, cxp, cyp, h * 0.5);
    g.addColorStop(0, `rgba(255, 110, 20, ${0.16 * flick})`);
    g.addColorStop(1, "rgba(255, 110, 20, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x, glassTop, w, y + h - glassTop);

    // Getter flash: dark mirror patch inside the dome.
    g = ctx.createRadialGradient(cxp - w * 0.06, glassTop + domeR * 0.55, 0,
      cxp, glassTop + domeR * 0.6, w * 0.22);
    g.addColorStop(0, "rgba(120, 135, 150, 0.30)");
    g.addColorStop(0.5, "rgba(40, 48, 58, 0.35)");
    g.addColorStop(1, "rgba(20, 24, 30, 0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cxp, glassTop + domeR * 0.6, w * 0.20, w * 0.14, 0, 0, U.TAU);
    ctx.fill();

    // Glass highlight streak.
    g = ctx.createLinearGradient(x, 0, x + w * 0.4, 0);
    g.addColorStop(0, "rgba(255, 255, 255, 0.10)");
    g.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(x + w * 0.06, glassTop + w * 0.1, w * 0.16, y + h - glassTop - w * 0.2);
    ctx.restore();

    // Socket under the tube, lit faintly by the digit above.
    const sh = h * 0.10;
    let sg = ctx.createLinearGradient(0, y + h, 0, y + h + sh);
    sg.addColorStop(0, "#241a12");
    sg.addColorStop(1, "#0c0a07");
    ctx.fillStyle = sg;
    U.roundRect(ctx, x - w * 0.06, y + h - sh * 0.2, w * 1.12, sh, sh * 0.3);
    ctx.fill();
    sg = ctx.createRadialGradient(x + w / 2, y + h, 0, x + w / 2, y + h, w * 0.5);
    sg.addColorStop(0, `rgba(255, 100, 20, ${0.12 * flick})`);
    sg.addColorStop(1, "rgba(255, 100, 20, 0)");
    ctx.fillStyle = sg;
    ctx.fillRect(x - w * 0.1, y + h - sh * 0.2, w * 1.2, sh * 1.4);

    // Three pins under the socket, seated into the walnut base.
    const pinW = w * 0.03, pinH = h * 0.035;
    ctx.fillStyle = "#1a120b";
    for (const fx of [0.3, 0.5, 0.7]) {
      U.roundRect(ctx, x + w * fx - pinW / 2, y + h + sh * 0.85, pinW, pinH, pinW * 0.3);
      ctx.fill();
    }
  }

  function neonDots(ctx, x, y, h, on, now) {
    const flick = 0.88 + 0.12 * Math.sin(now * 0.013 + 2.2);
    for (const fy of [0.36, 0.64]) {
      ctx.beginPath();
      ctx.arc(x, y + h * fy, h * 0.045, 0, U.TAU);
      if (on) {
        ctx.save();
        ctx.globalAlpha = flick;
        ctx.shadowColor = "#ff4800";
        ctx.shadowBlur = h * 0.12;
        ctx.fillStyle = "#ff8a30";
        ctx.fill();
        ctx.fill();
        ctx.shadowBlur = h * 0.03;
        ctx.fillStyle = "#ffe0b8";
        ctx.beginPath();
        ctx.arc(x, y + h * fy, h * 0.022, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = "rgba(150, 100, 70, 0.15)";
        ctx.fill();
      }
    }
  }

  CLOX.register({
    id: "nixie",
    name: "Nixie · IN-18",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);

      // Dark room, faint warm spill.
      ctx.fillStyle = "#070605";
      ctx.fillRect(0, 0, W, H);
      let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.6);
      g.addColorStop(0, "rgba(130, 55, 12, 0.16)");
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
      ctx.save();
      U.roundRect(ctx, bx, by, bw, bh, bh * 0.25);
      ctx.clip();
      ctx.drawImage(grain(bw, bh), bx, by, bw, bh);
      ctx.restore();
      ctx.fillStyle = "rgba(255, 190, 120, 0.08)";
      ctx.fillRect(bx + bh * 0.2, by, bw - bh * 0.4, Math.max(1, bh * 0.05));

      // Tubes + separators.
      let x = x0, di = 0;
      for (let gi = 0; gi < groups; gi++) {
        tube(ctx, x, y0, tw, th, digits[gi * 2], di++, now);
        x += tw + inGap;
        tube(ctx, x, y0, tw, th, digits[gi * 2 + 1], di++, now);
        x += tw;
        if (gi < groups - 1) {
          neonDots(ctx, x + groupGap / 2, y0, th, t.ms < 500, now);
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
