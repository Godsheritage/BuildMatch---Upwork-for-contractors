import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Star, Shield, AlertTriangle, MessageCircle, Briefcase,
  DollarSign, Eye,
} from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { ConfirmModal } from '../../components/admin/shared/ConfirmModal';
import { Button } from '../../components/ui';
import {
  useAdminUserFull,
  useSuspendUser, useUnsuspendUser, useBanUserPost,
  useVerifyContractorUser, useSendAdminMessage,
} from '../../hooks/useAdmin';
import type { AdminUserFullProfile } from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s from './AdminUserDetailPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
  return `$${n.toFixed(0)}`;
}

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60)      return 'just now';
  if (sec < 3600)    return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400)   return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

function roleBadge(role: string) {
  const cls = role === 'INVESTOR' ? sh.badgeInvestor : role === 'CONTRACTOR' ? sh.badgeContractor : sh.badgeAdmin;
  return <span className={`${sh.badge} ${cls}`}>{role}</span>;
}

function statusBadge(u: Pick<AdminUserFullProfile, 'isActive' | 'isBanned'>) {
  if (u.isBanned)  return <span className={`${sh.badge} ${sh.badgeBanned}`}>Banned</span>;
  if (!u.isActive) return <span className={`${sh.badge} ${sh.badgeInProgress}`}>Suspended</span>;
  return <span className={`${sh.badge} ${sh.badgeActive}`}>Active</span>;
}

function jobStatusCls(status: string) {
  const map: Record<string, string> = {
    OPEN: sh.badgeOpen, AWARDED: sh.badgeAwarded, IN_PROGRESS: sh.badgeInProgress,
    COMPLETED: sh.badgeCompleted, CANCELLED: sh.badgeCancelled,
  };
  return map[status] ?? sh.badgeActive;
}

