# DEVNOTES — Inventory Sux

> **Repo:** NoStrangersHospitality/inventory-sux  
> **Prod:** app.inventorysux.com  
> **Stack:** Next.js (App Router) · Supabase (Postgres + Auth + Storage) · Vercel · Stripe · SendGrid · Twilio

---

## Core Architecture

- **Auth:** Supabase Auth. Users have a `role` column (`owner`, `admin`, `staff`).
- **ownerId pattern:** Throughout the app, always resolve as `ownerId || session.user.id` — never rely on a `ownerIdResolved` state variable. This prevents staff/admin accounts from losing their owner association.
- **initRan ref guard:** Use a `const initRan = useRef(false)` guard inside useEffect to prevent double-initialization (React StrictMode fires effects twice in dev).
  ```js
  const initRan = useRef(false)
  useEffect(() => {
    if (initRan.current) return
    initRan.current = true
    // ... init logic
  }, [])
  ```
- **FOH/BOH parallel structure:** `app/foh/` and `app/boh/` mirror each other. Pages can silently drift. Any fix to one side must be audited and applied to the other. See "FOH/BOH Drift" section below.

---

## Auth & Admin

- Admins can manage staff but **cannot deactivate each other** — guard needed (not yet built).
- `role` column on `profiles` table: `owner | admin | staff`.
- RLS policies: staff/admin operate under the owner's `user_id`. ownerId is passed explicitly through most queries.

---

## Order Pages (FOH + BOH)

### ownerId pattern
```js
const ownerIdToUse = ownerId || session.user.id
```
Never read from a `ownerIdResolved` state — use the above inline.

### Par input (Mac Chrome controlled-input fix)
Supabase returns numeric columns as **strings**. Using `defaultValue` causes a blank display on Mac Chrome when the string `"0"` doesn't match number `0` on re-render. Always use a **controlled** input:
```js
<input
  type="number"
  min="0"
  value={parseFloat(row.par) || 0}
  onChange={e => updateRow(dn, ri, 'par', parseFloat(e.target.value) || 0)}
/>
```
This must be applied on ALL paths that build row state (initial load, resume, etc.).

### order_lines unit field
Both `markAsReady` and `submitOrder` must write the `unit` field on every order_lines insert/upsert:
```js
unit: row.orderUnit || row.unit || null
```
The email order route renders it as `${line.unit || '--'}` in the order table.

### Empty-recap guard
Both `markAsReady` and `submitOrder` must check for an empty order before proceeding:
```js
const lines = []
// ... build lines ...
if (lines.length === 0) {
  alert('No items to order.')
  return
}
```
Also applies to the "resume as ready" path.

### 4-week order history
`orderHistory` state holds last 4 orders per item. Displayed as "Last 4" and "Avg" columns in the order table. Uses a fixed reference frame — items not ordered in a given week show explicit `0` rather than being omitted.

Helper functions: `getItemHistory(itemId)` → array of last 4 qtys, `getItemHistoryAvg(itemId)` → average.

### Stale closure in updateRow
When `updateRow` became non-async, reading `orderRows[distName][idx]` after `setOrderRows` returned stale pre-update state, causing `line_id` to be undefined and silent failures on per-keystroke draft saves.

**Fix:** Capture the updated row inside the setState callback:
```js
let currentRow = null
setOrderRows(prev => {
  const updated = { ...row, [field]: val }
  currentRow = updated
  // ... return new state
})
// use currentRow for DB saves, not orderRows[distName][idx]
```

### FOH/BOH Drift — known differences
| | FOH | BOH |
|---|---|---|
| SMS order_method check | `contact.order_method?.toLowerCase() === 'sms'` | `contact.order_method === 'Text' \|\| contact.order_method?.toLowerCase() === 'sms'` |
| Vendor table | `distributors` | `vendors` |

**BOH 'Text' gotcha:** BOH vendor records store `order_method = 'Text'` (capital T), not `'sms'`. The BOH SMS send check must include `contact.order_method === 'Text'` explicitly, in addition to the lowercase fallback. Forgetting this causes BOH SMS orders to silently not send.

---

## Email Ordering

- **Route:** `app/api/email/order/route.js`
- **Reply-to:** `orders@parse.inventorysux.com` (SendGrid Inbound Parse)
- **Subject format:** `[#${orderId?.slice(0, 8).toUpperCase()}]` — included in subject for reply thread matching
- **Unit column:** `${line.unit || '--'}` rendered in the order email table

