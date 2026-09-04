import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const context = vm.createContext({ CLOX: {}, Intl, Date, Math, TextEncoder });
for (const file of ['world-time.js', 'meeting-time.js']) {
  const path = new URL(`../js/${file}`, import.meta.url);
  if (existsSync(path)) vm.runInContext(readFileSync(path, 'utf8'), context);
}
const T = context.CLOX.worldTime, M = context.CLOX.meetingTime;
const person = (id, from = 540, to = 1020) => ({ city: T.cities.find(c => c.id === id), from, to });
const find = (options = {}) => M.findSlots({ dateKey: '2026-09-07', referenceZone: 'America/Chicago',
  participants: [person('chicago'), person('london')], duration: 30, ...options });
const iso = value => new Date(value).toISOString();

test('finds the whole shared window and permits a meeting ending at closing time', () => {
  const result = find();
  assert.equal(result.fits, 7);
  assert.equal(iso(result.slots[0].start), '2026-09-07T14:00:00.000Z');
  const last = result.slots.filter(s => s.outside === 0).at(-1);
  assert.equal(iso(last.end), '2026-09-07T16:00:00.000Z');
  assert.equal(last.people[1].outside, 0);
});

test('checks every minute of the full duration, not just its start', () => {
  const slot = find({ duration: 60 }).slots.find(s => iso(s.start) === '2026-09-07T15:30:00.000Z');
  assert.equal(slot.people[0].outside, 0);
  assert.equal(slot.people[1].outside, 30);
  assert.equal(slot.outside, 30);
});

test('admits no false overlap and ranks alternatives by the largest burden first', () => {
  const result = find({ participants: [person('chicago'), person('london'), person('tokyo'), person('sydney')] });
  assert.equal(result.fits, 0);
  assert.ok(result.slots.every(s => s.outside > 0));
  for (let i = 1; i < result.slots.length; i++) {
    const a = result.slots[i - 1], b = result.slots[i];
    assert.ok(a.worst <= b.worst);
    if (a.worst === b.worst) assert.ok(a.outside <= b.outside);
  }
});

test('uses the reference city date across the date line', () => {
  const result = find({ referenceZone: 'Pacific/Auckland', participants: [person('auckland'), person('honolulu')] });
  assert.equal(result.total, 96);
  for (const slot of result.slots) assert.equal(T.at(new Date(slot.start), 'Pacific/Auckland').dateKey, '2026-09-07');
  assert.ok(result.slots.some(s => T.at(new Date(s.start), 'Pacific/Honolulu').dateKey === '2026-09-06'));
});

test('weekends follow each participant local date', () => {
  const options = { dateKey: '2026-09-05', participants: [person('chicago')] };
  assert.equal(find(options).fits, 0);
  assert.equal(find({ ...options, includeWeekends: true }).fits, 31);
  const overnight = find({ participants: [person('chicago'), person('tokyo')], dateKey: '2026-09-04' });
  const late = overnight.slots.find(s => iso(s.start) === '2026-09-04T16:00:00.000Z');
  assert.equal(late.people[0].weekend, 0);
  assert.equal(late.people[1].weekend, 30);
});

test('overnight hours belong to the weekday on which the window opens', () => {
  const result = find({ dateKey: '2026-09-05', participants: [person('chicago', 1320, 360)] });
  const early = result.slots.find(s => iso(s.start) === '2026-09-05T06:00:00.000Z');
  const late = result.slots.find(s => iso(s.start) === '2026-09-06T04:00:00.000Z');
  assert.equal(early.outside, 0, 'Saturday 01:00 is inside Friday night availability');
  assert.equal(late.outside, 30, 'Saturday night availability is excluded');
});

test('spring DST has 23 hours and elapsed duration crosses the missing hour', () => {
  const result = find({ dateKey: '2026-03-08', includeWeekends: true, duration: 120,
    participants: [person('chicago', 60, 240)] });
  assert.equal(result.total, 92);
  assert.equal(result.fits, 1);
  const slot = result.slots[0];
  assert.equal(iso(slot.start), '2026-03-08T07:00:00.000Z');
  assert.equal(iso(slot.end), '2026-03-08T09:00:00.000Z');
  assert.match(M.localRange(slot, slot.people[0].city), /01:00.*04:00/);
});

