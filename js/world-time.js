/* World time and solar geometry. No DOM: the clock and tests use the same math. */
"use strict";

CLOX.worldTime = (() => {
  const HOUR = 3600000, DAY = 24 * HOUR, RAD = Math.PI / 180;
  const pad = n => String(n).padStart(2, "0");
  const cities = [
    ["anchorage", "Anchorage", "Alaska", "America/Anchorage", 61.22, -149.90],
    ["honolulu", "Honolulu", "Hawaii", "Pacific/Honolulu", 21.31, -157.86],
    ["vancouver", "Vancouver", "Canada", "America/Vancouver", 49.28, -123.12],
    ["los-angeles", "Los Angeles", "United States", "America/Los_Angeles", 34.05, -118.24],
    ["denver", "Denver", "United States", "America/Denver", 39.74, -104.99],
    ["mexico-city", "Mexico City", "Mexico", "America/Mexico_City", 19.43, -99.13],
    ["chicago", "Chicago", "United States", "America/Chicago", 41.88, -87.63],
    ["new-york", "New York", "United States", "America/New_York", 40.71, -74.01],
    ["toronto", "Toronto", "Canada", "America/Toronto", 43.65, -79.38],
    ["st-johns", "St. John's", "Canada", "America/St_Johns", 47.56, -52.71],
    ["bogota", "Bogotá", "Colombia", "America/Bogota", 4.71, -74.07],
    ["sao-paulo", "São Paulo", "Brazil", "America/Sao_Paulo", -23.55, -46.63],
    ["buenos-aires", "Buenos Aires", "Argentina", "America/Argentina/Buenos_Aires", -34.60, -58.38],
    ["reykjavik", "Reykjavík", "Iceland", "Atlantic/Reykjavik", 64.15, -21.94],
    ["london", "London", "United Kingdom", "Europe/London", 51.51, -0.13],
    ["paris", "Paris", "France", "Europe/Paris", 48.86, 2.35],
    ["berlin", "Berlin", "Germany", "Europe/Berlin", 52.52, 13.41],
    ["tromso", "Tromsø", "Norway", "Europe/Oslo", 69.65, 18.96],
    ["lagos", "Lagos", "Nigeria", "Africa/Lagos", 6.52, 3.38],
    ["cairo", "Cairo", "Egypt", "Africa/Cairo", 30.04, 31.24],
    ["cape-town", "Cape Town", "South Africa", "Africa/Johannesburg", -33.92, 18.42],
    ["istanbul", "Istanbul", "Türkiye", "Europe/Istanbul", 41.01, 28.98],
    ["nairobi", "Nairobi", "Kenya", "Africa/Nairobi", -1.29, 36.82],
    ["dubai", "Dubai", "United Arab Emirates", "Asia/Dubai", 25.20, 55.27],
    ["delhi", "Delhi", "India", "Asia/Kolkata", 28.61, 77.21],
    ["kathmandu", "Kathmandu", "Nepal", "Asia/Kathmandu", 27.72, 85.32],
    ["dhaka", "Dhaka", "Bangladesh", "Asia/Dhaka", 23.81, 90.41],
    ["bangkok", "Bangkok", "Thailand", "Asia/Bangkok", 13.76, 100.50],
    ["singapore", "Singapore", "Singapore", "Asia/Singapore", 1.35, 103.82],
    ["hong-kong", "Hong Kong", "Hong Kong", "Asia/Hong_Kong", 22.32, 114.17],
    ["beijing", "Beijing", "China", "Asia/Shanghai", 39.90, 116.41],
    ["seoul", "Seoul", "South Korea", "Asia/Seoul", 37.57, 126.98],
    ["tokyo", "Tokyo", "Japan", "Asia/Tokyo", 35.68, 139.65],
    ["perth", "Perth", "Australia", "Australia/Perth", -31.95, 115.86],
    ["adelaide", "Adelaide", "Australia", "Australia/Adelaide", -34.93, 138.60],
    ["sydney", "Sydney", "Australia", "Australia/Sydney", -33.87, 151.21],
    ["auckland", "Auckland", "New Zealand", "Pacific/Auckland", -36.85, 174.76],
    ["chatham", "Chatham Islands", "New Zealand", "Pacific/Chatham", -43.95, -176.56]
  ].map(([id, name, country, zone, lat, lon]) => ({ id, name, country, zone, lat, lon }));
  const defaults = ["chicago", "london", "tokyo", "sydney"];
  const formatters = new Map();

  function at(date, zone) {
    let fmt = formatters.get(zone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat("en-GB-u-ca-gregory-nu-latn", {
        timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
        weekday: "short", hour: "2-digit", minute: "2-digit", second: "2-digit",
        hourCycle: "h23"
      });
      formatters.set(zone, fmt);
    }
    const p = Object.fromEntries(fmt.formatToParts(date).map(v => [v.type, v.value]));
    const year = +p.year, month = +p.month, day = +p.day;
    const hour = +p.hour, minute = +p.minute, second = +p.second;
    const civil = Date.UTC(year, month - 1, day, hour, minute, second);
    return {
      year, month, day, hour, minute, second, weekday: p.weekday,
      dateKey: `${year}-${pad(month)}-${pad(day)}`,
      offsetMinutes: Math.round((civil - Math.floor(date.getTime() / 1000) * 1000) / 60000)
    };
  }

  function clock(p, h24) {
    return `${h24 ? pad(p.hour) : (p.hour % 12 || 12)}:${pad(p.minute)}`;
  }

  function offsetLabel(minutes) {
    if (!minutes) return "UTC±00:00";
    return `UTC${minutes < 0 ? "−" : "+"}${pad(Math.floor(Math.abs(minutes) / 60))}:${pad(Math.abs(minutes) % 60)}`;
  }

  function dayDifference(a, b) {
    return Math.round((Date.UTC(a.year, a.month - 1, a.day) - Date.UTC(b.year, b.month - 1, b.day)) / DAY);
  }

  function normalizeCities(value) {
    const choices = Array.isArray(value) ? value : [];
    return [...new Set([...choices, ...defaults])]
      .filter(id => cities.some(city => city.id === id)).slice(0, 4);
  }

  // NOAA's approximate solar-position equations, using UTC throughout.
  // https://gml.noaa.gov/grad/solcalc/solareqns.PDF
  function sun(date) {
    const start = Date.UTC(date.getUTCFullYear(), 0, 1);
    const days = (Date.UTC(date.getUTCFullYear() + 1, 0, 1) - start) / DAY;
    const g = 2 * Math.PI / days * ((date.getTime() - start) / DAY - 0.5);
    const eq = 229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g)
      - 0.014615 * Math.cos(2 * g) - 0.040849 * Math.sin(2 * g));
    const dec = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g)
      - 0.006758 * Math.cos(2 * g) + 0.000907 * Math.sin(2 * g)
      - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
    const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes()
      + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000;
    const lon = 180 - (utcMinutes + eq) / 4;
    return { lat: dec / RAD, lon: ((lon + 180) % 360 + 360) % 360 - 180 };
  }

  function elevation(lat, lon, solar) {
    const sin = Math.sin(lat * RAD) * Math.sin(solar.lat * RAD)
      + Math.cos(lat * RAD) * Math.cos(solar.lat * RAD) * Math.cos((lon - solar.lon) * RAD);
    return Math.asin(Math.max(-1, Math.min(1, sin))) / RAD;
  }

  function light(lat, lon, solar) {
    const e = elevation(lat, lon, solar);
    return e >= 0 ? "Daylight" : e >= -6 ? "Twilight" : "Night";
  }

  function timeline(city, start) {
    return Array.from({ length: 96 }, (_, i) => {
      const instant = start + i * HOUR / 4;
      const date = new Date(instant), p = at(date, city.zone);
      return { instant, hour: p.hour, minute: p.minute, dateKey: p.dateKey,
        office: p.hour >= 9 && p.hour < 17, elevation: elevation(city.lat, city.lon, sun(date)) };
    });
  }

  return { cities, defaults, at, clock, offsetLabel, dayDifference,
    normalizeCities, sun, elevation, light, timeline, HOUR, DAY };
})();
