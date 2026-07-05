# Vercel Deployment Plan

The real app requires a server-capable host. GitHub Pages remains useful for the public placeholder, but it cannot run the Next.js backend routes, Prisma, uploads, AI parsing, or private environment variables.

Vercel supports Next.js projects and can run server-rendered Next.js routes through Vercel Functions. Vercel environment variables are configured outside source code, encrypted at rest, and available during builds or function execution.

## Required Environment Variables

Set these in Vercel Project Settings before production deployment:

```text
APP_PASSCODE=
OPENAI_API_KEY=
AI_PARSER_MODE=enabled
OPENAI_MODEL=gpt-5.5
DATABASE_URL=
APP_BASE_URL=
NODE_ENV=production
OFFICIAL_HOMESCHOOL_START_DATE=2027-05-01
INCLUDE_TRIAL_RECORDS_IN_REPORTS=false
STORAGE_PROVIDER=local
LOCAL_UPLOAD_DIR=./storage/evidence
```

Do not commit real values to GitHub.

## Database Requirement

SQLite is acceptable for local development only. A Vercel deployment needs a hosted PostgreSQL database before real records are stored there.

Recommended next setup:

1. Create a Vercel project from this GitHub repository.
2. Add a hosted Postgres database integration or external Postgres provider.
3. Set `DATABASE_URL` to the production Postgres connection string.
4. Switch the Prisma datasource provider from `sqlite` to `postgresql`.
5. Generate and apply a production migration.
6. Add `APP_PASSCODE` and `OPENAI_API_KEY` in Vercel environment variables.
7. Deploy.

## Current AI Behavior

The `/api/ai/parse` route:

- Uses the OpenAI Responses API when `OPENAI_API_KEY` exists and `AI_PARSER_MODE` is not `disabled`.
- Uses the local mock parser when the key is missing or AI parsing is disabled.
- Never sends the OpenAI API key to frontend code.
- Returns draft activity records only; nothing is permanently saved until parent approval.

## Current Deployment Blockers

- Production database is not set up yet.
- Production file uploads need durable object storage before real artifacts are used.
- The passcode is simple family protection, not full multi-user authentication.
