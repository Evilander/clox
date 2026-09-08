/* LCD — classic digital watch (F-91W energy). Green-gray liquid crystal
 * panel with dark segments, change ghosting, viewing-angle shading,
 * blinking colon, day/date row, resin bezel with screws, strap lugs and
 * the familiar accent text. No glow — LCDs don't emit. */
"use strict";

(() => {
  // Previous character per cell: liquid crystal relaxes slowly, so an
  // outgoing digit lingers as a faint ghost for a quarter second.
  const ghostPrev = {};
  function ghostFor(key, ch, now) {
    let g = ghostPrev[key];
    if (!g) { ghostPrev[key] = { ch, prev: null, t0: -1e9 }; return null; }
    if (g.ch !== ch) { g.prev = g.ch; g.ch = ch; g.t0 = now; }
    const age = now - g.t0;
    if (age < 260 && g.prev && g.prev !== " " && g.prev !== ":") {
      return { ch: g.prev, a: 0.18 * (1 - age / 260) };
    }
    return null;
  }

  CLOX.register({
    id: "lcd",
    name: "LCD · Digital Watch",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);

      // Room background.
      let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "#202226");
      g.addColorStop(1, "#0e0f11");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // ---- Layout: LCD window centered inside a dark resin bezel ----
      const hs = settings.h24 ? U.pad2(t.H) : String(t.h).padStart(2, " ");
      const main = hs + ":" + U.pad2(t.m);
      const secScale = 0.62;

      let dh = Math.min(H * 0.30, W * 0.20);
      const widthFor = (dhh) => {
        const dww = dhh * 0.58, gg = dhh * 0.13;
        let wsum = U.segLayout(main, dww, dhh, gg).total;
        if (settings.seconds) {
          wsum += gg * 2 + U.segLayout(U.pad2(t.s), dww * secScale, dhh * secScale, gg * secScale).total;
        }
        return wsum;
      };
      const maxW = W * 0.56;
      if (widthFor(dh) > maxW) dh *= maxW / widthFor(dh);
      const dw = dh * 0.58, gap = dh * 0.13;

      const layout = U.segLayout(main, dw, dh, gap);
      const secLayout = settings.seconds
        ? U.segLayout(U.pad2(t.s), dw * secScale, dh * secScale, gap * secScale)
        : null;
      const totalW = layout.total + (secLayout ? gap * 2 + secLayout.total : 0);

      // Panel and bezel rects.
      const padX = dh * 0.45, topRow = dh * 0.52;
      const pw = totalW + padX * 2;
      const ph = dh + topRow + dh * 0.42;
      const pxx = (W - pw) / 2;
      const pyy = (H - ph) / 2 + dh * 0.05;
      const bez = dh * 0.42;

      // Full resin strap, tucked behind the case with molded ridges.
      const lugW = pw * 0.45, lugH = dh * 0.35;
      const strapW = Math.min(pw * 0.34, dh * 1.65);
      const strapX = W / 2 - strapW / 2;
      g = ctx.createLinearGradient(strapX, 0, strapX + strapW, 0);
      g.addColorStop(0, "#07080c");
      g.addColorStop(0.18, "#181b23");
      g.addColorStop(0.50, "#10131a");
      g.addColorStop(0.82, "#1c2028");
      g.addColorStop(1, "#050609");
      ctx.fillStyle = g;
      U.roundRect(ctx, strapX, -dh * 0.2, strapW, pyy - dh * 0.05, dh * 0.08);
      ctx.fill();
      U.roundRect(ctx, strapX, pyy + ph + dh * 0.05, strapW, H - (pyy + ph) + dh * 0.2, dh * 0.08);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.035)";
      ctx.lineWidth = Math.max(1, dh * 0.010);
      for (let i = 0; i < 6; i++) {
        const yy = pyy - dh * 0.58 - i * dh * 0.19;
        ctx.beginPath();
        ctx.moveTo(strapX + strapW * 0.18, yy);
        ctx.lineTo(strapX + strapW * 0.82, yy);
        ctx.stroke();
      }
      for (let i = 0; i < 6; i++) {
        const yy = pyy + ph + dh * 0.58 + i * dh * 0.19;
        ctx.beginPath();
        ctx.moveTo(strapX + strapW * 0.18, yy);
        ctx.lineTo(strapX + strapW * 0.82, yy);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(0, 0, 0, 0.42)";
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.ellipse(W / 2, pyy + ph + dh * (0.72 + i * 0.35), strapW * 0.12, dh * 0.045, 0, 0, U.TAU);
        ctx.fill();
      }

      // Strap lugs, tucked behind the case top and bottom.
      for (const s of [-1, 1]) {
        const ly = s < 0 ? pyy - bez - lugH : pyy + ph + bez;
        ctx.fillStyle = "#101116";
        ctx.beginPath();
        ctx.moveTo(W / 2 - lugW / 2 + lugH * 0.3, s < 0 ? ly : ly + lugH);
        ctx.lineTo(W / 2 + lugW / 2 - lugH * 0.3, s < 0 ? ly : ly + lugH);
        ctx.lineTo(W / 2 + lugW / 2, s < 0 ? ly + lugH : ly);
        ctx.lineTo(W / 2 - lugW / 2, s < 0 ? ly + lugH : ly);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
        ctx.fillRect(W / 2 - lugW / 2 + lugH * 0.3, s < 0 ? ly : ly + lugH - 1,
          lugW - lugH * 0.6, 1);
      }

      // Resin bezel (navy-black, like the classic watch case).
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = dh * 0.25;
      ctx.shadowOffsetY = dh * 0.08;
      g = ctx.createLinearGradient(0, pyy - bez, 0, pyy + ph + bez);
      g.addColorStop(0, "#23262e");
      g.addColorStop(0.5, "#181a20");
      g.addColorStop(1, "#101116");
      ctx.fillStyle = g;
      U.roundRect(ctx, pxx - bez, pyy - bez, pw + bez * 2, ph + bez * 2, dh * 0.28);
      ctx.fill();
      ctx.restore();
      g = ctx.createLinearGradient(pxx - bez, 0, pxx + pw + bez, 0);
      g.addColorStop(0, "rgba(0, 0, 0, 0.38)");
      g.addColorStop(0.12, "rgba(255, 255, 255, 0.060)");
      g.addColorStop(0.50, "rgba(255, 255, 255, 0.012)");
      g.addColorStop(0.88, "rgba(255, 255, 255, 0.036)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.46)");
      ctx.fillStyle = g;
      U.roundRect(ctx, pxx - bez, pyy - bez, pw + bez * 2, ph + bez * 2, dh * 0.28);
      ctx.fill();

      // Side pushers, proud of the resin body.
      for (const side of [-1, 1]) {
        const bx = side < 0 ? pxx - bez - dh * 0.10 : pxx + pw + bez - dh * 0.02;
        for (const fy of [0.22, 0.50]) {
          g = ctx.createLinearGradient(side < 0 ? bx + dh * 0.14 : bx, 0, side < 0 ? bx : bx + dh * 0.14, 0);
          g.addColorStop(0, "#0a0b0f");
          g.addColorStop(1, "#282c34");
          ctx.fillStyle = g;
          U.roundRect(ctx, bx, pyy + ph * fy, dh * 0.14, dh * 0.24, dh * 0.035);
          ctx.fill();
        }
      }

      // Corner screws in the bezel.
      for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const sx = pxx - bez * 0.55 + fx * (pw + bez * 1.1);
        const sy = pyy - bez * 0.55 + fy * (ph + bez * 1.1);
        g = ctx.createRadialGradient(sx - dh * 0.012, sy - dh * 0.012, 0, sx, sy, dh * 0.045);
        g.addColorStop(0, "#3a3d46");
        g.addColorStop(1, "#15161a");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(sx, sy, dh * 0.045, 0, U.TAU);
        ctx.fill();
        ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
        ctx.lineWidth = Math.max(1, dh * 0.012);
        ctx.beginPath();
        ctx.moveTo(sx - dh * 0.026, sy + dh * 0.012);
        ctx.lineTo(sx + dh * 0.026, sy - dh * 0.012);
        ctx.stroke();
      }

      // Bezel accent text.
      const afs = Math.max(11, dh * 0.11);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `700 ${afs * 1.15}px "Segoe UI", sans-serif`;
      ctx.fillStyle = "#d9dade";
      ctx.fillText("CLOX", W / 2, pyy - bez * 0.52);
      ctx.font = `600 ${afs * 0.8}px "Segoe UI", sans-serif`;
      ctx.fillStyle = "#c33b3b";
      ctx.textAlign = "left";
      ctx.fillText("WR", pxx, pyy + ph + bez * 0.52);
      ctx.fillStyle = "#3c78c9";
      ctx.textAlign = "right";
      ctx.fillText("ALARM CHRONOGRAPH", pxx + pw, pyy + ph + bez * 0.52);
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(217, 218, 222, 0.35)";
      ctx.fillText("QUARTZ", W / 2, pyy + ph + bez * 0.52);

      // Yellow keyline around the LCD window.
      ctx.strokeStyle = "#e0b23c";
      ctx.lineWidth = Math.max(1.5, dh * 0.018);
      U.roundRect(ctx, pxx - dh * 0.07, pyy - dh * 0.07, pw + dh * 0.14, ph + dh * 0.14, dh * 0.10);
      ctx.stroke();

      // LCD glass: green-gray, brighter toward the top like real cells.
      g = ctx.createLinearGradient(0, pyy, 0, pyy + ph);
      g.addColorStop(0, "#b4bfa4");
      g.addColorStop(0.5, "#a8b399");
      g.addColorStop(1, "#98a48b");
      ctx.fillStyle = g;
      U.roundRect(ctx, pxx, pyy, pw, ph, dh * 0.06);
      ctx.fill();
      ctx.strokeStyle = "rgba(20, 30, 18, 0.42)";
      ctx.lineWidth = Math.max(1, dh * 0.020);
      U.roundRect(ctx, pxx + dh * 0.02, pyy + dh * 0.02, pw - dh * 0.04, ph - dh * 0.04, dh * 0.055);
      ctx.stroke();
      // Inner shadow along the top edge.
      g = ctx.createLinearGradient(0, pyy, 0, pyy + dh * 0.14);
      g.addColorStop(0, "rgba(0, 0, 0, 0.30)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      U.roundRect(ctx, pxx, pyy, pw, ph, dh * 0.06);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
      for (let y = pyy + dh * 0.12; y < pyy + ph - dh * 0.08; y += dh * 0.16) {
        ctx.fillRect(pxx + dh * 0.08, y, pw - dh * 0.16, Math.max(1, dh * 0.006));
      }

      const INK = "#1c241c";
      const GHOST = "rgba(28, 36, 28, 0.075)";
      const opt = { t: dh * 0.115, on: INK, off: GHOST, glow: 0, glowColor: "rgba(0,0,0,0)" };

      // Segment shadow pass gives the crystal a little physical depth.
      const drawRow = (o) => {
        const y0 = pyy + topRow;
        let x = pxx + padX + o;
        for (const cell of layout.cells) {
          if (cell.ch === ":") U.drawSegColon(ctx, x, y0 + o, cell.w, dh, opt, t.ms < 500);
          else U.drawSevenSeg(ctx, cell.ch, x, y0 + o, dw, dh, opt);
          x += cell.w + gap;
        }
        if (secLayout) {
          const so = Object.assign({}, opt, { t: opt.t * secScale });
          let sx = pxx + padX + layout.total + gap * 2 + o;
          const sy = y0 + dh * (1 - secScale) + o;
          for (const cell of secLayout.cells) {
            U.drawSevenSeg(ctx, cell.ch, sx, sy, dw * secScale, dh * secScale, so);
            sx += cell.w + gap * secScale;
          }
        }
      };
      // Outgoing digits linger as pale ghosts (crystal relaxation).
      {
        const y0 = pyy + topRow;
        let x = pxx + padX, di = 0;
        const gOpt = { t: opt.t, on: INK, off: "rgba(0,0,0,0)", glow: 0, glowColor: "rgba(0,0,0,0)" };
        for (const cell of layout.cells) {
          if (cell.ch !== ":") {
            const gh = ghostFor(`m${di}`, cell.ch, now);
            if (gh) {
              gOpt.on = `rgba(28, 36, 28, ${gh.a})`;
              U.drawSevenSeg(ctx, gh.ch, x, y0, dw, dh, gOpt);
            }
            di++;
          }
          x += cell.w + gap;
        }
        if (secLayout) {
          let sx = pxx + padX + layout.total + gap * 2, si = 0;
          const sy = y0 + dh * (1 - secScale);
          const sgOpt = Object.assign({}, gOpt, { t: opt.t * secScale });
          for (const cell of secLayout.cells) {
            const gh = ghostFor(`s${si}`, cell.ch, now);
            if (gh) {
              sgOpt.on = `rgba(28, 36, 28, ${gh.a})`;
              U.drawSevenSeg(ctx, gh.ch, sx, sy, dw * secScale, dh * secScale, sgOpt);
            }
            sx += cell.w + gap * secScale;
            si++;
          }
        }
      }
      const inkOpt = { on: opt.on, off: opt.off };
      opt.on = "rgba(0, 0, 0, 0.13)";
      opt.off = "rgba(0, 0, 0, 0)";
      drawRow(dh * 0.014);            // offset shadow
      opt.on = inkOpt.on;
      opt.off = inkOpt.off;
      drawRow(0);                     // real segments

      // Top row: day + date (left), AM/PM (right), like the watch's header.
      const hfs = dh * 0.30;
      ctx.font = `700 ${hfs}px Consolas, "Segoe UI", monospace`;
      ctx.fillStyle = INK;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      const hy = pyy + topRow * 0.52;
      ctx.fillText(`${U.DAYS[t.day].slice(0, 2)}  ${t.date}`, pxx + padX, hy);
      if (!settings.h24) {
        ctx.textAlign = "right";
        ctx.fillText(t.pm ? "PM" : "AM", pxx + pw - padX, hy);
      }
      // Divider under the header row.
      ctx.fillStyle = "rgba(28, 36, 28, 0.35)";
      ctx.fillRect(pxx + padX * 0.5, pyy + topRow * 0.92, pw - padX, Math.max(1, dh * 0.012));

      // Viewing angle: real crystal dims toward the bottom of the cell.
      g = ctx.createLinearGradient(0, pyy + ph * 0.55, 0, pyy + ph);
      g.addColorStop(0, "rgba(26, 34, 26, 0)");
      g.addColorStop(1, "rgba(26, 34, 26, 0.10)");
      ctx.fillStyle = g;
      U.roundRect(ctx, pxx, pyy, pw, ph, dh * 0.06);
      ctx.fill();

      // Glass glare sweep.
      ctx.save();
      U.roundRect(ctx, pxx, pyy, pw, ph, dh * 0.06);
      ctx.clip();
      g = ctx.createLinearGradient(pxx, pyy, pxx + pw * 0.55, pyy + ph);
      g.addColorStop(0, "rgba(255, 255, 255, 0.16)");
      g.addColorStop(0.25, "rgba(255, 255, 255, 0.03)");
      g.addColorStop(0.5, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(pxx, pyy, pw, ph);
      ctx.restore();

      // Vignette.
      g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.45)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
