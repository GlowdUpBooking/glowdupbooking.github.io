# -glowdupbooking.github.io
Glow’d Up Booking — coming soon. Booking + reminders + deposits for beauty pros.

## Booking Link Routing
The pro dashboard builds booking links as:

`/professional/<pro_id>`

Notes:
- If `VITE_BOOKING_BASE_URL` is set, booking links will use that domain (e.g., `https://glowdupbooking.com/professional/<pro_id>`).
- If not set, booking links stay on the current domain.
- The `/professional/:id` route exists in this app and currently shows a "Booking is almost here" placeholder (useful until the customer web app is live).
- `/book/:code` is kept as a legacy alias and also resolves to the placeholder.

## Analytics (GA4 + PostHog)
Set these in your local env file (`.env.local`) for production analytics:

```bash
VITE_GA4_ID=G-XXXXXXXXXX
VITE_POSTHOG_KEY=phc_xxxxxxxxxxxxxxxxx
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

Notes:
- GA4 and PostHog can run together.
- If either key is missing, that provider is skipped automatically.
- In dev, tracked events are also logged in browser console as `[analytics:event]`.

## Stripe Connect Onboarding
The app now includes a payout onboarding step at:
- `/app/onboarding/payouts`

Required Supabase Edge Function:
- `stripe-connect` at `supabase/functions/stripe-connect/index.ts`

Required env vars for this function:
- `STRIPE_SECRET_KEY`
- `SITE_URL`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ALLOWED_ORIGINS` (recommended)

## Stripe Subscription Sync (Webhook)
To keep plan status in sync automatically (upgrade, cancel, renew), deploy and configure:

- Supabase Edge Function: `stripe-webhook` at `supabase/functions/stripe-webhook/index.ts`
- Stripe events consumed:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

### 1) Deploy function
```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase functions deploy stripe-webhook --no-verify-jwt
```

### 2) Set webhook secret in Supabase
Create endpoint in Stripe Dashboard:
- Developers -> Webhooks -> Add endpoint
- URL: `https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/stripe-webhook`
- Select the 4 events listed above
- Copy the endpoint signing secret (`whsec_...`)

Then set secret in Supabase:
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

### 3) Verify end-to-end
1. Start from a Free account in app.
2. Upgrade from `/pricing`.
3. Complete checkout.
4. Confirm `pro_subscriptions` row updates (`status`, `plan`, `interval`, `stripe_customer_id`, `stripe_subscription_id`).

## Availability Cloud Sync (Supabase)
To sync pro availability across devices, run this SQL once in Supabase SQL Editor:

- `supabase/sql/2026-02-21_pro_availability.sql`

After this table is created, `/app/settings` will save schedule data to cloud (`pro_availability`) instead of local-only fallback.
