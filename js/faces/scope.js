/* SCOPE — an analog XY oscilloscope tracing the time. The digits are
 * vector strokes drawn by a beam onto a persistence layer (real fading
 * phosphor, not a font), with a bright beam dot racing the trace, a
 * graticule, front-panel knobs, and a corner Lissajous figure whose
 * phase completes one turn per minute — the seconds, as physics. */
"use strict";

(() => {
  // Skeletal vector digits: arrays of strokes, points in a 0.62×1 box.
  const VEC = {
    "0": [[0.08, 0.20, 0.31, 0.05, 0.54, 0.20, 0.54, 0.80, 0.31, 0.95, 0.08, 0.80, 0.08, 0.20],
          [0.13, 0.74, 0.49, 0.26]],
    "1": [[0.16, 0.20, 0.34, 0.05, 0.34, 0.95], [0.16, 0.95, 0.52, 0.95]],
    "2": [[0.08, 0.24, 0.18, 0.07, 0.44, 0.07, 0.54, 0.24, 0.49, 0.44, 0.08, 0.95, 0.55, 0.95]],
    "3": [[0.08, 0.07, 0.52, 0.07, 0.30, 0.42, 0.50, 0.52, 0.55, 0.74, 0.36, 0.95, 0.12, 0.90, 0.06, 0.78]],
    "4": [[0.44, 0.95, 0.44, 0.06, 0.07, 0.64, 0.58, 0.64]],
    "5": [[0.52, 0.07, 0.11, 0.07, 0.09, 0.47, 0.34, 0.40, 0.54, 0.55, 0.53, 0.80, 0.33, 0.95, 0.09, 0.88]],
    "6": [[0.50, 0.09, 0.24, 0.18, 0.10, 0.46, 0.10, 0.80, 0.31, 0.96, 0.50, 0.83, 0.53, 0.62, 0.33, 0.49, 0.12, 0.56]],
    "7": [[0.07, 0.07, 0.56, 0.07, 0.26, 0.95]],
    "8": [[0.31, 0.48, 0.13, 0.38, 0.13, 0.16, 0.31, 0.05, 0.49, 0.16, 0.49, 0.38, 0.31, 0.48,
           0.10, 0.60, 0.10, 0.84, 0.31, 0.96, 0.52, 0.84, 0.52, 0.60, 0.31, 0.48]],
    "9": [[0.12, 0.91, 0.38, 0.82, 0.52, 0.54, 0.52, 0.20, 0.31, 0.04, 0.12, 0.17, 0.09, 0.38, 0.29, 0.51, 0.50, 0.44]],
    ":": [[0.26, 0.30, 0.32, 0.34, 0.26, 0.38, 0.20, 0.34, 0.26, 0.30],
          [0.26, 0.62, 0.32, 0.66, 0.26, 0.70, 0.20, 0.66, 0.26, 0.62]],
    " ": []
  };
  const CHAR_W = { ":": 0.34, " ": 0.5 };

  const hash = (i) => {
    const x = Math.sin(i * 71.3 + 19.7) * 43758.5453;
    return x - Math.floor(x);
  };

  let phosphor = { key: "", canvas: null, ctx: null };
  let grat = { key: "", canvas: null };
  let trace = { key: "", strokes: null, flat: null };

  function releaseLayer(layer) {
    if (layer.canvas) {
      layer.canvas.width = 0;
      layer.canvas.height = 0;
    }
  }

  function releaseScopeCaches() {
    releaseLayer(phosphor);
    releaseLayer(grat);
    phosphor = { key: "", canvas: null, ctx: null };
    grat = { key: "", canvas: null };
  }

  function ensureLayers(w, h) {
    const key = `${Math.round(w)}x${Math.round(h)}@${Math.min(window.devicePixelRatio || 1, 2)}`;
    if (phosphor.key !== key) {
      releaseLayer(phosphor);
      const c = document.createElement("canvas");
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = Math.max(2, Math.round(w * dpr));
      c.height = Math.max(2, Math.round(h * dpr));
      const g = c.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      phosphor = { key, canvas: c, ctx: g, dpr };
    }
  }

  function graticule(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}`;
    if (grat.key === key) return grat.canvas;
    releaseLayer(grat);
    const c = document.createElement("canvas");
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.strokeStyle = "rgba(130, 255, 185, 0.09)";
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 1; i < 10; i++) { g.moveTo((w / 10) * i, 0); g.lineTo((w / 10) * i, h); }
    for (let i = 1; i < 8; i++) { g.moveTo(0, (h / 8) * i); g.lineTo(w, (h / 8) * i); }
    g.stroke();
    g.strokeStyle = "rgba(130, 255, 185, 0.16)";
    g.beginPath();
    g.moveTo(w / 2, 0); g.lineTo(w / 2, h);
    g.moveTo(0, h / 2); g.lineTo(w, h / 2);
    g.stroke();
    // Fine ticks along the center axes.
    g.beginPath();
    for (let i = 0; i < 50; i++) {
      g.moveTo((w / 50) * i, h / 2 - 3); g.lineTo((w / 50) * i, h / 2 + 3);
    }
    for (let i = 0; i < 40; i++) {
      g.moveTo(w / 2 - 3, (h / 40) * i); g.lineTo(w / 2 + 3, (h / 40) * i);
    }
    g.stroke();
    grat = { key, canvas: c };
    return c;
  }

  /* Build the full beam path for a time string: screen-space strokes. */
  function buildStrokes(str, sx, sy, scale) {
    const strokes = [];
    let x = sx;
    for (const ch of str) {
      const w = (CHAR_W[ch] ?? 0.62) * scale;
      for (const st of (VEC[ch] ?? [])) {
        const pts = [];
        for (let i = 0; i < st.length; i += 2) {
          pts.push([x + st[i] * scale, sy + st[i + 1] * scale]);
        }
        strokes.push(pts);
      }
      x += w + scale * 0.16;
    }
    return strokes;
  }

  const strWidth = (str, scale) => {
    let w = 0;
    for (const ch of str) w += (CHAR_W[ch] ?? 0.62) * scale + scale * 0.16;
    return w - scale * 0.16;
  };

  CLOX.register({
    id: "scope",
    name: "Scope · Vector Phosphor",

    leave() {
      releaseScopeCaches();
    },

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);

      // Instrument body.
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#22242a");
      g.addColorStop(0.5, "#191b20");
      g.addColorStop(1, "#101115");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      g = ctx.createLinearGradient(0, H * 0.62, 0, H);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(0.45, "rgba(7, 8, 10, 0.34)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.78)");
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.56, W, H * 0.44);

      const scrW = Math.min(W * 0.76, H * 1.10);
      const scrH = scrW * 0.72;
      const sx = (W - scrW) / 2, sy = (H - scrH) / 2 - H * 0.045;
      const bez = Math.min(W, H) * 0.035;

      g = ctx.createRadialGradient(W / 2, sy + scrH + bez * 2, bez, W / 2, sy + scrH + bez * 3, scrW * 0.55);
      g.addColorStop(0, "rgba(0, 0, 0, 0.72)");
      g.addColorStop(0.70, "rgba(0, 0, 0, 0.22)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx - bez * 2.6, sy + scrH + bez * 0.6, scrW + bez * 5.2, bez * 4.4);

      // Bezel plate + screws + branding.
      g = ctx.createLinearGradient(0, sy - bez * 1.6, 0, sy + scrH + bez * 1.6);
      g.addColorStop(0, "#2d3038");
      g.addColorStop(1, "#1a1c22");
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = bez;
      ctx.fillStyle = g;
      U.roundRect(ctx, sx - bez * 1.6, sy - bez * 1.6, scrW + bez * 3.2, scrH + bez * 3.2, bez);
      ctx.fill();
      ctx.restore();
      g = ctx.createLinearGradient(sx - bez * 1.6, 0, sx + scrW + bez * 1.6, 0);
      g.addColorStop(0, "rgba(0, 0, 0, 0.44)");
      g.addColorStop(0.13, "rgba(255, 255, 255, 0.045)");
      g.addColorStop(0.50, "rgba(255, 255, 255, 0.010)");
      g.addColorStop(0.87, "rgba(255, 255, 255, 0.034)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = g;
      U.roundRect(ctx, sx - bez * 1.6, sy - bez * 1.6, scrW + bez * 3.2, scrH + bez * 3.2, bez);
      ctx.fill();
      for (const side of [-1, 1]) {
        const hx = side < 0 ? sx - bez * 2.55 : sx + scrW + bez * 1.75;
        const hy = sy + scrH * 0.21;
        g = ctx.createLinearGradient(hx, 0, hx + bez * 0.8, 0);
        g.addColorStop(0, side < 0 ? "#06070a" : "#2b2f37");
        g.addColorStop(1, side < 0 ? "#2b2f37" : "#06070a");
        ctx.fillStyle = g;
        U.roundRect(ctx, hx, hy, bez * 0.78, scrH * 0.58, bez * 0.22);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.055)";
        U.roundRect(ctx, hx + bez * 0.16, hy + bez * 0.28, bez * 0.46, scrH * 0.58 - bez * 0.56, bez * 0.16);
        ctx.fill();
      }
      for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const scx = sx - bez * 0.9 + fx * (scrW + bez * 1.8);
        const scy = sy - bez * 0.9 + fy * (scrH + bez * 1.8);
        g = ctx.createRadialGradient(scx - 2, scy - 2, 0, scx, scy, bez * 0.30);
        g.addColorStop(0, "#4a4e58");
        g.addColorStop(1, "#15161a");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(scx, scy, bez * 0.30, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.6)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(scx - bez * 0.18, scy + bez * (fx ? 0.12 : -0.12));
        ctx.lineTo(scx + bez * 0.18, scy - bez * (fx ? 0.12 : -0.12));
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(220, 225, 235, 0.5)";
      ctx.font = `600 ${bez * 0.5}px "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("CLOX  ·  CX-2026 VECTOR MONITOR", sx, sy - bez * 0.85);
      // Power LED.
      ctx.save();
      ctx.shadowColor = "#ff5030";
      ctx.shadowBlur = bez * 0.4;
      ctx.fillStyle = "#ff6a40";
      ctx.beginPath();
      ctx.arc(sx + scrW - bez * 0.2, sy - bez * 0.85, bez * 0.14, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      // Screen well.
      g = ctx.createRadialGradient(sx + scrW / 2, sy + scrH / 2, scrH * 0.2,
        sx + scrW / 2, sy + scrH / 2, scrH * 0.85);
      g.addColorStop(0, "#061309");
      g.addColorStop(1, "#020805");
      ctx.fillStyle = g;
      U.roundRect(ctx, sx, sy, scrW, scrH, bez * 0.8);
      ctx.fill();
      g = ctx.createRadialGradient(sx + scrW / 2, sy + scrH / 2, scrH * 0.35,
        sx + scrW / 2, sy + scrH / 2, scrH * 0.68);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.42)");
      ctx.fillStyle = g;
      U.roundRect(ctx, sx, sy, scrW, scrH, bez * 0.8);
      ctx.fill();

      ctx.save();
      U.roundRect(ctx, sx, sy, scrW, scrH, bez * 0.8);
      ctx.clip();
      ctx.drawImage(graticule(scrW, scrH), sx, sy, scrW, scrH);

      // ---- Phosphor layer: fade a little, then trace this frame ----
      ensureLayers(scrW, scrH);
      const ph = phosphor.ctx;
      ph.save();
      ph.globalCompositeOperation = "destination-out";
      ph.fillStyle = "rgba(0, 0, 0, 0.085)";
      ph.fillRect(0, 0, scrW, scrH);
      ph.restore();

      const hs = settings.h24 ? U.pad2(t.H) : String(t.h);
      const str = `${hs}:${U.pad2(t.m)}`;
      const scale = Math.min(scrH * 0.52, (scrW * 0.86) / (strWidth(str, 1)));
      const tx = (scrW - strWidth(str, scale)) / 2;
      const ty = scrH * 0.5 - scale * 0.5;

      // Vertical-roll glitch every ~20s, brief.
      const gl = hash(Math.floor(now / 4000));
      const glitching = gl < 0.18 && (now % 4000) < 620;
      const roll = glitching ? Math.sin((now % 4000) * 0.02) * scrH * 0.02 : 0;

      // Trace geometry only changes with the time string or layout —
      // cache it (the roll is applied as a translate at draw time).
      const traceKey = `${str}|${settings.h24 ? "24" : (t.pm ? "P" : "A")}|${Math.round(scale)}|${Math.round(tx)}|${Math.round(ty)}`;
      if (trace.key !== traceKey) {
        const strokes = buildStrokes(str, tx, ty, scale);
        if (!settings.h24) {
          // AM/PM marker as a tiny vector tag next to the digits.
          const tag = t.pm ? [[0, 0, 0, 1], [0, 0, 0.5, 0, 0.55, 0.22, 0.5, 0.44, 0, 0.44]]  // P
                           : [[0, 1, 0.28, 0, 0.56, 1], [0.12, 0.62, 0.44, 0.62]];           // A
          const ts = scale * 0.16;
          for (const st of tag) {
            const pts = [];
            for (let i = 0; i < st.length; i += 2) {
              pts.push([tx + strWidth(str, scale) + ts * 0.6 + st[i] * ts,
                ty + scale - ts * 1.05 + st[i + 1] * ts]);
            }
            strokes.push(pts);
          }
        }
        const flat = [];
        for (const pts of strokes) {
          for (let k = 0; k + 1 < pts.length; k++) flat.push([pts[k], pts[k + 1]]);
        }
        trace = { key: traceKey, strokes, flat };
      }
      const strokes = trace.strokes;

      ph.save();
      ph.globalCompositeOperation = "lighter";
      ph.translate(0, roll);
      ph.lineJoin = "round";
      ph.lineCap = "round";
      const wob = (i, k) => Math.sin(now * 0.011 + i * 3.1 + k * 7.7) * scrH * 0.0018;
      // Two passes: soft halo + bright core, with a little hum wobble.
      for (const [lw, col] of [
        [scrH * 0.012, "rgba(80, 220, 140, 0.10)"],
        [scrH * 0.004, "rgba(160, 255, 190, 0.5)"]
      ]) {
        ph.strokeStyle = col;
        ph.lineWidth = lw;
        for (let si = 0; si < strokes.length; si++) {
          const pts = strokes[si];
          ph.beginPath();
          pts.forEach(([x, y], k) => {
            const xx = x + wob(si, k), yy = y + wob(si + 40, k);
            k ? ph.lineTo(xx, yy) : ph.moveTo(xx, yy);
          });
          ph.stroke();
        }
      }

      // Beam dot racing the whole trace (~1.2s per lap).
      const flat = trace.flat;
      if (flat.length) {
        const u = (now % 1200) / 1200 * flat.length;
        const seg = flat[Math.floor(u) % flat.length];
        const fp = u % 1;
        const bx = U.lerp(seg[0][0], seg[1][0], fp);
        const by = U.lerp(seg[0][1], seg[1][1], fp);
        ph.fillStyle = "rgba(230, 255, 240, 0.9)";
        ph.beginPath();
        ph.arc(bx, by, scrH * 0.006, 0, U.TAU);
        ph.fill();
      }

      // Corner Lissajous: 3:2 figure, phase = one full turn per minute.
      if (settings.seconds) {
        const lr = scrH * 0.10;
        const lcx = scrW * 0.865, lcy = scrH * 0.82;
        const phase = (t.fs / 60) * U.TAU;
        ph.strokeStyle = "rgba(150, 255, 190, 0.13)";
        ph.lineWidth = scrH * 0.0024;
        ph.beginPath();
        for (let i = 0; i <= 110; i++) {
          const th = (i / 110) * U.TAU;
          const x = lcx + Math.sin(3 * th + phase) * lr;
          const y = lcy + Math.sin(2 * th) * lr * 0.8;
          i ? ph.lineTo(x, y) : ph.moveTo(x, y);
        }
        ph.stroke();
      }
      ph.restore();   // closes the "lighter" phosphor pass opened above

      ctx.drawImage(phosphor.canvas, sx, sy, scrW, scrH);

      // Static readout text (crisp, on the glass).
      ctx.fillStyle = "rgba(140, 255, 185, 0.45)";
      ctx.font = `500 ${Math.max(10, scrH * 0.032)}px Consolas, monospace`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(`TRIG:INT  ${settings.h24 ? "24H" : "12H"}  ${U.DAYS[t.day]} ${U.MONTHS[t.month]} ${U.pad2(t.date)}`,
        sx + scrW * 0.03, sy + scrH * 0.035);
      if (settings.seconds) {
        ctx.textAlign = "right";
        ctx.fillText(`Δt ${U.pad2(t.s)}s`, sx + scrW * 0.97, sy + scrH * 0.035);
      }

      // Glass curvature sheen.
      g = ctx.createRadialGradient(sx + scrW * 0.3, sy + scrH * 0.2, 0,
        sx + scrW * 0.3, sy + scrH * 0.2, scrW * 0.7);
      g.addColorStop(0, "rgba(180, 255, 210, 0.05)");
      g.addColorStop(0.4, "rgba(180, 255, 210, 0.012)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(sx, sy, scrW, scrH);
      g = ctx.createLinearGradient(sx + scrW * 0.08, sy, sx + scrW * 0.70, sy + scrH);
      g.addColorStop(0, "rgba(190, 255, 220, 0.11)");
      g.addColorStop(0.16, "rgba(190, 255, 220, 0.024)");
      g.addColorStop(0.30, "rgba(190, 255, 220, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.10)");
      ctx.fillStyle = g;
      ctx.fillRect(sx, sy, scrW, scrH);
      ctx.restore();   // screen clip

      // ---- Knob row under the screen ----
      const ky = sy + scrH + bez * 2.6;
      const kr = Math.min(W, H) * 0.028;
      const knobs = ["INTENS", "FOCUS", "X-POS", "Y-POS", "TIME/DIV"];
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      knobs.forEach((label, i) => {
        const kx = W / 2 + (i - (knobs.length - 1) / 2) * kr * 4.4;
        g = ctx.createRadialGradient(kx - kr * 0.3, ky - kr * 0.3, 0, kx, ky, kr);
        g.addColorStop(0, "#3c4048");
        g.addColorStop(1, "#14161a");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(kx, ky, kr, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        const ka = (hash(i + 3) - 0.5) * 4 + (i === 4 ? Math.sin(now * 0.0002) * 0.3 : 0);
        ctx.strokeStyle = "#cfd4de";
        ctx.lineWidth = Math.max(2, kr * 0.12);
        ctx.beginPath();
        ctx.moveTo(kx + Math.sin(ka) * kr * 0.35, ky - Math.cos(ka) * kr * 0.35);
        ctx.lineTo(kx + Math.sin(ka) * kr * 0.85, ky - Math.cos(ka) * kr * 0.85);
        ctx.stroke();
        ctx.fillStyle = "rgba(220, 225, 235, 0.4)";
        ctx.font = `500 ${kr * 0.42}px "Segoe UI", sans-serif`;
        ctx.fillText(label, kx, ky + kr * 1.25);
      });

      // Vignette.
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.8);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
