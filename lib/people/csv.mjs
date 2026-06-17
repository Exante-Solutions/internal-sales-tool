/**
 * Pure CSV parser for bulk people import (SPEC §18.5). Single source of truth so
 * the route + tests share one implementation (same pattern as lib/scoring,
 * lib/ingest). No framework, no SDK, no validator imports — plain ESM.
 *
 *   parsePeopleCsv(text) -> [{ displayName, emails: string[], company?: string }]
 *
 * Tolerant of header order/case, quoted fields (incl. embedded commas + escaped
 * "" quotes), CRLF/LF, BOM, and blank lines. Trims every cell. Multiple emails
 * may live in one cell (separated by ; , or whitespace) or across `email`/`emails`
 * columns. Identity resolution + dedupe happen downstream (§4.3) — this only shapes
 * rows. Rows with neither a name nor an email are skipped.
 */

/** Split one CSV line into fields, honoring quotes and "" escapes. */
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Normalize a header cell to a canonical key. */
function headerKey(raw) {
  return raw.trim().toLowerCase().replace(/^﻿/, "").replace(/[\s_-]+/g, "");
}

const NAME_KEYS = new Set(["displayname", "name", "fullname", "person", "contact"]);
const EMAIL_KEYS = new Set(["email", "emails", "emailaddress", "emailaddresses", "mail"]);
const COMPANY_KEYS = new Set(["company", "companyname", "organization", "organisation", "org", "account"]);

/** Split a cell that may hold several emails (`;`, `,`, or whitespace separated). */
function splitEmails(cell) {
  if (!cell) return [];
  return cell
    .split(/[;,\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * Parse a people CSV into shaped rows. Header row is required (any order/case);
 * an `email`/`emails` and/or `name` column are recognized. Blank lines skipped.
 */
export function parsePeopleCsv(text) {
  if (typeof text !== "string") return [];
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map(headerKey);
  const out = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => c === "")) continue;

    let displayName = "";
    let company;
    const emails = [];

    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      const val = (cells[c] ?? "").trim();
      if (!val) continue;
      if (NAME_KEYS.has(key) && !displayName) {
        displayName = val;
      } else if (EMAIL_KEYS.has(key)) {
        for (const e of splitEmails(val)) {
          if (!emails.includes(e)) emails.push(e);
        }
      } else if (COMPANY_KEYS.has(key) && !company) {
        company = val;
      }
    }

    // Skip rows with neither a name nor any email.
    if (!displayName && emails.length === 0) continue;

    // Fall back to the local-part of the first email when no name is given.
    if (!displayName && emails.length > 0) {
      displayName = emails[0].split("@")[0];
    }

    const row = { displayName, emails };
    if (company) row.company = company;
    out.push(row);
  }

  return out;
}
