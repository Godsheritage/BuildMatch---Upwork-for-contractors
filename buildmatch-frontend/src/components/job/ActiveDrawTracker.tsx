import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, X, Download } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useDisputeEvidenceUpload } from '../../hooks/useDisputeEvidenceUpload';
import { getOrCreateConversation } from '../../services/message.service';
import { Lightbox } from '../ui/Lightbox';
import api from '../../services/api';
import styles from './ActiveDrawTracker.module.css';

// ── Types ──────────────────────────────────────────────────────────────────────

interface DrawEvidenceItem {
  id:      string;
  url:     string;
  caption: string | null;
}

interface DrawRequestData {
  id:           string;
  status:       'PENDING' | 'APPROVED' | 'REJECTED' | 'DISPUTED';
  note:         string | null;
  amount:       number;
  contractorId: string;
  createdAt:    string;
  disputeId:    string | null;
  contractor?:  { id: string; firstName: string; lastName: string };
  evidence:     DrawEvidenceItem[];
}

interface DrawMilestoneData {
  id:                 string;
  drawNumber:         number;
  title:              string;
  completionCriteria: string;
  percentage:         number;
  amount:             number;
  status:             'PENDING' | 'REQUESTED' | 'APPROVED' | 'RELEASED' | 'DISPUTED';
  requestedAt:        string | null;
  releasedAt:         string | null;
  drawRequests:       DrawRequestData[];
}

