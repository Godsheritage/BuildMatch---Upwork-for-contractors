import { Link } from 'react-router-dom';

const LAST_UPDATED = 'March 26, 2026';

interface SectionProps {
  num: number;
  title: string;
  children: React.ReactNode;
}

function Section({ num, title, children }: SectionProps) {
  return (
    <section style={{ marginBottom: 36 }}>
      <h2 style={{
        fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)',
        letterSpacing: '-0.01em', marginBottom: 12,
        display: 'flex', alignItems: 'baseline', gap: 10,
      }}>
        <span style={{ color: 'var(--color-text-muted)', fontSize: 14, fontWeight: 500 }}>{num}.</span>
        {title}
      </h2>
      <div style={{ fontSize: 14, color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
        {children}
      </div>
    </section>
  );
}

export function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>

      {/* Nav */}
      <header style={{
        borderBottom: '1px solid var(--color-border)',
        padding: '0 40px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        position: 'sticky', top: 0, background: 'var(--color-bg)', zIndex: 10,
      }}>
        <Link to="/" style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text-primary)', textDecoration: 'none', letterSpacing: '-0.02em' }}>
          BuildMatch
        </Link>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <Link to="/login" style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none' }}>Sign in</Link>
          <Link
            to="/register"
            style={{
              fontSize: 13, fontWeight: 500, color: '#fff',
              background: 'var(--color-primary)', textDecoration: 'none',
              padding: '7px 16px', borderRadius: 8,
            }}
          >
            Create account
          </Link>
        </div>
      </header>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px 80px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 48 }}>
          <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Legal
          </p>
          <h1 style={{ fontSize: 32, fontWeight: 600, color: 'var(--color-text-primary)', letterSpacing: '-0.03em', marginBottom: 12 }}>
            Terms &amp; Conditions
          </h1>
          <p style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
            Last updated: {LAST_UPDATED}
          </p>
          <div style={{
            marginTop: 24, padding: '16px 20px',
            background: 'var(--color-surface)', borderRadius: 10,
            border: '1px solid var(--color-border)',
            fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7,
          }}>
            Please read these Terms &amp; Conditions carefully before using the BuildMatch platform. By creating an account or using our services, you agree to be bound by these terms. If you do not agree, please do not use the platform.
          </div>
        </div>

        {/* Sections */}
        <Section num={1} title="Acceptance of Terms">
          <p>
            By accessing or using BuildMatch (&ldquo;the Platform,&rdquo; &ldquo;we,&rdquo; &ldquo;our,&rdquo; or &ldquo;us&rdquo;), you agree to comply with and be legally bound by these Terms &amp; Conditions and our Privacy Policy. These terms apply to all users of the Platform, including investors, contractors, and visitors.
          </p>
          <p style={{ marginTop: 10 }}>
            We reserve the right to update or modify these Terms at any time. Continued use of the Platform after changes are posted constitutes your acceptance of the revised Terms.
          </p>
        </Section>

        <Section num={2} title="Description of Service">
          <p>
            BuildMatch is a marketplace platform that connects property investors and real estate developers (&ldquo;Investors&rdquo;) with skilled contractors and tradespeople (&ldquo;Contractors&rdquo;). The Platform allows Investors to post job listings, review contractor profiles, and accept bids, while Contractors can create profiles, browse job listings, and submit bids.
          </p>
          <p style={{ marginTop: 10 }}>
            BuildMatch acts solely as an intermediary and is not a party to any agreement made between Investors and Contractors. We do not employ, supervise, or control the work performed by Contractors.
          </p>
        </Section>

        <Section num={3} title="Account Registration">
          <p>To use the full features of BuildMatch, you must create an account. You agree to:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Provide accurate, current, and complete information during registration.</li>
            <li>Maintain and promptly update your account information.</li>
            <li>Keep your password secure and confidential.</li>
            <li>Notify us immediately of any unauthorized use of your account.</li>
            <li>Take full responsibility for all activities that occur under your account.</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            You must be at least 18 years of age to create an account. By registering, you represent that you meet this requirement.
          </p>
        </Section>

        <Section num={4} title="User Conduct">
          <p>You agree not to use the Platform to:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Post false, misleading, or fraudulent information.</li>
            <li>Solicit, advertise, or promote services outside of the Platform's intended use.</li>
            <li>Harass, threaten, or harm other users.</li>
            <li>Violate any applicable local, state, national, or international law or regulation.</li>
            <li>Attempt to gain unauthorized access to any part of the Platform or its systems.</li>
            <li>Use automated tools (bots, scrapers, crawlers) to extract data without written permission.</li>
            <li>Circumvent any technical measures we use to restrict Platform access.</li>
          </ul>
        </Section>

        <Section num={5} title="Contractor Responsibilities">
          <p>Contractors who use BuildMatch agree to:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Accurately represent their qualifications, licenses, and experience on their profile.</li>
            <li>Only submit bids for work they are qualified and legally authorized to perform.</li>
            <li>Maintain all required licenses, insurance, and certifications required by applicable law.</li>
            <li>Fulfill any agreements made with Investors promptly and professionally.</li>
            <li>Promptly notify BuildMatch if their credentials change or expire.</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            BuildMatch does not verify the accuracy of contractor credentials. We encourage Investors to independently verify contractor licenses and insurance before hiring.
          </p>
        </Section>

        <Section num={6} title="Investor Responsibilities">
          <p>Investors who use BuildMatch agree to:</p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Post job listings that accurately describe the scope of work and budget.</li>
            <li>Review bids fairly and communicate clearly with contractors.</li>
            <li>Honor commitments made to contractors upon accepting a bid.</li>
            <li>Pay contractors promptly according to any agreed-upon terms.</li>
            <li>Not post job listings for illegal or prohibited activities.</li>
          </ul>
        </Section>

        <Section num={7} title="Fees and Payments">
          <p>
            BuildMatch currently provides its core services free of charge during our early access period. We reserve the right to introduce subscription fees, transaction fees, or premium features in the future. Any changes to our fee structure will be communicated with at least 30 days&rsquo; notice.
          </p>
          <p style={{ marginTop: 10 }}>
            All financial transactions between Investors and Contractors are conducted directly between the parties. BuildMatch is not responsible for any payment disputes, non-payment, or financial losses arising from transactions between users.
          </p>
        </Section>

        <Section num={8} title="Intellectual Property">
          <p>
            All content, features, and functionality on the Platform — including but not limited to text, graphics, logos, icons, and software — are owned by or licensed to BuildMatch and are protected by applicable intellectual property laws.
          </p>
          <p style={{ marginTop: 10 }}>
            By posting content on the Platform (including job listings, bids, reviews, and profile information), you grant BuildMatch a non-exclusive, royalty-free, worldwide license to use, display, and distribute such content solely for the purpose of operating and improving the Platform.
          </p>
        </Section>

        <Section num={9} title="Limitation of Liability">
          <p>
            To the maximum extent permitted by law, BuildMatch and its officers, directors, employees, and agents shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Platform, including but not limited to:
          </p>
          <ul style={{ marginTop: 10, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Disputes between Investors and Contractors.</li>
            <li>Work quality, timeliness, or outcomes of any contracted services.</li>
            <li>Loss of data, revenue, or business opportunities.</li>
            <li>Errors or inaccuracies in user-submitted content.</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            Our total liability in any matter shall not exceed $100 USD or the amount you paid to BuildMatch in the 12 months preceding the event giving rise to the claim, whichever is greater.
          </p>
        </Section>

        <Section num={10} title="Termination">
          <p>
            We reserve the right to suspend or terminate your account at any time, with or without notice, for any reason, including if we believe you have violated these Terms. You may also delete your account at any time by contacting us.
          </p>
          <p style={{ marginTop: 10 }}>
            Upon termination, your right to access the Platform ceases immediately. Sections of these Terms that by their nature should survive termination (including intellectual property rights, disclaimers, and limitation of liability) shall survive.
          </p>
        </Section>

        <Section num={11} title="Governing Law">
          <p>
            These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions. Any disputes arising from these Terms or your use of the Platform shall be resolved exclusively in the state or federal courts located in Delaware.
          </p>
        </Section>

        <Section num={12} title="Contact Us">
          <p>
            If you have any questions about these Terms &amp; Conditions, please contact us at:
          </p>
          <div style={{
            marginTop: 12, padding: '14px 18px',
            background: 'var(--color-surface)', borderRadius: 8,
            border: '1px solid var(--color-border)',
          }}>
            <p style={{ fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 4 }}>BuildMatch, Inc.</p>
            <p>Email: <a href="mailto:legal@buildmatch.com" style={{ color: 'var(--color-primary)' }}>legal@buildmatch.com</a></p>
            <p>Address: 651 N Broad St, Suite 201, Middletown, DE 19709</p>
          </div>
        </Section>

        {/* Footer */}
        <div style={{
          paddingTop: 32, borderTop: '1px solid var(--color-border)',
          display: 'flex', gap: 24, flexWrap: 'wrap',
        }}>
          <Link to="/register" style={{ fontSize: 13, color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 500 }}>
            Create an account
          </Link>
          <Link to="/login" style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            Sign in
          </Link>
          <Link to="/" style={{ fontSize: 13, color: 'var(--color-text-muted)', textDecoration: 'none' }}>
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
