# Nontechnical Builder Workflow

The person creating and approving this website should not need coding knowledge to judge whether work is correct. Codex should make every change easy to verify in the browser.

## Default Handoff Format

After each meaningful change, Codex should provide:

- Website URL to open.
- Plain-language summary of what changed.
- Browser checklist with 3-7 concrete things to click, enter, or confirm.
- Any known limitations.
- Confirmation that the change was committed and pushed.

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

## Development Expectations

When implementation begins:

- Keep the app runnable with one simple command.
- Keep local development URLs stable when possible.
- Start the dev server before asking the user to review UI changes.
- Explain changes in terms of homeschool workflows, not implementation details.
- Use realistic sample data for demos and verification.
- Preserve privacy by keeping real records out of Git.

## Verification Checklists

Each feature should include a simple checklist.

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
