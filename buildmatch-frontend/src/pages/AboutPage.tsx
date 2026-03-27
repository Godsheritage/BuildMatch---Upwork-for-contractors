import { Link } from 'react-router-dom';
import {
  ShieldCheck, Star, DollarSign, Users,
  Zap, Heart, Globe, ArrowRight,
  Building2, HardHat,
} from 'lucide-react';
import styles from './AboutPage.module.css';

// ── Data ──────────────────────────────────────────────────────────────────────

const STATS = [
  { value: '5,000+',  label: 'Verified contractors' },
  { value: '12,000+', label: 'Projects posted'       },
  { value: '38',      label: 'States covered'        },
  { value: '96%',     label: 'Satisfaction rate'     },
];

const VALUES = [
  {
    icon: ShieldCheck,
    title: 'Trust above all',
    desc: 'Every contractor is verified before they can bid. License checks, insurance reviews, and real reviews from real projects — because your home deserves more than a gamble.',
  },
  {
    icon: Heart,
    title: 'Built for people',
    desc: 'Behind every job post is someone trying to improve their home. Behind every bid is a tradesperson trying to grow their business. We never lose sight of the humans in the transaction.',
  },
  {
    icon: DollarSign,
    title: 'Fair for everyone',
    desc: 'Investors get competitive bids without the runaround. Contractors get real leads without paying per click. Transparent pricing, no hidden fees, no surprises.',
  },
  {
    icon: Globe,
    title: 'Local at heart',
    desc: 'We believe great contractors are already in your neighborhood. Our job is to make sure they find you — and you find them — before the next storm hits or the leak gets worse.',
  },
];

const WHO_WE_SERVE = [
  {
    role: 'Investors & Homeowners',
    icon: Building2,
    color: '#1B3A5C',
    bg: '#EFF6FF',
    headline: 'Your project, your terms.',
    desc: 'Post a job in minutes, receive competitive bids from licensed pros near you, and hire with confidence — all without a single cold call or referral chase.',
    quote: '"I posted my kitchen renovation on a Tuesday and had five qualified bids by Thursday. Hired someone local with great reviews. The whole process was transparent and stress-free."',
    author: 'Priya T., homeowner in Austin, TX',
    cta: 'Post a job',
    href: '/register',
  },
  {
    role: 'Contractors & Tradespeople',
    icon: HardHat,
    color: '#0F6E56',
    bg: '#F0FDF4',
    headline: 'Win the work you want.',
    desc: 'Browse open jobs that match your trade and territory. Submit bids on your terms. No cold leads, no subscription fees per bid — just real jobs from real project owners.',
    quote: '"Before BuildMatch I spent half my time chasing leads. Now I filter by job type and location, submit a bid in ten minutes, and close more work than ever. My pipeline has doubled."',
    author: 'DeShawn M., licensed electrician in Atlanta, GA',
    cta: 'Create your profile',
    href: '/register',
  },
];

