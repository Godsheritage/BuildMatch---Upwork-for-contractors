import { useState } from 'react';
import { useAdminFeatureFlags, useUpdateFeatureFlag } from '../../hooks/useAdmin';
import sh from './admin-shared.module.css';

function fmt(date: string) {
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Flag row ──────────────────────────────────────────────────────────────────

function FlagRow({
  flagKey, enabled, rolloutPct, description, updatedAt,
}: {
  flagKey: string;
  enabled: boolean;
  rolloutPct: number;
  description: string | null;
  updatedAt: string;
}) {
  const [draft, setDraft]     = useState(rolloutPct);
  const [editing, setEditing] = useState(false);
  const { mutate, isPending } = useUpdateFeatureFlag();

  function toggle() {
    mutate({ key: flagKey, enabled: !enabled, rolloutPct: draft });
  }

  function saveRollout() {
    mutate({ key: flagKey, enabled, rolloutPct: draft }, { onSuccess: () => setEditing(false) });
  }

  return (
    <tr>
      <td>
        <div className={sh.nameMain}>{flagKey.replace(/_/g, ' ')}</div>
        <div className={sh.nameSub} style={{ fontFamily: 'monospace', fontSize: 11 }}>{flagKey}</div>
      </td>
      <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>
        {description ?? '—'}
      </td>
      <td>
        <span className={`${sh.badge} ${enabled ? sh.badgeVerified : sh.badgeUnverified}`}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </td>
      <td>
        {editing ? (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input
              type="number" min={0} max={100}
              className={sh.searchInput}
              style={{ maxWidth: 70, padding: '4px 8px', fontSize: 13 }}
              value={draft}
              onChange={e => setDraft(Number(e.target.value))}
              onKeyDown={e => { if (e.key === 'Enter') saveRollout(); if (e.key === 'Escape') setEditing(false); }}
              autoFocus
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>%</span>
            <button className={`${sh.actionBtn} ${sh.actionBtnNavy}`} onClick={saveRollout} disabled={isPending}>
              {isPending ? '…' : 'Save'}
            </button>
            <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} onClick={() => { setEditing(false); setDraft(rolloutPct); }}>
              ✕
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{rolloutPct}%</span>
            <button className={`${sh.actionBtn} ${sh.actionBtnGhost}`} style={{ fontSize: 11, padding: '2px 8px' }} onClick={() => setEditing(true)}>
              Edit
            </button>
          </div>
        )}
      </td>
      <td style={{ color: 'var(--color-text-muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
        {fmt(updatedAt)}
      </td>
      <td>
        <button
          className={`${sh.actionBtn} ${enabled ? sh.actionBtnRed : sh.actionBtnNavy}`}
          disabled={isPending}
          onClick={toggle}
        >
          {isPending ? '…' : enabled ? 'Disable' : 'Enable'}
        </button>
      </td>
    </tr>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function AdminFeatureFlagsPage() {
  const { data: flags, isLoading } = useAdminFeatureFlags();

  const enabledCount  = (flags ?? []).filter(f => f.enabled).length;
  const disabledCount = (flags ?? []).filter(f => !f.enabled).length;

  return (
    <div className={sh.page}>
      <div className={sh.pageHeader}>
        <div>
          <h1 className={sh.pageTitle}>Feature Flags</h1>
          <p className={sh.pageSubtitle}>
            {enabledCount} enabled · {disabledCount} disabled
          </p>
        </div>
      </div>

      <div className={sh.tableWrap}>
        <table className={sh.table}>
          <thead>
            <tr>
              <th>Flag</th>
              <th>Description</th>
              <th>Status</th>
              <th>Rollout</th>
              <th>Last Changed</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className={sh.skeletonRow}>
                  {[150, 180, 70, 60, 90, 60].map((w, j) => (
                    <td key={j}><div className={sh.skeletonLine} style={{ width: w }} /></td>
                  ))}
                </tr>
              ))
            ) : (flags ?? []).length === 0 ? (
              <tr className={sh.emptyRow}><td colSpan={6}>No feature flags found</td></tr>
            ) : (flags ?? []).map(f => (
              <FlagRow
                key={f.key}
                flagKey={f.key}
                enabled={f.enabled}
                rolloutPct={f.rolloutPct}
                description={f.description}
                updatedAt={f.updatedAt}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
