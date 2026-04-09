import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, X, Camera, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react';
import { getSupabaseClient } from '../lib/supabase';
import * as idSvc from '../services/id-verification.service';

// ── Mobile-only ID verification flow (Upwork-style) ─────────────────────────
// Public route — auth is the path-param session token. Phones only (no tablets).

type Stage =
  | 'loading'
  | 'gate'         // not a phone / no token / expired
  | 'country'
  | 'idType'
  | 'terms'
  | 'docCapture'
  | 'docPreview'
  | 'selfieCapture'
  | 'selfiePreview'
  | 'submitting'
  | 'done'
  | 'error';

type IdType = 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE';

const COUNTRIES = [
  'United States', 'Canada', 'United Kingdom', 'Australia', 'Nigeria', 'India', 'Germany',
  'France', 'Spain', 'Italy', 'Mexico', 'Brazil', 'South Africa', 'Japan', 'China',
  'Other',
];

const ID_TYPES: { value: IdType; label: string; desc: string }[] = [
  { value: 'PASSPORT',         label: 'Passport',          desc: 'International travel document' },
  { value: 'NATIONAL_ID',      label: 'National ID',       desc: 'Government-issued ID card' },
  { value: 'DRIVERS_LICENSE',  label: "Driver's license",  desc: 'Government-issued driving permit' },
];

function isPhoneClient(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iPad/i.test(ua)) return false;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return false;
  // Reject anything wider than typical phones (most phones < 500px CSS px portrait)
  const w = Math.min(window.innerWidth, window.innerHeight);
  if (w > 540) return false;
  return /iPhone|Android.*Mobile|iPod/i.test(ua);
}

