/* REGULATOR — watchmaker's precision wall clock (Vienna regulator school).
 * True regulator dial: the minute hand owns the center; hours and seconds
 * live in sub-dials. Brass pendulum swings on a 2-second period behind
 * the glass of a walnut case. */
"use strict";

(() => {
  function subdial(ctx, cx, cy, r, ticks, labels) {
    ctx.save();
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

  CLOX.register({
    id: "regulator",
    name: "Regulator · Pendulum",

    draw(ctx, W, H, d) {
      const t = U.timeParts(d, true);

      // Wall.
      let g = ctx.createRadialGradient(W / 2, H * 0.3, 0, W / 2, H / 2, Math.max(W, H) * 0.8);
      g.addColorStop(0, "#2e2a26");
      g.addColorStop(1, "#141210");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Case.
      const cw = Math.min(W * 0.34, H * 0.50);
      const chh = Math.min(H * 0.92, cw * 2.1);
      const cx = W / 2;
      const cyTop = (H - chh) / 2;
      const rad = cw * 0.10;

      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = cw * 0.10;
      ctx.shadowOffsetY = cw * 0.04;
      g = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
      g.addColorStop(0, "#2a1a0e");
      g.addColorStop(0.18, "#4a2f1a");
      g.addColorStop(0.5, "#5a3a20");
      g.addColorStop(0.82, "#432a16");
      g.addColorStop(1, "#241609");
      ctx.fillStyle = g;
      U.roundRect(ctx, cx - cw / 2, cyTop, cw, chh, rad);
      ctx.fill();
      ctx.restore();

      // Door opening (dark interior behind glass).
      const inX = cx - cw / 2 + cw * 0.075, inW = cw * 0.85;
      const inY = cyTop + cw * 0.075, inH = chh - cw * 0.15;
      g = ctx.createLinearGradient(0, inY, 0, inY + inH);
      g.addColorStop(0, "#171310");
      g.addColorStop(1, "#0c0a08");
      ctx.fillStyle = g;
      U.roundRect(ctx, inX, inY, inW, inH, rad * 0.6);
      ctx.fill();
      // Trim line around the opening.
      ctx.strokeStyle = "rgba(200, 160, 90, 0.22)";
      ctx.lineWidth = Math.max(1, cw * 0.006);
      U.roundRect(ctx, inX, inY, inW, inH, rad * 0.6);
      ctx.stroke();

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
      ctx.strokeStyle = "#a8823f";
      ctx.lineWidth = cw * 0.014;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, rodLen);
      ctx.stroke();
      g = ctx.createRadialGradient(-bobR * 0.3, rodLen + bobR * 0.7, bobR * 0.1,
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
      hand(ctx, cx, sCy, (t.fs / 60) * U.TAU, sR * 0.85, sR * 0.07, "#7a2620", sR * 0.2);

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
