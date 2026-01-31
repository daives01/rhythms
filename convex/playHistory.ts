import { mutation, query } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import { requireCurrentUser, requireGroupAdmin, requireGroupMember } from "./groupMembers"

const playHistoryValidator = v.object({
  _id: v.id("playHistory"),
  _creationTime: v.number(),
  userId: v.id("users"),
  groupId: v.optional(v.id("groups")),
  assignmentId: v.optional(v.id("assignments")),
  seed: v.string(),
  tempo: v.number(),
  difficulty: v.string(),
  score: v.number(),
  createdAt: v.number(),
})

export const add = mutation({
  args: {
    seed: v.string(),
    tempo: v.number(),
    difficulty: v.string(),
    score: v.number(),
    groupId: v.optional(v.id("groups")),
    assignmentId: v.optional(v.id("assignments")),
  },
  returns: playHistoryValidator,
  handler: async (ctx, args) => {
    const user = await requireCurrentUser(ctx)

    if (args.groupId) {
      await requireGroupMember(ctx, args.groupId)
    }

    if (args.assignmentId) {
      const assignment = await ctx.db.get(args.assignmentId)
      if (!assignment) {
        throw new ConvexError({ code: "NOT_FOUND", message: "Assignment not found." })
      }
      await requireGroupMember(ctx, assignment.groupId)
      if (assignment.dueAt < Date.now()) {
        throw new ConvexError({ code: "FORBIDDEN", message: "Assignment is past due." })
      }
    }

    const playId = await ctx.db.insert("playHistory", {
      userId: user._id,
      groupId: args.groupId,
      assignmentId: args.assignmentId,
      seed: args.seed,
      tempo: args.tempo,
      difficulty: args.difficulty,
      score: args.score,
      createdAt: Date.now(),
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

export const listForAssignment = query({
  args: {
    assignmentId: v.id("assignments"),
  },
  returns: v.array(playHistoryValidator),
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId)
    if (!assignment) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Assignment not found." })
    }
    await requireGroupAdmin(ctx, assignment.groupId)

    if (!assignment.leaderboard) {
      throw new ConvexError({ code: "FORBIDDEN", message: "Leaderboard disabled." })
    }

    return await ctx.db
      .query("playHistory")
      .withIndex("by_assignmentId_createdAt", (q) => q.eq("assignmentId", args.assignmentId))
      .order("desc")
      .collect()
  },
})
