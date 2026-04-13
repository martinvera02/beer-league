import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerItem } from '../lib/animations'
import { soundSuccess, soundError } from '../lib/sounds'

function SparkChart({ history, width = 120, height = 40 }) {
  if (!history || history.length < 2) return null
  const prices = history.map(h => h.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const points = prices.map((p, i) => {
    const x = (i / (prices.length - 1)) * width
    const y = height - ((p - min) / range) * height
    return `${x},${y}`
  }).join(' ')
  const isUp = prices[prices.length - 1] >= prices[0]
  const lineColor = isUp ? '#10b981' : '#ef4444'
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DetailChart({ history, width = 300, height = 120 }) {
  if (!history || history.length < 2) return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Sin historial suficiente</p>
    </div>
  )
  const prices = history.map(h => h.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pad = 20
  const toX = (i) => pad + (i / (prices.length - 1)) * (width - pad * 2)
  const toY = (p) => pad + (height - pad * 2) - ((p - min) / range) * (height - pad * 2)
  const points = prices.map((p, i) => `${toX(i)},${toY(p)}`).join(' ')
  const areaPoints = `${toX(0)},${height - pad} ${points} ${toX(prices.length - 1)},${height - pad}`
  const isUp = prices[prices.length - 1] >= prices[0]
  const lineColor = isUp ? '#10b981' : '#ef4444'
  const current = prices[prices.length - 1]
  const start = prices[0]
  const pct = (((current - start) / start) * 100).toFixed(1)
  return (
    <div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{current.toFixed(0)}🪙</span>
        <span className={`text-sm font-semibold mb-0.5 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(pct)}%
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="area-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
            <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line key={i} x1={pad} y1={pad + (height - pad * 2) * t}
            x2={width - pad} y2={pad + (height - pad * 2) * t}
            stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3" />
        ))}
        <polygon points={areaPoints} fill="url(#area-grad)" />
        <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={toX(prices.length - 1)} cy={toY(current)} r="4" fill={lineColor} />
        <text x={pad - 4} y={pad + 4} textAnchor="end" fontSize="9" fill="var(--text-hint)">{max.toFixed(0)}</text>
        <text x={pad - 4} y={height - pad + 4} textAnchor="end" fontSize="9" fill="var(--text-hint)">{min.toFixed(0)}</text>
      </svg>
    </div>
  )
}

export default function Market() {
  const { user } = useAuth()
  const [tab, setTab] = useState('market')
  const [balance, setBalance] = useState(0)
  const [drinkMarket, setDrinkMarket] = useState([])
  const [drinkTypes, setDrinkTypes] = useState([])
  const [powerups, setPowerups] = useState([])
  const [myPowerups, setMyPowerups] = useState([])
  const [myPositions, setMyPositions] = useState([])
  const [leagues, setLeagues] = useState([])
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [loading, setLoading] = useState(true)

  const [selectedDrink, setSelectedDrink] = useState(null)
  const [drinkHistory, setDrinkHistory] = useState([])
  const [tradeDirection, setTradeDirection] = useState('long')
  const [tradeAmount, setTradeAmount] = useState(10)
  const [trading, setTrading] = useState(false)

  const [selectedPowerup, setSelectedPowerup] = useState(null)
  const [targetUser, setTargetUser] = useState(null)
  const [turboDrink, setTurboDrink] = useState(null)
  const [leagueMembers, setLeagueMembers] = useState([])
  const [buying, setBuying] = useState(false)

  const [closingPosition, setClosingPosition] = useState(null)
  const [closeResult, setCloseResult] = useState(null)

  useEffect(() => { fetchAll() }, [])
  useEffect(() => { if (selectedLeague) fetchLeagueMembers(selectedLeague.id) }, [selectedLeague])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: walletData },
      { data: marketData },
      { data: drinkTypesData },
      { data: powerupData },
      { data: myPowerupData },
      { data: positionData },
      { data: leagueData },
    ] = await Promise.all([
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
      supabase.from('drink_market').select('*, drink_types(name, emoji, points)').order('drink_type_id'),
      supabase.from('drink_types').select('*').order('points', { ascending: false }),
      supabase.from('powerup_catalog').select('*').eq('active', true),
      supabase.from('active_powerups')
        .select('*, powerup_catalog(name, emoji, description, effect_type)')
        .eq('user_id', user.id).eq('active', true)
        .or('expires_at.is.null,expires_at.gt.now()'),
      supabase.from('market_positions')
        .select('*, drink_types(name, emoji)').eq('user_id', user.id).eq('closed', false),
      supabase.from('league_members').select('league_id, leagues(id, name)').eq('user_id', user.id),
    ])

    setBalance(walletData?.balance || 0)
    setDrinkTypes(drinkTypesData || [])
    setPowerups(powerupData || [])
    setMyPowerups(myPowerupData || [])
    setMyPositions(positionData || [])

    const userLeagues = leagueData?.map(d => d.leagues) || []
    setLeagues(userLeagues)
    if (userLeagues.length > 0 && !selectedLeague) setSelectedLeague(userLeagues[0])

    const { data: histData } = await supabase
      .from('drink_market_history').select('*').order('recorded_at', { ascending: true })

    if (histData) {
      const grouped = histData.reduce((acc, h) => {
        if (!acc[h.drink_type_id]) acc[h.drink_type_id] = []
        acc[h.drink_type_id].push(h)
        return acc
      }, {})
      setDrinkMarket((marketData || []).map(d => ({ ...d, history: grouped[d.drink_type_id] || [] })))
    } else {
      setDrinkMarket(marketData || [])
    }

    setLoading(false)
  }

  const fetchLeagueMembers = async (leagueId) => {
    const { data } = await supabase
      .from('league_members').select('profiles(id, username, avatar_url)')
      .eq('league_id', leagueId).neq('user_id', user.id)
    setLeagueMembers(data?.map(d => d.profiles) || [])
  }

  const openDrinkDetail = async (drink) => {
    setSelectedDrink(drink)
    setTradeAmount(10)
    setTradeDirection('long')
    const { data } = await supabase
      .from('drink_market_history').select('*')
      .eq('drink_type_id', drink.drink_type_id)
      .order('recorded_at', { ascending: true }).limit(50)
    setDrinkHistory(data || [])
  }

  const executeTrade = async () => {
    if (!selectedDrink || tradeAmount < 10 || tradeAmount > balance) return
    setTrading(true)
    const result = await supabase.rpc('open_market_position', {
      p_user_id: user.id,
      p_drink_type_id: selectedDrink.drink_type_id,
      p_direction: tradeDirection,
      p_amount: tradeAmount,
    })
    if (result.data?.success) {
      soundSuccess()
      setBalance(prev => prev - tradeAmount)
      setSelectedDrink(null)
      fetchAll()
    } else { soundError() }
    setTrading(false)
  }

  const executeClosePosition = async (positionId) => {
    setClosingPosition(positionId)
    const { data } = await supabase.rpc('close_market_position', {
      p_user_id: user.id,
      p_position_id: positionId,
    })
    if (data?.success) {
      soundSuccess()
      setCloseResult(data)
      setTimeout(() => setCloseResult(null), 3000)
      fetchAll()
    } else { soundError() }
    setClosingPosition(null)
  }

  const executeBuyPowerup = async () => {
    if (!selectedPowerup || !selectedLeague) return
    const needsTarget = ['freeze'].includes(selectedPowerup.effect_type)
    if (needsTarget && !targetUser) return
    const needsTurboDrink = selectedPowerup.effect_type === 'turbo'
    if (needsTurboDrink && !turboDrink) return

    setBuying(true)

    let extraData = {}
    if (needsTurboDrink) extraData.drink_type_id = turboDrink

    const result = await supabase.rpc('buy_powerup', {
      p_user_id: user.id,
      p_target_user_id: targetUser?.id || user.id,
      p_league_id: selectedLeague.id,
      p_powerup_id: selectedPowerup.id,
      p_extra_data: extraData,
    })

    if (result.data?.success) {
      soundSuccess()
      setBalance(prev => prev - selectedPowerup.cost)
      setSelectedPowerup(null)
      setTargetUser(null)
      setTurboDrink(null)
      fetchAll()
    } else { soundError() }
    setBuying(false)
  }

  const formatTime = (ts) => {
    if (!ts) return 'Permanente'
    const diff = new Date(ts) - Date.now()
    if (diff <= 0) return 'Expirado'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  const needsTarget = selectedPowerup && ['freeze'].includes(selectedPowerup.effect_type)
  const needsTurboDrink = selectedPowerup?.effect_type === 'turbo'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="text-center">
        <motion.div className="text-5xl mb-3" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>🪙</motion.div>
        <p style={{ color: 'var(--text-muted)' }}>Cargando mercado...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Mercado 📈</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Invierte, especula y destruye a tus amigos</p>
          </div>
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.3 }} key={balance}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl"
            style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <span className="text-lg">🪙</span>
            <span className="font-bold text-amber-400 text-lg">{balance.toLocaleString()}</span>
          </motion.div>
        </div>

        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
          {[
            { id: 'market',    label: '📈 Cotización' },
            { id: 'powerups',  label: '⚡ Tienda' },
            { id: 'portfolio', label: '💼 Cartera' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10"
              style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {tab === t.id && (
                <motion.div layoutId="market-tab" className="absolute inset-0 bg-amber-500 rounded-lg"
                  style={{ zIndex: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── COTIZACIÓN ── */}
      {tab === 'market' && (
        <div className="px-4 pt-4 max-w-md mx-auto">
          <p className="text-xs mb-2 font-medium" style={{ color: 'var(--text-muted)' }}>
            El precio afecta a los puntos que ganas. Precio {'>'} 100 = más puntos, {'<'} 100 = menos puntos.
          </p>
          <div className="rounded-xl p-3 mb-4 flex gap-4 text-xs"
            style={{ backgroundColor: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <span>📈 x0.5 — x2.0 multiplicador</span>
            <span className="text-emerald-400">Precio 200 = x2 pts</span>
            <span className="text-red-400">Precio 50 = x0.5 pts</span>
          </div>

          <div className="space-y-3">
            {drinkMarket.map((drink) => {
              const isUp = drink.history?.length > 1 ? drink.price >= drink.history[0]?.price : true
              const pct = drink.history?.length > 1
                ? (((drink.price - drink.history[0].price) / drink.history[0].price) * 100).toFixed(1)
                : '0.0'
              const multiplier = Math.max(0.5, Math.min(2.0, drink.price / 100))
              const effectivePoints = Math.round(drink.drink_types?.points * multiplier * 10) / 10

              return (
                <motion.button key={drink.id} variants={staggerItem} initial="initial" animate="animate"
                  whileTap={{ scale: 0.98 }} onClick={() => openDrinkDetail(drink)}
                  className="w-full rounded-2xl p-4 text-left" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: 'var(--bg-input)' }}>
                      {drink.drink_types?.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{drink.drink_types?.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs" style={{ color: 'var(--text-hint)' }}>
                          Base: {drink.drink_types?.points}pts
                        </span>
                        <span className="text-xs font-bold" style={{ color: multiplier > 1 ? '#10b981' : multiplier < 1 ? '#ef4444' : 'var(--text-muted)' }}>
                          → {effectivePoints}pts ahora
                        </span>
                      </div>
                    </div>
                    <div className="flex-shrink-0">
                      <SparkChart history={drink.history} width={80} height={32} />
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="font-bold text-sm">{parseFloat(drink.price).toFixed(0)}🪙</p>
                      <p className={`text-xs font-semibold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isUp ? '▲' : '▼'} {Math.abs(pct)}%
                      </p>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TIENDA POWERUPS ── */}
      {tab === 'powerups' && (
        <div className="px-4 pt-4 max-w-md mx-auto">
          {leagues.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Liga donde se aplicará</p>
              <div className="flex gap-2 flex-wrap">
                {leagues.map(l => (
                  <motion.button key={l.id} whileTap={{ scale: 0.95 }} onClick={() => setSelectedLeague(l)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${selectedLeague?.id === l.id ? 'bg-amber-500 text-white' : ''}`}
                    style={selectedLeague?.id !== l.id ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' } : {}}>
                    {l.name}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          {myPowerups.length > 0 && (
            <div className="mb-5">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Tus powerups activos</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {myPowerups.map(ap => (
                  <div key={ap.id} className="flex-shrink-0 rounded-2xl px-3 py-2 text-center"
                    style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}>
                    <div className="text-2xl mb-1">{ap.powerup_catalog?.emoji}</div>
                    <p className="text-xs font-semibold text-amber-400">{ap.powerup_catalog?.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{formatTime(ap.expires_at)}</p>
                    {ap.extra_data?.uses_left && (
                      <p className="text-xs mt-0.5 text-amber-400">{ap.extra_data.uses_left} usos</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Catálogo</p>
          <div className="space-y-3">
            {powerups.map(pw => {
              const canAfford = balance >= pw.cost
              return (
                <motion.div key={pw.id} variants={staggerItem} initial="initial" animate="animate"
                  className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', opacity: canAfford ? 1 : 0.6 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: 'var(--bg-input)' }}>
                      {pw.emoji}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{pw.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{pw.description}</p>
                      {pw.duration_hours && (
                        <p className="text-xs mt-0.5 text-amber-400">⏱ {pw.duration_hours}h de efecto</p>
                      )}
                    </div>
                    <motion.button whileTap={{ scale: 0.9 }}
                      disabled={!canAfford || !selectedLeague}
                      onClick={() => setSelectedPowerup(pw)}
                      className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                      style={{
                        backgroundColor: canAfford ? '#f59e0b' : 'var(--bg-input)',
                        color: canAfford ? '#fff' : 'var(--text-hint)',
                      }}>
                      {pw.cost}🪙
                    </motion.button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CARTERA ── */}
      {tab === 'portfolio' && (
        <div className="px-4 pt-4 max-w-md mx-auto">

          <motion.div {...fadeIn} className="rounded-2xl p-6 mb-4 text-center"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Saldo disponible</p>
            <p className="text-5xl font-bold text-amber-400">{balance.toLocaleString()}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>🪙 Cervezas</p>
          </motion.div>

          <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm font-bold mb-1">¿Cómo ganar 🪙?</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-hint)' }}>
              1 punto = 10🪙 base. El precio del mercado multiplica los puntos (y las monedas).
            </p>
            <div className="space-y-2">
              {drinkTypes.map(drink => {
                const marketDrink = drinkMarket.find(d => d.drink_type_id === drink.id)
                const price = marketDrink?.price || 100
                const multiplier = Math.max(0.5, Math.min(2.0, price / 100))
                const effectivePoints = Math.round(drink.points * multiplier * 10) / 10
                const coins = Math.floor(effectivePoints * 10)
                const isModified = Math.abs(multiplier - 1) > 0.05

                return (
                  <motion.div key={drink.id} variants={staggerItem} initial="initial" animate="animate"
                    className="flex justify-between items-center py-2 border-b last:border-0"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{drink.emoji}</span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{drink.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isModified && (
                        <span className="text-xs" style={{ color: 'var(--text-hint)' }}>
                          x{multiplier.toFixed(1)}
                        </span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' }}>
                        {effectivePoints}pts
                      </span>
                      <span className="text-sm font-bold"
                        style={{ color: multiplier > 1 ? '#10b981' : multiplier < 1 ? '#ef4444' : '#f59e0b' }}>
                        +{coins}🪙
                      </span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Resultado cierre */}
          <AnimatePresence>
            {closeResult && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-4 mb-4 text-center"
                style={{ backgroundColor: closeResult.pnl >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${closeResult.pnl >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                <p className="font-bold" style={{ color: closeResult.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                  {closeResult.pnl >= 0 ? '🎉 Ganancia' : '📉 Pérdida'}: {closeResult.pnl >= 0 ? '+' : ''}{closeResult.pnl}🪙
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                  Entrada: {parseFloat(closeResult.entry_price).toFixed(0)}🪙 → Salida: {parseFloat(closeResult.exit_price).toFixed(0)}🪙
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Posiciones abiertas */}
          <p className="text-sm font-bold mb-3">Posiciones abiertas</p>
          {myPositions.length === 0 ? (
            <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
              <div className="text-4xl mb-2">📊</div>
              <p className="text-sm">Sin posiciones abiertas</p>
              <p className="text-xs mt-1">Ve a Cotización para invertir</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myPositions.map(pos => {
                const currentMarket = drinkMarket.find(d => d.drink_type_id === pos.drink_type_id)
                const currentPrice = currentMarket?.price || pos.entry_price
                const pnl = pos.direction === 'long'
                  ? Math.floor(pos.amount * ((currentPrice - pos.entry_price) / pos.entry_price))
                  : Math.floor(pos.amount * ((pos.entry_price - currentPrice) / pos.entry_price))
                const isProfit = pnl >= 0
                return (
                  <motion.div key={pos.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: 'var(--bg-input)' }}>
                        {pos.drink_types?.emoji}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-sm">{pos.drink_types?.name}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pos.direction === 'long' ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'}`}>
                            {pos.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                          Invertido: {pos.amount}🪙 · Entrada: {parseFloat(pos.entry_price).toFixed(0)}🪙
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfit ? '+' : ''}{pnl}🪙
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                          Ahora: {parseFloat(currentPrice).toFixed(0)}🪙
                        </p>
                      </div>
                    </div>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => executeClosePosition(pos.id)}
                      disabled={closingPosition === pos.id}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold transition-colors"
                      style={{
                        backgroundColor: isProfit ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: isProfit ? '#10b981' : '#ef4444',
                        border: `1px solid ${isProfit ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      }}>
                      {closingPosition === pos.id ? 'Cerrando...' : `Cerrar posición (${isProfit ? '+' : ''}${pnl}🪙)`}
                    </motion.button>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal detalle bebida + trading */}
      <AnimatePresence>
        {selectedDrink && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
            onClick={() => setSelectedDrink(null)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="rounded-t-3xl p-6 w-full max-w-lg"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>

              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedDrink.drink_types?.emoji}</span>
                  <div>
                    <h2 className="text-lg font-bold">{selectedDrink.drink_types?.name}</h2>
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Vol: {selectedDrink.volume?.toLocaleString()}🪙</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelectedDrink(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
              </div>

              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
                <DetailChart history={drinkHistory} width={320} height={140} />
              </div>

              <div className="mb-4">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Dirección</p>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTradeDirection('long')}
                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors"
                    style={{
                      backgroundColor: tradeDirection === 'long' ? 'rgba(16,185,129,0.2)' : 'var(--bg-input)',
                      color: tradeDirection === 'long' ? '#10b981' : 'var(--text-muted)',
                      border: tradeDirection === 'long' ? '2px solid #10b981' : '2px solid transparent',
                    }}>▲ LONG (sube)</motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTradeDirection('short')}
                    className="flex-1 py-3 rounded-xl font-bold text-sm transition-colors"
                    style={{
                      backgroundColor: tradeDirection === 'short' ? 'rgba(239,68,68,0.2)' : 'var(--bg-input)',
                      color: tradeDirection === 'short' ? '#ef4444' : 'var(--text-muted)',
                      border: tradeDirection === 'short' ? '2px solid #ef4444' : '2px solid transparent',
                    }}>▼ SHORT (baja)</motion.button>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cantidad a invertir</p>
                  <p className="text-xs text-amber-400 font-bold">{tradeAmount}🪙 / {balance}🪙</p>
                </div>
                <input type="range" min="10" max={Math.min(balance, 500)} step="10"
                  value={tradeAmount} onChange={e => setTradeAmount(Number(e.target.value))}
                  className="w-full accent-amber-500" />
                <div className="flex justify-between mt-2 gap-2">
                  {[10, 50, 100, 250].map(v => (
                    <motion.button key={v} whileTap={{ scale: 0.9 }}
                      onClick={() => setTradeAmount(Math.min(v, balance))}
                      className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                      style={{
                        backgroundColor: tradeAmount === v ? '#f59e0b' : 'var(--bg-input)',
                        color: tradeAmount === v ? '#fff' : 'var(--text-muted)',
                      }}>
                      {v}
                    </motion.button>
                  ))}
                </div>
              </div>

              <p className="text-xs mb-3 text-center" style={{ color: 'var(--text-hint)' }}>
                {tradeDirection === 'long'
                  ? `▲ El precio subirá ~${(tradeAmount / 100).toFixed(1)}🪙 → más puntos al beberla`
                  : `▼ El precio bajará ~${(tradeAmount / 100).toFixed(1)}🪙 → menos puntos al beberla`}
              </p>

              <motion.button whileTap={{ scale: 0.97 }} onClick={executeTrade}
                disabled={trading || tradeAmount > balance || tradeAmount < 10}
                className="w-full font-bold py-4 rounded-2xl text-white transition-colors"
                style={{ backgroundColor: tradeDirection === 'long' ? '#10b981' : '#ef4444' }}>
                {trading ? 'Ejecutando...' : `${tradeDirection === 'long' ? '▲ Comprar LONG' : '▼ Vender SHORT'} · ${tradeAmount}🪙`}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal comprar powerup */}
      <AnimatePresence>
        {selectedPowerup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
            onClick={() => { setSelectedPowerup(null); setTargetUser(null); setTurboDrink(null) }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="rounded-t-3xl p-6 w-full max-w-lg"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '85vh', overflowY: 'auto' }}>

              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedPowerup.emoji}</span>
                  <div>
                    <h2 className="text-lg font-bold">{selectedPowerup.name}</h2>
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{selectedPowerup.description}</p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setSelectedPowerup(null); setTargetUser(null); setTurboDrink(null) }}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
              </div>

              {/* Selector objetivo para Freeze */}
              {needsTarget && (
                <div className="mb-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    Selecciona a quién congelar en {selectedLeague?.name}
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {leagueMembers.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: 'var(--text-hint)' }}>No hay otros miembros</p>
                    ) : leagueMembers.map(member => (
                      <motion.button key={member.id} whileTap={{ scale: 0.97 }}
                        onClick={() => setTargetUser(member)}
                        className="w-full rounded-xl p-3 flex items-center gap-3"
                        style={{
                          backgroundColor: targetUser?.id === member.id ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)',
                          border: targetUser?.id === member.id ? '2px solid #f59e0b' : '2px solid transparent',
                        }}>
                        {member.avatar_url
                          ? <img src={member.avatar_url} alt={member.username} className="w-8 h-8 rounded-full object-cover" />
                          : <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card)' }}>🍺</div>
                        }
                        <span className="text-sm font-medium">{member.username}</span>
                        {targetUser?.id === member.id && <span className="ml-auto text-amber-400">✓</span>}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {/* Selector bebida para Turbo */}
              {needsTurboDrink && (
                <div className="mb-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    ¿A qué bebida aplicar el Turbo x3?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {drinkTypes.map(drink => (
                      <motion.button key={drink.id} whileTap={{ scale: 0.95 }}
                        onClick={() => setTurboDrink(drink.id)}
                        className="rounded-xl p-3 flex items-center gap-2"
                        style={{
                          backgroundColor: turboDrink === drink.id ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)',
                          border: turboDrink === drink.id ? '2px solid #f59e0b' : '2px solid transparent',
                        }}>
                        <span className="text-xl">{drink.emoji}</span>
                        <span className="text-xs font-medium">{drink.name}</span>
                        {turboDrink === drink.id && <span className="ml-auto text-amber-400 text-xs">✓</span>}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between p-4 rounded-2xl mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Coste</span>
                <span className="font-bold text-amber-400 text-lg">{selectedPowerup.cost}🪙</span>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={executeBuyPowerup}
                disabled={
                  buying || balance < selectedPowerup.cost ||
                  (needsTarget && !targetUser) ||
                  (needsTurboDrink && !turboDrink)
                }
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-bold py-4 rounded-2xl transition-colors">
                {buying ? 'Activando...' : `Activar · ${selectedPowerup.cost}🪙`}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}