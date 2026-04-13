# BuildMatch API Documentation

Base URL: `http://localhost:3001` (dev) · `https://api.buildmatch.us` (production)

---

## Local Setup

### Prerequisites

- **Node.js** v18.12+ (v18.x recommended — v20+ works but may show engine warnings)
- **npm** v8+
- A **Supabase** project (free tier works) — provides PostgreSQL + Storage + Realtime
- An **Anthropic API key** (for AI features — optional, app runs without it if `AI_ENABLED=false`)

### 1. Clone and install

```bash
cd buildmatch-backend
npm install
```

### 2. Create your `.env` file

Copy the example and fill in your values:

```bash
cp .env.example .env
```

**Required variables:**

| Variable | Where to get it | Notes |
|----------|----------------|-------|
| `DATABASE_URL` | Supabase → Settings → Database → Connection string (Transaction mode, port 6543) | Append `?pgbouncer=true&connection_limit=1` |
| `DIRECT_URL` | Supabase → Settings → Database → Connection string (Session mode, port 5432) | Used only for migrations |
| `JWT_SECRET` | Generate: `openssl rand -hex 32` | At least 32 chars |
| `SUPABASE_URL` | Supabase → Settings → API → Project URL | `https://xxxxx.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → `service_role` key | **Never expose to frontend** |

**Optional variables:**

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3001` | |
| `JWT_EXPIRES_IN` | `7d` | |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allow-list (comma-separated for multiple origins) |
| `ANTHROPIC_API_KEY` | — | Required for AI features |
| `AI_ENABLED` | `true` | Set `false` to disable all `/api/ai/*` routes |
| `GOOGLE_CLIENT_ID` | — | For Google OAuth login |
| `RESEND_API_KEY` | — | For real email delivery. When unset, emails log to console |
| `EMAIL_FROM` | `BuildMatch <noreply@buildmatch.us>` | |

### 3. Set up the database

Generate the Prisma client and apply migrations:

```bash
npm run db:generate       # Generate Prisma client from schema
npm run db:migrate        # Apply Prisma-managed migrations
```

> **Important:** Some tables (disputes, saved contractors, properties, estimates) are managed outside Prisma via raw SQL. These are created by one-shot migration scripts (`.migrate_*.js` files). If you're starting from a fresh database, the tables were already created during initial setup. If they're missing, ask a team member for the SQL or check `prisma/supabase_disputes_tables.sql`.

### 4. Create Supabase Storage buckets

Go to **Supabase Dashboard → Storage** and create these buckets:

| Bucket | Public | Notes |
|--------|--------|-------|
| `avatars` | Yes | User profile photos |
| `job-photos` | Yes | Job posting photos |
| `dispute-evidence` | Yes | Dispute evidence + ID documents |
| `draw-evidence` | Yes | Draw request evidence |
| `bug-reports` | Yes | Bug report screenshots |
| `estimate-photos` | Yes | Property estimate photos |

Set file size limit to 15 MB and allowed MIME types to `image/jpeg, image/png, image/webp, image/heic` on each.

### 5. Seed the database (optional)

```bash
npm run db:seed           # Creates sample users (investor + contractor)
npm run db:seed-jobs      # Creates sample jobs with bids
```

### 6. Start the dev server

```bash
npm run dev
```

The server starts at `http://localhost:3001` with hot reload via `ts-node-dev`.

Verify it's running:
```bash
curl http://localhost:3001/health
# → { "success": true, "data": { "status": "ok" } }
```

### Available scripts

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload (port 3001) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm start` | Run compiled production build |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Create and apply a new Prisma migration |
| `npm run db:studio` | Open Prisma Studio GUI at localhost:5555 |
| `npm run db:seed` | Seed sample users |
| `npm run db:seed-jobs` | Seed sample jobs + bids |

### Project structure

```
src/
  app.ts              # Express app setup (middleware + route mounting)
  server.ts           # HTTP listener entry point
  routes/             # Express routers (thin — just middleware chains)
    admin/            # Admin-only routes (auth + requireAdmin applied once in index.ts)
    ai/               # AI feature routes
  controllers/        # Request handlers — call service, send response
  services/           # Business logic + database calls
    ai/               # AI service files (one per feature)
    admin/            # Admin-only services
  middleware/         # auth, validate, error, admin
  schemas/            # Zod validation schemas
  config/             # Configuration files (estimator areas, etc.)
  types/              # TypeScript type definitions
  utils/              # JWT, password hashing, response helpers, content filter
  lib/                # Prisma singleton, Supabase client
  prisma/
    schema.prisma     # Database schema
