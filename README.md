# Bennett Homeschool

Homeschool progress tracking and legal record archive app.

This repository now contains the first private Next.js MVP scaffold alongside the planning documents, static mockups, and public GitHub Pages placeholder.

## Project Direction

Build a mobile-friendly website where daily learning activities are the source of truth. Subjects, legal requirements, time allocations, standards/skills, resources, and evidence artifacts are metadata attached to each activity.

Initial legal context: Texas homeschool records, with a data model that can support other states later.

## Setup Status

- Git installed
- GitHub CLI installed
- Node.js LTS installed
- Public GitHub repository connected
- GitHub Pages target website enabled
- Next.js app scaffold started
- Prisma schema and initial PostgreSQL migration added
- Backend routes added for activities, uploads, weekly review drafts, Markdown/PDF exports, and mock AI parsing

## Local App Setup

The real app runs separately from the public static placeholder in `site/`.

1. Install dependencies:

   ```powershell
   pnpm install
   ```

2. Copy `.env.example` to `.env` and keep real secrets out of Git. For the public Vercel app, set `DATABASE_URL` from the Prisma Postgres integration in Vercel.

3. Generate the Prisma client:

   ```powershell
   pnpm prisma:generate
   ```

4. Apply database migrations:

   ```powershell
   pnpm prisma:migrate:deploy
   ```

5. Start the app:

   ```powershell
   pnpm dev
   ```

6. Open:

   ```text
   http://localhost:3000
   ```

Manual activity logging works without AI. If `OPENAI_API_KEY` is missing, the AI parse route returns a mock draft and does not expose any API key to the frontend.

## Project Context

See [docs/project-brief.md](docs/project-brief.md) for the full product brief and data model notes.

## Builder Assumption

The person creating and reviewing this website has no coding experience. Development should be organized so changes can be verified by opening the target website, following short checklists, and confirming visible behavior.

See [docs/nontechnical-workflow.md](docs/nontechnical-workflow.md) for the working process.
