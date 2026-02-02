import { mutation, query } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import { requireCurrentUser, requireGroupAdmin, requireGroupMember } from "./groupMembers"

const challengeValidator = v.object({
  _id: v.id("challenges"),
  _creationTime: v.number(),
  groupId: v.id("groups"),
  createdBy: v.id("users"),
  title: v.string(),
  description: v.optional(v.string()),
  dueAt: v.number(),
  tempo: v.optional(v.number()),
  difficulty: v.optional(v.string()),
  seed: v.optional(v.string()),
  tuplets: v.optional(v.boolean()),
  leaderboard: v.boolean(),
  createdAt: v.number(),
})

export const create = mutation({
  args: {
    groupId: v.id("groups"),
    title: v.string(),
    description: v.optional(v.string()),
    dueAt: v.number(),
    tempo: v.optional(v.number()),
    difficulty: v.optional(v.string()),
    seed: v.optional(v.string()),
    tuplets: v.optional(v.boolean()),
    leaderboard: v.optional(v.boolean()),
  },
  returns: challengeValidator,
  handler: async (ctx, args) => {
    const { user } = await requireGroupAdmin(ctx, args.groupId)
    const challengeId = await ctx.db.insert("challenges", {
      groupId: args.groupId,
      createdBy: user._id,
      title: args.title,
      description: args.description,
      dueAt: args.dueAt,
      tempo: args.tempo,
      difficulty: args.difficulty,
      seed: args.seed,
      tuplets: args.tuplets,
      leaderboard: args.leaderboard ?? true,
      createdAt: Date.now(),
    })
    const challenge = await ctx.db.get(challengeId)
    if (!challenge) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Challenge creation failed." })
    }
    return challenge
  },
})

export const listForGroup = query({
  args: {
    groupId: v.id("groups"),
    includePast: v.optional(v.boolean()),
  },
  returns: v.array(challengeValidator),
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId)
    const now = Date.now()
    const query = ctx.db
      .query("challenges")
      .withIndex("by_groupId_dueAt", (q) =>
        args.includePast ? q.eq("groupId", args.groupId) : q.eq("groupId", args.groupId).gte("dueAt", now)
      )

    return await query.collect()
  },
})

export const listForUser = query({
  args: {},
  returns: v.array(challengeValidator),
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx)
    
    const memberships = await ctx.db
      .query("groupMembers")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect()
    
    const allChallenges = []
    
    for (const membership of memberships) {
      const groupChallenges = await ctx.db
        .query("challenges")
        .withIndex("by_groupId_dueAt", (q) => q.eq("groupId", membership.groupId))
        .collect()
      allChallenges.push(...groupChallenges)
    }
    
    return allChallenges
  },
})

export const get = query({
  args: {
    challengeId: v.id("challenges"),
  },
  returns: v.union(v.null(), challengeValidator),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId)
    if (!challenge) return null
    await requireGroupMember(ctx, challenge.groupId)
    return challenge
  },
})

export const update = mutation({
  args: {
    challengeId: v.id("challenges"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueAt: v.optional(v.number()),
    tempo: v.optional(v.number()),
    difficulty: v.optional(v.string()),
    tuplets: v.optional(v.boolean()),
    leaderboard: v.optional(v.boolean()),
  },
  returns: challengeValidator,
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId)
    if (!challenge) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Challenge not found." })
    }
    await requireGroupAdmin(ctx, challenge.groupId)

    const updates: Partial<typeof challenge> = {}
    if (args.title !== undefined) updates.title = args.title
    if (args.description !== undefined) updates.description = args.description
    if (args.dueAt !== undefined) updates.dueAt = args.dueAt
    if (args.tempo !== undefined) updates.tempo = args.tempo
    if (args.difficulty !== undefined) updates.difficulty = args.difficulty
    if (args.tuplets !== undefined) updates.tuplets = args.tuplets
    if (args.leaderboard !== undefined) updates.leaderboard = args.leaderboard

    await ctx.db.patch(args.challengeId, updates)
    const updated = await ctx.db.get(args.challengeId)
    if (!updated) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Challenge update failed." })
    }
    return updated
  },
})

export const delete_ = mutation({
  args: {
    challengeId: v.id("challenges"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId)
    if (!challenge) return null
    await requireGroupAdmin(ctx, challenge.groupId)
    await ctx.db.delete(args.challengeId)
    return null
  },
})
