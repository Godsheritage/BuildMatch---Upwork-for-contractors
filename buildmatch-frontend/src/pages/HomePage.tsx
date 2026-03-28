import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Zap, Droplets, Wind, Home, Layers, Paintbrush,
  Trees, Hammer, Wrench, Building2,
  ShieldCheck, DollarSign, Star, Clock, ArrowRight,
  MapPin, CheckCircle2, Search,
} from 'lucide-react';
import { useContractorSearch } from '../hooks/useContractorSearch';
import { ContractorSearchResults } from '../components/contractor/ContractorSearchResults';
import styles from './HomePage.module.css';

// ── Static data ────────────────────────────────────────────────────────────

const CATEGORIES = [
  { icon: Zap,        label: 'Electrical',         count: '140+ contractors', bg: '#FEF9C3', color: '#854D0E' },
  { icon: Droplets,   label: 'Plumbing',            count: '98 contractors',   bg: '#DBEAFE', color: '#1E40AF' },
  { icon: Wind,       label: 'HVAC',                count: '76 contractors',   bg: '#E0F2FE', color: '#0369A1' },
  { icon: Home,       label: 'Roofing',             count: '112 contractors',  bg: '#F0FDF4', color: '#166534' },
  { icon: Layers,     label: 'Flooring',            count: '88 contractors',   bg: '#FDF4FF', color: '#7E22CE' },
  { icon: Paintbrush, label: 'Painting',            count: '203 contractors',  bg: '#FFF7ED', color: '#C2410C' },
  { icon: Trees,      label: 'Landscaping',         count: '64 contractors',   bg: '#F0FDF4', color: '#15803D' },
  { icon: Hammer,     label: 'Demolition',          count: '41 contractors',   bg: '#FEF2F2', color: '#B91C1C' },
  { icon: Building2,  label: 'General Contractor',  count: '310+ contractors', bg: '#EFF6FF', color: '#1D4ED8' },
  { icon: Wrench,     label: 'Other Trades',        count: '55 contractors',   bg: '#F8F7F5', color: '#6B6B67' },
];

const HOW_INVESTOR = [
  {
    title: 'Post your job',
    desc: 'Describe the project, your budget, and timeline. It takes less than 3 minutes.',
  },
  {
    title: 'Review competitive bids',
    desc: 'Receive bids from qualified, licensed contractors in your area. Compare profiles and ratings.',
  },
  {
    title: 'Hire and get it done',
    desc: 'Choose your contractor, agree on terms, and communicate directly through BuildMatch.',
  },
];

const HOW_CONTRACTOR = [
  {
    title: 'Create your profile',
    desc: 'Showcase your licenses, specialties, portfolio, and hourly rates to stand out from the crowd.',
  },
  {
    title: 'Browse matching jobs',
    desc: 'See open jobs that match your trade, location, and availability — updated daily.',
  },
  {
    title: 'Submit bids and win work',
    desc: 'Send a competitive proposal, connect with investors, and grow your business.',
  },
];

const BENEFITS = [
  {
    icon: ShieldCheck,
    title: 'Verified credentials',
    desc: 'Every contractor\'s license and insurance are reviewed before they can bid on projects. Hire with confidence.',
  },
  {
    icon: DollarSign,
    title: 'Competitive bids',
    desc: 'Post once, get multiple quotes. Compare proposals side-by-side to find the best fit for your budget.',
  },
  {
    icon: Star,
    title: 'Ratings you can trust',
    desc: 'Transparent reviews from real investors after every completed project — no fake ratings, ever.',
  },
];

const FEATURED_CONTRACTORS = [
  {
    initials: 'MJ',
    color: { bg: '#DBEAFE', text: '#1E40AF' },
    name: 'Marcus Johnson',
    location: 'San Francisco, CA',
    rating: 4.9,
    reviews: 47,
    bio: 'Licensed master electrician with 12 years of experience in residential and commercial wiring, panel upgrades, and smart home installs.',
    tags: ['Electrician', 'Licensed', 'Insured'],
    rate: '$85–120/hr',
    jobs: 34,
  },
  {
    initials: 'SR',
    color: { bg: '#D1FAE5', text: '#065F46' },
    name: 'Sofia Ramirez',
    location: 'Austin, TX',
    rating: 4.8,
    reviews: 31,
    bio: 'General contractor specializing in kitchen and bathroom renovations. Known for clean timelines and transparent communication.',
    tags: ['General Contractor', 'Remodeling'],
    rate: '$65–90/hr',
    jobs: 28,
  },
  {
    initials: 'DW',
    color: { bg: '#EDE9FE', text: '#5B21B6' },
    name: 'Derek Williams',
    location: 'Denver, CO',
    rating: 4.7,
    reviews: 22,
    bio: 'HVAC technician certified in installation, maintenance, and repair of residential and light commercial systems.',
    tags: ['HVAC', 'Licensed', 'Certified'],
    rate: '$70–95/hr',
    jobs: 19,
  },
];