### SendGrid Inbound Parse → order_replies
- **Route:** `app/api/email/reply/route.js`
- Parse webhook hits this route on inbound reply emails
- **Distributor matching:** exact email match first (`.ilike()`), then domain fallback
- Always uses the matched distributor's **stored name** (`dist.name`), never a name derived from order data
- `extractReply()` strips quoted thread/signatures with `cutPatterns`:
  - `From:`, `Original Message`, `Forwarded Message`, `On...wrote:`, `Sent:`, `Inventory Sux New Order`, `Submitted by`, `Order #`, `[EXTERNAL]`, `CAUTION:`, `WARNING:`, `> ` (quoted lines)
- Inserts into `order_replies` with `archived: false`

### DMARC config
DNS `_dmarc` record was originally `p=reject; adkim=s; aspf=s` — too strict, causing deliverability failures.

**Current (relaxed):**
```
p=none; adkim=r; aspf=r
```
Change from `p=reject` → `p=none` and strict alignment → relaxed allows legitimate mail through while monitoring.

> **SendGrid account verification:** Response submitted, awaiting resolution as of this writing.

---

## SMS Ordering

- **Route:** `app/api/sms/order/route.js`
- **Provider:** Twilio
- **Inbound webhook:** `app/api/sms/reply/route.js` — receives replies, inserts into `order_replies`

### Phone number normalization
Raw string compare fails for formatted numbers. Always normalize before matching:
```js
const normalize = (p) => p?.replace(/\D/g, '').slice(-10)
const match = vendors.find(v => normalize(v.phone) === normalize(fromNumber))
```
Apply this in the SMS webhook reply route when matching incoming numbers to stored vendor phone numbers.

### Twilio A2P 10DLC Compliance
**Campaign approved:** `CM557c73f4c26a3f6c08`  
**Messaging Service SID:** set in Vercel env (`TWILIO_MESSAGING_SERVICE_SID`)

Infrastructure built:
- SMS consent checkbox on distributors and vendors edit pages
- Consent confirmation page at `/distributor-sms-consent`
- ToS Section 8 added (SMS consent language)
- `sms_consent_confirmed`, `sms_consent_confirmed_at`, `sms_consent_confirmed_by` columns on both `distributors` and `vendors` tables

**SQL migrations run:**
```sql
alter table distributors
  add column if not exists sms_consent_confirmed boolean default false,
  add column if not exists sms_consent_confirmed_at timestamptz,
  add column if not exists sms_consent_confirmed_by uuid;

alter table vendors
  add column if not exists sms_consent_confirmed boolean default false,
  add column if not exists sms_consent_confirmed_at timestamptz,
  add column if not exists sms_consent_confirmed_by uuid;
```

---

## Notifications / order_replies

- **Dashboard bell:** Shows unread reply count. Tray opens on click. Does **NOT** auto-mark-all-read on open (this behavior was intentionally removed). Explicit "Mark all read" button in tray.
- **"View all notifications →"** link in tray points to `/notifications`.
- **Notifications page:** `app/notifications/page.js` — full reply history with archive support.
- **`archived` column on `order_replies`:** Added migration:
  ```sql
  alter table order_replies add column if not exists archived boolean default false;
  ```
- **Realtime:** Dashboard subscribes to new `order_replies` inserts for live bell updates.
- **`loadReplies` must be defined before the useEffect that calls it** (ESLint `react-hooks/immutability` rule). Move the function definition above the useEffect.

---

## COGS

### recipe_ingredients source pattern
Ingredients can come from spirits, prep items, or purchased inventory items. Schema uses `source_type` + `source_id` to handle all cases:

```sql
alter table recipe_ingredients add column if not exists source_type text default 'spirit';
alter table recipe_ingredients add column if not exists source_id uuid;
update recipe_ingredients
  set source_type = 'spirit', source_id = spirit_id
  where source_id is null and spirit_id is not null;
```

`source_type` values: `'spirit'` | `'prep_item'` | `'inventory_item'`

### Prep items — purchased type
Prep items can be either made in-house or purchased:
```sql
alter table prep_items add column if not exists source_type text default 'made';
alter table prep_items add column if not exists purchase_cost numeric;
```
`source_type`: `'made'` | `'purchased'`

### Unit conversion oz split-table fix
`oz` appears in **both** `WEIGHT_TO_G` (28.3495 g) and `VOLUME_TO_ML` (29.5735 ml). The conversion function must check whether both units are weight units before selecting the lookup table — otherwise g↔oz picks the wrong table and causes ~28x overcost.

```js
const weightUnits = new Set(['g', 'kg', 'oz', 'lb'])
const useWeight = weightUnits.has(fromUnit) && weightUnits.has(toUnit)
const table = useWeight ? WEIGHT_TO_G : VOLUME_TO_ML
```

