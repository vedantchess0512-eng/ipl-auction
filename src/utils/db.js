import { buildMegaAuctionPlayers } from '../data/megaAuctionPlayers.js'
import { buildLegendsPlayers } from '../data/legendsPlayers.js'
import { buildIPL2026Players } from '../data/ipl2026Players.js'
import { ref, set, get, update, push, onValue, off, serverTimestamp, remove } from 'firebase/database'
import { db } from '../firebase.js'
import { generateFixtures } from './fixtureGenerator.js'
import { initPointsTable, updatePointsTable, sortPointsTable } from './pointsTable.js'

export function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function createRoom(hostConfig) {
  const roomId = generateRoomCode()
  const bidTimer = hostConfig.bidTimer || 15
  const roomData = {
    id: roomId,
    hostId: hostConfig.hostId,
    hostName: hostConfig.hostName,
    host: hostConfig.hostName,
    format: hostConfig.format,
    minSquadSize: hostConfig.minSquadSize,
    maxSquadSize: hostConfig.maxSquadSize,
    maxOverseas: hostConfig.maxOverseas,
    bidTimer,
    bidIncrement: hostConfig.bidIncrement,
    status: 'lobby',
    currentPlayerIndex: 0,
    currentBid: 0,
    currentHighestBidder: null,
    timerEndsAt: null,
    pausedTimeLeft: null,
    paused: false,
    players: hostConfig.players,
    teams: hostConfig.teams,
    createdAt: serverTimestamp(),
    auctionLog: [],
    playedNames: []
  }
  await set(ref(db, `rooms/${roomId}`), roomData)
  return roomId
}

export async function joinRoom(roomId, playerName, teamId) {
  const teamRef = ref(db, `rooms/${roomId}/teams/${teamId}`)
  const snap = await get(teamRef)
  if (!snap.exists()) throw new Error('Team not found')
  const team = snap.val()
  if (team.ownerId && team.ownerId !== playerName) throw new Error('Team already taken')
  await update(teamRef, { ownerId: playerName, ownerName: playerName })
  return true
}

export async function releaseTeam(roomId, teamId, playerName) {
  const teamRef = ref(db, `rooms/${roomId}/teams/${teamId}`)
  const snap = await get(teamRef)
  if (!snap.exists()) return
  const team = snap.val()
  if (team.ownerId !== playerName) return
  await update(teamRef, { ownerId: null, ownerName: null })
}

