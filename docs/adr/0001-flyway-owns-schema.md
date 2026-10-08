# ADR 0001: Flyway in the API owns the database schema

**Status:** accepted

## Decision
All game tables are created by Flyway migrations in `api/src/main/resources/db/migration`. The `supabase/` directory holds auth configuration only. It never has a `migrations/` folder.

## Why
- Testcontainers runs exactly the migrations that production runs, without the Supabase CLI.
- The schema ships with the code that depends on it. Hibernate `ddl-auto=validate` fails startup if they drift.
- The front end never reads or writes game tables, so Supabase has no reason to own them.

## Consequences
- Game tables live in the `game` schema. PostgREST doesn't expose it, `anon` and `authenticated` have all grants revoked, and RLS is on with no policies.
- `supabase db reset` wipes the `game` schema locally. Restart the API to re-apply migrations.
