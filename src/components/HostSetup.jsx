import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IPL_TEAMS, AUCTION_FORMATS } from '../data/teams.js'
import { buildMegaAuctionPlayers } from '../data/megaAuctionPlayers.js'
import { buildLegendsPlayers } from '../data/legendsPlayers.js'
import { buildIPL2026Players, IPL_2026_TEAMS } from '../data/ipl2026Players.js'
import { createRoom } from '../utils/db.js'

// Player counts per format
const FORMAT_PLAYER_COUNTS = {
  MEGA: 522,
  LEGENDS: 280,
  IPL2026: 200,
}

export default function HostSetup() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [hostName, setHostName] = useState('')
  const [format, setFormat] = useState('MEGA')
  const [minSquad, setMinSquad] = useState(15)
  const [maxSquad, setMaxSquad] = useState(25)
  const [maxOverseas, setMaxOverseas] = useState(8)
  const [bidTimer, setBidTimer] = useState(15)
  const [bidIncrement, setBidIncrement] = useState(5)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setCreating(true)
    setError('')
    try {
      let players = []
      if (format === 'MEGA') players = buildMegaAuctionPlayers()
      else if (format === 'LEGENDS') players = buildLegendsPlayers()
      else if (format === 'IPL2026') players = buildIPL2026Players()

      const fmt = AUCTION_FORMATS[format]
      const teamsObj = {}
      IPL_TEAMS.forEach(team => {
        let purse = fmt.pursePerTeam || 12000
        let squad = []
        if (format === 'IPL2026' && IPL_2026_TEAMS[team.id]) {
          const t2026 = IPL_2026_TEAMS[team.id]
          purse = t2026.purse
          squad = t2026.retained.map(p => ({
            ...p,
            id: `retained_${p.name.replace(/\s/g,'_')}`,
            basePrice: p.retentionPrice,
            soldPrice: p.retentionPrice,
            set: 'Retained',
            soldTo: team.name,
            isRetained: true
          }))
        }
        teamsObj[team.id] = {
          ...team,
          ownerId: null,
          ownerName: null,
          purse,
          initialPurse: purse,
          squad,
          maxOverseas
        }
      })

      const hostId = `host_${Date.now()}`
      localStorage.setItem('playerName', hostName)
      localStorage.setItem('isHost', 'true')
      localStorage.setItem('hostId', hostId)

      const roomId = await createRoom({
        hostId,
        hostName,
        format,
        minSquadSize: minSquad,
        maxSquadSize: maxSquad,
        maxOverseas,
        bidTimer,
        bidIncrement,
        players,
        teams: teamsObj
      })

      navigate(`/room/${roomId}`)
    } catch (err) {
      console.error(err)
      setError('Failed to create room. Check your Firebase config.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')} style={{marginBottom:24}}>
          ← Back
        </button>

        <h1 style={styles.title}>Host Setup</h1>

        {/* Step indicators */}
        <div style={styles.steps}>
          {['Format', 'Settings', 'Preview'].map((s, i) => (
            <div key={s} style={styles.stepItem}>
              <div style={{
                ...styles.stepNum,
                background: step > i+1 ? 'var(--green)' : step === i+1 ? 'var(--gold)' : 'var(--bg-elevated)',
                color: step > i+1 || step === i+1 ? '#000' : 'var(--text-muted)'
              }}>
                {step > i+1 ? '✓' : i+1}
              </div>
              <span style={{fontSize:13, color: step === i+1 ? 'var(--text-primary)' : 'var(--text-muted)'}}>{s}</span>
            </div>
          ))}
        </div>

        {/* STEP 1: Format Selection */}
        {step === 1 && (
          <div className="animate-fade-in" style={styles.stepContent}>
            <div style={styles.field}>
              <label style={styles.label}>Your Name (Host)</label>
              <input
                placeholder="e.g. Vedant"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                maxLength={20}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Auction Format</label>
              <div style={styles.formatGrid}>
                {Object.values(AUCTION_FORMATS).map(fmt => (
                  <div
                    key={fmt.id}
                    style={{
                      ...styles.formatCard,
                      border: format === fmt.id ? '2px solid var(--gold)' : '1px solid var(--border)',
                      background: format === fmt.id ? 'rgba(242,169,0,0.08)' : 'var(--bg-card)',
                    }}
                    onClick={() => setFormat(fmt.id)}
                  >
                    <div style={styles.formatTop}>
                      <span style={{fontSize:36}}>{fmt.icon}</span>
                      <span style={styles.formatBadge}>{FORMAT_PLAYER_COUNTS[fmt.id] || 0} Players</span>
                    </div>
                    <div style={styles.fmtName}>{fmt.name}</div>
                    <div style={styles.fmtDesc}>{fmt.description}</div>
                    {fmt.id === 'MEGA' && (
                      <div style={styles.fmtDetail}>\uD83C\uDFCF {FORMAT_PLAYER_COUNTS.MEGA} Players • No Retentions • Fresh Start</div>
                    )}
                    {fmt.id === 'LEGENDS' && (
                      <div style={styles.fmtDetail}>⭐ IPL All-Time Greats • Legends Edition</div>
                    )}
                    {fmt.id === 'IPL2026' && (
                      <div style={styles.fmtDetail}>🌸 Real Purses • Real Retentions • Authentic</div>
                    )}
                    {format === fmt.id && <div style={styles.selectedCheck}>✓ Selected</div>}
                  </div>
                ))}
              </div>
            </div>

            <button
              className="btn btn-gold btn-lg"
              style={{width:'100%', marginTop:8}}
              disabled={!hostName.trim()}
              onClick={() => setStep(2)}
            >
              Next: Settings →
            </button>
          </div>
        )}

        {/* STEP 2: Settings */}
        {step === 2 && (
          <div className="animate-fade-in" style={styles.stepContent}>
            <div style={styles.settingsGrid}>
              <div style={styles.settingCard}>
                <div style={styles.settingLabel}>Min Squad Size</div>
                <div style={styles.numInput}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMinSquad(Math.max(11, minSquad - 1))}>−</button>
                  <span style={styles.numVal}>{minSquad}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMinSquad(Math.min(maxSquad, minSquad + 1))}>+</button>
                </div>
                <div style={styles.settingHint}>Minimum 11 (must be able to field an XI)</div>
              </div>

              <div style={styles.settingCard}>
                <div style={styles.settingLabel}>Max Squad Size</div>
                <div style={styles.numInput}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMaxSquad(Math.max(minSquad, maxSquad - 1))}>−</button>
                  <span style={styles.numVal}>{maxSquad}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMaxSquad(Math.min(35, maxSquad + 1))}>+</button>
                </div>
                <div style={styles.settingHint}>Max 35 players</div>
              </div>

              <div style={styles.settingCard}>
                <div style={styles.settingLabel}>Max Overseas</div>
                <div style={styles.numInput}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMaxOverseas(Math.max(4, maxOverseas - 1))}>−</button>
                  <span style={styles.numVal}>{maxOverseas}</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setMaxOverseas(Math.min(12, maxOverseas + 1))}>+</button>
                </div>
                <div style={styles.settingHint}>IPL standard is 8</div>
              </div>

              <div style={styles.settingCard}>
                <div style={styles.settingLabel}>Bid Timer (seconds)</div>
                <div style={styles.numInput}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setBidTimer(Math.max(5, bidTimer - 5))}>−</button>
                  <span style={styles.numVal}>{bidTimer}s</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setBidTimer(Math.min(60, bidTimer + 5))}>+</button>
                </div>
                <div style={styles.settingHint}>Timer resets on each new bid</div>
              </div>

              <div style={styles.settingCard}>
                <div style={styles.settingLabel}>Bid Increment (\u20B9 Lakhs)</div>
                <div style={styles.numInput}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setBidIncrement(Math.max(5, bidIncrement - 5))}>−</button>
                  <span style={styles.numVal}>\u20B9{bidIncrement}L</span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setBidIncrement(Math.min(100, bidIncrement + 5))}>+</button>
                </div>
                <div style={styles.settingHint}>Minimum raise per bid</div>
              </div>
            </div>

            <div style={styles.infoBox}>
              <div style={styles.infoIcon}>\uD83C\uDFCF</div>
              <div>
                <div style={styles.infoTitle}>All 10 IPL teams included</div>
                <div style={styles.infoDesc}>
                  Each friend joins the lobby and picks their own team. They can switch to any unpicked team before the auction starts.
                </div>
              </div>
            </div>

            {error && <p style={{color:'var(--red)', fontSize:13}}>{error}</p>}

            <div style={{display:'flex', gap:12, marginTop:4}}>
              <button className="btn btn-ghost" onClick={() => setStep(1)} style={{flex:1}}>← Back</button>
              <button
                className="btn btn-green btn-lg"
                onClick={() => setStep(3)}
                style={{flex:1}}
              >
                Next: Preview →
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === 3 && (
          <div className="animate-fade-in" style={styles.stepContent}>
            <div style={styles.previewBox}>
              <div style={styles.previewTitle}>🎬 Auction Preview</div>

              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Format</span>
                <span style={styles.previewValue}>{AUCTION_FORMATS[format]?.name}</span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Players</span>
                <span style={styles.previewValue}>{FORMAT_PLAYER_COUNTS[format]} players</span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Squad Size</span>
                <span style={styles.previewValue}>{minSquad}–{maxSquad} players</span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Max Overseas</span>
                <span style={styles.previewValue}>{maxOverseas}</span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Bid Timer</span>
                <span style={styles.previewValue}>{bidTimer} seconds</span>
              </div>
              <div style={styles.previewRow}>
                <span style={styles.previewLabel}>Bid Increment</span>
                <span style={styles.previewValue}>\u20B9{bidIncrement}L</span>
              </div>

              {/* Animated preview card */}
              <div style={styles.previewCard}>
                <div style={styles.previewCardHeader}>
                  <span style={{...styles.animatedDot, animation:'pulse 2s infinite'}} />
                  <span>MARQUEE SET 1</span>
                </div>
                <div style={{display:'flex', gap:12, alignItems:'center', padding:'12px'}}>
                  <div style={{width:48, height:48, borderRadius:'50%', background:'var(--bg-elevated)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24}}>
                    {AUCTION_FORMATS[format]?.icon}
                  </div>
                  <div>
                    <div style={{fontFamily:'var(--font-display)', fontSize:18, fontWeight:700}}>Player Name</div>
                    <div style={{fontSize:12, color:'var(--text-muted)'}}>Role • Base Price</div>
                  </div>
                </div>
                <div style={{padding:'8px 12px', background:'var(--bg-elevated)', borderRadius:'0 0 var(--radius-lg) var(--radius-lg)', textAlign:'center'}}>
                  <span style={{fontFamily:'var(--font-display)', fontSize:24, fontWeight:800, color:'var(--gold)'}}>\u20B90 Cr</span>
                  <div style={{fontSize:11, color:'var(--text-muted)', marginTop:4}}>Current Bid</div>
                </div>
              </div>
            </div>

            <div style={{display:'flex', gap:12, marginTop:4}}>
              <button className="btn btn-ghost" onClick={() => setStep(2)} style={{flex:1}}>← Back</button>
              <button
                className="btn btn-green btn-lg"
                onClick={handleCreate}
                disabled={creating}
                style={{flex:2}}
              >
                {creating ? 'Creating Room...' : '🚀 Create Room (10 Teams)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight:'100vh', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'40px 16px', background:'var(--bg-primary)' },
  container: { width:'100%', maxWidth:700 },
  title: { fontFamily:'var(--font-display)', fontSize:36, fontWeight:800, marginBottom:32 },
  steps: { display:'flex', alignItems:'center', gap:0, marginBottom:36 },
  stepItem: { display:'flex', alignItems:'center', gap:8, flex:1 },
  stepNum: { width:28, height:28, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'var(--font-display)', fontWeight:700, fontSize:13, flexShrink:0 },
  stepContent: { display:'flex', flexDirection:'column', gap:20 },
  field: { display:'flex', flexDirection:'column', gap:6 },
  label: { fontFamily:'var(--font-display)', fontSize:13, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', color:'var(--text-secondary)' },
  hint: { fontSize:12, color:'var(--text-muted)', marginTop:2 },
  formatGrid: { display:'flex', flexDirection:'column', gap:12 },
  formatCard: { display:'flex', flexDirection:'column', gap:8, padding:'18px 20px', borderRadius:'var(--radius-lg)', cursor:'pointer', transition:'all 0.2s', position:'relative' },
  formatTop: { display:'flex', alignItems:'center', justifyContent:'space-between' },
  formatBadge: { padding:'4px 10px', borderRadius:20, background:'var(--bg-elevated)', border:'1px solid var(--border)', fontSize:12, fontFamily:'var(--font-display)', fontWeight:600 },
  fmtName: { fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, marginTop:8 },
  fmtDesc: { color:'var(--text-secondary)', fontSize:14, lineHeight:1.5 },
  fmtDetail: { fontSize:13, color:'var(--gold)', marginTop:4, fontFamily:'var(--font-display)', fontWeight:600 },
  selectedCheck: { position:'absolute', top:12, right:12, color:'var(--gold)', fontSize:18 },
  settingsGrid: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 },
  settingCard: { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'16px' },
  settingLabel: { fontFamily:'var(--font-display)', fontSize:13, fontWeight:600, letterSpacing:0.5, textTransform:'uppercase', color:'var(--text-secondary)', marginBottom:10 },
  settingHint: { fontSize:12, color:'var(--text-muted)', marginTop:8 },
  numInput: { display:'flex', alignItems:'center', gap:12, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'8px 12px' },
  numVal: { flex:1, textAlign:'center', fontFamily:'var(--font-display)', fontSize:20, fontWeight:700 },
  infoBox: { display:'flex', gap:14, padding:'14px 16px', background:'rgba(242,169,0,0.08)', border:'1px solid rgba(242,169,0,0.25)', borderRadius:'var(--radius-lg)', alignItems:'flex-start' },
  infoIcon: { fontSize:24, flexShrink:0, marginTop:2 },
  infoTitle: { fontFamily:'var(--font-display)', fontSize:14, fontWeight:700, color:'var(--gold)', marginBottom:4 },
  infoDesc: { fontSize:13, color:'var(--text-secondary)', lineHeight:1.5 },
  // Preview
  previewBox: { background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:24 },
  previewTitle: { fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, marginBottom:16, color:'var(--gold)' },
  previewRow: { display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid var(--border)' },
  previewLabel: { fontSize:13, color:'var(--text-secondary)' },
  previewValue: { fontSize:13, fontFamily:'var(--font-display)', fontWeight:600 },
  previewCard: { marginTop:16, border:'1px solid rgba(242,169,0,0.15)', borderRadius:'var(--radius-lg)', overflow:'hidden', boxShadow:'0 4px 24px rgba(0,0,0,0.4)' },
  previewCardHeader: { display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--bg-elevated)', fontSize:11, color:'var(--text-muted)', letterSpacing:1, textTransform:'uppercase' },
  animatedDot: { width:8, height:8, borderRadius:'50%', background:'var(--gold)', display:'inline-block' },
}