export async function getRoom(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`))
  if (!snap.exists()) return null
  return snap.val()
}

export function subscribeRoom(roomId, callback) {
  const roomRef = ref(db, `rooms/${roomId}`)
  onValue(roomRef, (snap) => callback(snap.val()))
  return () => off(roomRef)
}

export async function placeBid(roomId, teamId, teamName, amount) {
  const snap = await get(ref(db, `rooms/${roomId}/bidTimer`))
  const bidTimer = snap.val() || 15
  await update(ref(db, `rooms/${roomId}`), {
    currentBid: amount,
    currentHighestBidder: { teamId, teamName },
    timerEndsAt: Date.now() + (bidTimer * 1000),
    pausedTimeLeft: null,
  })
}

export async function updateRoomSettings(roomId, settings) {
  await update(ref(db, `rooms/${roomId}`), settings)
}

// ─── KICK PLAYER (host only) ──────────────────────────────────────
export async function kickPlayer(roomId, teamId) {
  await update(ref(db, `rooms/${roomId}/teams/${teamId}`), {
    ownerId: null,
    ownerName: null,
    kicked: true,
  })
  // Remove from kicked list after 5s so they can rejoin if re-invited
  setTimeout(async () => {
    const snap = await get(ref(db, `rooms/${roomId}/teams/${teamId}`))
    if (snap.exists() && !snap.val().ownerId) {
      await update(ref(db, `rooms/${roomId}/teams/${teamId}`), { kicked: false })
    }
  }, 5000)
}

// ─── SPECTATOR JOIN ───────────────────────────────────────────────
export async function joinAsSpectator(roomId, playerName) {
  const specRef = ref(db, `rooms/${roomId}/spectators/${playerName}`)
  await set(specRef, { name: playerName, joinedAt: Date.now() })
}

export async function leaveSpectator(roomId, playerName) {
  const specRef = ref(db, `rooms/${roomId}/spectators/${playerName}`)
  await remove(specRef)
}

// ─── RECONNECT ────────────────────────────────────────────────────
export async function reconnectPlayer(roomId, playerName) {
  // Find if this player has a team
  const snap = await get(ref(db, `rooms/${roomId}/teams`))
  if (!snap.exists()) return null
  const teams = snap.val()
  const myTeam = Object.values(teams).find(t => t.ownerId === playerName)
  return myTeam || null
}

function pickNextPlayer(players, currentSet, playedNamesSet) {
  const sameSetRemaining = players.filter(
    p => p.set === currentSet && !playedNamesSet.has(p.name)
  )
  if (sameSetRemaining.length > 0) {
    return sameSetRemaining[Math.floor(Math.random() * sameSetRemaining.length)]
  }
  const setOrder = []
  const seen = new Set()
  for (const p of players) {
    if (!seen.has(p.set)) { seen.add(p.set); setOrder.push(p.set) }
  }
  const currentSetIdx = setOrder.indexOf(currentSet)
  for (let i = currentSetIdx + 1; i < setOrder.length; i++) {
    const nextSet = setOrder[i]
    const nextSetRemaining = players.filter(
      p => p.set === nextSet && !playedNamesSet.has(p.name)
    )
    if (nextSetRemaining.length > 0) {
      return nextSetRemaining[Math.floor(Math.random() * nextSetRemaining.length)]
    }
  }
  return null
}

function findIndexByName(players, name) {
  return players.findIndex(p => p.name === name)
}

export async function nextPlayer(roomId, soldTo, soldPrice, playerData) {
  const roomSnap = await get(ref(db, `rooms/${roomId}`))
  const room = roomSnap.val()
  const players = room.players || []
  const bidTimer = room.bidTimer || 15
  const currentIndex = room.currentPlayerIndex || 0
  const currentPlayer = players[currentIndex]

  const playedNamesSet = new Set(room.playedNames || [])
  if (currentPlayer) playedNamesSet.add(currentPlayer.name)

  const updates = {}

  if (soldTo && soldPrice > 0) {
    const soldPlayer = { ...playerData, soldPrice, soldTo: soldTo.teamName }
    const squadRef = `rooms/${roomId}/teams/${soldTo.teamId}/squad`
    const teamSnap = await get(ref(db, squadRef))
    const existingSquad = teamSnap.exists() ? teamSnap.val() : []
    updates[squadRef] = [...existingSquad, soldPlayer]
    const purseSnap = await get(ref(db, `rooms/${roomId}/teams/${soldTo.teamId}/purse`))
    const currentPurse = purseSnap.val() || 0
    updates[`rooms/${roomId}/teams/${soldTo.teamId}/purse`] = currentPurse - soldPrice
    updates[`rooms/${roomId}/auctionLog/${Date.now()}`] = {
      playerName: playerData.name,
      soldTo: soldTo.teamName,
      teamId: soldTo.teamId,
      soldPrice,
      basePrice: playerData.basePrice || 0,
      role: playerData.role || '',
      nationality: playerData.nationality || '',
      time: Date.now()
    }
  } else if (playerData) {
    updates[`rooms/${roomId}/auctionLog/${Date.now()}_unsold`] = {
      playerName: playerData.name,
      soldTo: null,
      soldPrice: 0,
      basePrice: playerData.basePrice || 0,
      role: playerData.role || '',
      time: Date.now()
    }
  }

  updates[`rooms/${roomId}/playedNames`] = Array.from(playedNamesSet)

  const currentSet = currentPlayer?.set
  const nextPlayerObj = pickNextPlayer(players, currentSet, playedNamesSet)

  if (!nextPlayerObj || playedNamesSet.size >= players.length) {
    updates[`rooms/${roomId}/status`] = 'completed'
    updates[`rooms/${roomId}/timerEndsAt`] = null
    updates[`rooms/${roomId}/pausedTimeLeft`] = null
  } else {
    const nextIndex = findIndexByName(players, nextPlayerObj.name)
    updates[`rooms/${roomId}/currentPlayerIndex`] = nextIndex
    updates[`rooms/${roomId}/currentBid`] = 0
    updates[`rooms/${roomId}/currentHighestBidder`] = null
    updates[`rooms/${roomId}/paused`] = false
    updates[`rooms/${roomId}/pausedTimeLeft`] = null
    updates[`rooms/${roomId}/timerEndsAt`] = Date.now() + (bidTimer * 1000)
  }

  await update(ref(db), updates)
}

export async function startAuction(roomId) {
  const roomRef = ref(db, `rooms/${roomId}`)
  const snapshot = await get(roomRef)
  const room = snapshot.val()
  if (!room) return

  await update(roomRef, {
    status: 'auction',
    currentPlayerIndex: 0,
    currentHighestBidder: null,
    currentBid: 0,
    timerEndsAt: null,
    lastBidTime: null,
    paused: false,
    pausedTimeLeft: null,
    auctionLog: null,
  })
}

export async function setPaused(roomId, paused) {
  const snap = await get(ref(db, `rooms/${roomId}`))
  const room = snap.val()
  if (paused) {
    const timeLeft = room.timerEndsAt
      ? Math.max(0, Math.ceil((room.timerEndsAt - Date.now()) / 1000))
      : 0
    await update(ref(db, `rooms/${roomId}`), {
      paused: true,
      pausedTimeLeft: timeLeft,
      timerEndsAt: null,
    })
  } else {
    const remaining = room.pausedTimeLeft || (room.bidTimer || 15)
    await update(ref(db, `rooms/${roomId}`), {
      paused: false,
      pausedTimeLeft: null,
      timerEndsAt: Date.now() + (remaining * 1000),
    })
  }
}

export async function restartAuction(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`))
  const room = snap.val()
  const bidTimer = room.bidTimer || 15

  let freshPlayers
  if (room.format === 'MEGA') freshPlayers = buildMegaAuctionPlayers()
  else if (room.format === 'LEGENDS') freshPlayers = buildLegendsPlayers()
  else freshPlayers = buildIPL2026Players()

  let startIndex = 0
  if (freshPlayers.length > 0) {
    const firstSet = freshPlayers[0].set
    const firstSetPlayers = freshPlayers.filter(p => p.set === firstSet)
    const picked = firstSetPlayers[Math.floor(Math.random() * firstSetPlayers.length)]
    startIndex = findIndexByName(freshPlayers, picked.name)
  }

  await update(ref(db, `rooms/${roomId}`), {
    status: 'auction',
    currentPlayerIndex: startIndex,
    currentBid: 0,
    currentHighestBidder: null,
    paused: false,
    pausedTimeLeft: null,
    auctionLog: {},
    players: freshPlayers,
    playedNames: [],
    timerEndsAt: Date.now() + (bidTimer * 1000),
  })

  const teams = room.teams || {}
  const teamUpdates = {}
  Object.values(teams).forEach(team => {
    teamUpdates[`rooms/${roomId}/teams/${team.id}/squad`] = []
    teamUpdates[`rooms/${roomId}/teams/${team.id}/purse`] = team.initialPurse || team.purse
  })
  if (Object.keys(teamUpdates).length > 0) await update(ref(db), teamUpdates)
}

