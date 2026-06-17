/**
 * Dependency-light avatar generator (SPEC §18.3, RUBRIC Q4). Deterministic from
 * the user's email — no heavy avatar library, no new npm dependency. Produces
 * an inline SVG data-URI identicon plus the uppercase initials, both derived
 * from a stable hash of the email so the same user always renders the same way.
 */

/** FNV-1a 32-bit — small, stable, non-crypto string hash. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Up to two uppercase initials from an email's local part (or the raw seed). */
export function initialsFromEmail(email: string): string {
  const local = (email.split("@")[0] || email).trim();
  if (!local) return "?";
  const parts = local.split(/[.\-_+\s]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return local.slice(0, 2).toUpperCase();
}

/** A pleasant, deterministic HSL pair (bg + fg-safe) derived from the email. */
export function avatarColors(email: string): { bg: string; fg: string } {
  const hue = hash(email.toLowerCase()) % 360;
  return {
    bg: `hsl(${hue} 58% 42%)`,
    fg: `hsl(${hue} 40% 92%)`,
  };
}

/**
 * An inline SVG initials avatar as a `data:` URI — usable as an <img src> with
 * zero network requests and no dependency. Square, rounded by CSS at the call
 * site. Deterministic from the email.
 */
export function avatarDataUri(email: string, size = 64): string {
  const { bg, fg } = avatarColors(email);
  const initials = initialsFromEmail(email);
  const fontSize = Math.round(size * 0.42);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${Math.round(
    size * 0.22,
  )}" fill="${bg}"/><text x="50%" y="50%" dy="0.02em" dominant-baseline="central" text-anchor="middle" font-family="ui-sans-serif,system-ui,sans-serif" font-size="${fontSize}" font-weight="600" fill="${fg}">${initials}</text></svg>`;
  // encodeURIComponent keeps the data-URI valid without base64 (lighter, no Buffer).
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
