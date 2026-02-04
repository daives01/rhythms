import { mutation, query } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { ConvexError, v } from "convex/values"
import { paginationOptsValidator, paginationResultValidator } from "convex/server"
import { requireCurrentUser, requireGroupAdmin, requireGroupMember } from "./groupMembers"

const playHistoryValidator = v.object({
  _id: v.id("playHistory"),
  _creationTime: v.number(),
  userId: v.id("users"),
  groupId: v.optional(v.id("groups")),
  challengeId: v.optional(v.id("challenges")),
  seed: v.string(),
  tempo: v.number(),
  difficulty: v.string(),
  tuplets: v.optional(v.boolean()),
  score: v.number(),
  createdAt: v.number(),
  userName: v.optional(v.string()),
  userEmail: v.optional(v.string()),
})

const userPreviewValidator = v.object({
  _id: v.id("users"),
  name: v.optional(v.string()),
  email: v.optional(v.string()),
})

export const add = mutation({
  args: {
    seed: v.string(),
    tempo: v.number(),
    difficulty: v.string(),
    tuplets: v.optional(v.boolean()),
    score: v.number(),
    groupId: v.optional(v.id("groups")),
    challengeId: v.optional(v.id("challenges")),
  },
  returns: playHistoryValidator,
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const now = Date.now()

    if (args.groupId) {
      await requireGroupMember(ctx, args.groupId)
    }

    if (args.challengeId) {
      const challenge = await ctx.db.get(args.challengeId)
      if (!challenge) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Challenge not found." })
      }
      await requireGroupMember(ctx, challenge.groupId)
      if (args.groupId && args.groupId !== challenge.groupId) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Challenge does not belong to group." })
      }
      if (challenge.dueAt < Date.now()) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Challenge is past due." })
      }
    }

    const playId = await ctx.db.insert("playHistory", {
      userId: user._id,
      groupId: args.groupId,
      challengeId: args.challengeId,
      seed: args.seed,
      tempo: args.tempo,
      difficulty: args.difficulty,
      tuplets: args.tuplets,
      score: args.score,
      createdAt: now,
      userName: user.name,
      userEmail: user.email,
    })

    const record = await ctx.db.get(playId)
    if (!record) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Play history creation failed." })
    }
    return record
  },
})

export const listForUser = query({
  args: {
    limit: v.optional(v.number()),
  },
  returns: v.array(playHistoryValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const limit = Math.min(args.limit ?? 20, 100)

    return await ctx.db
      .query("playHistory")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(limit)
  },
})

export const listForUserPaginated = query({
  args: {
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(playHistoryValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    return await ctx.db
      .query("playHistory")
      .withIndex("by_userId_createdAt", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts)
  },
})

export const listForChallenge = query({
  args: {
    challengeId: v.id("challenges"),
    limit: v.optional(v.number()),
  },
  returns: v.array(
    v.object({
      play: playHistoryValidator,
      user: userPreviewValidator,
    })
  ),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId)
    if (!challenge) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Challenge not found." })
    }
    await requireGroupMember(ctx, challenge.groupId)

    const limit = Math.min(args.limit ?? 200, 500)

    const plays = await ctx.db
      .query("playHistory")
      .withIndex("by_challengeId_createdAt", (q) => q.eq("challengeId", args.challengeId))
      .order("desc")
      .take(limit)

    const bestPlaysByUser = new Map<Id<"users">, (typeof plays)[number]>()
    for (const play of plays) {
      const existing = bestPlaysByUser.get(play.userId)
      if (!existing) {
        bestPlaysByUser.set(play.userId, play)
        continue
      }
      if (play.score > existing.score || (play.score === existing.score && play.createdAt > existing.createdAt)) {
        bestPlaysByUser.set(play.userId, play)
      }
    }

    const userIds = Array.from(bestPlaysByUser.keys())
    const users = await Promise.all(userIds.map((userId) => ctx.db.get(userId)))
    const usersById = new Map(
      users
        .filter((user): user is NonNullable<typeof user> => Boolean(user))
        .map((user) => [user._id, user])
    )

    return Array.from(bestPlaysByUser.values())
      .map((play) => {
        const user = usersById.get(play.userId)
        return {
          play,
          user: {
            _id: play.userId,
            name: user?.name ?? play.userName,
            email: user?.email ?? play.userEmail,
          },
        }
      })
      .sort((a, b) => {
        if (b.play.score !== a.play.score) return b.play.score - a.play.score
        return b.play.createdAt - a.play.createdAt
      })
  },
})

export const listUserCompletionsForChallenge = query({
  args: {
    challengeId: v.id("challenges"),
  },
  returns: v.array(
    v.object({
      play: playHistoryValidator,
      user: userPreviewValidator,
    })
  ),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    const challenge = await ctx.db.get(args.challengeId)
    if (!challenge) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Challenge not found." })
    }
    await requireGroupMember(ctx, challenge.groupId)

    const plays = await ctx.db
      .query("playHistory")
      .withIndex("by_challengeId_userId_createdAt", (q) =>
        q.eq("challengeId", args.challengeId).eq("userId", user._id)
      )
      .order("desc")
      .collect()

    return plays.map((play) => ({
      play,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    }))
  },
})

export const listForGroupByUser = query({
  args: {
    groupId: v.id("groups"),
    limit: v.optional(v.number()),
  },
  returns: v.array(playHistoryValidator),
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)
    await requireGroupMember(ctx, args.groupId)
    const limit = Math.min(args.limit ?? 200, 500)

    return await ctx.db
      .query("playHistory")
      .withIndex("by_groupId_userId_createdAt", (q) =>
        q.eq("groupId", args.groupId).eq("userId", user._id)
      )
      .order("desc")
      .take(limit)
  },
})

export const listCompletionsForChallenge = query({
  args: {
    challengeId: v.id("challenges"),
  },
  returns: v.array(
    v.object({
      play: playHistoryValidator,
      user: userPreviewValidator,
    })
  ),
  handler: async (ctx, args) => {
    const challenge = await ctx.db.get(args.challengeId)
    if (!challenge) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Challenge not found." })
    }
    await requireGroupAdmin(ctx, challenge.groupId)

    const plays = await ctx.db
      .query("playHistory")
      .withIndex("by_challengeId_createdAt", (q) => q.eq("challengeId", args.challengeId))
      .order("desc")
      .collect()

    return plays.map((play) => ({
      play,
      user: {
        _id: play.userId,
        name: play.userName,
        email: play.userEmail,
      },
    }))
  },
})
