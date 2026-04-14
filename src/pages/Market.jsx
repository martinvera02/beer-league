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
  const multipliers = prices.map(p => Math.max(0.5, Math.min(2.0, p / 100)))
  const min = Math.min(...multipliers)
  const max = Math.max(...multipliers)
  const range = max - min || 0.1
  const pad = 24
  const toX = (i) => pad + (i / (multipliers.length - 1)) * (width - pad * 2)
  const toY = (m) => pad + (height - pad * 2) - ((m - min) / range) * (height - pad * 2)
  const points = multipliers.map((m, i) => `${toX(i)},${toY(m)}`).join(' ')
  const areaPoints = `${toX(0)},${height - pad} ${points} ${toX(multipliers.length - 1)},${height - pad}`
  const current = multipliers[multipliers.length - 1]
  const start = multipliers[0]
  const isUp = current >= start
  const lineColor = isUp ? '#10b981' : '#ef4444'
  const pct = (((current - start) / start) * 100).toFixed(1)
  return (
    <div>
      <div className="flex items-end gap-3 mb-3">
        <div>
          <p className="text-xs mb-0.5" style={{ color: 'var(--text-hint)' }}>Multiplicador actual</p>
          <p className="text-3xl font-bold"
            style={{ color: current > 1 ? '#10b981' : current < 1 ? '#ef4444' : 'var(--text-primary)' }}>
            x{current.toFixed(2)}
          </p>
        </div>
        <span className={`text-sm font-semibold mb-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
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
        <circle cx={toX(multipliers.length - 1)} cy={toY(current)} r="4" fill={lineColor} />
        <text x={pad - 4} y={pad + 4} textAnchor="end" fontSize="9" fill="var(--text-hint)">x{max.toFixed(1)}</text>
        <text x={pad - 4} y={height - pad + 4} textAnchor="end" fontSize="9" fill="var(--text-hint)">x{min.toFixed(1)}</text>
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
  const [resetDrink, setResetDrink] = useState(null)
  const [leagueMembers, setLeagueMembers] = useState([])
  const [buying, setBuying] = useState(false)
  const [buyResult, setBuyResult] = useState(null)

  const [closingPosition, setClosingPosition] = useState(null)
  const [closeResult, setCloseResult] = useState(null)

  // Banco
  const [activeLoan, setActiveLoan] = useState(null)
  const [loanDebt, setLoanDebt] = useState(null)
  const [loanAmount, setLoanAmount] = useState(100)
  const [loanDays, setLoanDays] = useState(3)
  const [requesting, setRequesting] = useState(false)
  const [repaying, setRepaying] = useState(false)
  const [loanResult, setLoanResult] = useState(null)
  const [loanHistory, setLoanHistory] = useState([])

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
      { data: loanData },
      { data: loanHistoryData },
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
      supabase.from('bank_loans').select('*').eq('user_id', user.id)
        .in('status', ['active', 'defaulted']).maybeSingle(),
      supabase.from('bank_loans').select('*').eq('user_id', user.id)
        .in('status', ['repaid', 'defaulted']).order('created_at', { ascending: false }).limit(5),
    ])

    setBalance(walletData?.balance || 0)
    setDrinkTypes(drinkTypesData || [])
    setPowerups(powerupData || [])
    setMyPowerups(myPowerupData || [])
    setMyPositions(positionData || [])
    setActiveLoan(loanData || null)
    setLoanHistory(loanHistoryData || [])

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

    if (loanData) {
      const { data: debtData } = await supabase.rpc('get_current_debt', { p_loan_id: loanData.id })
      setLoanDebt(debtData)
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
    const needsTarget = ['freeze', 'sniper', 'sabotage'].includes(selectedPowerup.effect_type)
    if (needsTarget && !targetUser) return
    const needsTurboDrink = selectedPowerup.effect_type === 'turbo'
    if (needsTurboDrink && !turboDrink) return
    const needsResetDrink = selectedPowerup.effect_type === 'market_reset'
    if (needsResetDrink && !resetDrink) return

    setBuying(true)
    let extraData = {}
    if (needsTurboDrink) extraData.drink_type_id = turboDrink
    if (needsResetDrink) extraData.drink_type_id = resetDrink

    const { data } = await supabase.rpc('buy_powerup', {
      p_user_id: user.id,
      p_target_user_id: targetUser?.id || user.id,
      p_league_id: selectedLeague.id,
      p_powerup_id: selectedPowerup.id,
      p_extra_data: extraData,
    })

    if (data?.success) {
      soundSuccess()
      setBalance(prev => prev - selectedPowerup.cost)
      setBuyResult(data)
      setTimeout(() => {
        setBuyResult(null)
        setSelectedPowerup(null)
        setTargetUser(null)
        setTurboDrink(null)
        setResetDrink(null)
      }, 2000)
      fetchAll()
    } else {
      soundError()
      setBuyResult(data)
      setTimeout(() => setBuyResult(null), 3000)
    }
    setBuying(false)
  }

  const executeRequestLoan = async () => {
    if (loanAmount < 50 || loanAmount > 5000) return
    setRequesting(true)
    const { data } = await supabase.rpc('request_bank_loan', {
      p_amount: loanAmount,
      p_days: loanDays,
    })
    if (data?.success) {
      soundSuccess()
      setLoanResult(data)
      fetchAll()
    } else {
      soundError()
      setLoanResult(data)
    }
    setTimeout(() => setLoanResult(null), 4000)
    setRequesting(false)
  }

  const executeRepayLoan = async () => {
    if (!activeLoan) return
    setRepaying(true)
    const { data } = await supabase.rpc('repay_bank_loan', { p_loan_id: activeLoan.id })
    if (data?.success) {
      soundSuccess()
      setLoanResult({ ...data, repaid: true })
      setActiveLoan(null)
      setLoanDebt(null)
      fetchAll()
    } else {
      soundError()
      setLoanResult(data)
    }
    setTimeout(() => setLoanResult(null), 4000)
    setRepaying(false)
  }

  const getInterestRate = (days) => {
    if (days === 1) return 5
    if (days === 3) return 8
    return 12
  }

  const getPreviewRepay = () => {
    const rate = getInterestRate(loanDays)
    return Math.ceil(loanAmount * (1 + rate / 100))
  }

  const formatTime = (ts) => {
    if (!ts) return 'Permanente'
    const diff = new Date(ts) - Date.now()
    if (diff <= 0) return 'Expirado'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  const formatDate = (ts) => new Date(ts).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  const getDueStatus = (dueDate) => {
    const diff = new Date(dueDate) - Date.now()
    if (diff < 0) {
      const days = Math.floor(Math.abs(diff) / 86400000)
      return { label: `${days}d de retraso`, color: '#ef4444', urgent: true }
    }
    const hours = Math.floor(diff / 3600000)
    if (hours < 24) return { label: `${hours}h restantes`, color: '#f97316', urgent: true }
    const days = Math.floor(diff / 86400000)
    return { label: `${days}d restantes`, color: '#10b981', urgent: false }
  }

  const getMultiplier = (price) => Math.max(0.5, Math.min(2.0, price / 100))
  const inDebt = balance < 0
  const needsTarget = selectedPowerup && ['freeze', 'sniper', 'sabotage'].includes(selectedPowerup.effect_type)
  const needsTurboDrink = selectedPowerup?.effect_type === 'turbo'
  const needsResetDrink = selectedPowerup?.effect_type === 'market_reset'

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="text-center">
        <motion.div className="text-5xl mb-3" animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>🪙</motion.div>
        <p style={{ color: 'var(--text-muted)' }}>Cargando mercado...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Mercado 📈</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Invierte para subir o bajar el multiplicador de cada bebida
            </p>
          </div>
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 0.3 }} key={balance}
            className="flex items-center gap-2 px-4 py-2 rounded-2xl"
            style={{
              backgroundColor: inDebt ? 'rgba(239,68,68,0.12)' : 'rgba(245,158,11,0.12)',
              border: `1px solid ${inDebt ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.3)'}`,
            }}>
            <span className="text-lg">🪙</span>
            <span className="font-bold text-lg" style={{ color: inDebt ? '#ef4444' : '#f59e0b' }}>
              {balance.toLocaleString()}
            </span>
          </motion.div>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl p-1 gap-1" style={{ backgroundColor: 'var(--bg-input)' }}>
          {[
            { id: 'market',    label: '📈 Cotización' },
            { id: 'powerups',  label: '⚡ Tienda' },
            { id: 'portfolio', label: '💼 Cartera' },
            { id: 'bank',      label: '🏦 Banco' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10"
              style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {tab === t.id && (
                <motion.div layoutId="market-tab" className="absolute inset-0 rounded-lg"
                  style={{ zIndex: -1, backgroundColor: t.id === 'bank' ? '#6366f1' : '#f59e0b' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── COTIZACIÓN ── */}
      {tab === 'market' && (
        <div className="px-4 pt-4 max-w-md mx-auto">
          <div className="rounded-2xl p-3 mb-4 flex items-center justify-between"
            style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="text-center flex-1">
              <p className="text-xs font-bold text-red-400">x0.5</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Mínimo</p>
            </div>
            <div className="text-center flex-1 border-x" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>x1.0</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Base</p>
            </div>
            <div className="text-center flex-1">
              <p className="text-xs font-bold text-emerald-400">x2.0</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Máximo</p>
            </div>
          </div>

          <div className="space-y-3">
            {drinkMarket.map((drink) => {
              const multiplier = getMultiplier(drink.price)
              const basePoints = drink.drink_types?.points || 0
              const effectivePoints = Math.round(basePoints * multiplier * 10) / 10
              const effectiveCoins = Math.floor(effectivePoints * 10)
              const isUp = drink.history?.length > 1 ? drink.price >= drink.history[0]?.price : true
              const pct = drink.history?.length > 1
                ? (((drink.price - drink.history[0].price) / drink.history[0].price) * 100).toFixed(1) : '0.0'
              const barPct = ((multiplier - 0.5) / 1.5) * 100
              const barColor = multiplier > 1.1 ? '#10b981' : multiplier < 0.9 ? '#ef4444' : '#9ca3af'

              return (
                <motion.button key={drink.id} variants={staggerItem} initial="initial" animate="animate"
                  whileTap={{ scale: 0.98 }} onClick={() => openDrinkDetail(drink)}
                  className="w-full rounded-2xl p-4 text-left" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: 'var(--bg-input)' }}>
                      {drink.drink_types?.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{drink.drink_types?.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Vol: {drink.volume?.toLocaleString()}🪙</p>
                    </div>
                    <SparkChart history={drink.history} width={60} height={28} />
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isUp ? '▲' : '▼'} {Math.abs(pct)}%
                      </p>
                    </div>
                  </div>
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs" style={{ color: 'var(--text-hint)' }}>x0.5</span>
                      <span className="text-sm font-bold"
                        style={{ color: multiplier > 1.1 ? '#10b981' : multiplier < 0.9 ? '#ef4444' : 'var(--text-primary)' }}>
                        x{multiplier.toFixed(2)}
                      </span>
                      <span className="text-xs" style={{ color: 'var(--text-hint)' }}>x2.0</span>
                    </div>
                    <div className="w-full rounded-full h-2" style={{ backgroundColor: 'var(--bg-input)' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${barPct}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className="h-2 rounded-full" style={{ backgroundColor: barColor }} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Pts base</p>
                        <p className="text-sm font-medium">{basePoints}pts</p>
                      </div>
                      <span style={{ color: 'var(--text-hint)' }}>→</span>
                      <div>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Pts ahora</p>
                        <p className="text-sm font-bold"
                          style={{ color: multiplier > 1 ? '#10b981' : multiplier < 1 ? '#ef4444' : 'var(--text-primary)' }}>
                          {effectivePoints}pts
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Monedas ahora</p>
                      <p className="text-sm font-bold"
                        style={{ color: multiplier > 1 ? '#10b981' : multiplier < 1 ? '#ef4444' : '#f59e0b' }}>
                        +{effectiveCoins}🪙
                      </p>
                    </div>
                  </div>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* ── TIENDA ── */}
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
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: 'var(--bg-card)', opacity: canAfford ? 1 : 0.6 }}>
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
                      className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold"
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
            style={{
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${inDebt ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.2)'}`,
            }}>
            <p className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>Saldo disponible</p>
            <p className="text-5xl font-bold" style={{ color: inDebt ? '#ef4444' : '#f59e0b' }}>
              {balance.toLocaleString()}
            </p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>
              {inDebt ? '🔴 En números rojos' : '🪙 Cervezas'}
            </p>
            {inDebt && (
              <p className="text-xs mt-2 text-red-400">
                Cada moneda que ganes reducirá tu deuda automáticamente
              </p>
            )}
          </motion.div>

          <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm font-bold mb-1">¿Cómo ganar 🪙?</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-hint)' }}>
              Puntos × 10 = monedas. El multiplicador del mercado afecta a ambos.
            </p>
            <div className="space-y-2">
              {drinkTypes.map(drink => {
                const marketDrink = drinkMarket.find(d => d.drink_type_id === drink.id)
                const price = marketDrink?.price || 100
                const multiplier = getMultiplier(price)
                const effectivePoints = Math.round(drink.points * multiplier * 10) / 10
                const coins = Math.floor(effectivePoints * 10)
                const isModified = Math.abs(multiplier - 1) > 0.05
                return (
                  <div key={drink.id} className="flex justify-between items-center py-2 border-b last:border-0"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{drink.emoji}</span>
                      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{drink.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {isModified && (
                        <span className="text-xs font-bold"
                          style={{ color: multiplier > 1 ? '#10b981' : '#ef4444' }}>
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
                  </div>
                )
              })}
            </div>
          </div>

          <AnimatePresence>
            {closeResult && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-4 mb-4 text-center"
                style={{
                  backgroundColor: closeResult.pnl >= 0 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${closeResult.pnl >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                <p className="font-bold" style={{ color: closeResult.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                  {closeResult.pnl >= 0 ? '🎉 Ganancia' : '📉 Pérdida'}: {closeResult.pnl >= 0 ? '+' : ''}{closeResult.pnl}🪙
                </p>
              </motion.div>
            )}
          </AnimatePresence>

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
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{pos.drink_types?.name}</p>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pos.direction === 'long' ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'}`}>
                            {pos.direction === 'long' ? '▲ LONG' : '▼ SHORT'}
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                          {pos.amount}🪙 · x{getMultiplier(pos.entry_price).toFixed(2)} → x{getMultiplier(currentPrice).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                          {isProfit ? '+' : ''}{pnl}🪙
                        </p>
                      </div>
                    </div>
                    <motion.button whileTap={{ scale: 0.97 }}
                      onClick={() => executeClosePosition(pos.id)}
                      disabled={closingPosition === pos.id}
                      className="w-full py-2.5 rounded-xl text-sm font-semibold"
                      style={{
                        backgroundColor: isProfit ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: isProfit ? '#10b981' : '#ef4444',
                        border: `1px solid ${isProfit ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      }}>
                      {closingPosition === pos.id ? 'Cerrando...' : `Cerrar (${isProfit ? '+' : ''}${pnl}🪙)`}
                    </motion.button>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── BANCO ── */}
      {tab === 'bank' && (
        <div className="px-4 pt-4 max-w-md mx-auto">

          <motion.div {...fadeIn} className="rounded-2xl p-5 mb-4 text-center"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <div className="text-4xl mb-2">🏦</div>
            <h2 className="text-lg font-bold">Banco de la Espuma</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Pide monedas adelantadas · cuanto antes pagues, menos interés
            </p>
          </motion.div>

          {/* Resultado de acción */}
          <AnimatePresence>
            {loanResult && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-4 mb-4 text-center"
                style={{
                  backgroundColor: loanResult.success || loanResult.repaid ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                  border: `1px solid ${loanResult.success || loanResult.repaid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                {loanResult.success && !loanResult.repaid && (
                  <>
                    <p className="font-bold text-emerald-400 text-lg">🎉 +{loanResult.amount}🪙 recibidas</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                      Devuelve {loanResult.repay_amount}🪙 antes del plazo · Interés: {loanResult.interest_rate}%
                    </p>
                  </>
                )}
                {loanResult.repaid && (
                  <>
                    <p className="font-bold text-emerald-400 text-lg">✅ Préstamo saldado</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                      Has pagado {loanResult.paid}🪙
                      {loanResult.days_late > 0 ? ` (${loanResult.days_late}d de retraso)` : ' a tiempo 👏'}
                    </p>
                  </>
                )}
                {!loanResult.success && !loanResult.repaid && (
                  <p className="font-bold text-red-400">⚠️ {loanResult.error}</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Préstamo activo */}
          {activeLoan && loanDebt && (
            <motion.div {...fadeIn} className="rounded-2xl p-5 mb-4"
              style={{
                backgroundColor: 'var(--bg-card)',
                border: `2px solid ${loanDebt.is_defaulted ? '#ef4444' : loanDebt.is_overdue ? '#f97316' : 'rgba(99,102,241,0.4)'}`,
              }}>
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold">
                  {loanDebt.is_defaulted ? '🔴 En números rojos' : 'Préstamo activo'}
                </p>
                {(() => {
                  const status = getDueStatus(activeLoan.due_date)
                  return (
                    <motion.span
                      animate={status.urgent ? { opacity: [1, 0.5, 1] } : {}}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="text-xs font-bold px-2 py-1 rounded-full"
                      style={{ backgroundColor: `${status.color}20`, color: status.color }}>
                      ⏰ {status.label}
                    </motion.span>
                  )
                })()}
              </div>

              {/* Aviso números rojos */}
              {loanDebt.is_defaulted && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-xl p-3 mb-4"
                  style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <p className="text-xs text-red-400 text-center">
                    ⚠️ Tu saldo está en negativo. Cada moneda que ganes irá directamente a reducir tu deuda hasta que vuelvas a 0.
                  </p>
                </motion.div>
              )}

              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>Pedido</span>
                  <span className="font-bold">{activeLoan.amount}🪙</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-muted)' }}>Interés base</span>
                  <span className="font-medium text-amber-400">{activeLoan.interest_rate}%</span>
                </div>
                {loanDebt.days_late > 0 && (
                  <div className="flex justify-between text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>Penalización ({loanDebt.days_late}d)</span>
                    <span className="font-medium text-red-400">+{loanDebt.penalty_rate}%</span>
                  </div>
                )}
                <div className="border-t pt-2 flex justify-between text-sm" style={{ borderColor: 'var(--border)' }}>
                  <span className="font-bold">A pagar ahora</span>
                  <span className="font-bold text-lg"
                    style={{ color: loanDebt.is_defaulted ? '#ef4444' : loanDebt.is_overdue ? '#f97316' : 'var(--text-primary)' }}>
                    {loanDebt.current_debt}🪙
                  </span>
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={executeRepayLoan}
                disabled={repaying || balance < loanDebt.current_debt}
                className="w-full py-3 rounded-xl font-bold text-sm text-white"
                style={{ backgroundColor: loanDebt.is_defaulted ? '#ef4444' : loanDebt.is_overdue ? '#f97316' : '#6366f1' }}>
                {repaying ? 'Pagando...' :
                  balance < loanDebt.current_debt
                    ? `Te faltan ${loanDebt.current_debt - balance}🪙 — sigue bebiendo 🍺`
                    : `Saldar deuda · ${loanDebt.current_debt}🪙`}
              </motion.button>
            </motion.div>
          )}

          {/* Formulario nuevo préstamo */}
          {!activeLoan && (
            <motion.div {...fadeIn} className="rounded-2xl p-5 mb-4"
              style={{ backgroundColor: 'var(--bg-card)' }}>
              <p className="text-sm font-bold mb-4">Solicitar préstamo</p>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cantidad</p>
                  <p className="text-sm font-bold text-indigo-400">{loanAmount}🪙</p>
                </div>
                <input type="range" min="50" max="5000" step="50"
                  value={loanAmount} onChange={e => setLoanAmount(Number(e.target.value))}
                  className="w-full accent-indigo-500" />
                <div className="flex justify-between mt-1">
                  <span className="text-xs" style={{ color: 'var(--text-hint)' }}>50🪙 mín</span>
                  <span className="text-xs" style={{ color: 'var(--text-hint)' }}>5000🪙 máx</span>
                </div>
                <div className="flex gap-2 mt-2">
                  {[100, 250, 500, 1000].map(v => (
                    <motion.button key={v} whileTap={{ scale: 0.9 }}
                      onClick={() => setLoanAmount(v)}
                      className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                      style={{
                        backgroundColor: loanAmount === v ? '#6366f1' : 'var(--bg-input)',
                        color: loanAmount === v ? '#fff' : 'var(--text-muted)',
                      }}>
                      {v}
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="mb-5">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Plazo de devolución</p>
                <div className="flex gap-2">
                  {[
                    { days: 1, label: '1 día',   rate: '5%' },
                    { days: 3, label: '3 días',  rate: '8%' },
                    { days: 7, label: '7 días',  rate: '12%' },
                  ].map(opt => (
                    <motion.button key={opt.days} whileTap={{ scale: 0.95 }}
                      onClick={() => setLoanDays(opt.days)}
                      className="flex-1 rounded-xl p-3 text-center"
                      style={{
                        backgroundColor: loanDays === opt.days ? 'rgba(99,102,241,0.2)' : 'var(--bg-input)',
                        border: loanDays === opt.days ? '2px solid #6366f1' : '2px solid transparent',
                      }}>
                      <p className="text-sm font-bold"
                        style={{ color: loanDays === opt.days ? '#818cf8' : 'var(--text-primary)' }}>
                        {opt.label}
                      </p>
                      <p className="text-xs mt-0.5 text-amber-400">{opt.rate}</p>
                    </motion.button>
                  ))}
                </div>
              </div>

              <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>Recibes ahora</span>
                  <span className="font-bold text-emerald-400">+{loanAmount}🪙</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span style={{ color: 'var(--text-muted)' }}>Interés ({getInterestRate(loanDays)}%)</span>
                  <span className="font-medium text-amber-400">+{getPreviewRepay() - loanAmount}🪙</span>
                </div>
                <div className="border-t pt-1 mt-1 flex justify-between text-sm" style={{ borderColor: 'var(--border)' }}>
                  <span className="font-bold">Total a devolver</span>
                  <span className="font-bold text-indigo-400">{getPreviewRepay()}🪙</span>
                </div>
                <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-hint)' }}>
                  +2% adicional por cada día de retraso · sin límite
                </p>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={executeRequestLoan}
                disabled={requesting}
                className="w-full py-4 rounded-2xl font-bold text-white text-sm"
                style={{ backgroundColor: '#6366f1' }}>
                {requesting ? 'Solicitando...' : `Pedir ${loanAmount}🪙 al banco`}
              </motion.button>
            </motion.div>
          )}

          {/* Historial */}
          {loanHistory.length > 0 && (
            <div>
              <p className="text-sm font-bold mb-3">Historial</p>
              <div className="space-y-2">
                {loanHistory.map(loan => (
                  <motion.div key={loan.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl p-3 flex items-center gap-3"
                    style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: loan.status === 'repaid' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                      <span className="text-sm">{loan.status === 'repaid' ? '✅' : '❌'}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{loan.amount}🪙 prestadas</p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                        {formatDate(loan.created_at)} · {loan.interest_rate}% interés
                      </p>
                    </div>
                    <p className="text-xs font-bold"
                      style={{ color: loan.status === 'repaid' ? '#10b981' : '#ef4444' }}>
                      {loan.status === 'repaid' ? 'Pagado' : 'Impagado'}
                    </p>
                  </motion.div>
                ))}
              </div>
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
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                      Base: {selectedDrink.drink_types?.points}pts · Vol: {selectedDrink.volume?.toLocaleString()}🪙
                    </p>
                  </div>
                </div>
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelectedDrink(null)}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
              </div>
              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
                <DetailChart history={drinkHistory} width={320} height={140} />
              </div>
              {(() => {
                const mult = getMultiplier(selectedDrink.price)
                const effPts = Math.round(selectedDrink.drink_types?.points * mult * 10) / 10
                const effCoins = Math.floor(effPts * 10)
                return (
                  <div className="flex gap-3 mb-4">
                    <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-input)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Pts ahora</p>
                      <p className="font-bold" style={{ color: mult > 1 ? '#10b981' : mult < 1 ? '#ef4444' : 'var(--text-primary)' }}>
                        {effPts}pts
                      </p>
                    </div>
                    <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-input)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Monedas ahora</p>
                      <p className="font-bold" style={{ color: mult > 1 ? '#10b981' : mult < 1 ? '#ef4444' : '#f59e0b' }}>
                        +{effCoins}🪙
                      </p>
                    </div>
                  </div>
                )
              })()}
              <div className="mb-4">
                <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Dirección</p>
                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTradeDirection('long')}
                    className="flex-1 py-3 rounded-xl font-bold text-sm"
                    style={{
                      backgroundColor: tradeDirection === 'long' ? 'rgba(16,185,129,0.2)' : 'var(--bg-input)',
                      color: tradeDirection === 'long' ? '#10b981' : 'var(--text-muted)',
                      border: tradeDirection === 'long' ? '2px solid #10b981' : '2px solid transparent',
                    }}>▲ LONG<br /><span className="text-xs font-normal">sube multiplicador</span></motion.button>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setTradeDirection('short')}
                    className="flex-1 py-3 rounded-xl font-bold text-sm"
                    style={{
                      backgroundColor: tradeDirection === 'short' ? 'rgba(239,68,68,0.2)' : 'var(--bg-input)',
                      color: tradeDirection === 'short' ? '#ef4444' : 'var(--text-muted)',
                      border: tradeDirection === 'short' ? '2px solid #ef4444' : '2px solid transparent',
                    }}>▼ SHORT<br /><span className="text-xs font-normal">baja multiplicador</span></motion.button>
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cantidad</p>
                  <p className="text-xs text-amber-400 font-bold">{tradeAmount}🪙 / {balance}🪙</p>
                </div>
                <input type="range" min="10" max={Math.min(Math.max(balance, 10), 500)} step="10"
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
                      }}>{v}</motion.button>
                  ))}
                </div>
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={executeTrade}
                disabled={trading || tradeAmount > balance || tradeAmount < 10}
                className="w-full font-bold py-4 rounded-2xl text-white"
                style={{ backgroundColor: tradeDirection === 'long' ? '#10b981' : '#ef4444' }}>
                {trading ? 'Ejecutando...' : `${tradeDirection === 'long' ? '▲ LONG' : '▼ SHORT'} · ${tradeAmount}🪙`}
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
            onClick={() => { setSelectedPowerup(null); setTargetUser(null); setTurboDrink(null); setResetDrink(null) }}>
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
                <motion.button whileTap={{ scale: 0.9 }}
                  onClick={() => { setSelectedPowerup(null); setTargetUser(null); setTurboDrink(null); setResetDrink(null) }}
                  className="w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
              </div>

              <AnimatePresence>
                {buyResult && (
                  <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="rounded-2xl p-3 mb-4 text-center"
                    style={{
                      backgroundColor: buyResult.success ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                      border: `1px solid ${buyResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                    }}>
                    <p className="text-sm font-bold" style={{ color: buyResult.success ? '#10b981' : '#f59e0b' }}>
                      {buyResult.success
                        ? buyResult.extra?.target
                          ? `✅ ${buyResult.extra.target} ha recibido el impacto`
                          : '✅ Powerup activado'
                        : buyResult.extra?.message || 'Escudo bloqueó el ataque 🛡️'}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {needsTarget && (
                <div className="mb-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    Selecciona el objetivo en {selectedLeague?.name}
                  </p>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
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
                          : <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card)' }}>🍺</div>}
                        <span className="text-sm font-medium">{member.username}</span>
                        {targetUser?.id === member.id && <span className="ml-auto text-amber-400">✓</span>}
                      </motion.button>
                    ))}
                  </div>
                </div>
              )}

              {needsTurboDrink && (
                <div className="mb-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>¿A qué bebida aplicar el Turbo x3?</p>
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

              {needsResetDrink && (
                <div className="mb-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>¿Qué bebida resetear a x1.0?</p>
                  <div className="grid grid-cols-2 gap-2">
                    {drinkMarket.map(drink => {
                      const mult = getMultiplier(drink.price)
                      return (
                        <motion.button key={drink.drink_type_id} whileTap={{ scale: 0.95 }}
                          onClick={() => setResetDrink(drink.drink_type_id)}
                          className="rounded-xl p-3 flex items-center gap-2"
                          style={{
                            backgroundColor: resetDrink === drink.drink_type_id ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)',
                            border: resetDrink === drink.drink_type_id ? '2px solid #f59e0b' : '2px solid transparent',
                          }}>
                          <span className="text-xl">{drink.drink_types?.emoji}</span>
                          <div className="flex-1 text-left">
                            <p className="text-xs font-medium">{drink.drink_types?.name}</p>
                            <p className="text-xs" style={{ color: mult > 1.05 ? '#10b981' : mult < 0.95 ? '#ef4444' : 'var(--text-hint)' }}>
                              x{mult.toFixed(2)}
                            </p>
                          </div>
                          {resetDrink === drink.drink_type_id && <span className="text-amber-400 text-xs">✓</span>}
                        </motion.button>
                      )
                    })}
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
                  (needsTurboDrink && !turboDrink) ||
                  (needsResetDrink && !resetDrink)
                }
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-bold py-4 rounded-2xl">
                {buying ? 'Activando...' : `Activar · ${selectedPowerup.cost}🪙`}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}