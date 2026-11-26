import React, { useEffect, useState } from 'react'

export default function Confetti({ duration = 2500 }) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setVisible(false), duration)
    return () => clearTimeout(t)
  }, [duration])

  if (!visible) return null

  const pieces = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: ['#F2A900', '#3B82F6', '#22C55E', '#EF4444', '#a855f7', '#ec4899', '#f97316'][Math.floor(Math.random() * 7)],
    delay: `${Math.random() * 0.8}s`,
    animDuration: `${1.2 + Math.random() * 1.2}s`,
    size: `${6 + Math.random() * 10}px`,
    borderRadius: Math.random() > 0.5 ? '50%' : '2px',
    rotate: `${Math.floor(Math.random() * 360)}deg`
  }))

  return (
    <>
      <style>{`
        @keyframes confettiFall {
          0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden' }}>
        {pieces.map(p => (
          <div key={p.id} style={{
            position: 'absolute',
            top: '-20px',
            left: p.left,
            width: p.size,
            height: p.size,
            background: p.color,
            borderRadius: p.borderRadius,
            transform: `rotate(${p.rotate})`,
            animation: `confettiFall ${p.animDuration} linear ${p.delay} forwards`
          }} />
        ))}
      </div>
    </>
  )
}