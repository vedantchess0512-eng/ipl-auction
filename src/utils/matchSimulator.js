// ═════════════════════════════════════════════════════════════════
// matchSimulator.js — Ball-by-ball IPL-style engine
// Tracks: per-batsman stats, per-bowler figures, fall of wickets,
//         batting modes, bowling selection, over summaries
// ═════════════════════════════════════════════════════════════════

function getRating(player) {
  if (!player) return 40
  const price = player.soldPrice || player.basePrice || 50
  return Math.min(100, Math.max(20, Math.round((price / 20) + 30)))
}

function getRole(player) {
  return (player?.role || 'BAT').toUpperCase()
}

// ── Batting mode multipliers ─────────────────────────────────────
// modes: 'normal' | 'defensive' | 'aggressive' | 'slog'
const MODE_MULTIPLIERS = {
  defensive:  { dot: 1.5, one: 1.3, two: 1.1, three: 0.8, four: 0.5, six: 0.3, wicket: 0.5 },
  normal:     { dot: 1.0, one: 1.0, two: 1.0, three: 1.0, four: 1.0, six: 1.0, wicket: 1.0 },
  aggressive: { dot: 0.7, one: 0.9, two: 1.0, three: 1.1, four: 1.5, six: 1.8, wicket: 1.4 },
  slog:       { dot: 0.5, one: 0.7, two: 0.8, three: 0.9, four: 1.8, six: 3.0, wicket: 2.0 },
}

const BASE = { dot:28, one:30, two:10, three:2, four:14, six:7, wicket:7, wide:1, noball:1 }

const TOTAL_BALLS = 120

// ── Varied commentary pools ──────────────────────────────────────
const COMMENTARY = {
  dot: [
    (b, bw) => `Dot. ${bw} bowls a tight line, ${b} defends solidly.`,
    (b, bw) => `Good delivery from ${bw}. ${b} cannot find the gap.`,
    (b, bw) => `${bw} beats ${b} outside off. No run.`,
    (b, bw) => `${b} plays it straight to the fielder. Dot ball.`,
    (b, bw) => `Tight line from ${bw}, ${b} has to respect it.`,
    (b, bw) => `${b} misses the drive — outside edge, safe. Dot.`,
  ],
  one: [
    (b, bw) => `${b} tucks it off the pads for a single.`,
    (b, bw) => `${b} pushes to mid-off and scurries across for one.`,
    (b, bw) => `Clipped off the hips, ${b} takes the single.`,
    (b, bw) => `${b} nudges it fine and turns for a quick single.`,
    (b, bw) => `Worked into the on side. ${b} rotates the strike.`,
  ],
  two: [
    (b, bw) => `${b} drives through the gap — two runs!`,
    (b, bw) => `Good running between the wickets. ${b} takes two.`,
    (b, bw) => `${b} flicks it square, they're coming back for two!`,
    (b, bw) => `Into the gap at mid-wicket, excellent running — two!`,
  ],
  three: [
    (b, bw) => `${b} hits it hard and they're running three!`,
    (b, bw) => `Three! Superb placement by ${b}, brilliant running!`,
    (b, bw) => `Driven hard down the ground — three runs, great effort!`,
  ],
  four: [
    (b, bw) => `FOUR! ${b} drives beautifully through the covers!`,
    (b, bw) => `FOUR! ${b} pulls it powerfully to the midwicket boundary!`,
    (b, bw) => `FOUR! Cracking cut shot by ${b}! Goes to the fence!`,
    (b, bw) => `FOUR! ${b} flicks ${bw} off the pads, races to the rope!`,
    (b, bw) => `FOUR! Glorious straight drive by ${b}!`,
    (b, bw) => `FOUR! ${b} slaps it through point — poor ${bw}!`,
    (b, bw) => `FOUR! Back-foot punch by ${b}, scorching through covers!`,
    (b, bw) => `FOUR! Edged but flying to the third man boundary!`,
  ],
  six: [
    (b, bw) => `SIX! ${b} launches it over long-on, into the crowd!`,
    (b, bw) => `SIX! Massive hit by ${b}! That's gone miles!`,
    (b, bw) => `SIX! ${b} sweeps it over deep fine-leg! Extraordinary!`,
    (b, bw) => `SIX! Muscle power from ${b}! Cleared the rope with ease!`,
    (b, bw) => `SIX! ${b} advances down the track and lofts it over mid-on!`,
    (b, bw) => `SIX! Inside-out drive by ${b}! Picks it perfectly!`,
    (b, bw) => `SIX! ${b} ramps it over fine-leg — unconventional but effective!`,
  ],
  wicket: [
    (b, bw) => `OUT! ${b} is caught at mid-off, ${bw} strikes!`,
    (b, bw) => `OUT! Bowled! ${bw} hits the top of off stump! ${b} walks back!`,
    (b, bw) => `OUT! LBW! ${b} trapped in front by ${bw}! Big appeal, given!`,
    (b, bw) => `OUT! ${b} holes out at long-on trying to go big!`,
    (b, bw) => `OUT! ${b} plays on! The ball clips the stumps! ${bw} is pumped!`,
    (b, bw) => `OUT! Caught behind! ${b} gets a faint edge to the keeper!`,
    (b, bw) => `OUT! ${b} miscues the pull — taken at mid-on. ${bw} gets one!`,
    (b, bw) => `OUT! Stumped! ${b} advances but misses, keeper does the rest!`,
  ],
  wide: [
    (b, bw) => `Wide! ${bw} strays down the leg side. Extra run.`,
    (b, bw) => `Wide down the off side from ${bw}. Poor delivery.`,
    (b, bw) => `Wide! ${bw} loses the line completely.`,
  ],
  noball: [
    (b, bw) => `No ball! ${bw} oversteps. FREE HIT coming up!`,
    (b, bw) => `No ball! Front foot lands well past the crease. Free hit!`,
  ],
}

