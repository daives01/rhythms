import { query, mutation } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import type { Doc } from "./_generated/dataModel"
import { authComponent } from "./auth"

const userValidator = v.object({
  _id: v.id("users"),
  _creationTime: v.number(),
  authUserId: v.string(),
  email: v.optional(v.string()),
  name: v.optional(v.string()),
  premium: v.optional(v.boolean()),
  createdAt: v.number(),
})

export const getAuthUser = query({
  args: {},
  returns: v.union(v.null(), userValidator),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return null

    return await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
      .unique()
  },
})

export const getOrCreateUser = mutation({
  args: {},
  returns: userValidator,
  handler: async (ctx) => {
    const authUser = await authComponent.getAuthUser(ctx)
    if (!authUser) {
      throw new ConvexError({ code: "UNAUTHORIZED", message: "Sign in required." })
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUser._id))
      .unique()
    if (existing) {
      const updates: Partial<UserDoc> = {}
      if (existing.email !== authUser.email) updates.email = authUser.email ?? undefined
      if (existing.name !== authUser.name) updates.name = authUser.name ?? undefined
      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates)
        const updated = await ctx.db.get(existing._id)
        if (!updated) {
          throw new ConvexError({ code: "NOT_FOUND", message: "User update failed." })
        }
        return updated
      }
      return existing
    }

    const now = Date.now()
    const userId = await ctx.db.insert("users", {
      authUserId: authUser._id,
      email: authUser.email ?? undefined,
      name: authUser.name ?? undefined,
      premium: false,
      createdAt: now,
    })

    const user = await ctx.db.get(userId)
    if (!user) {
      throw new ConvexError({ code: "NOT_FOUND", message: "User creation failed." })
    }
    return user
  },
})

export const getAuthSession = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      userId: v.id("users"),
      authUserId: v.string(),
      email: v.optional(v.string()),
      name: v.optional(v.string()),
      premium: v.optional(v.boolean()),
    })
  ),
  handler: async (ctx) => {
    const authUser = await authComponent.safeGetAuthUser(ctx)
    if (!authUser) return null

    const authUserId = authUser._id
    const user = await ctx.db
      .query("users")
      .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
      .unique()

    if (!user) return null

    return {
      userId: user._id,
      authUserId,
      email: user.email,
      name: user.name,
      premium: user.premium,
    }
  },
})

export type UserDoc = Doc<"users">
