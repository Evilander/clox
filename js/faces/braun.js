/* BRAUN — Dieter Rams-school minimalist analog. Matte case, clean sans
 * numerals, stick hands, yellow second hand that steps once per second
 * with a tiny mechanical overshoot (quartz tick, not sweep). */
"use strict";

(() => {
  const hash = (i) => {
    const x = Math.sin(i * 157.3 + 71.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function stick(ctx, angle, len, width, color, tail = 0) {
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, tail);
    ctx.lineTo(0, -len);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  // Paper-grain dial texture is static per size — render once to an
  // offscreen canvas instead of stippling ~540 specks every frame.
  let grainCache = { key: "", canvas: null };

  function grainTexture(FR) {
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${Math.round(FR)}@${scale}`;
    if (grainCache.key === key) return grainCache.canvas;
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(FR * 2 * scale));
    c.height = Math.max(2, Math.round(FR * 2 * scale));
    const g = c.getContext("2d");
    g.scale(scale, scale);
    g.translate(FR, FR);

    g.beginPath();
    g.arc(0, 0, FR, 0, U.TAU);
    g.clip();

    for (let i = 0; i < 500; i++) {
      const a = hash(i) * U.TAU, r = Math.sqrt(hash(i + 700)) * FR;
      g.fillStyle = `rgba(0, 0, 0, ${0.02 + hash(i + 1200) * 0.02})`;
      g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1, 1);
    }
    for (let i = 0; i < 40; i++) {
      const a = hash(i + 2000) * U.TAU, r = Math.sqrt(hash(i + 2500)) * FR;
      g.fillStyle = "rgba(255, 255, 255, 0.02)";
      g.fillRect(Math.cos(a) * r, Math.sin(a) * r, 1.6, 1.6);
    }

    grainCache = { key, canvas: c };
    return c;
  }

  CLOX.register({
    id: "braun",
    name: "Braun · Minimal",

    draw(ctx, W, H, d, settings) {
      const t = U.timeParts(d, true);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.44;

      // Neutral studio background.
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, "#26272a");
      g.addColorStop(1, "#101113");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cx, cy);

      // Matte case: shallow dark ring, no ornament.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = R * 0.08;
      ctx.shadowOffsetY = R * 0.03;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, U.TAU);
      ctx.fillStyle = "#181a1c";
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.99, 0, U.TAU);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = R * 0.006;
      ctx.stroke();

      // Off-white dial.
      const FR = R * 0.93;
      g = ctx.createRadialGradient(0, -FR * 0.25, 0, 0, 0, FR);
      g.addColorStop(0, "#f6f4ef");
      g.addColorStop(1, "#e9e6de");
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.drawImage(grainTexture(FR), -FR, -FR, FR * 2, FR * 2);

      // Thin ticks: every minute, hours slightly longer. No bezel clutter.
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * U.TAU;
        const isHour = i % 5 === 0;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = "#2a2a28";
        if (isHour) ctx.fillRect(-R * 0.005, -FR * 0.95, R * 0.010, FR * 0.075);
        else ctx.fillRect(-R * 0.0025, -FR * 0.95, R * 0.005, FR * 0.038);
        ctx.restore();
      }

      // All twelve numerals in a plain grotesque, modest size.
      ctx.fillStyle = "#2a2a28";
      ctx.font = `400 ${R * 0.105}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let n = 1; n <= 12; n++) {
        const a = (n / 12) * U.TAU;
        const nr = FR * 0.755;
        ctx.fillText(String(n), Math.sin(a) * nr, -Math.cos(a) * nr + R * 0.004);
      }

      ctx.font = `500 ${R * 0.038}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillStyle = "#7c7a72";
      ctx.fillText("clox", 0, -FR * 0.30);
      ctx.font = `400 ${R * 0.028}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillStyle = "rgba(124, 122, 114, 0.75)";
      ctx.fillText("quartz", 0, -FR * 0.24);

      // Hands: plain black sticks; hour/minute move continuously. Float
      // height off the dial differs per hand, so shadow scales with it.
      const shadow = (fn, blur, offsetY) => {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
        ctx.shadowBlur = blur;
        ctx.shadowOffsetY = offsetY;
        fn();
        ctx.restore();
      };
      shadow(() => stick(ctx, (t.fh / 12) * U.TAU, FR * 0.52, R * 0.036, "#1c1c1a", R * 0.015), R * 0.010, R * 0.008);
      shadow(() => stick(ctx, (t.fm / 60) * U.TAU, FR * 0.80, R * 0.028, "#1c1c1a", R * 0.015), R * 0.014, R * 0.014);

      // Yellow second hand: quartz tick — steps each second with a small
      // overshoot in the first 120ms, then a damped micro-oscillation
      // settles the rest of the way by ~420ms (double recoil).
      if (settings.seconds) {
        const p = U.clamp(t.ms / 120, 0, 1);
        const secVal = (t.s - 1) + U.easeOutBack(p);
        let secAngle = (secVal / 60) * U.TAU;
        if (t.ms > 120 && t.ms < 420) {
          secAngle += Math.sin((t.ms - 120) * 0.05) * Math.exp(-(t.ms - 120) / 90) * 0.006;
        }
        shadow(() => {
          ctx.save();
          ctx.rotate(secAngle);
          ctx.strokeStyle = "#f5c400";
          ctx.lineWidth = R * 0.012;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(0, R * 0.14);
          ctx.lineTo(0, -FR * 0.72);
          ctx.stroke();
          // Counterweight disc near the pivot, Braun-style.
          ctx.beginPath();
          ctx.arc(0, R * 0.06, R * 0.026, 0, U.TAU);
          ctx.fillStyle = "#f5c400";
          ctx.fill();
          ctx.restore();
        }, R * 0.019, R * 0.022);
      }

      // Center pin.
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.014, 0, U.TAU);
      ctx.fillStyle = "#1c1c1a";
      ctx.fill();

      // Very subtle domed-glass sheen.
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.clip();
      g = ctx.createRadialGradient(-FR * 0.4, -FR * 0.5, 0, -FR * 0.4, -FR * 0.5, FR * 1.4);
      g.addColorStop(0, "rgba(255, 255, 255, 0.10)");
      g.addColorStop(0.4, "rgba(255, 255, 255, 0.02)");
      g.addColorStop(0.6, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-FR, -FR, FR * 2, FR * 2);

      ctx.restore();
    }
  });
})();
