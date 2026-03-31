import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { StarRating } from '../../components/ui';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import {
  useAdminReviewQueue,
  useAdminReviews,
  useAdminReviewAnomalies,
  useApproveReview,
  useRemoveReview,
  useEditReview,
  useFlagReview,
} from '../../hooks/useAdmin';
import type { AdminReviewListItem, ReviewAnomalies } from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s from './AdminReviewsPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function SkeletonCards() {
  return (
    <>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className={s.queueCard}>
          <div className={sh.skeletonLine} style={{ width: 160, marginBottom: 8 }} />
          <div className={sh.skeletonLine} style={{ width: 240, marginBottom: 12 }} />
          <div className={sh.skeletonLine} style={{ width: '100%', marginBottom: 6 }} />
          <div className={sh.skeletonLine} style={{ width: '80%' }} />
        </div>
      ))}
    </>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className={sh.skeletonRow}>
          {Array.from({ length: cols }).map((_, j) => (
            <td key={j}><div className={sh.skeletonLine} style={{ width: j === 0 ? 160 : 90 }} /></td>
          ))}
        </tr>
      ))}
    </>
  );
}

// ── Remove modal ──────────────────────────────────────────────────────────────

function RemoveModal({
  reviewerName,
  onConfirm,
  onClose,
  isLoading,
}: {
  reviewerName: string;
  onConfirm:   (reason: string) => void;
  onClose:     () => void;
  isLoading:   boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Remove Review</h3>
        <p className={sh.modalBody}>
          Remove review by <strong>{reviewerName}</strong>? This will soft-delete the review
          and recalculate the contractor's rating. The reviewer will be notified.
        </p>
        <label className={s.modalLabel}>
          Reason <span style={{ color: 'var(--color-danger)' }}>*</span>
        </label>
        <textarea
          className={sh.modalNote}
          rows={3}
          placeholder="Explain why this review is being removed…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>
            Cancel
          </button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnRed}`}
            disabled={reason.trim().length < 5 || isLoading}
            onClick={() => onConfirm(reason.trim())}
          >
            {isLoading ? 'Removing…' : 'Remove Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminReviewsPage() {
  const navigate = useNavigate();

  const [tab, setTab] = useState<'queue' | 'all' | 'anomalies'>('queue');

  // Queue inline-edit state
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // Remove modal target
  const [removeTarget, setRemoveTarget] = useState<{ id: string; reviewerName: string } | null>(null);

  // All reviews filter state
  const [page,             setPage]             = useState(1);
  const [minRating,        setMinRating]        = useState('');
  const [maxRating,        setMaxRating]        = useState('');
  const [dateFrom,         setDateFrom]         = useState('');
  const [dateTo,           setDateTo]           = useState('');
  const [contractorSearch, setContractorSearch] = useState('');
  const [reviewerSearch,   setReviewerSearch]   = useState('');

  // Data hooks
  const queueQuery     = useAdminReviewQueue();
  const anomaliesQuery = useAdminReviewAnomalies();

  const allParams = useMemo(() => {
    const p: Record<string, unknown> = { page, limit: 25 };
    if (minRating)        p.minRating = minRating;
    if (maxRating)        p.maxRating = maxRating;
    if (dateFrom)         p.dateFrom  = dateFrom;
    if (dateTo)           p.dateTo    = dateTo;
    return p;
  }, [page, minRating, maxRating, dateFrom, dateTo]);

  const allQuery = useAdminReviews(allParams);

  // Mutation hooks
  const approve = useApproveReview();
  const remove  = useRemoveReview();
  const edit    = useEditReview();
  const flag    = useFlagReview();

  // Queue sorted oldest first
  const queueItems = useMemo(() => {
    const items = queueQuery.data?.data ?? [];
    return [...items].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [queueQuery.data]);

  // All reviews with client-side name filter on current page
  const allReviews = useMemo(() => {
    const items = allQuery.data?.data ?? [];
    return items.filter(r => {
      if (contractorSearch && !r.contractorName.toLowerCase().includes(contractorSearch.toLowerCase())) return false;
      if (reviewerSearch   && !r.reviewerName.toLowerCase().includes(reviewerSearch.toLowerCase()))   return false;
      return true;
    });
  }, [allQuery.data, contractorSearch, reviewerSearch]);

  function startEdit(item: AdminReviewListItem) {
    setEditingId(item.id);
    setEditContent(item.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditContent('');
  }

  function saveEdit(id: string) {
    edit.mutate({ id, newContent: editContent }, { onSuccess: cancelEdit });
  }

  function resetFilter(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(1); };
  }

  const anomalies: ReviewAnomalies | null = anomaliesQuery.data ?? null;

  return (
    <div className={sh.page}>
      <AdminPageHeader title="Reviews & Ratings" subtitle="Moderate contractor reviews, detect anomalies, and maintain platform trust." />

      {/* Tabs */}
      <div className={s.tabs}>
        <button
          className={`${s.tab} ${tab === 'queue' ? s.tabActive : ''}`}
          onClick={() => setTab('queue')}
        >
          Moderation Queue
          {!queueQuery.isLoading && queueItems.length > 0 && (
            <span className={s.tabCountBadge}>{queueItems.length}</span>
          )}
        </button>
        <button
          className={`${s.tab} ${tab === 'all' ? s.tabActive : ''}`}
          onClick={() => setTab('all')}
        >
          All Reviews
        </button>
        <button
          className={`${s.tab} ${tab === 'anomalies' ? s.tabActive : ''}`}
          onClick={() => setTab('anomalies')}
        >
          Anomalies
          {anomalies && (anomalies.ratingDrops.length + anomalies.potentialFakeSeeding.length + anomalies.duplicateContent.length) > 0 && (
            <span className={s.tabCountBadgeDanger}>
              {anomalies.ratingDrops.length + anomalies.potentialFakeSeeding.length + anomalies.duplicateContent.length}
            </span>
          )}
        </button>
      </div>

      {/* ── MODERATION QUEUE TAB ─────────────────────────────────────────── */}
      {tab === 'queue' && (
        <div>
          {queueQuery.isLoading && <SkeletonCards />}

          {!queueQuery.isLoading && queueItems.length === 0 && (
            <div className={s.emptyHealthy}>
              <span className={s.emptyCheck}>✓</span>
              <p className={s.emptyMsg}>Queue is clear</p>
              <p className={s.emptySub}>No reviews are currently flagged for moderation.</p>
            </div>
          )}

          {queueItems.map(item => (
            <div key={item.id} className={s.queueCard}>
              <div className={s.queueCardHeader}>
                <div className={s.queueCardMeta}>
                  <span className={s.flaggedBadge}>Flagged</span>
                  <span className={s.queueCardRole}>{item.reviewerRole}</span>
                </div>
                <span className={s.queueCardDate}>{fmtDate(item.createdAt)}</span>
              </div>

              <div className={s.queueCardParties}>
                <button
                  className={s.partyLink}
                  onClick={() => navigate(`/admin/users/${item.reviewerId}`)}
                >
                  {item.reviewerName}
                </button>
                <span className={s.partyArrow}>→</span>
                {item.contractorProfileId ? (
                  <button
                    className={s.partyLink}
                    onClick={() => navigate(`/admin/contractors/${item.contractorProfileId}`)}
                  >
                    {item.contractorName}
                  </button>
                ) : (
                  <span>{item.contractorName}</span>
                )}
              </div>

              <div className={s.queueCardRating}>
                <StarRating rating={item.rating} size={14} />
                <span className={s.ratingNum}>{item.rating}/5</span>
                {item.title && <span className={s.reviewTitle}>"{item.title}"</span>}
              </div>

              {editingId === item.id ? (
                <div className={s.editBlock}>
                  <label className={s.editLabel}>Edit content</label>
                  <textarea
                    className={s.editArea}
                    rows={5}
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                  />
                </div>
              ) : (
                <p className={s.queueCardBody}>{item.body}</p>
              )}

              <div className={s.queueCardActions}>
                {editingId === item.id ? (
                  <>
                    <button
                      className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
                      disabled={editContent.trim().length < 10 || edit.isPending}
                      onClick={() => saveEdit(item.id)}
                    >
                      {edit.isPending ? 'Saving…' : 'Save Edit'}
                    </button>
                    <button
                      className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
                      onClick={cancelEdit}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className={`${sh.actionBtn} ${s.approveBtn}`}
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(item.id)}
                    >
                      Approve
                    </button>
                    <button
                      className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>
                    <button
                      className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                      onClick={() => setRemoveTarget({ id: item.id, reviewerName: item.reviewerName })}
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ALL REVIEWS TAB ──────────────────────────────────────────────── */}
      {tab === 'all' && (
        <div>
          {/* Filter bar */}
          <div className={sh.filters}>
            <input
              className={sh.searchInput}
              placeholder="Filter by reviewer name…"
              value={reviewerSearch}
              onChange={e => setReviewerSearch(e.target.value)}
            />
            <input
              className={sh.searchInput}
              placeholder="Filter by contractor name…"
              value={contractorSearch}
              onChange={e => setContractorSearch(e.target.value)}
            />
            <select
              className={sh.filterSelect}
              value={minRating}
              onChange={e => resetFilter(setMinRating)(e.target.value)}
            >
              <option value="">Min rating</option>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} ★</option>)}
            </select>
            <select
              className={sh.filterSelect}
              value={maxRating}
              onChange={e => resetFilter(setMaxRating)(e.target.value)}
            >
              <option value="">Max rating</option>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n} ★</option>)}
            </select>
            <input
              type="date"
              className={sh.filterSelect}
              value={dateFrom}
              onChange={e => resetFilter(setDateFrom)(e.target.value)}
              title="From date"
            />
            <input
              type="date"
              className={sh.filterSelect}
              value={dateTo}
              onChange={e => resetFilter(setDateTo)(e.target.value)}
              title="To date"
            />
            {(minRating || maxRating || dateFrom || dateTo || contractorSearch || reviewerSearch) && (
              <button
                className={s.clearBtn}
                onClick={() => {
                  setMinRating(''); setMaxRating('');
                  setDateFrom(''); setDateTo('');
                  setContractorSearch(''); setReviewerSearch('');
                  setPage(1);
                }}
              >
                Clear filters
              </button>
            )}
            <span className={s.totalCount}>
              {allQuery.data ? `${allQuery.data.total} total` : ''}
            </span>
          </div>

          <div className={sh.tableWrap}>
            <table className={sh.table}>
              <thead>
                <tr>
                  <th>Reviewer</th>
                  <th>Contractor</th>
                  <th>Rating</th>
                  <th>Content</th>
                  <th>Job</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allQuery.isLoading && <SkeletonRows cols={7} />}

                {!allQuery.isLoading && allReviews.length === 0 && (
                  <tr className={sh.emptyRow}>
                    <td colSpan={7}>No reviews match the current filters.</td>
                  </tr>
                )}

                {allReviews.map(item => (
                  <tr key={item.id} className={item.isFlagged ? s.flaggedRow : ''}>
                    <td>
                      <div className={s.userCell}>
                        <button
                          className={s.userLink}
                          onClick={() => navigate(`/admin/users/${item.reviewerId}`)}
                        >
                          {item.reviewerName}
                        </button>
                        <span className={s.userEmail}>{item.reviewerEmail}</span>
                      </div>
                    </td>
                    <td>
                      {item.contractorProfileId ? (
                        <button
                          className={s.userLink}
                          onClick={() => navigate(`/admin/contractors/${item.contractorProfileId}`)}
                        >
                          {item.contractorName}
                        </button>
                      ) : (
                        <span className={sh.mutedCell}>{item.contractorName}</span>
                      )}
                    </td>
                    <td>
                      <StarRating rating={item.rating} size={13} />
                    </td>
                    <td>
                      <span className={s.previewText} title={item.body}>
                        {item.contentPreview}
                      </span>
                      {item.isFlagged && <span className={s.flaggedBadge} style={{ display: 'block', marginTop: 3 }}>Flagged</span>}
                    </td>
                    <td>
                      <button
                        className={s.jobLink}
                        onClick={() => navigate(`/admin/jobs/${item.jobId}`)}
                      >
                        {item.jobId.slice(-8)}
                      </button>
                    </td>
                    <td className={s.dateCell}>{fmtDate(item.createdAt)}</td>
                    <td>
                      <div className={sh.actions}>
                        {!item.isFlagged && (
                          <button
                            className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
                            disabled={flag.isPending}
                            onClick={() => flag.mutate(item.id)}
                          >
                            Flag
                          </button>
                        )}
                        {item.isFlagged && (
                          <button
                            className={`${sh.actionBtn} ${s.approveBtn}`}
                            disabled={approve.isPending}
                            onClick={() => approve.mutate(item.id)}
                          >
                            Approve
                          </button>
                        )}
                        <button
                          className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                          onClick={() => setRemoveTarget({ id: item.id, reviewerName: item.reviewerName })}
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {allQuery.data && allQuery.data.totalPages > 1 && (
              <div className={sh.pagination}>
                <span>
                  Page {allQuery.data.page} of {allQuery.data.totalPages}
                </span>
                <div className={sh.paginationBtns}>
                  <button
                    className={sh.pageBtn}
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    ← Prev
                  </button>
                  <button
                    className={sh.pageBtn}
                    disabled={page >= allQuery.data.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ANOMALIES TAB ────────────────────────────────────────────────── */}
      {tab === 'anomalies' && (
        <div>
          {anomaliesQuery.isLoading && (
            <div className={s.anomalySection}>
              <div className={sh.skeletonLine} style={{ width: 200, marginBottom: 16, height: 18 }} />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={s.anomalyCard}>
                  <div className={sh.skeletonLine} style={{ width: 160, marginBottom: 8 }} />
                  <div className={sh.skeletonLine} style={{ width: 240 }} />
                </div>
              ))}
            </div>
          )}

          {!anomaliesQuery.isLoading && anomalies && (
            <>
              {/* 1. Sudden rating drops */}
              <div className={s.anomalySection}>
                <h3 className={s.anomalySectionTitle}>
                  Sudden Rating Drops
                  <span className={s.anomalyCount}>{anomalies.ratingDrops.length}</span>
                </h3>
                <p className={s.anomalySectionDesc}>
                  Contractors whose current average is more than 1 star below their historical average (reviews older than 7 days).
                </p>
                {anomalies.ratingDrops.length === 0 ? (
                  <p className={s.anomalyEmpty}>No sudden rating drops detected.</p>
                ) : (
                  anomalies.ratingDrops.map((item, i) => (
                    <div key={i} className={s.anomalyCard}>
                      <div className={s.anomalyCardHeader}>
                        <span className={s.anomalyName}>{item.name}</span>
                        <span className={s.anomalyDropBadge}>−{item.drop.toFixed(1)} ★</span>
                      </div>
                      <div className={s.anomalyCardMeta}>
                        Historical avg: <strong>{item.oldAvg.toFixed(1)}</strong> → Current:{' '}
                        <strong style={{ color: 'var(--color-danger)' }}>{item.currentAvg.toFixed(1)}</strong>
                      </div>
                      <button
                        className={s.investigateLink}
                        onClick={() => navigate(`/admin/contractors/${item.contractorProfileId}`)}
                      >
                        Investigate →
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* 2. Suspiciously perfect */}
              <div className={s.anomalySection}>
                <h3 className={s.anomalySectionTitle}>
                  Suspiciously Perfect
                  <span className={s.anomalyCount}>{anomalies.potentialFakeSeeding.length}</span>
                </h3>
                <p className={s.anomalySectionDesc}>
                  Contractors with a perfect 5.0 average but fewer than 5 total reviews — possible fake seeding.
                </p>
                {anomalies.potentialFakeSeeding.length === 0 ? (
                  <p className={s.anomalyEmpty}>No suspicious perfect ratings detected.</p>
                ) : (
                  anomalies.potentialFakeSeeding.map((item, i) => (
                    <div key={i} className={s.anomalyCard}>
                      <div className={s.anomalyCardHeader}>
                        <span className={s.anomalyName}>{item.name}</span>
                        <span className={s.anomalyPerfectBadge}>★ {item.averageRating.toFixed(1)}</span>
                      </div>
                      <div className={s.anomalyCardMeta}>
                        {item.totalReviews} review{item.totalReviews !== 1 ? 's' : ''} — all perfect
                      </div>
                      <button
                        className={s.investigateLink}
                        onClick={() => navigate(`/admin/contractors/${item.contractorProfileId}`)}
                      >
                        Investigate →
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* 3. Duplicate content */}
              <div className={s.anomalySection}>
                <h3 className={s.anomalySectionTitle}>
                  Duplicate Content
                  <span className={s.anomalyCount}>{anomalies.duplicateContent.length}</span>
                </h3>
                <p className={s.anomalySectionDesc}>
                  Reviewers who submitted the identical review body on 3 or more different contractors.
                </p>
                {anomalies.duplicateContent.length === 0 ? (
                  <p className={s.anomalyEmpty}>No duplicate content detected.</p>
                ) : (
                  anomalies.duplicateContent.map((item, i) => (
                    <div key={i} className={s.anomalyCard}>
                      <div className={s.anomalyCardHeader}>
                        <span className={s.anomalyName}>{item.name}</span>
                        <span className={s.anomalyDupeBadge}>{item.contractorCount} contractors</span>
                      </div>
                      <div className={s.anomalyCardMeta}>{item.email}</div>
                      <p className={s.anomalyBodyPreview}>"{item.body}"</p>
                      <button
                        className={s.investigateLink}
                        onClick={() => navigate(`/admin/users/${item.reviewerId}`)}
                      >
                        Investigate →
                      </button>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Remove modal */}
      {removeTarget && (
        <RemoveModal
          reviewerName={removeTarget.reviewerName}
          onConfirm={(reason) => {
            remove.mutate(
              { id: removeTarget.id, reason },
              { onSuccess: () => setRemoveTarget(null) },
            );
          }}
          onClose={() => setRemoveTarget(null)}
          isLoading={remove.isPending}
        />
      )}
    </div>
  );
}
