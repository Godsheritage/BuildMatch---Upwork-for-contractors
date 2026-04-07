import React, { useState, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, CheckCircle2, Circle, Clock, FileText,
  Image, Video, ExternalLink, Upload, X, AlertTriangle,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Spinner } from '../../components/ui/Spinner';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { useDisputeMessages } from '../../hooks/useDisputeMessages';
import { useDisputeEvidenceUpload } from '../../hooks/useDisputeEvidenceUpload';
import {
  getDisputeById,
  getDisputeEvidence,
  submitEvidence,
  withdrawDispute,
} from '../../services/dispute.service';
import type {
  Dispute,
  DisputeEvidence,
  DisputeStatus,
  EvidenceType,
} from '../../types/dispute.types';
import styles from './DisputeDetailPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric', minute: '2-digit',
  });
}

function formatCategory(cat: string): string {
  return cat.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRuling(ruling: string): string {
  const map: Record<string, string> = {
    INVESTOR_WINS:  'Investor Wins',
    CONTRACTOR_WINS:'Contractor Wins',
    SPLIT:          'Split Decision',
    WITHDRAWN:      'Withdrawn',
    NO_ACTION:      'No Action',
  };
  return map[ruling] ?? ruling;
}

const ACTIVE_STATUSES: DisputeStatus[] = ['OPEN', 'UNDER_REVIEW', 'AWAITING_EVIDENCE', 'PENDING_RULING'];

function isDisputeActive(status: DisputeStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DisputeStatus, { label: string; bg: string; color: string }> = {
  OPEN:               { label: 'Open',            bg: '#DBEAFE', color: '#1E40AF' },
  UNDER_REVIEW:       { label: 'Under Review',    bg: '#EDE9FE', color: '#5B21B6' },
  AWAITING_EVIDENCE:  { label: 'Evidence Needed', bg: '#FEF3C7', color: '#92400E' },
  PENDING_RULING:     { label: 'Pending Ruling',  bg: '#FFEDD5', color: '#9A3412' },
  RESOLVED:           { label: 'Resolved',        bg: '#DCFCE7', color: '#166534' },
  CLOSED:             { label: 'Closed',          bg: '#F3F4F6', color: '#374151' },
  WITHDRAWN:          { label: 'Withdrawn',       bg: '#F3F4F6', color: '#6B7280' },
};

function StatusBadge({ status }: { status: DisputeStatus }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-block', padding: '3px 10px',
        borderRadius: 'var(--radius-pill)', fontSize: 11,
        fontWeight: 500, letterSpacing: '0.04em',
        background: cfg.bg, color: cfg.color,
      }}
    >
      {cfg.label}
    </span>
  );
}

// ── Status timeline ───────────────────────────────────────────────────────────

const TIMELINE_STEPS = [
  { key: 'OPEN',              label: 'Dispute Filed' },
  { key: 'UNDER_REVIEW',      label: 'Under Review' },
  { key: 'AWAITING_EVIDENCE', label: 'Evidence Collection' },
  { key: 'PENDING_RULING',    label: 'Pending Ruling' },
  { key: 'RESOLVED',          label: 'Resolved' },
] as const;

