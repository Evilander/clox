/* NOCTURNE — a lunar observatory. The sphere uses the bundled NASA LROC albedo.
 * Phase is an approximate mean synodic cycle, not a lunar ephemeris. */
"use strict";

(() => {
  const MONTH = 29.530588853, EPOCH = Date.UTC(2000, 0, 6, 18, 14);
  const TINT = [0.94, 0.98, 1.035];
  const spheres = new Map(), backgrounds = new Map();
  const texture = new Image();
  let pixels = null, textureW = 0, textureH = 0;
  texture.onload = () => {
    const c = document.createElement("canvas");
    c.width = textureW = texture.naturalWidth; c.height = textureH = texture.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(texture, 0, 0);
    pixels = g.getImageData(0, 0, textureW, textureH).data;
    spheres.clear();
  };
  texture.src = CLOX.moonTexture;

  function phase(d) {
    const age = (((d.getTime() - EPOCH) / 86400000) % MONTH + MONTH) % MONTH;
    const fraction = age / MONTH;
    const illumination = (1 - Math.cos(fraction * U.TAU)) / 2;
    const names = ["New moon", "Waxing crescent", "First quarter", "Waxing gibbous",
      "Full moon", "Waning gibbous", "Last quarter", "Waning crescent"];
    return { age, fraction, illumination, name: names[Math.round(fraction * 8) % 8] };
  }
  CLOX.nocturne = { phase };

  function sphere(size, d, preview) {
    size = Math.max(64, Math.min(1024, Math.ceil(size / 32) * 32));
    const key = preview ? "preview" : "main";
    const stamp = `${size}:${Math.floor(d.getTime() / 900000)}:${!!pixels}`;
    if (spheres.get(key)?.stamp === stamp) return spheres.get(key).canvas;
    const c = document.createElement("canvas"); c.width = c.height = size;
    const g = c.getContext("2d"), data = g.createImageData(size, size);
    const p = phase(d), lx = Math.sin(p.fraction * U.TAU), lz = -Math.cos(p.fraction * U.TAU);
    for (let y = 0; y < size; y++) {
      const ny = (y + 0.5) / size * 2 - 1;
      const latitude = Math.asin(ny);
      const ty = Math.min(textureH - 1, Math.max(0, Math.floor((0.5 + latitude / Math.PI) * textureH)));
      for (let x = 0; x < size; x++) {
        const nx = (x + 0.5) / size * 2 - 1, r2 = nx * nx + ny * ny;
        if (r2 > 1) continue;
        const nz = Math.sqrt(1 - r2);
        const longitude = Math.atan2(nx, nz);
        const tx = Math.min(textureW - 1, Math.max(0, Math.floor((0.5 + longitude / U.TAU) * textureW)));
        const source = (ty * textureW + tx) * 4, target = (y * size + x) * 4;
        const light = Math.max(0, nx * lx + nz * lz);
        // Earthshine leaves a quiet trace of the maria on the unlit hemisphere.
        const shade = (0.072 + 1.22 * Math.pow(light, 0.48)) * (0.78 + 0.22 * nz);
        for (let channel = 0; channel < 3; channel++) {
          const albedo = pixels ? pixels[source + channel] : 154;
          data.data[target + channel] = Math.min(255, albedo * shade * TINT[channel]);
        }
        data.data[target + 3] = Math.min(255, (1 - Math.sqrt(r2)) * size * 255);
      }
    }
    g.putImageData(data, 0, 0);
    spheres.set(key, { stamp, canvas: c }); return c;
  }

  function text(g, value, x, y, size, color = "#e1dfd3", align = "left", font = "'Segoe UI', sans-serif") {
    g.font = `${size}px ${font}`; g.fillStyle = color;
    g.textAlign = align; g.textBaseline = "alphabetic"; g.fillText(value, x, y);
  }
  function circle(g, x, y, r, color, width = 1) {
    g.beginPath(); g.arc(x, y, r, 0, U.TAU); g.strokeStyle = color; g.lineWidth = width; g.stroke();
  }

  function background(W, H, preview) {
    const key = preview ? "preview" : "main";
    const ratio = Math.min(window.devicePixelRatio || 1, 2, 3840 / W, 2160 / H);
    const stamp = `${W}:${H}:${ratio}`;
    if (backgrounds.get(key)?.stamp === stamp) return backgrounds.get(key).canvas;
    const c = document.createElement("canvas"); c.width = Math.round(W * ratio); c.height = Math.round(H * ratio);
    const g = c.getContext("2d"); g.scale(ratio, ratio);
    const wash = g.createRadialGradient(W * 0.32, H * 0.46, 0, W * 0.38, H * 0.5, W * 0.78);
    wash.addColorStop(0, "#172833"); wash.addColorStop(0.38, "#0b1721"); wash.addColorStop(1, "#020609");
    g.fillStyle = wash; g.fillRect(0, 0, W, H);
    let seed = 517;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 430; i++) {
      const x = random() * W, y = random() * H, r = (0.18 + random() * 0.6) * Math.min(W / 1600, H / 900);
      g.fillStyle = `rgba(185,202,213,${0.08 + random() * 0.27})`;
      g.beginPath(); g.arc(x, y, Math.max(0.2, r), 0, U.TAU); g.fill();
    }
    backgrounds.set(key, { stamp, canvas: c }); return c;
  }

  function instrument(g, x, y, radius, t, settings) {
    g.save(); g.translate(x, y);
    const rim = g.createLinearGradient(-radius, -radius, radius, radius);
    rim.addColorStop(0, "#685b40"); rim.addColorStop(0.2, "#e3c789");
    rim.addColorStop(0.35, "#534b37"); rim.addColorStop(0.6, "#182026");
    rim.addColorStop(0.86, "#6b624d"); rim.addColorStop(1, "#b09b6e");
    circle(g, 0, 0, radius, rim, 5.5);
    circle(g, 0, 0, radius + 4.5, "#ffffff12", 0.8);
    circle(g, 0, 0, radius - 7, "#d2ba841f");
    circle(g, 0, 0, radius - 46, "#b8cbd414", 0.65);
    for (let i = 0; i < 120; i++) {
      const angle = i * U.TAU / 120 - Math.PI / 2, major = i % 10 === 0;
      const r0 = radius - 12, r1 = r0 - (major ? 17 : i % 5 === 0 ? 10 : 5);
      g.beginPath(); g.moveTo(Math.cos(angle) * r0, Math.sin(angle) * r0);
      g.lineTo(Math.cos(angle) * r1, Math.sin(angle) * r1);
      g.strokeStyle = major ? "#c8b181" : "#73848a66"; g.lineWidth = major ? 1.5 : 0.75; g.stroke();
      if (major) text(g, String(i === 0 ? 12 : i / 10), Math.cos(angle) * (radius - 39), Math.sin(angle) * (radius - 39) + 5, 13, "#c4bcaa", "center");
    }
    const points = [{ value: t.fh / 12, r: radius + 1, size: 6, color: "#e4c487" },
      { value: t.fm / 60, r: radius - 46, size: 4.5, color: "#a6c8d3" }];
    if (settings.seconds) points.push({ value: t.fs / 60, r: radius + 12, size: 2.1, color: "#e2e4d6" });
    for (const point of points) {
      const a = point.value * U.TAU - Math.PI / 2, px = Math.cos(a) * point.r, py = Math.sin(a) * point.r;
      g.shadowBlur = 12; g.shadowColor = point.color;
      g.fillStyle = point.color; g.beginPath(); g.arc(px, py, point.size, 0, U.TAU); g.fill(); g.shadowBlur = 0;
    }
    g.restore();
  }

  CLOX.register({
    id: "nocturne", name: "Nocturne · Lunar Observatory",
    leave() { backgrounds.clear(); spheres.clear(); },
    draw(ctx, W, H, d, settings) {
      ctx.drawImage(background(W, H, settings.preview), 0, 0, W, H);
      const portrait = H > W * 1.12;
      const rw = portrait ? 800 : 1600, rh = portrait ? 1380 : 900;
      const s = Math.min(W / rw, H / rh), ox = (W - rw * s) / 2, oy = (H - rh * s) / 2;
      const t = U.timeParts(d, settings.h24), p = phase(d);
      ctx.save(); ctx.translate(ox, oy); ctx.scale(s, s);
      text(ctx, "N O C T U R N E", 95, 95, 22, "#ddc696");
      text(ctx, "LUNAR OBSERVATORY", 95, 123, 10, "#7a919c");
      if (!portrait) text(ctx, `${U.DAYS[t.day]}  /  ${U.pad2(t.date)} ${U.MONTHS[t.month]} ${d.getFullYear()}`, 1505, 95, 14, "#8a9a9e", "right");
      const mx = portrait ? 400 : 480, my = portrait ? 475 : 475, r = 242;
      const halo = ctx.createRadialGradient(mx, my, r * 0.65, mx, my, r * 1.27);
      halo.addColorStop(0, "#b1cad508"); halo.addColorStop(0.8, "#b1cad509"); halo.addColorStop(1, "#b1cad500");
      ctx.fillStyle = halo; ctx.beginPath(); ctx.arc(mx, my, r * 1.27, 0, U.TAU); ctx.fill();
      const moon = sphere(r * 2 * s * Math.min(window.devicePixelRatio || 1, 2), d, settings.preview);
      ctx.drawImage(moon, mx - r, my - r, r * 2, r * 2);
      instrument(ctx, mx, my, 323, t, settings);
      const tx = portrait ? 105 : 930, ty = portrait ? 945 : 380;
      text(ctx, "LOCAL TIME", tx + 3, ty - 55, 12, "#879b9f");
      text(ctx, `${U.pad2(t.h)}:${U.pad2(t.m)}`, tx, ty + 57, 125, "#e3e3d8", "left", "'Segoe UI', Roboto, sans-serif");
      text(ctx, `${settings.seconds ? U.pad2(t.s) + "  /  " : ""}${settings.h24 ? "24 HOUR" : t.pm ? "PM" : "AM"}`, tx + 8, ty + 99, 17, "#a8b8b9");
      ctx.strokeStyle = "#9db4bd30"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(tx, ty + 139); ctx.lineTo(tx + 525, ty + 139); ctx.stroke();
      text(ctx, p.name, tx, ty + 200, 33, "#d5c19b", "left", "Georgia, serif");
      text(ctx, "ILLUMINATED", tx, ty + 251, 11, "#7b8e95");
      text(ctx, "LUNAR AGE", tx + 275, ty + 251, 11, "#7b8e95");
      text(ctx, `${Math.round(p.illumination * 100)}%`, tx, ty + 287, 26, "#becbc9");
      text(ctx, `${p.age.toFixed(1)} days`, tx + 275, ty + 287, 26, "#becbc9");
      if (!portrait) {
        text(ctx, "THE LUNATION", 170, 842, 10, "#7a9098");
        for (let i = 0; i <= 29; i++) {
          const x = 300 + i * 39;
          ctx.fillStyle = Math.abs(i - p.age) < 0.7 ? "#d6bd84" : "#5c76804d";
          ctx.beginPath(); ctx.arc(x, 838, Math.abs(i - p.age) < 0.7 ? 3.7 : 1.4, 0, U.TAU); ctx.fill();
        }
        text(ctx, "29.53 DAYS", 1505, 842, 10, "#7a9098", "right");
      }
      ctx.restore();
    }
  });
})();
