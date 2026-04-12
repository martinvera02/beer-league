const ctx = () => new (window.AudioContext || window.webkitAudioContext)()

const play = (fn) => {
  try { fn(ctx()) } catch (e) { console.warn('Audio error:', e) }
}

// 🍺 Añadir consumición — sonido de burbuja festivo
export const soundDrink = () => play((ac) => {
  const t = ac.currentTime

  // Burbuja ascendente
  const osc1 = ac.createOscillator()
  const gain1 = ac.createGain()
  osc1.connect(gain1)
  gain1.connect(ac.destination)
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(300, t)
  osc1.frequency.exponentialRampToValueAtTime(600, t + 0.15)
  gain1.gain.setValueAtTime(0.3, t)
  gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  osc1.start(t)
  osc1.stop(t + 0.25)

  // Pop final
  const osc2 = ac.createOscillator()
  const gain2 = ac.createGain()
  osc2.connect(gain2)
  gain2.connect(ac.destination)
  osc2.type = 'sine'
  osc2.frequency.setValueAtTime(800, t + 0.15)
  osc2.frequency.exponentialRampToValueAtTime(400, t + 0.35)
  gain2.gain.setValueAtTime(0.2, t + 0.15)
  gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.35)
  osc2.start(t + 0.15)
  osc2.stop(t + 0.35)
})

// 🏆 Subir en el ranking — fanfarria corta
export const soundRankUp = () => play((ac) => {
  const notes = [523, 659, 784, 1047]
  notes.forEach((freq, i) => {
    const t = ac.currentTime + i * 0.12
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0.25, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
    osc.start(t)
    osc.stop(t + 0.15)
  })
})

// 💬 Mensaje enviado — click suave
export const soundMessage = () => play((ac) => {
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(880, t)
  osc.frequency.exponentialRampToValueAtTime(1100, t + 0.08)
  gain.gain.setValueAtTime(0.15, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
  osc.start(t)
  osc.stop(t + 0.12)
})

// 💬 Mensaje recibido — tono más grave
export const soundMessageReceived = () => play((ac) => {
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(600, t)
  osc.frequency.exponentialRampToValueAtTime(750, t + 0.1)
  gain.gain.setValueAtTime(0.12, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15)
  osc.start(t)
  osc.stop(t + 0.15)
})

// ❤️ Like — doble pop
export const soundLike = () => play((ac) => {
  [0, 0.1].forEach((delay, i) => {
    const t = ac.currentTime + delay
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type = 'sine'
    osc.frequency.setValueAtTime(i === 0 ? 700 : 900, t)
    osc.frequency.exponentialRampToValueAtTime(i === 0 ? 900 : 1100, t + 0.08)
    gain.gain.setValueAtTime(0.15, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
    osc.start(t)
    osc.stop(t + 0.1)
  })
})

// 🚫 Error / acción denegada — tono descendente
export const soundError = () => play((ac) => {
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(400, t)
  osc.frequency.exponentialRampToValueAtTime(200, t + 0.2)
  gain.gain.setValueAtTime(0.15, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
  osc.start(t)
  osc.stop(t + 0.25)
})

// 🎉 Celebración — acorde festivo
export const soundSuccess = () => play((ac) => {
  const chords = [523, 659, 784]
  chords.forEach((freq, i) => {
    const t = ac.currentTime + i * 0.05
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(0.18, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4)
    osc.start(t)
    osc.stop(t + 0.4)
  })
})

// 🔔 Navegación entre pestañas
export const soundTab = () => play((ac) => {
  const t = ac.currentTime
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  osc.connect(gain)
  gain.connect(ac.destination)
  osc.type = 'sine'
  osc.frequency.setValueAtTime(440, t)
  osc.frequency.exponentialRampToValueAtTime(520, t + 0.06)
  gain.gain.setValueAtTime(0.08, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1)
  osc.start(t)
  osc.stop(t + 0.1)
})