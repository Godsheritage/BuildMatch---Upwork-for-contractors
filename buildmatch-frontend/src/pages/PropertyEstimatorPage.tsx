import { useEffect, useState } from 'react';
import {
  Building2, Plus, ChevronRight, Loader, CheckCircle2,
  AlertTriangle, Camera, Sparkles, ArrowLeft, Trash2,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { getSupabaseClient } from '../lib/supabase';
import api from '../services/api';
import {
  listProperties, createProperty, deleteProperty,
  listEstimates, createEstimate, getEstimate, runEstimation,
  addEstimatePhoto, saveEstimateAnswers,
  type Property, type PropertyEstimate, type PropertyType, type RenovationPurpose, type PrimaryIssue,
} from '../services/property.service';

// ── Constants ────────────────────────────────────────────────────────────────

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: 'SINGLE_FAMILY', label: 'Single family' },
  { value: 'DUPLEX',        label: 'Duplex' },
  { value: 'TRIPLEX',       label: 'Triplex' },
  { value: 'FOURPLEX',      label: 'Fourplex' },
  { value: 'TOWNHOUSE',     label: 'Townhouse' },
  { value: 'CONDO',         label: 'Condo' },
  { value: 'MULTI_FAMILY',  label: 'Multi-family' },
  { value: 'COMMERCIAL',    label: 'Commercial' },
];

const PURPOSES: { value: RenovationPurpose; label: string }[] = [
  { value: 'FLIP',               label: 'Fix & flip' },
  { value: 'RENTAL',             label: 'Rental property' },
  { value: 'PRIMARY_RESIDENCE',  label: 'Primary residence' },
  { value: 'WHOLESALE',          label: 'Wholesale' },
];

const ISSUES: { value: PrimaryIssue; label: string }[] = [
  { value: 'COSMETIC',     label: 'Cosmetic refresh' },
  { value: 'FULL_GUT',     label: 'Full gut renovation' },
  { value: 'WATER_DAMAGE', label: 'Water damage' },
  { value: 'FIRE_DAMAGE',  label: 'Fire damage' },
  { value: 'NEGLECT',      label: 'Deferred maintenance / neglect' },
  { value: 'STRUCTURAL',   label: 'Structural issues' },
  { value: 'PARTIAL',      label: 'Partial renovation' },
];

const PHOTO_AREAS = [
  { key: 'exterior_front', label: 'Exterior — front' },
  { key: 'exterior_back',  label: 'Exterior — back' },
  { key: 'kitchen',        label: 'Kitchen' },
  { key: 'bathroom',       label: 'Bathroom(s)' },
  { key: 'living',         label: 'Living / main area' },
  { key: 'bedroom',        label: 'Bedrooms' },
  { key: 'basement',       label: 'Basement' },
  { key: 'roof',           label: 'Roof' },
  { key: 'damage',         label: 'Problem areas' },
  { key: 'other',          label: 'Other' },
];

const QUESTIONNAIRE = [
  { key: 'foundation_visible_cracks', q: 'Are there visible cracks in the foundation?' },
  { key: 'roof_condition',            q: 'What is the condition of the roof? (good / fair / poor / unknown)' },
  { key: 'hvac_functional',           q: 'Is the HVAC system currently functional?' },
  { key: 'plumbing_issues',           q: 'Any known plumbing issues? Describe if yes.' },
  { key: 'electrical_panel',          q: 'What type/size electrical panel? (e.g., 100A, 200A, unknown)' },
  { key: 'mold_present',             q: 'Is mold visible anywhere?' },
  { key: 'permits_needed',           q: 'Will you need permits? (yes / no / unsure)' },
];

// ── Page stages ──────────────────────────────────────────────────────────────

type Stage = 'list' | 'add-property' | 'wizard' | 'results';

