import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ CLOX: {}, Intl, Date, Math });
const source = new URL('../js/world-time.js', import.meta.url);
if (existsSync(source)) vm.runInContext(readFileSync(source, 'utf8'), context);
const T = context.CLOX.worldTime;
const date = s => new Date(s);

test('world time is available without a DOM or server', () => {
  assert.equal(typeof T?.at, 'function');
});

test('spring forward skips the missing hour in Chicago', () => {
  const before = T.at(date('2026-03-08T07:59:59Z'), 'America/Chicago');
  const after = T.at(date('2026-03-08T08:00:00Z'), 'America/Chicago');
  assert.equal(before.hour, 1);
  assert.equal(before.offsetMinutes, -360);
  assert.equal(after.hour, 3);
  assert.equal(after.offsetMinutes, -300);
});

test('fall back repeats the local hour at two different offsets', () => {
  const first = T.at(date('2026-11-01T06:30:00Z'), 'America/Chicago');
  const second = T.at(date('2026-11-01T07:30:00Z'), 'America/Chicago');
  assert.equal(first.hour, 1);
  assert.equal(second.hour, 1);
  assert.equal(first.offsetMinutes, -300);
  assert.equal(second.offsetMinutes, -360);
});

test('quarter-hour and half-hour zones retain their minutes', () => {
  const d = date('2026-01-01T00:00:00Z');
  const nepal = T.at(d, 'Asia/Kathmandu');
  const india = T.at(d, 'Asia/Kolkata');
  assert.equal(nepal.hour, 5);
  assert.equal(nepal.minute, 45);
  assert.equal(nepal.offsetMinutes, 345);
  assert.equal(india.minute, 30);
  assert.equal(india.offsetMinutes, 330);
  assert.equal(T.offsetLabel(nepal.offsetMinutes), 'UTC+05:45');
  assert.equal(T.offsetLabel(-210), 'UTC−03:30');
});

test('midnight is zero, and year boundaries compare civil dates', () => {
  const d = date('2026-01-01T00:00:00Z');
  const utc = T.at(d, 'UTC');
  const hawaii = T.at(d, 'Pacific/Honolulu');
  const tokyo = T.at(d, 'Asia/Tokyo');
  assert.equal(utc.hour, 0);
  assert.equal(utc.offsetMinutes, 0);
  assert.equal(hawaii.dateKey, '2025-12-31');
  assert.equal(T.dayDifference(hawaii, tokyo), -1);
  assert.equal(T.dayDifference(tokyo, hawaii), 1);
  assert.equal(T.clock(utc, false), '12:00');
  assert.equal(T.clock(utc, true), '00:00');
});

test('southern hemisphere DST and a 30-minute transition use zone rules', () => {
  const winter = T.at(date('2026-07-01T00:00:00Z'), 'Australia/Sydney');
  const summer = T.at(date('2026-01-01T00:00:00Z'), 'Australia/Sydney');
  assert.equal(winter.offsetMinutes, 600);
  assert.equal(summer.offsetMinutes, 660);
  const before = T.at(date('2026-10-03T15:29:59Z'), 'Australia/Lord_Howe');
  const after = T.at(date('2026-10-03T15:30:00Z'), 'Australia/Lord_Howe');
  assert.equal(before.hour, 1);
  assert.equal(after.hour, 2);
  assert.equal(after.minute, 30);
  assert.equal(after.offsetMinutes - before.offsetMinutes, 30);
});

test('invalid saved cities cannot erase the board or duplicate stations', () => {
  for (const input of [null, 42, {}, 'tokyo', [], ['bad', 'tokyo', 'tokyo'], ['__proto__']]) {
    const ids = Array.from(T.normalizeCities(input));
    assert.equal(ids.length, 4);
    assert.equal(new Set(ids).size, 4);
    assert.ok(ids.every(id => T.cities.some(city => city.id === id)));
  }
  assert.deepEqual(Array.from(T.normalizeCities(['kathmandu', 'chicago'])),
    ['kathmandu', 'chicago', 'london', 'tokyo']);
});

test('all catalog zones work and coordinates are physical', () => {
  assert.equal(new Set(T.cities.map(city => city.id)).size, T.cities.length);
  for (const city of T.cities) {
    assert.ok(Math.abs(city.lat) <= 90 && Math.abs(city.lon) <= 180, city.id);
    assert.ok(Number.isFinite(T.at(date('2026-09-04T00:00:00Z'), city.zone).offsetMinutes), city.id);
  }
});

test('solar declination follows the solstices and equinox', () => {
  const june = T.sun(date('2026-06-21T12:00:00Z'));
  const december = T.sun(date('2026-12-21T12:00:00Z'));
  const march = T.sun(date('2026-03-20T12:00:00Z'));
  assert.ok(Math.abs(june.lat - 23.44) < 0.5);
  assert.ok(Math.abs(december.lat + 23.44) < 0.5);
  assert.ok(Math.abs(march.lat) < 0.7);
  assert.ok(Math.abs(march.lon) < 3);
});

test('the sun is overhead at its ground point and below its antipode', () => {
  for (const iso of ['2026-03-20T00:00:00Z', '2026-06-21T12:00:00Z', '2024-02-29T23:59:59Z']) {
    const sun = T.sun(date(iso));
    assert.ok(sun.lon >= -180 && sun.lon < 180);
    assert.ok(Math.abs(T.elevation(sun.lat, sun.lon, sun) - 90) < 0.00001);
    assert.ok(Math.abs(T.elevation(-sun.lat, sun.lon + 180, sun) + 90) < 0.00001);
  }
});

test('polar day and night never produce NaN', () => {
  const sun = T.sun(date('2026-06-21T00:00:00Z'));
  assert.ok(T.elevation(90, 0, sun) > 23);
  assert.ok(T.elevation(-90, 0, sun) < -23);
  assert.equal(T.light(90, 0, sun), 'Daylight');
  assert.equal(T.light(-90, 0, sun), 'Night');
  assert.equal(T.light(0, sun.lon + 94, { lat: 0, lon: sun.lon }), 'Twilight');
});

test('a timeline is 24 elapsed hours even when local time jumps', () => {
  const start = date('2026-03-08T06:00:00Z').getTime();
  const city = T.cities.find(c => c.id === 'chicago');
  const cells = T.timeline(city, start);
  assert.equal(cells.length, 96);
  assert.equal(cells[7].hour, 1);
  assert.equal(cells[8].hour, 3);
  assert.equal(cells[95].instant - cells[0].instant, 95 * 15 * 60000);
  assert.ok(cells.every(c => Number.isFinite(c.elevation)));
  assert.ok(cells.every(c => c.office === (c.hour >= 9 && c.hour < 17)));
});
