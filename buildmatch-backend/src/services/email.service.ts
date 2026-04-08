// ── Provider-agnostic email sender ───────────────────────────────────────────
//
// Selects a provider at runtime:
//   • If RESEND_API_KEY is set → POST to Resend's HTTP API (no SDK install)
//   • Otherwise → log to the console so dev environments work with zero setup
//
// All outbound mail in BuildMatch should funnel through here. The dispute and
// draw notification services have their own console-only deliverEmail()
// helpers today; those can be migrated to call sendEmail() in a follow-up PR.

interface SendEmailInput {
  to:       string;
  subject:  string;
  html:     string;
  text?:    string;
}

const FROM = process.env.EMAIL_FROM ?? 'BuildMatch <noreply@buildmatch.us>';

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    // Dev fallback — log a copy of the message so devs can grab links etc.
    console.log('────────────────────────────────────────────────');
    console.log(`[email] To:      ${input.to}`);
    console.log(`[email] Subject: ${input.subject}`);
    if (input.text) console.log(`[email] Body:    ${input.text}`);
    console.log('────────────────────────────────────────────────');
    return;
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method:  'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from:    FROM,
        to:      [input.to],
        subject: input.subject,
        html:    input.html,
        text:    input.text,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[email] Resend ${res.status}:`, body);
      // Non-fatal: never let email failures break the calling request.
    }
  } catch (err) {
    console.error('[email] send failed:', err);
  }
}
