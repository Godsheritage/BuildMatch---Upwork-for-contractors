# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Vite dev server at http://localhost:5173
npm run build    # tsc -b && vite build (type-check first)
npm run lint     # ESLint
npm run preview  # Preview production build locally
```

Node.js v18.12.1 is in use. ESLint engine warnings are expected and non-blocking.

Environment variable in `.env.local`:
- `VITE_API_URL` — backend base URL, e.g. `http://localhost:3001/api`

## Architecture

Entry: `src/main.tsx` → `src/App.tsx`

`App.tsx` mounts providers in this order:
```
QueryClientProvider → AuthProvider → ToastProvider → BrowserRouter → Routes
```

TypeScript is split across three configs: `tsconfig.json` (composite root), `tsconfig.app.json` (browser code), `tsconfig.node.json` (build tools). Build command is `tsc -b && vite build`.

Tailwind v3 is installed but the project uses a **custom CSS module + design-token system**. Tailwind utility classes work but most styling is done via `*.module.css` files and `var(--token-name)` CSS variables.

## Folder Structure

```
src/
  components/
    ui/          # Primitive design-system components (barrel: index.ts)
    layout/      # Navbar, Footer, DashboardLayout, PageWrapper
    auth/        # ProtectedRoute
    contractor/  # ContractorCard, ContractorList
    job/         # JobCard, JobList
    messaging/   # MessageThread, JobContextPanel, JobInfoDrawer, ConversationList
  pages/         # One file per route
  hooks/         # useAuth, useContractors, useJobs, useMessaging, useUnreadCount, useMessageNotifications
  services/      # api.ts (Axios), auth.service.ts, contractor.service.ts, job.service.ts, message.service.ts
  context/       # AuthContext.tsx, ToastContext.tsx
  types/         # user.types.ts, contractor.types.ts, job.types.ts, message.types.ts
  styles/        # design-tokens.css, globals.css
```

## All Pages & Routes

| Page file | Route | Protection | Description |
|-----------|-------|------------|-------------|
| `HomePage.tsx` | `/` | public | Marketing landing page |
| `LoginPage.tsx` | `/login` | public | Email/password login |
| `RegisterPage.tsx` | `/register` | public | Role-based registration (INVESTOR / CONTRACTOR) |
| `ForgotPasswordPage.tsx` | `/forgot-password` | public | Password reset entry |
| `ContractorsPage.tsx` | `/contractors` | public | Browse contractors with filter sidebar |
| `ContractorProfilePage.tsx` | `/contractors/:id` | public | Full contractor profile |
| `JobsPage.tsx` | `/jobs` | public | Browse jobs with filter sidebar + URL-synced params |
| `JobDetailPage.tsx` | `/jobs/:id` | public | Job detail + polymorphic sidebar; "Having an issue?" link (IN_PROGRESS only) → `/settings/disputes/new?jobId=` |
| `DashboardPage.tsx` | `/dashboard` | auth | Greeting + stats overview |
| `InvestorJobsPage.tsx` | `/dashboard/jobs` | INVESTOR | Job management table with tabs + kebab actions |
| `PostJobPage.tsx` | `/dashboard/post-job` | INVESTOR | Create job form with live preview |
| `ProfileSetupPage.tsx` | `/dashboard/profile/setup` | CONTRACTOR | 4-step profile wizard |
| `MessagesPage.tsx` | `/dashboard/messages` | auth | Full inbox: conversation list + message thread + job context panel |
| `MessagesPage.tsx` | `/dashboard/messages/:conversationId` | auth | Same page — URL param activates the conversation thread |
| `SettingsPage.tsx` | `/dashboard/settings` | auth | Settings overview grid; includes Dispute Centre card |
| `SettingsPersonalPage.tsx` | `/dashboard/settings/personal` | auth | Profile/personal info editing |
| `SettingsSecurityPage.tsx` | `/dashboard/settings/security` | auth | Password change |
| `SettingsNotificationsPage.tsx` | `/dashboard/settings/notifications` | auth | Notification preferences |
| `SettingsVerificationPage.tsx` | `/dashboard/settings/verification` | auth | ID / licence verification |
| `DisputesListPage.tsx` | `/dashboard/settings/disputes` **and** `/settings/disputes` | auth | Dispute list with summary stats and status tabs |
| `FileDisputePage.tsx` | `/dashboard/settings/disputes/new` **and** `/settings/disputes/new` | auth | 3-step dispute wizard; `?jobId=` pre-selects job + skips to Step 2 |
| `DisputeDetailPage.tsx` | `/dashboard/settings/disputes/:disputeId` **and** `/settings/disputes/:disputeId` | auth | Full dispute thread; live Realtime messages + evidence upload |
| `SavedContractorsPage.tsx` | `/dashboard/saved` | INVESTOR | Two-column saved contractors manager: list sidebar (create/rename/delete) + contractor grid with sort, notes, and quick actions (message, view profile, move, remove) |
| `AdminDashboardPage.tsx` | `/admin` | ADMIN | Stats grid (6 cards), job status breakdown, recent activity feed |
| `AdminUsersPage.tsx` | `/admin/users` | ADMIN | Paginated user table; ban/unban, change role (with modal + note) |
| `AdminContractorsPage.tsx` | `/admin/contractors` | ADMIN | Paginated contractor table; verify/unverify license, toggle availability |
| `AdminJobsPage.tsx` | `/admin/jobs` | ADMIN | Paginated job table with force-close (modal + note, irreversible) |
| `AdminDisputesPage.tsx` | `/admin/disputes` | ADMIN | Paginated dispute table; detail drawer with change-status + record-ruling panels |
| `AdminAuditLogPage.tsx` | `/admin/audit` | ADMIN | Paginated audit event table; filter by action type or admin ID |

