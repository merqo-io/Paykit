# .claude/skills/supabase-migrate

Run this explicit migration skill for local Supabase schema work. It applies migrations only; DB types are hand-maintained in `src/lib/db-types/` and updated by hand after each migration, and `src/lib/types.ts` is just the barrel. Hosted database changes require the safety gate in SKILL.md and separate authorization.
