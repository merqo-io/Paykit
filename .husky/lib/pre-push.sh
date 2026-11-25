#!/usr/bin/env bash
set -euo pipefail
bash .claude/verify-harness.sh
pnpm run check && pnpm exec vitest run --reporter=dot
