import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTournamentStats } from '../utils/db.js'
import { IPL_TEAMS } from '../data/teams.js'

function formatPrice(lakhs) {
  if (!lakhs && lakhs !== 0) return '–'
  if (lakhs >= 100) return `${(lakhs / 100).toFixed(2)} Cr`
  return `${lakhs} L`
}

export default function Trophy() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getTournamentStats(roomId).then(s => {
      setStats(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [roomId])

  if (loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-secondary)', gap:16 }}>
      <div style={{ fontSize:48 }}>⏳</div>
      Loading tournament stats...
    </div>
  )

  if (!stats) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', color:'var(--text-secondary)', gap:16 }}>
      <div style={{ fontSize:48 }}>😕</div>
      Tournament not found.
      <button className="btn btn-ghost" onClick={() => navigate('/')}>Go Home</button>
    </div>
  )

  const { champion, championTeam, topScorer, topWicketTaker, pointsTable, totalMatches, teams } = stats
  const iplTeam = IPL_TEAMS.find(t => t.id === champion)
  const champColor = iplTeam?.color || championTeam?.color || 'var(--gold)'

  return (
    <div style={styles.page}>
      {/* Glow bg */}
      <div style={{ position:'fixed', top:0, left:'50%', transform:'translateX(-50%)', width:600, height:600, background:`radial-gradient(circle, ${champColor}18 0%, transparent 70%)`, pointerEvents:'none', zIndex:0 }} />

      <div style={styles.scroll}>
        {/* Trophy hero */}
        <div style={styles.hero}>
          <div style={{ fontSize:100, lineHeight:1, filter:`drop-shadow(0 0 30px ${champColor}66)` }}>🏆</div>
          <div style={{ fontSize:11, letterSpacing:4, color:'var(--text-muted)', textTransform:'uppercase', marginTop:20 }}>Tournament Champion</div>
          <div style={{ fontFamily:'var(--font-display)', fontSize:38, fontWeight:800, color: champColor, marginTop:8, textAlign:'center' }}>
            {championTeam?.name || champion || 'TBD'}
          </div>
          {championTeam?.ownerName && (
            <div style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
              Managed by <strong>{championTeam.ownerName}</strong>
            </div>
          )}
          <div style={{ fontSize:13, color:'var(--text-muted)', marginTop:8 }}>{totalMatches} matches played</div>
        </div>

        {/* Awards */}
        <div style={styles.awards}>
          {topScorer && (
            <div style={styles.awardCard}>
              <div style={styles.awardIcon}>🟠</div>
              <div style={styles.awardLabel}>Orange Cap</div>
              <div style={styles.awardName}>{topScorer.name}</div>
              <div style={styles.awardStat}>{topScorer.runs} runs</div>
            </div>
          )}
          {!topScorer && (
            <div style={{ ...styles.awardCard, opacity:0.4 }}>
              <div style={styles.awardIcon}>🟠</div>
              <div style={styles.awardLabel}>Orange Cap</div>
              <div style={styles.awardName}>–</div>
              <div style={styles.awardStat}>No data</div>
            </div>
          )}
          {topWicketTaker && (
            <div style={styles.awardCard}>
              <div style={styles.awardIcon}>🟣</div>
              <div style={styles.awardLabel}>Purple Cap</div>
              <div style={styles.awardName}>{topWicketTaker.name}</div>
              <div style={styles.awardStat}>{topWicketTaker.wickets} wickets</div>
            </div>
          )}
          {!topWicketTaker && (
            <div style={{ ...styles.awardCard, opacity:0.4 }}>
              <div style={styles.awardIcon}>🟣</div>
              <div style={styles.awardLabel}>Purple Cap</div>
              <div style={styles.awardName}>–</div>
              <div style={styles.awardStat}>No data</div>
            </div>
          )}
        </div>

        {/* Final standings */}
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Final Standings</div>
          <table style={styles.table}>
            <thead>
              <tr>
                {['#','Team','P','W','L','Pts','NRR'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(pointsTable || []).map((row, i) => {
                const ipl = IPL_TEAMS.find(t => t.id === row.id)
                return (
                  <tr key={row.id} style={{
                    ...styles.tr,
                    background: i === 0 ? 'rgba(255,215,0,0.06)' : 'transparent',
                  }}>
                    <td style={styles.td}>{i === 0 ? '🏆' : i + 1}</td>
                    <td style={{ ...styles.td, display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ width:10, height:10, borderRadius:'50%', display:'inline-block', background: ipl?.color || row.color || '#888', flexShrink:0 }} />
                      <span style={{ fontWeight: i === 0 ? 700 : 400, color: i === 0 ? 'var(--gold)' : 'inherit' }}>{row.name}</span>
                    </td>
                    <td style={styles.td}>{row.p}</td>
                    <td style={styles.td}>{row.w}</td>
                    <td style={styles.td}>{row.l}</td>
                    <td style={{ ...styles.td, fontWeight:700, color:'var(--gold)' }}>{row.pts}</td>
                    <td style={{ ...styles.td, color:(row.nrr||0) >= 0 ? 'var(--text-success)' : 'var(--text-danger)' }}>
                      {(row.nrr||0) >= 0 ? '+' : ''}{(row.nrr||0).toFixed(3)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'30px 20px 60px' }}>
          <button className="btn btn-primary" style={{ padding:'14px 40px', fontSize:17, fontWeight:800 }} onClick={() => navigate('/')}>
            🏏 Play Again
          </button>
          <button className="btn btn-ghost" onClick={() => navigate(`/tournament/${roomId}`)}>
            ← Back to Tournament
          </button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: { height:'100vh', background:'var(--bg-primary)', overflow:'hidden', position:'relative' },
  scroll: { height:'100%', overflowY:'auto', position:'relative', zIndex:1 },
  hero: { display:'flex', flexDirection:'column', alignItems:'center', padding:'60px 20px 30px' },
  awards: { display:'flex', gap:16, padding:'0 20px 30px', justifyContent:'center', flexWrap:'wrap' },
  awardCard: { flex:1, minWidth:140, maxWidth:200, background:'var(--bg-elevated)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'20px 16px', textAlign:'center' },
  awardIcon: { fontSize:28, marginBottom:8 },
  awardLabel: { fontSize:10, fontWeight:700, letterSpacing:1, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:8 },
  awardName: { fontFamily:'var(--font-display)', fontSize:16, fontWeight:700, color:'var(--gold)', marginBottom:4 },
  awardStat: { fontSize:13, color:'var(--text-secondary)' },
  section: { padding:'0 20px 20px', maxWidth:800, margin:'0 auto', width:'100%' },
  sectionLabel: { fontFamily:'var(--font-display)', fontSize:11, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase', color:'var(--text-muted)', marginBottom:12 },
  table: { width:'100%', borderCollapse:'collapse', fontSize:13 },
  th: { padding:'10px 12px', textAlign:'left', color:'var(--text-muted)', fontSize:11, textTransform:'uppercase', borderBottom:'1px solid var(--border)' },
  tr: { borderBottom:'1px solid var(--border)' },
  td: { padding:'10px 12px' },
}