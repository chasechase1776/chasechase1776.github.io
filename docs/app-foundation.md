# App Foundation

## Current Foundation

The project now uses a real Next.js application foundation:

- Next.js App Router in `app/`
- React and TypeScript
- Prisma ORM with PostgreSQL
- Vercel project configuration
- GitHub Pages placeholder for the public root URL
- Local and live smoke-check scripts

This repository already contains prototype homeschool logging screens and API routes from earlier work. Do not remove them during foundation cleanup unless the user explicitly asks. Future changes should preserve existing behavior while improving the foundation around it.

## Local Development

Use the project package manager through Corepack:

```text
corepack pnpm run dev
```

Local review URL:

```text
http://localhost:3000
```

If `pnpm` is available directly on the machine, `pnpm run dev` is also fine.

Localhost is optional for developer troubleshooting. It is not required as a predeployment review step. The normal review target for the user should be the deployed Vercel production URL after the change is committed and pushed.

## Checks

Run these before committing application changes:

```text
corepack pnpm run typecheck
corepack pnpm run lint
corepack pnpm run build
```

Or run the combined check:

```text
corepack pnpm run check
```

## Smoke Checks

Stable Vercel production smoke check:

```text
corepack pnpm run smoke:live
```

The smoke check confirms the stable Vercel production URL is reachable and contains the expected `Bennett Homeschool` page text.

## Production Deployment Path

The real app should deploy to Vercel because GitHub Pages cannot run Next.js backend routes, Prisma, uploads, or environment-variable-backed server features.

Production deploy command after Vercel is authenticated and configured:

```text
corepack pnpm run deploy:prod
```

Required Vercel setup:

- Vercel CLI authenticated on this machine
- Vercel project linked
- Production `DATABASE_URL` configured
- Any optional AI/passcode/storage environment variables configured

Current status: Vercel CLI is authenticated. Production deployment is available after checks pass.

## Nontechnical Browser Verification

Each handoff should include:

1. Vercel production URL to open when deployment is available.
2. What changed in plain language.
3. A short click-through checklist.
4. Checks that passed.
5. Any deployment blockers.
6. Markdown files changed, or confirmation that no Markdown files changed.

Do not ask the reviewer to inspect code or terminal output unless there is no practical alternative.
