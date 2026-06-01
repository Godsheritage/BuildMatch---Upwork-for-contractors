import prisma from '../lib/prisma';
import { sendEmail } from './email.service';
import type { WaitlistInput } from '../schemas/waitlist.schemas';

export async function addToWaitlist(input: WaitlistInput): Promise<void> {
  await prisma.waitlistSignup.upsert({
    where:  { email: input.email },
    update: { role: input.role ?? null },
    create: { name: input.name, email: input.email, role: input.role ?? null },
  });

  const roleLabel = input.role === 'INVESTOR' ? 'investor' : input.role === 'CONTRACTOR' ? 'contractor' : null;
  const roleNote  = roleLabel
    ? `<p style="color:#6B6B67;line-height:1.6">We've noted that you're joining as an <strong style="color:#1A1A18">${roleLabel}</strong> — we'll make sure your onboarding experience is tailored for you.</p>`
    : '';

  await sendEmail({
    to:      input.email,
    subject: "You're on the BuildMatch waitlist!",
    html: `
      <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#1A1A18">
        <h2 style="color:#1B3A5C;margin-bottom:8px">You're on the list, ${input.name}!</h2>
        <p style="color:#6B6B67;line-height:1.6">Thanks for signing up. We'll reach out the moment BuildMatch goes live on <strong style="color:#1A1A18">July 1st, 2026</strong>.</p>
        ${roleNote}
        <p style="color:#6B6B67;line-height:1.6">BuildMatch connects real-estate investors with licensed, vetted contractors — faster and smarter than ever.</p>
        <p style="margin-top:24px;color:#6B6B67">— The BuildMatch Team</p>
      </div>
    `,
    text: `Hi ${input.name}, you're on the BuildMatch waitlist! We'll reach out when we go live on July 1st, 2026. — The BuildMatch Team`,
  }).catch((err) => console.error('[waitlist] email failed:', err));
}