export async function restartPlayerList(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`))
  const room = snap.val()
  const bidTimer = room.bidTimer || 15

  let freshPlayers
  if (room.format === 'MEGA') freshPlayers = buildMegaAuctionPlayers()
  else if (room.format === 'LEGENDS') freshPlayers = buildLegendsPlayers()
  else freshPlayers = buildIPL2026Players()

  let startIndex = 0
  if (freshPlayers.length > 0) {
    const firstSet = freshPlayers[0].set
    const firstSetPlayers = freshPlayers.filter(p => p.set === firstSet)
    const picked = firstSetPlayers[Math.floor(Math.random() * firstSetPlayers.length)]
    startIndex = findIndexByName(freshPlayers, picked.name)
  }

  await update(ref(db, `rooms/${roomId}`), {
    players: freshPlayers,
    currentPlayerIndex: startIndex,
    currentBid: 0,
    currentHighestBidder: null,
    paused: false,
    pausedTimeLeft: null,
    playedNames: [],
    timerEndsAt: Date.now() + (bidTimer * 1000),
  })
}

export async function endAuction(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`))
  const room = snap.val()
  const updates = {}
  updates[`rooms/${roomId}/status`] = 'completed'
  updates[`rooms/${roomId}/timerEndsAt`] = null
  updates[`rooms/${roomId}/pausedTimeLeft`] = null
  updates[`rooms/${roomId}/paused`] = false

  const unsoldPlayers = (room.auctionLog || {})
    ? Object.values(room.auctionLog)
        .filter(l => !l.soldTo)
        .map(l => ({ ...room.players.find(p => p.name === l.playerName) || { name: l.playerName }, basePrice: Math.round((l.basePrice || 100) * 0.8) }))
    : []
  if (unsoldPlayers.length > 0) {
    updates[`rooms/${roomId}/unsoldPlayers`] = unsoldPlayers
  }

  const cp = room.players?.[room.currentPlayerIndex || 0]
  if (cp) {
    updates[`rooms/${roomId}/auctionLog/${Date.now()}_ended`] = {
      playerName: cp.name, soldTo: null, soldPrice: 0, time: Date.now()
    }
  }
  await update(ref(db), updates)
}

