import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MoreVertical, Download, Flag } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import { ConfirmModal } from '../../components/admin/shared/ConfirmModal';
import { Button } from '../../components/ui';
import {
  useAdminUsers, useAdminFlaggedUsers,
  useSuspendUser, useUnsuspendUser, useBanUserPost, useSendAdminMessage,
} from '../../hooks/useAdmin';
import type { AdminUser, FlaggedUser } from '../../services/admin.service';
import sh from './admin-shared.module.css';
import s from './AdminUsersPage.module.css';

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function roleBadge(role: string) {
  const cls = role === 'INVESTOR' ? sh.badgeInvestor : role === 'CONTRACTOR' ? sh.badgeContractor : sh.badgeAdmin;
  return <span className={`${sh.badge} ${cls}`}>{role}</span>;
}

function statusBadge(u: Pick<AdminUser, 'isActive' | 'isBanned' | 'suspendedUntil'>) {
  if (u.isBanned) return <span className={`${sh.badge} ${sh.badgeBanned}`}>Banned</span>;
  if (!u.isActive) return <span className={`${sh.badge} ${sh.badgeInProgress}`}>Suspended</span>;
  return <span className={`${sh.badge} ${sh.badgeActive}`}>Active</span>;
}

// ── Modals ────────────────────────────────────────────────────────────────────

