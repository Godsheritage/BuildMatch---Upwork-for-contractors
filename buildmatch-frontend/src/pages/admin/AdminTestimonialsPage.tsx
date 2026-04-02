import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Quote, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getAdminTestimonials,
  approveTestimonial,
  rejectTestimonial,
  type AdminTestimonial,
} from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s from './AdminTestimonialsPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={s.queueCard}>
          <div className={sh.skeletonLine} style={{ width: '90%', marginBottom: 8 }} />
          <div className={sh.skeletonLine} style={{ width: '75%', marginBottom: 8 }} />
          <div className={sh.skeletonLine} style={{ width: '50%' }} />
        </div>
      ))}
    </>
  );
}

// ── Reject Modal ──────────────────────────────────────────────────────────────

function RejectModal({
  testimonial,
  onConfirm,
  onCancel,
  loading,
}: {
  testimonial: AdminTestimonial;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className={sh.backdrop} onClick={onCancel}>
      <div className={sh.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Reject Testimonial</h3>
        <p className={sh.modalBody}>
          This will permanently delete the testimonial from{' '}
          <strong>{testimonial.authorName}</strong> for{' '}
          <strong>{testimonial.contractorName}</strong>. Provide a reason for the audit log.
        </p>
        <textarea
          className={s.modalTextarea}
          placeholder="Reason (min 5 characters)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
        />
        <div className={sh.modalActions}>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnRed}`}
            disabled={loading || reason.trim().length < 5}
            onClick={() => onConfirm(reason.trim())}
          >
            {loading ? 'Rejecting…' : 'Reject & Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Queue Card ────────────────────────────────────────────────────────────────

function TestimonialCard({
  t,
  onApprove,
  onReject,
  approving,
}: {
  t: AdminTestimonial;
  onApprove: () => void;
  onReject: () => void;
  approving: boolean;
}) {
  return (
    <div className={s.queueCard}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
        <Quote size={18} style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 3 }} />
        <p className={s.queueCardBody}>{t.body}</p>
      </div>

      <div className={s.queueCardFooter}>
        <div className={s.queueCardMeta}>
          <span className={s.queueCardAuthor}>
            {t.authorName}{' '}
            <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>({t.authorEmail})</span>
          </span>
          <span className={s.queueCardSub}>
            For: <strong style={{ color: 'var(--color-text-primary)' }}>{t.contractorName}</strong>
            {' '}· Submitted {fmtDate(t.createdAt)}
          </span>
        </div>

        <div className={s.queueCardActions}>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnRed}`}
            onClick={onReject}
            disabled={approving}
          >
            Reject
          </button>
          <button
            className={`${sh.actionBtn} ${s.approveBtn}`}
            onClick={onApprove}
            disabled={approving}
          >
            {approving ? 'Approving…' : 'Approve'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Pagination ────────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className={sh.pagination}>
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
        Page {page} of {totalPages}
      </span>
      <div className={sh.paginationBtns}>
        <button className={sh.pageBtn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={14} />
        </button>
        <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'queue' | 'all';

export function AdminTestimonialsPage() {
  const qc = useQueryClient();
  const [tab,         setTab]         = useState<Tab>('queue');
  const [rejectTarget, setRejectTarget] = useState<AdminTestimonial | null>(null);
  const [approvingId, setApprovingId]  = useState<string | null>(null);
  const [rejectingId, setRejectingId]  = useState<string | null>(null);

  // ── Queue tab ──────────────────────────────────────────────────────────────
  const [qPage, setQPage] = useState(1);

  const queueQ = useQuery({
    queryKey: ['admin', 'testimonials', 'pending', qPage],
    queryFn:  () => getAdminTestimonials({ approved: 'false', page: qPage, limit: 10 }),
    enabled:  tab === 'queue',
    staleTime: 30_000,
  });

  // ── All tab ────────────────────────────────────────────────────────────────
  const [aPage,     setAPage]     = useState(1);
  const [aApproved, setAApproved] = useState<'all' | 'true' | 'false'>('all');

  const allQ = useQuery({
    queryKey: ['admin', 'testimonials', 'all', aPage, aApproved],
    queryFn:  () => getAdminTestimonials({ approved: aApproved, page: aPage, limit: 25 }),
    enabled:  tab === 'all',
    staleTime: 30_000,
  });

  // ── Mutations ──────────────────────────────────────────────────────────────

  const approveMut = useMutation({
    mutationFn: (id: string) => approveTestimonial(id),
    onMutate:   (id) => setApprovingId(id),
    onSettled:  () => setApprovingId(null),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['admin', 'testimonials'] }),
  });

  const rejectMut = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTestimonial(id, reason),
    onMutate:   ({ id }) => setRejectingId(id),
    onSettled:  () => setRejectingId(null),
    onSuccess:  () => {
      setRejectTarget(null);
      qc.invalidateQueries({ queryKey: ['admin', 'testimonials'] });
    },
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className={sh.page}>
      {/* Header */}
      <div className={sh.pageHeader}>
        <h1 className={sh.pageTitle}>Testimonials</h1>
        <p className={sh.pageSubtitle}>Review and approve contractor testimonials before they appear publicly.</p>
      </div>

      {/* Tabs */}
      <div className={s.tabs}>
        <button
          className={`${s.tab} ${tab === 'queue' ? s.tabActive : ''}`}
          onClick={() => setTab('queue')}
        >
          Pending Approval
          {queueQ.data && queueQ.data.total > 0 && (
            <span className={s.tabCountBadge}>{queueQ.data.total}</span>
          )}
        </button>
        <button
          className={`${s.tab} ${tab === 'all' ? s.tabActive : ''}`}
          onClick={() => setTab('all')}
        >
          All Testimonials
        </button>
      </div>

      {/* ── Pending Queue ────────────────────────────────────────────────────── */}
      {tab === 'queue' && (
        <>
          {queueQ.isLoading && <SkeletonCards />}

          {queueQ.isError && (
            <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>Failed to load testimonials.</p>
          )}

          {queueQ.data && queueQ.data.data.length === 0 && (
            <div className={s.emptyHealthy}>
              <CheckCircle2 size={40} style={{ color: 'var(--color-accent)' }} />
              <p className={s.emptyMsg}>Queue is clear</p>
              <p className={s.emptySub}>All testimonials have been reviewed.</p>
            </div>
          )}

          {queueQ.data?.data.map((t) => (
            <TestimonialCard
              key={t.id}
              t={t}
              approving={approvingId === t.id}
              onApprove={() => approveMut.mutate(t.id)}
              onReject={() => setRejectTarget(t)}
            />
          ))}

          {queueQ.data && (
            <Pagination page={qPage} totalPages={queueQ.data.totalPages} onPage={setQPage} />
          )}
        </>
      )}

      {/* ── All Testimonials ─────────────────────────────────────────────────── */}
      {tab === 'all' && (
        <>
          {/* Filter */}
          <div className={sh.filters}>
            <select
              className={sh.filterSelect}
              value={aApproved}
              onChange={(e) => {
                setAApproved(e.target.value as 'all' | 'true' | 'false');
                setAPage(1);
              }}
            >
              <option value="all">All statuses</option>
              <option value="false">Pending</option>
              <option value="true">Approved</option>
            </select>
          </div>

          {allQ.isLoading && (
            <>
              {Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 6 }).map((__, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: j === 2 ? 200 : 100 }} /></td>
                  ))}
                </tr>
              ))}
            </>
          )}

          {allQ.isError && (
            <p style={{ color: 'var(--color-danger)', fontSize: 14 }}>Failed to load testimonials.</p>
          )}

          {allQ.data && allQ.data.data.length === 0 && (
            <tr className={sh.emptyRow}>
              <td colSpan={6} style={{ textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 14, padding: '32px 0' }}>
                No testimonials match this filter.
              </td>
            </tr>
          )}

          {allQ.data && allQ.data.data.length > 0 && (
            <div className={sh.tableWrap}>
              <table className={sh.table}>
                <thead>
                  <tr>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>Author</th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>Contractor</th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>Content</th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>Status</th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>Submitted</th>
                    <th style={{ padding: '10px 12px', fontSize: 11, fontWeight: 500, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allQ.data.data.map((t) => (
                    <tr
                      key={t.id}
                      style={{ borderBottom: '1px solid var(--color-border)' }}
                    >
                      <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                        <div className={s.userCell}>
                          <span className={s.userName}>{t.authorName}</span>
                          <span className={s.userEmail}>{t.authorEmail}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'top', fontSize: 13, color: 'var(--color-text-primary)' }}>
                        {t.contractorName}
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                        <span className={s.previewText}>
                          {t.body.length > 100 ? t.body.slice(0, 100) + '…' : t.body}
                        </span>
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                        {t.approved
                          ? <span className={s.badgeApproved}>Approved</span>
                          : <span className={s.badgePending}>Pending</span>
                        }
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                        <span className={s.dateCell}>{fmtDate(t.createdAt)}</span>
                      </td>
                      <td style={{ padding: '12px 12px', verticalAlign: 'top' }}>
                        <div className={sh.actions}>
                          {!t.approved && (
                            <button
                              className={`${sh.actionBtn} ${s.approveBtn}`}
                              disabled={approvingId === t.id}
                              onClick={() => approveMut.mutate(t.id)}
                            >
                              {approvingId === t.id ? 'Approving…' : 'Approve'}
                            </button>
                          )}
                          <button
                            className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                            disabled={rejectingId === t.id}
                            onClick={() => setRejectTarget(t)}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {allQ.data && (
            <Pagination page={aPage} totalPages={allQ.data.totalPages} onPage={setAPage} />
          )}
        </>
      )}

      {/* Reject Modal */}
      {rejectTarget && (
        <RejectModal
          testimonial={rejectTarget}
          loading={rejectingId === rejectTarget.id}
          onConfirm={(reason) => rejectMut.mutate({ id: rejectTarget.id, reason })}
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </div>
  );
}