function getCommentary(outcome, batsman, bowler) {
  const pool = COMMENTARY[outcome]
  if (!pool) return ''
  const fn = pool[Math.floor(Math.random() * pool.length)]
  return fn(batsman?.name || 'Batsman', bowler?.name || 'Bowler')
}

// ── Bowling rotation ─────────────────────────────────────────────
function getNextBowler(bowlingXI, bowlerStats, completedOverNum, bowlerOrder) {
  const MAX_OVERS = 4

  // If bowlerOrder has a bowler for this over
  if (bowlerOrder && bowlerOrder[completedOverNum]) {
    const forced = bowlingXI.find(p => p.name === bowlerOrder[completedOverNum])
    if (forced && (bowlerStats[forced.name]?.overs || 0) < MAX_OVERS) return forced
  }

  // Prefer BOWL/AR roles
  const preferred = bowlingXI.filter(p => ['BOWL','AR'].includes(getRole(p)))
  const fallback = bowlingXI
  const pool = preferred.length >= 2 ? preferred : fallback

  // Filter out anyone who has bowled max overs
  const eligible = pool.filter(p => (bowlerStats[p.name]?.overs || 0) < MAX_OVERS)
  if (eligible.length === 0) {
    // Everyone hit the limit — pick whoever has fewest overs
    return pool.sort((a,b) => (bowlerStats[a.name]?.overs||0) - (bowlerStats[b.name]?.overs||0))[0]
  }

  // Don't repeat the previous over's bowler
  const prev = bowlerStats._lastBowler
  const notPrev = eligible.filter(p => p.name !== prev)
  const candidates = notPrev.length > 0 ? notPrev : eligible

  // Pick highest rated among candidates
  return candidates.sort((a,b) => getRating(b) - getRating(a))[0]
}

