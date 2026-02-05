import { useState } from "react"
import { useMutation, useQuery } from "convex/react"
import { Copy, Check, X, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

interface InviteManagerProps {
  groupId: Id<"groups">
}

interface GroupInvite {
  _id: Id<"groupInvites">
  _creationTime: number
  groupId: Id<"groups">
  createdBy: Id<"users">
  code: string
  createdAt: number
  expiresAt?: number
  maxUses?: number
  useCount: number
  revokedAt?: number
}

const expirationOptions = [
  { value: undefined, label: "Never" },
  { value: 3600000, label: "1 hour" },
  { value: 86400000, label: "1 day" },
  { value: 604800000, label: "7 days" },
  { value: 2592000000, label: "30 days" },
] as const

const maxUsesOptions = [
  { value: undefined, label: "Unlimited" },
  { value: 1, label: "1 use" },
  { value: 5, label: "5 uses" },
  { value: 10, label: "10 uses" },
  { value: 25, label: "25 uses" },
  { value: 100, label: "100 uses" },
] as const

export function InviteManager({ groupId }: InviteManagerProps) {
  const session = authClient.useSession()
  const invites = useQuery(api.groups.listInvites, session.data ? { groupId } : "skip")
  const createInvite = useMutation(api.groups.createInvite)
  const revokeInvite = useMutation(api.groups.revokeInvite)

  const [expirationMs, setExpirationMs] = useState<number | undefined>(undefined)
  const [maxUses, setMaxUses] = useState<number | undefined>(undefined)
  const [isCreating, setIsCreating] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCreate = async () => {
    setErrorMessage(null)
    setIsCreating(true)
    try {
      const expiresAt = expirationMs ? Date.now() + expirationMs : undefined
      await createInvite({
        groupId,
        expiresAt,
        maxUses,
      })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to create invite.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleRevoke = async (inviteId: Id<"groupInvites">) => {
    try {
      await revokeInvite({ inviteId })
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to revoke invite.")
    }
  }

  const getInviteLink = (code: string): string => {
    return `${window.location.origin}/join?code=${code}`
  }

  const handleCopy = async (inviteId: string, code: string) => {
    const link = getInviteLink(code)
    try {
      await navigator.clipboard.writeText(link)
      setCopiedId(inviteId)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      const textArea = document.createElement("textarea")
      textArea.value = link
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand("copy")
      document.body.removeChild(textArea)
      setCopiedId(inviteId)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const formatExpiration = (expiresAt?: number): string => {
    if (!expiresAt) return "Never"
    const now = Date.now()
    const diff = expiresAt - now
    if (diff <= 0) return "Expired"
    const days = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    if (days > 0) return `${days} day${days === 1 ? "" : "s"}`
    if (hours > 0) return `${hours} hour${hours === 1 ? "" : "s"}`
    return "< 1 hour"
  }

  const isActive = (invite: GroupInvite): boolean => {
    if (invite.revokedAt) return false
    if (invite.expiresAt && invite.expiresAt < Date.now()) return false
    if (invite.maxUses !== undefined && invite.useCount >= invite.maxUses) return false
    return true
  }

  const typedInvites = invites as GroupInvite[] | undefined
  const activeInvites = typedInvites?.filter(isActive) ?? []
  const expiredInvites = typedInvites?.filter((i) => !isActive(i)) ?? []

  return (
    <div className="flex flex-col gap-4">
      {errorMessage && (
        <div className="border border-destructive text-destructive text-[10px] uppercase tracking-wider px-3 py-2">
          {errorMessage}
        </div>
      )}

      <div className="border border-border p-3 flex flex-col gap-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Create new invite</p>
        <div className="grid grid-cols-2 gap-2">
          <select
            aria-label="Expiration"
            value={expirationMs ?? ""}
            onChange={(e) => setExpirationMs(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full bg-background border border-border px-2 py-2 text-[10px] uppercase tracking-wider text-foreground"
          >
            {expirationOptions.map((opt) => (
              <option key={opt.label} value={opt.value ?? ""}>
                Expires: {opt.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Max uses"
            value={maxUses ?? ""}
            onChange={(e) => setMaxUses(e.target.value ? Number(e.target.value) : undefined)}
            className="w-full bg-background border border-border px-2 py-2 text-[10px] uppercase tracking-wider text-foreground"
          >
            {maxUsesOptions.map((opt) => (
              <option key={opt.label} value={opt.value ?? ""}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleCreate}
          disabled={isCreating}
          className="text-[10px] uppercase tracking-wider"
        >
          Generate invite
        </Button>
      </div>

      {activeInvites.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Active invites ({activeInvites.length})
          </p>
          <div className="flex flex-col gap-2">
            {activeInvites.map((invite) => (
              <div key={invite._id} className="border border-border p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <code className="text-sm text-foreground">{invite.code}</code>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopy(invite._id, invite.code)}
                      className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                      title="Copy invite link"
                    >
                      {copiedId === invite._id ? (
                        <Check className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={() => handleRevoke(invite._id)}
                      className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
                      title="Revoke invite"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground/60">
                  <span>Uses: {invite.useCount}{invite.maxUses !== undefined ? `/${invite.maxUses}` : ""}</span>
                  <span>Expires: {formatExpiration(invite.expiresAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {expiredInvites.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
            Expired/Revoked ({expiredInvites.length})
          </p>
          <div className="flex flex-col gap-2 opacity-50">
            {expiredInvites.map((invite) => (
              <div key={invite._id} className="border border-border p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <X className="w-4 h-4 text-muted-foreground/40" />
                  <code className="text-sm text-muted-foreground">{invite.code}</code>
                </div>
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
                  {invite.revokedAt ? "Revoked" : invite.expiresAt && invite.expiresAt < Date.now() ? "Expired" : "Used up"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {typedInvites?.length === 0 && (
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">
          No invites yet. Create one to invite members.
        </p>
      )}
    </div>
  )
}
