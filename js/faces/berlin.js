/* BERLIN — Mengenlehreuhr (Berlin set-theory clock, Binninger 1975).
 * Top lamp blinks the seconds; then 4 red lamps of 5 hours each,
 * 4 red lamps of 1 hour, 11 lamps of 5 minutes (quarters red, rest
 * yellow), 4 yellow lamps of 1 minute. Reads top to bottom. */
"use strict";

(() => {
  const ROW_LABELS = ["5H", "1H", "5M", "1M"];

  function lamp(ctx, x, y, w, h, r, trueColor, glowAlpha, glowColor) {
    // Housing: small dark socket immediately behind the glass.
    ctx.fillStyle = "#0c0c0e";
    U.roundRect(ctx, x - w * 0.04, y - h * 0.05, w * 1.08, h * 1.1, r * 1.2);
    ctx.fill();

    // Dark glass base with a faint tint of its own color — always present;
    // the lit glow (if any) overlays on top of it.
    U.roundRect(ctx, x, y, w, h, r);
    let g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#232427");
    g.addColorStop(1, "#151517");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    U.roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    ctx.fillStyle = trueColor;
    ctx.globalAlpha = 0.07;
    ctx.fillRect(x, y, w, h);
    ctx.restore();

    // Lit glow: ignition warm-up / fade is entirely driven by glowAlpha and
    // glowColor, which the caller derives from each lamp's tracked state.
    if (glowAlpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = glowAlpha;
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = h * 0.55;
      ctx.fillStyle = glowColor;
      U.roundRect(ctx, x, y, w, h, r);
      ctx.fill();
      ctx.fill();
      ctx.restore();
    }

    // Glass gloss on the top edge, brighter while lit.
    ctx.save();
    U.roundRect(ctx, x, y, w, h, r);
    ctx.clip();
    const gl = ctx.createLinearGradient(0, y, 0, y + h * 0.5);
    gl.addColorStop(0, `rgba(255, 255, 255, ${0.10 + 0.25 * glowAlpha})`);
    gl.addColorStop(1, "rgba(255, 255, 255, 0)");
    ctx.fillStyle = gl;
    ctx.fillRect(x, y, w, h * 0.5);
    ctx.restore();
  }

  // Cream steel housing the lamps read as set into. Purely cosmetic —
  // drawn behind the lamps, changes nothing about lamp geometry.
  function rowHousing(ctx, x, y, w, h, r) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, "#c9c2b2");
    g.addColorStop(1, "#a89f8c");
    ctx.fillStyle = g;
    U.roundRect(ctx, x, y, w, h, r);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1;
    U.roundRect(ctx, x, y, w, h, r);
    ctx.stroke();
  }

  function rowHousingCircle(ctx, cx, cy, r) {
    const g = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    g.addColorStop(0, "#c9c2b2");
    g.addColorStop(1, "#a89f8c");
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, U.TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function lerpColor(a, b, k) {
    const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
    const r = Math.round(U.lerp((pa >> 16) & 255, (pb >> 16) & 255, k));
    const gg = Math.round(U.lerp((pa >> 8) & 255, (pb >> 8) & 255, k));
    const bb = Math.round(U.lerp(pa & 255, pb & 255, k));
    return `rgb(${r}, ${gg}, ${bb})`;
  }

  // Per-lamp ignition state, keyed "row:idx" (or "sec:0" for the seconds
  // lamp). Neon warm-up on ignite, cooldown fade on release.
  let lampState = {};
  // Previous frame's per-row lit counts, to detect a relay-bank change.
  let prevLitCounts = [null, null, null, null];
  let sagT0 = -Infinity;

  function lampGlow(key, targetLit, trueColor, now, sagMul) {
    let st = lampState[key];
    if (!st) st = lampState[key] = { lit: false, t0: -Infinity };
    if (targetLit !== st.lit) { st.lit = targetLit; st.t0 = now; }
    const dur = targetLit ? 140 : 220;
    const p = U.clamp((now - st.t0) / dur, 0, 1);
    let alpha = targetLit ? p : 1 - p;
    if (targetLit) alpha *= sagMul;
    const color = targetLit ? lerpColor("#ff8a4a", trueColor, p) : trueColor;
    return { alpha, color };
  }

  CLOX.register({
    id: "berlin",
    name: "Berlin · Mengenlehreuhr",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, true);
      const RED = "#ff3527", YEL = "#ffb428";

      let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.75);
      g.addColorStop(0, "#191a1e");
      g.addColorStop(1, "#0a0b0d");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      // Stack geometry: seconds circle + 4 rows (leave room for the caption).
      const u = Math.min(H * 0.115, W * 0.125);
      const rowW = u * 6.2, rowH = u * 0.92, gap = u * 0.42, D = u * 1.5;
      const totalH = D + 4 * (rowH + gap);
      const x0 = (W - rowW) / 2;
      let y = (H - totalH) / 2 - u * 0.2;
      const cx = W / 2;

      // Central mast behind the stack — stays behind the new cream housings.
      ctx.fillStyle = "#101113";
      ctx.fillRect(cx - u * 0.11, y, u * 0.22, totalH + u * 0.4);

      // Seconds lamp: blinks on even seconds, like the original.
      const sr = D / 2;
      rowHousingCircle(ctx, cx, y + sr, sr * 1.08 + u * 0.18);
      const secGlow = lampGlow("sec:0", t.s % 2 === 0, YEL, now, 1);

      ctx.fillStyle = "#0c0c0e";
      ctx.beginPath();
      ctx.arc(cx, y + sr, sr * 1.08, 0, U.TAU);
      ctx.fill();

      g = ctx.createLinearGradient(0, y, 0, y + D);
      g.addColorStop(0, "#232427");
      g.addColorStop(1, "#151517");
      ctx.beginPath();
      ctx.arc(cx, y + sr, sr, 0, U.TAU);
      ctx.fillStyle = g;
      ctx.fill();

      if (secGlow.alpha > 0.001) {
        ctx.save();
        ctx.globalAlpha = secGlow.alpha;
        ctx.shadowColor = secGlow.color;
        ctx.shadowBlur = sr * 0.8;
        ctx.fillStyle = secGlow.color;
        ctx.beginPath();
        ctx.arc(cx, y + sr, sr, 0, U.TAU);
        ctx.fill();
        ctx.fill();
        ctx.restore();
      }

      // Gloss.
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, y + sr, sr, 0, U.TAU);
      ctx.clip();
      g = ctx.createLinearGradient(0, y, 0, y + sr);
      g.addColorStop(0, `rgba(255, 255, 255, ${0.10 + 0.25 * secGlow.alpha})`);
      g.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - sr, y, D, sr);
      ctx.restore();

      ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
      ctx.font = `${u * 0.16}px "Segoe UI", sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText("2S", cx + sr * 1.08 + u * 0.12, y + sr);

      y += D + gap;

      // Rows: [cellCount, litCount, colorFn]
      const rows = [
        [4, Math.floor(t.H / 5), () => RED],
        [4, t.H % 5, () => RED],
        [11, Math.floor(t.m / 5), (i) => (i % 3 === 2 ? RED : YEL)],
        [4, t.m % 5, () => YEL]
      ];

      // Relay sag: the instant any row's lit-count changes, every lit lamp
      // dims briefly together, as if they share one straining power rail.
      rows.forEach(([, litCount], idx) => {
        if (prevLitCounts[idx] !== null && prevLitCounts[idx] !== litCount) sagT0 = now;
        prevLitCounts[idx] = litCount;
      });
      const sagMul = (now - sagT0) < 70 ? 0.95 : 1;

      const cg = u * 0.14;
      rows.forEach(([count, litCount, colorFn], rowIdx) => {
        rowHousing(ctx, x0 - u * 0.28, y - u * 0.16, rowW + u * 0.56, rowH + u * 0.32, u * 0.16);
        const cw = (rowW - (count - 1) * cg) / count;
        for (let i = 0; i < count; i++) {
          const trueColor = colorFn(i);
          const glow = lampGlow(`${rowIdx}:${i}`, i < litCount, trueColor, now, sagMul);
          lamp(ctx, x0 + i * (cw + cg), y, cw, rowH, u * 0.10, trueColor, glow.alpha, glow.color);
        }
        ctx.fillStyle = "rgba(255, 255, 255, 0.18)";
        ctx.font = `${u * 0.16}px "Segoe UI", sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(ROW_LABELS[rowIdx], x0 + rowW + u * 0.40, y + rowH / 2);
        y += rowH + gap;
      });

      // Tiny decode caption for anyone still learning to read it.
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.font = `500 ${Math.max(12, u * 0.22)}px "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(
        `${U.pad2(t.H)}:${U.pad2(t.m)}` + (settings.seconds ? `:${U.pad2(t.s)}` : ""),
        cx, y + u * 0.1
      );
    }
  });
})();