// ── Single ball simulation ───────────────────────────────────────
function simulateBallWithMode(batsman, bowler, phase, chaseCtx, isImpact, modeMulti) {
  const bRating = getRating(batsman) * (isImpact ? 1.15 : 1)
  const bowlRating = getRating(bowler)
  const role = getRole(batsman)
  const w = { ...BASE }

  if (phase === 'powerplay') { w.four += 4; w.six += 2; w.dot -= 4 }
  else if (phase === 'death') { w.four += 6; w.six += 5; w.dot -= 6; w.wicket += 3 }

  if (role === 'WK' || role === 'BAT') { w.one += 5; w.two += 3; w.four += 2 }
  else if (role === 'AR') { w.four += 3; w.six += 3 }
  else if (role === 'BOWL') { w.dot += 5; w.wicket += 4; w.one -= 3; w.four -= 4; w.six -= 4 }

  const bF = (bRating - 50) / 100
  w.dot    = Math.max(5, w.dot    - bF * 10)
  w.four   = Math.max(2, w.four   + bF * 6)
  w.six    = Math.max(1, w.six    + bF * 4)
  w.wicket = Math.max(2, w.wicket - bF * 4)

  const bowlF = (bowlRating - 50) / 100
  w.dot    = Math.max(5, w.dot    + bowlF * 8)
  w.wicket = Math.max(2, w.wicket + bowlF * 5)
  w.four   = Math.max(2, w.four   - bowlF * 4)
  w.six    = Math.max(1, w.six    - bowlF * 3)

  if (chaseCtx) {
    const rrr = chaseCtx.ballsLeft > 0 ? (chaseCtx.required / chaseCtx.ballsLeft) * 6 : 99
    if (rrr > 12)     { w.six += 8; w.four += 6; w.wicket += 4; w.dot -= 6 }
    else if (rrr > 9) { w.six += 4; w.four += 3; w.wicket += 2 }
    else if (rrr < 6) { w.dot += 4; w.one += 4; w.six -= 3; w.wicket -= 2 }
  }

  // Apply batting mode multipliers
  Object.keys(modeMulti).forEach(k => {
    if (w[k] !== undefined) w[k] = Math.max(0.3, w[k] * modeMulti[k])
  })

  Object.keys(w).forEach(k => { w[k] = Math.max(0.3, w[k]) })
  return weightedRandom(w)
}

function weightedRandom(weights) {
  let total = Object.values(weights).reduce((s, v) => s + v, 0)
  let r = Math.random() * total
  for (const [key, val] of Object.entries(weights)) {
    r -= val
    if (r <= 0) return key
  }
  return 'dot'
}

const OUTCOME_RUNS = { dot:0, one:1, two:2, three:3, four:4, six:6, wicket:0, wide:1, noball:1 }

