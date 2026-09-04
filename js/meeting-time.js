/* Meeting windows use elapsed minutes, even when local clocks skip or repeat. */
"use strict";

CLOX.meetingTime = (() => {
  const T = CLOX.worldTime, MINUTE = 60000, STEP = 15 * MINUTE;
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function availability(p, from, to, includeWeekends) {
    const minute = p.hour * 60 + p.minute;
    const overnight = from > to;
    const inWindow = overnight ? minute >= from || minute < to : minute >= from && minute < to;
    // The early part of an overnight window belongs to the previous day.
    const day = (weekdays.indexOf(p.weekday) + (overnight && minute < to ? 6 : 0)) % 7;
    const weekend = !includeWeekends && (day === 0 || day === 6);
    const distance = inWindow ? 0 : Math.min((from - minute + 1440) % 1440, (minute - to + 1440) % 1440 + 1);
    return { outside: Number(!inWindow || weekend), weekend: Number(weekend), penalty: distance + (weekend ? 1440 : 0) };
  }

  function findSlots({ dateKey, referenceZone, participants, duration, includeWeekends = false, notBefore = -Infinity }) {
    const midnight = new Date(`${dateKey}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey) || !Number.isFinite(+midnight)
      || midnight.toISOString().slice(0, 10) !== dateKey || midnight.getUTCFullYear() < 1900) {
      throw new RangeError("Choose a valid date from 1900 onward.");
    }
    if (!Number.isInteger(duration) || duration < 15 || duration > 180) throw new RangeError("Choose a duration from 15 to 180 minutes.");
    if (!Array.isArray(participants) || participants.length < 1 || participants.length > 4) throw new RangeError("Choose one to four cities.");
    for (const { city, from, to } of participants) {
      if (!T.cities.includes(city) || !Number.isInteger(from) || !Number.isInteger(to)
        || from < 0 || from >= 1440 || to < 0 || to >= 1440 || from === to) {
        throw new RangeError("Choose valid local hours with different start and end times.");
      }
    }
    if (notBefore !== -Infinity && !Number.isFinite(notBefore)) throw new RangeError("Invalid earliest start.");

    const starts = [];
    // Enumerate instants instead of parsing an ambiguous local date and time.
    for (let t = +midnight - T.DAY; t < +midnight + 2 * T.DAY; t += STEP) {
      if (t >= notBefore && T.at(new Date(t), referenceZone).dateKey === dateKey) starts.push(t);
    }
    if (!starts.length) return { slots: [], fits: 0, total: 0 };
    const base = starts[0], length = (starts.at(-1) - base) / MINUTE + duration;
    const indexes = participants.map(({ city, from, to }) => {
      const outside = [0], weekend = [0], penalty = [0];
      for (let i = 0; i < length; i++) {
        const p = T.at(new Date(base + i * MINUTE), city.zone);
        const a = availability(p, from, to, includeWeekends);
        outside.push(outside[i] + a.outside);
        weekend.push(weekend[i] + a.weekend);
        penalty.push(penalty[i] + a.penalty);
      }
      return { outside, weekend, penalty };
    });
    const slots = starts.map(start => {
      const i = (start - base) / MINUTE, j = i + duration;
      const people = participants.map((person, k) => ({ ...person,
        outside: indexes[k].outside[j] - indexes[k].outside[i],
        weekend: indexes[k].weekend[j] - indexes[k].weekend[i] }));
      return { start, end: start + duration * MINUTE, people,
        worst: Math.max(...people.map(p => p.outside)),
        outside: people.reduce((sum, p) => sum + p.outside, 0),
        penalty: indexes.reduce((sum, index) => sum + index.penalty[j] - index.penalty[i], 0) };
    });
    const fits = slots.filter(s => s.outside === 0).length;
    slots.sort((a, b) => a.worst - b.worst || a.outside - b.outside || a.penalty - b.penalty || a.start - b.start);
    return { slots, fits, total: slots.length };
  }

  function localRange(slot, city, h24 = true) {
    const a = T.at(new Date(slot.start), city.zone), b = T.at(new Date(slot.end), city.zone);
    const time = p => `${T.clock(p, h24)}${h24 ? "" : p.hour >= 12 ? " PM" : " AM"}`;
    const endDay = a.dateKey === b.dateKey ? "" : `${b.weekday} ${b.dateKey} · `;
    const offsets = T.offsetLabel(a.offsetMinutes) + (a.offsetMinutes === b.offsetMinutes ? "" : ` → ${T.offsetLabel(b.offsetMinutes)}`);
    return `${a.weekday} ${a.dateKey} · ${time(a)} – ${endDay}${time(b)} (${offsets})`;
  }

  function status(person) {
    return person.outside ? `${person.outside} min outside hours${person.weekend ? " · weekend" : ""}` : "Within hours";
  }

  function describe(slot, title, h24 = true) {
    const utc = value => new Date(value).toISOString().replace(".000Z", "Z");
    return [title.trim() || "Team call", `${(slot.end - slot.start) / MINUTE} minutes`,
      ...slot.people.map(p => `${p.city.name}: ${localRange(slot, p.city, h24)} · ${status(p)}`),
      `UTC: ${utc(slot.start)} – ${utc(slot.end)}`].join("\n");
  }

  // RFC 5545: UTC dates, escaped TEXT, CRLF, and at most 75 UTF-8 octets per line.
  // https://www.rfc-editor.org/rfc/rfc5545.html
  function calendar(slot, title, uid, created) {
    if (!/^[a-zA-Z0-9@._-]+$/.test(uid)) throw new RangeError("Invalid event identifier.");
    const stamp = value => new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const escape = value => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n")
      .replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, "");
    const fold = line => {
      const encoder = new TextEncoder();
      let result = "", bytes = 0;
      for (const char of line) {
        const size = encoder.encode(char).length;
        if (bytes + size > 75) { result += "\r\n "; bytes = 1; }
        result += char; bytes += size;
      }
      return result;
    };
    return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Clox//Meridian//EN", "CALSCALE:GREGORIAN",
      "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp(created)}`, `DTSTART:${stamp(slot.start)}`,
      `DTEND:${stamp(slot.end)}`, `SUMMARY:${escape(title.trim() || "Team call")}`,
      `DESCRIPTION:${escape(describe(slot, title))}`, "STATUS:TENTATIVE", "END:VEVENT", "END:VCALENDAR"]
      .map(fold).join("\r\n") + "\r\n";
  }

  return { findSlots, localRange, status, describe, calendar };
})();
