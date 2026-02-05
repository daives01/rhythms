import { ConvexError } from "convex/values"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { authComponent } from "./auth"

export const requireAuthUserId = async (ctx: QueryCtx | MutationCtx) => {
  const authUser = await authComponent.safeGetAuthUser(ctx)
  if (!authUser) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "Sign in required." })
  }
  return authUser._id
}

export const getUserByAuthId = async (ctx: QueryCtx | MutationCtx, authUserId: string) => {
  return await ctx.db
    .query("users")
    .withIndex("by_authUserId", (q) => q.eq("authUserId", authUserId))
    .unique()
}

export const requireCurrentUser = async (ctx: QueryCtx | MutationCtx) => {
  const authUserId = await requireAuthUserId(ctx)
  const user = await getUserByAuthId(ctx, authUserId)
  if (!user) {
    throw new ConvexError({ code: "UNAUTHORIZED", message: "User not found." })
  }
  return user
}

export const requireGroupAdmin = async (
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">
) => {
  const user = await requireCurrentUser(ctx)
  const membership = await ctx.db
    .query("groupMembers")
    .withIndex("by_groupId_userId", (q) => q.eq("groupId", groupId).eq("userId", user._id))
    .unique()

  if (!membership || membership.role !== "admin") {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Admin access required.",
    })
  }
  return { user, membership }
}

export const requireGroupMember = async (
  ctx: QueryCtx | MutationCtx,
  groupId: Id<"groups">
) => {
  const user = await requireCurrentUser(ctx)
  const membership = await ctx.db
    .query("groupMembers")
    .withIndex("by_groupId_userId", (q) => q.eq("groupId", groupId).eq("userId", user._id))
    .unique()

  if (!membership) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Group membership required.",
    })
  }
  return { user, membership }
}