function SuspendModal({ target, onClose }: {
  target: { userId: string; name: string } | null;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState('');
  const { mutate, isPending } = useSuspendUser();

  useEffect(() => { setReason(''); setDays(''); }, [target]);
  if (!target) return null;

  function submit() {
    if (!reason.trim() || !target) return;
    mutate(
      { id: target.userId, reason, durationDays: days ? parseInt(days, 10) : null },
      { onSuccess: onClose },
    );
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Suspend {target.name}</h3>
        <p className={sh.modalBody}>The user will be locked out immediately. Leave duration blank for indefinite.</p>
        <textarea
          className={sh.modalNote}
          placeholder="Reason (required)…"
          value={reason}
          onChange={e => setReason(e.target.value)}
          autoFocus
        />
        <input
          type="number"
          className={sh.modalSelect}
          placeholder="Duration in days (blank = indefinite)"
          value={days}
          onChange={e => setDays(e.target.value)}
          min={1}
          max={3650}
          style={{ marginBottom: 'var(--space-4)' }}
        />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button className={`${sh.actionBtn} ${sh.actionBtnAmber}`} onClick={submit} disabled={isPending || !reason.trim()}>
            {isPending ? 'Suspending…' : 'Suspend User'}
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageModal({ target, onClose }: {
  target: { userId: string; name: string } | null;
  onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const { mutate, isPending } = useSendAdminMessage();

  useEffect(() => { setSubject(''); setContent(''); }, [target]);
  if (!target) return null;

  function submit() {
    if (!subject.trim() || !content.trim() || !target) return;
    mutate({ id: target.userId, subject, content }, { onSuccess: onClose });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Message {target.name}</h3>
        <input
          className={sh.modalSelect}
          placeholder="Subject…"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          autoFocus
        />
        <textarea
          className={sh.modalNote}
          placeholder="Message content…"
          value={content}
          onChange={e => setContent(e.target.value)}
          style={{ minHeight: 120 }}
        />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button className={`${sh.actionBtn} ${sh.actionBtnNavy}`} onClick={submit}
            disabled={isPending || !subject.trim() || !content.trim()}>
            {isPending ? 'Sending…' : 'Send Message'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kebab ─────────────────────────────────────────────────────────────────────

function KebabMenu({
  user, onSuspend, onUnsuspend, onMessage, onBan, navigate,
}: {
  user: AdminUser | FlaggedUser;
  onSuspend: () => void;
  onUnsuspend: () => void;
  onMessage: () => void;
  onBan: () => void;
  navigate: (to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const isUser = (u: AdminUser | FlaggedUser): u is AdminUser => 'isActive' in u && 'suspendedUntil' in u;
  const suspended = isUser(user) && !user.isActive && !user.isBanned;
  const active    = isUser(user) ? user.isActive && !user.isBanned : !user.isBanned && user.isActive;

  return (
    <div ref={ref} className={s.kebab}>
      <button className={s.kebabTrigger} onClick={() => setOpen(o => !o)} aria-label="Actions">
        <MoreVertical size={15} />
      </button>
      {open && (
        <div className={s.kebabMenu}>
          <button className={s.kebabItem} onClick={() => { navigate(`/admin/users/${user.id}`); setOpen(false); }}>
            View Profile
          </button>
          {user.role !== 'ADMIN' && active && (
            <button className={s.kebabItem} onClick={() => { onSuspend(); setOpen(false); }}>
              Suspend
            </button>
          )}
          {user.role !== 'ADMIN' && suspended && (
            <button className={s.kebabItem} onClick={() => { onUnsuspend(); setOpen(false); }}>
              Unsuspend
            </button>
          )}
          <button className={s.kebabItem} onClick={() => { onMessage(); setOpen(false); }}>
            Message
          </button>
          {user.role !== 'ADMIN' && !user.isBanned && (
            <button className={`${s.kebabItem} ${s.kebabDanger}`} onClick={() => { onBan(); setOpen(false); }}>
              Ban
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const navigate = useNavigate();

  // Filter state
  const [searchInput, setSearchInput] = useState('');
  const [search,      setSearch]      = useState('');
  const [role,        setRole]        = useState('');
  const [status,      setStatus]      = useState('');
  const [dateFrom,    setDateFrom]    = useState('');
  const [dateTo,      setDateTo]      = useState('');
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [page,        setPage]        = useState(1);

  // Modal targets
  const [suspendTarget, setSuspendTarget] = useState<{ userId: string; name: string } | null>(null);
  const [messageTarget, setMessageTarget] = useState<{ userId: string; name: string } | null>(null);
  const [banTarget,     setBanTarget]     = useState<{ userId: string; email: string; name: string } | null>(null);

  // Debounce search 300ms
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const clearFilters = useCallback(() => {
    setSearchInput(''); setSearch(''); setRole(''); setStatus('');
    setDateFrom(''); setDateTo(''); setFlaggedOnly(false); setPage(1);
  }, []);

  const hasFilters = searchInput || role || status || dateFrom || dateTo || flaggedOnly;

  // Data
  const queryParams = {
    page, limit: 25,
    search: search || undefined,
    role:   role   || undefined,
    status: status || undefined,
    dateFrom: dateFrom || undefined,
    dateTo:   dateTo   || undefined,
  };
  const { data, isLoading }             = useAdminUsers(queryParams);
  const { data: flaggedData, isLoading: flaggedLoading } = useAdminFlaggedUsers();

  const { mutate: unsuspend, isPending: unsuspending } = useUnsuspendUser();
  const { mutate: ban,       isPending: banning       } = useBanUserPost();

  const users       = data?.data       ?? [];
  const total       = data?.total      ?? 0;
  const totalPages  = data?.totalPages ?? 1;
  const flaggedUsers = flaggedData?.users ?? [];

  const loading = flaggedOnly ? flaggedLoading : isLoading;
  const displayUsers: (AdminUser | FlaggedUser)[] = flaggedOnly ? flaggedUsers : users;

  return (
    <div className={sh.page}>
      <AdminPageHeader
        title="Users"
        subtitle={flaggedOnly ? `${flaggedUsers.length} flagged users` : `${total} total users`}
        actions={
          <Button variant="secondary" size="sm">
            <Download size={13} style={{ marginRight: 4 }} />
            Export CSV
          </Button>
        }
      />

      {/* Filter bar */}
      <div className={s.filterCard}>
        {/* Search */}
        <div className={s.searchWrap}>
          <Search size={13} className={s.searchIcon} />
          <input
            className={s.searchInput}
            placeholder="Search name or email…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
        </div>

        {/* Role pills */}
        <div className={s.pillGroup}>
          {(['', 'INVESTOR', 'CONTRACTOR', 'ADMIN'] as const).map(r => (
            <button key={r} className={`${s.pill} ${role === r ? s.pillActive : ''}`}
              onClick={() => { setRole(r); setPage(1); }}>
              {r || 'All'}
            </button>
          ))}
        </div>

        {/* Status pills */}
        <div className={s.pillGroup}>
          {(['', 'active', 'suspended', 'banned'] as const).map(st => (
            <button key={st} className={`${s.pill} ${status === st ? s.pillActive : ''}`}
              onClick={() => { setStatus(st); setPage(1); }}>
              {st ? st.charAt(0).toUpperCase() + st.slice(1) : 'All'}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div className={s.dateRange}>
          <input type="date" className={s.dateInput} value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1); }} />
          <span className={s.dateSep}>–</span>
          <input type="date" className={s.dateInput} value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1); }} />
        </div>

        {/* Flagged toggle */}
        <button
          className={`${s.pill} ${flaggedOnly ? s.pillFlagged : ''}`}
          onClick={() => { setFlaggedOnly(f => !f); setPage(1); }}
        >
          <Flag size={12} style={{ marginRight: 4 }} />
          Flagged only
        </button>

        {hasFilters && (
          <button className={s.clearBtn} onClick={clearFilters}>Clear filters</button>
        )}
      </div>

      {/* Table */}
      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Jobs</th>
              {flaggedOnly && <th>Risk</th>}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: flaggedOnly ? 8 : 7 }).map((_, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: j === 0 ? 160 : 70 }} /></td>
                  ))}
                </tr>
              ))
            ) : displayUsers.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={flaggedOnly ? 8 : 7}>No users found</td></tr>
            ) : displayUsers.map(u => {
              const name = `${u.firstName} ${u.lastName}`;
              const isFlagged = flaggedOnly && 'severityScore' in u;
              const jobCount = 'jobCount' in u ? u.jobCount : 0;

              return (
                <tr key={u.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/admin/users/${u.id}`)}>
                  <td onClick={e => e.stopPropagation()}>
                    <div className={sh.nameCell}>
                      {u.avatarUrl
                        ? <img src={u.avatarUrl} className={sh.avatar} alt={name} />
                        : <div className={sh.avatar}>{initials(u.firstName, u.lastName)}</div>
                      }
                      <div>
                        <div className={sh.nameMain}>{name}</div>
                        <div className={sh.nameSub}>{u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{u.email}</td>
                  <td>{roleBadge(u.role)}</td>
                  <td>{statusBadge(u)}</td>
                  <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{fmt(u.createdAt)}</td>
                  <td style={{ color: 'var(--color-text-muted)' }}>{jobCount}</td>
                  {flaggedOnly && isFlagged && (
                    <td>
                      <span className={s.riskScore}>{(u as FlaggedUser).severityScore}</span>
                    </td>
                  )}
                  <td onClick={e => e.stopPropagation()}>
                    <KebabMenu
                      user={u}
                      navigate={navigate}
                      onSuspend={() => setSuspendTarget({ userId: u.id, name })}
                      onUnsuspend={() => unsuspend(u.id)}
                      onMessage={() => setMessageTarget({ userId: u.id, name })}
                      onBan={() => setBanTarget({ userId: u.id, email: u.email, name })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!flaggedOnly && (
          <div className={sh.pagination}>
            <span>Showing {users.length ? (page - 1) * 25 + 1 : 0}–{Math.min(page * 25, total)} of {total}</span>
            <div className={sh.paginationBtns}>
              <button className={sh.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <button className={`${sh.pageBtn} ${sh.pageBtnActive}`}>{page}</button>
              <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <SuspendModal target={suspendTarget} onClose={() => setSuspendTarget(null)} />
      <MessageModal target={messageTarget} onClose={() => setMessageTarget(null)} />

      <ConfirmModal
        isOpen={!!banTarget}
        onClose={() => setBanTarget(null)}
        onConfirm={() => {
          if (!banTarget) return;
          ban({ id: banTarget.userId, reason: `Banned by admin` }, { onSuccess: () => setBanTarget(null) });
        }}
        title={`Ban ${banTarget?.name ?? 'this user'}?`}
        message="This will permanently ban the user and add their email to the ban list. This action is logged and cannot be easily reversed."
        confirmLabel="Ban User"
        variant="danger"
        confirmPhrase={banTarget?.email}
        isLoading={banning}
      />

      {/* Unsuspend confirm — lightweight inline confirm handled by kebab directly calling the mutation */}
    </div>
  );
}
