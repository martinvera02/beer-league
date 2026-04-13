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
  const [sabotageBlocked, setSabotageBlocked] = useState(false)
  const [sabotageMsg, setSabotageMsg] = useState('')
  const [result, setResult] = useState(null)
  const [activePowerups, setActivePowerups] = useState([])

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [
      { data: drinks },
      { data: members },
      { data: season },
      { data: market },
      { data: powerups },
    ] = await Promise.all([
      supabase.from('drink_types').select('*'),
      supabase.from('league_members').select('league_id').eq('user_id', user.id),
      supabase.rpc('get_active_season'),
      supabase.from('drink_market').select('drink_type_id, price'),
      supabase.from('active_powerups')
        .select('*, powerup_catalog(name, emoji, effect_type)')
        .eq('user_id', user.id)
        .eq('active', true)
        .or('expires_at.is.null,expires_at.gt.now()'),
    ])

    setDrinkTypes(drinks || [])
    setLeagues(members?.map(m => m.league_id) || [])
    setSeasonId(season?.id || null)
    setActivePowerups(powerups || [])

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
    let multiplier = marketMultiplier
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

    const drinkGroupId = generateUUID()

    const { data, error } = await supabase.rpc('add_drink_with_effects', {
      p_user_id: user.id,
      p_drink_type_id: selectedDrink,
      p_season_id: seasonId,
      p_league_ids: leagues,
      p_drink_group_id: drinkGroupId,
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
    setTimeout(() => {
      setSuccess(false)
      setResult(null)
    }, 3000)
    setLoading(false)
    setSelectedDrink(null)
  }

  const isFreezeActive = activePowerups.some(p =>
    p.powerup_catalog?.effect_type === 'freeze'
  )

  const hasShield = activePowerups.some(p =>
    p.powerup_catalog?.effect_type === 'shield'
  )

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

        {/* Powerups activos */}
        {activePowerups.length > 0 && (
          <motion.div {...fadeIn} className="flex gap-2 overflow-x-auto pb-2 mb-4">
            {activePowerups.map(ap => (
              <div key={ap.id}
                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: ap.powerup_catalog?.effect_type === 'shield'
                    ? 'rgba(99,102,241,0.15)' : 'rgba(245,158,11,0.15)',
                  color: ap.powerup_catalog?.effect_type === 'shield' ? '#818cf8' : '#f59e0b',
                  border: `1px solid ${ap.powerup_catalog?.effect_type === 'shield' ? 'rgba(99,102,241,0.3)' : 'rgba(245,158,11,0.3)'}`,
                }}>
                <span>{ap.powerup_catalog?.emoji}</span>
                <span>{ap.powerup_catalog?.name}</span>
                {ap.extra_data?.uses_left && <span>({ap.extra_data.uses_left} usos)</span>}
              </div>
            ))}
          </motion.div>
        )}

        {/* Aviso freeze */}
        <AnimatePresence>
          {isFreezeActive && !shieldBlocked && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="rounded-2xl p-4 mb-4 text-center"
              style={{ backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)' }}>
              <div className="text-3xl mb-1">🧊</div>
              <p className="font-bold text-blue-400">¡Estás congelado!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                No puedes sumar puntos mientras dure el freeze
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div variants={staggerContainer} initial="initial" animate="animate"
          className="grid grid-cols-2 gap-3 mb-8">
          {drinkTypes.map(drink => {
            const effectivePoints = getEffectivePoints(drink)
            const basePoints = drink.points
            const isModified = Math.abs(effectivePoints - basePoints) > 0.05
            const trend = getMarketTrend(drink.id)
            const isSelected = selectedDrink === drink.id

            return (
              <motion.button
                key={drink.id}
                variants={staggerItem}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedDrink(drink.id)}
                className={`rounded-2xl p-5 text-center transition-all relative ${
                  isSelected ? 'bg-amber-500 shadow-lg shadow-amber-900' : ''
                }`}
                style={!isSelected ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' } : {}}
              >
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
                  {isModified ? (
                    <div>
                      <span className="text-xs line-through mr-1"
                        style={{ color: isSelected ? 'rgba(255,255,255,0.5)' : 'var(--text-hint)' }}>
                        {basePoints}pts
                      </span>
                      <span className="text-sm font-bold"
                        style={{ color: isSelected ? '#fff' : '#10b981' }}>
                        {effectivePoints}pts
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs"
                      style={{ color: isSelected ? 'rgba(255,255,255,0.8)' : 'var(--text-hint)' }}>
                      {basePoints} {basePoints === 1 ? 'punto' : 'puntos'}
                    </div>
                  )}
                  <div className="text-xs font-medium mt-0.5"
                    style={{ color: isSelected ? 'rgba(255,255,255,0.9)' : '#f59e0b' }}>
                    +{Math.floor(effectivePoints * 10)}🪙
                  </div>
                </div>
              </motion.button>
            )
          })}
        </motion.div>

        <motion.button
          onClick={handleAdd}
          disabled={!selectedDrink || loading || leagues.length === 0 || isFreezeActive}
          whileTap={{ scale: 0.97 }}
          whileHover={selectedDrink && !isFreezeActive ? { scale: 1.02 } : {}}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-lg transition-colors"
        >
          {loading ? 'Guardando...' :
           isFreezeActive ? '🧊 Congelado' :
           leagues.length === 0 ? 'Únete a una liga primero' :
           '¡Apuntar consumición!'}
        </motion.button>

        {leagues.length === 0 && (
          <motion.p {...fadeIn} className="text-center text-sm mt-3" style={{ color: 'var(--text-hint)' }}>
            Crea o únete a una liga desde la sección 🏆
          </motion.p>
        )}

        <AnimatePresence>
          {/* Éxito con desglose */}
          {success && result && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="mt-6 rounded-2xl py-5 px-4 text-center"
              style={{ backgroundColor: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)' }}
            >
              <motion.div className="text-5xl mb-2"
                animate={{ rotate: [0, -15, 15, -10, 0], scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6 }}>
                🎉
              </motion.div>
              <p className="text-emerald-400 font-bold text-lg">¡Consumición anotada!</p>

              <div className="mt-3 space-y-1.5">
                <div className="flex justify-between text-sm px-4">
                  <span style={{ color: 'var(--text-muted)' }}>Puntos base</span>
                  <span className="font-medium">{result.base_points} pts</span>
                </div>
                {result.market_multiplier !== 1 && (
                  <div className="flex justify-between text-sm px-4">
                    <span style={{ color: 'var(--text-muted)' }}>Mercado</span>
                    <span className={`font-medium ${result.market_multiplier > 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                      x{result.market_multiplier}
                    </span>
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
                <div className="border-t mt-2 pt-2 flex justify-between text-sm px-4"
                  style={{ borderColor: 'rgba(16,185,129,0.3)' }}>
                  <span className="font-bold text-emerald-400">Total</span>
                  <span className="font-bold text-emerald-400">{result.final_points} pts</span>
                </div>
              </div>

              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-amber-400 font-bold mt-3 text-lg"
              >
                +{result.coins}🪙
              </motion.p>

              <p className="text-xs mt-2" style={{ color: 'var(--text-hint)' }}>
                Anotado en {leagues.length} {leagues.length === 1 ? 'liga' : 'ligas'}
              </p>
            </motion.div>
          )}

          {/* Freeze activo al intentar añadir */}
          {frozen && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="mt-6 rounded-2xl py-5 text-center"
              style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.4)' }}
            >
              <div className="text-5xl mb-2">🧊</div>
              <p className="text-blue-400 font-bold">¡Estás congelado!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                Alguien te ha aplicado un Freeze. No puntúas hasta que expire.
              </p>
            </motion.div>
          )}

          {/* Escudo bloqueó el freeze */}
          {shieldBlocked && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="mt-6 rounded-2xl py-5 text-center"
              style={{ backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.4)' }}
            >
              <motion.div className="text-5xl mb-2"
                animate={{ scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] }}
                transition={{ duration: 0.5 }}>
                🛡️
              </motion.div>
              <p className="font-bold" style={{ color: '#818cf8' }}>¡Escudo activado!</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                Tu escudo ha absorbido el Freeze y se ha consumido
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}