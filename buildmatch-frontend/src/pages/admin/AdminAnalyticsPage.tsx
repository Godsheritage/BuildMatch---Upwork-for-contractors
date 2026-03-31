import { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import {
  useUserGrowth,
  useJobFunnel,
  useRevenueOverTime,
  useGeographic,
  useRetention,
  useSearchGaps,
} from '../../hooks/useAdmin';
import s from './AdminAnalyticsPage.module.css';
import sh from './admin-shared.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

type Period = '7d' | '30d' | '90d' | '12m';
const PERIODS: { label: string; value: Period }[] = [
  { label: '7d',  value: '7d'  },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: '12m', value: '12m' },
];

const GROUP_BY: Record<Period, string> = {
  '7d':  'day',
  '30d': 'day',
  '90d': 'week',
  '12m': 'month',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={s.section}>
      <h2 className={s.sectionTitle}>{title}</h2>
      {children}
    </section>
  );
}

// ── Skeleton block ────────────────────────────────────────────────────────────

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <div className={s.chartSkeleton} style={{ height }} />;
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  moneyKeys?: string[];
}

function CustomTooltip({ active, payload, label, moneyKeys = [] }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className={s.tooltip}>
      <p className={s.tooltipLabel}>{label}</p>
      {payload.map(p => (
        <p key={p.name} className={s.tooltipRow} style={{ color: p.color }}>
          {p.name}: <strong>
            {moneyKeys.includes(p.name) ? fmtMoney(p.value) : p.value.toLocaleString()}
          </strong>
        </p>
      ))}
    </div>
  );
}

// ── Section 1: User Growth ────────────────────────────────────────────────────

function UserGrowthSection({ period }: { period: Period }) {
  const groupBy = GROUP_BY[period];
  const { data, isLoading } = useUserGrowth({ period, groupBy });

  // Build cumulative arrays for the line chart
  const chartData = (() => {
    if (!data) return [];
    let cumInv = 0, cumCon = 0;
    return data.labels.map((label, i) => {
      cumInv += data.investors[i];
      cumCon += data.contractors[i];
      return { label, Investors: cumInv, Contractors: cumCon };
    });
  })();

  const totalNew    = data ? data.total.reduce((a, b) => a + b, 0) : 0;
  const newInv      = data ? data.investors.reduce((a, b) => a + b, 0) : 0;
  const newCon      = data ? data.contractors.reduce((a, b) => a + b, 0) : 0;

  return (
    <Section title="User Growth">
      {isLoading ? <ChartSkeleton /> : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} width={40} />
            <Tooltip content={(props) => (
              <CustomTooltip
                active={props.active}
                payload={props.payload as TooltipProps['payload']}
                label={props.label as string}
              />
            )} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line
              type="monotone" dataKey="Investors"
              stroke="#1B3A5C" strokeWidth={2} dot={false}
            />
            <Line
              type="monotone" dataKey="Contractors"
              stroke="#0F6E56" strokeWidth={2} dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div className={s.statRow}>
        <div className={s.statCard}>
          <span className={s.statValue}>{totalNew.toLocaleString()}</span>
          <span className={s.statLabel}>New users</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statValue} style={{ color: '#1B3A5C' }}>{newInv.toLocaleString()}</span>
          <span className={s.statLabel}>New investors</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statValue} style={{ color: '#0F6E56' }}>{newCon.toLocaleString()}</span>
          <span className={s.statLabel}>New contractors</span>
        </div>
      </div>
    </Section>
  );
}

// ── Section 2: Job Funnel ─────────────────────────────────────────────────────

