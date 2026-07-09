/* SUNDIAL — weathered garden sundial, viewed from above. The gnomon's
 * shadow IS the clock: 15° per hour around the noon line, longer toward
 * dawn and dusk. After sunset the moon casts a faint cool shadow and
 * fireflies come out. Rim motto: "horas non numero nisi serenas". */
"use strict";

(() => {
  const hash = (i) => {
    const x = Math.sin(i * 157.3 + 71.7) * 43758.5453;
    return x - Math.floor(x);
  };

  const ROMAN = ["VI", "VII", "VIII", "IX", "X", "XI", "XII",
                 "I", "II", "III", "IV", "V", "VI"];

  /* Readable "smile" text along the bottom arc. phi is measured from the
   * bottom center, positive to the right; each glyph is placed explicitly
   * and tilted to follow the arc. */
  function curvedText(ctx, text, r, size, color) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = `italic ${size}px Georgia, serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const chars = [...text];
    const per = size * 0.62 / r;
    chars.forEach((ch, i) => {
      const phi = -(per * (chars.length - 1)) / 2 + i * per;
      ctx.save();
      ctx.translate(r * Math.sin(phi), r * Math.cos(phi));
      ctx.rotate(-phi);
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  }

  CLOX.register({
    id: "sundial",
    name: "Sundial · Garden Stone",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, true);
      const tf = t.H + t.m / 60 + t.s / 3600;
      const day = tf >= 6 && tf <= 18;
      // 0 at the day/night edges, 1 at local noon/midnight.
      const alt = day
        ? Math.sin(Math.PI * (tf - 6) / 12)
        : Math.sin(Math.PI * (((tf + 6) % 24) - 6 + (tf < 6 ? 12 : 0)) / 12);

      // Garden ground: mossy green, cooler and darker at night.
      const nf = day ? 0 : 1;
      const mix = (dv, nv) => Math.round(U.lerp(dv, nv, nf));
      let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, `rgb(${mix(86, 26)}, ${mix(108, 38)}, ${mix(52, 40)})`);
      g.addColorStop(1, `rgb(${mix(38, 10)}, ${mix(52, 16)}, ${mix(24, 20)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      // Grass flecks.
      for (let i = 0; i < 140; i++) {
        const gx = hash(i) * W, gy = hash(i + 900) * H;
        ctx.fillStyle = `rgba(${mix(120, 40)}, ${mix(150, 60)}, ${mix(70, 55)}, 0.25)`;
        ctx.fillRect(gx, gy, 2, 5 + hash(i + 20) * 5);
      }

      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.40;
      ctx.save();
      ctx.translate(cx, cy);

      // Stone plinth + dial plate.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = R * 0.09;
      ctx.shadowOffsetY = R * 0.045;
      ctx.beginPath();
      ctx.arc(0, 0, R * 1.06, 0, U.TAU);
      ctx.fillStyle = `rgb(${mix(112, 52)}, ${mix(106, 52)}, ${mix(94, 58)})`;
      ctx.fill();
      ctx.restore();
      g = ctx.createRadialGradient(-R * 0.25, -R * 0.3, 0, 0, 0, R);
      g.addColorStop(0, `rgb(${mix(196, 96)}, ${mix(188, 96)}, ${mix(166, 104)})`);
      g.addColorStop(1, `rgb(${mix(150, 66)}, ${mix(142, 66)}, ${mix(122, 74)})`);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();
      // Weathering: lichen spots and chips.
      for (let i = 0; i < 26; i++) {
        const a = hash(i + 40) * U.TAU, rr = Math.sqrt(hash(i + 60)) * R * 0.95;
        ctx.fillStyle = i % 3
          ? `rgba(${mix(120, 60)}, ${mix(130, 80)}, ${mix(90, 60)}, ${0.10 + hash(i) * 0.12})`
          : `rgba(60, 55, 45, ${0.08 + hash(i) * 0.08})`;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, R * (0.015 + hash(i + 5) * 0.045), 0, U.TAU);
        ctx.fill();
      }

      // Engraved rings.
      const ink = `rgba(${mix(58, 30)}, ${mix(52, 30)}, ${mix(42, 34)}, 0.9)`;
      for (const rr of [0.97, 0.80, 0.30]) {
        ctx.beginPath();
        ctx.arc(0, 0, R * rr, 0, U.TAU);
        ctx.strokeStyle = ink;
        ctx.lineWidth = R * (rr === 0.97 ? 0.014 : 0.007);
        ctx.stroke();
      }

      // Hour lines + numerals: VI (dawn) through XII (noon, up) to VI (dusk),
      // 15° per hour. Engraved look: dark line + light offset line.
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let hLine = 6; hLine <= 18; hLine++) {
        const a = (hLine - 12) * (Math.PI / 12);     // 0 = up (noon)
        ctx.save();
        ctx.rotate(a);
        ctx.strokeStyle = ink;
        ctx.lineWidth = R * (hLine % 3 === 0 ? 0.014 : 0.008);
        ctx.beginPath();
        ctx.moveTo(0, -R * 0.30);
        ctx.lineTo(0, -R * 0.78);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255, 255, 250, 0.18)";
        ctx.lineWidth = R * 0.004;
        ctx.beginPath();
        ctx.moveTo(R * 0.006, -R * 0.30);
        ctx.lineTo(R * 0.006, -R * 0.78);
        ctx.stroke();
        ctx.fillStyle = ink;
        ctx.font = `600 ${R * 0.085}px Georgia, serif`;
        ctx.fillText(ROMAN[hLine - 6], 0, -R * 0.875);
        ctx.restore();
      }
      // Half-hour dots.
      for (let hl = 6; hl < 18; hl++) {
        const a = (hl + 0.5 - 12) * (Math.PI / 12);
        ctx.beginPath();
        ctx.arc(Math.sin(a) * R * 0.78, -Math.cos(a) * R * 0.78, R * 0.010, 0, U.TAU);
        ctx.fillStyle = ink;
        ctx.fill();
      }

      // Rim motto, engraved along the bottom arc.
      curvedText(ctx, "· HORAS NON NUMERO NISI SERENAS ·", R * 0.885,
        R * 0.062, `rgba(${mix(58, 34)}, ${mix(52, 34)}, ${mix(42, 38)}, 0.85)`);

      // ---- The shadow (this is the clock) ----
      // 15°/hour about the noon line; the moon takes over at night.
      const shadowA = day
        ? (tf - 12) * (Math.PI / 12)
        : ((tf < 12 ? tf : tf - 24)) * (Math.PI / 12);
      const sLen = R * Math.min(0.82, 0.34 / Math.max(alt, 0.42) + 0.18);
      const sAlpha = day ? 0.22 + 0.16 * alt : 0.10 + 0.05 * alt;
      const sCol = day ? "40, 32, 20" : "20, 28, 60";
      ctx.save();
      ctx.rotate(shadowA);   // the shadow falls ON the current hour line
      g = ctx.createLinearGradient(0, 0, 0, -sLen);
      g.addColorStop(0, `rgba(${sCol}, ${sAlpha})`);
      g.addColorStop(1, `rgba(${sCol}, ${sAlpha * 0.35})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-R * 0.030, 0);
      ctx.lineTo(-R * 0.055, -sLen);                 // penumbra widens with distance
      ctx.lineTo(R * 0.055, -sLen);
      ctx.lineTo(R * 0.030, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // ---- Gnomon (bronze wedge pointing to noon) ----
      g = ctx.createLinearGradient(-R * 0.03, 0, R * 0.03, 0);
      g.addColorStop(0, `rgb(${mix(96, 50)}, ${mix(72, 42)}, ${mix(36, 26)})`);
      g.addColorStop(0.5, `rgb(${mix(190, 92)}, ${mix(150, 80)}, ${mix(84, 48)})`);
      g.addColorStop(1, `rgb(${mix(70, 38)}, ${mix(52, 32)}, ${mix(26, 20)})`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-R * 0.030, R * 0.06);
      ctx.lineTo(-R * 0.016, -R * 0.30);
      ctx.lineTo(0, -R * 0.34);
      ctx.lineTo(R * 0.016, -R * 0.30);
      ctx.lineTo(R * 0.030, R * 0.06);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(30, 22, 12, 0.6)";
      ctx.lineWidth = R * 0.005;
      ctx.stroke();
      // Mounting boss.
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.035, 0, U.TAU);
      g = ctx.createRadialGradient(-R * 0.008, -R * 0.008, 0, 0, 0, R * 0.035);
      g.addColorStop(0, `rgb(${mix(200, 100)}, ${mix(160, 86)}, ${mix(92, 52)})`);
      g.addColorStop(1, `rgb(${mix(80, 42)}, ${mix(60, 36)}, ${mix(30, 22)})`);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.restore();

      // Night: fireflies drift over the garden.
      if (!day) {
        for (let i = 0; i < 7; i++) {
          const fx = (hash(i + 300) + 0.14 * Math.sin(now * 0.00022 + i * 2.1)) * W;
          const fy = (hash(i + 400) + 0.10 * Math.cos(now * 0.00031 + i * 1.7)) * H;
          const pulse = Math.max(0, Math.sin(now * 0.0035 + i * 2.9));
          g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 14);
          g.addColorStop(0, `rgba(210, 255, 110, ${0.85 * pulse})`);
          g.addColorStop(1, "rgba(210, 255, 110, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(fx, fy, 14, 0, U.TAU);
          ctx.fill();
        }
        ctx.fillStyle = "rgba(8, 12, 30, 0.22)";
        ctx.fillRect(0, 0, W, H);
      }

      // Warm daylight vignette / cool night vignette.
      g = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.45)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
