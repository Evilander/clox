/* TIFO — the crowd IS the clock. A floodlit stadium stand of ~2,000
 * simulated fans, each holding a colored card; together the cards spell
 * the time, card-stunt style. The stadium wave laps the stand exactly
 * once per minute — the wave front is the second hand. Minute changes
 * ripple through as a card-flip cascade with human reaction-time noise,
 * laggards, and the occasional fan holding the wrong card. On the hour:
 * confetti, camera flashes, and a fresh tifo colorway. */
"use strict";

(() => {
  const FONT = {
    "0": ["01110","10001","10011","10101","11001","10001","01110"],
    "1": ["00100","01100","00100","00100","00100","00100","01110"],
    "2": ["01110","10001","00001","00010","00100","01000","11111"],
    "3": ["11111","00010","00100","00010","00001","10001","01110"],
    "4": ["00010","00110","01010","10010","11111","00010","00010"],
    "5": ["11111","10000","11110","00001","00001","10001","01110"],
    "6": ["00110","01000","10000","11110","10001","10001","01110"],
    "7": ["11111","00001","00010","00100","01000","01000","01000"],
    "8": ["01110","10001","10001","01110","10001","10001","01110"],
    "9": ["01110","10001","10001","01111","00001","00010","01100"],
    ":": ["00","00","11","00","11","00","00"],
    " ": ["00000","00000","00000","00000","00000","00000","00000"]
  };

  /* Hourly tifo colorways: two stand colors, digit color, confetti accent. */
  const PALETTES = [
    { a: "#9c1c24", b: "#6d1218", fg: "#f7f0e2", ac: "#ffd25e" },
    { a: "#164a9e", b: "#0e3170", fg: "#ffd25e", ac: "#8fd0ff" },
    { a: "#0f7a3d", b: "#0a5429", fg: "#f2efe4", ac: "#ffe08a" },
    { a: "#d15a1e", b: "#a03e10", fg: "#182a48", ac: "#ffe9c8" },
    { a: "#4a1d7a", b: "#331353", fg: "#ffcf4a", ac: "#d5a9ff" },
    { a: "#23262c", b: "#31353d", fg: "#ff4646", ac: "#e8e8e8" }
  ];

  const SKIN = ["#f0c8a0", "#dba873", "#b97a4e", "#8a5a34", "#6b4226", "#f5d3b3"];
  const HAIR = ["#1e1a16", "#3a2c1c", "#6e4a26", "#948b7e", "#c9c3b8", "#57402a"];

  const hash = (i) => {
    const x = Math.sin(i * 269.5 + 183.3) * 43758.5453;
    return x - Math.floor(x);
  };

  // ---- Crowd state (rebuilt when the window size changes) ----
  let grid = { key: "", cols: 0, rows: 0, cell: 0, rowH: 0, top: 0, fans: [] };
  let lastStr = "", flipT0 = -1e9, prevStr = "";
  let lastHour = -1, hourFxT0 = -1e9;
  const confetti = [];
  let ball = { until: -1e9, t0: 0, dir: 1 };
  let evSeed = 0;                       // stream for one-shot event randomness

  const rnd = () => hash(evSeed++ + 0.37);

  function rebuild(W, H) {
    const key = `${W}x${H}`;
    if (grid.key === key) return;
    const cols = 66;
    const cell = (W * 0.98) / cols;
    const top = H * 0.175, bot = H * 0.845;
    const rowH = cell * 0.80;
    const rows = Math.max(16, Math.floor((bot - top) / rowH));
    const fans = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const i = r * cols + c;
        fans.push({
          c, r,
          skin: SKIN[Math.floor(hash(i + 11) * SKIN.length)],
          hair: hash(i + 23) < 0.04 ? null : HAIR[Math.floor(hash(i + 31) * HAIR.length)],
          shirtK: hash(i + 47),                    // tinted from palette later
          phase: hash(i + 5) * U.TAU,
          speed: 0.0007 + hash(i + 7) * 0.0011,
          flipNoise: hash(i + 13) * 260,
          laggard: hash(i + 17) < 0.02 ? 700 + hash(i + 19) * 1800 : 0,
          wrongUntil: -1e9,
          scratchAt: 9e9,
          phone: hash(i + 29) < 0.0016
        });
      }
    }
    grid = { key, cols, rows, cell, rowH, top, fans };
  }

  /* Map a grid cell to its card color for the given time string. */
  function makeMosaic(cols, rows, str, pal) {
    // Glyph widths: digits/space 5, colon 2, plus 1-col gaps.
    const widths = [...str].map(ch => (FONT[ch] ?? FONT[" "])[0].length);
    const totalC = widths.reduce((a, b) => a + b, 0) + (str.length - 1);
    const sx = Math.max(1, Math.floor((cols * 0.92) / totalC));
    const sy = Math.max(1, Math.floor((rows * 0.78) / 7));
    const w = totalC * sx, h = 7 * sy;
    const x0 = Math.floor((cols - w) / 2), y0 = Math.floor((rows - h) / 2);
    const lit = new Set();
    let gx = x0;
    [...str].forEach((ch, gi) => {
      const gl = FONT[ch] ?? FONT[" "];
      for (let rr = 0; rr < 7; rr++) {
        for (let cc = 0; cc < gl[rr].length; cc++) {
          if (gl[rr][cc] !== "1") continue;
          for (let dy = 0; dy < sy; dy++) {
            for (let dx = 0; dx < sx; dx++) {
              lit.add((y0 + rr * sy + dy) * cols + (gx + cc * sx + dx));
            }
          }
        }
      }
      gx += (widths[gi] + 1) * sx;
    });
    return (c, r) => {
      if (lit.has(r * cols + c)) return pal.fg;
      // Stand pattern: broad horizontal bands; last palette goes checkered.
      if (pal === PALETTES[5]) return (c + r) % 2 ? pal.a : pal.b;
      return Math.floor(r / 3) % 2 ? pal.a : pal.b;
    };
  }

  CLOX.register({
    id: "tifo",
    name: "Tifo · The Crowd Is The Clock",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);
      rebuild(W, H);
      const { cols, rows, cell, rowH, top, fans } = grid;
      const pal = PALETTES[t.H % PALETTES.length];
      const prevPal = PALETTES[(t.H + PALETTES.length - 1) % PALETTES.length];

      const hs = settings.h24 ? U.pad2(t.H) : String(t.h).padStart(2, " ");
      const str = hs + ":" + U.pad2(t.m);
      if (str !== lastStr) {
        prevStr = lastStr || str;
        lastStr = str;
        flipT0 = now;
        for (const f of fans) {
          f.wrongUntil = (hash(evSeed++ + f.c * 7 + f.r) < 0.006)
            ? now + f.c * 10 + f.flipNoise + 1500 + rnd() * 1100 : -1e9;
        }
      }
      if (t.H !== lastHour) {
        if (lastHour !== -1) {
          hourFxT0 = now;
          for (let i = 0; i < 150; i++) {
            confetti.push({
              x: rnd() * W, y: top - rnd() * H * 0.15,
              vx: (rnd() - 0.5) * 40, vy: 30 + rnd() * 60,
              ph: rnd() * U.TAU, w: 4 + rnd() * 5,
              col: [pal.fg, pal.ac, "#ffffff", pal.a][Math.floor(rnd() * 4)]
            });
          }
        }
        lastHour = t.H;
      }

      // Mosaics for the new and (mid-cascade) previous minute.
      const mosaic = makeMosaic(cols, rows, str, pal);
      const flipAge = now - flipT0;
      const mosaicPrev = flipAge < 4200 ? makeMosaic(cols, rows, prevStr, pal) : null;

      // ---- Night sky + floodlit haze ----
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#05070f");
      g.addColorStop(0.5, "#0a0d18");
      g.addColorStop(1, "#0d1016");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      for (const fx of [0.06, 0.94]) {
        g = ctx.createRadialGradient(W * fx, H * 0.05, 0, W * fx, H * 0.05, H * 0.85);
        g.addColorStop(0, "rgba(255, 244, 214, 0.16)");
        g.addColorStop(0.4, "rgba(255, 244, 214, 0.05)");
        g.addColorStop(1, "rgba(255, 244, 214, 0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // Floodlight pylons.
      for (const fx of [0.06, 0.94]) {
        const px = W * fx, py = H * 0.045;
        ctx.fillStyle = "#1a1d24";
        ctx.fillRect(px - W * 0.003, py, W * 0.006, H * 0.10);
        ctx.save();
        ctx.shadowColor = "#fff4d6";
        ctx.shadowBlur = cell * 0.8;
        ctx.fillStyle = "#ffefc4";
        for (let lr = 0; lr < 2; lr++) {
          for (let lc = -2; lc <= 2; lc++) {
            ctx.fillRect(px + lc * W * 0.008 - W * 0.0025,
              py - H * 0.012 - lr * H * 0.014, W * 0.005, H * 0.008);
          }
        }
        ctx.restore();
      }

      // ---- Scoreboard ----
      const sbH = H * 0.055, sbW = Math.min(W * 0.56, cell * 40);
      const sbX = (W - sbW) / 2, sbY = H * 0.055;
      ctx.fillStyle = "#0c0e13";
      U.roundRect(ctx, sbX, sbY, sbW, sbH, sbH * 0.2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 200, 90, 0.25)";
      ctx.lineWidth = Math.max(1, H * 0.0015);
      U.roundRect(ctx, sbX, sbY, sbW, sbH, sbH * 0.2);
      ctx.stroke();
      const sfs = sbH * 0.42;
      ctx.font = `600 ${sfs}px Consolas, "Segoe UI", monospace`;
      ctx.textBaseline = "middle";
      ctx.save();
      ctx.shadowColor = "#ffb840";
      ctx.shadowBlur = sfs * 0.5;
      ctx.fillStyle = "#ffc95e";
      ctx.textAlign = "left";
      ctx.fillText("CLOX FC 0 - 0 REAL TIME", sbX + sbW * 0.03, sbY + sbH / 2);
      ctx.textAlign = "right";
      const match = `${U.DAYS[t.day]} ${U.MONTHS[t.month]} ${t.date}` +
        (settings.h24 ? "" : (t.pm ? " · PM" : " · AM")) +
        (settings.seconds ? `  ${t.m}'${U.pad2(t.s)}"` : "");
      ctx.fillText(match, sbX + sbW * 0.97, sbY + sbH / 2);
      ctx.restore();

      // ---- The stand ----
      const waveCol = (t.fs / 60) * (cols + 18) - 9;   // one lap per minute
      const x0 = (W - cols * cell) / 2;
      const bowl = (c) => (1 - Math.cos((c / (cols - 1) - 0.5) * Math.PI)) * -rowH * 1.6;

      // Seat rows behind the crowd.
      for (let r = 0; r < rows; r++) {
        ctx.fillStyle = r % 2 ? "#14161b" : "#171a20";
        ctx.fillRect(x0, top + r * rowH + rowH * 0.35, cols * cell, rowH * 0.66);
      }

      const armC = "rgba(230, 200, 170, 0.9)";
      for (const f of fans) {
        const fx = x0 + f.c * cell;
        let fy = top + f.r * rowH + bowl(f.c);

        // Wave envelope: the second hand, worn by people.
        const dc = f.c - waveCol + f.r * 0.06;
        const env = Math.exp(-(dc * dc) / 16);
        fy -= env * rowH * 0.95;

        // Card flip progress for this fan.
        let cardCol = mosaic(f.c, f.r);
        let squish = 1;
        if (mosaicPrev) {
          const p = (flipAge - (f.c * 10 + f.flipNoise + f.laggard)) / 220;
          if (p < 0) cardCol = mosaicPrev(f.c, f.r);
          else if (p < 1) {
            squish = Math.abs(Math.cos(p * Math.PI));
            if (p < 0.5) cardCol = mosaicPrev(f.c, f.r);
            fy -= (1 - squish) * rowH * 0.12;
          }
        }
        // The fan holding the wrong card (bless them).
        if (now < f.wrongUntil) {
          cardCol = cardCol === pal.fg ? pal.a : pal.fg;
        } else if (f.wrongUntil > -1e9 && now - f.wrongUntil < 160) {
          squish = Math.abs(Math.cos(((now - f.wrongUntil) / 160) * Math.PI));
        }

        // Body + head (pixel-crowd style: pure rects, fast and charming).
        // Jackets stay dark — the cards are the only bright thing in a tifo.
        const bob = Math.sin(now * f.speed + f.phase) * cell * 0.03;
        ctx.fillStyle = f.shirtK < 0.45 ? "#2b2e35" : (f.shirtK < 0.8 ? "#34302e" : "#22262d");
        ctx.fillRect(fx + cell * 0.16, fy + rowH * 0.46 + bob, cell * 0.68, rowH * 0.58);
        ctx.fillStyle = f.skin;
        ctx.fillRect(fx + cell * 0.32, fy + rowH * 0.14 + bob, cell * 0.36, cell * 0.36);
        if (f.hair) {
          ctx.fillStyle = f.hair;
          ctx.fillRect(fx + cell * 0.30, fy + rowH * 0.10 + bob, cell * 0.40, cell * 0.14);
        }

        // Scratch break: card down for a moment, then back up.
        if (now > f.scratchAt) {
          if (now > f.scratchAt + 1500) f.scratchAt = 9e9;
        } else if (f.scratchAt === 9e9 && hash(evSeed + f.c * 13 + f.r * 7) < 0.0000018) {
          f.scratchAt = now;
        }
        const cardDown = now > f.scratchAt && now < f.scratchAt + 1500;

        if (f.phone) {
          // Face lit by the glow of a phone. At a match. Honestly.
          ctx.fillStyle = "rgba(140, 190, 255, 0.85)";
          ctx.fillRect(fx + cell * 0.38, fy + rowH * 0.55 + bob, cell * 0.24, cell * 0.30);
        } else if (!cardDown) {
          const lift = env * rowH * 0.35;
          const cardH = rowH * 0.76 * squish;
          const cy = fy - rowH * 0.50 - lift + (rowH * 0.76 - cardH) / 2 + bob;
          ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
          ctx.fillRect(fx + cell * 0.10, cy + cardH * 0.12, cell * 0.84, cardH);
          ctx.fillStyle = cardCol;
          ctx.fillRect(fx + cell * 0.08, cy, cell * 0.84, cardH);
          if (env > 0.45) {
            ctx.fillStyle = armC;
            ctx.fillRect(fx + cell * 0.16, cy + cardH * 0.7, cell * 0.07, rowH * 0.5);
            ctx.fillRect(fx + cell * 0.77, cy + cardH * 0.7, cell * 0.07, rowH * 0.5);
          }
        }
      }

      // Camera flashes: occasional glints, a frenzy after the hour turns.
      const flashN = now - hourFxT0 < 8000 ? 6 : (hash(evSeed++ + 0.7) < 0.012 ? 1 : 0);
      for (let i = 0; i < flashN; i++) {
        {
          const c = Math.floor(rnd() * cols), r = Math.floor(rnd() * rows);
          const fx = x0 + c * cell, fy = top + r * rowH + bowl(c);
          ctx.save();
          ctx.shadowColor = "#ffffff";
          ctx.shadowBlur = cell * 1.2;
          ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
          ctx.fillRect(fx + cell * 0.3, fy, cell * 0.4, cell * 0.4);
          ctx.restore();
        }
      }

      // Beach ball: someone always brings one.
      if (now > ball.until && hash(evSeed++ + 0.5) < 0.00017) {
        ball = { until: now + 6500, t0: now, dir: rnd() < 0.5 ? 1 : -1 };
      }
      if (now < ball.until) {
        const bp = (now - ball.t0) / 6500;
        const bx = ball.dir > 0 ? bp * (W + 80) - 40 : W + 40 - bp * (W + 80);
        const by = top + rows * rowH * 0.45 - Math.abs(Math.sin(bp * Math.PI * 3)) * rowH * 5;
        const br = cell * 1.1;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(now * 0.004 * ball.dir);
        for (let s = 0; s < 6; s++) {
          ctx.fillStyle = s % 2 ? "#e8e6e0" : "#d84040";
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, br, (s / 6) * U.TAU, ((s + 1) / 6) * U.TAU);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      }

      // Confetti.
      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i];
        p.x += (p.vx + Math.sin(now * 0.003 + p.ph) * 30) * 0.016;
        p.y += p.vy * 0.016;
        if (p.y > top + rows * rowH) { confetti.splice(i, 1); continue; }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(now * 0.004 + p.ph);
        ctx.fillStyle = p.col;
        ctx.fillRect(-p.w / 2, -p.w / 4, p.w, p.w / 2);
        ctx.restore();
      }

      // Depth: upper rows fall away into shadow.
      g = ctx.createLinearGradient(0, top - rowH * 2, 0, top + rows * rowH);
      g.addColorStop(0, "rgba(0, 0, 0, 0.55)");
      g.addColorStop(0.4, "rgba(0, 0, 0, 0.12)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, top - rowH * 2, W, rows * rowH + rowH * 2);

      // ---- Ad boards + pitch sliver ----
      const adY = top + rows * rowH + rowH * 0.4;
      ctx.fillStyle = "#101318";
      ctx.fillRect(0, adY, W, H * 0.030);
      ctx.font = `600 ${H * 0.018}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(150, 200, 255, 0.35)";
      for (let ax = W * 0.1; ax < W; ax += W * 0.2) {
        ctx.fillText("C L O X", ax, adY + H * 0.015);
      }
      g = ctx.createLinearGradient(0, adY + H * 0.03, 0, H);
      g.addColorStop(0, "#1d4a26");
      g.addColorStop(1, "#0f2a15");
      ctx.fillStyle = g;
      ctx.fillRect(0, adY + H * 0.03, W, H - adY);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = Math.max(1.5, H * 0.0022);
      ctx.beginPath();
      ctx.moveTo(0, adY + H * 0.055);
      ctx.lineTo(W, adY + H * 0.055);
      ctx.stroke();

      // Vignette.
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.4, W / 2, H / 2, Math.max(W, H) * 0.78);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
