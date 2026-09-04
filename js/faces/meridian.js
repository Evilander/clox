/* MERIDIAN — four places on one turning Earth. Geography and daylight are
 * cached independently; moving through time never changes the live clock. */
"use strict";

(() => {
  const T = CLOX.worldTime, M = CLOX.meridian;
  const INK = "#0e1c23", PAPER = "#eadcbe", MUTED = "#a4aea7", BRASS = "#c8ad77";
  const COLORS = ["#e3bd7b", "#b1c8b0", "#db9c82", "#93bfd0"];
  const SERIF = "Georgia, 'Times New Roman', serif";
  const MONO = "Consolas, 'Courier New', monospace";
  const SANS = "'Segoe UI', system-ui, sans-serif";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const land = new Path2D();
  for (const ring of CLOX.land) {
    ring.forEach(([lon, lat], i) => i ? land.lineTo(lon, lat) : land.moveTo(lon, lat));
    land.closePath();
  }
  const maps = new Map(), timelines = new Map();
  let instantCache = { key: "" };

  function text(g, value, x, y, size, color = PAPER, family = SANS, align = "left") {
    g.fillStyle = color;
    g.font = `${size}px ${family}`;
    g.textAlign = align;
    g.textBaseline = "alphabetic";
    g.fillText(value, x, y);
  }

  function line(g, x1, y1, x2, y2, color, width = 1) {
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
    g.strokeStyle = color; g.lineWidth = width; g.stroke();
  }

  function dot(g, x, y, r, color) {
    g.beginPath(); g.arc(x, y, r, 0, U.TAU); g.fillStyle = color; g.fill();
  }

  function surface(w, h) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(w)); canvas.height = Math.max(1, Math.round(h));
    return canvas;
  }

  function mapBase(w, h, night) {
    const canvas = surface(w, h), g = canvas.getContext("2d");
    g.fillStyle = night ? "#0b1922" : "#1e3035"; g.fillRect(0, 0, w, h);
    g.save();
    g.translate(w / 2, h / 2); g.scale(w / 360, -h / 180);
    g.fillStyle = night ? "#455b65" : "#a18e66";
    g.fill(land, "evenodd");
    g.strokeStyle = night ? "#5d7377" : "#c4ae7d";
    g.lineWidth = 0.26; g.stroke(land);
    g.restore();
    for (let lon = -150; lon <= 150; lon += 30) {
      const x = (lon + 180) / 360 * w;
      line(g, x, 0, x, h, night ? "#71899520" : "#e3d5b223", Math.max(1, w / 1200));
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = (90 - lat) / 180 * h;
      line(g, 0, y, w, y, lat === 0 ? "#e3d5b243" : "#d7d2b51c", Math.max(1, w / 1200));
    }
    return canvas;
  }

  function shadedMap(w, h, date, preview) {
    const key = `${w}x${h}:${preview}`;
    let cache = maps.get(key);
    if (!cache) {
      cache = { day: mapBase(w, h, false), night: mapBase(w, h, true), image: surface(w, h), minute: null };
      // Full-size and gallery renderings need at most two independent caches.
      if (maps.size >= 2) maps.delete(maps.keys().next().value);
      maps.set(key, cache);
    }
    const minute = Math.floor(date.getTime() / 60000);
    if (cache.minute === minute) return cache.image;
    cache.minute = minute;
    const solar = T.sun(new Date(minute * 60000));
    const mask = surface(Math.min(720, w), Math.min(360, h));
    const m = mask.getContext("2d"), pixels = m.createImageData(mask.width, mask.height);
    const r = Math.PI / 180, sinDec = Math.sin(solar.lat * r), cosDec = Math.cos(solar.lat * r);
    const longitudes = Array.from({ length: mask.width }, (_, x) =>
      Math.cos(((x + 0.5) / mask.width * 360 - 180 - solar.lon) * r));
    for (let y = 0; y < mask.height; y++) {
      const lat = (90 - (y + 0.5) / mask.height * 180) * r;
      const a = Math.sin(lat) * sinDec, b = Math.cos(lat) * cosDec;
      for (let x = 0; x < mask.width; x++) {
        const elevationSin = a + b * longitudes[x];
        const t = U.clamp((0.07 - elevationSin) / 0.18, 0, 1);
        pixels.data[(y * mask.width + x) * 4 + 3] = Math.round(t * t * (3 - 2 * t) * 255);
      }
    }
    m.putImageData(pixels, 0, 0);
    const g = cache.image.getContext("2d");
    g.globalCompositeOperation = "copy"; g.drawImage(cache.night, 0, 0);
    g.globalCompositeOperation = "destination-in"; g.drawImage(mask, 0, 0, w, h);
    g.globalCompositeOperation = "destination-over"; g.drawImage(cache.day, 0, 0);
    g.globalCompositeOperation = "source-over";
    return cache.image;
  }

  function drawMap(g, rect, state, solar, scale, preview) {
    const { x, y, w, h } = rect;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const bitmapW = Math.max(2, Math.round(w * scale * dpr));
    const bitmapH = Math.max(2, Math.round(h * scale * dpr));
    g.drawImage(shadedMap(bitmapW, bitmapH, state.date, preview), x, y, w, h);
    g.strokeStyle = "#81908466"; g.lineWidth = 1; g.strokeRect(x, y, w, h);
    for (let lon = -180; lon <= 180; lon += 30) {
      const xx = x + (lon + 180) / 360 * w;
      line(g, xx, y - 5, xx, y, "#94a39a88");
      line(g, xx, y + h, xx, y + h + 5, "#94a39a88");
      if (w > 500 && lon > -180 && lon < 180) {
        text(g, lon === 0 ? "0°" : `${Math.abs(lon)}°${lon < 0 ? "W" : "E"}`, xx, y - 14, 10, MUTED, MONO, "center");
      }
    }
    const sx = x + (solar.lon + 180) / 360 * w, sy = y + (90 - solar.lat) / 180 * h;
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * U.TAU;
      line(g, sx + Math.cos(a) * 7, sy + Math.sin(a) * 7,
        sx + Math.cos(a) * 11, sy + Math.sin(a) * 11, "#f2dc9baa");
    }
    dot(g, sx, sy, 3.5, "#f7e2a9");
    g.restore();

    // Try several callout positions so close cities remain individually legible.
    const boxes = [];
    state.cities.forEach((city, i) => {
      const px = x + (city.lon + 180) / 360 * w, py = y + (90 - city.lat) / 180 * h;
      const value = w > 500 ? `${U.pad2(i + 1)}  ${city.name}` : U.pad2(i + 1);
      g.font = `12px ${SANS}`;
      const width = g.measureText(value).width + 16, height = 24;
      const candidates = [[12, -32], [12, 12], [-width - 12, -32], [-width - 12, 12], [12, -62], [12, 42]];
      let box;
      for (const [dx, dy] of candidates) {
        const b = { x: U.clamp(px + dx, x + 3, x + w - width - 3), y: U.clamp(py + dy, y + 3, y + h - height - 3), w: width, h: height };
        box = b;
        if (!boxes.some(a => a.x < b.x + b.w + 3 && a.x + a.w + 3 > b.x && a.y < b.y + b.h + 3 && a.y + a.h + 3 > b.y)) break;
      }
      boxes.push(box);
      line(g, px, py, U.clamp(px, box.x, box.x + box.w), U.clamp(py, box.y, box.y + box.h), COLORS[i], 1);
      dot(g, px, py, 5, INK); dot(g, px, py, 2.6, COLORS[i]);
      g.fillStyle = "#101f27e8"; g.fillRect(box.x, box.y, box.w, box.h);
      text(g, value, box.x + 8, box.y + 16, 12, COLORS[i]);
    });
  }

  function cityReadout(g, city, p, i, x, y, width, ref, solar, settings, compact, portrait) {
    const clockSize = portrait ? 39 : compact ? 40 : 63;
    dot(g, x + 4, y - 5, 3, COLORS[i]);
    text(g, city.name, x + 17, y, portrait || compact ? 17 : 20, PAPER);
    if (!portrait) text(g, T.light(city.lat, city.lon, solar).toUpperCase(), x + width, y - 1, 10, COLORS[i], MONO, "right");
    const value = T.clock(p, settings.h24);
    text(g, value, x, y + clockSize + 1, clockSize, PAPER, SERIF);
    const end = x + g.measureText(value).width;
    const seconds = settings.seconds ? `:${U.pad2(p.second)}` : "";
    const period = settings.h24 ? "" : p.hour >= 12 ? "PM" : "AM";
    text(g, seconds, end + 4, y + clockSize, portrait ? 16 : 22, BRASS, MONO);
    text(g, period, end + 7, y + clockSize - (settings.seconds ? 20 : 0), 10, MUTED, MONO);
    const diff = T.dayDifference(p, ref);
    const dateText = `${p.weekday.toUpperCase()} ${U.pad2(p.day)} ${U.MONTHS[p.month - 1]}`;
    text(g, dateText, x, y + clockSize + 23, 11, MUTED, MONO);
    if (diff) text(g, `${diff > 0 ? "+" : ""}${diff} DAY`, x + width, y + clockSize + 23, 10, COLORS[i], MONO, "right");
    else if (!portrait) text(g, T.offsetLabel(p.offsetMinutes), x + width, y + clockSize + 23, 11, MUTED, MONO, "right");
  }

  function getTimelines(state) {
    const key = `${state.start}:${state.cities.map(c => c.id).join()}`;
    if (!timelines.has(key)) {
      if (timelines.size >= 2) timelines.delete(timelines.keys().next().value);
      timelines.set(key, state.cities.map(city => T.timeline(city, state.start)));
    }
    return timelines.get(key);
  }

  function drawTimelines(g, state, now, portrait, compact) {
    const x = portrait ? 28 : 64, headingY = portrait ? 652 : compact ? 506 : 716;
    const trackX = portrait ? 105 : 190, trackW = portrait ? 307 : 1186;
    const top = portrait ? 690 : compact ? 536 : 752;
    const rowH = compact ? 18 : 23, barH = compact ? 14 : 18;
    text(g, "24 hours together", x, headingY, portrait ? 23 : 26, PAPER, SERIF);
    if (!portrait) {
      dot(g, 1002, headingY - 5, 4, "#ad976a"); text(g, "Daylight", 1013, headingY, 12, MUTED);
      dot(g, 1090, headingY - 5, 4, "#4a6470"); text(g, "Night", 1101, headingY, 12, MUTED);
      g.strokeStyle = "#cad0b59c"; g.lineWidth = 1; g.strokeRect(1180, headingY - 10, 10, 8);
      text(g, "09–17 local", 1200, headingY, 12, MUTED);
    } else {
      text(g, "Light = daylight · outline = 09–17 local", x, headingY + 20, 10, MUTED);
    }
    const tracks = getTimelines(state), cellW = trackW / 96;
    tracks.forEach((cells, row) => {
      const y = top + row * rowH;
      text(g, state.cities[row].name, x, y + barH * 0.76, portrait ? 10 : 12, COLORS[row]);
      cells.forEach((cell, i) => {
        const blend = U.clamp((cell.elevation + 6) / 12, 0, 1);
        const a = [37, 59, 72], b = [153, 131, 86];
        g.fillStyle = `rgb(${a.map((v, k) => Math.round(U.lerp(v, b[k], blend))).join(",")})`;
        g.fillRect(trackX + i * cellW, y, cellW + 0.3, barH);
        if (cell.office) {
          line(g, trackX + i * cellW, y + 1.5, trackX + (i + 1) * cellW, y + 1.5, "#e9e3c6aa");
          line(g, trackX + i * cellW, y + barH - 1.5, trackX + (i + 1) * cellW, y + barH - 1.5, "#e9e3c6aa");
          if (!cells[i - 1]?.office) line(g, trackX + i * cellW, y + 1.5, trackX + i * cellW, y + barH - 1.5, "#e9e3c6aa");
          if (!cells[i + 1]?.office) line(g, trackX + (i + 1) * cellW, y + 1.5, trackX + (i + 1) * cellW, y + barH - 1.5, "#e9e3c6aa");
        }
      });
      for (let i = 0; i < 96; i += portrait ? 24 : 12) {
        const p = cells[i], xx = trackX + i * cellW;
        line(g, xx, y, xx, y + barH, "#0e1c23aa");
        text(g, `${U.pad2(p.hour)}${p.minute ? `:${U.pad2(p.minute)}` : ""}`, xx + 5, y + barH * 0.76, portrait ? 10 : compact ? 10 : 11, "#faf0d6", MONO);
      }
    });
    const xx = trackX + U.clamp((state.date.getTime() - state.start) / T.DAY, 0, 1) * trackW;
    line(g, xx, top - 10, xx, top + rowH * 3 + barH + 6, "#fff0c7", 1.5);
    g.beginPath(); g.moveTo(xx - 4, top - 11); g.lineTo(xx + 4, top - 11); g.lineTo(xx, top - 5);
    g.fillStyle = "#fff0c7"; g.fill();
    if (!state.live) {
      const realX = trackX + (now.getTime() - state.start) / T.DAY * trackW;
      if (realX >= trackX && realX <= trackX + trackW) {
        dot(g, realX, top + rowH * 3 + barH + 7, 2, "#b1c8b0");
        text(g, "NOW", realX, top + rowH * 3 + barH + 21, 9, MUTED, MONO, "center");
      }
    }
    text(g, "24-HOUR SCALE", trackX + trackW, top - 15, 9, MUTED, MONO, "right");
  }

  CLOX.register({
    id: "meridian", name: "Meridian · World Time", controls: M.controls,
    enter: M.enter, leave: M.leave, busy: M.busy,
    draw(g, W, H, now, settings) {
      const portrait = W / H < 1.05, compact = !portrait && W / H > 2;
      const vw = portrait ? 440 : 1440, vh = portrait ? 900 : compact ? 720 : 960;
      const scale = Math.min(W / vw, H / vh), ox = (W - vw * scale) / 2, oy = (H - vh * scale) / 2;
      const state = M.snapshot(now, !!settings.preview);
      const key = `${Math.floor(state.date.getTime() / 1000)}:${state.cities.map(c => c.id).join()}`;
      if (instantCache.key !== key) instantCache = { key, parts: state.cities.map(c => T.at(state.date, c.zone)), solar: T.sun(state.date) };
      const { parts, solar } = instantCache;
      g.save();
      g.globalAlpha = 1; g.shadowBlur = 0; g.globalCompositeOperation = "source-over";
      g.fillStyle = INK; g.fillRect(0, 0, W, H);
      const glow = g.createRadialGradient(W * 0.35, H * 0.38, 0, W * 0.35, H * 0.38, W * 0.75);
      glow.addColorStop(0, "#26393870"); glow.addColorStop(1, "#07151d00");
      g.fillStyle = glow; g.fillRect(0, 0, W, H);
      g.translate(ox, oy); g.scale(scale, scale);
      const margin = portrait ? 28 : 64;
      text(g, "C L O X   /   A T L A S", margin, portrait ? 32 : 44, 10, BRASS, MONO);
      text(g, "Meridian", margin - 2, portrait ? 83 : 108, portrait ? 51 : 68, PAPER, SERIF);
      if (!portrait) text(g, "WORLD TIME", 360, 107, 11, MUTED, MONO);
      const utc = `${U.pad2(state.date.getUTCHours())}:${U.pad2(state.date.getUTCMinutes())}`;
      const utcX = portrait ? 412 : 1376, utcY = portrait ? 59 : 118;
      text(g, `${utc}${settings.seconds ? `:${U.pad2(state.date.getUTCSeconds())}` : ""}`, utcX, utcY, portrait ? 17 : 25, PAPER, MONO, "right");
      text(g, state.live ? "UTC / LIVE" : "UTC / EXPLORING", utcX, utcY + 20, 10, state.live ? MUTED : BRASS, MONO, "right");
      if (settings.seconds) {
        const fraction = (state.date.getUTCSeconds() + (reduced.matches ? 0 : state.date.getUTCMilliseconds() / 1000)) / 60;
        line(g, utcX - 108, utcY + 27, utcX, utcY + 27, "#8e947c33");
        line(g, utcX - 108, utcY + 27, utcX - 108 + fraction * 108, utcY + 27, BRASS);
      }
      const map = portrait ? { x: 26, y: 175, w: 388, h: 194 } : compact ?
        { x: 64, y: 136, w: 680, h: 340 } : { x: 64, y: 202, w: 900, h: 450 };
      drawMap(g, map, state, solar, scale, !!settings.preview);
      const ns = `${Math.abs(solar.lat).toFixed(1)}°${solar.lat < 0 ? "S" : "N"}`;
      const ew = `${Math.abs(solar.lon).toFixed(1)}°${solar.lon < 0 ? "W" : "E"}`;
      if (!compact) {
        text(g, `SUN OVER ${ns}  ${ew}`, map.x, map.y + map.h + 29, portrait ? 10 : 11, BRASS, MONO);
        if (!portrait) text(g, "NATURAL EARTH / 1:110m", map.x + map.w, map.y + map.h + 29, 10, MUTED, MONO, "right");
      }
      parts.forEach((p, i) => {
        const x = portrait ? 28 + (i % 2) * 208 : compact ? 842 : 1032;
        const y = portrait ? 435 + Math.floor(i / 2) * 104 : compact ? 149 + i * 85 : 208 + i * 121;
        cityReadout(g, state.cities[i], p, i, x, y, portrait ? 177 : compact ? 534 : 344, parts[0], solar, settings, compact, portrait);
        if (portrait) line(g, x, y + 80, x + 177, y + 80, "#7e8f8138");
        else if (i < 3) line(g, x, y + (compact ? 77 : 104), 1376, y + (compact ? 77 : 104), "#7e8f8138");
      });
      drawTimelines(g, state, now, portrait, compact);
      if (!portrait) text(g, "MERIDIAN", margin, compact ? 683 : 920, 10, BRASS, MONO);
      g.restore();
      if (!settings.preview) { M.settings(settings); M.layout(scale, ox, oy, portrait, compact); }
    }
  });
})();
