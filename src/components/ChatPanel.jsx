import React, { useState, useEffect, useRef } from 'react'
import { ref, push, onValue, off } from 'firebase/database'
import { db } from '../firebase.js'
import { IPL_TEAMS } from '../data/teams.js'

const CP = {
  msgContainer: { flex: 1, overflow: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 },
  empty: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '32px 16px' },
  inputRow: { display: 'flex', gap: 7, padding: '8px 10px', borderTop: '1px solid var(--border)', flexShrink: 0, alignItems: 'center', background: 'var(--bg-secondary)' },
  input: { width: '100%', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontFamily: 'var(--font-body)', fontSize: 13, padding: '8px 12px', outline: 'none', boxSizing: 'border-box' },
  sendBtn: { width: 36, height: 36, borderRadius: 8, background: 'var(--gold)', border: 'none', color: '#000', fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
}

const ChatPanel = React.memo(function ChatPanel({ roomId, playerName, myTeam, isHost, compact = false }) {
  const [messages, setMessages] = useState([])
  const [showEmoji, setShowEmoji] = useState(false)
  const [reactions, setReactions] = useState({})
  const [reactionMenuKey, setReactionMenuKey] = useState(null)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  const QUICK_EMOJIS = ['😂', '\uD83D\uDD25', '\uD83D\uDCB0', '\uD83C\uDFCF', '👏', '😍', '🤑', '😤', '🙏', '⭐', '💪', '😎']
  const STICKERS = ['\uD83C\uDFC6', '🎯', '🚀', '💣', '\uD83D\uDC51', '🎪', '🎊', '🏅', '⚡', '🌟', '💥', '🎉']
  const REACTION_EMOJIS = ['👍', '\uD83D\uDD25', '\uD83D\uDCB0', '😮', '❤️', '😂']
  const charLeft = 200 - (inputRef.current?.value?.length || 0)

  useEffect(() => {
    const chatRef = ref(db, `rooms/${roomId}/chat`)
    const unsub = onValue(chatRef, snap => {
      if (snap.exists()) {
        const raw = snap.val()
        const msgs = Object.entries(raw)
          .map(([key, val]) => ({ ...val, _key: key }))
          .sort((a, b) => (a.time || 0) - (b.time || 0))
        setMessages(msgs)
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60)
      } else {
        setMessages([])
      }
    })
    return () => off(chatRef)
  }, [roomId])

  function send(text) {
    const t = (text !== undefined ? text : inputRef.current?.value).trim()
    if (!t) return
    push(ref(db, `rooms/${roomId}/chat`), {
      text: t,
      sender: playerName,
      team: myTeam?.shortName || myTeam?.id || '?',
      teamColor: myTeam?.color || '#F2A900',
      isHost: isHost || false,
      time: Date.now(),
    })
    if (inputRef.current) inputRef.current.value = ''
    setShowEmoji(false)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function addReaction(msgKey, emoji) {
    setReactions(prev => ({ ...prev, [msgKey]: prev[msgKey] === emoji ? null : emoji }))
    setReactionMenuKey(null)
  }

  const teamLogo = (team) => IPL_TEAMS.find(t => t.shortName === team || t.id === team)?.logo

  // compact = inline mode (shown below auction on mobile)
  const msgContainerStyle = compact
    ? { flex: 1, overflow: 'auto', padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160 }
    : CP.msgContainer

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: compact ? 'var(--bg-elevated)' : 'var(--bg-primary)', borderRadius: compact ? '0 0 10px 10px' : 0 }}>
      {/* Chat header */}
      {!compact && (
        <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-secondary)', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 1 }}>\uD83D\uDCAC LIVE CHAT</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{messages.length} messages</span>
        </div>
      )}

      {/* Messages */}
      <div style={msgContainerStyle} onClick={() => setReactionMenuKey(null)}>
        {messages.length === 0 && <div style={CP.empty}>Say something to your friends 👋</div>}
        {messages.map((msg, i) => {
          const isMe = msg.sender === playerName
          const isHostMsg = msg.isHost
          const timeStr = msg.time ? new Date(msg.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
          const myReaction = reactions[msg._key]
          const showReactionMenu = reactionMenuKey === (msg._key || i)
          return (
            <div key={msg._key || i} style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: 2, marginBottom: 2 }}>
              {/* Sender info */}
              {!compact && (
                <div style={{ fontSize: 10, fontWeight: 700, color: isHostMsg ? '#fbbf24' : isMe ? 'var(--gold)' : (msg.teamColor || 'var(--gold)'), paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0, display: 'flex', alignItems: 'center', gap: 4, flexDirection: isMe ? 'row-reverse' : 'row' }}>
                    <img src={teamLogo(msg.team)} style={{ width: 13, height: 13, borderRadius: '50%' }} onError={e => e.target.style.display = 'none'} />
                    <span>{isHostMsg ? '\uD83D\uDC51 ' : ''}{isMe ? 'You' : msg.sender} [{msg.team}]</span>
                    <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 9 }}>{timeStr}</span>
                </div>
              )}
              {/* Bubble */}
              <div style={{ position: 'relative', maxWidth: compact ? '90%' : '82%' }}>
                <div
                  onDoubleClick={() => !isMe && setReactionMenuKey(showReactionMenu ? null : (msg._key || i))}
                  onLongPress={() => !isMe && setReactionMenuKey(msg._key || i)}
                  style={{
                    padding: compact ? '5px 9px' : '7px 11px',
                    fontSize: compact ? 12 : 13,
                    lineHeight: 1.4,
                    background: isHostMsg ? 'rgba(251,191,36,0.18)' : isMe ? 'var(--gold)' : 'var(--bg-card)',
                    color: isMe && !isHostMsg ? '#000' : 'var(--text-primary)',
                    borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                    border: isHostMsg ? '1px solid rgba(251,191,36,0.4)' : isMe ? 'none' : '1px solid var(--border)',
                    wordBreak: 'break-word',
                    cursor: 'default',
                  }}
                >
                  {compact && !isMe && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: msg.teamColor || 'var(--gold)', marginRight: 5 }}>[{msg.team}]</span>
                  )}
                  {msg.text}
                  {compact && (
                    <span style={{ marginLeft: 6, fontSize: 9, color: isMe ? 'rgba(0,0,0,0.5)' : 'var(--text-muted)' }}>{timeStr}</span>
                  )}
                </div>
                {/* Reaction badge */}
                {myReaction && (
                  <div style={{ position: 'absolute', bottom: -10, right: isMe ? 4 : 'auto', left: isMe ? 'auto' : 4, fontSize: 13, background: 'var(--bg-card)', borderRadius: 10, padding: '1px 5px', border: '1px solid var(--border)', zIndex: 2 }}>
                    {myReaction}
                  </div>
                )}
                {/* Reaction picker popup */}
                {showReactionMenu && (
                  <div style={{ position: 'absolute', bottom: '100%', left: isMe ? 'auto' : 0, right: isMe ? 0 : 'auto', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 20, padding: '5px 8px', display: 'flex', gap: 4, zIndex: 50, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', animation: 'slideIn 0.15s ease' }} onClick={e => e.stopPropagation()}>
                    {REACTION_EMOJIS.map(em => (
                      <button key={em} onClick={() => addReaction(msg._key || i, em)} style={{ background: myReaction === em ? 'rgba(242,169,0,0.2)' : 'none', border: 'none', fontSize: 18, cursor: 'pointer', padding: '2px 4px', borderRadius: 8, transform: myReaction === em ? 'scale(1.3)' : 'scale(1)', transition: 'transform 0.1s' }}>{em}</button>
                    ))}
                  </div>
                )}
              </div>
              {/* Quick reaction row (only in full mode, non-self messages) */}
              {!isMe && !compact && (
                <div style={{ display: 'flex', gap: 3, paddingLeft: 4, marginTop: myReaction ? 12 : 2 }}>
                  {['👍', '\uD83D\uDD25', '\uD83D\uDCB0', '😮'].map(em => (
                    <button key={em} onClick={() => addReaction(msg._key || i, em)} style={{ background: myReaction === em ? 'rgba(242,169,0,0.2)' : 'none', border: myReaction === em ? '1px solid var(--gold)' : '1px solid transparent', fontSize: 11, cursor: 'pointer', padding: '1px 4px', borderRadius: 4, opacity: 0.8 }}>{em}</button>
                  ))}
                </div>
              )}
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      {showEmoji && !compact && (
        <div style={{ padding: '8px 10px', borderTop: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 5, background: 'var(--bg-elevated)', maxHeight: 100, overflowY: 'auto', flexShrink: 0 }}>
          {[...QUICK_EMOJIS, ...STICKERS].map((em, i) => (
            <button key={i} onClick={() => setChatInput(prev => prev + em)} style={{ background: 'none', border: 'none', fontSize: 19, cursor: 'pointer', padding: '2px 3px', borderRadius: 4 }}>{em}</button>
          ))}
        </div>
      )}

      {/* Input row */}
      <div style={{ ...CP.inputRow, padding: compact ? '5px 8px' : '8px 10px', gap: compact ? 5 : 7 }}>
        {!compact && (
          <button onClick={() => setShowEmoji(v => !v)} style={{ width: 34, height: 34, borderRadius: 8, background: showEmoji ? 'var(--gold)' : 'var(--bg-elevated)', border: '1px solid var(--border)', fontSize: 16, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: showEmoji ? '#000' : 'inherit' }}>😊</button>
        )}
        <div style={{ flex: 1, position: 'relative' }}>
          <input
            ref={inputRef}
            style={{ ...CP.input, paddingRight: 36, fontSize: compact ? 12 : 13, padding: compact ? '6px 10px' : '8px 12px' }}
            placeholder={compact ? "Chat..." : "Type a message..."}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } e.stopPropagation() }}
            maxLength={200}
          />
          {(inputRef.current?.value?.length || 0) > 150 && !compact && (
            <span style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 9, color: charLeft < 20 ? 'var(--red)' : 'var(--text-muted)', fontFamily: 'monospace' }}>{charLeft}</span>
          )}
        </div>
        <button style={{ ...CP.sendBtn, width: compact ? 30 : 36, height: compact ? 30 : 36, opacity: inputRef.current?.value?.trim() ? 1 : 0.4 }} onClick={() => send()} disabled={!inputRef.current?.value?.trim()}>➤</button>
      </div>
    </div>
  )
});

export default ChatPanel
