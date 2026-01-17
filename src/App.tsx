import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Game } from "./components/Game"
import { PlayPage } from "./pages/PlayPage"
import { CalibrationPage } from "./pages/CalibrationPage"
import { GameOverPage } from "./pages/GameOverPage"

function App() {
  return (
    <BrowserRouter>
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
