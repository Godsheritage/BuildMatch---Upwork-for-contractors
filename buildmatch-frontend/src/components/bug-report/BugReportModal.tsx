import { useRef, useState } from 'react';
import { X, Upload, Trash2, Bug } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../context/ToastContext';
import { Button } from '../ui/Button';
import { submitBugReport, uploadScreenshot, type BugSeverity } from '../../services/bug-report.service';

const MAX_SHOTS  = 3;
const MAX_BYTES  = 5 * 1024 * 1024;
const ALLOWED    = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const SEVERITIES: { value: BugSeverity; label: string }[] = [
  { value: 'LOW',      label: 'Low'      },
  { value: 'MEDIUM',   label: 'Medium'   },
  { value: 'HIGH',     label: 'High'     },
  { value: 'CRITICAL', label: 'Critical' },
];

interface ShotState { id: string; url: string; uploading: boolean; publicUrl?: string }

export function BugReportModal({ onClose }: { onClose: () => void }) {
  const { user }  = useAuth();
  const { toast } = useToast();
  const fileRef   = useRef<HTMLInputElement>(null);

  const [title,       setTitle]       = useState('');
  const [severity,    setSeverity]    = useState<BugSeverity>('MEDIUM');
  const [description, setDescription] = useState('');
  const [shots,       setShots]       = useState<ShotState[]>([]);
  const [submitting,  setSubmitting]  = useState(false);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const slots = MAX_SHOTS - shots.length;
    for (const file of files.slice(0, slots)) {
      if (!ALLOWED.has(file.type)) { toast('Only PNG, JPG, WEBP, or GIF images.', 'error'); continue; }
      if (file.size > MAX_BYTES)   { toast('Image must be 5 MB or less.', 'error'); continue; }
      const id  = Math.random().toString(36).slice(2);
      const url = URL.createObjectURL(file);
      setShots(prev => [...prev, { id, url, uploading: true }]);
      try {
        const publicUrl = await uploadScreenshot(file, !!user, user?.id);
        setShots(prev => prev.map(s => s.id === id ? { ...s, uploading: false, publicUrl } : s));
      } catch {
        toast('Upload failed.', 'error');
        setShots(prev => prev.filter(s => s.id !== id));
        URL.revokeObjectURL(url);
      }
    }
  }

  function removeShot(id: string) {
    setShots(prev => {
      const s = prev.find(x => x.id === id);
      if (s) URL.revokeObjectURL(s.url);
      return prev.filter(x => x.id !== id);
    });
  }

  async function handleSubmit() {
    if (title.trim().length < 5)        { toast('Title must be at least 5 characters.', 'error'); return; }
    if (description.trim().length < 10) { toast('Please describe the issue in more detail.', 'error'); return; }
    if (shots.some(s => s.uploading))   { toast('Please wait for screenshots to finish uploading.', 'error'); return; }

    setSubmitting(true);
    try {
      await submitBugReport({
        title:          title.trim(),
        description:    description.trim(),
        severity,
        pageUrl:        window.location.href.slice(0, 500),
        userAgent:      navigator.userAgent.slice(0, 500),
        screenshotUrls: shots.map(s => s.publicUrl).filter((u): u is string => !!u),
      });
      toast('Thanks — your bug report has been sent.', 'success');
      onClose();
    } catch {
      toast('Could not submit your report. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal} role="dialog" aria-modal="true">
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Bug size={18} strokeWidth={1.75} color="var(--color-primary)" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Report a bug</h2>
          </div>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={body}>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Tell us what went wrong. The more detail, the faster we can fix it.
          </p>

          <Field label="Title">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Short summary of the issue"
              maxLength={140}
              style={input}
            />
          </Field>

          <Field label="Severity">
            <select value={severity} onChange={(e) => setSeverity(e.target.value as BugSeverity)} style={input}>
              {SEVERITIES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What did you do? What did you expect? What actually happened?"
              rows={5}
              maxLength={4000}
              style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </Field>

          <Field label={`Screenshots (optional, up to ${MAX_SHOTS})`}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {shots.map(s => (
                <div key={s.id} style={{ position: 'relative', width: 80, height: 80 }}>
                  <img src={s.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)', opacity: s.uploading ? 0.5 : 1 }} />
                  <button type="button" onClick={() => removeShot(s.id)} style={removeBtn} aria-label="Remove">
                    <Trash2 size={12} />
                  </button>
                  {s.uploading && <span style={uploadingPill}>Uploading…</span>}
                </div>
              ))}
              {shots.length < MAX_SHOTS && (
                <button type="button" onClick={() => fileRef.current?.click()} style={addShotBtn}>
                  <Upload size={16} />
                  <span style={{ fontSize: 11, marginTop: 4 }}>Add</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              multiple
              style={{ display: 'none' }}
              onChange={handleFiles}
            />
          </Field>
        </div>

        <div style={footer}>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary"   onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Send report'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-text-muted)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 16,
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520,
  maxHeight: '90vh', display: 'flex', flexDirection: 'column',
  boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
};
const header: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '16px 20px', borderBottom: '1px solid var(--color-border)',
};
const body:   React.CSSProperties = { padding: 20, overflowY: 'auto' };
const footer: React.CSSProperties = {
  padding: '14px 20px', borderTop: '1px solid var(--color-border)',
  display: 'flex', justifyContent: 'flex-end', gap: 10,
};
const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: 4, color: 'var(--color-text-muted)',
};
const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: '1px solid var(--color-border)', borderRadius: 8,
  background: '#fff',
};
const addShotBtn: React.CSSProperties = {
  width: 80, height: 80, borderRadius: 6,
  border: '1px dashed var(--color-border)', background: '#F8F7F5',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', color: 'var(--color-text-muted)',
};
const removeBtn: React.CSSProperties = {
  position: 'absolute', top: -6, right: -6, width: 20, height: 20,
  borderRadius: '50%', background: '#DC2626', color: '#fff',
  border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const uploadingPill: React.CSSProperties = {
  position: 'absolute', bottom: 4, left: 4, right: 4,
  fontSize: 9, textAlign: 'center', background: 'rgba(0,0,0,0.6)', color: '#fff',
  borderRadius: 4, padding: '2px 0',
};
