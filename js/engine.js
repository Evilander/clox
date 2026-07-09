/* clox engine: render loop, resize/DPR handling, input, settings. */
"use strict";

(() => {
  const canvas = document.getElementById("clock");
  const ctx = canvas.getContext("2d");
  const toastEl = document.getElementById("toast");
  const hintEl = document.getElementById("hint");

  const SETTINGS_KEY = "clox.settings.v1";
  const CYCLE_MS = 2 * 60 * 1000;

  const settings = Object.assign(
    { faceId: null, h24: false, seconds: true, cycle: false },
    loadSettings()
  );

  let W = 0, H = 0;
  let faceIndex = 0;
  let lastCycle = performance.now();
  let toastTimer = null, hintTimer = null, cursorTimer = null;
  let wakeLock = null;

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; }
    catch { return {}; }
  }
  function saveSettings() {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    catch { /* file:// storage can be unavailable; run without persistence */ }
  }

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
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

  function setFace(i, announce = true) {
    const n = CLOX.faces.length;
    faceIndex = ((i % n) + n) % n;
    settings.faceId = CLOX.faces[faceIndex].id;
    saveSettings();
    lastCycle = performance.now();
    if (announce) toast(CLOX.faces[faceIndex].name);
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* user gesture / permission issues: ignore */ }
  }

  /* Keep the display awake while fullscreen — screensaver mode. */
  async function syncWakeLock() {
    try {
      if (document.fullscreenElement && !wakeLock && "wakeLock" in navigator) {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => { wakeLock = null; });
      } else if (!document.fullscreenElement && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
    } catch { wakeLock = null; }
  }

  function pokeCursor() {
    document.body.classList.remove("nocursor");
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(
      () => document.body.classList.add("nocursor"), 2500);
  }

  window.addEventListener("resize", resize);
  document.addEventListener("fullscreenchange", syncWakeLock);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") syncWakeLock();
  });
  window.addEventListener("mousemove", pokeCursor);
  canvas.addEventListener("click", toggleFullscreen);

  window.addEventListener("keydown", e => {
    switch (e.key) {
      case "ArrowRight": case " ": setFace(faceIndex + 1); break;
      case "ArrowLeft": setFace(faceIndex - 1); break;
      case "f": case "F": toggleFullscreen(); break;
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
      case "?": showHint(8000); break;
      default: return;
    }
    e.preventDefault();
  });

  function frame(now) {
    if (settings.cycle && now - lastCycle > CYCLE_MS) {
      setFace(faceIndex + 1, false);
    }
    const face = CLOX.faces[faceIndex];
    if (face) {
      const d = new Date();
      face.draw(ctx, W, H, d, settings, now);
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
    setFace(savedIdx >= 0 ? savedIdx : 0, false);
    showHint();
    pokeCursor();
    requestAnimationFrame(frame);
  });
})();
