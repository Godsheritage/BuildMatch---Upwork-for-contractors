import { useEffect, useState, useCallback } from 'react';
import { Bug, User as UserIcon, ExternalLink } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import {
  getBugReports, updateBugReportAdmin,
  type BugReportItem, type BugStatus, type BugSeverity,
} from '../../services/admin.service';

const TABS: { value: BugStatus; label: string }[] = [
  { value: 'NEW',         label: 'New'         },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'RESOLVED',    label: 'Resolved'    },
  { value: 'WONT_FIX',    label: "Won't fix"   },
];

const SEV_COLORS: Record<BugSeverity, { bg: string; fg: string }> = {
  LOW:      { bg: '#F3F4F6', fg: '#374151' },
  MEDIUM:   { bg: '#DBEAFE', fg: '#1E40AF' },
  HIGH:     { bg: '#FEF3C7', fg: '#92400E' },
  CRITICAL: { bg: '#FEE2E2', fg: '#B91C1C' },
};

export function AdminBugReportsPage() {
  const [tab, setTab]               = useState<BugStatus>('NEW');
  const [items, setItems]           = useState<BugReportItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState<BugReportItem | null>(null);
  const [draftStatus, setDraftStatus] = useState<BugStatus>('NEW');
  const [draftNote, setDraftNote]   = useState('');
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getBugReports({ status: tab, page: 1, limit: 100 });
      setItems(res.data);
    } catch {
      setError('Failed to load bug reports');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  function selectItem(item: BugReportItem) {
    setSelected(item);
    setDraftStatus(item.status);
    setDraftNote(item.adminNote ?? '');
    setError('');
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError('');
    try {
      await updateBugReportAdmin(selected.id, { status: draftStatus, adminNote: draftNote || null });
      setSelected(null);
      await load();
    } catch {
      setError('Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <AdminPageHeader
        title="Bug reports"
        subtitle="User-submitted bugs from across the platform."
      />

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 24 }}>
        {TABS.map((t) => (
          <button
            key={t.value}
            onClick={() => { setTab(t.value); setSelected(null); }}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t.value ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === t.value ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <div style={errorBox}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.5fr)', gap: 20 }}>
        {/* List */}
        <div style={cardStyle}>
          {loading ? (
            <div style={emptyStyle}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={emptyStyle}>
              <Bug size={32} strokeWidth={1.5} color="#9CA3AF" />
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                No reports in this tab.
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((b) => {
                const active = selected?.id === b.id;
                const sev = SEV_COLORS[b.severity];
                return (
                  <li key={b.id}>
                    <button
                      onClick={() => selectItem(b)}
                      style={{
                        width: '100%', display: 'flex', flexDirection: 'column', gap: 6,
                        padding: '14px 16px',
                        background: active ? '#F8F7F5' : 'transparent',
                        border: 'none', borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {b.title}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          padding: '2px 8px', borderRadius: 10,
                          background: sev.bg, color: sev.fg, flexShrink: 0,
                        }}>
                          {b.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                        {b.reportingUser
                          ? `${b.reportingUser.firstName} ${b.reportingUser.lastName}`
                          : 'Anonymous'}
                        {' · '}
                        {new Date(b.createdAt).toLocaleString()}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Detail */}
        <div style={cardStyle}>
          {!selected ? (
            <div style={emptyStyle}>
              <Bug size={32} strokeWidth={1.5} color="#9CA3AF" />
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                Select a report to view details.
              </p>
            </div>
          ) : (
            <div style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, flex: 1 }}>{selected.title}</h3>
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  padding: '4px 10px', borderRadius: 12,
                  background: SEV_COLORS[selected.severity].bg,
                  color:      SEV_COLORS[selected.severity].fg,
                  flexShrink: 0,
                }}>
                  {selected.severity}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                <UserIcon size={13} />
                {selected.reportingUser
                  ? `${selected.reportingUser.firstName} ${selected.reportingUser.lastName} · ${selected.reportingUser.email}`
                  : `Anonymous${selected.ipAddress ? ` · ${selected.ipAddress}` : ''}`}
                {' · '}
                {new Date(selected.createdAt).toLocaleString()}
              </div>

              <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', padding: '12px 14px', background: '#F8F7F5', borderRadius: 8, border: '1px solid var(--color-border)', marginBottom: 16 }}>
                {selected.description}
              </div>

              {selected.screenshotUrls.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={metaLabel}>Screenshots</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {selected.screenshotUrls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }} />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selected.pageUrl && (
                <div style={{ marginBottom: 12 }}>
                  <div style={metaLabel}>Page URL</div>
                  <a href={selected.pageUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: 'var(--color-primary)', wordBreak: 'break-all', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    {selected.pageUrl} <ExternalLink size={11} />
                  </a>
                </div>
              )}

              {selected.userAgent && (
                <div style={{ marginBottom: 18 }}>
                  <div style={metaLabel}>User agent</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-muted)', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {selected.userAgent}
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 16, marginTop: 16 }}>
                <div style={metaLabel}>Status</div>
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value as BugStatus)}
                  style={{ width: '100%', padding: '8px 10px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 8, marginBottom: 14 }}
                >
                  {TABS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>

                <div style={metaLabel}>Admin note</div>
                <textarea
                  value={draftNote}
                  onChange={(e) => setDraftNote(e.target.value)}
                  rows={3}
                  placeholder="Internal notes…"
                  style={{ width: '100%', padding: '10px 12px', fontSize: 13, border: '1px solid var(--color-border)', borderRadius: 8, fontFamily: 'inherit', resize: 'vertical' }}
                />

                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    style={{ ...btnStyle, background: 'var(--color-primary)', color: '#fff' }}
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setSelected(null)}
                    disabled={saving}
                    style={{ ...btnStyle, background: '#fff', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--color-border)',
  borderRadius: 12,
  overflow: 'hidden',
};
const emptyStyle: React.CSSProperties = {
  padding: 40, textAlign: 'center',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  minHeight: 220,
};
const metaLabel: React.CSSProperties = {
  fontSize: 10, textTransform: 'uppercase',
  color: 'var(--color-text-muted)', letterSpacing: 0.4, marginBottom: 6,
};
const btnStyle: React.CSSProperties = {
  padding: '8px 18px', fontSize: 13, fontWeight: 500,
  borderRadius: 8, cursor: 'pointer', border: 'none',
};
const errorBox: React.CSSProperties = {
  padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FEE2E2',
  borderRadius: 8, color: '#B91C1C', fontSize: 13, marginBottom: 16,
};