**Route layout rules:**
- All `/dashboard/*` routes render inside `DashboardLayout` (240px role-aware sidebar + `<Outlet />`).
- `/dashboard/settings/*` routes additionally render inside `SettingsLayout` (220px settings sidebar + `<Outlet />`), creating a dual-sidebar layout.
- `/settings/disputes/*` routes render inside `SettingsLayout` **without** `DashboardLayout` — used as the entry point from public pages (e.g. `JobDetailPage`). SettingsLayout sidebar links go back to `/dashboard/settings/*` paths.
- Static segment `disputes/new` is declared before `disputes/:disputeId` to prevent param capture.
- All `/admin/*` routes render inside `AdminLayout` (dark navy sidebar) wrapped by `AdminRoute` (403 redirect for non-ADMIN).

## Component Hierarchy

```
App
├── QueryClientProvider
├── AuthProvider
├── ToastProvider (fixed toast stack, top-right)
└── BrowserRouter
    └── Routes
        ├── Public routes → each page renders its own <nav>
        └── ProtectedRoute
            └── DashboardLayout (sidebar + <Outlet>)
                ├── DashboardPage
                ├── InvestorJobsPage  (INVESTOR only)
                ├── PostJobPage       (INVESTOR only)
                └── ProfileSetupPage  (CONTRACTOR only)
```

### UI Component Library (`src/components/ui/`)

Import via the barrel: `import { Button, Card, Badge, Avatar, Input, StarRating } from '../components/ui'`

| Component | Key Props |
|-----------|-----------|
| `Button` | `variant?: 'primary' \| 'secondary' \| 'danger'`, `size?: 'sm' \| 'md'` |
| `Input` | `label?: string`, `error?: string` + all native input attrs |
| `Card` | `hoverable?: boolean`, `onClick?`, `className?` |
| `Badge` | `variant?: 'default' \| 'warning' \| 'muted'` |
| `Avatar` | `name: string`, `src?: string`, `size?: 'sm' \| 'md' \| 'lg'` |
| `StarRating` | `rating: number`, `maxStars?: number`, `size?: number` |

Each component has a co-located `*.module.css`. New UI components must follow the same pattern.

### ProtectedRoute

```tsx
<ProtectedRoute roles={['INVESTOR']}>
  <SomePage />
</ProtectedRoute>
```

