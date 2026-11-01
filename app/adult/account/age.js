// The age gate, asked first (SPEC 8 screen 2). It must agree with the server (deviations D30): only a birth year is asked, so the server
// lets a person in when this year minus the birth year is at least 19, and refuses otherwise. The year is the UTC year, like the server's.
export const MIN_GAP = 19;
export const utcYear = (now = Date.now()) => new Date(now).getUTCFullYear();
export const latestBirthYear = (now) => utcYear(now) - MIN_GAP;
// '1990' -> 1990, anything else (letters, 5 digits, a future year, before 1900) -> null
export function parseYear(text, now) {
  const t = String(text == null ? '' : text).trim();
  if (!/^[0-9]{4}$/.test(t)) return null;
  const y = Number(t);
  return y >= 1900 && y <= utcYear(now) ? y : null;
}
export const ageAllowed = (birthYear, now) => Number.isInteger(birthYear) && utcYear(now) - birthYear >= MIN_GAP;