```

### Troubleshooting

| Problem | Solution |
|---------|----------|
| `MaxClientsInSessionMode` | Use port 6543 (transaction mode) in `DATABASE_URL` with `?pgbouncer=true&connection_limit=1` |
| `ANTHROPIC_API_KEY not set` | Set `AI_ENABLED=false` in `.env` if you don't need AI features |
| Prisma client out of date | Run `npm run db:generate` after any schema change |
| Missing dispute/property tables | These are Supabase raw-SQL tables — ask a team member for the migration scripts |
| CORS errors from frontend | Ensure `FRONTEND_URL` in `.env` matches your frontend's origin exactly |
| Emails not sending | Check `RESEND_API_KEY` is set. Without it, emails log to the console (this is fine for dev) |

---

All responses follow the shape:
```json
{ "success": true|false, "data": ..., "message": "...", "errors": [...] }
```

## Authentication

Most endpoints require a JWT in the `Authorization` header:
```
Authorization: Bearer <token>
```

Tokens are returned from `/api/auth/login` and `/api/auth/register`. They expire based on the `JWT_EXPIRES_IN` env var (default `7d`).

### Auth levels used in this doc

| Tag | Meaning |
|-----|---------|
| **Public** | No auth required |
| **Auth** | Valid JWT required |
| **Investor** | JWT + `role === 'INVESTOR'` |
| **Contractor** | JWT + `role === 'CONTRACTOR'` |
| **Admin** | JWT + `role === 'ADMIN'` |
| **Optional** | JWT accepted but not required (enriches response if present) |

---

## Health Check

| Method | Path | Auth |
|--------|------|------|
| GET | `/health` | Public |

**Response:** `{ "status": "ok" }`

---

## Auth (`/api/auth`)

### Register

```
POST /api/auth/register
```
**Auth:** Public

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| email | string | Yes | Must be unique |
| password | string | Yes | Min 8 chars, 1 uppercase, 1 number |
| role | `"INVESTOR"` \| `"CONTRACTOR"` | Yes | |
| firstName | string | Yes | 2-100 chars |
| lastName | string | Yes | 2-100 chars |

**Response:** `{ user, token }`

### Login

```
POST /api/auth/login
```
**Auth:** Public

| Field | Type | Required |
|-------|------|----------|
| email | string | Yes |
| password | string | Yes |

**Response:** `{ user, token }`

### Google OAuth

```
POST /api/auth/google
```
**Auth:** Public

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| idToken | string | Yes | Google ID token from GIS |
| role | string | No | Required for new users |
| firstName | string | No | |
| lastName | string | No | |

**Response:** `{ user, token, isNewUser }`

### Get Current User

```
GET /api/auth/me
```
**Auth:** Auth

**Response:** Full user object with all profile fields.

### Link / Unlink Google

```
POST /api/auth/google/link      // Auth
POST /api/auth/google/unlink    // Auth
```
**Body (link):** `{ idToken: string }`

### Forgot Password

```
POST /api/auth/forgot-password
```
**Auth:** Public · **Rate limit:** 5 per 15 minutes per IP

| Field | Type | Required |
|-------|------|----------|
| email | string | Yes |

Always returns 200 regardless of whether the email exists (prevents enumeration).

### Verify Reset Token

```
GET /api/auth/reset-password/verify?token=<token>
```
**Auth:** Public

**Response:** `{ valid: true }` or 400 error.

### Reset Password

```
POST /api/auth/reset-password
```
**Auth:** Public

| Field | Type | Required |
|-------|------|----------|
| token | string | Yes |
| password | string | Yes |

### Email Verification

```
POST /api/auth/email/verify/request    // Auth — sends verification email
POST /api/auth/email/verify/confirm    // Public — body: { token }
```

### ID Document Submit

```
POST /api/auth/identity/document    // Auth
```
| Field | Type | Required |
|-------|------|----------|
| documentUrl | string | Yes |

---

## Users (`/api/users`)

### Update Profile

```
PUT /api/users/me
```
**Auth:** Auth

All fields optional:

| Field | Type |
|-------|------|
| firstName | string |
| lastName | string |
| phone | string |
| bio | string |
| city | string |
| state | string |
| company | string |
| title | string |
| website | string |
| displayName | string |
| pronouns | string |
| timezone | string |
| locale | string |
| dateFormat | string |
| numberFormat | string |
| quietHoursStart | string |
| quietHoursEnd | string |
| profilePublic | boolean |
| projectPreference | string |
| aiPreference | string |

### Avatar

```
PUT /api/users/me/avatar       // Body: { avatarUrl: string }
DELETE /api/users/me/avatar
```
**Auth:** Auth

### Notification Preferences

```
GET /api/users/me/notification-preferences
PUT /api/users/me/notification-preferences
```
**Auth:** Auth

| Field | Type | Default |
|-------|------|---------|
| messages | boolean | true |
| bidActivity | boolean | true |
| jobUpdates | boolean | true |
| disputeUpdates | boolean | true |
| drawUpdates | boolean | true |

---

## Contractors (`/api/contractors`)

### List Contractors

```
GET /api/contractors
```
**Auth:** Public

| Query Param | Type | Notes |
|-------------|------|-------|
| search | string | AI-powered: parses trade, city, state from natural language |
| state | string | 2-letter code |
| city | string | |
| minRating | number | e.g. `4` |
| available | boolean | |
| specialty | string | e.g. `ELECTRICAL` |
| page | number | Default 1 |
| limit | number | Default 12, max 50 |

**Response:**
```json
{
  "contractors": [
    {
      "id": "...", "userId": "...",
      "bio": "...", "yearsExperience": 12,
      "specialties": ["ELECTRICAL", "GENERAL"],
      "city": "Dallas", "state": "TX",
      "averageRating": 4.8, "totalReviews": 23,
      "isAvailable": true, "isLicenseVerified": true,
      "user": { "firstName": "John", "lastName": "Smith" }
    }
  ],
  "total": 45, "page": 1, "limit": 12
}
```

### Get Contractor

```
GET /api/contractors/:id
```
**Auth:** Public

### Get / Update Own Profile

```
GET /api/contractors/me          // Contractor
PUT /api/contractors/me          // Contractor
```

---

## Jobs (`/api/jobs`)

### List Jobs

```
GET /api/jobs
```
**Auth:** Public

| Query Param | Type | Notes |
|-------------|------|-------|
| tradeType | string | Enum value |
| state | string | |
| city | string | |
| minBudget | number | |
| maxBudget | number | |
| search | string | |
| status | string | `OPEN`, `AWARDED`, etc. |
| page, limit | number | |

### Get Job

```
GET /api/jobs/:id
```
**Auth:** Optional (adds `hasBid` for authenticated contractors)

### Create Job

```
POST /api/jobs
```
**Auth:** Investor

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | Yes | 10-120 chars |
| description | string | Yes | 50-2000 chars |
| tradeType | string | Yes | `GENERAL`, `ELECTRICAL`, `PLUMBING`, `HVAC`, `ROOFING`, `FLOORING`, `PAINTING`, `LANDSCAPING`, `DEMOLITION`, `OTHER` |
| budgetMin | number | Yes | |
| budgetMax | number | Yes | Must be > budgetMin |
| city | string | Yes | |
| state | string | Yes | |
| zipCode | string | Yes | |

### Update / Cancel Job

```
PUT /api/jobs/:id               // Investor, OPEN jobs only
DELETE /api/jobs/:id            // Investor, sets status CANCELLED
```

### My Jobs / My Bids

```
GET /api/jobs/my-jobs           // Investor
GET /api/jobs/my-bids           // Contractor (mounted separately)
```

---

## Bids (`/api/jobs/:jobId/bids`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/my-bid` | Contractor | Own bid on this job |
| GET | `/` | Auth | All bids (job owner or admin only) |
| POST | `/` | Contractor | Submit bid: `{ amount, message }` |
| PUT | `/:bidId/accept` | Investor | Atomically accepts + rejects others |
| PUT | `/:bidId/withdraw` | Contractor | Withdraw PENDING bid |

