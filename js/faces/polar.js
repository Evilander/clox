/* POLAR — modern radial clock. Three concentric progress arcs (hours,
 * minutes, seconds) sweep from 12 o'clock with glowing endpoints; a thin
 * digital readout sits at the center. */
"use strict";

(() => {
  const hash = (i) => {
    const x = Math.sin(i * 127.1 + 19.9) * 43758.5453;
    return x - Math.floor(x);
  };

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
    const sweep = frac * U.TAU;
    const end = start + sweep;

    // Comet: three arc passes brightening toward the head. Only the
    // brightest (shortest) pass pays for the shadowBlur glow.
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.globalAlpha = 0.30;
    ctx.beginPath();
    ctx.arc(0, 0, r, start, end);
    ctx.stroke();
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, r, start + sweep * 0.70, end);
    ctx.stroke();
    ctx.shadowColor = color;
    ctx.shadowBlur = width * 1.6;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, r, start + sweep * 0.88, end);
    ctx.stroke();
    // Endpoint dot, brighter.
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(Math.cos(end) * r, Math.sin(end) * r, width * 0.62, 0, U.TAU);
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = width * 2.2;
    ctx.fill();
    ctx.restore();
  }

  // 60 hairline ticks just outside the outer ring — static per radius,
  // cached offscreen like a watch bezel.
  let tickCache = { key: "", canvas: null };

  function ticks(R) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = R * 2.3;
    const key = `${Math.round(size)}@${dpr}`;
    if (tickCache.key === key) return tickCache.canvas;
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(size * dpr));
    c.height = Math.max(2, Math.round(size * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.translate(size / 2, size / 2);
    g.lineCap = "round";
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * U.TAU - Math.PI / 2;
      const major = i % 5 === 0;
      const len = major ? R * 0.035 : R * 0.02;
      const r0 = R * 1.05, r1 = r0 + len;
      g.strokeStyle = major ? "rgba(255, 255, 255, 0.12)" : "rgba(255, 255, 255, 0.07)";
      g.lineWidth = Math.max(1, R * 0.006);
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
      g.stroke();
    }
    tickCache = { key, canvas: c };
    return c;
  }

  // Rollover pulses: an expanding ring fires wherever a ring wraps past 0.
  // prevFrac tracks each ring's last fraction so a wrap (large downward
  // jump) can be detected; up to 3 pulses animate concurrently.
  const prevFrac = { s: null, m: null, h: null };
  const pulses = [];
  const PULSE_MS = 450;

  function trackWrap(now, key, frac, r, color) {
    const prev = prevFrac[key];
    prevFrac[key] = frac;
    if (prev != null && frac < prev - 0.5) {
      if (pulses.length >= 3) pulses.shift();
      pulses.push({ r, color, t0: now });
    }
  }

  function drawPulses(ctx, now, wArc) {
    ctx.save();
    for (let i = pulses.length - 1; i >= 0; i--) {
      const pu = pulses[i];
      const p = (now - pu.t0) / PULSE_MS;
      if (p >= 1) { pulses.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.arc(0, 0, U.lerp(pu.r, pu.r * 1.12, p), 0, U.TAU);
      ctx.strokeStyle = pu.color;
      ctx.lineWidth = U.lerp(wArc, 1, p);
      ctx.globalAlpha = (1 - p) * 0.5;
      ctx.stroke();
    }
    ctx.restore();
  }

  CLOX.register({
    id: "polar",
    name: "Polar · Radial Arcs",
    leave() {
      tickCache = { key: "", canvas: null };
      pulses.length = 0;
      prevFrac.s = prevFrac.m = prevFrac.h = null;
    },

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.42;

      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, "#141a21");
      g.addColorStop(0.52, "#090d13");
      g.addColorStop(1, "#030508");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const unit = Math.min(W, H);
      ctx.strokeStyle = "rgba(110, 150, 190, 0.055)";
      ctx.lineWidth = Math.max(1, unit * 0.001);
      const grid = Math.max(44, unit * 0.075);
      ctx.beginPath();
      for (let x = (W / 2) % grid; x < W; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = (H / 2) % grid; y < H; y += grid) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
      for (let i = 0; i < 36; i++) {
        const sx = (0.08 + hash(i) * 0.84) * W;
        const sy = (0.06 + hash(i + 90) * 0.86) * H;
        const tw = 0.35 + 0.65 * Math.sin(now * 0.001 + i * 1.7);
        ctx.fillStyle = `rgba(140, 190, 230, ${0.04 + tw * 0.08})`;
        ctx.fillRect(sx, sy, hash(i + 8) < 0.22 ? 2 : 1, hash(i + 17) < 0.22 ? 2 : 1);
      }

      ctx.save();
      ctx.translate(cx, cy);

      // Smoked glass under the arcs gives the radial display more mass.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = R * 0.16;
      ctx.shadowOffsetY = R * 0.05;
      g = ctx.createRadialGradient(-R * 0.24, -R * 0.28, 0, 0, 0, R * 1.03);
      g.addColorStop(0, "rgba(70, 88, 102, 0.38)");
      g.addColorStop(0.58, "rgba(20, 28, 36, 0.46)");
      g.addColorStop(1, "rgba(6, 9, 14, 0.82)");
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.02, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
      for (const rr of [1.02, 0.89, 0.73, 0.55]) {
        ctx.beginPath();
        ctx.arc(0, 0, R * rr, 0, U.TAU);
        ctx.strokeStyle = rr === 1.02 ? "rgba(205, 225, 245, 0.22)" : "rgba(205, 225, 245, 0.08)";
        ctx.lineWidth = Math.max(1, R * (rr === 1.02 ? 0.006 : 0.003));
        ctx.stroke();
      }
      g = ctx.createLinearGradient(-R * 0.5, -R * 0.82, R * 0.55, R * 0.45);
      g.addColorStop(0.10, "rgba(255, 255, 255, 0)");
      g.addColorStop(0.34, "rgba(255, 255, 255, 0.085)");
      g.addColorStop(0.45, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.00, 0, U.TAU);
      ctx.fill();

      // Twelve faint reference dots outside the outer ring.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * U.TAU - Math.PI / 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * R * 1.10, Math.sin(a) * R * 1.10, R * (i % 3 === 0 ? 0.012 : 0.007), 0, U.TAU);
        ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.65)" : "rgba(255, 255, 255, 0.22)";
        ctx.fill();
      }

      // 60 hairline ticks just outside the outer ring (bezel detail).
      const tkSize = R * 2.3;
      ctx.drawImage(ticks(R), -tkSize / 2, -tkSize / 2, tkSize, tkSize);

      const wArc = R * 0.052;
      const sFrac = t.fs / 60, mFrac = t.fm / 60, hFrac = ((t.H % 12) + t.fm / 60) / 12;
      // Without a seconds ring, minutes/hours re-space outward so the
      // face doesn't look hollow.
      const mR = settings.seconds ? R * 0.82 : R;
      const hR = settings.seconds ? R * 0.64 : R * 0.80;

      if (settings.seconds) {
        trackWrap(now, "s", sFrac, R, "#38cfff");
        ring(ctx, R, sFrac, wArc, "#38cfff");
      } else {
        prevFrac.s = null;
      }
      trackWrap(now, "m", mFrac, mR, "#ff5f9e");
      ring(ctx, mR, mFrac, wArc, "#ff5f9e");
      trackWrap(now, "h", hFrac, hR, "#ffc14d");
      ring(ctx, hR, hFrac, wArc, "#ffc14d");
      drawPulses(ctx, now, wArc);

      // Center readout: thin digits, small date.
      const hs = settings.h24 ? U.pad2(t.H) : String(t.h);
      ctx.fillStyle = "#eef2f6";
      ctx.font = `300 ${R * 0.34}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "alphabetic";
      ctx.fillText(`${hs}:${U.pad2(t.m)}`, 0, R * 0.05);
      ctx.fillStyle = "rgba(238, 242, 246, 0.52)";
      ctx.font = `400 ${R * 0.074}px "Segoe UI", system-ui, sans-serif`;
      ctx.fillText(
        `${U.DAYS[t.day]} ${U.MONTHS[t.month]} ${t.date}` +
        (settings.h24 ? "" : (t.pm ? " · PM" : " · AM")),
        0, R * 0.19
      );
      if (settings.seconds) {
        ctx.fillStyle = "rgba(238, 242, 246, 0.50)";
        ctx.font = `500 ${R * 0.074}px "Segoe UI", system-ui, sans-serif`;
        ctx.fillText(U.pad2(t.s), 0, R * 0.29);
      }
      ctx.font = `600 ${R * 0.036}px "Segoe UI", system-ui, sans-serif`;
      ctx.textBaseline = "middle";
      const labels = settings.seconds
        ? [["SECONDS", "#38cfff"], ["MINUTES", "#ff5f9e"], ["HOURS", "#ffc14d"]]
        : [["MINUTES", "#ff5f9e"], ["HOURS", "#ffc14d"]];
      labels.forEach(([label, col], i) => {
        const y = R * (0.43 + i * 0.064);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(-R * 0.20, y - R * 0.010, R * 0.010, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(238, 242, 246, 0.42)";
        ctx.fillText(label, 0, y);
      });
      ctx.restore();
    }
  });
})();