- No `roles` prop → any authenticated user passes.
- With `roles` → only users whose `user.role` is in the array pass; others see a 403 page.
- Unauthenticated users are always redirected to `/login`.

### DashboardLayout

Renders a 240px sticky sidebar + main `<Outlet>`. Sidebar nav links are role-aware: investors see "My Jobs" + "Post a Job"; contractors see "Browse Jobs" + "My Bids". Includes mobile hamburger + slide-in drawer.

Calls `useMessageNotifications()` so the global Supabase Realtime subscription for new message toasts is alive for the entire authenticated session.

### Messaging Components (`src/components/messaging/`)

| Component | File | Description |
|-----------|------|-------------|
| `MessageThread` | `MessageThread.tsx` | Chat view: header, scrollable bubbles, input bar. Accepts a `Conversation` prop. |
| `JobContextPanel` | `JobContextPanel.tsx` | Right-side panel showing job details + other user card. Hidden on tablet/mobile via its own CSS; use `className` prop to override. Supports `showHeader` prop. |
| `JobInfoDrawer` | `JobInfoDrawer.tsx` | Mobile bottom-sheet (82 vh, drag-to-close) that renders `JobContextPanel` inside it. Triggered by the "Job Info" icon button in the thread header (visible at ≤639px). |

**Three-panel layout** (`MessagesPage`): left list (280px) | center thread (flex 1) | right context panel (280px, hidden at ≤1023px). On mobile (≤639px), list and thread swap visibility based on whether `conversationId` URL param is present; back button in the thread header returns to `/dashboard/messages`.

## Auth Flow

1. On app mount, `AuthProvider` checks `localStorage['buildmatch_token']`.
2. If token exists, calls `getMe()` to restore the `user` object; clears token on failure.
3. `login()` / `register()` set `localStorage` + `user` state simultaneously.
4. `logout()` clears `localStorage` + sets `user` to `null`.
5. The Axios instance in `api.ts` reads the token on **every request** via a request interceptor.
6. A response interceptor catches `401` (on non-auth routes), clears the token, and redirects to `/login`.

`useAuth()` is the only public interface — never import `AuthContext` directly outside of `hooks/useAuth.ts`.

## React Query Keys

| Query Key | Endpoint | Used In |
|-----------|----------|---------|
| `['contractors']` | `GET /contractors` | ContractorsPage |
| `['contractors', id]` | `GET /contractors/:id` | ContractorProfilePage |
| `['jobs']` | `GET /jobs` | JobsPage |
| `['jobs', id]` | `GET /jobs/:id` | JobDetailPage |
| `['jobs', id, 'bids']` | `GET /jobs/:id/bids` | JobDetailPage (investor, bids list) |
| `['jobs', id, 'my-bid']` | `GET /jobs/:id/bids/my-bid` | JobDetailPage (contractor, existing bid) |
| `['jobs', 'my-jobs']` | `GET /jobs/my-jobs` | InvestorJobsPage |
| `['conversations']` | `GET /messages/conversations` | MessagesPage, ConversationList |
| `['conversations', id]` | `GET /messages/conversations/:id` | MessagesPage (marks read, invalidates unread) |
| `['unreadCount']` | `GET /messages/conversations/unread-count` | useUnreadCount (badge in sidebar) |
| `['saved-lists']` | `GET /saved/lists` | SavedContractorsPage sidebar, SavedContractorsWidget |
| `['saved-list-contractors', listId]` | `GET /saved/lists/:id/contractors` | SavedContractorsPage grid, SavedIndicator (ContractorProfilePage) |
| `['investor-jobs-for-message']` | `GET /jobs/my-jobs` (filtered) | JobPickerModal inside SavedContractorsPage |

