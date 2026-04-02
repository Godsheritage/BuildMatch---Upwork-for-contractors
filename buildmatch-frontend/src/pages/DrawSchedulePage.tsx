import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles, CheckCircle2, Clock, Lock, ChevronDown, ChevronUp,
  AlertCircle, ArrowLeft, Pencil, Plus, Calendar, Loader2, X,
  FileCheck, Bell, Trash2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { getJobById } from '../services/job.service';
import { getSupabaseClient } from '../lib/supabase';
import { Avatar } from '../components/ui';
import api from '../services/api';
import type { JobPost } from '../types/job.types';
import type { DrawSchedule, DrawMilestone, DrawScheduleStatus } from '../services/draw.service';
import s from './DrawSchedulePage.module.css';

// ── Inline API helpers (correct paths: /jobs/:jobId/draws/…) ─────────────────

function unwrap<T>(r: { data: { data: T } }): T { return r.data.data; }

const drawApi = {
  getSchedule: (jobId: string) =>
    api.get<{ data: { schedule: DrawSchedule | null } }>(`/jobs/${jobId}/draws`)
      .then(r => r.data.data.schedule),

  generate: (jobId: string) =>
    api.post<{ data: { schedule: DrawSchedule } }>(`/jobs/${jobId}/draws/generate`)
      .then(r => r.data.data.schedule),

  approve: (jobId: string) =>
    api.post<{ data: { schedule: DrawSchedule } }>(`/jobs/${jobId}/draws/approve`)
      .then(r => r.data.data.schedule),

  resetApproval: (jobId: string) =>
    api.post<{ data: { schedule: DrawSchedule } }>(`/jobs/${jobId}/draws/reset-approval`)
      .then(r => r.data.data.schedule),

  updateMilestone: (jobId: string, milestoneId: string, payload: object) =>
    api.put<{ data: { milestone: DrawMilestone } }>(`/jobs/${jobId}/draws/milestones/${milestoneId}`, payload)
      .then(r => r.data.data.milestone),

  addMilestone: (jobId: string, payload: object) =>
    api.post<{ data: { milestone: DrawMilestone } }>(`/jobs/${jobId}/draws/milestones`, payload)
      .then(r => r.data.data.milestone),

  deleteMilestone: (jobId: string, milestoneId: string) =>
    api.delete<{ data: { schedule: DrawSchedule } }>(`/jobs/${jobId}/draws/milestones/${milestoneId}`)
      .then(r => r.data.data.schedule),
};

// ── Pure helpers ──────────────────────────────────────────────────────────────

function fmtMoney(n: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  }).format(n);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_LABEL: Record<DrawScheduleStatus, string> = {
  DRAFT:            'Draft',
  NEGOTIATING:      'Negotiating',
  PENDING_APPROVAL: 'Pending Approval',
  LOCKED:           'Locked',
};

const SEGMENT_COLORS = [
  '#1B3A5C', '#0F6E56', '#2563EB', '#7C3AED',
  '#D97706', '#DC2626', '#059669', '#DB2777',
];

function extractContractorName(schedule: DrawSchedule | null): string {
  if (!schedule) return 'Contractor';
  for (const m of schedule.milestones) {
    const req = m.drawRequests[0];
    if (req?.contractor) return `${req.contractor.firstName} ${req.contractor.lastName}`;
  }
  return 'Contractor';
}

// ── Status badge ──────────────────────────────────────────────────────────────

function ScheduleBadge({ status }: { status: DrawScheduleStatus }) {
  return <span className={`${s.badge} ${s[`badge${status}`]}`}>{STATUS_LABEL[status]}</span>;
}

// ── Generic confirm modal ─────────────────────────────────────────────────────

