import { describe, expect, test } from "bun:test"
import { buildAppUserSyncChange } from "./auth-user-sync"

describe("buildAppUserSyncChange", () => {
  test("creates an insert when no app user exists", () => {
    const change = buildAppUserSyncChange(
      null,
      { id: "auth_123", email: "alice@example.com", name: "Alice" },
      1234
    )

    expect(change).toEqual({
      kind: "insert",
      value: {
        authUserId: "auth_123",
        email: "alice@example.com",
        name: "Alice",
        premium: false,
        createdAt: 1234,
      },
    })
  })

  test("returns no change when the app user is already in sync", () => {
    const change = buildAppUserSyncChange(
      { _id: "user_1", email: "alice@example.com", name: "Alice" },
      { id: "auth_123", email: "alice@example.com", name: "Alice" }
    )

    expect(change).toEqual({ kind: "none" })
  })

  test("builds a patch when synced fields change", () => {
    const change = buildAppUserSyncChange(
      { _id: "user_1", email: "alice@example.com", name: "Alice" },
      { id: "auth_123", email: "new@example.com", name: "Alice B" }
    )

    expect(change).toEqual({
      kind: "patch",
      userId: "user_1",
      value: {
        email: "new@example.com",
        name: "Alice B",
      },
    })
  })

  test("clears fields when Better Auth no longer has values", () => {
    const change = buildAppUserSyncChange(
      { _id: "user_1", email: "alice@example.com", name: "Alice" },
      { id: "auth_123", email: null, name: null }
    )

    expect(change).toEqual({
      kind: "patch",
      userId: "user_1",
      value: {
        email: undefined,
        name: undefined,
      },
    })
  })
})
