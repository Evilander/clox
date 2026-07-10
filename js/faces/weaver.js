/* WEAVER — an orb-weaver spider spins the time. Twelve silk spokes are
 * the hour ring (the current hour's spoke gleams); the capture spiral is
 * the minute hand: she lays exactly one segment per minute, 5 laps of 12
 * sectors, so the web's completeness IS the time. Dew condenses on the
 * silk every second and slides down the threads. On the hour a gust
 * tears her finished work loose and she patiently begins again.
 * The moon shows its real phase for today's date. */
"use strict";

(() => {
  const hash = (i) => {
    const x = Math.sin(i * 91.17 + 231.9) * 43758.5453;
    return x - Math.floor(x);
  };

  // ---- Cached night scene (sky, moon w/ true phase, branches, fence) ----
  let bg = { key: "", canvas: null };

  function buildBg(W, H, d) {
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(W));
    c.height = Math.max(2, Math.round(H));
    const g = c.getContext("2d");

    let gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, "#05070f");
    gr.addColorStop(0.55, "#0a0f1f");
    gr.addColorStop(1, "#121a2c");
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);

    // Static stars.
    for (let i = 0; i < 130; i++) {
      const a = 0.15 + hash(i + 900) * 0.5;
      g.fillStyle = `rgba(220, 230, 255, ${a})`;
      const s = hash(i + 77) < 0.12 ? 2 : 1;
      g.fillRect(hash(i) * W, hash(i + 300) * H * 0.75, s, s);
    }

    // Moon with the actual phase for today (synodic approximation),
    // composed on its own layer so the phase cut can't hole the sky.
    const mx = W * 0.82, my = H * 0.15, mr = Math.min(W, H) * 0.058;
    const days = (d.getTime() - 947182440000) / 86400000;   // new moon 2000-01-06
    const ph = (((days % 29.53058867) + 29.53058867) % 29.53058867) / 29.53058867;
    const lit = 0.5 - 0.5 * Math.cos(ph * U.TAU);           // illuminated fraction
    gr = g.createRadialGradient(mx, my, mr * 0.6, mx, my, mr * 4);
    gr.addColorStop(0, `rgba(220, 228, 255, ${0.06 + lit * 0.16})`);
    gr.addColorStop(1, "rgba(220, 228, 255, 0)");
    g.fillStyle = gr;
    g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    const mc = document.createElement("canvas");
    mc.width = mc.height = Math.ceil(mr * 2.2);
    const mg = mc.getContext("2d");
    const mcx = mc.width / 2;
    // Dark earthshine disc, then the lit face, then the phase shadow.
    mg.fillStyle = "#2a2d38";
    mg.beginPath();
    mg.arc(mcx, mcx, mr, 0, U.TAU);
    mg.fill();
    mg.save();
    mg.beginPath();
    mg.arc(mcx, mcx, mr, 0, U.TAU);
    mg.clip();
    gr = mg.createRadialGradient(mcx - mr * 0.3, mcx - mr * 0.3, 0, mcx, mcx, mr);
    gr.addColorStop(0, "#f2f0e2");
    gr.addColorStop(1, "#c9c8b8");
    mg.fillStyle = gr;
    mg.beginPath();
    mg.arc(mcx, mcx, mr, 0, U.TAU);
    mg.fill();
    mg.fillStyle = "rgba(120, 120, 110, 0.3)";
    for (const [ox, oy, orr] of [[-0.3, -0.15, 0.22], [0.25, 0.3, 0.16], [0.1, -0.4, 0.11]]) {
      mg.beginPath();
      mg.arc(mcx + ox * mr, mcx + oy * mr, orr * mr, 0, U.TAU);
      mg.fill();
    }
    // Shadow disc slides across with the phase (crescent approximation).
    const sdx = ph < 0.5 ? -4 * mr * ph : 4 * mr * (1 - ph);
    mg.fillStyle = "rgba(23, 26, 36, 0.96)";
    mg.beginPath();
    mg.arc(mcx + sdx, mcx, mr * 1.02, 0, U.TAU);
    mg.fill();
    mg.restore();
    g.drawImage(mc, mx - mcx, my - mcx);

    // Branch, upper-left — the web's high anchor.
    const limb = (x0, y0, x1, y1, w0, w1, leafN, seed) => {
      const nx = -(y1 - y0), ny = x1 - x0;
      const nl = Math.hypot(nx, ny) || 1;
      const px = nx / nl, py = ny / nl;
      const mxx = (x0 + x1) / 2 + px * H * 0.02, myy = (y0 + y1) / 2 + py * H * 0.02;
      g.fillStyle = "#0c0a08";
      g.beginPath();
      g.moveTo(x0 + px * w0, y0 + py * w0);
      g.quadraticCurveTo(mxx + px * w1, myy + py * w1, x1 + px * w1 * 0.4, y1 + py * w1 * 0.4);
      g.lineTo(x1 - px * w1 * 0.4, y1 - py * w1 * 0.4);
      g.quadraticCurveTo(mxx - px * w1, myy - py * w1, x0 - px * w0, y0 - py * w0);
      g.closePath();
      g.fill();
      // Moonlit rim along the top.
      g.strokeStyle = "rgba(170, 190, 230, 0.10)";
      g.lineWidth = Math.max(1, w0 * 0.15);
      g.beginPath();
      g.moveTo(x0 + px * w0 * 0.8, y0 + py * w0 * 0.8);
      g.quadraticCurveTo(mxx + px * w1, myy + py * w1, x1, y1);
      g.stroke();
      for (let i = 0; i < leafN; i++) {
        const tt = 0.3 + hash(seed + i) * 0.75;
        const lx = U.lerp(x0, x1, tt) + (hash(seed + i + 40) - 0.5) * H * 0.07;
        const ly = U.lerp(y0, y1, tt) + (hash(seed + i + 80) - 0.5) * H * 0.06 - H * 0.02;
        const lr = H * (0.018 + hash(seed + i + 20) * 0.03);
        g.fillStyle = `rgba(${18 + hash(seed + i) * 14 | 0}, ${26 + hash(seed + i + 3) * 16 | 0}, 22, 0.9)`;
        g.beginPath();
        g.arc(lx, ly, lr, 0, U.TAU);
        g.fill();
      }
    };
    limb(-W * 0.02, H * 0.045, W * 0.33, H * 0.16, H * 0.035, H * 0.012, 12, 11);
    limb(W * 1.02, H * 0.30, W * 0.84, H * 0.42, H * 0.028, H * 0.010, 9, 55);

    // Fence rail at the bottom — the web's low anchor.
    g.fillStyle = "#0e0c0a";
    g.fillRect(0, H * 0.895, W, H * 0.026);
    g.fillStyle = "rgba(170, 190, 230, 0.07)";
    g.fillRect(0, H * 0.895, W, Math.max(1, H * 0.003));
    g.fillStyle = "#0c0a08";
    for (let px = W * 0.1; px < W; px += W * 0.202) {
      g.fillRect(px, H * 0.885, W * 0.014, H * 0.115);
    }
    // Ground mist.
    gr = g.createLinearGradient(0, H * 0.80, 0, H);
    gr.addColorStop(0, "rgba(90, 110, 150, 0)");
    gr.addColorStop(1, "rgba(90, 110, 150, 0.09)");
    g.fillStyle = gr;
    g.fillRect(0, H * 0.80, W, H * 0.2);

    bg = { key: `${W}x${H}|${Math.floor(days)}`, canvas: c };
  }

  // ---- Web geometry, rebuilt each hour (every web is unique) ----
  let web = null;
  const segRadius = (R, L, k) => R * (0.32 + 0.13 * (L + k / 12));

  function buildWeb(W, H, hour) {
    const cx = W * 0.50, cy = H * 0.47, R = Math.min(W, H) * 0.40;
    const spokes = [];
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI / 2 + (i / 12) * U.TAU + (hash(hour * 31 + i) - 0.5) * 0.05;
      spokes.push({ a, ex: cx + Math.cos(a) * R * 1.02, ey: cy + Math.sin(a) * R * 1.02 });
    }
    const segs = [];
    for (let m = 0; m < 60; m++) {
      const L = Math.floor(m / 12), k = m % 12;
      const s0 = spokes[k], s1 = spokes[(k + 1) % 12];
      const r0 = segRadius(R, L, k), r1 = segRadius(R, L, k + 1);
      const p0 = [cx + Math.cos(s0.a) * r0, cy + Math.sin(s0.a) * r0];
      const p1 = [cx + Math.cos(s1.a) * r1, cy + Math.sin(s1.a) * r1];
      const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
      const sag = len * (0.10 * Math.abs((p1[0] - p0[0]) / (len || 1)) + 0.015);
      const cp = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 + sag];
      segs.push({ p0, cp, p1, len, downT: p0[1] > p1[1] ? 0 : 1 });
    }
    // Guy lines from the nearest spokes out to the scenery anchors.
    const anchors = [[W * 0.16, H * 0.115], [W * 0.855, H * 0.40], [W * 0.38, H * 0.90], [W * 0.66, H * 0.90]];
    const guys = anchors.map(an => {
      let best = spokes[0], bd = 1e18;
      for (const s of spokes) {
        const dd = (s.ex - an[0]) ** 2 + (s.ey - an[1]) ** 2;
        if (dd < bd) { bd = dd; best = s; }
      }
      return [[best.ex, best.ey], an];
    });
    web = { key: `${W}x${H}`, hour, cx, cy, R, spokes, segs, guys };
  }

  const segPoint = (s, t) => {
    const u = 1 - t;
    return [
      u * u * s.p0[0] + 2 * u * t * s.cp[0] + t * t * s.p1[0],
      u * u * s.p0[1] + 2 * u * t * s.cp[1] + t * t * s.p1[1]
    ];
  };

  // ---- Living state ----
  let laid = -1;                       // finished spiral segments (= minutes)
  let sp = { mode: "idle", seg: 0, t0: -1e9 };
  let gustT0 = -1e9, oldWeb = null, windDir = 1;
  let lastSec = -1;
  const dews = [], rings = [];
  let stepAcc = 0;

  const WALK_MS = 3000;

  function silkPath(ctx, s, cut = 1, off = null, flut = 0) {
    const N = 14;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * cut;
      let [x, y] = segPoint(s, t);
      if (off) {
        x += off[0] + Math.sin(t * 9 + off[2]) * flut;
        y += off[1] + Math.cos(t * 7 + off[2]) * flut * 0.7;
      }
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
  }

  function drawSpider(ctx, x, y, ang, gait, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + Math.PI / 2);          // body axis along travel
    ctx.lineCap = "round";
    // Legs: four pairs, arched, with a walking sway.
    ctx.strokeStyle = "#1a1512";
    ctx.lineWidth = Math.max(1, s * 0.10);
    for (const side of [-1, 1]) {
      for (let j = 0; j < 4; j++) {
        const base = side * (0.55 + j * 0.5) - Math.PI / 2;
        const swing = Math.sin(gait * U.TAU + j * 1.7 + (side > 0 ? 0 : Math.PI)) * 0.16;
        const len = s * (2.1 - j * 0.16);
        const kx = Math.cos(base + swing + side * 0.45) * len * 0.5;
        const ky = Math.sin(base + swing + side * 0.45) * len * 0.5 - s * 0.35;
        const tx = kx + Math.cos(base + swing - side * 0.25) * len * 0.55;
        const ty = ky + Math.sin(base + swing - side * 0.25) * len * 0.55 + s * 0.55;
        ctx.beginPath();
        ctx.moveTo(side * s * 0.28, -s * 0.15);
        ctx.lineTo(kx, ky);
        ctx.lineTo(tx, ty);
        ctx.stroke();
      }
    }
    // Abdomen (behind) with the orb-weaver's pale cross.
    let g = ctx.createRadialGradient(-s * 0.2, s * 0.55, 0, 0, s * 0.85, s * 1.05);
    g.addColorStop(0, "#4a3b2c");
    g.addColorStop(0.6, "#2c221a");
    g.addColorStop(1, "#17110c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, s * 0.85, s * 0.72, s * 0.95, 0, 0, U.TAU);
    ctx.fill();
    ctx.fillStyle = "rgba(225, 212, 170, 0.85)";
    for (const [ox, oy, rr] of [[0, 0.45, 0.10], [0, 0.85, 0.09], [0, 1.2, 0.07], [-0.3, 0.8, 0.08], [0.3, 0.8, 0.08]]) {
      ctx.beginPath();
      ctx.arc(ox * s, oy * s, rr * s, 0, U.TAU);
      ctx.fill();
    }
    // Cephalothorax (front).
    ctx.fillStyle = "#241b13";
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.35, s * 0.42, s * 0.5, 0, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  }

  CLOX.register({
    id: "weaver",
    name: "Weaver · Orb Spider",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, settings.h24);

      const bgKey = `${W}x${H}|${Math.floor((d.getTime() - 947182440000) / 86400000)}`;
      if (bg.key !== bgKey) buildBg(W, H, d);
      ctx.drawImage(bg.canvas, 0, 0, W, H);

      // Twinkling stars over the cached sky.
      for (let i = 0; i < 16; i++) {
        const tw = 0.5 + 0.5 * Math.sin(now * 0.0012 + i * 2.61);
        ctx.fillStyle = `rgba(230, 238, 255, ${0.5 * tw})`;
        ctx.fillRect(hash(i + 41) * W, hash(i + 61) * H * 0.7, 2, 2);
      }

      // ---- Web lifecycle ----
      if (web && web.key !== `${W}x${H}`) { buildWeb(W, H, t.H); }
      if (web && web.hour !== t.H && gustT0 < 0) {
        gustT0 = now;
        oldWeb = web;
        windDir = hash(t.H * 7.7) < 0.5 ? -1 : 1;
        web = null;
        sp = { mode: "hide", seg: 0, t0: now };
      }
      const gustAge = now - gustT0;
      if (!web && (gustT0 < 0 || gustAge > 1900)) {
        buildWeb(W, H, t.H);
        laid = gustT0 < 0 ? Math.max(0, t.m) : 0;   // cold entry: she's been busy
        sp = { mode: "idle", seg: Math.max(0, laid - 1), t0: now };
      }
      if (gustAge > 3400) { gustT0 = -1e9; oldWeb = null; }
      if (web && laid < t.m) laid = t.m;            // catch up after a hidden tab
      if (web && sp.mode === "idle" && laid <= t.m && laid < 60) {
        sp = { mode: "walk", seg: laid, t0: now };
      }
      if (sp.mode === "walk" && now - sp.t0 >= WALK_MS) {
        laid = Math.max(laid, sp.seg + 1);
        sp = { mode: "idle", seg: sp.seg, t0: now };
      }

      // Gentle breeze sway for everything silk.
      const swayX = Math.sin(now * 0.00042) * Math.min(W, H) * 0.004;
      const swayY = Math.sin(now * 0.00061 + 2) * Math.min(W, H) * 0.0025;

      ctx.save();
      ctx.translate(swayX, swayY);

      // Vibration rings (her steps, and the seconds ticking through silk).
      for (let i = rings.length - 1; i >= 0; i--) {
        const p = (now - rings[i].t0) / 900;
        if (p >= 1) { rings.splice(i, 1); continue; }
        ctx.save();
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(180, 200, 240, ${(1 - p) * 0.10})`;
        ctx.lineWidth = 2 + p * 6;
        ctx.beginPath();
        ctx.arc(rings[i].x, rings[i].y, p * (web ? web.R : 100) * 1.15, 0, U.TAU);
        ctx.stroke();
        ctx.restore();
      }

      const SILK = (a) => `rgba(205, 220, 250, ${a})`;

      // Old web tearing away in the gust.
      if (oldWeb) {
        ctx.lineWidth = 1;
        oldWeb.segs.forEach((s, i) => {
          const dl = i * 14 + hash(i + 5) * 350;
          const age = gustAge - dl;
          if (age < 0) {
            ctx.strokeStyle = SILK(0.42);
            silkPath(ctx, s);
            ctx.stroke();
          } else if (age < 1200) {
            const q = age / 1200;
            ctx.strokeStyle = SILK(0.42 * (1 - q));
            silkPath(ctx, s, 1, [windDir * q * q * W * 0.25, -q * H * 0.05 + q * q * H * 0.12, i], 6 + q * 14);
            ctx.stroke();
          }
        });
        oldWeb.spokes.forEach((s, i) => {
          const q = U.clamp((gustAge - 300) / 1400, 0, 1);
          ctx.strokeStyle = SILK(0.5 * (1 - q));
          ctx.beginPath();
          ctx.moveTo(oldWeb.cx, oldWeb.cy);
          ctx.quadraticCurveTo(
            (oldWeb.cx + s.ex) / 2 + windDir * q * 60 + Math.sin(now * 0.02 + i) * q * 18,
            (oldWeb.cy + s.ey) / 2 + q * 40, s.ex, s.ey);
          ctx.stroke();
        });
        if (!web) {
          // She clings to the hub while the gust takes her work.
          drawSpider(ctx,
            oldWeb.cx + Math.sin(now * 0.03) * 2.5,
            oldWeb.cy + Math.cos(now * 0.041) * 2,
            Math.PI / 2, (now * 0.004) % 1, Math.min(W, H) * 0.023);
        }
      }

      if (web) {
        const { cx, cy, R, spokes, segs, guys } = web;

        // Guy lines out to the branches and fence.
        ctx.strokeStyle = SILK(0.30);
        ctx.lineWidth = 1;
        for (const [a, b] of guys) {
          ctx.beginPath();
          ctx.moveTo(a[0], a[1]);
          ctx.quadraticCurveTo((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + H * 0.012, b[0], b[1]);
          ctx.stroke();
        }

        // Spokes — the hour ring. Current hour gleams; the next warms up.
        const hourIdx = t.H % 12;
        spokes.forEach((s, i) => {
          const isNow = i === hourIdx;
          const pre = i === (hourIdx + 1) % 12 ? (t.m / 60) * 0.30 : 0;
          ctx.strokeStyle = SILK(0.34 + pre);
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(s.ex, s.ey);
          ctx.stroke();
          if (isNow) {
            ctx.save();
            ctx.shadowColor = "rgba(220, 235, 255, 0.7)";
            ctx.shadowBlur = 5;
            const gl = ctx.createLinearGradient(cx, cy, s.ex, s.ey);
            gl.addColorStop(0, "rgba(235, 245, 255, 0.10)");
            gl.addColorStop(1, "rgba(235, 245, 255, 0.55)");
            ctx.strokeStyle = gl;
            ctx.lineWidth = 1.4;
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(s.ex, s.ey);
            ctx.stroke();
            ctx.restore();
          }
        });

        // Hub coil.
        ctx.strokeStyle = SILK(0.30);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let a = 0; a < U.TAU * 3; a += 0.25) {
          const rr = R * (0.05 + (a / (U.TAU * 3)) * 0.13);
          const x = cx + Math.cos(a - Math.PI / 2) * rr;
          const y = cy + Math.sin(a - Math.PI / 2) * rr;
          a ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.stroke();

        // The spiral — one segment per minute.
        ctx.lineWidth = 1.1;
        for (let i = 0; i < Math.min(laid, 60); i++) {
          const fresh = U.clamp(1 - (laid - i) / 8, 0, 1);
          ctx.strokeStyle = SILK(0.40 + fresh * 0.25);
          silkPath(ctx, segs[i]);
          ctx.stroke();
        }
        // The segment she is laying right now, glowing behind her.
        let spx, spy, spAng = 0, gait = 0;
        if (sp.mode === "walk") {
          const p = U.easeInOutCubic(U.clamp((now - sp.t0) / WALK_MS, 0, 1));
          const s = segs[sp.seg];
          ctx.save();
          ctx.shadowColor = "rgba(220, 235, 255, 0.8)";
          ctx.shadowBlur = 6;
          ctx.strokeStyle = SILK(0.8);
          silkPath(ctx, s, p);
          ctx.stroke();
          ctx.restore();
          [spx, spy] = segPoint(s, p);
          const [ax, ay] = segPoint(s, Math.min(1, p + 0.04));
          spAng = Math.atan2(ay - spy, ax - spx);
          gait = (now * 0.006) % 1;
          stepAcc += 16;
          if (stepAcc > 420) {           // her steps ring through the web
            stepAcc = 0;
            rings.push({ x: spx, y: spy, t0: now });
          }
        } else if (sp.mode === "hide") {
          spx = cx; spy = cy;            // she rides out the gust at the hub
          spAng = Math.PI / 2;
        } else {
          const s = segs[Math.max(0, Math.min(59, laid - 1 >= 0 ? laid - 1 : 0))];
          const anchorT = laid > 0 ? 1 : 0;
          [spx, spy] = segPoint(s, anchorT);
          const [bx, by] = segPoint(s, anchorT === 1 ? 0.92 : 0.08);
          spAng = Math.atan2(spy - by, spx - bx);
          spy += Math.sin(now * 0.0021) * 1.6;   // resting breath
        }

        // ---- Dew: seconds condensing on the silk ----
        if (t.s !== lastSec) {
          const every = settings.seconds ? 1 : 6;
          if (t.s % every === 0 && laid > 0 && dews.length < 14) {
            const idx = Math.max(0, laid - 1 - Math.floor(hash(t.m * 60 + t.s) * Math.min(laid, 16)));
            dews.push({ seg: idx, tp: 0.18 + hash(t.s * 7 + 3) * 0.64, t0: now, dur: 3200 + hash(t.s) * 1400 });
          }
          if (settings.seconds && web) {
            rings.push({ x: spx, y: spy, t0: now });
          }
          lastSec = t.s;
        }
        for (let i = dews.length - 1; i >= 0; i--) {
          const dew = dews[i];
          const s = segs[dew.seg];
          const age = now - dew.t0;
          const slide = U.clamp(age / dew.dur, 0, 1);
          let alpha = 0.9;
          let [dxp, dyp] = segPoint(s, U.lerp(dew.tp, s.downT, slide * slide));
          if (slide >= 1) {                       // falls off the thread
            const fall = (age - dew.dur) / 480;
            if (fall >= 1) { dews.splice(i, 1); continue; }
            dyp += fall * fall * 46;
            alpha = 0.9 * (1 - fall);
          }
          const tw2 = 0.7 + 0.3 * Math.sin(now * 0.004 + dew.seg);
          ctx.save();
          ctx.shadowColor = "rgba(210, 230, 255, 0.9)";
          ctx.shadowBlur = 7;
          ctx.fillStyle = `rgba(235, 244, 255, ${alpha * tw2})`;
          ctx.beginPath();
          ctx.arc(dxp, dyp, 2.1, 0, U.TAU);
          ctx.fill();
          ctx.strokeStyle = `rgba(235, 244, 255, ${alpha * tw2 * 0.5})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(dxp - 5, dyp); ctx.lineTo(dxp + 5, dyp);
          ctx.moveTo(dxp, dyp - 5); ctx.lineTo(dxp, dyp + 5);
          ctx.stroke();
          ctx.restore();
        }

        drawSpider(ctx, spx, spy, spAng, gait, Math.min(W, H) * 0.023);
      }

      ctx.restore();   // sway

      // Moths drifting in the moonlight.
      for (let i = 0; i < 2; i++) {
        const mx2 = W * (0.72 + 0.2 * Math.sin(now * 0.00013 + i * 4)) + Math.sin(now * 0.0011 + i) * W * 0.03;
        const my2 = H * (0.18 + 0.12 * Math.sin(now * 0.00021 + i * 2.6)) + Math.cos(now * 0.0009 + i * 3) * H * 0.02;
        const fl = Math.abs(Math.sin(now * 0.02 + i * 2));
        ctx.fillStyle = "rgba(216, 212, 190, 0.65)";
        ctx.beginPath();
        ctx.ellipse(mx2 - 3, my2, 3.4 * fl + 0.6, 2, 0.5, 0, U.TAU);
        ctx.ellipse(mx2 + 3, my2, 3.4 * fl + 0.6, 2, -0.5, 0, U.TAU);
        ctx.fill();
      }

      // Quiet decode line, in the house style of berlin/sundial.
      const hs = settings.h24 ? U.pad2(t.H) : String(t.h);
      const cap = `she weaves the hour — ${hs}:${U.pad2(t.m)}` +
        (settings.seconds ? `:${U.pad2(t.s)}` : "") +
        (settings.h24 ? "" : (t.pm ? " pm" : " am"));
      ctx.fillStyle = "rgba(200, 214, 240, 0.25)";
      ctx.font = `italic ${Math.max(13, H * 0.021)}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(cap, W / 2, H * 0.955);

      // Vignette.
      let g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.max(W, H) * 0.78);
      g.addColorStop(0, "rgba(0, 0, 0, 0)");
      g.addColorStop(1, "rgba(0, 0, 0, 0.5)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  });
})();