export function MobileIdVerificationPage() {
  const { token = '' }                  = useParams();
  const [stage, setStage]               = useState<Stage>('loading');
  const [errorMsg, setErrorMsg]         = useState('');
  const [country, setCountry]           = useState('');
  const [idType, setIdType]             = useState<IdType | ''>('');
  const [agreed, setAgreed]             = useState(false);
  const [docFile, setDocFile]           = useState<File | null>(null);
  const [docUrl, setDocUrl]             = useState<string>('');
  const [selfieFile, setSelfieFile]     = useState<File | null>(null);
  const [selfieUrl, setSelfieUrl]       = useState<string>('');

  const docInputRef    = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  // Initial validation: phone check + token resolve
  useEffect(() => {
    (async () => {
      if (!isPhoneClient()) {
        setStage('gate');
        setErrorMsg('Open this link on your phone to continue.');
        return;
      }
      try {
        await idSvc.getMobileSession(token);
        setStage('country');
      } catch (err) {
        const m = err instanceof Error ? err.message : 'This link is no longer valid.';
        setErrorMsg(m);
        setStage('gate');
      }
    })();
  }, [token]);

  // Cleanup object URLs
  useEffect(() => () => {
    if (docUrl)    URL.revokeObjectURL(docUrl);
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
  }, [docUrl, selfieUrl]);

  function handleDocPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (docUrl) URL.revokeObjectURL(docUrl);
    setDocFile(f);
    setDocUrl(URL.createObjectURL(f));
    setStage('docPreview');
  }
  function handleSelfiePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (selfieUrl) URL.revokeObjectURL(selfieUrl);
    setSelfieFile(f);
    setSelfieUrl(URL.createObjectURL(f));
    setStage('selfiePreview');
  }

  async function uploadFile(kind: 'document' | 'selfie', file: File): Promise<string> {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const presign = await idSvc.presignMobileUpload(token, kind, ext);
    const supabase = getSupabaseClient();
    const { error } = await supabase.storage
      .from(presign.bucket)
      .uploadToSignedUrl(presign.path, presign.token, file, { contentType: file.type });
    if (error) throw new Error(error.message);
    const { data } = supabase.storage.from(presign.bucket).getPublicUrl(presign.path);
    return data.publicUrl;
  }

  async function handleSubmit() {
    if (!docFile || !selfieFile || !country || !idType) return;
    setStage('submitting');
    try {
      const [documentUrl, selfiePublic] = await Promise.all([
        uploadFile('document', docFile),
        uploadFile('selfie',   selfieFile),
      ]);
      await idSvc.completeMobileSession(token, {
        documentUrl,
        selfieUrl: selfiePublic,
        country,
        idType,
      });
      setStage('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setStage('error');
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={pageStyle}>
      {stage === 'loading' && (
        <div style={centerStyle}>
          <p style={{ color: '#6B6B67', fontSize: 14 }}>Loading…</p>
        </div>
      )}

      {stage === 'gate' && (
        <div style={centerStyle}>
          <div style={iconCircleStyle('#FEE2E2')}>
            <Smartphone size={28} color="#B91C1C" strokeWidth={1.75} />
          </div>
          <h1 style={h1Style}>Phone required</h1>
          <p style={pMutedStyle}>{errorMsg || 'This page only works on mobile phones.'}</p>
        </div>
      )}

      {stage === 'country' && (
        <StepFrame title="Select the country that issued your ID" onBack={null}>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={selectStyle}
          >
            <option value="">Select a country</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <BigButton disabled={!country} onClick={() => setStage('idType')}>Select</BigButton>
        </StepFrame>
      )}

      {stage === 'idType' && (
        <StepFrame title="Select an ID for verification" onBack={() => setStage('country')}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {ID_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => { setIdType(t.value); setStage('terms'); }}
                style={listItemStyle}
              >
                <div>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#1A1A18' }}>{t.label}</div>
                  <div style={{ fontSize: 13, color: '#6B6B67', marginTop: 2 }}>{t.desc}</div>
                </div>
                <ChevronLeft size={18} style={{ transform: 'rotate(180deg)', color: '#6B6B67' }} />
              </button>
            ))}
          </div>
        </StepFrame>
      )}

      {stage === 'terms' && (
        <StepFrame title="Agree to terms & conditions" onBack={() => setStage('idType')}>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#1A1A18' }}>
            I agree that BuildMatch may collect, store, and review my photo ID and selfie to verify
            my identity. I understand my images will only be used for this purpose, and that my
            data is encrypted and never sold or shared with third parties.
          </p>

          <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', cursor: 'pointer', marginTop: 12 }}>
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              style={{ marginTop: 3, width: 18, height: 18 }}
            />
            <span style={{ fontSize: 14, color: '#1A1A18' }}>
              I confirm that I have read and understood the Terms &amp; Conditions.
            </span>
          </label>

          <div style={{ flex: 1 }} />
          <BigButton disabled={!agreed} onClick={() => setStage('docCapture')}>Begin verifying</BigButton>
        </StepFrame>
      )}

      {stage === 'docCapture' && (
        <StepFrame title={idType === 'PASSPORT' ? 'Passport' : idType === 'DRIVERS_LICENSE' ? "Driver's license" : 'National ID'} onBack={() => setStage('terms')}>
          <ul style={{ paddingLeft: 20, color: '#1A1A18', fontSize: 14, lineHeight: 1.7 }}>
            <li>Use your physical ID — not a screen or printed copy.</li>
            <li>Avoid backlighting from windows or bright light sources.</li>
            <li>Move your ID toward the camera until it's in focus and not blurry.</li>
            <li>Make sure your entire ID is visible and within the frame.</li>
          </ul>
          <div style={{ flex: 1 }} />
          <input
            ref={docInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleDocPick}
            style={{ display: 'none' }}
          />
          <BigButton onClick={() => docInputRef.current?.click()}>
            <Camera size={20} strokeWidth={2} />
          </BigButton>
        </StepFrame>
      )}

      {stage === 'docPreview' && docUrl && (
        <StepFrame title="Review your photo" onBack={() => setStage('docCapture')}>
          <img src={docUrl} alt="ID" style={previewImgStyle} />
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <BigButton variant="ghost" onClick={() => { setDocFile(null); setDocUrl(''); setStage('docCapture'); }}>
              Retake
            </BigButton>
            <BigButton onClick={() => setStage('selfieCapture')}>Looks good</BigButton>
          </div>
        </StepFrame>
      )}

      {stage === 'selfieCapture' && (
        <StepFrame title="Take a selfie" onBack={() => setStage('docPreview')}>
          <p style={{ fontSize: 14, color: '#1A1A18', lineHeight: 1.6 }}>
            We'll match your face to the photo on your ID. Find good lighting, look straight at the
            camera, and remove glasses or hats if you can.
          </p>
          <div style={{ flex: 1 }} />
          <input
            ref={selfieInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleSelfiePick}
            style={{ display: 'none' }}
          />
          <BigButton onClick={() => selfieInputRef.current?.click()}>
            <Camera size={20} strokeWidth={2} />
          </BigButton>
        </StepFrame>
      )}

      {stage === 'selfiePreview' && selfieUrl && (
        <StepFrame title="Review your selfie" onBack={() => setStage('selfieCapture')}>
          <img src={selfieUrl} alt="Selfie" style={previewImgStyle} />
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <BigButton variant="ghost" onClick={() => { setSelfieFile(null); setSelfieUrl(''); setStage('selfieCapture'); }}>
              Retake
            </BigButton>
            <BigButton onClick={handleSubmit}>Submit</BigButton>
          </div>
        </StepFrame>
      )}

      {stage === 'submitting' && (
        <div style={centerStyle}>
          <h1 style={h1Style}>Submitting your ID</h1>
          <p style={pMutedStyle}>This will only take a few seconds.</p>
          <div style={spinnerStyle} />
        </div>
      )}

      {stage === 'done' && (
        <div style={centerStyle}>
          <div style={iconCircleStyle('#E8F4F0')}>
            <CheckCircle2 size={28} color="#0F6E56" strokeWidth={1.75} />
          </div>
          <h1 style={h1Style}>You're all set</h1>
          <p style={pMutedStyle}>
            Your documents have been submitted. Our team will review them within 1 business day.
            You can close this tab and return to your computer.
          </p>
        </div>
      )}

      {stage === 'error' && (
        <div style={centerStyle}>
          <div style={iconCircleStyle('#FEE2E2')}>
            <AlertTriangle size={28} color="#B91C1C" strokeWidth={1.75} />
          </div>
          <h1 style={h1Style}>Something went wrong</h1>
          <p style={pMutedStyle}>{errorMsg}</p>
          <BigButton onClick={() => setStage('docCapture')}>Try again</BigButton>
        </div>
      )}
    </div>
  );
}

