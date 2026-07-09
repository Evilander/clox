/* BRAUN — Dieter Rams-school minimalist analog. Matte case, clean sans
 * numerals, stick hands, yellow second hand that steps once per second
 * with a tiny mechanical overshoot (quartz tick, not sweep). */
"use strict";

(() => {
  function stick(ctx, angle, len, width, color, tail = 0) {
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, tail);
    ctx.lineTo(0, -len);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  }

  CLOX.register({
    id: "braun",
    name: "Braun · Minimal",

    draw(ctx, W, H, d) {
      const t = U.timeParts(d, true);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.44;

      // Neutral studio background.
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, "#26272a");
      g.addColorStop(1, "#101113");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cx, cy);

      // Matte case: shallow dark ring, no ornament.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.55)";
      ctx.shadowBlur = R * 0.08;
      ctx.shadowOffsetY = R * 0.03;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, U.TAU);
      ctx.fillStyle = "#181a1c";
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.99, 0, U.TAU);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
      ctx.lineWidth = R * 0.006;
      ctx.stroke();

      // Off-white dial.
      const FR = R * 0.93;
      g = ctx.createRadialGradient(0, -FR * 0.25, 0, 0, 0, FR);
      g.addColorStop(0, "#f6f4ef");
      g.addColorStop(1, "#e9e6de");
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();

      // Thin ticks: every minute, hours slightly longer. No bezel clutter.
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * U.TAU;
        const isHour = i % 5 === 0;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = "#2a2a28";
        if (isHour) ctx.fillRect(-R * 0.005, -FR * 0.95, R * 0.010, FR * 0.075);
        else ctx.fillRect(-R * 0.0025, -FR * 0.95, R * 0.005, FR * 0.038);
        ctx.restore();
      }

      // All twelve numerals in a plain grotesque, modest size.
      ctx.fillStyle = "#2a2a28";
      ctx.font = `400 ${R * 0.105}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let n = 1; n <= 12; n++) {
        const a = (n / 12) * U.TAU;
        const nr = FR * 0.755;
        ctx.fillText(String(n), Math.sin(a) * nr, -Math.cos(a) * nr + R * 0.004);
      }

      ctx.font = `500 ${R * 0.038}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillStyle = "#7c7a72";
      ctx.fillText("clox", 0, -FR * 0.34);
      ctx.font = `400 ${R * 0.028}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      ctx.fillText("quartz", 0, -FR * 0.28);

      // Hands: plain black sticks; hour/minute move continuously.
      const shadow = (fn) => {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
        ctx.shadowBlur = R * 0.012;
        ctx.shadowOffsetY = R * 0.012;
        fn();
        ctx.restore();
      };
      shadow(() => stick(ctx, (t.fh / 12) * U.TAU, FR * 0.52, R * 0.036, "#1c1c1a", R * 0.015));
      shadow(() => stick(ctx, (t.fm / 60) * U.TAU, FR * 0.80, R * 0.028, "#1c1c1a", R * 0.015));

      // Yellow second hand: quartz tick — steps each second with a small
      // overshoot in the first 120ms, then rests.
      const p = U.clamp(t.ms / 120, 0, 1);
      const secVal = (t.s - 1) + U.easeOutBack(p);
      shadow(() => {
        ctx.save();
        ctx.rotate((secVal / 60) * U.TAU);
        ctx.strokeStyle = "#f5c400";
        ctx.lineWidth = R * 0.012;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(0, R * 0.14);
        ctx.lineTo(0, -FR * 0.72);
        ctx.stroke();
        // Counterweight disc near the pivot, Braun-style.
        ctx.beginPath();
        ctx.arc(0, R * 0.06, R * 0.026, 0, U.TAU);
        ctx.fillStyle = "#f5c400";
        ctx.fill();
        ctx.restore();
      });

      // Center pin.
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.014, 0, U.TAU);
      ctx.fillStyle = "#1c1c1a";
      ctx.fill();

      // Very subtle domed-glass sheen.
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.clip();
      g = ctx.createRadialGradient(-FR * 0.4, -FR * 0.5, 0, -FR * 0.4, -FR * 0.5, FR * 1.4);
      g.addColorStop(0, "rgba(255, 255, 255, 0.10)");
      g.addColorStop(0.4, "rgba(255, 255, 255, 0.02)");
      g.addColorStop(0.6, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-FR, -FR, FR * 2, FR * 2);

      ctx.restore();
    }
  });
})();
