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

    draw(ctx, W, H, d, settings) {
      const t = U.timeParts(d, settings?.h24);
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W * 0.43, H * 0.43);
      const br = R * 0.092; // ball radius, shared by spokes/ferrules/shadows/balls

      // Mid-century wall: walnut slats plus a warmer plaster wash.
      let g = ctx.createRadialGradient(cx, cy - H * 0.16, 0, cx, cy, Math.max(W, H) * 0.86);
      g.addColorStop(0, "#514439");
      g.addColorStop(0.55, "#2f2822");
      g.addColorStop(1, "#16120f");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      const slatW = Math.max(20, Math.min(W, H) * 0.042);
      for (let x = -slatW; x < W + slatW; x += slatW) {
        const k = Math.floor(x / slatW);
        const warm = k % 3 === 0;
        const sg = ctx.createLinearGradient(x, 0, x + slatW, 0);
        sg.addColorStop(0, warm ? "rgba(102, 66, 36, 0.15)" : "rgba(255, 220, 170, 0.025)");
        sg.addColorStop(0.75, "rgba(0, 0, 0, 0.10)");
        sg.addColorStop(1, "rgba(255, 240, 210, 0.025)");
        ctx.fillStyle = sg;
        ctx.fillRect(x, 0, slatW * 0.92, H);
      }
      ctx.fillStyle = "#15100c";
      ctx.fillRect(0, H * 0.82, W, H * 0.18);
      g = ctx.createLinearGradient(0, H * 0.80, 0, H);
      g.addColorStop(0, "rgba(150, 98, 48, 0.18)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.28)");
      ctx.fillStyle = g;
      ctx.fillRect(0, H * 0.77, W, H * 0.23);
      ctx.strokeStyle = "rgba(230, 190, 130, 0.12)";
      ctx.lineWidth = Math.max(1, Math.min(W, H) * 0.002);
      ctx.beginPath();
      ctx.moveTo(0, H * 0.82);
      ctx.lineTo(W, H * 0.82);
      ctx.stroke();

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
        ctx.moveTo(x0 + R * 0.018, y0 + R * 0.026);
        ctx.lineTo(x1 + R * 0.018, y1 + R * 0.026);
        ctx.strokeStyle = "rgba(0, 0, 0, 0.22)";
        ctx.lineWidth = R * 0.017;
        ctx.stroke();
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

      // Faint minute ring makes the design readable without adding numerals.
      ctx.strokeStyle = "rgba(225, 200, 150, 0.10)";
      ctx.lineWidth = Math.max(1, R * 0.003);
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.74, 0, U.TAU);
      ctx.stroke();
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * U.TAU;
        const major = i % 5 === 0;
        const r0 = R * (major ? 0.705 : 0.724), r1 = R * 0.742;
        ctx.beginPath();
        ctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
        ctx.lineTo(Math.sin(a) * r1, -Math.cos(a) * r1);
        ctx.strokeStyle = major ? "rgba(230, 205, 150, 0.28)" : "rgba(230, 205, 150, 0.12)";
        ctx.lineWidth = Math.max(1, R * (major ? 0.004 : 0.0022));
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
        ctx.fillRect(-R * 0.012, -R * 0.66, R * 0.024, R * 0.66);
        ctx.beginPath();
        ctx.ellipse(0, -R * 0.73, R * 0.036, R * 0.10, 0, 0, U.TAU);
        ctx.fill();
        // Lighter edge stroke along the leading (clockwise) side.
        ctx.beginPath();
        ctx.moveTo(R * 0.010, 0);
        ctx.lineTo(R * 0.010, -R * 0.66);
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

      // Small room placard: enough exact time for TV viewing without
      // turning the Nelson face into a digital clock.
      const hs = settings?.h24 ? U.pad2(t.H) : String(t.h);
      const label = `${hs}:${U.pad2(t.m)}${settings?.h24 ? "" : (t.pm ? " PM" : " AM")}`;
      const py = H * 0.865, ph = Math.max(30, Math.min(W, H) * 0.052);
      const pw = Math.max(Math.min(W, H) * 0.20, ph * 4.6);
      g = ctx.createLinearGradient(0, py - ph / 2, 0, py + ph / 2);
      g.addColorStop(0, "#d5b56d");
      g.addColorStop(1, "#6a5023");
      ctx.fillStyle = g;
      ctx.shadowColor = "rgba(0, 0, 0, 0.4)";
      ctx.shadowBlur = ph * 0.35;
      U.roundRect(ctx, cx - pw / 2, py - ph / 2, pw, ph, ph * 0.18);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "rgba(255, 238, 180, 0.28)";
      ctx.stroke();
      ctx.font = `600 ${ph * 0.42}px Georgia, serif`;
      ctx.fillStyle = "#1e1810";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, cx, py + ph * 0.02);
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
