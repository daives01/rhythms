import { useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { authClient } from "@/lib/auth-client"
import { buildAuthSearch, getReturnToFromLocation } from "@/lib/auth-redirect"

interface RequireAuthProps {
  children: React.ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = authClient.useSession()

  useEffect(() => {
    if (!session.data && !session.isPending) {
      const returnTo = getReturnToFromLocation(location)
      navigate({
        pathname: location.pathname,
        search: buildAuthSearch(location.search, returnTo),
      })
    }
  }, [session.data, session.isPending, navigate, location.pathname, location.search])

  if (!session.data) {
    return null
  }

  return <>{children}</>
}