// ── Initialize innings state (called once on "Start Innings") ─────
export function initInningsState(battingXI, bowlingXI, target, impactPlayer, hostDecisions = {}) {
  // Build batting order: use battingOrder from hostDecisions if provided, else XI order
  const battingOrder = hostDecisions.battingOrder || []
  const orderedBatters = battingOrder.length >= 11
    ? battingOrder.map(name => battingXI.find(p => p.name === name)).filter(Boolean)
    : [...battingXI]

  const batters = orderedBatters
  let batterOrderIdx = 2
  let striker = batters[0]
  let nonStriker = batters[1] || batters[0]

  // Per-batsman stats
  const batsmanStats = {}
  batters.forEach(p => {
    batsmanStats[p.name] = {
      name: p.name, role: p.role, nat: p.nationality,
      runs: 0, balls: 0, fours: 0, sixes: 0,
      status: 'dnb',
      dismissal: '',
      order: 0,
    }
  })

  // Per-bowler stats
  const bowlerStats = { _lastBowler: null }
  bowlingXI.forEach(p => {
    bowlerStats[p.name] = {
      name: p.name, role: p.role,
      overs: 0, balls: 0, runs: 0, wickets: 0, wides: 0, noballs: 0,
      maidens: 0,
    }
  })

  // Mark first two as batting
  let batsmanOrder = 1
  if (batsmanStats[striker.name]) { batsmanStats[striker.name].status = 'batting'; batsmanStats[striker.name].order = batsmanOrder++ }
  if (batsmanStats[nonStriker?.name]) { batsmanStats[nonStriker.name].status = 'batting'; batsmanStats[nonStriker.name].order = batsmanOrder++ }

  // Bowling setup
  const bowlerOrderList = hostDecisions.bowlerOrder || []
  let currentOverNum = 0
  let overBalls = 0
  let currentBowler = getNextBowler(bowlingXI, bowlerStats, 0, bowlerOrderList)
  if (currentBowler) bowlerStats._lastBowler = currentBowler.name

  return {
    // Configuration
    batters,
    bowlingXI,
    target: target || null,
    impactPlayer: impactPlayer || null,
    bowlerOrder: bowlerOrderList,

    // Current state
    runs: 0,
    wickets: 0,
    balls: 0,
    batterOrderIdx,
    striker,
    nonStriker,
    batsmanOrder,
    currentOverNum,
    overBalls,
    currentBowler,
    impactUsed: false,
    impactSubbedIn: null,

    // Over tracking
    overRunsThisOver: 0,
    overWicketsThisOver: 0,
    overBallsThisOver: [],

    // Stats
    batsmanStats,
    bowlerStats,

    // Logs
    ballLog: [],
    fallOfWickets: [],
    overSummaries: [],

    // Completion
    completed: false,
    finalResult: null,
  }
}

