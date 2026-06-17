/**
 * Nav active-state resolution — pure (BUG_FIX B11, BF11).
 *
 * The sidebar has two links onto `/conversations`: the **Calls** tab
 * (`/conversations`) and the **Unassigned inbox** (`/conversations?inbox=1`).
 * A query-blind `pathname.startsWith()` highlights Calls on the inbox and never
 * highlights the inbox. The fix makes the check query-aware:
 *
 *   - The Unassigned-inbox href is active iff the current path is
 *     `/conversations` AND the inbox/unassigned param is present in `search`.
 *   - The Calls href is active iff the current path is `/conversations` AND that
 *     param is ABSENT (mutually exclusive with the inbox).
 *   - `/` is active only on the exact `/` path.
 *   - Any other href is active when `pathname` starts with the href's path
 *     (query stripped).
 *
 * Zero-dep, framework-free; imported by src/components/app-nav.tsx.
 */

const CONVERSATIONS = "/conversations";
/** Params that mark the Unassigned-inbox view (standardized on `inbox`). */
const INBOX_PARAMS = ["inbox", "unassigned"];

/**
 * @param {string} search A query string, with or without the leading `?`
 *   (e.g. `"?inbox=1"` or `"inbox=1"` or `""`).
 * @returns {boolean} Whether an inbox/unassigned param is present.
 */
function hasInboxParam(search) {
  const qs = String(search ?? "").replace(/^\?/, "");
  if (!qs) return false;
  const params = new URLSearchParams(qs);
  return INBOX_PARAMS.some((p) => params.has(p));
}

/**
 * @param {string} pathname Current path (no query), e.g. `"/conversations"`.
 * @param {string} search Current query string (`"?inbox=1"`, `"inbox=1"`, `""`).
 * @param {string} href The nav link's href, possibly with a query.
 * @returns {boolean} Whether the link should render as active.
 */
export function navActive(pathname, search, href) {
  const path = String(pathname ?? "");
  const base = String(href ?? "").split("?")[0];
  const hrefHasInbox = hasInboxParam(String(href ?? "").split("?")[1] ?? "");

  // Query-aware split for the two /conversations links.
  if (base === CONVERSATIONS) {
    if (path !== CONVERSATIONS) return false;
    const inboxActive = hasInboxParam(search);
    return hrefHasInbox ? inboxActive : !inboxActive;
  }

  if (base === "/") return path === "/";
  return path.startsWith(base);
}
