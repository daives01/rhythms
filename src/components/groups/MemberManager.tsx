import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { X } from "lucide-react"
import { authClient } from "@/lib/auth-client"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

interface MemberManagerProps {
  groupId: Id<"groups">
  currentUserId: Id<"users">
}

interface GroupMemberWithUser {
  membership: {
    _id: Id<"groupMembers">
    _creationTime: number
    groupId: Id<"groups">
    userId: Id<"users">
    role: "admin" | "member"
    joinedAt: number
  }
  user: {
    _id: Id<"users">
    _creationTime: number
    authUserId: string
    email?: string
    name?: string
    premium?: boolean
    createdAt: number
  }
}

export function MemberManager({ groupId, currentUserId }: MemberManagerProps) {
  const session = authClient.useSession()
  const members = useQuery(api.groups.listMembers, session.data ? { groupId } : "skip")
  const removeMember = useMutation(api.groups.removeMember)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleRemove = async (userId: Id<"users">) => {
    setErrorMessage(null)
    try {
      await removeMember({ groupId, userId })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to remove member.")
    }
  }

  const typedMembers = members as GroupMemberWithUser[] | undefined

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div className="border border-destructive text-destructive text-[10px] uppercase tracking-wider px-3 py-2">
          {errorMessage}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Members ({typedMembers?.length ?? 0})
        </p>
        <div className="flex flex-col gap-2">
          {typedMembers?.map((entry) => (
            <div key={entry.membership._id} className="border border-border p-3 flex items-center justify-between">
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <span className="text-sm text-foreground truncate">
                  {entry.user.name ?? entry.user.email ?? entry.user._id}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  {entry.membership.role === "admin" ? "Admin" : "Member"}
                  {entry.user._id === currentUserId && " · You"}
                </span>
              </div>
              {entry.user._id !== currentUserId && (
                <button
                  onClick={() => handleRemove(entry.user._id)}
                  className="p-1.5 text-muted-foreground hover:text-destructive transition-colors ml-2"
                  title="Remove member"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
