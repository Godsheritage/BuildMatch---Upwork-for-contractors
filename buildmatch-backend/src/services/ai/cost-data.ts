/**
 * Baseline cost ranges per category.
 * The AI uses this as a reference when it cannot determine
 * region-specific costs from the zip code alone.
 */

export const COST_RANGES_PER_SQFT = {
  // Full gut renovation ranges
  FULL_GUT_LOW_END:    { low: 40,  high: 65  },
  FULL_GUT_MID_RANGE:  { low: 65,  high: 110 },
  FULL_GUT_HIGH_END:   { low: 110, high: 180 },

  // Cosmetic renovation ranges
  COSMETIC_LOW_END:    { low: 15,  high: 25  },
  COSMETIC_MID_RANGE:  { low: 25,  high: 45  },
  COSMETIC_HIGH_END:   { low: 45,  high: 75  },
};

export const CATEGORY_COSTS = {
  KITCHEN: {
    COSMETIC:     { low: 5000,   high: 15000  },
    PARTIAL:      { low: 15000,  high: 35000  },
    FULL_REMODEL: { low: 35000,  high: 75000  },
    FULL_GUT:     { low: 50000,  high: 120000 },
  },
  BATHROOM_PRIMARY: {
    COSMETIC:     { low: 2500,   high: 7000   },
    PARTIAL:      { low: 7000,   high: 18000  },
    FULL_REMODEL: { low: 18000,  high: 40000  },
    FULL_GUT:     { low: 30000,  high: 60000  },
  },
  BATHROOM_SECONDARY: {
    COSMETIC:     { low: 1500,   high: 5000   },
    PARTIAL:      { low: 5000,   high: 12000  },
    FULL_REMODEL: { low: 10000,  high: 25000  },
    FULL_GUT:     { low: 15000,  high: 35000  },
  },
  FLOORING_PER_SQFT: {
    LVP:          { low: 3,      high: 7      },
    HARDWOOD:     { low: 8,      high: 16     },
    TILE:         { low: 7,      high: 18     },
    CARPET:       { low: 2,      high: 6      },
    SUBFLOOR:     { low: 3,      high: 8      },
  },
  PAINTING_PER_SQFT: {
    INTERIOR:     { low: 2,      high: 5      },
    EXTERIOR:     { low: 1.5,    high: 4      },
  },
  ROOF: {
    ASPHALT_1500SQFT: { low: 8000,  high: 14000 },
    ASPHALT_2000SQFT: { low: 10000, high: 18000 },
    ASPHALT_2500SQFT: { low: 13000, high: 22000 },
    REPAIR_MINOR:     { low: 500,   high: 2500  },
    REPAIR_MAJOR:     { low: 2500,  high: 7000  },
  },
  HVAC: {
    REPAIR:           { low: 500,   high: 3000  },
    REPLACE_CENTRAL:  { low: 5000,  high: 12000 },
    REPLACE_MINI_SPLIT: { low: 3000, high: 8000 },
    DUCTWORK:         { low: 2000,  high: 6000  },
  },
  PLUMBING: {
    FIXTURE_REPLACE:  { low: 200,   high: 1000  },
    REPIPE_PARTIAL:   { low: 2000,  high: 6000  },
    REPIPE_FULL:      { low: 5000,  high: 15000 },
    WATER_HEATER:     { low: 1200,  high: 3500  },
    SEWER_LINE:       { low: 3000,  high: 10000 },
  },
  ELECTRICAL: {
    PANEL_UPGRADE_100A: { low: 1500, high: 3000  },
    PANEL_UPGRADE_200A: { low: 2500, high: 5000  },
    REWIRE_PARTIAL:     { low: 3000, high: 8000  },
    REWIRE_FULL:        { low: 8000, high: 20000 },
    OUTLET_ADDITION:    { low: 150,  high: 400   },
  },
  WINDOWS: {
    STANDARD_EACH:    { low: 400,   high: 900   },
    PREMIUM_EACH:     { low: 800,   high: 1800  },
    SLIDING_DOOR:     { low: 1200,  high: 3500  },
  },
  SIDING: {
    VINYL_PER_SQFT:   { low: 4,     high: 8     },
    HARDIE_PER_SQFT:  { low: 8,     high: 14    },
    WOOD_PER_SQFT:    { low: 6,     high: 12    },
    REPAIR_SECTION:   { low: 500,   high: 3000  },
  },
  FOUNDATION: {
    CRACK_REPAIR:     { low: 500,   high: 3000  },
    PIER_UNDERPINNING: { low: 5000, high: 15000 },
    WATERPROOFING:    { low: 3000,  high: 10000 },
    FULL_REPLACEMENT: { low: 20000, high: 80000 },
  },
  DEMOLITION: {
    INTERIOR_PER_SQFT: { low: 2,    high: 8     },
    EXTERIOR_STRUCTURE: { low: 5000, high: 25000 },
    DUMPSTER_30YD:     { low: 400,  high: 800   },
  },
  LANDSCAPING: {
    BASIC_CLEANUP:    { low: 500,   high: 2000  },
    SOD_PER_SQFT:     { low: 1,     high: 2.5   },
    FENCE_PER_LF:     { low: 15,    high: 40    },
    DRIVEWAY_CONCRETE: { low: 3000, high: 8000  },
    DRIVEWAY_ASPHALT:  { low: 2000, high: 5000  },
  },
  PERMITS_AND_FEES: {
    BUILDING_PERMIT:  { low: 500,   high: 3000  },
    ARCHITECTURAL:    { low: 2000,  high: 10000 },
    DUMPSTER_PERMIT:  { low: 50,    high: 300   },
  },
} as const;