interface DrawScheduleData {
  id:          string;
  totalAmount: number;
  milestones:  DrawMilestoneData[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function splitCriteria(raw: string): string[] {
  return raw.split(/\n|;/).map((s) => s.trim()).filter(Boolean);
}

function getNextDrawId(milestones: DrawMilestoneData[]): string | null {
  const sorted = [...milestones].sort((a, b) => a.drawNumber - b.drawNumber);
  for (const m of sorted) {
    if (m.status !== 'PENDING') continue;
    if (m.drawNumber === 1) return m.id;
    const prev = sorted.find((p) => p.drawNumber === m.drawNumber - 1);
    if (prev?.status === 'RELEASED' || prev?.status === 'APPROVED') return m.id;
    return null; // blocked by unreleased prior draw
  }
  return null;
}

// ── StatusBadge ────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING:   'Not started',
  REQUESTED: 'Under Review',
  APPROVED:  'Released',
  RELEASED:  'Released',
  DISPUTED:  'Disputed',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`${styles.statusBadge} ${styles[`badge_${status}`] ?? ''}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ── RequestDrawModal ───────────────────────────────────────────────────────────

interface RequestDrawModalProps {
  milestone: DrawMilestoneData;
  jobId:     string;
  onClose:   () => void;
  onSuccess: () => void;
}

function RequestDrawModal({ milestone, jobId, onClose, onSuccess }: RequestDrawModalProps) {
  const { toast } = useToast();
  const { uploadEvidence, isUploading } = useDisputeEvidenceUpload();

  const criteria = splitCriteria(milestone.completionCriteria);
  const [criteriaChecked, setCriteriaChecked]   = useState<boolean[]>(criteria.map(() => false));
  const [pendingEvidence, setPendingEvidence]   = useState<{ url: string; caption: string; uploading: boolean }[]>([]);
  const [note, setNote]                         = useState('');
  const [isSubmitting, setIsSubmitting]         = useState(false);
  const fileInputRef                            = useRef<HTMLInputElement>(null);

  const allCriteriaChecked = criteriaChecked.every(Boolean);
  const uploadedPhotos     = pendingEvidence.filter((e) => !e.uploading && e.url);
  const anyUploading       = pendingEvidence.some((e) => e.uploading);
  const canSubmit          = allCriteriaChecked && uploadedPhotos.length >= 1 && !isSubmitting && !anyUploading;

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const idx = pendingEvidence.length;
    setPendingEvidence((prev) => [...prev, { url: '', caption: '', uploading: true }]);

    try {
      const url = await uploadEvidence(file, milestone.id);
      setPendingEvidence((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, url, uploading: false } : item)),
      );
    } catch (err) {
      setPendingEvidence((prev) => prev.filter((_, i) => i !== idx));
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await api.post(`/jobs/${jobId}/draws/milestones/${milestone.id}/request`, {
        note:             note.trim() || undefined,
        evidenceUrls:     uploadedPhotos.map((e) => e.url),
        evidenceCaptions: uploadedPhotos.map((e) => e.caption),
      });
      onSuccess();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to submit draw request', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Request Draw {milestone.drawNumber}: {milestone.title}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Amount */}
        <p className={styles.modalAmountTeal}>${milestone.amount.toLocaleString()}</p>

        {/* Completion criteria checklist */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Completion Criteria</p>
          {criteria.map((criterion, i) => (
            <label key={i} className={styles.checkItem}>
              <input
                type="checkbox"
                checked={criteriaChecked[i]}
                onChange={() =>
                  setCriteriaChecked((prev) => prev.map((v, j) => (j === i ? !v : v)))
                }
              />
              <span>{criterion}</span>
            </label>
          ))}
          {!allCriteriaChecked && (
            <p className={styles.fieldHint} style={{ marginTop: 6 }}>
              Check each box to confirm you have completed all criteria before submitting.
            </p>
          )}
        </div>

        {/* Evidence upload */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>
            Upload Proof of Completion{' '}
            <span className={styles.required}>(required)</span>
          </p>

          <div className={styles.evidenceGrid}>
            {pendingEvidence.map((item, i) => (
              <div key={i} className={styles.evidenceUploadItem}>
                {item.uploading ? (
                  <div className={styles.uploadingThumb}>
                    <span className={styles.spinner} />
                  </div>
                ) : (
                  <img
                    src={item.url}
                    alt="evidence"
                    className={styles.evidenceThumbLg}
                  />
                )}
                {!item.uploading && (
                  <input
                    className={styles.captionInput}
                    placeholder="What does this photo show?"
                    value={item.caption}
                    maxLength={200}
                    onChange={(e) =>
                      setPendingEvidence((prev) =>
                        prev.map((p, j) =>
                          j === i ? { ...p, caption: e.target.value } : p,
                        ),
                      )
                    }
                  />
                )}
              </div>
            ))}

            {pendingEvidence.length < 10 && (
              <button
                className={styles.addPhotoBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading || anyUploading}
                type="button"
              >
                + Add Photo
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            hidden
            onChange={handleFileSelect}
          />

          {uploadedPhotos.length === 0 && (
            <p className={styles.fieldHint}>At least 1 photo required</p>
          )}
        </div>

        {/* Note to investor */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>
            Note to Investor{' '}
            <span className={styles.optional}>(optional)</span>
          </p>
          <textarea
            className={styles.noteTextarea}
            placeholder="Add a note to the investor (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
          />
        </div>

        <button className={styles.submitBtn} onClick={handleSubmit} disabled={!canSubmit}>
          {isSubmitting ? 'Submitting...' : 'Submit Draw Request'}
        </button>
      </div>
    </div>
  );
}

// ── ReviewDrawModal ────────────────────────────────────────────────────────────

interface ReviewDrawModalProps {
  milestone: DrawMilestoneData;
  request:   DrawRequestData;
  jobId:     string;
  onClose:   () => void;
  onSuccess: (type: 'approve' | 'dispute') => void;
}

function ReviewDrawModal({ milestone, request, jobId, onClose, onSuccess }: ReviewDrawModalProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const criteria                              = splitCriteria(milestone.completionCriteria);
  const [criteriaVerified, setCriteriaVerified] = useState<boolean[]>(criteria.map(() => false));
  const [lightboxIndex, setLightboxIndex]     = useState<number | null>(null);
  const [confirmApprove, setConfirmApprove]   = useState(false);
  const [isApproving, setIsApproving]         = useState(false);
  const [disputeFormOpen, setDisputeFormOpen] = useState(false);
  const [disputeDesc, setDisputeDesc]         = useState('');
  const [disputeOutcome, setDisputeOutcome]   = useState('');
  const [isDisputing, setIsDisputing]         = useState(false);

  const contractorName = request.contractor
    ? `${request.contractor.firstName} ${request.contractor.lastName}`
    : 'Contractor';

  async function handleApprove() {
    setIsApproving(true);
    try {
      await api.post(`/jobs/${jobId}/draws/requests/${request.id}/approve`);
      onSuccess('approve');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to approve', 'error');
      setConfirmApprove(false);
    } finally {
      setIsApproving(false);
    }
  }

  async function handleDispute() {
    if (disputeDesc.trim().length < 20) {
      toast('Description must be at least 20 characters', 'error');
      return;
    }
    if (disputeOutcome.trim().length < 10) {
      toast('Please describe the desired outcome (min 10 characters)', 'error');
      return;
    }
    setIsDisputing(true);
    try {
      await api.post(`/jobs/${jobId}/draws/requests/${request.id}/dispute`, {
        category:       'INCOMPLETE_WORK',
        description:    disputeDesc.trim(),
        desiredOutcome: disputeOutcome.trim(),
      });
      onSuccess('dispute');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to file dispute', 'error');
    } finally {
      setIsDisputing(false);
    }
  }

  async function handleMessage() {
    try {
      const conv = await getOrCreateConversation(jobId, request.contractorId);
      navigate(`/dashboard/messages/${conv.id}`);
    } catch {
      toast('Could not open conversation. Please try again.', 'error');
    }
  }

  function downloadAll() {
    request.evidence.forEach((e) => {
      const a = document.createElement('a');
      a.href     = e.url;
      a.target   = '_blank';
      a.rel      = 'noopener noreferrer';
      a.download = `evidence-${e.id}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  const showActions = !confirmApprove && !disputeFormOpen;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={styles.modal}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            Review Draw {milestone.drawNumber}: {milestone.title}
          </h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Amount + submitted by */}
        <p className={styles.modalAmountNavy}>${milestone.amount.toLocaleString()}</p>
        <p className={styles.modalSub}>
          Requested by {contractorName} on {fmtDate(request.createdAt)}
        </p>

