import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase, MessageSquare, FileText, TrendingUp,
  Star, DollarSign, CheckCircle2, Circle, ChevronRight,
  MessageCircle, ArrowRight, Pencil, MapPin, Award, Eye,
  Shield, Video, Wand2,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useLang } from '../context/LanguageContext';
import { getMyContractorProfile } from '../services/contractor.service';
import type { ContractorProfile } from '../types/contractor.types';
import { Button } from '../components/ui/Button';
import styles from './DashboardPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getGreeting(morning: string, afternoon: string, evening: string): string {
  const h = new Date().getHours();
  if (h < 12) return morning;
  if (h < 18) return afternoon;
  return evening;
}

function currentMonthName() {
  return new Date().toLocaleDateString('en-US', { month: 'long' });
}

// ── Profile strength (mirrors UserProfilePage logic) ──────────────────────────

interface StrengthItem { label: string; icon: React.ElementType; done: boolean; href: string; }

function computeStrength(profile: ContractorProfile | null | undefined): StrengthItem[] {
  return [
    { label: 'Add a bio',               icon: Pencil,    done: !!(profile?.bio),                    href: '/dashboard/profile/setup' },
    { label: 'Add your location',       icon: MapPin,    done: !!(profile?.city || profile?.state),  href: '/dashboard/profile/setup' },
    { label: 'Set your hourly rate',    icon: Briefcase, done: !!(profile?.hourlyRateMin),            href: '/dashboard/profile/setup' },
    { label: 'Add specialties',         icon: Star,      done: !!(profile?.specialties?.length),      href: '/dashboard/profile/setup' },
    { label: 'Years of experience',     icon: Award,     done: !!(profile?.yearsExperience),          href: '/dashboard/profile/setup' },
    { label: 'Upload portfolio image',  icon: Eye,       done: !!(profile?.portfolioImages?.length),  href: '/dashboard/profile/setup' },
    { label: 'Verify your license',     icon: Shield,    done: !!(profile?.isLicenseVerified),        href: '/dashboard/profile/setup' },
    { label: 'Create an intro video',   icon: Video,     done: false,                                 href: '/dashboard/profile/setup' },
  ];
}

// ── Path milestones ───────────────────────────────────────────────────────────

const PATH_STEPS = [
  { key: 'profile',    label: 'Complete profile' },
  { key: 'bid',        label: 'Submit a bid' },
  { key: 'win',        label: 'Win a job' },
  { key: 'payment',    label: 'Set up payouts' },
  { key: 'review',     label: 'Get reviewed' },
];

// ── Main page ─────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const { t }    = useLang();

  if (!user) return null;

  const isInvestor   = user.role === 'INVESTOR';
  const greeting     = `${getGreeting(t.dashboard.greeting.morning, t.dashboard.greeting.afternoon, t.dashboard.greeting.evening)}, ${user.firstName}`;

  if (isInvestor) return <InvestorDashboard greeting={greeting} t={t} />;
  return <ContractorDashboard greeting={greeting} t={t} />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// INVESTOR dashboard (unchanged structure, minor polish)
// ═══════════════════════════════════════════════════════════════════════════════

