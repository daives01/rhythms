import { describe, expect, test } from "bun:test"
import { buildGroupListEntries } from "./group-list"

describe("buildGroupListEntries", () => {
  test("returns groups with aligned memberships and challenge counts", () => {
    const entries = buildGroupListEntries(
      [
        {
          _id: "gm_1",
          _creationTime: 1,
          groupId: "group_1",
          userId: "user_1",
          role: "admin",
          joinedAt: 10,
        },
      ],
      [
        {
          _id: "group_1",
          _creationTime: 1,
          name: "Practice Crew",
          createdBy: "user_1",
          createdAt: 10,
        },
      ],
      [3]
    )

    expect(entries).toEqual([
      {
        group: {
          _id: "group_1",
          _creationTime: 1,
          name: "Practice Crew",
          createdBy: "user_1",
          createdAt: 10,
        },
        membership: {
          _id: "gm_1",
          _creationTime: 1,
          groupId: "group_1",
          userId: "user_1",
          role: "admin",
          joinedAt: 10,
        },
        challengeCount: 3,
      },
    ])
  })

  test("defaults missing challenge counts to zero", () => {
    const entries = buildGroupListEntries(
      [
        {
          _id: "gm_1",
          _creationTime: 1,
          groupId: "group_1",
          userId: "user_1",
          role: "member",
          joinedAt: 10,
        },
      ],
      [
        {
          _id: "group_1",
          _creationTime: 1,
          name: "Practice Crew",
          createdBy: "user_2",
          createdAt: 10,
        },
      ],
      []
    )

    expect(entries[0]?.challengeCount).toBe(0)
  })

  test("throws when a membership points at a missing group", () => {
    expect(() =>
      buildGroupListEntries(
        [
          {
            _id: "gm_1",
            _creationTime: 1,
            groupId: "group_1",
            userId: "user_1",
            role: "member",
            joinedAt: 10,
          },
        ],
        [null],
        [1]
      )
    ).toThrow("Group not found.")
  })
})
