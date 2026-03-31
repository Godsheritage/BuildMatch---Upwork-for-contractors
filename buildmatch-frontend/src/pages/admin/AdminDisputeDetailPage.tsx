import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { Button, Avatar } from '../../components/ui';
import {
  useAdminDispute,
  useAddDisputeNote,
  useSubmitDisputeRuling,
  useRequestDisputeInfo,
} from '../../hooks/useAdmin';
import type { AdminDisputeDetail } from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s from './AdminDisputeDetailPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
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

function fmtUsd(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    OPEN:         sh.badgeOpen,
    UNDER_REVIEW: sh.badgeInProgress,
    RESOLVED:     sh.badgeCompleted,
    CLOSED:       sh.badgeWithdrawn,
  };
  return (
    <span className={`${sh.badge} ${map[status] ?? ''}`}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

// ── Party row ─────────────────────────────────────────────────────────────────

function PartyRow({
  label, user, role,
}: {
  label: string;
  user: NonNullable<AdminDisputeDetail['investor']> | null;
  role: string;
}) {
  if (!user) return (
    <div className={s.summaryRow}>
      <span className={s.summaryLabel}>{label}</span>
      <span className={s.summaryValue} style={{ color: 'var(--color-text-muted)' }}>—</span>
    </div>
  );
  return (
    <div className={s.partyRow}>
      <span className={s.summaryLabel}>{label}</span>
      <div className={s.partyInfo}>
        <Avatar name={`${user.firstName} ${user.lastName}`} src={user.avatarUrl ?? undefined} size="sm" />
        <div>
          <div className={s.partyName}>{user.firstName} {user.lastName}</div>
          <div className={s.partyRole}>{role}</div>
        </div>
      </div>
    </div>
  );
}

// ── Admin Notes Feed ──────────────────────────────────────────────────────────

function NotesFeed({
  disputeId,
  notes,
}: {
  disputeId: string;
  notes: AdminDisputeDetail['notes'];
}) {
  const [content, setContent] = useState('');
  const { mutate: addNote, isPending } = useAddDisputeNote();

  function submit() {
    if (!content.trim()) return;
    addNote({ id: disputeId, content: content.trim() }, {
      onSuccess: () => setContent(''),
    });
  }

  return (
    <div className={s.card}>
      <h3 className={s.cardTitle}>Admin Notes</h3>

      <div className={s.notesList}>
        {notes.length === 0 ? (
          <p className={s.empty}>No notes yet.</p>
        ) : notes.map(n => (
          <div key={n.id} className={s.noteItem}>
            <div className={s.noteMeta}>
              <span className={s.noteAdmin}>{n.adminName}</span>
              <span className={s.noteTime}>{fmtDateTime(n.createdAt)}</span>
            </div>
            <p className={s.noteContent}>{n.content}</p>
          </div>
        ))}
      </div>

      <div className={s.noteInput}>
        <textarea
          className={s.noteTextarea}
          placeholder="Add a private note…"
          rows={3}
          value={content}
          onChange={e => setContent(e.target.value)}
        />
        <button
          className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
          style={{ width: '100%', marginTop: 8 }}
          disabled={!content.trim() || isPending}
          onClick={submit}
        >
          {isPending ? 'Adding…' : 'Add Note'}
        </button>
      </div>
    </div>
  );
}

// ── Message thread ────────────────────────────────────────────────────────────

function MessageThread({ messages }: { messages: AdminDisputeDetail['messages'] }) {
  return (
    <div className={s.section}>
      <h3 className={s.sectionTitle}>Message History</h3>
      <div className={s.threadBanner}>
        Viewing for dispute resolution purposes only.
      </div>
      <div className={s.thread}>
        {messages.length === 0 ? (
          <p className={s.empty}>No messages on this job.</p>
        ) : messages.map(m => (
          <div key={m.id} className={s.bubble}>
            <div className={s.bubbleMeta}>
              <span className={s.bubbleSender}>{m.senderName}</span>
              <span className={s.bubbleTime}>{fmtDateTime(String(m.createdAt))}</span>
            </div>
            {m.isFiltered ? (
              <span className={s.filteredLabel}>[FILTERED]</span>
            ) : (
              <p className={s.bubbleText}>{m.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Milestone proof photos ────────────────────────────────────────────────────

function MilestoneProof({
  milestone,
  jobPhotos,
}: {
  milestone: AdminDisputeDetail['milestone'];
  jobPhotos: string[];
}) {
  const photos = jobPhotos.length > 0 ? jobPhotos : [];

  return (
    <div className={s.section}>
      <h3 className={s.sectionTitle}>
        Milestone #{milestone?.order ?? '?'} — {milestone?.title ?? 'Unknown'}
      </h3>
      {milestone && (
        <div className={s.milestoneDetail}>
          <div className={s.milestoneRow}>
            <span className={s.milestoneLabel}>Amount</span>
            <span className={s.milestoneValue}>{fmtUsd(milestone.amount)}</span>
          </div>
          <div className={s.milestoneRow}>
            <span className={s.milestoneLabel}>Status</span>
            <span className={s.milestoneValue}>{milestone.status.replace(/_/g, ' ')}</span>
          </div>
          {milestone.completionNotes && (
            <div className={s.milestoneRow}>
              <span className={s.milestoneLabel}>Completion Notes</span>
              <span className={s.milestoneValue}>{milestone.completionNotes}</span>
            </div>
          )}
          {milestone.disputeReason && (
            <div className={s.milestoneRow}>
              <span className={s.milestoneLabel}>Dispute Reason</span>
              <span className={s.milestoneValue}>{milestone.disputeReason}</span>
            </div>
          )}
        </div>
      )}
      <h4 className={s.photoHeading}>Milestone Proof Photos</h4>
      {photos.length === 0 ? (
        <div className={s.noPhotos}>
          <span className={s.noPhotosIcon}>⚠</span>
          No milestone photos submitted
        </div>
      ) : (
        <div className={s.photoGrid}>
          {photos.map((url, i) => (
            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
              <img src={url} alt={`Photo ${i + 1}`} className={s.photo} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Request Info Modal ────────────────────────────────────────────────────────

function RequestInfoModal({
  disputeId,
  investor: inv,
  contractor: con,
  onClose,
}: {
  disputeId: string;
  investor: AdminDisputeDetail['investor'];
  contractor: AdminDisputeDetail['contractor'];
  onClose: () => void;
}) {
  const [targetId, setTargetId] = useState('');
  const [message, setMessage]   = useState('');
  const { mutate, isPending }   = useRequestDisputeInfo();

  const parties = [
    inv ? { id: inv.id, label: `${inv.firstName} ${inv.lastName} (Investor)` } : null,
    con ? { id: con.id, label: `${con.firstName} ${con.lastName} (Contractor)` } : null,
  ].filter(Boolean) as { id: string; label: string }[];

  function submit() {
    if (!targetId || message.trim().length < 10) return;
    mutate({ id: disputeId, targetUserId: targetId, message: message.trim() }, {
      onSuccess: onClose,
    });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Request More Info</h3>

        <label className={s.modalLabel}>Send to</label>
        <select
          className={sh.modalSelect}
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
        >
          <option value="">Select party…</option>
          {parties.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>

        <label className={s.modalLabel} style={{ marginTop: 12 }}>Message</label>
        <textarea
          className={sh.modalNote}
          rows={5}
          placeholder="Describe what information you need (min 10 chars)…"
          value={message}
          onChange={e => setMessage(e.target.value)}
        />
        <div className={s.charCount}>{message.length} chars</div>

        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
            disabled={!targetId || message.trim().length < 10 || isPending}
            onClick={submit}
          >
            {isPending ? 'Sending…' : 'Send Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ruling Confirm Modal ──────────────────────────────────────────────────────

const RULING_LABELS: Record<string, string> = {
  CONTRACTOR: 'Release to Contractor',
  INVESTOR:   'Return to Investor',
  SPLIT:      'Split Between Parties',
  WITHDRAWN:  'Withdrawn',
};

function RulingConfirmModal({
  disputeId,
  ruling,
  splitPct,
  rulingNote,
  amountDisputed,
  onClose,
}: {
  disputeId: string;
  ruling: string;
  splitPct: number;
  rulingNote: string;
  amountDisputed: number;
  onClose: () => void;
}) {
  const { mutate, isPending } = useSubmitDisputeRuling();

  const contractorPct = ruling === 'SPLIT' ? splitPct : ruling === 'CONTRACTOR' ? 100 : 0;
  const investorPct   = 100 - contractorPct;

  function confirm() {
    mutate(
      { id: disputeId, ruling, rulingNote, splitPct: ruling === 'SPLIT' ? splitPct : undefined },
      { onSuccess: onClose },
    );
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Confirm Ruling</h3>

        <div className={s.confirmGrid}>
          <div className={s.confirmRow}>
            <span className={s.confirmLabel}>Decision</span>
            <span className={s.confirmValue}>{RULING_LABELS[ruling] ?? ruling}</span>
          </div>
          <div className={s.confirmRow}>
            <span className={s.confirmLabel}>Total disputed</span>
            <span className={s.confirmValue}>{fmtUsd(amountDisputed)}</span>
          </div>
          {ruling === 'SPLIT' && (
            <>
              <div className={s.confirmRow}>
                <span className={s.confirmLabel}>Contractor receives</span>
                <span className={s.confirmValue} style={{ color: '#166534' }}>
                  {fmtUsd(amountDisputed * contractorPct / 100)} ({contractorPct}%)
                </span>
              </div>
              <div className={s.confirmRow}>
                <span className={s.confirmLabel}>Investor receives</span>
                <span className={s.confirmValue} style={{ color: '#1E40AF' }}>
                  {fmtUsd(amountDisputed * investorPct / 100)} ({investorPct}%)
                </span>
              </div>
            </>
          )}
          <div className={s.confirmRow} style={{ gridColumn: '1 / -1', display: 'block' }}>
            <span className={s.confirmLabel}>Ruling note</span>
            <p className={s.confirmNote}>{rulingNote}</p>
          </div>
        </div>

        <p className={s.confirmWarning}>
          This action will trigger Stripe transfers/refunds and notify both parties. It cannot be undone.
        </p>

        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button
            className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
            disabled={isPending}
            onClick={confirm}
          >
            {isPending ? 'Submitting…' : 'Confirm & Submit'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Ruling Panel ──────────────────────────────────────────────────────────────

type RulingOption = 'CONTRACTOR' | 'INVESTOR' | 'SPLIT';

function RulingPanel({
  detail,
}: {
  detail: AdminDisputeDetail;
}) {
  const { dispute, investor: inv, contractor: con } = detail;
  const [selectedRuling, setSelectedRuling] = useState<RulingOption | null>(null);
  const [splitPct,       setSplitPct]       = useState(50);
  const [rulingNote,     setRulingNote]      = useState('');
  const [showConfirm,    setShowConfirm]     = useState(false);
  const [showRequestInfo, setShowRequestInfo] = useState(false);

  const isActionable = !['RESOLVED', 'CLOSED'].includes(dispute.status);
  const noteLen      = rulingNote.trim().length;
  const canSubmit    = selectedRuling !== null && noteLen >= 50;

  if (!isActionable) {
    // Read-only resolved card
    return (
      <div className={s.card}>
        <h3 className={s.cardTitle}>Ruling</h3>
        {dispute.ruling ? (
          <div className={s.resolvedRuling}>
            <div className={s.resolvedDecision}>
              {RULING_LABELS[dispute.ruling] ?? dispute.ruling}
            </div>
            {dispute.ruling === 'SPLIT' && (
              <div className={s.resolvedSplit}>
                <span>Contractor {100}%</span>
                <span>Investor {0}%</span>
              </div>
            )}
            {dispute.rulingNote && (
              <p className={s.resolvedNote}>{dispute.rulingNote}</p>
            )}
            {dispute.rulingAt && (
              <p className={s.resolvedMeta}>Ruled {fmtDate(dispute.rulingAt)}</p>
            )}
          </div>
        ) : (
          <p className={s.empty}>No ruling recorded.</p>
        )}
      </div>
    );
  }

  const options: { key: RulingOption; label: string; sub: string; cls: string }[] = [
    { key: 'CONTRACTOR', label: 'Release to Contractor', sub: 'Funds transferred to contractor', cls: s.optionGreen },
    { key: 'INVESTOR',   label: 'Return to Investor',   sub: 'Funds refunded to investor',      cls: s.optionBlue  },
    { key: 'SPLIT',      label: 'Split',                sub: 'Partial transfer + refund',        cls: s.optionAmber },
  ];

  return (
    <>
      <div className={s.card}>
        <h3 className={s.cardTitle}>Record Ruling</h3>

        {/* Option cards */}
        <div className={s.optionCards}>
          {options.map(opt => (
            <button
              key={opt.key}
              className={`${s.optionCard} ${opt.cls} ${selectedRuling === opt.key ? s.optionCardSelected : ''}`}
              onClick={() => setSelectedRuling(opt.key)}
            >
              <div className={s.optionLabel}>{opt.label}</div>
              <div className={s.optionSub}>{opt.sub}</div>
            </button>
          ))}
        </div>

        {/* Split slider */}
        {selectedRuling === 'SPLIT' && (
          <div className={s.splitSlider}>
            <div className={s.splitLabels}>
              <span>Contractor {splitPct}%</span>
              <span>Investor {100 - splitPct}%</span>
            </div>
            <input
              type="range"
              min={1}
              max={99}
              value={splitPct}
              onChange={e => setSplitPct(Number(e.target.value))}
              className={s.slider}
            />
            <div className={s.splitAmounts}>
              <span className={s.splitAmountGreen}>
                {fmtUsd(detail.dispute.amountDisputed * splitPct / 100)} → {con?.firstName ?? 'Contractor'}
              </span>
              <span className={s.splitAmountBlue}>
                {fmtUsd(detail.dispute.amountDisputed * (100 - splitPct) / 100)} → {inv?.firstName ?? 'Investor'}
              </span>
            </div>
          </div>
        )}

        {/* Ruling note */}
        <label className={s.noteLabel}>
          Ruling Note <span className={s.noteRequired}>*</span>
        </label>
        <textarea
          className={s.noteTextarea}
          rows={5}
          placeholder="Explain the basis for this ruling (min 50 characters)…"
          value={rulingNote}
          onChange={e => setRulingNote(e.target.value)}
        />
        <div className={`${s.charCount} ${noteLen < 50 && noteLen > 0 ? s.charCountError : ''}`}>
          {noteLen} / 50 min
        </div>

        {/* Submit */}
        <button
          className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
          style={{ width: '100%', marginTop: 8 }}
          disabled={!canSubmit}
          onClick={() => setShowConfirm(true)}
        >
          Submit Ruling
        </button>

        {/* Request Info */}
        <button
          className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
          style={{ width: '100%', marginTop: 8 }}
          onClick={() => setShowRequestInfo(true)}
        >
          Request More Info
        </button>
      </div>

      {showConfirm && selectedRuling && (
        <RulingConfirmModal
          disputeId={dispute.id}
          ruling={selectedRuling}
          splitPct={splitPct}
          rulingNote={rulingNote}
          amountDisputed={dispute.amountDisputed}
          onClose={() => setShowConfirm(false)}
        />
      )}

      {showRequestInfo && (
        <RequestInfoModal
          disputeId={dispute.id}
          investor={inv}
          contractor={con}
          onClose={() => setShowRequestInfo(false)}
        />
      )}
    </>
  );
}

// ── Left column ───────────────────────────────────────────────────────────────

function DisputeSummaryCard({ detail }: { detail: AdminDisputeDetail }) {
  const { dispute, investor: inv, contractor: con } = detail;

  // Determine which party filed
  const filerIsInvestor = inv ? dispute.filedById === inv.id : false;
  const filer      = filerIsInvestor ? inv : con;
  const otherParty = filerIsInvestor ? con : inv;
  const filerRole  = filerIsInvestor ? 'Investor' : 'Contractor';
  const otherRole  = filerIsInvestor ? 'Contractor' : 'Investor';

  return (
    <div className={s.card}>
      <h3 className={s.cardTitle}>Dispute Summary</h3>

      <div className={s.amountDisputed}>{fmtUsd(dispute.amountDisputed)}</div>
      <div className={s.amountLabel}>amount disputed</div>

      <div className={s.summaryDivider} />

      <PartyRow label="Filed by"    user={filer      ?? null} role={filerRole} />
      <PartyRow label="Other party" user={otherParty ?? null} role={otherRole} />

      <div className={s.summaryDivider} />

      <div className={s.summaryRow}>
        <span className={s.summaryLabel}>Milestone</span>
        <span className={s.summaryValue}>#{dispute.milestoneDraw}</span>
      </div>
      <div className={s.summaryRow}>
        <span className={s.summaryLabel}>Filed</span>
        <span className={s.summaryValue}>{fmtDate(dispute.createdAt)}</span>
      </div>
      <div className={s.summaryRow}>
        <span className={s.summaryLabel}>Days elapsed</span>
        <span className={s.summaryValue}>{dispute.daysOpen}d</span>
      </div>

      <div className={s.summaryDivider} />

      <div className={s.summaryLabel} style={{ marginBottom: 6 }}>Reason</div>
      <p className={s.reason}>{dispute.reason}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminDisputeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError } = useAdminDispute(id ?? null);

  const detail = data as AdminDisputeDetail | undefined;

  const subtitle = detail
    ? `${detail.job?.title ?? 'Unknown job'} • ${id?.slice(0, 8)}`
    : undefined;

  return (
    <div>
      <AdminPageHeader
        title="Dispute Review"
        subtitle={subtitle}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {detail && <StatusBadge status={detail.dispute.status} />}
            <Link to="/admin/disputes">
              <Button variant="secondary" size="sm">← Back</Button>
            </Link>
          </div>
        }
      />

      {isLoading && (
        <div className={s.loadingWrap}>
          {[1, 2, 3].map(i => (
            <div key={i} className={s.skeletonCol}>
              <div className={sh.skeletonLine} style={{ width: '60%', height: 16, marginBottom: 12 }} />
              <div className={sh.skeletonLine} style={{ width: '100%', height: 12 }} />
              <div className={sh.skeletonLine} style={{ width: '80%', height: 12 }} />
              <div className={sh.skeletonLine} style={{ width: '90%', height: 12 }} />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className={s.errorState}>
          <p>Failed to load dispute. <Link to="/admin/disputes">Return to list</Link></p>
        </div>
      )}

      {!isLoading && !isError && detail && (
        <div className={s.columns}>
          {/* LEFT — Summary + Notes */}
          <div className={s.colLeft}>
            <DisputeSummaryCard detail={detail} />
            <NotesFeed disputeId={detail.dispute.id} notes={detail.notes} />
          </div>

          {/* CENTER — Evidence + Messages */}
          <div className={s.colCenter}>
            <MilestoneProof
              milestone={detail.milestone}
              jobPhotos={detail.job?.photos ?? []}
            />
            <MessageThread messages={detail.messages} />
          </div>

          {/* RIGHT — Ruling */}
          <div className={s.colRight}>
            <RulingPanel detail={detail} />
          </div>
        </div>
      )}
    </div>
  );
}
