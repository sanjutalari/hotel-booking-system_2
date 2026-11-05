# AGENTS.md

Node.js mini project: customer booking site (port 3000) + admin console (port 3001), vanilla HTML/CSS/JS frontend, PostgreSQL-backed guest accounts, and in-memory hotel/room/booking data. No tests, no lint, no build step.

## Boot model — one process, two ports
- `npm start` runs `node server.js`, which ALSO starts the admin app via `startAdminServer()` (`admin.js`). Not two `node` invocations — one process, ports 3000 + 3001.
- Both Express apps `require("./models/data")` → Node module cache → **same in-memory data**. No restart/sync needed for admin edits to appear on the customer site.
- **Never leave an old node process running.** `app.listen` failing to bind is easy to miss: the *stale* process keeps serving requests (we once saw `Cannot PUT /api/admin/rooms/...` from a pre-edit process). Restart recipe (PowerShell): `Get-Process node | Stop-Process -Force` then `node server.js`.

## No step needed: restart on every code change
No nodemon or frontend bundler. PostgreSQL is used for guest accounts only; hotel/room/booking seed data remains in memory. Frontend is static files in `public/` (3000) and `public-admin/` (3001) — edit and refresh the browser. **Every edit to `server.js` / `admin.js` / `routes/*` / `models/data.js` needs a full server restart** to take effect.

## Verification (there is no test harness)
- Syntax check any file: `node --check <file>`.
- Runtime check: start server, then hit endpoints (PowerShell `Invoke-RestMethod`/`Invoke-WebRequest`). Smoke-test the core flows after backend changes: book → room flips `booked`; cancel → flips `available`; admin add/delete; eligibility flag on the customer `GET /api/hotels`.
- Admin endpoints need the `/api/admin` prefix and are on port 3001: `http://localhost:3001/api/admin/hotels`.

## Data layer (`models/data.js`)
- Arrays `hotels`, `rooms`, `bookings` + plain object `inspections` keyed by hotelId. These project records are in-memory and reset on restart; guest accounts are stored in PostgreSQL via `db/pool.js`.
- Auto-ID helpers `getNextHotelId/getNextRoomId/getNextBookingId` → `H#`/`R#`/`B#`.
- `booking.totalAmount` is computed server-side (`nights × room.price`); `room.status` flips `available ⇄ booked` inside the route handlers.
- Eligibility rule (`routes/admin.js` `checkEligibility`): `hygiene === "pass" && service === "pass" && feedbackScore >= 3.5` → `eligible`, surfaced to the customer API as the "Quality-checked" badge.

## API & frontend conventions
- API namespaces: customer `/api` (3000); admin `/api/admin` (3001). POST/PUT handlers read `req.body` via `express.json()` — **POST/PUT calls must send `Content-Type: application/json`** with a `JSON.stringify` body or they silently become invalid.
- Query params go through `req.query`; URL params through `req.params` (e.g. `/:id/cancel`).
- Frontend is one-page multi-view: HTML `<section class="view">` toggled via `.active` class; all `fetch` calls go through the `api(path, options)` wrapper (`public/app.js`, `public-admin/admin.js`).
- `localStorage` keys include `staybook.token`, `staybook.account`, `staybook.user`, and `staybook.search`. Customer booking routes require a Bearer JWT; `middleware/auth.js` verifies it and booking ownership is checked server-side.
- Admin console intentionally has **no auth** (project requirement) — do not "fix" this.

## Reference docs
- `Hotel Booking System — Mini Project Guide.md` — the PRD/spec to follow.
- `README.md` — full architecture/API/endpoint docs; keep in sync when routes or features change.
- `TEAM-DIVISION.md` — 3-member build/demo/Q&A/assignment of file ownership.