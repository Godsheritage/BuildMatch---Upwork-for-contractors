import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Search } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';

/* ── Greeting ───────────────────────────────────────── */
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

/* ── Stat card ──────────────────────────────────────── */
interface StatCardProps {
  label: string;
  value: number | string;
}

function StatCard({ label, value }: StatCardProps) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E8E8E8',
        borderRadius: '12px',
        borderLeft: '3px solid #111',
        padding: '20px 24px',
      }}
    >
      <p
        style={{
          fontSize: '11px',
          fontWeight: 500,
          color: '#999',
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          marginBottom: '10px',
        }}
      >
        {label}
      </p>
      <p
        style={{
          fontSize: '32px',
          fontWeight: 600,
          color: '#111',
          lineHeight: 1,
        }}
      >
        {value}
      </p>
    </div>
  );
}

/* ── Empty state ────────────────────────────────────── */
interface EmptySectionProps {
  title: string;
  description: string;
  ctaLabel: string;
  ctaTo: string;
  icon: React.ElementType;
}

function EmptySection({ title, description, ctaLabel, ctaTo, icon: Icon }: EmptySectionProps) {
  return (
    <div
      style={{
        border: '1px solid #E8E8E8',
        borderRadius: '12px',
        padding: '48px 32px',
        textAlign: 'center',
        background: '#fff',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: '#F3F3F3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <Icon size={24} color="#555" strokeWidth={1.5} />
      </div>
      <p
        style={{
          fontSize: '15px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '6px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </p>
      <p
        style={{
          fontSize: '13px',
          color: 'var(--color-text-muted)',
          maxWidth: 320,
          margin: '0 auto 24px',
          lineHeight: 1.6,
        }}
      >
        {description}
      </p>
      <Link to={ctaTo}>
        <Button variant="primary" size="sm">
          {ctaLabel}
        </Button>
      </Link>
    </div>
  );
}

/* ── Main page ──────────────────────────────────────── */
export function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  const greeting = `${getGreeting()}, ${user.firstName}`;
  const isInvestor = user.role === 'INVESTOR';

  return (
    <div style={{ padding: '36px 40px', maxWidth: 960, margin: '0 auto', minHeight: '100%' }}>
      {/* Greeting */}
      <div style={{ marginBottom: 32 }}>
        <h1
          style={{
            fontSize: '24px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: 4,
          }}
        >
          {greeting}
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--color-text-muted)' }}>
          {isInvestor
            ? "Here's an overview of your project activity."
            : "Here's an overview of your contractor activity."}
        </p>
      </div>

      {/* Stat cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
          marginBottom: 40,
        }}
      >
        {isInvestor ? (
          <>
            <StatCard label="Active Jobs"       value={0} />
            <StatCard label="Contractors Hired" value={0} />
            <StatCard label="Total Spent"       value="$0" />
          </>
        ) : (
          <>
            <StatCard label="Profile Views"  value={0} />
            <StatCard label="Bids Submitted" value={0} />
            <StatCard label="Jobs Won"        value={0} />
          </>
        )}
      </div>

      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 16,
        }}
      >
        <h2
          style={{
            fontSize: '16px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '-0.01em',
          }}
        >
          {isInvestor ? 'Recent Jobs' : 'Available Jobs Near You'}
        </h2>
        {isInvestor && (
          <Link to="/post-job">
            <Button variant="primary" size="sm">
              Post a job
            </Button>
          </Link>
        )}
      </div>

      {/* Empty state */}
      {isInvestor ? (
        <EmptySection
          icon={Briefcase}
          title="No jobs posted yet"
          description="Post your first job to start receiving bids from qualified contractors in your area."
          ctaLabel="Post your first job"
          ctaTo="/post-job"
        />
      ) : (
        <EmptySection
          icon={Search}
          title="No jobs found nearby"
          description="Complete your profile to improve your match with available jobs and get discovered by investors."
          ctaLabel="Complete your profile"
          ctaTo="/profile"
        />
      )}
    </div>
  );
}
