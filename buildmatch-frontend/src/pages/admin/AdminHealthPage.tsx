import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ReferenceLine,
  Dot,
} from 'recharts';
import { AlertTriangle, Bell } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import {
  useHealthStatus,
  useHealthErrors,
  useBackgroundJobs,
  useTriggerBackgroundJob,
} from '../../hooks/useAdmin';
import type { ServiceHealthStatus, HourlyPerf, ApiErrorEntry } from '../../services/admin.service';
import s  from './AdminHealthPage.module.css';
import sh from './admin-shared.module.css';

// ── Constants ─────────────────────────────────────────────────────────────────

const PERF_THRESHOLD_MS = 500;

const JOB_SCHEDULE: Record<string, string> = {
  send_notifications:   'Every 5 min',
  process_webhooks:     'Real-time',
  retry_failed_payouts: 'Daily 03:00',
  send_daily_digest:    'Daily 09:00',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTs(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  });
}

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m    = Math.floor(diff / 60_000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function fmtMs(n: number | null): string {
  if (n === null || n === 0) return '—';
  return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s`;
}

function fmtMb(n: number): string {
  if (n === 0) return '0 MB';
  return `${n.toFixed(1)} MB`;
}

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ServiceHealthStatus | string }) {
  const cls =
    status === 'healthy' ? s.badgeHealthy :
    status === 'degraded' ? s.badgeDegraded : s.badgeDown;
  return (
    <span className={[s.badge, cls].join(' ')}>
      {status === 'down' && <Bell size={10} className={s.badgeIcon} />}
      {status}
    </span>
  );
}

function JobStatusBadge({ status }: { status: string }) {
  if (status === 'success')    return <span className={[sh.badge, sh.badgeActive].join(' ')}>success</span>;
  if (status === 'failed')     return <span className={[sh.badge, sh.badgeCancelled].join(' ')}>failed</span>;
  if (status === 'running')    return <span className={[sh.badge, sh.badgeAwarded].join(' ')}>running</span>;
  if (status === 'never_run')  return <span className={[sh.badge, sh.badgeWithdrawn].join(' ')}>never run</span>;
  return <span className={[sh.badge, sh.badgeUnverified].join(' ')}>{status}</span>;
}

// ── Section 1: Service Status Row ─────────────────────────────────────────────

function ServiceStatusRow() {
  const { data, isLoading } = useHealthStatus();

  if (isLoading || !data) {
    return (
      <div className={s.statusRow}>
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className={s.statusCard}>
            <div className={sh.skeletonLine} style={{ height: 12, width: 60, marginBottom: 8 }} />
            <div className={sh.skeletonLine} style={{ height: 22, width: 80, marginBottom: 6 }} />
            <div className={sh.skeletonLine} style={{ height: 12, width: 100 }} />
          </div>
        ))}
      </div>
    );
  }

  const totalStorageMb =
    data.storage.avatarsBucketMb +
    data.storage.jobPhotosBucketMb +
    data.storage.jobVideosBucketMb;

  const cards = [
    {
      name:   'API',
      status: data.api.status,
      metric: `avg ${fmtMs(data.api.avgResponseMs)} · p95 ${fmtMs(data.api.p95ResponseMs)}`,
    },
    {
      name:   'Database',
      status: data.database.status,
      metric: `query ${fmtMs(data.database.queryAvgMs)} · pool ${data.database.connectionPoolUsed}`,
    },
    {
      name:   'Storage',
      status: data.storage.status,
      metric: `${fmtMb(totalStorageMb)} used`,
    },
    {
      name:   'Stripe',
      status: data.stripe.status,
      metric: data.stripe.lastWebhookReceivedAt
        ? `webhook ${timeAgo(data.stripe.lastWebhookReceivedAt)}`
        : 'no webhook recorded',
    },
    {
      name:   'Realtime',
      status: data.supabaseRealtime.status,
      metric: `${data.supabaseRealtime.activeConnections} connections`,
    },
  ];

  return (
    <div className={s.statusRow}>
      {cards.map(c => (
        <div
          key={c.name}
          className={[
            s.statusCard,
            c.status === 'down'     ? s.statusCardDown     : '',
            c.status === 'degraded' ? s.statusCardDegraded : '',
          ].join(' ')}
        >
          <span className={s.statusCardName}>{c.name}</span>
          <StatusBadge status={c.status} />
          <span className={s.statusCardMetric}>{c.metric}</span>
        </div>
      ))}
    </div>
  );
}

// ── Section 2: API Performance Chart ─────────────────────────────────────────

interface PerfDot {
  cx?: number; cy?: number; payload?: HourlyPerf;
}

function PerfDotComponent(props: PerfDot) {
  const { cx = 0, cy = 0, payload } = props;
  if (!payload || payload.count === 0) return null;
  const over = payload.p95Ms > PERF_THRESHOLD_MS;
  return (
    <Dot
      cx={cx} cy={cy} r={3}
      fill={over ? '#DC2626' : '#BA7517'}
      stroke="none"
    />
  );
}

function PerfTooltip(props: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
}) {
  if (!props.active || !props.payload?.length) return null;
  return (
    <div className={s.tooltip}>
      <p className={s.tooltipLabel}>{props.label}</p>
      {props.payload.map(p => (
        <p key={p.name} className={s.tooltipRow}>
          {p.name}: <strong>{fmtMs(p.value)}</strong>
          {p.name === 'P95' && p.value > PERF_THRESHOLD_MS && (
            <span className={s.tooltipWarn}> ⚠ over threshold</span>
          )}
        </p>
      ))}
    </div>
  );
}

function PerfChart() {
  const { data, isLoading } = useHealthStatus();

  if (isLoading) return <div className={s.chartSkeleton} />;
  if (!data)     return null;

  const chartData = data.api.hourlyPerformance.map(h => ({
    hour:  h.hour,
    Avg:   h.count > 0 ? h.avgMs : null,
    P95:   h.count > 0 ? h.p95Ms : null,
    count: h.count,
  }));

  const hasData = chartData.some(d => d.count > 0);

  return (
    <div className={s.section}>
      <h2 className={s.sectionTitle}>API Performance — Last 24 Hours</h2>
      {!hasData ? (
        <p className={s.emptyChart}>No request data yet — buffer fills as traffic arrives.</p>
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              interval={3}
            />
            <YAxis
              tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
              width={44}
              tickFormatter={(v: number) => fmtMs(v)}
            />
            <Tooltip content={<PerfTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine
              y={PERF_THRESHOLD_MS}
              stroke="#DC2626"
              strokeDasharray="4 3"
              label={{ value: '500ms threshold', position: 'insideTopRight', fontSize: 10, fill: '#DC2626' }}
            />
            <Line
              type="monotone" dataKey="Avg" name="Avg"
              stroke="#1B3A5C" strokeWidth={2} dot={false}
              connectNulls={false}
            />
            <Line
              type="monotone" dataKey="P95" name="P95"
              stroke="#BA7517" strokeWidth={2}
              dot={<PerfDotComponent />}
              connectNulls={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ── Section 3: Error Log ──────────────────────────────────────────────────────

function ErrorLog() {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [page,     setPage]     = useState(1);

  const params = useMemo(() => ({
    page,
    limit:    25,
    dateFrom: dateFrom || undefined,
    dateTo:   dateTo   || undefined,
    endpoint: endpoint || undefined,
  }), [page, dateFrom, dateTo, endpoint]);

  const { data, isLoading } = useHealthErrors(params);

  // Group by error_msg to detect repeated errors (count ≥ 3)
  const countByMsg = useMemo((): Map<string, number> => {
    const m = new Map<string, number>();
    for (const e of (data?.data ?? [])) {
      const k = e.error_msg ?? '(no message)';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [data?.data]);

  function resetFilters() {
    setDateFrom(''); setDateTo(''); setEndpoint(''); setPage(1);
  }

  const isEmpty = !isLoading && (data?.data ?? []).length === 0;

  return (
    <div className={s.section}>
      <h2 className={s.sectionTitle}>Error Log</h2>

      <div className={sh.filters}>
        <input
          type="date"
          className={sh.filterSelect}
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          title="From date"
        />
        <input
          type="date"
          className={sh.filterSelect}
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          title="To date"
        />
        <input
          type="text"
          className={sh.searchInput}
          placeholder="Filter by endpoint…"
          value={endpoint}
          onChange={e => { setEndpoint(e.target.value); setPage(1); }}
        />
        {(dateFrom || dateTo || endpoint) && (
          <button className={s.clearBtn} onClick={resetFilters}>Clear</button>
        )}
        {data && (
          <span className={s.totalCount}>{data.total.toLocaleString()} errors</span>
        )}
      </div>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Endpoint</th>
              <th>Method</th>
              <th>Status</th>
              <th>Error</th>
              <th>User</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && [0, 1, 2, 3, 4].map(i => (
              <tr key={i} className={sh.skeletonRow}>
                {[0, 1, 2, 3, 4, 5].map(j => (
                  <td key={j}><div className={sh.skeletonLine} /></td>
                ))}
              </tr>
            ))}

            {isEmpty && (
              <tr>
                <td colSpan={6}>
                  <div className={s.emptyHealthy}>
                    <span className={s.emptyCheck}>✓</span>
                    <p className={s.emptyMsg}>No errors in the selected period</p>
                  </div>
                </td>
              </tr>
            )}

            {(data?.data ?? []).map((row: ApiErrorEntry) => {
              const msgKey = row.error_msg ?? '(no message)';
              const count  = countByMsg.get(msgKey) ?? 1;
              return (
                <tr key={row.id} className={s.errorRow}>
                  <td className={sh.mutedCell}>{fmtTs(row.created_at)}</td>
                  <td><code className={s.endpointCode}>{row.endpoint}</code></td>
                  <td>
                    <span className={[s.methodBadge, s[`method${row.method}`] ?? ''].join(' ')}>
                      {row.method}
                    </span>
                  </td>
                  <td>
                    <span className={[sh.badge, sh.badgeCancelled].join(' ')}>
                      {row.status_code}
                    </span>
                  </td>
                  <td>
                    <span className={s.errorMsg}>
                      {row.error_msg ?? <em className={sh.mutedCell}>—</em>}
                    </span>
                    {count >= 3 && (
                      <span className={s.repeatBadge}>{count}×</span>
                    )}
                  </td>
                  <td className={sh.mutedCell}>
                    {row.user_id ? (
                      <code className={s.userId}>{row.user_id.slice(0, 8)}…</code>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className={sh.pagination}>
            <span>Page {page} of {data.totalPages}</span>
            <div className={sh.paginationBtns}>
              <button
                className={sh.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >Prev</button>
              <button
                className={sh.pageBtn}
                disabled={page >= data.totalPages}
                onClick={() => setPage(p => p + 1)}
              >Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section 4: Background Jobs ────────────────────────────────────────────────

function BackgroundJobsSection() {
  const { data, isLoading } = useBackgroundJobs();
  const trigger             = useTriggerBackgroundJob();

  const [triggering, setTriggering] = useState<string | null>(null);

  async function handleTrigger(jobName: string) {
    setTriggering(jobName);
    try {
      await trigger.mutateAsync(jobName);
    } finally {
      setTriggering(null);
    }
  }

  return (
    <div className={s.section}>
      <h2 className={s.sectionTitle}>Background Jobs — Last 24 Hours</h2>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Job Name</th>
              <th>Last Run</th>
              <th>Status</th>
              <th>Runs (24h)</th>
              <th>Schedule</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && [0, 1, 2, 3].map(i => (
              <tr key={i} className={sh.skeletonRow}>
                {[0, 1, 2, 3, 4, 5].map(j => (
                  <td key={j}><div className={sh.skeletonLine} /></td>
                ))}
              </tr>
            ))}

            {!isLoading && (data?.jobs ?? []).map(job => (
              <>
                <tr
                  key={job.job_name}
                  className={job.status === 'failed' ? s.jobFailedRow : ''}
                >
                  <td>
                    <code className={s.jobName}>{job.job_name}</code>
                  </td>
                  <td className={sh.mutedCell}>
                    {job.last_run_at ? timeAgo(job.last_run_at) : '—'}
                  </td>
                  <td><JobStatusBadge status={job.status} /></td>
                  <td className={sh.mutedCell}>
                    {job.run_count > 0 ? (
                      <>
                        {job.run_count}
                        {job.fail_count > 0 && (
                          <span className={s.failCount}> ({job.fail_count} failed)</span>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  <td className={sh.mutedCell}>
                    {JOB_SCHEDULE[job.job_name] ?? '—'}
                  </td>
                  <td>
                    <button
                      className={[sh.actionBtn, sh.actionBtnGhost].join(' ')}
                      disabled={triggering === job.job_name}
                      onClick={() => handleTrigger(job.job_name)}
                    >
                      {triggering === job.job_name ? 'Running…' : 'Run Now'}
                    </button>
                  </td>
                </tr>
                {job.status === 'failed' && job.error_msg && (
                  <tr key={`${job.job_name}-err`} className={s.jobErrorRow}>
                    <td colSpan={6}>
                      <div className={s.jobErrorMsg}>
                        <AlertTriangle size={12} className={s.jobErrorIcon} />
                        {job.error_msg}
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}

            {!isLoading && (data?.jobs ?? []).length === 0 && (
              <tr><td colSpan={6} className={sh.emptyRow}>No job data available.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminHealthPage() {
  const { dataUpdatedAt } = useHealthStatus();

  const subtitle = dataUpdatedAt
    ? `Last checked ${new Date(dataUpdatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} · Auto-refreshes every 30s`
    : 'Auto-refreshes every 30s';

  return (
    <div className={s.page}>
      <AdminPageHeader
        title="System Health"
        subtitle={subtitle}
      />

      <ServiceStatusRow />
      <PerfChart />
      <ErrorLog />
      <BackgroundJobsSection />
    </div>
  );
}
