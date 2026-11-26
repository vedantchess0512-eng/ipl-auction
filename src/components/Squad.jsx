import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subscribeRoom, createTournament, startReAuction } from '../utils/db.js'
import { IPL_TEAMS } from '../data/teams.js'

const ROLE_LABELS = { BAT: 'Batsman', BOWL: 'Bowler', AR: 'All-Rounder', WK: 'Wicket-Keeper' }
const ROLE_CLASSES = { BAT: 'tag-bat', BOWL: 'tag-bowl', AR: 'tag-ar', WK: 'tag-wk' }

function formatPrice(lakhs) {
  if (!lakhs) return '0'
  if (lakhs >= 100) return `${(lakhs / 100).toFixed(lakhs % 100 === 0 ? 0 : 2)} Cr`
  return `${lakhs} L`
}

export default function Squad() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [startingTournament, setStartingTournament] = useState(false)
  const [startingTest, setStartingTest] = useState(false)
  const [startingReAuction, setStartingReAuction] = useState(false)

  const playerName = localStorage.getItem('playerName') || ''

  // FIX: HostSetup sets 'isHost' (no roomId suffix), check both keys
  const isHost = localStorage.getItem('isHost') === 'true' ||
                 localStorage.getItem(`isHost_${roomId}`) === 'true'

  useEffect(() => {
    const unsub = subscribeRoom(roomId, (data) => {
      if (!data) { navigate('/'); return }
      setRoom(data)
      if (!selectedTeam && data.teams) {
        const myTeam = Object.values(data.teams).find(t => t.ownerId === playerName)
        setSelectedTeam(myTeam?.id || Object.keys(data.teams)[0])
      }
      if (data.tournament?.stage && data.tournament?.matches) {
        navigate(`/tournament/${roomId}`)
      }
    })
    return unsub
  }, [roomId])

  const handleStartTournament = async () => {
    if (startingTournament) return
    setStartingTournament(true)
    try {
      await createTournament(roomId, false)
      navigate(`/tournament/${roomId}`)
    } catch (e) {
      console.error('Failed to create tournament', e)
      setStartingTournament(false)
    }
  }

  const handleTestTournament = async () => {
    if (startingTest) return
    setStartingTest(true)
    try {
      await createTournament(roomId, true)
      navigate(`/tournament/${roomId}`)
    } catch (e) {
      console.error('Failed to create test tournament', e)
      setStartingTest(false)
    }
  }

  const handleStartReAuction = async () => {
    if (startingReAuction) return
    if (!window.confirm('Start re-auction for unsold players at 20% reduced prices?')) return
    setStartingReAuction(true)
    try {
      await startReAuction(roomId)
      navigate(`/auction/${roomId}`)
    } catch (e) {
      console.error('Failed to start re-auction', e)
      setStartingReAuction(false)
    }
  }

  if (!room) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-secondary)' }}>
      Loading...
    </div>
  )

  const teams = Object.values(room.teams || {})
  const viewTeam = teams.find(t => t.id === selectedTeam) || teams[0]
  const auctionLog = room.auctionLog ? Object.values(room.auctionLog) : []
  const soldPlayers = auctionLog.filter(l => l.soldTo).sort((a, b) => b.soldPrice - a.soldPrice)
  const unsoldPlayers = room.unsoldPlayers || []

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>\uD83C\uDFC6 Auction Complete</div>
          <div style={styles.headerSub}>Room {roomId} • {room.format} Auction</div>
        </div>
        <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>

          {isHost && room.status === 'completed' && (
            <button
              onClick={handleStartTournament}
              disabled={startingTournament}
              style={{
                padding: '10px 20px',
                background: startingTournament ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #FFD700, #FFA500)',
                color: startingTournament ? 'var(--text-muted)' : '#000',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                fontSize: 14,
                cursor: startingTournament ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {startingTournament ? '⏳ Generating...' : '\uD83C\uDFCF Start Tournament →'}
            </button>
          )}

          {isHost && room.status === 'completed' && (
            <button
              onClick={handleTestTournament}
              disabled={startingTest}
              title="Creates 5 fake CPU teams so you can test the tournament alone"
              style={{
                padding: '10px 16px',
                background: startingTest ? 'var(--bg-elevated)' : 'rgba(124,58,237,0.18)',
                color: startingTest ? 'var(--text-muted)' : '#a78bfa',
                border: '1px solid rgba(124,58,237,0.45)',
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                fontSize: 13,
                cursor: startingTest ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap',
              }}
            >
              {startingTest ? '⏳ Setting up...' : '🧪 Test Tournament (Solo)'}
            </button>
          )}

          {/* UNSOLD RE-AUCTION BANNER + BUTTON */}
          {isHost && unsoldPlayers.length > 0 && (
            <div style={styles.reAuctionBanner}>
              <div style={styles.reAuctionIcon}>\u26A0\uFE0F</div>
              <div style={{ flex:1 }}>
                <div style={styles.reAuctionTitle}>{unsoldPlayers.length} players went unsold</div>
                <div style={styles.reAuctionDesc}>Re-auction them at 20% reduced base price</div>
              </div>
              <button
                onClick={handleStartReAuction}
                disabled={startingReAuction}
                style={{
                  padding: '8px 16px',
                  background: startingReAuction ? 'var(--bg-elevated)' : 'var(--gold)',
                  color: startingReAuction ? 'var(--text-muted)' : '#000',
                  border: 'none',
                  borderRadius: 'var(--radius)',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: startingReAuction ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap',
                }}
              >
                {startingReAuction ? '⏳ Starting...' : '\uD83D\uDD04 Start Re-Auction'}
              </button>
            </div>
          )}

          {!isHost && room.tournament?.stage && (
            <button
              onClick={() => navigate(`/tournament/${roomId}`)}
              style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #FFD700, #FFA500)',
                color: '#000',
                border: 'none',
                borderRadius: 'var(--radius)',
                fontWeight: 700,
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              \uD83C\uDFCF Join Tournament →
            </button>
          )}

          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>Home</button>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.teamList}>
          <div style={styles.sectionLabel}>All Teams</div>
          {teams.map(team => {
            const ipl = IPL_TEAMS.find(t => t.id === team.id) || team
            const active = selectedTeam === team.id
            const spent = (team.initialPurse || 12000) - (team.purse || 0)
            return (
              <div
                key={team.id}
                style={{
                  ...styles.teamItem,
                  background: active ? `${ipl.color || 'var(--gold)'}22` : 'var(--bg-elevated)',
                  border: active ? `1px solid ${ipl.color || 'var(--gold)'}` : '1px solid var(--border)',
                }}
                onClick={() => setSelectedTeam(team.id)}
              >
                <div style={{ ...styles.teamBadge, background: ipl.color || '#333', color: ipl.accent || '#fff' }}>
                  {team.shortName || team.id}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:500 }}>{team.ownerName || 'No owner'}</div>
                  <div style={{ fontSize:11, color:'var(--text-muted)' }}>{(team.squad||[]).length} players</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div style={{ color:'var(--gold)', fontSize:12, fontFamily:'var(--font-display)' }}>\u20B9{formatPrice(team.purse)} left</div>
                  <div style={{ color:'var(--text-muted)', fontSize:11 }}>\u20B9{formatPrice(spent)} spent</div>
                </div>
              </div>
            )
          })}

          <div style={{ ...styles.sectionLabel, marginTop:24 }}>Most Expensive Buys</div>
          {soldPlayers.slice(0, 8).map((p, i) => (
            <div key={i} style={styles.leaderRow}>
              <span style={{ color:'var(--gold)', fontSize:12, minWidth:16 }}>{i+1}</span>
              <span style={{ flex:1, fontSize:12 }}>{p.playerName}</span>
              <span style={{ fontSize:11, color:'var(--text-muted)', marginRight:6 }}>{p.soldTo}</span>
              <span style={{ color:'var(--gold)', fontFamily:'var(--font-display)', fontSize:12 }}>\u20B9{formatPrice(p.soldPrice)}</span>
            </div>
          ))}

          {!isHost && !room.tournament?.stage && room.status === 'completed' && (
            <div style={{
              marginTop: 24,
              padding: '12px 14px',
              background: 'var(--bg-elevated)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              fontSize: 13,
              color: 'var(--text-muted)',
              textAlign: 'center',
            }}>
              ⏳ Waiting for host to start the tournament...
            </div>
          )}
        </div>

        {viewTeam && (
          <div style={styles.squadDetail} className="animate-fade-in">
            {(() => {
              const ipl = IPL_TEAMS.find(t => t.id === viewTeam.id) || viewTeam
              const squad = viewTeam.squad || []
              const overseas = squad.filter(p => p.nationality === 'OS')
              const spent = (viewTeam.initialPurse || 12000) - (viewTeam.purse || 0)
              const roles = { BAT:0, BOWL:0, AR:0, WK:0 }
              squad.forEach(p => { roles[p.role] = (roles[p.role] || 0) + 1 })
              return (
                <>
                  <div style={{ ...styles.squadBanner, background: `linear-gradient(135deg, ${ipl.color || '#1a1a2e'}33, transparent)` }}>
                    <div style={{ ...styles.squadBadge, background: ipl.color || '#333', color: ipl.accent || '#fff' }}>
                      {viewTeam.shortName || viewTeam.id}
                    </div>
                    <div>
                      <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 }}>{viewTeam.name}</div>
                      <div style={{ color:'var(--text-secondary)', fontSize:14, display:'flex', alignItems:'center', gap:8 }}>
                      Managed by <strong>{viewTeam.ownerName || 'No owner'}</strong>
                      {(viewTeam.squad || []).length < (room.minSquadSize || 15) && (
                        <span style={{ padding:'2px 10px', background:'rgba(239,68,68,0.2)', border:'1px solid rgba(239,68,68,0.5)', borderRadius:4, color:'#f87171', fontSize:12, fontFamily:'var(--font-display)', fontWeight:700 }}>\u274C DISQUALIFIED</span>
                      )}
                    </div>
                    </div>
                  </div>

                  <div style={styles.statsRow}>
                    <div style={styles.statBox}>
                      <div style={styles.statVal}>{squad.length}</div>
                      <div style={styles.statKey}>Players</div>
                    </div>
                    <div style={styles.statBox}>
                      <div style={styles.statVal}>{overseas.length}/{viewTeam.maxOverseas || 8}</div>
                      <div style={styles.statKey}>Overseas</div>
                    </div>
                    <div style={styles.statBox}>
                      <div style={{ ...styles.statVal, color:'var(--gold)' }}>\u20B9{formatPrice(spent)}</div>
                      <div style={styles.statKey}>Spent</div>
                    </div>
                    <div style={styles.statBox}>
                      <div style={{ ...styles.statVal, color:'var(--green)' }}>\u20B9{formatPrice(viewTeam.purse)}</div>
                      <div style={styles.statKey}>Remaining</div>
                    </div>
                  </div>

                  <div style={styles.roleRow}>
                    {Object.entries(roles).map(([role, count]) => (
                      <div key={role} style={styles.roleChip}>
                        <span className={`tag ${ROLE_CLASSES[role]}`}>{role}</span>
                        <span style={{ fontSize:13, fontWeight:600 }}>{count}</span>
                      </div>
                    ))}
                  </div>

                  <div style={styles.playerList}>
                    {['WK','BAT','AR','BOWL'].map(role => {
                      const rolePlayers = squad.filter(p => p.role === role)
                      if (rolePlayers.length === 0) return null
                      return (
                        <div key={role}>
                          <div style={styles.roleHeader}>
                            <span className={`tag ${ROLE_CLASSES[role]}`}>{ROLE_LABELS[role]}</span>
                            <span style={{ color:'var(--text-muted)', fontSize:12 }}>{rolePlayers.length}</span>
                          </div>
                          {rolePlayers.map((p, i) => (
                            <div key={i} style={styles.playerRow}>
                              <span style={{ flex:1, fontSize:14 }}>{p.name}</span>
                              {p.nationality === 'OS' && (
                                <span className="tag tag-os" style={{ fontSize:10 }}>OS</span>
                              )}
                              <span style={{ color:'var(--gold)', fontFamily:'var(--font-display)', fontSize:13, minWidth:60, textAlign:'right' }}>
                                \u20B9{formatPrice(p.soldPrice)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                    {squad.length === 0 && (
                      <p style={{ color:'var(--text-muted)', textAlign:'center', padding:32 }}>No players in squad</p>
                    )}
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden' },
  header: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 24px', background:'var(--bg-secondary)', borderBottom:'1px solid var(--border)', flexShrink:0 },
  headerTitle: { fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 },
  headerSub: { fontSize:13, color:'var(--text-muted)', marginTop:2 },
  main: { flex:1, display:'flex', overflow:'hidden' },
  teamList: { width:280, borderRight:'1px solid var(--border)', overflow:'auto', padding:16, flexShrink:0 },
  sectionLabel: { fontFamily:'var(--font-display)', fontSize:11, fontWeight:600, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:10 },
  teamItem: { display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'var(--radius)', cursor:'pointer', marginBottom:8, transition:'all 0.15s' },
  teamBadge: { width:36, height:36, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:11, flexShrink:0 },
  leaderRow: { display:'flex', alignItems:'center', gap:8, padding:'6px 4px', borderBottom:'1px solid var(--border)' },
  squadDetail: { flex:1, overflow:'auto', padding:24 },
  squadBanner: { display:'flex', alignItems:'center', gap:16, padding:'20px 24px', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', marginBottom:20 },
  squadBadge: { width:60, height:60, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, flexShrink:0 },
  statsRow: { display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:10, marginBottom:16 },
  statBox: { background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'12px', textAlign:'center' },
  statVal: { fontFamily:'var(--font-display)', fontSize:20, fontWeight:700 },
  statKey: { color:'var(--text-muted)', fontSize:11, marginTop:2 },
  roleRow: { display:'flex', gap:12, marginBottom:20 },
  roleChip: { display:'flex', alignItems:'center', gap:8 },
  playerList: { display:'flex', flexDirection:'column', gap:16 },
  roleHeader: { display:'flex', alignItems:'center', gap:10, marginBottom:8 },
  playerRow: { display:'flex', alignItems:'center', gap:10, padding:'8px 0', borderBottom:'1px solid var(--border)' },
  // Re-auction banner
  reAuctionBanner: { display:'flex', alignItems:'center', gap:12, padding:'12px 16px', background:'rgba(242,169,0,0.1)', border:'1px solid rgba(242,169,0,0.3)', borderRadius:'var(--radius-lg)', marginBottom:12 },
  reAuctionIcon: { fontSize:24, flexShrink:0 },
  reAuctionTitle: { fontFamily:'var(--font-display)', fontSize:14, fontWeight:700, color:'var(--gold)' },
  reAuctionDesc: { fontSize:12, color:'var(--text-muted)', marginTop:2 },
}
