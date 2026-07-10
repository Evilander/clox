/* LIQUID — reactive liquid clock. The pool level IS the minute hand:
 * it rises through the hour and swallows the digits entirely by :59
 * before the rollover surge lets it go. A droplet falls each second and
 * raises a real traveling ripple; digits glow where submerged; bubbles
 * climb; mouse movement stirs the surface.
 * Color: press C to cycle presets (saved), or Auto drifts the hue
 * around the color wheel over 24 hours. */
"use strict";

(() => {
  const PRESETS = [
    { id: "auto", label: "Auto · 24h drift" },
    { id: "teal", label: "Tidepool Teal", hue: 172, sat: 70 },
    { id: "ocean", label: "Deep Ocean", hue: 207, sat: 75 },
    { id: "violet", label: "Ultraviolet", hue: 268, sat: 72 },
    { id: "gothic", label: "Gothic Rose", hue: 345, sat: 58, glowHue: 330, glowSat: 90 },
    { id: "ember", label: "Molten Ember", hue: 22, sat: 85 },
    { id: "acid", label: "Reactor Acid", hue: 96, sat: 78 }
  ];
  const COLOR_KEY = "clox.liquid.color";

  let presetIdx = Math.max(0, PRESETS.findIndex(p => {
    try { return p.id === localStorage.getItem(COLOR_KEY); } catch { return false; }
  }));
  let colorChangedAt = -1e9;

  const impulses = [];          // {x, t0, amp}
  let lastSec = -1, lastHour = -1, releaseT0 = -1e9;
  const mouse = { x: -1, y: -1, lastT: 0 };

  /* Listeners are attached only while this face is active — the engine
   * calls enter()/leave() on face switches. */
  function onMove(e) {
    const now = performance.now();
    if (now - mouse.lastT > 130 && (Math.abs(e.clientX - mouse.x) > 4 || Math.abs(e.clientY - mouse.y) > 4)) {
      mouse.lastT = now;
      impulses.push({ x: e.clientX, t0: now, amp: 10 });
    }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }
  function onKey(e) {
    if (e.key === "c" || e.key === "C") {
      presetIdx = (presetIdx + 1) % PRESETS.length;
      colorChangedAt = performance.now();
      try { localStorage.setItem(COLOR_KEY, PRESETS[presetIdx].id); } catch { }
    }
  }

  const hash = (i) => {
    const x = Math.sin(i * 379.9 + 53.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function surfaceY(x, level, now) {
    let y = level
      + Math.sin(x * 0.006 + now * 0.0011) * 5
      + Math.sin(x * 0.013 - now * 0.0017) * 3
      + Math.sin(x * 0.027 + now * 0.0029) * 1.6;
    for (const im of impulses) {
      const age = (now - im.t0) / 1000;
      if (age < 0 || age > 3) continue;
      const d = Math.abs(x - im.x);
      const dd = d - 300 * age;
      y += im.amp * Math.exp(-(dd * dd) / 1800) * Math.cos(dd * 0.09) * Math.exp(-age * 1.4);
    }
    return y;
  }

  CLOX.register({
    id: "liquid",
    name: "Liquid · Reactive Pool",

    enter() {
      window.addEventListener("mousemove", onMove);
      window.addEventListener("keydown", onKey);
    },
    leave() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
    },

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);

      // Ripples decay after 3s — prune them and hard-cap the pool so the
      // hourly surge can never grow the array without bound.
      for (let i = impulses.length - 1; i >= 0; i--) {
        if ((now - impulses[i].t0) / 1000 > 3) impulses.splice(i, 1);
      }
      if (impulses.length > 30) impulses.splice(0, impulses.length - 30);

      const preset = PRESETS[presetIdx];
      const hue = preset.hue ?? Math.round(((t.H + t.m / 60) / 24) * 360);
      const sat = preset.sat ?? 70;
      const gHue = preset.glowHue ?? hue;
      const gSat = preset.glowSat ?? sat;
      const C = (l, a = 1) => `hsla(${hue}, ${sat}%, ${l}%, ${a})`;   // body
      const G = (l, a = 1) => `hsla(${gHue}, ${gSat}%, ${l}%, ${a})`; // glow/digits

      // Deep basin.
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `hsl(${hue}, 45%, 4%)`);
      g.addColorStop(1, `hsl(${hue}, 55%, 8%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Level: the waterline climbs the digits through the hour — just
      // below them at :00, halfway up at :30, fully over them by ~:48
      // and drowned through :59 (digits span ~0.37H–0.59H).
      const prog = (t.m + t.fs / 60) / 60;
      let level = H * (0.66 - prog * 0.36);

      // Hour rollover: the pool surges as it lets go. Only within the
      // first minute — returning to this face hours later must not replay
      // the release long after the actual rollover.
      if (t.H !== lastHour) {
        if (lastHour !== -1 && t.m === 0) {
          releaseT0 = now;
          for (let i = 0; i < 6; i++) {
            impulses.push({ x: (i + 0.5) * (W / 6), t0: now + i * 60, amp: 26 });
          }
        }
        lastHour = t.H;
      }
      // The water lets go over ~3s instead of teleporting to the floor.
      const rel = (now - releaseT0) / 3000;
      if (rel >= 0 && rel < 1) {
        level = U.lerp(H * 0.30, level, U.easeInOutCubic(rel));
      }

      // One droplet per second: falls from the ceiling, then ripples.
      const dropX = (hash(t.m * 60 + t.s) * 0.8 + 0.1) * W;
      const FALL = 420;
      if (t.s !== lastSec) {
        lastSec = t.s;
        impulses.push({ x: dropX, t0: now + FALL, amp: 15 });
        if (impulses.length > 24) impulses.shift();
      }
      const fp = U.clamp(t.ms / FALL, 0, 1);
      if (fp < 1) {
        const dy = (level - 20) * fp * fp;          // gravity
        ctx.fillStyle = G(72, 0.95);
        ctx.save();
        ctx.shadowColor = G(60);
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.ellipse(dropX, 14 + dy, 4, 7 + fp * 5, 0, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }

      // Sample the surface and build the liquid body path.
      const step = Math.max(6, Math.round(W / 260));
      const pts = [];
      for (let x = 0; x <= W + step; x += step) {
        pts.push([x, surfaceY(x, level, now)]);
      }
      const liquidPath = () => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.lineTo(W, H);
        ctx.lineTo(0, H);
        ctx.closePath();
      };

      // Body of liquid.
      liquidPath();
      g = ctx.createLinearGradient(0, level - 20, 0, H);
      g.addColorStop(0, C(38, 0.95));
      g.addColorStop(0.25, C(26, 0.95));
      g.addColorStop(1, C(12, 0.98));
      ctx.fillStyle = g;
      ctx.fill();

      // Bubbles + caustic shimmer inside the liquid.
      ctx.save();
      liquidPath();
      ctx.clip();
      for (let i = 0; i < 14; i++) {
        const sp = 0.05 + hash(i) * 0.08;
        const p = (now * 0.001 * sp + hash(i + 50)) % 1;
        const bx = hash(i + 7) * W + Math.sin(now * 0.001 + i * 2) * 14;
        const by = H - p * (H - level - 10);
        ctx.strokeStyle = C(70, 0.35 * (1 - p * 0.5));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bx, by, 2 + hash(i + 13) * 4, 0, U.TAU);
        ctx.stroke();
      }
      for (let i = 0; i < 3; i++) {
        const cy2 = level + 30 + i * 46;
        g = ctx.createLinearGradient(0, cy2 - 8, 0, cy2 + 8);
        g.addColorStop(0, C(60, 0));
        g.addColorStop(0.5, C(60, 0.05 + 0.02 * Math.sin(now * 0.002 + i * 2)));
        g.addColorStop(1, C(60, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, cy2 - 8, W, 16);
      }
      ctx.restore();

      // Glowing surface line.
      ctx.save();
      ctx.shadowColor = G(62);
      ctx.shadowBlur = 14;
      ctx.strokeStyle = G(72, 0.95);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();

      // ---- The time: anchored mid-screen so the rising water overtakes
      // it — glass above the surface, luminous below, drowned by :59. ----
      const cxx = W / 2;
      const baseY = H * 0.48 + Math.sin(now * 0.0012) * H * 0.008;
      const fs = Math.min(W * 0.17, H * 0.30);
      const hs = settings.h24 ? U.pad2(t.H) : String(t.h);
      const str = `${hs}:${U.pad2(t.m)}`;
      ctx.font = `200 ${fs}px "Segoe UI Light", "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Glass shell (visible above water).
      ctx.strokeStyle = G(80, 0.5);
      ctx.lineWidth = Math.max(1.5, fs * 0.012);
      ctx.strokeText(str, cxx, baseY);
      ctx.fillStyle = G(85, 0.10);
      ctx.fillText(str, cxx, baseY);
      // Submerged glow (clipped to the liquid).
      ctx.save();
      liquidPath();
      ctx.clip();
      ctx.shadowColor = G(65);
      ctx.shadowBlur = fs * 0.18;
      ctx.fillStyle = G(78, 0.95);
      ctx.fillText(str, cxx, baseY);
      ctx.restore();

      // Small seconds + AM/PM beside the time (AM/PM shows even with
      // seconds hidden — 12h mode must always carry its period marker).
      const mtw = ctx.measureText(str).width;
      ctx.font = `300 ${fs * 0.24}px "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      if (settings.seconds) {
        ctx.fillStyle = G(75, 0.75);
        ctx.fillText(U.pad2(t.s), cxx + mtw / 2 + fs * 0.08, baseY - fs * 0.26);
      }
      if (!settings.h24) {
        ctx.fillStyle = G(75, 0.45);
        ctx.fillText(t.pm ? "PM" : "AM", cxx + mtw / 2 + fs * 0.08,
          baseY - (settings.seconds ? fs * 0.02 : fs * 0.26));
      }

      // Minute gauge on the right edge: the surface is the needle.
      const gx = W - Math.min(W, H) * 0.045;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.30)";
      ctx.lineWidth = 1.5;
      ctx.font = `500 ${Math.max(10, H * 0.014)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      const gu = Math.min(W, H);
      for (let mm = 0; mm <= 60; mm += 5) {
        const yy = H * 0.66 - (mm / 60) * H * 0.36;
        const wnd = mm % 15 === 0 ? gu * 0.020 : gu * 0.010;
        ctx.beginPath();
        ctx.moveTo(gx, yy);
        ctx.lineTo(gx + wnd, yy);
        ctx.stroke();
        if (mm % 15 === 0) ctx.fillText(String(mm), gx - 6, yy);
      }

      // Ceiling drip fixture.
      ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
      ctx.fillRect(0, 0, W, 8);

      // Color-change label (fades after a moment).
      const since = now - colorChangedAt;
      if (since < 1800) {
        ctx.globalAlpha = U.clamp(1 - (since - 1200) / 600, 0, 1);
        ctx.font = `500 ${Math.max(13, H * 0.022)}px "Segoe UI", sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = G(80, 0.9);
        ctx.fillText(`color · ${preset.label}`, W / 2, H * 0.05);
        ctx.globalAlpha = 1;
      }

      // Vignette.
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.45)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
