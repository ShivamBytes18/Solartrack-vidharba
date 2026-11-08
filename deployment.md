# Deployment and running guide

Stack: React (Vite) + Node/Express + MongoDB (Mongoose). In production one Node service serves both the API and the built React app.

## Run locally

Requirements: Node 20+, a MongoDB (local `mongod` or a free MongoDB Atlas cluster).

1. `git clone <repo-url> && cd solar-leads`
2. `npm run install:all`
3. `cp server/.env.example server/.env` and fill in `MONGODB_URI` and `JWT_SECRET` (any long random string).
   `GEMINI_API_KEY` is optional: without it the bill photo is not read by AI and the customer types the values (the app says so on screen).
4. `npm run seed` loads demo data (3 sample leads from the brief, 4 more, price lists, subsidy rule, one running project).
5. Two terminals: `npm run dev:server` (API on :4000) and `npm run dev:client` (app on http://localhost:5173).
6. Tests: `npm test` (20 unit tests, no database needed).

## Deployed setup (Render + MongoDB Atlas)

1. Create a free Atlas cluster, a database user, and allow network access (0.0.0.0/0 for the demo). Copy the connection string.
2. On Render create a **Web Service** from the GitHub repo.
   - Build command: `npm run build`
   - Start command: `npm start`
3. Add the environment variables below, deploy, open the service URL.
4. With `AUTO_SEED=true` the database is seeded on first start when it has no users.

### Environment variables (names only)

| Name | Needed | Purpose |
|---|---|---|
| `MONGODB_URI` | yes | MongoDB connection string |
| `JWT_SECRET` | yes | Signs staff login tokens (16+ chars) |
| `GEMINI_API_KEY` | optional | Enables AI bill reading (Google Gemini). Without it, manual entry |
| `GEMINI_MODEL` | optional | Vision-capable model name (default set in code) |
| `GEMINI_FALLBACK_MODEL` | optional | Backup model tried if the main one is overloaded or retired |
| `CLIENT_ORIGIN` | optional | Allowed CORS origin for local dev (default http://localhost:5173) |
| `PUBLIC_URL` | optional | Base URL used in status links and simulated messages |
| `AUTO_SEED` | optional | `true` seeds demo data on first start |
| `SEED_PASSWORD` | optional | Password given to the demo users when seeding |
| `NODE_ENV` | yes in prod | `production` |
| `PORT` | no | Set by the host |

No secrets are stored in the repository. `.env` files are git-ignored.

## Demo logins (for the reviewer)

| Role | Email | Password |
|---|---|---|
| Sales staff | `sales@demo.test` | `Demo@1234` |
| Admin (also manages Rules) | `admin@demo.test` | `Demo@1234` |

(Password is the default `SEED_PASSWORD`; change it for any real deployment.)

The homeowner needs no login: open `/` for the home page and `/check` for the lead form. Each lead gets a private status link (`/s/<token>`).

## 5-minute reviewer path

1. As homeowner open `/` (home page), click **Check my home**, fill the form, upload a bill photo, confirm values beside the image, see score and size.
2. Sign in at `/staff/login` as sales. See the dashboard (one project is stuck on purpose), open **Prashant Wankhede**, create a quote, download the PDF, start the project.
3. In **Projects** advance a stage; see the simulated WhatsApp message and open the customer status link.
4. As admin open **Rules**, add a new subsidy version with a future date; old rules stay, and quotes use the rule for the chosen date.