test('fall DST retains both repeated hours as distinct instants', () => {
  const result = find({ dateKey: '2026-11-01', includeWeekends: true, participants: [person('chicago', 60, 120)] });
  assert.equal(result.total, 100);
  const first = result.slots.find(s => iso(s.start) === '2026-11-01T06:00:00.000Z');
  const second = result.slots.find(s => iso(s.start) === '2026-11-01T07:00:00.000Z');
  assert.equal(first.outside, 0);
  assert.equal(second.outside, 0);
  assert.notEqual(M.localRange(first, first.people[0].city), M.localRange(second, second.people[0].city));
});

test('handles quarter-hour zones and minute-specific availability', () => {
  const result = find({ referenceZone: 'Asia/Kathmandu', participants: [person('kathmandu', 545, 580)] });
  assert.equal(result.fits, 0, 'no quarter-hour start fits 30 minutes within 09:05–09:40');
  const start = result.slots.find(s => iso(s.start) === '2026-09-07T03:30:00.000Z');
  assert.equal(start.outside, 5);
  assert.match(M.localRange(start, start.people[0].city), /09:15.*UTC\+05:45/);
});

test('excludes past starts and returns empty when the selected date is over', () => {
  const result = find({ notBefore: Date.parse('2026-09-07T14:00:01Z') });
  assert.equal(iso(result.slots[0].start), '2026-09-07T14:15:00.000Z');
  assert.equal(find({ notBefore: Date.parse('2026-09-09T00:00:00Z') }).total, 0);
});

test('rejects impossible dates, empty participants, and invalid availability', () => {
  for (const options of [{ dateKey: '2026-02-30' }, { dateKey: '' }, { participants: [] },
    { duration: 0 }, { duration: 1.5 }, { participants: [person('chicago', 540, 540)] },
    { participants: [person('chicago', -1, 1000)] }]) assert.throws(() => find(options));
});

test('copy details include full local dates, inconvenience, and an unambiguous UTC interval', () => {
  const slot = find({ participants: [person('chicago'), person('tokyo')] }).slots[0];
  const text = M.describe(slot, 'Project call', false);
  assert.match(text, /^Project call\n30 minutes/);
  assert.match(text, /Chicago:.*2026-09/);
  assert.match(text, /Tokyo:.*UTC\+09:00/);
  assert.match(text, /outside hours/);
  assert.match(text, /[AP]M/);
  assert.ok(text.includes(iso(slot.start).replace('.000Z', 'Z')));
});

test('calendar export preserves UTC instants and does not create an invitation', () => {
  const slot = find().slots[0];
  const text = M.calendar(slot, 'Project call', 'test-123@clox.local', new Date('2026-09-04T14:00:00Z'));
  assert.ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'));
  assert.ok(text.endsWith('END:VCALENDAR\r\n'));
  for (const value of ['UID:test-123@clox.local', 'DTSTAMP:20260904T140000Z',
    'DTSTART:20260907T140000Z', 'DTEND:20260907T143000Z', 'SUMMARY:Project call']) assert.ok(text.includes(value));
  assert.doesNotMatch(text, /(?:METHOD:REQUEST|ATTENDEE|ORGANIZER|TZID=)/);
  assert.ok(text.includes('DESCRIPTION:'));
});

test('calendar text escapes property injection and folds UTF-8 on character boundaries', () => {
  const title = '東京, planning; \\ notes\r\nATTENDEE:evil@example.test ' + '🌍'.repeat(40);
  const text = M.calendar(find().slots[0], title, 'safe-uid', new Date('2026-09-04T14:00:00Z'));
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
  const unfolded = text.replace(/\r\n /g, '');
  assert.ok(unfolded.includes('SUMMARY:東京\\, planning\\; \\\\ notes\\nATTENDEE:evil@example.test'));
  assert.ok(unfolded.includes('🌍'.repeat(40)));
  assert.doesNotMatch(text, /\r\nATTENDEE:/);
  assert.throws(() => M.calendar(find().slots[0], 'Call', 'bad\r\nUID:injection', new Date()));
});
