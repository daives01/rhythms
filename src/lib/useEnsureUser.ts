import { useEffect, useState } from "react"
import { useMutation } from "convex/react"
import { authClient } from "@/lib/auth-client"
import { api } from "../../convex/_generated/api"

export function useEnsureUser() {
  const session = authClient.useSession()
  const getOrCreateUser = useMutation(api.users.getOrCreateUser)
  const [isReady, setIsReady] = useState(false)
  const [isEnsuring, setIsEnsuring] = useState(false)

  useEffect(() => {
    if (!session.data) {
      setIsReady(false)
      setIsEnsuring(false)
      return
    }

    let cancelled = false
    setIsReady(false)
    setIsEnsuring(true)

    getOrCreateUser()
      .then(() => {
        if (cancelled) return
        setIsReady(true)
      })
      .catch(() => {
        if (cancelled) return
        setIsReady(false)
      })
      .finally(() => {
        if (cancelled) return
        setIsEnsuring(false)
      })

    return () => {
      cancelled = true
    }
  }, [getOrCreateUser, session.data])

  return { isReady, isEnsuring }
}
