import { useState, useCallback } from 'react';
import { Search, ShieldCheck, ShieldOff } from 'lucide-react';
import {
  useAdminContractors, useVerifyLicense, useUnverifyLicense, useSetAvailability,
} from '../../hooks/useAdmin';
import sh from './admin-shared.module.css';

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export function AdminContractorsPage() {
  const [search,            setSearch]           = useState('');
  const [state,             setState]            = useState('');
  const [isLicenseVerified, setIsLicenseVerified] = useState('');
  const [isAvailable,       setIsAvailable]       = useState('');
  const [page,              setPage]              = useState(1);

  const params = {
    page, limit: 25,
    search:            search            || undefined,
    state:             state             || undefined,
    isLicenseVerified: isLicenseVerified || undefined,
    isAvailable:       isAvailable       || undefined,
  };

  const { data, isLoading }              = useAdminContractors(params);
  const { mutate: verify,   isPending: verifying   } = useVerifyLicense();
  const { mutate: unverify, isPending: unverifying } = useUnverifyLicense();
  const { mutate: setAvail, isPending: settingAvail } = useSetAvailability();

  const handleSearch = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value); setPage(1);
  }, []);

  const contractors = data?.data       ?? [];
  const total       = data?.total      ?? 0;
  const totalPages  = data?.totalPages ?? 1;

  return (
    <div className={sh.page}>
      <div className={sh.pageHeader}>
        <div>
          <h1 className={sh.pageTitle}>Contractors</h1>
          <p className={sh.pageSubtitle}>{total} registered contractors</p>
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
        <input
          className={sh.searchInput}
          style={{ maxWidth: 100 }}
          placeholder="State (TX)"
          value={state}
          onChange={e => { setState(e.target.value.toUpperCase()); setPage(1); }}
        />
        <select className={sh.filterSelect} value={isLicenseVerified} onChange={e => { setIsLicenseVerified(e.target.value); setPage(1); }}>
          <option value="">License: all</option>
          <option value="true">Verified</option>
          <option value="false">Unverified</option>
        </select>
        <select className={sh.filterSelect} value={isAvailable} onChange={e => { setIsAvailable(e.target.value); setPage(1); }}>
          <option value="">Availability: all</option>
          <option value="true">Available</option>
          <option value="false">Unavailable</option>
        </select>
      </div>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Contractor</th>
              <th>Location</th>
              <th>Rating</th>
              <th>Jobs Done</th>
              <th>License</th>
              <th>Available</th>
              <th>Joined</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: j === 0 ? 150 : 60 }} /></td>
                  ))}
                </tr>
              ))
            ) : contractors.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={8}>No contractors found</td></tr>
            ) : contractors.map(c => (
              <tr key={c.profileId}>
                <td>
                  <div className={sh.nameCell}>
                    <div className={sh.avatar}>{initials(c.firstName, c.lastName)}</div>
                    <div>
                      <div className={sh.nameMain}>{c.firstName} {c.lastName}</div>
                      <div className={sh.nameSub}>{c.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ color: 'var(--color-text-muted)' }}>{c.city ?? '—'}{c.state ? `, ${c.state}` : ''}</td>
                <td style={{ color: 'var(--color-text-muted)' }}>
                  ★ {c.averageRating.toFixed(1)}
                </td>
                <td style={{ color: 'var(--color-text-muted)' }}>{c.completedJobs}</td>
                <td>
                  <span className={`${sh.badge} ${c.isLicenseVerified ? sh.badgeVerified : sh.badgeUnverified}`}>
                    {c.isLicenseVerified ? 'Verified' : 'Unverified'}
                  </span>
                </td>
                <td>
                  <span className={`${sh.badge} ${c.isAvailable ? sh.badgeActive : sh.badgeBanned}`}>
                    {c.isAvailable ? 'Yes' : 'No'}
                  </span>
                </td>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>{fmt(c.createdAt)}</td>
                <td>
                  <div className={sh.actions}>
                    {c.isLicenseVerified ? (
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnAmber}`}
                        disabled={unverifying}
                        onClick={() => unverify(c.profileId)}
                        title="Unverify license"
                      >
                        <ShieldOff size={12} />
                      </button>
                    ) : (
                      <button
                        className={`${sh.actionBtn} ${sh.actionBtnNavy}`}
                        disabled={verifying}
                        onClick={() => verify(c.profileId)}
                        title="Verify license"
                      >
                        <ShieldCheck size={12} />
                      </button>
                    )}
                    <button
                      className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
                      disabled={settingAvail}
                      onClick={() => setAvail({ profileId: c.profileId, isAvailable: !c.isAvailable })}
                    >
                      {c.isAvailable ? 'Mark unavail.' : 'Mark avail.'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={sh.pagination}>
          <span>Showing {contractors.length ? ((page - 1) * 25) + 1 : 0}–{Math.min(page * 25, total)} of {total}</span>
          <div className={sh.paginationBtns}>
            <button className={sh.pageBtn} disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
            <button className={`${sh.pageBtn} ${sh.pageBtnActive}`}>{page}</button>
            <button className={sh.pageBtn} disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}
