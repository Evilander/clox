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
      const br = R * 0.088; // ball radius, shared by spokes/ferrules/shadows/balls

      // Warm plaster wall with a soft spot.
      let g = ctx.createRadialGradient(cx, cy - H * 0.1, 0, cx, cy, Math.max(W, H) * 0.8);
      g.addColorStop(0, "#3a332b");
      g.addColorStop(1, "#191512");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      ctx.save();
      ctx.translate(cx, cy);

      // Wall wash: a single soft directional shadow behind the whole clock,
      // establishing one coherent top-left light source for everything below.
      g = ctx.createRadialGradient(R * 0.06, R * 0.09, 0, R * 0.06, R * 0.09, R * 1.25);
      g.addColorStop(0, "rgba(0, 0, 0, 0.28)");
      g.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8);

      // Brass spokes, lit along their length from the same top-left source.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * U.TAU;
        const x0 = Math.sin(a) * R * 0.10, y0 = -Math.cos(a) * R * 0.10;
        const x1 = Math.sin(a) * R * 0.90, y1 = -Math.cos(a) * R * 0.90;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        const sg = ctx.createLinearGradient(x0, y0, x1, y1);
        sg.addColorStop(0, "#ac9159");
        sg.addColorStop(1, "#7d6a3f");
        ctx.strokeStyle = sg;
        ctx.lineWidth = R * 0.012;
        ctx.stroke();
      }

      // Ferrules: brass sleeves where each spoke enters its ball.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * U.TAU;
        const fx = Math.sin(a) * (R - br), fy = -Math.cos(a) * (R - br);
        const fr = R * 0.016;
        const fg = ctx.createRadialGradient(fx - fr * 0.3, fy - fr * 0.3, fr * 0.1, fx, fy, fr);
        fg.addColorStop(0, "#e2c684");
        fg.addColorStop(1, "#8a6f38");
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.arc(fx, fy, fr, 0, U.TAU);
        ctx.fill();
      }

      // Each ball's cast shadow on the wall, drawn before the balls so the
      // balls themselves sit cleanly on top.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * U.TAU;
        const bx = Math.sin(a) * R, by = -Math.cos(a) * R;
        ctx.save();
        ctx.shadowColor = "rgba(0, 0, 0, 0.22)";
        ctx.shadowBlur = br * 0.8;
        ctx.fillStyle = "rgba(0, 0, 0, 0.22)";
        ctx.beginPath();
        ctx.ellipse(bx + R * 0.035, by + R * 0.045, br * 1.05, br * 0.75, 0, 0, U.TAU);
        ctx.fill();
        ctx.restore();
      }

      // Balls, each with its own sphere shading and drop shadow.
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * U.TAU;
        const bx = Math.sin(a) * R, by = -Math.cos(a) * R;
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
        // Elliptical sheen near the paddle's widest point.
        ctx.beginPath();
        ctx.ellipse(-R * 0.010, -R * 0.30, R * 0.022, R * 0.09, 0, 0, U.TAU);
        ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
        ctx.fill();
        // Lighter edge stroke along the leading (clockwise) side.
        ctx.beginPath();
        ctx.moveTo(R * 0.030, 0);
        ctx.lineTo(R * 0.052, -R * 0.30);
        ctx.lineTo(0, -R * 0.46);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
        ctx.lineWidth = 1;
        ctx.stroke();
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
        // Lighter edge stroke along the leading (clockwise) side.
        ctx.beginPath();
        ctx.moveTo(R * 0.010, 0);
        ctx.lineTo(R * 0.010, -R * 0.62);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
        ctx.lineWidth = 1;
        ctx.stroke();
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
