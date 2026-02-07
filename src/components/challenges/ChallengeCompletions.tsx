import { useQuery } from "convex/react"
import { Button } from "@/components/ui/button"
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

const csvEscape = (value: string | number | null | undefined): string => {
  if (value === null || value === undefined) return ""
  const text = String(value)
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

const downloadCsv = (filename: string, rows: string[][]) => {
  const content = rows.map((row) => row.join(",")).join("\n")
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

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
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Completions ({entries.length})
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const rows = [
              ["Name", "Email", "Score", "Tempo", "Difficulty", "Completed At"],
              ...entries.map((entry) => [
                csvEscape(entry.user.name ?? ""),
                csvEscape(entry.user.email ?? ""),
                csvEscape(entry.play.score),
                csvEscape(entry.play.tempo),
                csvEscape(entry.play.difficulty),
                csvEscape(new Date(entry.play.createdAt).toISOString()),
              ]),
            ]
            downloadCsv("challenge-completions.csv", rows)
          }}
          className="text-[10px] uppercase tracking-wider"
        >
          Export CSV
        </Button>
      </div>
      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
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

export function UserChallengeCompletions({ challengeId }: { challengeId: Id<"challenges"> }) {
  const entries = useQuery(api.playHistory.listUserCompletionsForChallenge, { challengeId }) as
    | ChallengeCompletionEntry[]
    | undefined

  if (!entries) {
    return (
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
        Loading your completions...
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
        You haven&apos;t completed this challenge yet.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
        Your completions ({entries.length})
      </span>
      <div className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
        {entries.map((entry) => (
          <div
            key={entry.play._id}
            className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground/70"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-foreground/70">
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
