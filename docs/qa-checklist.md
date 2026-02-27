# QA Checklist

## Onboarding (Pro)
- [ ] Sign up for a new pro account.
- [ ] Verify the `/verify-email` page shows the correct email.
- [ ] After verification, confirm you land on `/app/onboarding`.
- [ ] Basics: enter name/business/type, click Continue, confirm it moves to Location.
- [ ] Location: choose "has location" and complete required fields, confirm Continue works.
- [ ] Location: choose "no location" and select mobile yes/no, confirm Continue works.
- [ ] Travel: enter fee + radius, confirm Continue works.
- [ ] Social: enter optional handles, confirm Continue works.
- [ ] Services: add at least one service and save; confirm it appears in list.
- [ ] Services: upload a photo and set as cover (if available).
- [ ] Services: click "Skip for now" and confirm it routes to Payouts.
- [ ] Payouts: confirm Connect and Refresh status buttons work.
- [ ] Payouts: click "Continue to dashboard" and confirm `/app` loads.

## Pricing + Checkout
- [ ] Pricing page loads and shows all plans.
- [ ] Founder availability displays correctly (spots remaining).
- [ ] CTA buttons route to signup or checkout as expected.
- [ ] Logged-in user: clicking Starter/Pro/Founder starts checkout.

## Dashboard Access
- [ ] Logged-in but onboarding incomplete -> redirected to onboarding.
- [ ] Completed onboarding -> `/app` loads successfully.

## General
- [ ] No blank loading screens (all steps show a loader while fetching).
- [ ] No console errors during onboarding and pricing flows.
