/* WORDGRID — word clock (QLOCKTWO-style). An 11×10 letter grid where the
 * current time lights up as a sentence ("IT IS HALF PAST TEN"), letters
 * igniting in reading order as the phrase changes, corner dots for the
 * +1..+4 minutes between five-minute steps. */
"use strict";

(() => {
  const GRID = [
    "ITLISASAMPM",
    "ACQUARTERDC",
    "TWENTYFIVEX",
    "HALFSTENFTO",
    "PASTERUNINE",
    "ONESIXTHREE",
    "FOURFIVETWO",
    "EIGHTELEVEN",
    "SEVENTWELVE",
    "TENSEOCLOCK"
  ];

  // [row, startCol, length]
  const W_ = {
    IT: [0, 0, 2], IS: [0, 3, 2], AM: [0, 7, 2], PM: [0, 9, 2],
    A: [1, 0, 1], QUARTER: [1, 2, 7],
    TWENTY: [2, 0, 6], FIVE_M: [2, 6, 4],
    HALF: [3, 0, 4], TEN_M: [3, 5, 3], TO: [3, 9, 2],
    PAST: [4, 0, 4], NINE: [4, 7, 4],
    ONE: [5, 0, 3], SIX: [5, 3, 3], THREE: [5, 6, 5],
    FOUR: [6, 0, 4], FIVE_H: [6, 4, 4], TWO: [6, 8, 3],
    EIGHT: [7, 0, 5], ELEVEN: [7, 5, 6],
    SEVEN: [8, 0, 5], TWELVE: [8, 5, 6],
    TEN_H: [9, 0, 3], OCLOCK: [9, 5, 6]
  };
  const HOURS = [
    "TWELVE", "ONE", "TWO", "THREE", "FOUR", "FIVE_H", "SIX",
    "SEVEN", "EIGHT", "NINE", "TEN_H", "ELEVEN"
  ];

  function phrase(t) {
    const base = Math.floor(t.m / 5) * 5;
    const words = ["IT", "IS"];
    const MIN = {
      0: [], 5: ["FIVE_M", "PAST"], 10: ["TEN_M", "PAST"],
      15: ["A", "QUARTER", "PAST"], 20: ["TWENTY", "PAST"],
      25: ["TWENTY", "FIVE_M", "PAST"], 30: ["HALF", "PAST"],
      35: ["TWENTY", "FIVE_M", "TO"], 40: ["TWENTY", "TO"],
      45: ["QUARTER", "TO"], 50: ["TEN_M", "TO"], 55: ["FIVE_M", "TO"]
    };
    words.push(...MIN[base]);
    const hour = base <= 30 ? t.H : t.H + 1;
    words.push(HOURS[hour % 12]);
    if (base === 0) words.push("OCLOCK");
    return { words, extraMin: t.m - base };
  }

  // Per-cell ignition/cooldown state, plus a cache of the last-lit phrase so
  // stagger order is only recomputed when the sentence actually changes.
  let cellState = null;
  let prevLitSet = new Set();
  let lastPhraseKey = null;

  function cellK(cs, now) {
    const age = now - cs.t0 - cs.delay;
    if (cs.on) {
      if (age <= 0) return 0;
      if (age >= 160) return 1;
      return U.easeOutCubic(age / 160);
    }
    if (age <= 0) return 1;
    if (age >= 450) return 0;
    return 1 - age / 450;
  }

  /* Cooling tint: lerp from lit cream (#fff6e4) toward the dim baseline. */
  function cellColor(k) {
    const gc = Math.round(U.lerp(255, 246, k));
    const bc = Math.round(U.lerp(255, 228, k));
    const a = U.lerp(0.09, 1, k);
    return `rgba(255, ${gc}, ${bc}, ${a})`;
  }

  // Aperture plates: a faint rounded-square backing behind every cell,
  // static per viewport size — rendered once to an offscreen canvas.
  let plateCache = { key: "", canvas: null };
  function aperturePlates(W, H, cell, gx, gy) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const key = `${Math.round(W)}x${Math.round(H)}@${dpr}`;
    if (plateCache.key === key) return plateCache.canvas;
    const c = document.createElement("canvas");
    c.width = Math.max(2, Math.round(W * dpr));
    c.height = Math.max(2, Math.round(H * dpr));
    const g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.fillStyle = "rgba(255, 255, 255, 0.022)";
    const r = cell * 0.16, inset = cell * 0.06;
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col < 11; col++) {
        const x = gx + col * cell - cell / 2 + inset;
        const y = gy + row * cell - cell / 2 + inset;
        U.roundRect(g, x, y, cell - inset * 2, cell - inset * 2, r);
        g.fill();
      }
    }
    plateCache = { key, canvas: c };
    return c;
  }

  CLOX.register({
    id: "wordgrid",
    name: "Wordgrid · Word Clock",

    draw(ctx, W, H, d, settings, now) {
      const t = U.timeParts(d, true);
      const { words, extraMin } = phrase(t);

      const lit = new Set();
      for (const w of words) {
        const [r, c0, len] = W_[w];
        for (let i = 0; i < len; i++) lit.add(r * 11 + c0 + i);
      }

      // Ignition bookkeeping: only touch state when the sentence changes.
      const phraseKey = words.join(",");
      if (lastPhraseKey === null) {
        cellState = [];
        for (let i = 0; i < 110; i++) cellState.push({ on: lit.has(i), t0: -1e9, delay: 0 });
        prevLitSet = lit;
        lastPhraseKey = phraseKey;
      } else if (phraseKey !== lastPhraseKey) {
        const newlyLit = [];
        for (let i = 0; i < 110; i++) {
          if (lit.has(i) && !prevLitSet.has(i)) newlyLit.push(i);
        }
        newlyLit.forEach((i, rank) => {
          cellState[i] = { on: true, t0: now, delay: rank * 28 };
        });
        for (let i = 0; i < 110; i++) {
          if (!lit.has(i) && prevLitSet.has(i)) {
            cellState[i] = { on: false, t0: now, delay: 0 };
          }
        }
        prevLitSet = lit;
        lastPhraseKey = phraseKey;
      }

      // Near-black slate background.
      let g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, "#17181b");
      g.addColorStop(1, "#0b0c0e");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      const cell = Math.min((W * 0.72) / 11, (H * 0.84) / 10);
      const gx = (W - cell * 11) / 2 + cell / 2;
      const gy = (H - cell * 10) / 2 + cell / 2;

      ctx.drawImage(aperturePlates(W, H, cell, gx, gy), 0, 0, W, H);

      ctx.font = `600 ${cell * 0.52}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 11; c++) {
          const idx = r * 11 + c;
          const x = gx + c * cell, y = gy + r * cell;
          const k = cellK(cellState[idx], now);
          if (k > 0) {
            ctx.shadowColor = "rgba(255, 240, 210, 0.9)";
            ctx.shadowBlur = cell * 0.35 * k;
          } else {
            ctx.shadowBlur = 0;
          }
          ctx.fillStyle = cellColor(k);
          ctx.fillText(GRID[r][c], x, y);
        }
      }
      ctx.shadowBlur = 0;

      // AM / PM indicator below the grid — the active one lights up.
      ctx.font = `600 ${cell * 0.34}px "Segoe UI", system-ui, sans-serif`;
      const apY = gy + 10.0 * cell;
      [["AM", !t.pm, -cell * 0.85], ["PM", t.pm, cell * 0.85]].forEach(([lb, on, dx]) => {
        if (on) {
          ctx.shadowColor = "rgba(255, 240, 210, 0.9)";
          ctx.shadowBlur = cell * 0.25;
          ctx.fillStyle = "#fff6e4";
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
        }
        ctx.fillText(lb, W / 2 + dx, apY);
      });
      ctx.shadowBlur = 0;

      // Corner minute dots, pinned to the grid's own bounding box (clockwise
      // from top-left) rather than the viewport corners.
      const gLeft = gx - cell / 2, gTop = gy - cell / 2;
      const gRight = gLeft + cell * 11, gBottom = gTop + cell * 10;
      const dOff = cell * 0.9;
      const dotR = cell * 0.07;
      const corners = [
        [gLeft - dOff, gTop - dOff], [gRight + dOff, gTop - dOff],
        [gRight + dOff, gBottom + dOff], [gLeft - dOff, gBottom + dOff]
      ];
      corners.forEach(([x, y], i) => {
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, U.TAU);
        if (i < extraMin) {
          ctx.shadowColor = "rgba(255, 240, 210, 0.9)";
          ctx.shadowBlur = dotR * 3;
          ctx.fillStyle = "#fff6e4";
        } else {
          ctx.shadowBlur = 0;
          ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // Optional seconds: a hairline progress line directly under the grid.
      if (settings.seconds) {
        ctx.fillStyle = "rgba(255, 246, 228, 0.25)";
        ctx.fillRect(gLeft, gBottom + cell * 0.55, (cell * 11) * (t.fs / 60), Math.max(2, cell * 0.03));
      }
    }
  });
})();
