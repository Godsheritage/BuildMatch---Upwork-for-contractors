# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # ts-node-dev hot reload on port 3001
npm run build        # tsc → dist/
npm start            # node dist/server.js

npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:migrate   # Create + apply migration (prompts for name)
npm run db:studio    # Prisma Studio GUI at localhost:5555
```

Environment variables in `.env` (see `.env.example`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — long random string
- `JWT_EXPIRES_IN` — token lifetime, e.g. `7d`
- `PORT` — defaults to `3001`
- `FRONTEND_URL` — allowed CORS origin, e.g. `http://localhost:5173`

## Architecture

Entry: `src/server.ts` → imports `src/app.ts` → starts HTTP listener.

`app.ts` wires middleware in this exact order — do not reorder:
1. `helmet()` — security headers
2. `cors({ origin: FRONTEND_URL })` — never use `*`
3. `rateLimit({ windowMs: 15min, max: 100 })` — per-IP throttle
4. `express.json()` + `express.urlencoded({ extended: true })`
5. Routes: `/health`, `/api/auth`, `/api/users`, `/api/contractors`, `/api/jobs`
6. `errorHandler` — **must be last**

Prisma singleton lives at `src/lib/prisma.ts` (lazy proxy pattern). Import it everywhere rather than instantiating `PrismaClient` directly.

TypeScript compiles to `dist/` (CommonJS). `ts-node-dev` runs source directly in dev with `--transpile-only`.

## Folder Structure

```
src/
  routes/       # Express routers — thin, just mounts middleware chains
  controllers/  # Request handlers — call service, send response
  middleware/   # auth, validate, error
  services/     # All business logic and Prisma calls
  schemas/      # Zod schemas for request validation
  types/        # express.d.ts — extends Request with req.user
  utils/        # jwt, password, response, app-error
  lib/          # prisma.ts singleton
  app.ts
  server.ts
```

## API Routes

### Auth — `/api/auth`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | — | Register; body validated by `registerSchema` |
| POST | `/api/auth/login` | — | Login; returns `{ user, token }` |
| GET | `/api/auth/me` | `authenticate` | Returns current user from token |

### Contractors — `/api/contractors`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/contractors` | — | List contractors (query: search, state, city, minRating, available, page, limit) |
| GET | `/api/contractors/:id` | — | Contractor profile detail |
| PUT | `/api/contractors/me` | `authenticate` + `requireRole('CONTRACTOR')` | Upsert own profile |

**Route ordering:** `PUT /me` declared before `GET /:id` to prevent param capture.

### Jobs — `/api/jobs`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/jobs/my-jobs` | `authenticate` + `requireRole('INVESTOR')` | Investor's own jobs |
| GET | `/api/jobs` | — | List open jobs (query: tradeType, state, city, minBudget, maxBudget, search, status, page, limit) |
| GET | `/api/jobs/:id` | `optionalAuthenticate` | Job detail; adds `hasBid: bool` when caller is authenticated contractor |
| POST | `/api/jobs` | `authenticate` + `requireRole('INVESTOR')` | Create job |
| PUT | `/api/jobs/:id` | `authenticate` + `requireRole('INVESTOR')` | Update job (OPEN status only) |
| DELETE | `/api/jobs/:id` | `authenticate` + `requireRole('INVESTOR')` | Cancel job (sets status CANCELLED) |

### Bids — nested under `/api/jobs/:jobId/bids`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/jobs/:jobId/bids/my-bid` | `authenticate` + `requireRole('CONTRACTOR')` | Contractor's own bid on a job |
| GET | `/api/jobs/:jobId/bids` | `authenticate` | All bids — restricted to job owner or ADMIN |
| POST | `/api/jobs/:jobId/bids` | `authenticate` + `requireRole('CONTRACTOR')` | Submit bid (one per contractor per job) |
| PUT | `/api/jobs/:jobId/bids/:bidId/accept` | `authenticate` + `requireRole('INVESTOR')` | Accept bid — atomically rejects others, sets job AWARDED |
| PUT | `/api/jobs/:jobId/bids/:bidId/withdraw` | `authenticate` + `requireRole('CONTRACTOR')` | Withdraw PENDING bid |

**Route ordering:** `/my-bid` declared before `/:bidId/*` to prevent param capture.

### Health
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | — | Liveness check; returns `{ status: 'ok' }` |

## Database Models

