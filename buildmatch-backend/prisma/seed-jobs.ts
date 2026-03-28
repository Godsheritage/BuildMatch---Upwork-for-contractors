import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Investors ──────────────────────────────────────────────────────────────────

const INVESTORS = [
  { firstName: 'Sarah',   lastName: 'Coleman',  email: 'sarah@test.com',   city: 'Baltimore',    state: 'MD' },
  { firstName: 'James',   lastName: 'Whitfield', email: 'james@test.com',   city: 'Austin',       state: 'TX' },
  { firstName: 'Renee',   lastName: 'Thornton',  email: 'renee@test.com',   city: 'Atlanta',      state: 'GA' },
  { firstName: 'Marcus',  lastName: 'Ellison',   email: 'marcus@test.com',  city: 'Chicago',      state: 'IL' },
  { firstName: 'Vanessa', lastName: 'Park',      email: 'vanessa@test.com', city: 'Los Angeles',  state: 'CA' },
];

// ── Jobs — 4 per investor, 20 total ───────────────────────────────────────────
// investorIndex: 0=Sarah, 1=James, 2=Renee, 3=Marcus, 4=Vanessa

const JOBS = [
  // ── Sarah (Baltimore, MD) ────────────────────────────────────────────────────
  {
    investorIndex: 0,
    title: 'Full master bathroom remodel',
    description: 'Looking for an experienced contractor to gut and renovate a 120 sq ft master bathroom. Work includes tile demo, new shower enclosure, double vanity, updated plumbing fixtures, and in-floor radiant heat. Materials will be supplied by homeowner.',
    tradeType: 'GENERAL',
    budgetMin: 14000, budgetMax: 22000,
    city: 'Baltimore', state: 'MD', zipCode: '21201',
    status: 'OPEN',
  },
  {
    investorIndex: 0,
    title: 'Kitchen exhaust fan & recessed lighting install',
    description: 'Need a licensed electrician to install a new exhaust fan over the stove and add six recessed LED fixtures in the kitchen. Existing wiring is accessible through the attic. Looking for clean work with proper permits.',
    tradeType: 'ELECTRICAL',
    budgetMin: 1200, budgetMax: 2500,
    city: 'Baltimore', state: 'MD', zipCode: '21202',
    status: 'OPEN',
  },
  {
    investorIndex: 0,
    title: 'Basement waterproofing and sump pump install',
    description: 'Finished basement had water intrusion last spring along the east wall. Need a contractor to diagnose the source, apply interior waterproofing membrane, and install a new sump pump with battery backup. Must be licensed and insured.',
    tradeType: 'GENERAL',
    budgetMin: 4500, budgetMax: 9000,
    city: 'Towson', state: 'MD', zipCode: '21204',
    status: 'AWARDED',
  },
  {
    investorIndex: 0,
    title: 'Front yard landscape refresh',
    description: 'Front yard needs a complete refresh — remove two overgrown shrubs, regrade the slope, lay sod, and install a low-voltage pathway lighting system. Simple, clean look preferred.',
    tradeType: 'LANDSCAPING',
    budgetMin: 2000, budgetMax: 5000,
    city: 'Baltimore', state: 'MD', zipCode: '21210',
    status: 'COMPLETED',
  },

  // ── James (Austin, TX) ───────────────────────────────────────────────────────
  {
    investorIndex: 1,
    title: 'Roof replacement — 2,400 sq ft home',
    description: 'Current 25-year-old shingle roof needs full replacement after last year\'s hail damage. Insurance claim approved. Looking for a licensed roofer to coordinate directly with the adjuster and complete tear-off plus new 30-year architectural shingles.',
    tradeType: 'ROOFING',
    budgetMin: 9000, budgetMax: 15000,
    city: 'Austin', state: 'TX', zipCode: '78701',
    status: 'OPEN',
  },
  {
    investorIndex: 1,
    title: 'Central AC system replacement',
    description: '3-ton split system is 17 years old and no longer efficient. Need a certified HVAC contractor to remove the old unit and install a new SEER 16+ system. Ductwork is in good condition and will not need replacement.',
    tradeType: 'HVAC',
    budgetMin: 5500, budgetMax: 9500,
    city: 'Austin', state: 'TX', zipCode: '78704',
    status: 'OPEN',
  },
  {
    investorIndex: 1,
    title: 'Garage conversion to home office',
    description: 'Convert an attached 2-car garage (480 sq ft) into a finished home office with drywall, insulation, one dedicated 20A circuit, mini-split HVAC unit, and luxury vinyl plank flooring. Permits required.',
    tradeType: 'GENERAL',
    budgetMin: 18000, budgetMax: 30000,
    city: 'Round Rock', state: 'TX', zipCode: '78664',
    status: 'OPEN',
  },
  {
    investorIndex: 1,
    title: 'Interior repaint — 3,000 sq ft home',
    description: 'Full interior repaint of ceilings, walls, and trim throughout a 3,000 sq ft two-story home. 4 bedrooms, 2.5 baths, open living/dining. Paint supplied by contractor, colors pre-selected. Clean prep and two-coat finish required.',
    tradeType: 'PAINTING',
    budgetMin: 4500, budgetMax: 7500,
    city: 'Austin', state: 'TX', zipCode: '78745',
    status: 'CANCELLED',
  },

  // ── Renee (Atlanta, GA) ──────────────────────────────────────────────────────
  {
    investorIndex: 2,
    title: 'Main floor LVP flooring installation',
    description: 'Remove existing carpet and install 1,100 sq ft of luxury vinyl plank flooring on the main level. Include proper underlayment, transitions to tile in kitchen, and quarter-round throughout. Material already purchased.',
    tradeType: 'FLOORING',
    budgetMin: 3200, budgetMax: 6000,
    city: 'Atlanta', state: 'GA', zipCode: '30301',
    status: 'OPEN',
  },
  {
    investorIndex: 2,
    title: 'Water heater replacement — tankless upgrade',
    description: 'Current 40-gallon tank water heater is 12 years old. Looking to upgrade to a whole-house tankless gas unit. Plumber must handle gas line re-routing and permitting. Prefer Navien or Rinnai.',
    tradeType: 'PLUMBING',
    budgetMin: 2800, budgetMax: 5200,
    city: 'Decatur', state: 'GA', zipCode: '30030',
    status: 'OPEN',
  },
  {
    investorIndex: 2,
    title: 'Deck demolition and new composite deck build',
    description: 'Old wood deck (16x20) needs full demo and replacement. Want a new composite deck at same footprint with cable rail system, built-in bench seating, and post lighting. Must pull permits and meet current code.',
    tradeType: 'GENERAL',
    budgetMin: 16000, budgetMax: 28000,
    city: 'Atlanta', state: 'GA', zipCode: '30306',
    status: 'AWARDED',
  },
  {
    investorIndex: 2,
    title: 'Interior demo — wall removal for open floor plan',
    description: 'Need a contractor to remove one load-bearing wall between the kitchen and living room (approx 18 ft). Work includes structural assessment, temp support, beam installation, and patch/prep of ceiling and floors. Permits required.',
    tradeType: 'DEMOLITION',
    budgetMin: 6000, budgetMax: 12000,
    city: 'Smyrna', state: 'GA', zipCode: '30080',
    status: 'OPEN',
  },

  // ── Marcus (Chicago, IL) ─────────────────────────────────────────────────────
  {
    investorIndex: 3,
    title: 'Basement finish — 800 sq ft',
    description: 'Unfinished 800 sq ft basement needs to become a livable space. Scope includes framing, insulation, drywall, drop ceiling, one bathroom rough-in and finish, egress window enlargement, and LVP flooring. Looking for turnkey contractor.',
    tradeType: 'GENERAL',
    budgetMin: 35000, budgetMax: 55000,
    city: 'Chicago', state: 'IL', zipCode: '60601',
    status: 'OPEN',
  },
  {
    investorIndex: 3,
    title: 'EV charger installation — Level 2',
    description: 'Need a licensed electrician to install a 240V/50A circuit in the attached garage for a Level 2 EV charger. Panel has capacity. Permit required by City of Chicago. Prefer to supply the charger myself (ChargePoint Home Flex).',
    tradeType: 'ELECTRICAL',
    budgetMin: 600, budgetMax: 1400,
    city: 'Chicago', state: 'IL', zipCode: '60614',
    status: 'OPEN',
  },
  {
    investorIndex: 3,
    title: 'Bathroom tile regrout and caulk replacement',
    description: 'Guest bathroom and master shower both need regrout — grout is cracking and mold is forming. Full regrout, new silicone caulk at all transitions, and reseal. Small job but must be done correctly.',
    tradeType: 'FLOORING',
    budgetMin: 500, budgetMax: 1200,
    city: 'Evanston', state: 'IL', zipCode: '60201',
    status: 'COMPLETED',
  },
  {
    investorIndex: 3,
    title: 'Exterior house painting — 2-story colonial',
    description: 'Two-story colonial (approx 2,800 sq ft of paintable surface) needs full exterior repaint. Scrape, prime, and two-coat finish on siding, trim, shutters, and front door. Requesting bids with and without pressure washing prep.',
    tradeType: 'PAINTING',
    budgetMin: 6500, budgetMax: 12000,
    city: 'Oak Park', state: 'IL', zipCode: '60301',
    status: 'OPEN',
  },

  // ── Vanessa (Los Angeles, CA) ────────────────────────────────────────────────
  {
    investorIndex: 4,
    title: 'ADU construction — detached 400 sq ft studio',
    description: 'Permitted plans already approved for a detached 400 sq ft ADU in the backyard. Looking for a general contractor to handle the full build: foundation, framing, MEP, drywall, flooring, and finish work. Timeline target is 4–5 months.',
    tradeType: 'GENERAL',
    budgetMin: 120000, budgetMax: 165000,
    city: 'Los Angeles', state: 'CA', zipCode: '90012',
    status: 'OPEN',
  },
  {
    investorIndex: 4,
    title: 'Plumbing repipe — copper to PEX',
    description: 'Older 1960s home with original galvanized supply lines. Need a licensed plumber to repipe with PEX-A from the main shutoff throughout. Two bathrooms, one kitchen, one laundry. Must be licensed in CA.',
    tradeType: 'PLUMBING',
    budgetMin: 8000, budgetMax: 14000,
    city: 'Culver City', state: 'CA', zipCode: '90230',
    status: 'OPEN',
  },
  {
    investorIndex: 4,
    title: 'Solar panel install — 8kW system',
    description: 'Looking for a NABCEP-certified solar installer for an 8kW rooftop system on a flat TPO roof. Includes microinverters, main panel upgrade from 100A to 200A, and utility interconnection paperwork. LA DWP customer.',
    tradeType: 'ELECTRICAL',
    budgetMin: 22000, budgetMax: 35000,
    city: 'Los Angeles', state: 'CA', zipCode: '90034',
    status: 'AWARDED',
  },
  {
    investorIndex: 4,
    title: 'Drought-tolerant landscaping — front and back',
    description: 'Replace existing lawn (front: 800 sq ft, back: 600 sq ft) with drought-tolerant native planting and decomposed granite hardscape. Include drip irrigation system and one accent boulder cluster. LA DWP rebate expected.',
    tradeType: 'LANDSCAPING',
    budgetMin: 9000, budgetMax: 16000,
    city: 'Santa Monica', state: 'CA', zipCode: '90401',
    status: 'OPEN',
  },
];

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding 5 investor users and 20 jobs...\n');

  const passwordHash = await bcrypt.hash('test', 12);

  // Upsert investors and collect their IDs
  const investorIds: string[] = [];
  for (const inv of INVESTORS) {
    const user = await prisma.user.upsert({
      where: { email: inv.email },
      update: {},
      create: {
        email:     inv.email,
        password:  passwordHash,
        role:      'INVESTOR',
        firstName: inv.firstName,
        lastName:  inv.lastName,
        city:      inv.city,
        state:     inv.state,
        isVerified: true,
        isActive:   true,
      },
    });
    investorIds.push(user.id);
    console.log(`  ✓ Investor: ${inv.firstName} ${inv.lastName} <${inv.email}>`);
  }

  console.log('');

  // Create jobs
  for (const job of JOBS) {
    const investorId = investorIds[job.investorIndex];
    await prisma.job.create({
      data: {
        title:       job.title,
        description: job.description,
        tradeType:   job.tradeType as any,
        budgetMin:   job.budgetMin,
        budgetMax:   job.budgetMax,
        city:        job.city,
        state:       job.state,
        zipCode:     job.zipCode,
        status:      job.status as any,
        investorId,
        photos: [],
      },
    });
    console.log(`  ✓ [${job.status.padEnd(9)}] ${job.title} — ${job.city}, ${job.state}`);
  }

  console.log('\n5 investors and 20 jobs seeded successfully.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
