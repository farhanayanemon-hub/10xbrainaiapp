# WeaveAI

An AI platform built with SvelteKit that provides access to 65+ AI models for text generation, image generation, video generation, and multimodal chat.

## Tech Stack

- **Framework**: SvelteKit 2 with Svelte 5
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL via Drizzle ORM
- **Auth**: Auth.js (SvelteKit) with email/password + OAuth
- **Payments**: Stripe + Opaybd (BDT support)
- **Storage**: Local filesystem (with optional Cloudflare R2)
- **AI**: OpenRouter (text), Replicate (images/video), ElevenLabs (audio)
- **i18n**: Paraglide JS (en, de, es, pt)

## Project Structure

```
src/
  app.html           - Root HTML template
  auth.ts            - Auth.js configuration
  hooks.server.ts    - SvelteKit server hooks
  lib/
    server/db/
      schema.ts      - Drizzle ORM schema
      index.ts       - Database connection
    components/      - Reusable UI components
    stores/          - Svelte state stores
    utils/           - Utility functions
  routes/            - SvelteKit file-based routing
    +layout.svelte   - Root layout
    +page.svelte     - Landing page
    admin/           - Admin dashboard routes
    api/             - API endpoints
```

## Development Setup

- Runs on port **5000** (configured in vite.config.ts)
- Dev server: `npm run dev`
- DB migrations: `npx drizzle-kit push --force`

## Required Environment Variables

- `DATABASE_URL` - PostgreSQL connection string (auto-set by Replit)
- `AUTH_SECRET` - Auth.js secret key
- `PUBLIC_ORIGIN` - Public URL of the app

## Optional Environment Variables (configurable via Admin Dashboard)

- `OPENROUTER_API_KEY` - For text AI models
- `REPLICATE_API_TOKEN` - For image/video models
- `STRIPE_SECRET_KEY` / `PUBLIC_STRIPE_PUBLISHABLE_KEY` - Payments
- `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` - Google OAuth
- SMTP settings for email
- Cloudflare R2 for cloud storage
- `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` - Bot protection

## Admin Features

- **App Update**: Admin panel includes an "App Update" page at `/admin/settings/app-update` where admins can upload a zip file to update app code while preserving database, env vars, uploads, and settings. The endpoint includes path traversal protection, symlink rejection, and rollback on npm install failure.
- **Landing Page Settings**: Admin panel at `/admin/settings/landing` allows editing all landing page text content (hero, features, pricing section text, CTA, FAQs, footer). Content is stored in the `admin_settings` table under category `'landing'`. The public landing page (`+page.svelte`) loads content from DB with hardcoded fallback defaults. Pricing plans on the landing page are loaded dynamically from the `pricingPlans` DB table via `getPricingPlans('month')`.

## Payment Integration

- **Stripe**: Default payment provider, supports USD
- **Opaybd**: Bangladesh payment gateway supporting BDT (bKash, Nagad, etc.)
- Active provider is set via Admin > Settings > Payment Methods (`activePaymentProvider` setting)
- Currency display is dynamic: shows ৳ (BDT) when Opaybd is active, $ (USD) for Stripe
- `priceAmountBdt` column on `pricing_plan` table stores BDT prices in paisa
- Opaybd subscriptions require manual renewal (tracked via `renewalRequired` on subscription table)
- `RenewalBanner` component shows renewal prompts in the main app layout
- Key files: `src/lib/server/opaybd.ts`, `src/lib/server/payment-router.ts`, `src/routes/api/opaybd/`

## Backups

- `opaybd-backup/` - Archived Opaybd payment integration files for reference
- `opaybd-backup.tar.gz` - Compressed archive of the same

## Deployment

Uses `@sveltejs/adapter-node`. Build with `npm run build`, run with `node build/index.js`.
