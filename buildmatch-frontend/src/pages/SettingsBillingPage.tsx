import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, Plus, CreditCard, Trash2, Lock, HelpCircle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import {
  listBillingMethods, addBillingMethod, deleteBillingMethod, setDefaultBillingMethod,
  type BillingMethod, type AddBillingMethodPayload,
} from '../services/billing-method.service';
import styles from './SettingsSubPage.module.css';

type AddMode = null | 'CARD' | 'PAYPAL' | 'VENMO';

const US_STATES = [
  'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware',
  'Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana',
  'Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana',
  'Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina',
  'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina',
  'South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
  'Wisconsin','Wyoming',
];

export function SettingsBillingPage() {
  const { user }  = useAuth();
  const { toast } = useToast();

  const [methods, setMethods]   = useState<BillingMethod[]>([]);
  const [loading, setLoading]   = useState(true);
  const [adding, setAdding]     = useState(false);
  const [mode, setMode]         = useState<AddMode>(null);

  useEffect(() => {
    (async () => {
      try { setMethods(await listBillingMethods()); }
      catch { toast('Could not load billing methods.', 'error'); }
      finally { setLoading(false); }
    })();
  }, [toast]);

  function startAdding() { setAdding(true); setMode('CARD'); }
  function cancelAdding() { setAdding(false); setMode(null); }

  async function handleSubmit(payload: AddBillingMethodPayload) {
    try {
      const created = await addBillingMethod(payload);
      setMethods((prev) => [created, ...prev]);
      cancelAdding();
      toast('Billing method added.', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add billing method.', 'error');
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBillingMethod(id);
      setMethods((prev) => prev.filter((m) => m.id !== id));
      toast('Billing method removed.');
    } catch {
      toast('Could not remove billing method.', 'error');
    }
  }

  async function handleSetDefault(id: string) {
    try {
      await setDefaultBillingMethod(id);
      setMethods((prev) => prev.map((m) => ({ ...m, isDefault: m.id === id })));
    } catch {
      toast('Could not update default.', 'error');
    }
  }

  return (
    <div className={styles.page}>
      <Link to="/dashboard/settings" className={styles.back}>
        <ChevronLeft size={15} strokeWidth={2} />
        Account Settings
      </Link>

      <div className={styles.header}>
        <h1 className={styles.title}>Billing &amp; payments</h1>
        <p className={styles.subtitle}>
          Manage how you pay for upgrades and add-ons on BuildMatch.
        </p>
      </div>

      {/* Existing methods + Add flow share one card */}
      {!adding ? (
        <div className={styles.card}>
          <p className={styles.sectionTitle}>Billing methods</p>

          {loading ? (
            <p style={mutedText}>Loading…</p>
          ) : methods.length === 0 ? (
            <>
              <p style={{ ...mutedText, marginBottom: 16 }}>
                You haven't set up any billing methods yet. Your billing method will be charged only
                when your available balance from BuildMatch earnings is not sufficient to pay for
                your monthly membership and/or add-ons.
              </p>
              <button type="button" onClick={startAdding} style={addLinkStyle}>
                <Plus size={16} strokeWidth={2} />
                Add a billing method
              </button>
            </>
          ) : (
            <>
              <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0 }}>
                {methods.map((m) => (
                  <MethodRow
                    key={m.id}
                    method={m}
                    onSetDefault={() => handleSetDefault(m.id)}
                    onDelete={() => handleDelete(m.id)}
                  />
                ))}
              </ul>
              <button type="button" onClick={startAdding} style={addLinkStyle}>
                <Plus size={16} strokeWidth={2} />
                Add a billing method
              </button>
            </>
          )}
        </div>
      ) : (
        <AddBillingMethodCard
          mode={mode}
          setMode={setMode}
          onCancel={cancelAdding}
          onSubmit={handleSubmit}
          defaultName={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim()}
        />
      )}
    </div>
  );
}

// ── Method row ──────────────────────────────────────────────────────────────

function MethodRow({
  method, onSetDefault, onDelete,
}: { method: BillingMethod; onSetDefault: () => void; onDelete: () => void }) {
  const label =
    method.type === 'CARD'
      ? `${method.brand ?? 'Card'} ending in ${method.last4}`
      : method.type === 'PAYPAL'
        ? `PayPal · ${method.accountEmail}`
        : `Venmo · ${method.accountEmail}`;

  const sub =
    method.type === 'CARD'
      ? `Expires ${String(method.expMonth).padStart(2, '0')}/${String(method.expYear).slice(-2)}`
      : 'Connected account';

  return (
    <li style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      padding: '14px 0', borderBottom: '1px solid var(--color-border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 8, background: '#F8F7F5',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-text-muted)',
        }}>
          <CreditCard size={18} strokeWidth={1.75} />
        </div>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
            {label}
            {method.isDefault && (
              <span style={{
                marginLeft: 8, fontSize: 10, fontWeight: 600,
                padding: '2px 8px', borderRadius: 10,
                background: '#E8F4F0', color: 'var(--color-accent)',
                textTransform: 'uppercase', letterSpacing: 0.4,
              }}>
                Default
              </span>
            )}
          </p>
          <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>{sub}</p>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {!method.isDefault && (
          <button type="button" onClick={onSetDefault} style={smallLink}>Set as default</button>
        )}
        <button type="button" onClick={onDelete} style={iconBtn} aria-label="Remove">
          <Trash2 size={15} strokeWidth={1.75} />
        </button>
      </div>
    </li>
  );
}

