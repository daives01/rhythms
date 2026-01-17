import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom"
import { Game } from "./components/Game"
import { PlayPage } from "./pages/PlayPage"
import { CalibrationPage } from "./pages/CalibrationPage"
import { GameOverPage } from "./pages/GameOverPage"

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
      <SupportLink />
      <Routes>
        <Route path="/" element={<Game />} />
        <Route path="/play" element={<PlayPage />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route path="/game-over" element={<GameOverPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
