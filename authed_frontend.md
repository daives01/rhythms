# Authed Frontend Plan (After Backend)

Goal: add authenticated UI and group/challenge features after backend is complete, while keeping the unauthenticated play experience unchanged.

## Principles
- Unauthenticated users can play exactly as they do today.
- Authenticated users gain groups, challenges, and history views.
- Keep auth UI minimal and non-disruptive.

## UI/UX Scope
- Add a compact auth entry point (e.g., top-right button): Sign in / Account.
- Once signed in, show:
  - Group switcher (list groups and role).
  - Challenges list for selected group.
  - Play history (personal and group challenge results if leaderboard is enabled).
- No changes to the core play screen for unauth users.

## Pages/Components
- `AuthButton` / `AccountMenu`
  - Sign in / sign out.
  - Shows user name/avatar when signed in.
- `GroupSwitcher`
  - Lists groups and roles.
  - Create group (admin-only) flow.
- `ChallengesPanel`
  - List active and past challenges.
  - Click into challenge detail.
- `ChallengeDetail`
  - Shows parameters (tempo/difficulty/seed) and due date.
  - CTA: Start challenge run (pre-fills game params).
  - Leaderboard view if enabled.
- `HistoryPanel`
  - Personal play history list.
  - Filters for group/challenge.

## Data/Queries (Convex)
- `groups.listForUser`
- `challenges.listForGroup`
- `challenges.get`
- `playHistory.listForUser`
- `playHistory.listForChallenge` (leaderboard only)
- `groups.create`, `challenges.create` (admin-only UI)

## Auth Flow
- Integrate Better Auth client.
- On sign-in, call `auth.getOrCreateUser`.
- Store user session in frontend state; use Convex hooks for queries.

## Edge Cases
- No groups yet: show empty state with create/join guidance.
- No challenges: show empty state.
- Leaderboard disabled: hide leaderboard UI.
- Challenge expired: still allow play, but not for leaderboard/submit.

## Implementation Steps
1. Add auth entry UI and session state.
2. Add groups UI and data fetching.
3. Add challenges list/detail and launch flow.
4. Add history panels and leaderboard views.
5. Polish empty states and permissions.

## Definition of Done
- Unauthenticated play flow unchanged.
- Authenticated users can manage groups and challenges.
- Challenge play flows prefill params and submit results.
- Leaderboards show only when enabled.

## design principles
- it should continue the feel of the existing app, polished, clean, straightforward.
- use the CSS vars we have setup
- follow best practices like progressive disclosure, etc.
- make sure to abstract components where it makes sense.
- make sure, just like the existing app, that it works well on mobile as well as desktop
