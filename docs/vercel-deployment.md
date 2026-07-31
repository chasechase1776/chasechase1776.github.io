# Vercel Deployment Plan

The real app requires a server-capable host. GitHub Pages remains useful for the public placeholder, but it cannot run the Next.js backend routes, Prisma, uploads, AI parsing, or private environment variables.

Vercel supports Next.js projects and can run server-rendered Next.js routes through Vercel Functions. Vercel environment variables are configured outside source code, encrypted at rest, and available during builds or function execution.

## Required Environment Variables

Set these in Vercel Project Settings before production deployment:

```text
ENABLE_PASSCODE_GATE=false
APP_PASSCODE=
OPENAI_API_KEY=
AI_PARSER_MODE=enabled
OPENAI_MODEL=gpt-5.5
DATABASE_URL=
APP_BASE_URL=https://chasechase1776-github-io.vercel.app
NODE_ENV=production
OFFICIAL_HOMESCHOOL_START_DATE=2027-05-01
INCLUDE_TRIAL_RECORDS_IN_REPORTS=false
STORAGE_PROVIDER=supabase
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET=homeschool-files
SUPABASE_STORAGE_PREFIX=evidence
```

Do not commit real values to GitHub.

## Current Local CLI Status

The project includes the Vercel CLI as a development dependency and exposes:

```text
corepack pnpm run deploy:prod
```

Current status: Vercel CLI is authenticated and production deployment is available from this workspace.

Do not treat GitHub Pages as the production app deployment. GitHub Pages can only serve the static placeholder in `site/`.

## Stable Production URL

Use this URL for every production review unless a custom domain is added later:

```text
https://chasechase1776-github-io.vercel.app
```

Vercel may print one-off deployment URLs during deployment. Those are useful for debugging, but the stable project URL above should be the normal handoff URL.

## Database Requirement

The deployed app uses PostgreSQL through Prisma. The Vercel Prisma Postgres integration should provide the `DATABASE_URL` environment variable.

Recommended setup:

1. Create a Vercel project from this GitHub repository.
2. Add a hosted Postgres database integration or external Postgres provider.
3. Set `DATABASE_URL` to the production Postgres connection string.
4. Add `OPENAI_API_KEY` in Vercel environment variables if AI parsing is desired. Leave `ENABLE_PASSCODE_GATE=false` while the app is being built; set it to `true` and add `APP_PASSCODE` when family protection is ready.
5. Deploy.

The repository includes `vercel.json`, which runs:

```text
pnpm prisma:generate && pnpm prisma:migrate:deploy && pnpm exec next build
```

That means Vercel generates the Prisma client and applies checked-in database migrations during deployment.

## Standard Change Delivery

User-approved application changes are expected to be delivered through the full loop:

1. Verify the change locally and with the production build when practical.
2. Commit the change to Git.
3. Push the commit to GitHub.
4. Deploy the production project to Vercel.
5. Smoke-test the live Vercel URL.

This procedure is the default for work started in any thread for this project unless the user explicitly requests analysis only, local-only work, or no deployment. The live deployment result and any blockers should be included in the handoff.

## Ongoing Product Quality

Every relevant change should also look for safe improvements to intuitiveness, sleekness, clarity, and daily usability. Remove redundant UI, reduce friction, and preserve progressive disclosure without removing legal, evidence, skill, review, or export data from the underlying system.

## Current AI Behavior

The `/api/ai/parse` route:

- Uses the OpenAI Responses API when `OPENAI_API_KEY` exists and `AI_PARSER_MODE` is not `disabled`.
- Uses the local mock parser when the key is missing or AI parsing is disabled.
- Never sends the OpenAI API key to frontend code.
- Returns draft activity records only; nothing is permanently saved until parent approval.

## Current Deployment Limitations

- Production file uploads require Supabase environment variables and a Supabase Storage bucket before real artifacts are used.
- The passcode is simple family protection, not full multi-user authentication.