/**
 * Regional cost multipliers by metro area.
 * Base = 1.0 (national average). Values > 1.0 indicate higher-cost markets.
 */
export const REGIONAL_MULTIPLIERS: Record<string, number> = {
  // High-cost metros
  'New York':        1.35,
  'San Francisco':   1.45,
  'Los Angeles':     1.25,
  'Boston':          1.30,
  'Seattle':         1.20,
  'Washington DC':   1.25,
  'Miami':           1.15,
  'Chicago':         1.10,
  'Denver':          1.10,
  'San Diego':       1.20,
  'Honolulu':        1.50,

  // Average-cost metros
  'Austin':          1.05,
  'Portland':        1.10,
  'Nashville':       1.00,
  'Charlotte':       0.95,
  'Minneapolis':     1.05,
  'Philadelphia':    1.10,
  'Atlanta':         0.95,
  'Dallas':          0.95,
  'Phoenix':         0.95,
  'Raleigh':         0.95,

  // Lower-cost metros
  'Houston':         0.90,
  'San Antonio':     0.85,
  'Indianapolis':    0.85,
  'Columbus':        0.85,
  'Memphis':         0.80,
  'Detroit':         0.80,
  'Cleveland':       0.80,
  'St. Louis':       0.85,
  'Kansas City':     0.85,
  'Birmingham':      0.80,
  'Louisville':      0.85,
  'Oklahoma City':   0.80,
  'Little Rock':     0.78,
  'Jackson':         0.75,
};

/**
 * ZIP-code prefix → metro mapping for the most common US zip ranges.
 * Falls back to state-level defaults, then 1.0 (national average).
 */
const ZIP_TO_METRO: Record<string, string> = {
  '100': 'New York', '101': 'New York', '102': 'New York', '103': 'New York', '104': 'New York',
  '110': 'New York', '111': 'New York', '112': 'New York', '113': 'New York', '114': 'New York',
  '900': 'Los Angeles', '901': 'Los Angeles', '902': 'Los Angeles', '903': 'Los Angeles',
  '910': 'Los Angeles', '911': 'Los Angeles', '912': 'Los Angeles', '913': 'Los Angeles',
  '941': 'San Francisco', '940': 'San Francisco', '943': 'San Francisco', '944': 'San Francisco',
  '021': 'Boston', '022': 'Boston', '023': 'Boston', '024': 'Boston',
  '980': 'Seattle', '981': 'Seattle', '982': 'Seattle',
  '200': 'Washington DC', '201': 'Washington DC', '202': 'Washington DC', '203': 'Washington DC', '204': 'Washington DC',
  '331': 'Miami', '330': 'Miami', '332': 'Miami', '333': 'Miami',
  '606': 'Chicago', '600': 'Chicago', '601': 'Chicago',
  '802': 'Denver', '800': 'Denver', '801': 'Denver',
  '920': 'San Diego', '921': 'San Diego', '919': 'San Diego',
  '787': 'Austin', '786': 'Austin',
  '972': 'Portland', '970': 'Portland', '971': 'Portland',
  '372': 'Nashville', '370': 'Nashville', '371': 'Nashville',
  '282': 'Charlotte', '280': 'Charlotte', '281': 'Charlotte',
  '554': 'Minneapolis', '553': 'Minneapolis', '551': 'Minneapolis',
  '191': 'Philadelphia', '190': 'Philadelphia', '192': 'Philadelphia',
  '303': 'Atlanta', '300': 'Atlanta', '301': 'Atlanta',
  '750': 'Dallas', '751': 'Dallas', '752': 'Dallas', '753': 'Dallas',
  '850': 'Phoenix', '851': 'Phoenix', '852': 'Phoenix', '853': 'Phoenix',
  '276': 'Raleigh', '275': 'Raleigh', '277': 'Raleigh',
  '770': 'Houston', '772': 'Houston', '773': 'Houston', '774': 'Houston',
  '782': 'San Antonio', '781': 'San Antonio', '780': 'San Antonio',
  '462': 'Indianapolis', '460': 'Indianapolis', '461': 'Indianapolis',
  '432': 'Columbus', '430': 'Columbus', '431': 'Columbus',
  '381': 'Memphis', '380': 'Memphis',
  '482': 'Detroit', '480': 'Detroit', '481': 'Detroit', '483': 'Detroit',
  '441': 'Cleveland', '440': 'Cleveland', '442': 'Cleveland',
  '631': 'St. Louis', '630': 'St. Louis',
  '641': 'Kansas City', '640': 'Kansas City', '661': 'Kansas City',
  '352': 'Birmingham', '350': 'Birmingham', '351': 'Birmingham',
  '402': 'Louisville', '400': 'Louisville', '401': 'Louisville',
  '731': 'Oklahoma City', '730': 'Oklahoma City',
  '722': 'Little Rock', '720': 'Little Rock', '721': 'Little Rock',
  '392': 'Jackson', '390': 'Jackson', '391': 'Jackson',
  '968': 'Honolulu', '967': 'Honolulu', '966': 'Honolulu',
};

/**
 * Resolve a zip code to a regional cost multiplier.
 * Tries 3-digit zip prefix → metro → multiplier. Falls back to 1.0.
 */
export function getRegionalMultiplier(zipCode: string): number {
  const prefix = zipCode.replace(/\D/g, '').slice(0, 3);
  const metro = ZIP_TO_METRO[prefix];
  if (metro && metro in REGIONAL_MULTIPLIERS) return REGIONAL_MULTIPLIERS[metro];
  return 1.0;
}
