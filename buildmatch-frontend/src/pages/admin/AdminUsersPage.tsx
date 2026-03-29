import { useState, useCallback } from 'react';
import { Search } from 'lucide-react';
import {
  useAdminUsers, useBanUser, useUnbanUser, useChangeUserRole,
} from '../../hooks/useAdmin';
import sh from './admin-shared.module.css';

// ── Types ─────────────────────────────────────────────────────────────────────

type RoleModal  = { userId: string; currentRole: string } | null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function roleBadge(role: string) {
  const cls = role === 'INVESTOR' ? sh.badgeInvestor : role === 'CONTRACTOR' ? sh.badgeContractor : sh.badgeAdmin;
  return <span className={`${sh.badge} ${cls}`}>{role}</span>;
}

function statusBadge(isActive: boolean) {
  return <span className={`${sh.badge} ${isActive ? sh.badgeActive : sh.badgeBanned}`}>{isActive ? 'Active' : 'Banned'}</span>;
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── RoleModal ─────────────────────────────────────────────────────────────────

function RoleModal({ target, onClose }: { target: RoleModal; onClose: () => void }) {
  const [role, setRole] = useState(target?.currentRole ?? 'INVESTOR');
  const [note, setNote] = useState('');
  const { mutate, isPending } = useChangeUserRole();

  if (!target) return null;

  function submit() {
    if (!target) return;
    mutate({ id: target.userId, role, note: note || undefined }, { onSuccess: onClose });
  }

  return (
    <div className={sh.backdrop} onClick={onClose}>
      <div className={sh.modal} onClick={e => e.stopPropagation()}>
        <h3 className={sh.modalTitle}>Change User Role</h3>
        <p className={sh.modalBody}>Select the new role for this user. This action is audited.</p>
        <select className={sh.modalSelect} value={role} onChange={e => setRole(e.target.value)}>
          <option value="INVESTOR">INVESTOR</option>
          <option value="CONTRACTOR">CONTRACTOR</option>
        </select>
        <textarea className={sh.modalNote} placeholder="Optional note..." value={note} onChange={e => setNote(e.target.value)} />
        <div className={sh.modalActions}>
          <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={onClose}>Cancel</button>
          <button className={`${sh.actionBtn} ${sh.actionBtnAmber}`} onClick={submit} disabled={isPending}>
            {isPending ? 'Saving…' : 'Change Role'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const [search,   setSearch]   = useState('');
  const [role,     setRole]     = useState('');
  const [isActive, setIsActive] = useState('');
  const [page,     setPage]     = useState(1);
  const [roleModal, setRoleModal] = useState<RoleModal>(null);

  const params = { page, limit: 25, search: search || undefined, role: role || undefined, isActive: isActive || undefined };
  const { data, isLoading } = useAdminUsers(params);
  const { mutate: ban,   isPending: banning   } = useBanUser();
  const { mutate: unban, isPending: unbanning  } = useUnbanUser();

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value); setPage(1);
  }, []);

  const users     = data?.data       ?? [];
  const total     = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className={sh.page}>
      <div className={sh.pageHeader}>
        <div>
          <h1 className={sh.pageTitle}>Users</h1>
          <p className={sh.pageSubtitle}>{total} total users</p>
        </div>
      </div>

      <div className={sh.filters}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={14} style={{ position: 'absolute', left: 10, color: 'var(--color-text-muted)', pointerEvents: 'none' }} />
          <input
            className={sh.searchInput}
            style={{ paddingLeft: 30 }}
            placeholder="Search name or email…"
            value={search}
            onChange={handleSearch}
          />
        </div>
        <select className={sh.filterSelect} value={role} onChange={e => { setRole(e.target.value); setPage(1); }}>
          <option value="">All roles</option>
          <option value="INVESTOR">Investor</option>
          <option value="CONTRACTOR">Contractor</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select className={sh.filterSelect} value={isActive} onChange={e => { setIsActive(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          <option value="true">Active</option>
          <option value="false">Banned</option>
        </select>
      </div>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Status</th>
              <th>Jobs</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: j === 0 ? 160 : j === 4 ? 90 : 60 }} /></td>
                  ))}
                </tr>
              ))
            ) : users.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={6}>No users found</td></tr>
            ) : users.map(u => (
              <tr key={u.id}>
                <td>
                  <div className={sh.nameCell}>
                    <div className={sh.avatar}>{initials(u.firstName, u.lastName)}</div>
                    <div>
                      <div className={sh.nameMain}>{u.firstName} {u.lastName}</div>
                      <div className={sh.nameSub}>{u.email}</div>
                    </div>
                  </div>
                </td>
                <td>{roleBadge(u.role)}</td>
                <td>{statusBadge(u.isActive)}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>{u.jobCount}</td>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{fmt(u.createdAt)}</td>
                <td>
                  <div className={sh.actions}>
                    {u.role !== 'ADMIN' && (
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
                        onClick={() => setRoleModal({ userId: u.id, currentRole: u.role })}
                      >
                        Role
                      </button>
                    )}
                    {u.role !== 'ADMIN' && u.isActive && (
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnRed}`}
                        disabled={banning}
                        onClick={() => ban(u.id)}
                      >
                        Ban
                      </button>
                    )}
                    {u.role !== 'ADMIN' && !u.isActive && (
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
                        disabled={unbanning}
                        onClick={() => unban(u.id)}
                      >
                        Unban
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={sh.pagination}>
          <span>Showing {users.length ? ((page - 1) * 25) + 1 : 0}–{Math.min(page * 25, total)} of {total}</span>
          <div className={sh.paginationBtns}>
            <button className={sh.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className={`${sh.pageBtn} ${sh.pageBtnActive}`}>{page}</button>
            <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>

      <RoleModal target={roleModal} onClose={() => setRoleModal(null)} />
    </div>
  );
}
