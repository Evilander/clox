/* NELSON — George Nelson Ball Clock (1949), multicolor edition. Twelve
 * lacquered wooden balls on brass spokes, paddle hour hand, long minute
 * hand with an elliptical tip. No second hand — Nelson never fitted one. */
"use strict";

(() => {
  const BALLS = [
    "#c8402e", "#e0862c", "#d9b13b", "#ece4d3", "#3e7a74", "#2b2a28",
    "#c8402e", "#e0862c", "#d9b13b", "#ece4d3", "#3e7a74", "#2b2a28"
  ];

  CLOX.register({
    id: "nelson",
    name: "Nelson · Ball Clock",

    draw(ctx, W, H, d) {
      const t = U.timeParts(d, true);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.36;

      // Warm plaster wall with a soft spot.
      let g = ctx.createRadialGradient(cx, cy - H * 0.1, 0, cx, cy, Math.max(W, H) * 0.8);
      g.addColorStop(0, "#3a332b");
      g.addColorStop(1, "#191512");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cx, cy);

      // Brass spokes.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * U.TAU;
        ctx.beginPath();
        ctx.moveTo(Math.sin(a) * R * 0.10, -Math.cos(a) * R * 0.10);
        ctx.lineTo(Math.sin(a) * R * 0.90, -Math.cos(a) * R * 0.90);
        ctx.strokeStyle = "#9a8455";
        ctx.lineWidth = R * 0.012;
        ctx.stroke();
      }

      // Balls, each with its own sphere shading and drop shadow.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * U.TAU;
        const bx = Math.sin(a) * R, by = -Math.cos(a) * R;
        const br = R * 0.088;
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
        ctx.shadowBlur = br * 0.7;
        ctx.shadowOffsetY = br * 0.35;
        g = ctx.createRadialGradient(bx - br * 0.35, by - br * 0.4, br * 0.1, bx, by, br);
        const base = BALLS[i];
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.18, base);
        g.addColorStop(1, shade(base, 0.55));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }

      // Hands (continuous motion, like the original movement).
      const shadow = (fn) => {
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
        ctx.shadowBlur = R * 0.02;
        ctx.shadowOffsetY = R * 0.02;
        fn();
        ctx.restore();
      };

      // Hour: tapered paddle.
      shadow(() => {
        ctx.save();
        ctx.rotate((t.fh / 12) * U.TAU);
        ctx.beginPath();
        ctx.moveTo(-R * 0.030, 0);
        ctx.lineTo(-R * 0.052, -R * 0.30);
        ctx.lineTo(0, -R * 0.46);
        ctx.lineTo(R * 0.052, -R * 0.30);
        ctx.lineTo(R * 0.030, 0);
        ctx.closePath();
        ctx.fillStyle = "#22211f";
        ctx.fill();
        ctx.restore();
      });

      // Minute: slim stick ending in an elongated elliptical tip.
      shadow(() => {
        ctx.save();
        ctx.rotate((t.fm / 60) * U.TAU);
        ctx.fillStyle = "#22211f";
        ctx.fillRect(-R * 0.010, -R * 0.62, R * 0.020, R * 0.62);
        ctx.beginPath();
        ctx.ellipse(0, -R * 0.68, R * 0.030, R * 0.085, 0, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      });

      // Brass hub.
      g = ctx.createRadialGradient(-R * 0.012, -R * 0.012, 0, 0, 0, R * 0.045);
      g.addColorStop(0, "#e8cf8e");
      g.addColorStop(1, "#8a6f38");
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.045, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();

      ctx.restore();
    }
  });

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * k);
    const gg = Math.round(((n >> 8) & 255) * k);
    const b = Math.round((n & 255) * k);
    return `rgb(${r}, ${gg}, ${b})`;
  }
})();