// ── Layout helpers ──────────────────────────────────────────────────────────

function StepFrame({
  title, onBack, children,
}: { title: string; onBack: (() => void) | null; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', padding: '20px 22px 28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        {onBack ? (
          <button type="button" onClick={onBack} style={iconBtnStyle} aria-label="Back">
            <ChevronLeft size={24} strokeWidth={2} />
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={() => window.close()}
          style={iconBtnStyle}
          aria-label="Close"
        >
          <X size={22} strokeWidth={2} />
        </button>
      </div>
      <h1 style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.2, margin: '0 0 24px', color: '#1A1A18' }}>
        {title}
      </h1>
      {children}
    </div>
  );
}

function BigButton({
  children, onClick, disabled, variant = 'primary',
}: {
  children: React.ReactNode;
  onClick?:  () => void;
  disabled?: boolean;
  variant?:  'primary' | 'ghost';
}) {
  const isPrimary = variant === 'primary';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        padding: '18px 22px',
        background: isPrimary ? (disabled ? '#9CA3AF' : '#0F6E56') : 'transparent',
        color: isPrimary ? '#fff' : '#0F6E56',
        border: isPrimary ? 'none' : '1.5px solid #0F6E56',
        borderRadius: 12,
        fontSize: 16,
        fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      }}
    >
      {children}
    </button>
  );
}

// ── Inline style constants ──────────────────────────────────────────────────

const pageStyle: React.CSSProperties = {
  minHeight:  '100dvh',
  background: '#fff',
  color:      '#1A1A18',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};
const centerStyle: React.CSSProperties = {
  minHeight: '100dvh',
  padding:   '40px 24px',
  display:   'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  gap: 16,
};
const h1Style: React.CSSProperties = { fontSize: 24, fontWeight: 600, margin: 0 };
const pMutedStyle: React.CSSProperties = { fontSize: 14, color: '#6B6B67', maxWidth: 320, lineHeight: 1.6, margin: 0 };
const iconBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#1A1A18',
  padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const selectStyle: React.CSSProperties = {
  width: '100%', padding: '16px 14px', fontSize: 16,
  border: '1px solid #E5E4E0', borderRadius: 10, background: '#fff', appearance: 'auto',
};
const listItemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '18px 4px', borderTop: '1px solid #1A1A18',
  background: 'none', cursor: 'pointer', textAlign: 'left', width: '100%',
};
const previewImgStyle: React.CSSProperties = {
  width: '100%', borderRadius: 12, border: '1px solid #E5E4E0', maxHeight: '60vh', objectFit: 'contain',
};
const spinnerStyle: React.CSSProperties = {
  width: 36, height: 36, borderRadius: '50%',
  border: '3px solid #E5E4E0', borderTopColor: '#0F6E56',
  animation: 'spin 0.9s linear infinite', marginTop: 12,
};
const iconCircleStyle = (bg: string): React.CSSProperties => ({
  width: 56, height: 56, borderRadius: '50%', background: bg,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});
