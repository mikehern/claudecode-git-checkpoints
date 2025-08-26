## Summary

Explain what this PR changes and why.

## Linked issues

Fixes #<id> <!-- or --> Closes #<id>

## Screenshots / Demos

If UI/UX or output changes, add before/after.

## Test plan

How did you test this? Include commands, platforms, and any added tests.

## Checklist

- [ ] Includes a minimal repro or unit test where feasible
- [ ] Updates docs/CLI help if behavior changes
- [ ] Adds changelog entry or labels (feature/fix)
- [ ] Follows style/lint rules
      CONTRIBUTING.md

# Contributing to claudecode-git-checkpoints

Thanks for your interest in improving the project! This guide focuses on reporting bugs and requesting features
so we can triage quickly and ship fixes faster.

## How to report a bug

1. Update to the latest release and try to reproduce.
2. Collect diagnostics:
   - `claudecode-git-checkpoints --version`
   - OS/shell/arch and `git --version`
   - Re-run with `--debug` and capture relevant logs (redact secrets).
3. Open a bug using the issue form:
   - Open: https://github.com/mikehern/claudecode-git-checkpoints/issues/new?template=bug_report.yml
   - Include a minimal reproduction (tiny repo or script) if possible.
4. Expectation: we triage within 2 business days and aim to reproduce within 5.

Tip: A minimal repro (10–30 lines) massively speeds up fixes. If you can’t share a repo, describe exact
commands and outputs.

## How to request a feature

1. Check existing issues and Discussions (Ideas).
2. Open a request using the feature form:
   - Open: https://github.com/mikehern/claudecode-git-checkpoints/issues/new?template=feature_request.yml
3. Focus on the user problem; propose a solution and alternatives. Upvotes (👍) help with prioritization.

## Labels and triage

- Core types: `bug`, `feature`, `enhancement`, `question`, `docs`
- Status: `status:needs-triage`, `status:in-progress`, `status:blocked`
- Priority: `priority:high`, `priority:medium`, `priority:low`
- Area (optional): `area:cli`, `area:git`, `area:perf`, `area:docs`, etc.

We use milestones for “Next Patch”, “Next Minor”, and “Backlog”.

## Pull requests

- Link issues with “Fixes #<id>”.
- Add tests or a minimal repro where feasible.
- Update docs/CLI help and changelog if behavior changes.
- Keep changes small and focused. We’re happy to discuss larger designs in an issue/Discussion first.

## Local development

- Use the latest LTS toolchain(s).
- Run lint/tests locally before opening a PR if available.
