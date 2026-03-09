# Tech Debt

## Unsafe `as` casts for Convex IDs
Several places cast raw URL params directly to typed IDs without validation:
- `GroupDetailPage.tsx:352` - `id as Id<"groups">`
- `GroupDetailPage.tsx:354` - `challengeParam as Id<"challenges">`
- `PlayPage.tsx:201-202` - `challengeData.groupId as Id<"groups">`

Backend handles gracefully (returns null / throws), so it's safe, just untidy.

## Query result type casts
`GroupsPage.tsx:39-40` and `GroupDetailPage.tsx:359-367` cast `useQuery` results with `as` instead of letting types flow from the API. If the backend return type changes, these won't flag at compile time.

## Unsafe cast in auth email sending
`convex/auth.ts:61-63` casts `ctx` to call `runAction` with a string path `"sendEmail:sendEmail"`. Bypasses Convex's type system — no compile-time check if the function is renamed or args change.

## Variable shadowing
`challenges.ts:66` - `const query = ctx.db.query(...)` shadows the `query` import from `"_generated/server"`.

## Unbounded `.collect()` calls
A few queries collect without limits:
- `groups.ts:429` - all challenges for a group
- `challenges.ts:87-96` - `listForUser` fetches all challenges across all user groups
- `groupMembers.ts` `listMembers` collects all members

Fine at current scale but worth adding `.take()` limits before groups get large.

## Denormalized user data goes stale
`groupMembers` and `playHistory` store `userName`/`userEmail` snapshots. `listMembers` gracefully falls back to live user data, but there's no mechanism to backfill denormalized fields when a user updates their profile.

## Boilerplate-heavy page layouts
Every page repeats the same wrapper div with `min-h-dvh flex flex-col select-none` and identical touch-action styles, plus nearly identical unauthenticated "sign in" screens. A shared layout component would clean this up.

## GroupDetailPage size (1172 lines)
Handles challenge form, challenge hub/mixer, group overview, editing modal, leaderboard/completions modals, and settings sync. Could be broken into smaller components.

## Default `convex/README.md`
Boilerplate Convex readme committed, not project-specific.