---

## Messaging (`/api/messages`)

### Conversations

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/conversations` | Auth | `{ jobId, recipientId }` — get or create |
| GET | `/conversations` | Auth | List all with last message + unread count |
| GET | `/conversations/unread-count` | Auth | `{ total: number }` |
| GET | `/conversations/:id` | Auth | Detail + marks unread as read |
| GET | `/conversations/:id/messages` | Auth | Paginated: `?before=<msgId>&limit=30` |
| POST | `/conversations/:id/messages` | Auth | `{ content, replyToId? }` |

### Message Actions

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| PUT | `/messages/:messageId` | Auth | Edit own message (15-min window). Body: `{ content }` |
| DELETE | `/messages/:messageId` | Auth | Soft-delete own message |
| POST | `/messages/:messageId/report` | Auth | Report other's message: `{ reason, description? }` |

**Message object:**
```json
{
  "id": "...", "conversationId": "...", "senderId": "...",
  "content": "...", "isFiltered": false,
  "editedAt": null, "deletedAt": null,
  "replyToId": null,
  "replyTo": { "id": "...", "senderId": "...", "content": "preview..." },
  "createdAt": "2026-04-10T...",
  "sender": { "firstName": "Jane", "lastName": "Doe", "avatarUrl": null }
}
```

---

## Disputes (`/api/disputes`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/summary` | Auth | Per-status counts |
| GET | `/` | Auth | `?status=&page=&limit=` |
| POST | `/` | Auth | File a dispute (see body below) |
| GET | `/:id` | Auth | Detail (party only) |
| GET | `/:id/messages` | Auth | |
| POST | `/:id/messages` | Auth | `{ content }` |
| GET | `/:id/evidence` | Auth | |
| POST | `/:id/evidence` | Auth | `{ type, url, description }` |
| POST | `/:id/withdraw` | Auth | `{ reason }` (filer only) |

