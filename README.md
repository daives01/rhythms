# Rhythms

A rhythm game built with React. Test your timing and hit notes to the beat.

## Quick Start

```bash
bun install
bun run dev
```

Then open http://localhost:5173

## Auth (Local vs Prod)

### Local
- Run `bunx convex dev` in another terminal to provision a dev deployment and generate `.env.local`.
- Set `SITE_URL` (and optionally `CLIENT_URL`) in your Convex envs:
  ```bash
  bunx convex env set SITE_URL http://localhost:5173
  bunx convex env set CLIENT_URL http://localhost:5173
  ```
- Do not set `RESEND_API_KEY` locally. Auth emails are logged to the Convex console with a `[DEV EMAIL LINK]` you can open in the browser.

### Production
- Set `SITE_URL` and `CLIENT_URL` to your production URLs via Convex envs.
- Set `RESEND_API_KEY` and optionally `EMAIL_FROM` (defaults to `noreply@rhythms.app`).
- Auth emails are sent via Resend using the Convex Node action in `convex/sendEmail.ts`.

## Build

```bash
bun run build
```

## More Info

Visit [rhythms.daniel-ives.com](https://rhythms.daniel-ives.com) for the live version.
