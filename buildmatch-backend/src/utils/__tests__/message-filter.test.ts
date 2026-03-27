import { describe, it, expect } from 'vitest';
import { filterMessageContent } from '../message-filter';

// ── Helpers ───────────────────────────────────────────────────────────────────

function clean(input: string) {
  return filterMessageContent(input);
}

// ── 1. Phone numbers ──────────────────────────────────────────────────────────

describe('phone numbers', () => {
  it('removes (555) 867-5309 format', () => {
    const r = clean('Call me at (555) 867-5309 anytime.');
    expect(r.filteredContent).toContain('[phone number removed]');
    expect(r.filteredContent).not.toContain('5309');
    expect(r.wasFiltered).toBe(true);
    expect(r.filterReasons).toContain('Phone number');
  });

  it('removes 555-867-5309 format', () => {
    const r = clean('My number is 555-867-5309.');
    expect(r.filteredContent).toContain('[phone number removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes 555.867.5309 format', () => {
    const r = clean('Reach me at 555.867.5309.');
    expect(r.filteredContent).toContain('[phone number removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes 10-digit run-together 5558675309', () => {
    const r = clean('Text 5558675309 for a quote.');
    expect(r.filteredContent).toContain('[phone number removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes +1 555 867 5309 international format', () => {
    const r = clean('WhatsApp me at +1 555 867 5309.');
    expect(r.filteredContent).toContain('[phone number removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes +1-555-867-5309 format', () => {
    const r = clean('Number: +1-555-867-5309');
    expect(r.filteredContent).toContain('[phone number removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes 1 (555) 867-5309 format', () => {
    const r = clean('Call 1 (555) 867-5309 today.');
    expect(r.filteredContent).toContain('[phone number removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('deduplicates reason when multiple phones appear', () => {
    const r = clean('Call (555) 867-5309 or 555-111-2222.');
    expect(r.filterReasons.filter((x) => x === 'Phone number')).toHaveLength(1);
  });
});

// ── 2. Email addresses ────────────────────────────────────────────────────────

describe('email addresses', () => {
  it('removes simple email john@gmail.com', () => {
    const r = clean('Email me at john@gmail.com for details.');
    expect(r.filteredContent).toContain('[email removed]');
    expect(r.filteredContent).not.toContain('gmail.com');
    expect(r.wasFiltered).toBe(true);
    expect(r.filterReasons).toContain('Email address');
  });

  it('removes email with dots and plus john.doe+work@company.com', () => {
    const r = clean('Contact: john.doe+work@company.com');
    expect(r.filteredContent).toContain('[email removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes email with subdomain and country TLD', () => {
    const r = clean('Reach me at user@mail.company.co.uk');
    expect(r.filteredContent).toContain('[email removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('deduplicates reason when multiple emails appear', () => {
    const r = clean('Email a@b.com or c@d.org');
    expect(r.filterReasons.filter((x) => x === 'Email address')).toHaveLength(1);
  });
});

// ── 3. Social media handles ───────────────────────────────────────────────────

describe('social media handles', () => {
  it('removes standalone @mention', () => {
    const r = clean('Find me @johndoe on Instagram.');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.filteredContent).not.toContain('@johndoe');
    expect(r.filterReasons).toContain('Social media handle');
  });

  it('removes instagram.com/username URL', () => {
    const r = clean('My portfolio: instagram.com/johndoe_builds');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes instagram: username colon format', () => {
    const r = clean('Instagram: johndoe_builds');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes venmo.com/username URL', () => {
    const r = clean('Pay at venmo.com/johndoe');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes venmo: username colon format', () => {
    const r = clean('Venmo: johndoe');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes $CashApp handle', () => {
    // "CashApp" (one word) does not trigger the payment pattern (cash\s+app)
    const r = clean('My CashApp handle is $JohnBuilds.');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.filteredContent).not.toContain('$JohnBuilds');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes facebook.com/username', () => {
    const r = clean('See my work at facebook.com/johnbuilds');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes twitter.com/username', () => {
    const r = clean('Follow me: twitter.com/johndoe');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes x.com/username', () => {
    const r = clean('Find me at x.com/johndoe');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes tiktok.com/@username', () => {
    const r = clean('Tiktok: tiktok.com/@johndoe');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes snapchat: username colon format', () => {
    const r = clean('Snap me: snapchat: johndoe');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes whatsapp: username format', () => {
    // Use a plain username so the phone filter does not consume it first
    const r = clean('Message me: whatsapp: johndoe_builds');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes zelle: … format', () => {
    // Use a plain username so the email filter does not consume it first
    const r = clean('Pay me via zelle: johndoe');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('deduplicates Social media handle reason', () => {
    const r = clean('@alice and @bob');
    expect(r.filterReasons.filter((x) => x === 'Social media handle')).toHaveLength(1);
  });
});

// ── 4. Payment app references ─────────────────────────────────────────────────

describe('off-platform payment requests', () => {
  it('removes "venmo me" sentence', () => {
    const r = clean('Just venmo me the deposit and we can start Monday.');
    expect(r.filteredContent).toContain('[payment request removed]');
    expect(r.filterReasons).toContain('Off-platform payment request');
  });

  it('removes "cash app" sentence', () => {
    const r = clean('I prefer cash app for payments.');
    expect(r.filteredContent).toContain('[payment request removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes "zelle me" sentence', () => {
    const r = clean('Can you zelle me the deposit tonight?');
    expect(r.filteredContent).toContain('[payment request removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes "send payment to" sentence', () => {
    const r = clean('Please send payment to my account before we start.');
    expect(r.filteredContent).toContain('[payment request removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes "wire transfer" sentence', () => {
    const r = clean('A wire transfer would work for me.');
    expect(r.filteredContent).toContain('[payment request removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes "western union" sentence', () => {
    const r = clean('You can send via western union if you want.');
    expect(r.filteredContent).toContain('[payment request removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes "pay me on" sentence', () => {
    const r = clean('Just pay me on PayPal and we are good.');
    expect(r.filteredContent).toContain('[payment request removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('deduplicates reason', () => {
    const r = clean('Venmo me now. Also wire transfer works.');
    expect(r.filterReasons.filter((x) => x === 'Off-platform payment request')).toHaveLength(1);
  });
});

// ── 5. External URLs ──────────────────────────────────────────────────────────

describe('external links', () => {
  it('removes unknown http URL', () => {
    const r = clean('Check my site at http://johnsplumbing.com/gallery');
    expect(r.filteredContent).toContain('[link removed]');
    expect(r.filterReasons).toContain('External link');
  });

  it('removes unknown https URL', () => {
    const r = clean('See my reviews at https://johnscontracting.net');
    expect(r.filteredContent).toContain('[link removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('removes www. prefixed URL', () => {
    const r = clean('Visit www.mybusiness.com for more info.');
    expect(r.filteredContent).toContain('[link removed]');
    expect(r.wasFiltered).toBe(true);
  });

  it('keeps buildmatch.com URLs', () => {
    const r = clean('See the job at buildmatch.com/jobs/123');
    expect(r.filteredContent).not.toContain('[link removed]');
    expect(r.wasFiltered).toBe(false);
  });

  it('keeps google.com URLs', () => {
    const r = clean('My reviews: https://google.com/maps/place/myshop');
    expect(r.filteredContent).not.toContain('[link removed]');
    expect(r.wasFiltered).toBe(false);
  });

  it('keeps yelp.com URLs', () => {
    const r = clean('Check yelp.com/biz/johns-plumbing-nyc for ratings.');
    expect(r.filteredContent).not.toContain('[link removed]');
    expect(r.wasFiltered).toBe(false);
  });

  it('keeps bbb.org URLs', () => {
    const r = clean('My BBB profile: https://bbb.org/us/ny/new-york/profile/123');
    expect(r.filteredContent).not.toContain('[link removed]');
    expect(r.wasFiltered).toBe(false);
  });

  it('keeps angieslist.com URLs', () => {
    const r = clean('Find me on angieslist.com/companylist/us/ny/john.htm');
    expect(r.filteredContent).not.toContain('[link removed]');
    expect(r.wasFiltered).toBe(false);
  });

  it('keeps houzz.com URLs', () => {
    const r = clean('Portfolio at houzz.com/pro/johndoe');
    expect(r.filteredContent).not.toContain('[link removed]');
    expect(r.wasFiltered).toBe(false);
  });
});

// ── 6. Clean messages pass through unchanged ──────────────────────────────────

describe('clean messages', () => {
  it('passes through plain text', () => {
    const msg = 'I can start the job on Monday morning. Does 8am work for you?';
    const r = clean(msg);
    expect(r.filteredContent).toBe(msg);
    expect(r.wasFiltered).toBe(false);
    expect(r.filterReasons).toHaveLength(0);
  });

  it('passes through message with price', () => {
    const msg = 'My estimate for the full job is $4,500 including materials.';
    const r = clean(msg);
    expect(r.filteredContent).toBe(msg);
    expect(r.wasFiltered).toBe(false);
  });

  it('passes through message with a date', () => {
    const msg = 'I can have it done by 03/15/2026.';
    const r = clean(msg);
    expect(r.filteredContent).toBe(msg);
    expect(r.wasFiltered).toBe(false);
  });

  it('passes through message with safe URL', () => {
    const msg = 'My work is listed on yelp.com/biz/johns-plumbing.';
    const r = clean(msg);
    expect(r.filteredContent).toBe(msg);
    expect(r.wasFiltered).toBe(false);
  });
});

// ── 7. Multiple violations in one message ─────────────────────────────────────

describe('multiple violations', () => {
  it('strips phone + email in same message', () => {
    const r = clean('Call me at (555) 867-5309 or email john@example.com.');
    expect(r.filteredContent).toContain('[phone number removed]');
    expect(r.filteredContent).toContain('[email removed]');
    expect(r.filterReasons).toContain('Phone number');
    expect(r.filterReasons).toContain('Email address');
    expect(r.wasFiltered).toBe(true);
  });

  it('strips email + social handle in same message', () => {
    const r = clean('Email me at bob@example.com or DM @bobbuilds.');
    expect(r.filteredContent).toContain('[email removed]');
    expect(r.filteredContent).toContain('[contact info removed]');
    expect(r.filterReasons).toContain('Email address');
    expect(r.filterReasons).toContain('Social media handle');
  });

  it('strips phone + external link in same message', () => {
    const r = clean('Call 555-123-4567 or visit http://bobsplumbing.com.');
    expect(r.filteredContent).toContain('[phone number removed]');
    expect(r.filteredContent).toContain('[link removed]');
  });

  it('strips all five categories in one message', () => {
    // Use periods as sentence terminators so the payment pattern does not
    // consume the @bobbuilds handle that appears in a separate clause.
    const r = clean(
      'Call (555) 123-4567. Email bob@foo.com. Follow @bobbuilds. ' +
      'Venmo me the deposit. Visit http://bobsplumbing.com.',
    );
    expect(r.filterReasons).toContain('Phone number');
    expect(r.filterReasons).toContain('Email address');
    expect(r.filterReasons).toContain('Social media handle');
    expect(r.filterReasons).toContain('Off-platform payment request');
    expect(r.filterReasons).toContain('External link');
    expect(r.filterReasons).toHaveLength(5);
    expect(r.wasFiltered).toBe(true);
  });
});
