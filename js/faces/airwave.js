/* An analog channel holding on to the time. Hourly snow follows wall time. */
"use strict";

(() => {
  const snowFrames = [];
  const screens = new Map();
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");

  function signal(date) {
    const inHour = (date.getMinutes() * 60 + date.getSeconds()) * 1000 + date.getMilliseconds();
    const tune = date.getTime() % 47000;
    return { snow: inHour < 2900, reveal: U.clamp((inHour - 1800) / 1100, 0, 1),
      glitch: tune < 180 || (tune > 530 && tune < 620), inHour };
  }
  CLOX.airwave = { signal };

  function snow(index) {
    if (snowFrames[index]) return snowFrames[index];
    const c = document.createElement("canvas"); c.width = 384; c.height = 216;
    const g = c.getContext("2d"), pixels = g.createImageData(c.width, c.height);
    let seed = (index + 1) * 982451653;
    for (let i = 0; i < pixels.data.length; i += 4) {
      seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
      const value = 28 + (seed >>> 0) % 145;
      pixels.data[i] = value; pixels.data[i + 1] = value + 3;
      pixels.data[i + 2] = value + 7; pixels.data[i + 3] = 255;
    }
    g.putImageData(pixels, 0, 0); snowFrames[index] = c; return c;
  }

  function screen(W, H, d, settings) {
    const key = settings.preview ? "preview" : "main";
    const t = U.timeParts(d, settings.h24);
    const stamp = `${W}:${H}:${t.H}:${t.m}:${settings.seconds ? t.s : 0}:${settings.h24}:${settings.seconds}:${d.toDateString()}`;
    const cached = screens.get(key);
    if (cached?.stamp === stamp) return cached.canvas;
    const c = cached?.canvas || document.createElement("canvas");
    const ratio = Math.min(window.devicePixelRatio || 1, 2, 3840 / W, 2160 / H);
    const pw = Math.max(1, Math.round(W * ratio)), ph = Math.max(1, Math.round(H * ratio));
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    const g = c.getContext("2d"); g.setTransform(ratio, 0, 0, ratio, 0, 0);
    const wash = g.createRadialGradient(W * 0.5, H * 0.48, 0, W * 0.5, H * 0.5, W * 0.65);
    wash.addColorStop(0, "#17252d"); wash.addColorStop(0.62, "#090f19"); wash.addColorStop(1, "#010207");
    g.fillStyle = wash; g.fillRect(0, 0, W, H);
    const s = Math.min(W / 1440, H / 810);
    g.textAlign = "left"; g.textBaseline = "alphabetic";
    g.font = `${27 * s}px 'Courier New', monospace`;
    g.fillStyle = "#9eacb1";
    g.fillText("CH 03", W * 0.075, H * 0.13);
    g.textAlign = "right"; g.fillText("STEREO", W * 0.925, H * 0.13);
    const str = `${U.pad2(t.h)}:${U.pad2(t.m)}${settings.seconds ? `:${U.pad2(t.s)}` : ""}`;
    g.textAlign = "center"; g.textBaseline = "middle";
    g.font = `bold ${Math.min(W / (str.length * 0.66) * 0.82, H * 0.24)}px 'Courier New', monospace`;
    g.fillStyle = "#ea506638"; g.fillText(str, W / 2 - s * 2.6, H * 0.49);
    g.fillStyle = "#64d1d53d"; g.fillText(str, W / 2 + s * 2.6, H * 0.49);
    g.shadowColor = "#cfddba66"; g.shadowBlur = 15 * s;
    g.fillStyle = "#dce4c8"; g.fillText(str, W / 2, H * 0.49);
    g.shadowBlur = 0;
    g.font = `${24 * s}px 'Courier New', monospace`;
    g.fillStyle = "#9da89b";
    g.fillText(`${U.DAYS[t.day]}  ${U.MONTHS[t.month]} ${U.pad2(t.date)}  ${d.getFullYear()}${settings.h24 ? "" : t.pm ? "    PM" : "    AM"}`, W / 2, H * 0.67);
    g.textAlign = "left"; g.fillStyle = "#69817a";
    g.fillText("SP  ▷", W * 0.075, H * 0.88);
    g.textAlign = "right"; g.fillText("AIRWAVE", W * 0.925, H * 0.88);
    g.fillStyle = "#00000024";
    for (let y = 0; y < H; y += Math.max(2, 3 * s)) g.fillRect(0, y, W, Math.max(0.6, s));
    screens.set(key, { stamp, canvas: c }); return c;
  }

  CLOX.register({
    id: "airwave", name: "Airwave · Analog Television",
    leave() { screens.clear(); snowFrames.length = 0; },
    draw(ctx, W, H, d, settings, now) {
      const state = signal(d), base = screen(W, H, d, settings);
      ctx.drawImage(base, 0, 0, W, H);
      const noise = snow(reduced.matches ? 0 : Math.floor(now / 85) % 6);
      ctx.save();
      if (state.snow && !reduced.matches) {
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = 1 - state.reveal;
        ctx.drawImage(noise, 0, 0, W, H);
        ctx.globalAlpha = (1 - state.reveal) * 0.4;
        const y = ((now / 350) % 1) * H;
        ctx.fillStyle = "#111319"; ctx.fillRect(0, y, W, H * 0.1);
        if (state.reveal > 0) {
          ctx.globalAlpha = state.reveal;
          const offset = Math.sin(now * 0.03) * W * 0.022 * (1 - state.reveal);
          ctx.drawImage(base, offset, 0, W, H);
        }
      } else if (state.glitch && !reduced.matches) {
        const y = H * (0.3 + 0.4 * Math.abs(Math.sin(d.getTime() * 0.0002)));
        ctx.beginPath(); ctx.rect(0, y, W, H * 0.055); ctx.clip();
        ctx.drawImage(base, W * 0.012, 0, W, H);
        ctx.globalAlpha = 0.18; ctx.drawImage(noise, 0, 0, W, H);
      } else {
        ctx.globalAlpha = 0.022; ctx.drawImage(noise, 0, 0, W, H);
      }
      ctx.restore();
    }
  });
})();