// ── Simulate next ball (called on each "Next Ball" click) ────────
// Takes current state + CURRENT battingModes, returns { newState, ballResult }
export function simulateNextBall(state, currentBattingModes = {}) {
  if (state.completed) return { newState: state, ballResult: null }

  // Clone state for immutability (shallow clone of top-level, deep clone of objects)
  const s = {
    ...state,
    batsmanStats: { ...state.batsmanStats },
    bowlerStats: { ...state.bowlerStats },
    ballLog: [...state.ballLog],
    fallOfWickets: [...state.fallOfWickets],
    overSummaries: [...state.overSummaries],
    overBallsThisOver: [...state.overBallsThisOver],
  }

  const overNum = Math.floor(s.balls / 6)
  const phase = overNum < 6 ? 'powerplay' : overNum < 15 ? 'middle' : 'death'
  const chaseCtx = s.target
    ? { required: s.target - s.runs, ballsLeft: TOTAL_BALLS - s.balls }
    : null

  // Get batting mode for current striker from CURRENT modes (not pre-saved)
  const mode = currentBattingModes[s.striker?.name] || 'normal'
  const modeMulti = MODE_MULTIPLIERS[mode] || MODE_MULTIPLIERS.normal

  // Impact player check
  const isImpactStriker = s.impactPlayer && s.striker?.name === s.impactPlayer?.name && !s.impactUsed

  const outcome = simulateBallWithMode(s.striker, s.currentBowler, phase, chaseCtx, isImpactStriker, modeMulti)
  const runsThisBall = OUTCOME_RUNS[outcome] || 0
  const isWicket = outcome === 'wicket'
  const isExtra = outcome === 'wide' || outcome === 'noball'

  s.runs += runsThisBall
  s.overRunsThisOver += runsThisBall

  // Update bowler stats (clone the specific bowler's stats)
  if (s.currentBowler && s.bowlerStats[s.currentBowler.name]) {
    s.bowlerStats[s.currentBowler.name] = { ...s.bowlerStats[s.currentBowler.name] }
    const bs = s.bowlerStats[s.currentBowler.name]
    bs.runs += runsThisBall
    if (!isExtra) bs.balls++
    if (isWicket) bs.wickets++
    if (outcome === 'wide') bs.wides++
    if (outcome === 'noball') bs.noballs++
  }

  // Update batsman stats (clone the specific batsman's stats)
  if (!isExtra && s.striker && s.batsmanStats[s.striker.name]) {
    s.batsmanStats[s.striker.name] = { ...s.batsmanStats[s.striker.name] }
    const bs = s.batsmanStats[s.striker.name]
    bs.balls++
    if (!isWicket) {
      bs.runs += runsThisBall
      if (outcome === 'four') bs.fours++
      if (outcome === 'six') bs.sixes++
    }
  }

  if (!isExtra) {
    s.balls++
    s.overBalls++
  }

  const commentary = getCommentary(outcome, s.striker, s.currentBowler)

  // Swap on 1 or 3
  if (!isWicket && !isExtra && (runsThisBall === 1 || runsThisBall === 3)) {
    const temp = s.striker
    s.striker = s.nonStriker
    s.nonStriker = temp
  }

  if (isWicket) {
    s.overWicketsThisOver++
    // Mark batsman out
    if (s.striker && s.batsmanStats[s.striker.name]) {
      s.batsmanStats[s.striker.name] = { ...s.batsmanStats[s.striker.name] }
      const bs = s.batsmanStats[s.striker.name]
      bs.status = 'out'
      bs.balls++  // count the wicket ball
      const dismissedBy = s.currentBowler?.name || 'unknown'
      bs.dismissal = `b ${dismissedBy}`
    }
    // Fall of wicket
    s.wickets++
    s.fallOfWickets.push({
      wicket: s.wickets,
      runs: s.runs,
      over: `${Math.floor(s.balls/6)}.${s.balls%6}`,
      batsman: s.striker?.name || '',
    })

    // Bring next batter
    if (s.batterOrderIdx < s.batters.length) {
      const newBatter = s.batters[s.batterOrderIdx++]
      s.striker = newBatter
      if (s.batsmanStats[s.striker.name]) {
        s.batsmanStats[s.striker.name] = { ...s.batsmanStats[s.striker.name] }
        s.batsmanStats[s.striker.name].status = 'batting'
        s.batsmanStats[s.striker.name].order = s.batsmanOrder++
      }
    } else {
      s.completed = true
      s.finalResult = buildFinalResult(s)
      return { newState: s, ballResult: null }
    }
  }

  const ballEntry = {
    ballNum: s.balls,
    over: Math.floor((s.balls - 1) / 6) + 1,
    ballInOver: ((s.balls - 1) % 6) + 1,
    outcome,
    label: OUTCOME_LABEL[outcome],
    runs: runsThisBall,
    totalRuns: s.runs,
    totalWickets: s.wickets,
    isWicket,
    isExtra,
    text: commentary,
    batsman: isWicket ? (s.striker?.name || '') : s.striker?.name,
    bowler: s.currentBowler?.name,
    strikerName: s.striker?.name,
    nonStrikerName: s.nonStriker?.name,
    phase,
    mode,
  }
  s.ballLog.push(ballEntry)
  s.overBallsThisOver.push(ballEntry)

  // Over complete
  if (!isExtra && s.overBalls === 6) {
    // Maiden check
    if (s.overRunsThisOver === 0 && s.currentBowler && s.bowlerStats[s.currentBowler.name]) {
      s.bowlerStats[s.currentBowler.name] = { ...s.bowlerStats[s.currentBowler.name] }
      s.bowlerStats[s.currentBowler.name].maidens++
    }
    if (s.currentBowler && s.bowlerStats[s.currentBowler.name]) {
      s.bowlerStats[s.currentBowler.name] = { ...s.bowlerStats[s.currentBowler.name] }
      s.bowlerStats[s.currentBowler.name].overs++
      s.bowlerStats[s.currentBowler.name].balls = 0
      s.bowlerStats._lastBowler = s.currentBowler.name
    }

    s.overSummaries.push({
      over: s.currentOverNum + 1,
      runs: s.overRunsThisOver,
      wickets: s.overWicketsThisOver,
      balls: [...s.overBallsThisOver],
      bowler: s.currentBowler?.name,
    })

    s.currentOverNum++
    s.overRunsThisOver = 0
    s.overWicketsThisOver = 0
    s.overBallsThisOver = []
    s.overBalls = 0
    // Swap ends
    const temp = s.striker
    s.striker = s.nonStriker
    s.nonStriker = temp
    // Next bowler
    s.currentBowler = getNextBowler(s.bowlingXI, s.bowlerStats, s.currentOverNum, s.bowlerOrder)
  }


  // Check if innings is complete after this ball
  if (s.balls >= TOTAL_BALLS || s.wickets >= 10) {
    s.completed = true
    s.finalResult = buildFinalResult(s)
  } else if (s.target && s.runs >= s.target) {
    s.completed = true
    s.finalResult = buildFinalResult(s)
  }

  return { newState: s, ballResult: ballEntry }
}

