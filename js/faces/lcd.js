/* LCD — classic digital watch (F-91W energy). Green-gray liquid crystal
 * panel with dark segments, blinking colon, day/date row, resin bezel
 * with the familiar accent text. No glow — LCDs don't emit. */
"use strict";

CLOX.register({
  id: "lcd",
  name: "LCD · Digital Watch",

  draw(ctx, W, H, d, settings) {
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
    // Inner shadow along the top edge.
    g = ctx.createLinearGradient(0, pyy, 0, pyy + dh * 0.14);
    g.addColorStop(0, "rgba(0, 0, 0, 0.30)");
    g.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = g;
    U.roundRect(ctx, pxx, pyy, pw, ph, dh * 0.06);
    ctx.fill();

    const INK = "#1c241c";
    const GHOST = "rgba(28, 36, 28, 0.055)";
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
