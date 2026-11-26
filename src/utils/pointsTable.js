// Points table utilities — pure functions, no Firebase

export function initPointsTable(teams) {
  const table = {}
  teams.forEach(team => {
    table[team.id] = {
      id: team.id,
      name: team.name || team.id,
      shortName: team.shortName || team.id,
      color: team.color || '#888',
      p: 0, w: 0, l: 0, t: 0, pts: 0,
      runsFor: 0, oversFor: 0,
      runsAgainst: 0, oversAgainst: 0,
      nrr: 0,
    }
  })
  return table
}

export function updatePointsTable(table, match) {
  if (!match.winner || match.status !== 'completed') return table
  const updated = JSON.parse(JSON.stringify(table)) // deep clone
  const a = updated[match.teamA]
  const b = updated[match.teamB]
  if (!a || !b) return table

  a.p += 1; b.p += 1

  // ICC NRR rule: if all-out use full 20 overs as denominator
  const oversA = parseFloat(match.oversA) || 20
  const oversB = parseFloat(match.oversB) || 20
  const allOutA = (match.wicketsA || 0) >= 10
  const allOutB = (match.wicketsB || 0) >= 10
  const denomA = allOutA ? 20 : oversA
  const denomB = allOutB ? 20 : oversB

  a.runsFor += match.scoreA || 0
  a.oversFor += denomA
  a.runsAgainst += match.scoreB || 0
  a.oversAgainst += denomB

  b.runsFor += match.scoreB || 0
  b.oversFor += denomB
  b.runsAgainst += match.scoreA || 0
  b.oversAgainst += denomA

  if (match.winner === match.teamA) {
    a.w += 1; a.pts += 2; b.l += 1
  } else if (match.winner === match.teamB) {
    b.w += 1; b.pts += 2; a.l += 1
  } else {
    a.t += 1; a.pts += 1; b.t += 1; b.pts += 1
  }

  a.nrr = calcNRR(a.runsFor, a.oversFor, a.runsAgainst, a.oversAgainst)
  b.nrr = calcNRR(b.runsFor, b.oversFor, b.runsAgainst, b.oversAgainst)

  return updated
}

function calcNRR(runsFor, oversFor, runsAgainst, oversAgainst) {
  if (!oversFor || !oversAgainst) return 0
  return (runsFor / oversFor) - (runsAgainst / oversAgainst)
}

export function sortPointsTable(table) {
  return Object.values(table).sort((a, b) => {
    if (b.pts !== a.pts) return b.pts - a.pts
    if (Math.abs(b.nrr - a.nrr) > 0.0001) return b.nrr - a.nrr
    if (b.w !== a.w) return b.w - a.w
    return (a.name || '').localeCompare(b.name || '')
  })
}