function JobFunnelSection() {
  const { data, isLoading } = useJobFunnel();

  const stages: { label: string; key: keyof typeof data; color: string }[] = [
    { label: 'Jobs Posted',   key: 'posted',        color: '#1B3A5C' },
    { label: 'Received Bids', key: 'received_bids', color: '#2A5F8F' },
    { label: 'Awarded',       key: 'awarded',       color: '#0F6E56' },
    { label: 'In Progress',   key: 'in_progress',   color: '#148067' },
    { label: 'Completed',     key: 'completed',     color: '#1A9A7C' },
  ];

  const maxVal = data ? Math.max(data.posted, 1) : 1;

  return (
    <Section title="Job Funnel">
      {isLoading ? <ChartSkeleton height={200} /> : !data ? null : (
        <>
          <div className={s.funnel}>
            {stages.map((stage, i) => {
              const val     = Number(data[stage.key] ?? 0);
              const prev    = i > 0 ? Number(data[stages[i - 1].key] ?? 0) : val;
              const pctPrev = prev > 0 ? Math.round((val / prev) * 100) : 0;
              const pctMax  = Math.round((val / maxVal) * 100);
              return (
                <div key={stage.key} className={s.funnelRow}>
                  <span className={s.funnelLabel}>{stage.label}</span>
                  <div className={s.funnelBarWrap}>
                    <div
                      className={s.funnelBar}
                      style={{ width: `${pctMax}%`, background: stage.color }}
                    />
                  </div>
                  <span className={s.funnelCount}>{val.toLocaleString()}</span>
                  {i > 0 && (
                    <span className={s.funnelPct}>{pctPrev}% of prev</span>
                  )}
                </div>
              );
            })}
          </div>
          <div className={s.statRow}>
            <div className={s.statCard}>
              <span className={s.statValue}>{data.completion_rate}%</span>
              <span className={s.statLabel}>Completion rate</span>
            </div>
            <div className={s.statCard}>
              <span className={s.statValue}>{data.avg_bids_per_job}</span>
              <span className={s.statLabel}>Avg bids / job</span>
            </div>
            <div className={s.statCard}>
              <span className={s.statValue}>{data.avg_time_to_award_days}d</span>
              <span className={s.statLabel}>Avg time to award</span>
            </div>
          </div>
        </>
      )}
    </Section>
  );
}

// ── Section 3: Revenue ────────────────────────────────────────────────────────

function RevenueSection() {
  const { data, isLoading } = useRevenueOverTime({ period: '12m' });

  const chartData = data
    ? data.labels.map((label, i) => ({
        label,
        GMV:     data.gmv[i],
        Revenue: data.revenue[i],
        'Jobs Completed': data.jobs_completed[i],
      }))
    : [];

  const totalGmv = data ? data.gmv.reduce((a, b) => a + b, 0) : 0;
  const totalRev = data ? data.revenue.reduce((a, b) => a + b, 0) : 0;

  return (
    <Section title="Revenue (Last 12 Months)">
      {isLoading ? <ChartSkeleton /> : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              width={52}
              tickFormatter={(v: number) => fmtMoney(v)}
            />
            <Tooltip content={(props) => (
              <CustomTooltip
                active={props.active}
                payload={props.payload as TooltipProps['payload']}
                label={props.label as string}
                moneyKeys={['GMV', 'Revenue']}
              />
            )} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="GMV"     fill="#1B3A5C" radius={[3, 3, 0, 0]} />
            <Bar dataKey="Revenue" fill="#0F6E56" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      <div className={s.statRow}>
        <div className={s.statCard}>
          <span className={s.statValue}>{fmtMoney(totalGmv)}</span>
          <span className={s.statLabel}>Total GMV (12m)</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statValue} style={{ color: '#0F6E56' }}>{fmtMoney(totalRev)}</span>
          <span className={s.statLabel}>Platform revenue (12m)</span>
        </div>
      </div>
    </Section>
  );
}

// ── Section 4: Geographic ─────────────────────────────────────────────────────