**File dispute body:**
```json
{
  "jobId": "...",
  "category": "QUALITY|PAYMENT|TIMELINE|COMMUNICATION|SCOPE|OTHER",
  "amountDisputed": 5000,
  "description": "...",
  "desiredOutcome": "..."
}
```

---

## Draw Schedule (`/api/jobs/:jobId/draws`)

All routes require auth + job party membership.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/` | Party | Full schedule + milestones |
| POST | `/generate` | Investor | AI-generate milestones |
| POST | `/approve` | Party | Approve schedule |
| POST | `/reset-approval` | Party | Retract approval |
| POST | `/milestones` | Party | Add milestone |
| PUT | `/milestones/:id` | Party | Edit milestone |
| DELETE | `/milestones/:id` | Party | Remove milestone |
| POST | `/milestones/:id/request` | Contractor | Submit draw request |
| GET | `/milestones/:id/request` | Party | Latest request |
| POST | `/requests/:id/approve` | Investor | Approve + release |
| POST | `/requests/:id/dispute` | Investor | Dispute draw |
| POST | `/requests/:id/evidence` | Contractor | Add evidence |

---

## Contracts (`/api/contracts`)

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| GET | `/by-job/:jobId` | Auth | |
| POST | `/generate` | Investor | `{ jobId, bidId }` — requires draw schedule locked |
| GET | `/:contractId` | Auth | |
| POST | `/:contractId/sign` | Auth | Sign as your role |
| GET | `/:contractId/pdf` | Auth | Returns PDF binary |

---

## Saved Contractors (`/api/saved`)

All routes require **Investor** auth.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/toggle` | `{ contractorProfileId, listId? }` | Toggle save/unsave |
| GET | `/ids` | — | Map of saved IDs |
| GET | `/lists` | — | All lists |
| POST | `/lists` | `{ name }` | Create list (max 10) |
| PUT | `/lists/:id` | `{ name }` | Rename |
| DELETE | `/lists/:id` | — | Delete (not default) |
| GET | `/lists/:id/contractors` | — | Full contractor data |
| DELETE | `/lists/:id/contractors/:savedId` | — | Remove from list |
| PUT | `/contractors/:savedId/move` | `{ targetListId }` | Move to list |
| PUT | `/contractors/:savedId/note` | `{ note }` | Update note |

---

## Property Estimator (`/api/estimator`)

All routes require **Investor** auth.

### Properties

