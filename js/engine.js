/* clox engine: render loop, resize/DPR handling, input, settings,
 * face lifecycle, gallery overlay, crossfade, night dim, hourly chime. */
"use strict";

(() => {
  const canvas = document.getElementById("clock");
  const ctx = canvas.getContext("2d");
  const toastEl = document.getElementById("toast");
  const hintEl = document.getElementById("hint");
  const galleryButton = document.getElementById("gallery-button");
  const galleryDialog = document.getElementById("face-gallery");
  const galleryChoices = document.getElementById("gallery-buttons");
  const galleryClose = document.getElementById("gallery-close");

  const SETTINGS_KEY = "clox.settings.v1";
  const CYCLE_MS = 2 * 60 * 1000;
  const FADE_MS = 450;
  const DPR = () => Math.min(window.devicePixelRatio || 1, 2);

  const settings = Object.assign(
    { faceId: null, h24: false, seconds: true, cycle: false, dim: 0, chime: false },
    loadSettings()
  );

  /* URL params take one-time precedence over stored settings:
   * ?face=nixie&h24=1&seconds=0&cycle=1 — handy for kiosk shortcuts. */
  try {
    const q = new URLSearchParams(location.search);
    const flag = (v) => v === "1" || v === "true";
    if (q.has("face")) settings.faceId = q.get("face");
    if (q.has("h24")) settings.h24 = flag(q.get("h24"));
    if (q.has("seconds")) settings.seconds = flag(q.get("seconds"));
    if (q.has("cycle")) settings.cycle = flag(q.get("cycle"));
  } catch { /* no URL API? run with stored settings */ }

  const reducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let W = 0, H = 0;
  let faceIndex = 0, started = false;
  let lastCycle = performance.now();
  let toastTimer = null, hintTimer = null, cursorTimer = null;
  let wakeLock = null, wakeLockPending = false;

  // Crossfade state: a snapshot of the outgoing frame fades over the new face.
  const snap = document.createElement("canvas");
  const snapCtx = snap.getContext("2d");
  let fadeT0 = -1e9;

  // Gallery state.
  let galleryOn = false, galSel = 0, galTick = 0;
  let galleryReturnFocus = null;
  let tiles = { key: "", list: [], cols: 1, tw: 0, th: 0, pad: 0, top: 0, left: 0, labelH: 0 };

  // Chime state.
  let audio = null, lastChimeHour = null;

  const DIM_LEVELS = [0, 0.35, 0.65];
  const DIM_NAMES = ["off", "low", "high"];

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
    catch { return {}; }
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch { /* file:// storage can be unavailable; run without persistence */ }
  }

  function resize() {
    const dpr = DPR();
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tiles.key = "";                        // gallery grid must re-layout
  }

  function toast(msg, ms = 1800) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add("hidden"), ms);
  }

  function showHint(ms = 6000) {
    hintEl.classList.remove("hidden");
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => hintEl.classList.add("hidden"), ms);
  }

  /* Snapshot the presented frame so the next face can fade in over it. */
  function beginFade() {
    if (reducedMotion || !started) return;
    snap.width = canvas.width;
    snap.height = canvas.height;
    snapCtx.drawImage(canvas, 0, 0);
    fadeT0 = performance.now();
  }

  function setFace(i, announce = true, fade = true, persist = true) {
    const n = CLOX.faces.length;
    if (!n) return;
    const prev = started ? CLOX.faces[faceIndex] : null;
    const next = ((i % n) + n) % n;
    if (fade && next !== faceIndex) beginFade();
    faceIndex = next;
    settings.faceId = CLOX.faces[faceIndex].id;
    if (persist) saveSettings();         // boot skips this: URL params stay one-shot
    lastCycle = performance.now();
    const face = CLOX.faces[faceIndex];
    if (face.controls) {
      hintEl.classList.add("hidden");
      clearTimeout(hintTimer);
    }
    syncControls();
    if (face !== prev) {
      prev?.leave?.();
      face.enter?.();
    }
    if (announce) toast(face.name);
  }

  function syncControls() {
    const current = CLOX.faces[faceIndex];
    for (const face of CLOX.faces) {
      if (face.controls) face.controls.hidden = galleryOn || face !== current;
    }
    galleryButton.hidden = galleryOn || current?.id === "meridian";
    if (galleryOn) canvas.setAttribute("aria-label", "Clock face gallery. Use arrow keys to choose, Enter to select, and Escape to close.");
    else if (!current?.controls) canvas.setAttribute("aria-label", `${current?.name || "Clox"}. Press M for world time or G for the face gallery.`);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* user gesture / permission issues: ignore */ }
  }

  /* Keep the display awake while fullscreen — screensaver mode.
   * Guards against the exit-while-requesting race: re-check fullscreen
   * after the request resolves and release immediately if it's gone. */
  async function syncWakeLock() {
    if (wakeLockPending) return;
    try {
      if (document.fullscreenElement && !wakeLock && "wakeLock" in navigator) {
        wakeLockPending = true;
        const wl = await navigator.wakeLock.request("screen");
        wakeLockPending = false;
        if (!document.fullscreenElement) {
          await wl.release();
        } else {
          wakeLock = wl;
          wakeLock.addEventListener("release", () => { wakeLock = null; });
        }
      } else if (!document.fullscreenElement && wakeLock) {
        const wl = wakeLock;
        wakeLock = null;                 // clear first so a re-entry can acquire
        await wl.release();
        if (document.fullscreenElement && !wakeLock) syncWakeLock();
      }
    } catch { wakeLock = null; wakeLockPending = false; }
  }

  function pokeCursor() {
    document.body.classList.remove("nocursor");
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(
      () => document.body.classList.add("nocursor"), 2500);
  }

  // ---- Hourly chime: two soft sine tones, only while the tab is visible ----
  function chime() {
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const note = (freq, at, peak) => {
        const osc = audio.createOscillator();
        const gain = audio.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0, at);
        gain.gain.linearRampToValueAtTime(peak, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 1.4);
        osc.connect(gain).connect(audio.destination);
        osc.start(at);
        osc.stop(at + 1.5);
      };
      note(880, audio.currentTime, 0.08);
      note(660, audio.currentTime + 0.28, 0.10);
    } catch { /* audio unavailable — chime silently does nothing */ }
  }

  // ---- Gallery: a live wall of every face, one tile refreshed per frame ----
  function buildTiles() {
    const n = CLOX.faces.length;
    const key = `${W}x${H}x${n}`;
    if (tiles.key === key) return;
    const pad = Math.max(10, Math.round(Math.min(W, H) * 0.018));
    const labelH = Math.max(18, Math.round(H * 0.024));
    const cols = Math.max(2, Math.min(n, Math.ceil(Math.sqrt(n * W / Math.max(120, H - 80) / 1.6))));
    const rows = Math.ceil(n / cols);
    let tw = (W - pad * (cols + 1)) / cols;
    let th = tw * 0.625;
    const fitH = Math.max(24, (H - pad * 2 - 68) / rows - labelH - pad * 0.4);
    if (th > fitH) { th = fitH; tw = th / 0.625; }
    const gridW = cols * (tw + pad) - pad;
    const gridH = rows * (th + labelH + pad * 0.4) - pad * 0.4;
    const dpr = DPR();
    const list = [];
    for (let i = 0; i < n; i++) {
      const c = document.createElement("canvas");
      c.width = Math.max(2, Math.round(tw * dpr));
      c.height = Math.max(2, Math.round(th * dpr));
      list.push({ canvas: c, ctx: c.getContext("2d"), drawn: false });
    }
    tiles = {
      key, list, cols, tw, th, pad, labelH,
      left: (W - gridW) / 2,
      top: (H - 60 - gridH) / 2
    };
    if (galleryChoices.childElementCount !== n) {
      galleryChoices.replaceChildren();
      CLOX.faces.forEach((face, i) => {
        const button = document.createElement("button");
        button.type = "button";
        button.setAttribute("aria-label", face.name);
        button.addEventListener("click", () => closeGallery(i));
        button.addEventListener("focus", () => { galSel = i; });
        galleryChoices.append(button);
      });
    }
    [...galleryChoices.children].forEach((button, i) => {
      const { x, y } = tileRect(i);
      Object.assign(button.style, { left: `${x}px`, top: `${y}px`, width: `${tw}px`, height: `${th + labelH}px` });
    });
  }

  const tileRect = (i) => {
    const col = i % tiles.cols, row = Math.floor(i / tiles.cols);
    return {
      x: tiles.left + col * (tiles.tw + tiles.pad),
      y: tiles.top + row * (tiles.th + tiles.labelH + tiles.pad * 0.4)
    };
  };

  function drawGallery(d, now) {
    buildTiles();
    const n = CLOX.faces.length;

    // Refresh one tile per frame, round-robin — bounded cost, still alive.
    const i = galTick++ % n;
    const t = tiles.list[i];
    const dpr = DPR();
    try {
      t.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      CLOX.faces[i].draw(t.ctx, tiles.tw, tiles.th, d,
        Object.assign({}, settings, { preview: true }), now);
      t.drawn = true;
    } catch { /* a broken face shows as a dark tile rather than killing the loop */ }

    ctx.fillStyle = "#05060a";
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let k = 0; k < n; k++) {
      const { x, y } = tileRect(k);
      const tile = tiles.list[k];
      if (tile.drawn) {
        ctx.drawImage(tile.canvas, x, y, tiles.tw, tiles.th);
      } else {
        ctx.fillStyle = "#0c0e14";
        ctx.fillRect(x, y, tiles.tw, tiles.th);
      }
      if (k === galSel) {
        ctx.strokeStyle = "#ffd27a";
        ctx.lineWidth = 2.5;
        ctx.strokeRect(x - 1.5, y - 1.5, tiles.tw + 3, tiles.th + 3);
      } else {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x - 0.5, y - 0.5, tiles.tw + 1, tiles.th + 1);
      }
      if (k === faceIndex) {
        ctx.fillStyle = "#ffd27a";
        ctx.beginPath();
        ctx.arc(x + tiles.tw - 9, y + 9, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = k === galSel ? "rgba(255, 220, 150, 0.95)" : "rgba(255, 255, 255, 0.55)";
      ctx.font = `${k === galSel ? 600 : 400} ${Math.max(11, tiles.labelH * 0.55)}px "Segoe UI", sans-serif`;
      const label = W < 600 ? CLOX.faces[k].name.split(" · ")[0] : CLOX.faces[k].name;
      ctx.fillText(label, x + tiles.tw / 2, y + tiles.th + tiles.labelH * 0.55,
        tiles.tw * 0.96);
    }
  }

  function openGallery() {
    if (galleryOn) return;
    galleryReturnFocus = document.activeElement;
    galleryOn = true;
    buildTiles();
    galSel = faceIndex;
    galTick = faceIndex;
    syncControls();
    galleryDialog.showModal();
    galleryChoices.children[faceIndex].focus({ preventScroll: true });
  }
  CLOX.openGallery = openGallery;

  function closeGallery(pick) {
    galleryOn = false;
    galleryDialog.close();
    if (pick != null) setFace(pick);
    else { beginFade(); lastCycle = performance.now(); }
    syncControls();
    const returnTo = galleryReturnFocus;
    galleryReturnFocus = null;
    if (returnTo && returnTo !== document.body && returnTo.getClientRects().length) {
      returnTo.focus({ preventScroll: true });
    } else canvas.focus({ preventScroll: true });
  }

  // ---- Input ----
  galleryButton.addEventListener("click", openGallery);
  galleryClose.addEventListener("click", () => closeGallery(null));
  galleryDialog.addEventListener("cancel", e => { e.preventDefault(); closeGallery(null); });
  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", syncWakeLock);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncWakeLock();
  });
  window.addEventListener("mousemove", pokeCursor);

  // A persisted-on chime needs a user gesture before audio may start:
  // warm the AudioContext on the first interaction of the session.
  const warmAudio = () => {
    if (settings.chime) {
      try {
        audio = audio || new (window.AudioContext || window.webkitAudioContext)();
        if (audio.state === "suspended") audio.resume();
      } catch { /* stays silent until toggled */ }
    }
  };
  window.addEventListener("keydown", warmAudio, { once: false });
  canvas.addEventListener("click", warmAudio);

  canvas.addEventListener("click", toggleFullscreen);

  window.addEventListener("keydown", e => {
    if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
    if (galleryOn) {
      if (e.target === galleryClose) return;
      const n = CLOX.faces.length;
      switch (e.key) {
        case "ArrowRight": galSel = (galSel + 1) % n; break;
        case "ArrowLeft": galSel = (galSel + n - 1) % n; break;
        case "ArrowDown": galSel = Math.min(n - 1, galSel + tiles.cols); break;
        case "ArrowUp": galSel = Math.max(0, galSel - tiles.cols); break;
        case "Home": galSel = 0; break;
        case "End": galSel = n - 1; break;
        case "Enter": case " ": closeGallery(galSel); break;
        case "Escape": case "g": case "G": closeGallery(null); break;
        default: return;
      }
      if (galleryOn) galleryChoices.children[galSel].focus({ preventScroll: true });
      e.preventDefault();
      return;
    }
    if (e.target.closest?.("input, select, textarea, dialog, [contenteditable]:not([contenteditable='false'])")) return;
    if (e.target.closest?.("button") && (e.key === "Enter" || e.key === " ")) return;
    // Number keys jump straight to the first ten faces.
    if (e.key >= "0" && e.key <= "9") {
      const idx = e.key === "0" ? 9 : +e.key - 1;
      if (idx < CLOX.faces.length) { setFace(idx); e.preventDefault(); }
      return;
    }
    switch (e.key) {
      case "ArrowRight": case " ": setFace(faceIndex + 1); break;
      case "ArrowLeft": setFace(faceIndex - 1); break;
      case "f": case "F": toggleFullscreen(); break;
      case "g": case "G":
        openGallery();
        break;
      case "m": case "M": {
        const index = CLOX.faces.findIndex(face => face.id === "meridian");
        if (index !== -1) setFace(index);
        break;
      }
      case "s": case "S":
        settings.seconds = !settings.seconds; saveSettings();
        toast(`seconds ${settings.seconds ? "on" : "off"}`); break;
      case "h": case "H":
        settings.h24 = !settings.h24; saveSettings();
        toast(settings.h24 ? "24-hour" : "12-hour"); break;
      case "a": case "A":
        settings.cycle = !settings.cycle; saveSettings();
        lastCycle = performance.now();
        toast(`auto-cycle ${settings.cycle ? "on (2 min)" : "off"}`); break;
      case "n": case "N":
        settings.dim = (settings.dim + 1) % DIM_LEVELS.length; saveSettings();
        toast(`night dim ${DIM_NAMES[settings.dim]}`); break;
      case "b": case "B":
        settings.chime = !settings.chime; saveSettings();
        if (settings.chime) chime();       // audible confirmation unlocks audio
        toast(`hourly chime ${settings.chime ? "on" : "off"}`); break;
      case "p": case "P": {
        const face = CLOX.faces[faceIndex];
        const dd = new Date();
        const stamp = [dd.getHours(), dd.getMinutes(), dd.getSeconds()]
          .map(v => String(v).padStart(2, "0")).join("");
        canvas.toBlob(blob => {
          if (!blob) return;
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `clox-${face ? face.id : "face"}-${stamp}.png`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 5000);
        });
        toast("saved snapshot");
        break;
      }
      case "?": showHint(8000); break;
      default: return;
    }
    e.preventDefault();
  });

  // ---- Frame loop ----
  function frame(now) {
    const d = new Date();

    // Chime + title bookkeeping runs in every mode, gallery included.
    const hr = d.getHours();
    if (lastChimeHour === null) lastChimeHour = hr;
    else if (hr !== lastChimeHour) {
      lastChimeHour = hr;
      if (settings.chime && !document.hidden) chime();
    }
    if (d.getSeconds() !== frame.lastTitleSec) {
      frame.lastTitleSec = d.getSeconds();
      const hh = settings.h24 ? U.pad2(d.getHours()) : String(((d.getHours() % 12) || 12));
      document.title = `${hh}:${U.pad2(d.getMinutes())} — clox`;
    }

    if (galleryOn) {
      drawGallery(d, now);
      if (DIM_LEVELS[settings.dim]) {
        ctx.fillStyle = `rgba(0, 0, 0, ${DIM_LEVELS[settings.dim]})`;
        ctx.fillRect(0, 0, W, H);
      }
      requestAnimationFrame(frame);
      return;
    }

    if (CLOX.faces[faceIndex]?.busy?.()) lastCycle = now;
    if (settings.cycle && now - lastCycle > CYCLE_MS) {
      setFace(faceIndex + 1, false);
    }

    const face = CLOX.faces[faceIndex];
    if (face) face.draw(ctx, W, H, d, settings, now);

    // Crossfade the previous face's last frame over the new one.
    if (now - fadeT0 < FADE_MS) {
      const p = (now - fadeT0) / FADE_MS;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalAlpha = 1 - U.easeOutCubic(p);
      ctx.drawImage(snap, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }

    // Night dim: one compositor overlay, faces stay untouched.
    if (DIM_LEVELS[settings.dim]) {
      ctx.fillStyle = `rgba(0, 0, 0, ${DIM_LEVELS[settings.dim]})`;
      ctx.fillRect(0, 0, W, H);
    }

    requestAnimationFrame(frame);
  }

  document.addEventListener("DOMContentLoaded", () => {
    resize();
    if (!CLOX.faces.length) {
      document.body.style.color = "#f66";
      document.body.textContent = "clox: no faces registered — check script tags.";
      return;
    }
    const savedIdx = CLOX.faces.findIndex(f => f.id === settings.faceId);
    setFace(savedIdx >= 0 ? savedIdx : 0, false, false, false);   // fires enter() via prev=null
    started = true;
    if (!CLOX.faces[faceIndex].controls) showHint();
    pokeCursor();
    requestAnimationFrame(frame);
  });
})();
