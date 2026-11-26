// Pure fixture generator — no Firebase dependency
// Returns { format, matches, playoffSlots, playoffMatches }

export function generateFixtures(teams) {
  const n = teams.length
  if (n < 2) return null
  if (n === 2) return generateBestOf3(teams)
  if (n <= 4) return generateRoundRobin(teams, 1, 'top2')
  if (n <= 6) return generateRoundRobin(teams, 1, 'top4')
  return generateRoundRobin(teams, 2, 'top4')
}

function generateBestOf3(teams) {
  return {
    format: 'bestof3',
    matches: [
      makeMatch('bo3-1', teams[0], teams[1], 'league', 'Game 1'),
      makeMatch('bo3-2', teams[0], teams[1], 'league', 'Game 2'),
      makeMatch('bo3-3', teams[0], teams[1], 'league', 'Game 3 (if needed)'),
    ],
    playoffSlots: 0,
    playoffMatches: [],
  }
}

function generateRoundRobin(teams, rounds, playoffType) {
  const matches = []
  let idx = 0
  for (let r = 0; r < rounds; r++) {
    const leg = rounds > 1 ? (r === 0 ? 'First Leg' : 'Second Leg') : 'League'
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        idx++
        matches.push(makeMatch(`league-${r}-${i}-${j}`, teams[i], teams[j], 'league', `Match ${idx} (${leg})`))
      }
    }
  }
  const playoffSlots = playoffType === 'top2' ? 2 : 4
  const playoffMatches = playoffType === 'top2'
    ? [makePlayoffMatch('final', 'Final', '#1 Seed', '#2 Seed')]
    : [
        makePlayoffMatch('q1', 'Qualifier 1', '#1 Seed', '#2 Seed'),
        makePlayoffMatch('eliminator', 'Eliminator', '#3 Seed', '#4 Seed'),
        makePlayoffMatch('q2', 'Qualifier 2', 'Loser Q1', 'Winner Eliminator'),
        makePlayoffMatch('final', 'Final', 'Winner Q1', 'Winner Q2'),
      ]
  return { format: playoffType === 'top2' ? 'roundrobin_top2' : 'roundrobin_top4', matches, playoffSlots, playoffMatches }
}

function makeMatch(id, teamA, teamB, stage, label) {
  return {
    id,
    teamA: teamA.id, teamAName: teamA.name || teamA.id, teamAShort: teamA.shortName || teamA.id, teamAColor: teamA.color || '#888',
    teamB: teamB.id, teamBName: teamB.name || teamB.id, teamBShort: teamB.shortName || teamB.id, teamBColor: teamB.color || '#888',
    stage, label, status: 'scheduled',
    scoreA: null, wicketsA: null, oversA: null,
    scoreB: null, wicketsB: null, oversB: null,
    winner: null, xiA: [], xiB: [], impactA: null, impactB: null, tossWinner: null, tossDec: null,
  }
}

function makePlayoffMatch(id, label, slotA, slotB) {
  return {
    id, teamA: null, teamAName: slotA, teamAShort: slotA, teamAColor: '#888',
    teamB: null, teamBName: slotB, teamBShort: slotB, teamBColor: '#888',
    stage: 'playoff', label, status: 'pending',
    scoreA: null, wicketsA: null, oversA: null,
    scoreB: null, wicketsB: null, oversB: null,
    winner: null, xiA: [], xiB: [], impactA: null, impactB: null, tossWinner: null, tossDec: null,
  }
}