export function PropertyEstimatorPage() {
  const { toast } = useToast();

  const [stage,      setStage]      = useState<Stage>('list');
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading,    setLoading]    = useState(true);

  // Wizard state
  const [activeProperty, setActiveProperty] = useState<Property | null>(null);
  const [activeEstimate, setActiveEstimate] = useState<PropertyEstimate | null>(null);

  useEffect(() => {
    listProperties().then(setProperties).catch(() => toast('Failed to load properties.', 'error')).finally(() => setLoading(false));
  }, [toast]);

  function handlePropertyCreated(prop: Property) {
    setProperties((p) => [prop, ...p]);
    setActiveProperty(prop);
    setStage('wizard');
  }

  async function handleDeleteProperty(id: string) {
    if (!confirm('Delete this property and all its estimates?')) return;
    try {
      await deleteProperty(id);
      setProperties((p) => p.filter((x) => x.id !== id));
      toast('Property deleted.');
    } catch { toast('Failed to delete.', 'error'); }
  }

  async function handleSelectProperty(prop: Property) {
    setActiveProperty(prop);
    try {
      const ests = await listEstimates(prop.id);
      if (ests.length > 0 && ests[0].status === 'COMPLETE') {
        setActiveEstimate(ests[0]);
        setStage('results');
      } else {
        setStage('wizard');
      }
    } catch {
      setStage('wizard');
    }
  }

  function handleEstimateReady(est: PropertyEstimate) {
    setActiveEstimate(est);
    setStage('results');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div>
      {stage === 'list' && (
        <PropertyList
          properties={properties}
          loading={loading}
          onAdd={() => setStage('add-property')}
          onSelect={handleSelectProperty}
          onDelete={handleDeleteProperty}
        />
      )}
      {stage === 'add-property' && (
        <AddPropertyForm
          onBack={() => setStage('list')}
          onCreated={handlePropertyCreated}
        />
      )}
      {stage === 'wizard' && activeProperty && (
        <EstimateWizard
          property={activeProperty}
          onBack={() => setStage('list')}
          onComplete={handleEstimateReady}
        />
      )}
      {stage === 'results' && activeEstimate && activeProperty && (
        <EstimateResults
          estimate={activeEstimate}
          property={activeProperty}
          onBack={() => setStage('list')}
          onNewEstimate={() => setStage('wizard')}
        />
      )}
    </div>
  );
}

// ── Property list ────────────────────────────────────────────────────────────

