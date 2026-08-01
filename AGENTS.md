# Codex Working Notes

## Current Mode

The project is in environment/repository setup mode. Do not implement application features until the user explicitly asks to start coding.

## Product Principle

The activity is the source of truth. Subjects, legal requirements, time, standards/skills, and evidence are metadata attached to each learning activity.

## Technical Direction

Preferred stack when implementation begins:

- Next.js / React
- TypeScript
- Prisma ORM
- SQLite for local MVP unless the user chooses Postgres
- Local file storage for MVP evidence uploads, with optional S3-compatible storage later
- PDF generation for annual, portfolio, and compliance exports

## Version Control Expectations

After the GitHub remote is connected, commit and push completed changes at each logical stopping point. Keep commits focused and descriptive.

## Normal Operating Procedure

For any change that the user requests or approves in any project thread:

1. Ask a concise clarification question before starting commands or edits that would create a large amount of coding, broad architectural change, data migration risk, or unclear user-facing behavior.
2. Implement the smallest complete change that meets the request.
3. Run the relevant build, type, lint, and browser checks.
4. Commit the verified change with a focused message.
5. Push the commit to the connected GitHub repository.
6. Deploy the same change to the Vercel production project.
7. Smoke-test the live Vercel URL and report the URL, checks, limitations, and deployment result.

Do not claim completion until the change is committed, pushed, deployed, and checked live. If a build, push, deployment, or smoke test is blocked, report the blocker clearly and continue with safe diagnostics or fixes when possible. Do not deploy when the user explicitly requests analysis only, asks to pause, or withholds required approval or secrets.

Every implementation should also improve the product experience where relevant: maximize intuitiveness, keep the interface sleek and calm, remove redundant controls or copy, preserve useful information hierarchy, and reduce friction in the parent’s daily workflow. These refinements must preserve the activity-first model, progressive disclosure, legal context, accessibility, and data integrity.

## User Experience for the Builder

Assume the person reviewing the work has no coding experience and will validate changes by checking the running website.

Every implementation handoff should include:

- The Vercel production URL to open when deployment is available.
- A short list of what changed in plain language.
- A short browser checklist for verifying the change.
- A note naming any Markdown (`.md`) files changed, or saying no Markdown files changed.
- Any known limitations or unfinished pieces.
- A note confirming tests/build checks that were run.

Prefer visible, clickable UI over hidden configuration. Avoid asking the user to inspect code, JSON, databases, logs, terminal output, or localhost unless there is no practical alternative.

## Implementation Checklist

Before changing the app:

- Confirm whether the request is small and specific enough to implement directly.
- Ask for clarification first when the request could require a large build, multiple workspace changes, irreversible data changes, a new external service, or a new product workflow.
- Keep Portfolio focused on proof-of-learning artifacts and book-list records; keep generated PDFs and compliance exports in Reports.
- Preserve existing saved user data when adding database fields or running migrations.
- Use the Vercel production URL as the normal verification target after deployment.
- Leave Markdown documentation notes when a workflow rule changes.

## Constraints

- Preserve legal/compliance context in project documentation.
- Avoid public-school-style scheduling assumptions in the core model.
- Do not double-count activity time across subjects.
- Treat subject tags, legal tags, standards/skills, evidence artifacts, and time allocations as distinct concepts.