const DIFFERENCES = [
  {
    icon: Star,
    title: 'Verified, rated, accountable',
    desc: 'Ratings only unlock after a project is marked complete — no fake reviews, no pay-to-rank. Every contractor on BuildMatch has been through a credentials review.',
  },
  {
    icon: Zap,
    title: 'Smart matching, not just search',
    desc: 'Our AI reads your job description and routes it to the right contractors by trade type, location, and availability — so the bids you get are actually relevant.',
  },
  {
    icon: Users,
    title: 'A community, not just a marketplace',
    desc: 'When a contractor wins a job on BuildMatch, a local business grows. When a homeowner hires locally, a community thrives. Every transaction on this platform has a ripple effect.',
  },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export function AboutPage() {
  return (
    <div className={styles.page}>

      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navWordmark}>BuildMatch</Link>
        <div className={styles.navLinks}>
          <Link to="/contractors" className={styles.navLink}>Find Contractors</Link>
          <Link to="/about" className={styles.navLink} style={{ color: 'var(--color-text-primary)' }}>About</Link>
        </div>
        <div className={styles.navActions}>
          <Link to="/login"    className={styles.navSignIn}>Sign in</Link>
          <Link to="/register" className={styles.navSignUp}>Get started</Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroPill}>Our mission</div>
          <h1 className={styles.heroHeading}>
            The marketplace where<br />
            great work gets done.
          </h1>
          <p className={styles.heroSub}>
            BuildMatch connects real estate investors and homeowners with licensed,
            vetted contractors across the country — making it easier to hire the right
            person, at the right price, for the right job.
          </p>
          <div className={styles.heroActions}>
            <Link to="/register" className={styles.heroCta}>
              Start a project <ArrowRight size={15} strokeWidth={2} />
            </Link>
            <Link to="/contractors" className={styles.heroSecondary}>
              Browse contractors
            </Link>
          </div>
        </div>
        <div className={styles.heroOverlay} aria-hidden="true" />
      </section>

      {/* ── Stats ── */}
      <section className={styles.stats}>
        <div className={styles.statsInner}>
          {STATS.map(({ value, label }) => (
            <div key={label} className={styles.statItem}>
              <span className={styles.statValue}>{value}</span>
              <span className={styles.statLabel}>{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Story ── */}
      <section className={styles.story}>
        <div className={styles.storyInner}>
          <div className={styles.storyText}>
            <p className={styles.eyebrow}>Our story</p>
            <h2 className={styles.storyHeading}>
              We built what we wished existed.
            </h2>
            <p className={styles.storyBody}>
              BuildMatch started when our founders — a property developer and a retired
              electrician — kept running into the same problem from opposite sides: finding
              reliable, qualified contractors was a full-time job on its own. Homeowners
              were flying blind, relying on word-of-mouth and luck. Skilled tradespeople
              were spending more time chasing leads than doing the work they trained for.
            </p>
            <p className={styles.storyBody}>
              So we built a platform that fixes both. One that respects the trade, protects
              the homeowner, and makes the whole process — from posting a job to shaking
              hands on a deal — feel less like a gamble and more like a system that actually
              works.
            </p>
            <p className={styles.storyBody}>
              Today, BuildMatch operates across 38 states, with thousands of verified
              contractors and tens of thousands of completed projects. We're just getting
              started.
            </p>
          </div>
          <div className={styles.storyAside}>
            <div className={styles.storyCard}>
              <p className={styles.storyCardQuote}>
                "The home services industry is a $600 billion market where trust has always
                been the missing ingredient. We built BuildMatch to be the platform that
                finally gets that right."
              </p>
              <div className={styles.storyCardAuthor}>
                <div className={styles.storyCardAvatar}>JA</div>
                <div>
                  <p className={styles.storyCardName}>James & Adaeze Okonkwo</p>
                  <p className={styles.storyCardRole}>Co-founders, BuildMatch</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Who we serve ── */}
      <section className={styles.serve}>
        <div className={styles.serveInner}>
          <p className={styles.eyebrow}>Who we serve</p>
          <h2 className={styles.serveHeading}>Two sides. One platform.</h2>
          <p className={styles.serveSubtitle}>
            BuildMatch is designed so both investors and contractors come out ahead — every time.
          </p>
          <div className={styles.serveGrid}>
            {WHO_WE_SERVE.map(({ role, icon: Icon, color, bg, headline, desc, quote, author, cta, href }) => (
              <div key={role} className={styles.serveCard}>
                <div className={styles.serveCardHeader} style={{ background: bg }}>
                  <div className={styles.serveRoleIcon} style={{ background: color }}>
                    <Icon size={20} color="#fff" strokeWidth={1.75} />
                  </div>
                  <p className={styles.serveRole} style={{ color }}>{role}</p>
                </div>
                <div className={styles.serveCardBody}>
                  <h3 className={styles.serveCardHeadline}>{headline}</h3>
                  <p className={styles.serveCardDesc}>{desc}</p>
                  <blockquote className={styles.serveQuote}>
                    <p className={styles.serveQuoteText}>{quote}</p>
                    <footer className={styles.serveQuoteAuthor}>— {author}</footer>
                  </blockquote>
                  <Link to={href} className={styles.serveCardCta} style={{ color, borderColor: color }}>
                    {cta} <ArrowRight size={13} strokeWidth={2} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Values ── */}
      <section className={styles.values}>
        <div className={styles.valuesInner}>
          <p className={styles.eyebrow}>What we stand for</p>
          <h2 className={styles.valuesHeading}>The principles we build on.</h2>
          <div className={styles.valuesGrid}>
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className={styles.valueCard}>
                <div className={styles.valueIconWrap}>
                  <Icon size={20} strokeWidth={1.75} color="var(--color-primary)" />
                </div>
                <h3 className={styles.valueTitle}>{title}</h3>
                <p className={styles.valueDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How we're different ── */}
      <section className={styles.diff}>
        <div className={styles.diffInner}>
          <p className={styles.eyebrow}>Why BuildMatch</p>
          <h2 className={styles.diffHeading}>Not just another job board.</h2>
          <div className={styles.diffGrid}>
            {DIFFERENCES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className={styles.diffItem}>
                <div className={styles.diffIconWrap}>
                  <Icon size={22} strokeWidth={1.75} color="var(--color-accent)" />
                </div>
                <h3 className={styles.diffTitle}>{title}</h3>
                <p className={styles.diffDesc}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Join CTA ── */}
      <section className={styles.cta}>
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaHeading}>
            Ready to get to work?
          </h2>
          <p className={styles.ctaSub}>
            Whether you have a project to post or a trade to grow, BuildMatch is built for you.
          </p>
          <div className={styles.ctaCards}>
            <div className={styles.ctaCard}>
              <Building2 size={28} strokeWidth={1.5} color="var(--color-primary)" />
              <h3 className={styles.ctaCardTitle}>I'm an investor or homeowner</h3>
              <p className={styles.ctaCardDesc}>Post your project and get competitive bids from verified contractors in your area.</p>
              <Link to="/register" className={styles.ctaCardBtn} style={{ background: 'var(--color-primary)' }}>
                Post a job <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>
            <div className={styles.ctaDivider}>or</div>
            <div className={styles.ctaCard}>
              <HardHat size={28} strokeWidth={1.5} color="var(--color-accent)" />
              <h3 className={styles.ctaCardTitle}>I'm a contractor</h3>
              <p className={styles.ctaCardDesc}>Create your profile, browse open jobs, and win work that fits your trade and schedule.</p>
              <Link to="/register" className={styles.ctaCardBtn} style={{ background: 'var(--color-accent)' }}>
                Join as a pro <ArrowRight size={14} strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerBrand}>
            <span className={styles.footerWordmark}>BuildMatch</span>
            <p className={styles.footerTagline}>Connecting projects with the people who build them.</p>
          </div>
          <div className={styles.footerLinks}>
            <div className={styles.footerCol}>
              <p className={styles.footerColTitle}>Platform</p>
              <Link to="/contractors" className={styles.footerLink}>Find contractors</Link>
              <Link to="/register"    className={styles.footerLink}>Post a job</Link>
              <Link to="/register"    className={styles.footerLink}>Join as a pro</Link>
            </div>
            <div className={styles.footerCol}>
              <p className={styles.footerColTitle}>Company</p>
              <Link to="/about"  className={styles.footerLink}>About us</Link>
              <Link to="/terms"  className={styles.footerLink}>Terms of service</Link>
              <Link to="/terms"  className={styles.footerLink}>Privacy policy</Link>
            </div>
            <div className={styles.footerCol}>
              <p className={styles.footerColTitle}>Support</p>
              <a href="mailto:support@buildmatch.com" className={styles.footerLink}>Contact us</a>
              <Link to="/login" className={styles.footerLink}>Sign in</Link>
            </div>
          </div>
        </div>
        <div className={styles.footerBottom}>
          <span>© {new Date().getFullYear()} BuildMatch Inc. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}
