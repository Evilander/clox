/* BERLIN — Mengenlehreuhr (Berlin set-theory clock, Binninger 1975).
 * Top lamp blinks the seconds; then 4 red lamps of 5 hours each,
 * 4 red lamps of 1 hour, 11 lamps of 5 minutes (quarters red, rest
 * yellow), 4 yellow lamps of 1 minute. Reads top to bottom. */
"use strict";

(() => {
  function lamp(ctx, x, y, w, h, r, color, lit) {
    // Housing.
    ctx.fillStyle = "#0c0c0e";
    U.roundRect(ctx, x - w * 0.04, y - h * 0.05, w * 1.08, h * 1.1, r * 1.2);
    ctx.fill();

    U.roundRect(ctx, x, y, w, h, r);
    if (lit) {
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = h * 0.55;
      ctx.fillStyle = color;
      ctx.fill();
      ctx.fill();
      ctx.restore();
    } else {
      // Dark glass with a faint tint of its own color.
      const g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, "#232427");
      g.addColorStop(1, "#151517");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      U.roundRect(ctx, x, y, w, h, r);
      ctx.clip();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.07;
      ctx.fillRect(x, y, w, h);
      ctx.restore();
    }
    // Glass gloss on the top edge.
    ctx.save();
    U.roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    gl.addColorStop(0, `rgba(255, 255, 255, ${lit ? 0.35 : 0.10})`);
    gl.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, w, h * 0.5);
    ctx.restore();
  }

  CLOX.register({
    id: "berlin",
    name: "Berlin · Mengenlehreuhr",

    draw(ctx, W, H, d, settings) {
      const t = U.timeParts(d, true);
      const RED = "#ff3527", YEL = "#ffb428";

      let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "#191a1e");
      g.addColorStop(1, "#0a0b0d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Stack geometry: seconds circle + 4 rows (leave room for the caption).
      const u = Math.min(H * 0.115, W * 0.125);
      const rowW = u * 6.2, rowH = u * 0.92, gap = u * 0.42, D = u * 1.5;
      const totalH = D + 4 * (rowH + gap);
      const x0 = (W - rowW) / 2;
      let y = (H - totalH) / 2 - u * 0.2;
      const cx = W / 2;

      // Central mast behind the stack.
      ctx.fillStyle = "#101113";
      ctx.fillRect(cx - u * 0.11, y, u * 0.22, totalH + u * 0.4);

      // Seconds lamp: lit on even seconds, like the original.
      const sr = D / 2;
      ctx.fillStyle = "#0c0c0e";
      ctx.beginPath();
      ctx.arc(cx, y + sr, sr * 1.08, 0, U.TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, y + sr, sr, 0, U.TAU);
      if (t.s % 2 === 0) {
        ctx.save();
        ctx.shadowColor = YEL;
        ctx.shadowBlur = sr * 0.8;
        ctx.fillStyle = YEL;
        ctx.fill();
        ctx.fill();
        ctx.restore();
      } else {
        g = ctx.createLinearGradient(0, y, 0, y + D);
        g.addColorStop(0, "#232427");
        g.addColorStop(1, "#151517");
        ctx.fillStyle = g;
        ctx.fill();
      }
      // Gloss.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, y + sr, sr, 0, U.TAU);
      ctx.clip();
      g = ctx.createLinearGradient(0, y, 0, y + sr);
      g.addColorStop(0, `rgba(255, 255, 255, ${t.s % 2 === 0 ? 0.35 : 0.10})`);
      g.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - sr, y, D, sr);
      ctx.restore();
      y += D + gap;

      // Rows: [cellCount, litCount, colorFn]
      const rows = [
        [4, Math.floor(t.H / 5), () => RED],
        [4, t.H % 5, () => RED],
        [11, Math.floor(t.m / 5), (i) => (i % 3 === 2 ? RED : YEL)],
        [4, t.m % 5, () => YEL]
      ];
      const cg = u * 0.14;
      for (const [count, litCount, colorFn] of rows) {
        const cw = (rowW - (count - 1) * cg) / count;
        for (let i = 0; i < count; i++) {
          lamp(ctx, x0 + i * (cw + cg), y, cw, rowH, u * 0.10,
            colorFn(i), i < litCount);
        }
        y += rowH + gap;
      }

      // Tiny decode caption for anyone still learning to read it.
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.font = `500 ${Math.max(12, u * 0.22)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(
        `${U.pad2(t.H)}:${U.pad2(t.m)}` + (settings.seconds ? `:${U.pad2(t.s)}` : ""),
        cx, y + u * 0.1
      );
    }
  });
})();
