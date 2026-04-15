import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerItem } from '../lib/animations'
import { soundLike, soundMessage, soundSuccess, soundError } from '../lib/sounds'

// ─── CONSTANTES RULETA ────────────────────────────────────────────────────────

const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])

const getNumberColor = (n) => {
  if (n === 0) return 'green'
  return REDS.has(n) ? 'red' : 'black'
}

// Orden de los números en la ruleta europea
const WHEEL_ORDER = [
  0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,
  5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26
]

const COLOR_STYLES = {
  red:   { bg: '#dc2626', text: '#fff' },
  black: { bg: '#111827', text: '#fff' },
  green: { bg: '#16a34a', text: '#fff' },
}

// ─── RULETA GRATUITA (sectores de premios) ────────────────────────────────────

const FREE_SEGMENTS = [
  { label: '+2 pts',      emoji: '🍺', color: '#f59e0b', textColor: '#fff' },
  { label: '+50 🪙',      emoji: '🪙', color: '#6366f1', textColor: '#fff' },
  { label: 'Escudo',      emoji: '🛡️', color: '#10b981', textColor: '#fff' },
  { label: '+5 pts',      emoji: '🍺', color: '#ef4444', textColor: '#fff' },
  { label: '+150 🪙',     emoji: '🪙', color: '#8b5cf6', textColor: '#fff' },
  { label: 'Freeze',      emoji: '🧊', color: '#3b82f6', textColor: '#fff' },
  { label: '+2 pts',      emoji: '🍺', color: '#f59e0b', textColor: '#fff' },
  { label: '+300 🪙',     emoji: '🪙', color: '#ec4899', textColor: '#fff' },
  { label: 'Racha Doble', emoji: '🔥', color: '#f97316', textColor: '#fff' },
  { label: '+5 pts',      emoji: '🍺', color: '#ef4444', textColor: '#fff' },
  { label: 'Turbo',       emoji: '⚡', color: '#eab308', textColor: '#fff' },
  { label: '💀 Nada',     emoji: '💀', color: '#374151', textColor: '#9ca3af' },
]

