# AGENTS.md

Single source of truth for humans and AI agents (Codex, Cursor, Claude, others) working on **VibeathonNerdearla2026**. If this file and the code disagree, the code wins - fix this file.

## Documentation map (read this instead of the code)

1. `AGENTS.md` (this file) - map, how we work, workflow contract.
2. `.agents/CONTEXT.md` - current stack/architecture snapshot and repo facts.
3. `docs/plans/HANDOFF.md` - current state and how to resume, read first if work is mid-flight.
4. `docs/decisions/` - ADRs: why a non-trivial trade-off was decided the way it was.

## Purpose

**Open source live captions and translation for multi-track conferences.**

## Stack

- package.json (pnpm) - scripts: build,build:domain,dev,format,format:check,lint,test,typecheck

## Commands

- `package.json (pnpm) - scripts: build,build:domain,dev,format,format:check,lint,test,typecheck`

## Workflow contract

These rules describe this repo's CURRENT reality, detected by `project-init`'s `adopt.sh` on 2026-10-10 - not an aspiration. If a row says "nothing (convention only)", that rule is not mechanically enforced today.

| Rule | Documented | Enforced by |
|---|---|---|
| Single branch flow - `main` is both base and release branch | this section | nothing (convention only) |
| Branch names observed: feature/ (14),fix/ (2) | this section | nothing (convention only) |
| PRs merged into `main` via merge commit (14 of last 30 commits are merges) | this section | nothing (convention only) |
| ~100% of the last 29 commit subjects on `main` are Conventional Commits | this section | nothing (convention only) |
| CI: CI (ci.yml): pull_request,push | this section | nothing requires it to pass before merge |
| Repo allows: squash=true, merge-commit=true, rebase=true; delete-branch-on-merge=false | this section | GitHub repo settings (`gh repo view`) |

Changing any rule above: update this table and every enforcement point in the same change, and record it in `docs/decisions/`.

### Recommended (not enforced yet)
- Branch protection on `main` (required status checks, no force-push).


## Documentation rules

- Any decision with a real trade-off (architecture, a hard-to-reverse library/service choice, data model, security trade-off) gets a new ADR under the ADR directory above.
- When work pauses mid-flight, update `docs/plans/HANDOFF.md` before stopping, not after.
- A change that alters architecture, env vars, commands, or deploy updates `AGENTS.md` and `.agents/CONTEXT.md` in the same change.
- Changing any "Workflow contract" rule updates every enforcement point in the same change, per that section above.
