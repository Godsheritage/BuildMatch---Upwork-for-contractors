import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  Zap, Droplets, Wind, Home, Layers, Paintbrush,
  Trees, Hammer, Wrench, Building2,
  ArrowRight, Search, Menu, X,
  FileText, Users, CheckCircle2, UserCircle, Briefcase, Send,
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
    Icon: FileText,
    title: 'Post your job',
    desc: 'Describe the project, your budget, and timeline. It takes less than 3 minutes.',
    cta: { label: 'Post a Job', to: '/register?role=INVESTOR' },
  },
  {
    Icon: Users,
    title: 'Review competitive bids',
    desc: 'Receive bids from qualified, licensed contractors in your area. Compare profiles and ratings.',
    cta: { label: 'Explore contractors', to: '/contractors' },
  },
  {
    Icon: CheckCircle2,
    title: 'Hire and get it done',
    desc: 'Choose your contractor, agree on terms, and communicate directly through BuildMatch.',
    cta: { label: 'Get started', to: '/register?role=INVESTOR' },
  },
];

const HOW_CONTRACTOR = [
  {
    Icon: UserCircle,
    title: 'Create your profile',
    desc: 'Showcase your licenses, specialties, portfolio, and hourly rates to stand out from the crowd.',
    cta: { label: 'Create Profile', to: '/register?role=CONTRACTOR' },
  },
  {
    Icon: Briefcase,
    title: 'Browse matching jobs',
    desc: 'See open jobs that match your trade, location, and availability — updated daily.',
    cta: { label: 'Browse Jobs', to: '/register?role=CONTRACTOR' },
  },
  {
    Icon: Send,
    title: 'Submit bids and win work',
    desc: 'Send a competitive proposal, connect with investors, and grow your business.',
    cta: { label: 'Start Bidding', to: '/register?role=CONTRACTOR' },
  },
];

const TRUST_LOGOS = ['Greystar', 'Lincoln Property', 'Tricon', 'Aimco', 'Essex Property'];

const SEARCH_EXAMPLES = [
  'rehab a kitchen in Austin',
  'fix a leaking roof in Denver',
  'remodel a master bathroom in Chicago',
  'install an HVAC system in Phoenix',
  'replace flooring in a condo in Miami',
  'rewire an electrical panel in Dallas',
  'build a deck addition in Nashville',
  'paint a 3-bedroom home in Seattle',
  'repair foundation cracks in Houston',
  'gut and renovate a basement in Detroit',
  'replace windows in a duplex in Atlanta',
  'build a garage in Portland',
  'install hardwood floors in Boston',
  'landscape a backyard in San Diego',
];

// ── Main page ──────────────────────────────────────────────────────────────

