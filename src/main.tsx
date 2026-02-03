import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { ConvexReactClient } from "convex/react"
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react"
import "./index.css"
import App from "./App.tsx"
import { authClient } from "./lib/auth-client"

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL)

const hydrateCachedSession = () => {
  const cachedSession = authClient.getSessionData?.()
  if (!cachedSession) return

  const sessionAtom = authClient.$store?.atoms?.session
  if (!sessionAtom) return

  const current = sessionAtom.get()
  if (!current || current.data) return

  sessionAtom.set({
    ...current,
    data: cachedSession,
    error: null,
    isPending: false,
    isRefetching: false,
  })
}

if (typeof window !== "undefined") {
  hydrateCachedSession()
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ConvexBetterAuthProvider client={convex} authClient={authClient}>
      <App />
    </ConvexBetterAuthProvider>
  </StrictMode>
)
