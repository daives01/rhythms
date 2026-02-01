import { useEffect } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { authClient } from "@/lib/auth-client"

interface RequireAuthProps {
  children: React.ReactNode
}

export function RequireAuth({ children }: RequireAuthProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const session = authClient.useSession()

  useEffect(() => {
    if (!session.data && !session.isPending) {
      navigate("/account", { state: { from: location.pathname } })
    }
  }, [session.data, session.isPending, navigate, location.pathname])

  if (!session.data) {
    return null
  }

  return <>{children}</>
}
