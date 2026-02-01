import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

interface ChallengeLeaderboardEntry {
  play: {
    _id: Id<"playHistory">
    score: number
    tempo: number
    difficulty: string
    createdAt: number
  }
  user: {
    _id: Id<"users">
    name?: string
    email?: string
  }
}

interface ChallengeLeaderboardProps {
  challengeId: Id<"challenges">
  limit?: number
}

export function ChallengeLeaderboard({ challengeId, limit = 5 }: ChallengeLeaderboardProps) {
  const entries = useQuery(api.playHistory.listForChallenge, { challengeId }) as
    | ChallengeLeaderboardEntry[]
    | undefined

  if (!entries) {
    return (
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
        Loading leaderboard...
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
        No scores yet.
      </div>
    )
  }

  const topEntries = entries.slice(0, limit)

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Top scores
      </span>
      <div className="flex flex-col gap-1">
        {topEntries.map((entry, index) => (
          <div
            key={entry.play._id}
            className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/70"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-foreground/70">#{index + 1}</span>
              <span className="truncate">
                {entry.user.name ?? entry.user.email ?? "Unknown"}
              </span>
            </div>
            <span className="text-foreground">{entry.play.score} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}
