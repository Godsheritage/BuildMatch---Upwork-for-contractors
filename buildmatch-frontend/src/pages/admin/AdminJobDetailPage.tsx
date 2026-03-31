import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft, Star, AlertTriangle, DollarSign, MapPin, Briefcase,
  Clock, User, Shield, MessageCircle, FileText, Zap,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { ConfirmModal } from '../../components/admin/shared/ConfirmModal';
import { Button } from '../../components/ui';
import {
  useAdminJobFull,
  useRemoveJob, useToggleFeatureJob, useChangeJobStatus,
} from '../../hooks/useAdmin';
import type { AdminJobDetail } from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s from './AdminJobDetailPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function fmtBudget(min: number, max: number) {
  const f = (n: number) => n >= 1_000 ? `$${(n / 1_000).toFixed(0)}k` : `$${n}`;
  return `${f(min)} – ${f(max)}`;
}

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60)    return 'just now';
  if (sec < 3600)  return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function initials(name: string) {
  const parts = name.split(' ');
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    OPEN:        sh.badgeOpen,
    AWARDED:     sh.badgeAwarded,
    IN_PROGRESS: sh.badgeInProgress,
    COMPLETED:   sh.badgeCompleted,
    CANCELLED:   sh.badgeCancelled,
  };
  return (
    <span className={`${sh.badge} ${cls[status] ?? ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function BidStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    PENDING:   sh.badgeInProgress,
    ACCEPTED:  sh.badgeActive,
    REJECTED:  sh.badgeBanned,
    WITHDRAWN: sh.badgeCancelled,
  };
  return (
    <span className={`${sh.badge} ${cls[status] ?? ''}`}>
      {status}
    </span>
  );
}

function EscrowStatusBadge({ status }: { status: string }) {
  const cls: Record<string, string> = {
    PENDING:        sh.badgeInProgress,
    FUNDED:         sh.badgeActive,
    IN_PROGRESS:    sh.badgeAwarded,
    RELEASED:       sh.badgeCompleted,
    FULLY_RELEASED: sh.badgeCompleted,
    DISPUTED:       sh.badgeBanned,
    REFUNDED:       sh.badgeCancelled,
    CANCELLED:      sh.badgeCancelled,
  };
  return (
    <span className={`${sh.badge} ${cls[status] ?? ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Valid status transitions (matches backend) ────────────────────────────────

const VALID_FROM: Record<string, string[]> = {
  OPEN:        ['CANCELLED'],
  AWARDED:     ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED:   [],
  CANCELLED:   [],
};

// ── Remove modal ──────────────────────────────────────────────────────────────

function RemoveModal({
  isOpen, title, jobId, onClose,
}: { isOpen: boolean; title: string; jobId: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [typed,  setTyped]  = useState('');
  const { mutate, isPending } = useRemoveJob();

  useEffect(() => { if (!isOpen) { setReason(''); setTyped(''); } }, [isOpen]);
  if (!isOpen) return null;

  function submit() {
    if (typed !== 'REMOVE' || !reason.trim()) return;
    mutate({ id: jobId, reason: reason.trim() }, { onSuccess: onClose });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={`${sh.modalTitle} ${s.modalDanger}`}>Remove Job Listing</h3>
        <p className={sh.modalBody}>
          Cancel <strong>"{title}"</strong>, notify the investor by email,
          and queue active escrow funds for refund.
        </p>
        <label className={s.modalLabel}>
          Reason <span className={s.modalRequired}>*</span>
        </label>
        <textarea
          className={sh.modalNote}
          placeholder="Explain why this listing is being removed…"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={3}
        />
        <label className={s.modalLabel} style={{ marginTop: 12 }}>
          Type <strong>REMOVE</strong> to confirm
        </label>
        <input
          className={s.phraseInput}
          placeholder="REMOVE"
          value={typed}
          onChange={e => setTyped(e.target.value)}
        />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnRed}`}
            onClick={submit}
            disabled={isPending || typed !== 'REMOVE' || !reason.trim()}
          >
            {isPending ? 'Removing…' : 'Remove Job'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Change status modal ───────────────────────────────────────────────────────

function ChangeStatusModal({
  isOpen, currentStatus, jobId, onClose,
}: { isOpen: boolean; currentStatus: string; jobId: string; onClose: () => void }) {
  const allowed = VALID_FROM[currentStatus] ?? [];
  const [newStatus, setNewStatus] = useState(allowed[0] ?? '');
  const [reason, setReason] = useState('');
  const { mutate, isPending } = useChangeJobStatus();

  useEffect(() => {
    if (isOpen) { setNewStatus(allowed[0] ?? ''); setReason(''); }
  }, [isOpen, currentStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;
  if (allowed.length === 0) return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Change Status</h3>
        <p className={sh.modalBody}>No valid transitions from <strong>{currentStatus}</strong>.</p>
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );

  function submit() {
    if (!newStatus || !reason.trim()) return;
    mutate({ id: jobId, newStatus, reason: reason.trim() }, { onSuccess: onClose });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Change Job Status</h3>
        <p className={sh.modalBody}>
          Current status: <strong>{currentStatus.replace(/_/g, ' ')}</strong>
        </p>
        <label className={s.modalLabel}>New Status</label>
        <select
          className={sh.modalSelect}
          value={newStatus}
          onChange={e => setNewStatus(e.target.value)}
        >
          {allowed.map(st => (
            <option key={st} value={st}>{st.replace(/_/g, ' ')}</option>
          ))}
        </select>
        <label className={s.modalLabel} style={{ marginTop: 12 }}>
          Reason <span className={s.modalRequired}>*</span>
        </label>
        <textarea
          className={sh.modalNote}
          placeholder="Reason for this status change…"
          value={reason}
          onChange={e => setReason(e.target.value)}
          rows={2}
        />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
            onClick={submit}
            disabled={isPending || !newStatus || !reason.trim()}
          >
            {isPending ? 'Updating…' : 'Update Status'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page skeleton ─────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className={s.layout}>
      <div className={s.leftCard}>
        <div className={sh.skeletonLine} style={{ width: 120, height: 20, margin: '0 auto 8px' }} />
        <div className={sh.skeletonLine} style={{ width: 80, height: 14, margin: '0 auto' }} />
      </div>
      <div className={s.rightCol}>
        <div className={sh.skeletonLine} style={{ height: 200, width: '100%', borderRadius: 8 }} />
      </div>
    </div>
  );
}

// ── Left info card ────────────────────────────────────────────────────────────

function JobInfoCard({ job }: { job: AdminJobDetail }) {
  const VIDEO_EXT = /\.(mp4|mov|avi|webm|mkv)/i;
  const photos = job.photos.filter(p => !VIDEO_EXT.test(p));
  const videos = job.photos.filter(p =>  VIDEO_EXT.test(p));

  return (
    <div className={s.infoCard}>
      {/* Status + flags row */}
      <div className={s.cardBadgeRow}>
        <StatusBadge status={job.status} />
        {job.isFeatured && (
          <span className={s.featuredBadge}>
            <Star size={10} fill="currentColor" style={{ marginRight: 3 }} />
            Featured
          </span>
        )}
        {job.isFlagged && (
          <span className={s.flaggedBadge}>
            <AlertTriangle size={10} style={{ marginRight: 3 }} />
            Flagged
          </span>
        )}
      </div>

      <div className={s.divider} />

      {/* Core fields */}
      <div className={s.metaList}>
        <div className={s.metaRow}>
          <span className={s.metaLabel}><Briefcase size={11} style={{ marginRight: 4 }} />Trade</span>
          <span className={s.metaValue}>{job.tradeType}</span>
        </div>
        <div className={s.metaRow}>
          <span className={s.metaLabel}><DollarSign size={11} style={{ marginRight: 4 }} />Budget</span>
          <span className={s.metaValue}>{fmtBudget(job.budgetMin, job.budgetMax)}</span>
        </div>
        <div className={s.metaRow}>
          <span className={s.metaLabel}><MapPin size={11} style={{ marginRight: 4 }} />Location</span>
          <span className={s.metaValue}>{job.city}, {job.state} {job.zipCode}</span>
        </div>
        <div className={s.metaRow}>
          <span className={s.metaLabel}><User size={11} style={{ marginRight: 4 }} />Investor</span>
          <Link to={`/admin/users/${job.investorId}`} className={sh.nameLink}>
            {job.investorName}
          </Link>
        </div>
        <div className={s.metaRow}>
          <span className={s.metaLabel}><Clock size={11} style={{ marginRight: 4 }} />Posted</span>
          <span className={s.metaValue}>{fmt(job.createdAt)}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className={s.divider} />
      <div className={s.statRow}>
        <div className={s.statItem}>
          <span className={s.statVal}>{job.bidCount}</span>
          <span className={s.statLbl}>Bids</span>
        </div>
        <div className={s.statItem}>
          <span className={s.statVal}>{job.disputeCount}</span>
          <span className={s.statLbl}>Disputes</span>
        </div>
        <div className={s.statItem}>
          <span className={s.statVal}>{job.photoCount + job.videoCount}</span>
          <span className={s.statLbl}>Media</span>
        </div>
      </div>

      {/* Flag reason */}
      {job.isFlagged && job.flaggedReason && (
        <>
          <div className={s.divider} />
          <div className={s.flagReasonBox}>
            <AlertTriangle size={11} style={{ marginRight: 5, flexShrink: 0 }} />
            <span>{job.flaggedReason}</span>
          </div>
        </>
      )}

      {/* Photo / video strip */}
      {photos.length > 0 && (
        <>
          <div className={s.divider} />
          <div className={s.mediaStrip}>
            {photos.slice(0, 5).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img src={url} alt={`Photo ${i + 1}`} className={s.mediaThumbnail} />
              </a>
            ))}
            {photos.length > 5 && (
              <span className={s.mediaMore}>+{photos.length - 5}</span>
            )}
          </div>
          {videos.length > 0 && (
            <div className={s.videoCount}>
              {videos.length} video{videos.length > 1 ? 's' : ''}
            </div>
          )}
        </>
      )}

      {/* Escrow summary */}
      {job.escrow && (
        <>
          <div className={s.divider} />
          <div className={s.escrowSection}>
            <div className={s.escrowHeader}>
              <Shield size={12} style={{ marginRight: 5 }} />
              <span className={s.escrowTitle}>Escrow</span>
              <EscrowStatusBadge status={job.escrow.status} />
            </div>
            <div className={s.metaRow} style={{ marginTop: 8 }}>
              <span className={s.metaLabel}>Total</span>
              <span className={s.metaValue}>${job.escrow.totalAmount.toLocaleString()}</span>
            </div>
            <div className={s.metaRow}>
              <span className={s.metaLabel}>Platform fee</span>
              <span className={s.metaValue}>${job.escrow.platformFeeAmount.toLocaleString()}</span>
            </div>
            <div className={s.milestoneList}>
              {job.escrow.milestones.map(m => (
                <div key={m.id} className={s.milestoneRow}>
                  <span className={s.milestoneName}>{m.title}</span>
                  <span className={s.milestoneAmt}>${m.amount.toLocaleString()}</span>
                  <span className={`${sh.badge} ${m.status === 'RELEASED' ? sh.badgeCompleted : sh.badgeInProgress}`}>
                    {m.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Description (collapsible) */}
      <div className={s.divider} />
      <div className={s.descSection}>
        <span className={s.metaLabel}>Description</span>
        <p className={s.descText}>{job.description}</p>
      </div>
    </div>
  );
}

// ── Bids table ────────────────────────────────────────────────────────────────

function BidsTable({ job }: { job: AdminJobDetail }) {
  if (job.bids.length === 0) {
    return <p className={sh.emptyRow}>No bids submitted yet.</p>;
  }

  return (
    <div className={sh.tableWrap}>
      <table className={sh.table}>
        <thead>
          <tr>
            <th>Contractor</th>
            <th>Amount</th>
            <th>Message</th>
            <th>Status</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {job.bids.map(bid => (
            <tr
              key={bid.id}
              className={bid.status === 'ACCEPTED' ? s.acceptedRow : ''}
            >
              <td>
                <div className={s.contractorCell}>
                  <div className={s.avatar}>
                    {bid.contractorAvatar
                      ? <img src={bid.contractorAvatar} alt="" className={s.avatarImg} />
                      : <span className={s.avatarInitials}>{initials(bid.contractorName)}</span>
                    }
                  </div>
                  <Link to={`/admin/users/${bid.contractorId}`} className={sh.nameLink}>
                    {bid.contractorName}
                  </Link>
                </div>
              </td>
              <td style={{ fontWeight: 'var(--font-weight-semibold)' as React.CSSProperties['fontWeight'], whiteSpace: 'nowrap' }}>
                ${bid.amount.toLocaleString()}
              </td>
              <td className={sh.mutedCell}>
                <span className={s.msgPreview}></span>
              </td>
              <td><BidStatusBadge status={bid.status} /></td>
              <td className={sh.mutedCell} style={{ whiteSpace: 'nowrap' }}>
                {fmt(bid.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

type TimelineEvent = {
  id:          string;
  type:        'posted' | 'bid' | 'admin' | 'dispute' | 'milestone' | 'message';
  description: string;
  actor:       string;
  ts:          string;
};

function buildTimeline(job: AdminJobDetail): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Job posted
  events.push({
    id:          'posted',
    type:        'posted',
    description: 'Job listed',
    actor:       job.investorName,
    ts:          job.createdAt,
  });

  // Each bid
  for (const b of job.bids) {
    events.push({
      id:          `bid-${b.id}`,
      type:        'bid',
      description: `Bid submitted — $${b.amount.toLocaleString()}${b.status !== 'PENDING' ? ` (${b.status.toLowerCase()})` : ''}`,
      actor:       b.contractorName,
      ts:          b.createdAt,
    });
  }

  // Disputes
  for (const d of job.disputes) {
    events.push({
      id:          `dispute-${d.id}`,
      type:        'dispute',
      description: `Dispute filed — ${d.category} (${d.status})`,
      actor:       'Party',
      ts:          d.createdAt,
    });
  }

  // Escrow milestones with dates
  if (job.escrow) {
    for (const m of job.escrow.milestones) {
      if (m.approvedAt) {
        events.push({
          id:          `ms-approved-${m.id}`,
          type:        'milestone',
          description: `Milestone approved — ${m.title}`,
          actor:       job.investorName,
          ts:          m.approvedAt,
        });
      }
      if (m.releasedAt) {
        events.push({
          id:          `ms-released-${m.id}`,
          type:        'milestone',
          description: `Milestone released — ${m.title} ($${m.amount.toLocaleString()})`,
          actor:       'System',
          ts:          m.releasedAt,
        });
      }
    }
  }

  // Admin actions from audit_log
  for (const entry of job.statusTimeline) {
    const label = entry.action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase());
    events.push({
      id:          `audit-${entry.createdAt}-${entry.action}`,
      type:        'admin',
      description: `${label}${entry.note ? ` — ${entry.note}` : ''}`,
      actor:       entry.adminId ? `Admin ${entry.adminId.slice(0, 6)}…` : 'Admin',
      ts:          entry.createdAt,
    });
  }

  // Conversation messages count (summary)
  for (const conv of job.conversations) {
    if (conv.messageCount > 0 && conv.lastMessageAt) {
      events.push({
        id:          `conv-${conv.id}`,
        type:        'message',
        description: `${conv.messageCount} message${conv.messageCount > 1 ? 's' : ''} exchanged`,
        actor:       conv.contractorName,
        ts:          conv.lastMessageAt,
      });
    }
  }

  return events.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
}

const TYPE_ICON: Record<TimelineEvent['type'], React.ReactNode> = {
  posted:    <Briefcase   size={13} />,
  bid:       <DollarSign  size={13} />,
  admin:     <Shield      size={13} />,
  dispute:   <AlertTriangle size={13} />,
  milestone: <Zap         size={13} />,
  message:   <MessageCircle size={13} />,
};

const TYPE_COLOR: Record<TimelineEvent['type'], string> = {
  posted:    s.iconNavy,
  bid:       s.iconTeal,
  admin:     s.iconAmber,
  dispute:   s.iconRed,
  milestone: s.iconGreen,
  message:   s.iconMuted,
};

function Timeline({ job }: { job: AdminJobDetail }) {
  const events = buildTimeline(job);

  if (events.length === 0) {
    return <p className={sh.emptyRow}>No timeline events.</p>;
  }

  return (
    <div className={s.timeline}>
      {events.map(ev => (
        <div key={ev.id} className={s.timelineItem}>
          <div className={`${s.timelineDot} ${TYPE_COLOR[ev.type]}`}>
            {TYPE_ICON[ev.type]}
          </div>
          <div className={s.timelineBody}>
            <span className={s.timelineDesc}>{ev.description}</span>
            <span className={s.timelineActor}>{ev.actor}</span>
          </div>
          <div className={s.timelineTs} title={fmtDateTime(ev.ts)}>
            {timeAgo(ev.ts)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function AdminJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { data, isLoading } = useAdminJobFull(jobId ?? null);
  const { mutate: toggleFeature, isPending: featurePending } = useToggleFeatureJob();

  const [showRemove,       setShowRemove]       = useState(false);
  const [showChangeStatus, setShowChangeStatus] = useState(false);
  const [showFeature,      setShowFeature]      = useState(false);

  const job = data as AdminJobDetail | undefined;

  return (
    <div className={sh.page}>
      <AdminPageHeader
        title={isLoading ? 'Loading…' : job?.title ?? 'Job Detail'}
        subtitle={job ? `${job.status.replace(/_/g, ' ')} · ${job.tradeType} · ${job.city}, ${job.state}` : undefined}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Link to="/admin/jobs">
              <Button variant="secondary" size="sm">
                <ArrowLeft size={13} style={{ marginRight: 4 }} />
                Back
              </Button>
            </Link>
            {job && (
              <>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowFeature(true)}
                  disabled={featurePending}
                >
                  <Star size={13} style={{ marginRight: 4 }} />
                  {job.isFeatured ? 'Unfeature' : 'Feature'}
                </Button>
                {!['COMPLETED', 'CANCELLED'].includes(job.status) && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowChangeStatus(true)}
                    >
                      Change Status
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => setShowRemove(true)}
                    >
                      Remove Job
                    </Button>
                  </>
                )}
              </>
            )}
          </div>
        }
      />

      {isLoading && <PageSkeleton />}

      {!isLoading && job && (
        <>
          {/* ── Section 1 + 2: Info card + Bids ── */}
          <div className={s.topLayout}>
            {/* Left: sticky info card */}
            <div className={s.leftCard}>
              <JobInfoCard job={job} />
            </div>

            {/* Right: bids table */}
            <div className={s.rightCol}>
              <div className={s.sectionHeader}>
                <FileText size={14} style={{ marginRight: 6 }} />
                Bids
                <span className={s.sectionCount}>{job.bidCount}</span>
              </div>
              <BidsTable job={job} />
            </div>
          </div>

          {/* ── Section 3: Full-width timeline ── */}
          <div className={s.timelineSection}>
            <div className={s.sectionHeader}>
              <Clock size={14} style={{ marginRight: 6 }} />
              Timeline
              <span className={s.sectionCount}>{buildTimeline(job).length} events</span>
            </div>
            <Timeline job={job} />
          </div>
        </>
      )}

      {!isLoading && !job && (
        <p style={{ color: 'var(--color-text-muted)', padding: '32px 0', textAlign: 'center' }}>
          Job not found.
        </p>
      )}

      {/* Modals */}
      <RemoveModal
        isOpen={showRemove}
        title={job?.title ?? ''}
        jobId={jobId ?? ''}
        onClose={() => setShowRemove(false)}
      />
      <ChangeStatusModal
        isOpen={showChangeStatus}
        currentStatus={job?.status ?? 'OPEN'}
        jobId={jobId ?? ''}
        onClose={() => setShowChangeStatus(false)}
      />
      {job && (
        <ConfirmModal
          isOpen={showFeature}
          onClose={() => setShowFeature(false)}
          onConfirm={() => toggleFeature(jobId!, { onSuccess: () => setShowFeature(false) })}
          title={job.isFeatured ? 'Unfeature Job' : 'Feature Job'}
          message={job.isFeatured
            ? `Remove "${job.title}" from featured listings?`
            : `Promote "${job.title}" as a featured listing for all users?`}
          confirmLabel={job.isFeatured ? 'Unfeature' : 'Feature'}
          variant="primary"
          isLoading={featurePending}
        />
      )}
    </div>
  );
}
