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
