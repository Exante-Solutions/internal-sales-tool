/**
 * Google connection state from granted scopes — pure (BUG_FIX B1, BF1).
 *
 * Settings shows per-grant Connected/Disconnect controls for Gmail + Calendar.
 * Google returns scopes as full URLs (and may add openid/email/profile), and the
 * stored string can be space- or comma-joined. Matching MUST be tolerant: a grant
 * is present when ANY scope ends with the readonly suffix — never exact equality.
 *
 * Zero-dep, framework-free; imported by src/app/settings/page.tsx.
 */

/** The suffix that proves a Gmail read grant, regardless of URL prefix. */
const GMAIL_SUFFIX = "gmail.readonly";
/** The suffix that proves a Calendar read grant, regardless of URL prefix. */
const CALENDAR_SUFFIX = "calendar.readonly";

/**
 * @param {string[]|string|null|undefined} scopes
 *   The granted scopes — an array, or a single space/comma-joined string.
 * @returns {{ gmailConnected: boolean, calendarConnected: boolean }}
 */
export function connectionState(scopes) {
  const list = Array.isArray(scopes)
    ? scopes
    : String(scopes ?? "").split(/[\s,]+/);
  const norm = list.map((s) => String(s ?? "").trim().toLowerCase()).filter(Boolean);
  const hasSuffix = (suffix) => norm.some((s) => s.endsWith(suffix));
  return {
    gmailConnected: hasSuffix(GMAIL_SUFFIX),
    calendarConnected: hasSuffix(CALENDAR_SUFFIX),
  };
}
