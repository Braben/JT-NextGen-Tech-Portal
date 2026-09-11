# JT NextGen Portal Deployment

This runbook is for a production or staging deployment of the Express API and
React frontend. Production must use a managed PostgreSQL database and durable
file storage for uploads. The bundled SQLite database is for local development
and isolated tests only.

## Required configuration

Set these values in the hosting platform's secret/environment manager. Do not
commit a real `.env` file or credentials.

- `NODE_ENV=production`
- `DATABASE_URL` as a PostgreSQL connection string
- `JWT_SECRET` with at least 32 random characters
- `CORS_ORIGIN` as the exact comma-separated frontend origin list
- `FRONTEND_URL` as the public frontend URL
- `SEED_DEMO_ACCOUNTS=false`
- `OPENROUTER_API_KEY` if the landing-page assistant is enabled
- SMTP/Twilio values if email or SMS notifications are enabled

Generate a secret locally with:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Release procedure

1. Install dependencies with `npm ci` in both `backend` and `frontend`.
2. Build the frontend: `npm --prefix frontend run build`.
3. Run `npm --prefix backend run release:check`.
4. Run database migrations using the deployment platform's migration process.
5. If a bootstrap admin is required, set the bootstrap variables, run `npm --prefix backend run seed` once, then remove those variables.
6. Start the API with `npm --prefix backend run start:prod`.
7. Verify `GET /api/health` returns HTTP 200 with healthy database and uploads checks.

The production startup guard refuses weak JWT secrets, SQLite URLs, missing
database URLs, wildcard CORS, malformed origins, or missing frontend builds.

## Existing data checks

Run the read-only assignment audit before launch:

```powershell
npm --prefix backend run audit:assignment-scope
```

Historical assignments without a programme are reported for admin review. Do
not bulk-assign them automatically: the correct programme/class is a business
decision and must be confirmed by an administrator.

## Operational requirements

- Use HTTPS at the edge and configure the platform's health check to call `/api/health`.
- Put `backend/uploads` on persistent storage or move file storage to an object store before scaling beyond one instance.
- Schedule encrypted PostgreSQL backups and test restoration before launch.
- Forward JSON logs to a managed log service; retain request IDs for support investigations.
- Configure alerts for health-check failures, repeated 5xx responses, failed notification delivery, and database connectivity errors.
- Run a staging smoke test with one admin, instructor, and student account: login, registration/onboarding, class allocation, assignment submission, grading, announcements, forum access, attendance, and logout.

## Rollback

Keep the previous application build available at the hosting platform. If a
release fails, roll back the application image/build first, then restore the
database only when a migration has changed data and the rollback plan has been
tested. Never delete the production database as a rollback shortcut.
