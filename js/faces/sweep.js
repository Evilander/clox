/* SWEEP — detailed analog wall clock. Brushed-metal bezel, ivory dial,
 * serif numerals, date window, drop-shadowed hands, true continuous
 * sweep second hand, glass highlight. */
"use strict";

(() => {
  function hand(ctx, angle, len, wBase, wTip, color, tail = 0) {
    ctx.save();
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(-wBase / 2, tail);
    ctx.lineTo(-wTip / 2, -len);
    ctx.lineTo(wTip / 2, -len);
    ctx.lineTo(wBase / 2, tail);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  CLOX.register({
    id: "sweep",
    name: "Sweep · Wall Clock",

    draw(ctx, W, H, d, settings) {
      const t = U.timeParts(d, settings.h24);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.45;

      // Wall.
      let g = ctx.createRadialGradient(cx, cy - H * 0.2, 0, cx, cy, Math.max(W, H) * 0.8);
      g.addColorStop(0, "#2c2e33");
      g.addColorStop(1, "#131417");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Clock shadow on the wall.
      ctx.save();
      ctx.translate(cx, cy);
      ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
      ctx.shadowBlur = R * 0.12;
      ctx.shadowOffsetY = R * 0.05;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, U.TAU);
      ctx.fillStyle = "#111";
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(cx, cy);

      // Brushed-metal bezel (conic gradient where supported).
      let bezel;
      if (ctx.createConicGradient) {
        bezel = ctx.createConicGradient(-0.6, 0, 0);
        const stops = [
          [0.00, "#e8e9ea"], [0.10, "#9ea1a6"], [0.22, "#f2f3f4"],
          [0.35, "#84878c"], [0.50, "#dcdee0"], [0.63, "#8f9297"],
          [0.78, "#eceded"], [0.90, "#9a9da2"], [1.00, "#e8e9ea"]
        ];
        for (const [p, c] of stops) bezel.addColorStop(p, c);
      } else {
        bezel = ctx.createLinearGradient(-R, -R, R, R);
        bezel.addColorStop(0, "#e8e9ea");
        bezel.addColorStop(1, "#84878c");
      }
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, U.TAU);
      ctx.fillStyle = bezel;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.985, 0, U.TAU);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = R * 0.004;
      ctx.stroke();

      // Dial.
      const FR = R * 0.90;
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, FR);
      g.addColorStop(0, "#faf7ef");
      g.addColorStop(0.85, "#f1ecdf");
      g.addColorStop(1, "#ddd6c4");
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();
      // Inner shadow where dial meets bezel.
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.strokeStyle = "rgba(0, 0, 0, 0.28)";
      ctx.lineWidth = R * 0.012;
      ctx.stroke();

      // Ticks.
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * U.TAU;
        const isHour = i % 5 === 0;
        ctx.save();
        ctx.rotate(a);
        ctx.fillStyle = "#20201d";
        if (isHour) {
          ctx.fillRect(-R * 0.011, -FR * 0.965, R * 0.022, FR * 0.085);
        } else {
          ctx.fillRect(-R * 0.004, -FR * 0.965, R * 0.008, FR * 0.045);
        }
        ctx.restore();
      }

      // Numerals.
      ctx.fillStyle = "#26251f";
      ctx.font = `${R * 0.145}px Georgia, "Times New Roman", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (let n = 1; n <= 12; n++) {
        const a = (n / 12) * U.TAU;
        const nr = FR * 0.78;
        ctx.fillText(String(n), Math.sin(a) * nr, -Math.cos(a) * nr);
      }

      // Dial text + date window at 3 o'clock.
      ctx.font = `600 ${R * 0.045}px "Segoe UI", sans-serif`;
      ctx.fillStyle = "#4a463c";
      ctx.fillText("CLOX", 0, -FR * 0.38);
      ctx.font = `italic ${R * 0.035}px Georgia, serif`;
      ctx.fillText("quartz", 0, FR * 0.42);

      const dwW = R * 0.13, dwH = R * 0.095, dwX = FR * 0.52;
      ctx.fillStyle = "#fffdf6";
      ctx.strokeStyle = "#8a8474";
      ctx.lineWidth = R * 0.006;
      U.roundRect(ctx, dwX - dwW / 2, -dwH / 2, dwW, dwH, R * 0.012);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#26251f";
      ctx.font = `600 ${R * 0.06}px "Segoe UI", sans-serif`;
      ctx.fillText(String(t.date), dwX, R * 0.004);

      // Hands (each with its own drop shadow pass).
      const shadow = (fn) => {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.30)";
        ctx.shadowBlur = R * 0.02;
        ctx.shadowOffsetY = R * 0.02;
        fn();
        ctx.restore();
      };

      const hourA = (t.fh / 12) * U.TAU;
      const minA = (t.fm / 60) * U.TAU;
      const secA = (t.fs / 60) * U.TAU;

      shadow(() => hand(ctx, hourA, FR * 0.52, R * 0.042, R * 0.022, "#1d1c19", R * 0.06));
      shadow(() => hand(ctx, minA, FR * 0.76, R * 0.034, R * 0.014, "#1d1c19", R * 0.08));

      // Red sweep second hand with counterweight.
      shadow(() => {
        ctx.save();
        ctx.rotate(secA);
        ctx.fillStyle = "#c8281e";
        ctx.fillRect(-R * 0.006, -FR * 0.86, R * 0.012, FR * 0.86 + R * 0.14);
        ctx.beginPath();
        ctx.arc(0, R * 0.13, R * 0.028, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      });

      // Center caps.
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.035, 0, U.TAU);
      ctx.fillStyle = "#1d1c19";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.018, 0, U.TAU);
      ctx.fillStyle = "#c8281e";
      ctx.fill();

      // Glass: soft crescent highlight, upper-left.
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.clip();
      g = ctx.createRadialGradient(-FR * 0.45, -FR * 0.55, 0, -FR * 0.45, -FR * 0.55, FR * 1.25);
      g.addColorStop(0, "rgba(255, 255, 255, 0.16)");
      g.addColorStop(0.35, "rgba(255, 255, 255, 0.05)");
      g.addColorStop(0.6, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-FR, -FR, FR * 2, FR * 2);

      ctx.restore();
    }
  });
})();