export function HomePage() {
  const { user } = useAuth();
  const { results, isPending, isError, search, reset } = useContractorSearch();
  const [inputValue, setInputValue] = useState('');
  const [submittedQuery, setSubmittedQuery] = useState('');
  const resultsRef = useRef<HTMLDivElement>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [howTab, setHowTab] = useState<'INVESTOR' | 'CONTRACTOR'>('INVESTOR');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Typewriter effect for search placeholder
  const [typedText, setTypedText]     = useState('');
  const [exampleIdx, setExampleIdx]   = useState(0);
  const [isDeleting, setIsDeleting]   = useState(false);

  useEffect(() => {
    const current = SEARCH_EXAMPLES[exampleIdx];

    if (!isDeleting && typedText === current) {
      const pause = setTimeout(() => setIsDeleting(true), 2800);
      return () => clearTimeout(pause);
    }

    if (isDeleting && typedText === '') {
      setIsDeleting(false);
      setExampleIdx((i) => (i + 1) % SEARCH_EXAMPLES.length);
      return;
    }

    const speed = isDeleting ? 30 : 52;
    const timer = setTimeout(() => {
      setTypedText(isDeleting
        ? current.slice(0, typedText.length - 1)
        : current.slice(0, typedText.length + 1)
      );
    }, speed);

    return () => clearTimeout(timer);
  }, [typedText, isDeleting, exampleIdx]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
          );
          const data = await res.json();
          const city = data.city || data.locality || null;
          if (city) setUserCity(city);
        } catch {
          // silently ignore — headline falls back to generic text
        }
      },
      () => { /* permission denied — silently ignore */ },
      { timeout: 8000 }
    );
  }, []);

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
        <Link to="/" className={styles.navLogo}>
          <img src="/logo.png" alt="BuildMatch" />
        </Link>
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
        <button
          type="button"
          className={styles.navHamburger}
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
        >
          <Menu size={22} strokeWidth={2} />
        </button>
      </nav>

      {/* ── MOBILE NAV DRAWER ──────────────────────────── */}
      {mobileNavOpen && (
        <div className={styles.mobileNavBackdrop} onClick={() => setMobileNavOpen(false)}>
          <aside className={styles.mobileNavSheet} onClick={(e) => e.stopPropagation()}>
            <div className={styles.mobileNavHeader}>
              <img src="/logo.png" alt="BuildMatch" style={{ height: 36 }} />
              <button
                type="button"
                className={styles.mobileNavClose}
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <div className={styles.mobileNavLinks}>
              <Link to="/contractors" className={styles.mobileNavLink} onClick={() => setMobileNavOpen(false)}>Find Contractors</Link>
              <Link to="/post-job"    className={styles.mobileNavLink} onClick={() => setMobileNavOpen(false)}>Post a Job</Link>
              <Link to="/register"    className={styles.mobileNavLink} onClick={() => setMobileNavOpen(false)}>How It Works</Link>
            </div>
            <div className={styles.mobileNavCtas}>
              {user ? (
                <Link to="/dashboard" className={styles.navCta} onClick={() => setMobileNavOpen(false)}>Dashboard</Link>
              ) : (
                <>
                  <Link to="/login"    className={styles.mobileNavSignIn} onClick={() => setMobileNavOpen(false)}>Sign in</Link>
                  <Link to="/register" className={styles.navCta} onClick={() => setMobileNavOpen(false)}>Get started</Link>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* ── HERO ───────────────────────────────────────── */}
      <section className={styles.hero}>
        {/* Ambient background orbs */}
        <div className={`${styles.heroOrb} ${styles.heroOrb1}`} />
        <div className={`${styles.heroOrb} ${styles.heroOrb2}`} />
        <div className={`${styles.heroOrb} ${styles.heroOrb3}`} />

        <div className={styles.heroInner}>
          <div className={styles.heroLeft}>
            <div className={styles.heroEyebrow}>
              <span className={styles.heroDot} />
              Built for the construction industry
            </div>
            <h1 className={styles.heroH1}>
              Find contractors{' '}
              <span className={styles.heroHighlight}>for every specialty</span>
              {userCity && (
                <span className={styles.heroCity}> in {userCity}</span>
              )}
            </h1>
            <p className={styles.heroSub}>
              Connect with <strong>licensed, insured, and vetted</strong> contractors across every
              trade — from <strong>electrical</strong> and <strong>plumbing</strong> to <strong>roofing</strong> and <strong>renovations</strong>.
            </p>
            <div className={styles.searchRow}>
              <Search size={18} className={styles.searchIcon} />
              <div className={styles.searchInputWrap}>
                <input
                  className={styles.searchInput}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                />
                {inputValue === '' && (
                  <span className={styles.searchPlaceholder} aria-hidden>
                    <span className={styles.searchPlaceholderLabel}>Describe your project: </span>
                    {typedText}
                    <span className={styles.searchCursor} />
                  </span>
                )}
              </div>
              <div className={styles.searchBtnWrap}>
                <span className={styles.searchAiBadge}>
                  <span className={styles.searchAiDot} />
                  AI-powered
                </span>
                <button
                  className={styles.searchBtn}
                  onClick={handleSearch}
                  disabled={isPending || inputValue.trim().length < 10}
                  type="button"
                >
                  {isPending ? 'Searching…' : 'Find Contractors'}
                </button>
              </div>
            </div>
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
        <div className={styles.howHeaderRow}>
          <h2 className={styles.howTitle}>How it works</h2>
          <div className={styles.howToggle}>
            <button
              className={`${styles.howToggleBtn} ${howTab === 'INVESTOR' ? styles.howToggleActive : ''}`}
              onClick={() => setHowTab('INVESTOR')}
              type="button"
            >
              For hiring
            </button>
            <button
              className={`${styles.howToggleBtn} ${howTab === 'CONTRACTOR' ? styles.howToggleActive : ''}`}
              onClick={() => setHowTab('CONTRACTOR')}
              type="button"
            >
              For finding work
            </button>
          </div>
        </div>

        <div className={styles.howCardsRow}>
          {(howTab === 'INVESTOR' ? HOW_INVESTOR : HOW_CONTRACTOR).map(({ Icon, title, desc, cta }, i) => (
            <div key={title} className={styles.howStepCard}>
              <div className={`${styles.howStepVisual} ${
                i === 0 ? styles.howVisual1 : i === 1 ? styles.howVisual2 : styles.howVisual3
              }`}>
                {i === 0 ? (
                  <div className={styles.howBrandCard}>
                    <div className={styles.howBrandIconWrap}>
                      <Icon size={48} strokeWidth={1.5} />
                    </div>
                  </div>
                ) : (
                  <div className={`${styles.howVisualIcon} ${i === 2 ? styles.howVisualIconLight : ''}`}>
                    <Icon size={48} strokeWidth={1.25} />
                  </div>
                )}
              </div>
              <div className={styles.howStepContent}>
                <p className={styles.howStepTitle2}>{title}</p>
                <p className={styles.howStepDesc2}>{desc}</p>
                <Link to={cta.to} className={styles.howCardBtn}>
                  {cta.label}
                  <ArrowRight size={14} strokeWidth={2} />
                </Link>
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
