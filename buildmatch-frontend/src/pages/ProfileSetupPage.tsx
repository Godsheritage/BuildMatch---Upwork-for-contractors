import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, MapPin, Star, Clock, ShieldCheck, Camera } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../hooks/useAuth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Avatar } from '../components/ui/Avatar';
import { updateMyProfile } from '../services/contractor.service';
import { uploadAvatar } from '../services/storage.service';

// ── Constants ──────────────────────────────────────────────────────────────

const TRADE_TYPES = [
  { value: 'GENERAL',     label: 'General'     },
  { value: 'ELECTRICAL',  label: 'Electrical'  },
  { value: 'PLUMBING',    label: 'Plumbing'    },
  { value: 'HVAC',        label: 'HVAC'        },
  { value: 'ROOFING',     label: 'Roofing'     },
  { value: 'FLOORING',    label: 'Flooring'    },
  { value: 'PAINTING',    label: 'Painting'    },
  { value: 'LANDSCAPING', label: 'Landscaping' },
  { value: 'DEMOLITION',  label: 'Demolition'  },
  { value: 'OTHER',       label: 'Other'       },
];

const US_STATES = [
  { value: 'AL', label: 'Alabama' },       { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },       { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },    { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },   { value: 'DE', label: 'Delaware' },
  { value: 'DC', label: 'D.C.' },          { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },       { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },         { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },       { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },        { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },     { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },      { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },      { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },   { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },       { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },        { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },    { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },      { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },      { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },{ value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },     { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },          { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },      { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' }, { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
];

const STEPS = ['Basic Info', 'Credentials', 'Rate & Location', 'Review'];

// ── Form state ─────────────────────────────────────────────────────────────

interface FormData {
  bio: string;
  specialties: string[];
  yearsExperience: string;
  licenseNumber: string;
  licenseState: string;
  insuranceExpiry: string;
  hourlyRateMin: string;
  hourlyRateMax: string;
  city: string;
  state: string;
  zipCode: string;
  isAvailable: boolean;
  avatarUrl: string;
}

const INITIAL: FormData = {
  bio: '', specialties: [], yearsExperience: '',
  licenseNumber: '', licenseState: '', insuranceExpiry: '',
  hourlyRateMin: '', hourlyRateMax: '',
  city: '', state: '', zipCode: '',
  isAvailable: true,
  avatarUrl: '',
};

// ── Shared field styles ────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  width: '100%',
  border: '1px solid #E8E8E8',
  borderRadius: 8,
  padding: '9px 12px',
  fontSize: 14,
  background: '#fff',
  outline: 'none',
  fontFamily: 'inherit',
  color: '#111',
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  paddingRight: 32,
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 13,
  fontWeight: 500,
  color: '#111',
  marginBottom: 6,
};

