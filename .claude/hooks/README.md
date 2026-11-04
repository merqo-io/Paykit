# hooks

## Purpose

The scripts `.claude/settings.json` wires to Claude Code lifecycle events —
the actual guardrail logic (secret/CI protection, commit hygiene, type
feedback, prompt-injection screening, skill-usage logging) behind the
harness.

## Contents

- `block-no-verify.sh` — PreToolUse(Bash): blocks `--no-verify`/`-n` on
  `git commit`, hook-bypass env vars, direct commits to `main`, force-push
  to a protected branch, `git checkout/restore` on guard-layer files, and
  recursive-force `rm` on source directories; exit 2 blocks.
  Windows drive-letter paths (`C:\…`, `C:/…`) and quoted paths with spaces
  are normalised before the branch is judged, so worktree commits on feature
  branches pass. A strict `&&` chain (`cd <repo> && git commit`) is judged only
  by the directories git actually runs in, so it passes from a `main` checkout
  when the `cd` lands on a feature branch; anything looser keeps the starting
  directory as a candidate.
- `block-no-verify.test.sh` — regression tests for the hook (run `bash .claude/hooks/block-no-verify.test.sh`).
- `post-edit-typecheck.sh` — PostToolUse(Edit|Write), `.ts`/`.tsx` files
  only: runs incremental `tsc --noEmit` and surfaces the last 5 lines;
  feedback-only, never blocks.
- `post-edit-comment-check.sh` — PostToolUse(Edit|Write): flags
  change-narration comments (patterns from `../comment-hygiene-patterns.txt`)
  and oversized comment blocks via `hookSpecificOutput.additionalContext`;
  feedback-only, never blocks.
- `protect-files.sh` — checks reads and writes, normalizes Windows paths, and hard-blocks secret/credential access except blank environment templates. Governance and CI workflow writes require approval; ordinary application code, skills and specs are unrestricted.
- `session-context.sh` — SessionStart(startup|resume|clear|compact):
  re-injects the always-on invariants (`AGENTS.md` is already loaded through
  the `CLAUDE.md` import).
- `skill-usage-log.sh` — PostToolUse(`Skill`): appends a
  `timestamp\tskill-name` line to `.claude/skill-usage.log`; always exits 0.
- `stop-checks.sh` — Stop: runs `pnpm test`; on failure, tails the last 20
  lines to stderr and exits 2; short-circuits to exit 0 when
  `stop_hook_active` is true, avoiding a re-entry loop.
- `subagent-stop.sh` — SubagentStop: if a subagent left uncommitted
  `.ts`/`.tsx` changes, runs `tsc --noEmit` and exits 2 with the last 20
  lines of errors, blocking a handback of broken code.
- `user-prompt-guard.cjs` — reports injection phrases as advisory context and blocks embedded credentials (OWASP LLM02).

## Connectivity

Every script here is inert on its own — `.claude/settings.json` binds a
script to a lifecycle event; that binding is what makes it a "hook" rather
than a loose shell script. `verify-harness.sh` (one level up, in `.claude/`)
treats every script in this folder as part of the integrity-checked
enforcement layer.

## Parent

[.claude](../README.md)
