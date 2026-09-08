/* Remote control for the native TV app and the ?tv=1 browser preview. */
"use strict";

(() => {
  const engine = CLOX.engine;
  if (!engine.settings.tv) return;
  document.body.classList.add("tv");
  const menu = document.getElementById("tv-menu");
  const cityDialog = document.getElementById("tv-cities");
  const cityChoices = document.getElementById("tv-city-choices");
  const done = document.getElementById("tv-cities-done");
  const actions = [...menu.querySelectorAll("button")];
  const cities = [...CLOX.worldTime.cities].sort((a, b) => a.name.localeCompare(b.name));
  let pendingCities = [];

  document.getElementById("hint").textContent =
    "◀ / ▶  Change clock    ·    OK  Collection    ·    ☰  Settings    ·    ▶Ⅱ  Auto-cycle";

  function refresh() {
    const s = engine.settings;
    const values = { cycle: s.cycle ? "On" : "Off", interval: `${s.cycleMinutes} minutes`,
      h24: s.h24 ? "24 hour" : "12 hour", seconds: s.seconds ? "Visible" : "Hidden",
      dim: ["Full", "Soft", "Low"][s.dim] };
    for (const button of actions) {
      if (values[button.dataset.tvAction]) button.querySelector("strong").textContent = values[button.dataset.tvAction];
      if (["cycle", "seconds", "h24"].includes(button.dataset.tvAction)) {
        button.setAttribute("aria-pressed", String(s[button.dataset.tvAction]));
      }
      button.hidden = button.dataset.tvAction === "color" && engine.face.id !== "liquid";
    }
    const canvas = document.getElementById("clock");
    let display = `Canvas ${canvas.width} × ${canvas.height}`;
    try {
      if (window.CloxHost?.getDisplayInfo) {
        const info = JSON.parse(window.CloxHost.getDisplayInfo());
        const uhd = info.renderer === "uhd-virtual-display";
        const width = uhd ? info.virtualSurfaceWidth : info.reportedWidthPixels;
        const height = uhd ? info.virtualSurfaceHeight : info.reportedHeightPixels;
        if (width && height) display = `${width} × ${height} display · ${canvas.width} × ${canvas.height} canvas`;
      }
    } catch { /* Browser preview has no native display information. */ }
    document.getElementById("tv-resolution").textContent = display;
  }

  function openMenu() {
    engine.closeGallery();
    refresh();
    if (!menu.open) menu.showModal();
    actions[0].focus();
  }

  function closeMenu() {
    menu.close();
    document.getElementById("clock").focus();
  }

  function stepFocus(buttons, direction) {
    const current = buttons.indexOf(document.activeElement);
    buttons[(Math.max(0, current) + direction + buttons.length) % buttons.length].focus();
  }

  function showCities() {
    menu.close();
    pendingCities = CLOX.meridian.snapshot(new Date()).cities.map(city => city.id);
    cityChoices.replaceChildren();
    pendingCities.forEach((id, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.slot = String(i);
      button.addEventListener("click", () => changeCity(i, 1));
      cityChoices.append(button);
    });
    refreshCities();
    cityDialog.showModal();
    cityChoices.firstElementChild.focus();
  }

  function refreshCities() {
    [...cityChoices.children].forEach((button, i) => {
      const city = cities.find(c => c.id === pendingCities[i]);
      button.textContent = `${i + 1}   ‹   ${city.name} · ${city.country}   ›`;
    });
  }

  function changeCity(slot, direction) {
    let index = cities.findIndex(city => city.id === pendingCities[slot]);
    do { index = (index + direction + cities.length) % cities.length; }
    while (pendingCities.includes(cities[index].id));
    pendingCities[slot] = cities[index].id;
    refreshCities();
  }

  done.addEventListener("click", () => {
    CLOX.meridian.setCities(pendingCities);
    cityDialog.close();
    engine.command("m");
    document.getElementById("clock").focus();
  });
  cityDialog.addEventListener("cancel", e => { e.preventDefault(); cityDialog.close(); openMenu(); });
  menu.addEventListener("cancel", e => { e.preventDefault(); closeMenu(); });

  for (const button of actions) button.addEventListener("click", () => {
    switch (button.dataset.tvAction) {
      case "faces": closeMenu(); CLOX.openGallery(); break;
      case "cycle": engine.command("a"); break;
      case "interval": engine.cycleInterval(); break;
      case "h24": engine.command("h"); break;
      case "seconds": engine.command("s"); break;
      case "dim": engine.command("n"); break;
      case "color": {
        // The face owns its palette and persistence, including keyboard input.
        const event = new KeyboardEvent("keydown", { key: "c", bubbles: true });
        document.getElementById("clock").dispatchEvent(event);
        break;
      }
      case "cities": showCities(); break;
      case "close": closeMenu(); break;
    }
    refresh();
  });

  CLOX.tv = {
    get busy() { return menu.open || cityDialog.open; },
    setActive(value) { engine.setActive(value); },
    handleKey(key) {
      const back = key === "Escape" || key === "Back" || key === "BrowserBack";
      if (cityDialog.open) {
        if (back) { cityDialog.close(); openMenu(); return true; }
        if (key === "ArrowUp" || key === "ArrowDown") {
          stepFocus([...cityChoices.children, done], key === "ArrowUp" ? -1 : 1); return true;
        }
        const slot = document.activeElement?.dataset.slot;
        if ((key === "ArrowLeft" || key === "ArrowRight") && slot != null) {
          changeCity(Number(slot), key === "ArrowLeft" ? -1 : 1); return true;
        }
        if (key === "Enter" || key === " ") { document.activeElement?.click(); return true; }
        return key.startsWith("Arrow") || key === "ContextMenu" || key === "MediaPlayPause";
      }
      if (menu.open) {
        if (back || key === "ContextMenu") { closeMenu(); return true; }
        if (key === "ArrowUp" || key === "ArrowDown") {
          stepFocus(actions.filter(button => !button.hidden), key === "ArrowUp" ? -1 : 1); return true;
        }
        if (key === "Enter" || key === " ") { document.activeElement?.click(); return true; }
        return key.startsWith("Arrow") || key === "MediaPlayPause";
      }
      if (engine.galleryOpen) {
        if (key === "ContextMenu") { openMenu(); return true; }
        if (back) { engine.closeGallery(); return true; }
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Enter", " ", "Home", "End"].includes(key)) {
          engine.command(key); return true;
        }
        return key === "MediaPlayPause";
      }
      if (back) return false;
      switch (key) {
        case "ArrowLeft": case "ArrowRight": engine.command(key); return true;
        case "ArrowUp": case "Enter": CLOX.openGallery(); return true;
        case "ArrowDown": case "ContextMenu": openMenu(); return true;
        case "MediaPlayPause": case " ": engine.command("a"); return true;
        default: return false;
      }
    }
  };
})();
