import { useState } from 'react';
import { X, Flag } from 'lucide-react';
import { Button } from '../ui/Button';

const REASONS = [
  'Spam or scam',
  'Harassment or hate speech',
  'Sharing contact info',
  'Inappropriate content',
  'Other',
];

interface ReportMessageModalProps {
  message: { id: string; content: string };
  onClose:  () => void;
  onSubmit: (reason: string, description?: string) => Promise<void>;
}

export function ReportMessageModal({ message, onClose, onSubmit }: ReportMessageModalProps) {
  const [reason, setReason]           = useState<string>(REASONS[0]);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting]   = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await onSubmit(reason, description.trim() || undefined);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modal} role="dialog" aria-modal="true">
        <div style={header}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Flag size={16} strokeWidth={1.75} color="var(--color-danger)" />
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Report message</h2>
          </div>
          <button type="button" onClick={onClose} style={iconBtn} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div style={body}>
          <div style={quoteBox}>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>Reported message</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {message.content.length > 200 ? `${message.content.slice(0, 200)}…` : message.content}
            </p>
          </div>

          <label style={label}>Reason</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} style={input}>
            {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>

          <label style={{ ...label, marginTop: 14 }}>
            More details <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Anything else our team should know?"
            style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={footer}>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Cancel</Button>
          <Button variant="primary"   onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Sending…' : 'Submit report'}
          </Button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 16,
};
const modal: React.CSSProperties = {
  background: '#fff', borderRadius: 12, width: '100%', maxWidth: 480,
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
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 500,
  color: 'var(--color-text-muted)', marginBottom: 6,
};
const input: React.CSSProperties = {
  width: '100%', padding: '10px 12px', fontSize: 14,
  border: '1px solid var(--color-border)', borderRadius: 8,
  background: '#fff',
};
const quoteBox: React.CSSProperties = {
  padding: '10px 12px', background: '#F8F7F5',
  borderRadius: 8, border: '1px solid var(--color-border)',
  marginBottom: 16,
};
