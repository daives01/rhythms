import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { Game } from "./components/Game"
import { PlayPage } from "./pages/PlayPage"
import { CalibrationPage } from "./pages/CalibrationPage"
import { GameOverPage } from "./pages/GameOverPage"
import { AuthEntry } from "./components/auth/AuthEntry"
import { AccountPage } from "./pages/AccountPage"
import { JoinPage } from "./pages/JoinPage"
import { ResetPasswordPage } from "./pages/ResetPasswordPage"
import { AuthApiRedirectPage } from "./pages/AuthApiRedirectPage"
import { HistoryPage } from "./pages/HistoryPage"
import { GroupDetailPage } from "./pages/GroupDetailPage"
import { GroupsPage } from "./pages/GroupsPage"

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
      <Routes>
        <Route path="/" element={<Game />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route path="/game-over" element={<GameOverPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/groups" element={<GroupsPage />} />
        <Route path="/groups/:id" element={<GroupDetailPage />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/api/auth/*" element={<AuthApiRedirectPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
