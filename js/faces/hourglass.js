/* HOURGLASS — the minute made physical. The top bulb holds the current
 * minute's sand: it drains over exactly 60 seconds through a live stream
 * into a growing pile, then the whole glass flips during the first 0.9s
 * of the next minute. The glass is vertically symmetric, so the 180°
 * flip lands seamlessly on the "full again" state — no state to track.
 * A brass plaque on the base engraves the actual time and date. */
"use strict";

(() => {
  const hash = (i) => {
    const x = Math.sin(i * 113.9 + 47.3) * 43758.5453;
    return x - Math.floor(x);
  };

  const SAND = "#d9a441", SAND_DK = "#a4762a", SAND_LT = "#efc775";

  /* One bulb outline as a path (upper bulb; lower is mirrored).
   * Local coords: waist at (0,0), bulb extends upward to -bh. */
  function bulbPath(ctx, bw, bh, dir) {
    // dir = -1 for the upper bulb (opens upward), +1 for the lower.
    const s = dir;
    ctx.beginPath();
    ctx.moveTo(-bw * 0.055, 0);
    ctx.bezierCurveTo(-bw * 0.30, s * bh * 0.14, -bw * 0.50, s * bh * 0.36,
      -bw * 0.50, s * bh * 0.60);
    ctx.bezierCurveTo(-bw * 0.50, s * bh * 0.88, -bw * 0.26, s * bh, 0, s * bh);
    ctx.bezierCurveTo(bw * 0.26, s * bh, bw * 0.50, s * bh * 0.88,
      bw * 0.50, s * bh * 0.60);
    ctx.bezierCurveTo(bw * 0.50, s * bh * 0.36, bw * 0.30, s * bh * 0.14,
      bw * 0.055, 0);
    ctx.closePath();
  }

  /* Bulb half-width at height |y| above/below the waist (matches bulbPath
   * closely enough for sand clipping). */
  function bulbHalfW(bw, bh, y) {
    const t = U.clamp(y / bh, 0, 1);
    return bw * 0.5 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) *
      (t > 0.9 ? 1 - (t - 0.9) * 6 : 1) + bw * 0.04;
  }

  CLOX.register({
    id: "hourglass",
    name: "Hourglass · One Minute of Sand",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);

      // Study-dark room with a warm candle-side glow.
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#171310");
      g.addColorStop(1, "#0a0806");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      g = ctx.createRadialGradient(W * 0.30, H * 0.28, 0, W * 0.5, H * 0.5, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(255, 176, 88, 0.12)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Dust motes drifting through the glow.
      for (let i = 0; i < 7; i++) {
        const mx = (hash(i) + 0.06 * Math.sin(now * 0.00013 + i * 2.2)) * W;
        const my = (hash(i + 40) + 0.05 * Math.cos(now * 0.00009 + i * 1.7)) * H;
        ctx.fillStyle = `rgba(255, 220, 170, ${0.05 + 0.03 * Math.sin(now * 0.001 + i * 3)})`;
        ctx.fillRect(mx, my, 2, 2);
      }

      const cx = W / 2, cy = H / 2;
      const S = Math.min(W, H);
      const bw = S * 0.34;                 // bulb width
      const bh = S * 0.315;                // bulb height (per half)
      const frameW = bw * 1.28;

      // Flip during the first 0.9s of each minute; drain the other 59.1s.
      const FLIP = 0.9;
      let rot = 0, f;                      // f = drained fraction 0..1
      if (t.fs < FLIP) {
        rot = U.easeInOutCubic(t.fs / FLIP) * Math.PI;
        f = 1;
      } else {
        f = (t.fs - FLIP) / (60 - FLIP);
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(rot);

      // ---- Wooden end plates + brass posts (behind the glass) ----
      const plateH = S * 0.045, plateW = frameW * 1.12;
      for (const s of [-1, 1]) {
        const py = s * (bh + plateH * 0.62);
        g = ctx.createLinearGradient(0, py - plateH / 2, 0, py + plateH / 2);
        g.addColorStop(0, "#4c3018");
        g.addColorStop(0.4, "#38220f");
        g.addColorStop(1, "#241407");
        ctx.fillStyle = g;
        U.roundRect(ctx, -plateW / 2, py - plateH / 2, plateW, plateH, plateH * 0.3);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 200, 130, 0.10)";
        ctx.fillRect(-plateW / 2 + plateH * 0.2, py - plateH / 2, plateW - plateH * 0.4, Math.max(1, plateH * 0.06));
      }
      for (const sx of [-1, 1]) {
        const px = sx * frameW * 0.52;
        g = ctx.createLinearGradient(px - S * 0.012, 0, px + S * 0.012, 0);
        g.addColorStop(0, "#6e5218");
        g.addColorStop(0.5, "#d9b45e");
        g.addColorStop(1, "#5a4212");
        ctx.fillStyle = g;
        ctx.fillRect(px - S * 0.011, -bh - plateH * 0.5, S * 0.022, (bh + plateH * 0.5) * 2);
        // Turned collars on the posts.
        for (const fy of [-0.62, 0, 0.62]) {
          U.roundRect(ctx, px - S * 0.017, fy * bh - S * 0.012, S * 0.034, S * 0.024, S * 0.008);
          ctx.fill();
        }
      }

      // ---- Sand (clipped inside the glass) ----
      // Top bulb: remaining sand sits above the waist; its surface falls
      // as the minute drains (height tracks sqrt-ish volume for a flask).
      const remain = 1 - f;
      const topLevel = bh * (0.16 + 0.78 * Math.pow(remain, 0.62)); // surface height above waist
      ctx.save();
      bulbPath(ctx, bw, bh, -1);
      ctx.clip();
      if (remain > 0.003) {
        g = ctx.createLinearGradient(0, -topLevel, 0, 0);
        g.addColorStop(0, SAND_LT);
        g.addColorStop(0.5, SAND);
        g.addColorStop(1, SAND_DK);
        ctx.fillStyle = g;
        ctx.beginPath();
        const dip = Math.min(topLevel * 0.55, bw * 0.16) * (0.25 + 0.75 * f);
        ctx.moveTo(-bulbHalfW(bw, bh, topLevel), -topLevel);
        ctx.quadraticCurveTo(0, -topLevel + dip, bulbHalfW(bw, bh, topLevel), -topLevel);
        ctx.lineTo(bw * 0.52, 0);
        ctx.lineTo(-bw * 0.52, 0);
        ctx.closePath();
        ctx.fill();
        // Grain speckle, stable within the minute.
        for (let i = 0; i < 26; i++) {
          const gx2 = (hash(i + t.m * 7) - 0.5) * bw * 0.8;
          const gy2 = -hash(i + 60 + t.m) * topLevel * 0.9;
          ctx.fillStyle = i % 2 ? "rgba(255, 226, 150, 0.25)" : "rgba(120, 82, 28, 0.3)";
          ctx.fillRect(gx2, gy2, 2, 2);
        }
      }
      ctx.restore();

      // Bottom pile: a mound growing toward the waist.
      ctx.save();
      bulbPath(ctx, bw, bh, 1);
      ctx.clip();
      const pileH = bh * (0.10 + 0.80 * Math.pow(f, 0.6));
      const baseW = bulbHalfW(bw, bh, bh * 0.985) * 2.4;
      g = ctx.createLinearGradient(0, bh - pileH, 0, bh);
      g.addColorStop(0, SAND_LT);
      g.addColorStop(0.45, SAND);
      g.addColorStop(1, SAND_DK);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(-baseW, bh);
      const lean = (hash(t.m + 3) - 0.5) * bw * 0.08;   // each minute piles differently
      ctx.quadraticCurveTo(-baseW * 0.42, bh - pileH * 0.55,
        lean - bw * 0.03, bh - pileH);
      ctx.quadraticCurveTo(lean, bh - pileH * 1.06, lean + bw * 0.03, bh - pileH);
      ctx.quadraticCurveTo(baseW * 0.42, bh - pileH * 0.5, baseW, bh);
      ctx.closePath();
      ctx.fill();
      for (let i = 0; i < 22; i++) {
        const gx2 = (hash(i + 200 + t.m) - 0.5) * baseW * 1.4;
        const gy2 = bh - hash(i + 300 + t.m) * pileH * 0.85;
        ctx.fillStyle = i % 2 ? "rgba(255, 226, 150, 0.22)" : "rgba(120, 82, 28, 0.28)";
        ctx.fillRect(gx2, gy2, 2, 2);
      }
      // The stream (hidden while flipping — the throat is "closed").
      if (rot === 0 && f < 1) {
        ctx.strokeStyle = "rgba(233, 190, 100, 0.9)";
        ctx.lineWidth = Math.max(1.5, bw * 0.012);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        for (let yy = 0; yy <= bh - pileH; yy += 6) {
          ctx.lineTo(Math.sin(yy * 0.35 + now * 0.02) * 0.8, yy);
        }
        ctx.stroke();
        // Falling grains alongside the stream.
        for (let i = 0; i < 5; i++) {
          const p = ((now * 0.0011) + i * 0.23) % 1;
          ctx.fillStyle = `rgba(240, 200, 110, ${0.7 * (1 - p * 0.4)})`;
          ctx.fillRect((hash(i + Math.floor(now * 0.0011) * 5) - 0.5) * bw * 0.03,
            p * (bh - pileH), 2, 3);
        }
        // Impact puff where the stream lands.
        ctx.fillStyle = "rgba(240, 205, 120, 0.18)";
        ctx.beginPath();
        ctx.ellipse(0, bh - pileH, bw * 0.045, bw * 0.02, 0, 0, U.TAU);
        ctx.fill();
      }
      ctx.restore();

      // ---- The glass itself (over the sand) ----
      for (const s of [-1, 1]) {
        bulbPath(ctx, bw, bh, s);
        g = ctx.createLinearGradient(-bw / 2, 0, bw / 2, 0);
        g.addColorStop(0, "rgba(190, 215, 235, 0.10)");
        g.addColorStop(0.2, "rgba(255, 255, 255, 0.02)");
        g.addColorStop(0.8, "rgba(160, 190, 215, 0.03)");
        g.addColorStop(1, "rgba(190, 215, 235, 0.10)");
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = "rgba(205, 225, 245, 0.28)";
        ctx.lineWidth = Math.max(1, S * 0.0035);
        ctx.stroke();
        // Long curved highlight on the left of each bulb.
        ctx.save();
        bulbPath(ctx, bw, bh, s);
        ctx.clip();
        ctx.strokeStyle = "rgba(255, 255, 255, 0.20)";
        ctx.lineWidth = S * 0.008;
        ctx.beginPath();
        ctx.moveTo(-bw * 0.34, s * bh * 0.22);
        ctx.quadraticCurveTo(-bw * 0.46, s * bh * 0.55, -bw * 0.30, s * bh * 0.86);
        ctx.stroke();
        ctx.restore();
      }
      // Brass throat collar at the waist.
      g = ctx.createLinearGradient(0, -S * 0.014, 0, S * 0.014);
      g.addColorStop(0, "#caa04c");
      g.addColorStop(0.5, "#8a6a26");
      g.addColorStop(1, "#5c4514");
      ctx.fillStyle = g;
      U.roundRect(ctx, -bw * 0.10, -S * 0.012, bw * 0.20, S * 0.024, S * 0.008);
      ctx.fill();

      ctx.restore();   // un-rotate

      // ---- Brass plaque on the base: the actual time ----
      const plW = S * 0.30, plH = S * 0.088;
      const plY = cy + bh + plateH * 1.9;
      g = ctx.createLinearGradient(0, plY, 0, plY + plH);
      g.addColorStop(0, "#e0bd68");
      g.addColorStop(0.5, "#b08c38");
      g.addColorStop(1, "#7a5c1c");
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = plH * 0.3;
      ctx.shadowOffsetY = plH * 0.1;
      ctx.fillStyle = g;
      U.roundRect(ctx, cx - plW / 2, plY, plW, plH, plH * 0.16);
      ctx.fill();
      ctx.restore();
      ctx.strokeStyle = "rgba(60, 42, 8, 0.55)";
      ctx.lineWidth = Math.max(1, plH * 0.03);
      U.roundRect(ctx, cx - plW * 0.47, plY + plH * 0.10, plW * 0.94, plH * 0.80, plH * 0.10);
      ctx.stroke();
      // Engraved time — dark fill with a light offset like stamped brass.
      const hs = settings.h24 ? U.pad2(t.H) : String(t.h);
      const tStr = `${hs}:${U.pad2(t.m)}` +
        (settings.h24 ? "" : (t.pm ? " PM" : " AM"));
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `600 ${plH * 0.42}px Georgia, serif`;
      ctx.fillStyle = "rgba(255, 240, 200, 0.35)";
      ctx.fillText(tStr, cx, plY + plH * 0.40 + plH * 0.02);
      ctx.fillStyle = "#3a2a08";
      ctx.fillText(tStr, cx, plY + plH * 0.40);
      ctx.font = `500 ${plH * 0.20}px Georgia, serif`;
      ctx.fillStyle = "rgba(58, 42, 8, 0.85)";
      ctx.fillText(`${U.DAYS[t.day]} · ${U.MONTHS[t.month]} ${t.date}` +
        (settings.seconds ? ` · ${U.pad2(t.s)}` : ""), cx, plY + plH * 0.74);

      // Vignette.
      g = ctx.createRadialGradient(cx, cy, S * 0.35, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.55)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