**Invalidation rules:**
- Submitting a bid → invalidate `['jobs', jobId]`
- Accepting a bid → invalidate `['jobs', jobId]` + `['jobs', jobId, 'bids']`
- Withdrawing a bid → invalidate `['jobs', jobId]` + `['jobs', jobId, 'my-bid']`
- Cancelling a job → invalidate `['jobs', 'my-jobs']`
- Opening a conversation → invalidate `['conversations']` + `['unreadCount']`
- New Realtime message → invalidate `['conversations']` + `['unreadCount']`
- Remove/move saved contractor → invalidate `['saved-list-contractors', listId]` + `['saved-lists']`
- Create/rename/delete list → invalidate `['saved-lists']`

**staleTime:** 30–60 seconds on all queries. Never use `refetchOnWindowFocus` defaults — data is not real-time.

## Services

### `src/services/api.ts`
Axios instance with:
- `baseURL`: `VITE_API_URL`
- Request interceptor: attaches `Authorization: Bearer <token>` from `localStorage`
- Response interceptor: on `401` (except `/auth/*`), clears token + redirects to `/login`
- Exported constant: `TOKEN_KEY = 'buildmatch_token'`

### `src/services/job.service.ts`
```ts
createJob(payload)                     // POST /jobs
getJobs(params)                        // GET  /jobs
getJobById(id)                         // GET  /jobs/:id
getMyJobs()                            // GET  /jobs/my-jobs
cancelJob(id)                          // DELETE /jobs/:id
createBid(jobId, payload)              // POST /jobs/:jobId/bids
getJobBids(jobId)                      // GET  /jobs/:jobId/bids
getMyBid(jobId)                        // GET  /jobs/:jobId/bids/my-bid
acceptBid(jobId, bidId)                // PUT  /jobs/:jobId/bids/:bidId/accept
withdrawBid(jobId, bidId)              // PUT  /jobs/:jobId/bids/:bidId/withdraw
```

### `src/services/message.service.ts`
```ts
getConversations()                                // GET  /messages/conversations
getOrCreateConversation(jobId, recipientId)       // POST /messages/conversations
getConversation(conversationId)                   // GET  /messages/conversations/:id  (also marks read)
getMessages(conversationId, before?)              // GET  /messages/conversations/:id/messages
sendMessage(conversationId, content)              // POST /messages/conversations/:id/messages
getTotalUnreadCount()                             // GET  /messages/conversations/unread-count
```

`getOrCreateConversation` is used across multiple pages (JobDetailPage, ContractorProfilePage, InvestorJobsPage, MyBidsPage) to start/navigate to a conversation.

### Messaging Hooks

| Hook | File | Description |
|------|------|-------------|
| `useMessaging(conversationId)` | `hooks/useMessaging.ts` | Fetches messages with pagination (`loadMore`), exposes `sendMessage`, subscribes to per-conversation Realtime INSERT events. |
| `useUnreadCount()` | `hooks/useUnreadCount.ts` | Polls every 30s + Realtime `conversations` UPDATE. Returns `{ totalUnread: number }`. |
| `useMessageNotifications()` | `hooks/useMessageNotifications.ts` | Global Realtime `messages` INSERT subscription. Shows an 'info' toast with "View" action button when a message arrives for a conversation the user is NOT currently viewing. Mount once in `DashboardLayout`. |

### Dispute Hooks

| Hook | File | Description |
|------|------|-------------|
| `useDisputeMessages(disputeId, dispute?)` | `hooks/useDisputeMessages.ts` | Initial fetch (`queryKey: ['dispute-messages', id]`, 15s poll fallback), Supabase Realtime INSERT subscription on `dispute_messages`, auto-scroll via `messagesEndRef`, `sendMessage(content)` with optimistic update. Returns `{ messages, isLoading, sendMessage, messagesEndRef }`. |

### `src/services/dispute.service.ts`
```ts
getDisputeSummary()                          // GET  /disputes/summary
getMyDisputes(params?)                       // GET  /disputes
getDisputeById(id)                           // GET  /disputes/:id
getDisputeMessages(id)                       // GET  /disputes/:id/messages
getDisputeEvidence(id)                       // GET  /disputes/:id/evidence
fileDispute(payload)                         // POST /disputes
addDisputeMessage(id, content)               // POST /disputes/:id/messages
submitEvidence(id, payload)                  // POST /disputes/:id/evidence
withdrawDispute(id, reason)                  // POST /disputes/:id/withdraw
```

