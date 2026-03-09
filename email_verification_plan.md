# Email Verification Improvement Plan

## Context
- Better Auth sends verification emails, but the app does not currently gate any behavior on verification status.
- This makes verification feel optional and provides limited security/anti-abuse value.

## Goals
- Make email verification meaningful while keeping sign-up friction low.
- Define which actions require a verified email.
- Provide clear UI feedback and recovery paths.

## Current Flow Summary
- Better Auth sends verification email on sign-up.
- Convex user creation does not record verification status.
- No queries/mutations enforce verification.

## Proposed Policy
- Allow sign-in and onboarding immediately.
- Require verified email for group-related actions:
  - Create group.
  - Create invite links.
  - Redeem invites.
- Allow non-verified users to browse personal pages but show a persistent banner nudging verification.

## Implementation Steps
1. Persist verification status in Convex.
   - Add `emailVerified: v.optional(v.boolean())` to `users` table.
   - Update `getOrCreateUser` to map verification status from Better Auth session/user data.
2. Add a server-side guard.
   - Create `requireVerifiedEmail(ctx)` helper in `convex/groupMembers.ts` or a new `convex/authGuards.ts`.
   - Check the current user doc and throw `FORBIDDEN` with a clear message.
3. Gate sensitive mutations.
   - Apply guard to `groups.create`, `groups.createInvite`, `groups.redeemInvite`, `challenges.create` (if desired).
4. Add UI feedback.
   - Surface a banner/toast for unverified users with a “Resend verification email” action.
   - Disable gated buttons with a tooltip explaining why.
5. Add resend verification action.
   - Add a Convex action calling Better Auth to resend verification email.
   - Wire to UI.
6. Backfill existing users.
   - Add a one-time admin mutation or migration script to set `emailVerified` for current users based on Better Auth data.

## UX Copy Draft
- Banner: “Verify your email to create and join groups. Check your inbox for the verification link.”
- Button: “Resend verification email”.

## Open Questions
- Should play history, challenges, or other features be gated for unverified users?
- Do we want to auto-delete unverified accounts after N days?
- Should verification be required before premium upgrade flow?
