/**
 * seed-portfolio.ts
 * Seeds 5 rich portfolio projects per contractor into ContractorProfile.portfolioProjects
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Photo sets per trade ──────────────────────────────────────────────────────

const PHOTOS: Record<string, string[]> = {
  GENERAL: [
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900&q=80',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&q=80',
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80',
  ],
  ELECTRICAL: [
    'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=900&q=80',
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80',
    'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=900&q=80',
  ],
  PLUMBING: [
    'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=900&q=80',
    'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=900&q=80',
    'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=900&q=80',
  ],
  HVAC: [
    'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=900&q=80',
    'https://images.unsplash.com/photo-1621905251918-48416bd8575a?w=900&q=80',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900&q=80',
  ],
  ROOFING: [
    'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=900&q=80',
    'https://images.unsplash.com/photo-1572120360610-d971b9d7767c?w=900&q=80',
    'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=900&q=80',
  ],
  FLOORING: [
    'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=900&q=80',
    'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=900&q=80',
    'https://images.unsplash.com/photo-1615971677499-5467cbab01c0?w=900&q=80',
  ],
  PAINTING: [
    'https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=900&q=80',
    'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=900&q=80',
    'https://images.unsplash.com/photo-1515263487990-61b07816b324?w=900&q=80',
  ],
  LANDSCAPING: [
    'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=900&q=80',
    'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=900&q=80',
    'https://images.unsplash.com/photo-1558904541-efa843a96f01?w=900&q=80',
  ],
  DEMOLITION: [
    'https://images.unsplash.com/photo-1513467535987-fd81bc7d62f8?w=900&q=80',
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900&q=80',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&q=80',
  ],
  OTHER: [
    'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=900&q=80',
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&q=80',
    'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=900&q=80',
  ],
};

// ── Project templates per trade ───────────────────────────────────────────────

const TEMPLATES: Record<string, Array<{
  title: string;
  description: string;
  budgetMin: number;
  budgetMax: number;
  durationWeeks: number;
  highlights: string[];
  clientName: string;
  clientReview: string;
  clientRating: number;
}>> = {
  GENERAL: [
    {
      title: 'Full Home Renovation – 3,200 sq ft',
      description: 'Complete gut renovation of a 1970s single-family home. Scope included structural repairs, new framing, drywall, insulation upgrades, updated plumbing, and full interior finish-out.',
      budgetMin: 95000, budgetMax: 110000, durationWeeks: 14,
      highlights: ['Structural assessment included', 'All permits pulled', 'Delivered on schedule'],
      clientName: 'Robert H.', clientRating: 5,
      clientReview: 'They transformed our outdated 1970s house into a modern home. Every subcontractor they brought in was professional and the project timeline was met exactly as promised.',
    },
    {
      title: 'Kitchen & Living Room Open-Plan Remodel',
      description: 'Removed a load-bearing wall to create an open-plan kitchen and living space. New hardwood floors, custom cabinetry, quartz countertops, and recessed lighting throughout.',
      budgetMin: 42000, budgetMax: 55000, durationWeeks: 6,
      highlights: ['Load-bearing wall removal', 'Custom cabinetry', 'Under budget by 8%'],
      clientName: 'Linda T.', clientRating: 5,
      clientReview: 'The open plan transformation exceeded every expectation. They coordinated everything seamlessly and the quality of the finish is outstanding.',
    },
    {
      title: 'Garage Conversion to ADU',
      description: 'Converted a detached two-car garage into a 480 sq ft accessory dwelling unit with a full kitchen, bathroom, and separate utility connections.',
      budgetMin: 68000, budgetMax: 80000, durationWeeks: 10,
      highlights: ['Separate utility meters', 'ADU permit approved', 'Rental-ready finish'],
      clientName: 'Marcus P.', clientRating: 4,
      clientReview: 'Excellent work on the ADU conversion. The unit is now renting for $1,800/month. A few minor punch-list items took a while to resolve but the core work is top quality.',
    },
    {
      title: 'Master Suite Addition – 600 sq ft',
      description: 'Designed and built a new master suite addition on the rear of the home, including a walk-in closet, spa-style bathroom, and vaulted ceiling.',
      budgetMin: 78000, budgetMax: 92000, durationWeeks: 12,
      highlights: ['Vaulted ceiling with skylights', 'Radiant floor heating', 'Seamless exterior match'],
      clientName: 'Jennifer A.', clientRating: 5,
      clientReview: 'Our new master suite is absolutely beautiful. They matched the exterior of the addition perfectly to the existing home. We\'re still getting compliments from neighbors.',
    },
    {
      title: 'Commercial Office Tenant Improvement',
      description: 'Interior build-out of 2,800 sq ft commercial office space: new partitions, drop ceiling, HVAC distribution, data/power rough-in, and full ADA-compliant restrooms.',
      budgetMin: 120000, budgetMax: 145000, durationWeeks: 8,
      highlights: ['ADA compliant throughout', 'Delivered 3 days early', 'Zero change orders'],
      clientName: 'David K.', clientRating: 5,
      clientReview: 'We have used many contractors for our office build-outs and this team is by far the most organized and communicative. Will use them for every future project.',
    },
  ],
  ELECTRICAL: [
    {
      title: 'Full Electrical Panel Upgrade – 200A Service',
      description: 'Replaced a 60-amp Federal Pacific panel with a new 200-amp main service panel, including updated grounding, AFCI/GFCI breakers throughout, and a dedicated EV charger circuit.',
      budgetMin: 4800, budgetMax: 6200, durationWeeks: 1,
      highlights: ['200A service upgrade', 'EV charger circuit added', 'Passed city inspection first visit'],
      clientName: 'Thomas W.', clientRating: 5,
      clientReview: 'Fast, professional, and completely clean work. The permit inspection passed first time. I now have EV charging and the peace of mind of a modern panel.',
    },
    {
      title: 'Whole-Home Rewire – 1960s Ranch',
      description: 'Complete rewire of 1,800 sq ft ranch home, replacing knob-and-tube wiring with modern 12/2 and 14/2 Romex. All new outlets, switches, and fixtures. Walls patched and painted.',
      budgetMin: 18000, budgetMax: 24000, durationWeeks: 3,
      highlights: ['Knob-and-tube removal', 'Walls patched included', 'Home insurance approved'],
      clientName: 'Carol S.', clientRating: 5,
      clientReview: 'Our home had original knob-and-tube wiring that was a fire hazard. This team handled everything and our insurance approved us for a full coverage policy immediately after.',
    },
    {
      title: 'New Construction Electrical Rough-In',
      description: 'Electrical rough-in for a 2,400 sq ft new construction home — 42-circuit panel, low-voltage pre-wire for networking and audio, and stubbed-out for solar-ready installation.',
      budgetMin: 22000, budgetMax: 28000, durationWeeks: 4,
      highlights: ['Solar-ready conduit', 'Low-voltage pre-wire', 'On-schedule with GC'],
      clientName: 'Brian L.', clientRating: 5,
      clientReview: 'Coordinated perfectly with our general contractor. Their rough-in was clean, organized, and properly labeled — the inspector commented on how well it was done.',
    },
    {
      title: 'Commercial Lighting Retrofit – 12,000 sq ft Warehouse',
      description: 'Replaced 200 fluorescent fixtures with LED high-bay lighting across a 12,000 sq ft warehouse. Includes new switching zones, emergency egress lighting, and occupancy sensors.',
      budgetMin: 38000, budgetMax: 46000, durationWeeks: 2,
      highlights: ['42% energy reduction', 'Emergency egress compliant', 'Zero production downtime'],
      clientName: 'Frank M.', clientRating: 4,
      clientReview: 'The lighting retrofit was completed over a weekend so we had zero downtime. Energy bills dropped significantly. A couple of sensors needed adjustment after the fact but they fixed it promptly.',
    },
    {
      title: 'Smart Home Integration & Automation',
      description: 'Installed whole-home automation system including smart lighting, motorized shades, whole-home audio pre-wire, smart thermostat integration, and security system rough-in.',
      budgetMin: 14000, budgetMax: 18000, durationWeeks: 2,
      highlights: ['Lutron integration', 'Whole-home audio', 'Single-app control'],
      clientName: 'Rachel N.', clientRating: 5,
      clientReview: 'Everything in our new home is connected and controlled from one app. The attention to detail in the programming and wire management is impressive.',
    },
  ],
  PLUMBING: [
    {
      title: 'Full Bathroom Plumbing Rough-In & Finish',
      description: 'Complete plumbing for a primary bathroom remodel: new wet wall, freestanding tub drain, dual-head shower rough-in, heated towel bar, and touchless faucets.',
      budgetMin: 8500, budgetMax: 11000, durationWeeks: 2,
      highlights: ['Freestanding soaker tub', 'Dual shower heads', 'Touchless fixtures'],
      clientName: 'Natalie B.', clientRating: 5,
      clientReview: 'Our spa bathroom turned out exactly as designed. Not a single leak after 6 months of use. The team was meticulous about protecting finished surfaces during work.',
    },
    {
      title: 'Whole-House Repipe – PEX Replacement',
      description: 'Replaced all galvanized steel supply lines with PEX-A throughout a 2,200 sq ft home. Minimal wall damage, walls patched, and water pressure increased significantly.',
      budgetMin: 12000, budgetMax: 16000, durationWeeks: 3,
      highlights: ['PEX-A flexible pipe', 'Walls patched & painted', 'Water pressure increased 40%'],
      clientName: 'Steven G.', clientRating: 5,
      clientReview: 'Our water pressure was terrible. After the repipe it\'s like a completely different house. They patched all the walls so cleanly you can\'t even tell work was done.',
    },
    {
      title: 'Sewer Line Replacement – 85 ft Run',
      description: 'Replaced collapsed 85-foot clay sewer line using open-cut method. New 4-inch PVC mainline, camera inspection verification, and driveway concrete repaired to original condition.',
      budgetMin: 9800, budgetMax: 13500, durationWeeks: 2,
      highlights: ['Camera inspection included', 'Concrete fully restored', 'City permit approved'],
      clientName: 'Dorothy F.', clientRating: 4,
      clientReview: 'The sewer replacement was a stressful situation and they handled it professionally. The driveway repair was done so well we can barely see where they dug.',
    },
    {
      title: 'Outdoor Kitchen & Irrigation Plumbing',
      description: 'Plumbing installation for a full outdoor kitchen including natural gas line, hot/cold supply for sink, and a 12-zone drip irrigation system for the landscaped yard.',
      budgetMin: 7200, budgetMax: 9400, durationWeeks: 2,
      highlights: ['Gas line for outdoor grill', '12-zone irrigation', 'Hot/cold at outdoor sink'],
      clientName: 'Chris V.', clientRating: 5,
      clientReview: 'They handled every part of the outdoor kitchen and irrigation plumbing. Professional, clean work and they even labeled every irrigation valve.',
    },
    {
      title: 'Water Heater Replacement & Recirculation Loop',
      description: 'Replaced 20-year-old tank water heater with a 75-gallon high-efficiency unit, plus installed a hot water recirculation pump eliminating the 2-minute cold water wait.',
      budgetMin: 3200, budgetMax: 4200, durationWeeks: 1,
      highlights: ['Instant hot water', 'High-efficiency unit', 'Installed same day'],
      clientName: 'Margaret S.', clientRating: 5,
      clientReview: 'Instant hot water at every tap is life-changing. Installed same day as quoted, no mess, and the recirculation pump works perfectly.',
    },
  ],
  HVAC: [
    {
      title: 'Full HVAC System Replacement – 2,800 sq ft Home',
      description: 'Replaced a 22-year-old HVAC system with a 5-ton 18-SEER2 heat pump, new air handler, all new ductwork, smart thermostat, and air quality filtration system.',
      budgetMin: 18500, budgetMax: 24000, durationWeeks: 2,
      highlights: ['18 SEER2 efficiency', 'New ductwork throughout', 'Smart thermostat included'],
      clientName: 'Alan T.', clientRating: 5,
      clientReview: 'Energy bills dropped by almost 40% in the first summer. The installation was clean and professional and they cleaned up completely each day.',
    },
    {
      title: 'Commercial HVAC Zoning – 6,000 sq ft Office',
      description: 'Designed and installed a variable refrigerant flow (VRF) system across a 6,000 sq ft office, creating 8 independent zones for precise comfort control.',
      budgetMin: 62000, budgetMax: 78000, durationWeeks: 4,
      highlights: ['8 independent zones', 'VRF technology', 'BMS integration'],
      clientName: 'Patricia O.', clientRating: 5,
      clientReview: 'No more cold or hot spots. Everyone in the office controls their own zone and complaints about temperature dropped to zero after installation.',
    },
    {
      title: 'Mini-Split Installation – 5-Zone Ductless System',
      description: 'Installed a 5-zone ductless mini-split system to a home addition without existing ductwork. Includes ceiling cassette units, line sets concealed in wall chases, and smart app control.',
      budgetMin: 14000, budgetMax: 18000, durationWeeks: 2,
      highlights: ['No ductwork required', 'Smart app control', 'Line sets fully concealed'],
      clientName: 'Kevin M.', clientRating: 5,
      clientReview: 'Perfect solution for our addition. The mini-splits are whisper quiet and the concealed line sets look completely built-in.',
    },
    {
      title: 'Duct Sealing & Air Balancing – Existing Home',
      description: 'Blower door test, duct leakage assessment, and complete sealing of all accessible duct connections. Followed by air balancing across 18 registers for even distribution.',
      budgetMin: 4200, budgetMax: 5800, durationWeeks: 1,
      highlights: ['Blower door tested', 'Duct leakage reduced 65%', 'Utility rebate eligible'],
      clientName: 'Sandra L.', clientRating: 4,
      clientReview: 'Our upstairs was always 8 degrees hotter than downstairs. After the balancing it\'s now within 1-2 degrees. Great technical knowledge and fair price.',
    },
    {
      title: 'Geothermal Heat Pump Installation',
      description: 'Designed and installed a closed-loop geothermal heat pump system for a 3,400 sq ft home. Includes horizontal loop field, new air handler, and water-to-air heat pump unit.',
      budgetMin: 38000, budgetMax: 48000, durationWeeks: 6,
      highlights: ['30% federal tax credit eligible', 'Lowest operating cost', '25-year system life'],
      clientName: 'George W.', clientRating: 5,
      clientReview: 'A significant investment but the operating costs are remarkably low. The team clearly understood geothermal systems and the installation was handled flawlessly.',
    },
  ],
  ROOFING: [
    {
      title: 'Full Roof Replacement – Architectural Shingles',
      description: 'Tear-off and replacement of 3,200 sq ft roof with GAF Timberline HDZ architectural shingles. New underlayment, ice-and-water shield, ridge cap, and ridge vents installed.',
      budgetMin: 14500, budgetMax: 18000, durationWeeks: 1,
      highlights: ['GAF Master Elite certified', '50-year shingle warranty', 'Completed in 2 days'],
      clientName: 'Barbara J.', clientRating: 5,
      clientReview: 'Our roof needed complete replacement after hail damage. They worked with our insurance, completed the job in two days, and cleaned up the yard perfectly.',
    },
    {
      title: 'Commercial Low-Slope Roof – TPO Membrane',
      description: 'Installed a 15,000 sq ft TPO roofing system on a commercial building, including tapered insulation for positive drainage, roof drains, and 20-year manufacturer warranty.',
      budgetMin: 72000, budgetMax: 92000, durationWeeks: 3,
      highlights: ['20-year membrane warranty', 'Positive drainage design', 'OSHA compliant safety plan'],
      clientName: 'William C.', clientRating: 5,
      clientReview: 'Outstanding commercial roofing work. Their project management kept everything on schedule and the TPO installation looks and tests perfect after two full rainy seasons.',
    },
    {
      title: 'Standing Seam Metal Roof – 4,100 sq ft',
      description: 'Installed a concealed-fastener standing seam metal roof with custom Kynar coating in dark bronze. Includes snow guards, integrated gutters, and solar mount blocking.',
      budgetMin: 52000, budgetMax: 65000, durationWeeks: 3,
      highlights: ['50-year metal warranty', 'Solar-mount ready', 'Custom color Kynar coating'],
      clientName: 'Elizabeth H.', clientRating: 5,
      clientReview: 'The standing seam roof completely transformed the curb appeal of our home. Craftsmanship is exceptional — every seam is perfectly straight.',
    },
    {
      title: 'Emergency Roof Repair After Storm Damage',
      description: 'Emergency response to storm damage including temporary tarping, insurance documentation photos, and full repair of damaged sections within 48 hours of initial contact.',
      budgetMin: 6800, budgetMax: 9200, durationWeeks: 1,
      highlights: ['48-hour response', 'Insurance documentation', 'No interior water damage'],
      clientName: 'Paul N.', clientRating: 5,
      clientReview: 'Called at 8pm after the storm and they were there by 8am with tarps and a full assessment. Insurance claim was handled perfectly. Responsive and trustworthy.',
    },
    {
      title: 'Skylight Installation & Curb Flashing',
      description: 'Installed three Velux FCM fixed skylights with factory-supplied flashing kits, interior light wells, and manual shades. Coordinated interior drywall and painting.',
      budgetMin: 9500, budgetMax: 12500, durationWeeks: 1,
      highlights: ['Zero leaks after 2 years', 'Interior drywall included', 'Velux certified installer'],
      clientName: 'Donna R.', clientRating: 5,
      clientReview: 'Beautiful skylights, zero leaks through two full winters. They handled the interior light wells so the finish looks completely custom.',
    },
  ],
  FLOORING: [
    {
      title: 'Whole-Home Hardwood Installation – 2,600 sq ft',
      description: 'Installed 2,600 sq ft of 5-inch white oak engineered hardwood throughout a two-story home. Includes glue-down over concrete slab on grade and staple-down over wood subfloor.',
      budgetMin: 28000, budgetMax: 36000, durationWeeks: 2,
      highlights: ['White oak engineered', 'Glue-down over concrete', 'Lifetime finish warranty'],
      clientName: 'Melissa K.', clientRating: 5,
      clientReview: 'Our floors look absolutely stunning. The installation is seamless — every transition and threshold is perfectly executed.',
    },
    {
      title: 'Large-Format Tile Installation – Primary Bath & Kitchen',
      description: 'Installed 24×48 porcelain large-format tile in a primary bathroom and kitchen totaling 680 sq ft. Lippage less than 1/16" throughout. Heated floor in bathroom.',
      budgetMin: 12000, budgetMax: 16000, durationWeeks: 2,
      highlights: ['Radiant heat under tile', 'Sub-1/16" lippage', '24×48 large format'],
      clientName: 'Susan G.', clientRating: 5,
      clientReview: 'The large-format tile is perfectly level — not a single tile out of plane. The heated floor mat has made our bathroom the best room in the house.',
    },
    {
      title: 'Staircase Refinish & New Balusters',
      description: 'Refinished 18-step oak staircase with new water-based stain and satin finish, replaced existing turned balusters with square metal spindles, and added new shoe rail.',
      budgetMin: 4800, budgetMax: 6400, durationWeeks: 1,
      highlights: ['Low-VOC finish', 'Metal baluster upgrade', '1-year workmanship warranty'],
      clientName: 'Anthony B.', clientRating: 5,
      clientReview: 'The staircase was the only thing that looked dated in our home. Now it\'s the focal point everyone notices first. Beautiful work.',
    },
    {
      title: 'Commercial Polished Concrete – 8,000 sq ft',
      description: 'Ground, densified, and polished 8,000 sq ft of existing concrete slab to an 800-grit cream finish with integral guard coating for a retail space.',
      budgetMin: 32000, budgetMax: 42000, durationWeeks: 2,
      highlights: ['800-grit cream finish', 'Retail-grade guard coat', 'Scratch-resistant surface'],
      clientName: 'Nancy W.', clientRating: 4,
      clientReview: 'The polished concrete floor gives our retail space a premium look that fits the brand perfectly. A few edge areas needed touch-up but overall great quality.',
    },
    {
      title: 'Hardwood Floor Restoration – 1940s Home',
      description: 'Sanded, stained, and refinished original 2¼-inch strip oak floors throughout a 1940s home. Repaired 140 sq ft of damaged boards and matched the original stain exactly.',
      budgetMin: 6200, budgetMax: 8500, durationWeeks: 1,
      highlights: ['Original wood preserved', 'Exact stain match', 'Zero chemical odor finish'],
      clientName: 'Harold S.', clientRating: 5,
      clientReview: 'They brought our 1940s oak floors back to life. The stain match to our existing trim is perfect and the water-based finish dried with no odor.',
    },
  ],
  PAINTING: [
    {
      title: 'Whole-Home Interior Paint – 4,200 sq ft',
      description: 'Interior repaint of a 4,200 sq ft home with Benjamin Moore Aura throughout. Includes ceiling, walls, trim, doors, and closets. All furniture moved and protected.',
      budgetMin: 18000, budgetMax: 24000, durationWeeks: 2,
      highlights: ['Benjamin Moore Aura', 'Furniture protection included', 'Zero paint on floors or fixtures'],
      clientName: 'Joyce M.', clientRating: 5,
      clientReview: 'Immaculate work. Every edge is perfectly crisp and they left the house cleaner than they found it. Our home looks brand new.',
    },
    {
      title: 'Exterior Repaint – Victorian Home',
      description: 'Full exterior repaint of a Victorian-era home in a 5-color scheme including body, trim, sash, shutters, and porch details. Included wood repair, caulking, and primer coat.',
      budgetMin: 22000, budgetMax: 30000, durationWeeks: 3,
      highlights: ['5-color Victorian scheme', 'Wood rot repair included', '10-year exterior warranty'],
      clientName: 'Arthur D.', clientRating: 5,
      clientReview: 'Our Victorian is the talk of the neighborhood. The 5-color scheme was expertly applied and the prep work they did on the wood rot saved us from a much bigger problem.',
    },
    {
      title: 'Commercial Office Paint & Accent Walls',
      description: 'Interior paint of 3,500 sq ft office including branded accent walls in company colors, semi-gloss on all trim and doors, and epoxy paint in the server room.',
      budgetMin: 12000, budgetMax: 16000, durationWeeks: 1,
      highlights: ['Brand color match certified', 'After-hours work', 'Completed in 4 days'],
      clientName: 'Cynthia R.', clientRating: 5,
      clientReview: 'They completed the office paint over a long weekend so we had zero business disruption. The brand color match is exact and the office looks completely transformed.',
    },
    {
      title: 'Cabinet Refinishing – Kitchen & Bathrooms',
      description: 'Spray-finished 42 cabinet boxes and doors in the kitchen and two bathrooms with Sherwin-Williams Emerald Urethane, transforming dark oak into a crisp white.',
      budgetMin: 7500, budgetMax: 9800, durationWeeks: 2,
      highlights: ['Factory-quality spray finish', 'Hardware upgraded', 'Fully cured before use'],
      clientName: 'Timothy F.', clientRating: 5,
      clientReview: 'The cabinet transformation is remarkable. The spray finish is smooth as glass and after 18 months of use, no chips or yellowing.',
    },
    {
      title: 'Decorative Faux Finish & Texture Work',
      description: 'Applied Venetian plaster in the dining room and library, custom color wash in two bedrooms, and textured ceilings restored in the master suite and hallways.',
      budgetMin: 9000, budgetMax: 13000, durationWeeks: 2,
      highlights: ['Venetian plaster dining room', 'Custom color wash', 'Artisan-level finish'],
      clientName: 'Virginia L.', clientRating: 5,
      clientReview: 'The Venetian plaster in our dining room is a showpiece. The craftsmanship is exceptional — every guest asks who did the work.',
    },
  ],
  LANDSCAPING: [
    {
      title: 'Full Landscape Design & Installation',
      description: 'Designed and installed complete landscape for a new construction home: hardscape patio, raised planter beds, sod installation, irrigation system, and landscape lighting.',
      budgetMin: 48000, budgetMax: 62000, durationWeeks: 4,
      highlights: ['Designed by licensed landscape architect', '12-zone drip irrigation', 'LED landscape lighting'],
      clientName: 'Deborah C.', clientRating: 5,
      clientReview: 'Transformed a bare construction lot into a beautiful outdoor living space. Every plant selection and placement was thoughtful and the hardscape is stunning.',
    },
    {
      title: 'Backyard Outdoor Living Renovation',
      description: 'Complete backyard renovation including travertine paver patio, pergola with electrical, built-in BBQ station, fire pit area, and drought-tolerant planting beds.',
      budgetMin: 58000, budgetMax: 75000, durationWeeks: 6,
      highlights: ['Travertine paver patio', 'Built-in BBQ + fire pit', 'Pergola with electricity'],
      clientName: 'Richard A.', clientRating: 5,
      clientReview: 'Our backyard is now our favorite room in the house. We use it year-round and have hosted 20+ events in it. The quality of every element is excellent.',
    },
    {
      title: 'Commercial Grounds Maintenance & Renovation',
      description: 'Complete renovation of a 2-acre commercial property including removal of overgrown plantings, regrading, sod replacement, and new irrigation with smart controller.',
      budgetMin: 36000, budgetMax: 48000, durationWeeks: 3,
      highlights: ['Smart irrigation controller', '2-acre property', 'HOA approved design'],
      clientName: 'Sharon B.', clientRating: 4,
      clientReview: 'Our property looks completely professional now. The smart irrigation has cut our water use by 30% and the renovation came in under budget.',
    },
    {
      title: 'Pool Deck & Surround Landscaping',
      description: 'Installed 1,200 sq ft of natural travertine pool deck, decomposed granite pathways, and tropical planting beds around an existing pool.',
      budgetMin: 24000, budgetMax: 32000, durationWeeks: 3,
      highlights: ['Non-slip travertine', 'Tropical plant palette', 'Pool-safe materials throughout'],
      clientName: 'Joseph T.', clientRating: 5,
      clientReview: 'The pool area looks like a luxury resort. The travertine stays cool underfoot and the tropical plants are thriving a year later.',
    },
    {
      title: 'Retaining Wall & Slope Stabilization',
      description: 'Constructed 240 linear feet of segmental retaining wall on a steep slope, with engineered geogrid reinforcement, drainage aggregate backfill, and erosion-control planting.',
      budgetMin: 42000, budgetMax: 56000, durationWeeks: 4,
      highlights: ['Engineered retaining wall', 'Geogrid reinforcement', 'Drainage system integrated'],
      clientName: 'Frances N.', clientRating: 5,
      clientReview: 'The slope was eroding every winter and destroying our yard. The retaining wall has held perfectly through two full rainy seasons. Excellent engineering and execution.',
    },
  ],
  DEMOLITION: [
    {
      title: 'Interior Selective Demo – Pre-Renovation',
      description: 'Selective interior demolition of 3,800 sq ft commercial space including removal of existing partitions, drop ceiling, flooring, and mechanical rough-in for renovation prep.',
      budgetMin: 28000, budgetMax: 38000, durationWeeks: 2,
      highlights: ['Hazmat pre-inspection included', 'Zero structural damage', 'Debris hauled within 24 hrs'],
      clientName: 'Larry G.', clientRating: 5,
      clientReview: 'Selective demo done perfectly — they removed exactly what needed to go and left everything else intact. The general contractor said the prep was the cleanest they\'d seen.',
    },
    {
      title: 'Residential Pool Removal & Fill',
      description: 'Demolished a 12×24 ft in-ground concrete pool, properly perforated the shell for drainage, and backfilled with compacted engineered fill. Compaction test passed.',
      budgetMin: 14000, budgetMax: 19000, durationWeeks: 2,
      highlights: ['Compaction test passed', 'Engineered fill used', 'Permit from city obtained'],
      clientName: 'Patrick S.', clientRating: 5,
      clientReview: 'The pool had become a liability and they removed it cleanly and professionally. Compaction test passed first attempt and the lot is now fully buildable.',
    },
    {
      title: 'Concrete Driveway Removal & Disposal',
      description: 'Removed 3,200 sq ft of existing concrete driveway and apron using hydraulic breaker, hauled 180 cubic yards of debris, and subgrade prepared for new installation.',
      budgetMin: 8500, budgetMax: 11000, durationWeeks: 1,
      highlights: ['Same-day debris hauling', 'Subgrade leveled', 'Zero damage to adjacent surfaces'],
      clientName: 'Helen A.', clientRating: 4,
      clientReview: 'Large job completed efficiently in two days. The subgrade prep was done well and our new contractor praised how clean it was left.',
    },
    {
      title: 'Chimney & Masonry Demolition',
      description: 'Demolished two interior chimneys from roofline to basement, bricked up fireplace openings, repaired roof penetrations, and patched all interior walls to match existing finishes.',
      budgetMin: 12000, budgetMax: 16000, durationWeeks: 2,
      highlights: ['Interior walls patched', 'Roof penetrations sealed', 'Structural header added'],
      clientName: 'Raymond K.', clientRating: 5,
      clientReview: 'Two old chimneys gone cleanly with no structural issues. The wall and ceiling patches are almost invisible. Professional and thorough work.',
    },
    {
      title: 'Structural Wall Removal & Beam Installation',
      description: 'Removed two load-bearing walls and installed a 24-foot LVL beam to create an open living space. Includes temporary shoring, engineering stamped drawings, and permit.',
      budgetMin: 18000, budgetMax: 24000, durationWeeks: 1,
      highlights: ['Engineer-stamped drawings', 'Permit obtained', 'Shoring plan executed safely'],
      clientName: 'Shirley P.', clientRating: 5,
      clientReview: 'They removed two load-bearing walls safely with proper engineering and permits. The open plan they created is transformative. Passed structural inspection first visit.',
    },
  ],
  OTHER: [
    {
      title: 'Custom Home Theater Build-Out',
      description: 'Constructed a dedicated 400 sq ft home theater room with acoustic wall panels, tiered seating platform, 4K projection system, 7.2 Dolby Atmos audio, and custom millwork.',
      budgetMin: 62000, budgetMax: 82000, durationWeeks: 8,
      highlights: ['7.2 Dolby Atmos', 'Acoustic wall treatment', 'Custom tiered platform'],
      clientName: 'Dennis W.', clientRating: 5,
      clientReview: 'The home theater exceeds every expectation. The acoustic treatment and sound system were engineered perfectly. It genuinely rivals a commercial cinema.',
    },
    {
      title: 'Wine Cellar Construction & Climate Control',
      description: 'Built a 350 sq ft temperature-controlled wine cellar with custom redwood racking, CellarPro cooling unit, stone tile floor, and distressed brick wall panels.',
      budgetMin: 48000, budgetMax: 62000, durationWeeks: 6,
      highlights: ['Holds 2,400 bottles', 'CellarPro climate control', 'Stone & brick aesthetic'],
      clientName: 'Gloria S.', clientRating: 5,
      clientReview: 'Our wine cellar is absolutely spectacular. The craftsmanship on the custom racking is superb and the temperature has held at 55°F through every season.',
    },
    {
      title: 'ADA Accessibility Renovation',
      description: 'Full ADA compliance upgrade for a commercial retail space: widened doorways, installed automatic door operators, lowered service counters, and added compliant restrooms.',
      budgetMin: 38000, budgetMax: 52000, durationWeeks: 4,
      highlights: ['ADA inspector approved', 'Zero business interruption', 'Tax credit eligible'],
      clientName: 'Carl B.', clientRating: 5,
      clientReview: 'The ADA upgrade was handled with minimal disruption to our business. The inspector passed every element and our customers have noticed the improved accessibility.',
    },
    {
      title: 'Custom Workshop & Tool Room Build-Out',
      description: 'Constructed a detached 600 sq ft workshop with 200A sub-panel, compressed air rough-in, epoxy floor, radiant heat, dust collection rough-in, and custom workbench millwork.',
      budgetMin: 42000, budgetMax: 55000, durationWeeks: 6,
      highlights: ['200A sub-panel', 'Radiant heated floor', 'Dust collection system'],
      clientName: 'Kenneth D.', clientRating: 5,
      clientReview: 'Best investment I\'ve made in my home. The workshop is perfectly equipped for serious woodworking. Every detail was built to last.',
    },
    {
      title: 'Fence & Privacy Screen Installation',
      description: 'Installed 320 linear feet of 6-foot cedar privacy fence with custom lattice top sections, a double-wide automated gate, and post lighting throughout.',
      budgetMin: 16000, budgetMax: 22000, durationWeeks: 2,
      highlights: ['Automated gate included', 'Post lighting throughout', 'Cedar naturally treated'],
      clientName: 'Ruth H.', clientRating: 5,
      clientReview: 'Beautifully built fence. Perfectly straight posts, tight board gaps, and the automated gate works flawlessly. Several neighbors have already asked for the contact.',
    },
  ],
};

// Fallback to GENERAL templates if trade not found
function getTemplates(specialties: string[]) {
  for (const s of specialties) {
    if (TEMPLATES[s]) return { trade: s, templates: TEMPLATES[s] };
  }
  return { trade: 'GENERAL', templates: TEMPLATES.GENERAL };
}

const CITIES = [
  { city: 'Austin',       state: 'TX' },
  { city: 'Dallas',       state: 'TX' },
  { city: 'Houston',      state: 'TX' },
  { city: 'Phoenix',      state: 'AZ' },
  { city: 'Denver',       state: 'CO' },
  { city: 'Nashville',    state: 'TN' },
  { city: 'Charlotte',    state: 'NC' },
  { city: 'Atlanta',      state: 'GA' },
  { city: 'Tampa',        state: 'FL' },
  { city: 'San Antonio',  state: 'TX' },
];

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function main() {
  const contractors = await prisma.contractorProfile.findMany({
    select: { id: true, userId: true, specialties: true, city: true, state: true },
  });

  console.log(`Seeding portfolio projects for ${contractors.length} contractors…`);

  for (const contractor of contractors) {
    const { trade, templates } = getTemplates(contractor.specialties);
    const photos = PHOTOS[trade] ?? PHOTOS.GENERAL;

    const projects = templates.map((t, i) => {
      const location = contractor.city && contractor.state
        ? { city: contractor.city, state: contractor.state }
        : CITIES[randInt(0, CITIES.length - 1)];

      return {
        id:            `proj_${contractor.id}_${i}`,
        title:         t.title,
        description:   t.description,
        tradeType:     trade,
        city:          location.city,
        state:         location.state,
        budgetMin:     t.budgetMin,
        budgetMax:     t.budgetMax,
        durationWeeks: t.durationWeeks,
        completedAt:   daysAgo(randInt(30, 540)),
        photos:        photos.slice(0, 2 + (i % 2)), // 2 or 3 photos per project
        clientName:    t.clientName,
        clientReview:  t.clientReview,
        clientRating:  t.clientRating,
        highlights:    t.highlights,
      };
    });

    await prisma.contractorProfile.update({
      where: { id: contractor.id },
      data:  { portfolioProjects: projects },
    });

    console.log(`  ✓ ${contractor.id}  →  ${projects.length} projects  (${trade})`);
  }

  console.log('\nDone.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
