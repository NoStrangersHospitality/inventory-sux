# Inventory Sux — Dev Notes

Living reference for patterns, conventions, and gotchas established during development. Paste this at the start of a new chat session along with whatever file(s) you're working on — it gives Claude the "why" behind the code so we stop re-litigating settled decisions and reintroducing fixed bugs.

**Update this file** whenever a new pattern, gotcha, or schema change gets established. Treat it as part of the deliverable for any session that introduces something future sessions need to know.

---

## Core Architecture

- **Stack**: Next.js (App Router) + Supabase (Postgres + Auth + Storage) + Vercel + Stripe + SendGrid + Twilio
- **Repo**: `NoStrangersHospitality/inventory-sux`
- **Production URL**: `app.inventorysux.com`
- **Areas**: The app is split into **FOH** (front of house — bar/spirits/wine) and **BOH** (back of house — kitchen). Most tables have an `area` column (`'foh'` | `'boh'`) and pages live under `app/foh/...` and `app/boh/...` with largely parallel structure.

### ⚠️ FOH/BOH pages drift — check both before assuming consistency
FOH and BOH ordering pages (`app/foh/ordering/order/page.js` and `app/boh/ordering/order/page.js`) are structurally parallel but maintained as separate files, not shared components. They have already drifted at least once: BOH's `markAsReady`/`submitOrder` correctly wrote `unit: row.orderUnit || row.unit || null` to `order_lines`, while FOH's equivalent functions never wrote a `unit` field at all — silently breaking the PDF/email order summary's UNIT column for FOH orders for an unknown period before being caught (see Outstanding Items below for the fix). **Any bug fix or feature added to one of these pages should be checked against its sibling before assuming the other one already has it** — don't assume parity just because they look structurally identical.

---

## Data Ownership Model — `ownerId` pattern

**This is the single most important pattern in the app and the most common source of regressions.**

- Auth session = the logged-in user (could be an owner OR a staff member).
- All data queries must use the **owner's** user ID, not the session user's ID directly.
- `useRole()` hook (`hooks/useRole.js`) returns `ownerId = profile.owner_user_id || session.user.id`.
  - For an **owner**, `owner_user_id` is null, so `ownerId` falls back to their own session ID.
  - For **staff**, `owner_user_id` points to the owner's ID, so `ownerId` resolves to the owner.

### ✅ Correct pattern (use this everywhere):
```js
const { ownerId } = useRole()
const { data: { session } } = await supabase.auth.getSession()
const ownerIdToUse = ownerId || session.user.id
```

### ❌ Anti-pattern — DO NOT introduce `ownerIdResolved` state
We've repeatedly added a `useState` called `ownerIdResolved` that gets set once during `init()` and then referenced in other functions (`saveInvoice`, `approveInvoice`, `handleFileUpload`, etc.). **This breaks** because:
- State can be stale/null if the function fires before `init()` completes, or after a refresh.
- `ownerId` from `useRole()` is always live — there's no reason to cache it in local state.

**If you see `ownerIdResolved` anywhere, replace it with `ownerId || session.user.id` inline and remove the state.**

### `initRan` ref pattern
Every page using `useRole()` should guard its init `useEffect` with a ref to prevent double-init when `ownerId` changes from `null` → resolved value:

```js
const initRan = useRef(false)

useEffect(() => {
  if (!ownerId) return
  if (initRan.current) return
  initRan.current = true

  const init = async () => { /* ... */ }
  init()
}, [ownerId])
```

---

## Auth & Admin

