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
