import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getRoom } from '../utils/db.js'

export default function Landing() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  async function handleJoin(e) {
    e.preventDefault()
    if (!joinCode.trim() || !playerName.trim()) return
    setJoining(true)
    setError('')
    try {
      const room = await getRoom(joinCode.toUpperCase().trim())
      if (!room) { setError('Room not found. Check the code and try again.'); return }
      if (room.status === 'completed') { setError('This auction has already ended.'); return }
      localStorage.setItem('playerName', playerName.trim())
      navigate(`/room/${joinCode.toUpperCase().trim()}`)
    } catch (err) {
      setError('Something went wrong. Try again.')
    } finally {
      setJoining(false)
    }
  }

  // Generate 8 floating particles with random properties
  const particles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    left: `${8 + Math.random() * 84}%`,
    top: `${10 + Math.random() * 80}%`,
    duration: `${10 + Math.random() * 20}s`,
    delay: `${Math.random() * 8}s`,
    size: `${4 + Math.random() * 6}px`,
    opacity: 0.15 + Math.random() * 0.25
  }))

  return (
    <div style={styles.page}>
      {/* Animated cricket ball particles */}
      {particles.map(p => (
        <div
          key={p.id}
          style={{
            ...styles.particle,
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            opacity: p.opacity,
            animationDuration: p.duration,
            animationDelay: p.delay
          }}
        />
      ))}

      {/* Top Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>\uD83C\uDFCF</span>
          <span style={styles.logoText}>IPL AUCTION</span>
        </div>
        <span style={styles.betaBadge}>BETA</span>
      </nav>

      {/* Main Content */}
      <main style={styles.main}>
        {/* Hero Section */}
        <div style={styles.hero} className="animate-fade-in">
          <h1 style={styles.heroTitle}>
            BUILD YOUR<br />
            <span style={styles.heroTitleGold}>DREAM TEAM</span>
          </h1>
          <p style={styles.heroSubtitle}>
            Bid on stars. Build your squad. Dominate the tournament.
          </p>
        </div>

        {/* Two Glowing Action Cards */}
        <div style={styles.actionCards} className="animate-slide-up">
          {/* HOST AN AUCTION Card */}
          <div style={{ ...styles.actionCard, ...styles.hostCard }}>
            <div style={styles.cardGlowGold} />
            <div style={styles.cardContent}>
              <div style={styles.cardIcon}>🚀</div>
              <h2 style={styles.cardTitle}>HOST AN AUCTION</h2>
              <p style={styles.cardDesc}>
                Create a room, pick the format, set the rules, and invite your friends.
              </p>
              <button
                className="btn btn-gold btn-lg"
                style={{ width: '100%', marginTop: 16 }}
                onClick={() => navigate('/host')}
              >
                CREATE ROOM
              </button>
            </div>
          </div>

          {/* JOIN A ROOM Card */}
          <div style={{ ...styles.actionCard, ...styles.joinCard }}>
            <div style={styles.cardGlowBlue} />
            <div style={styles.cardContent}>
              <div style={styles.cardIcon}>🎫</div>
              <h2 style={styles.cardTitle}>JOIN A ROOM</h2>
              <p style={styles.cardDesc}>
                Got a room code from your friend? Enter it below to join the auction.
              </p>
              <form onSubmit={handleJoin} style={styles.joinForm}>
                <input
                  placeholder="Your name"
                  value={playerName}
                  onChange={e => setPlayerName(e.target.value)}
                  maxLength={20}
                  style={styles.input}
                />
                <input
                  placeholder="Room code (e.g. KXY7P2)"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  style={{ ...styles.input, ...styles.roomCodeInput }}
                />
                {error && <p style={styles.errorText}>{error}</p>}
                <button
                  type="submit"
                  className="btn btn-blue btn-lg"
                  disabled={joining || !joinCode || !playerName}
                  style={{ width: '100%' }}
                >
                  {joining ? 'JOINING...' : 'JOIN AUCTION'}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Format Preview Cards */}
        <div style={styles.formatsSection} className="animate-fade-in">
          <h3 style={styles.formatsTitle}>CHOOSE YOUR FORMAT</h3>
          <div style={styles.formatCardsRow}>
            {[
              { icon: '\uD83C\uDFC6', name: 'Mega Auction', desc: '\u20B9120 Cr • All 2026 Players • No Retentions' },
              { icon: '⭐', name: 'Legends Auction', desc: '\u20B9120 Cr • IPL All-Time Greats' },
              { icon: '🌸', name: 'IPL 2026 Real', desc: 'Real Purses • Real Retentions • Authentic' },
            ].map((f, i) => (
              <div
                key={f.name}
                style={{ ...styles.formatCard, animationDelay: `${i * 0.15}s` }}
                className="animate-fade-in"
              >
                <span style={styles.formatIcon}>{f.icon}</span>
                <div>
                  <div style={styles.formatName}>{f.name}</div>
                  <div style={styles.formatDesc}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
        Made for cricket fans \uD83C\uDFCF • Free forever
      </footer>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    overflow: 'visible',
    background: 'var(--bg-primary)'
  },

  // Floating particles
  particle: {
    position: 'absolute',
    borderRadius: '50%',
    background: 'rgba(242, 169, 0, 0.5)',
    animation: 'float 10s infinite ease-in-out',
    pointerEvents: 'none',
    zIndex: 0
  },

  // Navbar
  navbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '24px 32px',
    position: 'relative',
    zIndex: 1
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logoIcon: {
    fontSize: 28
  },
  logoText: {
    fontFamily: 'var(--font-display)',
    fontWeight: 800,
    fontSize: 22,
    letterSpacing: 2,
    color: 'var(--gold)'
  },
  betaBadge: {
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    letterSpacing: 4,
    color: '#000',
    backgroundColor: 'var(--gold)',
    padding: '4px 10px',
    borderRadius: 4,
    fontWeight: 700
  },

  // Main content
  main: {
    flex: 1,
    maxWidth: 900,
    margin: '0 auto',
    padding: '20px 24px',
    width: '100%',
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },

  // Hero
  hero: {
    textAlign: 'center',
    marginBottom: 48,
    paddingTop: 40
  },
  heroTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 'clamp(48px, 8vw, 80px)',
    fontWeight: 800,
    lineHeight: 1.05,
    letterSpacing: -1,
    color: '#fff',
    textTransform: 'uppercase'
  },
  heroTitleGold: {
    color: 'var(--gold)',
    fontSize: 'clamp(56px, 10vw, 96px)'
  },
  heroSubtitle: {
    color: 'var(--text-secondary)',
    fontSize: 18,
    maxWidth: 500,
    margin: '16px auto 0',
    lineHeight: 1.6
  },

  // Action cards
  actionCards: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: 20,
    marginBottom: 48
  },
  actionCard: {
    position: 'relative',
    borderRadius: 'var(--radius-lg)',
    padding: 28,
    background: 'var(--bg-card)',
    border: '1px solid rgba(242, 169, 0, 0.15)',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    overflow: 'hidden'
  },
  hostCard: {
    borderColor: 'rgba(242, 169, 0, 0.3)'
  },
  joinCard: {
    borderColor: 'rgba(59, 130, 246, 0.3)'
  },
  cardGlowGold: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: 'linear-gradient(90deg, transparent, var(--gold), transparent)'
  },
  cardGlowBlue: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    background: 'linear-gradient(90deg, transparent, var(--blue), transparent)'
  },
  cardContent: {
    position: 'relative',
    zIndex: 1
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 12
  },
  cardTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 8,
    letterSpacing: 1
  },
  cardDesc: {
    color: 'var(--text-secondary)',
    fontSize: 14,
    lineHeight: 1.6
  },
  joinForm: {
    marginTop: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 10
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-body)',
    fontSize: 15,
    outline: 'none'
  },
  roomCodeInput: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center'
  },
  errorText: {
    color: 'var(--red)',
    fontSize: 13,
    margin: 0
  },

  // Format cards
  formatsSection: {
    textAlign: 'center',
    marginBottom: 48
  },
  formatsTitle: {
    fontFamily: 'var(--font-display)',
    fontSize: 18,
    fontWeight: 600,
    marginBottom: 16,
    color: 'var(--text-secondary)',
    letterSpacing: 1,
    textTransform: 'uppercase'
  },
  formatCardsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
    gap: 12
  },
  formatCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '14px 20px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    textAlign: 'left'
  },
  formatIcon: {
    fontSize: 24
  },
  formatName: {
    fontFamily: 'var(--font-display)',
    fontWeight: 700,
    fontSize: 16
  },
  formatDesc: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    marginTop: 2
  },

  // Footer
  footer: {
    textAlign: 'center',
    padding: 24,
    color: 'var(--text-muted)',
    fontSize: 13,
    position: 'relative',
    zIndex: 1
  }
}