### Admin Service — `src/services/admin.service.ts`

All admin API calls. Typed with: `PlatformStats`, `AdminUser`, `AdminContractor`, `AdminJob`, `AdminDispute`, `AdminDisputeDetail`, `AuditLogEntry`, `PageResponse<T>`.

```ts
getStats()                                      // GET  /admin/stats
getActivity(limit?)                             // GET  /admin/stats/activity
getUsers(params)                                // GET  /admin/users
getUserById(userId)                             // GET  /admin/users/:userId
banUser(userId)                                 // PUT  /admin/users/:userId/ban
unbanUser(userId)                               // PUT  /admin/users/:userId/unban
changeUserRole(params)                          // PUT  /admin/users/:userId/role
getContractors(params)                          // GET  /admin/contractors
verifyLicense(profileId)                        // PUT  /admin/contractors/:profileId/verify-license
unverifyLicense(profileId)                      // PUT  /admin/contractors/:profileId/unverify-license
setAvailability(params)                         // PUT  /admin/contractors/:profileId/availability
getJobs(params)                                 // GET  /admin/jobs
getJobById(jobId)                               // GET  /admin/jobs/:jobId
forceCloseJob(params)                           // PUT  /admin/jobs/:jobId/force-close
getAdminDisputes(params)                        // GET  /admin/disputes
getAdminDisputeById(id)                         // GET  /admin/disputes/:id
recordRuling(params)                            // POST /admin/disputes/:id/ruling
updateDisputeStatus(params)                     // PUT  /admin/disputes/:id/status
getAuditLog(params)                             // GET  /admin/audit
```

### Admin Hooks — `src/hooks/useAdmin.ts`

React Query hooks for all admin data. All query keys are prefixed `['admin', ...]`, staleTime 30–60s.

| Hook | Query Key | Description |
|------|-----------|-------------|
| `useAdminStats()` | `['admin', 'stats']` | Platform stats (6 counters) |
| `useAdminActivity(limit?)` | `['admin', 'activity']` | Recent events feed |
| `useAdminUsers(params)` | `['admin', 'users', params]` | Paginated user list |
| `useAdminUser(id)` | `['admin', 'users', id]` | Single user detail |
| `useBanUser()` | — | PUT ban; invalidates users list |
| `useUnbanUser()` | — | PUT unban; invalidates users list |
| `useChangeUserRole()` | — | PUT role; invalidates users list |
| `useAdminContractors(params)` | `['admin', 'contractors', params]` | Paginated contractor list |
| `useVerifyLicense()` | — | PUT verify; invalidates contractors |
| `useUnverifyLicense()` | — | PUT unverify; invalidates contractors |
| `useSetAvailability()` | — | PUT availability; invalidates contractors |
| `useAdminJobs(params)` | `['admin', 'jobs', params]` | Paginated job list |
| `useAdminJob(id)` | `['admin', 'jobs', id]` | Single job detail |
| `useForceCloseJob()` | — | PUT force-close; invalidates jobs list |
| `useAdminDisputes(params)` | `['admin', 'disputes', params]` | Paginated dispute list |
| `useAdminDispute(id)` | `['admin', 'disputes', id]` | Single dispute detail |
| `useRecordRuling()` | — | POST ruling; invalidates disputes |
| `useUpdateDisputeStatus()` | — | PUT status; invalidates disputes |
| `useAdminAuditLog(params)` | `['admin', 'audit', params]` | Paginated audit log |

### Admin Components

- **`AdminLayout`** (`src/components/admin/AdminLayout.tsx`) — dark navy sidebar (`#0F1F33`), 6 nav items, admin indicator dot, "Back to app" button. Renders `<Outlet />` in main content area.
- **`AdminRoute`** (`src/components/admin/AdminRoute.tsx`) — unauthenticated → `/login`; authenticated non-ADMIN → `/dashboard`; ADMIN → renders children.
- **`admin-shared.module.css`** (`src/pages/admin/`) — shared table, badge, pagination, modal, filter, skeleton, and action-button styles. Import as `sh` in all admin pages.