> **Long-term:** Full DB unification of COGS ↔ Inventory items is a dedicated session. Currently two separate data stores.

---

## ESLint Patterns

Four rules that come up repeatedly:

### 1. Declaration order (`react-hooks/immutability`)
Functions called inside a `useEffect` must be defined **before** the effect:
```js
// ✅ correct
function loadReplies() { ... }
useEffect(() => { loadReplies() }, [])

// ❌ wrong — ESLint error
useEffect(() => { loadReplies() }, [])
function loadReplies() { ... }
```

### 2. exhaustive-deps
When a useEffect intentionally omits a dependency (e.g., a function that would cause infinite loops if added), suppress with:
```js
// eslint-disable-next-line react-hooks/exhaustive-deps
```
Do not add the dependency if it would cause an infinite loop — suppress instead.

### 3. Ternary-as-statement
ESLint forbids ternaries used as statements (for side effects). Replace with `if/else`:
```js
// ❌ wrong
next.has(cat) ? next.delete(cat) : next.add(cat)

// ✅ correct
if (next.has(cat)) { next.delete(cat) } else { next.add(cat) }
```

### 4. Unused variables
- Remove destructured vars that aren't used: `const [, group] = something` instead of `const [vendorName, group] = something`
- Common culprits: `distributorName` in SMS order route, `vendorName`/`distName` in order pages

---

## RLS Policies

**Known conflict (resolved 6/23/2026):** "Users can manage own order lines" policy conflicted with "order_lines_insert" policy. Both had to be satisfied simultaneously, causing silent insert failures for staff/admin accounts.

**Fix:** Drop the old policy, keep only the one that works for all roles:
```sql
drop policy if exists "Users can manage own order lines" on order_lines;
```

When RLS insert failures happen: check `supabase.from(...).insert(...).select()` — if `data` is empty with no error, it's usually an RLS conflict.

---

## Database Schema Notes

### order_lines
```
id, order_id, user_id, item_id, item_name,
distributor_id, distributor_name,
par, shelf_count, well_count,
suggested_qty, final_qty,
unit  ← written by both FOH and BOH markAsReady/submitOrder
```

### order_replies
```
id, order_id, distributor_id, distributor_name,
reply_text, received_at,
read (boolean),
archived (boolean, default false)  ← added this session
```

### distributors / vendors (SMS consent columns added)
```
sms_consent_confirmed (boolean, default false)
sms_consent_confirmed_at (timestamptz)
sms_consent_confirmed_by (uuid → profiles.id)
```

### recipe_ingredients (COGS source pattern)
```
source_type (text, default 'spirit')  ← 'spirit' | 'prep_item' | 'inventory_item'
source_id (uuid)                       ← replaces hard-coded spirit_id for non-spirit ingredients
spirit_id (uuid)                       ← still present for legacy rows
```

### prep_items (purchased type)
```
source_type (text, default 'made')  ← 'made' | 'purchased'
purchase_cost (numeric)
```

---

## Invoice Scanning

- Uploads invoice image → OpenAI Vision extracts line items
- Matched against inventory items by name similarity
- Creates `received_items` records
- Route: `app/api/invoices/scan/route.js`

---

## Ghost Order Cleanup SQL

A stuck order with `receiving_status='pending'` and `status='submitted'` can block the receiving flow. To clean up:

```sql
-- Find stuck orders for a user
select id, submitted_at from orders
where receiving_status = 'pending'
  and status = 'submitted'
  and user_id = '<owner_user_id>';

-- Clean up (replace <order_id> with actual id)
delete from order_receiving where order_id = '<order_id>';
delete from orders where id = '<order_id>';
```

> **Note:** As of this writing, one stuck order exists for user `e98897c2-495c-4e15-91e0-ec3a10343732`. Run the select first to confirm the id, then delete.

---

## Vercel Environment Variables

Key env vars (set in Vercel dashboard):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID` ← updated for A2P campaign
- `SENDGRID_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

---

## Outstanding / Next Sessions

### Immediate
- [ ] Run ghost order cleanup SQL (user `e98897c2...`)
- [ ] Verify "View all notifications →" link is in live `app/dashboard/page.js`
- [ ] Audit all other FOH/BOH page pairs for drift (beyond order pages)

### Short-term
- [ ] Admin permission guard — prevent admins from deactivating each other
- [ ] SMS inline reply feature — reply to a distributor from the notification tray
- [ ] SendGrid account verification — awaiting resolution

### Dedicated sessions (scope too large for inline)
- [ ] COGS ↔ Inventory full DB unification
- [ ] Multi-location / parent account architecture