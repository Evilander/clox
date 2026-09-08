/* FLIP — Solari split-flap clock. Four single-digit cards (H1 H2 : M1 M2)
 * so a rollover cascades left-to-right, plus a small seconds card, all with
 * a gravity-eased flap animation. */
"use strict";

(() => {
  const hash = (i) => {
    const x = Math.sin(i * 157.3 + 71.7) * 43758.5453;
    return x - Math.floor(x);
  };

  // Per-card animation state: value currently shown, value flipping away,
  // start time (t0, may be delayed for cascade stagger), settle-bounce end.
  const cards = {};

  function track(key, val, now, dur, delay = 0) {
    let c = cards[key];
    if (!c) { c = cards[key] = { val, prev: val, t0: -1e9, dur, endT: -1e9 }; }
    if (val !== c.val) { c.prev = c.val; c.val = val; c.t0 = now + delay; }
    return c;
  }

  function cardBg(ctx, x, y, w, h, r) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#34343a");
    g.addColorStop(0.08, "#29292f");
    g.addColorStop(0.5, "#1b1b20");
    g.addColorStop(0.501, "#303036");
    g.addColorStop(0.92, "#18191e");
    g.addColorStop(1, "#0f1014");
    ctx.fillStyle = g;
    U.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    const vg = ctx.createLinearGradient(x, 0, x + w, 0);
    vg.addColorStop(0, "rgba(255, 255, 255, 0.045)");
    vg.addColorStop(0.16, "rgba(255, 255, 255, 0)");
    vg.addColorStop(0.82, "rgba(0, 0, 0, 0)");
    vg.addColorStop(1, "rgba(0, 0, 0, 0.22)");
    ctx.fillStyle = vg;
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

  /* Dark hinge-edge crease, drawn in screen space so it stays a crisp 2px
   * regardless of how much the flap is squished. */
  function hingeEdge(ctx, x, w, hinge, sy) {
    if (Math.abs(sy) >= 0.97) return;
    ctx.save();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.55)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 2, hinge);
    ctx.lineTo(x + w + 2, hinge);
    ctx.stroke();
    ctx.restore();
  }

  function drawCard(ctx, x, y, w, h, c, now, label, cardIndex) {
    const r = h * 0.09;
    const font = `700 ${h * 0.72}px "Helvetica Neue", "Arial Narrow", Arial, sans-serif`;
    const p = U.clamp((now - c.t0) / c.dur, 0, 1);
    const hinge = y + h / 2;

    // Molded card thickness behind the flipping face.
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
    ctx.shadowBlur = h * 0.075;
    ctx.shadowOffsetY = h * 0.03;
    const sideGrad = ctx.createLinearGradient(0, y + h * 0.05, 0, y + h + h * 0.055);
    sideGrad.addColorStop(0, "#15161b");
    sideGrad.addColorStop(1, "#07080b");
    ctx.fillStyle = sideGrad;
    U.roundRect(ctx, x + w * 0.018, y + h * 0.035, w, h, r);
    ctx.fill();
    ctx.restore();

    // Drop shadow under the whole card.
    ctx.save();
    ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
    ctx.shadowBlur = h * 0.09;
    ctx.shadowOffsetY = h * 0.035;
    cardBg(ctx, x, y, w, h, r);
    ctx.restore();

    if (p >= 1) {
      if (c.endT < c.t0) c.endT = c.t0 + c.dur;
      half(ctx, x, y, w, h, r, c.val, font, "top", 0.10);
      // Settled bottom half dips briefly right after the flap lands.
      const dt = now - c.endT;
      if (dt >= 0 && dt < 180) {
        const bounce = 2.5 * Math.exp(-dt / 70) * Math.sin(dt / 22);
        ctx.save();
        ctx.translate(0, bounce);
        half(ctx, x, y, w, h, r, c.val, font, "bottom", 0);
        ctx.restore();
      } else {
        half(ctx, x, y, w, h, r, c.val, font, "bottom", 0);
      }
    } else {
      const e = U.easeInOutCubic(p);
      // Static layers: new value already waits on top, old value lingers below.
      half(ctx, x, y, w, h, r, c.val, font, "top", 0.10);
      half(ctx, x, y, w, h, r, c.prev, font, "bottom", 0);

      if (e < 0.5) {
        // Old top flap folding down toward the viewer.
        const sy = Math.cos(e * Math.PI);
        const sx = 1 - 0.07 * (1 - Math.abs(sy));
        ctx.save();
        ctx.translate(x + w / 2, hinge);
        ctx.scale(sx, Math.max(0.001, sy));
        ctx.translate(-(x + w / 2), -hinge);
        half(ctx, x, y, w, h, r, c.prev, font, "top", 0.10 + (1 - sy) * 0.45);
        ctx.restore();
        hingeEdge(ctx, x, w, hinge, sy);
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

        const sx = 1 - 0.07 * (1 - Math.abs(sy));
        ctx.save();
        ctx.translate(x + w / 2, hinge);
        ctx.scale(sx, Math.max(0.001, sy));
        ctx.translate(-(x + w / 2), -hinge);
        half(ctx, x, y, w, h, r, c.val, font, "bottom", (1 - sy) * 0.30);
        ctx.restore();
        hingeEdge(ctx, x, w, hinge, sy);
      }
    }

    // Split line + axle pins.
    ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
    ctx.fillRect(x, hinge - Math.max(1, h * 0.006), w, Math.max(2, h * 0.012));
    const shine = ctx.createLinearGradient(0, y, 0, y + h * 0.24);
    shine.addColorStop(0, "rgba(255, 255, 255, 0.09)");
    shine.addColorStop(0.45, "rgba(255, 255, 255, 0.018)");
    shine.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = shine;
    U.roundRect(ctx, x + w * 0.035, y + h * 0.035, w * 0.93, h * 0.20, r * 0.55);
    ctx.fill();
    ctx.fillStyle = "#0c0c0e";
    const pw = w * 0.035, ph = h * 0.10;
    for (const px of [x - pw * 0.4, x + w - pw * 0.6]) {
      U.roundRect(ctx, px, hinge - ph / 2, pw, ph, pw * 0.4);
      ctx.fill();
    }

    // Worn corner: a tiny static chip, fixed per card position + digit value.
    const corner = Math.floor(hash(cardIndex * 10 + (+c.val)) * 4);
    const side = h * 0.035;
    const ptx = corner % 2 === 0 ? x : x + w;
    const pty = corner < 2 ? y : y + h;
    const dx = corner % 2 === 0 ? 1 : -1;
    const dy = corner < 2 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(ptx, pty);
    ctx.lineTo(ptx + dx * side, pty);
    ctx.lineTo(ptx, pty + dy * side);
    ctx.closePath();
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fill();

    // Tiny corner label (AM/PM on the hours card).
    if (label) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.font = `600 ${h * 0.075}px "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(label, x + w * 0.07, y + h * 0.06);
    }
  }

  /* Stationary axle-pin dots marking the gap between the hour and minute
   * groups — like the divider on a real Solari module. */
  function colonDots(ctx, cx, y, h) {
    const hinge = y + h / 2;
    const rr = h * 0.032;
    ctx.fillStyle = "#0c0c0e";
    for (const dy of [-h * 0.15, h * 0.15]) {
      ctx.beginPath();
      ctx.arc(cx, hinge + dy, rr, 0, U.TAU);
      ctx.fill();
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
      g.addColorStop(0, "rgba(255, 240, 214, 0.11)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Layout: four single-digit cards (H1 H2 : M1 M2), optional seconds card.
      let ch = Math.min(H * 0.46, W * 0.30);
      let dcw = ch * 1.18 * 0.62;      // single-digit width, ~0.62 of the old two-digit card
      const sScale = 0.55;
      let gapSmall = dcw * 0.14;       // within a digit pair
      let gapMid = dcw * 0.55;         // between hour pair and minute pair
      let gapSec = ch * 0.12;          // before the seconds group
      const secCardW = () => dcw * 0.92;
      const total = () => dcw * 4 + gapSmall * 2 + gapMid +
        (settings.seconds ? gapSec + secCardW() : 0);
      const maxW = W * 0.88;
      if (total() > maxW) {
        const k = maxW / total();
        ch *= k; dcw *= k; gapSmall *= k; gapMid *= k; gapSec *= k;
      }

      const x0 = (W - total()) / 2;
      const cy = H / 2 - ch / 2;

      const hStr = U.pad2(settings.h24 ? t.H : t.h);
      const mStr = U.pad2(t.m);

      const xH1 = x0;
      const xH2 = xH1 + dcw + gapSmall;
      const xM1 = xH2 + dcw + gapMid;
      const xM2 = xM1 + dcw + gapSmall;

      const panelPadX = ch * 0.22;
      const panelPadTop = ch * 0.24;
      const panelPadBottom = ch * 0.30;
      const panelX = x0 - panelPadX;
      const panelY = cy - panelPadTop;
      const panelW = total() + panelPadX * 2;
      const panelH = ch + panelPadTop + panelPadBottom;
      const railH = ch * 0.075;

      // The cards sit in a deep airport-departure module, with rails and
      // hardware visible at TV distance.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.68)";
      ctx.shadowBlur = ch * 0.18;
      ctx.shadowOffsetY = ch * 0.07;
      g = ctx.createLinearGradient(0, panelY, 0, panelY + panelH);
      g.addColorStop(0, "#202126");
      g.addColorStop(0.18, "#14151a");
      g.addColorStop(1, "#07080b");
      ctx.fillStyle = g;
      U.roundRect(ctx, panelX, panelY, panelW, panelH, ch * 0.055);
      ctx.fill();
      ctx.restore();
      g = ctx.createLinearGradient(panelX, 0, panelX + panelW, 0);
      g.addColorStop(0, "rgba(0, 0, 0, 0.34)");
      g.addColorStop(0.12, "rgba(255, 255, 255, 0.035)");
      g.addColorStop(0.50, "rgba(255, 255, 255, 0.012)");
      g.addColorStop(0.88, "rgba(255, 255, 255, 0.028)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.38)");
      ctx.fillStyle = g;
      U.roundRect(ctx, panelX, panelY, panelW, panelH, ch * 0.055);
      ctx.fill();
      for (const ry of [panelY + panelPadTop * 0.45, cy + ch + panelPadBottom * 0.40]) {
        g = ctx.createLinearGradient(0, ry - railH / 2, 0, ry + railH / 2);
        g.addColorStop(0, "#3a3a40");
        g.addColorStop(0.45, "#191a1f");
        g.addColorStop(1, "#08090c");
        ctx.fillStyle = g;
        U.roundRect(ctx, panelX + panelPadX * 0.25, ry - railH / 2, panelW - panelPadX * 0.5, railH, railH * 0.35);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(panelX + panelPadX * 0.35, ry - railH * 0.38, panelW - panelPadX * 0.7, Math.max(1, railH * 0.08));
      }
      for (let i = 0; i < 4; i++) {
        const sx = panelX + panelPadX * 0.45 + i * (panelW - panelPadX * 0.9) / 3;
        const sy = panelY + panelH - panelPadBottom * 0.22;
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.beginPath();
        ctx.arc(sx, sy, ch * 0.015, 0, U.TAU);
        ctx.fill();
        ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
        ctx.beginPath();
        ctx.arc(sx - ch * 0.004, sy - ch * 0.005, ch * 0.005, 0, U.TAU);
        ctx.fill();
      }

      // Cascade: each position left-to-right starts its flip 45ms later.
      const h1 = track("h1", hStr[0], now, 550, 0);
      const h2 = track("h2", hStr[1], now, 550, 45);
      const m1 = track("m1", mStr[0], now, 550, 90);
      const m2 = track("m2", mStr[1], now, 550, 135);

      drawCard(ctx, xH1, cy, dcw, ch, h1, now, settings.h24 ? null : (t.pm ? "PM" : "AM"), 0);
      drawCard(ctx, xH2, cy, dcw, ch, h2, now, null, 1);
      colonDots(ctx, xH2 + dcw + gapMid / 2, cy, ch);
      drawCard(ctx, xM1, cy, dcw, ch, m1, now, null, 2);
      drawCard(ctx, xM2, cy, dcw, ch, m2, now, null, 3);

      if (settings.seconds) {
        // Seconds flap falls fast, like the real mechanism. Stays a single
        // two-digit module — authentic for a seconds unit.
        const sCard = track("s", U.pad2(t.s), now, 240);
        const sh = ch * sScale, sw = secCardW();
        const xSec = xM2 + dcw + gapSec;
        drawCard(ctx, xSec, cy + ch - sh, sw, sh, sCard, now, null, 4);
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
