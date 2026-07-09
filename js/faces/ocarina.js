/* OCARINA — Hyrule-field world clock, Ocarina of Time inspired.
 * Real day/night sky with an arcing rayed sun and crescent moon; a
 * crater-topped volcano wearing its puffy smoke ring; a white-walled,
 * blue-roofed castle seated in the hills; a blue-ceramic dial with a
 * gold band, three-triangle crest, faceted rupee markers, and a fairy
 * drifting around it. All artwork drawn from scratch (fan homage — no
 * ripped assets). */
"use strict";

(() => {
  // Sky keyframes: [hour, topColor, horizonColor]
  const SKY = [
    [0.0, [6, 10, 30], [16, 24, 48]],
    [4.5, [6, 10, 30], [16, 24, 48]],
    [6.0, [42, 58, 110], [232, 144, 90]],
    [7.5, [74, 144, 216], [184, 216, 238]],
    [12.0, [58, 126, 200], [168, 208, 232]],
    [17.0, [58, 110, 192], [216, 176, 112]],
    [18.75, [52, 48, 110], [232, 106, 58]],
    [20.5, [6, 10, 30], [16, 24, 48]],
    [24.0, [6, 10, 30], [16, 24, 48]]
  ];

  const lerpRGB = (a, b, t) =>
    `rgb(${Math.round(U.lerp(a[0], b[0], t))}, ${Math.round(U.lerp(a[1], b[1], t))}, ${Math.round(U.lerp(a[2], b[2], t))})`;

  function skyColors(tf) {
    for (let i = 0; i < SKY.length - 1; i++) {
      if (tf >= SKY[i][0] && tf <= SKY[i + 1][0]) {
        const t = (tf - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0] || 1);
        return [lerpRGB(SKY[i][1], SKY[i + 1][1], t), lerpRGB(SKY[i][2], SKY[i + 1][2], t)];
      }
    }
    return ["rgb(6,10,30)", "rgb(16,24,48)"];
  }

  function nightFactor(tf) {
    if (tf >= 7 && tf <= 17.5) return 0;
    if (tf >= 19.5 || tf <= 4.5) return 1;
    if (tf > 4.5 && tf < 7) return 1 - (tf - 4.5) / 2.5;
    return (tf - 17.5) / 2;
  }

  const hash = (i) => {
    const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function triangle(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.866, y + s * 0.5);
    ctx.lineTo(x - s * 0.866, y + s * 0.5);
    ctx.closePath();
    ctx.fill();
  }

  // Faceted rupee: elongated hexagon + inner facet line.
  function rupee(ctx, x, y, h, color) {
    const w = h * 0.62;
    const hex = (k) => {
      ctx.beginPath();
      ctx.moveTo(x, y - h * 0.5 * k);
      ctx.lineTo(x + w * 0.5 * k, y - h * 0.22 * k);
      ctx.lineTo(x + w * 0.5 * k, y + h * 0.22 * k);
      ctx.lineTo(x, y + h * 0.5 * k);
      ctx.lineTo(x - w * 0.5 * k, y + h * 0.22 * k);
      ctx.lineTo(x - w * 0.5 * k, y - h * 0.22 * k);
      ctx.closePath();
    };
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = h * 0.5;
    hex(1);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    hex(0.55);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
    ctx.lineWidth = Math.max(1, h * 0.05);
    ctx.stroke();
    hex(1);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.stroke();
    ctx.restore();
  }

  CLOX.register({
    id: "ocarina",
    name: "Ocarina · Hyrule Field",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, true);
      const tf = t.H + t.m / 60 + t.s / 3600;
      const nf = nightFactor(tf);
      const horizonY = H * 0.62;
      const shade = (base, k) => `rgb(${base.map(v => Math.round(v * (1 - 0.72 * k))).join(",")})`;

      // Sky.
      const [top, bot] = skyColors(tf);
      let g = ctx.createLinearGradient(0, 0, 0, horizonY);
      g.addColorStop(0, top);
      g.addColorStop(1, bot);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, horizonY + H * 0.04);

      // Stars at night.
      if (nf > 0.05) {
        for (let i = 0; i < 90; i++) {
          const sx = hash(i) * W;
          const sy = hash(i + 500) * horizonY * 0.9;
          const tw = 0.55 + 0.45 * Math.sin(now * 0.001 + i * 2.7);
          ctx.fillStyle = `rgba(230, 238, 255, ${(0.75 * nf * tw).toFixed(3)})`;
          ctx.fillRect(sx, sy, 2, 2);
        }
      }

      // Sun / moon arc.
      const arcR = Math.min(W, H) * 0.52;
      const body = (p, drawFn) => {
        const theta = Math.PI * (1 - p);
        drawFn(W / 2 + Math.cos(theta) * arcR * 1.5, horizonY - Math.sin(theta) * arcR * 0.85);
      };
      if (tf > 5.5 && tf < 18.5) {
        body((tf - 5.5) / 13, (x, y) => {
          const r = Math.min(W, H) * 0.045;
          ctx.save();
          ctx.shadowColor = "#ffd76a";
          ctx.shadowBlur = r * 1.6;
          ctx.fillStyle = "#ffdf7a";
          ctx.translate(x, y);
          ctx.rotate(now * 0.0001);
          for (let i = 0; i < 8; i++) {
            ctx.rotate(U.TAU / 8);
            triangle(ctx, 0, -r * 1.45, r * 0.34);
          }
          g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, "#fff3c0");
          g.addColorStop(1, "#ffc93e");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, U.TAU);
          ctx.fill();
          ctx.restore();
        });
      }
      const moonP = tf >= 18 ? (tf - 18) / 12 : (tf + 6) / 12;
      if (moonP > 0 && moonP < 1 && (tf >= 18 || tf < 6)) {
        body(moonP, (x, y) => {
          const r = Math.min(W, H) * 0.04;
          ctx.save();
          ctx.shadowColor = "#f0e6b0";
          ctx.shadowBlur = r;
          ctx.fillStyle = "#f4ecc2";
          ctx.beginPath();
          ctx.arc(x, y, r, 0, U.TAU);
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.fillStyle = top;
          ctx.beginPath();
          ctx.arc(x + r * 0.42, y - r * 0.18, r * 0.82, 0, U.TAU);
          ctx.fill();
          ctx.restore();
        });
      }

      // ---- Volcano with crater + puffy smoke ring (seated in the hills:
      // bases extend below the horizon; the grass fill overlaps them). ----
      const mx = W * 0.80, mw = W * 0.16, mTop = H * 0.33;
      const baseY = horizonY + H * 0.03;
      const rock = [96, 74, 58];
      // Smoke ring puffs, split so the ring truly encircles the cone:
      // back half drawn before the rock, front half after.
      const ringY = mTop + H * 0.055, ringRx = mw * 0.62, ringRy = H * 0.026;
      const puffs = [];
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * U.TAU;
        puffs.push({
          x: mx + Math.cos(a) * ringRx * (1 + 0.05 * hash(i + 70)),
          y: ringY + Math.sin(a) * ringRy,
          r: (H * 0.022) * (0.9 + 0.4 * hash(i + 40))
            * (1 + 0.08 * Math.sin(now * 0.0012 + i * 1.9)),
          front: Math.sin(a) >= 0            // lower arc is nearer the viewer
        });
      }
      const drawPuffs = (front) => {
        for (const p of puffs) {
          if (p.front !== front) continue;
          const lum = front ? 238 : 208;
          g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, `rgba(${lum}, ${lum}, ${lum - 8}, ${(front ? 0.9 : 0.65) - nf * 0.3})`);
          g.addColorStop(0.55, `rgba(${lum}, ${lum}, ${lum - 8}, ${(front ? 0.5 : 0.3) - nf * 0.18})`);
          g.addColorStop(1, `rgba(${lum}, ${lum}, ${lum - 8}, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, U.TAU);
          ctx.fill();
        }
      };
      drawPuffs(false);
      g = ctx.createLinearGradient(mx - mw, 0, mx + mw, 0);
      g.addColorStop(0, shade(rock.map(v => v * 1.15), nf));
      g.addColorStop(0.55, shade(rock, nf));
      g.addColorStop(1, shade(rock.map(v => v * 0.7), nf));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(mx - mw, baseY);
      // Concave slopes, twin crater lips with a dip between.
      ctx.quadraticCurveTo(mx - mw * 0.42, horizonY - H * 0.10, mx - mw * 0.16, mTop + H * 0.012);
      ctx.lineTo(mx - mw * 0.06, mTop + H * 0.030);
      ctx.lineTo(mx + mw * 0.05, mTop + H * 0.026);
      ctx.lineTo(mx + mw * 0.15, mTop);
      ctx.quadraticCurveTo(mx + mw * 0.44, horizonY - H * 0.10, mx + mw, baseY);
      ctx.closePath();
      ctx.fill();
      // Crater glow at night (the mountain never sleeps).
      if (nf > 0.2) {
        g = ctx.createRadialGradient(mx, mTop + H * 0.02, 0, mx, mTop + H * 0.02, mw * 0.5);
        g.addColorStop(0, `rgba(255, 110, 30, ${0.35 * nf})`);
        g.addColorStop(1, "rgba(255, 110, 30, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(mx - mw, mTop - H * 0.1, mw * 2, H * 0.2);
      }
      // Front half of the smoke ring wraps over the cone.
      drawPuffs(true);

      // ---- Castle: white walls, blue conical roofs, on its own rise. ----
      const kx = W * 0.155, kb = baseY + H * 0.005;
      const wall = [204, 198, 186], roof = [56, 84, 148];
      const wallC = shade(wall, nf), roofC = shade(roof, nf);
      const kh = H * 0.13, kw = W * 0.035;
      const towerXs = [kx - kw * 1.15, kx + kw * 1.15];
      // Curtain wall.
      ctx.fillStyle = shade(wall.map(v => v * 0.82), nf);
      ctx.fillRect(kx - kw * 1.6, kb - kh * 0.42, kw * 3.2, kh * 0.45);
      for (let i = 0; i < 9; i++) {   // crenellations
        ctx.fillRect(kx - kw * 1.6 + i * kw * 0.38, kb - kh * 0.50, kw * 0.20, kh * 0.09);
      }
      // Flanking towers.
      for (const tx of towerXs) {
        ctx.fillStyle = wallC;
        ctx.fillRect(tx - kw * 0.30, kb - kh * 0.78, kw * 0.60, kh * 0.80);
        ctx.fillStyle = roofC;
        ctx.beginPath();
        ctx.moveTo(tx - kw * 0.42, kb - kh * 0.78);
        ctx.lineTo(tx, kb - kh * 1.12);
        ctx.lineTo(tx + kw * 0.42, kb - kh * 0.78);
        ctx.closePath();
        ctx.fill();
      }
      // Central keep, tallest, with banner-topped cone.
      ctx.fillStyle = wallC;
      ctx.fillRect(kx - kw * 0.42, kb - kh, kw * 0.84, kh * 1.02);
      ctx.fillStyle = roofC;
      ctx.beginPath();
      ctx.moveTo(kx - kw * 0.56, kb - kh);
      ctx.lineTo(kx, kb - kh * 1.5);
      ctx.lineTo(kx + kw * 0.56, kb - kh);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = wallC;
      ctx.lineWidth = Math.max(1, H * 0.0022);
      ctx.beginPath();
      ctx.moveTo(kx, kb - kh * 1.5);
      ctx.lineTo(kx, kb - kh * 1.62);
      ctx.stroke();
      ctx.fillStyle = shade([180, 40, 40], nf);
      ctx.beginPath();
      ctx.moveTo(kx, kb - kh * 1.62);
      ctx.lineTo(kx + kw * 0.30, kb - kh * 1.56);
      ctx.lineTo(kx, kb - kh * 1.50);
      ctx.closePath();
      ctx.fill();
      // Window slits, lit at night.
      ctx.fillStyle = nf > 0.4 ? "rgba(255, 214, 120, 0.85)" : "rgba(60, 56, 66, 0.8)";
      for (const [wx, wy] of [[kx, kb - kh * 0.72], [kx, kb - kh * 0.45],
        [towerXs[0], kb - kh * 0.55], [towerXs[1], kb - kh * 0.55]]) {
        ctx.fillRect(wx - kw * 0.045, wy, kw * 0.09, kh * 0.10);
      }

      // ---- Rolling grass (drawn last: seats everything into the field) ----
      const hillTopY = (x) => horizonY + Math.sin(x * 0.004 + 2) * H * 0.012;
      g = ctx.createLinearGradient(0, horizonY, 0, H);
      g.addColorStop(0, shade([92, 128, 58], nf));
      g.addColorStop(1, shade([44, 66, 30], nf));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, hillTopY(0));
      for (let x = 0; x <= W; x += W / 48) ctx.lineTo(x, hillTopY(x));
      ctx.lineTo(W, H);
      ctx.lineTo(0, H);
      ctx.closePath();
      ctx.fill();
      // A few field trees for depth.
      for (const [fx, s] of [[0.32, 1], [0.62, 0.7], [0.90, 0.85], [0.06, 0.8]]) {
        const tx = W * fx, ts = H * 0.030 * s, ty = hillTopY(tx) + H * 0.012;
        ctx.fillStyle = shade([54, 40, 28], nf);
        ctx.fillRect(tx - ts * 0.10, ty - ts * 0.6, ts * 0.2, ts * 0.7);
        ctx.fillStyle = shade([52, 96, 40], nf);
        for (const [ox, oy, k] of [[0, -1.05, 1], [-0.55, -0.65, 0.8], [0.55, -0.65, 0.8]]) {
          ctx.beginPath();
          ctx.arc(tx + ox * ts, ty + oy * ts, ts * k * 0.62, 0, U.TAU);
          ctx.fill();
        }
      }

      // ---- Blue-ceramic dial with a gold band (the instrument's colors) ----
      const cx = W / 2, cy = H * 0.55;
      const R = Math.min(W, H) * 0.30;
      ctx.save();
      ctx.translate(cx, cy);
      // Gold band.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = R * 0.1;
      ctx.shadowOffsetY = R * 0.05;
      g = ctx.createLinearGradient(0, -R, 0, R);
      g.addColorStop(0, "#e8c96a");
      g.addColorStop(0.5, "#a87f2c");
      g.addColorStop(1, "#6e5218");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, U.TAU);
      ctx.fill();
      ctx.restore();
      // Blue ceramic face.
      g = ctx.createRadialGradient(-R * 0.25, -R * 0.35, 0, 0, 0, R * 0.9);
      g.addColorStop(0, "#3d63c8");
      g.addColorStop(0.6, "#27439c");
      g.addColorStop(1, "#152a6b");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.90, 0, U.TAU);
      ctx.fill();
      // Filigree ring.
      ctx.strokeStyle = "rgba(240, 205, 110, 0.35)";
      ctx.lineWidth = R * 0.008;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.80, 0, U.TAU);
      ctx.stroke();

      // Gold notches.
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * U.TAU;
        const major = i % 5 === 0;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = major ? "rgba(245, 215, 130, 0.9)" : "rgba(245, 215, 130, 0.35)";
        ctx.fillRect(-R * (major ? 0.009 : 0.0045), -R * 0.875,
          R * (major ? 0.018 : 0.009), R * (major ? 0.06 : 0.03));
        ctx.restore();
      }

      // Golden three-triangle crest at 12; rupees at 3, 6, 9.
      ctx.save();
      ctx.shadowColor = "#ffd23e";
      ctx.shadowBlur = R * 0.06;
      ctx.fillStyle = "#ffd94e";
      const ts2 = R * 0.055, tyy = -R * 0.62;
      triangle(ctx, 0, tyy - ts2, ts2);
      triangle(ctx, -ts2 * 0.87, tyy + ts2 * 0.52, ts2);
      triangle(ctx, ts2 * 0.87, tyy + ts2 * 0.52, ts2);
      ctx.restore();
      rupee(ctx, R * 0.66, 0, R * 0.15, "#3e8ee0");
      rupee(ctx, 0, R * 0.66, R * 0.15, "#e04848");
      rupee(ctx, -R * 0.66, 0, R * 0.15, "#3ec964");

      // Gold hands with diamond tips.
      const handG = (angle, len, w) => {
        ctx.save();
        ctx.rotate(angle);
        ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
        ctx.shadowBlur = R * 0.02;
        g = ctx.createLinearGradient(-w, 0, w, 0);
        g.addColorStop(0, "#8a6a1e");
        g.addColorStop(0.5, "#ffdf7e");
        g.addColorStop(1, "#8a6a1e");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-w / 2, R * 0.06);
        ctx.lineTo(-w * 0.22, -len + R * 0.07);
        ctx.lineTo(0, -len);
        ctx.lineTo(w * 0.22, -len + R * 0.07);
        ctx.lineTo(w / 2, R * 0.06);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };
      handG((t.fh / 12) * U.TAU, R * 0.45, R * 0.055);
      handG((t.fm / 60) * U.TAU, R * 0.66, R * 0.04);
      if (settings.seconds) {
        ctx.save();
        ctx.rotate((t.fs / 60) * U.TAU);
        ctx.strokeStyle = "#ffd77a";
        ctx.lineWidth = R * 0.010;
        ctx.beginPath();
        ctx.moveTo(0, R * 0.08);
        ctx.lineTo(0, -R * 0.72);
        ctx.stroke();
        ctx.restore();
      }
      g = ctx.createRadialGradient(-R * 0.01, -R * 0.01, 0, 0, 0, R * 0.045);
      g.addColorStop(0, "#ffe9a0");
      g.addColorStop(1, "#9a7622");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.045, 0, U.TAU);
      ctx.fill();
      // Ceramic sheen.
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.90, 0, U.TAU);
      ctx.clip();
      g = ctx.createRadialGradient(-R * 0.45, -R * 0.55, 0, -R * 0.45, -R * 0.55, R * 1.3);
      g.addColorStop(0, "rgba(255, 255, 255, 0.18)");
      g.addColorStop(0.35, "rgba(255, 255, 255, 0.04)");
      g.addColorStop(0.55, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.restore();

      // Fairy: glowing orb with flittering wings.
      const fa = now * 0.00035;
      const fr = R * (1.22 + 0.1 * Math.sin(now * 0.0011));
      const fx2 = cx + Math.cos(fa) * fr * 1.25;
      const fy2 = cy + Math.sin(fa) * fr * 0.8 + Math.sin(now * 0.004) * R * 0.03;
      const orb = R * 0.035;
      ctx.save();
      const flap = Math.sin(now * 0.03) * 0.6;
      ctx.fillStyle = "rgba(220, 240, 255, 0.55)";
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(fx2 + s * orb * 1.15, fy2 - orb * 0.3, orb * 0.9,
          orb * (1.5 + Math.abs(flap)), s * (0.6 + flap * 0.25), 0, U.TAU);
        ctx.fill();
      }
      g = ctx.createRadialGradient(fx2, fy2, 0, fx2, fy2, orb * 2.4);
      g.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      g.addColorStop(0.3, "rgba(150, 210, 255, 0.55)");
      g.addColorStop(1, "rgba(150, 210, 255, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(fx2, fy2, orb * 2.4, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      // Night dims the whole field slightly.
      if (nf > 0) {
        ctx.fillStyle = `rgba(4, 8, 24, ${0.18 * nf})`;
        ctx.fillRect(0, 0, W, H);
      }
    }
  });
})();
