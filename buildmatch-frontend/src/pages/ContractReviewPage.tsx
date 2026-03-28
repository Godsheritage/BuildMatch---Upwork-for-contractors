import React, { useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, CheckCircle2, Clock, FileText, AlertTriangle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { Button } from '../components/ui/Button';
import {
  getContractById, signContract, getContractPdfUrl,
  type Contract, type PaymentScheduleItem,
} from '../services/contract.service';
import { getOrCreateConversation } from '../services/message.service';
import styles from './ContractReviewPage.module.css';

// ── Confirm modal ─────────────────────────────────────────────────────────────

function ConfirmSignModal({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void;
  onCancel:  () => void;
  isPending: boolean;
}) {
  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <FileText size={18} className={styles.modalIcon} />
          <h3 className={styles.modalTitle}>Confirm Digital Signature</h3>
        </div>
        <p className={styles.modalBody}>
          By clicking <strong>Confirm & Sign</strong>, you are digitally signing this contract.
          Your name and timestamp will be permanently recorded.
        </p>
        <p className={styles.modalSub}>
          This action cannot be undone. Make sure you have read and understood all contract terms.
        </p>
        <div className={styles.modalActions}>
          <button className={styles.modalCancelBtn} onClick={onCancel} disabled={isPending} type="button">
            Cancel
          </button>
          <button className={styles.modalConfirmBtn} onClick={onConfirm} disabled={isPending} type="button">
            {isPending ? 'Signing…' : 'Confirm & Sign'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Section block ─────────────────────────────────────────────────────────────

function Section({
  title, children, accent,
}: {
  title: string; children: React.ReactNode; accent?: 'teal' | 'amber' | 'navy';
}) {
  return (
    <div className={`${styles.docSection} ${accent ? styles[`accent_${accent}`] : ''}`}>
      <h3 className={styles.docSectionTitle}>{title}</h3>
      <div className={styles.docSectionBody}>{children}</div>
    </div>
  );
}

// ── Payment schedule table ─────────────────────────────────────────────────────

function PaymentTable({ items }: { items: PaymentScheduleItem[] }) {
  return (
    <table className={styles.payTable}>
      <thead>
        <tr className={styles.payTableHead}>
          <th>Milestone</th>
          <th>Amount</th>
          <th>%</th>
          <th>Completion Criteria</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i} className={styles.payTableRow}>
            <td className={styles.payMilestone}>{item.milestoneName}</td>
            <td className={styles.payAmount}>${item.amount.toLocaleString()}</td>
            <td className={styles.payPct}>{item.percentage}%</td>
            <td className={styles.payDesc}>{item.description}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── Signature row ─────────────────────────────────────────────────────────────

function SigRow({ label, signedAt }: { label: string; signedAt: string | null }) {
  if (signedAt) {
    const dt = new Date(signedAt).toLocaleString([], {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
    return (
      <div className={styles.sigRow}>
        <CheckCircle2 size={14} className={styles.sigCheckIcon} strokeWidth={2.5} />
        <div>
          <span className={styles.sigLabel}>{label}</span>
          <span className={styles.sigDate}>{dt}</span>
        </div>
      </div>
    );
  }
  return (
    <div className={styles.sigRow}>
      <Clock size={14} className={styles.sigPendingIcon} strokeWidth={2} />
      <div>
        <span className={styles.sigLabel}>{label}</span>
        <span className={styles.sigPending}>Awaiting signature</span>
      </div>
    </div>
  );
}

// ── Signing panel ─────────────────────────────────────────────────────────────

function SigningPanel({
  contract,
  userId,
  onSigned,
}: {
  contract: Contract;
  userId:   string;
  onSigned: () => void;
}) {
  const [agreed,      setAgreed]      = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { toast }    = useToast();
  const navigate     = useNavigate();
  const qc           = useQueryClient();

  const isInvestor         = contract.investorId   === userId;
  const isContractor       = contract.contractorId === userId;
  const userSigned         = isInvestor   ? !!contract.investorSignedAt
                           : isContractor ? !!contract.contractorSignedAt
                           : false;
  const otherSigned        = isInvestor   ? !!contract.contractorSignedAt
                           : isContractor ? !!contract.investorSignedAt
                           : false;
  const bothSigned         = !!contract.investorSignedAt && !!contract.contractorSignedAt;
  const isActive           = contract.status === 'ACTIVE';

  const otherPartyLabel = isInvestor ? 'the contractor' : 'the investor';

  const sign = useMutation({
    mutationFn: () => signContract(contract.id),
    onSuccess: () => {
      toast('Contract signed successfully!');
      qc.invalidateQueries({ queryKey: ['contract', contract.id] });
      onSigned();
    },
    onError: (err: Error) => {
      toast(err.message || 'Failed to sign contract', 'error');
    },
  });

  const [openingMsg, setOpeningMsg] = useState(false);

  async function handleSendReminder() {
    // Navigate to conversation with the other party
    const otherUserId = isInvestor ? contract.contractorId : contract.investorId;
    setOpeningMsg(true);
    try {
      const conv = await getOrCreateConversation(contract.jobId, otherUserId);
      navigate(`/dashboard/messages/${conv.id}`);
    } catch {
      toast('Could not open conversation', 'error');
    } finally {
      setOpeningMsg(false);
    }
  }

  // Both signed — celebration state
  if (isActive || bothSigned) {
    return (
      <div className={styles.panelCard}>
        <div className={styles.activeState}>
          <CheckCircle2 size={32} className={styles.activeIcon} strokeWidth={2} />
          <h3 className={styles.activeTitle}>Contract Active</h3>
          <p className={styles.activeSub}>Both parties have signed this contract.</p>
        </div>
        <div className={styles.sigList}>
          <SigRow label="Investor"   signedAt={contract.investorSignedAt}   />
          <SigRow label="Contractor" signedAt={contract.contractorSignedAt} />
        </div>
        <Link to={`/jobs/${contract.jobId}`} className={styles.milestonesLink}>
          View Job &amp; Milestones →
        </Link>
      </div>
    );
  }

  // Current user signed, waiting on other
  if (userSigned && !otherSigned) {
    return (
      <div className={styles.panelCard}>
        <div className={styles.sigList}>
          <SigRow label="Investor"   signedAt={contract.investorSignedAt}   />
          <SigRow label="Contractor" signedAt={contract.contractorSignedAt} />
        </div>
        <div className={styles.signedState}>
          <CheckCircle2 size={16} className={styles.signedIcon} strokeWidth={2.5} />
          <span>You have signed</span>
        </div>
        <p className={styles.waitingText}>
          Waiting for {otherPartyLabel} to sign before this contract becomes active.
        </p>
        <button
          className={styles.reminderBtn}
          onClick={handleSendReminder}
          disabled={openingMsg}
          type="button"
        >
          {openingMsg ? 'Opening…' : `Send reminder to ${otherPartyLabel}`}
        </button>
      </div>
    );
  }

  // Current user has NOT signed yet
  return (
    <div className={styles.panelCard}>
      <div className={styles.sigList}>
        <SigRow label="Investor"   signedAt={contract.investorSignedAt}   />
        <SigRow label="Contractor" signedAt={contract.contractorSignedAt} />
      </div>

      <div className={styles.readCallout}>
        <AlertTriangle size={13} className={styles.readCalloutIcon} strokeWidth={2} />
        Please read the full contract before signing
      </div>

      <label className={styles.agreeLabel}>
        <input
          type="checkbox"
          className={styles.agreeCheckbox}
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
        />
        <span>I have read and agree to all terms in this contract</span>
      </label>

      <Button
        variant="primary"
        className={styles.signBtn}
        onClick={() => setShowConfirm(true)}
        disabled={!agreed}
      >
        Sign Contract
      </Button>

      {showConfirm && (
        <ConfirmSignModal
          onConfirm={() => { sign.mutate(); setShowConfirm(false); }}
          onCancel={() => setShowConfirm(false)}
          isPending={sign.isPending}
        />
      )}
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  const b = (w: number | string, h: number) => (
    <div
      className={styles.skeleton}
      style={{ width: w, height: h, borderRadius: 4 }}
    />
  );
  return (
    <div className={styles.wrap}>
      <div className={styles.docCol}>
        <div className={styles.docCard} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {b('60%', 30)}
          {b('30%', 18)}
          {b('100%', 80)}
          {b('100%', 60)}
          {b('100%', 120)}
        </div>
      </div>
      <div className={styles.panelCol}>
        <div className={styles.panelCard} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {b('70%', 20)}
          {b('100%', 50)}
          {b('100%', 44)}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ContractReviewPage() {
  const { contractId } = useParams<{ contractId: string }>();
  const { user }       = useAuth();
  const navigate       = useNavigate();
  const qc             = useQueryClient();

  const { data: contract, isLoading, isError } = useQuery({
    queryKey: ['contract', contractId],
    queryFn:  () => getContractById(contractId!),
    enabled:  !!contractId,
    staleTime: 30_000,
  });

  function handleSigned() {
    qc.invalidateQueries({ queryKey: ['contract', contractId] });
  }

  // Access guard — redirect if not a party
  const isParty = contract && user &&
    (contract.investorId === user.id || contract.contractorId === user.id);

  if (!isLoading && contract && !isParty) {
    navigate('/dashboard', { replace: true });
    return null;
  }

  const paymentItems: PaymentScheduleItem[] = Array.isArray(contract?.paymentSchedule)
    ? (contract.paymentSchedule as PaymentScheduleItem[])
    : [];

  const statusLabel = contract?.status === 'PENDING_SIGNATURES' ? 'Pending Signatures'
                    : contract?.status === 'ACTIVE'             ? 'Active'
                    : contract?.status === 'COMPLETED'          ? 'Completed'
                    : contract?.status === 'VOIDED'             ? 'Voided'
                    : 'Draft';

  const statusStyle: React.CSSProperties =
    contract?.status === 'ACTIVE'    ? { background: '#DCFCE7', color: '#166534' }
  : contract?.status === 'COMPLETED' ? { background: '#F3F4F6', color: '#374151' }
  : contract?.status === 'VOIDED'    ? { background: '#FEE2E2', color: '#991B1B' }
  : { background: '#FEF9C3', color: '#854D0E' };

  return (
    <div className={styles.page}>
      {/* Navbar */}
      <nav className={styles.nav}>
        <Link to="/" className={styles.navWordmark}>BuildMatch</Link>
        {contract && (
          <Link to={`/jobs/${contract.jobId}`} className={styles.navBack}>
            <ArrowLeft size={14} strokeWidth={2} /> Back to job
          </Link>
        )}
      </nav>

      {isLoading && <Skeleton />}

      {isError && (
        <div className={styles.errorState}>
          <p className={styles.errorTitle}>Contract not found</p>
          <p className={styles.errorSub}>This contract may not exist or you don't have access.</p>
          <Link to="/dashboard"><Button variant="secondary" size="sm">← Back to dashboard</Button></Link>
        </div>
      )}

      {contract && (
        <div className={styles.wrap}>

          {/* ── Contract document (left) ─────────────────── */}
          <div className={styles.docCol}>
            <div className={styles.docCard}>

              {/* Title block */}
              <div className={styles.docTitleBlock}>
                <div className={styles.docTitleRow}>
                  <h1 className={styles.docTitle}>{contract.title}</h1>
                  <span className={styles.statusBadge} style={statusStyle}>{statusLabel}</span>
                </div>
                {contract.aiGenerated && (
                  <div className={styles.aiBadge}>
                    ✦ AI-Generated · Review carefully
                  </div>
                )}
                <p className={styles.docMeta}>
                  Generated {new Date(contract.createdAt).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })}
                </p>
              </div>

              {/* Scope of work */}
              <Section title="Scope of Work" accent="teal">
                {contract.scopeOfWork.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className={styles.docPara}>{line}</p>
                ))}
              </Section>

              {/* Exclusions */}
              {contract.exclusions && (
                <Section title="Exclusions" accent="amber">
                  {contract.exclusions.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} className={styles.docPara}>{line}</p>
                  ))}
                </Section>
              )}

              {/* Responsibilities */}
              {contract.investorResponsibilities && (
                <Section title="Investor Responsibilities">
                  {contract.investorResponsibilities.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} className={styles.docPara}>{line}</p>
                  ))}
                </Section>
              )}
              {contract.contractorResponsibilities && (
                <Section title="Contractor Responsibilities">
                  {contract.contractorResponsibilities.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} className={styles.docPara}>{line}</p>
                  ))}
                </Section>
              )}

              {/* Timeline */}
              {(contract.timelineEstimate || contract.timelineOverageClause) && (
                <Section title="Timeline">
                  {contract.timelineEstimate && (
                    <><p className={styles.docSubLabel}>Estimate</p><p className={styles.docPara}>{contract.timelineEstimate}</p></>
                  )}
                  {contract.timelineOverageClause && (
                    <><p className={styles.docSubLabel}>Delay Policy</p><p className={styles.docPara}>{contract.timelineOverageClause}</p></>
                  )}
                </Section>
              )}

              {/* Dispute resolution */}
              {contract.disputeResolutionProcess && (
                <Section title="Dispute Resolution">
                  {contract.disputeResolutionProcess.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} className={styles.docPara}>{line}</p>
                  ))}
                </Section>
              )}

              {/* Payment schedule */}
              {paymentItems.length > 0 && (
                <Section title="Payment Schedule" accent="navy">
                  <PaymentTable items={paymentItems} />
                </Section>
              )}

              {/* Disclaimer */}
              <p className={styles.disclaimer}>
                This contract was generated with AI assistance by BuildMatch.
                Both parties should review all terms carefully before signing.
                BuildMatch is not a law firm and this document does not constitute legal advice.
              </p>

              {/* Download */}
              <div className={styles.downloadRow}>
                <a
                  href={getContractPdfUrl(contract.id)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.downloadBtn}
                  download
                >
                  <Download size={13} strokeWidth={2} />
                  Download PDF
                </a>
              </div>

            </div>
          </div>

          {/* ── Signing panel (right, sticky) ─────────────── */}
          <aside className={styles.panelCol}>
            {user && (
              <SigningPanel
                contract={contract}
                userId={user.id}
                onSigned={handleSigned}
              />
            )}
          </aside>

        </div>
      )}
    </div>
  );
}