function PropertyList({
  properties, loading, onAdd, onSelect, onDelete,
}: {
  properties: Property[];
  loading:    boolean;
  onAdd:      () => void;
  onSelect:   (p: Property) => void;
  onDelete:   (id: string) => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Your properties</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Add a property and get an AI-powered renovation estimate.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus size={14} /> Add property
        </Button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</p>
      ) : properties.length === 0 ? (
        <div style={emptyStyle}>
          <Building2 size={40} strokeWidth={1} color="#9CA3AF" />
          <p style={{ margin: '12px 0 0', fontSize: 14, color: 'var(--color-text-muted)' }}>
            No properties yet. Add your first property to get started.
          </p>
          <Button variant="primary" size="sm" onClick={onAdd} style={{ marginTop: 16 }}>
            <Plus size={14} /> Add property
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {properties.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p)}
              style={propCardStyle}
            >
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>{p.address_line1}</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--color-text-muted)' }}>
                  {p.city}, {p.state} {p.zip_code} · {p.property_type.replace(/_/g, ' ')}
                  {p.sqft_estimate ? ` · ${p.sqft_estimate.toLocaleString()} sqft` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                style={iconBtnStyle}
                aria-label="Delete"
              >
                <Trash2 size={14} />
              </button>
              <ChevronRight size={16} color="var(--color-text-muted)" />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── Add property form ────────────────────────────────────────────────────────

function AddPropertyForm({ onBack, onCreated }: { onBack: () => void; onCreated: (p: Property) => void }) {
  const { toast } = useToast();
  const [f, setF] = useState({
    address_line1: '', address_line2: '', city: '', state: '', zip_code: '',
    property_type: 'SINGLE_FAMILY' as PropertyType,
    year_built: '', sqft_estimate: '', bedrooms: '', bathrooms: '',
    has_basement: false, has_garage: false, stories: '1',
  });
  const [saving, setSaving] = useState(false);

  function set(key: string, val: string | boolean) { setF((prev) => ({ ...prev, [key]: val })); }

  async function handleSubmit() {
    if (!f.address_line1 || !f.city || !f.state || !f.zip_code) { toast('Fill in all required fields.', 'error'); return; }
    setSaving(true);
    try {
      const prop = await createProperty({
        address_line1: f.address_line1, address_line2: f.address_line2 || undefined,
        city: f.city, state: f.state, zip_code: f.zip_code,
        property_type: f.property_type,
        year_built: f.year_built ? parseInt(f.year_built) : undefined,
        sqft_estimate: f.sqft_estimate ? parseInt(f.sqft_estimate) : undefined,
        bedrooms: f.bedrooms ? parseInt(f.bedrooms) : undefined,
        bathrooms: f.bathrooms ? parseFloat(f.bathrooms) : undefined,
        has_basement: f.has_basement, has_garage: f.has_garage,
        stories: parseInt(f.stories) || 1,
      } as Partial<Property>);
      onCreated(prop);
    } catch { toast('Failed to add property.', 'error'); }
    finally { setSaving(false); }
  }

  return (
    <div>
      <button type="button" onClick={onBack} style={backBtnStyle}><ArrowLeft size={14} /> Back</button>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '12px 0 16px' }}>Add a property</h2>

      <div style={cardStyle}>
        <Field label="Address line 1 *"><input style={inputS} value={f.address_line1} onChange={(e) => set('address_line1', e.target.value)} /></Field>
        <Field label="Address line 2"><input style={inputS} value={f.address_line2} onChange={(e) => set('address_line2', e.target.value)} /></Field>
        <TwoCol>
          <Field label="City *"><input style={inputS} value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="State *"><input style={inputS} value={f.state} onChange={(e) => set('state', e.target.value)} placeholder="e.g. MD" /></Field>
        </TwoCol>
        <TwoCol>
          <Field label="ZIP *"><input style={inputS} value={f.zip_code} onChange={(e) => set('zip_code', e.target.value)} /></Field>
          <Field label="Property type">
            <select style={inputS} value={f.property_type} onChange={(e) => set('property_type', e.target.value)}>
              {PROPERTY_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </TwoCol>
        <TwoCol>
          <Field label="Year built"><input style={inputS} type="number" value={f.year_built} onChange={(e) => set('year_built', e.target.value)} /></Field>
          <Field label="Est. sqft"><input style={inputS} type="number" value={f.sqft_estimate} onChange={(e) => set('sqft_estimate', e.target.value)} /></Field>
        </TwoCol>
        <TwoCol>
          <Field label="Bedrooms"><input style={inputS} type="number" value={f.bedrooms} onChange={(e) => set('bedrooms', e.target.value)} /></Field>
          <Field label="Bathrooms"><input style={inputS} type="number" step="0.5" value={f.bathrooms} onChange={(e) => set('bathrooms', e.target.value)} /></Field>
        </TwoCol>
        <div style={{ display: 'flex', gap: 20, marginBottom: 16 }}>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.has_basement} onChange={(e) => set('has_basement', e.target.checked)} /> Basement
          </label>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={f.has_garage} onChange={(e) => set('has_garage', e.target.checked)} /> Garage
          </label>
        </div>
        <Button variant="primary" onClick={handleSubmit} disabled={saving}>{saving ? 'Saving…' : 'Add property & continue'}</Button>
      </div>
    </div>
  );
}

// ── Estimate wizard ──────────────────────────────────────────────────────────

