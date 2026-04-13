import { useState, useRef } from 'react';
import {
  Camera, CheckCircle2, ChevronDown, ChevronUp,
  Plus, AlertTriangle, X, RotateCcw, Loader,
  // Area icons
  Sofa, UtensilsCrossed, Bath, Droplets, BedDouble, Armchair, ArrowDown,
  Zap, Wind, Flame, Droplet,
  Home, Building, Landmark, Map, Car,
  CloudRain, AlertTriangle as DamageIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { useEstimatorPhotoUpload } from '../../hooks/useEstimatorPhotoUpload';
import type { WizardState, PhotoEntry } from '../../pages/EstimatorPage';

// ── Photo area config (mirrors backend estimator-areas.ts) ──────────────────

interface PhotoArea {
  key: string; label: string;
  category: 'INTERIOR' | 'SYSTEMS' | 'EXTERIOR' | 'DAMAGE';
  required: boolean; minPhotos: number; maxPhotos: number;
  icon: React.ElementType;
  guidance: string;
  shootingTips: string[];
  sampleCaption: string;
}

const AREAS: PhotoArea[] = [
  // INTERIOR
  { key: 'LIVING_ROOM', label: 'Living Room', category: 'INTERIOR', required: true, minPhotos: 2, maxPhotos: 6, icon: Sofa,
    guidance: 'Photograph all four walls, the floor, and the ceiling. Capture any visible damage, cracks, stains, or worn areas.',
    shootingTips: ['Stand in each corner and shoot diagonally across the room', 'Get a close-up of any damaged flooring or wall areas', 'Photograph the ceiling especially near windows for water stains', 'Include baseboards and trim in at least one shot'],
    sampleCaption: 'e.g. Water stain on north wall near window' },
  { key: 'KITCHEN', label: 'Kitchen', category: 'INTERIOR', required: true, minPhotos: 3, maxPhotos: 8, icon: UtensilsCrossed,
    guidance: 'Photograph cabinets, countertops, appliances, flooring, and the area under the sink.',
    shootingTips: ['Show the full cabinet run from across the room', 'Open under-sink cabinet to show plumbing condition', 'Photograph appliances (especially if old or damaged)', 'Show the backsplash and countertop surface closely'],
    sampleCaption: 'e.g. Cabinets delaminating on lower row' },
  { key: 'BATHROOM_PRIMARY', label: 'Primary Bathroom', category: 'INTERIOR', required: true, minPhotos: 3, maxPhotos: 6, icon: Bath,
    guidance: 'Photograph the shower/tub, toilet, vanity, floor, and any visible water damage or mold.',
    shootingTips: ['Show the entire shower or tub surround', 'Close-up of grout lines and caulking', 'Show the vanity top clearly', 'Check for water staining on the ceiling above the shower'],
    sampleCaption: 'e.g. Grout failing on shower floor, black mold at base' },
  { key: 'BATHROOM_SECONDARY', label: 'Secondary Bathroom(s)', category: 'INTERIOR', required: false, minPhotos: 2, maxPhotos: 6, icon: Droplets,
    guidance: 'Same approach as the primary bathroom for all additional bathrooms.',
    shootingTips: ['Include all bathrooms beyond the primary', 'Label captions with which bathroom'],
    sampleCaption: 'e.g. Hallway bath — vanity needs replacement' },
  { key: 'BEDROOMS', label: 'Bedrooms', category: 'INTERIOR', required: true, minPhotos: 2, maxPhotos: 8, icon: BedDouble,
    guidance: 'At least one photo per bedroom showing the floor, walls, and ceiling.',
    shootingTips: ['One wide shot of each bedroom from the doorway', 'Close-up of any damaged flooring or walls', 'Show closet interiors if they need work'],
    sampleCaption: 'e.g. Master bedroom — carpet stained throughout' },
  { key: 'DINING_ROOM', label: 'Dining Room / Flex Space', category: 'INTERIOR', required: false, minPhotos: 1, maxPhotos: 4, icon: Armchair,
    guidance: 'Floor, walls, and ceiling. Note any flooring transitions or cosmetic issues.',
    shootingTips: ['Wide shot showing flooring and walls'],
    sampleCaption: 'e.g. Dining area — hardwood floors scratched' },
  { key: 'BASEMENT', label: 'Basement', category: 'INTERIOR', required: false, minPhotos: 2, maxPhotos: 8, icon: ArrowDown,
    guidance: 'Photograph the entire perimeter wall, floor, ceiling, and any signs of water intrusion.',
    shootingTips: ['Walk the perimeter and photograph all foundation walls', 'Look for white efflorescence', 'Photograph floor drains and sump pump', 'Show ceiling joists if exposed'],
    sampleCaption: 'e.g. East wall — active seepage, white mineral deposits' },
  // SYSTEMS
  { key: 'ELECTRICAL_PANEL', label: 'Electrical Panel', category: 'SYSTEMS', required: true, minPhotos: 1, maxPhotos: 3, icon: Zap,
    guidance: 'Open the panel door and photograph the full panel with breakers visible.',
    shootingTips: ['Open the panel door fully', 'Make sure breaker labels are readable', 'Photograph the panel label showing age and amperage'],
    sampleCaption: 'e.g. 100 amp Federal Pacific panel, original to house' },
  { key: 'HVAC', label: 'HVAC System', category: 'SYSTEMS', required: true, minPhotos: 1, maxPhotos: 4, icon: Wind,
    guidance: 'Photograph the furnace/air handler and the outdoor condenser. Include age labels.',
    shootingTips: ['Find the manufacturer sticker showing installation date', 'Photograph the outdoor condenser from the side', 'Show any visible rust, corrosion, or damage'],
    sampleCaption: 'e.g. Furnace installed 2001, showing rust at heat exchanger' },
  { key: 'WATER_HEATER', label: 'Water Heater', category: 'SYSTEMS', required: true, minPhotos: 1, maxPhotos: 2, icon: Flame,
    guidance: 'Photograph the full water heater including the age label and any corrosion.',
    shootingTips: ['Find the sticker showing year of manufacture', 'Show the floor around the base for rust staining'],
    sampleCaption: 'e.g. 2009 water heater, rust at base of tank' },
  { key: 'PLUMBING_VISIBLE', label: 'Visible Plumbing', category: 'SYSTEMS', required: false, minPhotos: 1, maxPhotos: 4, icon: Droplet,
    guidance: 'Photograph accessible plumbing: under sinks, basement pipes, main shutoff.',
    shootingTips: ['Open under-sink cabinets', 'Note pipe material', 'Look for active leaks'],
    sampleCaption: 'e.g. Galvanized supply lines, showing corrosion' },
  // EXTERIOR
  { key: 'ROOF', label: 'Roof', category: 'EXTERIOR', required: true, minPhotos: 2, maxPhotos: 6, icon: Home,
    guidance: 'Photograph from the ground from multiple angles. Look for missing or curling shingles.',
    shootingTips: ['Step back to see the full roof plane', 'Photograph all four sides', 'Zoom in on damaged areas', 'Show gutter condition'],
    sampleCaption: 'e.g. South-facing slope — shingles curling, granule loss' },
  { key: 'EXTERIOR_WALLS', label: 'Exterior Walls & Siding', category: 'EXTERIOR', required: true, minPhotos: 2, maxPhotos: 6, icon: Building,
    guidance: 'Walk around and photograph all four sides. Look for cracks, rot, peeling paint.',
    shootingTips: ['Photograph each elevation', 'Close-up of damaged areas', 'Show condition at grade level'],
    sampleCaption: 'e.g. Rear elevation — wood siding rotted at base' },
  { key: 'FOUNDATION_EXTERIOR', label: 'Foundation (Exterior)', category: 'EXTERIOR', required: false, minPhotos: 1, maxPhotos: 4, icon: Landmark,
    guidance: 'Walk the perimeter and photograph any visible cracks, bowing, or water damage.',
    shootingTips: ['Photograph cracks with something for scale', 'Note if cracks are horizontal or vertical'],
    sampleCaption: 'e.g. NE corner — stair-step crack in block foundation' },
  { key: 'DRIVEWAY_WALKWAYS', label: 'Driveway & Walkways', category: 'EXTERIOR', required: false, minPhotos: 1, maxPhotos: 3, icon: Map,
    guidance: 'Full driveway and main walkway. Note cracking, heaving, drainage issues.',
    shootingTips: ['Full-length shot of driveway', 'Close-up of major cracks'],
    sampleCaption: 'e.g. Driveway — significant cracking throughout' },
  { key: 'GARAGE', label: 'Garage', category: 'EXTERIOR', required: false, minPhotos: 1, maxPhotos: 4, icon: Car,
    guidance: 'Garage interior, floor, walls, and garage door condition.',
    shootingTips: ['Wide shot of full interior', 'Show floor condition', 'Show door mechanism'],
    sampleCaption: 'e.g. Garage floor — oil stains, minor cracking' },
  // DAMAGE
  { key: 'WATER_DAMAGE', label: 'Water Damage Areas', category: 'DAMAGE', required: false, minPhotos: 1, maxPhotos: 10, icon: CloudRain,
    guidance: 'Every area of visible water damage: staining, bubbling paint, soft floors, mold.',
    shootingTips: ['Photograph the source AND affected area', 'Show ceiling stains from above if accessible', 'Check inside closets for hidden damage'],
    sampleCaption: 'e.g. Bathroom ceiling below master bath — active leak stain' },
  { key: 'FIRE_SMOKE_DAMAGE', label: 'Fire or Smoke Damage', category: 'DAMAGE', required: false, minPhotos: 1, maxPhotos: 10, icon: Flame,
    guidance: 'All areas showing char, smoke staining, or structural fire damage.',
    shootingTips: ['Wide shots first, then close-ups of worst areas', 'Show structural members if charred'],
    sampleCaption: 'e.g. Kitchen — cabinet run fully charred' },
  { key: 'OTHER_DAMAGE', label: 'Other Damage or Concerns', category: 'DAMAGE', required: false, minPhotos: 1, maxPhotos: 10, icon: DamageIcon,
    guidance: 'Pest damage, structural concerns, code violations, or anything unusual.',
    shootingTips: ['Document anything that looks wrong or unusual'],
    sampleCaption: 'e.g. Large hole in bedroom wall, possible pest entry point' },
];

type Category = 'INTERIOR' | 'SYSTEMS' | 'EXTERIOR' | 'DAMAGE';
const CATEGORIES: { key: Category; label: string }[] = [
  { key: 'INTERIOR', label: 'Interior' },
  { key: 'SYSTEMS',  label: 'Systems' },
  { key: 'EXTERIOR', label: 'Exterior' },
  { key: 'DAMAGE',   label: 'Damage' },
];

function getRequiredKeys(hasBasement: boolean, hasGarage: boolean): Set<string> {
  const keys = AREAS.filter(a => a.required).map(a => a.key);
  if (hasBasement) keys.push('BASEMENT');
  if (hasGarage)   keys.push('GARAGE');
  return new Set(keys);
}

// ── Uploaded photo type (in-flight state) ────────────────────────────────────

interface LocalPhoto extends PhotoEntry {
  uploading?: boolean;
  error?:     boolean;
  localUrl?:  string; // ObjectURL for instant preview
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  state:  WizardState;
  onNext: (updated: WizardState) => void;
  onBack: () => void;
}

// ── Main component ──────────────────────────────────────────────────────────

export function Step2PhotoCapture({ state, onNext, onBack }: Props) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Category>('INTERIOR');
  const [photos, setPhotos]       = useState<Record<string, LocalPhoto[]>>(
    () => {
      const init: Record<string, LocalPhoto[]> = {};
      for (const [k, arr] of Object.entries(state.photos)) {
        init[k] = arr.map(p => ({ ...p }));
      }
      return init;
    },
  );
  const [captions, setCaptions]   = useState<Record<string, string>>({});

  const { uploadPhoto, deletePhoto } = useEstimatorPhotoUpload();
  const { property } = state;

  const requiredKeys = getRequiredKeys(property.hasBasement, property.hasGarage);

  // Filter visible areas by property features
  function getVisibleAreas(cat: Category): PhotoArea[] {
    return AREAS.filter(a => {
      if (a.category !== cat) return false;
      if (a.key === 'BASEMENT' && !property.hasBasement) return false;
      if (a.key === 'GARAGE'   && !property.hasGarage)   return false;
      return true;
    });
  }

  // Progress stats
  const allRequired = AREAS.filter(a => requiredKeys.has(a.key));
  const completedRequired = allRequired.filter(a => (photos[a.key]?.length ?? 0) >= a.minPhotos);
  const totalPhotos = Object.values(photos).reduce((s, arr) => s + arr.length, 0);

  function catCount(cat: Category): number {
    return getVisibleAreas(cat).filter(a => (photos[a.key]?.length ?? 0) > 0).length;
  }

  // ── Photo handlers ────────────────────────────────────────────────────────

  async function handleFiles(area: PhotoArea, files: FileList | File[]) {
    if (!property.id) { toast('Save property first.', 'error'); return; }
    const areaPhotos = photos[area.key] ?? [];
    const slots = area.maxPhotos - areaPhotos.length;
    const toUpload = Array.from(files).slice(0, Math.max(0, slots));

    for (const file of toUpload) {
      const tempId   = `temp-${Date.now()}-${Math.random()}`;
      const localUrl = URL.createObjectURL(file);

      // Optimistic preview
      setPhotos(prev => ({
        ...prev,
        [area.key]: [
          ...(prev[area.key] ?? []),
          { photoId: tempId, url: localUrl, caption: '', sortOrder: (prev[area.key]?.length ?? 0), uploading: true, localUrl },
        ],
      }));

      try {
        const result = await uploadPhoto({
          file,
          propertyId: property.id,
          areaKey:    area.key,
          areaLabel:  area.label,
          sortOrder:  (photos[area.key]?.length ?? 0),
        });
        // Replace temp with real
        setPhotos(prev => ({
          ...prev,
          [area.key]: (prev[area.key] ?? []).map(p =>
            p.photoId === tempId
              ? { photoId: result.photoId, url: result.url, caption: '', sortOrder: p.sortOrder }
              : p,
          ),
        }));
      } catch (err) {
        // Mark as error
        setPhotos(prev => ({
          ...prev,
          [area.key]: (prev[area.key] ?? []).map(p =>
            p.photoId === tempId ? { ...p, uploading: false, error: true } : p,
          ),
        }));
        toast(err instanceof Error ? err.message : 'Upload failed.', 'error');
      } finally {
        URL.revokeObjectURL(localUrl);
      }
    }
  }

  async function handleDelete(areaKey: string, photoId: string) {
    // If it's a temp/error entry, just remove locally
    const photo = (photos[areaKey] ?? []).find(p => p.photoId === photoId);
    if (photo?.localUrl) URL.revokeObjectURL(photo.localUrl);

    if (!photoId.startsWith('temp-')) {
      try { await deletePhoto(photoId); }
      catch { toast('Could not remove photo.', 'error'); return; }
    }
    setPhotos(prev => ({
      ...prev,
      [areaKey]: (prev[areaKey] ?? []).filter(p => p.photoId !== photoId),
    }));
  }

  async function handleRetry(areaKey: string, photoId: string) {
    // Remove the errored entry — user should re-upload
    setPhotos(prev => ({
      ...prev,
      [areaKey]: (prev[areaKey] ?? []).filter(p => p.photoId !== photoId),
    }));
  }

  // ── Next validation ───────────────────────────────────────────────────────

  function handleNext() {
    // Check all required areas
    const missing: string[] = [];
    for (const area of allRequired) {
      if ((photos[area.key]?.length ?? 0) < area.minPhotos) {
        missing.push(area.key);
      }
    }
    if (missing.length > 0) {
      const firstKey = missing[0];
      const el = document.querySelector(`[data-area-key="${firstKey}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const label = AREAS.find(a => a.key === firstKey)?.label ?? firstKey;
      toast(`${label} needs more photos. Scroll up to see what's missing.`, 'error');
      return;
    }
    if (totalPhotos < 8) {
      toast('Please add at least 8 photos total across all areas.', 'error');
      return;
    }
    // Strip temp state from photos for wizard
    const cleanPhotos: Record<string, PhotoEntry[]> = {};
    for (const [k, arr] of Object.entries(photos)) {
      cleanPhotos[k] = arr
        .filter(p => !p.error && !p.uploading)
        .map(({ photoId, url, caption, sortOrder }) => ({ photoId, url, caption, sortOrder }));
    }
    onNext({ ...state, photos: cleanPhotos, currentStep: 3 });
  }

  const allRequiredMet = completedRequired.length >= allRequired.length && totalPhotos >= 8;
  const anyUploading = Object.values(photos).some(arr => arr.some(p => p.uploading));

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ paddingBottom: 80 }}>
      <h2 style={heading}>Document the property</h2>
      <p style={subtitleStyle}>
        The more photos you provide, the more accurate your estimate.
        Take photos as you walk through the property.
      </p>

      {/* Progress bar */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
          <span style={{ color: 'var(--color-text-muted)' }}>
            {completedRequired.length} of {allRequired.length} required sections photographed
          </span>
          <span style={{ fontWeight: 600, color: allRequiredMet ? 'var(--color-accent)' : 'var(--color-text-muted)' }}>
            {totalPhotos} photos
          </span>
        </div>
        <div style={progressTrack}>
          <div style={{
            ...progressFill,
            width: `${(completedRequired.length / Math.max(1, allRequired.length)) * 100}%`,
            background: allRequiredMet ? 'var(--color-accent)' : 'var(--color-primary)',
          }} />
        </div>
      </div>

      {/* Category tabs */}
      <div style={tabRow}>
        {CATEGORIES.map(cat => {
          const count = catCount(cat.key);
          const active = activeTab === cat.key;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => setActiveTab(cat.key)}
              style={{
                ...tabBtn,
                borderBottomColor: active ? 'var(--color-primary)' : 'transparent',
                color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
              }}
            >
              {cat.label}
              {count > 0 && (
                <span style={tabBadge}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Damage tab note */}
      {activeTab === 'DAMAGE' && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 16px', fontStyle: 'italic' }}>
          Add photos here only if visible damage exists. These sections are optional.
        </p>
      )}

      {/* Area blocks */}
      {getVisibleAreas(activeTab).map(area => (
        <PhotoAreaBlock
          key={area.key}
          area={area}
          isRequired={requiredKeys.has(area.key)}
          photos={photos[area.key] ?? []}
          caption={captions[area.key] ?? ''}
          onFiles={(files) => handleFiles(area, files)}
          onDelete={(pid) => void handleDelete(area.key, pid)}
          onRetry={(pid) => void handleRetry(area.key, pid)}
          onCaptionChange={(val) => setCaptions(prev => ({ ...prev, [area.key]: val }))}
        />
      ))}

      {/* Sticky bottom bar */}
      <div style={bottomBar}>
        <button type="button" onClick={onBack} style={backBtn}>Back</button>
        <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
          {completedRequired.length}/{allRequired.length} sections
        </span>
        <Button
          variant="primary"
          size="sm"
          onClick={handleNext}
          disabled={!allRequiredMet || anyUploading}
          title={!allRequiredMet ? 'Complete all required sections to continue' : undefined}
        >
          {anyUploading ? 'Uploading…' : 'Next: Add Details'}
        </Button>
      </div>
    </div>
  );
}

// ── PhotoAreaBlock ──────────────────────────────────────────────────────────

function PhotoAreaBlock({
  area, isRequired, photos, caption,
  onFiles, onDelete, onRetry, onCaptionChange,
}: {
  area:            PhotoArea;
  isRequired:      boolean;
  photos:          LocalPhoto[];
  caption:         string;
  onFiles:         (files: FileList) => void;
  onDelete:        (photoId: string) => void;
  onRetry:         (photoId: string) => void;
  onCaptionChange: (val: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipsOpen, setTipsOpen] = useState(false);
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
  const Icon = area.icon;
  const met = photos.length >= area.minPhotos;
  const canAdd = photos.filter(p => !p.error).length < area.maxPhotos;
  const needed = Math.max(0, area.minPhotos - photos.length);

  return (
    <div
      data-area-key={area.key}
      style={{
        ...areaCard,
        borderColor: isRequired && photos.length === 0 ? '#FDE68A' : 'var(--color-border)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}>
          <Icon size={16} strokeWidth={1.75} color={met ? 'var(--color-accent)' : 'var(--color-text-muted)'} />
          {area.label}
          {met && <CheckCircle2 size={14} color="var(--color-accent)" strokeWidth={2.5} />}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {photos.length > 0 && (
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
              {photos.length}/{area.maxPhotos}
            </span>
          )}
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
            background: isRequired ? '#FEF3C7' : '#F3F4F6',
            color:      isRequired ? '#92400E' : '#6B7280',
          }}>
            {isRequired ? 'Required' : 'Optional'}
          </span>
        </span>
      </div>

      {/* Guidance */}
      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
        {area.guidance}
      </p>

      {/* Tips toggle */}
      <button
        type="button"
        onClick={() => setTipsOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--color-accent)', fontWeight: 500, padding: 0, marginBottom: 10 }}
      >
        {tipsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Shooting tips
      </button>
      {tipsOpen && (
        <ul style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.6 }}>
          {area.shootingTips.map((tip, i) => <li key={i}>{tip}</li>)}
        </ul>
      )}

      {/* Upload zone / photo grid */}
      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={uploadZone}
        >
          <Camera size={28} strokeWidth={1.5} color="var(--color-accent)" />
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 6 }}>
            {isMobile ? 'Tap to take photo' : 'Click or drag photos here'}
          </span>
          <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
            {area.minPhotos} photo{area.minPhotos > 1 ? 's' : ''} minimum
          </span>
        </button>
      ) : (
        <div style={photoGrid}>
          {photos.map(p => (
            <div key={p.photoId} style={thumbWrap}>
              <img
                src={p.localUrl || p.url}
                alt=""
                style={thumbImg}
              />
              {/* Uploading overlay */}
              {p.uploading && (
                <div style={overlay}>
                  <Loader size={18} strokeWidth={2} color="#fff" style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              )}
              {/* Error overlay */}
              {p.error && (
                <div style={{ ...overlay, background: 'rgba(220,38,38,0.7)' }}>
                  <button type="button" onClick={() => onRetry(p.photoId)} style={retryBtn}>
                    <RotateCcw size={14} /> Retry
                  </button>
                </div>
              )}
              {/* Hover delete */}
              {!p.uploading && !p.error && (
                <button type="button" onClick={() => onDelete(p.photoId)} style={deleteBtn} aria-label="Remove">
                  <X size={12} strokeWidth={2.5} />
                </button>
              )}
            </div>
          ))}
          {/* Add more button */}
          {canAdd && (
            <button type="button" onClick={() => fileRef.current?.click()} style={addMoreBtn}>
              <Plus size={20} strokeWidth={1.5} />
            </button>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple={!isMobile}
        capture={isMobile ? 'environment' : undefined}
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) onFiles(e.target.files); e.target.value = ''; }}
      />

      {/* Status callout */}
      {isRequired && needed > 0 && photos.length > 0 && (
        <div style={amberCallout}>
          <AlertTriangle size={13} strokeWidth={2} />
          Add {needed} more photo{needed > 1 ? 's' : ''} to continue
        </div>
      )}
      {met && (
        <div style={greenCallout}>
          <CheckCircle2 size={13} strokeWidth={2.5} />
          {area.label} documented
        </div>
      )}

      {/* Caption input */}
      {photos.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <label style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4 }}>
            Add notes about this area (optional)
          </label>
          <input
            type="text"
            value={caption}
            onChange={(e) => onCaptionChange(e.target.value)}
            placeholder={area.sampleCaption}
            style={captionInput}
          />
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const heading:       React.CSSProperties = { fontSize: 22, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' };
const subtitleStyle: React.CSSProperties = { fontSize: 14, color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 };

const progressTrack: React.CSSProperties = { width: '100%', height: 6, borderRadius: 3, background: '#E5E7EB' };
const progressFill:  React.CSSProperties = { height: '100%', borderRadius: 3, transition: 'width 0.3s, background 0.3s' };

const tabRow: React.CSSProperties = { display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', marginBottom: 20 };
const tabBtn: React.CSSProperties = {
  padding: '10px 18px', background: 'none', border: 'none',
  borderBottom: '2px solid transparent', fontSize: 13, fontWeight: 500,
  cursor: 'pointer', marginBottom: -1,
  display: 'flex', alignItems: 'center', gap: 6,
};
const tabBadge: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, minWidth: 18, height: 18,
  borderRadius: 9, background: 'var(--color-accent)', color: '#fff',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
};

const areaCard: React.CSSProperties = {
  border: '1px solid var(--color-border)', borderRadius: 12,
  padding: '16px 18px', marginBottom: 14, background: '#fff',
  transition: 'border-color 0.2s',
};

const uploadZone: React.CSSProperties = {
  width: '100%', padding: '28px 16px',
  border: '2px dashed var(--color-border)', borderRadius: 10,
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  gap: 2, cursor: 'pointer', background: '#FAFAF9',
};

const photoGrid: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8,
};