// ── Progress indicator ─────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 40 }}>
      {STEPS.map((label, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 72 }}>
              <div
                style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done || active ? '#111' : '#F0F0F0',
                  color: done || active ? '#fff' : '#aaa',
                  fontSize: 13, fontWeight: 600,
                  transition: 'background 0.2s',
                }}
              >
                {done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </div>
              <span
                style={{
                  fontSize: 11, fontWeight: 500, textAlign: 'center',
                  color: active ? '#111' : done ? '#555' : '#aaa',
                  letterSpacing: '0.01em', lineHeight: 1.3,
                }}
              >
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1, height: 1,
                  background: i < current ? '#111' : '#E8E8E8',
                  marginTop: 16, transition: 'background 0.2s',
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Step 1: Basic Info ─────────────────────────────────────────────────────

function Step1({
  data, onChange, avatarFile, onAvatarFile,
}: {
  data: FormData;
  onChange: (patch: Partial<FormData>) => void;
  avatarFile: File | null;
  onAvatarFile: (f: File | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewUrl = avatarFile ? URL.createObjectURL(avatarFile) : data.avatarUrl || null;

  const toggleSpecialty = (val: string) => {
    const next = data.specialties.includes(val)
      ? data.specialties.filter((s) => s !== val)
      : [...data.specialties, val];
    onChange({ specialties: next });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Avatar upload */}
      <div>
        <label style={labelStyle}>Profile photo (optional)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 4 }}>
          <div
            style={{
              width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
              border: '2px dashed #E0E0E0', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#F8F8F8', cursor: 'pointer', position: 'relative',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            {previewUrl ? (
              <img src={previewUrl} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <Camera size={22} color="#bbb" strokeWidth={1.5} />
            )}
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                fontSize: 13, fontWeight: 500, color: '#111',
                background: 'none', border: '1px solid #E0E0E0',
                borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
              }}
            >
              {previewUrl ? 'Change photo' : 'Upload photo'}
            </button>
            {previewUrl && (
              <button
                type="button"
                onClick={() => { onAvatarFile(null); onChange({ avatarUrl: '' }); }}
                style={{
                  fontSize: 12, color: '#999', background: 'none',
                  border: 'none', cursor: 'pointer', marginLeft: 10,
                  textDecoration: 'underline', textUnderlineOffset: 2,
                }}
              >
                Remove
              </button>
            )}
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 5 }}>JPG or PNG, max 2 MB</p>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file && file.size <= 2 * 1024 * 1024) onAvatarFile(file);
            e.target.value = '';
          }}
        />
      </div>

      {/* Bio */}
      <div>
        <label style={labelStyle}>Bio</label>
        <div style={{ position: 'relative' }}>
          <textarea
            value={data.bio}
            onChange={(e) => onChange({ bio: e.target.value.slice(0, 500) })}
            placeholder="Tell investors about your work, your approach, and what sets you apart..."
            rows={4}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              border: '1px solid #E8E8E8', borderRadius: 8,
              padding: '10px 12px', paddingBottom: 28,
              fontSize: 14, color: '#111', fontFamily: 'inherit',
              outline: 'none', lineHeight: 1.6,
            }}
          />
          <span
            style={{
              position: 'absolute', bottom: 8, right: 12,
              fontSize: 11, color: data.bio.length >= 450 ? '#BA7517' : '#bbb',
            }}
          >
            {data.bio.length}/500
          </span>
        </div>
      </div>

      {/* Specialties */}
      <div>
        <label style={labelStyle}>Specialties</label>
        <p style={{ fontSize: 12, color: '#999', marginBottom: 10, marginTop: -2 }}>
          Select all that apply
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {TRADE_TYPES.map(({ value, label }) => {
            const selected = data.specialties.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggleSpecialty(value)}
                style={{
                  padding: '6px 14px', borderRadius: 20,
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  transition: 'all 0.12s',
                  border: selected ? '1.5px solid #111' : '1px solid #E0E0E0',
                  background: selected ? '#111' : '#fff',
                  color: selected ? '#fff' : '#555',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Years of experience */}
      <div style={{ maxWidth: 220 }}>
        <Input
          id="yearsExperience"
          type="number"
          label="Years of experience"
          placeholder="0"
          min={0}
          max={50}
          value={data.yearsExperience}
          onChange={(e) => {
            const v = e.target.value;
            const n = parseInt(v, 10);
            if (v === '' || (n >= 0 && n <= 50)) onChange({ yearsExperience: v });
          }}
        />
      </div>
    </div>
  );
}

// ── Step 2: Credentials ────────────────────────────────────────────────────

function Step2({
  data, onChange,
}: {
  data: FormData;
  onChange: (patch: Partial<FormData>) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        All fields are optional. This information helps build trust with investors.
      </p>

      <Input
        id="licenseNumber"
        label="License number (optional)"
        placeholder="e.g. LIC-123456"
        value={data.licenseNumber}
        onChange={(e) => onChange({ licenseNumber: e.target.value })}
      />

      <div>
        <label style={labelStyle}>License state (optional)</label>
        <select
          value={data.licenseState}
          onChange={(e) => onChange({ licenseState: e.target.value })}
          style={{ ...selectStyle, color: data.licenseState ? '#111' : '#aaa' }}
        >
          <option value="">Select state</option>
          {US_STATES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>Insurance expiry date (optional)</label>
        <input
          type="date"
          value={data.insuranceExpiry}
          onChange={(e) => onChange({ insuranceExpiry: e.target.value })}
          style={{ ...selectStyle, color: data.insuranceExpiry ? '#111' : '#aaa' }}
        />
      </div>
    </div>
  );
}

// ── Step 3: Rate & Location ────────────────────────────────────────────────

function Step3({
  data, onChange, errors,
}: {
  data: FormData;
  onChange: (patch: Partial<FormData>) => void;
  errors: Record<string, string>;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hourly rate */}
      <div>
        <label style={labelStyle}>Hourly rate range (optional)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Input
            id="hourlyRateMin"
            type="number"
            label="Min $"
            placeholder="0"
            min={0}
            value={data.hourlyRateMin}
            onChange={(e) => onChange({ hourlyRateMin: e.target.value })}
            error={errors.hourlyRateMin}
          />
          <Input
            id="hourlyRateMax"
            type="number"
            label="Max $"
            placeholder="0"
            min={0}
            value={data.hourlyRateMax}
            onChange={(e) => onChange({ hourlyRateMax: e.target.value })}
          />
        </div>
      </div>

      {/* Location */}
      <Input
        id="city"
        label="City"
        placeholder="San Francisco"
        value={data.city}
        onChange={(e) => onChange({ city: e.target.value })}
      />

      <div>
        <label style={labelStyle}>State</label>
        <select
          value={data.state}
          onChange={(e) => onChange({ state: e.target.value })}
          style={{ ...selectStyle, color: data.state ? '#111' : '#aaa' }}
        >
          <option value="">Select state</option>
          {US_STATES.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      <div style={{ maxWidth: 200 }}>
        <Input
          id="zipCode"
          label="Zip code"
          placeholder="94105"
          maxLength={5}
          value={data.zipCode}
          onChange={(e) => onChange({ zipCode: e.target.value.replace(/\D/g, '').slice(0, 5) })}
          error={errors.zipCode}
        />
      </div>

      {/* Availability toggle */}
      <div
        style={{
          border: '1px solid #E8E8E8', borderRadius: 10,
          padding: '16px 20px', marginTop: 4,
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
          {/* Toggle track */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <input
              type="checkbox"
              checked={data.isAvailable}
              onChange={(e) => onChange({ isAvailable: e.target.checked })}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <div
              onClick={() => onChange({ isAvailable: !data.isAvailable })}
              style={{
                width: 48, height: 26, borderRadius: 13, cursor: 'pointer',
                background: data.isAvailable ? '#111' : '#DCDCDC',
                transition: 'background 0.2s', position: 'relative',
              }}
            >
              <div
                style={{
                  position: 'absolute', top: 3,
                  left: data.isAvailable ? 25 : 3,
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
                  transition: 'left 0.2s',
                }}
              />
            </div>
          </div>
          <div>
            <p style={{ fontSize: 14, fontWeight: 500, color: '#111', margin: 0 }}>
              Available for new work
            </p>
            <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>
              Your profile will be shown to investors actively looking to hire
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// ── Step 4: Review ─────────────────────────────────────────────────────────

function ProfilePreviewCard({
  data, firstName, lastName,
}: {
  data: FormData;
  firstName: string;
  lastName: string;
}) {
  const fullName = `${firstName} ${lastName}`;
  const location = [data.city, data.state].filter(Boolean).join(', ');
  const hasRate = data.hourlyRateMin || data.hourlyRateMax;
  const rateLabel = hasRate
    ? `$${data.hourlyRateMin || '?'}–$${data.hourlyRateMax || '?'}/hr`
    : null;

  return (
    <div
      style={{
        border: '1px solid #E8E8E8', borderRadius: 12,
        padding: '24px', background: '#fff', maxWidth: 420, margin: '0 auto',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <Avatar name={fullName} size="md" />
        <div style={{ minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, color: '#111', margin: 0, letterSpacing: '-0.01em' }}>
            {fullName}
          </p>
          {location && (
            <p style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#888', margin: '3px 0 0' }}>
              <MapPin size={11} strokeWidth={2} />
              {location}
            </p>
          )}
        </div>
        {data.isAvailable && (
          <div
            style={{
              marginLeft: 'auto', flexShrink: 0,
              background: '#F0F0F0', color: '#555',
              fontSize: 11, fontWeight: 500,
              padding: '3px 10px', borderRadius: 20,
            }}
          >
            Available
          </div>
        )}
      </div>

      {/* Bio */}
      {data.bio && (
        <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6, marginBottom: 14 }}>
          {data.bio.length > 140 ? data.bio.slice(0, 140) + '…' : data.bio}
        </p>
      )}

      {/* Specialties */}
      {data.specialties.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {data.specialties.slice(0, 4).map((s) => {
            const label = TRADE_TYPES.find((t) => t.value === s)?.label ?? s;
            return (
              <span
                key={s}
                style={{
                  fontSize: 11, fontWeight: 500,
                  padding: '3px 10px', borderRadius: 20,
                  border: '1px solid #E0E0E0', color: '#555',
                }}
              >
                {label}
              </span>
            );
          })}
          {data.specialties.length > 4 && (
            <span style={{ fontSize: 11, color: '#999' }}>+{data.specialties.length - 4} more</span>
          )}
        </div>
      )}

      {/* Footer meta */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 16,
          paddingTop: 12, borderTop: '1px solid #F0F0F0',
          fontSize: 12, color: '#888',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Star size={11} strokeWidth={2} />
          New profile
        </span>
        {data.yearsExperience && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Clock size={11} strokeWidth={2} />
            {data.yearsExperience} yr{parseInt(data.yearsExperience, 10) !== 1 ? 's' : ''}
          </span>
        )}
        {rateLabel && (
          <span style={{ marginLeft: 'auto', fontWeight: 500, color: '#111' }}>
            {rateLabel}
          </span>
        )}
      </div>
    </div>
  );
}

function Step4({ data, firstName, lastName }: { data: FormData; firstName: string; lastName: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#111', marginBottom: 4 }}>
          Here's how your profile will look
        </p>
        <p style={{ fontSize: 13, color: '#888' }}>
          You can update any of this from the My Profile page at any time.
        </p>
      </div>

      <ProfilePreviewCard data={data} firstName={firstName} lastName={lastName} />

      {/* Credential badge if license provided */}
      {data.licenseNumber && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 8,
            background: '#F8F8F8', border: '1px solid #E8E8E8',
          }}
        >
          <ShieldCheck size={16} strokeWidth={2} color="#555" />
          <p style={{ fontSize: 13, color: '#555', margin: 0 }}>
            License {data.licenseNumber}{data.licenseState ? ` · ${data.licenseState}` : ''}
            {' '}<span style={{ color: '#aaa' }}>· Pending verification</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export function ProfileSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [data, setData] = useState<FormData>(INITIAL);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const update = (patch: Partial<FormData>) => {
    setData((prev) => ({ ...prev, ...patch }));
    const keys = Object.keys(patch);
    if (keys.some((k) => stepErrors[k])) {
      setStepErrors((prev) => {
        const next = { ...prev };
        keys.forEach((k) => delete next[k]);
        return next;
      });
    }
  };

  const validateCurrentStep = (): boolean => {
    if (step === 2) {
      const e: Record<string, string> = {};
      const min = parseFloat(data.hourlyRateMin);
      const max = parseFloat(data.hourlyRateMax);
      if (data.hourlyRateMin && data.hourlyRateMax && min > max) {
        e.hourlyRateMin = 'Min must be ≤ max';
      }
      if (data.zipCode && !/^\d{5}$/.test(data.zipCode)) {
        e.zipCode = 'Must be a 5-digit zip code';
      }
      setStepErrors(e);
      return Object.keys(e).length === 0;
    }
    return true;
  };

  const handleNext = () => {
    if (!validateCurrentStep()) return;
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBack = () => {
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setServerError('');
    try {
      // Build payload — only send fields the user actually filled in
      const payload: Record<string, unknown> = { isAvailable: data.isAvailable };
      if (data.bio.trim())           payload.bio             = data.bio.trim();
      if (data.specialties.length)   payload.specialties     = data.specialties;
      if (data.yearsExperience)      payload.yearsExperience = parseInt(data.yearsExperience, 10);
      if (data.licenseNumber.trim()) payload.licenseNumber   = data.licenseNumber.trim();
      if (data.licenseState)         payload.licenseState    = data.licenseState;
      if (data.insuranceExpiry)      payload.insuranceExpiry = new Date(data.insuranceExpiry).toISOString();
      if (data.hourlyRateMin)        payload.hourlyRateMin   = parseFloat(data.hourlyRateMin);
      if (data.hourlyRateMax)        payload.hourlyRateMax   = parseFloat(data.hourlyRateMax);
      if (data.city.trim())          payload.city            = data.city.trim();
      if (data.state)                payload.state           = data.state;
      if (data.zipCode)              payload.zipCode         = data.zipCode;

      if (avatarFile) {
        const url = await uploadAvatar(avatarFile, user.id);
        payload.avatarUrl = url;
      }

      await updateMyProfile(payload as never);
      navigate('/dashboard');
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setServerError(err.response.data.message as string);
      } else {
        setServerError('Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '40px 24px', minHeight: '100%', boxSizing: 'border-box' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 24, fontWeight: 600, color: '#111',
              letterSpacing: '-0.02em', marginBottom: 6,
            }}
          >
            Set up your contractor profile
          </h1>
          <p style={{ fontSize: 14, color: '#888' }}>
            Help investors find and hire you by completing your profile.
          </p>
        </div>

        {/* Card */}
        <div
          style={{
            background: '#fff', border: '1px solid #E8E8E8',
            borderRadius: 16, padding: '40px 48px',
          }}
        >
          <StepIndicator current={step} />

          {/* Step content */}
          <div style={{ minHeight: 280 }}>
            {step === 0 && <Step1 data={data} onChange={update} avatarFile={avatarFile} onAvatarFile={setAvatarFile} />}
            {step === 1 && <Step2 data={data} onChange={update} />}
            {step === 2 && <Step3 data={data} onChange={update} errors={stepErrors} />}
            {step === 3 && (
              <Step4
                data={data}
                firstName={user.firstName}
                lastName={user.lastName}
              />
            )}
          </div>

          {/* Server error */}
          {serverError && (
            <div
              style={{
                marginTop: 20,
                background: '#FFF5F5', border: '1px solid #FECACA',
                borderRadius: 8, padding: '10px 14px',
                fontSize: 13, color: '#DC2626',
              }}
            >
              {serverError}
            </div>
          )}

          {/* Navigation */}
          <div
            style={{
              display: 'flex',
              justifyContent: step === 0 ? 'flex-end' : 'space-between',
              alignItems: 'center',
              marginTop: 40, paddingTop: 24,
              borderTop: '1px solid #F0F0F0',
            }}
          >
            {step > 0 && (
              <Button variant="secondary" onClick={handleBack} disabled={isSubmitting}>
                Back
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={handleNext}>
                Continue
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Publishing…' : 'Looks good — publish profile'}
              </Button>
            )}
          </div>
        </div>

        {/* Skip link */}
        {step < STEPS.length - 1 && (
          <p style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: '#aaa' }}>
            <button
              type="button"
              onClick={() => navigate('/dashboard')}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#aaa', fontSize: 13, textDecoration: 'underline',
                textUnderlineOffset: 3,
              }}
            >
              Skip for now
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