### Supabase Realtime Channels

| Channel name | Table | Event | Used by |
|---|---|---|---|
| `conversation-{id}` | `messages` | INSERT | `useMessaging` — live chat updates |
| `conversations-unread` | `conversations` | UPDATE | `useUnreadCount` — sidebar badge |
| `global-messages-notifications` | `messages` | INSERT | `useMessageNotifications` — toast alerts |
| `dispute-messages:{id}` | `dispute_messages` | INSERT | `useDisputeMessages` — live dispute thread |

**Important:** `useMessageNotifications` must **not** be mounted multiple times — it is called exactly once in `DashboardLayout`.

## Saved Contractors Feature

### Context — `src/context/SavedContractorsContext.tsx`
`SavedContractorsProvider` must wrap the router (inside `AuthProvider`, outside `BrowserRouter`). Fetches `GET /saved/ids` once on INVESTOR login and maintains a `savedIds: Record<contractorProfileId, listId>` map in state.

```tsx
const { savedIds, isSaved, getListId, toggle, totalSaved, isLoading } = useSavedContractors();
```

- `isSaved(contractorProfileId)` — `boolean`, used by `BookmarkButton` for icon state
- `toggle(contractorProfileId, listId?)` — optimistic update + API call; reverts on error; `pendingRef` (Set) prevents concurrent toggles on the same contractor
- `totalSaved` — count of saved contractors; shown as sidebar badge in `DashboardLayout`
- Non-INVESTOR users: context returns empty state + no-ops (safe to call on any page)

### Hooks — `src/hooks/useSavedContractors.ts`
Re-exports `useSavedContractors` from context, plus TanStack Query wrappers:

| Hook | Query Key | Description |
|------|-----------|-------------|
| `useSavedLists()` | `['saved-lists']` | All lists for the investor (staleTime 5 min) |
| `useListContractors(listId)` | `['saved-list-contractors', listId]` | Full contractor join for one list (staleTime 2 min, enabled: !!listId) |
| `useCreateList()` | — | POST `/saved/lists`; invalidates `['saved-lists']` on success |
| `useDeleteList()` | — | DELETE `/saved/lists/:id`; invalidates `['saved-lists']` |
| `useRenameList()` | — | PUT `/saved/lists/:id`; invalidates `['saved-lists']` |
| `useRemoveFromList()` | — | DELETE `/saved/lists/:id/contractors/:savedId`; invalidates `['saved-list-contractors', listId]` |

Move and note-update are direct `api.put()` calls in the page/component (no dedicated hook).

### BookmarkButton — `src/components/ui/BookmarkButton.tsx`
Self-contained toggle button. Import directly (not via barrel).

```tsx
<BookmarkButton
  contractorProfileId={id}
  size="sm" | "md" | "lg"
  variant="icon" | "icon-label"
  className?={string}
/>
```

- CONTRACTOR role → returns `null` (never visible to contractors)
- Non-investor → non-interactive gray icon; click redirects to `/login`
- Reads/writes via `useSavedContractors()` context — no local API calls
- `justSaved` state triggers `bookmarkPulse` CSS animation (220 ms scale pop)
- Used on: `ContractorCard`, `ContractorProfilePage` sidebar, `RecommendedContractors`, `BidAnalysisPanel` comparison table

### SavedIndicator — inline in `ContractorProfilePage.tsx`
When `isSaved(contractor.id)` is true, renders a teal "Saved to [list name]" button in the sidebar CTA block. Clicking opens a dropdown: current list name, "Move to a different list" submenu (lazily fetches `useListContractors` to get `savedId`), "Remove from saved list" (calls `toggle`). `SavedIndicator` returns `null` when not saved — `BookmarkButton` shows below it for the save action.

## Design System

All CSS custom properties live in `src/styles/design-tokens.css`, imported globally. **Never hardcode color or spacing values** — always use a token.

### Colors

