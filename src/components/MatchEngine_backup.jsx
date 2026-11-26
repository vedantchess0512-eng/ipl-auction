import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subscribeTournament, saveMatchResult, savePlayoffResult } from '../utils/db.js'
import { simulateInnings } from '../utils/matchSimulator.js'

// ── Constants ──────────────────────────────────────────────────
const BATTING_MODES = [
  { key: 'defensive',  label: 'Defensive', icon: '🛡️', color: '#60a5fa', desc: 'Play safe, avoid wickets' },
  { key: 'normal',     label: 'Normal',    icon: '⚖️', color: '#a3a3a3', desc: 'Balanced approach' },
  { key: 'aggressive', label: 'Attack',    icon: '⚡', color: '#fb923c', desc: 'Go for boundaries' },
  { key: 'slog',       label: 'Slog',      icon: '💥', color: '#f43f5e', desc: 'Max hitting, high risk' },
]

const OUTCOME_LABEL = { dot:'0', one:'1', two:'2', three:'3', four:'4', six:'6', wicket:'W', wide:'Wd', noball:'Nb' }

// ── Helpers ────────────────────────────────────────────────────
const SR = (runs, balls) => balls > 0 ? ((runs / balls) * 100).toFixed(1) : '0.0'
const ECO = (runs, balls) => balls > 0 ? ((runs / balls) * 6).toFixed(2) : '0.00'
const oversDisplay = (overs, balls) => `${overs}.${balls}`

function ballColor(outcome) {
  if (outcome === 'wicket') return '#ef4444'
  if (outcome === 'six')    return 'var(--gold)'
  if (outcome === 'four')   return '#60a5fa'
  if (outcome === 'wide' || outcome === 'noball') return '#f97316'
  if (outcome === 'dot')    return 'var(--text-muted)'
  return 'var(--text-primary)'
}

function ballBg(outcome) {
  if (outcome === 'wicket') return '#7f1d1d'
  if (outcome === 'six')    return '#78350f'
  if (outcome === 'four')   return '#1e3a5f'
  if (outcome === 'wide' || outcome === 'noball') return '#7c2d12'
  if (outcome === 'dot')    return 'var(--bg-elevated)'
  return 'var(--bg-secondary)'
}

