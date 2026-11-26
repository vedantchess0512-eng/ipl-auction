import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subscribeRoom, joinRoom, releaseTeam, startAuction, joinAsSpectator } from '../utils/db.js'
import { IPL_TEAMS } from '../data/teams.js'
import { ref, push, onValue, off } from 'firebase/database'
import { db } from '../firebase.js'

function LobbyChat({ roomId, playerName }) {
  const [messages, setMessages] = React.useState([])
  const [input, setInput] = React.useState('')
  const [showEmoji, setShowEmoji] = React.useState(false)
  const bottomRef = React.useRef(null)

  const QUICK_EMOJIS = ['😂','\uD83D\uDD25','\uD83D\uDCB0','\uD83C\uDFCF','👏','😍','🤑','😤','🙏','⭐','💪','😎','🎉','\uD83D\uDC51','⚡']

  React.useEffect(() => {
    const chatRef = ref(db, `rooms/${roomId}/chat`)
    const unsub = onValue(chatRef, snap => {
      if (snap.exists()) {
        const msgs = Object.values(snap.val()).sort((a,b) => (a.time||0)-(b.time||0))
        setMessages(msgs)
        setTimeout(() => bottomRef.current?.scrollIntoView({behavior:'smooth'}), 60)
      }
    })
    return () => off(chatRef)
  }, [roomId])

  function send(text) {
    const t = (text || input).trim()
    if (!t) return
    push(ref(db, `rooms/${roomId}/chat`), {
      text: t, sender: playerName, time: Date.now()
    })
    setInput('')
    setShowEmoji(false)
  }

  return (
    <div style={{ marginTop: 24, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--gold)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span>\uD83D\uDCAC LOBBY CHAT</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{messages.length} messages</span>
      </div>
      <div style={{ height: 220, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {messages.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 16 }}>Say hi to your friends 👋</div>}
        {messages.map((msg, i) => {
          const isMe = msg.sender === playerName
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 2 }}>
              <div style={{ fontSize: 11, color: isMe ? 'var(--gold)' : 'var(--text-muted)' }}>{msg.sender}{isMe ? ' (You)' : ''}</div>
              <div style={{ padding: '7px 12px', borderRadius: isMe ? '12px 12px 2px 12px' : '12px 12px 12px 2px', background: isMe ? 'var(--gold)' : 'var(--bg-elevated)', color: isMe ? '#000' : 'var(--text-primary)', fontSize: 13, maxWidth: '80%', lineHeight: 1.4 }}>
                {msg.text}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>
      {showEmoji && (
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 6, background: 'var(--bg-elevated)' }}>
          {QUICK_EMOJIS.map((em, i) => (
            <button key={i} onClick={() => send(em)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', padding: '2px 4px', borderRadius: 4 }}>{em}</button>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid var(--border)', alignItems: 'center' }}>
        <button onClick={() => setShowEmoji(v => !v)} style={{ width: 36, height: 36, borderRadius: 8, background: showEmoji ? 'var(--gold)' : 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>😊</button>
        <input
          style={{ flex: 1, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, padding: '8px 12px', outline: 'none' }}
          placeholder="Type a message..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); send() } }}
          maxLength={200}
        />
        <button onClick={() => send()} disabled={!input.trim()} style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--gold)', border: 'none', color: '#000', fontSize: 16, cursor: 'pointer', opacity: input.trim() ? 1 : 0.4 }}>➤</button>
      </div>
    </div>
  )
}

export default function Lobby() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [myTeam, setMyTeam] = useState(null)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [spectatorCount, setSpectatorCount] = useState(0)
  const [playerName] = useState(() => localStorage.getItem('playerName') || '')
  const isHost = !!(room && playerName && (room.hostName === playerName || room.host === playerName))

  useEffect(() => {
    if (!roomId) return
    const unsub = subscribeRoom(roomId, (data) => {
      if (!data) { navigate('/'); return }
      setRoom(data)
      if (data.teams) {
        const owned = Object.values(data.teams).find(t => t.ownerId === playerName)
        if (owned) setMyTeam(owned.id)
      }
      if (data.status === 'auction') {
        navigate(`/auction/${roomId}`)
      }
    })
    return unsub
  }, [roomId])

  // Track spectator count
  useEffect(() => {
    if (!roomId) return
    const specRef = ref(db, `rooms/${roomId}/spectators`)
    const unsub = onValue(specRef, snap => {
      if (snap.exists()) setSpectatorCount(Object.keys(snap.val()).length)
      else setSpectatorCount(0)
    })
    return () => off(specRef)
  }, [roomId])

  async function handlePickTeam(teamId) {
    if (joining) return
    const teams = Object.values(room?.teams || {})
    const targetTeam = teams.find(t => t.id === teamId)
    if (targetTeam?.ownerId && targetTeam.ownerId !== playerName) return
    if (myTeam === teamId) return

    setJoining(true)
    setError('')
    try {
      if (myTeam) {
        await releaseTeam(roomId, myTeam, playerName)
      }
      await joinRoom(roomId, playerName, teamId)
      setMyTeam(teamId)
    } catch (err) {
      setError(err.message || 'Failed to join team')
    } finally {
      setJoining(false)
    }
  }

  // Watch as spectator — join auction room directly
  async function handleWatchAsSpectator() {
    try {
      await joinAsSpectator(roomId, playerName)
      navigate(`/auction/${roomId}`)
    } catch (err) {
      navigate(`/auction/${roomId}`)
    }
  }

  async function handleStart() {
    if (!room) return
    const teams = Object.values(room.teams || {})
    const unowned = teams.filter(t => !t.ownerId)
    if (unowned.length > 0 && !window.confirm(`${unowned.length} team(s) have no owner. Start anyway?`)) return
    await startAuction(roomId)
  }

  if (!room) return <div style={styles.loading}>Loading room...</div>

  const teams = Object.values(room.teams || {})
  const takenCount = teams.filter(t => t.ownerId).length
  const format = room.format
  const formatLabel = format === 'MEGA' ? 'Mega Auction' : format === 'LEGENDS' ? 'Legends Auction' : 'IPL 2026'
  const auctionLive = room.status === 'auction'
  const hasTeam = !!myTeam

  return (
    <div style={styles.page}>
      <div style={styles.container}>

        {/* Top Section: Room Code + Meta */}
        <div style={styles.topSection}>
          <div style={styles.roomCodeBlock}>
            <div style={styles.roomLabel}>ROOM CODE</div>
            <div style={styles.roomCode}>{roomId}</div>
            <button onClick={() => {
              navigator.clipboard.writeText(roomId)
              setCopied(true)
              setTimeout(() => setCopied(false), 2000)
            }} style={styles.copyBtn} className="btn btn-ghost btn-sm">
              {copied ? '\u2705 COPIED!' : '\uD83D\uDCCB COPY CODE'}
            </button>
          </div>
          <div style={styles.metaRow}>
            <span style={styles.formatBadge}>{formatLabel}</span>
            <span style={styles.metaChip}>👥 {takenCount}/{teams.length} players</span>
            {spectatorCount > 0 && <span style={styles.metaChip}>👁️ {spectatorCount} watching</span>}
            {auctionLive && <span style={styles.liveBadge}>🔴 LIVE</span>}
          </div>
        </div>

        {/* Info Pills */}
        <div style={styles.infoPills}>
          <span style={styles.pill}>Squad: {room.minSquadSize}–{room.maxSquadSize}</span>
          <span style={styles.pill}>Max OS: {room.maxOverseas}</span>
          <span style={styles.pill}>Bid timer: {room.bidTimer}s</span>
          <span style={styles.pill}>Increment: \u20B9{room.bidIncrement}L</span>
        </div>

        {/* Spectator / Watch Banner — for users who haven't picked a team */}
        {!hasTeam && !isHost && (
          <div style={styles.spectatorBanner}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
                👁️ Watch as Spectator
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                You can watch the auction without bidding, or pick a team below to participate.
              </div>
            </div>
            <button
              onClick={handleWatchAsSpectator}
              style={{ padding: '8px 16px', borderRadius: 8, background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.5)', color: '#93c5fd', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, cursor: 'pointer', flexShrink: 0 }}
            >
              👁️ Watch Live
            </button>
          </div>
        )}

        {/* Select Team Heading */}
        <h2 style={styles.sectionTitle}>SELECT YOUR TEAM</h2>

        {/* My Team Banner */}
        {myTeam && !auctionLive && (
          <div style={styles.myTeamBanner}>
            \u2705 You're managing <strong>{teams.find(t => t.id === myTeam)?.name || myTeam}</strong>
            <span style={styles.bannerHint}>You can switch to any available team.</span>
          </div>
        )}

        {/* Team Grid 2x5 */}
        <div className="team-grid">
          {teams.map(team => {
            const ipl = IPL_TEAMS.find(t => t.id === team.id) || team
            const takenByOther = team.ownerId && team.ownerId !== playerName
            const isMe = team.ownerId === playerName
            const clickable = !takenByOther && !joining

            return (
              <div
                key={team.id}
                style={{
                  ...styles.teamCard,
                  background: `linear-gradient(rgba(15,15,30,0.88), rgba(15,15,30,0.88)), ${ipl.gradient}`,
                  border: isMe ? '3px solid var(--gold)' : takenByOther ? '1px solid var(--border)' : '1px solid rgba(242,169,0,0.15)',
                  opacity: takenByOther ? 0.5 : 1,
                  cursor: clickable ? 'pointer' : 'default',
                }}
                onClick={() => clickable && handlePickTeam(team.id)}
                onMouseEnter={(e) => {
                  if (clickable && !isMe) {
                    e.currentTarget.style.transform = 'scale(1.03)'
                    e.currentTarget.style.boxShadow = `0 0 20px ${ipl.color || 'rgba(242,169,0,0.3)'}`
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)'
                  e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.4)'
                }}
              >
                {isMe && <div style={styles.checkmark}>✓</div>}
                <img src={ipl.logo} alt={team.id} style={styles.teamLogo} onError={(e) => { e.target.style.display = 'none' }} />
                <div style={styles.teamShort}>{team.shortName}</div>
                <div style={styles.teamName}>{team.name}</div>
                <div style={styles.teamPurse}>\u20B9{((team.purse || 0) / 100).toFixed(0)} Cr</div>
                <div style={styles.teamOwner}>
                  {isMe && <span style={styles.ownerBadge}>⭐ You</span>}
                  {takenByOther && <span style={styles.takenBadge}>{team.ownerName}</span>}
                  {!team.ownerId && <span style={styles.availableBadge}>Available</span>}
                </div>
              </div>
            )
          })}
        </div>

        {error && <p style={styles.errorText}>{error}</p>}

        {/* Join Live Auction Button */}
        {auctionLive && myTeam && (
          <div style={styles.joinLiveWrap}>
            <button className="btn btn-gold btn-lg" onClick={() => navigate(`/auction/${roomId}`)}>
              \uD83C\uDFCF Join Live Auction →
            </button>
          </div>
        )}

        {/* Host Controls */}
        {isHost && !auctionLive && (
          <button
            className="btn btn-gold btn-lg"
            style={{ marginTop: 16, width: '100%', fontSize: 18, padding: '14px' }}
            onClick={handleStart}
          >
            \uD83C\uDFCF START AUCTION
          </button>
        )}

        {/* Activity Feed */}
        <div style={styles.activityBox}>
          <div style={styles.activityTitle}>\uD83D\uDCCB Activity Feed</div>
          <div style={styles.terminal}>
            <div style={styles.terminalLine}>
              <span style={styles.terminalTime}>[--:--]</span>
              <span style={styles.terminalText}>🟢 Room created by <strong>{room.hostName}</strong></span>
            </div>
            {teams.filter(t => t.ownerId).map(t => (
              <div key={t.id} style={styles.terminalLine}>
                <span style={styles.terminalTime}>[--:--]</span>
                <span style={styles.terminalText}>\uD83C\uDFCF <strong>{t.ownerName}</strong> selected {t.name}</span>
              </div>
            ))}
            {takenCount === teams.length && (
              <div style={styles.terminalLine}>
                <span style={styles.terminalTime}>[--:--]</span>
                <span style={{...styles.terminalText, color:'var(--green)'}}>\u2705 All teams filled! Ready to start.</span>
              </div>
            )}
            {auctionLive && (
              <div style={styles.terminalLine}>
                <span style={styles.terminalTime}>[--:--]</span>
                <span style={{...styles.terminalText, color:'var(--green)'}}>🔴 Auction is LIVE!</span>
              </div>
            )}
            {spectatorCount > 0 && (
              <div style={styles.terminalLine}>
                <span style={styles.terminalTime}>[--:--]</span>
                <span style={{...styles.terminalText, color:'#93c5fd'}}>👁️ {spectatorCount} spectator{spectatorCount > 1 ? 's' : ''} watching</span>
              </div>
            )}
          </div>
        </div>

        <LobbyChat roomId={roomId} playerName={playerName} />
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', padding: '24px 16px', background: 'var(--bg-primary)' },
  container: { maxWidth: 1000, margin: '0 auto' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' },
  topSection: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 },
  roomCodeBlock: { display: 'flex', alignItems: 'baseline', gap: 16, flexWrap: 'wrap' },
  roomLabel: { fontFamily: 'var(--font-display)', fontSize: 11, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 4 },
  roomCode: { fontFamily: 'monospace', fontSize: 40, fontWeight: 800, letterSpacing: 6, color: 'var(--gold)' },
  copyBtn: { marginTop: 8 },
  metaRow: { display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-end' },
  formatBadge: { padding: '6px 14px', borderRadius: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: 1 },
  metaChip: { padding: '4px 12px', borderRadius: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 13, color: 'var(--text-secondary)' },
  liveBadge: { padding: '4px 12px', borderRadius: 20, background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', fontSize: 13, color: 'var(--green)', fontFamily: 'var(--font-display)', fontWeight: 600, letterSpacing: 1 },
  infoPills: { display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 },
  pill: { padding: '6px 14px', borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border)', fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', letterSpacing: 0.5 },
  spectatorBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--radius)', marginBottom: 20, flexWrap: 'wrap' },
  sectionTitle: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 16 },
  myTeamBanner: { padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius)', marginBottom: 16, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  bannerHint: { color: 'var(--text-muted)', fontSize: 13, marginLeft: 'auto' },
  teamCard: { position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '20px 10px', borderRadius: 'var(--radius-lg)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)', transition: 'all 0.2s ease', overflow: 'hidden' },
  checkmark: { position: 'absolute', top: 8, right: 8, width: 24, height: 24, borderRadius: '50%', background: 'var(--gold)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800 },
  teamLogo: { width: 48, height: 48, objectFit: 'contain', marginBottom: 4 },
  teamShort: { fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16, color: 'var(--gold)', letterSpacing: 1 },
  teamName: { fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, textAlign: 'center', lineHeight: 1.2, color: 'var(--text-primary)' },
  teamPurse: { fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--gold)', fontWeight: 700, marginTop: 4 },
  teamOwner: { marginTop: 4, textAlign: 'center' },
  ownerBadge: { fontSize: 11, color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 600 },
  takenBadge: { fontSize: 11, color: 'var(--text-secondary)' },
  availableBadge: { fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' },
  errorText: { color: 'var(--red)', marginTop: 12 },
  joinLiveWrap: { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  activityBox: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20, marginTop: 24 },
  activityTitle: { fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 },
  terminal: { background: '#0a0a0f', borderRadius: 'var(--radius)', padding: 16, fontFamily: 'monospace', fontSize: 13, maxHeight: 200, overflowY: 'auto' },
  terminalLine: { padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', gap: 8, alignItems: 'center' },
  terminalTime: { color: 'var(--text-muted)', fontSize: 11, minWidth: 50 },
  terminalText: { color: 'var(--text-secondary)' },
}