/* REGULATOR — watchmaker's precision wall clock (Vienna regulator school).
 * True regulator dial: the minute hand owns the center; hours and seconds
 * live in sub-dials. Brass pendulum swings on a 2-second period behind
 * the glass of a walnut case. */
"use strict";

(() => {
  const hash = (i) => {
    const x = Math.sin(i * 157.3 + 71.7) * 43758.5453;
    return x - Math.floor(x);
  };

  function subdial(ctx, cx, cy, r, ticks, labels) {
    ctx.save();
    let g = ctx.createRadialGradient(cx - r * 0.24, cy - r * 0.28, 0, cx, cy, r);
    g.addColorStop(0, "#fff9e8");
    g.addColorStop(0.72, "#eee6d1");
    g.addColorStop(1, "#cfc5aa");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, U.TAU);
    ctx.fill();
    ctx.strokeStyle = "rgba(150, 122, 65, 0.22)";
    ctx.lineWidth = r * 0.075;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.91, 0, U.TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, U.TAU);
    ctx.strokeStyle = "#3a352b";
    ctx.lineWidth = r * 0.03;
    ctx.stroke();
    for (let i = 0; i < ticks; i++) {
      const a = (i / ticks) * U.TAU;
      const major = ticks === 60 ? i % 5 === 0 : true;
      const len = major ? r * 0.14 : r * 0.07;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * (r - len), cy - Math.cos(a) * (r - len));
      ctx.lineTo(cx + Math.sin(a) * r * 0.97, cy - Math.cos(a) * r * 0.97);
      ctx.lineWidth = major ? r * 0.025 : r * 0.012;
      ctx.strokeStyle = "#2c2822";
      ctx.stroke();
    }
    if (labels) {
      ctx.fillStyle = "#2c2822";
      ctx.font = `${r * 0.26}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      labels.forEach((lb, i) => {
        const a = (i / labels.length) * U.TAU;
        ctx.fillText(lb, cx + Math.sin(a) * r * 0.68, cy - Math.cos(a) * r * 0.68);
      });
    }
    ctx.restore();
  }

  function hand(ctx, cx, cy, angle, len, wBase, color, tail = 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-wBase / 2, tail);
    ctx.lineTo(-wBase * 0.18, -len);
    ctx.lineTo(wBase * 0.18, -len);
    ctx.lineTo(wBase / 2, tail);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, wBase * 0.7, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  }

  // Case body + door opening + joinery detail: none of it depends on the
  // clock's time, only on its size, so it's rendered once per size to an
  // offscreen bitmap instead of being rebuilt every frame.
  let caseCache = { key: "", canvas: null };

  function buildCase(cw, chh) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${Math.round(cw)}x${Math.round(chh)}@${dpr}`;
    if (caseCache.key === key) return caseCache.canvas;

    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(cw * dpr));
    c.height = Math.max(2, Math.round(chh * dpr));
    const oc = c.getContext("2d");
    oc.scale(dpr, dpr);

    const rad = cw * 0.10;
    const inX = cw * 0.075, inW = cw * 0.85;
    const inY = cw * 0.075, inH = chh - cw * 0.15;

    // Walnut case.
    let g = oc.createLinearGradient(0, 0, cw, 0);
    g.addColorStop(0, "#2a1a0e");
    g.addColorStop(0.18, "#4a2f1a");
    g.addColorStop(0.5, "#5a3a20");
    g.addColorStop(0.82, "#432a16");
    g.addColorStop(1, "#241609");
    oc.fillStyle = g;
    U.roundRect(oc, 0, 0, cw, chh, rad);
    oc.fill();

    // Carved crown and plinth keep the case from reading as a flat rectangle.
    g = oc.createLinearGradient(0, 0, 0, cw * 0.24);
    g.addColorStop(0, "#5b391d");
    g.addColorStop(0.55, "#2b190b");
    g.addColorStop(1, "#160c05");
    oc.fillStyle = g;
    oc.beginPath();
    oc.moveTo(cw * 0.18, cw * 0.15);
    oc.quadraticCurveTo(cw * 0.50, -cw * 0.02, cw * 0.82, cw * 0.15);
    oc.lineTo(cw * 0.76, cw * 0.24);
    oc.quadraticCurveTo(cw * 0.50, cw * 0.13, cw * 0.24, cw * 0.24);
    oc.closePath();
    oc.fill();
    oc.fillStyle = "rgba(255, 205, 135, 0.12)";
    oc.fillRect(cw * 0.20, cw * 0.18, cw * 0.60, Math.max(1, cw * 0.008));
    g = oc.createLinearGradient(0, chh - cw * 0.16, 0, chh);
    g.addColorStop(0, "#4d2f16");
    g.addColorStop(1, "#190c04");
    oc.fillStyle = g;
    U.roundRect(oc, cw * 0.12, chh - cw * 0.145, cw * 0.76, cw * 0.105, cw * 0.026);
    oc.fill();

    // Wood grain: wavering vertical streaks, later occluded by the door
    // opening so they only read on the case stiles.
    oc.save();
    U.roundRect(oc, 0, 0, cw, chh, rad);
    oc.clip();
    for (let i = 0; i < 24; i++) {
      const gx = (i + 0.5) / 24 * cw;
      const dark = hash(i) > 0.5;
      oc.strokeStyle = dark ? "rgba(10, 5, 2, 0.05)" : "rgba(255, 224, 180, 0.03)";
      oc.lineWidth = 1;
      oc.beginPath();
      for (let s = 0; s <= 6; s++) {
        const y = (s / 6) * chh;
        const x = gx + (hash(i * 13.7 + s * 3.1) - 0.5) * cw * 0.025;
        s ? oc.lineTo(x, y) : oc.moveTo(x, y);
      }
      oc.stroke();
    }
    oc.restore();

    // Door opening (dark interior behind glass).
    g = oc.createLinearGradient(0, inY, 0, inY + inH);
    g.addColorStop(0, "#171310");
    g.addColorStop(1, "#0c0a08");
    oc.fillStyle = g;
    U.roundRect(oc, inX, inY, inW, inH, rad * 0.6);
    oc.fill();
    oc.strokeStyle = "rgba(200, 160, 90, 0.22)";
    oc.lineWidth = Math.max(1, cw * 0.006);
    U.roundRect(oc, inX, inY, inW, inH, rad * 0.6);
    oc.stroke();

    // Inner bevel: two close strokes just inside the opening.
    const b1 = Math.max(1, cw * 0.010);
    oc.strokeStyle = "rgba(200, 160, 90, 0.10)";
    oc.lineWidth = Math.max(1, cw * 0.004);
    U.roundRect(oc, inX + b1, inY + b1, inW - b1 * 2, inH - b1 * 2, Math.max(0, rad * 0.6 - b1));
    oc.stroke();
    const b2 = b1 + Math.max(1, cw * 0.005);
    oc.strokeStyle = "rgba(0, 0, 0, 0.35)";
    U.roundRect(oc, inX + b2, inY + b2, inW - b2 * 2, inH - b2 * 2, Math.max(0, rad * 0.6 - b2));
    oc.stroke();

    // Chains and side weights, visible through the glass behind the dial.
    const weightTop = inY + inH * 0.51, weightH = cw * 0.33, weightW = cw * 0.042;
    for (const side of [-1, 1]) {
      const wx = cw / 2 + side * inW * 0.31;
      oc.strokeStyle = "rgba(210, 170, 88, 0.30)";
      oc.lineWidth = Math.max(1, cw * 0.004);
      oc.beginPath();
      oc.moveTo(wx, inY + cw * 0.11);
      oc.lineTo(wx, weightTop + weightH * 0.08);
      oc.stroke();
      for (let j = 0; j < 8; j++) {
        oc.beginPath();
        oc.ellipse(wx, inY + cw * 0.14 + j * cw * 0.039, cw * 0.006, cw * 0.014, j % 2 ? 0.7 : -0.7, 0, U.TAU);
        oc.stroke();
      }
      const wg = oc.createLinearGradient(wx - weightW, 0, wx + weightW, 0);
      wg.addColorStop(0, "#72531d");
      wg.addColorStop(0.48, "#d2ad5d");
      wg.addColorStop(0.72, "#8d6826");
      wg.addColorStop(1, "#4b3511");
      oc.fillStyle = wg;
      U.roundRect(oc, wx - weightW / 2, weightTop, weightW, weightH, weightW * 0.45);
      oc.fill();
      oc.fillStyle = "rgba(255, 235, 170, 0.20)";
      oc.fillRect(wx - weightW * 0.22, weightTop + weightH * 0.08, weightW * 0.12, weightH * 0.78);
    }

    // Brass hinges on the door's right edge.
    const hw = cw * 0.025, hh = cw * 0.07;
    for (const f of [0.25, 0.75]) {
      const hy = inY + inH * f - hh / 2;
      const hx = inX + inW - hw / 2;
      const hg = oc.createLinearGradient(hx, 0, hx + hw, 0);
      hg.addColorStop(0, "#caa04c");
      hg.addColorStop(1, "#7a5c20");
      oc.fillStyle = hg;
      U.roundRect(oc, hx, hy, hw, hh, hw * 0.3);
      oc.fill();
    }

    // Keyhole escutcheon, centered below the door.
    const escR = cw * 0.02;
    const escX = cw / 2, escY = (inY + inH + chh) / 2;
    const eg = oc.createRadialGradient(escX - escR * 0.3, escY - escR * 0.3, escR * 0.1, escX, escY, escR);
    eg.addColorStop(0, "#e8cf8e");
    eg.addColorStop(1, "#8a6f38");
    oc.fillStyle = eg;
    oc.beginPath();
    oc.arc(escX, escY, escR, 0, U.TAU);
    oc.fill();
    oc.fillStyle = "#241609";
    oc.beginPath();
    oc.arc(escX, escY - escR * 0.25, escR * 0.28, 0, U.TAU);
    oc.fill();
    oc.beginPath();
    oc.moveTo(escX - escR * 0.14, escY - escR * 0.05);
    oc.lineTo(escX + escR * 0.14, escY - escR * 0.05);
    oc.lineTo(escX + escR * 0.22, escY + escR * 0.55);
    oc.lineTo(escX - escR * 0.22, escY + escR * 0.55);
    oc.closePath();
    oc.fill();

    caseCache = { key, canvas: c };
    return c;
  }

  CLOX.register({
    id: "regulator",
    name: "Regulator · Pendulum",
    leave() {
      caseCache = { key: "", canvas: null };
    },

    draw(ctx, W, H, d, settings) {
      const t = U.timeParts(d, true);

      // Wall.
      let g = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
      g.addColorStop(0, "#2e2a26");
      g.addColorStop(1, "#141210");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const room = Math.min(W, H);
      ctx.fillStyle = "rgba(255, 225, 180, 0.025)";
      for (let x = W * 0.12; x < W; x += W * 0.19) {
        ctx.fillRect(x, H * 0.03, Math.max(1, room * 0.0014), H * 0.86);
      }
      ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
      ctx.fillRect(0, H * 0.82, W, H * 0.18);
      ctx.strokeStyle = "rgba(255, 220, 170, 0.055)";
      ctx.lineWidth = Math.max(1, room * 0.002);
      ctx.beginPath();
      ctx.moveTo(0, H * 0.82);
      ctx.lineTo(W, H * 0.82);
      ctx.stroke();
      g = ctx.createRadialGradient(W * 0.50, H * 0.06, 0, W * 0.50, H * 0.16, room * 0.62);
      g.addColorStop(0, "rgba(255, 213, 145, 0.14)");
      g.addColorStop(1, "rgba(255, 213, 145, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Case.
      const cw = Math.min(W * 0.42, H * 0.58);
      const chh = Math.min(H * 0.92, cw * 2.1);
      const cx = W / 2;
      const cyTop = (H - chh) / 2;
      const rad = cw * 0.10;

      ctx.save();
      g = ctx.createRadialGradient(cx, cyTop + chh * 0.57, cw * 0.24, cx, cyTop + chh * 0.62, cw * 0.76);
      g.addColorStop(0, "rgba(0, 0, 0, 0.40)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(cx + cw * 0.06, cyTop + chh * 0.58, cw * 0.82, chh * 0.52, 0.03, 0, U.TAU);
      ctx.fill();
      ctx.restore();

      const caseImg = buildCase(cw, chh);
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = cw * 0.10;
      ctx.shadowOffsetY = cw * 0.04;
      ctx.drawImage(caseImg, cx - cw / 2, cyTop, cw, chh);
      ctx.restore();

      // Door opening bounds, for placing the dial/pendulum/glass overlay.
      const inX = cx - cw / 2 + cw * 0.075, inW = cw * 0.85;
      const inY = cyTop + cw * 0.075, inH = chh - cw * 0.15;

      // ---- Pendulum (drawn before the dial so the bob passes behind it) ----
      const dialY = inY + inW * 0.52;
      const RD = inW * 0.44;
      const pivotY = dialY;
      const bobR = cw * 0.115;
      const rodLen = (inY + inH) - pivotY - bobR * 2.1;
      const theta = 0.075 * Math.sin(Math.PI * t.fs);

      ctx.save();
      ctx.translate(cx, pivotY);
      ctx.rotate(theta);
      // Lyre rod: two thin brass rods from the pivot converging on the bob.
      ctx.strokeStyle = "#a8823f";
      ctx.lineWidth = 1.5;
      const lyreGap = cw * 0.012;
      ctx.beginPath();
      ctx.moveTo(-lyreGap / 2, 0);
      ctx.lineTo(0, rodLen);
      ctx.moveTo(lyreGap / 2, 0);
      ctx.lineTo(0, rodLen);
      ctx.stroke();
      // Specular highlight tracks a fixed light source as the bob swings.
      const hlx = -Math.sin(theta) * bobR * 0.5;
      g = ctx.createRadialGradient(hlx, rodLen + bobR * 0.7, bobR * 0.1,
        0, rodLen + bobR, bobR);
      g.addColorStop(0, "#ecd28e");
      g.addColorStop(0.6, "#b8903f");
      g.addColorStop(1, "#6e5220");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, rodLen + bobR, bobR, 0, U.TAU);
      ctx.fill();
      // Rating nut under the bob.
      ctx.fillStyle = "#8a6a2e";
      ctx.fillRect(-cw * 0.02, rodLen + bobR * 2.02, cw * 0.04, cw * 0.03);
      ctx.restore();

      // ---- Dial ----
      g = ctx.createRadialGradient(cx, dialY, 0, cx, dialY, RD);
      g.addColorStop(0, "#f6f1e2");
      g.addColorStop(0.9, "#ece5d2");
      g.addColorStop(1, "#d4ccb6");
      ctx.beginPath();
      ctx.arc(cx, dialY, RD, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();
      g = ctx.createRadialGradient(cx - RD * 0.30, dialY - RD * 0.34, 0, cx, dialY, RD * 1.02);
      g.addColorStop(0, "rgba(255, 255, 255, 0.22)");
      g.addColorStop(0.55, "rgba(255, 255, 255, 0.03)");
      g.addColorStop(1, "rgba(85, 65, 30, 0.16)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, dialY, RD * 0.985, 0, U.TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx, dialY, RD * 0.92, 0, U.TAU);
      ctx.strokeStyle = "rgba(170, 140, 76, 0.28)";
      ctx.lineWidth = RD * 0.035;
      ctx.stroke();
      ctx.strokeStyle = "#3a352b";
      ctx.lineWidth = RD * 0.02;
      ctx.stroke();

      // Minute track: fine railroad ticks, numerals every 15.
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * U.TAU;
        const major = i % 5 === 0;
        const len = major ? RD * 0.07 : RD * 0.035;
        ctx.beginPath();
        ctx.moveTo(cx + Math.sin(a) * (RD * 0.96 - len), dialY - Math.cos(a) * (RD * 0.96 - len));
        ctx.lineTo(cx + Math.sin(a) * RD * 0.96, dialY - Math.cos(a) * RD * 0.96);
        ctx.lineWidth = major ? RD * 0.014 : RD * 0.007;
        ctx.strokeStyle = "#2c2822";
        ctx.stroke();
      }
      ctx.fillStyle = "#2c2822";
      ctx.font = `${RD * 0.11}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      [["60", 0], ["15", 0.25], ["30", 0.5], ["45", 0.75]].forEach(([lb, f]) => {
        const a = f * U.TAU;
        ctx.fillText(lb, cx + Math.sin(a) * RD * 0.84, dialY - Math.cos(a) * RD * 0.84);
      });

      // Sub-dials: hours above center, seconds below.
      const hR = RD * 0.30, hCy = dialY - RD * 0.44;
      const sR = RD * 0.30, sCy = dialY + RD * 0.44;
      subdial(ctx, cx, hCy, hR, 12, ["12", "3", "6", "9"]);
      subdial(ctx, cx, sCy, sR, 60, null);

      hand(ctx, cx, hCy, (t.fh / 12) * U.TAU, hR * 0.72, hR * 0.10, "#20242e");

      // Dead-beat seconds: the hand rests on the second, then steps quickly
      // to the next — synced with the pendulum, which passes center (its
      // fastest point, where a real escapement ticks) at each whole second.
      if (settings.seconds) {
        const stepT = t.ms < 90 ? U.easeOutCubic(t.ms / 90) : 1;
        const secVal = U.lerp(t.s - 1, t.s, stepT);
        hand(ctx, cx, sCy, (secVal / 60) * U.TAU, sR * 0.85, sR * 0.07, "#7a2620", sR * 0.2);
      }

      // The star of a regulator: the central minute hand.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
      ctx.shadowBlur = RD * 0.02;
      ctx.shadowOffsetY = RD * 0.02;
      hand(ctx, cx, dialY, (t.fm / 60) * U.TAU, RD * 0.90, RD * 0.045, "#20242e", RD * 0.14);
      ctx.restore();

      // Glass: two diagonal streaks over the whole door.
      ctx.save();
      U.roundRect(ctx, inX, inY, inW, inH, rad * 0.6);
      ctx.clip();
      g = ctx.createLinearGradient(inX, inY, inX + inW, inY + inH);
      g.addColorStop(0.18, "rgba(255, 255, 255, 0)");
      g.addColorStop(0.26, "rgba(255, 255, 255, 0.07)");
      g.addColorStop(0.34, "rgba(255, 255, 255, 0)");
      g.addColorStop(0.55, "rgba(255, 255, 255, 0)");
      g.addColorStop(0.62, "rgba(255, 255, 255, 0.05)");
      g.addColorStop(0.72, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(inX, inY, inW, inH);
      ctx.restore();
    }
  });
})();
