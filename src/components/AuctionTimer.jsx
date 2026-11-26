import React, { useState, useEffect, useRef } from 'react';

// Separate AuctionTimer component to prevent parent re-renders
// Only this component re-renders on timer ticks, not the entire AuctionRoom
function AuctionTimer({ bidTimer, paused, timerEndsAt, onTimerComplete, isHost, room, onUrgencyChange, onTick }) {
  const [timeLeft, setTimeLeft] = useState(bidTimer ?? 15);
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (paused) {
      const frozen = room?.pausedTimeLeft ?? bidTimer ?? 15;
      setTimeLeft(frozen);
      return;
    }

    const tick = () => {
      // If timerEndsAt not set yet, show bidTimer value
      if (!timerEndsAt) {
        if (mountedRef.current) {
          setTimeLeft(bidTimer ?? 15);
        }
        return;
      }

      const rawMs = (timerEndsAt || 0) - Date.now();
      const left = Math.max(0, Math.floor(rawMs / 1000));
      if (mountedRef.current) {
        setTimeLeft(left);
      }

      // Signal parent about urgency (for BID button pulse)
      onUrgencyChange?.(left === 1 && !paused);

      // Notify parent of each tick (for sound sync)
      onTick?.(left);

      // Auto-advance handled by parent
      if (left <= 0 && !paused) {
        onTimerComplete?.();
      }
    };

    // Set initial value first, then run tick and set interval
    setTimeLeft(bidTimer ?? 15);
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [timerEndsAt, paused, bidTimer, isHost, onTimerComplete, onUrgencyChange, onTick, room?.pausedTimeLeft, room?.bidTimer]);

  const displayTime = paused ? (room?.pausedTimeLeft ?? bidTimer ?? 15) : Math.max(0, timeLeft ?? bidTimer ?? 15);
  const timerWidthPct = Math.min(100, (displayTime / (bidTimer || 15)) * 100);

  // Determine if we should show red pulse (only at 1 second or less, and only when not paused)
  const shouldBlink = !paused && displayTime <= 1;

  return (
    <div style={{ position: 'relative', background: 'var(--bg-elevated)', borderRadius: 12, height: 52, overflow: 'hidden', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          height: '100%',
          borderRadius: 12,
          width: `${timerWidthPct}%`,
          background: paused ? '#555' : displayTime <= 3 ? 'var(--red)' : displayTime <= 7 ? 'var(--gold)' : 'var(--green)',
          transition: paused ? 'none' : 'width 0.25s linear, background 0.3s'
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          textAlign: 'center',
          fontFamily: 'var(--font-display)',
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: 1,
          color: '#fff',
          textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          // Only apply pulse animation to timer display when at 1 second
          animation: shouldBlink ? 'pulse 0.6s infinite' : 'none'
        }}
      >
        {paused ? `⏸ ${displayTime}s` : `${displayTime}s`}
      </div>
    </div>
  );
}

export default AuctionTimer;