```
POST /api/estimator/properties
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| addressLine1 | string | Yes | 5-200 chars |
| addressLine2 | string | No | |
| city | string | Yes | |
| state | string | Yes | 2-letter code |
| zipCode | string | Yes | 5-digit |
| propertyType | string | Yes | `SINGLE_FAMILY`, `DUPLEX`, `TRIPLEX`, `FOURPLEX`, `TOWNHOUSE`, `CONDO`, `MULTI_FAMILY`, `COMMERCIAL` |
| yearBuilt | number | No | 1800-2024 |
| sqftEstimate | number | No | 100-50000 |
| bedrooms | number | Yes | 0-20 |
| bathrooms | number | Yes | 0-20 |
| hasBasement | boolean | No | Default false |
| hasGarage | boolean | No | Default false |
| stories | number | No | Default 1 |

```
GET /api/estimator/properties
```
Returns all properties with `latestEstimate` object (status, totals).

### Estimates

```
POST /api/estimator/estimates
```
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| propertyId | uuid | Yes | Must belong to caller |
| renovationPurpose | string | Yes | `FLIP`, `RENTAL`, `PRIMARY_RESIDENCE`, `WHOLESALE` |
| primaryIssue | string | Yes | `COSMETIC`, `FULL_GUT`, `WATER_DAMAGE`, `FIRE_DAMAGE`, `NEGLECT`, `STRUCTURAL`, `PARTIAL` |
| questionnaireAnswers | Record<string, string> | Yes | Key-value pairs |
| photoIds | uuid[] | Yes | 4-40 IDs, must cover 4+ areas |

**Response:** `202 Accepted` with `{ estimateId, status: "PROCESSING" }`

AI runs asynchronously. Poll for completion:

```
GET /api/estimator/estimates/:id/poll
```
**Response:** `{ status, totalLow?, totalHigh?, updatedAt }`

Full result when complete:
```
GET /api/estimator/estimates/:id
```

**Estimate statuses:** `PROCESSING` → `COMPLETE` | `FAILED`

List estimates for a property:
```
GET /api/estimator/properties/:propertyId/estimates
```

### Photos

```
POST /api/estimator/photos
```
| Field | Type | Required |
|-------|------|----------|
| propertyId | uuid | Yes |
| areaKey | string | Yes |
| areaLabel | string | Yes |
| url | string | Yes |
| storagePath | string | Yes |
| caption | string | No |
| sortOrder | number | No |

```
DELETE /api/estimator/photos/:photoId
```
Deletes from both Supabase Storage and DB.

---

## Billing Methods (`/api/billing-methods`)

All routes require **Auth**.

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/` | — | List all methods |
| POST | `/` | See below | Add method |
| DELETE | `/:id` | — | Remove |
| PUT | `/:id/default` | — | Set as default |

**Add card:**
```json
{
  "type": "CARD",
  "cardNumber": "4111111111111111",
  "holderName": "Jane Doe",
  "expMonth": 12,
  "expYear": 27,
  "country": "United States",
  "addressLine1": "123 Main St",
  "city": "Baltimore",
  "state": "Maryland",
  "zipCode": "21218"
}
```

**Add PayPal/Venmo:**
```json
{ "type": "PAYPAL", "accountEmail": "jane@example.com" }
```

---

## Bug Reports (`/api/bug-reports`)

```
POST /api/bug-reports
```
**Auth:** Optional · **Rate limit:** 5 per 15 minutes

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| title | string | Yes | 5-140 chars |
| description | string | Yes | 10-4000 chars |
| severity | string | No | `LOW`, `MEDIUM` (default), `HIGH`, `CRITICAL` |
| pageUrl | string | No | Auto-captured |
| userAgent | string | No | Auto-captured |
| screenshotUrls | string[] | No | Max 3 |

---

## Upload (`/api/upload`)

### Presigned Upload (authenticated)

```
POST /api/upload/presign
```
**Auth:** Auth

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| bucket | string | Yes | `job-photos`, `avatars`, `dispute-evidence`, `draw-evidence`, `bug-reports`, `estimate-photos` |
| path | string | Yes | Must start with `{userId}/` |

**Response:** `{ signedUrl, token, path }`

### Public Presign (anonymous bug reports)

