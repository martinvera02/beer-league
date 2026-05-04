import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { soundDrink, soundSuccess, soundError } from '../lib/sounds'

const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0
  return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
})

const isMartesEnMadrid = () => {
  const madrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const dow = madrid.getDay(), hour = madrid.getHours()
  return dow === 2 || (dow === 3 && hour < 4)
}

const isOperacionBarbacoa = () => {
  const madrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  return madrid.getDate() === 9 && madrid.getMonth() === 4
}

const CUBATA_NORMAL_ID = 2
const CUBATA_CAMARADA_ID = 13

function CountdownDigit({ value }) {
  return (
    <motion.span key={value} initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className="inline-block w-6 text-center font-black text-white tabular-nums"
      style={{ fontVariantNumeric: 'tabular-nums' }}>
      {value}
    </motion.span>
  )
}

function CountdownDisplay({ countdown }) {
  if (!countdown) return null
  const [hh, mm, ss] = countdown.split(':')
  return (
    <div className="flex items-center gap-0.5 mt-1.5">
      <span className="text-white/40 text-xs mr-1.5">acaba en</span>
      <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-lg" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
        <CountdownDigit value={hh[0]} /><CountdownDigit value={hh[1]} />
        <span className="text-white/50 font-black mx-0.5">:</span>
        <CountdownDigit value={mm[0]} /><CountdownDigit value={mm[1]} />
        <span className="text-white/50 font-black mx-0.5">:</span>
        <motion.span key={ss} initial={{ scale: 1.2, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }}
          className="inline-block w-6 text-center font-black text-white tabular-nums">{ss[0]}</motion.span>
        <motion.span key={ss + 'b'} initial={{ scale: 1.2, opacity: 0.5 }} animate={{ scale: 1, opacity: 1 }}
          className="inline-block w-6 text-center font-black text-white tabular-nums">{ss[1]}</motion.span>
      </div>
    </div>
  )
}

