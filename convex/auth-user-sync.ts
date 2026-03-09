export interface AppUserSyncRecord {
  _id: string
  email?: string
  name?: string
}

export interface AuthUserSyncSource {
  id: string
  email?: string | null
  name?: string | null
}

type AppUserInsert = {
  authUserId: string
  email?: string
  name?: string
  premium: false
  createdAt: number
}

type AppUserPatch = {
  email?: string
  name?: string
}

export type AppUserSyncChange =
  | { kind: "insert"; value: AppUserInsert }
  | { kind: "patch"; userId: string; value: AppUserPatch }
  | { kind: "none" }

export function buildAppUserSyncChange(
  existing: AppUserSyncRecord | null,
  authUser: AuthUserSyncSource,
  now = Date.now()
): AppUserSyncChange {
  const nextEmail = authUser.email ?? undefined
  const nextName = authUser.name ?? undefined

  if (!existing) {
    return {
      kind: "insert",
      value: {
        authUserId: authUser.id,
        email: nextEmail,
        name: nextName,
        premium: false,
        createdAt: now,
      },
    }
  }

  const updates: AppUserPatch = {}
  if (existing.email !== nextEmail) updates.email = nextEmail
  if (existing.name !== nextName) updates.name = nextName

  if (Object.keys(updates).length === 0) {
    return { kind: "none" }
  }

  return {
    kind: "patch",
    userId: existing._id,
    value: updates,
  }
}
