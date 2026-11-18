# Word Wars

A private, two-player Wordle-style duel. Each player chooses a secret five-letter word; both get six guesses to solve the other's word.

## Stack
- Static HTML/CSS/JavaScript frontend (no build step)
- Supabase Postgres for room state
- Supabase Edge Function for authenticated, server-side game actions
- Vercel for static hosting

## Setup Supabase
1. Create a Supabase project.
2. Open **SQL Editor** and run `supabase/schema.sql`.
3. In **Project Settings → API**, copy the Project URL and anon/publishable key.
4. In the Supabase CLI, link your project and deploy the Edge Function:
   ```sh
   supabase login
   supabase link --project-ref YOUR_PROJECT_REF
   supabase functions deploy duel
   ```
5. The Edge Function uses the built-in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets. Confirm these are available to Edge Functions in Project Settings → Edge Functions → Secrets. Never expose the service role key in frontend code.
6. Set the Project URL and anon/publishable key in `config.js`.

## Deploy on Vercel
1. Import this GitHub repository into Vercel.
2. Framework preset: **Other**. Build command: leave blank. Output directory: `.`.
3. Deploy. Every push to `main` will redeploy automatically.
4. Add the production domain to Supabase **Authentication → URL Configuration → Redirect URLs** if you later add auth (not required by this MVP).

## Game security
- The browser only receives an unguessable per-player room token.
- Room tokens are stored as SHA-256 hashes in Postgres.
- The service-role Edge Function validates every action and computes tile feedback server-side.
- Secret words are never returned to the opponent before the round ends.
- Direct anon/authenticated table access is revoked by the SQL schema.
- Room codes are six characters; rooms expire after seven days.

## Notes
- Guesses are five-letter alphabetic strings. This MVP does not currently enforce a dictionary of valid English words.
- Polling refreshes room state approximately every 1.8 seconds.
- For production hardening, add rate limits, abuse controls, a dictionary validator, scheduled cleanup of expired rooms, and stricter CORS allowlisting to your deployed domain.
