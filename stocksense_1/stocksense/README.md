# StockSense — Modular Inventory Management System

Full-stack IMS: React (Vite) + Tailwind + Lucide → Node/Express → Supabase (Postgres).

## 1. Database (Supabase)

1. Create a Supabase project.
2. Open **SQL Editor → New query**, paste the contents of `sql/schema.sql`, and run it.
   This creates all 7 tables, the `process_ledger_validation` trigger (the core
   stock-movement engine), RLS policies, and seeds the example data (Steel Rods,
   Chairs, Main Warehouse, Production Floor, Rack A).
3. In **Authentication → Providers**, ensure Email is enabled (and OTP/magic link,
   used by the password-reset flow).
4. Grab your Project URL, anon key, and service_role key from **Project Settings → API**.

## 2. Backend

```bash
cd backend
cp .env.example .env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, etc.
npm install
npm run dev             # http://localhost:4000
```

The backend verifies every request's Supabase JWT (`middleware/auth.js`) and uses
the **service role key** to talk to Postgres directly — so it must never run in
the browser. All inventory math (increment/decrement/transfer/sync + the
non-negative-stock guard) lives in the Postgres trigger, not in application code,
so it's atomic and race-safe even with concurrent requests.

## 3. Frontend

```bash
cd frontend
cp .env.example .env   # fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
npm install
npm run dev              # http://localhost:5173
```

Create a user either via Supabase Studio (**Authentication → Users → Add user**)
or the sign-up API, then insert a matching row into `users_profiles` (id must
match `auth.users.id`) so the sidebar shows a name/role.

## How a document flows

1. **Create** — `POST /api/operations/ledger` inserts a `stock_ledger` row in
   `Draft`/`Waiting` plus its `ledger_items` lines. No stock changes yet.
2. **Progress** — `PUT /.../:id/status` moves it through `Waiting → Ready`
   (used by the Delivery Pick/Pack steps). Still no stock changes.
3. **Validate** — `PUT /.../:id/validate` sets `status = 'Done'`. This UPDATE
   fires `trg_process_ledger_validation`, which atomically applies the correct
   stock delta per `document_type` and raises a Postgres exception (surfaced
   as HTTP 409) if it would take any `stock_levels.current_quantity` negative.

## Project layout

```
sql/schema.sql              → run once in Supabase SQL editor
backend/
  server.js                 → Express app + route mounting
  middleware/auth.js         → Supabase JWT verification
  lib/supabaseAdmin.js       → service-role client
  routes/dashboard.js        → KPIs + activity stream
  routes/products.js         → catalog + categories/locations
  routes/ledger.js           → create/status/validate/list documents
frontend/
  src/context/AuthContext.jsx
  src/components/            → Sidebar, AuthCard, KpiCard, StatusPill, LineItemsEditor, AddProductModal
  src/pages/                 → Dashboard, Products, Receipts, Deliveries, InternalMoves, Adjustments, MoveHistory
  src/lib/api.js              → fetch wrapper mapping 1:1 to backend endpoints
```