// ── Main Component ─────────────────────────────────────────────
export default function MatchEngine({ isPlayoff = false }) {
  const { roomId, matchId } = useParams()
  const navigate = useNavigate()
  const [room, setRoom] = useState(null)
  const commentaryRef = useRef(null)

  // Phase: 'setup1' | 'innings1' | 'between' | 'setup2' | 'innings2' | 'result'
  const [gamePhase, setGamePhase] = useState('setup1')
  const [innings1, setInnings1] = useState(null)
  const [innings2, setInnings2] = useState(null)
  const [shownBalls, setShownBalls] = useState([])
  const [ballCursor, setBallCursor] = useState(0)
  const [currentInnings, setCurrentInnings] = useState(1)
  const [resultSaved, setResultSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('commentary') // commentary | scorecard | bowling | fowl

  // Host decisions state
  // battingModes: { playerName: 'normal' | 'defensive' | 'aggressive' | 'slog' }
  const [battingModes1, setBattingModes1] = useState({}) // innings 1 batting team modes
  const [battingModes2, setBattingModes2] = useState({}) // innings 2 batting team modes
  const [bowlerOrder1, setBowlerOrder1] = useState([])   // innings 1 bowling order
  const [bowlerOrder2, setBowlerOrder2] = useState([])   // innings 2 bowling order
  const [battingOrder1, setBattingOrder1] = useState([]) // innings 1 batting order
  const [battingOrder2, setBattingOrder2] = useState([]) // innings 2 batting order

  // Over summary popup
  const [overSummaryPopup, setOverSummaryPopup] = useState(null)
  const [showBowlerModal, setShowBowlerModal] = useState(false)
  const [overJustEnded, setOverJustEnded] = useState(false)

  const isHost = localStorage.getItem('isHost') === 'true' ||
                 localStorage.getItem(`isHost_${roomId}`) === 'true'

  useEffect(() => {
    const unsub = subscribeTournament(roomId, data => { if (data) setRoom(data) })
    return unsub
  }, [roomId])

  useEffect(() => {
    if (commentaryRef.current) {
      commentaryRef.current.scrollTop = commentaryRef.current.scrollHeight
    }
  }, [shownBalls])

  if (!room) return <Loading text="Loading match..." />

  const tournament = room.tournament
  const match = isPlayoff ? tournament?.playoffs?.[matchId] : tournament?.matches?.[matchId]
  if (!match) return <Loading text="Match not found." />

  const teams = room.teams || {}
  const playerName = localStorage.getItem('playerName') || ''
  const myTeam = Object.values(teams).find(t => t.ownerId === playerName)
  const myTeamId = myTeam?.id
  const { tossWinner, tossDec, xiA, xiB, impactA, impactB } = match

  // Determine who bats first
  const tossWonByA = tossWinner === match.teamA
  const batFirstId  = tossDec === 'bat' ? (tossWonByA ? match.teamA : match.teamB) : (tossWonByA ? match.teamB : match.teamA)
  const batSecondId = batFirstId === match.teamA ? match.teamB : match.teamA
  const battingFirstIsA = batFirstId === match.teamA

  const battingXI1  = battingFirstIsA ? (xiA || []) : (xiB || [])
  const bowlingXI1  = battingFirstIsA ? (xiB || []) : (xiA || [])
  const battingXI2  = battingFirstIsA ? (xiB || []) : (xiA || [])
  const bowlingXI2  = battingFirstIsA ? (xiA || []) : (xiB || [])
  const impact1     = battingFirstIsA ? impactA : impactB
  const impact2     = battingFirstIsA ? impactB : impactA

  const batFirstName  = teams[batFirstId]?.name  || (battingFirstIsA ? match.teamAName : match.teamBName)
  const batSecondName = teams[batSecondId]?.name || (battingFirstIsA ? match.teamBName : match.teamAName)
  const batFirstColor  = teams[batFirstId]?.color  || '#FFD700'
  const batSecondColor = teams[batSecondId]?.color || '#60a5fa'

  const currentBattingTeamId = currentInnings === 1 ? batFirstId : batSecondId
  const currentBowlingTeamId = currentInnings === 1 ? batSecondId : batFirstId
  const iAmBatting = myTeamId === currentBattingTeamId
  const iAmBowling = myTeamId === currentBowlingTeamId

  // ── Live stats from shownBalls ──
  const currentBallData = shownBalls[shownBalls.length - 1]
  const liveRuns     = shownBalls.reduce((s,b) => s + (b.runs||0), 0)
  const liveWickets  = shownBalls.filter(b => b.isWicket).length
  const liveBalls    = shownBalls.filter(b => !b.isExtra).length
  const liveOvers    = `${Math.floor(liveBalls/6)}.${liveBalls%6}`
  const thisOverBalls = shownBalls.filter(b => !b.isExtra).slice(-6)
  const lastBall = shownBalls[shownBalls.length - 1]

  // Current batsmen from last ball
  const currentBattingXIStriker = currentInnings === 1 ? battingXI1 : battingXI2
  const strikerName    = currentBallData?.strikerName || currentBattingXIStriker[0]?.name
  const nonStrikerName = currentBallData?.nonStrikerName || currentBattingXIStriker[1]?.name

  // Live per-batsman stats from shownBalls
  const liveBatsmanStats = {}
  shownBalls.forEach(b => {
    if (!b.batsman) return
    if (!liveBatsmanStats[b.batsman]) liveBatsmanStats[b.batsman] = { runs:0, balls:0, fours:0, sixes:0, isOut:false }
    const bs = liveBatsmanStats[b.batsman]
    if (!b.isExtra) { bs.balls++; bs.runs += b.runs }
    if (b.outcome === 'four') bs.fours++
    if (b.outcome === 'six') bs.sixes++
    if (b.isWicket) bs.isOut = true
  })

  // Live per-bowler stats
  const liveBowlerStats = {}
  shownBalls.forEach(b => {
    if (!b.bowler) return
    if (!liveBowlerStats[b.bowler]) liveBowlerStats[b.bowler] = { balls:0, runs:0, wickets:0, overs:0 }
    const bs = liveBowlerStats[b.bowler]
    if (!b.isExtra) bs.balls++
    bs.runs += b.runs
    if (b.isWicket) bs.wickets++
    bs.overs = Math.floor(bs.balls/6)
  })

  // Current bowler = most recent ball's bowler
  const currentBowlerName = lastBall?.bowler

  // ── Actions ──────────────────────────────────────────────────

  const startInnings1 = () => {
    const result = simulateInnings(
      battingXI1, bowlingXI1, null, impact1,
      { battingModes: battingModes1, bowlerOrder: bowlerOrder1, battingOrder: battingOrder1 }
    )
    setInnings1(result)
    setShownBalls([result.ballLog[0]].filter(Boolean))
    setBallCursor(0)
    setCurrentInnings(1)
    setGamePhase('innings1')
    setActiveTab('commentary')
  }

  const startInnings2 = () => {
    if (!innings1) return
    const target = innings1.runs + 1
    const result = simulateInnings(
      battingXI2, bowlingXI2, target, impact2,
      { battingModes: battingModes2, bowlerOrder: bowlerOrder2, battingOrder: battingOrder2 }
    )
    setInnings2(result)
    setShownBalls([result.ballLog[0]].filter(Boolean))
    setBallCursor(0)
    setCurrentInnings(2)
    setGamePhase('innings2')
    setActiveTab('commentary')
  }

  const showNextBall = () => {
    const log = currentInnings === 1 ? innings1?.ballLog : innings2?.ballLog
    if (!log) return
    const next = ballCursor + 1

    // Check if we just completed an over
    const prevBall = log[ballCursor]
    const nextBall = log[next]
    const prevOver = prevBall ? Math.floor(prevBall.ballNum / 6) : -1
    const nextOver = nextBall ? Math.floor(nextBall.ballNum / 6) : -1

    if (next < log.length) {
      setShownBalls(log.slice(0, next + 1))
      setBallCursor(next)
      // Show over summary popup when over changes
      if (nextOver > prevOver && prevOver >= 0) {
        const innings = currentInnings === 1 ? innings1 : innings2
        const summary = innings?.overSummaries?.[prevOver]
        if (summary) {
          setOverSummaryPopup(summary)
          setOverJustEnded(true)
          // Only auto-close popup for non-bowling captains
          if (!iAmBowling) {
            setTimeout(() => setOverSummaryPopup(null), 3000)
          }
        }
      } else {
        // Clear popup if we're not at an over end
        setOverSummaryPopup(null)
        setOverJustEnded(false)
      }
    } else {
      if (currentInnings === 1) setGamePhase('between')
      else setGamePhase('result')
    }
  }

  const skipToEnd = () => {
    const log = currentInnings === 1 ? innings1?.ballLog : innings2?.ballLog
    if (!log) return
    setShownBalls(log)
    setBallCursor(log.length - 1)
    if (currentInnings === 1) setGamePhase('between')
    else setGamePhase('result')
  }

  const getResult = () => {
    if (!innings1 || !innings2) return null
    const s1 = innings1.runs, s2 = innings2.runs
    if (s2 > s1) {
      const wktsLeft = 10 - innings2.wickets
      return { winner: batSecondId, text: `${batSecondName} won by ${wktsLeft} wicket${wktsLeft !== 1 ? 's' : ''}`, margin: `${wktsLeft} wickets` }
    }
    if (s1 > s2) {
      const margin = s1 - s2
      return { winner: batFirstId, text: `${batFirstName} won by ${margin} run${margin !== 1 ? 's' : ''}`, margin: `${margin} runs` }
    }
    return { winner: null, text: 'Match Tied!', margin: 'Tie' }
  }

  const handleSaveResult = async () => {
    if (saving || resultSaved) return
    const res = getResult()
    if (!res) return
    setSaving(true)

    const payload = {
      scoreA:   battingFirstIsA ? innings1.runs    : innings2.runs,
      wicketsA: battingFirstIsA ? innings1.wickets : innings2.wickets,
      oversA:   battingFirstIsA ? innings1.overs   : innings2.overs,
      scoreB:   battingFirstIsA ? innings2.runs    : innings1.runs,
      wicketsB: battingFirstIsA ? innings2.wickets : innings1.wickets,
      oversB:   battingFirstIsA ? innings2.overs   : innings1.overs,
      winner:   res.winner || null,
      ballLogA: battingFirstIsA ? innings1.ballLog : innings2.ballLog,
      ballLogB: battingFirstIsA ? innings2.ballLog : innings1.ballLog,
    }

    if (isPlayoff) await savePlayoffResult(roomId, matchId, payload)
    else           await saveMatchResult(roomId, matchId, payload)

    setResultSaved(true)
    setSaving(false)
  }

  const result = (gamePhase === 'result') ? getResult() : null
  const currentInningsObj = currentInnings === 1 ? innings1 : innings2
  const currentBattingTeamName = currentInnings === 1 ? batFirstName : batSecondName
  const currentBattingTeamColor = currentInnings === 1 ? batFirstColor : batSecondColor
  const currentBattingXI = currentInnings === 1 ? battingXI1 : battingXI2
  const currentBowlingXI = currentInnings === 1 ? bowlingXI1 : bowlingXI2

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div style={styles.page}>

      {/* ── HEADER ── */}
      <div style={styles.header}>
        <div style={styles.headerMatch}>{match.label}</div>
        <div style={styles.headerTeams}>{match.teamAName} vs {match.teamBName}</div>
        <div style={styles.tossInfo}>
          🪙 {teams[tossWinner]?.name} won toss · chose to {tossDec}
          {impact1 && <span style={{ marginLeft:10, color:'var(--gold)' }}>🔥 {impact1.name}</span>}
        </div>
      </div>

      {/* ── SETUP PHASE 1 ── */}
      {gamePhase === 'setup1' && (
        <SetupPhase
          battingTeamName={batFirstName}
          battingTeamColor={batFirstColor}
          bowlingTeamName={batSecondName}
          battingXI={battingXI1}
          bowlingXI={bowlingXI1}
          battingModes={battingModes1}
          setBattingModes={setBattingModes1}
          bowlerOrder={bowlerOrder1}
          setBowlerOrder={setBowlerOrder1}
          battingOrder={battingOrder1}
          setBattingOrder={setBattingOrder1}
          isHost={isHost}
          onStart={startInnings1}
          inningsNum={1}
          myTeamId={myTeamId}
          battingTeamId={batFirstId}
          bowlingTeamId={batSecondId}
        />
      )}

      {/* ── SETUP PHASE 2 ── */}
      {gamePhase === 'setup2' && (
        <SetupPhase
          battingTeamName={batSecondName}
          battingTeamColor={batSecondColor}
          bowlingTeamName={batFirstName}
          battingXI={battingXI2}
          bowlingXI={bowlingXI2}
          battingModes={battingModes2}
          setBattingModes={setBattingModes2}
          bowlerOrder={bowlerOrder2}
          setBowlerOrder={setBowlerOrder2}
          battingOrder={battingOrder2}
          setBattingOrder={setBattingOrder2}
          isHost={isHost}
          onStart={startInnings2}
          inningsNum={2}
          target={innings1 ? innings1.runs + 1 : null}
          myTeamId={myTeamId}
          battingTeamId={batSecondId}
          bowlingTeamId={batFirstId}
        />
      )}

      {/* ── LIVE INNINGS ── */}
      {(gamePhase === 'innings1' || gamePhase === 'innings2') && (
        <>
          {/* Over summary popup */}
          {overSummaryPopup && (
            <div style={styles.overPopup}>
              <div style={styles.overPopupTitle}>End of Over {overSummaryPopup.over}</div>
              <div style={styles.overPopupScore}>{overSummaryPopup.runs} runs · {overSummaryPopup.wickets} wkt</div>
              <div style={{ display:'flex', gap:6, justifyContent:'center', marginTop:8 }}>
                {overSummaryPopup.balls.map((b,i) => (
                  <div key={i} style={{ ...styles.popupBall, background: ballBg(b.outcome), color: ballColor(b.outcome) }}>
                    {OUTCOME_LABEL[b.outcome]}
                  </div>
                ))}
              </div>
              <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:6 }}>Bowler: {overSummaryPopup.bowler}</div>
              {iAmBowling && (
                <button
                  className="btn btn-primary"
                  style={{ marginTop:10, padding:'6px 16px', fontSize:12 }}
                  onClick={() => setShowBowlerModal(true)}
                >
                  🎳 Select Next Bowler
                </button>
              )}
              {iAmBowling && (
                <div style={{ fontSize:10, color:'var(--text-muted)', marginTop:6, cursor:'pointer' }}
                     onClick={() => { setOverSummaryPopup(null); setOverJustEnded(false) }}>
                  Dismiss
                </div>
              )}
            </div>
          )}

          {/* Bowler Selection Modal */}
          {showBowlerModal && (
            <div style={styles.modalOverlay} onClick={() => setShowBowlerModal(false)}>
              <div style={styles.modalContent} onClick={e => e.stopPropagation()}>
                <div style={styles.modalHeader}>Select Next Bowler</div>
                <div style={styles.modalSubheader}>Choose bowler for the next over</div>
                <div style={{ maxHeight:300, overflowY:'auto' }}>
                  {currentBowlingXI
                    .filter(p => ['BOWL','AR'].includes((p.role||'').toUpperCase()))
                    .map(p => {
                      const stats = liveBowlerStats[p.name]
                      const oversBowled = stats ? Math.floor(stats.balls / 6) : 0
                      const canBowl = oversBowled < 4
                      return (
                        <div
                          key={p.name}
                          onClick={() => {
                            if (canBowl) {
                              setShowBowlerModal(false)
                              setOverJustEnded(false)
                              setOverSummaryPopup(null)
                            }
                          }}
                          style={{
                            ...styles.modalItem,
                            opacity: canBowl ? 1 : 0.4,
                            cursor: canBowl ? 'pointer' : 'not-allowed',
                            background: canBowl ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                          }}
                        >
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:13, fontWeight:600 }}>{p.name}</div>
                            <div style={{ fontSize:10, color:'var(--text-muted)' }}>{p.role} · {oversBowled} overs bowled</div>
                          </div>
                          {!canBowl && <span style={{ fontSize:10, color:'#ef4444' }}>Max 4 overs</span>}
                        </div>
                      )
                    })}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ marginTop:10, width:'100%' }}
                  onClick={() => setShowBowlerModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Scorecard panel */}
          <div style={styles.scorecard}>
            {/* Team + score */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div>
                <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:2 }}>
                  {currentBattingTeamName}
                  {currentInnings === 2 && <span style={{ color:'#f97316' }}> · Chasing</span>}
                </div>
                <div style={{ display:'flex', alignItems:'baseline', gap:8 }}>
                  <span style={styles.bigScore}>{liveRuns}/{liveWickets}</span>
                  <span style={styles.oversLabel}>({liveOvers} ov)</span>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                {currentInnings === 2 && innings1 && (
                  <>
                    <div style={{ fontSize:12, color:'var(--text-muted)' }}>Target</div>
                    <div style={{ fontSize:22, fontWeight:700, color:'var(--gold)' }}>{innings1.runs + 1}</div>
                    <div style={{ fontSize:12, color:'#f97316' }}>
                      Need {Math.max(0, innings1.runs + 1 - liveRuns)} off {Math.max(0, 120 - liveBalls)} balls
                    </div>
                  </>
                )}
                {currentInnings === 1 && (
                  <div style={{ fontSize:13, color:'var(--text-muted)' }}>
                    CRR: {liveBalls > 0 ? ((liveRuns/(liveBalls/6))).toFixed(2) : '0.00'}
                  </div>
                )}
              </div>
            </div>

            {/* Batsmen row */}
            <div style={styles.batsmenRow}>
              {[strikerName, nonStrikerName].filter(Boolean).map((name, idx) => {
                const bs = liveBatsmanStats[name] || { runs:0, balls:0, fours:0, sixes:0 }
                const isStriker = idx === 0
                return (
                  <div key={name} style={{ ...styles.batsmanChip, opacity: idx===1 ? 0.75 : 1 }}>
                    <span style={{ fontSize:11, color: isStriker ? 'var(--gold)' : 'var(--text-muted)', marginRight:4 }}>
                      {isStriker ? '🏏' : ''}
                    </span>
                    <span style={{ fontSize:13, fontWeight: isStriker ? 700 : 400 }}>{name}</span>
                    <span style={{ fontSize:13, color:'var(--gold)', marginLeft:6, fontFamily:'var(--font-display)' }}>
                      {bs.runs}({bs.balls})
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Current bowler */}
            {currentBowlerName && (
              <div style={styles.bowlerChip}>
                <span style={{ fontSize:11, color:'var(--text-muted)' }}>🎳 {currentBowlerName}</span>
                {liveBowlerStats[currentBowlerName] && (() => {
                  const bs = liveBowlerStats[currentBowlerName]
                  return (
                    <span style={{ fontSize:11, color:'var(--text-muted)', marginLeft:8 }}>
                      {Math.floor(bs.balls/6)}.{bs.balls%6}-{bs.runs}-{bs.wickets}
                    </span>
                  )
                })()}
              </div>
            )}
          </div>

          {/* This over balls */}
          <div style={styles.overRow}>
            <span style={styles.overRowLabel}>Over {Math.floor(liveBalls/6)+1}:</span>
            <div style={{ display:'flex', gap:6 }}>
              {Array.from({ length: 6 }).map((_, i) => {
                const b = thisOverBalls[i]
                return (
                  <div key={i} style={{
                    ...styles.ballDot,
                    background: b ? ballBg(b.outcome) : 'transparent',
                    color: b ? ballColor(b.outcome) : 'var(--border)',
                    border: b ? 'none' : '1px solid var(--border)',
                    fontWeight: 700,
                  }}>
                    {b ? (OUTCOME_LABEL[b.outcome] || '?') : '·'}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Last ball highlight */}
          {lastBall && (
            <div style={{ ...styles.lastBallBox, borderLeftColor: ballColor(lastBall.outcome) }}>
              <span style={{ fontSize:22, fontWeight:800, color: ballColor(lastBall.outcome), minWidth:32 }}>
                {OUTCOME_LABEL[lastBall.outcome]}
              </span>
              <span style={{ fontSize:14 }}>{lastBall.text}</span>
            </div>
          )}

          {/* Tabs */}
          <div style={styles.tabRow}>
            {['commentary','scorecard','bowling','fowl'].map(t => (
              <button key={t} onClick={() => setActiveTab(t)} style={{
                ...styles.tabBtn,
                color: activeTab === t ? 'var(--gold)' : 'var(--text-muted)',
                borderBottom: activeTab === t ? '2px solid var(--gold)' : '2px solid transparent',
              }}>
                {t === 'commentary' ? '📣 Live' : t === 'scorecard' ? '🏏 Batting' : t === 'bowling' ? '🎳 Bowling' : '📉 FoW'}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div ref={commentaryRef} style={styles.tabContent}>

            {/* Commentary */}
            {activeTab === 'commentary' && (
              <div>
                {[...shownBalls].reverse().map((b, i) => (
                  <div key={i} style={{
                    ...styles.commentaryLine,
                    background: b.isWicket ? 'rgba(239,68,68,0.08)' : b.outcome === 'six' ? 'rgba(251,191,36,0.06)' : 'transparent',
                  }}>
                    <span style={{ color:'var(--text-muted)', fontSize:11, minWidth:44, flexShrink:0 }}>
                      Ov {b.over}.{b.ballInOver}
                    </span>
                    <div style={{
                      width:26, height:26, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:11, fontWeight:700, flexShrink:0,
                      background: ballBg(b.outcome), color: ballColor(b.outcome),
                    }}>
                      {OUTCOME_LABEL[b.outcome]}
                    </div>
                    <span style={{ flex:1, fontSize:13 }}>{b.text}</span>
                    <span style={{ fontSize:11, color:'var(--text-muted)', flexShrink:0 }}>
                      {b.totalRuns}/{b.totalWickets}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Batting scorecard */}
            {activeTab === 'scorecard' && (
              <div>
                <table style={styles.scorecardTable}>
                  <thead>
                    <tr>
                      <th style={styles.sth}>Batsman</th>
                      <th style={styles.sth}>R</th>
                      <th style={styles.sth}>B</th>
                      <th style={styles.sth}>4s</th>
                      <th style={styles.sth}>6s</th>
                      <th style={styles.sth}>SR</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBattingXI.map(p => {
                      const bs = liveBatsmanStats[p.name] || { runs:0, balls:0, fours:0, sixes:0, isOut:false }
                      const isStriker = p.name === strikerName
                      const isNon = p.name === nonStrikerName
                      const isDNB = !bs.balls && !bs.runs && !isStriker && !isNon
                      return (
                        <tr key={p.name} style={{
                          ...styles.str,
                          background: isStriker ? 'rgba(251,191,36,0.07)' : 'transparent',
                          opacity: isDNB ? 0.4 : 1,
                        }}>
                          <td style={styles.std}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              {isStriker && <span style={{ color:'var(--gold)', fontSize:12 }}>🏏</span>}
                              {isNon && !isStriker && <span style={{ fontSize:10, color:'var(--text-muted)' }}>●</span>}
                              <span style={{ fontSize:13, fontWeight: isStriker ? 600 : 400 }}>{p.name}</span>
                            </div>
                            {bs.isOut && <div style={{ fontSize:10, color:'var(--text-muted)' }}>out</div>}
                            {isDNB && <div style={{ fontSize:10, color:'var(--text-muted)' }}>yet to bat</div>}
                          </td>
                          <td style={{ ...styles.std, fontWeight:700, color: isDNB ? 'var(--text-muted)' : 'inherit' }}>{isDNB ? '-' : bs.runs}</td>
                          <td style={styles.std}>{isDNB ? '-' : bs.balls}</td>
                          <td style={styles.std}>{isDNB ? '-' : bs.fours}</td>
                          <td style={styles.std}>{isDNB ? '-' : bs.sixes}</td>
                          <td style={styles.std}>{isDNB ? '-' : SR(bs.runs, bs.balls)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bowling figures */}
            {activeTab === 'bowling' && (
              <div>
                <table style={styles.scorecardTable}>
                  <thead>
                    <tr>
                      <th style={styles.sth}>Bowler</th>
                      <th style={styles.sth}>O</th>
                      <th style={styles.sth}>R</th>
                      <th style={styles.sth}>W</th>
                      <th style={styles.sth}>Eco</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentBowlingXI
                      .filter(p => ['BOWL','AR','WK','BAT'].includes(p.role))
                      .map(p => {
                        const bs = liveBowlerStats[p.name]
                        if (!bs) return null
                        const isCurrent = p.name === currentBowlerName
                        return (
                          <tr key={p.name} style={{
                            ...styles.str,
                            background: isCurrent ? 'rgba(96,165,250,0.07)' : 'transparent',
                          }}>
                            <td style={styles.std}>
                              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                                {isCurrent && <span style={{ color:'#60a5fa', fontSize:12 }}>🎳</span>}
                                <span style={{ fontSize:13, fontWeight: isCurrent ? 600 : 400 }}>{p.name}</span>
                              </div>
                            </td>
                            <td style={styles.std}>{Math.floor(bs.balls/6)}.{bs.balls%6}</td>
                            <td style={styles.std}>{bs.runs}</td>
                            <td style={{ ...styles.std, fontWeight:700, color: bs.wickets > 0 ? '#f87171' : 'inherit' }}>{bs.wickets}</td>
                            <td style={styles.std}>{ECO(bs.runs, bs.balls)}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Fall of wickets */}
            {activeTab === 'fowl' && (
              <div style={{ padding:'8px 0' }}>
                {shownBalls.filter(b => b.isWicket).length === 0 && (
                  <div style={{ textAlign:'center', color:'var(--text-muted)', padding:'30px', fontSize:13 }}>
                    No wickets yet
                  </div>
                )}
                {shownBalls.filter(b => b.isWicket).map((b, i) => (
                  <div key={i} style={styles.fowlRow}>
                    <div style={{ width:24, height:24, borderRadius:'50%', background:'#7f1d1d', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#fca5a5', flexShrink:0 }}>
                      {i+1}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:500 }}>{b.batsman}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>b {b.bowler}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#f87171' }}>{b.totalRuns}/{b.totalWickets}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)' }}>Ov {b.over}.{b.ballInOver}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={styles.controls}>
            {/* Batting mode buttons — only visible to batting team captain */}
            {iAmBatting && strikerName && (
              <div style={styles.modeRow}>
                <span style={{ fontSize:11, color:'var(--text-muted)', marginRight:6, flexShrink:0 }}>
                  {strikerName.split(' ').slice(-1)[0]}:
                </span>
                {BATTING_MODES.map(m => {
                  const modes = currentInnings === 1 ? battingModes1 : battingModes2
                  const setModes = currentInnings === 1 ? setBattingModes1 : setBattingModes2
                  const active = (modes[strikerName] || 'normal') === m.key
                  return (
                    <button key={m.key} onClick={() => setModes(prev => ({ ...prev, [strikerName]: m.key }))}
                      title={m.desc}
                      style={{
                        padding:'4px 8px', fontSize:11, borderRadius:6, border:'none', cursor:'pointer',
                        background: active ? m.color : 'var(--bg-elevated)',
                        color: active ? '#000' : 'var(--text-muted)',
                        fontWeight: active ? 700 : 400,
                        transition:'all .15s',
                      }}>
                      {m.icon} {m.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Next ball/skip buttons — only for host */}
            {isHost ? (
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-primary" style={{ flex:1, padding:'12px', fontSize:15 }} onClick={showNextBall}>
                  {ballCursor >= (currentInningsObj?.ballLog?.length || 1) - 1
                    ? currentInnings === 1 ? 'End Innings →' : 'See Result →'
                    : '▶ Next Ball'}
                </button>
                <button className="btn btn-ghost" style={{ padding:'12px 18px' }} onClick={skipToEnd}>⏭ Skip</button>
              </div>
            ) : (
              !iAmBatting && !iAmBowling && (
                <div style={{ padding:'12px 20px', textAlign:'center', color:'var(--text-muted)', fontSize:13, borderTop:'1px solid var(--border)', flexShrink:0 }}>
                  Watching live — host controls the pace
                </div>
              )
            )}
          </div>}
        </>
      )}

      {/* ── BETWEEN INNINGS ── */}
      {gamePhase === 'between' && (
        <div style={styles.centeredSection}>
          <div style={{ ...styles.inningsCard, width:'100%', maxWidth:420 }}>
            <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:4 }}>Innings 1 · {batFirstName}</div>
            <div style={{ fontFamily:'var(--font-display)', fontSize:40, fontWeight:800, color:'var(--gold)' }}>
              {innings1?.runs}/{innings1?.wickets}
            </div>
            <div style={{ color:'var(--text-muted)', marginTop:2 }}>({innings1?.overs} ov)</div>
            <div style={{ marginTop:14, padding:'10px 14px', background:'var(--bg-secondary)', borderRadius:'var(--radius)', fontSize:15 }}>
              Target for {batSecondName}: <strong style={{ color:'var(--gold)', fontSize:20 }}>{(innings1?.runs||0)+1}</strong>
            </div>
            {/* Top performers from innings 1 */}
            {innings1?.battingScorecard && (
              <div style={{ marginTop:14 }}>
                <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:6 }}>Top Bat</div>
                {innings1.battingScorecard
                  .filter(b => b.status !== 'dnb')
                  .sort((a,b) => b.runs - a.runs)
                  .slice(0,2)
                  .map(b => (
                    <div key={b.name} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px solid var(--border)' }}>
                      <span>{b.name}</span>
                      <span style={{ color:'var(--gold)', fontFamily:'var(--font-display)' }}>{b.runs}({b.balls})</span>
                    </div>
                  ))}
                <div style={{ fontSize:11, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginTop:10, marginBottom:6 }}>Top Bowl</div>
                {innings1.bowlerFigures
                  .sort((a,b) => b.wickets - a.wickets || a.runs - b.runs)
                  .slice(0,2)
                  .map(b => (
                    <div key={b.name} style={{ display:'flex', justifyContent:'space-between', fontSize:12, padding:'3px 0', borderBottom:'1px solid var(--border)' }}>
                      <span>{b.name}</span>
                      <span style={{ color:'#f87171', fontFamily:'var(--font-display)' }}>{b.wickets}/{b.runs}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
          {isHost && (
            <button className="btn btn-primary" style={{ marginTop:16, padding:'14px 40px', fontSize:16 }}
              onClick={() => setGamePhase('setup2')}>
              🏏 Set Up Innings 2 →
            </button>
          )}
          {!isHost && <div style={{ marginTop:16, color:'var(--text-muted)' }}>Waiting for host to start 2nd innings...</div>}
        </div>
      )}

      {/* ── RESULT ── */}
      {gamePhase === 'result' && result && (
        <div style={{ ...styles.centeredSection, overflow:'auto' }}>
          <div style={{ fontSize:72 }}>🏆</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:26, fontWeight:800, color:'var(--gold)', textAlign:'center' }}>
            {result.text}
          </div>
          <div style={{ display:'flex', gap:24, marginTop:8 }}>
            {[
              { name: batFirstName,  inn: innings1 },
              { name: batSecondName, inn: innings2 },
            ].map(({ name, inn }) => (
              <div key={name} style={styles.inningsCard}>
                <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>{name}</div>
                <div style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:700 }}>
                  {inn?.runs}/{inn?.wickets}
                </div>
                <div style={{ fontSize:12, color:'var(--text-muted)' }}>({inn?.overs} ov)</div>
              </div>
            ))}
          </div>
          {/* Final scorecards */}
          {innings1 && innings2 && (
            <div style={{ width:'100%', maxWidth:500, marginTop:16 }}>
              <FullScorecard inn={innings1} label={`${batFirstName} — Innings 1`} />
              <FullScorecard inn={innings2} label={`${batSecondName} — Innings 2`} />
            </div>
          )}
          {isHost && !resultSaved && (
            <button className="btn btn-primary" style={{ marginTop:16, padding:'14px 40px', fontSize:16 }}
              onClick={handleSaveResult} disabled={saving}>
              {saving ? 'Saving...' : '✓ Save Result & Continue'}
            </button>
          )}
          {resultSaved && (
            <div style={{ marginTop:16, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
              <div style={{ color:'var(--text-success)' }}>✓ Result saved!</div>
              <button className="btn btn-primary" onClick={() => navigate(`/tournament/${roomId}`)}>
                ← Back to Tournament
              </button>
            </div>
          )}
          {!isHost && (
            <button className="btn btn-ghost" style={{ marginTop:16 }} onClick={() => navigate(`/tournament/${roomId}`)}>
              ← Back to Tournament
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── SetupPhase component ───────────────────────────────────────
function SetupPhase({ battingTeamName, battingTeamColor, bowlingTeamName, battingXI, bowlingXI, battingModes, setBattingModes, bowlerOrder, setBowlerOrder, battingOrder, setBattingOrder, isHost, onStart, inningsNum, target, myTeamId, battingTeamId, bowlingTeamId }) {
  const bowlers = bowlingXI.filter(p => ['BOWL','AR'].includes((p.role||'').toUpperCase()))

  const amBattingCaptain = myTeamId === battingTeamId
  const amBowlingCaptain = myTeamId === bowlingTeamId

  const toggleBowler = (name) => {
    setBowlerOrder(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name)
      return [...prev, name]
    })
  }

  const toggleBattingOrder = (name) => {
    setBattingOrder(prev => {
      if (prev.includes(name)) return prev.filter(n => n !== name)
      return [...prev, name]
    })
  }

  return (
    <div style={{ flex:1, overflow:'auto', padding:20 }}>
      <div style={{ maxWidth:680, margin:'0 auto' }}>
        {/* Innings header */}
        <div style={{ padding:'14px 18px', background:'var(--bg-elevated)', borderRadius:'var(--radius-lg)', border:`1px solid ${battingTeamColor}44`, marginBottom:20 }}>
          <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:4 }}>Innings {inningsNum}</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800, color: battingTeamColor }}>{battingTeamName} batting</div>
          {target && <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:4 }}>Target: <strong style={{ color:'var(--gold)' }}>{target}</strong></div>}
        </div>

        {/* Batting modes — only visible to batting team captain */}
        {amBattingCaptain && (
          <div style={{ marginBottom:20 }}>
            <div style={styles.setupSectionLabel}>🏏 Batting Modes — {battingTeamName}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>Set approach for each batsman. Affects their shot selection.</div>
            {battingXI.map((p, i) => {
              const currentMode = battingModes[p.name] || 'normal'
              return (
                <div key={p.name} style={styles.setupPlayerRow}>
                  <div style={{ fontSize:12, fontWeight:500, marginBottom:5 }}>
                    <span style={{ color:'var(--text-muted)', marginRight:4 }}>#{i+1}</span>
                    {p.name}
                    <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:4 }}>({p.role})</span>
                  </div>
                  <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                    {BATTING_MODES.map(m => (
                      <button key={m.key} onClick={() => setBattingModes(prev => ({ ...prev, [p.name]: m.key }))}
                        style={{
                          padding:'3px 8px', fontSize:10, borderRadius:4, border:'none', cursor:'pointer',
                          background: currentMode === m.key ? m.color : 'var(--bg-secondary)',
                          color: currentMode === m.key ? '#000' : 'var(--text-muted)',
                          fontWeight: currentMode === m.key ? 700 : 400,
                        }}>
                        {m.icon} {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Bowling order — only visible to bowling team captain */}
        {amBowlingCaptain && (
          <div style={{ marginBottom:20 }}>
            <div style={styles.setupSectionLabel}>🎳 Bowling Order — {bowlingTeamName}</div>
            <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:10 }}>Select bowlers in preferred order. Auto-rotates, max 4 overs each.</div>
            {bowlers.map(p => {
              const selected = bowlerOrder.includes(p.name)
              const idx = bowlerOrder.indexOf(p.name)
              return (
                <div key={p.name} onClick={() => toggleBowler(p.name)} style={{
                  ...styles.setupPlayerRow,
                  cursor: 'pointer',
                  border: selected ? '1px solid var(--gold)' : '1px solid var(--border)',
                  background: selected ? 'rgba(251,191,36,0.06)' : 'var(--bg-secondary)',
                  display:'flex', alignItems:'center', gap:10, padding:'8px 12px',
                }}>
                  <div style={{
                    width:22, height:22, borderRadius:'50%', flexShrink:0,
                    background: selected ? 'var(--gold)' : 'var(--bg-elevated)',
                    color: selected ? '#000' : 'var(--text-muted)',
                    display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700,
                  }}>
                    {selected ? idx+1 : ''}
                  </div>
                  <div style={{ flex:1, fontSize:12, fontWeight: selected ? 600 : 400 }}>{p.name}</div>
                  <span style={{ fontSize:10, color:'var(--text-muted)' }}>{p.role}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Waiting message for non-captains */}
        {!amBattingCaptain && !amBowlingCaptain && (
          <div style={{ textAlign:'center', color:'var(--text-muted)', marginTop:24 }}>Waiting for teams to set up...</div>
        )}

        {/* Start button — only for host */}
        {isHost && (
          <button className="btn btn-primary" style={{ width:'100%', marginTop:24, padding:'14px', fontSize:16 }} onClick={onStart}>
            🏏 Start Innings {inningsNum}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Full scorecard at result screen ───────────────────────────
function FullScorecard({ inn, label }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background:'var(--bg-elevated)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', marginBottom:12, overflow:'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 16px', cursor:'pointer' }}>
        <span style={{ fontSize:13, fontWeight:600 }}>{label}</span>
        <span style={{ color:'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding:'0 16px 12px' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr>
                {['Batsman','R','B','4s','6s','SR'].map(h => <th key={h} style={{ ...styles.sth, fontSize:10 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(inn.battingScorecard||[]).filter(b=>b.status!=='dnb').map(b => (
                <tr key={b.name} style={styles.str}>
                  <td style={{ ...styles.std, fontSize:12 }}>
                    {b.name}
                    {b.status === 'out' && <div style={{ fontSize:10, color:'var(--text-muted)' }}>{b.dismissal}</div>}
                    {b.status === 'notout' && <div style={{ fontSize:10, color:'var(--text-success)' }}>not out</div>}
                  </td>
                  <td style={{ ...styles.std, fontWeight:700 }}>{b.runs}</td>
                  <td style={styles.std}>{b.balls}</td>
                  <td style={styles.std}>{b.fours}</td>
                  <td style={styles.std}>{b.sixes}</td>
                  <td style={styles.std}>{b.balls>0 ? ((b.runs/b.balls)*100).toFixed(0) : '0'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12, marginTop:10 }}>
            <thead>
              <tr>
                {['Bowler','O','R','W','Eco'].map(h => <th key={h} style={{ ...styles.sth, fontSize:10 }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {(inn.bowlerFigures||[]).map(b => (
                <tr key={b.name} style={styles.str}>
                  <td style={{ ...styles.std, fontSize:12 }}>{b.name}</td>
                  <td style={styles.std}>{b.overs}.{b.balls}</td>
                  <td style={styles.std}>{b.runs}</td>
                  <td style={{ ...styles.std, fontWeight:700, color: b.wickets>0?'#f87171':'inherit' }}>{b.wickets}</td>
                  <td style={styles.std}>{b.balls>0?((b.runs/b.balls)*6).toFixed(2):'0.00'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Loading({ text }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-secondary)' }}>
      {text}
    </div>
  )
}

const styles = {
  page: { height:'100vh', display:'flex', flexDirection:'column', background:'var(--bg-primary)', overflow:'hidden' },
  header: { padding:'10px 20px', background:'var(--bg-secondary)', borderBottom:'1px solid var(--border)', flexShrink:0, textAlign:'center' },
  headerMatch: { fontSize:10, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 },
  headerTeams: { fontFamily:'var(--font-display)', fontSize:17, fontWeight:800, color:'var(--gold)' },
  tossInfo: { fontSize:11, color:'var(--text-muted)', marginTop:1 },
  scorecard: { padding:'12px 20px', background:'var(--bg-secondary)', borderBottom:'1px solid var(--border)', flexShrink:0 },
  bigScore: { fontFamily:'var(--font-display)', fontSize:48, fontWeight:800, color:'var(--gold)', lineHeight:1 },
  oversLabel: { fontSize:15, color:'var(--text-muted)' },
  batsmenRow: { display:'flex', gap:16, marginTop:10 },
  batsmanChip: { display:'flex', alignItems:'center', padding:'4px 10px', background:'var(--bg-elevated)', borderRadius:20, border:'1px solid var(--border)' },
  bowlerChip: { display:'flex', alignItems:'center', marginTop:6, padding:'3px 10px', background:'var(--bg-elevated)', borderRadius:20, border:'1px solid var(--border)', width:'fit-content' },
  overRow: { display:'flex', alignItems:'center', gap:8, padding:'8px 20px', background:'var(--bg-elevated)', borderBottom:'1px solid var(--border)', flexShrink:0 },
  overRowLabel: { fontSize:11, color:'var(--text-muted)', minWidth:60 },
  ballDot: { width:30, height:30, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11 },
  lastBallBox: { padding:'10px 20px', borderLeft:'4px solid', background:'var(--bg-elevated)', flexShrink:0, display:'flex', alignItems:'center', gap:10 },
  tabRow: { display:'flex', background:'var(--bg-secondary)', borderBottom:'1px solid var(--border)', flexShrink:0 },
  tabBtn: { flex:1, padding:'9px 0', background:'none', border:'none', fontSize:12, cursor:'pointer', fontFamily:'inherit', transition:'all .15s' },
  tabContent: { flex:1, overflowY:'auto', padding:'0 20px 10px' },
  commentaryLine: { display:'flex', alignItems:'center', gap:8, padding:'7px 4px', borderBottom:'1px solid var(--border)', fontSize:13, borderRadius:4 },
  scorecardTable: { width:'100%', borderCollapse:'collapse', fontSize:12, marginTop:8 },
  sth: { padding:'8px 8px', textAlign:'left', color:'var(--text-muted)', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid var(--border)', fontWeight:600 },
  str: { borderBottom:'1px solid var(--border)' },
  std: { padding:'8px 8px', verticalAlign:'middle' },
  fowlRow: { display:'flex', alignItems:'center', gap:12, padding:'10px 4px', borderBottom:'1px solid var(--border)' },
  controls: { flexShrink:0, background:'var(--bg-secondary)', borderTop:'1px solid var(--border)', padding:'10px 16px', display:'flex', flexDirection:'column', gap:8 },
  modeRow: { display:'flex', alignItems:'center', gap:6, overflowX:'auto', paddingBottom:4 },
  centeredSection: { flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24, gap:14 },
  inningsCard: { padding:'18px 24px', background:'var(--bg-elevated)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', textAlign:'center' },
  overPopup: { position:'fixed', top:80, left:'50%', transform:'translateX(-50%)', background:'var(--bg-elevated)', border:'1px solid var(--gold)', borderRadius:'var(--radius-lg)', padding:'14px 20px', textAlign:'center', zIndex:1000, boxShadow:'0 8px 32px rgba(0,0,0,0.4)', minWidth:200 },
  overPopupTitle: { fontSize:11, color:'var(--gold)', textTransform:'uppercase', letterSpacing:1, marginBottom:4 },
  overPopupScore: { fontSize:22, fontWeight:800, fontFamily:'var(--font-display)' },
  popupBall: { width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700 },
  modalOverlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:2000 },
  modalContent: { background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:20, minWidth:320, maxWidth:400, maxHeight:'80vh', overflow:'auto' },
  modalHeader: { fontSize:16, fontWeight:700, marginBottom:4, color:'var(--gold)' },
  modalSubheader: { fontSize:11, color:'var(--text-muted)', marginBottom:16 },
  modalItem: { padding:'10px 12px', borderRadius:'var(--radius)', marginBottom:6, display:'flex', alignItems:'center', gap:10, border:'1px solid var(--border)' },
  setupSectionLabel: { fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1, marginBottom:10 },
  setupPlayerRow: { background:'var(--bg-secondary)', borderRadius:'var(--radius)', border:'1px solid var(--border)', padding:'8px 12px', marginBottom:6 },
}