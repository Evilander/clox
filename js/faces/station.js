/* STATION — Swiss railway (SBB) clock. Bar markers, no numerals,
 * red lollipop second hand that sweeps the dial in 58.5s then pauses
 * at 12 for the minute impulse; the minute hand snaps with a small
 * overshoot, exactly like the real Mobatime movements. */
"use strict";

(() => {
  function bar(ctx, angle, inner, outer, width, color) {
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = color;
    ctx.fillRect(-width / 2, -outer, width, outer - inner);
    ctx.restore();
  }

  function hand(ctx, angle, len, wBase, wTip, tail, color) {
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
    id: "station",
    name: "Station · Swiss Railway",

    draw(ctx, W, H, d, settings) {
      const t = U.timeParts(d, true);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.45;

      // SBB movement timing, computed up front — the impulse vibration
      // below needs it before the dial is drawn.
      const msec = t.s + t.ms / 1000;
      const JUMP = 0.35;

      // Platform-dark background.
      let g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
      g.addColorStop(0, "#22262b");
      g.addColorStop(1, "#0d0f12");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(255, 255, 255, 0.04)");
      g.addColorStop(0.12, "rgba(255, 255, 255, 0)");
      g.addColorStop(0.72, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.46)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "rgba(255, 255, 255, 0.025)";
      ctx.fillRect(0, H * 0.13, W, Math.max(1, H * 0.002));
      ctx.fillRect(0, H * 0.82, W, Math.max(1, H * 0.002));
      const armW = R * 0.18;
      g = ctx.createLinearGradient(cx - armW, 0, cx + armW, 0);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(0.28, "#07080a");
      g.addColorStop(0.72, "#1c1e23");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      U.roundRect(ctx, cx - armW, H * 0.05, armW * 2, H * 0.17, R * 0.025);
      ctx.fill();

      ctx.save();
      ctx.translate(cx, cy);

      // Deep enamel case side, offset just enough to read as a real object.
      g = ctx.createLinearGradient(-R, -R, R, R);
      g.addColorStop(0, "#24262a");
      g.addColorStop(0.45, "#08090b");
      g.addColorStop(1, "#000000");
      ctx.beginPath();
      ctx.arc(R * 0.026, R * 0.036, R * 1.02, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();

      // Housing shadow + black rim.
      ctx.save();
      ctx.shadowColor = "rgba(0, 0, 0, 0.65)";
      ctx.shadowBlur = R * 0.10;
      ctx.shadowOffsetY = R * 0.04;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, U.TAU);
      ctx.fillStyle = "#0a0a0b";
      ctx.fill();
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.985, 0, U.TAU);
      ctx.strokeStyle = "#2e2e30";
      ctx.lineWidth = R * 0.006;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.935, 0, U.TAU);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
      ctx.lineWidth = R * 0.018;
      ctx.stroke();

      // Impulse vibration: the movement (dial, markers, hands) shivers
      // briefly as the minute hand snaps, decaying to nothing by 350ms.
      // The fixed case and glass above are drawn outside this and don't
      // move with it.
      ctx.save();
      if (msec < JUMP) {
        const decay = 1 - msec / JUMP;
        ctx.translate(
          Math.sin(msec * 1000 * 0.09) * R * 0.0022 * decay,
          Math.cos(msec * 1000 * 0.075) * R * 0.0018 * decay
        );
      }

      // White dial.
      const FR = R * 0.93;
      g = ctx.createRadialGradient(0, -FR * 0.2, 0, 0, 0, FR);
      g.addColorStop(0, "#ffffff");
      g.addColorStop(0.85, "#f6f6f4");
      g.addColorStop(1, "#e4e4e0");
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();
      g = ctx.createRadialGradient(-FR * 0.12, -FR * 0.18, FR * 0.18, 0, 0, FR);
      g.addColorStop(0, "rgba(255, 255, 255, 0.12)");
      g.addColorStop(0.72, "rgba(255, 255, 255, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.10)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.fill();

      // Markers: 12 heavy hour bars, 48 light minute bars.
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * U.TAU;
        if (i % 5 === 0) {
          bar(ctx, a, FR * 0.72, FR * 0.90, R * 0.045, "#1a1a1a");
        } else {
          bar(ctx, a, FR * 0.845, FR * 0.90, R * 0.014, "#1a1a1a");
        }
      }

      // --- SBB movement timing ---
      // Minute hand: impulse snap in the first 350ms of each minute,
      // with a slight spring overshoot.
      let minuteVal;
      if (msec < JUMP) {
        minuteVal = (t.m - 1) + U.easeOutBack(msec / JUMP);
      } else {
        minuteVal = t.m;
      }
      const minA = (minuteVal / 60) * U.TAU;
      const hourA = ((t.H % 12) + minuteVal / 60) / 12 * U.TAU;

      const shadow = (fn) => {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.25)";
        ctx.shadowBlur = R * 0.015;
        ctx.shadowOffsetY = R * 0.015;
        fn();
        ctx.restore();
      };

      shadow(() => hand(ctx, hourA, FR * 0.60, R * 0.058, R * 0.042, R * 0.14, "#1a1a1a"));
      shadow(() => hand(ctx, minA, FR * 0.885, R * 0.048, R * 0.028, R * 0.16, "#1a1a1a"));

      // Red second hand: thin rod ending in the lollipop disc. Sweeps in
      // 58.5s flat, then parks at 12 for a full 1.5s until the minute
      // impulse — the real Mobatime behavior, not a rendering shortcut.
      // The 1.5s hold is intentional and authentic.
      if (settings.seconds) {
        const secA = Math.min(msec / 58.5, 1) * U.TAU;
        shadow(() => {
          ctx.save();
          ctx.rotate(secA);
          ctx.fillStyle = "#eb0000";
          ctx.fillRect(-R * 0.008, -FR * 0.62, R * 0.016, FR * 0.62 + R * 0.19);
          ctx.beginPath();
          ctx.arc(0, -FR * 0.62, R * 0.062, 0, U.TAU);
          ctx.fill();
          ctx.restore();
        });
      }

      // Center cap.
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.026, 0, U.TAU);
      ctx.fillStyle = "#eb0000";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.012, 0, U.TAU);
      ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
      ctx.fill();

      ctx.restore(); // end impulse vibration

      // Glass highlight.
      ctx.beginPath();
      ctx.arc(0, 0, FR, 0, U.TAU);
      ctx.clip();
      g = ctx.createRadialGradient(-FR * 0.5, -FR * 0.55, 0, -FR * 0.5, -FR * 0.55, FR * 1.3);
      g.addColorStop(0, "rgba(255, 255, 255, 0.20)");
      g.addColorStop(0.3, "rgba(255, 255, 255, 0.04)");
      g.addColorStop(0.55, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-FR, -FR, FR * 2, FR * 2);
      g = ctx.createLinearGradient(-FR * 0.70, -FR * 0.88, FR * 0.62, FR * 0.38);
      g.addColorStop(0, "rgba(255, 255, 255, 0)");
      g.addColorStop(0.45, "rgba(255, 255, 255, 0.16)");
      g.addColorStop(0.53, "rgba(255, 255, 255, 0.035)");
      g.addColorStop(0.66, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-FR, -FR, FR * 2, FR * 2);
      // Second, fainter highlight, lower-right.
      g = ctx.createRadialGradient(FR * 0.4, FR * 0.5, 0, FR * 0.4, FR * 0.5, FR * 1.3);
      g.addColorStop(0, "rgba(255, 255, 255, 0.05)");
      g.addColorStop(0.3, "rgba(255, 255, 255, 0.01)");
      g.addColorStop(0.55, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-FR, -FR, FR * 2, FR * 2);

      ctx.restore();
    }
  });
})();
