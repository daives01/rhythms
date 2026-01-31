import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  users: defineTable({
    authUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    premium: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_authUserId", ["authUserId"])
    .index("by_email", ["email"]),
  groups: defineTable({
    name: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
  }),
  groupMembers: defineTable({
    groupId: v.id("groups"),
    userId: v.id("users"),
    role: v.union(v.literal("admin"), v.literal("member")),
    joinedAt: v.number(),
  })
    .index("by_groupId_userId", ["groupId", "userId"])
    .index("by_groupId", ["groupId"])
    .index("by_userId", ["userId"]),
  groupInvites: defineTable({
    groupId: v.id("groups"),
    createdBy: v.id("users"),
    code: v.string(),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    maxUses: v.optional(v.number()),
    useCount: v.number(),
    revokedAt: v.optional(v.number()),
  })
    .index("by_code", ["code"])
    .index("by_groupId", ["groupId"]),
  assignments: defineTable({
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
    .index("by_groupId_dueAt", ["groupId", "dueAt"])
    .index("by_groupId_createdAt", ["groupId", "createdAt"]),
  playHistory: defineTable({
    userId: v.id("users"),
    groupId: v.optional(v.id("groups")),
    assignmentId: v.optional(v.id("assignments")),
    seed: v.string(),
    tempo: v.number(),
    difficulty: v.string(),
    score: v.number(),
    createdAt: v.number(),
  })
    .index("by_userId_createdAt", ["userId", "createdAt"])
    .index("by_groupId_createdAt", ["groupId", "createdAt"])
    .index("by_assignmentId_createdAt", ["assignmentId", "createdAt"]),
})
