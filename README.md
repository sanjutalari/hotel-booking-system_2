# StayBook — Hotel Booking System

A hotel booking project with a guest site, an admin console, an Express API, PostgreSQL-backed guest accounts, and JWT-protected booking actions.

> **Stack status:** the faculty handout mixes MERN/MongoDB with PostgreSQL. The team selected PostgreSQL. The customer UI is currently HTML/CSS/vanilla JavaScript rather than React. PostgreSQL currently stores guest accounts only; hotel, room, inspection, and booking data remain in memory and reset on restart. Finish the React and database work before claiming MERN/PERN compliance or full database persistence.

## Project information

- **Title:** StayBook — Hotel Booking System
- **Team name:** [Add unique team name]
- **Team size:** 3
- **GitHub:** [Add repository URL]
- **Deployment:** [Add public Render URL after deployment]

## Description and objectives

Guests can search hotels, compare rooms, book stays, and manage bookings. Admins can manage hotels and rooms and record quality inspections. The project demonstrates REST APIs, CRUD operations, password hashing, and token-based guest authentication.

Objectives: provide a clear booking workflow; expose JSON APIs; manage hotel/room records; store guest accounts in PostgreSQL; protect guest booking endpoints with JWT; prepare for deployment with environment-based secrets.

## Technologies

| Layer | Current implementation |
|---|---|
| Runtime / API | Node.js, Express.js |
| Customer/admin UI | HTML, CSS, vanilla JavaScript, Fetch API |
| Database | PostgreSQL for guest accounts; other project records remain in memory |
| Authentication | bcryptjs password hashing and JSON Web Tokens (2-hour expiry) |
| Hosting target | Render (not deployed yet) |

## Features

- Search, filter, and sort hotels; browse room photos and availability.
- Register and sign in with an email/password account.
- Store password hashes in PostgreSQL and issue a signed JWT after login.
- Require a valid JWT for guest booking, cancellation, feedback, and booking history.
- Calculate the booking total on the server using nights × room rate.
- Admin CRUD for hotels and rooms, inspections, feedback summaries, and quality eligibility.
- Responsive layout, keyboard focus styling, and reduced-motion support.

## Project structure

```text
hotel-booking-system/
├── db/                 # PostgreSQL pool, schema, and startup initialization
├── docs/VIVA-QA.md     # viva practice questions and answers
├── middleware/         # JWT verification
├── models/data.js      # current in-memory hotel, room, booking, inspection data
├── public/             # customer HTML/CSS/JS
├── public-admin/       # admin HTML/CSS/JS
├── routes/             # auth, hotel, booking, and admin API routes
├── admin.js            # local admin listener; deployed admin is served at /admin/
├── routes/admin-auth.js # environment-configured admin login and JWT issuance
├── server.js           # customer app and startup
├── .env.example        # local configuration template
├── TEAM-DIVISION.md    # three-member speaking/work split
└── README.md
```

## Run locally

1. Install Node.js and PostgreSQL; create a database named `hotel_booking`.
2. Copy `.env.example` to `.env`; set `DATABASE_URL` and a long random `JWT_SECRET`.
3. Run `npm install`, then `npm start`.
4. Open `http://localhost:3000` (guest site) and `http://localhost:3001` (local admin console). On Render, use `/admin/` on the public service URL.
5. Configure `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` in the service environment. Store only a bcrypt hash for the password; never commit the password or hash to this public repository.

The server applies `db/schema.sql` at startup when `DATABASE_URL` is set. If it is missing, browsing works locally, but register/login return a configuration message. Admin login requires `ADMIN_EMAIL`, a bcrypt `ADMIN_PASSWORD_HASH`, and `JWT_SECRET`. Never commit `.env`, passwords, hashes, or production secrets.

## API overview

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| POST | `/api/auth/register` | Public | Create guest account and issue JWT |
| POST | `/api/auth/login` | Public | Verify credentials and issue JWT |
| GET | `/api/auth/me` | JWT | Read signed-in account |
| GET | `/api/hotels` | Public | Search hotels |
| GET | `/api/hotels/:id/rooms` | Public | List hotel rooms |
| POST | `/api/bookings` | JWT | Create booking for signed-in guest |
| GET | `/api/bookings/me` | JWT | Read own booking history |
| PUT | `/api/bookings/:id/cancel` | JWT owner | Cancel own booking |
| POST | `/api/bookings/:id/feedback` | JWT owner | Rate own stay |
| `/api/admin/auth/login` | POST | Public | Verify configured admin and issue a 2-hour admin JWT |
| `/api/admin/*` | Various | Admin JWT | Hotel, room, booking and inspection controls |

Protected requests use `Authorization: Bearer <token>`. The server reads guest identity from the verified JWT, not a client-supplied user ID.

## JWT flow

On registration or login, the server checks credentials and signs a short-lived token containing the account ID (`sub`), name, and email. The browser sends it with protected requests. `middleware/auth.js` verifies the signature and expiry before a route runs. JWTs are signed, not encrypted; never put passwords or other secrets in their payload.

## Team members

| Member | Name | Registration number | Main contribution |
|---|---|---|---|
| 1 | Sanjay | [Add number] | Architecture/workflow, Git/Render preparation, JWT and booking API explanation, frontend integration |
| 2 | [Member 2] | [Add number] | PostgreSQL schema/data integration and hotel/room CRUD backend |
| 3 | [Member 3] | [Add number] | Customer/admin UI, responsive behavior, feature demo and screenshots |

This is a suggested split based on the current project and Sanjay's description. Replace it with actual contributions. Each of the three members should understand the full workflow.

## Presentation outline (7–10 slides)

1. Project title, unique team name, members.
2. Introduction and problem statement.
3. Objectives.
4. Technologies and tools (resolve PostgreSQL vs MongoDB with faculty).
5. Architecture and workflow.
6. Features and CRUD/API behavior.
7. Database design and JWT.
8. Current website screenshots.
9. Challenges and future scope.
10. Conclusion and deployment link.

Prepare the PPT after deployment, capture screenshots from the working site, and upload it to this repository.

## Before final submission

- Add the unique team name, three names, and registration numbers.
- Confirm with faculty whether the required combination is React + MongoDB (MERN) or React + PostgreSQL (PERN); the current vanilla UI is neither.
- Move hotel, room, inspection, and booking persistence from `models/data.js` into PostgreSQL.
- Add environment variables in Render and verify guest/admin deployment URLs.
- Ensure `.gitignore` excludes `node_modules`, `.env`, and unrelated personal reports. Check repository tracking before pushing.
- Add GitHub/deployment links to the shared spreadsheet and upload the 7–10 slide presentation.

See [TEAM-DIVISION.md](TEAM-DIVISION.md) and [docs/VIVA-QA.md](docs/VIVA-QA.md).
