import { mutation, query } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import { requireCurrentUser, requireGroupAdmin } from "./groupMembers"

const groupValidator = v.object({
  _id: v.id("groups"),
  _creationTime: v.number(),
  name: v.string(),
  createdBy: v.id("users"),
  createdAt: v.number(),
})

const groupMemberValidator = v.object({
  _id: v.id("groupMembers"),
  _creationTime: v.number(),
  groupId: v.id("groups"),
  userId: v.id("users"),
  role: v.union(v.literal("admin"), v.literal("member")),
  joinedAt: v.number(),
})

const groupInviteValidator = v.object({
  _id: v.id("groupInvites"),
  _creationTime: v.number(),
  groupId: v.id("groups"),
  createdBy: v.id("users"),
  code: v.string(),
  createdAt: v.number(),
  expiresAt: v.optional(v.number()),
  maxUses: v.optional(v.number()),
  useCount: v.number(),
  revokedAt: v.optional(v.number()),
})

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

const generateInviteCode = (size = 8) => {
  const bytes = new Uint8Array(size)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("")
}

export const create = mutation({
  args: {
    name: v.string(),
  },
  returns: v.object({
    group: groupValidator,
    membership: groupMemberValidator,
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    if (!user.premium) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Premium access required to create groups." })
    }
    const now = Date.now()
    const groupId = await ctx.db.insert("groups", {
      name: args.name,
      createdBy: user._id,
      createdAt: now,
    })
    const membershipId = await ctx.db.insert("groupMembers", {
      groupId,
      userId: user._id,
      role: "admin",
      joinedAt: now,
    })

    const group = await ctx.db.get(groupId)
    const membership = await ctx.db.get(membershipId)
    if (!group || !membership) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Group creation failed." })
    }
    return { group, membership }
  },
})

export const createInvite = mutation({
  args: {
    groupId: v.id("groups"),
    expiresAt: v.optional(v.number()),
    maxUses: v.optional(v.number()),
  },
  returns: groupInviteValidator,
  handler: async (ctx, args) => {
    const { user } = await requireGroupAdmin(ctx, args.groupId)
    const now = Date.now()
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const code = generateInviteCode()
      const existing = await ctx.db
        .query("groupInvites")
        .withIndex("by_code", (q) => q.eq("code", code))
        .unique()
      if (existing) continue

      const inviteId = await ctx.db.insert("groupInvites", {
        groupId: args.groupId,
        createdBy: user._id,
        code,
        createdAt: now,
        expiresAt: args.expiresAt,
        maxUses: args.maxUses,
        useCount: 0,
      })
      const invite = await ctx.db.get(inviteId)
      if (!invite) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Invite creation failed." })
      }
      return invite
    }

    throw new ConvexError({ code: "INTERNAL", message: "Unable to generate invite code." })
  },
})

export const redeemInvite = mutation({
  args: {
    code: v.string(),
  },
  returns: v.object({
    invite: groupInviteValidator,
    membership: groupMemberValidator,
  }),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const invite = await ctx.db
      .query("groupInvites")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .unique()
    if (!invite) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invite not found." })
    }
    if (invite.revokedAt) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Invite revoked." })
    }
    if (invite.expiresAt && invite.expiresAt < Date.now()) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Invite expired." })
    }
    if (invite.maxUses !== undefined && invite.useCount >= invite.maxUses) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Invite already used." })
    }

    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) => q.eq("groupId", invite.groupId).eq("userId", user._id))
      .unique()
    if (existing) {
      return { invite, membership: existing }
    }

    await ctx.db.patch(invite._id, { useCount: invite.useCount + 1 })
    const membershipId = await ctx.db.insert("groupMembers", {
      groupId: invite.groupId,
      userId: user._id,
      role: "member",
      joinedAt: Date.now(),
    })
    const membership = await ctx.db.get(membershipId)
    if (!membership) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Membership creation failed." })
    }
    return { invite, membership }
  },
})

export const revokeInvite = mutation({
  args: {
    inviteId: v.id("groupInvites"),
  },
  returns: groupInviteValidator,
  handler: async (ctx, args) => {
    const invite = await ctx.db.get(args.inviteId)
    if (!invite) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invite not found." })
    }
    await requireGroupAdmin(ctx, invite.groupId)
    await ctx.db.patch(args.inviteId, { revokedAt: Date.now() })
    const updated = await ctx.db.get(args.inviteId)
    if (!updated) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Invite update failed." })
    }
    return updated
  },
})

export const listInvites = query({
  args: {
    groupId: v.id("groups"),
  },
  returns: v.array(groupInviteValidator),
  handler: async (ctx, args) => {
    await requireGroupAdmin(ctx, args.groupId)
    return await ctx.db
      .query("groupInvites")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect()
  },
})

export const removeMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { user } = await requireGroupAdmin(ctx, args.groupId)
    if (user._id === args.userId) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Admins cannot remove themselves." })
    }
    const membership = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) => q.eq("groupId", args.groupId).eq("userId", args.userId))
      .unique()
    if (!membership) return null
    await ctx.db.delete(membership._id)
    return null
  },
})

export const listMembers = query({
  args: {
    groupId: v.id("groups"),
  },
  returns: v.array(
    v.object({
      membership: groupMemberValidator,
      user: v.object({
        _id: v.id("users"),
        _creationTime: v.number(),
        authUserId: v.string(),
        email: v.optional(v.string()),
        name: v.optional(v.string()),
        premium: v.optional(v.boolean()),
        createdAt: v.number(),
      }),
    })
  ),
  handler: async (ctx, args) => {
    await requireGroupAdmin(ctx, args.groupId)
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId", (q) => q.eq("groupId", args.groupId))
      .collect()

    const entries = await Promise.all(
      memberships.map(async (membership) => {
        const user = await ctx.db.get(membership.userId)
        return user ? { membership, user } : null
      })
    )

    return entries.filter(
      (entry): entry is { membership: typeof memberships[number]; user: NonNullable<(typeof entries)[number]>["user"] } =>
        entry !== null
    )
  },
})

export const addMember = mutation({
  args: {
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.optional(v.union(v.literal("admin"), v.literal("member"))),
  },
  returns: groupMemberValidator,
  handler: async (ctx, args) => {
    await requireGroupAdmin(ctx, args.groupId)
    const existing = await ctx.db
      .query("groupMembers")
      .withIndex("by_groupId_userId", (q) => q.eq("groupId", args.groupId).eq("userId", args.userId))
      .unique()
    if (existing) return existing

    const membershipId = await ctx.db.insert("groupMembers", {
      groupId: args.groupId,
      userId: args.userId,
      role: args.role ?? "member",
      joinedAt: Date.now(),
    })
    const membership = await ctx.db.get(membershipId)
    if (!membership) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Membership creation failed." })
    }
    return membership
  },
})

export const listForUser = query({
  args: {},
  returns: v.array(
    v.object({
      group: groupValidator,
      membership: groupMemberValidator,
    })
  ),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()

    const groups = await Promise.all(
      memberships.map(async (membership) => {
        const group = await ctx.db.get(membership.groupId)
        return group ? { group, membership } : null
      })
    )

    return groups.filter(
      (entry): entry is { group: NonNullable<(typeof groups)[number]>["group"]; membership: (typeof memberships)[number] } =>
        entry !== null
    )
  },
})
