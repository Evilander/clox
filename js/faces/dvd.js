/* The DVD VIDEO idle screen: black, a drifting logo, a new color at each wall.
 * Logo geometry: DVD FLLC, via commons.wikimedia.org/wiki/File:DVD-Video_Logo.svg. */
"use strict";

(() => {
  const colors = ["#39d8f0", "#ec58cc", "#f6cf39", "#75ed56", "#9270ff", "#ff7649"];
  const logo = new Path2D("M469.9 212.1h-14.7l-.4 2.2h6.2l-2.2 17.3h2.6l2.3-17.3h5.7zM480.1 224.9l-3.1-12.8h-1.8l-6.7 19.5h2.2l5.4-15.1 3.1 15.1 8-15.1v15.1h2.6v-19.5h-2.6zM76.2 282.1 59 249.7H44.3l27.1 49.7h8.4l27.5-49.7H92.2zM141 275.4v24h13.3v-49.7H141zM285 299.4h36.8V291h-23v-13.3h21.7v-8.5h-21.7v-11h23v-8.5H285zM472 188.1c0-18.6-105.6-33.7-236-33.7S0 169.5 0 188.1s105.7 33.7 236 33.7 236-15 236-33.7zm-298.7.5c0-6.2 24.2-11.1 54.1-11.1s54 5 54 11-24.1 11.1-54 11.1-54-5-54-11zM392.3 249.5c-19.3 0-35 11.1-35 24.8s15.7 24.8 35 24.8 35-11 35-24.8c0-13.7-15.7-24.8-35-24.8zm0 40.6c-11.5 0-20.8-7-20.8-15.8 0-8.7 9.3-15.7 20.8-15.7s20.8 7 20.8 15.7-9.3 15.8-20.8 15.8zM214.8 249.7h-21v49.7h21s33.4 0 33.4-24.6-33.4-25-33.4-25zm-7 41.2v-32.7s26.2-1.7 26.2 16.5c0 18.1-26.1 16.2-26.1 16.2zM192 54.3a78 78 0 0 0-4-26.2h1.7L234.5 154 344.5 28h59.3S450 26.8 450 56.5s-38.4 41.2-63 41.2h-10.6l13.8-59.4h-48.3l-20.4 86.4h65.8c63 0 112.8-34.6 112.8-70.4C500 1.3 418.9.6 418.9.6h-102l-64.7 81.6L227 .6H43l-6.7 27.5h61.5c8.7.2 44 2.4 44 28.4 0 29.7-38.4 41.2-62.9 41.2H68.3L82 38.3H33.7l-20.4 86.4h65.8c63 0 112.8-34.6 112.8-70.4z");
  const states = new Map();

  function advance(state, dt, maxX, maxY) {
    state.x += state.vx * dt;
    state.y += state.vy * dt;
    let hit = false;
    if (state.x < 0 || state.x > maxX) {
      state.x = U.clamp(state.x < 0 ? -state.x : 2 * maxX - state.x, 0, maxX);
      state.vx *= -1; hit = true;
      // A near miss: turn away before the second wall can complete a corner hit.
      if (state.y < maxY * 0.025) { state.y = maxY * 0.025; state.vy = Math.abs(state.vy); }
      if (state.y > maxY * 0.975) { state.y = maxY * 0.975; state.vy = -Math.abs(state.vy); }
    }
    if (state.y < 0 || state.y > maxY) {
      state.y = U.clamp(state.y < 0 ? -state.y : 2 * maxY - state.y, 0, maxY);
      state.vy *= -1; hit = true;
      if (state.x < maxX * 0.025) { state.x = maxX * 0.025; state.vx = Math.abs(state.vx); }
      if (state.x > maxX * 0.975) { state.x = maxX * 0.975; state.vx = -Math.abs(state.vx); }
    }
    if (hit) state.color = (state.color + 1) % colors.length;
    return state;
  }

  function countdown(date) {
    return 3600 - date.getMinutes() * 60 - date.getSeconds();
  }
  CLOX.dvdClock = { advance, countdown };

  CLOX.register({
    id: "dvd", name: "DVD · The Idle Screen",
    leave() { states.clear(); },
    draw(ctx, W, H, d, settings, now) {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      const w = Math.min(W * 0.22, H * 0.38), h = w * 0.96;
      const maxX = W - w, maxY = H - h;
      const key = settings.preview ? "preview" : "main";
      let state = states.get(key);
      if (!state || state.W !== W || state.H !== H) {
        const speed = Math.min(W, H) * 0.057;
        state = { x: maxX * 0.31, y: maxY * 0.39, vx: speed, vy: speed * 0.817,
          W, H, now, color: 0 };
        states.set(key, state);
      }
      let elapsed = Math.max(0, Math.min((now - state.now) / 1000, settings.preview ? 2 : 0.15));
      while (elapsed > 0) {
        const step = Math.min(elapsed, 0.1);
        advance(state, step, maxX, maxY); elapsed -= step;
      }
      state.now = now;
      const color = colors[state.color];
      ctx.save(); ctx.translate(state.x, state.y);
      ctx.fillStyle = color;
      ctx.save(); ctx.scale(w / 500, w / 500); ctx.fill(logo, "evenodd"); ctx.restore();
      const t = U.timeParts(d, settings.h24);
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `600 ${w * 0.118}px 'Courier New', monospace`;
      ctx.fillText(`${U.pad2(t.h)}:${U.pad2(t.m)}${settings.seconds ? `:${U.pad2(t.s)}` : ""}${settings.h24 ? "" : t.pm ? " PM" : " AM"}`, w / 2, w * 0.75);
      const left = countdown(d);
      ctx.globalAlpha = 0.65;
      ctx.font = `${w * 0.052}px 'Courier New', monospace`;
      ctx.fillText(`${U.pad2(Math.floor(left / 60))}:${U.pad2(left % 60)} TO THE NEXT HOUR`, w / 2, w * 0.90);
      ctx.restore();
    }
  });
})();
