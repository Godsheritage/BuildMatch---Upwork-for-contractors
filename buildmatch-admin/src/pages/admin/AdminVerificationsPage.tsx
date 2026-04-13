import { useEffect, useState, useCallback } from 'react';
import { CheckCircle2, XCircle, ShieldCheck, Clock, User as UserIcon } from 'lucide-react';
import { AdminPageHeader } from '../../components/admin/shared/AdminPageHeader';
import {
  getIdVerifications, reviewIdVerification,
  type IdVerificationItem,
} from '../../services/admin.service';

type Tab = 'PENDING' | 'APPROVED' | 'REJECTED';

export function AdminVerificationsPage() {
  const [tab, setTab]               = useState<Tab>('PENDING');
  const [items, setItems]           = useState<IdVerificationItem[]>([]);
  const [loading, setLoading]       = useState(false);
  const [selected, setSelected]     = useState<IdVerificationItem | null>(null);
  const [note, setNote]             = useState('');
  const [submitting, setSubmitting] = useState<null | 'APPROVED' | 'REJECTED'>(null);
  const [error, setError]           = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getIdVerifications(tab);
      setItems(res.users);
    } catch {
      setError('Failed to load verifications');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  async function handleDecision(decision: 'APPROVED' | 'REJECTED') {
    if (!selected) return;
    if (decision === 'REJECTED' && !note.trim()) {
      setError('A note is required when rejecting.');
      return;
    }
    setSubmitting(decision);
    setError('');
    try {
      await reviewIdVerification(selected.id, decision, note.trim() || undefined);
      setSelected(null);
      setNote('');
      await load();
    } catch {
      setError('Failed to submit decision');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div style={{ maxWidth: 1200 }}>
      <AdminPageHeader
        title="Identity verifications"
        subtitle="Review government ID submissions and approve or reject them."
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--color-border)', marginBottom: 24 }}>
        {(['PENDING', 'APPROVED', 'REJECTED'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setSelected(null); }}
            style={{
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: tab === t ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: tab === t ? 'var(--color-primary)' : 'var(--color-text-muted)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              marginBottom: -1,
            }}
          >
            {t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {error && (
        <div style={errorBoxStyle}>{error}</div>
      )}

      {/* Two-column: list + detail */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)', gap: 20 }}>
        {/* List */}
        <div style={cardStyle}>
          {loading ? (
            <div style={emptyStyle}>Loading…</div>
          ) : items.length === 0 ? (
            <div style={emptyStyle}>
              <ShieldCheck size={32} strokeWidth={1.5} color="#9CA3AF" />
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                No {tab.toLowerCase()} submissions.
              </p>
            </div>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {items.map((u) => {
                const active = selected?.id === u.id;
                return (
                  <li key={u.id}>
                    <button
                      onClick={() => { setSelected(u); setNote(u.idVerificationNote ?? ''); setError(''); }}
                      style={{
                        width: '100%', display: 'flex', gap: 12, alignItems: 'center',
                        padding: '12px 14px', background: active ? '#F8F7F5' : 'transparent',
                        border: 'none', borderBottom: '1px solid var(--color-border)',
                        cursor: 'pointer', textAlign: 'left',
                      }}
                    >
                      <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatarUrl} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {u.firstName} {u.lastName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {u.email}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                          {u.idType ?? '—'} · {u.idCountry ?? '—'} · {new Date(u.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      {tab === 'PENDING' && <Clock size={14} color="#BA7517" />}
                      {tab === 'APPROVED' && <CheckCircle2 size={14} color="#0F6E56" />}
                      {tab === 'REJECTED' && <XCircle size={14} color="#DC2626" />}
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
              <UserIcon size={32} strokeWidth={1.5} color="#9CA3AF" />
              <p style={{ margin: '8px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                Select a submission to review.
              </p>
            </div>
          ) : (
            <div style={{ padding: 20 }}>
              <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 600 }}>
                {selected.firstName} {selected.lastName}
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 12, color: 'var(--color-text-muted)' }}>
                {selected.email} · {selected.role}
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18, fontSize: 12 }}>
                <Field label="ID Type"  value={selected.idType ?? '—'} />
                <Field label="Country"  value={selected.idCountry ?? '—'} />
                <Field label="Submitted" value={new Date(selected.updatedAt).toLocaleString()} />
                <Field label="Status"   value={selected.idVerificationStatus ?? '—'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 18 }}>
                <DocBox label="ID Document" url={selected.idDocumentUrl} />
                <DocBox label="Selfie"      url={selected.idSelfieUrl} />
              </div>

              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>
                Note {tab === 'PENDING' ? '(required for rejection)' : ''}
              </label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                placeholder="Optional note shown to the user…"
                disabled={tab !== 'PENDING'}
                style={textareaStyle}
              />

              {tab === 'PENDING' && (
                <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
                  <button
                    onClick={() => handleDecision('APPROVED')}
                    disabled={!!submitting}
                    style={{ ...btnStyle, background: '#0F6E56', color: '#fff' }}
                  >
                    <CheckCircle2 size={14} />
                    {submitting === 'APPROVED' ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleDecision('REJECTED')}
                    disabled={!!submitting}
                    style={{ ...btnStyle, background: '#fff', color: '#DC2626', border: '1px solid #DC2626' }}
                  >
                    <XCircle size={14} />
                    {submitting === 'REJECTED' ? 'Rejecting…' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, src }: { name: string; src: string | null }) {
  if (src) {
    return <img src={src} alt={name} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />;
  }
  const initials = name.split(' ').map(s => s[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  return (
    <div style={{
      width: 36, height: 36, borderRadius: '50%', background: '#E8F4F0',
      color: '#0F6E56', fontSize: 12, fontWeight: 600,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {initials}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: 0.4 }}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--color-text-primary)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function DocBox({ label, url }: { label: string; url: string | null }) {
  return (
    <div>
      <div style={{ fontSize: 10, textTransform: 'uppercase', color: 'var(--color-text-muted)', letterSpacing: 0.4, marginBottom: 6 }}>{label}</div>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block' }}>
          <img
            src={url}
            alt={label}
            style={{ width: '100%', height: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--color-border)', background: '#F8F7F5' }}
          />
        </a>
      ) : (
        <div style={{ width: '100%', height: 160, borderRadius: 8, background: '#F8F7F5', border: '1px dashed var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--color-text-muted)' }}>
          Not provided
        </div>
      )}
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
const textareaStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 13,
  border: '1px solid var(--color-border)', borderRadius: 8,
  fontFamily: 'inherit', resize: 'vertical',
};
const btnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '8px 16px', fontSize: 13, fontWeight: 500,
  borderRadius: 8, cursor: 'pointer', border: 'none',
};
const errorBoxStyle: React.CSSProperties = {
  padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FEE2E2',
  borderRadius: 8, color: '#B91C1C', fontSize: 13, marginBottom: 16,
};