function StatusTimeline({ status, createdAt }: { status: DisputeStatus; createdAt: string }) {
  if (status === 'WITHDRAWN') {
    return (
      <div className={styles.timelineCard}>
        <p className={styles.sidebarSectionTitle}>Status Timeline</p>
        <div className={styles.timelineItem}>
          <span className={styles.dotFilled} />
          <div>
            <p className={styles.timelineLabel}>Dispute Filed</p>
            <p className={styles.timelineSub}>{formatDate(createdAt)}</p>
          </div>
        </div>
        <div className={styles.timelineItem}>
          <span className={styles.dotWithdrawn} />
          <div>
            <p className={styles.timelineLabel} style={{ color: '#6B7280' }}>Withdrawn</p>
          </div>
        </div>
      </div>
    );
  }

  const currentIdx = TIMELINE_STEPS.findIndex((s) => s.key === status);

  return (
    <div className={styles.timelineCard}>
      <p className={styles.sidebarSectionTitle}>Status Timeline</p>
      {TIMELINE_STEPS.map((step, i) => {
        const isPast    = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture  = i > currentIdx;
        return (
          <div key={step.key} className={styles.timelineItem}>
            {isPast ? (
              <CheckCircle2 size={16} strokeWidth={2} style={{ color: '#22C55E', flexShrink: 0 }} />
            ) : isCurrent ? (
              <span className={styles.dotFilled} />
            ) : (
              <Circle size={16} strokeWidth={1.5} style={{ color: 'var(--color-border)', flexShrink: 0 }} />
            )}
            <div>
              <p
                className={styles.timelineLabel}
                style={{
                  color: isFuture
                    ? 'var(--color-text-muted)'
                    : isCurrent
                    ? 'var(--color-primary)'
                    : 'var(--color-text-primary)',
                  fontWeight: isCurrent ? 600 : undefined,
                }}
              >
                {step.label}
              </p>
              {i === 0 && <p className={styles.timelineSub}>{formatDate(createdAt)}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Evidence icon ─────────────────────────────────────────────────────────────

function EvidenceIcon({ type }: { type: EvidenceType }) {
  if (type === 'PHOTO')    return <Image  size={16} strokeWidth={1.75} style={{ color: '#0369A1' }} />;
  if (type === 'VIDEO')    return <Video  size={16} strokeWidth={1.75} style={{ color: '#7C3AED' }} />;
  if (type === 'DOCUMENT') return <FileText size={16} strokeWidth={1.75} style={{ color: '#C2410C' }} />;
  return <FileText size={16} strokeWidth={1.75} style={{ color: 'var(--color-text-muted)' }} />;
}

// ── Evidence upload form ──────────────────────────────────────────────────────

function EvidenceUploadForm({
  disputeId,
  onSubmitted,
  onCancel,
}: {
  disputeId:   string;
  onSubmitted: () => void;
  onCancel:    () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { uploadEvidence, isUploading, uploadProgress, error: uploadError, evidenceType } =
    useDisputeEvidenceUpload();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [description, setDescription]  = useState('');
  const [isDragging, setIsDragging]    = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error('No file selected');
      if (description.trim().length < 10) throw new Error('Description must be at least 10 characters');
      const url  = await uploadEvidence(selectedFile, disputeId);
      const type = evidenceType ?? 'OTHER';
      return submitEvidence(disputeId, { type, url, description: description.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId, 'evidence'] });
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      toast('Evidence submitted successfully');
      onSubmitted();
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to submit evidence', 'error');
    },
  });

  function handleFileChange(file: File | null) {
    setSelectedFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileChange(file);
  }

  return (
    <div className={styles.evidenceForm}>
      <div className={styles.evidenceFormHeader}>
        <span className={styles.sidebarSectionTitle} style={{ margin: 0 }}>Add Evidence</span>
        <button className={styles.iconBtn} onClick={onCancel}><X size={16} strokeWidth={2} /></button>
      </div>

      {/* Drop zone */}
      <div
        className={[styles.dropZone, isDragging ? styles.dropZoneDragging : ''].join(' ')}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4,video/quicktime,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
        />
        {selectedFile ? (
          <div className={styles.fileSelected}>
            <EvidenceIcon type={evidenceType ?? 'OTHER'} />
            <span className={styles.fileName}>{selectedFile.name}</span>
            <button
              className={styles.iconBtn}
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        ) : (
          <>
            <Upload size={20} strokeWidth={1.75} style={{ color: 'var(--color-text-muted)' }} />
            <p className={styles.dropZoneText}>Drop a file or click to browse</p>
            <p className={styles.dropZoneHint}>Images, videos, PDFs · 10 MB max (100 MB for videos)</p>
          </>
        )}
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div className={styles.progressWrap}>
          <div className={styles.progressBar} style={{ width: `${uploadProgress}%` }} />
          <span className={styles.progressLabel}>{uploadProgress}%</span>
        </div>
      )}

      {uploadError && <p className={styles.formError}>{uploadError}</p>}

      {/* Description */}
      <textarea
        className={styles.evidenceTextarea}
        rows={3}
        placeholder="Describe this evidence (required, min 10 characters)…"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <div className={styles.evidenceFormActions}>
        <Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => submitMutation.mutate()}
          disabled={!selectedFile || description.trim().length < 10 || isUploading || submitMutation.isPending}
        >
          {submitMutation.isPending ? <><Spinner size="sm" /> Submitting…</> : 'Submit Evidence'}
        </Button>
      </div>
    </div>
  );
}

// ── Withdraw modal ────────────────────────────────────────────────────────────

function WithdrawModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: (reason: string) => void;
  onCancel:  () => void;
  isPending: boolean;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [reason, setReason]           = useState('');

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <AlertTriangle size={20} strokeWidth={2} style={{ color: 'var(--color-danger)' }} />
          <h3 className={styles.modalTitle}>Withdraw Dispute</h3>
        </div>
        <p className={styles.modalBody}>
          Are you sure you want to withdraw this dispute? This cannot be undone.
          Any held funds will be released to the contractor.
        </p>

        <div className={styles.modalField}>
          <label className={styles.formLabel}>Reason for withdrawing</label>
          <textarea
            className={styles.evidenceTextarea}
            rows={2}
            placeholder="Briefly explain why you are withdrawing (min 10 chars)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <div className={styles.modalField}>
          <label className={styles.formLabel}>Type <strong>WITHDRAW</strong> to confirm</label>
          <input
            type="text"
            className={styles.confirmInput}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="WITHDRAW"
          />
        </div>

        <div className={styles.modalActions}>
          <Button variant="secondary" onClick={onCancel} disabled={isPending}>Cancel</Button>
          <Button
            variant="danger"
            disabled={confirmText !== 'WITHDRAW' || reason.trim().length < 10 || isPending}
            onClick={() => onConfirm(reason.trim())}
          >
            {isPending ? <><Spinner size="sm" /> Withdrawing…</> : 'Withdraw Dispute'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function DisputeDetailPage() {
  const { disputeId }   = useParams<{ disputeId: string }>();
  const navigate        = useNavigate();
  const { user }        = useAuth();
  const { toast }       = useToast();
  const queryClient     = useQueryClient();

  const [mobileTab, setMobileTab]           = useState<'discussion' | 'details'>('discussion');
  const [messageInput, setMessageInput]     = useState('');
  const [isSending, setIsSending]           = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [showEvidenceUpload, setShowEvidenceUpload] = useState(false);
  const [evidenceExpanded, setEvidenceExpanded] = useState(true);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: dispute, isLoading: disputeLoading, error: disputeError } = useQuery({
    queryKey: ['dispute', disputeId],
    queryFn:  () => getDisputeById(disputeId!),
    enabled:  !!disputeId,
  });

  const { messages: localMessages, sendMessage, messagesEndRef } = useDisputeMessages(disputeId, dispute);

  const { data: evidence = [] } = useQuery({
    queryKey: ['dispute', disputeId, 'evidence'],
    queryFn:  () => getDisputeEvidence(disputeId!),
    enabled:  !!disputeId,
  });

  // ── Send handler ───────────────────────────────────────────────────────────

  async function handleSend() {
    const content = messageInput.trim();
    if (!content || isSending) return;
    setIsSending(true);
    setMessageInput('');
    try {
      await sendMessage(content);
    } finally {
      setIsSending(false);
    }
  }

  // ── Withdraw mutation ──────────────────────────────────────────────────────

  const withdrawMutation = useMutation({
    mutationFn: (reason: string) => withdrawDispute(disputeId!, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dispute', disputeId] });
      queryClient.invalidateQueries({ queryKey: ['disputes', 'list'] });
      queryClient.invalidateQueries({ queryKey: ['disputes', 'summary'] });
      toast('Dispute withdrawn successfully');
      setShowWithdrawModal(false);
    },
    onError: () => toast('Failed to withdraw dispute', 'error'),
  });

  // ── Loading / error states ─────────────────────────────────────────────────

  if (disputeLoading) {
    return (
      <div className={styles.loadingWrap}>
        <Spinner size="sm" />
        <span>Loading dispute…</span>
      </div>
    );
  }

  if (disputeError || !dispute) {
    return (
      <div className={styles.errorWrap}>
        <AlertTriangle size={32} strokeWidth={1.5} style={{ color: 'var(--color-danger)' }} />
        <p>Dispute not found or you don't have access.</p>
        <Button variant="secondary" onClick={() => navigate('/dashboard/settings/disputes')}>
          Back to Disputes
        </Button>
      </div>
    );
  }

  const isFiler    = dispute.filedById === user?.id;
  const canMessage = isDisputeActive(dispute.status);
  const canWithdraw = isFiler && ['OPEN', 'UNDER_REVIEW', 'AWAITING_EVIDENCE'].includes(dispute.status);

  // ── Left column content ────────────────────────────────────────────────────

  const LeftColumn = (
    <div className={styles.leftColumn}>

      {/* Dispute header card */}
      <div className={styles.headerCard}>
        <div className={styles.headerCardTop}>
          <div className={styles.badgeRow}>
            <StatusBadge status={dispute.status} />
            <span
              style={{
                display: 'inline-block', padding: '3px 10px',
                borderRadius: 'var(--radius-pill)', fontSize: 11,
                fontWeight: 500, background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-muted)',
              }}
            >
              {formatCategory(dispute.category)}
            </span>
          </div>
        </div>

        <Link to={`/jobs/${dispute.jobId}`} className={styles.disputeJobTitle}>
          {dispute.jobTitle}
        </Link>

        <p className={styles.disputeAmount}>
          Amount in dispute:&nbsp;
          <strong style={{ color: 'var(--color-accent)' }}>
            ${dispute.amountDisputed.toLocaleString()}
          </strong>
        </p>

        <div className={styles.partiesRow}>
          <div className={styles.partyItem}>
            <Avatar
              name={`${dispute.filedBy.firstName} ${dispute.filedBy.lastName}`}
              src={dispute.filedBy.avatarUrl ?? undefined}
              size="sm"
            />
            <div>
              <p className={styles.partyRole}>Filed by</p>
              <p className={styles.partyName}>
                {dispute.filedBy.firstName} {dispute.filedBy.lastName}
              </p>
            </div>
          </div>

          <div className={styles.partySep}>vs</div>

          <div className={styles.partyItem}>
            <Avatar
              name={`${dispute.against.firstName} ${dispute.against.lastName}`}
              src={dispute.against.avatarUrl ?? undefined}
              size="sm"
            />
            <div>
              <p className={styles.partyRole}>Against</p>
              <p className={styles.partyName}>
                {dispute.against.firstName} {dispute.against.lastName}
              </p>
            </div>
          </div>
        </div>

        <p className={styles.filedDate}>
          <Clock size={12} strokeWidth={2} style={{ marginRight: 4 }} />
          Filed on {formatDate(dispute.createdAt)}
        </p>
      </div>

      {/* Description */}
      <div className={styles.sectionCard}>
        <p className={styles.sectionLabel}>What happened</p>
        <p className={styles.sectionText}>{dispute.description}</p>
        <p className={styles.sectionLabel} style={{ marginTop: 'var(--space-4)' }}>Desired outcome</p>
        <p className={styles.sectionText}>{dispute.desiredOutcome}</p>
      </div>

      {/* Message thread */}
      <div className={styles.sectionCard}>
        <div className={styles.threadHeader}>
          <p className={styles.threadTitle}>Communication with BuildMatch</p>
          <p className={styles.threadSub}>All parties and BuildMatch staff can see these messages</p>
        </div>

        <div className={styles.messageList}>
          {localMessages.map((msg) => {
            if (msg.isSystem) {
              return (
                <div key={msg.id} className={styles.systemMessage}>
                  <span className={styles.systemPill}>{msg.content}</span>
                </div>
              );
            }
            const isMe = msg.senderId === user?.id;
            return (
              <div key={msg.id} className={[styles.messageBubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft].join(' ')}>
                <p className={styles.bubbleSender}>{msg.senderName}</p>
                <div className={[styles.bubble, isMe ? styles.bubbleMine : styles.bubbleTheirs].join(' ')}>
                  {msg.content}
                </div>
                <p className={styles.bubbleTime}>{formatTime(msg.createdAt)}</p>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Closed banner */}
        {!canMessage && (
          <div className={styles.closedBanner}>
            <AlertTriangle size={15} strokeWidth={2} />
            This dispute has been {dispute.status.toLowerCase()}. No further messages can be sent.
          </div>
        )}

        {/* Message input */}
        {canMessage && (
          <div className={styles.messageInput}>
            <textarea
              className={styles.messageTextarea}
              rows={3}
              placeholder="Add a message to this dispute…"
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && messageInput.trim()) {
                  void handleSend();
                }
              }}
            />
            <div className={styles.messageInputActions}>
              <span className={styles.messageHint}>⌘↵ to send</span>
              <Button
                variant="primary"
                size="sm"
                disabled={!messageInput.trim() || isSending}
                onClick={() => void handleSend()}
              >
                {isSending ? <Spinner size="sm" /> : 'Send'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── Right sidebar content ──────────────────────────────────────────────────

  const RightSidebar = (
    <div className={styles.sidebar}>

      {/* Status timeline */}
      <StatusTimeline status={dispute.status} createdAt={dispute.createdAt} />

      {/* Ruling card */}
      {dispute.status === 'RESOLVED' && dispute.ruling && (
        <div className={styles.rulingCard}>
          <p className={styles.rulingHeader}>
            <CheckCircle2 size={15} strokeWidth={2} style={{ color: '#22C55E' }} />
            Dispute Resolved
          </p>
          <p className={styles.rulingValue}>{formatRuling(dispute.ruling)}</p>
          {dispute.rulingNote && (
            <p className={styles.rulingNote}>{dispute.rulingNote}</p>
          )}
          {dispute.resolvedAt && (
            <p className={styles.rulingDate}>
              Resolved by BuildMatch on {formatDate(dispute.resolvedAt)}
            </p>
          )}
        </div>
      )}

      {/* Evidence */}
      <div className={styles.evidenceCard}>
        <button
          className={styles.evidenceToggle}
          onClick={() => setEvidenceExpanded((v) => !v)}
        >
          <p className={styles.sidebarSectionTitle} style={{ margin: 0 }}>Evidence submitted</p>
          {evidenceExpanded
            ? <ChevronUp size={15} strokeWidth={2} />
            : <ChevronDown size={15} strokeWidth={2} />
          }
        </button>

        {evidenceExpanded && (
          <>
            {evidence.length === 0 ? (
              <p className={styles.evidenceEmpty}>No evidence submitted yet.</p>
            ) : (
              <div className={styles.evidenceList}>
                {evidence.map((ev) => (
                  <div key={ev.id} className={styles.evidenceItem}>
                    <EvidenceIcon type={ev.type} />
                    <div className={styles.evidenceInfo}>
                      <p className={styles.evidenceDesc}>{ev.description}</p>
                      <p className={styles.evidenceMeta}>
                        {ev.type} · {formatDate(ev.createdAt)}
                      </p>
                    </div>
                    {ev.url && (
                      <a
                        href={ev.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.evidenceLink}
                      >
                        <ExternalLink size={13} strokeWidth={2} />
                        View
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Add evidence */}
            {canMessage && !showEvidenceUpload && (
              <button
                className={styles.addEvidenceBtn}
                onClick={() => setShowEvidenceUpload(true)}
              >
                <Upload size={13} strokeWidth={2} />
                Add Evidence
              </button>
            )}

            {showEvidenceUpload && (
              <EvidenceUploadForm
                disputeId={disputeId!}
                onSubmitted={() => setShowEvidenceUpload(false)}
                onCancel={() => setShowEvidenceUpload(false)}
              />
            )}
          </>
        )}
      </div>

      {/* Withdraw action */}
      {canWithdraw && (
        <Button
          variant="danger"
          size="sm"
          onClick={() => setShowWithdrawModal(true)}
          style={{ width: '100%' }}
        >
          Withdraw Dispute
        </Button>
      )}
    </div>
  );

  return (
    <div className={styles.page}>

      {/* Back nav */}
      <button className={styles.backBtn} onClick={() => navigate('/dashboard/settings/disputes')}>
        <ArrowLeft size={15} strokeWidth={2} />
        All Disputes
      </button>

      {/* Mobile tab toggle */}
      <div className={styles.mobileTabs}>
        <button
          className={[styles.mobileTab, mobileTab === 'discussion' ? styles.mobileTabActive : ''].join(' ')}
          onClick={() => setMobileTab('discussion')}
        >
          Discussion
        </button>
        <button
          className={[styles.mobileTab, mobileTab === 'details' ? styles.mobileTabActive : ''].join(' ')}
          onClick={() => setMobileTab('details')}
        >
          Details
        </button>
      </div>

      {/* Two-column layout */}
      <div className={styles.layout}>
        <div className={[styles.leftWrap, mobileTab === 'details' ? styles.mobileHidden : ''].join(' ')}>
          {LeftColumn}
        </div>
        <div className={[styles.rightWrap, mobileTab === 'discussion' ? styles.mobileHidden : ''].join(' ')}>
          {RightSidebar}
        </div>
      </div>

      {/* Withdraw modal */}
      {showWithdrawModal && (
        <WithdrawModal
          onConfirm={(reason) => withdrawMutation.mutate(reason)}
          onCancel={() => setShowWithdrawModal(false)}
          isPending={withdrawMutation.isPending}
        />
      )}
    </div>
  );
}
