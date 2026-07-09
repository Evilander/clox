/* FLIP — Solari split-flap clock. Two-digit cards for hours/minutes
 * (small seconds card optional) with a gravity-eased flap animation. */
"use strict";

(() => {
  // Per-card animation state: value currently shown, value flipping away, start time.
  const cards = {};

  function track(key, val, now, dur) {
    let c = cards[key];
    if (!c) { c = cards[key] = { val, prev: val, t0: -1e9, dur }; }
    if (val !== c.val) { c.prev = c.val; c.val = val; c.t0 = now; }
    return c;
  }

  function cardBg(ctx, x, y, w, h, r) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#232326");
    g.addColorStop(0.5, "#1b1b1e");
    g.addColorStop(0.501, "#242427");
    g.addColorStop(1, "#161619");
    ctx.fillStyle = g;
    U.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
  }

  /* Draw one half of a card (background + centered text), clipped. */
  function half(ctx, x, y, w, h, r, text, font, which, shade) {
    const gapH = Math.max(1.5, h * 0.008);
    ctx.save();
    ctx.beginPath();
    if (which === "top") ctx.rect(x - 2, y, w + 4, h / 2 - gapH);
    else ctx.rect(x - 2, y + h / 2 + gapH, w + 4, h / 2 - gapH);
    ctx.clip();
    cardBg(ctx, x, y, w, h, r);
    ctx.fillStyle = "#ececec";
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x + w / 2, y + h * 0.54);
    if (shade > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${shade})`;
      U.roundRect(ctx, x, y, w, h, r);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawCard(ctx, x, y, w, h, c, now, label) {
    const r = h * 0.09;
    const font = `700 ${h * 0.72}px "Helvetica Neue", "Arial Narrow", Arial, sans-serif`;
    const p = U.clamp((now - c.t0) / c.dur, 0, 1);
    const hinge = y + h / 2;

    // Drop shadow under the whole card.
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = h * 0.09;
    ctx.shadowOffsetY = h * 0.035;
    cardBg(ctx, x, y, w, h, r);
    ctx.restore();

    if (p >= 1) {
      half(ctx, x, y, w, h, r, c.val, font, "top", 0.10);
      half(ctx, x, y, w, h, r, c.val, font, "bottom", 0);
    } else {
      const e = U.easeInOutCubic(p);
      // Static layers: new value already waits on top, old value lingers below.
      half(ctx, x, y, w, h, r, c.val, font, "top", 0.10);
      half(ctx, x, y, w, h, r, c.prev, font, "bottom", 0);

      if (e < 0.5) {
        // Old top flap folding down toward the viewer.
        const sy = Math.cos(e * Math.PI);
        ctx.save();
        ctx.translate(x + w / 2, hinge);
        ctx.scale(1, Math.max(0.001, sy));
        ctx.translate(-(x + w / 2), -hinge);
        half(ctx, x, y, w, h, r, c.prev, font, "top", 0.10 + (1 - sy) * 0.45);
        ctx.restore();
      } else {
        // New bottom flap unfolding; casts a moving shadow on the old bottom.
        const sy = -Math.cos(e * Math.PI);
        ctx.save();
        ctx.beginPath();
        ctx.rect(x - 2, hinge, w + 4, (h / 2) * sy + 2);
        ctx.clip();
        ctx.fillStyle = `rgba(0, 0, 0, ${0.35 * (1 - sy)})`;
        ctx.fillRect(x - 2, hinge, w + 4, h / 2 + 2);
        ctx.restore();

        ctx.save();
        ctx.translate(x + w / 2, hinge);
        ctx.scale(1, Math.max(0.001, sy));
        ctx.translate(-(x + w / 2), -hinge);
        half(ctx, x, y, w, h, r, c.val, font, "bottom", (1 - sy) * 0.30);
        ctx.restore();
      }
    }

    // Split line + axle pins.
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(x, hinge - Math.max(1, h * 0.006), w, Math.max(2, h * 0.012));
    ctx.fillStyle = "#0c0c0e";
    const pw = w * 0.035, ph = h * 0.10;
    for (const px of [x - pw * 0.4, x + w - pw * 0.6]) {
      U.roundRect(ctx, px, hinge - ph / 2, pw, ph, pw * 0.4);
      ctx.fill();
    }

    // Tiny corner label (AM/PM on the hours card).
    if (label) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.font = `600 ${h * 0.075}px "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(label, x + w * 0.07, y + h * 0.06);
    }
  }

  CLOX.register({
    id: "flip",
    name: "Flip · Solari",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);

      // Warm dark room with a soft overhead spotlight.
      let g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "#121114");
      g.addColorStop(1, "#0a090b");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      g = ctx.createRadialGradient(W / 2, H * 0.36, 0, W / 2, H * 0.36, Math.max(W, H) * 0.62);
      g.addColorStop(0, "rgba(255, 240, 214, 0.07)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Layout: two big cards, optional smaller seconds card.
      let ch = Math.min(H * 0.46, W * 0.30);
      let cw = ch * 1.18;
      const sScale = 0.55;
      let gap = ch * 0.12;
      const total = () => cw * 2 + gap + (settings.seconds ? gap + cw * sScale : 0);
      const maxW = W * 0.88;
      if (total() > maxW) {
        const k = maxW / total();
        ch *= k; cw *= k; gap *= k;
      }

      const x0 = (W - total()) / 2;
      const cy = H / 2 - ch / 2;

      const hCard = track("h", settings.h24 ? U.pad2(t.H) : U.pad2(t.h), now, 550);
      const mCard = track("m", U.pad2(t.m), now, 550);

      drawCard(ctx, x0, cy, cw, ch, hCard, now,
        settings.h24 ? null : (t.pm ? "PM" : "AM"));
      drawCard(ctx, x0 + cw + gap, cy, cw, ch, mCard, now, null);

      if (settings.seconds) {
        // Seconds flap falls fast, like the real mechanism.
        const sCard = track("s", U.pad2(t.s), now, 240);
        const sh = ch * sScale, sw = cw * sScale;
        drawCard(ctx, x0 + cw * 2 + gap * 2, cy + ch - sh, sw, sh, sCard, now, null);
      }

      // Date line beneath the cards.
      ctx.fillStyle = "rgba(255, 255, 255, 0.30)";
      ctx.font = `500 ${Math.max(13, ch * 0.085)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(
        `${U.DAYS[t.day]}  ·  ${U.MONTHS[t.month]} ${t.date}`,
        W / 2, cy + ch + ch * 0.14
      );
    }
  });
})();