export async function startReAuction(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`))
  const room = snap.val()
  const unsoldPlayers = room.unsoldPlayers || []
  if (unsoldPlayers.length === 0) return

  const shuffled = [...unsoldPlayers].sort(() => Math.random() - 0.5)
  const bidTimer = room.bidTimer || 15

  await update(ref(db, `rooms/${roomId}`), {
    status: 'auction',
    players: shuffled,
    currentPlayerIndex: 0,
    currentBid: 0,
    currentHighestBidder: null,
    paused: false,
    pausedTimeLeft: null,
    playedNames: [],
    timerEndsAt: Date.now() + (bidTimer * 1000),
    reAuctionMode: true,
    unsoldPlayers: null
  })
}

// ════════════════════════════════════════════════════════════════
// PART 2 — TOURNAMENT (unchanged from original)
// ════════════════════════════════════════════════════════════════

const FULL_UNIQUE_PLAYER_POOL = [
  { name: 'MS Dhoni', role: 'WK', nat: 'IN', price: 1400 },
  { name: 'Rishabh Pant', role: 'WK', nat: 'IN', price: 1600 },
  { name: 'KL Rahul', role: 'WK', nat: 'IN', price: 1400 },
  { name: 'Sanju Samson', role: 'WK', nat: 'IN', price: 1400 },
  { name: 'Adam Gilchrist', role: 'WK', nat: 'OS', price: 1200 },
  { name: 'Jonny Bairstow', role: 'WK', nat: 'OS', price: 1200 },
  { name: 'Ishan Kishan', role: 'WK', nat: 'IN', price: 1600 },
  { name: 'Dinesh Karthik', role: 'WK', nat: 'IN', price: 800 },
  { name: 'Quinton de Kock', role: 'WK', nat: 'OS', price: 1000 },
  { name: 'Jos Buttler', role: 'WK', nat: 'OS', price: 2000 },
  { name: 'Nicholas Pooran', role: 'WK', nat: 'OS', price: 1400 },
  { name: 'Heinrich Klaasen', role: 'WK', nat: 'OS', price: 2300 },
  { name: 'Phil Salt', role: 'WK', nat: 'OS', price: 1170 },
  { name: 'Jitesh Sharma', role: 'WK', nat: 'IN', price: 130 },
  { name: 'Ryan Rickelton', role: 'WK', nat: 'OS', price: 100 },
  { name: 'Virat Kohli', role: 'BAT', nat: 'IN', price: 2100 },
  { name: 'Rohit Sharma', role: 'BAT', nat: 'IN', price: 1600 },
  { name: 'Shubman Gill', role: 'BAT', nat: 'IN', price: 1650 },
  { name: 'Yashasvi Jaiswal', role: 'BAT', nat: 'IN', price: 1400 },
  { name: 'David Warner', role: 'BAT', nat: 'OS', price: 1500 },
  { name: 'Travis Head', role: 'BAT', nat: 'OS', price: 1500 },
  { name: 'Steve Smith', role: 'BAT', nat: 'OS', price: 1200 },
  { name: 'Kane Williamson', role: 'BAT', nat: 'OS', price: 1300 },
  { name: 'Shreyas Iyer', role: 'BAT', nat: 'IN', price: 2625 },
  { name: 'Ruturaj Gaikwad', role: 'BAT', nat: 'IN', price: 1800 },
  { name: 'Faf du Plessis', role: 'BAT', nat: 'OS', price: 1800 },
  { name: 'Devdutt Padikkal', role: 'BAT', nat: 'IN', price: 150 },
  { name: 'Prithvi Shaw', role: 'BAT', nat: 'IN', price: 740 },
  { name: 'Tilak Varma', role: 'BAT', nat: 'IN', price: 1700 },
  { name: 'Sai Sudharsan', role: 'BAT', nat: 'IN', price: 800 },
  { name: 'Abhishek Sharma', role: 'BAT', nat: 'IN', price: 1450 },
  { name: 'Rajat Patidar', role: 'BAT', nat: 'IN', price: 1100 },
  { name: 'Will Jacks', role: 'BAT', nat: 'OS', price: 1100 },
  { name: 'Jake Fraser-McGurk', role: 'BAT', nat: 'OS', price: 900 },
  { name: 'Aiden Markram', role: 'BAT', nat: 'OS', price: 200 },
  { name: 'Glenn Maxwell', role: 'BAT', nat: 'OS', price: 750 },
  { name: 'Liam Livingstone', role: 'BAT', nat: 'OS', price: 2000 },
  { name: 'Manish Pandey', role: 'BAT', nat: 'IN', price: 100 },
  { name: 'Shikhar Dhawan', role: 'BAT', nat: 'IN', price: 100 },
  { name: 'Ambati Rayudu', role: 'BAT', nat: 'IN', price: 100 },
  { name: 'Mayank Agarwal', role: 'BAT', nat: 'IN', price: 600 },
  { name: 'Venkatesh Iyer', role: 'BAT', nat: 'IN', price: 2350 },
  { name: 'Dawid Malan', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Tom Kohler-Cadmore', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Riyan Parag', role: 'BAT', nat: 'IN', price: 150 },
  { name: 'Dhruv Jurel', role: 'BAT', nat: 'IN', price: 300 },
  { name: 'B Sai Sudharsan', role: 'BAT', nat: 'IN', price: 200 },
  { name: 'Ayush Badoni', role: 'BAT', nat: 'IN', price: 200 },
  { name: 'Rahul Tripathi', role: 'BAT', nat: 'IN', price: 100 },
  { name: 'Wriddhiman Saha', role: 'BAT', nat: 'IN', price: 100 },
  { name: 'Robin Uthappa', role: 'BAT', nat: 'IN', price: 100 },
  { name: 'Rassie van der Dussen', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Tom Latham', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Ben Duckett', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Finn Allen', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Kusal Mendis', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Pathum Nissanka', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Rilee Rossouw', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Niroshan Dickwella', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Sikandar Raza', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Colin Munro', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Evin Lewis', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Brandon King', role: 'BAT', nat: 'OS', price: 100 },
  { name: 'Hardik Pandya', role: 'AR', nat: 'IN', price: 1600 },
  { name: 'Ravindra Jadeja', role: 'AR', nat: 'IN', price: 1800 },
  { name: 'Axar Patel', role: 'AR', nat: 'IN', price: 1650 },
  { name: 'Washington Sundar', role: 'AR', nat: 'IN', price: 350 },
  { name: 'Andre Russell', role: 'AR', nat: 'OS', price: 1200 },
  { name: 'Sunil Narine', role: 'AR', nat: 'OS', price: 1300 },
  { name: 'Sam Curran', role: 'AR', nat: 'OS', price: 1850 },
  { name: 'Mitchell Marsh', role: 'AR', nat: 'OS', price: 1700 },
  { name: 'Shivam Dube', role: 'AR', nat: 'IN', price: 450 },
  { name: 'Krunal Pandya', role: 'AR', nat: 'IN', price: 700 },
  { name: 'Shardul Thakur', role: 'AR', nat: 'IN', price: 400 },
  { name: 'Deepak Chahar', role: 'AR', nat: 'IN', price: 1400 },
  { name: 'Marcus Stoinis', role: 'AR', nat: 'OS', price: 250 },
  { name: 'Jason Holder', role: 'AR', nat: 'OS', price: 750 },
  { name: 'Dwayne Bravo', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Chris Morris', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Moeen Ali', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Daniel Sams', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Daryl Mitchell', role: 'AR', nat: 'OS', price: 100 },
  { name: 'David Miller', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Romario Shepherd', role: 'AR', nat: 'OS', price: 1150 },
  { name: 'Shahbaz Ahmed', role: 'AR', nat: 'IN', price: 200 },
  { name: 'Nitish Rana', role: 'AR', nat: 'IN', price: 400 },
  { name: 'Shashank Singh', role: 'AR', nat: 'IN', price: 525 },
  { name: 'Tristan Stubbs', role: 'AR', nat: 'OS', price: 1625 },
  { name: 'Tim David', role: 'AR', nat: 'OS', price: 850 },
  { name: 'Rickey Bhui', role: 'AR', nat: 'IN', price: 100 },
  { name: 'R Sai Kishore', role: 'AR', nat: 'IN', price: 1100 },
  { name: 'Ravi Bishnoi', role: 'AR', nat: 'IN', price: 200 },
  { name: 'Piyush Chawla', role: 'AR', nat: 'IN', price: 100 },
  { name: 'Chris Gayle', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Eoin Morgan', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Corey Anderson', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Ben Stokes', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Cameron Green', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Matthew Wade', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Wanindu Hasaranga', role: 'AR', nat: 'OS', price: 150 },
  { name: 'Odean Smith', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Anrich Nortje', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Mujeeb Ur Rahman', role: 'AR', nat: 'OS', price: 100 },
  { name: 'Jasprit Bumrah', role: 'BOWL', nat: 'IN', price: 1800 },
  { name: 'Mohammad Shami', role: 'BOWL', nat: 'IN', price: 1050 },
  { name: 'Yuzvendra Chahal', role: 'BOWL', nat: 'IN', price: 1800 },
  { name: 'Kuldeep Yadav', role: 'BOWL', nat: 'IN', price: 2000 },
  { name: 'Bhuvneshwar Kumar', role: 'BOWL', nat: 'IN', price: 500 },
  { name: 'Avesh Khan', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Rashid Khan', role: 'BOWL', nat: 'OS', price: 1800 },
  { name: 'Trent Boult', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Pat Cummins', role: 'BOWL', nat: 'OS', price: 2000 },
  { name: 'Kagiso Rabada', role: 'BOWL', nat: 'OS', price: 140 },
  { name: 'Arshdeep Singh', role: 'BOWL', nat: 'IN', price: 1800 },
  { name: 'T Natarajan', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Harshal Patel', role: 'BOWL', nat: 'IN', price: 120 },
  { name: 'Umesh Yadav', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Mohammed Siraj', role: 'BOWL', nat: 'IN', price: 125 },
  { name: 'Prasidh Krishna', role: 'BOWL', nat: 'IN', price: 750 },
  { name: 'Josh Hazlewood', role: 'BOWL', nat: 'OS', price: 150 },
  { name: 'Lockie Ferguson', role: 'BOWL', nat: 'OS', price: 200 },
  { name: 'Adam Milne', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Alzarri Joseph', role: 'BOWL', nat: 'OS', price: 115 },
  { name: 'Fidel Edwards', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Nathan Coulter-Nile', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Waqar Salamkheil', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Akeal Hosein', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Shivam Mavi', role: 'BOWL', nat: 'IN', price: 600 },
  { name: 'Yash Dayal', role: 'BOWL', nat: 'IN', price: 325 },
  { name: 'Khaleel Ahmed', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Sandeep Sharma', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Varun Chakaravarthy', role: 'BOWL', nat: 'IN', price: 200 },
  { name: 'Noor Ahmad', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Maheesh Theekshana', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Ravi Ashwin', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Deepak Hooda', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Tushar Deshpande', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Karn Sharma', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Tanvir Sangha', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Akash Singh', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Mukesh Kumar', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Naveen-ul-Haq', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Adil Rashid', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Imran Tahir', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Matheesha Pathirana', role: 'BOWL', nat: 'OS', price: 150 },
  { name: 'Gerald Coetzee', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Lungi Ngidi', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Ottniel Baartman', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Tabraiz Shamsi', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Azmatullah Omarzai', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Fazalhaq Farooqi', role: 'BOWL', nat: 'OS', price: 100 },
  { name: 'Jayant Yadav', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Parvez Rasool', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Shreyas Gopal', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Umran Malik', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Akash Madhwal', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Vyshak Vijaykumar', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Mohit Sharma', role: 'BOWL', nat: 'IN', price: 100 },
  { name: 'Chetan Sakariya', role: 'BOWL', nat: 'IN', price: 100 },
]

function makeFakeSquadUnique(teamIndex) {
  const byRole = { WK: [], BAT: [], AR: [], BOWL: [] }
  FULL_UNIQUE_PLAYER_POOL.forEach(p => byRole[p.role].push(p))
  const PICKS = { WK: 1, BAT: 4, AR: 4, BOWL: 6 }
  const squad = []
  Object.entries(PICKS).forEach(([role, count]) => {
    const pool = byRole[role]
    const start = (teamIndex * count) % pool.length
    for (let i = 0; i < count; i++) {
      const player = pool[(start + i) % pool.length]
      squad.push({ name: player.name, role: player.role, nationality: player.nat, basePrice: player.price, soldPrice: player.price + Math.floor(Math.random() * 200), soldTo: `team_${teamIndex}`, set: 'Test' })
    }
  })
  return squad
}

function buildCPUxi(squad) {
  if (!squad || squad.length < 11) return squad || []
  const byRole = { WK: [], BAT: [], AR: [], BOWL: [] }
  squad.forEach(p => { const r = p.role?.toUpperCase() || 'BAT'; if (byRole[r]) byRole[r].push(p) })
  Object.keys(byRole).forEach(r => { byRole[r] = byRole[r].sort(() => Math.random() - 0.5) })
  const xi = []; const MAX_OS = 4; let osCount = 0
  const tryAdd = (player) => { if (xi.length >= 11) return false; const isOS = player.nationality === 'OS'; if (isOS && osCount >= MAX_OS) return false; xi.push(player); if (isOS) osCount++; return true }
  byRole.WK.slice(0, 2).forEach(p => tryAdd(p))
  let batAdded = 0; for (const p of byRole.BAT) { if (batAdded >= 4) break; if (tryAdd(p)) batAdded++ }
  let arAdded = 0; for (const p of byRole.AR) { if (arAdded >= 3) break; if (tryAdd(p)) arAdded++ }
  for (const p of byRole.BOWL) { if (xi.length >= 11) break; tryAdd(p) }
  const used = new Set(xi.map(p => p.name))
  for (const p of squad) { if (xi.length >= 11) break; if (!used.has(p.name)) tryAdd(p) }
  return xi.slice(0, 11)
}

const ALL_POSSIBLE_FAKE_TEAMS = [
  { id: 'MI', name: 'Mumbai Indians', shortName: 'MI', color: '#004BA0', accent: '#D1AB3E' },
  { id: 'CSK', name: 'Chennai Super Kings', shortName: 'CSK', color: '#F9CD05', accent: '#0081E9' },
  { id: 'RCB', name: 'Royal Challengers Bangalore', shortName: 'RCB', color: '#EC1C24', accent: '#FFD700' },
  { id: 'KKR', name: 'Kolkata Knight Riders', shortName: 'KKR', color: '#3A225D', accent: '#B3A123' },
  { id: 'SRH', name: 'Sunrisers Hyderabad', shortName: 'SRH', color: '#FF822A', accent: '#000000' },
  { id: 'DC', name: 'Delhi Capitals', shortName: 'DC', color: '#004C93', accent: '#EF1C25' },
  { id: 'RR', name: 'Rajasthan Royals', shortName: 'RR', color: '#EA1A85', accent: '#254AA5' },
  { id: 'GT', name: 'Gujarat Titans', shortName: 'GT', color: '#1C1C6E', accent: '#C8A84B' },
  { id: 'PBKS', name: 'Punjab Kings', shortName: 'PBKS', color: '#ED1B24', accent: '#A7A9AC' },
  { id: 'LSG', name: 'Lucknow Super Giants', shortName: 'LSG', color: '#A0C2E8', accent: '#FBBD16' },
]

export async function createTournament(roomId, testMode = false) {
  const snap = await get(ref(db, `rooms/${roomId}`))
  const room = snap.val()
  if (!room) return
  if (room.tournament?.matches) return
  let teamsForTournament
  if (testMode) {
    const realTeams = Object.values(room.teams || {})
    const myRealTeam = realTeams.find(t => t.ownerId) || realTeams[0]
    let mySquad = myRealTeam?.squad || []
    if (mySquad.length < 15) mySquad = makeFakeSquadUnique(0)
    const fakeCandidates = ALL_POSSIBLE_FAKE_TEAMS.filter(t => t.id !== myRealTeam?.id).slice(0, 5)
    teamsForTournament = [
      { ...myRealTeam, squad: mySquad, id: myRealTeam.id, name: myRealTeam.name, shortName: myRealTeam.shortName || myRealTeam.id, color: myRealTeam.color || '#F2A900', accent: myRealTeam.accent || '#000', ownerName: myRealTeam.ownerName || 'You' },
      ...fakeCandidates.map((t, i) => ({ ...t, ownerId: `cpu_${t.id}`, ownerName: `CPU ${t.shortName}`, purse: 0, initialPurse: 12000, maxOverseas: 8, squad: makeFakeSquadUnique(i + 1) }))
    ]
    const fakeTeamsObj = {}
    teamsForTournament.forEach(t => { fakeTeamsObj[t.id] = t })
    await update(ref(db, `rooms/${roomId}/teams`), fakeTeamsObj)
  } else {
    teamsForTournament = Object.values(room.teams || {})
  }
  const fixtures = generateFixtures(teamsForTournament)
  if (!fixtures) return
  const pointsTable = initPointsTable(teamsForTournament)
  const matchesObj = {}
  fixtures.matches.forEach(m => { matchesObj[m.id] = m })
  const playoffObj = {}
  fixtures.playoffMatches.forEach(m => { playoffObj[m.id] = m })
  await update(ref(db, `rooms/${roomId}/tournament`), {
    stage: 'league', format: fixtures.format, playoffSlots: fixtures.playoffSlots,
    matches: matchesObj, playoffs: playoffObj, pointsTable, champion: null,
    testMode: testMode || false, createdAt: serverTimestamp(),
  })
}

export function subscribeTournament(roomId, callback) {
  const roomRef = ref(db, `rooms/${roomId}`)
  onValue(roomRef, snap => callback(snap.val()))
  return () => off(roomRef)
}

export async function saveXI(roomId, matchId, teamId, xi, impactPlayer, isPlayoff = false) {
  const path = isPlayoff ? `rooms/${roomId}/tournament/playoffs/${matchId}` : `rooms/${roomId}/tournament/matches/${matchId}`
  const snap = await get(ref(db, path))
  const match = snap.val()
  if (!match) return
  const isTeamA = match.teamA === teamId
  await update(ref(db, path), { [isTeamA ? 'xiA' : 'xiB']: xi, [isTeamA ? 'impactA' : 'impactB']: impactPlayer || null })
}

export async function saveToss(roomId, matchId, tossWinner, tossDec, isPlayoff = false) {
  const path = isPlayoff ? `rooms/${roomId}/tournament/playoffs/${matchId}` : `rooms/${roomId}/tournament/matches/${matchId}`
  await update(ref(db, path), { tossWinner, tossDec, status: 'live' })
}

export async function autoFillCPUxi(roomId, matchId, isPlayoff = false) {
  const path = isPlayoff ? `rooms/${roomId}/tournament/playoffs/${matchId}` : `rooms/${roomId}/tournament/matches/${matchId}`
  const [matchSnap, teamsSnap] = await Promise.all([get(ref(db, path)), get(ref(db, `rooms/${roomId}/teams`))])
  const match = matchSnap.val()
  const teams = teamsSnap.val() || {}
  if (!match) return
  const updates = {}
  if (!match.xiA || match.xiA.length < 11) { const teamA = teams[match.teamA]; if (teamA?.ownerId?.startsWith('cpu_') || teamA?.ownerName?.startsWith('CPU')) updates[`${path}/xiA`] = buildCPUxi(teamA.squad || []) }
  if (!match.xiB || match.xiB.length < 11) { const teamB = teams[match.teamB]; if (teamB?.ownerId?.startsWith('cpu_') || teamB?.ownerName?.startsWith('CPU')) updates[`${path}/xiB`] = buildCPUxi(teamB.squad || []) }
  if (Object.keys(updates).length > 0) await update(ref(db), updates)
}

export async function saveMatchResult(roomId, matchId, result) {
  const { scoreA, wicketsA, oversA, scoreB, wicketsB, oversB, winner } = result
  await update(ref(db, `rooms/${roomId}/tournament/matches/${matchId}`), { scoreA, wicketsA, oversA, scoreB, wicketsB, oversB, winner: winner || null, status: 'completed', playedAt: serverTimestamp() })
  const snap = await get(ref(db, `rooms/${roomId}/tournament`))
  const tournament = snap.val()
  const allMatches = Object.values(tournament.matches || {})
  const teamsSnap = await get(ref(db, `rooms/${roomId}/teams`))
  const teams = Object.values(teamsSnap.val() || {})
  let table = initPointsTable(teams)
  allMatches.filter(m => m.status === 'completed').forEach(m => { table = updatePointsTable(table, m) })
  const justSaved = { ...allMatches.find(m => m.id === matchId), scoreA, wicketsA, oversA, scoreB, wicketsB, oversB, winner: winner || null, status: 'completed' }
  table = updatePointsTable(table, justSaved)
  await update(ref(db, `rooms/${roomId}/tournament/pointsTable`), table)
  await checkAndAdvanceStage(roomId)
}

export async function savePlayoffResult(roomId, matchId, result) {
  const { scoreA, wicketsA, oversA, scoreB, wicketsB, oversB, winner } = result
  await update(ref(db, `rooms/${roomId}/tournament/playoffs/${matchId}`), { scoreA, wicketsA, oversA, scoreB, wicketsB, oversB, winner: winner || null, status: 'completed', playedAt: serverTimestamp() })
  if (winner) await advancePlayoffs(roomId, matchId, winner)
}

async function checkAndAdvanceStage(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}/tournament`))
  const tournament = snap.val()
  if (!tournament || tournament.stage !== 'league') return
  const leagueMatches = Object.values(tournament.matches || {})
  const allDone = leagueMatches.every(m => m.status === 'completed')
  if (!allDone) return
  const table = tournament.pointsTable || {}
  const sorted = sortPointsTable(table)
  const format = tournament.format
  if (format === 'bestof3') {
    const wins = {}
    leagueMatches.forEach(m => { if (m.winner) wins[m.winner] = (wins[m.winner] || 0) + 1 })
    const champ = Object.entries(wins).find(([, w]) => w >= 2)?.[0]
    if (champ) await update(ref(db, `rooms/${roomId}/tournament`), { stage: 'done', champion: champ })
    return
  }
  if (format === 'roundrobin_top2') {
    const [t1, t2] = sorted
    await update(ref(db, `rooms/${roomId}/tournament/playoffs/final`), { teamA: t1?.id, teamAName: t1?.name, teamAShort: t1?.shortName, teamAColor: t1?.color, teamB: t2?.id, teamBName: t2?.name, teamBShort: t2?.shortName, teamBColor: t2?.color, status: 'scheduled' })
    await update(ref(db, `rooms/${roomId}/tournament`), { stage: 'playoff' })
    return
  }
  const top4 = sorted.slice(0, 4)
  const u = {}
  const slot = (mId, side, team) => { const base = `rooms/${roomId}/tournament/playoffs/${mId}`; u[`${base}/team${side}`] = team?.id || null; u[`${base}/team${side}Name`] = team?.name || 'TBD'; u[`${base}/team${side}Short`] = team?.shortName || 'TBD'; u[`${base}/team${side}Color`] = team?.color || '#888' }
  slot('q1', 'A', top4[0]); slot('q1', 'B', top4[1]); slot('eliminator', 'A', top4[2]); slot('eliminator', 'B', top4[3])
  u[`rooms/${roomId}/tournament/playoffs/q1/status`] = 'scheduled'
  u[`rooms/${roomId}/tournament/playoffs/eliminator/status`] = 'scheduled'
  u[`rooms/${roomId}/tournament/stage`] = 'playoff'
  await update(ref(db), u)
}

