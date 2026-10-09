# Deploy runbook

One-off setup state and prod configuration. Not needed for day-to-day coding.

## URLs
- API (Fly.io): https://assassin-2027-api.fly.dev (app `assassin-2027-api`, region `fra`, config in `api/fly.toml`)
- Web (Vercel): https://assassin-2027.vercel.app

## API (Fly.io)
- Secrets: datasource URL/user/password, `SUPABASE_URL`, `APP_ADMIN_EMAILS`. List with `fly secrets list`.
- Prod DB goes through the Supabase session pooler (`aws-1-eu-central-1`). Get the pooler host and username from the Supabase dashboard (Connect); don't commit the username, it contains the project ref.
- CI deploys on push to main after `verify` passes, using the `FLY_API_TOKEN` repo secret (a one-year deploy token named `github-actions`; mint a new one before it expires).

## Web (Vercel)
- Project `assassin-2027`: Root Directory `web`, Node 22.
- Env vars are set for Production and Preview (previews use the prod API and Supabase).
- Vercel builds `main` from GitHub. Manual deploy from the repo root: `npx vercel deploy --prod`.

## Supabase (prod dashboard)
- Email goes out through Gmail SMTP with an app password (`smtp.gmail.com:465`, about 500 emails a day). Supabase locks template editing until custom SMTP is configured.
- **Email OTP Length = 6**, to match local `otp_length = 6` and the web's 6-digit check. New hosted projects default to 8.
- **Confirm email off**, to match local `enable_confirmations = false`. Otherwise new users get the "Confirm signup" email instead of the token_hash magic link.
- The magic-link template must match `supabase/templates/magic_link.html` (`redirect_to={{ .RedirectTo }}`), and Redirect URLs must allow `https://assassin-2027.vercel.app/**`.
- Prod JWKS serves ES256 P-256. The publishable key gets PGRST002 (503) on PostgREST because the Data API is off; that is expected.