const TRUST_LOGOS = ['Greystar', 'Lincoln Property', 'Tricon', 'Aimco', 'Essex Property'];

// ── Hero preview card ──────────────────────────────────────────────────────

function HeroPreviewCard() {
  const items = [
    { initials: 'MJ', color: { bg: '#DBEAFE', text: '#1E40AF' }, name: 'Marcus Johnson', meta: 'Electrician · San Francisco', rate: '$85/hr' },
    { initials: 'SR', color: { bg: '#D1FAE5', text: '#065F46' }, name: 'Sofia Ramirez',  meta: 'General Contractor · Austin',  rate: '$70/hr' },
    { initials: 'DW', color: { bg: '#EDE9FE', text: '#5B21B6' }, name: 'Derek Williams', meta: 'HVAC · Denver',                rate: '$80/hr' },
  ];
  return (
    <div className={styles.heroCard}>
      <p className={styles.heroCardLabel}>Top contractors near you</p>
      {items.map((c) => (
        <div key={c.name} className={styles.heroCardItem}>
          <div
            className={styles.heroCardAvatar}
            style={{ background: c.color.bg, color: c.color.text }}
          >
            {c.initials}
          </div>
          <div className={styles.heroCardInfo}>
            <p className={styles.heroCardName}>{c.name}</p>
            <p className={styles.heroCardMeta}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                <Star size={10} fill="#F59E0B" color="#F59E0B" />
                <span>4.9</span>
                <span style={{ marginLeft: 4 }}>{c.meta}</span>
              </span>
            </p>
          </div>
          <span className={styles.heroCardRate}>{c.rate}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function HomePage() {
  const { user } = useAuth();
  const { results, isPending, isError, search, reset } = useContractorSearch();
  const [inputValue, setInputValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);

  function handleSearch() {
    const q = inputValue.trim();
    if (q.length < 10) return;
    setSubmittedQuery(q);
    search(q);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  function handleClear() {
    reset();
    setInputValue('');
    setSubmittedQuery('');
  }

  const showResults = isPending || isError || results !== null;

  return (
    <div className={styles.page}>

      {/* ── NAVBAR ─────────────────────────────────────── */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navWordmark}>BuildMatch</Link>
        <div className={styles.navLinks}>
          <Link to="/contractors" className={styles.navLink}>Find Contractors</Link>
          <Link to="/post-job"    className={styles.navLink}>Post a Job</Link>
          <Link to="/register"    className={styles.navLink}>How It Works</Link>
        </div>
        <div className={styles.navActions}>
          {user ? (
            <Link to="/dashboard" className={styles.navCta}>Dashboard</Link>
          ) : (
            <>
              <Link to="/login"    className={styles.navSignIn}>Sign in</Link>
              <Link to="/register" className={styles.navCta}>Get started</Link>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────── */}
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <div className={styles.heroEyebrow}>
              <span className={styles.heroDot} />
              Built for the construction industry
            </div>
            <h1 className={styles.heroH1}>
              Find trusted contractors{' '}
              <span className={styles.heroHighlight}>for any build</span>
            </h1>
            <p className={styles.heroSub}>
              Connect with licensed, insured, and vetted contractors across every
              trade — from electrical and plumbing to roofing and renovations.
            </p>
            <div className={styles.searchRow}>
              <Search size={16} className={styles.searchIcon} />
              <input
                className={styles.searchInput}
                type="text"
                placeholder="Describe your project — e.g. rehab a kitchen in Austin"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
              />
              <button
                className={styles.searchBtn}
                onClick={handleSearch}
                disabled={isPending || inputValue.trim().length < 10}
                type="button"
              >
                {isPending ? 'Searching…' : 'Find Contractors'}
              </button>
            </div>
            <div className={styles.heroCtaRow}>
              <Link to="/contractors" className={styles.heroCtaPrimary}>
                Browse All <ArrowRight size={16} strokeWidth={2.5} />
              </Link>
              <Link to="/register?role=CONTRACTOR" className={styles.heroCtaSecondary}>
                I'm a Contractor
              </Link>
            </div>
            <p className={styles.heroNote}>
              Free to post. No subscription required.
            </p>
          </div>
          <div className={styles.heroRight}>
            <HeroPreviewCard />
          </div>
        </div>
      </section>

      {/* ── AI SEARCH RESULTS ──────────────────────────── */}
      {showResults && (
        <div ref={resultsRef}>
          <ContractorSearchResults
            query={submittedQuery}
            results={results}
            isPending={isPending}
            isError={isError}
            onClear={handleClear}
          />
        </div>
      )}

      {/* ── TRUST BAR ──────────────────────────────────── */}
      <div className={styles.trustBar}>
        <div className={styles.trustBarInner}>
          <span className={styles.trustLabel}>Trusted by property managers and developers at</span>
          <div className={styles.trustLogos}>
            {TRUST_LOGOS.map((logo) => (
              <span key={logo} className={styles.trustLogo}>{logo}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ── STATS ──────────────────────────────────────── */}
      <section className={styles.stats}>
        <div className={styles.statsInner}>
          <div className={styles.statItem}>
            <p className={styles.statNumber}>5,000+</p>
            <p className={styles.statDesc}>Licensed contractors<br />across 48 states</p>
          </div>
          <div className={styles.statItem}>
            <p className={styles.statNumber}>12,000+</p>
            <p className={styles.statDesc}>Projects posted<br />and completed</p>
          </div>
          <div className={styles.statItem}>
            <p className={styles.statNumber}>4.8★</p>
            <p className={styles.statDesc}>Average contractor<br />rating from investors</p>
          </div>
        </div>
      </section>

      {/* ── CATEGORIES ─────────────────────────────────── */}
      <section className={styles.categories}>
        <div className={styles.categoriesHeader}>
          <p className={styles.sectionEyebrow}>Browse by trade</p>
          <h2 className={styles.sectionHeading}>Find contractors for every specialty</h2>
          <p className={styles.sectionSub}>
            Whether you need a plumber for a quick fix or a general contractor for a full renovation,
            BuildMatch has you covered.
          </p>
        </div>
        <div className={styles.categoryGrid}>
          {CATEGORIES.map(({ icon: Icon, label, count, bg, color }) => (
            <Link key={label} to="/contractors" className={styles.categoryCard}>
              <div className={styles.categoryIcon} style={{ background: bg }}>
                <Icon size={20} color={color} strokeWidth={1.75} />
              </div>
              <p className={styles.categoryName}>{label}</p>
              <p className={styles.categoryCount}>{count}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────── */}
      <section className={styles.howItWorks}>
        <div className={styles.howHeader}>
          <p className={styles.sectionEyebrow}>Simple by design</p>
          <h2 className={styles.sectionHeading}>How BuildMatch works</h2>
          <p className={styles.sectionSub}>
            Two types of users, one powerful platform. Whether you're hiring or looking for work,
            we've made it straightforward.
          </p>
        </div>
        <div className={styles.howGrid}>
          {/* For investors */}
          <div className={styles.howCard}>
            <p className={styles.howCardTitle}>
              <Building2 size={18} color="var(--color-primary)" strokeWidth={1.75} />
              For Investors &amp; Property Owners
            </p>
            {HOW_INVESTOR.map((step, i) => (
              <div key={step.title} className={styles.howStep}>
                <div className={styles.howStepNum}>{i + 1}</div>
                <div className={styles.howStepBody}>
                  <p className={styles.howStepTitle}>{step.title}</p>
                  <p className={styles.howStepDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 28 }}>
              <Link
                to="/register?role=INVESTOR"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 14, fontWeight: 500, color: 'var(--color-primary)',
                  textDecoration: 'none',
                }}
              >
                Post your first job <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
          </div>

          {/* For contractors */}
          <div className={styles.howCard}>
            <p className={styles.howCardTitle}>
              <Hammer size={18} color="var(--color-accent)" strokeWidth={1.75} />
              For Contractors
            </p>
            {HOW_CONTRACTOR.map((step, i) => (
              <div key={step.title} className={styles.howStep}>
                <div className={styles.howStepNum} style={{ background: 'var(--color-accent)' }}>
                  {i + 1}
                </div>
                <div className={styles.howStepBody}>
                  <p className={styles.howStepTitle}>{step.title}</p>
                  <p className={styles.howStepDesc}>{step.desc}</p>
                </div>
              </div>
            ))}
            <div style={{ marginTop: 28 }}>
              <Link
                to="/register?role=CONTRACTOR"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 14, fontWeight: 500, color: 'var(--color-accent)',
                  textDecoration: 'none',
                }}
              >
                Create your profile <ArrowRight size={14} strokeWidth={2.5} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── BENEFITS ───────────────────────────────────── */}
      <section className={styles.benefits}>
        <div className={styles.benefitsHeader}>
          <p className={styles.sectionEyebrow}>Why BuildMatch</p>
          <h2 className={styles.sectionHeading}>Hire smarter, build faster</h2>
        </div>
        <div className={styles.benefitsGrid}>
          {BENEFITS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className={styles.benefitCard}>
              <div className={styles.benefitIcon}>
                <Icon size={22} color="var(--color-accent)" strokeWidth={1.75} />
              </div>
              <p className={styles.benefitTitle}>{title}</p>
              <p className={styles.benefitDesc}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURED CONTRACTORS ───────────────────────── */}
      <section className={styles.featured}>
        <div className={styles.featuredHeader}>
          <div>
            <p className={styles.sectionEyebrow}>Top talent</p>
            <h2 className={styles.sectionHeading} style={{ marginBottom: 0 }}>
              Meet our top-rated contractors
            </h2>
          </div>
          <Link to="/contractors" className={styles.featuredViewAll}>
            View all contractors →
          </Link>
        </div>
        <div className={styles.featuredGrid}>
          {FEATURED_CONTRACTORS.map((c) => (
            <div key={c.name} className={styles.featuredCard}>
              <div className={styles.featuredCardTop}>
                <div
                  className={styles.featuredAvatar}
                  style={{ background: c.color.bg, color: c.color.text }}
                >
                  {c.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className={styles.featuredName}>{c.name}</p>
                  <p className={styles.featuredMeta}>
                    <MapPin size={11} strokeWidth={2} />
                    {c.location}
                  </p>
                </div>
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 500, color: 'var(--color-text-primary)',
                    flexShrink: 0,
                  }}
                >
                  <Star size={12} fill="#F59E0B" color="#F59E0B" />
                  {c.rating}
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
                    ({c.reviews})
                  </span>
                </div>
              </div>

              <p className={styles.featuredBio}>{c.bio}</p>

              <div className={styles.featuredTags}>
                {c.tags.map((tag) => (
                  <span key={tag} className={styles.featuredTag}>{tag}</span>
                ))}
              </div>

              <div className={styles.featuredFooter}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <CheckCircle2 size={12} color="var(--color-accent)" strokeWidth={2.5} />
                  {c.jobs} jobs done
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={11} strokeWidth={2} />
                  Responds in &lt;1 day
                </span>
                <span className={styles.featuredRateVal}>{c.rate}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA BANNER ─────────────────────────────────── */}
      <section className={styles.ctaBanner}>
        <div className={styles.ctaBannerInner}>
          <h2 className={styles.ctaBannerHeading}>
            Ready to find your contractor?
          </h2>
          <p className={styles.ctaBannerSub}>
            Join thousands of investors and property owners who trust BuildMatch
            to get their projects done right.
          </p>
          <div className={styles.ctaBannerRow}>
            <Link
              to="/register?role=INVESTOR"
              className={styles.heroCtaPrimary}
            >
              Post a Job — it's free
            </Link>
            <Link
              to="/contractors"
              className={styles.heroCtaSecondary}
            >
              Browse contractors
            </Link>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────── */}
      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <div className={styles.footerTop}>
            {/* Brand */}
            <div>
              <Link to="/" className={styles.footerWordmark}>BuildMatch</Link>
              <p className={styles.footerTagline}>
                The smarter way to find and hire licensed construction contractors
                across the United States.
              </p>
            </div>

            {/* Platform */}
            <div>
              <p className={styles.footerColTitle}>Platform</p>
              <div className={styles.footerLinks}>
                <Link to="/contractors" className={styles.footerLink}>Find Contractors</Link>
                <Link to="/post-job"    className={styles.footerLink}>Post a Job</Link>
                <Link to="/register"    className={styles.footerLink}>How It Works</Link>
                <Link to="/login"       className={styles.footerLink}>Sign In</Link>
              </div>
            </div>

            {/* For contractors */}
            <div>
              <p className={styles.footerColTitle}>For Contractors</p>
              <div className={styles.footerLinks}>
                <Link to="/register?role=CONTRACTOR" className={styles.footerLink}>Create Profile</Link>
                <Link to="/dashboard/profile/setup"  className={styles.footerLink}>Profile Setup</Link>
                <Link to="/register"                 className={styles.footerLink}>Browse Jobs</Link>
              </div>
            </div>

            {/* Company */}
            <div>
              <p className={styles.footerColTitle}>Company</p>
              <div className={styles.footerLinks}>
                <Link to="/" className={styles.footerLink}>About</Link>
                <Link to="/" className={styles.footerLink}>Blog</Link>
                <Link to="/" className={styles.footerLink}>Privacy Policy</Link>
                <Link to="/" className={styles.footerLink}>Terms of Service</Link>
              </div>
            </div>
          </div>

          <div className={styles.footerBottom}>
            <p className={styles.footerCopy}>
              © {new Date().getFullYear()} BuildMatch, Inc. All rights reserved.
            </p>
            <p className={styles.footerCopy}>
              Built for the construction industry.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
