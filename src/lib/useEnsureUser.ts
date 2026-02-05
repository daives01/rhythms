import { useEffect } from "react"
import { useMutation, useQuery } from "convex/react"
import { authClient } from "@/lib/auth-client"
import { api } from "../../convex/_generated/api"

export function useEnsureUser() {
  const session = authClient.useSession()
  const user = useQuery(api.users.getAuthUser)
  const getOrCreateUser = useMutation(api.users.getOrCreateUser)

  useEffect(() => {
    if (session.data && user === null) {
      getOrCreateUser()
    }
  }, [session.data, user, getOrCreateUser])

  const isReady = session.data ? user !== undefined && user !== null : false

  return { isReady, user }
}
