import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { staggerItem, fadeIn } from '../lib/animations'
import { soundSuccess, soundError } from '../lib/sounds'
import SeasonCountdown from '../components/SeasonCountdown'
import SeasonHistory from '../components/SeasonHistory'
import Market from './Market'
import StockMarket from './StockMarket'

// ─── CONSTANTES RULETA ────────────────────────────────────────────────────────
const REDS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36])
const getNumberColor = (n) => { if (n === 0) return 'green'; return REDS.has(n) ? 'red' : 'black' }
const WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26]
const COLOR_STYLES = { red: { bg: '#dc2626', text: '#fff' }, black: { bg: '#111827', text: '#fff' }, green: { bg: '#16a34a', text: '#fff' } }

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
const FREE_LABEL_MAP = { '+2 puntos': 0, '+50 monedas': 1, 'Escudo': 2, '+5 puntos': 3, '+150 monedas': 4, 'Freeze': 5, '+300 monedas': 7, 'Racha Doble': 8, 'Turbo': 10, '¡Mala suerte!': 11 }
const FREE_POWERUP_MAP = { 'shield': 2, 'freeze': 5, 'double_points': 8, 'turbo': 10, 'sabotage': 11, 'sniper': 9 }

function calcFinalRotation(currentRotation, targetIndex, totalSegments, extraSpins = 6) {
  const segAngle = 360 / totalSegments
  const segCenter = targetIndex * segAngle + segAngle / 2
  const targetOffset = (360 - segCenter % 360) % 360
  const currentNorm = ((currentRotation % 360) + 360) % 360
  let delta = targetOffset - currentNorm
  if (delta < 0) delta += 360
  return currentRotation + extraSpins * 360 + delta
}

