# Team Division and Presentation Plan

**Project:** StayBook — Hotel Booking System  
**Team name:** [Choose a unique name]  
**Team size:** exactly three

> This is a proposed split based on the current files and Sanjay's description. Update it to match actual work; do not claim work another member did. Every member should understand the whole workflow.

| Member | Suggested ownership | Speaking focus |
|---|---|---|
| **1 — Sanjay** | Architecture/workflow; Git and Render preparation; integrate and explain the ChatGPT-assisted customer UI work; JWT authentication; explain the booking API and his backend contribution. | System workflow, deployment, JWT, `POST /api/bookings`. |
| **2 — [Name]** | PostgreSQL schema and data migration; hotel/room persistence and CRUD API. | Database design, relationships, CRUD, API-to-database flow. |
| **3 — [Name]** | Customer/admin UI, responsive layout, forms, feature integration, screenshots. | Search → hotel → room → booking → history demo and UI. |

## Sanjay's backend explanation

Use `routes/bookings.js` and `middleware/auth.js`:

1. The browser sends JSON and `Authorization: Bearer <JWT>`.
2. The middleware verifies the signature and expiry, then reads the guest ID from the token's `sub` claim.
3. `POST /api/bookings` validates the hotel, room, dates, and guest count.
4. The server checks room availability, calculates nights × nightly rate, creates the booking, and marks the room booked.
5. It returns JSON with HTTP 201; the frontend renders a stay voucher.
6. Cancellation checks that the booking belongs to the signed-in guest before changing its status and freeing the room.

Be clear: hotel/room/booking data are still in memory and reset on restart. PostgreSQL currently stores guest accounts. Moving all project data to PostgreSQL remains necessary for a fully persistent application.

## JWT explanation for Sanjay

JWT means JSON Web Token. After login, the server compares the submitted password with the bcrypt hash in PostgreSQL and signs a token using `JWT_SECRET`. The token carries an account ID and expires after two hours. The browser sends it as a Bearer token. Middleware verifies it before a protected route runs. The server trusts the verified account ID, not a user ID from the request. A JWT is signed, not encrypted, so never put passwords or secrets in its payload.

## Suggested speaking order (8–10 minutes)

- **Sanjay (2–3 min):** title/team, problem, architecture/workflow, JWT and booking flow, Render plan.
- **Member 2 (2–3 min):** schema, relationships, CRUD/API data flow, PostgreSQL.
- **Member 3 (2–3 min):** screens, responsive UI, live user journey.
- **All (1 min):** challenge, future scope, conclusion.

## Demo sequence

1. Search by location and open a hotel.
2. Browse rooms and show the live total calculation.
3. Sign in/register; confirm a room and show the voucher.
4. Open booking history; cancel or rate a stay.
5. Show hotel/room management and the inspection eligibility badge.
6. Explain which data is persistent and which still uses in-memory demo data.

## Fill before submission

- Team name: [Unique name]
- Sanjay registration number: [Number]
- Member 2: [Full name] — [Registration number]
- Member 3: [Full name] — [Registration number]
- GitHub: [Add after push]
- Render: [Add after deployment]