async function advancePlayoffs(roomId, completedId, winnerId) {
  const snap = await get(ref(db, `rooms/${roomId}/tournament`))
  const tournament = snap.val()
  const playoffs = tournament.playoffs || {}
  const table = tournament.pointsTable || {}
  const getTeam = id => { const t = table[id]; return t ? { id, name: t.name, shortName: t.shortName || t.name, color: t.color || '#888' } : { id, name: id, shortName: id, color: '#888' } }
  const winner = getTeam(winnerId)
  if (completedId === 'q1') {
    const loserId = playoffs.q1.teamA === winnerId ? playoffs.q1.teamB : playoffs.q1.teamA
    const loser = getTeam(loserId)
    const elimDone = playoffs.eliminator?.status === 'completed'
    const elimWinner = elimDone ? getTeam(playoffs.eliminator.winner) : null
    await update(ref(db, `rooms/${roomId}/tournament/playoffs/final`), { teamA: winner.id, teamAName: winner.name, teamAShort: winner.shortName, teamAColor: winner.color })
    await update(ref(db, `rooms/${roomId}/tournament/playoffs/q2`), { teamA: loser.id, teamAName: loser.name, teamAShort: loser.shortName, teamAColor: loser.color, teamB: elimWinner?.id || null, teamBName: elimWinner?.name || 'Winner Eliminator', teamBShort: elimWinner?.shortName || 'TBD', teamBColor: elimWinner?.color || '#888', status: elimDone ? 'scheduled' : 'pending' })
  }
  if (completedId === 'eliminator') {
    const q2snap = await get(ref(db, `rooms/${roomId}/tournament/playoffs/q2`))
    const q2 = q2snap.val() || {}
    await update(ref(db, `rooms/${roomId}/tournament/playoffs/q2`), { teamB: winner.id, teamBName: winner.name, teamBShort: winner.shortName, teamBColor: winner.color, status: q2.teamA ? 'scheduled' : 'pending' })
  }
  if (completedId === 'q2') {
    const fsnap = await get(ref(db, `rooms/${roomId}/tournament/playoffs/final`))
    const final = fsnap.val() || {}
    await update(ref(db, `rooms/${roomId}/tournament/playoffs/final`), { teamB: winner.id, teamBName: winner.name, teamBShort: winner.shortName, teamBColor: winner.color, status: final.teamA ? 'scheduled' : 'pending' })
  }
  if (completedId === 'final') await update(ref(db, `rooms/${roomId}/tournament`), { stage: 'done', champion: winnerId })
}

