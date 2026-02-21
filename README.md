# -glowdupbooking.github.io
Glow’d Up Booking — coming soon. Booking + reminders + deposits for beauty pros.

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
