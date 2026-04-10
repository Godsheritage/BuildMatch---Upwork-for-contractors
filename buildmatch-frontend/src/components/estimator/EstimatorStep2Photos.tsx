import { useRef } from 'react';
import { Camera, Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../../context/ToastContext';
import { useEstimatorPhotoUpload } from '../../hooks/useEstimatorPhotoUpload';
import type { WizardProperty, PhotoEntry } from '../../pages/EstimatorPage';

interface PhotoArea {
  key: string; label: string;
  category: 'INTERIOR' | 'SYSTEMS' | 'EXTERIOR' | 'DAMAGE';
  required: boolean; minPhotos: number; maxPhotos: number;
  guidance: string; sampleCaption: string;
}

const AREAS: PhotoArea[] = [
  { key: 'LIVING_ROOM',        label: 'Living Room',           category: 'INTERIOR', required: true,  minPhotos: 2, maxPhotos: 6, guidance: 'Photograph all four walls, the floor, and the ceiling.', sampleCaption: 'e.g. Water stain on north wall near window' },
  { key: 'KITCHEN',            label: 'Kitchen',               category: 'INTERIOR', required: true,  minPhotos: 3, maxPhotos: 8, guidance: 'Cabinets, countertops, appliances, flooring, and under the sink.', sampleCaption: 'e.g. Cabinets delaminating on lower row' },
  { key: 'BATHROOM_PRIMARY',   label: 'Primary Bathroom',      category: 'INTERIOR', required: true,  minPhotos: 3, maxPhotos: 6, guidance: 'Shower/tub, toilet, vanity, floor, and any water damage.', sampleCaption: 'e.g. Grout failing on shower floor' },
  { key: 'BATHROOM_SECONDARY', label: 'Secondary Bathroom(s)', category: 'INTERIOR', required: false, minPhotos: 2, maxPhotos: 6, guidance: 'Same approach as primary bathroom.', sampleCaption: 'e.g. Hallway bath — vanity needs replacement' },
  { key: 'BEDROOMS',           label: 'Bedrooms',              category: 'INTERIOR', required: true,  minPhotos: 2, maxPhotos: 8, guidance: 'At least one photo per bedroom showing floor, walls, ceiling.', sampleCaption: 'e.g. Master bedroom — carpet stained throughout' },
  { key: 'DINING_ROOM',        label: 'Dining Room / Flex',    category: 'INTERIOR', required: false, minPhotos: 1, maxPhotos: 4, guidance: 'Floor, walls, and ceiling.', sampleCaption: 'e.g. Hardwood floors scratched' },
  { key: 'BASEMENT',           label: 'Basement',              category: 'INTERIOR', required: false, minPhotos: 2, maxPhotos: 8, guidance: 'Perimeter wall, floor, ceiling, water heater, electrical panel.', sampleCaption: 'e.g. East wall — active seepage' },
  { key: 'ELECTRICAL_PANEL',   label: 'Electrical Panel',      category: 'SYSTEMS',  required: true,  minPhotos: 1, maxPhotos: 3, guidance: 'Open panel door, photograph breakers.', sampleCaption: 'e.g. 100 amp Federal Pacific panel' },
  { key: 'HVAC',               label: 'HVAC System',           category: 'SYSTEMS',  required: true,  minPhotos: 1, maxPhotos: 4, guidance: 'Furnace/air handler + outdoor condenser + age label.', sampleCaption: 'e.g. Furnace installed 2001, rust at heat exchanger' },
  { key: 'WATER_HEATER',       label: 'Water Heater',          category: 'SYSTEMS',  required: true,  minPhotos: 1, maxPhotos: 2, guidance: 'Full unit + age label + floor beneath.', sampleCaption: 'e.g. 2009 water heater, rust at base' },
  { key: 'PLUMBING_VISIBLE',   label: 'Visible Plumbing',      category: 'SYSTEMS',  required: false, minPhotos: 1, maxPhotos: 4, guidance: 'Under-sink plumbing, basement pipes, shutoff valve.', sampleCaption: 'e.g. Galvanized supply lines, showing corrosion' },
  { key: 'ROOF',               label: 'Roof',                  category: 'EXTERIOR', required: true,  minPhotos: 2, maxPhotos: 6, guidance: 'From ground, multiple angles. Look for missing/curling shingles.', sampleCaption: 'e.g. South slope — shingles curling' },
  { key: 'EXTERIOR_WALLS',     label: 'Exterior Walls & Siding', category: 'EXTERIOR', required: true, minPhotos: 2, maxPhotos: 6, guidance: 'All four sides. Look for cracks, rot, peeling paint.', sampleCaption: 'e.g. Rear — wood siding rotted at base' },
  { key: 'FOUNDATION_EXTERIOR', label: 'Foundation (Exterior)', category: 'EXTERIOR', required: false, minPhotos: 1, maxPhotos: 4, guidance: 'Cracks, bowing, or water damage in foundation wall.', sampleCaption: 'e.g. NE corner — stair-step crack' },
  { key: 'DRIVEWAY_WALKWAYS',  label: 'Driveway & Walkways',   category: 'EXTERIOR', required: false, minPhotos: 1, maxPhotos: 3, guidance: 'Full driveway + walkway. Note cracking/heaving.', sampleCaption: 'e.g. Driveway — significant cracking' },
  { key: 'GARAGE',             label: 'Garage',                category: 'EXTERIOR', required: false, minPhotos: 1, maxPhotos: 4, guidance: 'Interior, floor, walls, and garage door.', sampleCaption: 'e.g. Garage floor — oil stains, cracking' },
  { key: 'WATER_DAMAGE',       label: 'Water Damage Areas',    category: 'DAMAGE',   required: false, minPhotos: 1, maxPhotos: 10, guidance: 'Every area of visible water damage.', sampleCaption: 'e.g. Ceiling below master bath — active leak stain' },
  { key: 'FIRE_SMOKE_DAMAGE',  label: 'Fire or Smoke Damage',  category: 'DAMAGE',   required: false, minPhotos: 1, maxPhotos: 10, guidance: 'Char, smoke staining, or structural fire damage.', sampleCaption: 'e.g. Kitchen — cabinets fully charred' },
  { key: 'OTHER_DAMAGE',       label: 'Other Damage',          category: 'DAMAGE',   required: false, minPhotos: 1, maxPhotos: 10, guidance: 'Pest damage, structural concerns, code violations, etc.', sampleCaption: 'e.g. Large hole in bedroom wall' },
];

const CATEGORIES: { key: string; label: string }[] = [
  { key: 'INTERIOR', label: 'Interior' },
  { key: 'SYSTEMS',  label: 'Systems' },
  { key: 'EXTERIOR', label: 'Exterior' },
  { key: 'DAMAGE',   label: 'Damage (if applicable)' },
];

interface Props {
  property: WizardProperty;
  photos:   Record<string, PhotoEntry[]>;
  onNext:   (photos: Record<string, PhotoEntry[]>) => void;
  onUpdate: (photos: Record<string, PhotoEntry[]>) => void;
}

export function EstimatorStep2Photos({ property, photos, onNext, onUpdate }: Props) {
  const { toast }     = useToast();
  const { uploadPhoto, deletePhoto, uploading } = useEstimatorPhotoUpload();

  // Determine which areas are required for this property
  const requiredKeys = new Set(
    AREAS.filter(a => a.required).map(a => a.key)
      .concat(property.hasBasement ? ['BASEMENT'] : [])
      .concat(property.hasGarage ? ['GARAGE'] : []),
  );

  const totalPhotos = Object.values(photos).reduce((s, arr) => s + arr.length, 0);
  const coveredAreas = new Set(
    Object.entries(photos)
      .filter(([, arr]) => arr.length > 0)
      .map(([key]) => key),
  );
  const missingRequired = [...requiredKeys].filter(k => !coveredAreas.has(k));

  async function handleFile(area: PhotoArea, file: File) {
    const areaPhotos = photos[area.key] ?? [];
    if (areaPhotos.length >= area.maxPhotos) {
      toast(`Maximum ${area.maxPhotos} photos for ${area.label}.`, 'error');
      return;
    }
    if (!property.id) { toast('Save property details first.', 'error'); return; }

    try {
      const result = await uploadPhoto({
        file,
        propertyId: property.id,
        areaKey:    area.key,
        areaLabel:  area.label,
        sortOrder:  areaPhotos.length,
      });
      const updated = {
        ...photos,
        [area.key]: [
          ...(photos[area.key] ?? []),
          { photoId: result.photoId, url: result.url, caption: '', sortOrder: areaPhotos.length },
        ],
      };
      onUpdate(updated);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed.', 'error');
    }
  }

  async function handleDelete(areaKey: string, photoId: string) {
    try {
      await deletePhoto(photoId);
      const updated = {
        ...photos,
        [areaKey]: (photos[areaKey] ?? []).filter(p => p.photoId !== photoId),
      };
      onUpdate(updated);
    } catch {
      toast('Could not remove photo.', 'error');
    }
  }

  function handleContinue() {
    if (totalPhotos < 4) {
      toast('Please add at least 4 photos.', 'error');
      return;
    }
    if (missingRequired.length > 0) {
      const names = missingRequired.map(k => AREAS.find(a => a.key === k)?.label ?? k).join(', ');
      toast(`Missing required areas: ${names}`, 'error');
      return;
    }
    onNext(photos);
  }

  return (
    <div>
      <h2 style={heading}>Photo capture</h2>
      <p style={subtext}>
        Upload photos of the property by area. More photos = a more accurate estimate.
        <strong> At least 4 photos across the required areas.</strong>
      </p>

      {CATEGORIES.map(cat => {
        const areas = AREAS.filter(a => a.category === cat.key);
        if (areas.length === 0) return null;
        return (
          <div key={cat.key} style={{ marginBottom: 24 }}>
            <p style={catLabel}>{cat.label}</p>
            {areas.map(area => {
              const areaPhotos = photos[area.key] ?? [];
              const isRequired = requiredKeys.has(area.key);
              const met = areaPhotos.length >= area.minPhotos;

              return (
                <AreaBlock
                  key={area.key}
                  area={area}
                  isRequired={isRequired}
                  met={met}
                  photos={areaPhotos}
                  isUploading={!!uploading[area.key]}
                  onFile={(f) => handleFile(area, f)}
                  onDelete={(pid) => void handleDelete(area.key, pid)}
                />
              );
            })}
          </div>
        );
      })}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
          {totalPhotos} photo{totalPhotos !== 1 ? 's' : ''} · {coveredAreas.size} areas covered
        </span>
        <Button variant="primary" onClick={handleContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}

// ── Area upload block ────────────────────────────────────────────────────────

function AreaBlock({
  area, isRequired, met, photos, isUploading, onFile, onDelete,
}: {
  area: PhotoArea; isRequired: boolean; met: boolean;
  photos: PhotoEntry[]; isUploading: boolean;
  onFile: (f: File) => void; onDelete: (photoId: string) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const canAdd  = photos.length < area.maxPhotos;

  return (
    <div style={{
      padding: '14px 16px', marginBottom: 10,
      border: '1px solid var(--color-border)', borderRadius: 10,
      background: photos.length > 0 ? '#FAFAF9' : '#fff',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 14, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          {area.label}
          {isRequired && <span style={reqBadge}>Required</span>}
          {met && <CheckCircle2 size={14} color="var(--color-accent)" strokeWidth={2.5} />}
        </span>
        {canAdd && (
          <label style={addLink}>
            <Camera size={13} /> {isUploading ? 'Uploading…' : 'Add photo'}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }}
              disabled={isUploading}
            />
          </label>
        )}
      </div>

      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 8px', lineHeight: 1.5 }}>
        {area.guidance} ({area.minPhotos}–{area.maxPhotos} photos)
      </p>

      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          {photos.map((p) => (
            <div key={p.photoId} style={{ position: 'relative', width: 72, height: 72 }}>
              <img src={p.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6, border: '1px solid var(--color-border)' }} />
              <button
                type="button"
                onClick={() => onDelete(p.photoId)}
                style={delBtn}
                aria-label="Remove"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const heading:  React.CSSProperties = { fontSize: 20, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.02em' };
const subtext:  React.CSSProperties = { fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px', lineHeight: 1.5 };
const catLabel: React.CSSProperties = { fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, color: 'var(--color-text-muted)', margin: '0 0 10px' };
const addLink:  React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--color-accent)', cursor: 'pointer', fontWeight: 500 };
const reqBadge: React.CSSProperties = { fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 8, background: '#FEF3C7', color: '#92400E' };
const delBtn:   React.CSSProperties = {
  position: 'absolute', top: -4, right: -4, width: 18, height: 18,
  borderRadius: '50%', background: '#DC2626', color: '#fff',
  border: 'none', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
