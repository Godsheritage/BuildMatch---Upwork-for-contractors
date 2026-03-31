import { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import {
  useFinanceSummary,
  useFinanceTransactions,
  useFinancePayouts,
  useFailedTransactions,
  useRetryPayout,
  useIssueRefund,
} from '../../hooks/useAdmin';
import type { FinanceTransaction, FinancePayout, FailedItem } from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s from './AdminFinancePage.module.css';

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

function fmtUsdFull(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function delta(current: number, previous: number) {
  if (previous === 0) return null;
  const pct = ((current - previous) / previous) * 100;
  return { pct: Math.abs(pct).toFixed(1), up: pct >= 0 };
}

// ── Chart data helper: last 12 months labels ──────────────────────────────────

function buildChartData(summary: {
  totalGmvThisMonth:     number;
  totalGmvLastMonth:     number;
  totalRevenueThisMonth: number;
  totalRevenueLastMonth: number;
}) {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d     = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const isThis = i === 11;
    const isLast = i === 10;
    return {
      month: label,
      GMV:      isThis ? summary.totalGmvThisMonth     : isLast ? summary.totalGmvLastMonth     : 0,
      Revenue:  isThis ? summary.totalRevenueThisMonth : isLast ? summary.totalRevenueLastMonth : 0,
    };
  });
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:    string;
  value:    string;
  current:  number;
  previous: number;
  icon:     string;
}

function StatCard({ label, value, current, previous, icon }: StatCardProps) {
  const d = delta(current, previous);
  return (
    <div className={s.statCard}>
      <div className={s.statCardIcon}>{icon}</div>
      <div className={s.statCardBody}>
        <p className={s.statCardLabel}>{label}</p>
        <p className={s.statCardValue}>{value}</p>
        {d && (
          <p className={`${s.statCardDelta} ${d.up ? s.deltaUp : s.deltaDown}`}>
            {d.up ? '↑' : '↓'} {d.pct}% vs last month
          </p>
        )}
      </div>
    </div>
  );
}

