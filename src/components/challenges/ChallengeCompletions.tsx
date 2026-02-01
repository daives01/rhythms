import { useQuery } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

interface ChallengeCompletionEntry {
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

const formatFullDate = (timestamp: number): string =>
  new Date(timestamp).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

export function ChallengeCompletions({ challengeId }: { challengeId: Id<"challenges"> }) {
  const entries = useQuery(api.playHistory.listCompletionsForChallenge, { challengeId }) as
    | ChallengeCompletionEntry[]
    | undefined

  if (!entries) {
    return (
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
        Loading completions...
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
        No completions yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Completions ({entries.length})
      </span>
      <div className="flex flex-col gap-1">
        {entries.map((entry) => (
          <div
            key={entry.play._id}
            className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/70"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-foreground/70">
                {entry.user.name ?? entry.user.email ?? "Unknown"}
              </span>
              <span className="text-muted-foreground/40">
                {formatFullDate(entry.play.createdAt)}
              </span>
            </div>
            <span className="text-foreground">{entry.play.score} pts</span>
          </div>
        ))}
      </div>
    </div>
  )
}