export default function AddDrink() {
  const { user } = useAuth()
  const [drinkTypes, setDrinkTypes] = useState([])
  const [drinkMarket, setDrinkMarket] = useState({})
  const [leagues, setLeagues] = useState([])
  const [seasonId, setSeasonId] = useState(null)
  const [selectedDrink, setSelectedDrink] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [frozen, setFrozen] = useState(false)
  const [shieldBlocked, setShieldBlocked] = useState(false)
  const [result, setResult] = useState(null)
  const [activePowerups, setActivePowerups] = useState([])
  const [balance, setBalance] = useState(0)
  const [badgeEarned, setBadgeEarned] = useState(false)
  const [countdown, setCountdown] = useState('')

  const isMartes = isMartesEnMadrid()
  const isBarbacoa = isOperacionBarbacoa()
  const isEventActive = isBarbacoa || isMartes

  useEffect(() => {
    if (!isMartes || isBarbacoa) return
    const tick = () => {
      const madrid = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
      const dow = madrid.getDay(), h = madrid.getHours(), m = madrid.getMinutes(), s = madrid.getSeconds()
      let secsLeft = dow === 2 ? (24 - h) * 3600 - m * 60 - s + 4 * 3600 : (4 - h - 1) * 3600 + (60 - m - 1) * 60 + (60 - s)
      const hh = Math.floor(secsLeft / 3600), mm2 = Math.floor((secsLeft % 3600) / 60), ss2 = secsLeft % 60
      setCountdown(`${String(hh).padStart(2,'0')}:${String(mm2).padStart(2,'0')}:${String(ss2).padStart(2,'0')}`)
    }
    tick(); const interval = setInterval(tick, 1000); return () => clearInterval(interval)
  }, [isMartes, isBarbacoa])

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [{ data: drinks }, { data: members }, { data: season }, { data: market }, { data: powerups }, { data: walletData }] = await Promise.all([
      supabase.from('drink_types').select('*'),
      supabase.from('league_members').select('league_id').eq('user_id', user.id),
      supabase.rpc('get_active_season'),
      supabase.from('drink_market').select('drink_type_id, price'),
      supabase.from('active_powerups').select('*, powerup_catalog(name, emoji, effect_type)').eq('user_id', user.id).eq('active', true).or('expires_at.is.null,expires_at.gt.now()'),
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
    ])
    const filteredDrinks = (drinks || []).filter(d => {
      if (isBarbacoa && d.id === CUBATA_NORMAL_ID) return false
      if (!isBarbacoa && d.id === CUBATA_CAMARADA_ID) return false
      return true
    })
    setDrinkTypes(filteredDrinks)
    setLeagues(members?.map(m => m.league_id) || [])
    setSeasonId(season?.id || null)
    setActivePowerups(powerups || [])
    setBalance(walletData?.balance || 0)
    const marketMap = {}
    market?.forEach(m => { marketMap[m.drink_type_id] = m.price })
    setDrinkMarket(marketMap)
  }

  const getEffectivePoints = (drink) => {
    const price = drinkMarket[drink.id] || 100
    const marketMultiplier = Math.max(0.5, Math.min(2.0, price / 100))
    const hasDouble = activePowerups.some(p => p.powerup_catalog?.effect_type === 'double_points')
    const hasTurbo = activePowerups.some(p => p.powerup_catalog?.effect_type === 'turbo' && p.extra_data?.drink_type_id === drink.id)
    const hasGamble = activePowerups.some(p => p.powerup_catalog?.effect_type === 'gamble')
    if (hasGamble) return '?'
    let multiplier = marketMultiplier
    if (isEventActive) multiplier *= 2
    if (hasDouble) multiplier *= 2
    if (hasTurbo) multiplier *= 3
    return Math.round(drink.points * multiplier * 10) / 10
  }

  const getMarketMultiplier = (drinkId) => {
    const price = drinkMarket[drinkId] || 100
    return Math.max(0.5, Math.min(2.0, price / 100))
  }

  const handleAdd = async () => {
    if (!selectedDrink || leagues.length === 0 || !seasonId) return
    setLoading(true); soundDrink()
    const { data, error } = await supabase.rpc('add_drink_with_effects', {
      p_drink_type_id: selectedDrink, p_season_id: seasonId,
      p_league_ids: leagues, p_drink_group_id: generateUUID(),
    })
    if (error || !data?.success) {
      if (data?.frozen) {
        if (data?.shield_blocked) { setShieldBlocked(true); soundSuccess(); setTimeout(() => setShieldBlocked(false), 3000) }
        else { setFrozen(true); soundError(); setTimeout(() => setFrozen(false), 3000) }
      }
      setLoading(false); return
    }
    if (isBarbacoa) {
      const { error: badgeError } = await supabase.from('achievements').insert({ user_id: user.id, achievement_id: 'operacion_barbacoa_2026' })
      if (!badgeError) setBadgeEarned(true)
    }
    setResult(data); setSuccess(true); soundSuccess(); await fetchData()
    setTimeout(() => { setSuccess(false); setResult(null); setBadgeEarned(false) }, 5000)
    setLoading(false); setSelectedDrink(null)
  }

  const isFreezeActive    = activePowerups.some(p => p.powerup_catalog?.effect_type === 'freeze')
  const isInvisibleActive = activePowerups.some(p => p.powerup_catalog?.effect_type === 'invisible')
  const isGambleActive    = activePowerups.some(p => p.powerup_catalog?.effect_type === 'gamble')
  const inDebt = balance < 0

  const getPowerupColor = (effectType) => {
    switch (effectType) {
      case 'shield':    return { bg: 'rgba(99,102,241,0.15)',  color: '#818cf8', border: 'rgba(99,102,241,0.3)' }
      case 'freeze':    return { bg: 'rgba(59,130,246,0.15)',  color: '#60a5fa', border: 'rgba(59,130,246,0.3)' }
      case 'invisible': return { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', border: 'rgba(156,163,175,0.3)' }
      case 'gamble':    return { bg: 'rgba(168,85,247,0.15)',  color: '#c084fc', border: 'rgba(168,85,247,0.3)' }
      default:          return { bg: 'rgba(245,158,11,0.15)',  color: '#f59e0b', border: 'rgba(245,158,11,0.3)' }
    }
  }

  const eventGradient = isBarbacoa ? 'linear-gradient(135deg, #8B0000, #B22222, #8B0000)' : 'linear-gradient(135deg, #7c3aed, #dc2626)'
  const eventGlow = isBarbacoa ? '0 0 30px rgba(139,0,0,0.5)' : '0 0 30px rgba(124,58,237,0.4)'

  return (
    <div className="min-h-screen pb-28 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* ── HERO HEADER ── */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0" style={{
          background: isEventActive
            ? (isBarbacoa ? 'linear-gradient(180deg, rgba(139,0,0,0.25) 0%, transparent 100%)' : 'linear-gradient(180deg, rgba(124,58,237,0.2) 0%, transparent 100%)')
            : 'linear-gradient(180deg, rgba(245,158,11,0.08) 0%, transparent 100%)'
        }} />
        <div className="relative px-5 pt-8 pb-5">
          <div className="flex items-start justify-between mb-1">
            <div>
              <p className="text-xs font-black tracking-widest mb-1" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.15em' }}>
                BEER LEAGUE
              </p>
              <h1 className="text-3xl font-black leading-tight" style={{ color: 'var(--text-primary)' }}>
                ¿Qué estás<br />bebiendo? 🍺
              </h1>
            </div>
            {leagues.length > 0 && (
              <div className="px-3 py-1.5 rounded-xl text-xs font-black"
                style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                {leagues.length} {leagues.length === 1 ? 'liga' : 'ligas'}
              </div>
            )}
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>
            Se anotará en todas tus ligas automáticamente
          </p>
        </div>
      </div>

      <div className="px-4 max-w-md mx-auto">

        {/* ── BANNER BARBACOA ── */}
        <AnimatePresence>
          {isBarbacoa && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="rounded-2xl mb-4 relative overflow-hidden"
              style={{ background: eventGradient, border: '2px solid #FFD700', boxShadow: eventGlow }}>
              <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.08), transparent)' }}
                animate={{ x: ['-100%', '200%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1.5 }} />
              <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #FFD700, #FFA500, #FFD700, transparent)' }} />
              <div className="flex items-stretch">
                <div className="flex-shrink-0 flex items-center justify-center p-3"
                  style={{ background: 'rgba(0,0,0,0.25)', borderRight: '1px solid rgba(255,215,0,0.3)' }}>
                  <motion.img src="/operacion-barbacoa.png" alt="Operación Barbacoa"
                    className="object-contain" style={{ width: 68, height: 68 }}
                    animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 3, repeat: Infinity }} />
                </div>
                <div className="flex-1 p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
                      className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: '#FFD700' }} />
                    <p className="font-black text-sm tracking-widest uppercase" style={{ color: '#FFD700', letterSpacing: '0.12em' }}>
                      Operación Barbacoa
                    </p>
                  </div>
                  <p className="text-xs mb-2" style={{ color: 'rgba(255,220,100,0.8)' }}>🍖 Día de la Victoria · 9 de Mayo</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <motion.span animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 1.5, repeat: Infinity }}
                      className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: '#FFD700', color: '#8B0000' }}>
                      ✕2 PUNTOS
                    </motion.span>
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(255,215,0,0.15)', color: 'rgba(255,215,0,0.9)', border: '1px solid rgba(255,215,0,0.3)' }}>
                      🥃 Cubata del Camarada
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ height: 2, background: 'linear-gradient(90deg, transparent, #FFD700, #FFA500, #FFD700, transparent)' }} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── BANNER MARTES MACARRA ── */}
        <AnimatePresence>
          {isMartes && !isBarbacoa && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="rounded-2xl p-4 mb-4 relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #dc2626)', border: '2px solid rgba(255,255,255,0.15)', boxShadow: '0 0 25px rgba(124,58,237,0.4)' }}>
              <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }}
                animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }} />
              <div className="flex items-start gap-3 relative">
                <motion.div className="text-4xl flex-shrink-0"
                  animate={{ rotate: [-5, 5, -5], scale: [1, 1.08, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>😈</motion.div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white font-black text-lg tracking-tight">MARTES MACARRA</p>
                    <motion.span animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1, repeat: Infinity }}
                      className="text-xs font-black px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>x2</motion.span>
                  </div>
                  <p className="text-white/70 text-xs">¡Doble de puntos y monedas!</p>
                  <CountdownDisplay countdown={countdown} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── POWERUPS ACTIVOS ── */}
        {activePowerups.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {activePowerups.map(ap => {
              const c = getPowerupColor(ap.powerup_catalog?.effect_type)
              return (
                <div key={ap.id} className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                  <span>{ap.powerup_catalog?.emoji}</span>
                  <span>{ap.powerup_catalog?.name}</span>
                  {ap.extra_data?.uses_left && <span>({ap.extra_data.uses_left})</span>}
                </div>
              )
            })}
          </div>
        )}

        {/* ── AVISOS ── */}
        <AnimatePresence>
          {inDebt && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-3.5 mb-4 flex items-center gap-3"
              style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <motion.span className="text-xl flex-shrink-0" animate={{ scale: [1, 1.15, 1] }} transition={{ repeat: Infinity, duration: 2 }}>🔴</motion.span>
              <div>
                <p className="font-bold text-red-400 text-sm">Saldo negativo · {balance}🪙</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Las monedas van directamente a saldar tu deuda</p>
              </div>
            </motion.div>
          )}
          {isFreezeActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-4 mb-4 text-center"
              style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <div className="text-3xl mb-1">🧊</div>
              <p className="font-bold text-blue-400 text-sm">¡Estás congelado!</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>No puedes sumar puntos mientras dure el freeze</p>
            </motion.div>
          )}
          {isInvisibleActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-4 mb-4 text-center"
              style={{ backgroundColor: 'rgba(156,163,175,0.1)', border: '1px solid rgba(156,163,175,0.3)' }}>
              <div className="text-3xl mb-1">👻</div>
              <p className="font-bold text-sm" style={{ color: '#9ca3af' }}>Modo Invisible activo</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Tus consumiciones aparecen con 0pts pero ganas monedas</p>
            </motion.div>
          )}
          {isGambleActive && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-4 mb-4 text-center"
              style={{ backgroundColor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)' }}>
              <motion.div className="text-3xl mb-1" animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>🎰</motion.div>
              <p className="font-bold text-sm" style={{ color: '#c084fc' }}>¡Apuesta activa!</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Tu próxima consumición vale x0 o x4</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── GRID DE BEBIDAS ── */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {drinkTypes.map((drink, idx) => {
            const effectivePoints = getEffectivePoints(drink)
            const isGamble = effectivePoints === '?'
            const isSelected = selectedDrink === drink.id
            const mktMult = getMarketMultiplier(drink.id)
            const baseEffective = Math.round(drink.points * mktMult * 10) / 10
            const isModified = !isGamble && Math.abs(effectivePoints - baseEffective) > 0.05
            const isCamarada = drink.id === CUBATA_CAMARADA_ID
            const coins = isGamble ? '?' : Math.floor(effectivePoints * 10)
            const isHot = mktMult >= 1.3
            const isCold = mktMult <= 0.7

            return (
              <motion.button
                key={drink.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDrink(isSelected ? null : drink.id)}
                className="relative rounded-2xl overflow-hidden text-left"
                style={{
                  background: isSelected
                    ? (isBarbacoa ? 'linear-gradient(135deg, #8B0000, #B22222)' : isMartes ? 'linear-gradient(135deg, #7c3aed, #dc2626)' : 'linear-gradient(135deg, #d97706, #f59e0b)')
                    : isCamarada ? 'linear-gradient(135deg, rgba(139,0,0,0.2), rgba(180,0,0,0.1))' : 'var(--bg-card)',
                  border: isSelected
                    ? (isBarbacoa ? '2px solid #FFD700' : '2px solid rgba(255,255,255,0.2)')
                    : isCamarada ? '1px solid rgba(255,215,0,0.3)' : '1px solid var(--border)',
                  boxShadow: isSelected ? (isBarbacoa ? '0 8px 25px rgba(139,0,0,0.4)' : isMartes ? '0 8px 25px rgba(124,58,237,0.4)' : '0 8px 25px rgba(245,158,11,0.3)') : 'none',
                }}>

                {/* Fondo seleccionado — brillo */}
                {isSelected && (
                  <motion.div className="absolute inset-0 pointer-events-none"
                    style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.08), transparent)' }}
                    animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
                )}

                {/* Badge evento */}
                {isEventActive && (
                  <div className="absolute top-2 left-2 text-xs font-black px-1.5 py-0.5 rounded-full z-10"
                    style={{ background: isSelected ? 'rgba(255,255,255,0.25)' : (isBarbacoa ? '#FFD700' : 'rgba(255,255,255,0.15)'), color: isSelected || !isBarbacoa ? '#fff' : '#8B0000' }}>
                    ×2
                  </div>
                )}

                {/* Badge HOT/COLD */}
                {!isSelected && !isEventActive && (isHot || isCold) && (
                  <div className="absolute top-2 right-2 text-xs z-10">
                    {isHot ? '🔥' : '❄️'}
                  </div>
                )}

                {/* Badge Camarada */}
                {isCamarada && !isSelected && (
                  <div className="absolute top-2 right-2 z-10">
                    <span className="text-xs font-black px-1.5 py-0.5 rounded-full" style={{ background: '#FFD700', color: '#8B0000' }}>★</span>
                  </div>
                )}

                <div className="p-4">
                  {/* Emoji */}
                  <motion.div
                    className="text-4xl mb-3"
                    animate={isSelected ? { scale: [1, 1.2, 1] } : isCamarada ? { rotate: [-3, 3, -3] } : {}}
                    transition={{ duration: isSelected ? 0.4 : 2, repeat: isCamarada && !isSelected ? Infinity : 0 }}>
                    {drink.emoji}
                  </motion.div>

                  {/* Nombre */}
                  <p className="font-black text-sm mb-1 truncate"
                    style={{ color: isSelected ? '#fff' : 'var(--text-primary)' }}>
                    {drink.name}
                  </p>

                  {/* Puntos */}
                  <div className="flex items-baseline gap-1.5">
                    {isGamble ? (
                      <span className="text-base font-black" style={{ color: isSelected ? '#fff' : '#c084fc' }}>🎰 ?pts</span>
                    ) : isModified ? (
                      <>
                        <span className="text-xs line-through" style={{ color: isSelected ? 'rgba(255,255,255,0.4)' : 'var(--text-hint)' }}>{baseEffective}pts</span>
                        <span className="text-base font-black" style={{ color: isSelected ? '#fff' : (isBarbacoa ? '#FFD700' : '#10b981') }}>{effectivePoints}pts</span>
                      </>
                    ) : (
                      <span className="text-base font-black" style={{ color: isSelected ? '#fff' : 'var(--text-muted)' }}>{drink.points}pts</span>
                    )}
                  </div>

                  {/* Monedas */}
                  {!isGamble && (
                    <p className="text-xs font-bold mt-0.5" style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : inDebt ? '#ef4444' : '#f59e0b' }}>
                      {inDebt ? '→ deuda' : `+${coins}🪙`}
                    </p>
                  )}
                </div>
              </motion.button>
            )
          })}
        </div>

        {/* ── BOTÓN ANOTAR ── */}
        <div className="sticky bottom-6">
          <motion.button
            onClick={handleAdd}
            disabled={!selectedDrink || loading || leagues.length === 0 || isFreezeActive}
            whileTap={selectedDrink && !isFreezeActive ? { scale: 0.97 } : {}}
            className="w-full disabled:opacity-40 font-black py-5 rounded-2xl text-base relative overflow-hidden"
            style={{
              background: isFreezeActive ? 'rgba(59,130,246,0.3)'
                : !selectedDrink ? 'var(--bg-card)'
                : (isBarbacoa ? 'linear-gradient(135deg, #8B0000, #CC2200)'
                  : isMartes ? 'linear-gradient(135deg, #7c3aed, #dc2626)'
                  : 'linear-gradient(135deg, #d97706, #f59e0b)'),
              color: !selectedDrink ? 'var(--text-hint)' : '#fff',
              border: !selectedDrink ? '1px solid var(--border)' : 'none',
              boxShadow: selectedDrink && !isFreezeActive
                ? (isEventActive ? eventGlow : '0 8px 30px rgba(245,158,11,0.35)') : 'none',
            }}>

            {selectedDrink && !isFreezeActive && (
              <motion.div className="absolute inset-0 pointer-events-none"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }}
                animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 0.5 }} />
            )}

            <span className="relative">
              {loading ? 'Guardando...'
                : isFreezeActive ? '🧊 Congelado — espera'
                : leagues.length === 0 ? 'Únete a una liga primero'
                : !selectedDrink ? 'Selecciona una bebida'
                : isGambleActive ? '🎰 ¡Apostar!'
                : isBarbacoa ? '🍖 ¡Anotar — Operación Barbacoa!'
                : isMartes ? '😈 ¡Anotar — Martes Macarra!'
                : `🍺 Anotar ${drinkTypes.find(d => d.id === selectedDrink)?.name || ''}`}
            </span>
          </motion.button>

          {leagues.length === 0 && (
            <p className="text-center text-xs mt-2" style={{ color: 'var(--text-hint)' }}>
              Crea o únete a una liga desde la sección 🏆
            </p>
          )}
        </div>

        {/* ── RESULTADOS ── */}
        <AnimatePresence>
          {success && result && !result.gamble_active && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="mt-6 rounded-2xl overflow-hidden"
              style={isBarbacoa
                ? { background: 'linear-gradient(135deg, rgba(139,0,0,0.2), rgba(180,0,0,0.1))', border: '2px solid rgba(255,215,0,0.5)' }
                : result.martes_macarra
                  ? { background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(220,38,38,0.15))', border: '2px solid rgba(124,58,237,0.4)' }
                  : { backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}>

              <div className="p-5 text-center">
                <motion.div className="text-5xl mb-3"
                  animate={{ rotate: [0, -12, 12, -8, 0], scale: [1, 1.25, 1] }} transition={{ duration: 0.6 }}>
                  {isBarbacoa ? '🍖' : result.martes_macarra ? '😈' : '🎉'}
                </motion.div>

                {isBarbacoa && <p className="font-black text-xs tracking-widest mb-1" style={{ color: '#FFD700', letterSpacing: '0.12em' }}>¡OPERACIÓN BARBACOA!</p>}
                {!isBarbacoa && result.martes_macarra && <p className="font-black text-xs tracking-widest mb-1 text-purple-400" style={{ letterSpacing: '0.12em' }}>¡MARTES MACARRA!</p>}

                <p className="font-black text-lg" style={{ color: isBarbacoa ? '#FFD700' : result.martes_macarra ? '#fff' : '#10b981' }}>
                  ¡Consumición anotada!
                </p>

                {/* Desglose */}
                <div className="mt-4 rounded-xl overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
                  {[
                    { label: 'Puntos base', value: `${result.base_points}pts`, show: true },
                    { label: 'Mercado', value: `×${result.market_multiplier}`, show: result.market_multiplier !== 1, color: result.market_multiplier > 1 ? '#10b981' : '#ef4444' },
                    { label: isBarbacoa ? '🍖 Barbacoa' : '😈 Martes Macarra', value: '×2', show: isBarbacoa || result.martes_macarra, color: isBarbacoa ? '#FFD700' : '#a78bfa' },
                    { label: '🔥 Racha Doble', value: '×2', show: result.double_active, color: '#f59e0b' },
                    { label: '⚡ Turbo', value: '×3', show: result.turbo_active, color: '#f59e0b' },
                    { label: '👻 Invisible', value: '0pts visibles', show: result.invisible_active, color: '#9ca3af' },
                  ].filter(r => r.show).map((row, i, arr) => (
                    <div key={i} className="flex justify-between px-4 py-2 border-b last:border-0"
                      style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{row.label}</span>
                      <span className="text-xs font-black" style={{ color: row.color || 'rgba(255,255,255,0.8)' }}>{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between px-4 py-2.5"
                    style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}>
                    <span className="text-sm font-black" style={{ color: isBarbacoa ? '#FFD700' : result.martes_macarra ? '#a78bfa' : '#10b981' }}>Total</span>
                    <span className="text-sm font-black" style={{ color: isBarbacoa ? '#FFD700' : result.martes_macarra ? '#a78bfa' : '#10b981' }}>{result.final_points}pts</span>
                  </div>
                </div>

                <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="font-black text-2xl mt-4"
                  style={{ color: inDebt ? '#ef4444' : isBarbacoa ? '#FFD700' : result.martes_macarra ? '#a78bfa' : '#f59e0b' }}>
                  {inDebt ? `${result.coins}🪙 → reduciendo deuda` : `+${result.coins}🪙`}
                </motion.p>

                <AnimatePresence>
                  {badgeEarned && (
                    <motion.div initial={{ opacity: 0, scale: 0.6, y: 8 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ delay: 0.5, type: 'spring', stiffness: 300, damping: 20 }}
                      className="mt-3 rounded-xl px-4 py-2.5 flex items-center justify-center gap-2"
                      style={{ background: 'rgba(255,215,0,0.12)', border: '1px solid rgba(255,215,0,0.35)' }}>
                      <motion.span className="text-2xl" animate={{ rotate: [-10, 10, -10], scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>🎖️</motion.span>
                      <div className="text-left">
                        <p className="text-xs font-black" style={{ color: '#FFD700' }}>¡Medalla desbloqueada!</p>
                        <p className="text-xs" style={{ color: 'rgba(255,215,0,0.6)' }}>Veterano de la Barbacoa 2026</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <p className="text-xs mt-3" style={{ color: 'var(--text-hint)' }}>
                  Anotado en {leagues.length} {leagues.length === 1 ? 'liga' : 'ligas'}
                </p>
              </div>
            </motion.div>
          )}

          {success && result && result.gamble_active && (
            <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="mt-6 rounded-2xl py-6 px-4 text-center"
              style={{ backgroundColor: result.gamble_win ? 'rgba(168,85,247,0.12)' : 'rgba(239,68,68,0.1)', border: `2px solid ${result.gamble_win ? '#a855f7' : '#ef4444'}` }}>
              <motion.div className="text-6xl mb-3"
                animate={{ rotate: result.gamble_win ? [0, -20, 20, -10, 0] : [0, -5, 5, 0] }} transition={{ duration: 0.6 }}>
                {result.gamble_win ? '🎰' : '💀'}
              </motion.div>
              <p className="font-black text-xl mb-1" style={{ color: result.gamble_win ? '#c084fc' : '#ef4444' }}>
                {result.gamble_win ? '¡JACKPOT! ×4 🎉' : '¡MALA SUERTE! ×0 😬'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {result.gamble_win ? `Has ganado ${result.final_points}pts y ${result.coins}🪙` : 'Esta consumición no ha sumado puntos'}
              </p>
            </motion.div>
          )}

          {frozen && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 rounded-2xl py-5 text-center"
              style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.35)' }}>
              <div className="text-5xl mb-2">🧊</div>
              <p className="text-blue-400 font-bold">¡Congelado!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Alguien te ha aplicado un Freeze. Espera a que expire.</p>
            </motion.div>
          )}

          {shieldBlocked && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="mt-6 rounded-2xl py-5 text-center"
              style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.35)' }}>
              <motion.div className="text-5xl mb-2"
                animate={{ scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] }} transition={{ duration: 0.5 }}>🛡️</motion.div>
              <p className="font-bold" style={{ color: '#818cf8' }}>¡Escudo activado!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Tu escudo absorbió el ataque y se ha consumido</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}