// ── Custom chart tooltip ──────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={s.chartTooltip}>
      <p className={s.chartTooltipLabel}>{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color, margin: '2px 0', fontSize: 12 }}>
          {p.name}: {fmtUsd(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Type badge ────────────────────────────────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  escrow_deposit:    'Deposit',
  milestone_release: 'Milestone',
  fee:               'Fee',
  refund:            'Refund',
  payout:            'Payout',
};

const TYPE_CLASS: Record<string, string> = {
  escrow_deposit:    sh.badgeActive,
  milestone_release: sh.badgeAwarded,
  fee:               sh.badgeInProgress,
  refund:            sh.badgeCancelled,
  payout:            sh.badgeVerified,
};

function typeBadge(t: string) {
  return (
    <span className={`${sh.badge} ${TYPE_CLASS[t] ?? ''}`}>
      {TYPE_LABEL[t] ?? t}
    </span>
  );
}

function statusBadge(s: string) {
  const map: Record<string, string> = {
    FUNDED:        sh.badgeActive,
    IN_PROGRESS:   sh.badgeInProgress,
    RELEASED:      sh.badgeVerified,
    FULLY_RELEASED:sh.badgeVerified,
    REFUNDED:      sh.badgeCancelled,
    CANCELLED:     sh.badgeCancelled,
    DISPUTED:      sh.badgeDispute,
    APPROVED:      sh.badgeAwarded,
    processed:     sh.badgeVerified,
    pending:       sh.badgeInProgress,
    failed:        sh.badgeCancelled,
  };
  return (
    <span className={`${sh.badge} ${map[s] ?? ''}`}>
      {s.replace(/_/g, ' ')}
    </span>
  );
}

// ── Transactions Tab ──────────────────────────────────────────────────────────

const TX_TYPES = ['', 'escrow_deposit', 'milestone_release', 'fee', 'refund', 'payout'] as const;

function TransactionsTab() {
  const [page,     setPage]     = useState(1);
  const [type,     setType]     = useState('');
  const [status,   setStatus]   = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  const params = useMemo(() => ({
    page,
    limit: 25,
    ...(type     && { type }),
    ...(status   && { status }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo   && { dateTo }),
  }), [page, type, status, dateFrom, dateTo]);

  const { data, isLoading } = useFinanceTransactions(params);

  function clearFilters() {
    setType(''); setStatus(''); setDateFrom(''); setDateTo(''); setPage(1);
  }

  const hasFilters = !!(type || status || dateFrom || dateTo);

  return (
    <>
      {/* Filters */}
      <div className={sh.filters}>
        <select
          className={sh.filterSelect}
          value={type}
          onChange={e => { setType(e.target.value); setPage(1); }}
        >
          <option value="">All types</option>
          {TX_TYPES.slice(1).map(t => (
            <option key={t} value={t}>{TYPE_LABEL[t]}</option>
          ))}
        </select>

        <select
          className={sh.filterSelect}
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">All statuses</option>
          {['FUNDED','IN_PROGRESS','RELEASED','FULLY_RELEASED','REFUNDED','CANCELLED','DISPUTED'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
          ))}
        </select>

        <input
          type="date"
          className={sh.searchInput}
          style={{ maxWidth: 150 }}
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1); }}
          placeholder="From"
        />
        <input
          type="date"
          className={sh.searchInput}
          style={{ maxWidth: 150 }}
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1); }}
          placeholder="To"
        />

        {hasFilters && (
          <button className={s.clearBtn} onClick={clearFilters}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Job</th>
              <th>Investor</th>
              <th>Contractor</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>Fee</th>
              <th>Status</th>
              <th>Stripe ID</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j}><div className={sh.skeletonLine} /></td>
                  ))}
                </tr>
              ))
            ) : !data?.data.length ? (
              <tr className={sh.emptyRow}><td colSpan={9}>No transactions found.</td></tr>
            ) : (
              data.data.map((tx: FinanceTransaction) => (
                <tr key={tx.id}>
                  <td className={sh.mutedCell}>{fmtDate(tx.createdAt)}</td>
                  <td>
                    <span className={sh.nameMain} title={tx.jobTitle}>
                      {tx.jobTitle.length > 28 ? `${tx.jobTitle.slice(0, 28)}…` : tx.jobTitle}
                    </span>
                  </td>
                  <td className={sh.mutedCell}>{tx.investorName}</td>
                  <td className={sh.mutedCell}>{tx.contractorName}</td>
                  <td>{typeBadge(tx.type)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtUsdFull(tx.amount)}</td>
                  <td style={{ textAlign: 'right' }} className={sh.mutedCell}>
                    {tx.platformFee > 0 ? fmtUsdFull(tx.platformFee) : '—'}
                  </td>
                  <td>{statusBadge(tx.status)}</td>
                  <td>
                    {tx.stripeId ? (
                      <a
                        href={`https://dashboard.stripe.com/payments/${tx.stripeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={s.stripeLink}
                        title={tx.stripeId}
                      >
                        {tx.stripeId.slice(0, 18)}…
                      </a>
                    ) : (
                      <span className={sh.mutedCell}>—</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {data && data.totalPages > 1 && (
          <div className={sh.pagination}>
            <span>
              {((page - 1) * 25) + 1}–{Math.min(page * 25, data.total)} of {data.total}
            </span>
            <div className={sh.paginationBtns}>
              <button
                className={sh.pageBtn}
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                Prev
              </button>
              <button
                className={sh.pageBtn}
                disabled={page >= data.totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ── Payouts Tab ───────────────────────────────────────────────────────────────

function PayoutsTab() {
  const [statusFilter, setStatusFilter] = useState('');
  const params = useMemo(() => ({
    ...(statusFilter && { status: statusFilter }),
  }), [statusFilter]);

  const { data, isLoading } = useFinancePayouts(params);
  const { mutate: retry, isPending: retrying, variables: retryingId } = useRetryPayout();

  const payouts: FinancePayout[] = data?.payouts ?? [];

  return (
    <>
      <div className={sh.filters}>
        <select
          className={sh.filterSelect}
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="processed">Processed</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Contractor</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Stripe Payout ID</th>
              <th>Status</th>
              <th>Date</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><div className={sh.skeletonLine} /></td>
                  ))}
                </tr>
              ))
            ) : !payouts.length ? (
              <tr className={sh.emptyRow}><td colSpan={6}>No payouts found.</td></tr>
            ) : (
              payouts.map((p: FinancePayout) => {
                const isFailed = p.status === 'failed';
                return (
                  <tr key={p.id} className={isFailed ? s.failedRow : undefined}>
                    <td>
                      <div className={sh.nameCell}>
                        <span className={sh.nameMain}>{p.contractorName}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtUsdFull(p.amount)}</td>
                    <td>
                      {p.stripePayoutId ? (
                        <a
                          href={`https://dashboard.stripe.com/payouts/${p.stripePayoutId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={s.stripeLink}
                          title={p.stripePayoutId}
                        >
                          {p.stripePayoutId.slice(0, 18)}…
                        </a>
                      ) : (
                        <span className={sh.mutedCell}>—</span>
                      )}
                    </td>
                    <td>{statusBadge(p.status)}</td>
                    <td className={sh.mutedCell}>{fmtDate(p.createdAt)}</td>
                    <td>
                      {isFailed ? (
                        <button
                          className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
                          disabled={retrying && retryingId === p.id}
                          onClick={() => retry(p.id)}
                        >
                          {retrying && retryingId === p.id ? 'Retrying…' : 'Retry'}
                        </button>
                      ) : (
                        <span className={sh.mutedCell}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Refund Modal ──────────────────────────────────────────────────────────────

function RefundModal({
  item,
  onClose,
}: {
  item: FailedItem;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(item.amount.toFixed(2));
  const [reason, setReason] = useState('');
  const { mutate: issue, isPending } = useIssueRefund();

  const amountNum = parseFloat(amount);
  const canSubmit = reason.trim().length >= 5 && !isNaN(amountNum) && amountNum > 0 && !!item.jobId;

  function submit() {
    if (!canSubmit || !item.jobId) return;
    issue({ jobId: item.jobId, amount: amountNum, reason }, { onSuccess: onClose });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Issue Refund</h3>
        <p className={sh.modalBody}>
          Refund for <strong>{item.jobTitle ?? item.jobId}</strong> — {item.partyName}
        </p>

        <label className={s.modalLabel}>
          Amount (USD) <span className={s.modalRequired}>*</span>
        </label>
        <input
          type="number"
          min="0.01"
          step="0.01"
          className={sh.searchInput}
          style={{ width: '100%', maxWidth: '100%', marginBottom: 16 }}
          value={amount}
          onChange={e => setAmount(e.target.value)}
        />

        <label className={s.modalLabel}>
          Reason <span className={s.modalRequired}>*</span>
        </label>
        <textarea
          className={sh.modalNote}
          placeholder="Reason for refund (min 5 chars)…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />

        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>
            Cancel
          </button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnRed}`}
            disabled={!canSubmit || isPending}
            onClick={submit}
          >
            {isPending ? 'Issuing…' : 'Issue Refund'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Failed Items Tab ──────────────────────────────────────────────────────────

function FailedItemsTab() {
  const { data, isLoading } = useFailedTransactions();
  const { mutate: retry, isPending: retrying, variables: retryingId } = useRetryPayout();
  const [refundTarget, setRefundTarget] = useState<FailedItem | null>(null);

  const items: FailedItem[] = data?.items ?? [];

  return (
    <>
      {refundTarget && (
        <RefundModal item={refundTarget} onClose={() => setRefundTarget(null)} />
      )}

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Party</th>
              <th>Job</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th>Stripe ID</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className={sh.skeletonLine} /></td>
                  ))}
                </tr>
              ))
            ) : !items.length ? (
              <tr className={sh.emptyRow}>
                <td colSpan={8}>
                  <div className={s.emptyHealthy}>
                    <span className={s.emptyCheck}>✓</span>
                    All transactions healthy
                  </div>
                </td>
              </tr>
            ) : (
              items.map((item: FailedItem) => (
                <tr key={item.id} className={s.failedRow}>
                  <td className={sh.mutedCell}>{fmtDate(item.createdAt)}</td>
                  <td>
                    <span className={`${sh.badge} ${sh.badgeCancelled}`}>
                      {item.type === 'failed_deposit' ? 'Deposit' : 'Payout'}
                    </span>
                  </td>
                  <td className={sh.mutedCell}>{item.partyName}</td>
                  <td>
                    {item.jobTitle ? (
                      <span className={sh.nameMain} title={item.jobTitle}>
                        {item.jobTitle.length > 24 ? `${item.jobTitle.slice(0, 24)}…` : item.jobTitle}
                      </span>
                    ) : (
                      <span className={sh.mutedCell}>—</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 500 }}>{fmtUsdFull(item.amount)}</td>
                  <td>
                    {item.stripeId ? (
                      <a
                        href={`https://dashboard.stripe.com/payments/${item.stripeId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={s.stripeLink}
                        title={item.stripeId}
                      >
                        {item.stripeId.slice(0, 14)}…
                      </a>
                    ) : (
                      <span className={sh.mutedCell}>—</span>
                    )}
                  </td>
                  <td>{statusBadge(item.status)}</td>
                  <td>
                    <div className={sh.actions}>
                      {item.type === 'failed_payout' ? (
                        <button
                          className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
                          disabled={retrying && retryingId === item.id}
                          onClick={() => retry(item.id)}
                        >
                          {retrying && retryingId === item.id ? 'Retrying…' : 'Retry'}
                        </button>
                      ) : (
                        <button
                          className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                          onClick={() => setRefundTarget(item)}
                        >
                          Refund
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type Tab = 'transactions' | 'payouts' | 'failed';

const TABS: { id: Tab; label: string }[] = [
  { id: 'transactions', label: 'Transactions' },
  { id: 'payouts',      label: 'Payouts' },
  { id: 'failed',       label: 'Failed Items' },
];

export function AdminFinancePage() {
  const [tab, setTab] = useState<Tab>('transactions');
  const { data: summary, isLoading: summaryLoading } = useFinanceSummary();
  const { data: failedData } = useFailedTransactions();

  const chartData = useMemo(
    () => summary ? buildChartData(summary) : [],
    [summary],
  );

  const failedCount = failedData?.items.length ?? 0;

  return (
    <div className={sh.page}>
      <AdminPageHeader
        title="Finance"
        subtitle="Revenue, escrow balances, payouts, and refund management"
      />

      {/* ── Row 1: Stat cards ─────────────────────────────────────────────── */}
      <div className={s.statRow}>
        {summaryLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className={s.statCardSkeleton}>
              <div className={sh.skeletonLine} style={{ width: '60%', marginBottom: 8 }} />
              <div className={sh.skeletonLine} style={{ width: '80%', marginBottom: 6 }} />
              <div className={sh.skeletonLine} style={{ width: '40%' }} />
            </div>
          ))
        ) : summary ? (
          <>
            <StatCard
              label="GMV This Month"
              value={fmtUsd(summary.totalGmvThisMonth)}
              current={summary.totalGmvThisMonth}
              previous={summary.totalGmvLastMonth}
              icon="$"
            />
            <StatCard
              label="Revenue This Month"
              value={fmtUsd(summary.totalRevenueThisMonth)}
              current={summary.totalRevenueThisMonth}
              previous={summary.totalRevenueLastMonth}
              icon="✦"
            />
            <StatCard
              label="Funds in Escrow"
              value={fmtUsd(summary.fundsCurrentlyInEscrow)}
              current={summary.fundsCurrentlyInEscrow}
              previous={0}
              icon="🔒"
            />
            <StatCard
              label="Pending Payouts"
              value={fmtUsd(summary.pendingPayouts)}
              current={summary.pendingPayouts}
              previous={0}
              icon="⏳"
            />
          </>
        ) : null}
      </div>

      {/* ── Row 2: Revenue chart ──────────────────────────────────────────── */}
      <div className={s.chartCard}>
        <p className={s.chartTitle}>GMV & Revenue — Last 12 Months</p>
        {summaryLoading ? (
          <div className={s.chartSkeleton}>
            <div className={sh.skeletonLine} style={{ height: '100%', borderRadius: 8 }} />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 0 }} barSize={14}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-surface)' }} />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                iconType="square"
                iconSize={10}
              />
              <Bar dataKey="GMV"     fill="var(--color-primary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Revenue" fill="var(--color-accent)"  radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div className={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.id}
            className={`${s.tab} ${tab === t.id ? s.tabActive : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.id === 'failed' && failedCount > 0 && (
              <span className={s.tabCountRed}>{failedCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab panels ────────────────────────────────────────────────────── */}
      {tab === 'transactions' && <TransactionsTab />}
      {tab === 'payouts'      && <PayoutsTab />}
      {tab === 'failed'       && <FailedItemsTab />}
    </div>
  );
}
