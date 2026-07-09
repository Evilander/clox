/* POLAR — modern radial clock. Three concentric progress arcs (hours,
 * minutes, seconds) sweep from 12 o'clock with glowing endpoints; a thin
 * digital readout sits at the center. */
"use strict";

(() => {
  function ring(ctx, r, frac, width, color) {
    const start = -Math.PI / 2;
    // Track.
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, U.TAU);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.stroke();
    if (frac <= 0.0001) frac = 0.0001;
    // Arc.
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = width * 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, r, start, start + frac * U.TAU);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
    // Endpoint dot, brighter.
    const ea = start + frac * U.TAU;
    ctx.beginPath();
    ctx.arc(Math.cos(ea) * r, Math.sin(ea) * r, width * 0.62, 0, U.TAU);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = width * 2.2;
    ctx.fill();
    ctx.restore();
  }

  CLOX.register({
    id: "polar",
    name: "Polar · Radial Arcs",

    draw(ctx, W, H, d, settings) {
      const t = U.timeParts(d, settings.h24);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.38;

      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.7);
      g.addColorStop(0, "#101318");
      g.addColorStop(1, "#06080b");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cx, cy);

      // Twelve faint reference dots outside the outer ring.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * U.TAU - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * R * 1.10, Math.sin(a) * R * 1.10, R * 0.008, 0, U.TAU);
        ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.5)" : "rgba(255, 255, 255, 0.18)";
        ctx.fill();
      }

      const wArc = R * 0.052;
      if (settings.seconds) ring(ctx, R, t.fs / 60, wArc, "#38cfff");
      ring(ctx, R * 0.82, t.fm / 60, wArc, "#ff5f9e");
      ring(ctx, R * 0.64, ((t.H % 12) + t.fm / 60) / 12, wArc, "#ffc14d");

      // Center readout: thin digits, small date.
      const hs = settings.h24 ? U.pad2(t.H) : String(t.h);
      ctx.fillStyle = "#eef2f6";
      ctx.font = `200 ${R * 0.30}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${hs}:${U.pad2(t.m)}`, 0, R * 0.05);
      ctx.fillStyle = "rgba(238, 242, 246, 0.45)";
      ctx.font = `300 ${R * 0.072}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(
        `${U.DAYS[t.day]} ${U.MONTHS[t.month]} ${t.date}` +
        (settings.h24 ? "" : (t.pm ? " · PM" : " · AM")),
        0, R * 0.19
      );
      ctx.restore();
    }
  });
})();
