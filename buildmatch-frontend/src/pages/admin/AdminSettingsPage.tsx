import { useState } from 'react';
import {
  useAdminSettings, useUpdateSetting,
  useAdminBannedEmails, useBanEmail, useUnbanEmail,
} from '../../hooks/useAdmin';
import sh from './admin-shared.module.css';

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Editable setting row ───────────────────────────────────────────────────────

function SettingRow({ sk, value, description }: { sk: string; value: unknown; description: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(String(value ?? ''));
  const { mutate, isPending } = useUpdateSetting();

  function save() {
    // Keep the same JSON type as the original value
    let parsed: unknown = draft;
    if (typeof value === 'number')       parsed = Number(draft);
    else if (typeof value === 'boolean') parsed = draft === 'true';
    mutate({ key: sk, value: parsed }, { onSuccess: () => setEditing(false) });
  }

  return (
    <tr>
      <td>
        <div className={sh.nameMain}>{sk}</div>
        {description && <div className={sh.nameSub} style={{ fontSize: 11 }}>{description}</div>}
      </td>
      <td>
        {editing ? (
          <input
            className={sh.searchInput}
            style={{ maxWidth: 200, padding: '4px 8px', fontSize: 13 }}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
          />
        ) : (
          <code style={{ fontSize: 13, background: 'var(--color-surface)', padding: '2px 6px', borderRadius: 4 }}>
            {String(value ?? '')}
          </code>
        )}
      </td>
      <td>
        <div className={sh.actions}>
          {editing ? (
            <>
              <button className={`${sh.actionBtn} ${sh.actionBtnNavy}`} onClick={save} disabled={isPending}>
                {isPending ? 'Saving…' : 'Save'}
              </button>
              <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={() => { setEditing(false); setDraft(String(value ?? '')); }}>
                Cancel
              </button>
            </>
          ) : (
            <button className={`${sh.actionBtn} ${sh.actionBtnAmber}`} onClick={() => setEditing(true)}>
              Edit
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Banned emails section ─────────────────────────────────────────────────────

function BannedEmailsSection() {
  const [page,   setPage]   = useState(1);
  const [search, setSearch] = useState('');
  const [input,  setInput]  = useState('');
  const [reason, setReason] = useState('');

  const params = { page, limit: 25, search: search || undefined };
  const { data, isLoading } = useAdminBannedEmails(params);
  const { mutate: ban,   isPending: banning   } = useBanEmail();
  const { mutate: unban, isPending: unbanning } = useUnbanEmail();

  const entries    = data?.data       ?? [];
  const total      = data?.total      ?? 0;
  const totalPages = data?.totalPages ?? 1;

  function handleBan() {
    if (!input.trim()) return;
    ban({ email: input.trim(), reason: reason || undefined }, {
      onSuccess: () => { setInput(''); setReason(''); },
    });
  }

  return (
    <div>
      <h2 className={sh.pageTitle} style={{ fontSize: 16, marginBottom: 16 }}>Banned Emails</h2>

      {/* Add new */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <input
          className={sh.searchInput}
          style={{ maxWidth: 240 }}
          placeholder="email@example.com"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleBan()}
        />
        <input
          className={sh.searchInput}
          style={{ maxWidth: 220 }}
          placeholder="Reason (optional)"
          value={reason}
          onChange={e => setReason(e.target.value)}
        />
        <button
          className={`${sh.actionBtn} ${sh.actionBtnRed}`}
          disabled={!input.trim() || banning}
          onClick={handleBan}
        >
          {banning ? 'Banning…' : 'Ban Email'}
        </button>
      </div>

      {/* Search */}
      <div className={sh.filters} style={{ marginBottom: 12 }}>
        <input
          className={sh.searchInput}
          style={{ maxWidth: 240 }}
          placeholder="Search banned emails…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr><th>Email</th><th>Reason</th><th>Banned</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {[200, 140, 80, 60].map((w, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: w }} /></td>
                  ))}
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={4}>No banned emails</td></tr>
            ) : entries.map(e => (
              <tr key={e.email}>
                <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{e.email}</td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{e.reason ?? '—'}</td>
                <td style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', fontSize: 12 }}>{fmt(e.bannedAt)}</td>
                <td>
                  <button
                    className={`${sh.actionBtn} ${sh.actionBtnGhost}`}
                    disabled={unbanning}
                    onClick={() => unban(e.email)}
                  >
                    Unban
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className={sh.pagination}>
          <span>Showing {entries.length ? ((page - 1) * 25) + 1 : 0}–{Math.min(page * 25, total)} of {total}</span>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminSettingsPage() {
  const { data: settings, isLoading } = useAdminSettings();

  return (
    <div className={sh.page}>
      <div className={sh.pageHeader}>
        <div>
          <h1 className={sh.pageTitle}>Platform Settings</h1>
          <p className={sh.pageSubtitle}>Global configuration values — changes take effect immediately</p>
        </div>
      </div>

      <div className={sh.tableWrap} style={{ marginBottom: 40 }}>
        <table className={sh.table}>
          <thead>
            <tr><th>Key</th><th>Value</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {[160, 80, 60].map((w, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: w }} /></td>
                  ))}
                </tr>
              ))
            ) : (settings ?? []).length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={3}>No settings found</td></tr>
            ) : (settings ?? []).map(s => (
              <SettingRow key={s.key} sk={s.key} value={s.value} description={s.description} />
            ))}
          </tbody>
        </table>
      </div>

      <BannedEmailsSection />
    </div>
  );
}
