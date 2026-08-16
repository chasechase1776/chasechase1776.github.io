# Ontoly Backend Analysis Prompt

Use this prompt when Ontoly finds backend issues in this project:

Review the Ontoly Software Graph diagnostics and backend risk report. Treat generated Next.js folders (`.next`, `.next-*`) and Ontoly output folders as analysis noise, not application code. Keep the backend graph focused on source files such as `app/api/**`, `lib/**`, `prisma/**`, middleware, configuration, and scripts. If diagnostics remain after a source-only scan, prioritize fixes in backend route handlers, storage helpers, snapshot generation, PDF generation, and Prisma access. Avoid broad refactors unless the graph identifies a real source-code dependency cycle or route-level failure.

## Current Ontoly Findings

- Ontoly doctor reported the repository was ready.
- Ontoly coverage reported 100% completeness, consistency, and trustworthiness.
- Ontoly build found 9 warnings, all from generated `.next*` folders except one CSS import warning in `app/layout.tsx`.
- Ontoly backend risk identified hotspots in snapshot, storage, and PDF modules, but did not identify a route diagnostic.

## Fix Applied

`pnpm ontoly:build` now runs a source-only Ontoly scan through `scripts/ontoly-clean-build.mjs`. The script copies tracked and unignored source files into a temporary clean folder, omits generated Next/Ontoly output folders, and writes the graph back to `.ontoly`.
