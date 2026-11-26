import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subscribeRoom, placeBid, nextPlayer, setPaused, updateRoomSettings, restartAuction, restartPlayerList, endAuction, kickPlayer, joinAsSpectator, leaveSpectator } from '../utils/db.js'
import { ref, push, onValue, off, update } from 'firebase/database'
import { db } from '../firebase.js'
import { IPL_TEAMS } from '../data/teams.js'
import { bidSound, soldSound, unsoldSound, timerTickSound } from '../utils/sounds.js'
import Confetti from './Confetti.jsx'
import LoadingSpinner from './LoadingSpinner.jsx'
import AuctionTimer from './AuctionTimer.jsx'
import ChatPanel from './ChatPanel'

const ROLE_COLORS = {
  WK: { bg: 'rgba(147,51,234,0.2)', color: '#c084fc', label: 'Wicket-Keeper' },
  BAT: { bg: 'rgba(59,130,246,0.2)', color: '#93c5fd', label: 'Batsman' },
  BOWL: { bg: 'rgba(34,197,94,0.2)', color: '#86efac', label: 'Bowler' },
  AR: { bg: 'rgba(249,115,22,0.2)', color: '#fdba74', label: 'All-Rounder' }
}
const FORMAT_LABELS = { MEGA: 'Mega Auction', LEGENDS: 'Legends Auction', IPL2026: 'IPL 2026' }
const TIMER_OPTIONS = [5, 10, 15, 20, 25]

function formatPrice(lakhs) {
  if (!lakhs) return '0'
  if (lakhs >= 100) return `${(lakhs / 100).toFixed(lakhs % 100 === 0 ? 0 : 2)} Cr`
  return `${lakhs} L`
}