function bidStatusCls(status: string) {
  const map: Record<string, string> = {
    PENDING: sh.badgeInProgress, ACCEPTED: sh.badgeActive,
    REJECTED: sh.badgeBanned, WITHDRAWN: sh.badgeWithdrawn,
  };
  return map[status] ?? sh.badge;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className={s.twoCol}>
      <div className={s.sidebar}>
        <div className={s.profileCard}>
          <div className={s.avatarLgSkel} />
          <div style={{ height: 16, width: 120, background: '#EFEFED', borderRadius: 4, margin: '12px auto 6px', animation: 'pulse 1.6s infinite' }} />
          <div style={{ height: 12, width: 160, background: '#EFEFED', borderRadius: 4, margin: '0 auto', animation: 'pulse 1.6s infinite' }} />
        </div>
      </div>
      <div className={s.main}>
        <div className={s.tabs}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ width: 70, height: 28, background: '#EFEFED', borderRadius: 6, animation: 'pulse 1.6s infinite' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Modals (inline) ───────────────────────────────────────────────────────────

function SuspendModal({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [days,   setDays]   = useState('');
  const { mutate, isPending } = useSuspendUser();

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Suspend {name}</h3>
        <p className={sh.modalBody}>Leave duration blank for indefinite suspension.</p>
        <textarea className={sh.modalNote} placeholder="Reason (required)…" value={reason}
          onChange={e => setReason(e.target.value)} autoFocus />
        <input type="number" className={sh.modalSelect} placeholder="Duration in days (blank = indefinite)"
          value={days} onChange={e => setDays(e.target.value)} min={1} />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
            disabled={isPending || !reason.trim()}
            onClick={() => mutate({ id: userId, reason, durationDays: days ? parseInt(days, 10) : null }, { onSuccess: onClose })}>
            {isPending ? 'Suspending…' : 'Suspend'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageModal({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const { mutate, isPending } = useSendAdminMessage();

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Message {name}</h3>
        <input className={sh.modalSelect} placeholder="Subject…" value={subject}
          onChange={e => setSubject(e.target.value)} autoFocus />
        <textarea className={sh.modalNote} placeholder="Message…" value={content}
          onChange={e => setContent(e.target.value)} style={{ minHeight: 120 }} />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
            disabled={isPending || !subject.trim() || !content.trim()}
            onClick={() => mutate({ id: userId, subject, content }, { onSuccess: onClose })}>
            {isPending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Tab: Activity ─────────────────────────────────────────────────────────────

function ActivityTab({ data }: { data: AdminUserFullProfile }) {
  type Event = { label: string; sub: string; icon: string; date: string };

  const events: Event[] = [
    ...data.jobs.map(j => ({
      label: `Posted job: ${j.title}`,
      sub:   j.status,
      icon:  'job',
      date:  j.createdAt,
    })),
    ...data.bids.map(b => ({
      label: `Bid on: ${b.jobTitle}`,
      sub:   `$${b.amount.toLocaleString()} — ${b.status}`,
      icon:  'bid',
      date:  b.createdAt,
    })),
    ...data.reviews.map(r => ({
      label: `Review (${r.reviewerRole === data.role ? 'given' : 'received'}): ${r.title}`,
      sub:   `${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}`,
      icon:  'review',
      date:  r.createdAt,
    })),
    ...data.disputes.map(d => ({
      label: `Dispute — ${d.category}`,
      sub:   d.status,
      icon:  'dispute',
      date:  d.createdAt,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (!events.length) return <p className={s.emptyTab}>No activity recorded.</p>;

  const iconMap: Record<string, string> = {
    job: s.iconNavy, bid: s.iconTeal, review: s.iconStar, dispute: s.iconRed,
  };

  return (
    <div className={s.timeline}>
      {events.map((ev, i) => (
        <div key={i} className={s.timelineItem}>
          <div className={`${s.timelineIcon} ${iconMap[ev.icon] ?? s.iconNavy}`} />
          <div className={s.timelineBody}>
            <div className={s.timelineLabel}>{ev.label}</div>
            <div className={s.timelineSub}>{ev.sub}</div>
          </div>
          <div className={s.timelineTime}>{timeAgo(ev.date)}</div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Jobs ─────────────────────────────────────────────────────────────────

function JobsTab({ data }: { data: AdminUserFullProfile }) {
  const isInvestor = data.role === 'INVESTOR';

  if (isInvestor) {
    if (!data.jobs.length) return <p className={s.emptyTab}>No jobs posted.</p>;
    return (
      <div className={s.itemList}>
        {data.jobs.map(j => (
          <div key={j.id} className={s.listItem}>
            <div className={s.listItemMain}>
              <Link to={`/admin/jobs/${j.id}`} className={s.itemLink}>{j.title}</Link>
              <span className={s.itemMeta}>{fmtDate(j.createdAt)}</span>
            </div>
            <div className={s.listItemRight}>
              <span className={s.itemMeta}>{fmtMoney(j.budgetMin)}–{fmtMoney(j.budgetMax)}</span>
              <span className={`${sh.badge} ${jobStatusCls(j.status)}`}>{j.status}</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Contractor — show bids
  if (!data.bids.length) return <p className={s.emptyTab}>No bids submitted.</p>;
  return (
    <div className={s.itemList}>
      {data.bids.map(b => (
        <div key={b.id} className={s.listItem}>
          <div className={s.listItemMain}>
            <Link to={`/admin/jobs/${b.jobId}`} className={s.itemLink}>{b.jobTitle}</Link>
            <span className={s.itemMeta}>{fmtDate(b.createdAt)}</span>
          </div>
          <div className={s.listItemRight}>
            <span className={s.itemMeta}>{fmtMoney(b.amount)}</span>
            <span className={`${sh.badge} ${bidStatusCls(b.status)}`}>{b.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Messages ─────────────────────────────────────────────────────────────

function MessagesTab({ data }: { data: AdminUserFullProfile }) {
  if (!data.recentMessages.length) return <p className={s.emptyTab}>No messages on record.</p>;

  return (
    <div className={s.itemList}>
      {data.recentMessages.map(m => (
        <div key={m.id} className={s.listItem}>
          <div className={s.listItemMain}>
            <span className={s.itemLabel}>Conversation</span>
            {m.isFiltered && <span className={`${sh.badge} ${sh.badgeInProgress}`} style={{ fontSize: 10 }}>Filtered</span>}
          </div>
          <div className={s.listItemRight}>
            <span className={s.itemMeta}>{timeAgo(m.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Reviews ─────────────────────────────────────────────────────────────

function ReviewsTab({ data }: { data: AdminUserFullProfile }) {
  if (!data.reviews.length) return <p className={s.emptyTab}>No reviews.</p>;

  return (
    <div className={s.reviewList}>
      {data.reviews.map(r => (
        <div key={r.id} className={s.reviewCard}>
          <div className={s.reviewHeader}>
            <div className={s.reviewStars}>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} size={13} fill={i < r.rating ? 'var(--color-star)' : 'none'}
                  stroke={i < r.rating ? 'var(--color-star)' : 'var(--color-border)'} />
              ))}
            </div>
            <span className={s.itemMeta}>{fmtDate(r.createdAt)}</span>
          </div>
          <div className={s.reviewTitle}>{r.title}</div>
          <p className={s.reviewBody}>{r.body}</p>
          <span className={`${sh.badge} ${sh.badgeInvestor}`} style={{ fontSize: 10 }}>
            {r.reviewerRole === data.role ? 'Written by user' : 'Written about user'}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Tab: Audit ────────────────────────────────────────────────────────────────

function AuditTab({ data }: { data: AdminUserFullProfile }) {
  if (!data.accountStatusHistory.length) return <p className={s.emptyTab}>No admin actions on this account.</p>;

  return (
    <div className={s.itemList}>
      {data.accountStatusHistory.map((h, i) => (
        <div key={i} className={s.listItem}>
          <div className={s.listItemMain}>
            <span className={`${sh.badge} ${sh.badgeAdmin}`} style={{ fontSize: 10 }}>{h.action}</span>
            {h.note && <span className={s.itemMeta} style={{ fontStyle: 'italic' }}>{h.note}</span>}
          </div>
          <div className={s.listItemRight}>
            <span className={s.itemMeta}>{fmtDate(h.createdAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Tab = 'activity' | 'jobs' | 'messages' | 'reviews' | 'audit';

export function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { data, isLoading } = useAdminUserFull(userId ?? null);

  const [activeTab,   setActiveTab]   = useState<Tab>('activity');
  const [showSuspend, setShowSuspend] = useState(false);
  const [showMessage, setShowMessage] = useState(false);
  const [showBan,     setShowBan]     = useState(false);

  const { mutate: unsuspend, isPending: unsuspending } = useUnsuspendUser();
  const { mutate: ban,       isPending: banning       } = useBanUserPost();
  const { mutate: verify,    isPending: verifying     } = useVerifyContractorUser();

  if (isLoading) {
    return (
      <div>
        <AdminPageHeader title="Loading…" actions={<Link to="/admin/users"><Button variant="secondary" size="sm">← Back</Button></Link>} />
        <PageSkeleton />
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <AdminPageHeader title="User not found" actions={<Link to="/admin/users"><Button variant="secondary" size="sm">← Back</Button></Link>} />
        <p style={{ color: 'var(--color-text-muted)', padding: 'var(--space-6)' }}>This user could not be found.</p>
      </div>
    );
  }

  const fullName   = `${data.firstName} ${data.lastName}`;
  const suspended  = !data.isActive && !data.isBanned;
  const active     = data.isActive && !data.isBanned;
  const isContractor = data.role === 'CONTRACTOR';
  const canVerify  = isContractor && data.contractor && !data.contractor.isLicenseVerified;

  const headerActions = (
    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
      <Link to="/admin/users">
        <Button variant="secondary" size="sm">
          <ArrowLeft size={13} style={{ marginRight: 4 }} />
          Back
        </Button>
      </Link>
      {data.role !== 'ADMIN' && active && (
        <Button variant="secondary" size="sm" onClick={() => setShowSuspend(true)}>
          Suspend
        </Button>
      )}
      {data.role !== 'ADMIN' && suspended && (
        <Button variant="secondary" size="sm" onClick={() => unsuspend(data.id)} disabled={unsuspending}>
          {unsuspending ? 'Unsuspending…' : 'Unsuspend'}
        </Button>
      )}
      {canVerify && (
        <Button variant="secondary" size="sm" onClick={() => verify(data.id)} disabled={verifying}>
          <Shield size={13} style={{ marginRight: 4 }} />
          {verifying ? 'Verifying…' : 'Verify Contractor'}
        </Button>
      )}
      <Button variant="secondary" size="sm" onClick={() => setShowMessage(true)}>
        <MessageCircle size={13} style={{ marginRight: 4 }} />
        Send Message
      </Button>
      {data.role !== 'ADMIN' && !data.isBanned && (
        <Button variant="danger" size="sm" onClick={() => setShowBan(true)}>
          Ban
        </Button>
      )}
    </div>
  );

  return (
    <div>
      <AdminPageHeader
        title={fullName}
        subtitle={`${data.email} • ${data.role} • Joined ${fmtDate(data.createdAt)}`}
        actions={headerActions}
      />

      <div className={s.twoCol}>
        {/* ── LEFT SIDEBAR ─────────────────────────────────────────── */}
        <aside className={s.sidebar}>
          <div className={s.profileCard}>
            {/* Avatar */}
            <div className={s.avatarWrap}>
              {data.avatarUrl
                ? <img src={data.avatarUrl} className={s.avatarLg} alt={fullName} />
                : <div className={s.avatarLgInitials}>{initials(data.firstName, data.lastName)}</div>
              }
            </div>

            <div className={s.profileName}>{fullName}</div>
            <div className={s.profileEmail}>{data.email}</div>

            <div className={s.badgeRow}>
              {statusBadge(data)}
              {roleBadge(data.role)}
              {data.isVerified && <span className={`${sh.badge} ${sh.badgeVerified}`}>Verified</span>}
            </div>

            <div className={s.divider} />

            {/* Meta */}
            <div className={s.metaList}>
              <div className={s.metaRow}>
                <span className={s.metaLabel}>Member since</span>
                <span className={s.metaValue}>{fmtDate(data.createdAt)}</span>
              </div>
              {data.lastSignInAt && (
                <div className={s.metaRow}>
                  <span className={s.metaLabel}>Last active</span>
                  <span className={s.metaValue}>{timeAgo(data.lastSignInAt)}</span>
                </div>
              )}
              {data.suspendedUntil && (
                <div className={s.metaRow}>
                  <span className={s.metaLabel}>Suspended until</span>
                  <span className={s.metaValue} style={{ color: 'var(--color-warning)' }}>{fmtDate(data.suspendedUntil)}</span>
                </div>
              )}
              {(data.city || data.state) && (
                <div className={s.metaRow}>
                  <span className={s.metaLabel}>Location</span>
                  <span className={s.metaValue}>{[data.city, data.state].filter(Boolean).join(', ')}</span>
                </div>
              )}
            </div>

            <div className={s.divider} />

            {/* Stats */}
            <div className={s.statGrid}>
              {data.role === 'INVESTOR' ? (
                <>
                  <div className={s.statItem}>
                    <DollarSign size={13} className={s.statIcon} />
                    <div className={s.statVal}>{fmtMoney(data.totalSpend)}</div>
                    <div className={s.statLbl}>Total Spend</div>
                  </div>
                  <div className={s.statItem}>
                    <Briefcase size={13} className={s.statIcon} />
                    <div className={s.statVal}>{data.jobCount}</div>
                    <div className={s.statLbl}>Jobs Posted</div>
                  </div>
                </>
              ) : (
                <>
                  <div className={s.statItem}>
                    <DollarSign size={13} className={s.statIcon} />
                    <div className={s.statVal}>{fmtMoney(data.totalEarnings)}</div>
                    <div className={s.statLbl}>Earnings</div>
                  </div>
                  <div className={s.statItem}>
                    <Briefcase size={13} className={s.statIcon} />
                    <div className={s.statVal}>{data.bidCount}</div>
                    <div className={s.statLbl}>Bids</div>
                  </div>
                </>
              )}
              <div className={s.statItem}>
                <Star size={13} className={s.statIcon} />
                <div className={s.statVal}>{data.reviews.length}</div>
                <div className={s.statLbl}>Reviews</div>
              </div>
            </div>

            {/* Contractor-specific */}
            {isContractor && data.contractor && (
              <>
                <div className={s.divider} />
                <div className={s.metaList}>
                  <div className={s.metaRow}>
                    <span className={s.metaLabel}>Avg rating</span>
                    <span className={s.metaValue}>
                      {data.contractor.averageRating.toFixed(1)}
                      <Star size={11} fill="var(--color-star)" stroke="var(--color-star)" style={{ marginLeft: 3 }} />
                    </span>
                  </div>
                  <div className={s.metaRow}>
                    <span className={s.metaLabel}>Completed jobs</span>
                    <span className={s.metaValue}>{data.contractor.completedJobs}</span>
                  </div>
                  <div className={s.metaRow}>
                    <span className={s.metaLabel}>License</span>
                    <span className={s.metaValue}>
                      {data.contractor.isLicenseVerified
                        ? <span style={{ color: 'var(--color-accent)' }}>Verified</span>
                        : <span style={{ color: 'var(--color-warning)' }}>Unverified</span>}
                    </span>
                  </div>
                  <div className={s.metaRow}>
                    <span className={s.metaLabel}>Reliability</span>
                    <span className={s.metaValue}>{data.contractor.reliabilityScore}/100</span>
                  </div>
                </div>
              </>
            )}

            {/* Filter count warning */}
            {data.messageFilterCount > 0 && (
              <>
                <div className={s.divider} />
                <div className={s.filterWarning}>
                  <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                  <span>{data.messageFilterCount} filtered message{data.messageFilterCount !== 1 ? 's' : ''}</span>
                </div>
              </>
            )}
          </div>
        </aside>

        {/* ── RIGHT MAIN ───────────────────────────────────────────── */}
        <div className={s.main}>
          {/* Tabs */}
          <div className={s.tabs}>
            {(['activity', 'jobs', 'messages', 'reviews', 'audit'] as Tab[]).map(tab => (
              <button
                key={tab}
                className={`${s.tab} ${activeTab === tab ? s.tabActive : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {tab === 'jobs' && (
                  <span className={s.tabCount}>{data.role === 'INVESTOR' ? data.jobs.length : data.bids.length}</span>
                )}
                {tab === 'reviews' && <span className={s.tabCount}>{data.reviews.length}</span>}
                {tab === 'messages' && data.messageFilterCount > 0 && (
                  <span className={s.tabCountAmber}>{data.messageFilterCount}</span>
                )}
                {tab === 'audit' && data.accountStatusHistory.length > 0 && (
                  <span className={s.tabCount}>{data.accountStatusHistory.length}</span>
                )}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className={s.tabContent}>
            {activeTab === 'activity' && <ActivityTab data={data} />}
            {activeTab === 'jobs'     && <JobsTab data={data} />}
            {activeTab === 'messages' && <MessagesTab data={data} />}
            {activeTab === 'reviews'  && <ReviewsTab data={data} />}
            {activeTab === 'audit'    && <AuditTab data={data} />}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showSuspend && <SuspendModal userId={data.id} name={fullName} onClose={() => setShowSuspend(false)} />}
      {showMessage && <MessageModal userId={data.id} name={fullName} onClose={() => setShowMessage(false)} />}

      <ConfirmModal
        isOpen={showBan}
        onClose={() => setShowBan(false)}
        onConfirm={() => ban({ id: data.id, reason: 'Banned by admin' }, { onSuccess: () => { setShowBan(false); navigate('/admin/users'); } })}
        title={`Ban ${fullName}?`}
        message="This will permanently ban the user and block their email. This action is logged and irreversible."
        confirmLabel="Ban User"
        variant="danger"
        confirmPhrase={data.email}
        isLoading={banning}
      />
    </div>
  );
}
