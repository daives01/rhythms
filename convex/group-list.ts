export function buildGroupListEntries<
  TGroup extends { _id: unknown },
  TMembership extends { groupId: TGroup["_id"] }
>(
  memberships: TMembership[],
  groups: Array<TGroup | null>,
  challengeCounts: number[]
) {
  return groups.map((group, index) => {
    if (!group) {
      throw new Error("Group not found.")
    }

    return {
      group,
      membership: memberships[index],
      challengeCount: challengeCounts[index] ?? 0,
    }
  })
}
