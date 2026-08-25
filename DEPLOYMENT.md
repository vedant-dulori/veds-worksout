# Deploying RepTrack

RepTrack is a static Vite frontend for Vercel. Supabase provides authentication, Postgres persistence, and private progress-photo storage. Browser storage is used only by Supabase to retain the login session; workout and photo data comes from Supabase.

## 1. Create the Supabase backend

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor**, paste `supabase/schema.sql`, and run it. The script is safe to rerun.
3. In **Authentication > Providers > Email**, enable email/password authentication. Keep email confirmation enabled for production.
4. In **Authentication > URL Configuration**, set the Site URL to the production Vercel URL. Add the local URL and Vercel preview pattern to Redirect URLs:
   - `http://localhost:5173/**`
   - `https://*.vercel.app/**`
5. Copy the Project URL and public anonymous key from **Project Settings > API**.

The SQL enables row-level security on every app table. Each user can access only rows whose `user_id` matches their authenticated identity. The `progress-photos` bucket is private, restricted to each user's folder, and photos are displayed through short-lived signed URLs.

## 2. Configure locally

Create `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
```

Run:

```sh
npm install
npm run dev
```

Do not use a Supabase service-role key in this frontend and never commit `.env.local`.

## 3. Deploy to Vercel

1. Push the project to GitHub and import it at [vercel.com/new](https://vercel.com/new).
2. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` under **Project Settings > Environment Variables** for Production and Preview.
3. Deploy. `vercel.json` configures the Vite build and `dist` output directory.
4. If this is the first deployment, copy its final URL into the Supabase Site URL, then redeploy.

If you installed the official Supabase integration from the Vercel Marketplace, RepTrack also accepts the integration-provided `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` variables. Do not map or expose `SUPABASE_SERVICE_ROLE_KEY`.

The anonymous key is intentionally public. Security depends on keeping row-level security and Storage policies enabled. Database backups and retention follow the selected Supabase plan.

## Operational notes

- Photos are re-encoded to WebP before upload, reducing file size and stripping embedded metadata.
- Uploads are limited to 5 MB by the private Storage bucket.
- A network failure is shown as a cloud-save error; the app does not silently fall back to local data.
- The service worker caches only same-origin static app assets. Supabase API responses and private photos are not added to its cache.
