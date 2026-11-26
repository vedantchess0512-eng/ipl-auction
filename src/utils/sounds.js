const AudioContextClass = window.AudioContext || window.webkitAudioContext
let ctx = null

function getCtx() {
  if (!ctx) ctx = new AudioContextClass()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

// 🔓 MOBILE AUDIO UNLOCK (IMPORTANT)
export function unlockAudio() {
  try {
    const c = getCtx()
    if (c.state === 'suspended') c.resume()
  } catch (e) {}
}

export function bidSound() {
  try {
    const c = getCtx()
    const o = c.createOscillator()
    const g = c.createGain()

    o.connect(g)
    g.connect(c.destination)

    o.frequency.setValueAtTime(220, c.currentTime)
    o.frequency.linearRampToValueAtTime(440, c.currentTime + 0.1)

    g.gain.setValueAtTime(0.1, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.1)

    o.start()
    o.stop(c.currentTime + 0.1)
  } catch (e) {}
}

export function soldSound() {
  try {
    const c = getCtx()
    const notes = [523.25, 659.25, 783.99]

    notes.forEach((freq, i) => {
      const o = c.createOscillator()
      const g = c.createGain()

      o.connect(g)
      g.connect(c.destination)

      o.frequency.value = freq

      const start = c.currentTime + i * 0.1

      g.gain.setValueAtTime(0, start)
      g.gain.linearRampToValueAtTime(0.12, start)
      g.gain.exponentialRampToValueAtTime(0.01, start + 0.3)

      o.start(start)
      o.stop(start + 0.3)
    })
  } catch (e) {}
}

export function unsoldSound() {
  try {
    const c = getCtx()
    const o = c.createOscillator()
    const g = c.createGain()

    o.connect(g)
    g.connect(c.destination)

    o.frequency.setValueAtTime(440, c.currentTime)
    o.frequency.linearRampToValueAtTime(110, c.currentTime + 0.2)

    g.gain.setValueAtTime(0.1, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.01, c.currentTime + 0.2)

    o.start()
    o.stop(c.currentTime + 0.2)
  } catch (e) {}
}

export function timerTickSound() {
  try {
    const c = getCtx()
    const o = c.createOscillator()
    const g = c.createGain()

    o.connect(g)
    g.connect(c.destination)

    o.frequency.value = 1100

    g.gain.setValueAtTime(0.08, c.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.08)

    o.start()
    o.stop(c.currentTime + 0.08)
  } catch (e) {}
}