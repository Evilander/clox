/* WORDGRID — word clock (QLOCKTWO-style). An 11×10 letter grid where the
 * current time lights up as a sentence ("IT IS HALF PAST TEN"), corner
 * dots for the +1..+4 minutes between five-minute steps. */
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
    const words = ["IT", "IS", t.pm ? "PM" : "AM"];
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

  CLOX.register({
    id: "wordgrid",
    name: "Wordgrid · Word Clock",

    draw(ctx, W, H, d, settings) {
      const t = U.timeParts(d, true);
      const { words, extraMin } = phrase(t);

      // Which cells are lit.
      const lit = new Set();
      for (const w of words) {
        const [r, c0, len] = W_[w];
        for (let i = 0; i < len; i++) lit.add(r * 11 + c0 + i);
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

      ctx.font = `600 ${cell * 0.52}px "Segoe UI", system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 11; c++) {
          const x = gx + c * cell, y = gy + r * cell;
          if (lit.has(r * 11 + c)) {
            ctx.shadowColor = "rgba(255, 240, 210, 0.9)";
            ctx.shadowBlur = cell * 0.35;
            ctx.fillStyle = "#fff6e4";
            ctx.fillText(GRID[r][c], x, y);
            ctx.shadowBlur = 0;
          } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.09)";
            ctx.fillText(GRID[r][c], x, y);
          }
        }
      }

      // Corner minute dots (clockwise from top-left, QLOCKTWO convention).
      const inset = Math.min(W, H) * 0.035;
      const dotR = cell * 0.07;
      const corners = [
        [inset, inset], [W - inset, inset],
        [W - inset, H - inset], [inset, H - inset]
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

      // Optional seconds: a hairline progress line along the bottom edge.
      if (settings.seconds) {
        ctx.fillStyle = "rgba(255, 246, 228, 0.28)";
        ctx.fillRect(0, H - Math.max(2, H * 0.003), W * (t.fs / 60), Math.max(2, H * 0.003));
      }
    }
  });
})();