function GeographicSection() {
  const { data, isLoading } = useGeographic();

  return (
    <Section title="Geographic Distribution">
      {isLoading ? (
        <div className={sh.skeletonLine} style={{ height: 180, borderRadius: 8 }} />
      ) : !data ? null : (
        <>
          <div className={sh.tableWrap}>
            <table className={sh.table}>
              <thead>
                <tr>
                  <th>State</th>
                  <th>Investors</th>
                  <th>Contractors</th>
                  <th>Jobs</th>
                  <th>GMV</th>
                </tr>
              </thead>
              <tbody>
                {data.states.map(row => {
                  const isGap = row.investor_count > row.contractor_count * 2;
                  return (
                    <tr key={row.state} className={isGap ? s.supplyGapRow : ''}>
                      <td><strong>{row.state}</strong></td>
                      <td>{row.investor_count.toLocaleString()}</td>
                      <td>
                        {row.contractor_count.toLocaleString()}
                        {isGap && <span className={s.gapBadge}>supply gap</span>}
                      </td>
                      <td>{row.job_count.toLocaleString()}</td>
                      <td className={sh.mutedCell}>{fmtMoney(row.gmv)}</td>
                    </tr>
                  );
                })}
                {data.states.length === 0 && (
                  <tr>
                    <td colSpan={5} className={sh.emptyRow}>No geographic data yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {data.gaps.length > 0 && (
            <p className={s.gapNote}>
              Amber rows indicate states where investor demand significantly outpaces contractor supply
              (investors &gt; contractors × 2).
            </p>
          )}
        </>
      )}
    </Section>
  );
}

// ── Section 5: Search Gaps ────────────────────────────────────────────────────

function SearchGapsSection() {
  const { data, isLoading } = useSearchGaps();

  return (
    <Section title="Search Gaps (Last 30 Days)">
      <p className={s.sectionDesc}>
        Contractor searches that returned 0 results — unmet service demand.
      </p>
      {isLoading ? (
        <div className={sh.skeletonLine} style={{ height: 120, borderRadius: 8 }} />
      ) : !data ? null : (
        <div className={sh.tableWrap}>
          <table className={sh.table}>
            <thead>
              <tr>
                <th>Query</th>
                <th>Times Searched</th>
                <th>Last Searched</th>
              </tr>
            </thead>
            <tbody>
              {data.queries.map(row => (
                <tr key={row.query}>
                  <td><code className={s.queryCode}>{row.query}</code></td>
                  <td>{row.count.toLocaleString()}</td>
                  <td className={sh.mutedCell}>{fmtDate(row.last_searched)}</td>
                </tr>
              ))}
              {data.queries.length === 0 && (
                <tr>
                  <td colSpan={3} className={sh.emptyRow}>
                    No zero-result searches in the last 30 days.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {data && data.total_zero_result_searches > 0 && (
        <p className={s.gapNote}>
          {data.total_zero_result_searches.toLocaleString()} total zero-result searches in the last 30 days.
        </p>
      )}
    </Section>
  );
}

// ── Retention mini-stats ──────────────────────────────────────────────────────

function RetentionSection() {
  const { data, isLoading } = useRetention();

  if (isLoading) return (
    <Section title="Retention">
      <div className={s.statRow}>
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={s.statCard}>
            <div className={sh.skeletonLine} style={{ height: 28, width: 60, marginBottom: 6 }} />
            <div className={sh.skeletonLine} style={{ height: 14, width: 100 }} />
          </div>
        ))}
      </div>
    </Section>
  );

  if (!data) return null;

  return (
    <Section title="Retention">
      <div className={s.statRow}>
        <div className={s.statCard}>
          <span className={s.statValue}>{data.investor_repeat_rate}%</span>
          <span className={s.statLabel}>Investors with ≥2 jobs</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statValue}>{data.contractor_active_90d.toLocaleString()}</span>
          <span className={s.statLabel}>Contractors active (90d)</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statValue}>{data.avg_jobs_per_investor}</span>
          <span className={s.statLabel}>Avg jobs / investor</span>
        </div>
        <div className={s.statCard}>
          <span className={s.statValue}>{data.avg_bids_per_contractor}</span>
          <span className={s.statLabel}>Avg bids / contractor</span>
        </div>
      </div>
    </Section>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminAnalyticsPage() {
  const [period, setPeriod] = useState<Period>('30d');

  const periodSelector = (
    <div className={s.periodPills}>
      {PERIODS.map(p => (
        <button
          key={p.value}
          className={[s.periodPill, period === p.value ? s.periodPillActive : ''].join(' ')}
          onClick={() => setPeriod(p.value)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );

  return (
    <div className={s.page}>
      <AdminPageHeader
        title="Analytics"
        subtitle="Platform growth, engagement, and conversion metrics"
        actions={periodSelector}
      />

      <UserGrowthSection period={period} />
      <JobFunnelSection />
      <RevenueSection />
      <RetentionSection />
      <GeographicSection />
      <SearchGapsSection />
    </div>
  );
}
