import { useEffect } from "react"
import { useLocation } from "react-router-dom"

export function AuthApiRedirectPage() {
  const location = useLocation()
  const baseUrl = import.meta.env.VITE_CONVEX_SITE_URL

  useEffect(() => {
    if (!baseUrl) {
      return
    }
    const target = new URL(`${location.pathname}${location.search}${location.hash}`, baseUrl)
    window.location.replace(target.toString())
  }, [baseUrl, location.hash, location.pathname, location.search])

  return (
    <div className="min-h-dvh flex items-center justify-center p-6 text-center text-xs text-muted-foreground">
      Redirecting…
    </div>
  )
}