export async function getTournamentStats(roomId) {
  const snap = await get(ref(db, `rooms/${roomId}`))
  const room = snap.val()
  if (!room) return null
  const tournament = room.tournament || {}
  const allMatches = [...Object.values(tournament.matches || {}), ...Object.values(tournament.playoffs || {})].filter(m => m.status === 'completed')
  const playerRuns = {}; const playerWickets = {}
  allMatches.forEach(match => {
    ;[...(match.ballLogA || []), ...(match.ballLogB || [])].forEach(ball => {
      if (!ball.isExtra && !ball.isWicket && ball.runs > 0 && ball.batsman) playerRuns[ball.batsman] = (playerRuns[ball.batsman] || 0) + ball.runs
      if (ball.isWicket && ball.bowler) playerWickets[ball.bowler] = (playerWickets[ball.bowler] || 0) + 1
    })
  })
  const topScorer = Object.entries(playerRuns).sort((a, b) => b[1] - a[1])[0]
  const topWickets = Object.entries(playerWickets).sort((a, b) => b[1] - a[1])[0]
  return {
    champion: tournament.champion, championTeam: room.teams?.[tournament.champion] || null,
    topScorer: topScorer ? { name: topScorer[0], runs: topScorer[1] } : null,
    topWicketTaker: topWickets ? { name: topWickets[0], wickets: topWickets[1] } : null,
    pointsTable: sortPointsTable(tournament.pointsTable || {}), totalMatches: allMatches.length, teams: room.teams || {},
  }
}