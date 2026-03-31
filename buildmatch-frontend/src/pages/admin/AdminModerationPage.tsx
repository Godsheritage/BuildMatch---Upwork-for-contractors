import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { ConfirmModal } from '../../components/admin/shared/ConfirmModal';
import { Avatar } from '../../components/ui';
import {
  useFilteredMessages,
  useModerationContentQueue,
  useModerationFlaggedUsers,
  useWarnMessageUser,
  useEscalateMessageUser,
  useWarnUserDirectly,
  useApproveModerationContent,
  useRemoveModerationContent,
  useBanUser,
} from '../../hooks/useAdmin';
import type {
  FilteredMessage,
  ModerationContentQueueItem,
  ModerationFlaggedUser,
} from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s from './AdminModerationPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
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

// ── Remove-with-reason modal ──────────────────────────────────────────────────

function RemoveModal({
  title,
  message,
  onConfirm,
  onClose,
  isLoading,
}: {
  title: string;
  message: string;
  onConfirm: (reason: string) => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  const [reason, setReason] = useState('');
  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>{title}</h3>
        <p className={sh.modalBody}>{message}</p>
        <label className={s.modalLabel}>Reason <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <textarea
          className={sh.modalNote}
          rows={3}
          placeholder="Explain why this content is being removed…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnRed}`}
            disabled={!reason.trim() || isLoading}
            onClick={() => onConfirm(reason.trim())}
          >
            {isLoading ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Warn-user modal (direct, not tied to a message) ───────────────────────────

function WarnUserModal({
  user,
  onClose,
}: {
  user: ModerationFlaggedUser;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const { mutate, isPending } = useWarnUserDirectly();

  function submit() {
    if (reason.trim().length < 5) return;
    mutate({ userId: user.id, reason: reason.trim() }, { onSuccess: onClose });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Warn {user.firstName} {user.lastName}</h3>
        <p className={sh.modalBody}>
          This will send a formal warning and record it in the admin log.
        </p>
        <label className={s.modalLabel}>Warning message <span style={{ color: 'var(--color-danger)' }}>*</span></label>
        <textarea
          className={sh.modalNote}
          rows={4}
          placeholder="Describe the issue and what behavior must change (min 5 chars)…"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
            disabled={reason.trim().length < 5 || isPending}
            onClick={submit}
          >
            {isPending ? 'Sending…' : 'Send Warning'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FILTERED MESSAGES TAB ─────────────────────────────────────────────────────

function FilteredMessagesTab() {
  const navigate = useNavigate();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [userId,   setUserId]   = useState('');
  const [page,     setPage]     = useState(1);
  const LIMIT = 25;

  const params = {
    page, limit: LIMIT,
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo   ? { dateTo }   : {}),
    ...(userId   ? { userId }   : {}),
  };

  const { data, isLoading } = useFilteredMessages(params);
  const { mutate: warn,     isPending: warnPending     } = useWarnMessageUser();
  const { mutate: escalate, isPending: escalatePending } = useEscalateMessageUser();

  const [actionTarget, setActionTarget] = useState<{ id: string; action: 'warn' | 'escalate' } | null>(null);

  const messages  = data?.data ?? [];
  const total     = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function clearFilters() {
    setDateFrom(''); setDateTo(''); setUserId(''); setPage(1);
  }

  return (
    <>
      {/* Filter bar */}
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
          placeholder="Filter by user ID…"
          value={userId}
          onChange={e => { setUserId(e.target.value); setPage(1); }}
        />
        {(dateFrom || dateTo || userId) && (
          <button className={s.clearBtn} onClick={clearFilters}>Clear</button>
        )}
        <span className={s.totalCount}>{total} total</span>
      </div>

      {/* Table */}
      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Sender</th>
              <th>Recipient</th>
              <th>Job</th>
              <th>Filter Reason</th>
              <th>Sent</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows cols={6} />
            ) : messages.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={6}>No filtered messages found</td></tr>
            ) : messages.map((m: FilteredMessage) => (
              <tr key={m.id}>
                <td>
                  <div className={s.userCell}>
                    <button
                      className={s.userLink}
                      onClick={() => navigate(`/admin/users/${m.sender.id}`)}
                    >
                      {m.sender.name}
                    </button>
                    <span className={s.userEmail}>{m.sender.email}</span>
                  </div>
                  {m.senderFilterCount > 3 && (
                    <span className={s.filterCountBadge}>{m.senderFilterCount} total</span>
                  )}
                </td>
                <td>
                  {m.recipient ? (
                    <div className={s.userCell}>
                      <button
                        className={s.userLink}
                        onClick={() => navigate(`/admin/users/${m.recipient!.id}`)}
                      >
                        {m.recipient.name}
                      </button>
                      <span className={s.userEmail}>{m.recipient.email}</span>
                    </div>
                  ) : <span style={{ color: 'var(--color-text-muted)' }}>—</span>}
                </td>
                <td>
                  <button
                    className={s.jobLink}
                    onClick={() => navigate(`/admin/jobs/${m.jobId}`)}
                  >
                    {m.jobTitle || m.jobId.slice(0, 8)}
                  </button>
                </td>
                <td>
                  <span className={s.filterReasonBadge}>{m.filterReason ?? 'unknown'}</span>
                </td>
                <td className={s.dateCell}>{fmtDateTime(m.createdAt)}</td>
                <td>
                  <div className={s.actionGroup}>
                    <button
                      className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
                      disabled={warnPending}
                      onClick={() => setActionTarget({ id: m.id, action: 'warn' })}
                    >
                      Warn User
                    </button>
                    <button
                      className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                      disabled={escalatePending}
                      onClick={() => setActionTarget({ id: m.id, action: 'escalate' })}
                    >
                      Escalate
                    </button>
                    <button
                      className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
                      onClick={() => navigate(`/admin/jobs/${m.jobId}`)}
                    >
                      View Job
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!isLoading && total > 0 && (
          <div className={sh.pagination}>
            <span>Showing {messages.length ? (page - 1) * LIMIT + 1 : 0}–{Math.min(page * LIMIT, total)} of {total}</span>
            <div className={sh.paginationBtns}>
              <button className={sh.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button className={`${sh.pageBtn} ${sh.pageBtnActive}`}>{page}</button>
              <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Confirm modals */}
      {actionTarget?.action === 'warn' && (
        <ConfirmModal
          isOpen
          title="Warn user?"
          message="This sends a ToS warning message into the conversation and records the action."
          confirmLabel="Send Warning"
          variant="warning"
          isLoading={warnPending}
          onClose={() => setActionTarget(null)}
          onConfirm={() => warn(actionTarget.id, { onSuccess: () => setActionTarget(null) })}
        />
      )}
      {actionTarget?.action === 'escalate' && (
        <ConfirmModal
          isOpen
          title="Escalate user?"
          message="This flags the user for immediate review. If they have 3+ events, suspension will be suggested."
          confirmLabel="Escalate"
          variant="danger"
          isLoading={escalatePending}
          onClose={() => setActionTarget(null)}
          onConfirm={() => escalate(actionTarget.id, { onSuccess: () => setActionTarget(null) })}
        />
      )}
    </>
  );
}

// ── CONTENT QUEUE TAB ─────────────────────────────────────────────────────────

function ContentQueueTab() {
  const { data, isLoading } = useModerationContentQueue();
  const { mutate: approve, isPending: approvePending, variables: approveVars } = useApproveModerationContent();
  const { mutate: remove,  isPending: removePending  } = useRemoveModerationContent();

  const [approveTarget, setApproveTarget] = useState<ModerationContentQueueItem | null>(null);
  const [removeTarget,  setRemoveTarget]  = useState<ModerationContentQueueItem | null>(null);

  const queue = data?.queue ?? [];

  if (isLoading) {
    return (
      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead><tr><th>Type</th><th>Content Preview</th><th>Reason</th><th>Reported At</th><th>Actions</th></tr></thead>
          <tbody><SkeletonRows cols={5} /></tbody>
        </table>
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className={s.emptyHealthy}>
        <div className={s.emptyCheck}>✓</div>
        <p className={s.emptyMsg}>Content queue is clear</p>
        <p className={s.emptySub}>No flagged jobs or reviews awaiting review.</p>
      </div>
    );
  }

  return (
    <>
      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Content Preview</th>
              <th>Reason</th>
              <th>Reported At</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((item: ModerationContentQueueItem) => {
              const isApproving = approvePending && approveVars?.id === item.id;
              return (
                <tr key={`${item.type}-${item.id}`}>
                  <td>
                    <span className={item.type === 'job' ? s.typeBadgeJob : s.typeBadgeReview}>
                      {item.type === 'job' ? 'Job' : 'Review'}
                    </span>
                  </td>
                  <td>
                    <div className={s.previewCell}>
                      <span className={s.previewText}>{item.contentPreview}</span>
                      {item.reporter && (
                        <span className={s.reporterMeta}>by {item.reporter.name}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {item.reason
                      ? <span className={s.filterReasonBadge}>{item.reason}</span>
                      : <span style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>—</span>}
                  </td>
                  <td className={s.dateCell}>{fmtDate(item.createdAt)}</td>
                  <td>
                    <div className={s.actionGroup}>
                      <button
                        className={`${sh.actionBtn} ${s.actionBtnGreen}`}
                        disabled={isApproving}
                        onClick={() => setApproveTarget(item)}
                      >
                        {isApproving ? '…' : 'Approve'}
                      </button>
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                        onClick={() => setRemoveTarget(item)}
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {approveTarget && (
        <ConfirmModal
          isOpen
          title={`Approve ${approveTarget.type}?`}
          message={`The flag will be cleared and the ${approveTarget.type} will remain visible to users.`}
          confirmLabel="Approve"
          variant="primary"
          isLoading={approvePending}
          onClose={() => setApproveTarget(null)}
          onConfirm={() =>
            approve(
              { type: approveTarget.type, id: approveTarget.id },
              { onSuccess: () => setApproveTarget(null) },
            )
          }
        />
      )}

      {removeTarget && (
        <RemoveModal
          title={`Remove ${removeTarget.type}?`}
          message={
            removeTarget.type === 'job'
              ? 'The job will be cancelled and hidden from all users.'
              : 'The review will be permanently hidden (soft-deleted).'
          }
          isLoading={removePending}
          onClose={() => setRemoveTarget(null)}
          onConfirm={reason =>
            remove(
              { type: removeTarget.type, id: removeTarget.id, reason },
              { onSuccess: () => setRemoveTarget(null) },
            )
          }
        />
      )}
    </>
  );
}

// ── FLAGGED USERS TAB ─────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 70 ? s.scoreRed : score >= 40 ? s.scoreAmber : s.scoreGreen;
  return <span className={`${s.scoreBadge} ${cls}`}>{score}</span>;
}

function FlaggedUsersTab() {
  const navigate = useNavigate();
  const { data, isLoading } = useModerationFlaggedUsers();
  const { mutate: banUser, isPending: banPending, variables: banVars } = useBanUser();
  const [warnTarget,   setWarnTarget]   = useState<ModerationFlaggedUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<ModerationFlaggedUser | null>(null);

  const users = data?.users ?? [];

  return (
    <>
      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Filter Triggers</th>
              <th>Reports</th>
              <th>Dispute Losses</th>
              <th>Score</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <SkeletonRows cols={7} />
            ) : users.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={7}>No flagged users</td></tr>
            ) : users.map((u: ModerationFlaggedUser) => {
              const isSuspending = banPending && banVars === u.id;
              const roleCls: Record<string, string> = {
                INVESTOR:   sh.badgeInvestor,
                CONTRACTOR: sh.badgeContractor,
                ADMIN:      sh.badgeAdmin,
              };
              return (
                <tr key={u.id} className={u.flaggedForReview ? s.flaggedRow : undefined}>
                  <td>
                    <div className={s.userCellFull}>
                      <Avatar
                        name={`${u.firstName} ${u.lastName}`}
                        src={u.avatarUrl ?? undefined}
                        size="sm"
                      />
                      <div>
                        <button
                          className={s.userLink}
                          onClick={() => navigate(`/admin/users/${u.id}`)}
                        >
                          {u.firstName} {u.lastName}
                        </button>
                        <span className={s.userEmail}>{u.email}</span>
                      </div>
                    </div>
                    {u.flaggedForReview && (
                      <span className={s.flaggedBadge}>Flagged for review</span>
                    )}
                  </td>
                  <td>
                    <span className={`${sh.badge} ${roleCls[u.role] ?? ''}`}>
                      {u.role}
                    </span>
                  </td>
                  <td>
                    <span className={u.filterCount > 3 ? s.filterCountBadge : s.filterCountNormal}>
                      {u.filterCount}
                    </span>
                  </td>
                  <td className={s.countCell}>{u.warningCount}</td>
                  <td className={s.countCell}>{u.disputeLossCount}</td>
                  <td><ScoreBadge score={u.severityScore} /></td>
                  <td>
                    <div className={s.actionGroup}>
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
                        onClick={() => setWarnTarget(u)}
                      >
                        Warn
                      </button>
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                        disabled={u.isBanned || isSuspending}
                        onClick={() => setSuspendTarget(u)}
                      >
                        {u.isBanned ? 'Banned' : 'Suspend'}
                      </button>
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
                        onClick={() => navigate(`/admin/users/${u.id}`)}
                      >
                        Profile
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {warnTarget && (
        <WarnUserModal user={warnTarget} onClose={() => setWarnTarget(null)} />
      )}

      {suspendTarget && (
        <ConfirmModal
          isOpen
          title={`Suspend ${suspendTarget.firstName} ${suspendTarget.lastName}?`}
          message="This will ban the user and prevent them from logging in. The action is logged and reversible."
          confirmLabel="Suspend User"
          variant="danger"
          confirmPhrase={suspendTarget.email}
          isLoading={banPending}
          onClose={() => setSuspendTarget(null)}
          onConfirm={() =>
            banUser(suspendTarget.id, { onSuccess: () => setSuspendTarget(null) })
          }
        />
      )}
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'FILTERED_MESSAGES' | 'CONTENT_QUEUE' | 'FLAGGED_USERS';

const TABS: { key: Tab; label: string }[] = [
  { key: 'FILTERED_MESSAGES', label: 'Filtered Messages' },
  { key: 'CONTENT_QUEUE',     label: 'Content Queue' },
  { key: 'FLAGGED_USERS',     label: 'Flagged Users' },
];

export function AdminModerationPage() {
  const [activeTab, setActiveTab] = useState<Tab>('FILTERED_MESSAGES');

  // Gather counts for subtitle
  const { data: queueData } = useModerationContentQueue();
  const { data: msgData }   = useFilteredMessages({ page: 1, limit: 1 });

  const awaitingCount = (queueData?.total ?? 0) + (msgData?.total ?? 0);
  const subtitle = `${awaitingCount} item${awaitingCount !== 1 ? 's' : ''} awaiting review`;

  return (
    <div className={sh.page}>
      <AdminPageHeader title="Moderation" subtitle={subtitle} />

      {/* Tabs */}
      <div className={s.tabs}>
        {TABS.map(t => (
          <button
            key={t.key}
            className={`${s.tab} ${activeTab === t.key ? s.tabActive : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'FILTERED_MESSAGES' && <FilteredMessagesTab />}
      {activeTab === 'CONTENT_QUEUE'     && <ContentQueueTab />}
      {activeTab === 'FLAGGED_USERS'     && <FlaggedUsersTab />}
    </div>
  );
}
