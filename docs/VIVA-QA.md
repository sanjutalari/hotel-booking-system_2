# StayBook Viva Questions and Answers

Practice these short answers. Be accurate: guest accounts currently use PostgreSQL; hotel, room, inspection, and booking records are in memory until migration is completed.

## Project and architecture

**1. What problem does StayBook solve?**  
It helps guests find hotels, compare rooms, book stays, and manage trips, while giving admins a hotel and room management console.

**2. Explain the request workflow.**  
The browser sends an HTTP request to Express. A route validates it, works with data, and returns JSON. The frontend renders the response.

**3. What is Node.js?**  
The JavaScript runtime used to run the backend outside the browser.

**4. What is Express?**  
A Node.js web framework for routes, middleware, JSON handling, static files, and HTTP responses.

**5. What is REST?**  
A way to design resource-oriented APIs using HTTP methods. GET reads, POST creates, PUT updates, and DELETE removes.

**6. Is the frontend React?**  
No. It currently uses HTML, CSS, and vanilla JavaScript. React is still needed if required by faculty.

**7. Is this MERN?**  
No. MERN uses MongoDB, Express, React, and Node. PostgreSQL with React is called PERN. The current vanilla frontend and partial PostgreSQL usage mean the app is not yet fully MERN or PERN.

**8. What does the admin console do?**  
It supports hotel and room CRUD, inspections, booking summaries, and eligibility status.

## PostgreSQL and data

**9. What is stored in PostgreSQL now?**  
Guest account ID, name, email, and password hash. Other project records remain in in-memory JavaScript data.

**10. What happens to in-memory data on restart?**  
It resets. Those models need to move to PostgreSQL for persistence.

**11. Why parameterized SQL?**  
SQL values are sent separately from the query text, which helps prevent SQL injection.

**12. What is a primary key?**  
A field that uniquely identifies a row. The users table uses a generated ID.

**13. What does a unique email constraint do?**  
It prevents two accounts from registering with the same email address.

**14. How is the database connection configured?**  
The `pg` pool reads `DATABASE_URL` from environment variables rather than hard-coded credentials.

## Authentication and security

**15. What is authentication?**  
Verifying who a user is, usually by checking login credentials.

**16. What is authorization?**  
Deciding what an authenticated user may access. Booking handlers also check that the booking belongs to that user.

**17. What is JWT?**  
A signed JSON Web Token that carries claims about a logged-in user. The API verifies its signature and expiry.

**18. Explain this project's login flow.**  
The server finds the account in PostgreSQL, compares the password with the bcrypt hash, and issues a signed JWT when they match.

**19. What are the JWT parts?**  
Header, payload, and signature. The signature detects tampering; the payload is readable.

**20. What does `sub` mean?**  
The subject/account identifier. Here it identifies the signed-in guest.

**21. Why hash passwords?**  
The database stores a one-way password hash instead of the original password. bcryptjs makes guessing expensive.

**22. Is a JWT encrypted?**  
No. It is signed, not encrypted. Never put passwords or secrets in its payload.

**23. How is the JWT sent?**  
In the `Authorization` header as `Bearer <token>`.

**24. What happens after token expiry?**  
Protected requests are rejected; the guest signs in again to get a new token.

**25. Why not trust a user ID sent by the browser?**  
It can be changed to another person's ID. The server uses the account ID in the verified token instead.

**26. What is a risk of localStorage tokens?**  
Page JavaScript can read them, so an XSS flaw could expose a token. A production solution may use secure HTTP-only cookies with CSRF protection.

**27. Is the admin console protected by JWT?**  
Yes. Admin login verifies the configured email and bcrypt password hash, then issues a 2-hour JWT with the admin role. The admin API checks the token signature, expiry, and role before allowing hotel, room, booking, or inspection actions.

## Booking and frontend

**28. How is the booking total calculated?**  
The server multiplies nights by the room's nightly price; it does not trust a total from the browser.

**29. Why validate dates on both frontend and backend?**  
Frontend validation helps the user; backend validation protects the API if someone bypasses the page.

**30. How does cancellation work?**  
The API checks ownership, marks the booking cancelled, and sets the room available again.

**31. What does `fetch()` do?**  
It sends browser HTTP requests and returns a Promise for the response.

**32. What is JSON used for?**  
It carries structured data between browser and API.

**33. How does the room gallery work?**  
Thumbnail click handlers update the main image.

**34. How is the UI responsive?**  
CSS flexible layouts and media queries adapt the page to smaller screens.

## Deployment and team

**35. What is an environment variable?**  
A runtime configuration value such as `DATABASE_URL`, `JWT_SECRET`, or Render's `PORT`, kept out of source code.

**36. What is the Render start command?**  
`npm start` starts this Node.js application.

**37. What should be checked before deployment?**  
Set the production database and secret, initialize the schema, confirm deployed API URLs, and check the major guest flows.

**38. How is the work divided?**  
Explain only the actual work each person completed, as recorded in `TEAM-DIVISION.md`.

**39. What is Sanjay's backend explanation?**  
He can walk through the JWT middleware and booking route: verify token, validate booking, check room, calculate total, save the record, return JSON.

**40. What is the next development work?**  
Resolve React/PostgreSQL versus MongoDB requirements, persist all models in PostgreSQL, secure admin, deploy, capture screenshots, prepare the 7–10 slide PPT, and submit the URLs.
