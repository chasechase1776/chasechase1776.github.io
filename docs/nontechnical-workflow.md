# Nontechnical Builder Workflow

The person creating and approving this website should not need coding knowledge to judge whether work is correct. Codex should make every change easy to verify in the browser.

## Default Handoff Format

After each meaningful change, Codex should provide:

- Website URL to open.
- Plain-language summary of what changed.
- Browser checklist with 3-7 concrete things to click, enter, or confirm.
- Markdown files changed, or confirmation that no Markdown files changed.
- Any known limitations.
- Confirmation that the change was committed and pushed.
- Vercel deployment result when deployment is available.

## Approved Change Delivery Loop

User-approved implementation changes follow this loop automatically in every project thread:

1. Ask a short clarification question first when the request would require a large amount of coding, broad workflow changes, a database migration with unclear behavior, a new external service, or a decision that affects multiple workspaces.
2. Make the change in the existing app structure.
3. Run focused checks and the production build when practical.
4. Commit the completed change.
5. Push it to GitHub.
6. Deploy it to the Vercel production project.
7. Open and smoke-test the live Vercel URL.
8. Report what changed, the live URL, what was checked, any limitations, and the commit/deployment result.

This is the default delivery behavior unless the user asks for a review, planning-only response, local-only work, or explicitly says not to deploy. A failed check or deployment must be reported rather than hidden.

## Browser-First Verification

Prefer checks like:

- Open this page.
- Click this button.
- Fill in this example value.
- Confirm this warning appears.
- Confirm the saved item appears in the list.
- Confirm the report shows this total.

Avoid requiring the user to:

- Read source code.
- Inspect database tables.
- Use Git commands.
- Read terminal logs.
- Edit configuration files manually.
- Open localhost unless Codex clearly explains that Vercel deployment is blocked.

## Development Expectations

When implementation begins:

- Keep the app runnable with one simple command.
- Deploy user-approved changes to Vercel after the GitHub push when credentials and required environment variables are available.
- Use the Vercel production URL as the normal review target.
- Explain changes in terms of homeschool workflows, not implementation details.
- Use realistic sample data for demos and verification.
- Preserve privacy by keeping real records out of Git.

## Continuous UX Improvement

The app should continuously become easier and calmer to use. During each relevant implementation, evaluate whether the change can:

- Make the next parent action obvious.
- Reduce typing, repeated choices, and unnecessary navigation.
- Use progressive disclosure for optional homeschool metadata.
- Remove redundant labels, panels, warnings, or duplicate actions.
- Keep the daily log fast while preserving review, legal, skill, evidence, and export workflows.
- Improve visual hierarchy, spacing, responsive behavior, accessibility, and confidence during approval.

Do not simplify by removing required data. Keep the activity as the source of truth, keep subject minutes from double-counting actual time, and keep Texas legal context available without overwhelming the quick-log flow.

## Verification Checklists

Each feature should include a simple checklist.

Before large feature work, Codex should confirm:

1. Which workspace the feature belongs in.
2. What the parent should click first.
3. What information must save permanently.
4. Whether generated reports belong in Reports or proof artifacts belong in Portfolio.
5. Whether the change should alter existing records or only affect new records.

Example for activity logging:

1. Open the daily log page.
2. Add an activity title.
3. Enter actual minutes.
4. Add subject allocations.
5. Confirm the allocation total matches the actual minutes.
6. Save the activity.
7. Confirm the activity appears in the daily list.

Example for subject allocation warnings:

1. Open an activity.
2. Enter `60` actual minutes.
3. Allocate only `40` subject minutes.
4. Confirm the app shows a warning.
5. Add the missing `20` minutes.
6. Confirm the warning clears.

## Plain Language Rule

Use parent-facing language in summaries and UI review notes. Technical details are still important, but they belong in code, commits, and docs unless the user asks for them.