function EstimateWizard({
  property, onBack, onComplete,
}: { property: Property; onBack: () => void; onComplete: (e: PropertyEstimate) => void }) {
  const { user }  = useAuth();
  const { toast } = useToast();

  type WizStep = 'details' | 'photos' | 'questionnaire' | 'processing';
  const [step, setStep] = useState<WizStep>('details');

  const [purpose,   setPurpose]   = useState<RenovationPurpose>('FLIP');
  const [issue,     setIssue]     = useState<PrimaryIssue>('COSMETIC');
  const [estId,     setEstId]     = useState<string | null>(null);
  const [photos,    setPhotos]    = useState<{ area_key: string; area_label: string; file: File; url: string }[]>([]);
  const [answers,   setAnswers]   = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);

  async function handleCreateEstimate() {
    try {
      const est = await createEstimate({ property_id: property.id, renovation_purpose: purpose, primary_issue: issue });
      setEstId(est.id);
      setStep('photos');
    } catch { toast('Failed to create estimate.', 'error'); }
  }

  async function handleUploadPhotos() {
    if (!estId || photos.length === 0) { toast('Please add at least one photo.', 'error'); return; }
    setUploading(true);
    try {
      for (const p of photos) {
        const ext = (p.file.name.split('.').pop() || 'jpg').toLowerCase();
        const path = `${user!.id}/${estId}/${p.area_key}-${Date.now()}.${ext}`;
        const { data: presign } = await api.post<{ data: { signedUrl: string; token: string; path: string } }>(
          '/upload/presign', { bucket: 'estimate-photos', path },
        );
        const supabase = getSupabaseClient();
        const { error } = await supabase.storage
          .from('estimate-photos')
          .uploadToSignedUrl(presign.data.path, presign.data.token, p.file, { contentType: p.file.type });
        if (error) throw new Error(error.message);
        const { data: urlData } = supabase.storage.from('estimate-photos').getPublicUrl(presign.data.path);
        await addEstimatePhoto(estId, {
          area_key: p.area_key, area_label: p.area_label,
          url: urlData.publicUrl, storage_path: presign.data.path,
        });
      }
      setStep('questionnaire');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    } finally { setUploading(false); }
  }

  async function handleRunEstimation() {
    if (!estId) return;
    // Save answers
    const ansArray = Object.entries(answers).filter(([, v]) => v.trim()).map(([k, v]) => ({ question_key: k, answer: v }));
    if (ansArray.length > 0) {
      await saveEstimateAnswers(estId, ansArray).catch(() => {});
    }
    await runEstimation(estId);
    setStep('processing');

    // Poll until complete
    const poll = setInterval(async () => {
      try {
        const est = await getEstimate(estId);
        if (est.status === 'COMPLETE' || est.status === 'FAILED') {
          clearInterval(poll);
          onComplete(est);
        }
      } catch { /* keep polling */ }
    }, 3000);
  }

  function addPhotoFile(areaKey: string, areaLabel: string, file: File) {
    setPhotos((prev) => [...prev, { area_key: areaKey, area_label: areaLabel, file, url: URL.createObjectURL(file) }]);
  }

  return (
    <div>
      <button type="button" onClick={onBack} style={backBtnStyle}><ArrowLeft size={14} /> Back</button>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '8px 0 4px' }}>{property.address_line1}, {property.city}, {property.state}</p>
      <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>New estimate</h2>

      {step === 'details' && (
        <div style={cardStyle}>
          <p style={sectionTitle}>Step 1 — Renovation details</p>
          <Field label="Purpose">
            <select style={inputS} value={purpose} onChange={(e) => setPurpose(e.target.value as RenovationPurpose)}>
              {PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="Primary issue">
            <select style={inputS} value={issue} onChange={(e) => setIssue(e.target.value as PrimaryIssue)}>
              {ISSUES.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
            </select>
          </Field>
          <Button variant="primary" onClick={handleCreateEstimate}>Continue to photos</Button>
        </div>
      )}

      {step === 'photos' && (
        <div style={cardStyle}>
          <p style={sectionTitle}>Step 2 — Upload photos</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Add photos for each area of the property. The more photos, the better the estimate.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {PHOTO_AREAS.map((area) => {
              const areaPhotos = photos.filter((p) => p.area_key === area.key);
              return (
                <div key={area.key} style={{ padding: '12px 14px', border: '1px solid var(--color-border)', borderRadius: 8, background: '#FAFAF9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{area.label}</span>
                    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 500 }}>
                      <Camera size={13} /> Add photo
                      <input type="file" accept="image/*" style={{ display: 'none' }}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) addPhotoFile(area.key, area.label, f); e.target.value = ''; }}
                      />
                    </label>
                  </div>
                  {areaPhotos.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {areaPhotos.map((p, i) => (
                        <img key={i} src={p.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 6 }} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 16 }}>
            <Button variant="primary" onClick={handleUploadPhotos} disabled={uploading || photos.length === 0}>
              {uploading ? 'Uploading…' : `Upload ${photos.length} photo${photos.length !== 1 ? 's' : ''} & continue`}
            </Button>
          </div>
        </div>
      )}

      {step === 'questionnaire' && (
        <div style={cardStyle}>
          <p style={sectionTitle}>Step 3 — Quick questionnaire</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 16 }}>
            Help the AI understand things that may not be visible in photos.
          </p>
          {QUESTIONNAIRE.map((q) => (
            <Field key={q.key} label={q.q}>
              <input style={inputS} value={answers[q.key] ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.key]: e.target.value }))} />
            </Field>
          ))}
          <Button variant="primary" onClick={handleRunEstimation}>
            <Sparkles size={14} /> Generate estimate
          </Button>
        </div>
      )}

      {step === 'processing' && (
        <div style={{ ...emptyStyle, minHeight: 300 }}>
          <Loader size={36} strokeWidth={1.5} color="var(--color-primary)" className="animate-spin" />
          <p style={{ margin: '16px 0 0', fontSize: 16, fontWeight: 600 }}>Analyzing your property…</p>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
            Claude is reviewing {photos.length} photo{photos.length !== 1 ? 's' : ''} and generating a detailed cost breakdown. This usually takes 30–60 seconds.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Results ──────────────────────────────────────────────────────────────────

function EstimateResults({
  estimate, property, onBack, onNewEstimate,
}: { estimate: PropertyEstimate; property: Property; onBack: () => void; onNewEstimate: () => void }) {
  const isFailed = estimate.status === 'FAILED';

  return (
    <div>
      <button type="button" onClick={onBack} style={backBtnStyle}><ArrowLeft size={14} /> Back to properties</button>
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '8px 0 4px' }}>{property.address_line1}, {property.city}, {property.state}</p>

      {isFailed ? (
        <div style={{ ...emptyStyle, minHeight: 200 }}>
          <AlertTriangle size={36} color="var(--color-danger)" strokeWidth={1.5} />
          <p style={{ margin: '12px 0 0', fontSize: 16, fontWeight: 600 }}>Estimation failed</p>
          <p style={{ margin: '6px 0 16px', fontSize: 13, color: 'var(--color-text-muted)' }}>{estimate.ai_summary ?? 'Please try again with clearer photos.'}</p>
          <Button variant="primary" size="sm" onClick={onNewEstimate}>Try again</Button>
        </div>
      ) : (
        <>
          {/* Summary header */}
          <div style={{ ...cardStyle, padding: 24, marginBottom: 16, background: '#F0FDF4', borderColor: '#BBF7D0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <CheckCircle2 size={20} color="var(--color-accent)" strokeWidth={2} />
              <span style={{ fontSize: 16, fontWeight: 600 }}>Estimate complete</span>
              {estimate.confidence_overall && (
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: '#E8F4F0', color: 'var(--color-accent)' }}>
                  {estimate.confidence_overall} confidence
                </span>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 600, color: 'var(--color-text-primary)' }}>
              ${(estimate.total_low ?? 0).toLocaleString()} – ${(estimate.total_high ?? 0).toLocaleString()}
            </p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
              {estimate.renovation_purpose.replace(/_/g, ' ')} · {estimate.primary_issue.replace(/_/g, ' ')}
            </p>
          </div>

          {/* AI Summary */}
          {estimate.ai_summary && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <p style={sectionTitle}>AI Summary</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{estimate.ai_summary}</p>
            </div>
          )}

          {/* Line items */}
          {estimate.line_items && estimate.line_items.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <p style={sectionTitle}>Line items</p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th style={thStyle}>Category</th>
                    <th style={thStyle}>Description</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>Low</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>High</th>
                  </tr>
                </thead>
                <tbody>
                  {estimate.line_items.map((item, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={tdStyle}>{item.category}</td>
                      <td style={tdStyle}>{item.description}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>${item.low.toLocaleString()}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>${item.high.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Room breakdown */}
          {estimate.room_breakdown && estimate.room_breakdown.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <p style={sectionTitle}>Room breakdown</p>
              {estimate.room_breakdown.map((room, i) => (
                <div key={i} style={{ padding: '12px 0', borderBottom: i < estimate.room_breakdown!.length - 1 ? '1px solid var(--color-border)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{room.room}</span>
                    <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>${room.low.toLocaleString()} – ${room.high.toLocaleString()}</span>
                  </div>
                  {room.items.map((item, j) => (
                    <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--color-text-muted)', paddingLeft: 12, marginTop: 3 }}>
                      <span>{item.description}</span>
                      <span>${item.low.toLocaleString()} – ${item.high.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {/* Cannot assess */}
          {estimate.cannot_assess && estimate.cannot_assess.length > 0 && (
            <div style={{ ...cardStyle, marginBottom: 16, background: '#FFFBEB', borderColor: '#FDE68A' }}>
              <p style={sectionTitle}><AlertTriangle size={13} style={{ marginRight: 6 }} /> Items we couldn't assess</p>
              <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: '#92400E', lineHeight: 1.7 }}>
                {estimate.cannot_assess.map((item, i) => <li key={i}>{item}</li>)}
              </ul>
            </div>
          )}

          {/* Rationale */}
          {estimate.ai_rationale && (
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <p style={sectionTitle}>How we estimated this</p>
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{estimate.ai_rationale}</p>
            </div>
          )}

          <Button variant="secondary" onClick={onNewEstimate} style={{ marginTop: 8 }}>
            Run a new estimate on this property
          </Button>
        </>
      )}
    </div>
  );
}

// ── Shared helpers ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string | React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}
function TwoCol({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>;
}

const inputS: React.CSSProperties = { width: '100%', padding: '10px 12px', fontSize: 14, border: '1px solid var(--color-border)', borderRadius: 8, fontFamily: 'inherit' };
const cardStyle: React.CSSProperties = { background: '#fff', border: '1px solid var(--color-border)', borderRadius: 12, padding: 20, marginBottom: 16 };
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: '0 0 12px', display: 'flex', alignItems: 'center' };
const emptyStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 40 };
const propCardStyle: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', background: '#fff', border: '1px solid var(--color-border)', borderRadius: 10, cursor: 'pointer', width: '100%', textAlign: 'left' };
const backBtnStyle: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--color-text-muted)', padding: 0, fontWeight: 500 };
const iconBtnStyle: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 6, color: 'var(--color-text-muted)', borderRadius: 6 };
const thStyle: React.CSSProperties = { textAlign: 'left', padding: '8px 10px', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4, color: 'var(--color-text-muted)', fontWeight: 500 };
const tdStyle: React.CSSProperties = { padding: '8px 10px' };
