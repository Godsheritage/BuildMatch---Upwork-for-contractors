// ── Types ─────────────────────────────────────────────────────────────────────

export interface FilterResult {
  /** The cleaned message text with violations replaced. */
  filteredContent: string;
  /** true if any replacement was made. */
  wasFiltered: boolean;
  /** Deduplicated human-readable list of what was found. */
  filterReasons: string[];
}

// ── Safe-domain whitelist ─────────────────────────────────────────────────────

const SAFE_DOMAINS = [
  'buildmatch\\.com',
  'google\\.com',
  'yelp\\.com',
  'bbb\\.org',
  'angieslist\\.com',
  'houzz\\.com',
];

// Matches any URL whose host is NOT in the whitelist.
// Pattern: https?:// OR www. followed by a domain that isn't whitelisted.
const SAFE_DOMAIN_PATTERN = SAFE_DOMAINS.map((d) => `(?:${d})`).join('|');

// ── Filter patterns ───────────────────────────────────────────────────────────
// Each entry: [regex, replacement, reason label]

export const FILTER_PATTERNS: Array<[RegExp, string, string]> = [
  // ── 1. Phone numbers ─────────────────────────────────────────────────────
  // Covers: (555) 867-5309 · 555-867-5309 · 555.867.5309 ·
  //         5558675309 · +1 555 867 5309 · +1-555-867-5309 ·
  //         1 (555) 867-5309
  [
    /(?:\+?1[\s\-.]?)?(?:\(?\d{3}\)?[\s\-.]?)[\d]{3}[\s\-.]?\d{4}/gi,
    '[phone number removed]',
    'Phone number',
  ],

  // ── 2. Email addresses ────────────────────────────────────────────────────
  [
    /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/gi,
    '[email removed]',
    'Email address',
  ],

  // ── 3. Payment-app references (full sentence/clause replacement) ──────────
  // Must run before social-media handles so "venmo me @user" is caught once.
  [
    /[^.!?\n]*(?:venmo\s+me|cash\s+app|zelle\s+me|pay\s+me\s+on|send\s+payment\s+to|wire\s+transfer|western\s+union)[^.!?\n]*/gi,
    '[payment request removed]',
    'Off-platform payment request',
  ],

  // ── 4. Social media / payment handles ────────────────────────────────────

  // Known platform URLs: instagram, venmo, cashapp, facebook, fb, twitter,
  // x.com, linkedin, tiktok, snapchat, whatsapp
  [
    /(?:(?:www\.)?(?:instagram|venmo|cashapp|facebook|fb|twitter|x|linkedin\.com\/in|tiktok|snapchat|whatsapp)\.com\/[@$]?[\w.\-]+)/gi,
    '[contact info removed]',
    'Social media handle',
  ],

  // Platform colon patterns: "instagram: user", "venmo: user", "snapchat: user",
  // "whatsapp: user", "zelle: ..."
  [
    /(?:instagram|venmo|snapchat|whatsapp|zelle)\s*:\s*[\w.\-@+]+/gi,
    '[contact info removed]',
    'Social media handle',
  ],

  // Cash App $handle (e.g. $JohnDoe)
  [
    /\$[a-zA-Z][\w.\-]{2,}/g,
    '[contact info removed]',
    'Social media handle',
  ],

  // Standalone @mention (after email check so foo@bar.com is already gone)
  [
    /@[\w.\-]{2,}/g,
    '[contact info removed]',
    'Social media handle',
  ],

  // ── 5. External URLs (non-whitelisted) ───────────────────────────────────
  [
    new RegExp(
      `(?:https?:\\/\\/|www\\.)(?!(?:${SAFE_DOMAIN_PATTERN}))(?:[\\w\\-]+\\.)+[a-z]{2,}(?:\\/[^\\s]*)?`,
      'gi',
    ),
    '[link removed]',
    'External link',
  ],
];

// ── Main function ─────────────────────────────────────────────────────────────

export function filterMessageContent(content: string): FilterResult {
  let filteredContent = content;
  const reasonsSet = new Set<string>();

  for (const [pattern, replacement, reason] of FILTER_PATTERNS) {
    // Reset lastIndex for global regexes (safety when reusing the exported map)
    pattern.lastIndex = 0;
    const replaced = filteredContent.replace(pattern, replacement);
    if (replaced !== filteredContent) {
      reasonsSet.add(reason);
      filteredContent = replaced;
    }
  }

  return {
    filteredContent,
    wasFiltered: reasonsSet.size > 0,
    filterReasons: Array.from(reasonsSet),
  };
}