// ─── PLAYER AVATAR ──────────────────────────────────────────────────
function PlayerAvatar({ name, role, size = 'lg' }) {
  const [imgError, setImgError] = React.useState(false)
  const getInitials = (n) => {
    if (!n) return '?'
    const parts = n.split(' ').filter(Boolean)
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    return parts[0][0].toUpperCase()
  }
  const sizeStyles = { lg: { width: 72, height: 72, fontSize: 28 }, md: { width: 36, height: 36, fontSize: 14 }, sm: { width: 28, height: 28, fontSize: 12 } }
  const roleColor = ROLE_COLORS[role]?.color || '#888'
  const roleBg = ROLE_COLORS[role]?.bg || 'rgba(136,136,136,0.2)'
  const currentSize = sizeStyles[size] || sizeStyles.lg
  const photoUrl = name ? `https://scores.iplt20.com/ipl/playerimages/${name.trim().replace(/\s+/g, '-')}.png` : null
  if (photoUrl && !imgError) {
    return (
      <div style={{ width: currentSize.width, height: currentSize.height, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: roleBg, border: `2px solid ${roleColor}` }}>
        <img src={photoUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={() => setImgError(true)} />
      </div>
    )
  }
  return (
    <div style={{ width: currentSize.width, height: currentSize.height, borderRadius: '50%', background: roleBg, color: roleColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: currentSize.fontSize, flexShrink: 0, lineHeight: 1, border: `2px solid ${roleColor}` }}>
      {getInitials(name)}
    </div>
  )
}

// ─── STATS MODAL ─────────────────────────────────────────
function StatsModal({ room, teams, onClose }) {
  const [statsTab, setStatsTab] = useState('upcoming')
  const [search, setSearch] = useState('')
  const auctionLog = room.auctionLog ? Object.values(room.auctionLog) : []
  const soldPlayers = auctionLog.filter(l => l.soldTo).sort((a, b) => b.soldPrice - a.soldPrice)
  const unsoldPlayers = auctionLog.filter(l => !l.soldTo)
  const playedNamesSet = new Set(room.playedNames || [])
  const upcomingPlayers = (room.players || []).filter(p => !playedNamesSet.has(p.name))

  const filterBySearch = (list, key = 'name') =>
    search.trim() === '' ? list : list.filter(p => (p[key] || p.playerName || '').toLowerCase().includes(search.toLowerCase()))

  const upcomingFiltered = filterBySearch(upcomingPlayers)
  const upcomingBySets = {}
  upcomingFiltered.forEach(p => {
    const s = p.set || 'Other'
    if (!upcomingBySets[s]) upcomingBySets[s] = []
    upcomingBySets[s].push(p)
  })

  const TABS = [
    { id: 'upcoming', icon: '\uD83D\uDCCB', label: 'Upcoming', count: upcomingPlayers.length },
    { id: 'sold', icon: '\u2705', label: 'Sold', count: soldPlayers.length },
    { id: 'unsold', icon: '\u274C', label: 'Unsold', count: unsoldPlayers.length },
    { id: 'leaderboard', icon: '\uD83C\uDFC6', label: 'Leader', count: soldPlayers.length },
  ]

  return (
    <div style={SM.overlay} onClick={onClose}>
      <div style={SM.modalBox} onClick={e => e.stopPropagation()}>
        <div style={SM.modalHdr}>
          <span style={SM.modalTitle}>Auction Stats</span>
          <button style={SM.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
          <input
            style={{ width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' }}
            placeholder="🔍 Search players..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div style={SM.statTabBar}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...SM.statTabBtn, color: statsTab === t.id ? '#fff' : 'var(--text-muted)', borderBottom: statsTab === t.id ? '2px solid var(--gold)' : '2px solid transparent' }} onClick={() => setStatsTab(t.id)}>
              {t.icon} {t.label}
              <span style={{ marginLeft: 4, padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 700, background: statsTab === t.id ? 'var(--gold)' : 'var(--bg-elevated)', color: statsTab === t.id ? '#000' : 'var(--text-muted)' }}>{t.count}</span>
            </button>
          ))}
        </div>
        <div style={SM.statContent}>
          {statsTab === 'upcoming' && (
            <div>
              {upcomingFiltered.length === 0 && <div style={SM.empty}>\uD83C\uDFCF {search ? 'No players found' : 'All players auctioned!'}</div>}
              {Object.entries(upcomingBySets).map(([setName, players]) => (
                <div key={setName}>
                  <div style={SM.setHdr}><span style={SM.setName}>{setName}</span><span style={SM.setCnt}>{players.length} players</span></div>
                  <div style={SM.upGrid}>
                    {players.map((p, i) => (
                      <div key={i} style={SM.upCard}>
                        <PlayerAvatar name={p.name} role={p.role} size="md" />
                        <div style={SM.upName}>{p.name}</div>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', margin: '4px 0' }}>
                          <span style={{ ...SM.roleTag, background: ROLE_COLORS[p.role]?.bg, color: ROLE_COLORS[p.role]?.color }}>{p.role}</span>
                          {p.nationality === 'OS' && <span style={SM.osTag}>🌍 OS</span>}
                        </div>
                        <div style={SM.upPrice}>\u20B9{formatPrice(p.basePrice)} <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>Base</span></div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
          {statsTab === 'sold' && (
            <div>
              {filterBySearch(soldPlayers, 'playerName').length === 0 && <div style={SM.empty}>\u2705 No players found</div>}
              {filterBySearch(soldPlayers, 'playerName').map((p, i) => (
                <div key={i} style={SM.soldRow}>
                  <div style={{ flex: 1 }}>
                    <div style={SM.soldName}>{p.playerName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>→ {p.soldTo}</div>
                  </div>
                  <div style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 }}>\u20B9{formatPrice(p.soldPrice)}</div>
                </div>
              ))}
            </div>
          )}
          {statsTab === 'unsold' && (
            <div>
              {filterBySearch(unsoldPlayers, 'playerName').length === 0 && <div style={SM.empty}>\u274C No players found</div>}
              {filterBySearch(unsoldPlayers, 'playerName').map((p, i) => (
                <div key={i} style={SM.soldRow}>
                  <div style={SM.soldName}>{p.playerName}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Unsold</div>
                </div>
              ))}
            </div>
          )}
          {statsTab === 'leaderboard' && (
            <div>
              <div style={SM.lbSec}>\uD83C\uDFC6 Most Expensive Buys</div>
              {soldPlayers.slice(0, 10).map((p, i) => (
                <div key={i} style={SM.lbRow}>
                  <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', minWidth: 24, fontSize: 14 }}>#{i + 1}</span>
                  <span style={{ flex: 1, fontSize: 13 }}>{p.playerName}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginRight: 8 }}>{p.soldTo}</span>
                  <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontSize: 13 }}>\u20B9{formatPrice(p.soldPrice)}</span>
                </div>
              ))}
              <div style={{ ...SM.lbSec, marginTop: 20 }}>👥 Team Spending</div>
              {[...teams].sort((a, b) => (12000 - (b.purse || 12000)) - (12000 - (a.purse || 12000))).map(t => {
                const spent = 12000 - (t.purse || 12000)
                return (
                  <div key={t.id} style={SM.lbRow}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, minWidth: 50 }}>{t.shortName || t.id}</span>
                    <span style={{ flex: 1, fontSize: 12, color: 'var(--text-secondary)' }}>{t.ownerName || '-'}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)', marginRight: 8 }}>{(t.squad || []).length} pl</span>
                    <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontSize: 13 }}>\u20B9{formatPrice(spent)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── BID HISTORY MODAL ──────────────────────────────────────────────
function BidHistoryModal({ playerName, auctionLog, teams, onClose }) {
  const playerBids = auctionLog.filter(l => l.playerName === playerName)
  return (
    <div style={SM.overlay} onClick={onClose}>
      <div style={{ ...SM.modalBox, maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div style={SM.modalHdr}>
          <span style={SM.modalTitle}>Bid History: {playerName}</span>
          <button style={SM.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: 16, overflow: 'auto', maxHeight: 400 }}>
          {playerBids.length === 0 && <div style={SM.empty}>No bid history found</div>}
          {playerBids.map((b, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 14 }}>{b.soldTo || 'Unsold'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{b.time ? new Date(b.time).toLocaleTimeString() : '--'}</div>
              </div>
              <div style={{ color: b.soldTo ? 'var(--gold)' : 'var(--red)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                {b.soldTo ? `\u20B9${formatPrice(b.soldPrice)}` : 'UNSOLD'}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── IMPROVED CHAT PANEL ────────────────────────────────────────────────────
// ─── SETTINGS PANEL ───────────────────────────────────────────────────
function SettingsPanel({ room, roomId, isHost, myTeam, teams }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmRestart, setConfirmRestart] = useState(null)
  const bidTimer = room.bidTimer || 15
  const bidIncrement = room.bidIncrement || 5

  async function changeBidTimer(val) {
    if (!isHost) return
    setSaving(true)
    await updateRoomSettings(roomId, { bidTimer: val })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function changeIncrement(val) {
    if (!isHost) return
    setSaving(true)
    await updateRoomSettings(roomId, { bidIncrement: val })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function handleRestartFull() {
    if (!isHost) return
    setConfirmRestart(null); setSaving(true)
    await restartAuction(roomId)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function handleRestartList() {
    if (!isHost) return
    setConfirmRestart(null); setSaving(true)
    await restartPlayerList(roomId)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  async function handleKick(teamId, teamName) {
    if (!isHost) return
    if (!window.confirm(`Kick ${teamName} from the auction?`)) return
    await kickPlayer(roomId, teamId)
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 14px' }}>
      {!isHost && <div style={{ padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8, fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Only the host can change settings</div>}
      {saved && <div style={{ padding: '8px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 8, fontSize: 13, color: 'var(--green)', marginBottom: 12, textAlign: 'center' }}>\u2705 Settings updated!</div>}

      <div style={SP.settingRow}>
        <div style={SP.settingHdr}>
          <div><div style={SP.settingLabel}>🕐 Bid Timer</div><div style={SP.settingDesc}>Time allowed for each player auction</div></div>
          <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>{bidTimer}s</span>
        </div>
        <div style={SP.timerBtns}>
          {TIMER_OPTIONS.map(t => (
            <button key={t} style={{ ...SP.timerBtn, background: bidTimer === t ? '#7c3aed' : 'var(--bg-elevated)', color: bidTimer === t ? '#fff' : 'var(--text-secondary)', border: bidTimer === t ? '1px solid #7c3aed' : '1px solid var(--border)', opacity: !isHost ? 0.5 : 1 }} onClick={() => isHost && changeBidTimer(t)} disabled={!isHost || saving}>{t}s</button>
          ))}
        </div>
      </div>

      <div style={SP.settingRow}>
        <div style={SP.settingHdr}>
          <div><div style={SP.settingLabel}>\uD83D\uDCB0 Bid Increment</div><div style={SP.settingDesc}>Minimum raise amount per bid</div></div>
          <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16 }}>\u20B9{bidIncrement}L</span>
        </div>
        <div style={SP.timerBtns}>
          {[5, 10, 25, 50, 100].map(inc => (
            <button key={inc} style={{ ...SP.timerBtn, background: bidIncrement === inc ? '#7c3aed' : 'var(--bg-elevated)', color: bidIncrement === inc ? '#fff' : 'var(--text-secondary)', border: bidIncrement === inc ? '1px solid #7c3aed' : '1px solid var(--border)', opacity: !isHost ? 0.5 : 1 }} onClick={() => isHost && changeIncrement(inc)} disabled={!isHost || saving}>\u20B9{inc}L</button>
          ))}
        </div>
      </div>

      <div style={SP.settingRow}>
        <div style={SP.settingHdr}>
          <div><div style={SP.settingLabel}>\uD83C\uDFCF Auction Mode</div><div style={SP.settingDesc}>Cannot be changed mid-auction</div></div>
          <span style={{ padding: '4px 12px', borderRadius: 20, background: 'rgba(242,169,0,0.15)', color: 'var(--gold)', fontSize: 13, fontWeight: 600 }}>{FORMAT_LABELS[room.format] || room.format}</span>
        </div>
      </div>

      {isHost && (
        <div style={SP.settingRow}>
          <div style={SP.settingLabel}>👢 Kick Player</div>
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {teams.filter(t => t.ownerId && t.ownerId !== (room.hostName || room.host)).map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13 }}>{t.ownerName} ({t.shortName || t.id})</span>
                <button onClick={() => handleKick(t.id, t.ownerName)} style={{ padding: '4px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: 'var(--red)', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700 }}>KICK</button>
              </div>
            ))}
            {teams.filter(t => t.ownerId && t.ownerId !== (room.hostName || room.host)).length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No other players in room</div>
            )}
          </div>
        </div>
      )}

      {isHost && (
        <>
          <div style={{ marginTop: 8, marginBottom: 6, fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: 1, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Danger Zone</div>
          {confirmRestart === 'full' && (
            <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 'var(--radius-lg)', marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--red)', marginBottom: 8 }}>\u26A0\uFE0F This will reset ALL squads, purses and auction log. Are you sure?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--red)', border: 'none', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer' }} onClick={handleRestartFull}>Yes, Restart Everything</button>
                <button style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setConfirmRestart(null)}>Cancel</button>
              </div>
            </div>
          )}
          {confirmRestart === 'list' && (
            <div style={{ padding: '14px 16px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 'var(--radius-lg)', marginBottom: 10 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--red)', marginBottom: 8 }}>\u26A0\uFE0F This will restart the player list from the beginning (squads kept). Sure?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ flex: 1, padding: '8px', borderRadius: 8, background: 'var(--red)', border: 'none', color: '#fff', fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer' }} onClick={handleRestartList}>Yes, Restart List</button>
                <button style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' }} onClick={() => setConfirmRestart(null)}>Cancel</button>
              </div>
            </div>
          )}
          {!confirmRestart && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button style={{ padding: '10px 16px', borderRadius: 'var(--radius-lg)', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.35)', color: 'var(--red)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }} onClick={() => setConfirmRestart('full')} disabled={saving}>
                \uD83D\uDD04 Restart Full Auction
                <div style={{ fontWeight: 400, fontSize: 11, color: 'rgba(239,68,68,0.7)', marginTop: 3 }}>Resets all squads, purses and starts from player 1</div>
              </button>
              <button style={{ padding: '10px 16px', borderRadius: 'var(--radius-lg)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--red)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, cursor: 'pointer', textAlign: 'left' }} onClick={() => setConfirmRestart('list')} disabled={saving}>
                🔀 Restart Player List
                <div style={{ fontWeight: 400, fontSize: 11, color: 'rgba(239,68,68,0.7)', marginTop: 3 }}>Reshuffles & restarts player order (squads kept)</div>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── MAIN AUCTION ROOM MOBILE ────────────────────────────────────────────────
export default function AuctionRoomMobile() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const timeLeftRef = useRef(null)
  // Mobile: 'auction' shows left panel, 'tabs' shows right panel
  const [mobileView, setMobileView] = useState('auction')
  const [activeTab, setActiveTab] = useState('activity')
  const [showStats, setShowStats] = useState(false)
  const [showBidHistory, setShowBidHistory] = useState(null)
  const [squadFilter, setSquadFilter] = useState('ALL')
  const [expandedTeam, setExpandedTeam] = useState(null)
  const [lastBidSnapshot, setLastBidSnapshot] = useState(null)
  const [showRTM, setShowRTM] = useState(false)
  const [rtmTeam, setRtmTeam] = useState(null)
  const [showConfetti, setShowConfetti] = useState(false)
  const [flashType, setFlashType] = useState(null)
  const [bidPop, setBidPop] = useState(null)
  const [budgetWarning, setBudgetWarning] = useState(false)
  const [isSpectator, setIsSpectator] = useState(false)
  const [spectators, setSpectators] = useState([])
  // Inline chat toggle on mobile (shown below auction)
  const [showInlineChat, setShowInlineChat] = useState(false)
  const [inlineChatUnread, setInlineChatUnread] = useState(0)
  const lastMsgCountRef = useRef(0)

  const soldHandledRef = useRef(null) // used to avoid double-fire of sold/unsold
  const roomRef = useRef(null)
  const prevBidRef = useRef(null)
  const activityRef = useRef(null)
  const playerName = localStorage.getItem('playerName') || ''
  const isHost = !!(room && playerName && (room.hostName === playerName || room.host === playerName))

  const currentPlayer = room?.players?.[room?.currentPlayerIndex || 0]
  const teams = Object.values(room?.teams || {})
  const myTeam = teams.find(t => t.ownerId === playerName)
  const highestBidder = room?.currentHighestBidder
  const currentBid = room?.currentBid || 0
  const basePriceNum = currentPlayer?.basePrice || 0
  const nextBid = Math.max(basePriceNum, currentBid + (room?.bidIncrement || 5))
  const osCount = (myTeam?.squad || []).filter(p => p.nationality === 'OS').length
  const osLimit = room?.maxOverseas || 8
  const wouldExceedOS = currentPlayer?.nationality === 'OS' && osCount >= osLimit
  const canBid = myTeam && myTeam.purse >= nextBid && (!highestBidder || highestBidder?.teamId !== myTeam?.id) && !room?.paused && (myTeam.squad?.length || 0) < (room?.maxSquadSize || 25) && !wouldExceedOS && !isSpectator
  const auctionLog = room?.auctionLog ? Object.values(room.auctionLog).reverse() : []
  const progressPct = room?.players?.length ? Math.round(((room?.currentPlayerIndex || 0) / room.players.length) * 100) : 0
  const bidTimer = room?.bidTimer || 15
  const initialPurse = 12000

  // ── Track unread inline chat messages ──
  useEffect(() => {
    const chatRef = ref(db, `rooms/${roomId}/chat`)
    const unsub = onValue(chatRef, snap => {
      if (!snap.exists()) return
      const count = Object.keys(snap.val()).length
      if (mobileView === 'auction' && !showInlineChat && count > lastMsgCountRef.current) {
        setInlineChatUnread(prev => prev + (count - lastMsgCountRef.current))
      }
      lastMsgCountRef.current = count
    })
    return () => off(chatRef)
  }, [roomId, mobileView, showInlineChat])

  // Clear unread when chat opened
  useEffect(() => {
    if (showInlineChat) setInlineChatUnread(0)
  }, [showInlineChat])

  useEffect(() => {
    if (myTeam && myTeam.purse < initialPurse * 0.2 && myTeam.purse > 0) {
      setBudgetWarning(true)
      setTimeout(() => setBudgetWarning(false), 4000)
    }
  }, [myTeam?.purse])

  useEffect(() => {
    if (!room || !playerName) return
    const hasTeam = teams.some(t => t.ownerId === playerName)
    const isHostPlayer = room.hostName === playerName || room.host === playerName
    if (!hasTeam && !isHostPlayer) {
      setIsSpectator(true)
      joinAsSpectator(roomId, playerName)
    }
  }, [room?.teams, playerName])

  useEffect(() => {
    const specRef = ref(db, `rooms/${roomId}/spectators`)
    const unsub = onValue(specRef, snap => {
      if (snap.exists()) setSpectators(Object.values(snap.val()))
      else setSpectators([])
    })
    return () => off(specRef)
  }, [roomId])

  useEffect(() => {
    return () => { if (isSpectator) leaveSpectator(roomId, playerName) }
  }, [isSpectator])

  useEffect(() => {
    setLoading(true)
    const unsub = subscribeRoom(roomId, data => {
      if (!data) { navigate('/'); return }
      roomRef.current = data
      setRoom(data)
      setLoading(false)
      if (data.status === 'completed') navigate(`/squad/${roomId}`)
    })
    const loadingTimeout = setTimeout(() => setLoading(false), 8000)
    return () => { unsub(); clearTimeout(loadingTimeout) }
  }, [roomId])

  // ── ON SOLD callback for AuctionTimer ──
  const handleTimerSold = () => {
    if (!isHost) return
    const curIdx = room?.currentPlayerIndex ?? 0
    if (soldHandledRef.current === curIdx) return
    soldHandledRef.current = curIdx
    const hb = room?.currentHighestBidder
    const cb = room?.currentBid || 0
    const cp = room?.players?.[curIdx]
    if (cp) {
      if (cb > 0 && hb) {
        soldSound()
        setShowConfetti(true)
        setTimeout(() => setShowConfetti(false), 2500)
      } else {
        unsoldSound()
      }
      setTimeout(() => nextPlayer(roomId, hb || null, cb, cp), 500)
    }
  }


  useEffect(() => {
    if (room?.currentBid && room.currentBid !== prevBidRef.current) {
      prevBidRef.current = room.currentBid
      const bidEl = document.getElementById('current-bid-amount')
      if (bidEl) { bidEl.classList.remove('animate-pop'); void bidEl.offsetWidth; bidEl.classList.add('animate-pop') }
      setBidPop({ amount: room.currentBid, id: Date.now() })
      setTimeout(() => setBidPop(null), 1000)
      bidSound()
    }
  }, [room?.currentBid])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); if (canBid && !room?.paused) handleBid() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canBid, room?.paused])

  useEffect(() => {
    if (!currentPlayer || !highestBidder) { setShowRTM(false); return }
    const eligibleTeam = teams.find(t => {
      if (t.rtmUsed) return false
      if (t.id === highestBidder.teamId) return false
      return (t.retainedPlayers || []).includes(currentPlayer.name)
    })
    if (eligibleTeam) { setShowRTM(true); setRtmTeam(eligibleTeam) }
    else setShowRTM(false)
  }, [highestBidder, currentPlayer])

  useEffect(() => {
    if (activeTab === 'activity' && activityRef.current) {
      activityRef.current.scrollTop = activityRef.current.scrollHeight
    }
  }, [auctionLog, activeTab])

  if (loading) return <div style={S.loading}>Loading auction...</div>

  async function handleUndoBid() {
    if (!isHost || !lastBidSnapshot) return
    await updateRoomSettings(roomId, lastBidSnapshot)
    setLastBidSnapshot(null)
    const toast = document.createElement('div')
    toast.textContent = 'Bid undone \u2705'
    toast.style.cssText = 'position:fixed;bottom:20px;right:20px;padding:10px 20px;background:var(--green);color:#000;border-radius:8px;font-family:var(--font-display);font-weight:700;z-index:999;'
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 2000)
  }

  async function handleBid() {
    if (!canBid || !myTeam || isSpectator) return
    if (isHost) setLastBidSnapshot({ currentHighestBidder: room.currentHighestBidder, currentBid: room.currentBid, lastBidTime: room.lastBidTime })
    await placeBid(roomId, myTeam.id, myTeam.name, nextBid)
  }

  async function handleSold() {
    if (!isHost || !currentPlayer) return
    const curIdx = room?.currentPlayerIndex ?? 0
    soldHandledRef.current = curIdx
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 2500)
    soldSound()
    await nextPlayer(roomId, highestBidder, currentBid, currentPlayer)
  }

  async function handleUnsold() {
    if (!isHost || !currentPlayer) return
    const curIdx = room?.currentPlayerIndex ?? 0
    soldHandledRef.current = curIdx
    unsoldSound()
    await nextPlayer(roomId, null, 0, currentPlayer)
  }

  async function handleQuickBid(amountL) {
    if (!canBid || !myTeam || isSpectator) return
    const baseAmount = Math.max(basePriceNum, currentBid)
    const quickBidAmount = baseAmount + amountL
    if (myTeam.purse < quickBidAmount) return
    if (isHost) setLastBidSnapshot({ currentHighestBidder: room.currentHighestBidder, currentBid: room.currentBid, lastBidTime: room.lastBidTime })
    await placeBid(roomId, myTeam.id, myTeam.name, quickBidAmount)
  }

  async function handleUseRTM() {
    if (!rtmTeam || !highestBidder || !currentPlayer) return
    await update(ref(db, `rooms/${roomId}/teams/${rtmTeam.id}`), { rtmUsed: true })
    await placeBid(roomId, rtmTeam.id, rtmTeam.name, currentBid)
    setShowRTM(false)
    soldSound()
  }

  async function handleEndAuction() {
    if (!isHost) return
    if (!window.confirm('End auction for everyone?')) return
    try {
      await endAuction(roomId)
      navigate('/squad/' + roomId)
    } catch (err) {
      alert('Error ending auction: ' + err.message)
    }
  }

  const displayTime = room.paused ? (room.pausedTimeLeft ?? bidTimer) : Math.max(0, timeLeftRef.current ?? bidTimer)

  // ── FIXED: blink only at <= 1 second ──
  const shouldBlink = !room.paused && displayTime <= 1 && canBid

  const TABS = [
    { id: 'activity', label: '\uD83D\uDCCB', full: 'Activi' },
    { id: 'squad', label: '\uD83D\uDC64', full: 'My Squ' },
    { id: 'teams', label: '\uD83C\uDFCF', full: 'Teams' },
    { id: 'chat', label: '\uD83D\uDCAC', full: 'Chat' },
    { id: 'settings', label: '\u2699\uFE0F', full: 'Settin' },
  ]

  // ── LEFT PANEL CONTENT ──
  const LeftPanel = React.memo(() => (
    <div style={S.left} className="auction-left">
      {currentPlayer ? (
        <>
          {room.paused && <div style={S.pausedBanner}>⏸ AUCTION PAUSED — Waiting for host to resume</div>}

          <div style={S.setBar}>
            <span style={S.animatedDot} />
            <span style={S.setLabel}>{currentPlayer.set || 'MARQUEE SET 1'}</span>
          </div>

          {/* Player Card */}
          <div key={currentPlayer.name} style={{ ...S.playerCard, borderColor: ROLE_COLORS[currentPlayer.role]?.color || 'rgba(242,169,0,0.15)', boxShadow: `0 0 20px ${ROLE_COLORS[currentPlayer.role]?.color || 'rgba(242,169,0,0.15)'}` }} className="animate-card-in">
            {flashType && <div style={{ position: 'absolute', inset: 0, animation: flashType === 'sold' ? 'greenFlash 0.5s forwards' : 'redFlash 0.5s forwards', borderRadius: 'var(--radius-lg)', zIndex: 1 }} />}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
              <PlayerAvatar name={currentPlayer.name} role={currentPlayer.role} size="lg" />
            </div>
            <h1 style={S.playerName}>{currentPlayer.name}</h1>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
              <span style={{ ...S.roleBadge, background: ROLE_COLORS[currentPlayer.role]?.bg, color: ROLE_COLORS[currentPlayer.role]?.color }}>{ROLE_COLORS[currentPlayer.role]?.label || currentPlayer.role}</span>
              {currentPlayer.nationality === 'OS' && <span style={S.osBadge}>🌍 OVERSEAS</span>}
            </div>
            <div style={S.nationality}>{currentPlayer.nationality === 'OS' ? '🌍 Overseas' : '🇮🇳 India'}</div>
            {(currentPlayer.matches || currentPlayer.runs || currentPlayer.wickets) && (
              <div style={S.statsRow}>
                {currentPlayer.matches && <span>{currentPlayer.matches} Matches</span>}
                {currentPlayer.runs && <span>{currentPlayer.runs} Runs</span>}
                {currentPlayer.wickets && <span>{currentPlayer.wickets} Wickets</span>}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={S.basePrice}>BASE: <strong>\u20B9{formatPrice(basePriceNum)}</strong></div>
              <button onClick={() => setShowBidHistory(currentPlayer.name)} style={{ fontSize: 11, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>\uD83D\uDCCB History</button>
            </div>
          </div>

          {/* Current Bid Section — no blinking here, just static */}
          <div style={S.bidSection}>
            <div style={S.bidLabel}>CURRENT BID</div>
            <div id="current-bid-amount" style={{ ...S.bidAmount, color: currentBid > 0 ? 'var(--gold)' : 'var(--text-muted)' }}>
              {currentBid > 0 ? `\u20B9${formatPrice(currentBid)}` : '—'}
            </div>
            {highestBidder && (
              <div style={S.leadingTeam}>
                <img src={IPL_TEAMS.find(t => t.id === highestBidder.teamId)?.logo} style={S.leadingLogo} onError={e => e.target.style.display = 'none'} />
                <span>Leading: <strong>{highestBidder.teamName}</strong></span>
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6, fontFamily: 'var(--font-display)' }}>{auctionLog.length} bid{auctionLog.length !== 1 ? 's' : ''} placed</div>
            <div style={S.bidHistory}>
              {auctionLog.slice(0, 3).reverse().map((log, i) => (
                <div key={i} style={S.bidHistoryPill}>
                  <img src={IPL_TEAMS.find(t => t.id === log.teamId)?.logo} style={S.historyLogo} onError={e => e.target.style.display = 'none'} />
                  <span>\u20B9{formatPrice(log.bid || log.soldPrice)}</span>
                </div>
              ))}
            </div>
          </div>

          <AuctionTimer bidTimer={bidTimer} paused={room?.paused} timerEndsAt={room?.timerEndsAt} room={room} onTick={(left) => {
    if (left === 1 && !room?.paused) timerTickSound()
    if (left <= 0 && !room?.paused && isHost) {
      const curIdx = room?.currentPlayerIndex ?? 0
      if (soldHandledRef.current === curIdx) return
      soldHandledRef.current = curIdx
      const hb = room?.currentHighestBidder
      const cb = room?.currentBid || 0
      const cp = room?.players?.[curIdx]
      if (!cp) return
      if (cb > 0 && hb) { soldSound(); setShowConfetti(true); setTimeout(() => setShowConfetti(false), 2500) }
      else { unsoldSound() }
      setTimeout(() => nextPlayer(roomId, hb || null, cb, cp), 800)
    }
  }} />

          {/* Quick Bid Buttons */}
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, overflowX: 'auto', paddingBottom: 2, WebkitOverflowScrolling: 'touch' }}>
            {[5, 10, 25, 50, 100].map(val => (
              <button key={val} style={{ ...S.quickBidBtn, minWidth: 54, flexShrink: 0 }} onClick={() => handleQuickBid(val)} disabled={!canBid || room.paused || isSpectator}>+{val}L</button>
            ))}
          </div>

          {/* Main Bid Button or Spectator */}
          {isSpectator ? (
            <div style={{ padding: '12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10, textAlign: 'center', color: '#93c5fd', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700 }}>
              👁️ SPECTATOR — Watching Only
            </div>
          ) : (
            <>
              <button
                className="btn btn-gold btn-lg"
                style={{
                  width: '100%',
                  marginTop: 4,
                  animation: !room?.paused && timeLeftRef.current === 1 && canBid ? 'pulse 0.6s infinite' : 'none',
                  boxShadow: !room?.paused && timeLeftRef.current === 1 && canBid ? '0 0 20px var(--gold)' : 'none'
                }}
                disabled={!canBid || room.paused}
                onClick={handleBid}
              >
                BID \u20B9{formatPrice(nextBid)}
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 4 }}>Press <kbd style={S.kbd}>SPACE</kbd> to bid</div>
              {!canBid && myTeam && (
                <div style={S.disabledMsg}>
                  {myTeam.purse < nextBid ? "CAN'T AFFORD" : (myTeam.squad?.length || 0) >= (room.maxSquadSize || 25) ? "SQUAD FULL" : wouldExceedOS ? "OS LIMIT REACHED" : ""}
                </div>
              )}
            </>
          )}

          {showRTM && rtmTeam && (
            <div style={S.rtmCard}>
              <div style={S.rtmTitle}>🃏 RTM Available!</div>
              <div style={S.rtmTeam}><img src={rtmTeam.logo} style={S.rtmLogo} onError={e => e.target.style.display = 'none'} /><span>{rtmTeam.name} can use RTM</span></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button style={S.rtmUseBtn} onClick={handleUseRTM}>Use RTM</button>
                <button style={S.rtmSkipBtn} onClick={() => setShowRTM(false)}>Skip</button>
              </div>
              <div style={S.rtmTimer}>10s to decide...</div>
            </div>
          )}

          {myTeam && (
            <div style={S.purseDisplay}>
              <div style={S.purseHeader}>
                <span>My Purse</span>
                <span style={{ ...S.purseAmount, color: myTeam.purse < initialPurse * 0.2 ? 'var(--red)' : 'var(--gold)' }}>\u20B9{formatPrice(myTeam.purse)}</span>
              </div>
              <div style={S.purseBar}><div style={{ ...S.purseBarFill, width: `${((initialPurse - (myTeam.purse || initialPurse)) / initialPurse) * 100}%` }} /></div>
              <div style={S.purseSpent}>Spent: \u20B9{formatPrice(initialPurse - (myTeam.purse || initialPurse))}</div>
            </div>
          )}

          {myTeam && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-card)', border: '1px solid rgba(242,169,0,0.3)', borderRadius: 'var(--radius)', display: 'flex', gap: 8, flexWrap: 'wrap', flexShrink: 0, justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                \uD83D\uDCCB <strong style={{ color: (myTeam.squad?.length || 0) >= (room.minSquadSize || 15) ? 'var(--green)' : 'var(--gold)' }}>{myTeam.squad?.length || 0}</strong>/{room.minSquadSize || 15}–{room.maxSquadSize || 25}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>
                🌍 <strong style={{ color: osCount >= osLimit ? 'var(--red)' : 'var(--text-secondary)' }}>{osCount}</strong>/{osLimit}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>\uD83D\uDCB0 \u20B9{formatPrice(myTeam.purse || 0)}</span>
            </div>
          )}

          {/* ── INLINE CHAT (mobile only, below auction content) ── */}
          <div className="inline-chat-section" style={{ flexShrink: 0, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', marginTop: 4 }}>
            {/* Chat toggle header */}
            <button
              onClick={() => setShowInlineChat(v => !v)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--bg-secondary)', border: 'none', borderBottom: showInlineChat ? '1px solid var(--border)' : 'none', cursor: 'pointer', color: 'var(--text-primary)' }}
            >
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1 }}>
                \uD83D\uDCAC LIVE CHAT
                {inlineChatUnread > 0 && (
                  <span style={{ marginLeft: 8, background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: 10, fontWeight: 700 }}>{inlineChatUnread}</span>
                )}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{showInlineChat ? '▲' : '▼'}</span>
            </button>
            <div style={{display: showInlineChat ? 'block' : 'none'}}><ChatPanel roomId={roomId} playerName={playerName} myTeam={myTeam} isHost={isHost} compact={true} /></div>
          </div>

        </>
      ) : (
        <div style={S.auctionComplete}>
          <div style={S.completeIcon}>\uD83C\uDFC6</div>
          <h2 style={S.completeTitle}>Auction Complete!</h2>
          <p style={S.completeText}>All players have been auctioned.</p>
          <button className="btn btn-gold btn-lg" onClick={() => navigate(`/squad/${roomId}`)}>View Squads →</button>
        </div>
      )}
    </div>
  ), () => true)

  // ── RIGHT PANEL CONTENT ──
  const RightPanel = React.memo(() => (
    <div style={S.right} className="auction-right">
      {/* Tab bar */}
      <div style={S.tabBar}>
        {TABS.map(({ id, label, full }) => (
          <button
            key={id}
            style={{
              ...S.tabBtn,
              borderBottom: activeTab === id ? '2px solid var(--gold)' : '2px solid transparent',
              color: activeTab === id ? 'var(--text-primary)' : 'var(--text-muted)',
              background: activeTab === id ? 'rgba(242,169,0,0.07)' : 'none',
            }}
            onClick={() => setActiveTab(id)}
            title={full}
          >
            <span className="tab-icon">{label}</span>
            <span className="tab-label">{full}</span>
          </button>
        ))}
      </div>

      <div style={S.tabContent}>
        {activeTab === 'activity' && (
          <div ref={activityRef} style={S.activityTab}>
            {auctionLog.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>Auction just started...</p>}
            {auctionLog.map((log, i) => {
              const team = teams.find(t => t.id === log.teamId)
              return (
                <div key={i} className="animate-slide-in" style={{ ...S.activityItem, borderLeft: log.soldTo ? '3px solid var(--green)' : '3px solid var(--red)', background: log.soldTo ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)' }}>
                  <img src={team?.logo} style={S.activityLogo} onError={e => e.target.style.display = 'none'} />
                  <div style={{ flex: 1 }}>
                    <div style={S.activityPlayer}>{log.playerName}</div>
                    <div style={S.activityDetail}>
                      {log.soldTo ? (<>Sold to <strong>{log.soldTo}</strong> <span style={S.activityPrice}>\u20B9{formatPrice(log.soldPrice)}</span></>) : (<span style={{ color: 'var(--text-muted)' }}>Unsold</span>)}
                    </div>
                  </div>
                  <div style={S.activityTime}>{log.time ? new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}</div>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'squad' && (
          <div style={S.squadTab}>
            {!myTeam && !isSpectator ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>You don't own a team</p>
            ) : isSpectator ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 24 }}>👁️ Spectator mode — pick a team to bid</p>
            ) : (
              <>
                <div style={S.roleFilters}>
                  {['ALL', 'WK', 'BAT', 'AR', 'BOWL'].map(role => (
                    <button key={role} style={{ ...S.roleFilterBtn, background: squadFilter === role ? 'var(--gold)' : 'var(--bg-elevated)', color: squadFilter === role ? '#000' : 'var(--text-secondary)' }} onClick={() => setSquadFilter(role)}>{role}</button>
                  ))}
                </div>
                <div style={S.budgetTracker}>
                  <div style={S.budgetHeader}>
                    <span>Spent: \u20B9{formatPrice(initialPurse - (myTeam.purse || initialPurse))}</span>
                    <span>Left: \u20B9{formatPrice(myTeam.purse || 0)}</span>
                  </div>
                  <div style={S.budgetBars}>
                    {['WK', 'BAT', 'AR', 'BOWL'].map(role => {
                      const spent = (myTeam.squad || []).filter(p => p.role === role).reduce((sum, p) => sum + (p.soldPrice || 0), 0)
                      return (
                        <div key={role} style={S.budgetBarItem}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', width: 30 }}>{role}</div>
                          <div style={S.budgetBar}><div style={{ ...S.budgetBarFill, width: `${Math.min(100, (spent / initialPurse) * 100)}%`, background: ROLE_COLORS[role]?.color || 'var(--gold)' }} /></div>
                          <div style={{ fontSize: 10, color: 'var(--text-secondary)', width: 40, textAlign: 'right' }}>\u20B9{formatPrice(spent)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ flex: 1, overflow: 'auto' }}>
                  {(myTeam.squad || []).filter(p => squadFilter === 'ALL' || p.role === squadFilter).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: 13 }}>No players purchased yet</div>
                  ) : (
                    (myTeam.squad || []).filter(p => squadFilter === 'ALL' || p.role === squadFilter).map((p, i) => (
                      <div key={i} style={S.squadPlayer}>
                        <PlayerAvatar name={p.name} role={p.role} size="sm" />
                        <div style={S.squadPlayerInfo}>
                          <div style={S.squadPlayerName}>{p.name}</div>
                          <div style={{ fontSize: 11, color: ROLE_COLORS[p.role]?.color }}>{ROLE_COLORS[p.role]?.label}</div>
                        </div>
                        <div style={S.squadPlayerPrice}>\u20B9{formatPrice(p.soldPrice)}</div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'teams' && (
          <div style={S.teamsTab}>
            {teams.map(team => (
              <div key={team.id} style={S.teamItem}>
                <div style={S.teamHeader} onClick={() => setExpandedTeam(expandedTeam === team.id ? null : team.id)}>
                  <img src={team.logo || IPL_TEAMS.find(t => t.id === team.id)?.logo} style={S.teamLogoSmall} onError={e => e.target.style.display = 'none'} />
                  <span style={S.teamName}>{team.name}</span>
                  <span style={S.teamPurse}>\u20B9{formatPrice(team.purse)}</span>
                  <span style={S.teamCount}>{(team.squad || []).length} pl</span>
                </div>
                {expandedTeam === team.id && (
                  <div style={S.teamSquad}>
                    {(team.squad || []).length === 0 && <div style={{ padding: 8, color: 'var(--text-muted)', fontSize: 12 }}>No players yet</div>}
                    {(team.squad || []).map(p => (
                      <div key={p.name} style={S.teamSquadPlayer}>
                        <span style={{ fontSize: 12 }}>{p.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--gold)' }}>\u20B9{formatPrice(p.soldPrice)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{display: activeTab === 'chat' ? 'flex' : 'none', flex:1, flexDirection:'column', overflow:'hidden'}}><ChatPanel roomId={roomId} playerName={playerName} myTeam={myTeam} isHost={isHost} /></div>
        {activeTab === 'settings' && <SettingsPanel room={room} roomId={roomId} isHost={isHost} myTeam={myTeam} teams={teams} />}
      </div>
    </div>
  ), () => true)

  return (
    <div style={{ height: '100dvh', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{`
        @keyframes cardSlideIn {
          0% { opacity:0; transform:translateY(20px) scale(0.96); }
          100% { opacity:1; transform:translateY(0) scale(1); }
        }
        @keyframes slideIn {
          0% { opacity:0; transform:translateX(20px); }
          100% { opacity:1; transform:translateX(0); }
        }
        @keyframes pulse {
          0%,100% { opacity:1; box-shadow: 0 0 0 var(--gold); }
          50% { opacity:0.7; box-shadow: 0 0 20px var(--gold); }
        }
        
        .animate-slide-in { animation: slideIn 0.3s ease-out forwards; }
        .animate-pop { animation: pulse 0.4s ease-out forwards; }
      `}</style>

      {showConfetti && <Confetti duration={2500} />}

      {budgetWarning && myTeam && (
        <div style={{ position: 'fixed', top: 70, left: '50%', transform: 'translateX(-50%)', zIndex: 500, background: 'rgba(239,68,68,0.95)', color: '#fff', padding: '10px 20px', borderRadius: 10, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'slideIn 0.3s ease', whiteSpace: 'nowrap' }}>
          \u26A0\uFE0F LOW PURSE! Only \u20B9{formatPrice(myTeam.purse)} remaining
        </div>
      )}

      {isSpectator && (
        <div style={{ background: 'rgba(59,130,246,0.9)', color: '#fff', padding: '6px 16px', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
          👁️ SPECTATOR MODE
          {spectators.length > 0 && <span style={{ marginLeft: 10, opacity: 0.8 }}>({spectators.length} watching)</span>}
        </div>
      )}

      <style>{`
        

        /* ── DESKTOP: side by side ── */
        .auction-main { display: flex; flex-direction: row; }
        .auction-left { display: flex !important; flex: 1; max-width: 520px; min-width: 300px; }
        .auction-right { display: flex !important; width: 340px; min-width: 280px; }

        /* Tab label full text on desktop, icon only on mobile */
        .tab-icon { display: none; }
        .tab-label { display: inline; font-size: 11px; }

        /* Inline chat: hidden on desktop, shown on mobile */
        .inline-chat-section { display: none; }

        /* ── MOBILE (<=700px) ── */
        @media (max-width: 700px) {
          .auction-main { flex-direction: column !important; }

          .auction-left {
            max-width: 100% !important;
            min-width: unset !important;
            width: 100% !important;
            display: ${mobileView === 'auction' ? 'flex' : 'none'} !important;
            overflow-y: auto;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 66px !important;
          }

          .auction-right {
            width: 100% !important;
            min-width: unset !important;
            border-left: none !important;
            border-top: 1px solid var(--border);
            display: ${mobileView === 'tabs' ? 'flex' : 'none'} !important;
            flex: 1;
            /* fill remaining space above bottom nav */
            height: calc(100vh - 50px - 58px);
            overflow: hidden;
          }

          /* Show inline chat on mobile */
          .inline-chat-section { display: block !important; }

          .tab-icon { display: inline; font-size: 18px; }
          .tab-label { display: block; font-size: 9px; margin-top: 1px; font-family: var(--font-display); font-weight: 700; letter-spacing: 0.5px; }
        }
      `}</style>

      {/* TOP BAR */}
      <div style={S.topBar}>
        <div style={S.topLeft}>
          <span style={S.roomCode}>Room: <strong>{roomId}</strong></span>
          <span style={S.formatBadge}>{FORMAT_LABELS[room.format]}</span>
          {spectators.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-display)' }}>👁️ {spectators.length}</span>}
        </div>
        <div style={S.topCenter}>
          <span style={S.playerCount}>{(room.playedNames || []).length}/{room.players?.length || 0} auctioned</span>
          <div style={S.progressBar}><div style={{ ...S.progressFill, width: `${progressPct}%` }} /></div>
        </div>
        <div style={S.topRight}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowStats(true)}>📊</button>
          {isHost && (
            <>
              <button className="btn btn-sm" style={{ ...S.undoBtn, opacity: lastBidSnapshot ? 1 : 0.4 }} onClick={handleUndoBid} disabled={!lastBidSnapshot}>↩</button>
              <button className={`btn btn-sm ${room.paused ? 'btn-green' : 'btn-ghost'}`} onClick={() => setPaused(roomId, !room.paused)}>{room.paused ? '▶' : '⏸'}</button>
              <button className="btn btn-sm btn-red" onClick={handleEndAuction}>🏁</button>
            </>
          )}
        </div>
      </div>

      {/* MAIN: left + right */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }} className="auction-main">
        <LeftPanel />
        <RightPanel />
      </div>

      {/* ── MOBILE BOTTOM NAV BAR ── */}
      <style>{`
        .mobile-bottom-nav { display: none; }
        @media (max-width: 700px) {
          .mobile-bottom-nav {
            display: flex;
            position: fixed;
            bottom: 0; left: 0; right: 0;
            z-index: 200;
            background: var(--bg-secondary);
            border-top: 2px solid var(--border);
            height: 58px;
            align-items: stretch;
          }
        }
      `}</style>

      <div className="mobile-bottom-nav">
        {/* Auction tab */}
        <button
          onClick={() => setMobileView('auction')}
          style={{
            flex: 1,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: mobileView === 'auction' ? 'rgba(242,169,0,0.12)' : 'none',
            border: 'none',
            borderTop: mobileView === 'auction' ? '2px solid var(--gold)' : '2px solid transparent',
            color: mobileView === 'auction' ? 'var(--gold)' : 'var(--text-muted)',
            cursor: 'pointer', gap: 1, padding: '4px 0',
          }}
        >
          <span style={{ fontSize: 20 }}>\uD83C\uDFCF</span>
          <span style={{ fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 0.5 }}>AUCTION</span>
        </button>

        {/* Right panel tabs */}
        {[
          { id: 'activity', label: '\uD83D\uDCCB', full: 'ACTIVI' },
          { id: 'squad', label: '\uD83D\uDC64', full: 'MY SQU' },
          { id: 'teams', label: '\uD83C\uDFCF', full: 'TEAMS' },
          { id: 'chat', label: '\uD83D\uDCAC', full: 'CHAT' },
          { id: 'settings', label: '\u2699\uFE0F', full: 'SETTIN' },
        ].map(({ id, label, full }) => (
          <button
            key={id}
            onClick={() => { setMobileView('tabs'); setActiveTab(id) }}
            style={{
              flex: 1,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              background: mobileView === 'tabs' && activeTab === id ? 'rgba(242,169,0,0.12)' : 'none',
              border: 'none',
              borderTop: mobileView === 'tabs' && activeTab === id ? '2px solid var(--gold)' : '2px solid transparent',
              color: mobileView === 'tabs' && activeTab === id ? 'var(--gold)' : 'var(--text-muted)',
              cursor: 'pointer', gap: 1, padding: '4px 0', position: 'relative',
            }}
          >
            <span style={{ fontSize: 18 }}>{label}</span>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 0.5 }}>{full}</span>
            {/* Unread badge for chat tab */}
            {id === 'chat' && inlineChatUnread > 0 && mobileView !== 'tabs' && (
              <span style={{ position: 'absolute', top: 4, right: '18%', background: 'var(--red)', color: '#fff', borderRadius: 10, padding: '0px 5px', fontSize: 9, fontWeight: 700, minWidth: 16, textAlign: 'center' }}>{inlineChatUnread}</span>
            )}
          </button>
        ))}
      </div>

      {showStats && <StatsModal room={room} teams={teams} onClose={() => setShowStats(false)} />}
      {showBidHistory && <BidHistoryModal playerName={showBidHistory} auctionLog={auctionLog} teams={teams} onClose={() => setShowBidHistory(null)} />}
    </div>
  )
}

// ─── STYLES ───────────────────────────────────────────────────────────
const S = {
  page: { height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  loading: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 6 },
  topLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  roomCode: { fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-secondary)' },
  formatBadge: { padding: '3px 8px', borderRadius: 20, background: 'rgba(242,169,0,0.15)', color: 'var(--gold)', fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600 },
  topCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, flex: 1 },
  playerCount: { fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--text-secondary)', letterSpacing: 0.5 },
  progressBar: { width: 160, height: 3, background: 'var(--bg-elevated)', borderRadius: 2 },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, var(--gold), var(--green))', borderRadius: 2, transition: 'width 0.5s' },
  topRight: { display: 'flex', gap: 6, alignItems: 'center' },
  undoBtn: { background: 'rgba(242,169,0,0.15)', border: '1px solid rgba(242,169,0,0.3)', color: 'var(--gold)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, cursor: 'pointer', padding: '6px 10px', borderRadius: 6 },
  left: { flex: 1, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7, overflow: 'auto', maxWidth: 520, minWidth: 300 },
  right: { width: 340, minWidth: 280, borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 },
  pausedBanner: { width: '100%', padding: '7px 14px', background: 'rgba(239,68,68,0.9)', color: '#fff', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, textAlign: 'center', borderRadius: 'var(--radius)', letterSpacing: 1, flexShrink: 0 },
  setBar: { display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', background: 'var(--bg-elevated)', borderRadius: 8, flexShrink: 0 },
  animatedDot: { width: 9, height: 9, borderRadius: '50%', background: 'var(--gold)', display: 'inline-block', animation: 'pulse 1.5s infinite', boxShadow: '0 0 8px var(--gold)', flexShrink: 0 },
  setLabel: { fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: 2, color: 'var(--gold)', textTransform: 'uppercase', fontWeight: 700 },
  playerCard: { background: 'var(--bg-card)', border: '1px solid rgba(242,169,0,0.15)', borderRadius: 'var(--radius-lg)', padding: '14px', position: 'relative', flexShrink: 0 },
  playerName: { fontFamily: 'var(--font-display)', fontSize: 'clamp(22px,5vw,36px)', fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1, marginBottom: 8 },
  roleBadge: { padding: '3px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'var(--font-display)', fontWeight: 600 },
  osBadge: { padding: '3px 9px', borderRadius: 6, fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, background: 'rgba(168,85,247,0.2)', color: '#d8b4fe', letterSpacing: 1 },
  nationality: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 },
  statsRow: { display: 'flex', gap: 10, marginBottom: 7, fontSize: 11, color: 'var(--text-secondary)', flexWrap: 'wrap' },
  basePrice: { fontFamily: 'var(--font-display)', fontSize: 13, color: 'var(--text-secondary)', letterSpacing: 1 },
  bidSection: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px', textAlign: 'center', flexShrink: 0 },
  bidLabel: { fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase' },
  bidAmount: { fontFamily: 'var(--font-display)', fontSize: 38, fontWeight: 800, lineHeight: 1, marginBottom: 6 },
  leadingTeam: { display: 'flex', alignItems: 'center', gap: 7, justifyContent: 'center', fontSize: 13, color: 'var(--text-secondary)' },
  leadingLogo: { width: 18, height: 18, borderRadius: '50%' },
  bidHistory: { display: 'flex', gap: 5, justifyContent: 'center', marginTop: 7, flexWrap: 'wrap' },
  bidHistoryPill: { display: 'flex', alignItems: 'center', gap: 4, padding: '2px 7px', background: 'var(--bg-card)', borderRadius: 20, fontSize: 11, color: 'var(--text-secondary)' },
  historyLogo: { width: 13, height: 13, borderRadius: '50%' },
  quickBidBtn: { flex: 1, padding: '7px 4px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, cursor: 'pointer', textAlign: 'center', flexShrink: 0 },
  kbd: { padding: '2px 5px', borderRadius: 4, background: 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 10, fontFamily: 'monospace' },
  disabledMsg: { marginTop: 4, textAlign: 'center', fontSize: 12, color: 'var(--red)', fontFamily: 'var(--font-display)', fontWeight: 700 },
  rtmCard: { padding: 11, background: 'rgba(242,169,0,0.1)', border: '1px solid rgba(242,169,0,0.3)', borderRadius: 'var(--radius-lg)', flexShrink: 0 },
  rtmTitle: { fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 5 },
  rtmTeam: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, marginBottom: 3 },
  rtmLogo: { width: 22, height: 22, borderRadius: '50%' },
  rtmUseBtn: { flex: 1, padding: '7px', borderRadius: 8, background: 'var(--gold)', border: 'none', color: '#000', fontFamily: 'var(--font-display)', fontWeight: 700, cursor: 'pointer' },
  rtmSkipBtn: { padding: '7px 11px', borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' },
  rtmTimer: { fontSize: 11, color: 'var(--text-muted)', marginTop: 3, textAlign: 'center' },
  purseDisplay: { padding: 11, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', flexShrink: 0 },
  purseHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 },
  purseAmount: { fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15 },
  purseBar: { height: 5, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' },
  purseBarFill: { height: '100%', background: 'linear-gradient(90deg, var(--green), var(--gold))', borderRadius: 4, transition: 'width 0.5s' },
  purseSpent: { marginTop: 3, fontSize: 11, color: 'var(--text-secondary)' },
  auctionComplete: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, textAlign: 'center' },
  completeIcon: { fontSize: 52, marginBottom: 12 },
  completeTitle: { fontFamily: 'var(--font-display)', fontSize: 28, marginBottom: 8 },
  completeText: { color: 'var(--text-secondary)', marginTop: 8 },
  tabBar: { display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto' },
  tabBtn: { flex: 1, padding: '10px 4px', cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, border: 'none', transition: 'all 0.2s', whiteSpace: 'nowrap', minWidth: 50 },
  tabContent: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  activityTab: { flex: 1, overflow: 'auto', padding: 12 },
  activityItem: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 9px', borderBottom: '1px solid var(--border)', marginBottom: 3, borderRadius: 6 },
  activityLogo: { width: 22, height: 22, borderRadius: '50%', flexShrink: 0 },
  activityPlayer: { fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 13 },
  activityDetail: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 },
  activityPrice: { color: 'var(--gold)', marginLeft: 7, fontFamily: 'var(--font-display)' },
  activityTime: { fontSize: 10, color: 'var(--text-muted)', flexShrink: 0, fontFamily: 'monospace' },
  squadTab: { flex: 1, overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 9 },
  roleFilters: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  roleFilterBtn: { padding: '5px 11px', borderRadius: 6, border: 'none', fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 12, cursor: 'pointer', transition: 'all 0.2s' },
  budgetTracker: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 9, marginBottom: 6 },
  budgetHeader: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 7 },
  budgetBars: { display: 'flex', flexDirection: 'column', gap: 4 },
  budgetBarItem: { display: 'flex', alignItems: 'center', gap: 5 },
  budgetBar: { flex: 1, height: 5, background: 'var(--bg-card)', borderRadius: 3, overflow: 'hidden' },
  budgetBarFill: { height: '100%', borderRadius: 3, transition: 'width 0.5s' },
  squadPlayer: { display: 'flex', alignItems: 'center', gap: 7, padding: '5px 0', borderBottom: '1px solid var(--border)' },
  squadPlayerInfo: { flex: 1 },
  squadPlayerName: { fontSize: 13 },
  squadPlayerPrice: { color: 'var(--gold)', fontFamily: 'var(--font-display)', fontSize: 12 },
  teamsTab: { flex: 1, overflow: 'auto', padding: 12 },
  teamItem: { borderBottom: '1px solid var(--border)', marginBottom: 3 },
  teamHeader: { display: 'flex', alignItems: 'center', gap: 9, padding: '7px 0', cursor: 'pointer' },
  teamLogoSmall: { width: 26, height: 26, borderRadius: '50%', flexShrink: 0 },
  teamName: { flex: 1, fontSize: 13, fontFamily: 'var(--font-display)', fontWeight: 600 },
  teamPurse: { fontSize: 12, color: 'var(--gold)', fontFamily: 'var(--font-display)', marginRight: 6 },
  teamCount: { fontSize: 11, color: 'var(--text-muted)', marginRight: 6 },
  teamSquad: { padding: '7px 0 7px 35px' },
  teamSquadPlayer: { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.05)' },
}

const CP = {
  msgContainer: { flex: 1, overflow: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 },
  empty: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '32px 16px' },
  inputRow: { display: 'flex', gap: 7, padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, alignItems: 'center', background: 'var(--bg-secondary)' },
  input: { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' },
  sendBtn: { width: 36, height: 36, borderRadius: 8, background: 'var(--gold)', border: 'none', color: '#000', fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
}

const SP = {
  settingRow: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '13px 14px', marginBottom: 9 },
  settingHdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 },
  settingLabel: { fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, marginBottom: 3 },
  settingDesc: { fontSize: 11, color: 'var(--text-muted)' },
  timerBtns: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  timerBtn: { flex: 1, padding: '7px 3px', borderRadius: 8, cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 600, transition: 'all 0.15s', textAlign: 'center', minWidth: 40 },
}

const SM = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: '0 12px' },
  modalBox: { background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: 580, maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  modalHdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  modalTitle: { fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 18, cursor: 'pointer', padding: '0 4px' },
  statTabBar: { display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, overflowX: 'auto' },
  statTabBtn: { flex: 1, padding: '10px 3px', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, transition: 'all 0.15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, whiteSpace: 'nowrap' },
  statContent: { flex: 1, overflow: 'auto', padding: '14px 16px' },
  setHdr: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0 5px', borderBottom: '1px solid var(--border)', marginBottom: 9 },
  setName: { fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--gold)', letterSpacing: 1 },
  setCnt: { fontSize: 11, color: 'var(--text-muted)' },
  upGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 },
  upCard: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 11px' },
  upName: { fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, marginBottom: 3 },
  upPrice: { fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--green)', fontWeight: 700, marginTop: 3 },
  roleTag: { padding: '2px 7px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600 },
  osTag: { padding: '2px 7px', borderRadius: 4, fontSize: 10, fontFamily: 'var(--font-display)', fontWeight: 600, background: 'rgba(168,85,247,0.2)', color: '#d8b4fe' },
  soldRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--border)' },
  soldName: { fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600 },
  lbSec: { fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--gold)', marginBottom: 9, letterSpacing: 0.5 },
  lbRow: { display: 'flex', alignItems: 'center', gap: 7, padding: '6px 0', borderBottom: '1px solid var(--border)' },
  empty: { textAlign: 'center', padding: '36px 18px', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 2 },
}