- `profiles.is_admin` (boolean) gates access to `/admin`.
- **Login redirect**: `app/auth/login/page.js` checks `is_admin` after `signInWithPassword` and routes to `/admin` vs `/dashboard`. The OAuth callback (`app/auth/callback/route.js`) does the same check for magic-link/OAuth flows.
- **Pure admin accounts** (e.g. `billy@inventorysux.com`) have no `bar_name`, no subscription — `subscription_status` can be null. They always land on `/admin`.
- **Real subscriber accounts** that also happen to have `is_admin = true` (e.g. Billy's main Blacksheep account) will ALSO redirect to `/admin` on login — there's a "← App" button in the admin topbar to get back to `/dashboard`. This is a known minor friction point, not yet fixed for dual-purpose accounts.
- **Add Admin** button on `/admin` → `app/api/admin/create-admin/route.js` creates a new auth user + profile with `is_admin: true`, `subscription_status: 'comp'`, and sends a password-setup email via `resetPasswordForEmail`.
- **Supabase Auth → URL Configuration → Site URL** must be `https://app.inventorysux.com` (not localhost) or password reset / confirmation links break. This was a real incident — Site URL had reverted to localhost and broke reset emails until fixed.
- Creating auth users directly via SQL (`insert into auth.users ...`) is fragile — login can fail with "Database error querying schema" even when the row looks correct. **Prefer Supabase Dashboard → Authentication → Add User** (with Auto Confirm) over raw SQL inserts. If you must fix a password via SQL, use:
  ```sql
  update auth.users set encrypted_password = crypt('NewPass123!', gen_salt('bf')) where email = '...';
  ```
- Supabase sometimes caches deleted user emails for a few minutes ("already registered" error after delete) — wait or use a temp email and rename via SQL after.

---

## Staff / Team Roles

- `profiles.team_role` and `profiles.owner_user_id` identify staff accounts.
- `profiles.boh_access` gates BOH visibility for staff.
- BOH page guards: `if (!prof?.boh_access && !prof?.owner_user_id) { router.push('/dashboard'); return }` — owners always pass (no `owner_user_id`), staff need `boh_access`.
- Dashboard BOH tile: `canBOH = can('view_boh') && (isOwner ? profile?.boh_access : true)` — staff with `boh_staff` role see the tile regardless of the owner's own `boh_access` flag.

---

## Invoice Scanning & Approval Flow

**Two-step flow**: Scan → Review/Match → **Save for Approval** (writes `invoice_lines`, no inventory changes, status → `processed`) → Hub shows **Approve** button on `processed` invoices → **Approve** reads saved lines and writes to `inventory_items` + `inventory_history`, status → `confirmed`.

### `invoices.status` — CHECK CONSTRAINT
Only allows: `'pending'`, `'processing'`, `'processed'`, `'confirmed'`. **`'scanned'` is NOT allowed** — use `'processed'` for the initial upload status (we use `processed` for both "just scanned" and "saved, awaiting approval" — there's no separate scanned state).

### `invoice_lines.match_status` — CHECK CONSTRAINT
Allows: `'matched'`, `'unmatched'`, `'manual'`, `'create_new'`, `'low_confidence'`. (Originally only allowed `matched`/`unmatched`/`manual` — had to be widened.)

### `invoice_lines` schema (additions beyond original)
```sql
alter table invoice_lines add column if not exists is_create_new boolean default false;
alter table invoice_lines add column if not exists new_category text;
alter table invoice_lines add column if not exists case_size integer default 1;
alter table invoice_lines add column if not exists item_number text;
```
- `item_number` carries the distributor SKU from the scan through to `inventory_items.item_number` on approve (for both new items and matches).
- `is_create_new` flags lines that should create a brand-new `inventory_items` row on approve.
- `case_size` is used to convert invoice qty (cases) → `on_hand` units, and to back-calculate per-unit cost from case cost for BOH items.

### `/api/scan-invoice` (Claude Haiku OCR)
- Extracts `vendor`, `invoice_number`, `invoice_date`, `total_amount`, and `line_items[]` with `raw_name`, `item_number`, `qty`, `unit`, `unit_cost`, `total_cost`.
- Does SKU-first matching against `inventory_items.item_number`, falls back to fuzzy name matching (`similarityScore`).
- Match statuses: `matched` (SKU or high name-similarity), `low_confidence` (weak name match), `create_new` (user selected "+ Create new item"), `unmatched`.

### FOH vs BOH approve differences
- **FOH**: `unit_cost` on new/updated items = invoice unit_cost directly (cost is per-bottle/unit as scanned).
- **BOH**: case-based items — `unit_cost` = `unit_cost / case_size` when `case_size > 1` (storing per-unit cost, not per-case), and `on_hand` increments by `qty * case_size`.

---

## Email Reply Parsing (`app/api/email/reply/route.js`)

`extractReply()` strips the quoted thread/signature/security-banner noise from inbound SendGrid emails. Cuts at the first line matching: `From:`, `-----Original Message-----`, `-----Forwarded Message-----`, `On ... wrote:`, `Sent:`, `Inventory Sux New Order`, `Submitted by`, `Order #...`, `[EXTERNAL]`, `CAUTION:`, `WARNING:`, or any `>` quoted line. Everything above the cut is the real reply.

If you see raw email headers/CAUTION banners/quoted order text showing up in `order_replies.message`, this function needs another pattern added to `cutPatterns`.

---

## COGS / Spirits Database

- **Currently a SEPARATE system** from FOH inventory — `spirits` table (with `bottle_size_oz`, `bottle_cost`, `category` like "Bourbon"/"Liqueur"/etc., `distributor` as free text) vs `inventory_items` (with `unit_cost`, `on_hand`, `area`, `distributor_id` FK, category like "liquor"/"wine"/"beer"/"misc").
- **Long-term plan (not yet started)**: merge `spirits` into `inventory_items`. This requires:
  - Adding `bottle_size_oz` and a spirit-specific category field to `inventory_items`
  - Migrating `recipe_ingredients.spirit_id` FKs to point at `inventory_items.id`
  - Reconciling category vocabularies (spirit categories are granular: Bourbon/Rye/Scotch/etc.; inventory categories are broad: liquor/wine/beer/misc)
- **Short-term bridge**: CSV export/import between the two systems. The Google Sheets COGS workbook (`COGS_WorkBook.xlsx`, sheet "🍾 Spirits Database") is the source of truth for current accurate bottle sizes/costs — more accurate than `inventory_items.unit_cost` which is mostly `0.0000` (never populated via invoices yet).
- COGS spirits CSV import format: `Name, Category, Bottle Size (oz), Bottle Cost ($), Distributor, Notes`. Category is free text matching the `CATEGORIES` array in `app/foh/cogs/page.js` (Bourbon, Rye, Scotch, Irish, Japanese, Whiskey, Tequila, Mezcal, Vodka, Gin, Rum, Brandy, Liqueur, Aperitif, Bitters, Other).

---

## Key Environment Variables / IDs

- `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_APP_URL` — should be `https://app.inventorysux.com` (watch for localhost regressions)
- Stripe live price IDs: FOH `price_1TbRALLCkHYfmSfEspfqqokK`, BOH `price_1TbRBVLCkHYfmSfEtxICvRMN`, Bundle `price_1TbRCJLCkHYfmSfE0sXdf9xS`
- Twilio number `+14632232985`, current Messaging Service SID `MG7698c334fd5f54419510972470f976d1` (A2P 10DLC campaign approved/active as of this session)
- Old Twilio Messaging Service `MG149ae6124d1a5a2921ff566c7912867c` — has a warning, check references before deleting

---

## Production Auth Users (reference)

| Email | UID | Role |
|---|---|---|
| `billy.fredlund@uplandbrewing.com` | `e98897c2-...0343732` | Main Blacksheep owner account (comp, boh_access) |
| `billy@inventorysux.com` | `9add3022-...193f09` | Pure admin account → `/admin` |
| `test@inventorysux.com` | `8f21fbd8-...d9106f7` | Test bar account |
| `bfredlund@geoacademies.org` | `e6f06797-...000dcda` | BOH staff test account |
| `thefredlund5@gmail.com` | `42f9fc54-...e1b6b1` | Misc test account |

---

## `order_lines` columns (reference — do not add `category`, it doesn't exist)
`id, order_id, user_id, item_id, item_name, unit, distributor_id, distributor_name, par, shelf_count, well_count, suggested_qty, final_qty, created_at, org_id, location_id, received_qty, receiving_status`

`unit` stores the order unit (bottle/case/keg/etc, from `row.orderUnit`) and feeds the UNIT column on the PDF/email order confirmation. Both FOH and BOH now write `unit: row.orderUnit || row.unit || null` in `markAsReady`/`submitOrder` — confirm both stay in sync if this is touched again (see FOH/BOH drift warning above).

---

## Silent insert failures hide as $0.00 / 0% costs or blank fields
If a `.insert()` call into a table feeds a cost calculation or a downstream display (recipe_ingredients, prep_item_ingredients, order_lines), always check the returned `error` and surface it (console.error + alert), don't just await and move on. A missing column — e.g. a migration that wasn't run yet — makes PostgREST reject the whole insert. The parent record still saves fine, but the line items silently never get created, and the UI just shows $0.00 or `--` with no indication why. This has bitten us on `recipe_ingredients` (missing `source_type`/`source_id` columns) and is the same shape of bug as the FOH `order_lines.unit` gap — always confirm a written field is being read by every consumer (PDF generator, receive page, recap screen, etc.), not just the page that wrote it.

---

## Outstanding / Pinned Items

- [ ] COGS ↔ Inventory full DB unification (see above) — dedicated session needed
- [ ] Admin permission guards — prevent admins from deactivating each other or the owner account
- [ ] Dual-purpose accounts (real subscriber + is_admin) always redirect to `/admin` on login — minor friction, not fixed
- [ ] Rep reply notification UI polish — re-test once a real distributor reply comes through post email-parsing-fix
- [ ] Audit other FOH/BOH page pairs for similar drift (only `order_lines.unit` has been checked/fixed so far)