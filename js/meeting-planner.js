/* A local meeting planner; downloads and copied details use the selected instant. */
"use strict";

(() => {
  const T = CLOX.worldTime, M = CLOX.meridian, P = CLOX.meetingTime;
  const KEY = "clox.meeting.v1", durations = [15, 30, 45, 60, 90, 120, 180];
  const dialog = document.getElementById("meeting-dialog");
  const form = document.getElementById("meeting-form");
  const dateInput = document.getElementById("meeting-date");
  const durationInput = document.getElementById("meeting-duration");
  const weekendsInput = document.getElementById("meeting-weekends");
  const resultTitle = document.getElementById("meeting-result-title");
  const resultStatus = document.getElementById("meeting-result-status");
  const slotsEl = document.getElementById("meeting-slots");
  const other = document.getElementById("meeting-other");
  const allStarts = document.getElementById("meeting-all-starts");
  const selection = document.getElementById("meeting-selection");
  const titleInput = document.getElementById("meeting-event-title");
  const feedback = document.getElementById("meeting-feedback");
  const fallback = document.getElementById("meeting-copy-fallback");
  const exportButtons = [...document.querySelectorAll(".meeting-export button")];
  let preferences = {}, rows = [], candidates = [], reference = null, selected = null, uid = "";
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && typeof saved === "object" && !Array.isArray(saved)) preferences = saved;
  } catch { /* Availability can still be used without storage. */ }
  durationInput.value = String(durations.includes(preferences.duration) ? preferences.duration : 30);
  weekendsInput.checked = preferences.includeWeekends === true;

  function node(tag, text, className) {
    const el = document.createElement(tag);
    if (text !== undefined) el.textContent = text;
    if (className) el.className = className;
    return el;
  }

  function minute(value) {
    if (!/^\d{2}:\d{2}$/.test(value)) return NaN;
    const [h, m] = value.split(":").map(Number);
    return h < 24 && m < 60 ? h * 60 + m : NaN;
  }

  function addPerson(city) {
    const saved = preferences.hours?.[city.id];
    const valid = Number.isFinite(minute(saved?.from)) && Number.isFinite(minute(saved?.to)) && saved.from !== saved.to;
    const row = node("div", undefined, "meeting-person");
    const name = node("label", undefined, "meeting-person-name");
    const enabled = document.createElement("input");
    enabled.type = "checkbox"; enabled.checked = saved?.enabled !== false;
    enabled.id = `meeting-join-${city.id}`;
    name.append(enabled, node("span", city.name));
    const hours = node("div", undefined, "meeting-person-hours");
    const from = document.createElement("input"), to = document.createElement("input");
    for (const [input, key, caption, value] of [[from, "from", "Available from", "09:00"], [to, "to", "Available until", "17:00"]]) {
      input.type = "time"; input.required = true; input.step = "60";
      input.id = `meeting-${key}-${city.id}`;
      input.setAttribute("aria-label", `${caption} in ${city.name}`);
      input.value = valid ? saved[key] : value;
      input.disabled = !enabled.checked;
    }
    enabled.addEventListener("change", () => { from.disabled = to.disabled = !enabled.checked; });
    hours.append(from, node("span", "–"), to);
    row.append(name, hours);
    document.getElementById("meeting-people").append(row);
    return { city, enabled, from, to };
  }

  function invalidate(message = "Settings changed. Find times to compare these hours.") {
    selected = null;
    candidates = [];
    selection.hidden = true;
    other.hidden = true;
    slotsEl.replaceChildren();
    resultTitle.textContent = "Ready when you are.";
    resultStatus.textContent = message;
    exportButtons.forEach(button => { button.disabled = true; });
    feedback.textContent = ""; fallback.hidden = true;
  }

  function choose(slot, button) {
    if (selected?.start !== slot.start) uid = `${crypto.randomUUID()}@clox.local`;
    selected = slot;
    allStarts.value = String(slot.start);
    selection.hidden = false;
    exportButtons.forEach(el => { el.disabled = false; });
    for (const el of slotsEl.children) el.setAttribute("aria-pressed", String(el === button));
    document.getElementById("meeting-selection-label").textContent =
      `${(slot.end - slot.start) / 60000} MINUTES · ${new Date(slot.start).toISOString().replace("T", " ").slice(0, 16)} UTC`;
    const body = document.getElementById("meeting-local-times");
    body.replaceChildren();
    for (const person of slot.people) {
      const tr = document.createElement("tr"), th = node("th", person.city.name);
      th.scope = "row";
      const td = document.createElement("td");
      td.append(node("span", P.localRange(slot, person.city, M.h24)),
        node("span", P.status(person), `meeting-person-status${person.outside ? " is-compromise" : ""}`));
      tr.append(th, td); body.append(tr);
    }
    feedback.textContent = ""; fallback.hidden = true;
  }

  function search(persist = true) {
    invalidate();
    if (!form.reportValidity()) return;
    const participants = rows.filter(row => row.enabled.checked)
      .map(row => ({ city: row.city, from: minute(row.from.value), to: minute(row.to.value) }));
    if (participants.length < 2) {
      resultTitle.textContent = "Bring someone along.";
      resultStatus.textContent = "Choose at least two cities to find a shared time.";
      return;
    }
    let result;
    try {
      result = P.findSlots({ dateKey: dateInput.value, referenceZone: reference.zone, participants,
        duration: Number(durationInput.value), includeWeekends: weekendsInput.checked, notBefore: Date.now() });
    } catch (error) {
      resultTitle.textContent = "Check the local hours.";
      resultStatus.textContent = error.message;
      return;
    }
    if (persist) {
      const hours = Object.fromEntries(rows.map(row => [row.city.id, {
        enabled: row.enabled.checked, from: row.from.value, to: row.to.value }]));
      preferences = { duration: Number(durationInput.value), includeWeekends: weekendsInput.checked,
        hours: { ...preferences.hours, ...hours } };
      try { localStorage.setItem(KEY, JSON.stringify(preferences)); }
      catch { /* The current search remains usable. */ }
    }
    showOptions(result);
  }

  function startLabel(slot) {
    const p = T.at(new Date(slot.start), reference.zone);
    const period = M.h24 ? "" : p.hour >= 12 ? " PM" : " AM";
    const count = slot.people.filter(person => person.outside).length;
    return { time: `${T.clock(p, M.h24)}${period}`, offset: T.offsetLabel(p.offsetMinutes),
      fit: count ? `${count} outside hours` : "Everyone within hours" };
  }

  function showOptions(result) {
    if (!result.total) {
      resultTitle.textContent = "This day has passed.";
      resultStatus.textContent = `No future starts remain on this date in ${reference.name}. Choose another day.`;
      return;
    }
    resultTitle.textContent = result.fits ? "A shared window." : "No shared window.";
    resultStatus.textContent = result.fits
      ? `${result.fits} possible starts fit everyone’s hours. Showing a spread of options in ${reference.name} time.`
      : `These are the closest alternatives in ${reference.name} time. Check whose hours would need to change.`;
    candidates = result.slots;
    other.hidden = false;
    document.getElementById("meeting-other-label").textContent = `All starts in ${reference.name}`;
    allStarts.replaceChildren();
    for (const slot of [...candidates].sort((a, b) => a.start - b.start)) {
      const label = startLabel(slot);
      const option = node("option", `${label.time} (${label.offset}) · ${label.fit}`);
      option.value = String(slot.start); allStarts.append(option);
    }
    const suggestions = [];
    for (const slot of result.slots) {
      if (result.fits && slot.outside) continue;
      if (suggestions.some(other => Math.abs(other.start - slot.start) < Math.max(30, Number(durationInput.value)) * 60000)) continue;
      suggestions.push(slot);
      if (suggestions.length === 6) break;
    }
    suggestions.forEach((slot, i) => {
      const label = startLabel(slot);
      const button = node("button", undefined, `meeting-slot${slot.outside ? " is-compromise" : ""}`);
      button.type = "button";
      button.dataset.start = String(slot.start);
      button.append(node("span", label.time, "meeting-slot-time"),
        node("span", label.offset, "meeting-slot-offset"), node("span", label.fit, "meeting-slot-fit"));
      button.addEventListener("click", () => choose(slot, button));
      slotsEl.append(button);
      if (i === 0) choose(slot, button);
      else button.setAttribute("aria-pressed", "false");
    });
  }

  document.getElementById("meridian-plan").addEventListener("click", () => {
    const state = M.snapshot(new Date()), city = state.cities[0];
    const today = T.at(new Date(), city.zone).dateKey;
    if (reference?.id !== city.id || !dateInput.value || dateInput.value < today) {
      dateInput.value = T.at(state.date, city.zone).dateKey;
      if (dateInput.value < today) dateInput.value = today;
    }
    reference = city;
    dateInput.min = today;
    document.getElementById("meeting-date-label").textContent = `Day in ${city.name}`;
    document.getElementById("meeting-people").replaceChildren();
    rows = state.cities.map(addPerson);
    dialog.showModal();
    search(false);
  });
  document.getElementById("meeting-close").addEventListener("click", () => dialog.close());
  form.addEventListener("input", () => invalidate());
  form.addEventListener("submit", e => {
    e.preventDefault(); search();
    if (window.matchMedia("(max-width: 760px)").matches) resultTitle.scrollIntoView({ block: "start" });
    resultTitle.focus({ preventScroll: true });
  });
  titleInput.addEventListener("input", () => { feedback.textContent = ""; fallback.hidden = true; });
  allStarts.addEventListener("change", () => {
    const slot = candidates.find(candidate => candidate.start === Number(allStarts.value));
    choose(slot, [...slotsEl.children].find(button => button.dataset.start === allStarts.value));
  });

  function current() {
    if (!selected) return false;
    if (selected.start < Date.now()) {
      search(false);
      resultStatus.textContent = "That start has passed. The suggestions have been refreshed; choose a new time.";
      return false;
    }
    return true;
  }

  document.getElementById("meeting-atlas").addEventListener("click", () => {
    if (!current()) return;
    M.explore(selected.start);
    dialog.close();
  });
  document.getElementById("meeting-copy").addEventListener("click", async () => {
    if (!current()) return;
    const slot = selected, text = P.describe(slot, titleInput.value, M.h24);
    try {
      await navigator.clipboard.writeText(text);
      if (dialog.open && selected === slot) feedback.textContent = "Meeting details copied.";
    } catch {
      if (!dialog.open || selected !== slot) return;
      fallback.hidden = false;
      const field = document.getElementById("meeting-copy-text");
      field.value = text; field.focus(); field.select();
    }
  });
  document.getElementById("meeting-calendar").addEventListener("click", () => {
    if (!current()) return;
    const text = P.calendar(selected, titleInput.value, uid, new Date());
    const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `meridian-${new Date(selected.start).toISOString().slice(0, 16).replace(/[:T]/g, "-")}.ics`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    feedback.textContent = "Calendar file saved. Open it in your calendar to add the event.";
  });
})();
