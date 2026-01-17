import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Game } from "./components/Game"
import { CalibrationPage } from "./pages/CalibrationPage"
import { GameOverPage } from "./pages/GameOverPage"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Game />} />
        <Route path="/calibration" element={<CalibrationPage />} />
        <Route path="/:seed/gameOver" element={<GameOverPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
