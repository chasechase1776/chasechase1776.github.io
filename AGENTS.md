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

## User Experience for the Builder

Assume the person reviewing the work has no coding experience and will validate changes by checking the running website.

Every implementation handoff should include:

- The local URL to open.
- A short list of what changed in plain language.
- A short browser checklist for verifying the change.
- Any known limitations or unfinished pieces.
- A note confirming tests/build checks that were run.

Prefer visible, clickable UI over hidden configuration. Avoid asking the user to inspect code, JSON, databases, logs, or terminal output unless there is no practical alternative.

## Constraints

- Preserve legal/compliance context in project documentation.
- Avoid public-school-style scheduling assumptions in the core model.
- Do not double-count activity time across subjects.
- Treat subject tags, legal tags, standards/skills, evidence artifacts, and time allocations as distinct concepts.
