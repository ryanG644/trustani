# TrustAni

*Unotrusta ani? Trust vanhu.* Buyer reviews, fair prices and verified sellers for Zimbabwe.

Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage), deployed on Vercel.

## What's in v0.1

- **Seller directory** ranked by an evidence-weighted score; search by name, area or the **+263 number** that called you.
- **Seller pages** with score breakdown, flags (short loads, price discrimination from mystery shops, public complaints), prices and reviews.
- **Reviews** with category-specific ratings, price paid, and optional proof (payment reference, receipt, photo). Proof is private to moderators; it lifts the review from *Unverified* (weight 0.4) to *Supported* (0.7) or *Verified purchase* (1.0).
- **Fair prices**: 90-day medians and ranges per item, split into what buyers paid, what mystery shoppers were quoted, and what sellers advertise.
- **Moderation** (`/admin`): approve proof, import mystery-shop quotes (CSV paste), add public-complaint links, award the **TrustTrust** badge, remove reviews.
- **Lead import** script for seeding unrated sellers from public listings.
- Categories are data (`categories` table): sand/stone, cement/bricks, phones/laptops, solar.

Scoring, flags and the price index are SQL views in `supabase/migrations/0001_init.sql`.

## Deploy (about 20 minutes)

### 1. Supabase
1. Create a project at supabase.com (region: closest to Zimbabwe, e.g. Frankfurt or Cape Town if offered).
2. **SQL Editor** → run `supabase/migrations/0001_init.sql`, then `0002_categories.sql`.
3. **Authentication → URL Configuration**: set Site URL to `https://trustani.com` (or your Vercel URL for now) and add `https://<your-vercel-domain>/auth/callback` to Redirect URLs.
4. **Project Settings → API**: copy the Project URL, `anon` key and `service_role` key.

### 2. Vercel
1. Import this GitHub repo at vercel.com/new.
2. Add environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL` (e.g. `https://trustani.com`)
   - `NEXT_PUBLIC_PHONE_AUTH` = `0` (set to `1` once SMS is configured, step 4)
3. Deploy. Later, add trustani.com under **Settings → Domains**.

### 3. Seed the Harare leads
```bash
cp .env.example .env.local   # fill in URL + service_role key
npm install
npm run import:leads -- data/leads/harare-aggregates.json
```

### 4. Make yourself a moderator
Sign in on the live site once, then in the Supabase SQL Editor:
```sql
update profiles set role = 'admin' where id = (select id from auth.users where email = 'you@example.com');
```

### 5. Phone sign-in (recommended for Zimbabwe)
Supabase **Authentication → Providers → Phone**: connect Twilio (SMS, or WhatsApp via Twilio's WhatsApp sender). Then set `NEXT_PUBLIC_PHONE_AUTH=1` in Vercel and redeploy.

## Local development
```bash
npm install
cp .env.example .env.local
npm run dev
```

## Mystery-shop quotes
In `/admin`, paste one quote per line:
```
phone,item,qty,unit,area,profile,quote_usd,shopper,notes
+263772844668,river,5,m3,Ruwa,local_shona,60,TM,
+263772844668,river,5,m3,Ruwa,foreign,90,TM,UK number
```
A seller is flagged "Charges some buyers more" once **two rounds** each show a spread above 20% between profiles. Raw quotes are visible to moderators only.

## Not yet built (next phases)
WhatsApp lookup bot, seller claiming and replies, disputes workflow, automated fraud checks (review bursts, rings), email notifications.
