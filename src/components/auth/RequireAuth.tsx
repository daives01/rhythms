import { useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { authClient } from "@/lib/auth-client"
import { buildAuthSearch, getReturnToFromLocation } from "@/lib/auth-redirect"

interface RequireAuthProps {
  children: React.ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const navigate = useNavigate()
  const { pathname, search, hash } = useLocation()
  const session = authClient.useSession()

  useEffect(() => {
    if (!session.data && !session.isPending) {
      const returnTo = getReturnToFromLocation({ pathname, search, hash })
      navigate({
        pathname,
        search: buildAuthSearch(search, returnTo),
      })
    }
  }, [session.data, session.isPending, navigate, pathname, search, hash])

  if (!session.data) {
    return null
  }

  return <>{children}</>
}