// ── Build final result from state ────────────────────────────────
function buildFinalResult(s) {
  // Mark remaining batsmen
  if (s.striker && s.batsmanStats[s.striker.name] && s.batsmanStats[s.striker.name].status === 'batting') {
    s.batsmanStats[s.striker.name] = { ...s.batsmanStats[s.striker.name] }
    s.batsmanStats[s.striker.name].status = 'notout'
  }
  if (s.nonStriker && s.batsmanStats[s.nonStriker.name] && s.batsmanStats[s.nonStriker.name].status === 'batting') {
    s.batsmanStats[s.nonStriker.name] = { ...s.batsmanStats[s.nonStriker.name] }
    s.batsmanStats[s.nonStriker.name].status = 'notout'
  }

  const totalOvers = Math.floor(s.balls / 6)
  const remBalls = s.balls % 6
  const oversStr = `${totalOvers}.${remBalls}`

  // Build final bowler figures
  const bowlerFigures = s.bowlingXI
    .map(p => s.bowlerStats[p.name])
    .filter(Boolean)
    .filter(b => b.overs > 0 || b.balls > 0 || b.runs > 0)

  // Sort batting scorecard by order
  const battingScorecard = s.batters
    .map(p => s.batsmanStats[p.name])
    .filter(Boolean)
    .filter(b => b.status !== 'dnb' || b.order > 0)

  // Add DNB at end
  const dnb = s.batters
    .map(p => s.batsmanStats[p.name])
    .filter(b => b && b.status === 'dnb')

  return {
    runs: s.runs,
    wickets: s.wickets,
    balls: s.balls,
    overs: oversStr,
    oversNum: s.balls / 6,
    allOut: s.wickets >= 10,
    ballLog: s.ballLog,
    battingScorecard: [...battingScorecard, ...dnb],
    bowlerFigures,
    fallOfWickets: s.fallOfWickets,
    overSummaries: s.overSummaries,
    strikerAtEnd: s.striker?.name,
    nonStrikerAtEnd: s.nonStriker?.name,
  }
}

// ── Backward-compatible simulateInnings (for skip-to-end) ────────
export function simulateInnings(battingXI, bowlingXI, target, impactPlayer, hostDecisions = {}) {
  let state = initInningsState(battingXI, bowlingXI, target, impactPlayer, hostDecisions)
  const battingModes = hostDecisions.battingModes || {}

  while (!state.completed) {
    const { newState } = simulateNextBall(state, battingModes)
    state = newState
  }

  return state.finalResult || buildFinalResult(state)
}

const OUTCOME_LABEL = { dot:'0', one:'1', two:'2', three:'3', four:'4', six:'6', wicket:'W', wide:'Wd', noball:'Nb' }

// Export for use in MatchEngine display
export { OUTCOME_RUNS, OUTCOME_LABEL }
