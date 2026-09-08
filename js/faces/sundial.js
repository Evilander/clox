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

  // Ground + stone plate (everything but the shadow, gnomon, fireflies and
  // overlays) is static for a given size and night factor — cache it to an
  // offscreen canvas instead of repainting ~200 shapes every frame.
  let plateCache = { key: "", canvas: null };

  function buildPlate(W, H, nf) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(W * dpr));
    c.height = Math.max(2, Math.round(H * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    const mix = (dv, nv) => Math.round(U.lerp(dv, nv, nf));

    // Garden ground: mossy green, cooler and darker at night.
    let gr = g.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
    gr.addColorStop(0, `rgb(${mix(86, 26)}, ${mix(108, 38)}, ${mix(52, 40)})`);
    gr.addColorStop(1, `rgb(${mix(38, 10)}, ${mix(52, 16)}, ${mix(24, 20)})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    // Grass flecks.
    for (let i = 0; i < 140; i++) {
      const gx = hash(i) * W, gy = hash(i + 900) * H;
      g.fillStyle = `rgba(${mix(120, 40)}, ${mix(150, 60)}, ${mix(70, 55)}, 0.25)`;
      g.fillRect(gx, gy, 2, 5 + hash(i + 20) * 5);
    }
    // Large surrounding flagstones make the sundial feel seated in a garden.
    const slabW = Math.max(120, Math.min(W, H) * 0.18);
    const slabH = slabW * 0.56;
    g.lineWidth = Math.max(1, Math.min(W, H) * 0.002);
    for (let row = 0; row < 4; row++) {
      for (let col = -1; col <= Math.ceil(W / slabW) + 1; col++) {
        const sx = col * slabW + (row % 2) * slabW * 0.5;
        const sy = H * 0.64 + row * slabH * 0.62;
        const shade = mix(112 + hash(row * 19 + col) * 18, 38 + hash(row * 19 + col) * 12);
        g.fillStyle = `rgba(${shade}, ${shade - 6}, ${shade - 18}, ${U.lerp(0.20, 0.12, nf)})`;
        g.beginPath();
        g.moveTo(sx + slabW * 0.04, sy);
        g.lineTo(sx + slabW * 0.96, sy + slabH * 0.04);
        g.lineTo(sx + slabW * 0.90, sy + slabH * 0.58);
        g.lineTo(sx + slabW * 0.02, sy + slabH * 0.52);
        g.closePath();
        g.fill();
        g.strokeStyle = `rgba(${mix(48, 18)}, ${mix(42, 18)}, ${mix(32, 24)}, 0.20)`;
        g.stroke();
      }
    }

    const cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.40;
    g.save();
    g.translate(cx, cy);

    // Stone plinth + dial plate.
    g.save();
    g.shadowColor = "rgba(0, 0, 0, 0.5)";
    g.shadowBlur = R * 0.09;
    g.shadowOffsetY = R * 0.045;
    g.beginPath();
    g.arc(0, 0, R * 1.06, 0, U.TAU);
    g.fillStyle = `rgb(${mix(112, 52)}, ${mix(106, 52)}, ${mix(94, 58)})`;
    g.fill();
    g.restore();
    gr = g.createRadialGradient(-R * 0.24, -R * 0.34, 0, 0, 0, R * 1.12);
    gr.addColorStop(0, `rgb(${mix(154, 76)}, ${mix(148, 76)}, ${mix(130, 84)})`);
    gr.addColorStop(1, `rgb(${mix(80, 38)}, ${mix(76, 38)}, ${mix(66, 48)})`);
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, R * 1.05, 0, U.TAU);
    g.fill();
    g.strokeStyle = `rgba(${mix(42, 26)}, ${mix(38, 26)}, ${mix(30, 30)}, 0.45)`;
    g.lineWidth = R * 0.028;
    g.beginPath();
    g.arc(0, 0, R * 1.045, 0, U.TAU);
    g.stroke();
    gr = g.createRadialGradient(-R * 0.25, -R * 0.3, 0, 0, 0, R);
    gr.addColorStop(0, `rgb(${mix(196, 96)}, ${mix(188, 96)}, ${mix(166, 104)})`);
    gr.addColorStop(1, `rgb(${mix(150, 66)}, ${mix(142, 66)}, ${mix(122, 74)})`);
    g.beginPath();
    g.arc(0, 0, R, 0, U.TAU);
    g.fillStyle = gr;
    g.fill();
    // Weathering: lichen spots and chips.
    for (let i = 0; i < 26; i++) {
      const a = hash(i + 40) * U.TAU, rr = Math.sqrt(hash(i + 60)) * R * 0.95;
      g.fillStyle = i % 3
        ? `rgba(${mix(120, 60)}, ${mix(130, 80)}, ${mix(90, 60)}, ${0.10 + hash(i) * 0.12})`
        : `rgba(60, 55, 45, ${0.08 + hash(i) * 0.08})`;
      g.beginPath();
      g.arc(Math.cos(a) * rr, Math.sin(a) * rr, R * (0.015 + hash(i + 5) * 0.045), 0, U.TAU);
      g.fill();
    }
    // Hairline cracks cut across the stone but stay behind the hands/shadow.
    g.strokeStyle = `rgba(${mix(64, 30)}, ${mix(58, 30)}, ${mix(46, 34)}, 0.26)`;
    g.lineWidth = Math.max(1, R * 0.003);
    for (let i = 0; i < 8; i++) {
      const a = hash(i + 120) * U.TAU;
      const r0 = R * (0.25 + hash(i + 130) * 0.42);
      const len = R * (0.12 + hash(i + 140) * 0.22);
      g.beginPath();
      g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
      g.quadraticCurveTo(Math.cos(a + 0.08) * (r0 + len * 0.45), Math.sin(a + 0.08) * (r0 + len * 0.45),
        Math.cos(a - 0.06) * (r0 + len), Math.sin(a - 0.06) * (r0 + len));
      g.stroke();
    }

    // Engraved rings.
    const ink = `rgba(${mix(58, 30)}, ${mix(52, 30)}, ${mix(42, 34)}, 0.9)`;
    for (const rr of [0.97, 0.80, 0.30]) {
      g.beginPath();
      g.arc(0, 0, R * rr, 0, U.TAU);
      g.strokeStyle = ink;
      g.lineWidth = R * (rr === 0.97 ? 0.014 : 0.007);
      g.stroke();
    }
    g.fillStyle = `rgba(${mix(72, 40)}, ${mix(66, 40)}, ${mix(52, 42)}, 0.62)`;
    g.font = `700 ${R * 0.046}px Georgia, serif`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    [["N", 0], ["E", 0.25], ["S", 0.5], ["W", 0.75]].forEach(([lb, f]) => {
      const a = f * U.TAU;
      g.fillText(lb, Math.sin(a) * R * 0.46, -Math.cos(a) * R * 0.46);
    });

    // Hour lines + numerals: VI (dawn) through XII (noon, up) to VI (dusk),
    // 15° per hour. Engraved look: dark line + light offset line.
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let hLine = 6; hLine <= 18; hLine++) {
      const a = (hLine - 12) * (Math.PI / 12);     // 0 = up (noon)
      g.save();
      g.rotate(a);
      g.strokeStyle = ink;
      g.lineWidth = R * (hLine % 3 === 0 ? 0.014 : 0.008);
      g.beginPath();
      g.moveTo(0, -R * 0.30);
      g.lineTo(0, -R * 0.78);
      g.stroke();
      g.strokeStyle = "rgba(255, 255, 250, 0.18)";
      g.lineWidth = R * 0.004;
      g.beginPath();
      g.moveTo(R * 0.006, -R * 0.30);
      g.lineTo(R * 0.006, -R * 0.78);
      g.stroke();
      g.fillStyle = ink;
      g.font = `600 ${R * 0.085}px Georgia, serif`;
      g.fillText(ROMAN[hLine - 6], 0, -R * 0.875);
      g.restore();
    }
    // Half-hour dots.
    for (let hl = 6; hl < 18; hl++) {
      const a = (hl + 0.5 - 12) * (Math.PI / 12);
      g.beginPath();
      g.arc(Math.sin(a) * R * 0.78, -Math.cos(a) * R * 0.78, R * 0.010, 0, U.TAU);
      g.fillStyle = ink;
      g.fill();
    }

    // Rim motto, engraved along the bottom arc.
    curvedText(g, "· HORAS NON NUMERO NISI SERENAS ·", R * 0.885,
      R * 0.062, `rgba(${mix(58, 34)}, ${mix(52, 34)}, ${mix(42, 38)}, 0.85)`);

    g.restore();

    plateCache = { key: `${W}x${H}|${Math.round(nf * 20)}@${dpr}`, canvas: c };
  }

  CLOX.register({
    id: "sundial",
    name: "Sundial · Garden Stone",
    leave() {
      plateCache = { key: "", canvas: null };
    },

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, true);
      const tf = t.H + t.m / 60 + t.s / 3600;

      // Smooth night factor: 0 at full day, 1 at full night; ramps through
      // dawn (4.9→6.5) and dusk (17.5→19.1) instead of an instant flip.
      const nf = 1 - U.clamp(Math.min(tf - 4.9, 19.1 - tf) / 1.6, 0, 1);
      const day = nf < 0.5;   // shadow direction/color + fireflies only
      // 0 at the day/night edges, 1 at local noon/midnight.
      const alt = Math.max(
        day ? Math.sin(Math.PI * (tf - 6) / 12) : Math.cos(Math.PI * tf / 12),
        0
      );
      const mix = (dv, nv) => Math.round(U.lerp(dv, nv, nf));

      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.40;

      const plateKey = `${W}x${H}|${Math.round(nf * 20)}@${Math.min(window.devicePixelRatio || 1, 2)}`;
      if (plateCache.key !== plateKey) buildPlate(W, H, nf);
      ctx.drawImage(plateCache.canvas, 0, 0, W, H);

      let g;

      // Golden hour: warm wash as the sun nears the horizon.
      if (nf > 0.05 && nf < 0.6) {
        const gh = 0.10 * Math.sin(Math.PI * U.clamp((0.6 - nf) / 0.55, 0, 1));
        g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
        g.addColorStop(0, `rgba(255, 150, 60, ${gh.toFixed(3)})`);
        g.addColorStop(1, "rgba(255, 150, 60, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Cloud shadows drifting slowly over the daylit garden.
      if (nf < 0.4) {
        for (let i = 0; i < 2; i++) {
          const px = (0.5 + 0.46 * Math.sin(now * 0.00001 + hash(i + 600) * U.TAU)) * W;
          const py = (0.5 + 0.46 * Math.cos(now * 0.000009 + hash(i + 700) * U.TAU)) * H;
          const cr = Math.max(W, H) * (0.30 + hash(i + 800) * 0.12);
          g = ctx.createRadialGradient(px, py, 0, px, py, cr);
          g.addColorStop(0, "rgba(20, 25, 15, 0.05)");
          g.addColorStop(1, "rgba(20, 25, 15, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, cr, 0, U.TAU);
          ctx.fill();
        }
      }

      ctx.save();
      ctx.translate(cx, cy);

      // ---- The shadow (this is the clock) ----
      // 15°/hour about the noon line; the moon takes over at night.
      const shadowA = day
        ? (tf - 12) * (Math.PI / 12)
        : ((tf < 12 ? tf : tf - 24)) * (Math.PI / 12);
      const sLen = R * Math.min(0.82, 0.34 / Math.max(alt, 0.42) + 0.18);
      // Dissolve the shadow through the sun→moon handoff so the 180°
      // direction swap at mid-twilight never pops.
      const handoff = U.clamp(Math.abs(nf - 0.5) * 4, 0, 1);
      const sAlpha = (day ? 0.22 + 0.16 * alt : 0.10 + 0.05 * alt) * handoff;
      const sCol = day ? "40, 32, 20" : "20, 28, 60";
      ctx.save();
      ctx.rotate(shadowA);   // the shadow falls ON the current hour line
      ctx.shadowColor = `rgba(${sCol}, ${sAlpha * 0.7})`;
      ctx.shadowBlur = R * 0.035;
      g = ctx.createLinearGradient(0, 0, 0, -sLen);
      g.addColorStop(0, `rgba(${sCol}, ${sAlpha * 1.45})`);
      g.addColorStop(0.64, `rgba(${sCol}, ${sAlpha * 0.82})`);
      g.addColorStop(1, `rgba(${sCol}, ${sAlpha * 0.22})`);
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

      // Engraved readout for real-world readability; the shadow remains the
      // main clock, this only decodes it at TV distance.
      const plateW = Math.min(W * 0.34, R * 0.95);
      const plateH = Math.max(36, R * 0.12);
      const plateX = cx - plateW / 2, plateY = H * 0.855;
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
      ctx.shadowBlur = plateH * 0.35;
      g = ctx.createLinearGradient(0, plateY, 0, plateY + plateH);
      g.addColorStop(0, `rgba(${mix(184, 86)}, ${mix(174, 86)}, ${mix(145, 96)}, 0.78)`);
      g.addColorStop(1, `rgba(${mix(116, 46)}, ${mix(108, 46)}, ${mix(86, 58)}, 0.82)`);
      ctx.fillStyle = g;
      U.roundRect(ctx, plateX, plateY, plateW, plateH, plateH * 0.18);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = `rgba(${mix(48, 28)}, ${mix(42, 28)}, ${mix(32, 32)}, 0.55)`;
      ctx.lineWidth = Math.max(1, plateH * 0.035);
      ctx.stroke();
      const hs = settings.h24 ? U.pad2(t.H) : String(t.h);
      const readout = `${hs}:${U.pad2(t.m)}${settings.h24 ? "" : (t.pm ? " PM" : " AM")}`;
      ctx.font = `600 ${plateH * 0.43}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255, 246, 210, 0.28)";
      ctx.fillText(readout, cx, plateY + plateH * 0.50 + 1);
      ctx.fillStyle = `rgba(${mix(50, 28)}, ${mix(44, 28)}, ${mix(34, 34)}, 0.92)`;
      ctx.fillText(readout, cx, plateY + plateH * 0.50);
      ctx.restore();

      // Night: fireflies drift over the garden (brightness and the dark
      // overlay both ramp in with nf instead of snapping on at the edge).
      if (!day) {
        for (let i = 0; i < 7; i++) {
          const fx = (hash(i + 300) + 0.14 * Math.sin(now * 0.00022 + i * 2.1)) * W;
          const fy = (hash(i + 400) + 0.10 * Math.cos(now * 0.00031 + i * 1.7)) * H;
          const pulse = Math.max(0, Math.sin(now * 0.0035 + i * 2.9));
          g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 14);
          g.addColorStop(0, `rgba(210, 255, 110, ${(0.85 * pulse * nf).toFixed(3)})`);
          g.addColorStop(1, "rgba(210, 255, 110, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(fx, fy, 14, 0, U.TAU);
          ctx.fill();
        }
        ctx.fillStyle = `rgba(8, 12, 30, ${(0.22 * nf).toFixed(3)})`;
        ctx.fillRect(0, 0, W, H);
      }

      // Warm daylight vignette / cool night vignette.
      const vAlpha = U.lerp(0.32, 0.50, nf);
      g = ctx.createRadialGradient(cx, cy, Math.min(W, H) * 0.35, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, `rgba(0, 0, 0, ${vAlpha.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
