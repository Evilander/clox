/* GRIMDARK — a clock for the 41st millennium. Brass cog chapter ring,
 * bone parchment dial, skull at twelve, blade hands, a wax purity seal,
 * rising embers, and a proper Imperial datestamp (check digit, year
 * fraction, year, millennium) computed from the real date. */
"use strict";

(() => {
  const GOTHIC = '"Old English Text MT", "Blackadder ITC", Georgia, serif';

  const hash = (i) => {
    const x = Math.sin(i * 269.5 + 183.3) * 43758.5453;
    return x - Math.floor(x);
  };

  function skull(ctx, x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#d8cdb0";
    ctx.strokeStyle = "#3a3026";
    ctx.lineWidth = s * 0.06;
    // Cranium + jaw.
    ctx.beginPath();
    ctx.arc(0, -s * 0.15, s * 0.52, Math.PI * 0.95, Math.PI * 0.05);
    ctx.quadraticCurveTo(s * 0.52, s * 0.28, s * 0.30, s * 0.34);
    ctx.lineTo(s * 0.30, s * 0.52);
    ctx.lineTo(-s * 0.30, s * 0.52);
    ctx.lineTo(-s * 0.30, s * 0.34);
    ctx.quadraticCurveTo(-s * 0.52, s * 0.28, -s * 0.52, -s * 0.15);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Eyes, nose, teeth.
    ctx.fillStyle = "#1a1410";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * s * 0.22, -s * 0.10, s * 0.15, 0, U.TAU);
      ctx.fill();
    }
    // Servo-skull optics: red pinpoints burning in the sockets.
    for (const sx of [-1, 1]) {
      ctx.save();
      ctx.shadowColor = "#ff2010";
      ctx.shadowBlur = s * 0.22;
      ctx.fillStyle = "#ff3822";
      ctx.beginPath();
      ctx.arc(sx * s * 0.22, -s * 0.10, s * 0.055, 0, U.TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(0, s * 0.02);
    ctx.lineTo(s * 0.08, s * 0.20);
    ctx.lineTo(-s * 0.08, s * 0.20);
    ctx.closePath();
    ctx.fill();
    for (let i = -1; i <= 1; i++) {
      ctx.fillRect(i * s * 0.16 - s * 0.02, s * 0.34, s * 0.04, s * 0.16);
    }
    ctx.restore();
  }

  function bladeHand(ctx, angle, len, w, color, edge) {
    ctx.save();
    ctx.rotate(angle);
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = w;
    ctx.beginPath();
    ctx.moveTo(-w / 2, len * 0.12);
    ctx.lineTo(-w * 0.3, -len * 0.72);
    ctx.lineTo(-w * 0.55, -len * 0.78);   // barbs
    ctx.lineTo(0, -len);
    ctx.lineTo(w * 0.55, -len * 0.78);
    ctx.lineTo(w * 0.3, -len * 0.72);
    ctx.lineTo(w / 2, len * 0.12);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = edge;
    ctx.lineWidth = Math.max(1, w * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  // Imperial datestamp: 0 FFF YYY.M## — check digit, thousandth-of-year
  // fraction, year within millennium, millennium (+38k years for flavor).
  function imperialDate(d, t) {
    const y = d.getFullYear();
    const start = new Date(y, 0, 1).getTime();
    const yearMs = (new Date(y + 1, 0, 1).getTime()) - start;
    const frac = Math.min(999, Math.floor(((d.getTime() - start) / yearMs) * 1000));
    const year40k = y + 38000;
    const mill = Math.floor((year40k - 1) / 1000) + 1;
    const yy = year40k - (mill - 1) * 1000;
    return `0 ${String(frac).padStart(3, "0")} ${String(yy).padStart(3, "0")}.M${mill}`;
  }

  CLOX.register({
    id: "grimdark",
    name: "Grimdark · M41",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, true);

      // Void-dark background with an ember furnace glow from below.
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0a0806");
      g.addColorStop(1, "#191009");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      g = ctx.createRadialGradient(W / 2, H * 1.05, 0, W / 2, H * 1.05, H * 0.9);
      g.addColorStop(0, "rgba(150, 45, 10, 0.30)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Rising embers.
      for (let i = 0; i < 46; i++) {
        const speed = 0.014 + hash(i) * 0.03;
        const p = (now * 0.001 * speed + hash(i + 99)) % 1;
        const ex = hash(i + 7) * W + Math.sin(now * 0.0008 + i) * W * 0.015;
        const ey = H * (1.02 - p * 1.1);
        const a = Math.max(0, 0.8 * (1 - p)) * (0.6 + 0.4 * Math.sin(now * 0.006 + i * 3));
        ctx.fillStyle = `rgba(255, ${120 + Math.round(hash(i + 31) * 80)}, 30, ${a.toFixed(3)})`;
        const es = 2 + hash(i + 13) * 3;
        ctx.fillRect(ex, ey, es, es);
      }

      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.34;
      ctx.save();
      ctx.translate(cx, cy);

      // Brass cog ring.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
      ctx.shadowBlur = R * 0.1;
      ctx.shadowOffsetY = R * 0.04;
      g = ctx.createLinearGradient(0, -R * 1.2, 0, R * 1.2);
      g.addColorStop(0, "#6e5a2e");
      g.addColorStop(0.5, "#463818");
      g.addColorStop(1, "#2a2110");
      ctx.fillStyle = g;
      ctx.beginPath();
      const teeth = 20, ro = R * 1.19, ri = R * 1.06;
      for (let i = 0; i < teeth; i++) {
        const a0 = (i / teeth) * U.TAU;
        const half = U.TAU / teeth / 2;
        const tw = half * 0.52;
        ctx.arc(0, 0, ri, a0, a0 + half - tw * 0.5);
        ctx.arc(0, 0, ro, a0 + half - tw * 0.4, a0 + half + tw * 0.4);
        ctx.arc(0, 0, ri, a0 + half + tw * 0.5, a0 + U.TAU / teeth);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(220, 180, 90, 0.22)";
      ctx.lineWidth = R * 0.008;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.06, 0, U.TAU);
      ctx.stroke();

      // Parchment dial.
      g = ctx.createRadialGradient(0, -R * 0.2, 0, 0, 0, R);
      g.addColorStop(0, "#d9caa4");
      g.addColorStop(0.8, "#c2b088");
      g.addColorStop(1, "#8f7d58");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, U.TAU);
      ctx.fill();
      // Age stains.
      for (let i = 0; i < 14; i++) {
        const a = hash(i + 55) * U.TAU, rr = hash(i + 77) * R * 0.85;
        ctx.fillStyle = `rgba(90, 70, 40, ${0.05 + hash(i) * 0.05})`;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, R * (0.04 + hash(i + 3) * 0.09), 0, U.TAU);
        ctx.fill();
      }
      ctx.strokeStyle = "#3a3026";
      ctx.lineWidth = R * 0.012;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.97, 0, U.TAU);
      ctx.stroke();

      // Ticks + gothic numerals (skull replaces the XII).
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * U.TAU;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = "#3a3026";
        if (i % 5 === 0) ctx.fillRect(-R * 0.010, -R * 0.95, R * 0.020, R * 0.07);
        else ctx.fillRect(-R * 0.004, -R * 0.95, R * 0.008, R * 0.035);
        ctx.restore();
      }
      ctx.fillStyle = "#2e2419";
      ctx.font = `700 ${R * 0.105}px ${GOTHIC}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI"];
      for (let n = 1; n <= 11; n++) {
        const a = (n / 12) * U.TAU;
        ctx.fillText(ROMAN[n - 1], Math.sin(a) * R * 0.76, -Math.cos(a) * R * 0.76 + R * 0.01);
      }
      skull(ctx, 0, -R * 0.74, R * 0.14);

      // Motto + datestamp on the dial.
      ctx.fillStyle = "#4a3c2a";
      ctx.font = `${R * 0.072}px ${GOTHIC}`;
      ctx.fillText("Memento Mori", 0, R * 0.38);
      ctx.font = `600 ${R * 0.052}px Consolas, monospace`;
      ctx.fillStyle = "#5a482e";
      ctx.fillText(imperialDate(d, t), 0, R * 0.50);

      // Blade hands + iron boss.
      bladeHand(ctx, (t.fh / 12) * U.TAU, R * 0.50, R * 0.055, "#2c2824", "#8a7442");
      bladeHand(ctx, (t.fm / 60) * U.TAU, R * 0.78, R * 0.042, "#2c2824", "#8a7442");
      if (settings.seconds) {
        ctx.save();
        ctx.rotate((t.fs / 60) * U.TAU);
        ctx.strokeStyle = "#7a1f16";
        ctx.lineWidth = R * 0.012;
        ctx.beginPath();
        ctx.moveTo(0, R * 0.12);
        ctx.lineTo(0, -R * 0.86);
        ctx.stroke();
        ctx.restore();
      }
      g = ctx.createRadialGradient(-R * 0.01, -R * 0.01, 0, 0, 0, R * 0.05);
      g.addColorStop(0, "#c8b060");
      g.addColorStop(1, "#4a3a18");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.05, 0, U.TAU);
      ctx.fill();

      // Purity seal on the cog's lower right: wax disc + parchment ribbons.
      const px = R * 0.88, py = R * 0.72;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(0.15);
      for (const [rw, rl, ra] of [[R * 0.10, R * 0.52, 0.12], [R * 0.085, R * 0.4, -0.14]]) {
        ctx.save();
        ctx.rotate(ra);
        g = ctx.createLinearGradient(0, 0, 0, rl);
        g.addColorStop(0, "#d6c69c");
        g.addColorStop(1, "#b3a072");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-rw / 2, 0);
        ctx.lineTo(rw / 2, 0);
        ctx.lineTo(rw * 0.42, rl);
        ctx.lineTo(0, rl - rw * 0.35);
        ctx.lineTo(-rw * 0.42, rl);
        ctx.closePath();
        ctx.fill();
        // Script lines.
        ctx.strokeStyle = "rgba(60, 45, 25, 0.5)";
        ctx.lineWidth = Math.max(1, R * 0.005);
        for (let i = 1; i < 6; i++) {
          ctx.beginPath();
          ctx.moveTo(-rw * 0.3, rl * i / 6.5);
          ctx.lineTo(rw * 0.3, rl * i / 6.5 + rw * 0.05);
          ctx.stroke();
        }
        ctx.restore();
      }
      g = ctx.createRadialGradient(-R * 0.02, -R * 0.02, 0, 0, 0, R * 0.11);
      g.addColorStop(0, "#b03028");
      g.addColorStop(0.7, "#7a1c16");
      g.addColorStop(1, "#4e100c");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.11, 0, U.TAU);
      ctx.fill();
      skull(ctx, 0, 0, R * 0.055);
      ctx.restore();

      ctx.restore();

      // Vignette.
      g = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.3, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.6)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