const thumbWrap: React.CSSProperties = { position: 'relative', aspectRatio: '1', borderRadius: 8, overflow: 'hidden' };
const thumbImg:  React.CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const overlay:   React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const deleteBtn: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4, width: 22, height: 22,
  borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff',
  border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  opacity: 0.7, transition: 'opacity 0.15s',
};
const retryBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 4,
  background: 'rgba(255,255,255,0.9)', color: '#DC2626',
  border: 'none', borderRadius: 6, padding: '4px 10px',
  fontSize: 11, fontWeight: 600, cursor: 'pointer',
};
const addMoreBtn: React.CSSProperties = {
  aspectRatio: '1', border: '2px dashed var(--color-border)', borderRadius: 8,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  cursor: 'pointer', background: '#FAFAF9', color: 'var(--color-text-muted)',
};

const amberCallout: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 12px', marginTop: 10, borderRadius: 8,
  background: '#FEF3C7', color: '#92400E', fontSize: 12, fontWeight: 500,
};
const greenCallout: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '8px 12px', marginTop: 10, borderRadius: 8,
  background: '#D1FAE5', color: '#065F46', fontSize: 12, fontWeight: 500,
};

const captionInput: React.CSSProperties = {
  width: '100%', padding: '8px 12px', fontSize: 13,
  border: '1px solid var(--color-border)', borderRadius: 8,
  fontFamily: 'inherit', color: 'var(--color-text-primary)',
};

const bottomBar: React.CSSProperties = {
  position: 'fixed', bottom: 0, left: 0, right: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 24px', background: '#fff',
  borderTop: '1px solid var(--color-border)',
  zIndex: 40,
};

const backBtn: React.CSSProperties = {
  background: 'none', border: '1px solid var(--color-border)',
  borderRadius: 8, padding: '8px 16px', fontSize: 13,
  fontWeight: 500, cursor: 'pointer', color: 'var(--color-text-primary)',
};