// ── Add card ────────────────────────────────────────────────────────────────

function AddBillingMethodCard({
  mode, setMode, onCancel, onSubmit, defaultName,
}: {
  mode: AddMode;
  setMode: (m: AddMode) => void;
  onCancel: () => void;
  onSubmit: (p: AddBillingMethodPayload) => Promise<void>;
  defaultName: string;
}) {
  return (
    <div className={styles.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <p className={styles.sectionTitle} style={{ marginBottom: 0 }}>Add a billing method</p>
        <button type="button" onClick={onCancel} style={cancelBtnStyle}>Cancel</button>
      </div>

      <Option
        selected={mode === 'CARD'}
        onSelect={() => setMode('CARD')}
        label={<>Debit or credit card <CardLogos /></>}
      />
      {mode === 'CARD' && (
        <CardForm
          onSubmit={onSubmit}
          defaultName={defaultName}
        />
      )}

      <Option
        selected={mode === 'PAYPAL'}
        onSelect={() => setMode('PAYPAL')}
        label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><PaypalMark /></span>}
      />
      {mode === 'PAYPAL' && (
        <ConnectForm
          provider="PAYPAL"
          onSubmit={(email) => onSubmit({ type: 'PAYPAL', accountEmail: email })}
        />
      )}

      <Option
        selected={mode === 'VENMO'}
        onSelect={() => setMode('VENMO')}
        label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><VenmoMark /></span>}
      />
      {mode === 'VENMO' && (
        <ConnectForm
          provider="VENMO"
          onSubmit={(email) => onSubmit({ type: 'VENMO', accountEmail: email })}
        />
      )}
    </div>
  );
}

