/* Native controls stay separate from the canvas, including gallery previews. */
"use strict";

CLOX.meridian = (() => {
  const T = CLOX.worldTime, KEY = "clox.meridian.v1";
  const controls = document.getElementById("meridian-controls");
  const slider = document.getElementById("meridian-time");
  const label = document.getElementById("meridian-time-label");
  const liveButton = document.getElementById("meridian-live");
  const cityButton = document.getElementById("meridian-cities");
  const copyButton = document.getElementById("meridian-copy");
  const cityDialog = document.getElementById("meridian-city-dialog");
  const copyDialog = document.getElementById("meridian-copy-dialog");
  const selects = [];
  let ids = T.normalizeCities(null), selected = null, start = 0;
  let active = false, timer = null, lastLayout = "", copyTimer = null;
  let currentSettings = { h24: false };

  try { ids = T.normalizeCities(JSON.parse(localStorage.getItem(KEY))?.cities); }
  catch { /* Invalid or blocked storage leaves a usable default board. */ }
  const query = new URLSearchParams(location.search);
  if (query.has("cities")) ids = T.normalizeCities(query.get("cities").split(","));

  for (let i = 0; i < 4; i++) {
    const row = document.createElement("div");
    row.className = "meridian-city-field";
    const caption = document.createElement("label");
    caption.htmlFor = `meridian-city-${i}`;
    caption.textContent = U.pad2(i + 1);
    const select = document.createElement("select");
    select.id = caption.htmlFor;
    select.setAttribute("aria-label", `City ${i + 1}${i === 0 ? ", reference city" : ""}`);
    for (const city of [...T.cities].sort((a, b) => a.name.localeCompare(b.name))) {
      const option = document.createElement("option");
      option.value = city.id;
      option.textContent = `${city.name} · ${city.country}`;
      select.append(option);
    }
    row.append(caption, select);
    document.getElementById("meridian-city-fields").append(row);
    selects.push(select);
    select.addEventListener("change", syncOptions);
  }

  function syncOptions() {
    for (const select of selects) {
      for (const option of select.options) {
        option.disabled = selects.some(other => other !== select && other.value === option.value);
      }
    }
  }

  function snapshot(now, preview = false) {
    const live = preview || selected === null;
    const date = live ? now : new Date(selected);
    const base = live ? Math.floor(now.getTime() / T.HOUR) * T.HOUR - 6 * T.HOUR : start;
    return { date, start: base, live, cities: ids.map(id => T.cities.find(c => c.id === id)) };
  }

  function summary(state) {
    const header = `${state.live ? "Live" : "Exploring"} · ${state.date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
    return [header, ...state.cities.map(city => {
      const p = T.at(state.date, city.zone);
      const period = currentSettings.h24 ? "" : (p.hour >= 12 ? " PM" : " AM");
      return `${city.name}: ${p.weekday} ${p.dateKey}, ${T.clock(p, currentSettings.h24)}${period} (${T.offsetLabel(p.offsetMinutes)})`;
    })].join("\n");
  }

  function update() {
    if (!active || controls.hidden) return;
    const state = snapshot(new Date());
    slider.value = (state.date.getTime() - state.start) / 60000;
    const ref = T.at(state.date, state.cities[0].zone);
    const period = currentSettings.h24 ? "" : ref.hour >= 12 ? " PM" : " AM";
    label.textContent = state.live ? "Live · move to explore" :
      `${ref.weekday} ${T.clock(ref, currentSettings.h24)}${period} · ${state.cities[0].name}`;
    liveButton.setAttribute("aria-pressed", String(state.live));
    controls.classList.toggle("is-exploring", !state.live);
    const text = summary(state);
    slider.setAttribute("aria-valuetext", text.replaceAll("\n", "; "));
    document.getElementById("meridian-summary").textContent = text;
    document.getElementById("clock").setAttribute("aria-label", `Meridian world clock. ${text.replaceAll("\n", "; ")}`);
  }

  function live() { selected = null; update(); }

  slider.addEventListener("input", () => {
    if (selected === null) start = snapshot(new Date()).start;
    selected = start + Number(slider.value) * 60000;
    update();
  });
  slider.addEventListener("keydown", e => {
    if (e.key === "Escape") { live(); slider.blur(); e.preventDefault(); }
  });
  liveButton.addEventListener("click", live);
  document.getElementById("meridian-faces").addEventListener("click", () => CLOX.openGallery());

  cityButton.addEventListener("click", () => {
    selects.forEach((select, i) => { select.value = ids[i]; });
    syncOptions();
    cityDialog.showModal();
  });
  document.getElementById("meridian-cancel").addEventListener("click", () => cityDialog.close());
  document.getElementById("meridian-city-form").addEventListener("submit", e => {
    e.preventDefault();
    ids = T.normalizeCities(selects.map(select => select.value));
    try { localStorage.setItem(KEY, JSON.stringify({ cities: ids })); }
    catch { /* The choices still work for this session. */ }
    cityDialog.close();
    update();
  });

  copyButton.addEventListener("click", async () => {
    const text = summary(snapshot(new Date()));
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "Copied";
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { copyButton.textContent = "Copy times"; }, 1800);
    } catch {
      if (!active || controls.hidden) return;
      const field = document.getElementById("meridian-copy-text");
      field.value = text;
      if (!copyDialog.open) copyDialog.showModal();
      field.focus();
      field.select();
    }
  });

  function layout(s, x, y, portrait, compact) {
    const key = `${s}:${x}:${y}:${portrait}:${compact}`;
    if (key === lastLayout) return;
    lastLayout = key;
    const actions = controls.querySelector(".meridian-actions");
    actions.classList.toggle("is-portrait", portrait);
    const scrub = controls.querySelector(".meridian-scrub");
    const refWidth = portrait ? 440 : 1440;
    actions.style.left = `${portrait ? 12 : x + (compact ? 580 : 910) * s}px`;
    actions.style.width = `${portrait ? 2 * x + 440 * s - 24 : (compact ? 820 : 466) * s}px`;
    actions.style.top = `${y + (portrait ? 100 : compact ? 36 : 45) * s}px`;
    actions.style.fontSize = `${Math.max(11, 13 * s)}px`;
    scrub.style.left = `${x + (portrait ? 28 : 190) * s}px`;
    scrub.style.width = `${(refWidth - (portrait ? 56 : 254)) * s}px`;
    scrub.style.top = `${y + (portrait ? 810 : compact ? 622 : 858) * s}px`;
    slider.style.marginLeft = `${(portrait ? 77 * s : 0) - 6.5}px`;
    slider.style.width = `${(portrait ? 307 : 1186) * s + 13}px`;
  }

  return {
    controls, snapshot, layout,
    get h24() { return currentSettings.h24; },
    explore(instant) { selected = instant; start = Math.floor(instant / T.HOUR) * T.HOUR - 6 * T.HOUR; update(); },
    busy() { return selected !== null || cityDialog.open || copyDialog.open || document.getElementById("meeting-dialog").open || controls.contains(document.activeElement); },
    settings(value) { currentSettings = value; },
    enter() { active = true; timer = setInterval(update, 1000); update(); },
    leave() {
      active = false; clearInterval(timer); selected = null;
      cityDialog.close(); copyDialog.close();
      document.getElementById("meeting-dialog").close();
    },
    update
  };
})();