function InvestorDashboard({ greeting, t }: { greeting: string; t: ReturnType<typeof useLang>['t'] }) {
  return (
    <div className={styles.page}>
      <div className={styles.singleCol}>
        <div className={styles.greetingBlock}>
          <h1 className={styles.greeting}>{greeting}</h1>
          <p className={styles.greetingSub}>{t.dashboard.subtitle.investor}</p>
        </div>

        <div className={styles.statsRow}>
          <StatCard label={t.dashboard.stats.activeJobs}        value="0" />
          <StatCard label={t.dashboard.stats.contractorsHired}  value="0" />
          <StatCard label={t.dashboard.stats.totalSpent}        value="$0" />
        </div>

        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>{t.dashboard.sections.recentJobs}</h2>
          <Link to="/dashboard/post-job">
            <Button variant="primary" size="sm">{t.dashboard.sections.postJob}</Button>
          </Link>
        </div>

        <div className={styles.emptySection}>
          <div className={styles.emptyIconWrap}>
            <Briefcase size={24} color="var(--color-text-muted)" strokeWidth={1.5} />
          </div>
          <p className={styles.emptyTitle}>{t.dashboard.empty.investorTitle}</p>
          <p className={styles.emptyDesc}>{t.dashboard.empty.investorDesc}</p>
          <Link to="/dashboard/post-job">
            <Button variant="primary" size="sm">{t.dashboard.empty.investorCta}</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACTOR dashboard — enhanced two-column layout
// ═══════════════════════════════════════════════════════════════════════════════

function ContractorDashboard({ greeting, t }: { greeting: string; t: ReturnType<typeof useLang>['t'] }) {
  const { data: profile } = useQuery({
    queryKey: ['contractor', 'me'],
    queryFn:  getMyContractorProfile,
    retry:    false,
  });

  const strengthItems = computeStrength(profile);
  const doneCount     = strengthItems.filter((i) => i.done).length;
  const totalCount    = strengthItems.length;
  const strengthPct   = Math.round((doneCount / totalCount) * 100);

  // Current path step (first not done in order)
  const currentStep = 0; // placeholder — would derive from real data

  return (
    <div className={styles.page}>
      <div className={styles.greetingBlock}>
        <h1 className={styles.greeting}>{greeting}</h1>
        <p className={styles.greetingSub}>{t.dashboard.subtitle.contractor}</p>
      </div>

      <div className={styles.contractorLayout}>
        {/* ── Left/main column ───────────────────────────── */}
        <div className={styles.mainCol}>

          {/* Active bids */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <Briefcase size={15} strokeWidth={1.75} /> Active Bids
              </h2>
              <Link to="/dashboard/browse-jobs" className={styles.cardLink}>Browse jobs <ChevronRight size={13} strokeWidth={2} /></Link>
            </div>
            <div className={styles.emptyCard}>
              <div className={styles.emptyCardIcon}>
                <FileText size={20} strokeWidth={1.5} color="var(--color-text-muted)" />
              </div>
              <p className={styles.emptyCardTitle}>No active bids</p>
              <p className={styles.emptyCardDesc}>
                Jobs you've bid on will appear here once your bid is accepted.
              </p>
              <Link to="/dashboard/browse-jobs">
                <Button variant="secondary" size="sm">Find jobs to bid on</Button>
              </Link>
            </div>
          </div>

          {/* Respond to clients */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <MessageSquare size={15} strokeWidth={1.75} /> Respond to clients
              </h2>
            </div>
            <MessagesPanel />
          </div>

          {/* Path to next level */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <TrendingUp size={15} strokeWidth={1.75} /> Your path to success
              </h2>
            </div>
            <div className={styles.pathSection}>
              <PathTrack currentStep={currentStep} />
              <div className={styles.pathTask}>
                <span className={styles.pathTaskLabel}>NEXT STEP</span>
                <div className={styles.pathTaskRow}>
                  <div className={styles.pathTaskIcon}>
                    <Wand2 size={14} strokeWidth={1.75} />
                  </div>
                  <div>
                    <p className={styles.pathTaskTitle}>Complete your profile to attract clients</p>
                    <p className={styles.pathTaskDesc}>A complete profile gets 3× more job invites and is shown higher in search results.</p>
                  </div>
                  <Link to="/dashboard/profile/setup" className={styles.pathTaskAction}>
                    <ArrowRight size={15} strokeWidth={2} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right/side column ──────────────────────────── */}
        <div className={styles.sideCol}>

          {/* Profile Strength */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Profile Strength</h2>
              <span className={styles.strengthScore}>{doneCount} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>/ {totalCount}</span></span>
            </div>
            <div className={styles.cardBody}>
              <p className={styles.strengthCaption}>A strong profile helps you stand out and attract better opportunities.</p>
              <div className={styles.strengthTrack}>
                <div className={styles.strengthFill} style={{ width: `${strengthPct}%` }} />
              </div>
              <div className={styles.strengthList}>
                {strengthItems.map((item) => (
                  <Link key={item.label} to={item.href} className={`${styles.strengthItem} ${item.done ? styles.strengthItemDone : ''}`}>
                    {item.done
                      ? <CheckCircle2 size={14} strokeWidth={2.5} color="#0F6E56" />
                      : <Circle size={14} strokeWidth={1.75} color="var(--color-border)" />
                    }
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>
              {doneCount < totalCount && (
                <Link to="/dashboard/profile/setup">
                  <Button variant="secondary" size="sm" style={{ width: '100%', marginTop: 12 }}>
                    Complete profile
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Track your performance */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <DollarSign size={15} strokeWidth={1.75} /> Track performance
              </h2>
            </div>
            <div className={styles.cardBody}>
              <div className={styles.earnedBlock}>
                <p className={styles.earnedLabel}>Earned in {currentMonthName()}</p>
                <p className={styles.earnedValue}>$0</p>
              </div>
              <div className={styles.perfGrid}>
                <div className={styles.perfCell}>
                  <p className={styles.perfLabel}>Active orders total</p>
                  <p className={styles.perfValue}>$0</p>
                </div>
                <div className={styles.perfCell}>
                  <p className={styles.perfLabel}>Success score</p>
                  <p className={styles.perfValue}>{profile ? Math.round(profile.averageRating * 20) : 0}</p>
                </div>
              </div>
              <Link to="/dashboard" className={styles.cardLink} style={{ display: 'inline-flex', marginTop: 12 }}>
                View more analytics <ChevronRight size={13} strokeWidth={2} />
              </Link>
            </div>
          </div>

          {/* Share feedback */}
          <FeedbackCard />
        </div>
      </div>
    </div>
  );
}

// ── Messages panel ────────────────────────────────────────────────────────────

function MessagesPanel() {
  const [tab, setTab] = useState<'messages' | 'briefs'>('messages');

  return (
    <div>
      <div className={styles.tabBar}>
        <button
          className={`${styles.tab} ${tab === 'messages' ? styles.tabActive : ''}`}
          onClick={() => setTab('messages')}
        >
          <MessageCircle size={13} strokeWidth={2} /> Unread messages <span className={styles.tabBadge}>0</span>
        </button>
        <button
          className={`${styles.tab} ${tab === 'briefs' ? styles.tabActive : ''}`}
          onClick={() => setTab('briefs')}
        >
          <FileText size={13} strokeWidth={2} /> Briefs <span className={styles.tabBadge}>0</span>
        </button>
      </div>
      <div className={styles.emptyMessages}>
        <div className={styles.emptyMsgIcon}>
          <MessageSquare size={20} strokeWidth={1.5} color="var(--color-text-muted)" />
        </div>
        <p className={styles.emptyCardTitle}>No unread {tab === 'messages' ? 'messages' : 'briefs'}</p>
        <p className={styles.emptyCardDesc}>
          {tab === 'messages'
            ? 'Messages from clients about your bids will appear here.'
            : 'Job invitations and project briefs will appear here.'}
        </p>
      </div>
    </div>
  );
}

// ── Path track ────────────────────────────────────────────────────────────────

function PathTrack({ currentStep }: { currentStep: number }) {
  return (
    <div className={styles.pathTrack}>
      {PATH_STEPS.map((step, i) => {
        const done   = i < currentStep;
        const active = i === currentStep;
        return (
          <div key={step.key} className={styles.pathStepWrap}>
            <div className={`${styles.pathDot} ${done ? styles.pathDotDone : active ? styles.pathDotActive : ''}`}>
              {done ? <CheckCircle2 size={10} strokeWidth={3} /> : null}
            </div>
            {i < PATH_STEPS.length - 1 && (
              <div className={`${styles.pathLine} ${done ? styles.pathLineDone : ''}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Feedback card ─────────────────────────────────────────────────────────────

function FeedbackCard() {
  const [text, setText]       = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!text.trim()) return;
    setSubmitted(true);
    setText('');
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>
          <Star size={15} strokeWidth={1.75} /> Share feedback
        </h2>
      </div>
      <div className={styles.cardBody}>
        {submitted ? (
          <div className={styles.feedbackThanks}>
            <CheckCircle2 size={22} color="#0F6E56" strokeWidth={1.75} />
            <p>Thanks for your feedback!</p>
          </div>
        ) : (
          <>
            <p className={styles.feedbackPrompt}>Help us shape your dashboard. What's working or what's missing?</p>
            <textarea
              className={styles.feedbackInput}
              placeholder="Your thoughts…"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleSubmit}
              disabled={!text.trim()}
              style={{ width: '100%', marginTop: 10 }}
            >
              Give feedback
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Reusable stat card (investor) ─────────────────────────────────────────────

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.statCard}>
      <p className={styles.statLabel}>{label}</p>
      <p className={styles.statValue}>{value}</p>
    </div>
  );
}