```prisma
enum Role        { INVESTOR CONTRACTOR ADMIN }
enum JobStatus   { OPEN AWARDED IN_PROGRESS COMPLETED CANCELLED }
enum BidStatus   { PENDING ACCEPTED REJECTED WITHDRAWN }
enum TradeType   { GENERAL ELECTRICAL PLUMBING HVAC ROOFING FLOORING PAINTING LANDSCAPING DEMOLITION OTHER }

model User {
  id          String             @id @default(cuid())
  email       String             @unique
  password    String             // bcrypt, never select in responses
  role        Role
  firstName   String
  lastName    String
  phone       String?
  isVerified  Boolean            @default(false)
  isActive    Boolean            @default(true)
  contractor  ContractorProfile?
  postedJobs  Job[]              @relation("InvestorJobs")
}

model ContractorProfile {
  id                String    @id @default(cuid())
  userId            String    @unique
  user              User
  bio               String?
  yearsExperience   Int       @default(0)
  specialties       String[]
  licenseNumber     String?
  licenseState      String?
  isLicenseVerified Boolean   @default(false)
  insuranceExpiry   DateTime?
  hourlyRateMin     Float?
  hourlyRateMax     Float?
  portfolioImages   String[]
  city              String?
  state             String?
  zipCode           String?
  averageRating     Float     @default(0)
  totalReviews      Int       @default(0)
  completedJobs     Int       @default(0)
  isAvailable       Boolean   @default(true)
}

model Job {
  id          String    @id @default(cuid())
  title       String
  description String
  tradeType   TradeType
  budgetMin   Float
  budgetMax   Float
  city        String
  state       String
  zipCode     String
  status      JobStatus @default(OPEN)
  investorId  String
  investor    User      @relation("InvestorJobs")
  bids        Bid[]
}

model Bid {
  id           String    @id @default(cuid())
  jobId        String
  job          Job
  contractorId String    // references User.id — not a schema relation
  amount       Float
  message      String
  status       BidStatus @default(PENDING)
}
```

**Bid ↔ ContractorProfile relationship:** There is no schema-level `@relation` between `Bid` and `ContractorProfile`. The `getJobBids` service enriches bids manually: fetch bids → collect unique `contractorId` values → query `contractorProfile WHERE userId IN [...]` → merge via `Map`. This avoids a migration while still populating contractor data.

## Validation Schemas

### createJobSchema
- `title`: 10–120 chars
- `description`: 50–2000 chars
- `tradeType`: enum
- `budgetMin` / `budgetMax`: positive numbers; refinement: `budgetMin < budgetMax`
- `city`, `state`, `zipCode`: non-empty strings

### updateJobSchema
Same fields, all optional. Refinement validates budget constraint against persisted values (reads DB before applying partial update).

### createBidSchema
- `amount`: positive number
- `message`: 20–500 chars

### registerSchema
- `email`: valid email
- `password`: min 8 chars, requires uppercase + number
- `firstName` / `lastName`: 2–100 chars
- `role`: `'INVESTOR' | 'CONTRACTOR'`

### updateContractorProfileSchema
All fields optional. Refinement: `hourlyRateMin <= hourlyRateMax` (when both provided).

## Key Patterns

### Response shape
Always `{ success, data?, message?, errors? }`. Use `sendSuccess` / `sendError` from `src/utils/response.utils.ts`. Never return raw Prisma objects directly.

### Error handling
- Services throw `new AppError(message, statusCode)` for domain errors.
- Controllers catch all errors and call `sendError(res, err.message, err.statusCode)`.
- The global `errorHandler` middleware handles any uncaught errors as a last resort.
- Never let Prisma errors bubble to the client uncaught.

### Auth flow
`Authorization: Bearer <token>` header → `authenticate` middleware → `verifyToken()` → sets `req.user: { userId, role }` → controllers read `req.user!.userId`.

`optionalAuthenticate` is identical but silently continues if no/invalid token — used on public routes that benefit from knowing the caller (e.g., `GET /jobs/:id` adds `hasBid`).

### Atomic bid acceptance
`acceptBid` uses `prisma.$transaction([...])` to atomically:
1. `updateMany` — reject all other PENDING bids on the job
2. `update` — set the chosen bid to ACCEPTED
3. `update` — set the job status to AWARDED

Returns `results[1]` (the accepted Bid record).

### Partial budget update validation
`updateJob` reads the existing job before applying the patch, computes `newMin = input.budgetMin ?? job.budgetMin`, and validates `newMin < newMax` to prevent invalid state when only one budget boundary is updated.

### Password security
`password` field is never included in any Prisma select. Services explicitly omit it or use targeted selects.

### Route collision prevention
Static segments must be declared before dynamic params in every router:
- `/my-jobs` before `/:id`
- `/:jobId/bids/my-bid` before `/:jobId/bids/:bidId/...`
