# Convex + Better Auth Plan

Goal: add backend features (Convex + Better Auth) without changing the current unauthenticated frontend experience. Track users, groups, challenges, and play history for future features.

## Principles
- Backend is required, but unauthenticated UX should remain unchanged.
- One account per human; users can join multiple groups.
- Groups created by admins; roles stored per group membership.
- Store play history: seed, tempo, difficulty, score, timestamps.
- Challenges are admin-created per group; members can replay until due date.

## Data Model (Convex)
- `users`
  - `authUserId` (string, unique, from Better Auth)
  - `email` (string, optional)
  - `name` (string, optional)
  - `image` (string, optional)
  - `createdAt` (number)
- `groups`
  - `name` (string)
  - `createdBy` (Id<users>)
  - `createdAt` (number)
- `groupMembers`
  - `groupId` (Id<groups>)
  - `userId` (Id<users>)
  - `role` ("admin" | "member")
  - `joinedAt` (number)
- `playHistory`
  - `userId` (Id<users>)
  - `groupId` (Id<groups> | null) // optional if play is outside a group
  - `challengeId` (Id<challenges> | null) // optional link to challenge
  - `seed` (string)
  - `tempo` (number)
  - `difficulty` (string)
  - `score` (number)
  - `createdAt` (number)
- `challenges`
  - `groupId` (Id<groups>)
  - `createdBy` (Id<users>)
  - `title` (string)
  - `description` (string, optional)
  - `dueAt` (number)
  - `tempo` (number, optional)
  - `difficulty` (string, optional)
  - `seed` (string, optional)
  - `leaderboard` (boolean)
  - `createdAt` (number)

Indexes to add:
- `users.by_authUserId`
- `groupMembers.by_groupId_userId` (unique pair)
- `challenges.by_groupId_dueAt`
- `challenges.by_groupId_createdAt`
- `playHistory.by_userId_createdAt`
- `playHistory.by_groupId_createdAt`
- `playHistory.by_challengeId_createdAt`

## Auth + Convex Setup
- Add Convex to the project (Convex CLI + config + `convex/` folder).
- Integrate Better Auth per Convex integration doc:
  - Configure Better Auth instance and Convex auth config.
  - Add `auth.config.ts` and Convex auth setup.
  - Provide required env vars for backend.
- Add `ConvexProvider` in app root.

## Backend Functions
- `auth.getOrCreateUser` (mutation)
  - Input: Better Auth user info.
  - Upsert `users` by `authUserId`.
- `groups.create` (mutation)
  - Create group; add creator to `groupMembers` with role admin.
- `groups.addMember` (mutation)
  - Admin-only; add user to group.
- `groups.listForUser` (query)
  - List groups user belongs to with roles.
- `challenges.create` (mutation)
  - Admin-only; create challenge with params and dueAt.
- `challenges.listForGroup` (query)
  - List active/past challenges for a group.
- `challenges.get` (query)
  - Fetch challenge details.
- `playHistory.add` (mutation)
  - Requires auth; record seed, tempo, difficulty, score, optional groupId and challengeId.
  - If challengeId is provided: validate membership and due date.
- `playHistory.listForUser` (query)
  - List user history (limit + pagination).
- `playHistory.listForChallenge` (query)
  - Admin-only; list scores for a challenge (respect `leaderboard`).

## Frontend Integration (Unauthenticated UX unchanged)
- Backend is always configured, but unauthenticated users can still play as today.
- Use Better Auth for sign-in (later UI).
- On sign-in, call `auth.getOrCreateUser`.
- When a game finishes, call `playHistory.add` if signed in.

## Security/Access Rules
- Enforce auth on all mutations.
- `playHistory.add` only for authenticated users.
- `groups.addMember` requires admin role in the group.
- `challenges.create` requires admin role in the group.
- `playHistory.listForChallenge` allowed only for admins and only when `leaderboard` is true.

## Implementation Steps
1. Add Convex + Better Auth config files and env keys.
2. Define schema and indexes in Convex.
3. Implement backend functions and access checks.
4. Add provider wiring in frontend; keep unauth UX unchanged.
5. Hook game completion to `playHistory.add` when authenticated.

## Definition of Done
- Convex schema and functions exist for users, groups, challenges, play history.
- Better Auth integration works when configured.
- App runs with backend always configured; unauthenticated UX unchanged.
- Play history is recorded for authenticated users.
