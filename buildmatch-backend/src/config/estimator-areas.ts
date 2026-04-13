/**
 * Master config that drives every photo capture block.
 * The frontend reads this to render the upload UI, and the backend
 * references it to validate area coverage before running an estimate.
 */

export interface PhotoArea {
  key:            string;
  label:          string;
  category:       'INTERIOR' | 'SYSTEMS' | 'EXTERIOR' | 'DAMAGE';
  required:       boolean;
  minPhotos:      number;
  maxPhotos:      number;
  icon:           string;         // Lucide icon name
  guidance:       string;         // shown below the upload area
  shootingTips:   string[];       // shown in the tips tooltip
  sampleCaption:  string;         // placeholder text for photo captions
}

export const PHOTO_AREAS: PhotoArea[] = [

  // ── INTERIOR ──────────────────────────────────────────────────────────────
  {
    key:       'LIVING_ROOM',
    label:     'Living Room',
    category:  'INTERIOR',
    required:  true,
    minPhotos: 2,
    maxPhotos: 6,
    icon:      'Sofa',
    guidance:
      'Photograph all four walls, the floor, and the ceiling. ' +
      'Capture any visible damage, cracks, stains, or worn areas.',
    shootingTips: [
      'Stand in each corner and shoot diagonally across the room',
      'Get a close-up of any damaged flooring or wall areas',
      'Photograph the ceiling especially near windows for water stains',
      'Include baseboards and trim in at least one shot',
    ],
    sampleCaption: 'e.g. Water stain on north wall near window',
  },
  {
    key:       'KITCHEN',
    label:     'Kitchen',
    category:  'INTERIOR',
    required:  true,
    minPhotos: 3,
    maxPhotos: 8,
    icon:      'UtensilsCrossed',
    guidance:
      'Photograph cabinets, countertops, appliances, flooring, ' +
      'and the area under the sink. Open cabinet doors in at least one shot.',
    shootingTips: [
      'Show the full cabinet run from across the room',
      'Open under-sink cabinet to show plumbing condition',
      'Photograph appliances (especially if old or damaged)',
      'Show the backsplash and countertop surface closely',
      'Include the floor near the sink and dishwasher area',
    ],
    sampleCaption: 'e.g. Cabinets delaminating on lower row',
  },
  {
    key:       'BATHROOM_PRIMARY',
    label:     'Primary Bathroom',
    category:  'INTERIOR',
    required:  true,
    minPhotos: 3,
    maxPhotos: 6,
    icon:      'Bath',
    guidance:
      'Photograph the shower or tub, toilet, vanity, floor, and ' +
      'any visible water damage or mold. Get a close-up of the grout and caulking.',
    shootingTips: [
      'Show the entire shower or tub surround from one angle',
      'Close-up of grout lines and caulking at the base',
      'Show the vanity top and backsplash clearly',
      'Check for water staining on the ceiling above the shower',
      'Photograph the floor especially in corners',
    ],
    sampleCaption: 'e.g. Grout failing on shower floor, black mold at base',
  },
  {
    key:       'BATHROOM_SECONDARY',
    label:     'Secondary Bathroom(s)',
    category:  'INTERIOR',
    required:  false,
    minPhotos: 2,
    maxPhotos: 6,
    icon:      'Droplets',
    guidance:
      'Same approach as the primary bathroom. Photograph all ' +
      'fixtures, floor, walls, and any visible issues.',
    shootingTips: [
      'Include all bathrooms beyond the primary in this section',
      'Label captions with which bathroom (e.g. hallway bath, half bath)',
    ],
    sampleCaption: 'e.g. Hallway bath — vanity needs replacement',
  },
  {
    key:       'BEDROOMS',
    label:     'Bedrooms',
    category:  'INTERIOR',
    required:  true,
    minPhotos: 2,
    maxPhotos: 8,
    icon:      'BedDouble',
    guidance:
      'At least one photo per bedroom showing the floor, walls, and ' +
      'ceiling. Note any closet damage, window issues, or flooring conditions.',
    shootingTips: [
      'One wide shot of each bedroom from the doorway',
      'Close-up of any damaged flooring or walls',
      'Show closet interiors if they need work',
      'Capture window condition in each room',
    ],
    sampleCaption: 'e.g. Master bedroom — carpet stained throughout',
  },
  {
    key:       'DINING_ROOM',
    label:     'Dining Room / Flex Space',
    category:  'INTERIOR',
    required:  false,
    minPhotos: 1,
    maxPhotos: 4,
    icon:      'Armchair',
    guidance:
      'Floor, walls, and ceiling. Note any flooring transitions ' +
      'or obvious cosmetic issues.',
    shootingTips: [
      'Wide shot showing flooring and walls',
    ],
    sampleCaption: 'e.g. Dining area — hardwood floors scratched',
  },
  {
    key:       'BASEMENT',
    label:     'Basement',
    category:  'INTERIOR',
    required:  false,
    minPhotos: 2,
    maxPhotos: 8,
    icon:      'ArrowDown',
    guidance:
      'Photograph the entire perimeter wall, floor, ceiling, water ' +
      'heater, electrical panel if visible, and any signs of water intrusion. ' +
      'This is a high-value section for assessment.',
    shootingTips: [
      'Walk the perimeter and photograph all foundation walls',
      'Look for white efflorescence (mineral deposits = water issue)',
      'Photograph floor drains and sump pump if present',
      'Show the ceiling joists if exposed',
      'Include the HVAC equipment if in the basement',
    ],
    sampleCaption: 'e.g. Basement east wall — active seepage, white mineral deposits',
  },

  // ── SYSTEMS ───────────────────────────────────────────────────────────────
  {
    key:       'ELECTRICAL_PANEL',
    label:     'Electrical Panel',
    category:  'SYSTEMS',
    required:  true,
    minPhotos: 1,
    maxPhotos: 3,
    icon:      'Zap',
    guidance:
      'Open the panel door and photograph the full panel with ' +
      'breakers visible. Also photograph the service entrance if accessible. ' +
      'Look for double-tapping, Federal Pacific, or Zinsco panels.',
    shootingTips: [
      'Open the panel door fully before photographing',
      'Make sure the photo is clear enough to read breaker labels',
      'Photograph the panel label showing age and amperage',
      'If there are multiple panels, photograph each one',
    ],
    sampleCaption: 'e.g. 100 amp Federal Pacific panel, original to house',
  },
  {
    key:       'HVAC',
    label:     'HVAC System',
    category:  'SYSTEMS',
    required:  true,
    minPhotos: 1,
    maxPhotos: 4,
    icon:      'Wind',
    guidance:
      'Photograph the furnace or air handler and the outdoor condenser ' +
      'unit. Look for the age label on each unit and include it in your photo. ' +
      'Photograph any visible ductwork issues.',
    shootingTips: [
      'Find the manufacturer sticker showing installation date',
      'Photograph the outdoor condenser from the side',
      'Show any visible rust, corrosion, or damage',
      'Photograph visible ductwork in the basement or attic access',
    ],
    sampleCaption: 'e.g. Furnace installed 2001, showing rust at heat exchanger',
  },
  {
    key:       'WATER_HEATER',
    label:     'Water Heater',
    category:  'SYSTEMS',
    required:  true,
    minPhotos: 1,
    maxPhotos: 2,
    icon:      'Flame',
    guidance:
      'Photograph the full water heater including the age label ' +
      'and any corrosion, rust, or water staining on the floor beneath it.',
    shootingTips: [
      'Find the sticker showing year of manufacture',
      'Show the floor around the base for rust staining',
      'Photograph the pressure relief valve',
    ],
    sampleCaption: 'e.g. 2009 water heater, rust at base of tank',
  },
  {
    key:       'PLUMBING_VISIBLE',
    label:     'Visible Plumbing',
    category:  'SYSTEMS',
    required:  false,
    minPhotos: 1,
    maxPhotos: 4,
    icon:      'Droplet',
    guidance:
      'Photograph any accessible plumbing: under kitchen sink, ' +
      'bathroom supply lines, basement pipes, or the main shutoff valve. ' +
      'Look for galvanized steel, lead, or polybutylene pipe.',
    shootingTips: [
      'Open under-sink cabinets and photograph pipe material',
      'Note if pipes are copper, galvanized, PVC, or polybutylene',
      'Look for any active leaks or water staining',
    ],
    sampleCaption: 'e.g. Galvanized supply lines in kitchen, showing corrosion',
  },

  // ── EXTERIOR ──────────────────────────────────────────────────────────────
  {
    key:       'ROOF',
    label:     'Roof',
    category:  'EXTERIOR',
    required:  true,
    minPhotos: 2,
    maxPhotos: 6,
    icon:      'Home',
    guidance:
      'Photograph the roof from the ground from multiple angles. ' +
      'Look for missing, curling, or damaged shingles. Photograph gutters ' +
      'and any visible flashing around chimneys or dormers.',
    shootingTips: [
      'Step back far enough to see the full roof plane',
      'Photograph all four sides of the roof',
      'Zoom in on any damaged or missing shingle areas',
      'Show gutter condition and fascia boards',
      'Photograph chimney flashing if present',
    ],
    sampleCaption: 'e.g. South-facing slope — shingles curling, granule loss',
  },
  {
    key:       'EXTERIOR_WALLS',
    label:     'Exterior Walls & Siding',
    category:  'EXTERIOR',
    required:  true,
    minPhotos: 2,
    maxPhotos: 6,
    icon:      'Building',
    guidance:
      'Walk around the property and photograph all four sides. ' +
      'Look for cracked, missing, or rotted siding, gaps at corners, ' +
      'peeling paint, and any wood rot at the base.',
    shootingTips: [
      'Photograph each elevation (front, rear, both sides)',
      'Close-up of any damaged or rotted areas',
      'Show the condition at grade level where siding meets foundation',
      'Note the siding material: vinyl, wood, fiber cement, brick',
    ],
    sampleCaption: 'e.g. Rear elevation — wood siding rotted at base, 3 courses',
  },
  {
    key:       'FOUNDATION_EXTERIOR',
    label:     'Foundation (Exterior)',
    category:  'EXTERIOR',
    required:  false,
    minPhotos: 1,
    maxPhotos: 4,
    icon:      'Landmark',
    guidance:
      'Walk the perimeter and photograph any visible cracks, ' +
      'bowing, or water damage in the foundation wall. Even hairline ' +
      'cracks are worth documenting.',
    shootingTips: [
      'Photograph any crack with something for scale (a coin or hand)',
      'Note if cracks are horizontal (serious) or vertical/diagonal',
      'Show any grading issues where soil slopes toward the foundation',
    ],
    sampleCaption: 'e.g. NE corner — stair-step crack in block foundation',
  },
  {
    key:       'DRIVEWAY_WALKWAYS',
    label:     'Driveway & Walkways',
    category:  'EXTERIOR',
    required:  false,
    minPhotos: 1,
    maxPhotos: 3,
    icon:      'Map',
    guidance:
      'Photograph the full driveway and main walkway. ' +
      'Note cracking, heaving, or drainage issues.',
    shootingTips: [
      'Full-length shot of driveway',
      'Close-up of any major cracks',
    ],
    sampleCaption: 'e.g. Driveway — significant cracking throughout, heaved section',
  },
  {
    key:       'GARAGE',
    label:     'Garage',
    category:  'EXTERIOR',
    required:  false,
    minPhotos: 1,
    maxPhotos: 4,
    icon:      'Car',
    guidance:
      'Photograph the garage interior, the floor, walls, and ' +
      'the condition of the garage door and opener.',
    shootingTips: [
      'Wide shot of full interior',
      'Show floor condition',
      'Show door mechanism',
    ],
    sampleCaption: 'e.g. Garage floor — oil stains, minor cracking at threshold',
  },

  // ── DAMAGE ────────────────────────────────────────────────────────────────
  {
    key:       'WATER_DAMAGE',
    label:     'Water Damage Areas',
    category:  'DAMAGE',
    required:  false,
    minPhotos: 1,
    maxPhotos: 10,
    icon:      'CloudRain',
    guidance:
      'Photograph every area of visible water damage: staining, ' +
      'bubbling paint, soft floors, mold, or wet areas. This is one ' +
      'of the most important sections for accurate cost estimation.',
    shootingTips: [
      'Photograph the source AND the affected area',
      'Show ceiling stains from above (if accessible)',
      'Document any active moisture with a close-up',
      'Check inside closets and under carpets for hidden damage',
    ],
    sampleCaption: 'e.g. Bathroom ceiling below master bath — active leak stain',
  },
  {
    key:       'FIRE_SMOKE_DAMAGE',
    label:     'Fire or Smoke Damage',
    category:  'DAMAGE',
    required:  false,
    minPhotos: 1,
    maxPhotos: 10,
    icon:      'Flame',
    guidance:
      'Photograph all areas showing char, smoke staining, or ' +
      'structural damage from fire. Include a wide shot showing the ' +
      'extent of the affected area.',
    shootingTips: [
      'Wide shots first to show extent, then close-ups of worst areas',
      'Show any structural members (joists, studs) that are charred',
      'Document smoke staining on walls and ceilings',
    ],
    sampleCaption: 'e.g. Kitchen — cabinet run fully charred, ceiling joists exposed',
  },
  {
    key:       'OTHER_DAMAGE',
    label:     'Other Damage or Concerns',
    category:  'DAMAGE',
    required:  false,
    minPhotos: 1,
    maxPhotos: 10,
    icon:      'AlertTriangle',
    guidance:
      'Any other damage, safety concerns, or items needing attention ' +
      'that do not fit the other categories. Include pest damage, structural ' +
      'concerns, code violations, or anything unusual.',
    shootingTips: [
      'Document anything that looks wrong or unusual',
    ],
    sampleCaption: 'e.g. Large hole in bedroom wall, possible pest entry point',
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Get the list of required area keys, adjusted for property features.
 * Basement and garage become required when the property has them.
 */
export function getRequiredAreas(hasBasement: boolean, hasGarage: boolean): string[] {
  const required = PHOTO_AREAS
    .filter((a) => a.required)
    .map((a) => a.key);
  if (hasBasement) required.push('BASEMENT');
  if (hasGarage)   required.push('GARAGE');
  return required;
}

/**
 * Get all areas organized by category for rendering grouped sections.
 */
export function getAreasByCategory(): Record<
  'INTERIOR' | 'SYSTEMS' | 'EXTERIOR' | 'DAMAGE',
  PhotoArea[]
> {
  return {
    INTERIOR: PHOTO_AREAS.filter((a) => a.category === 'INTERIOR'),
    SYSTEMS:  PHOTO_AREAS.filter((a) => a.category === 'SYSTEMS'),
    EXTERIOR: PHOTO_AREAS.filter((a) => a.category === 'EXTERIOR'),
    DAMAGE:   PHOTO_AREAS.filter((a) => a.category === 'DAMAGE'),
  };
}