function FreeRouletteWheel({ spinning, targetIndex, onSpinEnd }) {
  const [displayRotation, setDisplayRotation] = useState(0)
  const rotationRef = useRef(0)
  const animRef = useRef(null)

  useEffect(() => {
    if (!spinning) return
    cancelAnimationFrame(animRef.current)
    const finalRotation = calcFinalRotation(rotationRef.current, targetIndex, FREE_SEGMENTS.length, 5 + Math.floor(Math.random() * 3))
    const duration = 4000 + Math.random() * 800
    let startTime = null
    const startRot = rotationRef.current
    const animate = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startRot + (finalRotation - startRot) * eased
      setDisplayRotation(current)
      if (progress < 1) { animRef.current = requestAnimationFrame(animate) }
      else { rotationRef.current = finalRotation; setDisplayRotation(finalRotation); onSpinEnd() }
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [spinning, targetIndex])

  const size = 260, cx = size / 2, cy = size / 2, r = size / 2 - 8
  const SEGMENT_ANGLE = 360 / FREE_SEGMENTS.length
  const polarToCartesian = (angle, radius) => {
    const rad = (angle - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }
  const describeArc = (startAngle, endAngle) => {
    const start = polarToCartesian(startAngle, r)
    const end = polarToCartesian(endAngle, r)
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <div style={{ position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', zIndex: 10, fontSize: 24 }}>▼</div>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', padding: 5, boxShadow: '0 0 30px rgba(245,158,11,0.4)' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
          <svg width={size - 10} height={size - 10} viewBox={`0 0 ${size} ${size}`}
            style={{ transform: `rotate(${displayRotation}deg)`, transformOrigin: 'center' }}>
            {FREE_SEGMENTS.map((seg, i) => {
              const startAngle = i * SEGMENT_ANGLE, endAngle = (i + 1) * SEGMENT_ANGLE, midAngle = startAngle + SEGMENT_ANGLE / 2
              const textPos = polarToCartesian(midAngle, r * 0.62), emojiPos = polarToCartesian(midAngle, r * 0.84)
              return (
                <g key={i}>
                  <path d={describeArc(startAngle, endAngle)} fill={seg.color} stroke="rgba(0,0,0,0.12)" strokeWidth="1" />
                  <text x={emojiPos.x} y={emojiPos.y} textAnchor="middle" dominantBaseline="middle" fontSize="13">{seg.emoji}</text>
                  <text x={textPos.x} y={textPos.y} textAnchor="middle" dominantBaseline="middle" fontSize="8.5" fontWeight="bold" fill={seg.textColor} transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}>{seg.label}</text>
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

function EuropeanRouletteWheel({ spinning, targetNumber, onSpinEnd }) {
  const [displayRotation, setDisplayRotation] = useState(0)
  const rotationRef = useRef(0)
  const animRef = useRef(null)

  useEffect(() => {
    if (!spinning || targetNumber === null) return
    cancelAnimationFrame(animRef.current)
    const targetIdx = WHEEL_ORDER.indexOf(targetNumber)
    if (targetIdx === -1) return
    const finalRotation = calcFinalRotation(rotationRef.current, targetIdx, 37, 6 + Math.floor(Math.random() * 4))
    const duration = 5000 + Math.random() * 1500
    let startTime = null
    const startRot = rotationRef.current
    const animate = (ts) => {
      if (!startTime) startTime = ts
      const progress = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      const current = startRot + (finalRotation - startRot) * eased
      setDisplayRotation(current)
      if (progress < 1) { animRef.current = requestAnimationFrame(animate) }
      else { rotationRef.current = finalRotation; setDisplayRotation(finalRotation); onSpinEnd() }
    }
    animRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(animRef.current)
  }, [spinning, targetNumber])

  const size = 280, cx = size / 2, cy = size / 2, r = size / 2 - 8, segAngle = 360 / 37
  const polarToCartesian = (angle, radius) => {
    const rad = (angle - 90) * Math.PI / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }
  const describeArc = (startAngle, endAngle) => {
    const start = polarToCartesian(startAngle, r), end = polarToCartesian(endAngle, r)
    return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`
  }

  return (
    <div style={{ position: 'relative', width: size, height: size, margin: '0 auto' }}>
      <div style={{ position: 'absolute', top: -16, left: '50%', transform: 'translateX(-50%)', zIndex: 10, width: 14, height: 14, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #fff, #ccc)', boxShadow: '0 2px 6px rgba(0,0,0,0.6)' }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'linear-gradient(135deg, #92400e, #d97706, #92400e)', padding: 6, boxShadow: '0 0 40px rgba(217,119,6,0.5)' }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden' }}>
          <svg width={size - 12} height={size - 12} viewBox={`0 0 ${size} ${size}`}
            style={{ transform: `rotate(${displayRotation}deg)`, transformOrigin: 'center' }}>
            {WHEEL_ORDER.map((num, i) => {
              const startAngle = i * segAngle, endAngle = (i + 1) * segAngle, midAngle = startAngle + segAngle / 2
              const textPos = polarToCartesian(midAngle, r * 0.78)
              const style = COLOR_STYLES[getNumberColor(num)]
              return (
                <g key={i}>
                  <path d={describeArc(startAngle, endAngle)} fill={style.bg} stroke="rgba(200,150,0,0.4)" strokeWidth="0.8" />
                  <text x={textPos.x} y={textPos.y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="bold" fill={style.text} transform={`rotate(${midAngle}, ${textPos.x}, ${textPos.y})`}>{num}</text>
                </g>
              )
            })}
            <circle cx={cx} cy={cy} r={28} fill="#1a0a00" stroke="#d97706" strokeWidth="3" />
            <circle cx={cx} cy={cy} r={20} fill="#2d1500" stroke="#92400e" strokeWidth="2" />
            <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize="11" fill="#d97706" fontWeight="bold">BEER</text>
          </svg>
        </div>
      </div>
    </div>
  )
}

function Casino() {
  const { user } = useAuth()
  const [casinoTab, setCasinoTab] = useState('free')
  const [balance, setBalance] = useState(0)
  const [freeSpinning, setFreeSpinning] = useState(false)
  const [freeTargetIdx, setFreeTargetIdx] = useState(0)
  const [freePrize, setFreePrize] = useState(null)
  const [showFreePrize, setShowFreePrize] = useState(false)
  const [alreadySpun, setAlreadySpun] = useState(false)
  const [spinHistory, setSpinHistory] = useState([])
  const [loadingFree, setLoadingFree] = useState(true)
  const [betAmount, setBetAmount] = useState(50)
  const [betType, setBetType] = useState(null)
  const [betValue, setBetValue] = useState(null)
  const [betSpinning, setBetSpinning] = useState(false)
  const [betTargetNumber, setBetTargetNumber] = useState(null)
  const [betResult, setBetResult] = useState(null)
  const [pendingBetResult, setPendingBetResult] = useState(null)
  const [showBetResult, setShowBetResult] = useState(false)
  const [betHistory, setBetHistory] = useState([])
  const [loadingBet, setLoadingBet] = useState(true)

  useEffect(() => { fetchBalance() }, [])
  useEffect(() => { if (casinoTab === 'free') fetchFreeData() }, [casinoTab])
  useEffect(() => { if (casinoTab === 'bet') fetchBetData() }, [casinoTab])

  const fetchBalance = async () => {
    const { data } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single()
    setBalance(data?.balance || 0)
  }
  const fetchFreeData = async () => {
    setLoadingFree(true)
    const { data } = await supabase.from('roulette_spins').select('*').eq('user_id', user.id).order('spun_at', { ascending: false }).limit(10)
    setSpinHistory(data || [])
    if (data && data.length > 0) {
      const lastMadrid = new Date(new Date(data[0].spun_at).toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
      const nowMadrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
      setAlreadySpun(lastMadrid.toDateString() === nowMadrid.toDateString())
    } else { setAlreadySpun(false) }
    setLoadingFree(false)
  }
  const fetchBetData = async () => {
    setLoadingBet(true)
    const { data } = await supabase.from('roulette_bets').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15)
    setBetHistory(data || [])
    setLoadingBet(false)
  }
  const resolveSegmentIndex = (data) => {
    if (FREE_LABEL_MAP[data.prize_label] !== undefined) return FREE_LABEL_MAP[data.prize_label]
    if (data.prize_powerup && FREE_POWERUP_MAP[data.prize_powerup] !== undefined) return FREE_POWERUP_MAP[data.prize_powerup]
    if (data.prize_type === 'nothing') return 11
    if (data.prize_type === 'coins') return 1
    if (data.prize_type === 'points') return 0
    return Math.floor(Math.random() * 12)
  }
  const handleFreeSpin = async () => {
    if (freeSpinning || alreadySpun) return
    setFreeSpinning(true); setFreePrize(null); setShowFreePrize(false)
    const { data } = await supabase.rpc('spin_roulette')
    if (!data?.success) { soundError(); setFreeSpinning(false); return }
    setFreeTargetIdx(resolveSegmentIndex(data)); setFreePrize(data)
  }
  const handleFreeSpinEnd = useCallback(() => {
    setFreeSpinning(false); setAlreadySpun(true); soundSuccess()
    setTimeout(() => { setShowFreePrize(true); fetchFreeData(); fetchBalance() }, 300)
  }, [])
  const handleBetSpin = async () => {
    if (betSpinning || !betType || betAmount < 10 || betAmount > balance) return
    if (betType === 'number' && betValue === null) return
    setBetSpinning(true); setBetResult(null); setPendingBetResult(null); setShowBetResult(false)
    const { data } = await supabase.rpc('spin_bet_roulette', { p_bet_amount: betAmount, p_bet_type: betType, p_bet_value: betType === 'number' ? String(betValue) : null })
    if (!data?.success) { soundError(); setBetSpinning(false); alert(data?.error || 'Error al apostar'); return }
    setBetTargetNumber(data.number); setPendingBetResult(data)
  }
  const handleBetSpinEnd = useCallback(() => {
    setBetSpinning(false)
    if (pendingBetResult) {
      setBetResult(pendingBetResult); setBalance(pendingBetResult.new_balance)
      if (pendingBetResult.won) soundSuccess(); else soundError()
      setTimeout(() => { setShowBetResult(true); fetchBetData() }, 400)
    }
  }, [pendingBetResult])

  const formatTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000), hours = Math.floor(mins / 60), days = Math.floor(hours / 24)
    if (days > 0) return `hace ${days}d`; if (hours > 0) return `hace ${hours}h`; if (mins > 0) return `hace ${mins}m`; return 'ahora'
  }

  const BET_TYPES = [
    { id: 'red', label: 'Rojo', emoji: '🔴', payout: 'x2' }, { id: 'black', label: 'Negro', emoji: '⚫', payout: 'x2' },
    { id: 'even', label: 'Par', emoji: '2️⃣', payout: 'x2' }, { id: 'odd', label: 'Impar', emoji: '1️⃣', payout: 'x2' },
    { id: 'low', label: '1-18', emoji: '⬇️', payout: 'x2' }, { id: 'high', label: '19-36', emoji: '⬆️', payout: 'x2' },
    { id: 'dozen1', label: '1ª Doc', emoji: '🎲', payout: 'x3' }, { id: 'dozen2', label: '2ª Doc', emoji: '🎲', payout: 'x3' },
    { id: 'dozen3', label: '3ª Doc', emoji: '🎲', payout: 'x3' }, { id: 'col1', label: 'Col 1', emoji: '📊', payout: 'x3' },
    { id: 'col2', label: 'Col 2', emoji: '📊', payout: 'x3' }, { id: 'col3', label: 'Col 3', emoji: '📊', payout: 'x3' },
    { id: 'number', label: 'Número', emoji: '🎯', payout: 'x36' },
  ]

  return (
    <div className="max-w-md mx-auto px-4 pt-4 pb-6">
      <div className="text-center mb-5">
        <h2 className="text-2xl font-bold mb-1">Casino 🎰</h2>
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl" style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <span className="text-lg">🪙</span>
          <span className="font-bold text-amber-400 text-lg">{balance.toLocaleString()}</span>
        </div>
      </div>
      <div className="flex rounded-xl p-1 mb-6" style={{ backgroundColor: 'var(--bg-input)' }}>
        {[{ id: 'free', label: '🎡 Ruleta Gratis', color: '#7c3aed' }, { id: 'bet', label: '🎰 Ruleta Apuestas', color: '#b91c1c' }].map(t => (
          <button key={t.id} onClick={() => setCasinoTab(t.id)}
            className="relative flex-1 py-2 rounded-lg text-xs font-medium z-10"
            style={{ color: casinoTab === t.id ? '#fff' : 'var(--text-muted)' }}>
            {casinoTab === t.id && <motion.div layoutId="casino-tab" className="absolute inset-0 rounded-lg" style={{ zIndex: -1, backgroundColor: t.color }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
            {t.label}
          </button>
        ))}
      </div>

      {casinoTab === 'free' && (
        <>
          <p className="text-center text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Una tirada gratis al día · Gana puntos, monedas o powerups</p>
          {loadingFree ? (
            <div className="text-center py-10"><motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-4xl mb-2">🎡</motion.div></div>
          ) : (
            <>
              <div className="mb-6"><FreeRouletteWheel spinning={freeSpinning} targetIndex={freeTargetIdx} onSpinEnd={handleFreeSpinEnd} /></div>
              {alreadySpun && !freeSpinning ? (
                <div className="rounded-2xl p-4 mb-5 text-center" style={{ backgroundColor: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.3)' }}>
                  <p className="text-sm font-bold text-purple-400">✅ Ya has girado hoy</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Vuelve mañana para otra tirada gratis</p>
                </div>
              ) : (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleFreeSpin} disabled={freeSpinning || alreadySpun}
                  className="w-full py-4 rounded-2xl font-bold text-white text-base mb-5 relative overflow-hidden"
                  style={{ backgroundColor: freeSpinning ? '#4c1d95' : '#7c3aed' }}>
                  {freeSpinning ? <div className="flex items-center justify-center gap-2"><motion.span animate={{ rotate: 360 }} transition={{ duration: 0.5, repeat: Infinity, ease: 'linear' }}>🎡</motion.span>Girando...</div> : '🎡 ¡Girar gratis!'}
                  {!freeSpinning && <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)' }} animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />}
                </motion.button>
              )}
              <AnimatePresence>
                {showFreePrize && freePrize && (
                  <motion.div initial={{ opacity: 0, scale: 0.5, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="rounded-2xl p-5 mb-5 text-center"
                    style={{ backgroundColor: freePrize.prize_type === 'nothing' ? 'rgba(55,65,81,0.5)' : 'rgba(124,58,237,0.15)', border: `2px solid ${freePrize.prize_type === 'nothing' ? '#374151' : '#7c3aed'}` }}>
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5 }} className="text-5xl mb-2">{freePrize.prize_emoji}</motion.div>
                    <p className="text-lg font-bold" style={{ color: freePrize.prize_type === 'nothing' ? '#9ca3af' : '#c084fc' }}>{freePrize.prize_label}</p>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: 'var(--bg-card)' }}>
                <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>Tabla de premios</p>
                <div className="grid grid-cols-2 gap-1">
                  {[{ emoji: '🍺', label: '+2 pts', prob: '20%', color: '#f59e0b' }, { emoji: '🍺', label: '+5 pts', prob: '15%', color: '#f59e0b' }, { emoji: '🪙', label: '+50🪙', prob: '15%', color: '#6366f1' }, { emoji: '🪙', label: '+150🪙', prob: '10%', color: '#8b5cf6' }, { emoji: '🪙', label: '+300🪙', prob: '8%', color: '#ec4899' }, { emoji: '🔥', label: 'Racha x2', prob: '8%', color: '#f97316' }, { emoji: '🛡️', label: 'Escudo', prob: '7%', color: '#10b981' }, { emoji: '🧊', label: 'Freeze', prob: '7%', color: '#3b82f6' }, { emoji: '⚡', label: 'Turbo', prob: '5%', color: '#eab308' }, { emoji: '💣', label: 'Sabotaje', prob: '3%', color: '#ef4444' }, { emoji: '🎯', label: 'Sniper', prob: '1%', color: '#a855f7' }, { emoji: '💀', label: 'Nada', prob: '1%', color: '#6b7280' }].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-1 px-2 rounded-lg" style={{ backgroundColor: 'var(--bg-input)' }}>
                      <div className="flex items-center gap-1.5"><span className="text-sm">{item.emoji}</span><span className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</span></div>
                      <span className="text-xs font-bold" style={{ color: item.color }}>{item.prob}</span>
                    </div>
                  ))}
                </div>
              </div>
              {spinHistory.length > 0 && (
                <div>
                  <p className="text-sm font-bold mb-3">Últimas tiradas</p>
                  <div className="space-y-2">
                    {spinHistory.map(spin => (
                      <motion.div key={spin.id} variants={staggerItem} initial="initial" animate="animate" className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                        <span className="text-2xl">{spin.prize_emoji}</span>
                        <div className="flex-1"><p className="text-sm font-medium">{spin.prize_label}</p><p className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatTime(spin.spun_at)}</p></div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {casinoTab === 'bet' && (
        <>
          <p className="text-center text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Ruleta europea clásica · Sin límite de tiradas</p>
          <div className="mb-5"><EuropeanRouletteWheel spinning={betSpinning} targetNumber={betTargetNumber} onSpinEnd={handleBetSpinEnd} /></div>
          <AnimatePresence>
            {showBetResult && betResult && (
              <motion.div initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="rounded-2xl p-5 mb-5 text-center"
                style={{ backgroundColor: betResult.won ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `2px solid ${betResult.won ? '#10b981' : '#ef4444'}` }}>
                <div className="flex justify-center mb-3">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black" style={COLOR_STYLES[betResult.color]}>{betResult.number}</div>
                </div>
                <motion.p className="text-xl font-bold mb-1" animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 0.4 }} style={{ color: betResult.won ? '#10b981' : '#ef4444' }}>
                  {betResult.won ? '¡GANASTE! 🎉' : '¡PERDISTE! 😬'}
                </motion.p>
                {betResult.won ? <><p className="text-2xl font-black text-emerald-400">+{betResult.payout}🪙</p><p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Multiplicador x{betResult.multiplier} · Neto +{betResult.net}🪙</p></> : <p className="text-lg font-bold text-red-400">-{betResult.bet_amount || betAmount}🪙</p>}
                <p className="text-xs mt-2" style={{ color: 'var(--text-hint)' }}>Saldo: {betResult.new_balance.toLocaleString()}🪙</p>
              </motion.div>
            )}
          </AnimatePresence>
          <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between mb-2"><p className="text-sm font-bold">Apuesta</p><p className="font-bold text-amber-400">{betAmount}🪙</p></div>
            <input type="range" min="10" max={Math.min(balance, 5000)} step="10" value={betAmount} onChange={e => setBetAmount(Number(e.target.value))} className="w-full accent-red-600 mb-2" />
            <div className="flex gap-2">
              {[50, 100, 250, 500, 1000].filter(v => v <= balance).map(v => (
                <motion.button key={v} whileTap={{ scale: 0.9 }} onClick={() => setBetAmount(v)}
                  className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                  style={{ backgroundColor: betAmount === v ? '#b91c1c' : 'var(--bg-input)', color: betAmount === v ? '#fff' : 'var(--text-muted)' }}>{v}</motion.button>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm font-bold mb-3">Tipo de apuesta</p>
            <div className="grid grid-cols-3 gap-2">
              {BET_TYPES.map(bt => (
                <motion.button key={bt.id} whileTap={{ scale: 0.93 }} onClick={() => { setBetType(bt.id); if (bt.id !== 'number') setBetValue(null) }}
                  className="rounded-xl p-2.5 text-center"
                  style={{ backgroundColor: betType === bt.id ? 'rgba(185,28,28,0.25)' : 'var(--bg-input)', border: betType === bt.id ? '2px solid #b91c1c' : '2px solid transparent' }}>
                  <div className="text-xl mb-0.5">{bt.emoji}</div>
                  <p className="text-xs font-bold" style={{ color: betType === bt.id ? '#fca5a5' : 'var(--text-primary)' }}>{bt.label}</p>
                  <p className="text-xs font-black" style={{ color: '#fbbf24' }}>{bt.payout}</p>
                </motion.button>
              ))}
            </div>
            {betType === 'number' && (
              <div className="mt-3">
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Número elegido: {betValue !== null ? <span className="font-black text-sm" style={COLOR_STYLES[getNumberColor(betValue)]}>{betValue}</span> : <span style={{ color: 'var(--text-hint)' }}>ninguno</span>}</p>
                <div className="grid grid-cols-9 gap-1 max-h-44 overflow-y-auto">
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setBetValue(0)} className="col-span-9 rounded-lg flex items-center justify-center text-xs font-bold" style={{ backgroundColor: betValue === 0 ? '#16a34a' : '#166534', color: '#fff', height: 28 }}>0</motion.button>
                  {Array.from({ length: 36 }, (_, i) => i + 1).map(n => (
                    <motion.button key={n} whileTap={{ scale: 0.9 }} onClick={() => setBetValue(n)}
                      className="aspect-square rounded-lg flex items-center justify-center text-xs font-bold"
                      style={{ backgroundColor: betValue === n ? '#fbbf24' : getNumberColor(n) === 'red' ? '#991b1b' : '#111827', color: betValue === n ? '#000' : '#fff', border: betValue === n ? '2px solid #fbbf24' : '1px solid rgba(255,255,255,0.1)', minHeight: 28 }}>{n}</motion.button>
                  ))}
                </div>
              </div>
            )}
          </div>
          {betType && (
            <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
              <div className="flex justify-between text-sm mb-1"><span style={{ color: 'var(--text-muted)' }}>Apuesta</span><span className="font-bold">{betAmount}🪙</span></div>
              <div className="flex justify-between text-sm mb-1"><span style={{ color: 'var(--text-muted)' }}>Tipo</span><span className="font-medium">{BET_TYPES.find(b => b.id === betType)?.label}{betType === 'number' && betValue !== null ? ` (${betValue})` : ''}</span></div>
              <div className="flex justify-between text-sm border-t pt-1 mt-1" style={{ borderColor: 'var(--border)' }}>
                <span className="font-bold">Si ganas recibes</span>
                <span className="font-black text-emerald-400">{betAmount * parseInt(BET_TYPES.find(b => b.id === betType)?.payout?.replace('x', '') || 1)}🪙</span>
              </div>
            </div>
          )}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleBetSpin}
            disabled={betSpinning || !betType || betAmount > balance || betAmount < 10 || (betType === 'number' && betValue === null)}
            className="w-full py-4 rounded-2xl font-bold text-white text-base mb-6 relative overflow-hidden"
            style={{ backgroundColor: betSpinning ? '#7f1d1d' : '#b91c1c', opacity: (!betType || betAmount > balance) ? 0.5 : 1 }}>
            {betSpinning ? <div className="flex items-center justify-center gap-2"><motion.div className="w-5 h-5 rounded-full border-2 border-white border-t-transparent" animate={{ rotate: 360 }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }} />Girando...</div>
              : !betType ? '← Elige tipo de apuesta' : betAmount > balance ? 'Saldo insuficiente' : betType === 'number' && betValue === null ? '← Elige un número' : `🎰 Apostar ${betAmount}🪙`}
            {!betSpinning && betType && betAmount <= balance && <motion.div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} animate={{ x: ['-100%', '100%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />}
          </motion.button>
          {betHistory.length > 0 && (
            <div>
              <p className="text-sm font-bold mb-3">Historial de apuestas</p>
              <div className="space-y-2">
                {betHistory.map(bet => (
                  <motion.div key={bet.id} variants={staggerItem} initial="initial" animate="animate" className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0" style={COLOR_STYLES[bet.result_color]}>{bet.result_number}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{BET_TYPES.find(b => b.id === bet.bet_type)?.label}{bet.bet_type === 'number' && bet.bet_value ? ` · ${bet.bet_value}` : ''}{' · '}{bet.bet_amount}🪙</p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatTime(bet.created_at)}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-sm font-black ${bet.won ? 'text-emerald-400' : 'text-red-400'}`}>{bet.won ? `+${bet.net}🪙` : `-${bet.bet_amount}🪙`}</p>
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

// ─── GLOBAL RANKING PRINCIPAL ─────────────────────────────────────────────────
export default function GlobalRanking() {
  const { user } = useAuth()
  const [tab, setTab] = useState('ranking')
  const [marketTab, setMarketTab] = useState('drinks')
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState(0)

  useEffect(() => { fetchRanking(); fetchBalance() }, [])

  const fetchRanking = async () => {
    setLoading(true)
    const { data } = await supabase.from('global_rankings').select('*').order('total_points', { ascending: false })
    setRankings(data || [])
    setLoading(false)
  }
  const fetchBalance = async () => {
    const { data } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single()
    setBalance(data?.balance || 0)
  }
  const handleBalanceChange = (delta) => setBalance(prev => prev + delta)
  const handleSeasonReset = useCallback(() => { fetchRanking() }, [])

  const medals = ['🥇', '🥈', '🥉']
  const Avatar = ({ url, username, size = 'md' }) => {
    const dim = size === 'md' ? 'w-10 h-10' : 'w-8 h-8'
    return url ? <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
      : <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0`} style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
  }

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="px-4 pt-6 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-2xl font-bold mb-4">Global 🌍</h1>
        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
          {[
            { id: 'ranking', label: '🏆 Ranking' },
            { id: 'market',  label: '📈 Mercado' },
            { id: 'casino',  label: '🎰 Casino' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-sm font-medium transition-colors z-10"
              style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {tab === t.id && (
                <motion.div layoutId="global-tab" className="absolute inset-0 rounded-lg"
                  style={{ zIndex: -1, backgroundColor: t.id === 'casino' ? '#7c3aed' : '#f59e0b' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'ranking' && (
        <div className="pb-24 px-4 pt-4 max-w-md mx-auto">
          <SeasonCountdown onSeasonReset={handleSeasonReset} />
          {!loading && rankings.length >= 3 && (
            <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="flex items-end justify-center gap-3 mb-8">
              <div className="flex flex-col items-center flex-1">
                <Avatar url={rankings[1]?.avatar_url} username={rankings[1]?.username} />
                <p className="text-xs font-semibold mt-1 truncate w-full text-center" style={{ color: 'var(--text-muted)' }}>{rankings[1]?.username}</p>
                <p className="text-amber-400 font-bold text-sm">{rankings[1]?.total_points}pts</p>
                <div className="w-full rounded-t-lg h-16 flex items-center justify-center text-2xl mt-1" style={{ backgroundColor: 'var(--bg-card)' }}>🥈</div>
              </div>
              <div className="flex flex-col items-center flex-1">
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
                  <Avatar url={rankings[0]?.avatar_url} username={rankings[0]?.username} />
                </motion.div>
                <p className="text-xs font-semibold mt-1 truncate w-full text-center" style={{ color: 'var(--text-primary)' }}>{rankings[0]?.username}</p>
                <p className="text-amber-400 font-bold text-sm">{rankings[0]?.total_points}pts</p>
                <div className="w-full bg-amber-500 rounded-t-lg h-24 flex items-center justify-center text-2xl mt-1">🥇</div>
              </div>
              <div className="flex flex-col items-center flex-1">
                <Avatar url={rankings[2]?.avatar_url} username={rankings[2]?.username} />
                <p className="text-xs font-semibold mt-1 truncate w-full text-center" style={{ color: 'var(--text-muted)' }}>{rankings[2]?.username}</p>
                <p className="text-amber-400 font-bold text-sm">{rankings[2]?.total_points}pts</p>
                <div className="w-full rounded-t-lg h-10 flex items-center justify-center text-2xl mt-1" style={{ backgroundColor: 'var(--bg-card)' }}>🥉</div>
              </div>
            </motion.div>
          )}
          {loading ? <p className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Cargando ranking...</p>
            : rankings.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}><div className="text-5xl mb-3">🌍</div><p>Aún no hay datos globales</p></div>
            ) : (
              <div className="space-y-3">
                {rankings.map((entry, index) => {
                  const isMe = entry.user_id === user.id
                  const drinkCounts = (entry.drinks_detail || []).reduce((acc, d) => {
                    if (!acc[d.name]) acc[d.name] = { emoji: d.emoji, count: 0 }
                    acc[d.name].count += 1; return acc
                  }, {})
                  return (
                    <motion.div key={entry.user_id} variants={staggerItem} initial="initial" animate="animate"
                      className={`rounded-2xl p-4 ${isMe ? 'bg-amber-500' : ''}`} style={!isMe ? { backgroundColor: 'var(--bg-card)' } : {}}>
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl w-8 text-center">{medals[index] || `${index + 1}`}</span>
                        <Avatar url={entry.avatar_url} username={entry.username} />
                        <div className="flex-1">
                          <p className="font-bold">{entry.username} {isMe && '(tú)'}</p>
                          <p className="text-xs" style={{ color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>{entry.total_drinks} consumiciones</p>
                        </div>
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${isMe ? 'text-white' : 'text-amber-400'}`}>{entry.total_points}</p>
                          <p className="text-xs" style={{ color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>puntos</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: isMe ? 'rgba(255,255,255,0.3)' : 'var(--border)' }}>
                        {Object.entries(drinkCounts).sort(([, a], [, b]) => b.count - a.count).map(([name, { emoji, count }]) => (
                          <div key={name} className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${isMe ? 'bg-amber-600 text-white' : ''}`}
                            style={!isMe ? { backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' } : {}}>
                            <span>{emoji}</span><span>{count}</span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          <SeasonHistory />
        </div>
      )}

      {tab === 'market' && (
        <div className="pb-24">
          <div className="px-4 pt-4 pb-0 max-w-md mx-auto">
            <div className="flex rounded-xl p-1 mb-2" style={{ backgroundColor: 'var(--bg-input)' }}>
              {[{ id: 'drinks', label: '🍺 Bebidas', color: '#f59e0b' }, { id: 'stocks', label: '📊 S&PINTA 500', color: '#6366f1' }].map(t => (
                <button key={t.id} onClick={() => setMarketTab(t.id)}
                  className="relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10"
                  style={{ color: marketTab === t.id ? '#fff' : 'var(--text-muted)' }}>
                  {marketTab === t.id && <motion.div layoutId="market-sub-tab" className="absolute inset-0 rounded-lg" style={{ zIndex: -1, backgroundColor: t.color }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {marketTab === 'drinks' && <Market />}
          {marketTab === 'stocks' && <StockMarket balance={balance} onBalanceChange={handleBalanceChange} />}
        </div>
      )}

      {tab === 'casino' && (
        <div className="pb-24">
          <Casino />
        </div>
      )}
    </div>
  )
}