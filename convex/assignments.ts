import { mutation, query } from "./_generated/server"
import { ConvexError, v } from "convex/values"
import { requireGroupAdmin, requireGroupMember } from "./groupMembers"

const assignmentValidator = v.object({
  _id: v.id("assignments"),
  _creationTime: v.number(),
  groupId: v.id("groups"),
  createdBy: v.id("users"),
  title: v.string(),
  description: v.optional(v.string()),
  dueAt: v.number(),
  tempo: v.optional(v.number()),
  difficulty: v.optional(v.string()),
  seed: v.optional(v.string()),
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
    leaderboard: v.optional(v.boolean()),
  },
  returns: assignmentValidator,
  handler: async (ctx, args) => {
    const { user } = await requireGroupAdmin(ctx, args.groupId)
    const assignmentId = await ctx.db.insert("assignments", {
      groupId: args.groupId,
      createdBy: user._id,
      title: args.title,
      description: args.description,
      dueAt: args.dueAt,
      tempo: args.tempo,
      difficulty: args.difficulty,
      seed: args.seed,
      leaderboard: args.leaderboard ?? true,
      createdAt: Date.now(),
    })
    const assignment = await ctx.db.get(assignmentId)
    if (!assignment) {
      throw new ConvexError({ code: "NOT_FOUND", message: "Assignment creation failed." })
    }
    return assignment
  },
})

export const listForGroup = query({
  args: {
    groupId: v.id("groups"),
    includePast: v.optional(v.boolean()),
  },
  returns: v.array(assignmentValidator),
  handler: async (ctx, args) => {
    await requireGroupMember(ctx, args.groupId)
    const now = Date.now()
    const query = ctx.db
      .query("assignments")
      .withIndex("by_groupId_dueAt", (q) => q.eq("groupId", args.groupId))

    const assignments = await query.collect()
    const filtered = args.includePast ? assignments : assignments.filter((assignment) => assignment.dueAt >= now)
    return filtered
  },
})

export const get = query({
  args: {
    assignmentId: v.id("assignments"),
  },
  returns: v.union(v.null(), assignmentValidator),
  handler: async (ctx, args) => {
    const assignment = await ctx.db.get(args.assignmentId)
    if (!assignment) return null
    await requireGroupMember(ctx, assignment.groupId)
    return assignment
  },
})
