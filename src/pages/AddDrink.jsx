import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerContainer, staggerItem } from '../lib/animations'
import { soundDrink, soundSuccess, soundError } from '../lib/sounds'

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

const isMartesEnMadrid = () => {
  const now = new Date()
  const madrid = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
  const dow = madrid.getDay()
  const hour = madrid.getHours()
  return dow === 2 || (dow === 3 && hour < 4)
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

  const isMartes = isMartesEnMadrid()

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [
      { data: drinks },
      { data: members },
      { data: season },
      { data: market },
      { data: powerups },
      { data: walletData },
    ] = await Promise.all([
      supabase.from('drink_types').select('*'),
      supabase.from('league_members').select('league_id').eq('user_id', user.id),
      supabase.rpc('get_active_season'),
      supabase.from('drink_market').select('drink_type_id, price'),
      supabase.from('active_powerups')
        .select('*, powerup_catalog(name, emoji, effect_type)')
        .eq('user_id', user.id).eq('active', true)
        .or('expires_at.is.null,expires_at.gt.now()'),
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
    ])

    setDrinkTypes(drinks || [])
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
    const hasTurbo = activePowerups.some(p =>
      p.powerup_catalog?.effect_type === 'turbo' &&
      p.extra_data?.drink_type_id === drink.id
    )
    const hasGamble = activePowerups.some(p => p.powerup_catalog?.effect_type === 'gamble')
    if (hasGamble) return '?'
    let multiplier = marketMultiplier
    if (isMartes) multiplier *= 2
    if (hasDouble) multiplier *= 2
    if (hasTurbo) multiplier *= 3
    return Math.round(drink.points * multiplier * 10) / 10
  }

  const getMarketTrend = (drinkId) => {
    const price = drinkMarket[drinkId] || 100
    if (price > 110) return { icon: '📈', color: '#10b981' }
    if (price < 90) return { icon: '📉', color: '#ef4444' }
    return { icon: null, color: 'var(--text-muted)' }
  }

  const handleAdd = async () => {
    if (!selectedDrink || leagues.length === 0 || !seasonId) return
    setLoading(true)
    soundDrink()

    const { data, error } = await supabase.rpc('add_drink_with_effects', {
      p_drink_type_id: selectedDrink,
      p_season_id: seasonId,
      p_league_ids: leagues,
      p_drink_group_id: generateUUID(),
    })

    if (error || !data?.success) {
      if (data?.frozen) {
        if (data?.shield_blocked) {
          setShieldBlocked(true)
          soundSuccess()
          setTimeout(() => setShieldBlocked(false), 3000)
        } else {
          setFrozen(true)
          soundError()
          setTimeout(() => setFrozen(false), 3000)
        }
      }
      setLoading(false)
      return
    }

    setResult(data)
    setSuccess(true)
    soundSuccess()
    await fetchData()
    setTimeout(() => { setSuccess(false); setResult(null) }, 4000)
    setLoading(false)
    setSelectedDrink(null)
  }

  const isFreezeActive    = activePowerups.some(p => p.powerup_catalog?.effect_type === 'freeze')
  const isInvisibleActive = activePowerups.some(p => p.powerup_catalog?.effect_type === 'invisible')
  const isGambleActive    = activePowerups.some(p => p.powerup_catalog?.effect_type === 'gamble')
  const inDebt = balance < 0

  const getPowerupColor = (effectType) => {
    switch (effectType) {
      case 'shield':    return { bg: 'rgba(99,102,241,0.15)',   color: '#818cf8', border: 'rgba(99,102,241,0.3)' }
      case 'freeze':    return { bg: 'rgba(59,130,246,0.15)',   color: '#60a5fa', border: 'rgba(59,130,246,0.3)' }
      case 'invisible': return { bg: 'rgba(156,163,175,0.15)', color: '#9ca3af', border: 'rgba(156,163,175,0.3)' }
      case 'gamble':    return { bg: 'rgba(168,85,247,0.15)',   color: '#c084fc', border: 'rgba(168,85,247,0.3)' }
      default:          return { bg: 'rgba(245,158,11,0.15)',   color: '#f59e0b', border: 'rgba(245,158,11,0.3)' }
    }
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-md mx-auto">

        <motion.div {...fadeIn}>
          <h1 className="text-2xl font-bold mb-1">Añadir consumición 🍺</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            ¿Qué has tomado? Se anotará en todas tus ligas.
          </p>
        </motion.div>

        {/* ── BANNER MARTES MACARRA ── */}
        <AnimatePresence>
          {isMartes && (
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              className="rounded-2xl p-4 mb-4 relative overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #dc2626)',
                border: '2px solid rgba(255,255,255,0.2)',
                boxShadow: '0 0 30px rgba(124,58,237,0.4)',
              }}>
              {/* Brillo animado */}
              <motion.div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
                animate={{ x: ['-100%', '200%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
              />
              <div className="flex items-center gap-3 relative">
                <motion.div
                  className="text-4xl flex-shrink-0"
                  animate={{ rotate: [-5, 5, -5], scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}>
                  😈
                </motion.div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-white font-black text-lg tracking-tight">MARTES MACARRA</p>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-white/20 text-white">x2</span>
                  </div>
                  <p className="text-white/80 text-xs">
                    ¡Doble de puntos y monedas todo el día! 🍺🍺
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Powerups activos */}
        {activePowerups.length > 0 && (
          <motion.div {...fadeIn} className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {activePowerups.map(ap => {
              const c = getPowerupColor(ap.powerup_catalog?.effect_type)
              return (
                <div key={ap.id}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                  style={{ backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                  <span>{ap.powerup_catalog?.emoji}</span>
                  <span>{ap.powerup_catalog?.name}</span>
                  {ap.extra_data?.uses_left && <span>({ap.extra_data.uses_left} usos)</span>}
                </div>
              )
            })}
          </motion.div>
        )}

        {/* Avisos de estado */}
        <AnimatePresence>
          {inDebt && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-4 mb-4"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.4)' }}>
              <div className="flex items-center gap-3">
                <motion.span className="text-2xl flex-shrink-0"
                  animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  🔴
                </motion.span>
                <div>
                  <p className="font-bold text-red-400 text-sm">Saldo en números rojos · {balance}🪙</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                    Tus monedas van directo a saldar tu deuda con el banco
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {isFreezeActive && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-4 mb-4 text-center"
              style={{ backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)' }}>
              <div className="text-3xl mb-1">🧊</div>
              <p className="font-bold text-blue-400">¡Estás congelado!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>No puedes sumar puntos mientras dure el freeze</p>
            </motion.div>
          )}

          {isInvisibleActive && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-4 mb-4 text-center"
              style={{ backgroundColor: 'rgba(156,163,175,0.15)', border: '1px solid rgba(156,163,175,0.4)' }}>
              <div className="text-3xl mb-1">👻</div>
              <p className="font-bold" style={{ color: '#9ca3af' }}>Modo Invisible activo</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Tus consumiciones aparecen con 0pts pero ganas monedas</p>
            </motion.div>
          )}

          {isGambleActive && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-4 mb-4 text-center"
              style={{ backgroundColor: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)' }}>
              <motion.div className="text-3xl mb-1"
                animate={{ rotate: [0, -10, 10, -5, 0] }} transition={{ repeat: Infinity, duration: 1.5 }}>🎰</motion.div>
              <p className="font-bold" style={{ color: '#c084fc' }}>¡Apuesta activa!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Tu próxima consumición vale x0 o x4 aleatoriamente</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Grid de bebidas */}
        <motion.div variants={staggerContainer} initial="initial" animate="animate"
          className="grid grid-cols-2 gap-3 mb-8">
          {drinkTypes.map(drink => {
            const effectivePoints = getEffectivePoints(drink)
            const basePoints = drink.points
            const isGamble = effectivePoints === '?'
            const isSelected = selectedDrink === drink.id
            const trend = getMarketTrend(drink.id)

            // Puntos base sin martes (para mostrar el original tachado)
            const price = drinkMarket[drink.id] || 100
            const mktMult = Math.max(0.5, Math.min(2.0, price / 100))
            const baseEffective = Math.round(basePoints * mktMult * 10) / 10
            const isModified = !isGamble && Math.abs(effectivePoints - baseEffective) > 0.05

            return (
              <motion.button key={drink.id} variants={staggerItem}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDrink(drink.id)}
                className={`rounded-2xl p-5 text-center transition-all relative ${isSelected ? 'shadow-lg' : ''}`}
                style={isSelected
                  ? { background: isMartes ? 'linear-gradient(135deg, #7c3aed, #dc2626)' : '#f59e0b', color: '#fff' }
                  : { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>

                {/* Badge Martes */}
                {isMartes && (
                  <div className="absolute top-1.5 left-1.5 text-xs font-black px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                    x2
                  </div>
                )}

                {trend.icon && (
                  <div className="absolute top-2 right-2 text-xs">{trend.icon}</div>
                )}

                <motion.div className="text-4xl mb-2"
                  animate={isSelected ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.3 }}>
                  {drink.emoji}
                </motion.div>
                <div className="font-semibold text-sm">{drink.name}</div>

                <div className="mt-1">
                  {isGamble ? (
                    <span className="text-sm font-bold" style={{ color: isSelected ? '#fff' : '#c084fc' }}>
                      🎰 x0 o x4
                    </span>
                  ) : isModified ? (
                    <div>
                      <span className="text-xs line-through mr-1"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.5)' : 'var(--text-hint)' }}>
                        {baseEffective}pts
                      </span>
                      <span className="text-sm font-bold" style={{ color: isSelected ? '#fff' : (isMartes ? '#a78bfa' : '#10b981') }}>
                        {effectivePoints}pts
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-hint)' }}>
                      {basePoints} {basePoints === 1 ? 'punto' : 'puntos'}
                    </div>
                  )}
                  {!isGamble && (
                    <div className="text-xs font-medium mt-0.5"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : inDebt ? '#ef4444' : '#f59e0b' }}>
                      {inDebt ? '→ deuda' : `+${Math.floor(effectivePoints * 10)}🪙`}
                    </div>
                  )}
                </div>
              </motion.button>
            )
          })}
        </motion.div>

        <motion.button onClick={handleAdd}
          disabled={!selectedDrink || loading || leagues.length === 0 || isFreezeActive}
          whileTap={{ scale: 0.97 }}
          whileHover={selectedDrink && !isFreezeActive ? { scale: 1.02 } : {}}
          className="w-full disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-lg transition-all"
          style={{
            background: isMartes
              ? 'linear-gradient(135deg, #7c3aed, #dc2626)'
              : '#f59e0b',
            boxShadow: isMartes ? '0 0 20px rgba(124,58,237,0.4)' : undefined,
          }}>
          {loading ? 'Guardando...' :
           isFreezeActive ? '🧊 Congelado' :
           isGambleActive ? '🎰 ¡Apostar!' :
           leagues.length === 0 ? 'Únete a una liga primero' :
           inDebt ? '🍺 Anotar (monedas → deuda)' :
           isMartes ? '😈 ¡Anotar — Martes Macarra!' :
           '¡Apuntar consumición!'}
        </motion.button>

        {leagues.length === 0 && (
          <motion.p {...fadeIn} className="text-center text-sm mt-3" style={{ color: 'var(--text-hint)' }}>
            Crea o únete a una liga desde la sección 🏆
          </motion.p>
        )}

        {/* Resultados */}
        <AnimatePresence>
          {success && result && !result.gamble_active && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="mt-6 rounded-2xl py-5 px-4 text-center"
              style={result.martes_macarra
                ? { background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(220,38,38,0.2))', border: '2px solid rgba(124,58,237,0.5)' }
                : { backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}>

              <motion.div className="text-5xl mb-2"
                animate={{ rotate: [0, -15, 15, -10, 0], scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6 }}>
                {result.martes_macarra ? '😈' : '🎉'}
              </motion.div>

              {result.martes_macarra && (
                <p className="font-black text-sm mb-1" style={{ color: '#a78bfa' }}>
                  ¡MARTES MACARRA!
                </p>
              )}

              <p className="font-bold text-lg" style={{ color: result.martes_macarra ? '#fff' : '#10b981' }}>
                ¡Consumición anotada!
              </p>

              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-sm px-4">
                  <span style={{ color: 'var(--text-muted)' }}>Puntos base</span>
                  <span className="font-medium">{result.base_points}pts</span>
                </div>
                {result.market_multiplier !== 1 && (
                  <div className="flex justify-between text-sm px-4">
                    <span style={{ color: 'var(--text-muted)' }}>Mercado</span>
                    <span className={`font-medium ${result.market_multiplier > 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      x{result.market_multiplier}
                    </span>
                  </div>
                )}
                {result.martes_macarra && (
                  <div className="flex justify-between text-sm px-4">
                    <span style={{ color: 'var(--text-muted)' }}>😈 Martes Macarra</span>
                    <span className="font-bold text-purple-400">x2</span>
                  </div>
                )}
                {result.double_active && (
                  <div className="flex justify-between text-sm px-4">
                    <span style={{ color: 'var(--text-muted)' }}>🔥 Racha Doble</span>
                    <span className="font-medium text-amber-400">x2</span>
                  </div>
                )}
                {result.turbo_active && (
                  <div className="flex justify-between text-sm px-4">
                    <span style={{ color: 'var(--text-muted)' }}>⚡ Turbo</span>
                    <span className="font-medium text-amber-400">x3</span>
                  </div>
                )}
                {result.invisible_active && (
                  <div className="flex justify-between text-sm px-4">
                    <span style={{ color: 'var(--text-muted)' }}>👻 Invisible</span>
                    <span className="font-medium" style={{ color: '#9ca3af' }}>0pts visibles</span>
                  </div>
                )}
                <div className="border-t mt-2 pt-2 flex justify-between text-sm px-4"
                  style={{ borderColor: result.martes_macarra ? 'rgba(124,58,237,0.4)' : 'rgba(16,185,129,0.3)' }}>
                  <span className="font-bold" style={{ color: result.martes_macarra ? '#a78bfa' : '#10b981' }}>Total</span>
                  <span className="font-bold" style={{ color: result.martes_macarra ? '#a78bfa' : '#10b981' }}>
                    {result.final_points}pts
                  </span>
                </div>
              </div>

              <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="font-bold mt-3 text-lg"
                style={{ color: inDebt ? '#ef4444' : result.martes_macarra ? '#a78bfa' : '#f59e0b' }}>
                {inDebt ? `${result.coins}🪙 → reduciendo deuda` : `+${result.coins}🪙`}
              </motion.p>
              <p className="text-xs mt-2" style={{ color: 'var(--text-hint)' }}>
                Anotado en {leagues.length} {leagues.length === 1 ? 'liga' : 'ligas'}
              </p>
            </motion.div>
          )}

          {/* Resultado apuesta */}
          {success && result && result.gamble_active && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="mt-6 rounded-2xl py-6 px-4 text-center"
              style={{
                backgroundColor: result.gamble_win ? 'rgba(168,85,247,0.15)' : 'rgba(239,68,68,0.12)',
                border: `2px solid ${result.gamble_win ? '#a855f7' : '#ef4444'}`,
              }}>
              <motion.div className="text-6xl mb-3"
                animate={{ rotate: result.gamble_win ? [0, -20, 20, -10, 0] : [0, -5, 5, 0] }}
                transition={{ duration: 0.6 }}>
                {result.gamble_win ? '🎰' : '💀'}
              </motion.div>
              <p className="font-bold text-xl mb-1"
                style={{ color: result.gamble_win ? '#c084fc' : '#ef4444' }}>
                {result.gamble_win ? '¡JACKPOT! x4 🎉' : '¡MALA SUERTE! x0 😬'}
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {result.gamble_win
                  ? `Has ganado ${result.final_points}pts y ${result.coins}🪙`
                  : 'Esta consumición no ha sumado puntos'}
              </p>
            </motion.div>
          )}

          {/* Freeze */}
          {frozen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="mt-6 rounded-2xl py-5 text-center"
              style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.4)' }}>
              <div className="text-5xl mb-2">🧊</div>
              <p className="text-blue-400 font-bold">¡Estás congelado!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                Alguien te ha aplicado un Freeze. No puntúas hasta que expire.
              </p>
            </motion.div>
          )}

          {/* Escudo bloqueó */}
          {shieldBlocked && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="mt-6 rounded-2xl py-5 text-center"
              style={{ backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.4)' }}>
              <motion.div className="text-5xl mb-2"
                animate={{ scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}>🛡️</motion.div>
              <p className="font-bold" style={{ color: '#818cf8' }}>¡Escudo activado!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                Tu escudo ha absorbido el ataque y se ha consumido
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}