        {/* Completion criteria verification */}
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Completion Criteria</p>
          {criteria.map((criterion, i) => (
            <div key={i} className={styles.verifyRow}>
              <span className={styles.criterionText}>{criterion}</span>
              <div className={styles.verifyBtns}>
                <button
                  className={`${styles.verifyBtn} ${criteriaVerified[i] ? styles.verifyBtnActive : ''}`}
                  onClick={() =>
                    setCriteriaVerified((prev) => prev.map((v, j) => (j === i ? true : v)))
                  }
                >
                  ✓ Verified
                </button>
                <button
                  className={`${styles.verifyBtn} ${!criteriaVerified[i] ? styles.unverifyBtnActive : ''}`}
                  onClick={() =>
                    setCriteriaVerified((prev) => prev.map((v, j) => (j === i ? false : v)))
                  }
                >
                  ✗ Not Verified
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Evidence gallery */}
        {request.evidence.length > 0 && (
          <div className={styles.section}>
            <div className={styles.sectionLabelRow}>
              <p className={styles.sectionLabel} style={{ marginBottom: 0 }}>Evidence</p>
              <button className={styles.downloadAllBtn} onClick={downloadAll}>
                <Download size={12} />
                Download All
              </button>
            </div>
            <div className={styles.evidenceGallery} style={{ marginTop: 8 }}>
              {request.evidence.map((e, i) => (
                <div
                  key={e.id}
                  className={styles.galleryItem}
                  onClick={() => setLightboxIndex(i)}
                >
                  <img src={e.url} alt={e.caption ?? `evidence ${i + 1}`} />
                  {e.caption && (
                    <p className={styles.evidenceCaption}>{e.caption}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contractor note */}
        {request.note && (
          <div className={styles.contractorNote}>
            <p className={styles.noteLabel}>Note from Contractor</p>
            <p className={styles.noteText}>{request.note}</p>
          </div>
        )}

        {/* Action buttons */}
        {showActions && (
          <div className={styles.actionRow}>
            <button className={styles.approveBtn} onClick={() => setConfirmApprove(true)}>
              Approve &amp; Release ${milestone.amount.toLocaleString()}
            </button>
            <button className={styles.messageLink} onClick={handleMessage}>
              Message Contractor
            </button>
            <button className={styles.disputeBtn} onClick={() => setDisputeFormOpen(true)}>
              Dispute This Draw
            </button>
          </div>
        )}

        {/* Confirm approve */}
        {confirmApprove && (
          <div className={styles.confirmBox}>
            <p className={styles.confirmTitle}>
              Release ${milestone.amount.toLocaleString()} to {contractorName}?
            </p>
            <p className={styles.confirmDesc}>
              This action cannot be undone. Funds will be transferred to the
              contractor&apos;s payout account.
            </p>
            <div className={styles.confirmBtns}>
              <button className={styles.cancelBtn} onClick={() => setConfirmApprove(false)}>
                Cancel
              </button>
              <button
                className={styles.confirmApproveBtn}
                onClick={handleApprove}
                disabled={isApproving}
              >
                {isApproving ? 'Releasing...' : 'Yes, Release'}
              </button>
            </div>
          </div>
        )}

        {/* Dispute form */}
        {disputeFormOpen && (
          <div className={styles.disputeForm}>
            <p className={styles.sectionLabel}>Describe the issue</p>
            <textarea
              className={styles.noteTextarea}
              placeholder="Describe what was not completed or not done correctly"
              value={disputeDesc}
              onChange={(e) => setDisputeDesc(e.target.value)}
              rows={4}
              maxLength={2000}
            />
            <p className={styles.charCount}>{disputeDesc.length}/2000 · min 20 chars</p>

            <p className={styles.sectionLabel} style={{ marginTop: 'var(--space-3)' }}>
              Desired outcome
            </p>
            <input
              className={styles.outcomeInput}
              placeholder="What resolution are you looking for?"
              value={disputeOutcome}
              onChange={(e) => setDisputeOutcome(e.target.value)}
              maxLength={500}
            />

            <div className={styles.disputeFormBtns}>
              <button className={styles.cancelBtn} onClick={() => setDisputeFormOpen(false)}>
                Back
              </button>
              <button
                className={styles.fileDisputeBtn}
                onClick={handleDispute}
                disabled={
                  isDisputing ||
                  disputeDesc.trim().length < 20 ||
                  disputeOutcome.trim().length < 10
                }
              >
                {isDisputing ? 'Filing...' : 'File Dispute'}
              </button>
            </div>
          </div>
        )}

        {/* Full-screen photo lightbox */}
        {lightboxIndex !== null && (
          <Lightbox
            images={request.evidence.map((e) => e.url)}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </div>
    </div>
  );
}

// ── MilestoneCard ──────────────────────────────────────────────────────────────

interface MilestoneCardProps {
  milestone:      DrawMilestoneData;
  isNextDraw:     boolean;
  userRole:       'INVESTOR' | 'CONTRACTOR';
  onRequestDraw:  () => void;
  onReviewRequest: () => void;
}

function MilestoneCard({
  milestone,
  isNextDraw,
  userRole,
  onRequestDraw,
  onReviewRequest,
}: MilestoneCardProps) {
  const latestRequest = milestone.drawRequests[0] ?? null;
  const status        = milestone.status;

  return (
    <div className={`${styles.milestoneCard} ${styles[`card_${status}`] ?? ''}`}>
      {/* Left: draw number circle */}
      <div>
        <div className={`${styles.drawCircle} ${styles[`circle_${status}`] ?? ''}`}>
          {status === 'RELEASED' || status === 'APPROVED' ? (
            <CheckCircle2 size={13} strokeWidth={2.5} />
          ) : (
            milestone.drawNumber
          )}
        </div>
      </div>

      {/* Right: card body */}
      <div className={styles.cardBody}>
        <div className={styles.cardHeader}>
          <div className={styles.cardMeta}>
            <p className={styles.drawNumLabel}>Draw {milestone.drawNumber}</p>
            <p className={`${styles.drawTitle} ${styles[`drawTitle_${status}`] ?? ''}`}>
              {milestone.title}
            </p>
          </div>
          <div className={styles.cardRight}>
            <p className={`${styles.drawAmount} ${styles[`drawAmount_${status}`] ?? ''}`}>
              ${milestone.amount.toLocaleString()}
            </p>
            <StatusBadge status={status} />
          </div>
        </div>

        {/* REQUESTED — evidence thumbnails + action */}
        {status === 'REQUESTED' && latestRequest && (
          <>
            {latestRequest.evidence.length > 0 && (
              <div className={styles.evidenceStrip}>
                {latestRequest.evidence.slice(0, 5).map((e) => (
                  <img
                    key={e.id}
                    src={e.url}
                    alt={e.caption ?? 'evidence'}
                    className={styles.evidenceThumbSm}
                  />
                ))}
              </div>
            )}
            {userRole === 'INVESTOR' ? (
              <button className={styles.reviewBtn} onClick={onReviewRequest}>
                Review Request
              </button>
            ) : (
              <p className={styles.awaitingText}>Awaiting approval</p>
            )}
          </>
        )}

        {/* RELEASED / APPROVED — release date */}
        {(status === 'RELEASED' || status === 'APPROVED') && milestone.releasedAt && (
          <p className={styles.releaseDate}>
            Released on {fmtDate(milestone.releasedAt)}
          </p>
        )}

        {/* DISPUTED — view dispute link */}
        {status === 'DISPUTED' && latestRequest?.disputeId && (
          <Link
            to={`/settings/disputes/${latestRequest.disputeId}`}
            className={styles.disputeLink}
          >
            View Dispute →
          </Link>
        )}

        {/* PENDING — request button or upcoming label */}
        {status === 'PENDING' && userRole === 'CONTRACTOR' && (
          isNextDraw ? (
            <button className={styles.requestBtn} onClick={onRequestDraw}>
              Request This Draw
            </button>
          ) : (
            <span className={styles.upcomingLabel}>Upcoming</span>
          )
        )}
      </div>
    </div>
  );
}

// ── ActiveDrawTracker ──────────────────────────────────────────────────────────

export function ActiveDrawTracker({
  jobId,
  userRole,
}: {
  jobId:    string;
  userRole: 'INVESTOR' | 'CONTRACTOR';
}) {
  const qc          = useQueryClient();
  const { toast }   = useToast();

  const [requestingMilestone, setRequestingMilestone] = useState<DrawMilestoneData | null>(null);
  const [reviewingMilestone, setReviewingMilestone]   = useState<DrawMilestoneData | null>(null);

  const { data: schedule, isLoading } = useQuery<DrawScheduleData | null>({
    queryKey:       ['draw-schedule', jobId],
    queryFn:        () =>
      api
        .get<{ data: { schedule: DrawScheduleData | null } }>(`/jobs/${jobId}/draws`)
        .then((r) => r.data.data.schedule),
    refetchInterval: 30_000,
    staleTime:       15_000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className={styles.skeleton} style={{ height: 60, borderRadius: 8 }} />
        {[1, 2, 3].map((i) => (
          <div key={i} className={styles.skeleton} style={{ height: 80, borderRadius: 10 }} />
        ))}
      </div>
    );
  }

  if (!schedule) return null;

  const milestones     = [...schedule.milestones].sort((a, b) => a.drawNumber - b.drawNumber);
  const releasedAmount = milestones
    .filter((m) => m.status === 'RELEASED' || m.status === 'APPROVED')
    .reduce((s, m) => s + m.amount, 0);
  const progressPct    = schedule.totalAmount > 0
    ? Math.round((releasedAmount / schedule.totalAmount) * 100)
    : 0;
  const releasedCount  = milestones.filter(
    (m) => m.status === 'RELEASED' || m.status === 'APPROVED',
  ).length;
  const nextDrawId     = userRole === 'CONTRACTOR' ? getNextDrawId(milestones) : null;

  const reviewingRequest = reviewingMilestone?.drawRequests[0] ?? null;

  return (
    <div className={styles.tracker}>
      {/* ── Overall progress bar ── */}
      <div className={styles.progressSection}>
        <div className={styles.progressLabelRow}>
          <span className={styles.progressLabel}>Payment Progress</span>
          <span className={styles.progressLabel}>{progressPct}%</span>
        </div>
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
        </div>
        <p className={styles.progressSub}>
          ${releasedAmount.toLocaleString()} released of ${schedule.totalAmount.toLocaleString()}
          &nbsp;·&nbsp;
          {releasedCount} of {milestones.length} draws complete
        </p>
      </div>

      {/* ── Milestone cards ── */}
      <div className={styles.milestoneList}>
        {milestones.map((m) => (
          <MilestoneCard
            key={m.id}
            milestone={m}
            isNextDraw={m.id === nextDrawId}
            userRole={userRole}
            onRequestDraw={() => setRequestingMilestone(m)}
            onReviewRequest={() => setReviewingMilestone(m)}
          />
        ))}
      </div>

      {/* ── Request Draw modal (contractor) ── */}
      {requestingMilestone && (
        <RequestDrawModal
          milestone={requestingMilestone}
          jobId={jobId}
          onClose={() => setRequestingMilestone(null)}
          onSuccess={() => {
            setRequestingMilestone(null);
            toast('Draw request submitted. The investor has been notified.');
            qc.invalidateQueries({ queryKey: ['draw-schedule', jobId] });
          }}
        />
      )}

      {/* ── Review Draw modal (investor) ── */}
      {reviewingMilestone && reviewingRequest && (
        <ReviewDrawModal
          milestone={reviewingMilestone}
          request={reviewingRequest}
          jobId={jobId}
          onClose={() => setReviewingMilestone(null)}
          onSuccess={(type) => {
            setReviewingMilestone(null);
            if (type === 'approve') {
              toast(`$${reviewingMilestone.amount.toLocaleString()} released to contractor.`);
            } else {
              toast('Dispute filed. You can track it in the Dispute Centre.');
            }
            qc.invalidateQueries({ queryKey: ['draw-schedule', jobId] });
          }}
        />
      )}
    </div>
  );
}
