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

    draw(ctx, W, H, d, settings, now) {
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
      if (settings.seconds) {
        ctx.fillStyle = "rgba(238, 242, 246, 0.35)";
        ctx.font = `300 ${R * 0.06}px "Segoe UI", system-ui, sans-serif`;
        ctx.fillText(U.pad2(t.s), 0, R * 0.29);
      }
      ctx.restore();
    }
  });
})();
