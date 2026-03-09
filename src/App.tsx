import { Suspense, lazy } from "react"
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { Game } from "./components/Game"
import { AuthLoading } from "./components/auth/AuthLoading"
import { AuthEntry } from "./components/auth/AuthEntry"

const PlayPage = lazy(() => import("./pages/PlayPage").then((module) => ({ default: module.PlayPage })))
const CalibrationPage = lazy(() =>
  import("./pages/CalibrationPage").then((module) => ({ default: module.CalibrationPage }))
)
const GameOverPage = lazy(() =>
  import("./pages/GameOverPage").then((module) => ({ default: module.GameOverPage }))
)
const JoinPage = lazy(() => import("./pages/JoinPage").then((module) => ({ default: module.JoinPage })))
const ResetPasswordPage = lazy(() =>
  import("./pages/ResetPasswordPage").then((module) => ({ default: module.ResetPasswordPage }))
)
const AuthApiRedirectPage = lazy(() =>
  import("./pages/AuthApiRedirectPage").then((module) => ({ default: module.AuthApiRedirectPage }))
)
const HistoryPage = lazy(() =>
  import("./pages/HistoryPage").then((module) => ({ default: module.HistoryPage }))
)
const GroupDetailPage = lazy(() =>
  import("./pages/GroupDetailPage").then((module) => ({ default: module.GroupDetailPage }))
)
const GroupsPage = lazy(() => import("./pages/GroupsPage").then((module) => ({ default: module.GroupsPage })))

function SupportLink() {
  const location = useLocation()
  if (location.pathname === "/play") return null
  
  return (
    <a
      href="https://buymeacoffee.com/danielives"
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-4 left-4 text-xs text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors z-50"
    >
      ♡ SUPPORT THE DEV
    </a>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AuthEntry />
      <SupportLink />
      <Suspense fallback={<AuthLoading />}>
        <Routes>
          <Route path="/" element={<Game />} />
          <Route path="/play" element={<PlayPage />} />
          <Route path="/calibration" element={<CalibrationPage />} />
          <Route path="/game-over" element={<GameOverPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/groups/:id" element={<GroupDetailPage />} />
          <Route path="/join" element={<JoinPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/api/auth/*" element={<AuthApiRedirectPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}

export default App