| Token | Value | Use |
|-------|-------|-----|
| `--color-primary` | `#1B3A5C` | CTAs, active nav, focus borders |
| `--color-accent` | `#0F6E56` | Budget figures, success, accept bid button |
| `--color-highlight` | `#E8F4F0` | Badge backgrounds, hover tints |
| `--color-warning` | `#BA7517` | Pending/caution text |
| `--color-bg` | `#FFFFFF` | Page background |
| `--color-surface` | `#F8F7F5` | Cards, sidebars, inputs |
| `--color-border` | `#E5E4E0` | Dividers, card edges |
| `--color-text-primary` | `#1A1A18` | Body text, headings |
| `--color-text-muted` | `#6B6B67` | Labels, metadata, placeholders |
| `--color-star` | `#F59E0B` | Star ratings |
| `--color-danger` | `#DC2626` | Errors, cancel/delete actions |

### Typography Rules
- Font: `var(--font-family)` — system-ui / SF Pro stack
- **Never use `font-weight` above 600.** Tokens: `--font-weight-normal` (400), `--font-weight-medium` (500), `--font-weight-semibold` (600).
- Heading letter-spacing: `var(--tracking-tight)` (-0.02em)
- Body line-height: `var(--leading-body)` (1.6)
- All-caps labels: 11px + `--tracking-wide` (0.06em) + `--font-weight-medium`

### Spacing
4px base scale. `--space-1` (4px) through `--space-24` (96px). Common: `--space-2` (8px), `--space-4` (16px), `--space-6` (24px).

### Visual Rules
- No background gradients.
- Card shadows: `--shadow-card` only (very subtle). No heavy drop shadows.
- Border radii: cards `--radius-md` (12px), buttons/inputs `--radius-sm` (8px), badges `--radius-pill` (20px).
- Navbar: white bg, `border-bottom: 1px solid var(--color-border)`, 60px height, sticky.
- Page-level layouts use `max-width` containers (1080–1100px) centered with `margin: 0 auto`.

### Status Badge Colors (used across Job pages)
| Status | Background | Text |
|--------|-----------|------|
| OPEN | `#DCFCE7` | `#166534` |
| AWARDED | `#DBEAFE` | `#1E40AF` |
| IN_PROGRESS | `#FEF9C3` | `#854D0E` |
| COMPLETED | `#F3F4F6` | `#374151` |
| CANCELLED | `#FEE2E2` | `#991B1B` |

## Key Patterns

### Two-column page layout
Public detail pages (`ContractorProfilePage`, `JobDetailPage`) use a `max-width: 1080px` centered flex container with a sticky sidebar (`align-self: flex-start`, `position: sticky`, `top: 80px`). At ≤768px the layout stacks vertically and the sidebar resets to `position: static`.

### URL-synced filters (JobsPage)
`useSearchParams` reads initial filter state from the URL on mount. A `useEffect` writes back to URL on every filter/sort/page change using `{ replace: true }`. This makes browser back/forward and direct links work correctly.

### Debounced inputs
Search, city, and budget fields use a local `setTimeout` / `clearTimeout` pattern (400ms) before updating the query params that trigger an API call.

### Polymorphic sidebar (JobDetailPage)
The right sidebar renders one of four variants based on the auth state:
- `bid-form` — CONTRACTOR + no existing bid
- `my-bid` — CONTRACTOR + already bid (fetches `getMyBid`)
- `investor` — INVESTOR + owns this job
- `guest` — everyone else

The variant is determined synchronously from `user.role` and `job.investorId`.

### Toast notifications
`useToast()` from `ToastContext`. Call `toast(message)` for success, `toast(message, 'error')` for errors. Displayed in a fixed overlay; auto-dismissed after 4.5s.

### Inline confirmation pattern
Destructive actions (cancel job, withdraw bid) use an **inline confirmation UI** rather than `window.confirm()`. For table rows: a modal overlay dialog. For sidebars: an in-card confirmation block replacing the button.

### Skeleton loaders
Loading states use animated `background: #EFEFED` divs with `animation: pulse` (opacity 1 → 0.4 → 1 at 1.6s). Matched to the shape of the content they replace.
