import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subscribeTournament, saveXI, saveToss, autoFillCPUxi } from '../utils/db.js'

const ROLE_CLASSES = { BAT: 'tag-bat', BOWL: 'tag-bowl', AR: 'tag-ar', WK: 'tag-wk' }
const ROLE_ORDER   = ['WK', 'BAT', 'AR', 'BOWL']
const ROLE_LABELS  = { WK: 'Wicket-Keepers', BAT: 'Batsmen', AR: 'All-Rounders', BOWL: 'Bowlers' }

export default function MatchSetup({ isPlayoff = false }) {
  const { roomId, matchId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const [phase, setPhase] = useState('xi')
  const [selectedXI, setSelectedXI] = useState([])
  const [impactPlayer, setImpactPlayer] = useState(null)
  const [xiSaved, setXiSaved] = useState(false)
  const [tossWinner, setTossWinner] = useState(null)
  const [tossAnimating, setTossAnimating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [autoFillingCPU, setAutoFillingCPU] = useState(false)

  const playerName = localStorage.getItem('playerName') || ''
  const isHost = localStorage.getItem('isHost') === 'true' ||
                 localStorage.getItem(`isHost_${roomId}`) === 'true'

  useEffect(() => {
    const unsub = subscribeTournament(roomId, data => {
      if (!data) return
      setRoom(data)
      const match = isPlayoff
        ? data.tournament?.playoffs?.[matchId]
        : data.tournament?.matches?.[matchId]
      if (match?.status === 'live' && match?.tossWinner) {
        const route = isPlayoff
          ? `/playoff-engine/${roomId}/${matchId}`
          : `/match-engine/${roomId}/${matchId}`
        navigate(route)
      }
    })
    return unsub
  }, [roomId, matchId])

  if (!room) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
      Loading match...
    </div>
  )

  const tournament = room.tournament
  const match = isPlayoff
    ? tournament?.playoffs?.[matchId]
    : tournament?.matches?.[matchId]

  if (!match) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
      Match not found.
    </div>
  )

  const teams = room.teams || {}
  const myTeam = Object.values(teams).find(t => t.ownerId === playerName)
  const myTeamId = myTeam?.id
  const isMyMatch = match.teamA === myTeamId || match.teamB === myTeamId
  const amTeamA = match.teamA === myTeamId
  const mySquad = myTeam?.squad || []

  // ── Detect if opponent is CPU ──────────────────────────────────
  const oppTeamId = amTeamA ? match.teamB : match.teamA
  const oppTeam = teams[oppTeamId]
  const oppIsCPU = oppTeam?.ownerId?.startsWith('cpu_') || oppTeam?.ownerName?.startsWith('CPU')

  // ── Toss decision eligibility ──────────────────────────────────
  const tossWinnerTeam = tossWinner ? Object.values(teams).find(t => t.id === tossWinner) : null
  const tossWinnerIsCPU = !tossWinnerTeam?.ownerId || tossWinnerTeam.ownerId === 'cpu' || tossWinnerTeam.ownerId?.startsWith('cpu_') || tossWinnerTeam?.ownerName?.startsWith('CPU')
  const canDecide = tossWinner && (myTeamId === tossWinner || (isHost && tossWinnerIsCPU))

  const MAX_XI       = 11
  const MAX_OS_IN_XI = 4
  const overseasInXI = selectedXI.filter(p => p.nationality === 'OS').length

  const togglePlayer = (player) => {
    const inXI = selectedXI.some(p => p.name === player.name)
    if (inXI) {
      setSelectedXI(prev => prev.filter(p => p.name !== player.name))
      if (impactPlayer?.name === player.name) setImpactPlayer(null)
    } else {
      if (selectedXI.length >= MAX_XI) return
      if (player.nationality === 'OS' && overseasInXI >= MAX_OS_IN_XI) return
      setSelectedXI(prev => [...prev, player])
    }
  }

  const handleSaveXI = async () => {
    if (selectedXI.length !== MAX_XI || saving) return
    setSaving(true)
    await saveXI(roomId, matchId, myTeamId, selectedXI, impactPlayer || null, isPlayoff)
    setXiSaved(true)
    setSaving(false)

    // ── FIX 1: If opponent is CPU, auto-fill their XI immediately ──
    if (oppIsCPU && isHost) {
      setAutoFillingCPU(true)
      await autoFillCPUxi(roomId, matchId, isPlayoff)
      setAutoFillingCPU(false)
      // Now both XIs are ready — proceed straight to toss
      setPhase('toss')
    }
  }

  const handleToss = async () => {
    setTossAnimating(true)
    await new Promise(r => setTimeout(r, 1800))
    const winner = Math.random() < 0.5 ? match.teamA : match.teamB
    setTossWinner(winner)
    setTossAnimating(false)
    setPhase('tossdec')
  }

  const handleTossDec = async (dec) => {
    await saveToss(roomId, matchId, tossWinner, dec, isPlayoff)
    const route = isPlayoff
      ? `/playoff-engine/${roomId}/${matchId}`
      : `/match-engine/${roomId}/${matchId}`
    navigate(route)
  }

  const teamAName = teams[match.teamA]?.name || match.teamAName
  const teamBName = teams[match.teamB]?.name || match.teamBName
  const bothXIReady = (match.xiA?.length || 0) >= MAX_XI && (match.xiB?.length || 0) >= MAX_XI

  const squadByRole = ROLE_ORDER.reduce((acc, role) => {
    acc[role] = mySquad.filter(p => p.role === role)
    return acc
  }, {})

  // Impact: from squad, NOT in XI
  const impactCandidates = mySquad.filter(p => !selectedXI.some(x => x.name === p.name))

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/tournament/${roomId}`)}>← Back</button>
        <div style={styles.headerCenter}>
          <div style={styles.headerTitle}>{match.label}</div>
          <div style={styles.headerSub}>{teamAName} vs {teamBName}</div>
        </div>
        <div style={{ width: 80 }} />
      </div>

      {/* Steps */}
      <div style={styles.steps}>
        {['XI Selection', 'Toss', 'Decision'].map((label, i) => {
          const phaseKeys = ['xi', 'toss', 'tossdec']
          const currentIdx = phaseKeys.indexOf(phase)
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div key={label} style={styles.stepItem}>
              <div style={{
                ...styles.stepCircle,
                background: done ? '#22c55e' : active ? 'var(--gold)' : 'var(--bg-elevated)',
                color: active ? '#000' : done ? '#fff' : 'var(--text-muted)',
              }}>
                {done ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 11, color: active ? 'var(--gold)' : 'var(--text-muted)', marginTop: 4 }}>{label}</div>
            </div>
          )
        })}
      </div>

      <div style={styles.body}>

        {/* ── XI SELECTION ── */}
        {phase === 'xi' && (
          <>
            {!isMyMatch && !isHost ? (
              <div style={styles.waitBox}>
                <div style={{ fontSize: 36, marginBottom: 12 }}>👀</div>
                <div style={{ fontSize: 16, marginBottom: 6 }}>{teamAName} vs {teamBName}</div>
                <div style={{ color: 'var(--text-muted)' }}>Both teams are selecting their XI...</div>
                {bothXIReady && isHost && (
                  <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => setPhase('toss')}>
                    Both XIs ready → Start Toss
                  </button>
                )}
              </div>
            ) : (
              <div style={styles.xiPanel}>

                <div style={styles.xiCountBar}>
                  <div>
                    <span style={{ fontSize: 28, fontWeight: 800, color: selectedXI.length === MAX_XI ? 'var(--gold)' : 'inherit' }}>
                      {selectedXI.length}
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 16 }}> / {MAX_XI} selected</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, color: overseasInXI >= MAX_OS_IN_XI ? '#ef4444' : 'var(--text-muted)' }}>
                      {overseasInXI}/{MAX_OS_IN_XI} overseas in XI
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      Squad: {mySquad.length} players · {mySquad.filter(p => p.nationality === 'OS').length} OS
                    </div>
                  </div>
                </div>

                <div style={styles.ruleBox}>
                  <span style={{ color: 'var(--gold)', fontWeight: 600 }}>Playing XI Rules:</span>
                  &nbsp;Exactly 11 players &nbsp;·&nbsp; Max 4 overseas &nbsp;·&nbsp; 1 Impact Player (sub, optional)
                  {oppIsCPU && (
                    <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>
                      · Opponent: <strong>CPU</strong> (XI auto-selected after you confirm)
                    </span>
                  )}
                </div>

                {ROLE_ORDER.map(role => {
                  const rolePlayers = squadByRole[role]
                  if (!rolePlayers || rolePlayers.length === 0) return null
                  return (
                    <div key={role}>
                      <div style={styles.roleHeader}>
                        <span className={`tag ${ROLE_CLASSES[role]}`}>{role}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{ROLE_LABELS[role]}</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)' }}>
                          {rolePlayers.filter(p => selectedXI.some(x => x.name === p.name)).length}/{rolePlayers.length} selected
                        </span>
                      </div>
                      <div style={styles.playerGrid}>
                        {rolePlayers.map(p => {
                          const inXI = selectedXI.some(x => x.name === p.name)
                          const osBlocked = !inXI && p.nationality === 'OS' && overseasInXI >= MAX_OS_IN_XI
                          const fullBlocked = !inXI && selectedXI.length >= MAX_XI
                          const disabled = osBlocked || fullBlocked
                          return (
                            <PlayerCard key={p.name} player={p}
                              selected={inXI}
                              disabled={disabled}
                              disabledReason={osBlocked ? 'OS limit' : fullBlocked ? 'XI full' : ''}
                              onClick={() => togglePlayer(p)} />
                          )
                        })}
                      </div>
                    </div>
                  )
                })}

                {/* Impact Player (from bench, after XI confirmed) */}
                {xiSaved && impactCandidates.length > 0 && (
                  <div style={styles.impactBox}>
                    <div style={styles.impactTitle}>
                      🔥 Impact Player
                      <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                        (IPL Rule: 1 sub per match, from bench, named at toss)
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                      Select 1 player from your bench. They can replace any XI player mid-match.
                      Once subbed in, the replaced player cannot bat/bowl/field.
                    </div>
                    <div style={styles.impactGrid}>
                      {impactCandidates.map(p => (
                        <button key={p.name}
                          onClick={() => setImpactPlayer(impactPlayer?.name === p.name ? null : p)}
                          style={{
                            ...styles.impactBtn,
                            background: impactPlayer?.name === p.name ? 'var(--gold)' : 'var(--bg-secondary)',
                            color: impactPlayer?.name === p.name ? '#000' : 'inherit',
                            fontWeight: impactPlayer?.name === p.name ? 700 : 400,
                            border: impactPlayer?.name === p.name ? '1.5px solid var(--gold)' : '1px solid var(--border)',
                          }}>
                          <span className={`tag ${ROLE_CLASSES[p.role]}`} style={{ fontSize: 9, marginRight: 4 }}>{p.role}</span>
                          {p.name}
                          {p.nationality === 'OS' && <span style={{ fontSize: 9, color: '#60a5fa', marginLeft: 4 }}>OS</span>}
                        </button>
                      ))}
                    </div>
                    {impactPlayer && (
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--gold)' }}>
                        ✓ Impact Player: <strong>{impactPlayer.name}</strong> — will be announced at toss
                      </div>
                    )}
                  </div>
                )}

                {/* Confirm button */}
                {!xiSaved && (
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 20, padding: '14px', fontSize: 16, opacity: selectedXI.length !== MAX_XI || saving ? 0.5 : 1 }}
                    disabled={selectedXI.length !== MAX_XI || saving}
                    onClick={handleSaveXI}>
                    {saving ? 'Saving...' : `Confirm XI (${selectedXI.length}/${MAX_XI}) →`}
                  </button>
                )}

                {/* Status after save */}
                {xiSaved && (
                  <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius)', fontSize: 13 }}>
                    ✅ <strong>XI saved!</strong>
                    {impactPlayer ? ` Impact Player: ${impactPlayer.name}` : ' No impact player selected.'}

                    {autoFillingCPU && (
                      <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                        ⏳ Setting CPU opponent's XI...
                      </div>
                    )}

                    {!autoFillingCPU && (
                      <div style={{ marginTop: 8, color: 'var(--text-muted)' }}>
                        {/* CPU match: host auto-proceeds to toss (handled in handleSaveXI) */}
                        {oppIsCPU && isHost
                          ? '✓ CPU XI set. Proceeding to toss...'
                          : bothXIReady
                            ? isHost
                              ? <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => setPhase('toss')}>Both XIs Ready → Proceed to Toss ▶</button>
                              : '✓ Both XIs set. Waiting for host to start toss...'
                            : "Waiting for opponent's XI..."}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── TOSS ── */}
        {phase === 'toss' && isHost && (
          <div style={styles.tossBox}>
            <div style={styles.tossTitle}>TOSS TIME</div>
            <div style={styles.tossTeams}>
              <span style={styles.tossTeamName}>{teamAName}</span>
              <span style={{ color: 'var(--text-muted)', margin: '0 12px' }}>vs</span>
              <span style={styles.tossTeamName}>{teamBName}</span>
            </div>
            <div style={{ fontSize: 80, margin: '24px 0', animation: tossAnimating ? 'coinFlip 0.15s linear infinite' : 'none' }}>
              🪙
            </div>
            <style>{`@keyframes coinFlip { 0%{transform:rotateY(0)} 100%{transform:rotateY(360deg)} }`}</style>
            <button className="btn btn-primary" style={{ fontSize: 18, padding: '14px 40px' }}
              onClick={handleToss} disabled={tossAnimating}>
              {tossAnimating ? 'Flipping...' : '🪙 Flip Coin!'}
            </button>
          </div>
        )}

        {/* ── TOSS DECISION ── */}
        {phase === 'tossdec' && canDecide && (
          <div style={styles.tossBox}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
            <div style={styles.tossResult}>
              <strong>{teams[tossWinner]?.name || tossWinner}</strong> wins the toss!
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: 15, margin: '16px 0 24px' }}>Choose to bat or bowl:</div>
            <div style={{ display: 'flex', gap: 16 }}>
              <button className="btn btn-primary" style={{ flex: 1, padding: '16px', fontSize: 16 }} onClick={() => handleTossDec('bat')}>
                🏏 Bat First
              </button>
              <button className="btn" style={{ flex: 1, padding: '16px', fontSize: 16, border: '2px solid var(--gold)', color: 'var(--gold)', background: 'transparent' }} onClick={() => handleTossDec('bowl')}>
                🎳 Bowl First
              </button>
            </div>
          </div>
        )}

        {phase === 'toss' && !isHost && (
          <div style={styles.waitBox}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🪙</div>
            <div>Waiting for host to flip the coin...</div>
          </div>
        )}
        {phase === 'tossdec' && !canDecide && (
          <div style={styles.waitBox}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🪙</div>
            <div>Waiting for toss winner to choose bat/bowl...</div>
          </div>
        )}

      </div>
    </div>
  )
}

function PlayerCard({ player, selected, disabled, disabledReason, onClick }) {
  return (
    <div onClick={disabled ? undefined : onClick} style={{
      padding: '10px 12px',
      borderRadius: 'var(--radius)',
      border: selected ? '1.5px solid var(--gold)' : '1px solid var(--border)',
      background: selected ? 'rgba(242,169,0,0.08)' : 'var(--bg-secondary)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.4 : 1,
      transition: 'all .12s',
      position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <span className={`tag ${ROLE_CLASSES[player.role] || 'tag-bat'}`} style={{ fontSize: 10 }}>{player.role}</span>
        {player.nationality === 'OS' && <span className="tag tag-os" style={{ fontSize: 9 }}>OS</span>}
        {disabled && disabledReason && <span style={{ fontSize: 9, color: '#ef4444', marginLeft: 2 }}>{disabledReason}</span>}
      </div>
      <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400 }}>{player.name}</div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
        ₹{player.soldPrice || player.basePrice}L
      </div>
      {selected && (
        <div style={{ position: 'absolute', top: 6, right: 8, color: 'var(--gold)', fontSize: 14 }}>✓</div>
      )}
    </div>
  )
}

const styles = {
  page: { height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  headerCenter: { textAlign: 'center' },
  headerTitle: { fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: 'var(--gold)' },
  headerSub: { fontSize: 12, color: 'var(--text-muted)' },
  steps: { display: 'flex', justifyContent: 'center', gap: 40, padding: '14px 20px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  stepItem: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  stepCircle: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, transition: 'all .2s' },
  body: { flex: 1, overflow: 'auto', padding: 20 },
  xiPanel: { maxWidth: 700, margin: '0 auto' },
  xiCountBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', marginBottom: 12, border: '1px solid var(--border)' },
  ruleBox: { padding: '8px 12px', background: 'rgba(242,169,0,0.07)', border: '1px solid rgba(242,169,0,0.2)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 16 },
  roleHeader: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, margin: '16px 0 10px' },
  playerGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 8 },
  impactBox: { marginTop: 24, padding: '16px', background: 'var(--bg-elevated)', border: '1px solid rgba(242,169,0,0.4)', borderRadius: 'var(--radius-lg)' },
  impactTitle: { fontSize: 14, fontWeight: 700, color: 'var(--gold)', marginBottom: 6 },
  impactGrid: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  impactBtn: { padding: '7px 12px', borderRadius: 'var(--radius)', fontSize: 12, cursor: 'pointer', transition: 'all .12s', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 4 },
  waitBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 300, color: 'var(--text-muted)', textAlign: 'center', gap: 8, fontSize: 15 },
  tossBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 400, textAlign: 'center', gap: 8 },
  tossTitle: { fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 800, color: 'var(--gold)', letterSpacing: 2 },
  tossTeams: { fontSize: 18, marginTop: 8 },
  tossTeamName: { fontWeight: 600 },
  tossResult: { fontSize: 22, color: 'var(--gold)', padding: '16px 24px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--gold)' },
}