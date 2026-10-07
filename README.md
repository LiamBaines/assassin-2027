# Assassin 2027

An app for running a real-life game of Assassin. Players sign up, an admin allocates targets as a single ring, and each player sees their current target.

- `web/`: Next.js front end (player view and desktop admin console), deployed on Vercel
- `api/`: Spring Boot API (Java 21, Maven), deployed on Fly.io
- `supabase/`: local Supabase config for auth (email magic link). Postgres is hosted by Supabase.

See [docs/architecture.md](docs/architecture.md) for the full design.

## Prerequisites
JDK 21, Node 22, pnpm, the Supabase CLI, and Docker (running).

## First-time setup
```sh
./scripts/gen-local-signing-key.sh   # local ES256 JWT key for Supabase auth
supabase start                       # local Postgres, Auth, and Mailpit on :54324
```
