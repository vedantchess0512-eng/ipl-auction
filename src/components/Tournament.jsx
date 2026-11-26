import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subscribeTournament } from '../utils/db.js'
import { sortPointsTable } from '../utils/pointsTable.js'
import { IPL_TEAMS } from '../data/teams.js'

function formatPrice(lakhs) {
  if (!lakhs && lakhs !== 0) return '–'
  if (lakhs >= 100) return `${(lakhs / 100).toFixed(2)} Cr`
  return `${lakhs} L`
}

export default function Tournament() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [tab, setTab] = useState('fixtures')
  const [showSquads, setShowSquads] = useState(false)

  const playerName = localStorage.getItem('playerName') || ''
  // ✅ FIX 1: check both isHost keys (HostSetup sets 'isHost', Squad sets isHost_roomId)
  const isHost = localStorage.getItem('isHost') === 'true' ||
                 localStorage.getItem(`isHost_${roomId}`) === 'true'

  useEffect(() => {
    const unsub = subscribeTournament(roomId, data => {
      if (!data) { navigate('/'); return }
      setRoom(data)
      // ✅ FIX 2: do NOT auto-redirect back to /squad when tournament exists
      // (removed the redirect that caused the Squad→Tournament→Squad loop)
    })
    return unsub
  }, [roomId])

  if (!room) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-secondary)' }}>
      Loading tournament...
    </div>
  )

  const tournament = room.tournament
  if (!tournament) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-secondary)' }}>
      Generating fixtures...
    </div>
  )

  const teams = room.teams || {}
  const leagueMatches = Object.values(tournament.matches || {}).sort((a, b) => {
    const order = ['completed', 'live', 'scheduled']
    return order.indexOf(a.status) - order.indexOf(b.status)
  })
  const playoffMatches = tournament.playoffs || {}
  const pointsTable = sortPointsTable(tournament.pointsTable || {})
  const stage = tournament.stage || 'league'

  const myTeam = Object.values(teams).find(t => t.ownerId === playerName)
  const myTeamId = myTeam?.id

  const playoffOrder = tournament.format === 'roundrobin_top2'
    ? ['final']
    : ['q1', 'eliminator', 'q2', 'final']

  const playoffLabels = { q1: 'Qualifier 1', eliminator: 'Eliminator', q2: 'Qualifier 2', final: 'FINAL' }

  const getIplColor = (teamId) => IPL_TEAMS.find(t => t.id === teamId)?.color || teams[teamId]?.color || '#888'

  const statusBadge = (status) => {
    const map = {
      completed: { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e', label: 'Done' },
      live:      { bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', label: '● LIVE' },
      scheduled: { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', label: 'Upcoming' },
      pending:   { bg: 'var(--bg-elevated)',      color: 'var(--text-muted)', label: 'TBD' },
    }
    const s = map[status] || map.pending
    return (
      <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99, background: s.bg, color: s.color }}>
        {s.label}
      </span>
    )
  }

  const canPlayLeague  = (m) => isHost && m.status === 'scheduled'
  const canPlayPlayoff = (m) => isHost && m?.status === 'scheduled' && m?.teamA && m?.teamB

  // ── SQUADS MODAL ─────────────────────────────────────────────
  if (showSquads) {
    return (
      <div style={styles.page}>
        <div style={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => setShowSquads(false)}>← Back to Tournament</button>
          <div style={styles.headerTitle}>All Squads</div>
          <div style={{ width: 120 }} />
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: 20 }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {Object.values(teams).map(team => {
              const ipl = IPL_TEAMS.find(t => t.id === team.id) || team
              const squad = team.squad || []
              const os = squad.filter(p => p.nationality === 'OS').length
              return (
                <div key={team.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 14px', background: `${ipl.color || '#333'}22`, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: ipl.color || '#333', color: ipl.accent || '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 11 }}>
                      {team.shortName || team.id}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{team.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{team.ownerName || 'CPU'} · {squad.length} players · {os} OS</div>
                    </div>
                  </div>
                  <div style={{ padding: '10px 14px', maxHeight: 260, overflow: 'auto' }}>
                    {squad.length === 0
                      ? <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>No players</div>
                      : squad.map((p, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', borderBottom: '1px solid var(--border)', fontSize: 12 }}>
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 4, background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontWeight: 600 }}>{p.role}</span>
                          <span style={{ flex: 1 }}>{p.name}</span>
                          {p.nationality === 'OS' && <span style={{ fontSize: 9, color: '#60a5fa' }}>OS</span>}
                        </div>
                      ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.headerTitle}>🏏 Tournament</div>
          <div style={styles.headerSub}>
            Room {roomId} &nbsp;·&nbsp;
            <span style={{ textTransform: 'capitalize', color: stage === 'done' ? '#22c55e' : '#60a5fa' }}>
              {stage === 'league' ? 'League Stage' : stage === 'playoff' ? 'Playoffs' : stage === 'done' ? '✓ Complete' : stage}
            </span>
          </div>
        </div>
        {tournament.champion && (
          <div style={styles.championBanner}>
            🏆 Champion: <strong>{teams[tournament.champion]?.name}</strong>
          </div>
        )}
        {/* ✅ FIX 2: Squads button now opens inline modal, no navigate() */}
        <button className="btn btn-ghost btn-sm" onClick={() => setShowSquads(true)}>👥 Squads</button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {[
          { key: 'fixtures', label: '📋 Fixtures' },
          { key: 'points',   label: '📊 Points Table' },
          { key: 'playoffs', label: '🏆 Playoffs' },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{ ...styles.tab, ...(tab === key ? styles.tabActive : {}) }}>
            {label}
          </button>
        ))}
      </div>

      <div style={styles.body}>

        {/* ── FIXTURES ── */}
        {tab === 'fixtures' && (
          <div style={styles.panel}>
            <div style={styles.panelMeta}>
              {leagueMatches.filter(m => m.status === 'completed').length} / {leagueMatches.length} matches played
            </div>
            {leagueMatches.map(match => {
              const isMyMatch = match.teamA === myTeamId || match.teamB === myTeamId
              return (
                <div key={match.id} style={{
                  ...styles.matchCard,
                  border: isMyMatch ? '1px solid var(--gold)' : '1px solid var(--border)',
                }}>
                  <div style={styles.matchMeta}>
                    <span style={styles.matchLabel}>{match.label}</span>
                    {statusBadge(match.status)}
                  </div>
                  <div style={styles.matchTeams}>
                    <div style={styles.matchTeam}>
                      <span style={{ ...styles.teamDot, background: getIplColor(match.teamA) }} />
                      <span style={{ fontWeight: match.winner === match.teamA ? 700 : 400 }}>{match.teamAName}</span>
                      {match.status === 'completed' && (
                        <span style={{ ...styles.matchScore, color: match.winner === match.teamA ? 'var(--gold)' : 'var(--text-muted)' }}>
                          {match.scoreA}/{match.wicketsA} ({match.oversA})
                        </span>
                      )}
                    </div>
                    <span style={styles.vs}>vs</span>
                    <div style={{ ...styles.matchTeam, justifyContent: 'flex-end', textAlign: 'right' }}>
                      {match.status === 'completed' && (
                        <span style={{ ...styles.matchScore, color: match.winner === match.teamB ? 'var(--gold)' : 'var(--text-muted)' }}>
                          {match.scoreB}/{match.wicketsB} ({match.oversB})
                        </span>
                      )}
                      <span style={{ fontWeight: match.winner === match.teamB ? 700 : 400 }}>{match.teamBName}</span>
                      <span style={{ ...styles.teamDot, background: getIplColor(match.teamB) }} />
                    </div>
                  </div>
                  <div style={styles.matchFooter}>
                    {match.status === 'completed' && (
                      <span style={{ fontSize: 12, color: 'var(--gold)' }}>
                        🏆 {teams[match.winner]?.name || match.winner} won
                      </span>
                    )}
                    {canPlayLeague(match) && (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => navigate(`/match-setup/${roomId}/${match.id}`)}>
                        ▶ Play Match
                      </button>
                    )}
                    {!isHost && match.status === 'scheduled' && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Waiting for host...</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── POINTS TABLE ── */}
        {tab === 'points' && (
          <div style={styles.panel}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {['#', 'Team', 'P', 'W', 'L', 'Pts', 'NRR'].map(h => (
                    <th key={h} style={styles.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pointsTable.map((row, i) => {
                  const qualifies = i < (tournament.playoffSlots || 4)
                  return (
                    <tr key={row.id} style={{
                      ...styles.tr,
                      background: qualifies ? 'rgba(59,130,246,0.08)' : 'transparent',
                      borderLeft: qualifies ? '3px solid #60a5fa' : '3px solid transparent',
                    }}>
                      <td style={styles.td}>{i + 1}</td>
                      <td style={{ ...styles.td, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...styles.teamDot, background: getIplColor(row.id) }} />
                        <span style={{ fontWeight: i === 0 ? 700 : 400 }}>{row.name}</span>
                      </td>
                      <td style={styles.td}>{row.p}</td>
                      <td style={styles.td}>{row.w}</td>
                      <td style={styles.td}>{row.l}</td>
                      <td style={{ ...styles.td, fontWeight: 700, color: 'var(--gold)' }}>{row.pts}</td>
                      <td style={{ ...styles.td, color: (row.nrr || 0) >= 0 ? '#22c55e' : '#ef4444' }}>
                        {(row.nrr || 0) >= 0 ? '+' : ''}{(row.nrr || 0).toFixed(3)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {tournament.playoffSlots > 0 && (
              <div style={{ marginTop: 12, fontSize: 12, color: '#60a5fa', padding: '6px 10px', background: 'rgba(59,130,246,0.08)', borderRadius: 'var(--radius)' }}>
                🔵 Top {tournament.playoffSlots} teams qualify for playoffs
              </div>
            )}
          </div>
        )}

        {/* ── PLAYOFFS ── */}
        {tab === 'playoffs' && (
          <div style={styles.panel}>
            {stage === 'league' ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 16 }}>Playoffs unlock after all league matches finish.</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>
                  {leagueMatches.filter(m => m.status !== 'completed').length} matches remaining
                </div>
              </div>
            ) : (
              <div style={styles.bracket}>
                {playoffOrder.map(id => {
                  const match = playoffMatches[id]
                  if (!match) return null
                  const isFinal = id === 'final'
                  const playable = canPlayPlayoff(match)
                  return (
                    <div key={id} style={{
                      ...styles.playoffCard,
                      border: isFinal ? '2px solid var(--gold)' : '1px solid var(--border)',
                      background: isFinal ? 'linear-gradient(135deg, var(--bg-elevated), var(--bg-secondary))' : 'var(--bg-elevated)',
                    }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
                        {playoffLabels[id]}
                      </div>
                      <div style={styles.playoffTeams}>
                        {[
                          ['A', 'teamA', 'teamAName', 'scoreA', 'wicketsA', 'oversA'],
                          ['B', 'teamB', 'teamBName', 'scoreB', 'wicketsB', 'oversB'],
                        ].map(([side, tId, tName, sField, wField, oField]) => (
                          <div key={side} style={{
                            ...styles.playoffTeamRow,
                            fontWeight: match.winner === match[tId] ? 700 : 400,
                            color: match.winner === match[tId] ? 'var(--gold)' : 'inherit',
                          }}>
                            <span style={{ ...styles.teamDot, background: getIplColor(match[tId]) }} />
                            <span style={{ flex: 1 }}>{match[tName] || 'TBD'}</span>
                            {match.status === 'completed' && (
                              <span style={{ fontSize: 13, fontFamily: 'var(--font-display)' }}>
                                {match[sField]}/{match[wField]}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      {match.status === 'completed' && match.winner && (
                        <div style={{ fontSize: 12, color: 'var(--gold)', marginTop: 8 }}>
                          🏆 {teams[match.winner]?.name || match.winner} won
                        </div>
                      )}
                      {(match.status === 'pending' || !match.teamA || !match.teamB) && match.status !== 'scheduled' && match.status !== 'completed' && (
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                          ⏳ Waiting for previous results...
                        </div>
                      )}
                      {playable && (
                        <button
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: 10 }}
                          onClick={() => navigate(`/playoff-setup/${roomId}/${id}`)}>
                          ▶ Play Match
                        </button>
                      )}
                    </div>
                  )
                })}

                {stage === 'done' && tournament.champion && (
                  <div style={styles.championCard}>
                    <div style={{ fontSize: 64 }}>🏆</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--gold)', marginTop: 8 }}>
                      {teams[tournament.champion]?.name}
                    </div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Tournament Champion</div>
                    <button
                      className="btn btn-primary"
                      style={{ marginTop: 16 }}
                      onClick={() => navigate(`/trophy/${roomId}`)}>
                      🏆 View Trophy Screen
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-primary)' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0, gap: 12, flexWrap: 'wrap' },
  headerTitle: { fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 },
  headerSub: { fontSize: 13, color: 'var(--text-muted)', marginTop: 2 },
  championBanner: { padding: '8px 16px', background: 'var(--bg-elevated)', border: '1px solid var(--gold)', borderRadius: 'var(--radius)', fontSize: 14, color: 'var(--gold)' },
  tabs: { display: 'flex', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  tab: { flex: 1, padding: '12px 0', background: 'none', border: 'none', borderBottom: '2px solid transparent', color: 'var(--text-muted)', fontSize: 14, cursor: 'pointer', transition: 'all .15s', fontFamily: 'inherit' },
  tabActive: { color: 'var(--gold)', borderBottomColor: 'var(--gold)', background: 'var(--bg-elevated)' },
  body: { flex: 1, overflow: 'auto' },
  panel: { padding: 20, maxWidth: 900, margin: '0 auto' },
  panelMeta: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 14 },
  matchCard: { borderRadius: 'var(--radius-lg)', padding: '14px 16px', marginBottom: 10, background: 'var(--bg-elevated)' },
  matchMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  matchLabel: { fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 },
  matchTeams: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 },
  matchTeam: { flex: 1, display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 },
  matchScore: { fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-display)' },
  vs: { fontSize: 11, color: 'var(--text-muted)', flexShrink: 0, fontWeight: 600 },
  matchFooter: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  teamDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0, display: 'inline-block' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid var(--border)' },
  tr: { borderBottom: '1px solid var(--border)', transition: 'background .1s' },
  td: { padding: '10px 12px' },
  bracket: { display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 500, margin: '0 auto' },
  playoffCard: { borderRadius: 'var(--radius-lg)', padding: '16px' },
  playoffTeams: { display: 'flex', flexDirection: 'column', gap: 8 },
  playoffTeamRow: { display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, padding: '4px 0' },
  championCard: { textAlign: 'center', padding: '40px 20px', background: 'var(--bg-elevated)', border: '2px solid var(--gold)', borderRadius: 'var(--radius-lg)' },
}