function Option({ selected, onSelect, label }: {
  selected: boolean; onSelect: () => void; label: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onSelect} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', padding: '18px 0',
      background: 'none', border: 'none', borderTop: '1px solid var(--color-border)',
      cursor: 'pointer', textAlign: 'left',
    }}>
      <span style={{
        width: 18, height: 18, borderRadius: '50%',
        border: `2px solid ${selected ? 'var(--color-accent)' : '#D1D5DB'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        {selected && <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-accent)' }} />}
      </span>
      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)', display: 'inline-flex', alignItems: 'center', gap: 12 }}>
        {label}
      </span>
    </button>
  );
}

// ── Card form ───────────────────────────────────────────────────────────────

function CardForm({
  onSubmit, defaultName,
}: { onSubmit: (p: AddBillingMethodPayload) => Promise<void>; defaultName: string }) {
  const [cardNumber, setCardNumber] = useState('');
  const [firstName,  setFirstName]  = useState(defaultName.split(' ')[0]  ?? '');
  const [lastName,   setLastName]   = useState(defaultName.split(' ').slice(1).join(' ') ?? '');
  const [expMonth,   setExpMonth]   = useState('');
  const [expYear,    setExpYear]    = useState('');
  const [cvc,        setCvc]        = useState('');
  const [country,    setCountry]    = useState('United States');
  const [line1,      setLine1]      = useState('');
  const [line2,      setLine2]      = useState('');
  const [city,       setCity]       = useState('');
  const [stateName,  setStateName]  = useState('');
  const [zip,        setZip]        = useState('');
  const [submitting, setSubmitting] = useState(false);

  function formatCardNumber(v: string): string {
    const digits = v.replace(/\D/g, '').slice(0, 19);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  }

  async function handleSave() {
    if (!cardNumber.trim() || !firstName || !lastName || !expMonth || !expYear || !cvc) return;
    if (!line1 || !city || !stateName || !zip) return;
    setSubmitting(true);
    try {
      await onSubmit({
        type:         'CARD',
        cardNumber,
        holderName:   `${firstName} ${lastName}`.trim(),
        expMonth:     parseInt(expMonth,  10),
        expYear:      parseInt(expYear,   10),
        country,
        addressLine1: line1,
        addressLine2: line2 || undefined,
        city,
        state:        stateName,
        zipCode:      zip,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ padding: '4px 0 20px' }}>
      <Field label="Card number">
        <div style={{ position: 'relative' }}>
          <CreditCard
            size={16}
            strokeWidth={1.75}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}
          />
          <input
            type="text"
            inputMode="numeric"
            placeholder="1234 5678 9012 3456"
            value={cardNumber}
            onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
            style={{ ...inputStyle, paddingLeft: 38, paddingRight: 130 }}
          />
          <span style={{
            position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
            fontSize: 11, color: 'var(--color-text-muted)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}>
            <Lock size={11} /> Securely stored
          </span>
        </div>
      </Field>

      <TwoCol>
        <Field label="First name">
          <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="Last name">
          <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} style={inputStyle} />
        </Field>
      </TwoCol>

      <TwoCol>
        <Field label="Expiration month">
          <input type="text" inputMode="numeric" placeholder="MM" maxLength={2} value={expMonth} onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ''))} style={inputStyle} />
        </Field>
        <Field label="Expiration year">
          <input type="text" inputMode="numeric" placeholder="YY" maxLength={4} value={expYear} onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ''))} style={inputStyle} />
        </Field>
      </TwoCol>

      <Field label={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Security code <HelpCircle size={12} strokeWidth={1.75} /></span>}>
        <input type="text" inputMode="numeric" placeholder="3 digits" maxLength={4} value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, ''))} style={{ ...inputStyle, maxWidth: 200 }} />
      </Field>

      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '20px 0 12px', color: 'var(--color-text-primary)' }}>Billing address</h3>

      <Field label="Country">
        <select value={country} onChange={(e) => setCountry(e.target.value)} style={inputStyle}>
          <option>United States</option>
          <option>Canada</option>
          <option>United Kingdom</option>
          <option>Australia</option>
          <option>Other</option>
        </select>
      </Field>

      <Field label="Address line 1">
        <input type="text" value={line1} onChange={(e) => setLine1(e.target.value)} style={inputStyle} />
      </Field>

      <Field label={<>Address line 2 <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>(optional)</span></>}>
        <input type="text" value={line2} onChange={(e) => setLine2(e.target.value)} style={inputStyle} />
      </Field>

      <TwoCol>
        <Field label="City">
          <input type="text" value={city} onChange={(e) => setCity(e.target.value)} style={inputStyle} />
        </Field>
        <Field label="State">
          <select value={stateName} onChange={(e) => setStateName(e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </TwoCol>

      <Field label="ZIP code">
        <input type="text" inputMode="numeric" maxLength={10} value={zip} onChange={(e) => setZip(e.target.value)} style={{ ...inputStyle, maxWidth: 200 }} />
      </Field>

      <Button variant="primary" size="md" onClick={handleSave} disabled={submitting}>
        {submitting ? 'Saving…' : 'Save'}
      </Button>
    </div>
  );
}

function ConnectForm({
  provider, onSubmit,
}: { provider: 'PAYPAL' | 'VENMO'; onSubmit: (email: string) => Promise<void> }) {
  const [email, setEmail]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const label = provider === 'PAYPAL' ? 'PayPal' : 'Venmo';

  async function handle() {
    if (!email.trim()) return;
    setSubmitting(true);
    try { await onSubmit(email.trim()); }
    finally { setSubmitting(false); }
  }

  return (
    <div style={{ padding: '4px 0 20px' }}>
      <p style={{ ...mutedText, marginBottom: 12 }}>
        Enter the email address associated with your {label} account. We'll use it to charge you for
        upgrades and add-ons.
      </p>
      <Field label={`${label} email`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={`you@${provider === 'PAYPAL' ? 'paypal' : 'venmo'}.com`}
          style={inputStyle}
        />
      </Field>
      <Button variant="primary" size="md" onClick={handle} disabled={submitting}>
        {submitting ? 'Connecting…' : `Connect ${label}`}
      </Button>
    </div>
  );
}

// ── Tiny helpers ────────────────────────────────────────────────────────────

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function TwoCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

// ── Brand marks (inline SVG/text — no extra dependencies) ───────────────────

function CardLogos() {
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <Pill color="#1A1F71" bg="#fff" border>VISA</Pill>
      <Pill color="#fff" bg="#EB001B">MC</Pill>
      <Pill color="#fff" bg="#006FCF">AMEX</Pill>
      <Pill color="#fff" bg="#FF6000">DISC</Pill>
      <Pill color="#fff" bg="#0079BE">DC</Pill>
    </span>
  );
}
function Pill({ children, color, bg, border }: { children: React.ReactNode; color: string; bg: string; border?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      minWidth: 32, height: 20, borderRadius: 4,
      background: bg, color, fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
      padding: '0 6px',
      border: border ? '1px solid #E5E4E0' : 'none',
    }}>{children}</span>
  );
}
function PaypalMark() {
  return <span style={{ fontSize: 18, fontWeight: 700, color: '#003087', fontStyle: 'italic' }}>Pay<span style={{ color: '#009cde' }}>Pal</span></span>;
}
function VenmoMark() {
  return <span style={{ fontSize: 18, fontWeight: 800, color: '#3D95CE', fontStyle: 'italic' }}>venmo</span>;
}

// ── Style constants ─────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', fontSize: 14,
  border: '1px solid var(--color-border)', borderRadius: 8,
  background: '#fff', fontFamily: 'inherit',
};
const mutedText: React.CSSProperties = {
  fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.6, margin: 0,
};
const addLinkStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--color-accent)', fontSize: 13, fontWeight: 500, padding: 0,
};
const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 18px', fontSize: 13, fontWeight: 500,
  background: '#fff', color: 'var(--color-accent)',
  border: '1px solid var(--color-border)', borderRadius: 8, cursor: 'pointer',
};
const smallLink: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 12, color: 'var(--color-accent)', fontWeight: 500,
};
const iconBtn: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  padding: 6, color: 'var(--color-text-muted)', borderRadius: 6,
};
