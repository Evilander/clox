/* TETRIS — the stack IS the clock. Falling bars assemble HH:MM as a
 * multicolor block stack in the first ~18 seconds of each minute (a
 * piece lands every ~¾s during the build). When a digit changes, its
 * region line-clear flashes and bursts, then rebuilds. LEVEL is the
 * hour, LINES is minutes-today, SCORE is seconds-today. */
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
  const COLORS = ["#31c7ef", "#f7d308", "#ad4d9c", "#42b642", "#ef2029", "#5a65ad", "#ef7921"];
  const SCALE = 2;                        // font pixel = 2×2 well cells
  const WELL_C = 56, WELL_R = 17, FLOOR_R = 16;

  const hash = (i) => {
    const x = Math.sin(i * 151.7 + 89.1) * 43758.5453;
    return x - Math.floor(x);
  };

  /* Decompose one glyph into horizontal bars (1-4 cells), bottom-up —
   * the build order the pieces will fall in. Cells are well coords. */
  function decompose(ch, gx0, gy0, seed) {
    const gl = FONT[ch] ?? FONT[" "];
    const runs = [];
    for (let fr = 6; fr >= 0; fr--) {
      for (let sy = SCALE - 1; sy >= 0; sy--) {
        const row = [];
        for (let fc = 0; fc < gl[fr].length; fc++) {
          for (let sx = 0; sx < SCALE; sx++) {
            row.push({ on: gl[fr][fc] === "1", c: gx0 + fc * SCALE + sx });
          }
        }
        let i = 0;
        const rowRuns = [];
        while (i < row.length) {
          if (!row[i].on) { i++; continue; }
          const maxLen = 2 + Math.floor(hash(seed + fr * 31 + i) * 3);   // 2-4
          const cells = [];
          while (i < row.length && row[i].on && cells.length < maxLen) {
            cells.push({ c: row[i].c, r: gy0 + fr * SCALE + sy });
            i++;
          }
          rowRuns.push({
            cells,
            color: COLORS[Math.floor(hash(seed * 7 + fr * 13 + cells[0].c) * COLORS.length)]
          });
        }
        // Alternate scan direction per row so the build looks organic.
        if ((fr * SCALE + sy) % 2) rowRuns.reverse();
        runs.push(...rowRuns);
      }
    }
    return runs;
  }

  // ---- Module state ----
  let glyphs = [];          // [{ch, x0, runs, placed, spawned, static}]
  let curStr = "";
  const flights = [];       // {gi, runIdx, t0}
  const clears = [];        // {cells:[{c,r,color}], t0, rows:[r0,r1], cols:[c0,c1]}
  const flashes = [];       // {cells, t0}

  const glyphX0 = (pos) => {
    // widths in font cols: 5 5 2 5 5 with 1-col gaps, scaled ×2, centered in 56.
    const w = [5, 5, 2, 5, 5];
    let x = (WELL_C - (22 + 4) * SCALE) / 2;
    for (let i = 0; i < pos; i++) x += (w[i] + 1) * SCALE;
    return x;
  };

  function rebuild(str, fs, instant) {
    const prev = curStr;
    curStr = str;
    for (let p = 0; p < 5; p++) {
      const ch = str[p];
      if (glyphs[p] && prev[p] === ch) continue;      // untouched digit stays
      if (glyphs[p] && prev && prev[p] !== ch) {
        // Line-clear burst for the outgoing digit.
        const old = glyphs[p];
        const cells = [];
        for (let k = 0; k < old.placed; k++) {
          for (const cell of old.runs[k].cells) {
            cells.push({ c: cell.c, r: cell.r, color: old.runs[k].color });
          }
        }
        if (cells.length) {
          clears.push({
            cells, t0: performance.now(),
            cols: [old.x0, old.x0 + 5 * SCALE]
          });
        }
      }
      const x0 = glyphX0(p);
      const runs = decompose(ch, x0, FLOOR_R - 7 * SCALE + 1, p * 997 + ch.charCodeAt(0));
      const isStatic = ch === ":" || ch === " ";
      const target = isStatic ? runs.length : (instant ? targetFor(runs.length, fs) : 0);
      // gen invalidates any in-flight pieces aimed at the outgoing digit.
      glyphs[p] = {
        ch, x0, runs, placed: target, spawned: target, static: isStatic,
        gen: (glyphs[p] ? glyphs[p].gen : 0) + 1
      };
    }
  }

  const targetFor = (runCount, fs) => {
    if (!runCount) return 0;
    const interval = 17 / runCount;      // full digit rebuilt by ~:18
    return U.clamp(Math.floor((fs - 0.8) / interval) + 1, 0, runCount);
  };

  function drawBlock(ctx, x, y, s, color, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
    ctx.fillRect(x, y, s, Math.max(1, s * 0.14));
    ctx.fillRect(x, y, Math.max(1, s * 0.14), s);
    ctx.fillStyle = "rgba(0, 0, 0, 0.30)";
    ctx.fillRect(x, y + s - Math.max(1, s * 0.14), s, Math.max(1, s * 0.14));
    ctx.fillRect(x + s - Math.max(1, s * 0.14), y, Math.max(1, s * 0.14), s);
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(x + s * 0.22, y + s * 0.22, s * 0.2, s * 0.2);
    ctx.globalAlpha = 1;
  }

  CLOX.register({
    id: "tetris",
    name: "Tetris · Falling Digits",
    leave() {
      glyphs = [];
      curStr = "";
      flights.length = 0;
      clears.length = 0;
      flashes.length = 0;
    },

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);
      const hs = settings.h24 ? U.pad2(t.H) : String(t.h).padStart(2, " ");
      const str = hs + ":" + U.pad2(t.m);

      if (str !== curStr) rebuild(str, t.fs, curStr === "");

      // Spawn pieces to keep each glyph on its schedule (one per second-ish).
      for (let gi = 0; gi < glyphs.length; gi++) {
        const gl = glyphs[gi];
        if (gl.static) continue;
        const target = targetFor(gl.runs.length, t.fs);
        if (target - gl.spawned > 3) {          // returning to the face mid-minute
          gl.spawned = gl.placed = target;
        }
        while (gl.spawned < target) {
          flights.push({ gi, gen: gl.gen, runIdx: gl.spawned, t0: now + (gl.spawned - target) * 40 });
          gl.spawned++;
        }
      }

      // ---- Scene ----
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#0a0b12");
      g.addColorStop(1, "#101018");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const cell = Math.min((W * 0.74) / WELL_C, (H * 0.56) / WELL_R);
      const wellW = WELL_C * cell, wellH = WELL_R * cell;
      const wx = (W - wellW) / 2, wy = (H - wellH) / 2 + H * 0.02;
      const px = (c) => wx + c * cell;
      const py = (r) => wy + r * cell;
      const cabX = Math.max(0, wx - cell * 5.3);
      const cabY = Math.max(0, wy - cell * 3.8);
      const cabW = Math.min(W, wellW + cell * 10.6);
      const cabH = Math.min(H - cabY, wellH + cell * 7.3);

      // Arcade cabinet around the playfield.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.70)";
      ctx.shadowBlur = cell * 2.4;
      ctx.shadowOffsetY = cell * 0.8;
      g = ctx.createLinearGradient(cabX, cabY, cabX + cabW, cabY + cabH);
      g.addColorStop(0, "#161a28");
      g.addColorStop(0.42, "#242a3b");
      g.addColorStop(0.70, "#121622");
      g.addColorStop(1, "#070a10");
      ctx.fillStyle = g;
      U.roundRect(ctx, cabX, cabY, cabW, cabH, cell * 1.2);
      ctx.fill();
      ctx.restore();
      const marqueeH = cell * 2.4;
      g = ctx.createLinearGradient(0, cabY + cell * 0.45, 0, cabY + cell * 0.45 + marqueeH);
      g.addColorStop(0, "#f7d308");
      g.addColorStop(0.48, "#ef7921");
      g.addColorStop(1, "#8b1f35");
      ctx.fillStyle = g;
      U.roundRect(ctx, cabX + cell * 1.2, cabY + cell * 0.45, cabW - cell * 2.4, marqueeH, cell * 0.35);
      ctx.fill();
      ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
      ctx.font = `900 ${cell * 1.16}px Consolas, "Courier New", monospace`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("CLOX STACK", cabX + cabW / 2, cabY + cell * 0.45 + marqueeH * 0.54);
      ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
      ctx.fillRect(cabX + cell * 1.4, cabY + cell * 0.68, cabW - cell * 2.8, Math.max(1, cell * 0.10));

      // Glow behind the well.
      g = ctx.createRadialGradient(W / 2, wy + wellH / 2, 0, W / 2, wy + wellH / 2, wellW * 0.6);
      g.addColorStop(0, "rgba(60, 90, 180, 0.10)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Well interior + faint grid.
      ctx.fillStyle = "#0b0d13";
      ctx.save();
      ctx.shadowColor = "rgba(40, 210, 240, 0.16)";
      ctx.shadowBlur = cell * 1.4;
      U.roundRect(ctx, wx - cell * 0.45, wy - cell * 0.45, wellW + cell * 0.9, wellH + cell * 0.9, cell * 0.35);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = "#0b0d13";
      ctx.fillRect(wx, wy, wellW, wellH);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.028)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let c = 1; c < WELL_C; c++) { ctx.moveTo(px(c), wy); ctx.lineTo(px(c), wy + wellH); }
      for (let r = 1; r < WELL_R; r++) { ctx.moveTo(wx, py(r)); ctx.lineTo(wx + wellW, py(r)); }
      ctx.stroke();

      // Gray brick border: sides + floor, classic well walls.
      for (let r = 0; r <= WELL_R; r++) {
        drawBlock(ctx, px(-1), py(r), cell, "#5c636e");
        drawBlock(ctx, px(WELL_C), py(r), cell, "#5c636e");
      }
      for (let c = -1; c <= WELL_C; c++) {
        drawBlock(ctx, px(c), py(WELL_R), cell, "#5c636e");
      }

      // Locked stack.
      for (const gl of glyphs) {
        for (let k = 0; k < gl.placed; k++) {
          const run = gl.runs[k];
          for (const cellPos of run.cells) {
            drawBlock(ctx, px(cellPos.c), py(cellPos.r), cell, run.color);
          }
        }
      }
      // Occasional glint on the stack.
      const gc = Math.floor(hash(Math.floor(now / 160)) * WELL_C);
      const gr = FLOOR_R - Math.floor(hash(Math.floor(now / 160) + 7) * 13);
      ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
      ctx.fillRect(px(gc) + cell * 0.3, py(gr) + cell * 0.3, cell * 0.25, cell * 0.25);

      // Falling pieces (clipped to the well).
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx, wy, wellW, wellH);
      ctx.clip();
      for (let i = flights.length - 1; i >= 0; i--) {
        const fl = flights[i];
        const gl = glyphs[fl.gi];
        if (!gl || fl.gen !== gl.gen || fl.runIdx >= gl.runs.length) { flights.splice(i, 1); continue; }
        const run = gl.runs[fl.runIdx];
        const p = (now - fl.t0) / 400;
        if (p >= 1) {
          gl.placed = Math.max(gl.placed, fl.runIdx + 1);
          flashes.push({ cells: run.cells, t0: now });
          flights.splice(i, 1);
          continue;
        }
        if (p < 0) continue;
        const targetR = run.cells[0].r;
        const yy = U.lerp(-2 * cell + wy, py(targetR), p * p);   // gravity
        for (const cellPos of run.cells) {
          drawBlock(ctx, px(cellPos.c), yy, cell, run.color, 0.95);
        }
      }
      ctx.restore();

      // Landing flashes.
      for (let i = flashes.length - 1; i >= 0; i--) {
        const f = flashes[i];
        const p = (now - f.t0) / 140;
        if (p >= 1) { flashes.splice(i, 1); continue; }
        ctx.fillStyle = `rgba(255, 255, 255, ${0.5 * (1 - p)})`;
        for (const cellPos of f.cells) {
          ctx.fillRect(px(cellPos.c), py(cellPos.r), cell, cell);
        }
      }

      // Line-clear bursts: flash band, then cells tumble out and fade.
      for (let i = clears.length - 1; i >= 0; i--) {
        const cl = clears[i];
        const age = (now - cl.t0) / 1000;
        if (age > 0.8) { clears.splice(i, 1); continue; }
        if (age < 0.14) {
          ctx.fillStyle = `rgba(255, 255, 255, ${0.55 * (1 - age / 0.14)})`;
          ctx.fillRect(px(cl.cols[0]), py(FLOOR_R - 7 * SCALE + 1),
            (cl.cols[1] - cl.cols[0]) * cell, (7 * SCALE) * cell);
        }
        for (let k = 0; k < cl.cells.length; k++) {
          const cellPos = cl.cells[k];
          const vx = (hash(k + cl.t0 % 97) - 0.5) * 9;
          const vr = 4 + hash(k + 31) * 9;
          const xx = px(cellPos.c) + vx * age * 60;
          const yy = py(cellPos.r) - vr * age * 26 + 340 * age * age;
          ctx.save();
          ctx.translate(xx + cell / 2, yy + cell / 2);
          ctx.rotate((hash(k) - 0.5) * age * 9);
          drawBlock(ctx, -cell / 2, -cell / 2, cell, cellPos.color, U.clamp(1 - age / 0.8, 0, 1));
          ctx.restore();
        }
      }

      // CRT scanlines and curved glass over the playfield.
      ctx.save();
      ctx.beginPath();
      ctx.rect(wx, wy, wellW, wellH);
      ctx.clip();
      ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
      for (let y = wy; y < wy + wellH; y += Math.max(2, cell * 0.55)) {
        ctx.fillRect(wx, y, wellW, Math.max(1, cell * 0.08));
      }
      g = ctx.createLinearGradient(wx, wy, wx + wellW, wy + wellH);
      g.addColorStop(0.02, "rgba(255, 255, 255, 0)");
      g.addColorStop(0.20, "rgba(255, 255, 255, 0.10)");
      g.addColorStop(0.31, "rgba(255, 255, 255, 0.015)");
      g.addColorStop(0.92, "rgba(255, 255, 255, 0.055)");
      ctx.fillStyle = g;
      ctx.fillRect(wx, wy, wellW, wellH);
      ctx.restore();
      ctx.strokeStyle = "rgba(150, 230, 255, 0.20)";
      ctx.lineWidth = Math.max(1, cell * 0.10);
      U.roundRect(ctx, wx - cell * 0.45, wy - cell * 0.45, wellW + cell * 0.9, wellH + cell * 0.9, cell * 0.35);
      ctx.stroke();

      // ---- HUD panels ----
      const fsz = Math.max(12, cell * 0.85);
      ctx.font = `700 ${fsz}px Consolas, "Courier New", monospace`;
      ctx.textBaseline = "top";
      const panelX = px(WELL_C + 2.6), leftX = wx - cell * 2.6;
      // NEXT box (right): the next scheduled bar.
      ctx.textAlign = "left";
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillText("NEXT", panelX, wy);
      let nxt = null;
      for (const gl of glyphs) {
        if (!gl.static && gl.spawned < gl.runs.length) { nxt = gl.runs[gl.spawned]; break; }
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 2;
      ctx.strokeRect(panelX, wy + fsz * 1.3, cell * 5.4, cell * 2.6);
      if (nxt) {
        for (let k = 0; k < nxt.cells.length; k++) {
          drawBlock(ctx, panelX + cell * 0.7 + k * cell, wy + fsz * 1.3 + cell * 0.8, cell, nxt.color);
        }
      }
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillText("LEVEL", panelX, wy + fsz * 1.3 + cell * 3.4);
      ctx.fillStyle = "#f7d308";
      ctx.fillText(U.pad2(t.H), panelX, wy + fsz * 2.4 + cell * 3.4);
      if (settings.seconds) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
        ctx.fillText("SCORE", panelX, wy + fsz * 3.6 + cell * 3.8);
        ctx.fillStyle = "#31c7ef";
        ctx.fillText(String(t.H * 3600 + t.m * 60 + t.s).padStart(6, "0"),
          panelX, wy + fsz * 4.7 + cell * 3.8);
      }
      // Left panel: LINES (minutes today) + date + AM/PM.
      ctx.textAlign = "right";
      ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
      ctx.fillText("LINES", leftX, wy);
      ctx.fillStyle = "#42b642";
      ctx.fillText(String(t.H * 60 + t.m).padStart(4, "0"), leftX, wy + fsz * 1.1);
      ctx.fillStyle = "rgba(255, 255, 255, 0.40)";
      ctx.font = `600 ${fsz * 0.72}px Consolas, "Courier New", monospace`;
      ctx.fillText(`${U.DAYS[t.day]} ${U.MONTHS[t.month]} ${U.pad2(t.date)}`, leftX, wy + fsz * 2.6);
      if (!settings.h24) {
        ctx.fillText(t.pm ? "PM" : "AM", leftX, wy + fsz * 3.5);
      }

      // Cabinet controls and speaker details below the glass.
      const controlsY = Math.min(H - cell * 1.7, cabY + cabH - cell * 1.55);
      ctx.fillStyle = "rgba(0, 0, 0, 0.34)";
      U.roundRect(ctx, cabX + cabW * 0.20, controlsY - cell * 0.55, cabW * 0.60, cell * 1.15, cell * 0.35);
      ctx.fill();
      ctx.fillStyle = "#10131d";
      ctx.beginPath();
      ctx.arc(cabX + cabW * 0.38, controlsY - cell * 0.05, cell * 0.34, 0, U.TAU);
      ctx.fill();
      ctx.strokeStyle = "#313848";
      ctx.lineWidth = Math.max(1, cell * 0.08);
      ctx.beginPath();
      ctx.moveTo(cabX + cabW * 0.38, controlsY - cell * 0.05);
      ctx.lineTo(cabX + cabW * 0.38 - cell * 0.45, controlsY - cell * 0.46);
      ctx.stroke();
      ["#31c7ef", "#ef2029", "#f7d308"].forEach((col, i) => {
        const bx = cabX + cabW * 0.55 + i * cell * 0.72;
        const bg = ctx.createRadialGradient(bx - cell * 0.10, controlsY - cell * 0.14, 0, bx, controlsY, cell * 0.28);
        bg.addColorStop(0, "#ffffff");
        bg.addColorStop(0.22, col);
        bg.addColorStop(1, "#381216");
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.arc(bx, controlsY, cell * 0.24, 0, U.TAU);
        ctx.fill();
      });
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = Math.max(1, cell * 0.05);
      for (let i = 0; i < 7; i++) {
        const yy = controlsY - cell * 0.38 + i * cell * 0.12;
        ctx.beginPath();
        ctx.moveTo(cabX + cabW * 0.24, yy);
        ctx.lineTo(cabX + cabW * 0.32, yy);
        ctx.moveTo(cabX + cabW * 0.68, yy);
        ctx.lineTo(cabX + cabW * 0.76, yy);
        ctx.stroke();
      }

      // Vignette.
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.78);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
