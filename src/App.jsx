import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Part 1 — existing components (unchanged)
import Landing from './components/Landing.jsx'
import HostSetup from './components/HostSetup.jsx'
import Lobby from './components/Lobby.jsx'
import AuctionRoom from './components/AuctionRoom.jsx'
import Squad from './components/Squad.jsx'

// Part 2 — new tournament components
import Tournament from './components/Tournament.jsx'
import MatchSetup from './components/MatchSetup.jsx'
import MatchEngine from './components/MatchEngine.jsx'
import Trophy from './components/Trophy.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ── Part 1 — Auction (exact same paths as before) ── */}
        <Route path="/" element={<Landing />} />
        <Route path="/host" element={<HostSetup />} />
        <Route path="/room/:roomId" element={<Lobby />} />
        <Route path="/auction/:roomId" element={<AuctionRoom />} />
        <Route path="/squad/:roomId" element={<Squad />} />

        {/* ── Part 2 — Tournament ── */}
        <Route path="/tournament/:roomId" element={<Tournament />} />

        {/* League match: XI select → engine */}
        <Route path="/match-setup/:roomId/:matchId" element={<MatchSetup isPlayoff={false} />} />
        <Route path="/match-engine/:roomId/:matchId" element={<MatchEngine isPlayoff={false} />} />

        {/* Playoff match: XI select → engine */}
        <Route path="/playoff-setup/:roomId/:matchId" element={<MatchSetup isPlayoff={true} />} />
        <Route path="/playoff-engine/:roomId/:matchId" element={<MatchEngine isPlayoff={true} />} />

        {/* Trophy */}
        <Route path="/trophy/:roomId" element={<Trophy />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}