function FreeRouletteWheel({ spinning, targetIndex, onSpinEnd }) {
  const [displayRotation, setDisplayRotation] = useState(0)
  const rotationRef = useRef(0)
  const animRef = useRef(null)

  const TOTAL = FREE_SEGMENTS.length
  const SEGMENT_ANGLE = 360 / TOTAL

  useEffect(() => {
    if (!spinning) return
    const segmentCenter = targetIndex * SEGMENT_ANGLE + SEGMENT_ANGLE / 2
    const targetAngle = 270 - segmentCenter
    const normalized = ((targetAngle % 360) + 360) % 360
    const spins = 5 + Math.floor(Math.random() * 3)
    const finalRotation = rotationRef.current + spins * 360 + normalized - (rotationRef.current % 360)
    const duration = 4000 + Math.random() * 1000
    let startTime = null
    const startRot = rotationRef.current

    const animate = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startRot + (finalRotation - startRot) * eased
      setDisplayRotation(current)
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        rotationRef.current = finalRotation
        setDisplayRotation(finalRotation)
        onSpinEnd()
      }
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [spinning])

  const size = 260
  const cx = size / 2, cy = size / 2, r = size / 2 - 8

  const polarToCartesian = (angle, radius) => {
    const rad = (angle - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const describeArc = (startAngle, endAngle) => {
    const start = polarToCartesian(startAngle, r)
    const end = polarToCartesian(endAngle, r)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', zIndex: 10, fontSize: 24 }}>▼</div>
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', padding: 5,
        boxShadow: '0 0 30px rgba(245,158,11,0.4)',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
          <svg width={size - 10} height={size - 10} viewBox={`0 0 ${size} ${size}`}
            style={{ transform: `rotate(${displayRotation}deg)`, transformOrigin: 'center' }}>
            {FREE_SEGMENTS.map((seg, i) => {
              const startAngle = i * SEGMENT_ANGLE
              const endAngle = (i + 1) * SEGMENT_ANGLE
              const midAngle = startAngle + SEGMENT_ANGLE / 2
              const textPos = polarToCartesian(midAngle, r * 0.62)
              const emojiPos = polarToCartesian(midAngle, r * 0.84)
              return (
                <g key={i}>
                  <path d={describeArc(startAngle, endAngle)} fill={seg.color} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
                  <text x={emojiPos.x} y={emojiPos.y} textAnchor="middle" dominantBaseline="middle" fontSize="13">{seg.emoji}</text>
                  <text x={textPos.x} y={textPos.y} textAnchor="middle" dominantBaseline="middle"
                    fontSize="8.5" fontWeight="bold" fill={seg.textColor}
                    transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}>
                    {seg.label}
                  </text>
                </g>
              )
            })}
            <circle cx={cx} cy={cy} r={20} fill="#1f2937" stroke="#f59e0b" strokeWidth="3" />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="16">🍺</text>
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── RULETA EUROPEA CLÁSICA ───────────────────────────────────────────────────

function EuropeanRouletteWheel({ spinning, targetNumber, onSpinEnd }) {
  const [displayRotation, setDisplayRotation] = useState(0)
  const rotationRef = useRef(0)
  const animRef = useRef(null)

  useEffect(() => {
    if (!spinning || targetNumber === null) return
    const targetIdx = WHEEL_ORDER.indexOf(targetNumber)
    if (targetIdx === -1) return

    const segAngle = 360 / 37
    const segCenter = targetIdx * segAngle + segAngle / 2
    const targetAngle = 270 - segCenter
    const normalized = ((targetAngle % 360) + 360) % 360
    const spins = 6 + Math.floor(Math.random() * 4)
    const finalRotation = rotationRef.current + spins * 360 + normalized - (rotationRef.current % 360)
    const duration = 5000 + Math.random() * 1500
    let startTime = null
    const startRot = rotationRef.current

    const animate = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      const current = startRot + (finalRotation - startRot) * eased
      setDisplayRotation(current)
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate)
      } else {
        rotationRef.current = finalRotation
        setDisplayRotation(finalRotation)
        onSpinEnd()
      }
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [spinning, targetNumber])

  const size = 280
  const cx = size / 2, cy = size / 2, r = size / 2 - 8
  const segAngle = 360 / 37

  const polarToCartesian = (angle, radius) => {
    const rad = (angle - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const describeArc = (startAngle, endAngle) => {
    const start = polarToCartesian(startAngle, r)
    const end = polarToCartesian(endAngle, r)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      {/* Bola indicadora */}
      <div style={{
        position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, width: 14, height: 14, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)',
        boxShadow: '0 2px 6px rgba(0,0,0,0.6)',
      }} />
      {/* Aro dorado */}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'linear-gradient(135deg, #92400e, #d97706, #92400e)', padding: 6,
        boxShadow: '0 0 40px rgba(217,119,6,0.5), inset 0 0 20px rgba(0,0,0,0.3)',
      }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
          <svg width={size - 12} height={size - 12} viewBox={`0 0 ${size} ${size}`}
            style={{ transform: `rotate(${displayRotation}deg)`, transformOrigin: 'center' }}>
            {WHEEL_ORDER.map((num, i) => {
              const startAngle = i * segAngle
              const endAngle = (i + 1) * segAngle
              const midAngle = startAngle + segAngle / 2
              const textPos = polarToCartesian(midAngle, r * 0.78)
              const color = getNumberColor(num)
              const style = COLOR_STYLES[color]
              return (
                <g key={i}>
                  <path d={describeArc(startAngle, endAngle)} fill={style.bg}
                    stroke="rgba(200,150,0,0.4)" strokeWidth="0.8" />
                  <text x={textPos.x} y={textPos.y} textAnchor="middle" dominantBaseline="middle"
                    fontSize="9" fontWeight="bold" fill={style.text}
                    transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}>
                    {num}
                  </text>
                </g>
              )
            })}
            {/* Centro */}
            <circle cx={cx} cy={cy} r={28} fill="#1a0a00" stroke="#d97706" strokeWidth="3" />
            <circle cx={cx} cy={cy} r={20} fill="#2d1500" stroke="#92400e" strokeWidth="2" />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#d97706" fontWeight="bold">
              BEER
            </text>
          </svg>
        </div>
      </div>
    </div>
  )
}

// ─── CASINO COMPONENT ─────────────────────────────────────────────────────────

function Casino() {
  const { user } = useAuth()
  const [casinoTab, setCasinoTab] = useState('free') // free | bet
  const [balance, setBalance] = useState(0)

  // Ruleta gratuita
  const [freeSpinning, setFreeSpinning] = useState(false)
  const [freeTargetIdx, setFreeTargetIdx] = useState(0)
  const [freePrize, setFreePrize] = useState(null)
  const [showFreePrize, setShowFreePrize] = useState(false)
  const [alreadySpun, setAlreadySpun] = useState(false)
  const [spinHistory, setSpinHistory] = useState([])
  const [loadingFree, setLoadingFree] = useState(true)

  // Ruleta de apuestas
  const [betAmount, setBetAmount] = useState(50)
  const [betType, setBetType] = useState(null)
  const [betValue, setBetValue] = useState(null)
  const [betSpinning, setBetSpinning] = useState(false)
  const [betTargetNumber, setBetTargetNumber] = useState(null)
  const [betResult, setBetResult] = useState(null)
  const [showBetResult, setShowBetResult] = useState(false)
  const [betHistory, setBetHistory] = useState([])
  const [loadingBet, setLoadingBet] = useState(true)
  const [numberPicker, setNumberPicker] = useState(false)

  useEffect(() => { fetchBalance() }, [])
  useEffect(() => { if (casinoTab === 'free') fetchFreeData() }, [casinoTab])
  useEffect(() => { if (casinoTab === 'bet') fetchBetData() }, [casinoTab])

  const fetchBalance = async () => {
    const { data } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single()
    setBalance(data?.balance || 0)
  }

  const fetchFreeData = async () => {
    setLoadingFree(true)
    const { data } = await supabase.from('roulette_spins').select('*')
      .eq('user_id', user.id).order('spun_at', { ascending: false }).limit(10)
    setSpinHistory(data || [])
    if (data && data.length > 0) {
      const lastSpin = new Date(data[0].spun_at)
      const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
      const lastMadrid = new Date(lastSpin.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
      setAlreadySpun(lastMadrid.toDateString() === nowMadrid.toDateString())
    } else { setAlreadySpun(false) }
    setLoadingFree(false)
  }

  const fetchBetData = async () => {
    setLoadingBet(true)
    const { data } = await supabase.from('roulette_bets').select('*')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(15)
    setBetHistory(data || [])
    setLoadingBet(false)
  }

  // Mapear prize_label → índice segmento visual
  const FREE_LABEL_MAP = {
    '+2 puntos': 0, '+50 monedas': 1, 'Escudo': 2, '+5 puntos': 3,
    '+150 monedas': 4, 'Freeze': 5, '+300 monedas': 7,
    'Racha Doble': 8, 'Turbo': 10, '¡Mala suerte!': 11,
  }

  const handleFreeSpin = async () => {
    if (freeSpinning || alreadySpun) return
    setFreeSpinning(true)
    setFreePrize(null)
    setShowFreePrize(false)
    const { data } = await supabase.rpc('spin_roulette')
    if (!data?.success) {
      soundError(); setFreeSpinning(false)
      return
    }
    const idx = FREE_LABEL_MAP[data.prize_label] ?? Math.floor(Math.random() * 12)
    setFreeTargetIdx(idx)
    setFreePrize(data)
  }

  const handleFreeSpinEnd = useCallback(() => {
    setFreeSpinning(false)
    setAlreadySpun(true)
    soundSuccess()
    setTimeout(() => { setShowFreePrize(true); fetchFreeData(); fetchBalance() }, 300)
  }, [])

  const handleBetSpin = async () => {
    if (betSpinning || !betType || betAmount < 10 || betAmount > balance) return
    if (betType === 'number' && betValue === null) return
    setBetSpinning(true)
    setBetResult(null)
    setShowBetResult(false)
    const { data } = await supabase.rpc('spin_bet_roulette', {
      p_bet_amount: betAmount,
      p_bet_type: betType,
      p_bet_value: betType === 'number' ? String(betValue) : null,
    })
    if (!data?.success) {
      soundError(); setBetSpinning(false)
      alert(data?.error || 'Error al apostar')
      return
    }
    setBetTargetNumber(data.number)
    setBetResult(data)
    setBalance(data.new_balance)
  }

  const handleBetSpinEnd = useCallback(() => {
    setBetSpinning(false)
    if (betResult?.won) soundSuccess()
    else soundError()
    setTimeout(() => { setShowBetResult(true); fetchBetData() }, 400)
  }, [betResult])

  const formatTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `hace ${days}d`
    if (hours > 0) return `hace ${hours}h`
    if (mins > 0) return `hace ${mins}m`
    return 'ahora'
  }

  const BET_TYPES = [
    { id: 'red',    label: 'Rojo',    emoji: '🔴', payout: 'x2',  desc: '18 números' },
    { id: 'black',  label: 'Negro',   emoji: '⚫', payout: 'x2',  desc: '18 números' },
    { id: 'even',   label: 'Par',     emoji: '2️⃣', payout: 'x2',  desc: '2,4,6...' },
    { id: 'odd',    label: 'Impar',   emoji: '1️⃣', payout: 'x2',  desc: '1,3,5...' },
    { id: 'low',    label: '1-18',    emoji: '⬇️', payout: 'x2',  desc: 'Mitad baja' },
    { id: 'high',   label: '19-36',   emoji: '⬆️', payout: 'x2',  desc: 'Mitad alta' },
    { id: 'dozen1', label: '1ª Doc',  emoji: '🎲', payout: 'x3',  desc: '1-12' },
    { id: 'dozen2', label: '2ª Doc',  emoji: '🎲', payout: 'x3',  desc: '13-24' },
    { id: 'dozen3', label: '3ª Doc',  emoji: '🎲', payout: 'x3',  desc: '25-36' },
    { id: 'col1',   label: 'Col 1',   emoji: '📊', payout: 'x3',  desc: '1,4,7...' },
    { id: 'col2',   label: 'Col 2',   emoji: '📊', payout: 'x3',  desc: '2,5,8...' },
    { id: 'col3',   label: 'Col 3',   emoji: '📊', payout: 'x3',  desc: '3,6,9...' },
    { id: 'number', label: 'Número',  emoji: '🎯', payout: 'x36', desc: 'Pleno' },
  ]

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-6">
      {/* Header */}
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold mb-1">Casino 🎰</h2>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl"
          style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <span className="text-lg">🪙</span>
          <span className="font-bold text-amber-400 text-lg">{balance.toLocaleString()}</span>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex rounded-xl p-1 mb-6" style={{ backgroundColor: 'var(--bg-input)' }}>
        <button onClick={() => setCasinoTab('free')}
          className="relative flex-1 py-2 rounded-lg text-xs font-medium z-10"
          style={{ color: casinoTab === 'free' ? '#fff' : 'var(--text-muted)' }}>
          {casinoTab === 'free' && (
            <motion.div layoutId="casino-tab" className="absolute inset-0 bg-purple-600 rounded-lg"
              style={{ zIndex: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
          )}
          🎡 Ruleta Gratis
        </button>
        <button onClick={() => setCasinoTab('bet')}
          className="relative flex-1 py-2 rounded-lg text-xs font-medium z-10"
          style={{ color: casinoTab === 'bet' ? '#fff' : 'var(--text-muted)' }}>
          {casinoTab === 'bet' && (
            <motion.div layoutId="casino-tab" className="absolute inset-0 rounded-lg"
              style={{ zIndex: -1, backgroundColor: '#b91c1c' }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
          )}
          🎰 Ruleta Apuestas
        </button>
      </div>

      {/* ── RULETA GRATUITA ── */}
      {casinoTab === 'free' && (
        <>
          <p className="text-center text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            Una tirada gratis al día · Gana puntos, monedas o powerups
          </p>

          {loadingFree ? (
            <div className="text-center py-10">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-4xl mb-2">🎡</motion.div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <FreeRouletteWheel spinning={freeSpinning} targetIndex={freeTargetIdx} onSpinEnd={handleFreeSpinEnd} />
              </div>

              {alreadySpun && !freeSpinning ? (
                <div className="rounded-2xl p-4 mb-5 text-center"
                  style={{ backgroundColor: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}>
                  <p className="text-sm font-bold text-purple-400">✅ Ya has girado hoy</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Vuelve mañana para otra tirada gratis</p>
                </div>
              ) : (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleFreeSpin}
                  disabled={freeSpinning || alreadySpun}
                  className="w-full py-4 rounded-2xl font-bold text-white text-base mb-5 relative overflow-hidden"
                  style={{ backgroundColor: freeSpinning ? '#4c1d95' : '#7c3aed' }}>
                  {freeSpinning ? (
                    <div className="flex items-center justify-center gap-2">
                      <motion.span animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}>🎡</motion.span>
                      Girando...
                    </div>
                  ) : '🎡 ¡Girar gratis!'}
                  {!freeSpinning && (
                    <motion.div className="absolute inset-0"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }}
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
                  )}
                </motion.button>
              )}

              <AnimatePresence>
                {showFreePrize && freePrize && (
                  <motion.div initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="rounded-2xl p-5 mb-5 text-center"
                    style={{
                      backgroundColor: freePrize.prize_type === 'nothing' ? 'rgba(55,65,81,0.5)' : 'rgba(124,58,237,0.15)',
                      border: `2px solid ${freePrize.prize_type === 'nothing' ? '#374151' : '#7c3aed'}`,
                    }}>
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5 }} className="text-5xl mb-2">
                      {freePrize.prize_emoji}
                    </motion.div>
                    <p className="text-lg font-bold" style={{ color: freePrize.prize_type === 'nothing' ? '#9ca3af' : '#c084fc' }}>
                      {freePrize.prize_label}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                      {freePrize.prize_type === 'points' ? 'Puntos añadidos en todas tus ligas' :
                       freePrize.prize_type === 'coins' ? 'Monedas añadidas a tu monedero' :
                       freePrize.prize_type === 'powerup' ? 'Powerup añadido a tu inventario' : 'Más suerte la próxima vez'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Tabla premios */}
              <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: 'var(--bg-card)' }}>
                <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>Tabla de premios</p>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { emoji: '🍺', label: '+2 pts', prob: '20%', color: '#f59e0b' },
                    { emoji: '🍺', label: '+5 pts', prob: '15%', color: '#f59e0b' },
                    { emoji: '🪙', label: '+50🪙', prob: '15%', color: '#6366f1' },
                    { emoji: '🪙', label: '+150🪙', prob: '10%', color: '#8b5cf6' },
                    { emoji: '🪙', label: '+300🪙', prob: '8%', color: '#ec4899' },
                    { emoji: '🔥', label: 'Racha x2', prob: '8%', color: '#f97316' },
                    { emoji: '🛡️', label: 'Escudo', prob: '7%', color: '#10b981' },
                    { emoji: '🧊', label: 'Freeze', prob: '7%', color: '#3b82f6' },
                    { emoji: '⚡', label: 'Turbo', prob: '5%', color: '#eab308' },
                    { emoji: '💣', label: 'Sabotaje', prob: '3%', color: '#ef4444' },
                    { emoji: '🎯', label: 'Sniper', prob: '1%', color: '#a855f7' },
                    { emoji: '💀', label: 'Nada', prob: '1%', color: '#6b7280' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg"
                      style={{ backgroundColor: 'var(--bg-input)' }}>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{item.emoji}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                      </div>
                      <span className="text-xs font-bold" style={{ color: item.color }}>{item.prob}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Historial gratuita */}
              {spinHistory.length > 0 && (
                <div>
                  <p className="text-sm font-bold mb-3">Últimas tiradas</p>
                  <div className="space-y-2">
                    {spinHistory.map(spin => (
                      <motion.div key={spin.id} variants={staggerItem} initial="initial" animate="animate"
                        className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                        <span className="text-2xl">{spin.prize_emoji}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{spin.prize_label}</p>
                          <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatTime(spin.spun_at)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ── RULETA DE APUESTAS ── */}
      {casinoTab === 'bet' && (
        <>
          <p className="text-center text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
            Ruleta europea clásica · Sin límite de tiradas
          </p>

          {/* Ruleta */}
          <div className="mb-5">
            <EuropeanRouletteWheel
              spinning={betSpinning}
              targetNumber={betTargetNumber}
              onSpinEnd={handleBetSpinEnd}
            />
          </div>

          {/* Resultado */}
          <AnimatePresence>
            {showBetResult && betResult && (
              <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="rounded-2xl p-5 mb-5 text-center"
                style={{
                  backgroundColor: betResult.won ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `2px solid ${betResult.won ? '#10b981' : '#ef4444'}`,
                }}>
                {/* Número resultado */}
                <div className="flex justify-center mb-3">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black"
                    style={COLOR_STYLES[betResult.color]}>
                    {betResult.number}
                  </div>
                </div>
                <motion.p className="text-xl font-bold mb-1"
                  animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.4 }}
                  style={{ color: betResult.won ? '#10b981' : '#ef4444' }}>
                  {betResult.won ? '¡GANASTE! 🎉' : '¡PERDISTE! 😬'}
                </motion.p>
                {betResult.won ? (
                  <>
                    <p className="text-2xl font-black text-emerald-400">+{betResult.payout}🪙</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                      Multiplicador x{betResult.multiplier} · Neto +{betResult.net}🪙
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-bold text-red-400">-{betResult.bet_amount || betAmount}🪙</p>
                )}
                <p className="text-xs mt-2" style={{ color: 'var(--text-hint)' }}>
                  Saldo actual: {betResult.new_balance.toLocaleString()}🪙
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cantidad a apostar */}
          <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold">Apuesta</p>
              <p className="font-bold text-amber-400">{betAmount}🪙</p>
            </div>
            <input type="range" min="10" max={Math.min(balance, 5000)} step="10"
              value={betAmount} onChange={e => setBetAmount(Number(e.target.value))}
              className="w-full accent-red-600 mb-2" />
            <div className="flex gap-2">
              {[50, 100, 250, 500, 1000].filter(v => v <= balance).map(v => (
                <motion.button key={v} whileTap={{ scale: 0.9 }} onClick={() => setBetAmount(v)}
                  className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                  style={{ backgroundColor: betAmount === v ? '#b91c1c' : 'var(--bg-input)', color: betAmount === v ? '#fff' : 'var(--text-muted)' }}>
                  {v}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Tipo de apuesta */}
          <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm font-bold mb-3">Tipo de apuesta</p>
            <div className="grid grid-cols-3 gap-2">
              {BET_TYPES.map(bt => (
                <motion.button key={bt.id} whileTap={{ scale: 0.93 }}
                  onClick={() => {
                    setBetType(bt.id)
                    if (bt.id !== 'number') setBetValue(null)
                    if (bt.id === 'number') setNumberPicker(true)
                  }}
                  className="rounded-xl p-2.5 text-center"
                  style={{
                    backgroundColor: betType === bt.id ? 'rgba(185,28,28,0.25)' : 'var(--bg-input)',
                    border: betType === bt.id ? '2px solid #b91c1c' : '2px solid transparent',
                  }}>
                  <div className="text-xl mb-0.5">{bt.emoji}</div>
                  <p className="text-xs font-bold" style={{ color: betType === bt.id ? '#fca5a5' : 'var(--text-primary)' }}>
                    {bt.label}
                  </p>
                  <p className="text-xs font-black" style={{ color: '#fbbf24' }}>{bt.payout}</p>
                </motion.button>
              ))}
            </div>

            {/* Selector de número */}
            {betType === 'number' && (
              <div className="mt-3">
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Número elegido: {betValue !== null ? (
                    <span className="font-black text-sm" style={COLOR_STYLES[getNumberColor(betValue)]}>
                      {' '}{betValue}
                    </span>
                  ) : <span style={{ color: 'var(--text-hint)' }}> ninguno</span>}
                </p>
                <div className="grid grid-cols-9 gap-1 max-h-44 overflow-y-auto">
                  {/* 0 */}
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setBetValue(0)}
                    className="aspect-square rounded-lg flex items-center justify-center text-xs font-bold col-span-9"
                    style={{ backgroundColor: betValue === 0 ? '#16a34a' : '#166534', color: '#fff', height: 28 }}>
                    0
                  </motion.button>
                  {/* 1-36 */}
                  {Array.from({ length: 36 }, (_, i) => i + 1).map(n => {
                    const color = getNumberColor(n)
                    return (
                      <motion.button key={n} whileTap={{ scale: 0.9 }} onClick={() => setBetValue(n)}
                        className="aspect-square rounded-lg flex items-center justify-center text-xs font-bold"
                        style={{
                          backgroundColor: betValue === n
                            ? '#fbbf24'
                            : color === 'red' ? '#991b1b' : '#111827',
                          color: betValue === n ? '#000' : '#fff',
                          border: betValue === n ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)',
                          minHeight: 28,
                        }}>
                        {n}
                      </motion.button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Resumen apuesta */}
          {betType && (
            <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: 'var(--text-muted)' }}>Apuesta</span>
                <span className="font-bold">{betAmount}🪙</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span style={{ color: 'var(--text-muted)' }}>Tipo</span>
                <span className="font-medium">{BET_TYPES.find(b => b.id === betType)?.label}
                  {betType === 'number' && betValue !== null ? ` (${betValue})` : ''}
                </span>
              </div>
              <div className="flex justify-between text-sm border-t pt-1 mt-1" style={{ borderColor: 'var(--border)' }}>
                <span className="font-bold">Si ganas recibes</span>
                <span className="font-black text-emerald-400">
                  {betAmount * parseInt(BET_TYPES.find(b => b.id === betType)?.payout?.replace('x', '') || 1)}🪙
                </span>
              </div>
            </div>
          )}

          {/* Botón girar */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleBetSpin}
            disabled={betSpinning || !betType || betAmount > balance || betAmount < 10 || (betType === 'number' && betValue === null)}
            className="w-full py-4 rounded-2xl font-bold text-white text-base mb-6 relative overflow-hidden"
            style={{ backgroundColor: betSpinning ? '#7f1d1d' : '#b91c1c', opacity: (!betType || betAmount > balance) ? 0.5 : 1 }}>
            {betSpinning ? (
              <div className="flex items-center justify-center gap-2">
                <motion.div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent"
                  animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />
                Girando...
              </div>
            ) : !betType ? '← Elige tipo de apuesta'
              : betAmount > balance ? 'Saldo insuficiente'
              : betType === 'number' && betValue === null ? '← Elige un número'
              : `🎰 Apostar ${betAmount}🪙`}
            {!betSpinning && betType && betAmount <= balance && (
              <motion.div className="absolute inset-0"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
            )}
          </motion.button>

          {/* Historial apuestas */}
          {betHistory.length > 0 && (
            <div>
              <p className="text-sm font-bold mb-3">Historial de apuestas</p>
              <div className="space-y-2">
                {betHistory.map(bet => (
                  <motion.div key={bet.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                    {/* Número resultado */}
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                      style={COLOR_STYLES[bet.result_color]}>
                      {bet.result_number}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {BET_TYPES.find(b => b.id === bet.bet_type)?.label}
                        {bet.bet_type === 'number' && bet.bet_value ? ` · ${bet.bet_value}` : ''}
                        {' · '}{bet.bet_amount}🪙
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatTime(bet.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-black ${bet.won ? 'text-emerald-400' : 'text-red-400'}`}>
                        {bet.won ? `+${bet.net}🪙` : `-${bet.bet_amount}🪙`}
                      </p>
                      {bet.won && <p className="text-xs text-amber-400">x{bet.payout / bet.bet_amount}</p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── SOCIAL PRINCIPAL ─────────────────────────────────────────────────────────

export default function Social() {
  const { user } = useAuth()
  const [tab, setTab] = useState('feed')
  const [posts, setPosts] = useState([])
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [showNewPost, setShowNewPost] = useState(false)
  const [newPostContent, setNewPostContent] = useState('')
  const [newPostImage, setNewPostImage] = useState(null)
  const [newPostPreview, setNewPostPreview] = useState(null)
  const [uploadingPost, setUploadingPost] = useState(false)
  const [uploadingStory, setUploadingStory] = useState(false)
  const [selectedStory, setSelectedStory] = useState(null)
  const [openComments, setOpenComments] = useState(null)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState([])
  const [sendingComment, setSendingComment] = useState(false)
  const postImageRef = useRef(null)
  const storyImageRef = useRef(null)
  const textareaRef = useRef(null)
  const commentsBottomRef = useRef(null)

  useEffect(() => { fetchFeed() }, [])

  useEffect(() => {
    if (showNewPost && textareaRef.current)
      setTimeout(() => textareaRef.current?.focus(), 100)
  }, [showNewPost])

  useEffect(() => {
    if (!openComments) return
    const channel = supabase.channel(`comments:${openComments.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'post_comments', filter: `post_id=eq.${openComments.id}` },
        async (payload) => {
          const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.user_id).single()
          setComments(prev => [...prev, { ...payload.new, profiles: profile }])
          setTimeout(() => commentsBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
        })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [openComments])

  const fetchFeed = async () => {
    setLoading(true)
    const [{ data: postsData }, { data: storiesData }] = await Promise.all([
      supabase.from('posts').select('*, profiles(username, avatar_url), post_likes(user_id), post_comments(id)')
        .order('created_at', { ascending: false }).limit(50),
      supabase.from('stories').select('*, profiles(username, avatar_url)')
        .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
    ])
    setPosts(postsData || [])
    setStories(storiesData || [])
    setLoading(false)
  }

  const handlePostImageSelect = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setNewPostImage(file)
    setNewPostPreview(URL.createObjectURL(file))
  }

  const submitPost = async () => {
    if (!newPostContent.trim() && !newPostImage) return
    setUploadingPost(true)
    let imageUrl = null
    if (newPostImage) {
      const ext = newPostImage.name.split('.').pop()
      const path = `${user.id}/posts/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('social').upload(path, newPostImage)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('social').getPublicUrl(path)
        imageUrl = publicUrl
      }
    }
    await supabase.from('posts').insert({ user_id: user.id, content: newPostContent.trim(), image_url: imageUrl })
    closeNewPost()
    setUploadingPost(false)
    fetchFeed()
  }

  const submitStory = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingStory(true)
    const ext = file.name.split('.').pop()
    const path = `${user.id}/stories/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('social').upload(path, file)
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from('social').getPublicUrl(path)
      await supabase.from('stories').insert({ user_id: user.id, image_url: publicUrl })
      fetchFeed()
    }
    setUploadingStory(false)
    e.target.value = ''
  }

  const toggleLike = async (post) => {
    const alreadyLiked = post.post_likes?.some(l => l.user_id === user.id)
    if (!alreadyLiked) soundLike()
    if (alreadyLiked) await supabase.from('post_likes').delete().eq('post_id', post.id).eq('user_id', user.id)
    else await supabase.from('post_likes').insert({ post_id: post.id, user_id: user.id })
    fetchFeed()
  }

  const deletePost = async (postId) => { await supabase.from('posts').delete().eq('id', postId); fetchFeed() }

  const openCommentsPanel = async (post) => {
    setOpenComments(post); setCommentText('')
    const { data } = await supabase.from('post_comments').select('*, profiles(username, avatar_url)')
      .eq('post_id', post.id).order('created_at', { ascending: true })
    setComments(data || [])
  }

  const closeCommentsPanel = () => { setOpenComments(null); setComments([]); setCommentText('') }

  const submitComment = async () => {
    if (!commentText.trim() || !openComments || sendingComment) return
    setSendingComment(true)
    soundMessage()
    const { error } = await supabase.from('post_comments').insert({ post_id: openComments.id, user_id: user.id, content: commentText.trim() })
    if (!error) { setCommentText(''); fetchFeed() }
    setSendingComment(false)
  }

  const handleCommentKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }
  const closeNewPost = () => { setShowNewPost(false); setNewPostContent(''); setNewPostImage(null); setNewPostPreview(null) }

  const formatTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `hace ${days}d`
    if (hours > 0) return `hace ${hours}h`
    if (mins > 0) return `hace ${mins}m`
    return 'ahora'
  }

  const Avatar = ({ url, username, size = 'sm' }) => {
    const dim = size === 'sm' ? 'w-9 h-9' : 'w-12 h-12'
    return url
      ? <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
      : <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 text-lg`} style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
  }

  const storiesByUser = stories.reduce((acc, s) => {
    if (!acc[s.user_id]) acc[s.user_id] = { profile: s.profiles, stories: [] }
    acc[s.user_id].stories.push(s)
    return acc
  }, {})

  const canPublish = (newPostContent.trim().length > 0 || newPostImage !== null) && !uploadingPost

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      <div className="px-4 pt-6 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-2xl font-bold mb-4">Social 🍻</h1>
        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
          {[
            { id: 'feed',    label: '📰 Feed' },
            { id: 'stories', label: '⭕ Historias' },
            { id: 'casino',  label: '🎰 Casino' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10"
              style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {tab === t.id && (
                <motion.div layoutId="social-tab" className="absolute inset-0 rounded-lg"
                  style={{ zIndex: -1, backgroundColor: t.id === 'casino' ? '#7c3aed' : '#f59e0b' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── FEED ── */}
      {tab === 'feed' && (
        <div className="max-w-md mx-auto px-4 pt-4">
          {Object.keys(storiesByUser).length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-3 mb-4">
              {Object.values(storiesByUser).map(({ profile, stories: userStories }) => (
                <motion.button key={userStories[0].user_id} whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedStory(userStories[0])}
                  className="flex flex-col items-center gap-1 flex-shrink-0">
                  <div className="p-0.5 rounded-full bg-gradient-to-tr from-amber-400 to-amber-600">
                    <div className="p-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-base)' }}>
                      <Avatar url={profile?.avatar_url} username={profile?.username} size="sm" />
                    </div>
                  </div>
                  <span className="text-xs truncate w-14 text-center" style={{ color: 'var(--text-muted)' }}>{profile?.username}</span>
                </motion.button>
              ))}
            </div>
          )}
          <motion.div {...fadeIn} className="rounded-2xl p-3 mb-4 flex items-center gap-3 cursor-pointer"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}
            onClick={() => setShowNewPost(true)}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg" style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
            <div className="flex-1 rounded-xl px-4 py-2.5 text-sm" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' }}>¿Qué estás bebiendo?</div>
          </motion.div>
          {loading ? <p className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Cargando feed...</p>
            : posts.length === 0 ? (
              <motion.div {...fadeIn} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <div className="text-5xl mb-3">📰</div><p>Aún no hay posts</p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => {
                  const isMe = post.user_id === user.id
                  const liked = post.post_likes?.some(l => l.user_id === user.id)
                  return (
                    <motion.div key={post.id} variants={staggerItem} initial="initial" animate="animate"
                      className="rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <div className="flex items-center gap-3 p-4 pb-3">
                        <Avatar url={post.profiles?.avatar_url} username={post.profiles?.username} />
                        <div className="flex-1">
                          <p className="font-bold text-sm">{post.profiles?.username}</p>
                          <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatTime(post.created_at)}</p>
                        </div>
                        {isMe && <motion.button whileTap={{ scale: 0.9 }} onClick={() => deletePost(post.id)} className="text-lg" style={{ color: 'var(--text-hint)' }}>🗑️</motion.button>}
                      </div>
                      {post.content && <p className="px-4 pb-3 text-sm leading-relaxed">{post.content}</p>}
                      {post.image_url && <img src={post.image_url} alt="Post" className="w-full object-cover max-h-80" />}
                      <div className="flex items-center gap-4 px-4 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        <motion.button whileTap={{ scale: 0.8 }} onClick={() => toggleLike(post)} className="flex items-center gap-1.5 text-sm">
                          <motion.span animate={liked ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }} className="text-xl">{liked ? '🍺' : '🤍'}</motion.span>
                          <span style={{ color: liked ? '#f59e0b' : 'var(--text-muted)' }}>{post.post_likes?.length || 0}</span>
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => openCommentsPanel(post)} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--text-muted)' }}>
                          <span className="text-xl">💬</span><span>{post.post_comments?.length || 0}</span>
                        </motion.button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
        </div>
      )}

      {/* ── HISTORIAS ── */}
      {tab === 'stories' && (
        <div className="max-w-md mx-auto px-4 pt-4">
          <motion.button whileTap={{ scale: 0.96 }} onClick={() => storyImageRef.current?.click()} disabled={uploadingStory}
            className="w-full border-2 border-dashed rounded-2xl py-6 flex flex-col items-center gap-2 mb-6"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
            <span className="text-3xl">{uploadingStory ? '⏳' : '⭕'}</span>
            <span className="text-sm">{uploadingStory ? 'Subiendo...' : 'Añadir historia'}</span>
            <span className="text-xs" style={{ color: 'var(--text-hint)' }}>Desaparece en 24 horas</span>
          </motion.button>
          <input ref={storyImageRef} type="file" accept="image/*" onChange={submitStory} className="hidden" />
          {Object.keys(storiesByUser).length === 0 ? (
            <motion.div {...fadeIn} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">⭕</div><p>No hay historias activas</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {Object.values(storiesByUser).map(({ profile, stories: userStories }) => (
                <motion.button key={userStories[0].user_id} variants={staggerItem} initial="initial" animate="animate"
                  whileTap={{ scale: 0.95 }} onClick={() => setSelectedStory(userStories[0])}
                  className="relative rounded-2xl overflow-hidden aspect-[3/4]" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <img src={userStories[0].image_url} alt="Historia" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                    <Avatar url={profile?.avatar_url} username={profile?.username} size="sm" />
                    <span className="text-xs font-semibold text-white truncate">{profile?.username}</span>
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CASINO ── */}
      {tab === 'casino' && <Casino />}

      {/* Botón flotante */}
      {tab === 'feed' && (
        <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }}
          onClick={() => setShowNewPost(true)}
          className="fixed bottom-24 right-5 w-14 h-14 bg-amber-500 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-40">
          ✏️
        </motion.button>
      )}

      {/* Modal nuevo post */}
      <AnimatePresence>
        {showNewPost && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col justify-end"
            style={{ backgroundColor: 'rgba(0,0,0,0.75)' }} onClick={closeNewPost}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="flex flex-col rounded-t-3xl w-full max-w-lg mx-auto"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '90vh' }}>
              <div className="flex items-center justify-between px-5 pt-5 pb-3 flex-shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={closeNewPost} className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>Cancelar</motion.button>
                <h2 className="text-base font-bold">Nuevo post</h2>
                <motion.button whileTap={{ scale: 0.95 }} onClick={submitPost} disabled={!canPublish}
                  className="px-4 py-2 rounded-full text-sm font-bold"
                  style={{ backgroundColor: canPublish ? '#f59e0b' : 'var(--bg-input)', color: canPublish ? '#fff' : 'var(--text-hint)' }}>
                  {uploadingPost ? '...' : 'Publicar'}
                </motion.button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pt-4">
                <div className="flex gap-3 mb-4">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-lg mt-1" style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
                  <textarea ref={textareaRef} value={newPostContent} onChange={e => setNewPostContent(e.target.value)}
                    placeholder="¿Qué estás bebiendo? 🍺" rows={5}
                    className="flex-1 outline-none resize-none text-sm bg-transparent leading-relaxed"
                    style={{ color: 'var(--text-primary)' }} />
                </div>
                {newPostPreview && (
                  <div className="relative mb-4 ml-12">
                    <img src={newPostPreview} alt="Preview" className="w-full rounded-2xl max-h-52 object-cover" />
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => { setNewPostImage(null); setNewPostPreview(null) }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm">✕</motion.button>
                  </div>
                )}
              </div>
              <div className="flex-shrink-0 border-t px-5 py-3 flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => postImageRef.current?.click()} style={{ color: '#f59e0b' }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                    <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" clipRule="evenodd" />
                  </svg>
                </motion.button>
                <input ref={postImageRef} type="file" accept="image/*" onChange={handlePostImageSelect} className="hidden" />
                <p className="text-xs ml-auto" style={{ color: 'var(--text-hint)' }}>{newPostContent.length > 0 && `${newPostContent.length} caracteres`}</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Visor historia */}
      <AnimatePresence>
        {selectedStory && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center" onClick={() => setSelectedStory(null)}>
            <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} src={selectedStory.image_url} alt="Historia" className="w-full h-full object-contain" />
            <div className="absolute top-6 left-4 flex items-center gap-2">
              <Avatar url={selectedStory.profiles?.avatar_url} username={selectedStory.profiles?.username} />
              <div><p className="text-white font-bold text-sm">{selectedStory.profiles?.username}</p><p className="text-gray-300 text-xs">{formatTime(selectedStory.created_at)}</p></div>
            </div>
            <button onClick={() => setSelectedStory(null)} className="absolute top-6 right-4 text-white text-2xl">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Panel comentarios */}
      <AnimatePresence>
        {openComments && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50" style={{ backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end' }}
            onClick={closeCommentsPanel}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', width: '100%', borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column', height: '80vh' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
                <p style={{ fontWeight: 'bold', fontSize: 16 }}>Comentarios {comments.length > 0 && <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 'normal', backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', padding: '2px 8px', borderRadius: 999 }}>{comments.length}</span>}</p>
                <button onClick={closeCommentsPanel} style={{ width: 28, height: 28, borderRadius: '50%', border: 'none', cursor: 'pointer', backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13 }}>✕</button>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
                {comments.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div><p style={{ fontSize: 14 }}>Sin comentarios todavía</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {comments.map(comment => {
                      const isMe = comment.user_id === user.id
                      return (
                        <motion.div key={comment.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ display: 'flex', gap: 10 }}>
                          <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, backgroundColor: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                            {comment.profiles?.avatar_url ? <img src={comment.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /> : <span style={{ fontSize: 18 }}>🍺</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ borderRadius: '4px 16px 16px 16px', padding: '10px 14px', backgroundColor: isMe ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)' }}>
                              <p style={{ fontSize: 12, fontWeight: 'bold', marginBottom: 4, color: isMe ? '#f59e0b' : 'var(--text-primary)' }}>{comment.profiles?.username} {isMe && '(tú)'}</p>
                              <p style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.5 }}>{comment.content}</p>
                            </div>
                            <p style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4, marginLeft: 4 }}>{formatTime(comment.created_at)}</p>
                          </div>
                        </motion.div>
                      )
                    })}
                    <div ref={commentsBottomRef} />
                  </div>
                )}
              </div>
              <div style={{ flexShrink: 0, borderTop: '1px solid var(--border)', padding: '12px 16px 80px 16px', display: 'flex', gap: 10, alignItems: 'flex-end', backgroundColor: 'var(--bg-card)' }}>
                <textarea value={commentText} onChange={e => setCommentText(e.target.value)} onKeyDown={handleCommentKeyDown}
                  placeholder="Escribe un comentario..." rows={1}
                  style={{ flex: 1, borderRadius: 20, padding: '10px 16px', backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: 'none', outline: 'none', resize: 'none', fontSize: 14, maxHeight: 80, fontFamily: 'inherit', lineHeight: 1.5 }} />
                <motion.button whileTap={{ scale: 0.9 }} onClick={submitComment} disabled={!commentText.trim() || sendingComment}
                  style={{ width: 44, height: 44, borderRadius: '50%', flexShrink: 0, border: 'none', cursor: 'pointer', backgroundColor: commentText.trim() && !sendingComment ? '#f59e0b' : 'var(--bg-input)', color: commentText.trim() && !sendingComment ? '#fff' : 'var(--text-hint)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: !commentText.trim() || sendingComment ? 0.5 : 1 }}>
                  {sendingComment
                    ? <motion.div style={{ width: 18, height: 18, border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" style={{ width: 18, height: 18 }}><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}