```
POST /api/upload/presign-public
```
**Auth:** Public · **Rate limit:** 5 per 15 minutes

| Field | Type | Required |
|-------|------|----------|
| filename | string | Yes |

Locked to `bug-reports` bucket. Path forced under `anon/` prefix.

---

## ID Verification (`/api/identity`)

Mobile handoff flow for government ID verification.

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/session` | Auth | Create handoff session, returns QR URL |
| GET | `/session/status` | Auth | Poll: `NONE`, `PENDING`, `UPLOADED`, `EXPIRED` |
| GET | `/m/:token` | Public | Mobile resolves session (phone UA required) |
| POST | `/m/:token/presign` | Public | Token-authed presign for mobile upload |
| POST | `/m/:token/complete` | Public | Submit document + selfie URLs |

---

## Notifications (`/api/notifications`)

```
GET /api/notifications
```
**Auth:** Auth

Returns computed notifications from bids, jobs, and draws for the last 30 days. Filtered by the user's notification preferences.

---

## AI Features (`/api/ai`)

All AI routes are gated by `AI_ENABLED` env var. If `AI_ENABLED=false`, all return 503.

| Method | Path | Auth | Rate Limit | Notes |
|--------|------|------|-----------|-------|
| POST | `/chat` | Optional | — | General AI chat |
| POST | `/classify-preview` | Public | — | Classify job text |
| POST | `/polish-reply` | Auth | — | Polish a message reply |
| POST | `/summarize/:jobId` | Auth | — | Summarize job messages |
| GET | `/matching/:jobId` | Auth | 20/hr | AI contractor matching |
| DELETE | `/matching/:jobId/cache` | Auth | — | Clear match cache |
| POST | `/search` | Optional | 10/15min | AI contractor search |
| POST | `/job-assistant/questions` | Investor | 30/hr | Generate follow-up Qs |
| POST | `/job-assistant/generate` | Investor | 20/hr | AI-generate job posting |
| GET | `/bids/:jobId/analysis` | Investor | 10/hr | Analyze bids on a job |
| GET | `/reliability/me` | Contractor | — | Own reliability score |
| POST | `/scope-estimate` | Investor | 10/day | Photo-based scope estimate |
| POST | `/parse-job` | Investor | 30/hr | Parse natural language to job fields |

---

## Admin (`/api/admin/*`)

All admin routes require `authenticate + requireAdmin`. Every destructive action writes to the audit log.

### Stats

| Method | Path | Notes |
|--------|------|-------|
| GET | `/stats` | Platform-wide counts |
| GET | `/stats/activity` | Recent activity feed |

### Users

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/users` | — | Paginated, filterable |
| GET | `/users/id-verifications` | `?status=PENDING` | ID verification queue |
| GET | `/users/flagged` | — | Flagged users |
| GET | `/users/:userId` | — | Full profile |
| POST | `/users/:id/suspend` | `{ reason, durationDays }` | |
| POST | `/users/:id/unsuspend` | — | |
| POST | `/users/:id/ban` | `{ reason }` | |
| POST | `/users/:id/verify-contractor` | — | |
| POST | `/users/:id/change-role` | `{ role, note }` | |
| POST | `/users/:id/impersonate` | — | Returns impersonation token |
| POST | `/users/:id/send-message` | `{ subject, content }` | |
| PUT | `/users/:userId/id-verification` | `{ decision, note }` | APPROVED or REJECTED |

### Contractors

| Method | Path | Notes |
|--------|------|-------|
| GET | `/contractors` | Paginated list |
| PUT | `/contractors/:profileId/verify-license` | |
| PUT | `/contractors/:profileId/unverify-license` | |
| PUT | `/contractors/:profileId/availability` | `{ isAvailable }` |

### Jobs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/jobs` | Filterable list |
| GET | `/jobs/content-queue` | Flagged jobs |
| GET | `/jobs/:jobId` | Detail with bids |
| POST | `/jobs/:jobId/remove` | `{ reason }` |
| POST | `/jobs/:jobId/feature` | Toggle featured |
| POST | `/jobs/:jobId/change-status` | `{ newStatus, reason }` |
| POST | `/jobs/:jobId/flag` | `{ reason }` |

### Disputes

| Method | Path | Notes |
|--------|------|-------|
| GET | `/disputes` | `?status=&page=&limit=` |
| GET | `/disputes/:id` | Detail |
| POST | `/disputes/:id/note` | `{ content }` |
| POST | `/disputes/:id/ruling` | `{ ruling, splitPct?, rulingNote }` |
| PUT | `/disputes/:id/status` | `{ newStatus }` |

### Bug Reports

| Method | Path | Notes |
|--------|------|-------|
| GET | `/bug-reports` | `?status=NEW&page=&limit=` |
| GET | `/bug-reports/count` | `{ newCount }` |
| GET | `/bug-reports/:id` | Detail |
| PUT | `/bug-reports/:id` | `{ status, adminNote }` |

### Audit Log

| Method | Path | Notes |
|--------|------|-------|
| GET | `/audit` | `?action=&adminId=&page=&limit=` |
| GET | `/audit/export` | `?format=csv\|json` — downloads file |

### Other Admin

| Path prefix | Notes |
|-------------|-------|
| `/settings` | Platform settings |
| `/flags` | Feature flags |
| `/banned-emails` | Banned email management |
| `/finance` | Financial overview |
| `/moderation` | Content moderation |
| `/reviews` | Review management |
| `/analytics` | Platform analytics |
| `/health` | System health |
| `/overview` | Dashboard overview |
| `/testimonials` | Testimonial management |

---

## Stripe / Payments (`/api/stripe`, `/api/escrow`)

### Stripe Connect

| Method | Path | Auth |
|--------|------|------|
| POST | `/stripe/connect/onboard` | Contractor |
| GET | `/stripe/connect/status` | Contractor |
| POST | `/stripe/webhooks` | Public (Stripe signature verified) |

### Escrow

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/escrow/fund-job/:jobId` | Investor | `{ paymentMethodId, currency, idempotencyKey }` |
| GET | `/escrow/:jobId` | Auth | |
| POST | `/escrow/:jobId/milestones/:id/submit` | Contractor | |
| POST | `/escrow/:jobId/milestones/:id/approve` | Investor | |
| POST | `/escrow/:jobId/milestones/:id/dispute` | Investor | |

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 400 | Bad request / validation error |
| 401 | Missing or invalid JWT |
| 403 | Forbidden (wrong role, not owner, etc.) |
| 404 | Resource not found |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

Error response shape:
```json
{
  "success": false,
  "message": "Human-readable error message",
  "errors": ["optional array of validation errors"]
}
```

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `POST /api/auth/forgot-password` | 5 per 15 min per IP |
| `POST /api/bug-reports` | 5 per 15 min per IP |
| `POST /api/upload/presign-public` | 5 per 15 min per IP |
| Global (all routes) | 100 per 15 min per IP |
| AI matching | 20 per hour per user |
| AI search | 10 per 15 min per IP |
| AI scope estimate | 10 per day per user |
| AI job assistant | 30/hr questions, 20/hr generate |
| AI bid analysis | 10 per hour per user |
| Saved toggle | 60 per min per user |

---

## Supabase Storage Buckets

| Bucket | Access | Used for |
|--------|--------|----------|
| `avatars` | Auth upload, public read | User profile photos |
| `job-photos` | Auth upload, public read | Job posting photos |
| `dispute-evidence` | Auth upload, party read | Dispute evidence files |
| `draw-evidence` | Auth upload, party read | Draw request evidence |
| `bug-reports` | Auth or public upload, public read | Bug report screenshots |
| `estimate-photos` | Auth upload, public read | Property estimate photos |

Upload flow:
1. `POST /api/upload/presign` → get signed URL + token
2. Upload file directly to Supabase Storage using the signed URL
3. Use the public URL in subsequent API calls

---

## Realtime (Supabase)

The frontend subscribes to these Supabase Realtime channels:

| Channel | Table | Event | Purpose |
|---------|-------|-------|---------|
| `conversation:{id}` | `messages` | INSERT, UPDATE | Live chat + edit/delete |
| `conversations-unread` | `conversations` | UPDATE | Sidebar unread badge |
| `global-messages-notifications` | `messages` | INSERT | Toast alerts |
| `dispute-messages:{id}` | `dispute_messages` | INSERT | Live dispute thread |
| `draw-schedule:{jobId}` | `draw_schedules` | UPDATE | Live schedule status |