function ConfirmModal({
  title, body, confirmLabel, loading, danger,
  onConfirm, onCancel,
}: {
  title:        string;
  body:         React.ReactNode;
  confirmLabel: string;
  loading:      boolean;
  danger?:      boolean;
  onConfirm:    () => void;
  onCancel:     () => void;
}) {
  return (
    <div className={s.backdrop} onClick={onCancel}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>{title}</h3>
          <button className={s.modalClose} onClick={onCancel}><X size={16} /></button>
        </div>
        <div className={s.modalBody}>{body}</div>
        <div className={s.modalActions}>
          <button className={s.btnGhost} onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            className={danger ? s.btnDanger : s.btnPrimary}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? <Loader2 size={14} className={s.spin} /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Milestone Modal ───────────────────────────────────────────────────────

function AddMilestoneModal({
  schedule, jobId, onAdded, onClose,
}: {
  schedule:  DrawSchedule;
  jobId:     string;
  onAdded:   () => void;
  onClose:   () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [title, setTitle]               = useState('');
  const [criteria, setCriteria]         = useState('');
  const [pct, setPct]                   = useState<number | ''>(10);
  const [afterDraw, setAfterDraw]       = useState<number>(
    schedule.milestones[schedule.milestones.length - 1]?.drawNumber ?? 0,
  );

  const usedPct   = schedule.milestones.reduce((s, m) => s + m.percentage, 0);
  const remaining = 100 - usedPct;
  const totalNew  = usedPct + (typeof pct === 'number' ? pct : 0);
  const pctValid  = Math.abs(totalNew - 100) < 0.01;

  const addMut = useMutation({
    mutationFn: () => drawApi.addMilestone(jobId, {
      title: title.trim(),
      description: '',
      completionCriteria: criteria.trim(),
      percentage: pct,
      afterDrawNumber: afterDraw,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['draw-schedule', jobId] });
      toast('Milestone added.');
      onAdded();
    },
    onError: () => toast('Failed to add milestone', 'error'),
  });

  const canSave = title.trim().length >= 3 && criteria.trim().length >= 10 && pctValid;

  return (
    <div className={s.backdrop} onClick={onClose}>
      <div className={s.modal} onClick={e => e.stopPropagation()}>
        <div className={s.modalHeader}>
          <h3 className={s.modalTitle}>Add Milestone</h3>
          <button className={s.modalClose} onClick={onClose}><X size={16} /></button>
        </div>
        <div className={s.modalBody}>
          <div className={s.formField}>
            <label className={s.fieldLabel}>Title</label>
            <input className={s.fieldInput} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Foundation work" />
          </div>
          <div className={s.formField}>
            <label className={s.fieldLabel}>Completion Criteria</label>
            <textarea className={s.fieldTextarea} rows={3} value={criteria} onChange={e => setCriteria(e.target.value)} placeholder="What must be done before this draw is released?" />
          </div>
          <div className={s.formRow}>
            <div className={s.formField}>
              <label className={s.fieldLabel}>Percentage</label>
              <div className={s.pctInputWrap}>
                <input
                  className={`${s.fieldInput} ${!pctValid && pct !== '' ? s.inputError : ''}`}
                  type="number" min={1} max={50} step={1}
                  value={pct}
                  onChange={e => setPct(e.target.value === '' ? '' : Number(e.target.value))}
                />
                <span className={s.pctSuffix}>%</span>
              </div>
              <span className={`${s.pctHint} ${!pctValid && pct !== '' ? s.pctHintError : ''}`}>
                Remaining: {remaining.toFixed(1)}%
                {!pctValid && pct !== '' && ` — total would be ${totalNew.toFixed(1)}%`}
              </span>
            </div>
            <div className={s.formField}>
              <label className={s.fieldLabel}>Insert after</label>
              <select className={s.fieldSelect} value={afterDraw} onChange={e => setAfterDraw(Number(e.target.value))}>
                <option value={0}>Before Draw 1</option>
                {schedule.milestones.map(m => (
                  <option key={m.id} value={m.drawNumber}>After Draw {m.drawNumber}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className={s.modalActions}>
          <button className={s.btnGhost} onClick={onClose}>Cancel</button>
          <button className={s.btnPrimary} disabled={!canSave || addMut.isPending} onClick={() => addMut.mutate()}>
            {addMut.isPending ? <Loader2 size={14} className={s.spin} /> : <Plus size={14} />}
            Add Milestone
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Percentage summary bar ────────────────────────────────────────────────────

function PercentageSummaryBar({ milestones }: { milestones: DrawMilestone[] }) {
  const total = milestones.reduce((s, m) => s + m.percentage, 0);
  const valid = Math.abs(total - 100) < 0.01;

  return (
    <div className={s.summaryBarWrap}>
      <div className={`${s.segBar} ${!valid ? s.segBarError : ''}`}>
        {milestones.map((m, i) => (
          <div
            key={m.id}
            className={s.segment}
            style={{ width: `${m.percentage}%`, background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }}
            title={`Draw ${m.drawNumber}: ${m.percentage}%`}
          />
        ))}
      </div>
      <div className={s.segLegend}>
        {milestones.map((m, i) => (
          <div key={m.id} className={s.segLegendItem}>
            <span className={s.segDot} style={{ background: SEGMENT_COLORS[i % SEGMENT_COLORS.length] }} />
            <span className={s.segLegendLabel}>Draw {m.drawNumber}: {m.percentage}%</span>
          </div>
        ))}
      </div>
      {!valid && (
        <p className={s.segError}>
          <AlertCircle size={13} />
          Adjust percentages to total 100% (currently {total.toFixed(1)}%)
        </p>
      )}
    </div>
  );
}

// ── Inline edit form ──────────────────────────────────────────────────────────

interface EditDraft {
  title:              string;
  completionCriteria: string;
  percentage:         number | '';
  dueDateDays:        number | '';
}

function InlineEditForm({
  m, schedule, jobId,
  onSaved, onCancel,
}: {
  m:        DrawMilestone;
  schedule: DrawSchedule;
  jobId:    string;
  onSaved:  () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const [draft, setDraft] = useState<EditDraft>({
    title:              m.title,
    completionCriteria: m.completionCriteria,
    percentage:         m.percentage,
    dueDateDays:        '',
  });

  const otherPctSum = schedule.milestones
    .filter(o => o.id !== m.id)
    .reduce((s, o) => s + o.percentage, 0);
  const totalIfSaved = otherPctSum + (typeof draft.percentage === 'number' ? draft.percentage : 0);
  const pctValid     = Math.abs(totalIfSaved - 100) < 0.01;

  const saveMut = useMutation({
    mutationFn: () => drawApi.updateMilestone(jobId, m.id, {
      title:              draft.title.trim() || undefined,
      completionCriteria: draft.completionCriteria.trim() || undefined,
      percentage:         typeof draft.percentage === 'number' ? draft.percentage : undefined,
      dueDateDays:        typeof draft.dueDateDays === 'number' ? draft.dueDateDays : undefined,
    }),
    onMutate: async () => {
      // Optimistic update
      await qc.cancelQueries({ queryKey: ['draw-schedule', jobId] });
      const prev = qc.getQueryData<DrawSchedule | null>(['draw-schedule', jobId]);
      if (prev) {
        qc.setQueryData<DrawSchedule>(['draw-schedule', jobId], {
          ...prev,
          milestones: prev.milestones.map(ms =>
            ms.id !== m.id ? ms : {
              ...ms,
              title:              draft.title || ms.title,
              completionCriteria: draft.completionCriteria || ms.completionCriteria,
              percentage:         typeof draft.percentage === 'number' ? draft.percentage : ms.percentage,
              amount:             typeof draft.percentage === 'number'
                ? Math.round((draft.percentage / 100) * prev.totalAmount * 100) / 100
                : ms.amount,
            },
          ),
        });
      }
      return { prev };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['draw-schedule', jobId] });
      toast('Milestone saved.');
      onSaved();
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['draw-schedule', jobId], ctx.prev);
      toast('Failed to save changes', 'error');
    },
  });

  return (
    <div className={s.editForm}>
      <div className={s.formField}>
        <label className={s.fieldLabel}>Title</label>
        <input
          className={s.fieldInput}
          value={draft.title}
          onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
        />
      </div>
      <div className={s.formField}>
        <label className={s.fieldLabel}>Completion Criteria</label>
        <textarea
          className={s.fieldTextarea}
          rows={3}
          value={draft.completionCriteria}
          onChange={e => setDraft(d => ({ ...d, completionCriteria: e.target.value }))}
        />
      </div>
      <div className={s.formRow}>
        <div className={s.formField}>
          <label className={s.fieldLabel}>Percentage</label>
          <div className={s.pctInputWrap}>
            <input
              className={`${s.fieldInput} ${!pctValid && draft.percentage !== '' ? s.inputError : ''}`}
              type="number" min={1} max={50} step={1}
              value={draft.percentage}
              onChange={e => setDraft(d => ({ ...d, percentage: e.target.value === '' ? '' : Number(e.target.value) }))}
            />
            <span className={s.pctSuffix}>%</span>
          </div>
          <span className={`${s.pctHint} ${!pctValid && draft.percentage !== '' ? s.pctHintError : ''}`}>
            Remaining: {(100 - otherPctSum).toFixed(1)}%
            {!pctValid && draft.percentage !== '' && ` — total would be ${totalIfSaved.toFixed(1)}%`}
          </span>
        </div>
        <div className={s.formField}>
          <label className={s.fieldLabel}>Est. days to complete</label>
          <input
            className={s.fieldInput}
            type="number" min={1} max={730} placeholder="e.g. 14"
            value={draft.dueDateDays}
            onChange={e => setDraft(d => ({ ...d, dueDateDays: e.target.value === '' ? '' : Number(e.target.value) }))}
          />
        </div>
      </div>
      <div className={s.editActions}>
        <button className={s.btnGhost} onClick={onCancel} disabled={saveMut.isPending}>Cancel</button>
        <button
          className={s.btnPrimary}
          disabled={saveMut.isPending || (!pctValid && draft.percentage !== '')}
          onClick={() => saveMut.mutate()}
        >
          {saveMut.isPending ? <Loader2 size={13} className={s.spin} /> : null}
          Save
        </button>
      </div>
    </div>
  );
}

// ── Milestone card ────────────────────────────────────────────────────────────

function MilestoneCard({
  m, schedule, jobId, isLocked, canEdit, isInvestor, isLast,
  onDeleted,
}: {
  m:           DrawMilestone;
  schedule:    DrawSchedule;
  jobId:       string;
  isLocked:    boolean;
  canEdit:     boolean;
  isInvestor:  boolean;
  isLast:      boolean;
  onDeleted:   (updated: DrawSchedule) => void;
}) {
  const { toast }  = useToast();
  const qc         = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const deleteMut = useMutation({
    mutationFn: () => drawApi.deleteMilestone(jobId, m.id),
    onSuccess:  (updated) => {
      qc.setQueryData(['draw-schedule', jobId], updated);
      toast('Milestone removed.');
      onDeleted(updated);
      setConfirmDel(false);
    },
    onError: () => toast('Failed to remove milestone', 'error'),
  });

  const color = SEGMENT_COLORS[(m.drawNumber - 1) % SEGMENT_COLORS.length];

  return (
    <>
      <div className={s.milestoneCard}>
        {/* Card header */}
        <div className={s.cardHeader}>
          <div className={s.cardHeaderLeft}>
            <span className={s.drawNumBadge} style={{ borderColor: color, color }}>
              Draw {m.drawNumber}
            </span>
            <span className={s.cardTitle}>{m.title}</span>
          </div>
          <div className={s.cardHeaderRight}>
            <span className={s.pctPill}>{m.percentage}%</span>
            <span className={s.cardAmount}>{fmtMoney(m.amount)}</span>
            {canEdit && !editing && (
              <button
                className={s.iconBtn}
                onClick={e => { e.stopPropagation(); setEditing(true); setOpen(true); }}
                title="Edit milestone"
              >
                <Pencil size={13} />
              </button>
            )}
            {canEdit && (
              <button
                className={`${s.iconBtn} ${s.iconBtnDanger}`}
                onClick={e => { e.stopPropagation(); setConfirmDel(true); }}
                title="Remove milestone"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              className={s.iconBtn}
              onClick={() => setOpen(v => !v)}
              aria-label={open ? 'Collapse' : 'Expand'}
            >
              {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* Card body */}
        {open && !editing && (
          <div className={s.cardBody}>
            <p className={s.criteriaLabel}>Completion Criteria:</p>
            <p className={s.criteriaText}>{m.completionCriteria}</p>
            {m.description && <p className={s.descriptionText}>{m.description}</p>}
            {m.dueDate && (
              <p className={s.dueDateText}>
                <Calendar size={12} />
                Est. completion: {new Date(m.dueDate).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Inline edit */}
        {editing && (
          <InlineEditForm
            m={m}
            schedule={schedule}
            jobId={jobId}
            onSaved={() => setEditing(false)}
            onCancel={() => setEditing(false)}
          />
        )}
      </div>

      {/* Connector */}
      {!isLast && <div className={s.connector}><div className={s.connectorLine} /></div>}

      {/* Delete confirm modal */}
      {confirmDel && (
        <ConfirmModal
          title="Remove milestone?"
          body={
            <p>
              <strong>Draw {m.drawNumber}: {m.title}</strong> will be removed and its{' '}
              {m.percentage}% will be redistributed proportionally across the remaining draws.
            </p>
          }
          confirmLabel="Remove"
          loading={deleteMut.isPending}
          danger
          onConfirm={() => deleteMut.mutate()}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </>
  );
}

// ── Approval section ──────────────────────────────────────────────────────────

function ApprovalSection({
  schedule, job, jobId, userId, isInvestor, isContractor,
}: {
  schedule:     DrawSchedule;
  job:          JobPost;
  jobId:        string;
  userId:       string;
  isInvestor:   boolean;
  isContractor: boolean;
}) {
  const { toast } = useToast();
  const qc        = useQueryClient();
  const navigate  = useNavigate();
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showResetConfirm,   setShowResetConfirm]   = useState(false);

  const investorName    = `${job.investor.firstName} ${job.investor.lastName}`;
  const contractorName  = extractContractorName(schedule);

  const myApprovedAt    = isInvestor ? schedule.investorApprovedAt : schedule.contractorApprovedAt;
  const otherApprovedAt = isInvestor ? schedule.contractorApprovedAt : schedule.investorApprovedAt;
  const otherName       = isInvestor ? contractorName : investorName;

  const approveMut = useMutation({
    mutationFn: () => drawApi.approve(jobId),
    onSuccess: (updated) => {
      qc.setQueryData(['draw-schedule', jobId], updated);
      setShowApproveConfirm(false);
      toast(updated.status === 'LOCKED'
        ? 'Schedule locked! Both parties have approved.'
        : 'Your approval has been recorded.');
    },
    onError: () => { setShowApproveConfirm(false); toast('Failed to approve', 'error'); },
  });

  const resetMut = useMutation({
    mutationFn: () => drawApi.resetApproval(jobId),
    onSuccess: (updated) => {
      qc.setQueryData(['draw-schedule', jobId], updated);
      setShowResetConfirm(false);
      toast('Approval withdrawn — schedule is back in negotiation.');
    },
    onError: () => { setShowResetConfirm(false); toast('Failed to withdraw approval', 'error'); },
  });

  if (schedule.status === 'LOCKED') {
    return (
      <div className={s.lockedApproval}>
        <Lock size={16} />
        <span>Schedule locked on {new Date(schedule.lockedAt!).toLocaleDateString()}</span>
      </div>
    );
  }

  return (
    <>
      <div className={s.approvalSection}>
        <h3 className={s.approvalHeading}>Approvals</h3>

        <div className={s.approvalGrid}>
          {/* Investor */}
          <div className={s.partyCard}>
            <div className={s.partyInfo}>
              <Avatar name={investorName} size="sm" />
              <div>
                <p className={s.partyName}>{investorName}</p>
                <p className={s.partyRole}>Investor</p>
              </div>
            </div>
            {schedule.investorApprovedAt ? (
              <div className={s.approvedState}>
                <CheckCircle2 size={16} className={s.approvedIcon} />
                <span>Approved {timeAgo(schedule.investorApprovedAt)}</span>
              </div>
            ) : (
              <div className={s.awaitingState}>
                <span className={s.awaitingCircle} />
                <span>Awaiting approval</span>
              </div>
            )}
            {isInvestor && !myApprovedAt && (
              <button className={s.btnPrimary} onClick={() => setShowApproveConfirm(true)}>
                <FileCheck size={14} /> Approve Schedule
              </button>
            )}
            {isInvestor && myApprovedAt && (
              <>
                <div className={s.approvedSelf}>
                  <CheckCircle2 size={14} className={s.approvedIcon} /> Approved ✓
                </div>
                {schedule.status === 'PENDING_APPROVAL' && (
                  <button className={s.linkBtn} onClick={() => setShowResetConfirm(true)}>
                    Request Changes
                  </button>
                )}
              </>
            )}
          </div>

          {/* Contractor */}
          <div className={s.partyCard}>
            <div className={s.partyInfo}>
              <Avatar name={contractorName} size="sm" />
              <div>
                <p className={s.partyName}>{contractorName}</p>
                <p className={s.partyRole}>Contractor</p>
              </div>
            </div>
            {schedule.contractorApprovedAt ? (
              <div className={s.approvedState}>
                <CheckCircle2 size={16} className={s.approvedIcon} />
                <span>Approved {timeAgo(schedule.contractorApprovedAt)}</span>
              </div>
            ) : (
              <div className={s.awaitingState}>
                <span className={s.awaitingCircle} />
                <span>Awaiting approval</span>
              </div>
            )}
            {isContractor && !myApprovedAt && (
              <button className={s.btnPrimary} onClick={() => setShowApproveConfirm(true)}>
                <FileCheck size={14} /> Approve Schedule
              </button>
            )}
            {isContractor && myApprovedAt && (
              <>
                <div className={s.approvedSelf}>
                  <CheckCircle2 size={14} className={s.approvedIcon} /> Approved ✓
                </div>
                {schedule.status === 'PENDING_APPROVAL' && (
                  <button className={s.linkBtn} onClick={() => setShowResetConfirm(true)}>
                    Request Changes
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Waiting callout (I approved, other hasn't) */}
        {myApprovedAt && !otherApprovedAt && (
          <div className={s.waitingCallout}>
            <div className={s.waitingText}>
              <Clock size={15} />
              <span>You have approved this schedule. Waiting for {otherName} to review and approve.</span>
            </div>
            <button
              className={s.reminderBtn}
              onClick={() => toast(`Reminder sent to ${otherName}.`)}
            >
              <Bell size={13} /> Send Reminder
            </button>
          </div>
        )}
      </div>

      {/* Approve confirm modal */}
      {showApproveConfirm && (
        <ConfirmModal
          title="Approve this draw schedule?"
          body={
            <div>
              <p>You are approving a schedule with <strong>{schedule.milestones.length} milestones</strong> totalling <strong>{fmtMoney(schedule.totalAmount)}</strong>.</p>
              <p className={s.modalNote}>Once both parties approve, the schedule is locked and cannot be changed. You can then sign the contract.</p>
            </div>
          }
          confirmLabel="Approve Schedule"
          loading={approveMut.isPending}
          onConfirm={() => approveMut.mutate()}
          onCancel={() => setShowApproveConfirm(false)}
        />
      )}

      {/* Reset confirm modal */}
      {showResetConfirm && (
        <ConfirmModal
          title="Request changes?"
          body={
            <p>This will un-approve the schedule and notify <strong>{otherName}</strong> that you want to negotiate further. Continue?</p>
          }
          confirmLabel="Request Changes"
          loading={resetMut.isPending}
          onConfirm={() => resetMut.mutate()}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function DrawSchedulePage() {
  const { jobId }  = useParams<{ jobId: string }>();
  const navigate   = useNavigate();
  const { user }   = useAuth();
  const { toast }  = useToast();
  const qc         = useQueryClient();

  const isInvestor   = user?.role === 'INVESTOR';
  const isContractor = user?.role === 'CONTRACTOR';

  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [realtimeBanner,   setRealtimeBanner]   = useState<string | null>(null);
  const [rationaleOpen,    setRationaleOpen]     = useState(false);
  const [showAddModal,     setShowAddModal]      = useState(false);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────

  const jobQ = useQuery({
    queryKey:  ['jobs', jobId],
    queryFn:   () => getJobById(jobId!),
    enabled:   !!jobId,
    staleTime: 60_000,
  });

  const scheduleQ = useQuery({
    queryKey:       ['draw-schedule', jobId],
    queryFn:        () => drawApi.getSchedule(jobId!),
    enabled:        !!jobId,
    staleTime:      10_000,
    refetchInterval: 10_000,
  });

  const job      = jobQ.data ?? null;
  const schedule = scheduleQ.data ?? null;

  // ── Auto-generate (investor + AWARDED + no schedule) ─────────────────────────

  const hasTriedGenerate = useRef(false);

  useEffect(() => {
    if (
      !isInvestor ||
      !job ||
      job.status !== 'AWARDED' ||
      schedule !== null ||
      scheduleQ.isLoading ||
      isAutoGenerating ||
      hasTriedGenerate.current
    ) return;

    hasTriedGenerate.current = true;
    setIsAutoGenerating(true);

    drawApi.generate(jobId!)
      .then(generated => {
        qc.setQueryData(['draw-schedule', jobId], generated);
      })
      .catch(() => toast('Could not auto-generate schedule. You can generate manually.', 'error'))
      .finally(() => setIsAutoGenerating(false));
  }, [isInvestor, job, schedule, scheduleQ.isLoading, isAutoGenerating, jobId, qc, toast]);

  // ── Supabase Realtime ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!jobId || !user) return;

    const supabase = getSupabaseClient();
    const channel  = supabase.channel(`draw-schedule:${jobId}`)
      .on(
        'postgres_changes',
        {
          event:  '*',
          schema: 'public',
          table:  'draw_schedules',
          filter: `job_id=eq.${jobId}`,
        },
        () => {
          qc.invalidateQueries({ queryKey: ['draw-schedule', jobId] });

          // Show banner with the other party's name
          const other = isInvestor
            ? extractContractorName(qc.getQueryData<DrawSchedule | null>(['draw-schedule', jobId]))
            : job ? `${job.investor.firstName} ${job.investor.lastName}` : 'The other party';

          setRealtimeBanner(`${other} just made changes to the draw schedule`);

          if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
          bannerTimerRef.current = setTimeout(() => setRealtimeBanner(null), 6_000);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    };
  }, [jobId, user, isInvestor, job, qc]);

  // ── Loading / error guards ────────────────────────────────────────────────────

  if (jobQ.isLoading || scheduleQ.isLoading) {
    return (
      <div className={s.page}>
        <div className={s.skeleton}>
          {[1, 2, 3, 4].map(i => <div key={i} className={s.skeletonRow} />)}
        </div>
      </div>
    );
  }

  if (jobQ.isError) {
    return (
      <div className={s.page}>
        <div className={s.errorState}>
          <AlertCircle size={20} />
          <span>Could not load job details.</span>
        </div>
      </div>
    );
  }

  const isLocked   = schedule?.status === 'LOCKED';
  const isDraft    = schedule?.status === 'DRAFT';
  const canEdit    = !!schedule && !isLocked;
  const totalBudget = schedule?.totalAmount ?? job?.budgetMax ?? 0;

  return (
    <div className={s.page}>
      {/* ── Back button ── */}
      <button className={s.backBtn} onClick={() => navigate(-1)}>
        <ArrowLeft size={15} /> Back
      </button>

      {/* ── Realtime banner ── */}
      {realtimeBanner && (
        <div className={s.realtimeBanner}>
          <span>{realtimeBanner}</span>
          <button className={s.bannerClose} onClick={() => setRealtimeBanner(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Page header ── */}
      <div className={s.pageHeader}>
        <div className={s.headerMeta}>
          <h1 className={s.pageTitle}>Draw Schedule</h1>
          {job && (
            <p className={s.pageSubtitle}>
              {job.title} &nbsp;•&nbsp; Total: {fmtMoney(totalBudget)}
            </p>
          )}
        </div>
        {schedule && <ScheduleBadge status={schedule.status} />}
      </div>

      {/* ── Auto-generating state ── */}
      {isAutoGenerating && (
        <div className={s.generatingState}>
          <Loader2 size={20} className={s.spin} />
          <span>Generating AI draw schedule…</span>
        </div>
      )}

      {/* ── Contractor waiting state ── */}
      {!isAutoGenerating && !schedule && isContractor && (
        <div className={s.waitingState}>
          <Clock size={32} className={s.waitingIcon} />
          <p className={s.waitingMsg}>Waiting for the investor to set up the draw schedule…</p>
        </div>
      )}

      {/* ── AI Generated Banner (DRAFT) ── */}
      {schedule && isDraft && schedule.aiGenerated && (
        <div className={s.aiBanner}>
          <div className={s.aiBannerHeader}>
            <Sparkles size={16} className={s.aiBannerIcon} />
            <span>BuildMatch AI generated this schedule based on your job details.</span>
          </div>
          <p className={s.aiBannerBody}>
            Review each milestone, make any adjustments, then both parties must approve before
            the contract can be signed.
          </p>
          <button
            className={s.aiBannerToggle}
            onClick={() => setRationaleOpen(v => !v)}
          >
            Why this schedule?
            {rationaleOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          {rationaleOpen && (
            <p className={s.aiBannerRationale}>
              The AI analysed your job type, scope, and budget to suggest draw amounts and
              timing that protect both parties. First draw ≤ 15% to minimise upfront risk,
              no single draw exceeds 35%, and the final draw ≥ 10% gives the investor
              leverage until work is verified complete.
            </p>
          )}
        </div>
      )}

      {/* ── Both Approved / Locked Banner ── */}
      {isLocked && (
        <div className={s.lockedBanner}>
          <div className={s.lockedBannerLeft}>
            <CheckCircle2 size={18} className={s.lockedIcon} />
            <div>
              <p className={s.lockedTitle}>Draw schedule locked. Both parties have approved.</p>
              <p className={s.lockedSub}>You can now review and sign the contract.</p>
            </div>
          </div>
          <button className={s.btnPrimary} onClick={() => navigate(`/jobs/${jobId}/contract`)}>
            Go to Contract
          </button>
        </div>
      )}

      {/* ── Schedule exists ── */}
      {schedule && (
        <>
          {/* Milestones list */}
          <div className={s.milestoneList}>
            {schedule.milestones.map((m, i) => (
              <MilestoneCard
                key={m.id}
                m={m}
                schedule={schedule}
                jobId={jobId!}
                isLocked={isLocked}
                canEdit={canEdit}
                isInvestor={isInvestor}
                isLast={i === schedule.milestones.length - 1}
                onDeleted={updated => qc.setQueryData(['draw-schedule', jobId], updated)}
              />
            ))}
          </div>

          {/* Add milestone button */}
          {canEdit && schedule.milestones.length < 8 && (
            <button className={s.addMilestoneBtn} onClick={() => setShowAddModal(true)}>
              <Plus size={14} /> Add Milestone
            </button>
          )}

          {/* Percentage summary bar */}
          <PercentageSummaryBar milestones={schedule.milestones} />

          {/* Approval section */}
          {job && (
            <ApprovalSection
              schedule={schedule}
              job={job}
              jobId={jobId!}
              userId={user!.userId}
              isInvestor={isInvestor}
              isContractor={isContractor}
            />
          )}
        </>
      )}

      {/* ── Add Milestone Modal ── */}
      {showAddModal && schedule && (
        <AddMilestoneModal
          schedule={schedule}
          jobId={jobId!}
          onAdded={() => setShowAddModal(false)}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </div>
  );
}
