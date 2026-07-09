/* LIQUID — reactive liquid clock. The pool level IS the minute hand:
 * it rises through the hour and surges back at the top of it. A droplet
 * falls each second and raises a real traveling ripple; glass digits
 * float half-submerged on the waterline; bubbles climb; the liquid's hue
 * drifts around the color wheel over 24 hours. Move the mouse to stir
 * the surface — it ripples back. */
"use strict";

(() => {
  const impulses = [];          // {x, t0, amp}
  let lastSec = -1, lastHour = -1;
  const mouse = { x: -1, y: -1, lastT: 0 };
  window.addEventListener("mousemove", (e) => {
    const now = performance.now();
    if (now - mouse.lastT > 130 && (Math.abs(e.clientX - mouse.x) > 4 || Math.abs(e.clientY - mouse.y) > 4)) {
      mouse.lastT = now;
      impulses.push({ x: e.clientX, t0: now, amp: 10 });
      if (impulses.length > 24) impulses.shift();
    }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

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
      const front = 300 * age;
      const dd = d - front;
      y += im.amp * Math.exp(-(dd * dd) / 1800) * Math.cos(dd * 0.09) * Math.exp(-age * 1.4);
    }
    return y;
  }

  CLOX.register({
    id: "liquid",
    name: "Liquid · Reactive Pool",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);
      const tf24 = t.H + t.m / 60;
      const hue = Math.round((tf24 / 24) * 360);
      const C = (l, a = 1, s = 70) => `hsla(${hue}, ${s}%, ${l}%, ${a})`;

      // Deep basin.
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, `hsl(${hue}, 45%, 4%)`);
      g.addColorStop(1, `hsl(${hue}, 55%, 8%)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Level: minute progress through the hour (rises bottom → up).
      const prog = (t.m + t.fs / 60) / 60;
      const level = H * (0.80 - prog * 0.52);

      // Hour rollover: the pool surges as it lets go.
      if (t.H !== lastHour) {
        if (lastHour !== -1) {
          for (let i = 0; i < 6; i++) {
            impulses.push({ x: (i + 0.5) * (W / 6), t0: now + i * 60, amp: 26 });
          }
        }
        lastHour = t.H;
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
        ctx.fillStyle = C(72, 0.95);
        ctx.save();
        ctx.shadowColor = C(60);
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

      // Bubbles rising inside the liquid.
      ctx.save();
      liquidPath();
      ctx.clip();
      for (let i = 0; i < 14; i++) {
        const sp = 0.05 + hash(i) * 0.08;
        const p = (now * 0.001 * sp + hash(i + 50)) % 1;
        const bx = hash(i + 7) * W + Math.sin(now * 0.001 + i * 2) * 14;
        const by = H - p * (H - level - 10);
        const br = 2 + hash(i + 13) * 4;
        ctx.strokeStyle = C(70, 0.35 * (1 - p * 0.5));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, U.TAU);
        ctx.stroke();
      }
      // Caustic shimmer bands under the surface.
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

      // Glowing surface line traced along the samples.
      ctx.save();
      ctx.shadowColor = C(62);
      ctx.shadowBlur = 14;
      ctx.strokeStyle = C(72, 0.95);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.stroke();
      ctx.restore();

      // ---- Floating time: glass above the line, luminous below ----
      const cxx = W / 2;
      const bob = surfaceY(cxx, level, now) - level;
      const baseY = level + bob;
      const fs = Math.min(W * 0.17, H * 0.30);
      const font = `200 ${fs}px "Segoe UI Light", "Segoe UI", sans-serif`;
      const hs = settings.h24 ? U.pad2(t.H) : String(t.h);
      const str = `${hs}:${U.pad2(t.m)}`;
      ctx.font = font;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      // Glass shell (visible above water).
      ctx.strokeStyle = C(80, 0.5);
      ctx.lineWidth = Math.max(1.5, fs * 0.012);
      ctx.strokeText(str, cxx, baseY);
      ctx.fillStyle = C(85, 0.10);
      ctx.fillText(str, cxx, baseY);
      // Submerged glow (clipped to the liquid).
      ctx.save();
      liquidPath();
      ctx.clip();
      ctx.shadowColor = C(65);
      ctx.shadowBlur = fs * 0.18;
      ctx.fillStyle = C(78, 0.95);
      ctx.fillText(str, cxx, baseY);
      ctx.restore();

      // Small seconds + AM/PM, floating to the right of the time.
      if (settings.seconds) {
        const m = ctx.measureText(str);
        ctx.font = `300 ${fs * 0.24}px "Segoe UI", sans-serif`;
        ctx.textAlign = "left";
        ctx.fillStyle = C(75, 0.75);
        ctx.fillText(U.pad2(t.s), cxx + m.width / 2 + fs * 0.08, baseY - fs * 0.26);
        if (!settings.h24) {
          ctx.fillStyle = C(75, 0.45);
          ctx.fillText(t.pm ? "PM" : "AM", cxx + m.width / 2 + fs * 0.08, baseY - fs * 0.02);
        }
      }

      // Minute gauge on the right edge: the surface is the needle.
      const gx = W - Math.min(W, H) * 0.045;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.fillStyle = "rgba(255, 255, 255, 0.30)";
      ctx.lineWidth = 1.5;
      ctx.font = `500 ${Math.max(10, H * 0.014)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let mm = 0; mm <= 60; mm += 5) {
        const yy = H * 0.80 - (mm / 60) * H * 0.52;
        const wnd = mm % 15 === 0 ? H * 0.020 : H * 0.010;
        ctx.beginPath();
        ctx.moveTo(gx, yy);
        ctx.lineTo(gx + wnd, yy);
        ctx.stroke();
        if (mm % 15 === 0) ctx.fillText(String(mm), gx - 6, yy);
      }

      // Ceiling drip fixture.
      ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
      ctx.fillRect(0, 0, W, 8);

      // Vignette.
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.8);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.45)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
