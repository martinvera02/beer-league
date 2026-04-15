import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerItem } from '../lib/animations'
import { soundSuccess, soundError } from '../lib/sounds'

function SparkChart({ history, width = 60, height = 28 }) {
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
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={isUp ? '#10b981' : '#ef4444'}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DetailChart({ history, width = 320, height = 150 }) {
  const svgRef = useRef(null)
  const [tooltip, setTooltip] = useState(null)

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
  const pad = 28

  const toX = (i) => pad + (i / (multipliers.length - 1)) * (width - pad * 2)
  const toY = (m) => pad + (height - pad * 2) - ((m - min) / range) * (height - pad * 2)
  const points = multipliers.map((m, i) => `${toX(i)},${toY(m)}`).join(' ')
  const areaPoints = `${toX(0)},${height - pad} ${points} ${toX(multipliers.length - 1)},${height - pad}`
  const current = multipliers[multipliers.length - 1]
  const isUp = current >= multipliers[0]
  const lineColor = isUp ? '#10b981' : '#ef4444'
  const pct = (((current - multipliers[0]) / multipliers[0]) * 100).toFixed(1)

  const handlePointer = (clientX) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = width / rect.width
    const mouseX = (clientX - rect.left) * scaleX
    let closestIdx = 0, closestDist = Infinity
    multipliers.forEach((_, i) => {
      const dist = Math.abs(toX(i) - mouseX)
      if (dist < closestDist) { closestDist = dist; closestIdx = i }
    })
    setTooltip({ x: toX(closestIdx), y: toY(multipliers[closestIdx]), point: history[closestIdx], idx: closestIdx, mult: multipliers[closestIdx] })
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div>
      <div className="flex items-end gap-3 mb-2">
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
      <div style={{ position: 'relative' }}>
        <svg ref={svgRef} width="100%" viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none" style={{ cursor: 'crosshair', display: 'block' }}
          onMouseMove={e => handlePointer(e.clientX)}
          onMouseLeave={() => setTooltip(null)}
          onTouchMove={e => { e.preventDefault(); handlePointer(e.touches[0].clientX) }}
          onTouchEnd={() => setTooltip(null)}>
          <defs>
            <linearGradient id="area-grad-d" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
            <line key={i} x1={pad} y1={pad + (height - pad * 2) * t}
              x2={width - pad} y2={pad + (height - pad * 2) * t}
              stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3" />
          ))}
          <polygon points={areaPoints} fill="url(#area-grad-d)" />
          <polyline points={points} fill="none" stroke={lineColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <text x={pad - 4} y={pad + 4} textAnchor="end" fontSize="9" fill="var(--text-hint)">x{max.toFixed(2)}</text>
          <text x={pad - 4} y={height - pad + 4} textAnchor="end" fontSize="9" fill="var(--text-hint)">x{min.toFixed(2)}</text>
          <circle cx={toX(multipliers.length - 1)} cy={toY(current)} r="4" fill={lineColor} />
          {tooltip && (
            <>
              <line x1={tooltip.x} y1={pad} x2={tooltip.x} y2={height - pad}
                stroke="rgba(255,255,255,0.25)" strokeWidth="1" strokeDasharray="3 2" />
              <circle cx={tooltip.x} cy={tooltip.y} r="5" fill={lineColor} stroke="white" strokeWidth="1.5" />
            </>
          )}
        </svg>
        {tooltip && tooltip.point && (
          <div style={{
            position: 'absolute', bottom: '100%',
            left: tooltip.idx > multipliers.length * 0.65 ? 'auto' : `${(tooltip.x / width) * 100}%`,
            right: tooltip.idx > multipliers.length * 0.65 ? `${(1 - tooltip.x / width) * 100}%` : 'auto',
            marginBottom: 8, pointerEvents: 'none', zIndex: 10,
            transform: tooltip.idx <= multipliers.length * 0.65 ? 'translateX(-50%)' : 'none',
          }}>
            <div className="rounded-xl px-3 py-2 shadow-xl text-xs whitespace-nowrap"
              style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${lineColor}`, color: 'var(--text-primary)' }}>
              <p className="font-bold" style={{ color: lineColor }}>x{tooltip.mult.toFixed(3)}</p>
              {tooltip.point.moved_by_username
                ? <p className="font-medium mt-0.5">{tooltip.point.direction === 'long' ? '▲' : '▼'} {tooltip.point.moved_by_username}</p>
                : <p style={{ color: 'var(--text-hint)' }}>Fluctuación auto</p>}
              <p className="mt-0.5" style={{ color: 'var(--text-hint)', fontSize: 9 }}>{formatTime(tooltip.point.recorded_at)}</p>
            </div>
          </div>
        )}
      </div>
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
  const [opsToday, setOpsToday] = useState(0)
  const [lastPowerupTime, setLastPowerupTime] = useState(null)

  // Acciones
  const [stockCompanies, setStockCompanies] = useState([])
  const [myStockPositions, setMyStockPositions] = useState([])
  const [myDividends, setMyDividends] = useState([])

  const [selectedDrink, setSelectedDrink] = useState(null)
  const [drinkHistory, setDrinkHistory] = useState([])
  const [tradeDirection, setTradeDirection] = useState('long')
  const [tradeAmount, setTradeAmount] = useState(50)
  const [trading, setTrading] = useState(false)
  const [tradeError, setTradeError] = useState('')

  const [selectedPowerup, setSelectedPowerup] = useState(null)
  const [targetUser, setTargetUser] = useState(null)
  const [turboDrink, setTurboDrink] = useState(null)
  const [resetDrink, setResetDrink] = useState(null)
  const [leagueMembers, setLeagueMembers] = useState([])
  const [buying, setBuying] = useState(false)
  const [buyResult, setBuyResult] = useState(null)
  const [closingPosition, setClosingPosition] = useState(null)
  const [closeResult, setCloseResult] = useState(null)

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

  const isMarketOpen = () => {
    const now = new Date()
    const madrid = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
    const h = madrid.getHours()
    return h >= 20 || h < 2
  }
  const marketOpen = isMarketOpen()

  const getPowerupCooldown = () => {
    if (!lastPowerupTime) return 0
    const diff = 30 * 60 * 1000 - (Date.now() - new Date(lastPowerupTime).getTime())
    return Math.max(0, Math.ceil(diff / 60000))
  }
  const powerupCooldown = getPowerupCooldown()
  const opsRemaining = Math.max(0, 3 - opsToday)

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
      { data: lastPowerupData },
      { data: stockData },
      { data: stockPosData },
      { data: dividendsData },
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
      supabase.from('active_powerups').select('created_at')
        .eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('stock_companies').select('*').eq('active', true).order('id'),
      supabase.from('stock_positions')
        .select('*, stock_companies(name, emoji, share_price, dividend_rate, base_price)')
        .eq('user_id', user.id),
      supabase.from('stock_dividends')
        .select('*, stock_companies(name, emoji)')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false }).limit(5),
    ])

    setBalance(walletData?.balance || 0)
    setDrinkTypes(drinkTypesData || [])
    setPowerups(powerupData || [])
    setMyPowerups(myPowerupData || [])
    setMyPositions(positionData || [])
    setActiveLoan(loanData || null)
    setLoanHistory(loanHistoryData || [])
    setLastPowerupTime(lastPowerupData?.created_at || null)
    setStockCompanies(stockData || [])
    setMyStockPositions(stockPosData || [])
    setMyDividends(dividendsData || [])

    const madridMidnight = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
    madridMidnight.setHours(0, 0, 0, 0)
    const { count } = await supabase.from('market_positions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', madridMidnight.toISOString())
    setOpsToday(count || 0)

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
    setTradeAmount(50)
    setTradeDirection('long')
    setTradeError('')
    const { data } = await supabase
      .from('drink_market_history').select('*')
      .eq('drink_type_id', drink.drink_type_id)
      .order('recorded_at', { ascending: true }).limit(60)
    setDrinkHistory(data || [])
  }

  const executeTrade = async () => {
    if (!selectedDrink || tradeAmount < 10 || tradeAmount > balance) return
    setTrading(true)
    setTradeError('')
    const { data } = await supabase.rpc('open_market_position', {
      p_drink_type_id: selectedDrink.drink_type_id,
      p_direction: tradeDirection,
      p_amount: tradeAmount,
    })
    if (data?.success) {
      soundSuccess()
      setBalance(prev => prev - tradeAmount)
      setOpsToday(prev => prev + 1)
      setSelectedDrink(null)
      fetchAll()
    } else {
      soundError()
      setTradeError(data?.error || 'Error al operar')
    }
    setTrading(false)
  }

  const executeClosePosition = async (positionId) => {
    setClosingPosition(positionId)
    const { data } = await supabase.rpc('close_market_position', { p_position_id: positionId })
    if (data?.success) {
      soundSuccess(); setCloseResult(data)
      setTimeout(() => setCloseResult(null), 3000)
      fetchAll()
    } else { soundError() }
    setClosingPosition(null)
  }

  const executeBuyPowerup = async () => {
    if (!selectedPowerup || !selectedLeague) return
    const needsTarget = ['freeze', 'sniper', 'sabotage'].includes(selectedPowerup.effect_type)
    if (needsTarget && !targetUser) return
    if (selectedPowerup.effect_type === 'turbo' && !turboDrink) return
    if (selectedPowerup.effect_type === 'market_reset' && !resetDrink) return
    setBuying(true)
    let extraData = {}
    if (selectedPowerup.effect_type === 'turbo') extraData.drink_type_id = turboDrink
    if (selectedPowerup.effect_type === 'market_reset') extraData.drink_type_id = resetDrink
    const { data } = await supabase.rpc('buy_powerup', {
      p_target_user_id: targetUser?.id || user.id,
      p_league_id: selectedLeague.id,
      p_powerup_id: selectedPowerup.id,
      p_extra_data: extraData,
    })
    if (data?.success) {
      soundSuccess(); setBalance(prev => prev - selectedPowerup.cost)
      setLastPowerupTime(new Date().toISOString()); setBuyResult(data)
      setTimeout(() => { setBuyResult(null); setSelectedPowerup(null); setTargetUser(null); setTurboDrink(null); setResetDrink(null) }, 2000)
      fetchAll()
    } else { soundError(); setBuyResult(data); setTimeout(() => setBuyResult(null), 4000) }
    setBuying(false)
  }

  const executeRequestLoan = async () => {
    setRequesting(true)
    const { data } = await supabase.rpc('request_bank_loan', { p_amount: loanAmount, p_days: loanDays })
    if (data?.success) { soundSuccess(); setLoanResult(data); fetchAll() }
    else { soundError(); setLoanResult(data) }
    setTimeout(() => setLoanResult(null), 4000)
    setRequesting(false)
  }

  const executeRepayLoan = async () => {
    if (!activeLoan) return
    setRepaying(true)
    const { data } = await supabase.rpc('repay_bank_loan', { p_loan_id: activeLoan.id })
    if (data?.success) {
      soundSuccess(); setLoanResult({ ...data, repaid: true })
      setActiveLoan(null); setLoanDebt(null); fetchAll()
    } else { soundError(); setLoanResult(data) }
    setTimeout(() => setLoanResult(null), 4000)
    setRepaying(false)
  }

  const getInterestRate = (d) => d === 1 ? 5 : d === 3 ? 8 : 12
  const getPreviewRepay = () => Math.ceil(loanAmount * (1 + getInterestRate(loanDays) / 100))
  const getImpactPreview = (amount) => (Math.sqrt(amount) * 0.8 / 100).toFixed(3)
  const getMultiplier = (price) => Math.max(0.5, Math.min(2.0, price / 100))

  const formatTime = (ts) => {
    if (!ts) return 'Permanente'
    const diff = new Date(ts) - Date.now()
    if (diff <= 0) return 'Expirado'
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const formatDate = (ts) => new Date(ts).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  const getDueStatus = (dueDate) => {
    const diff = new Date(dueDate) - Date.now()
    if (diff < 0) return { label: `${Math.floor(Math.abs(diff) / 86400000)}d de retraso`, color: '#ef4444', urgent: true }
    const hours = Math.floor(diff / 3600000)
    if (hours < 24) return { label: `${hours}h restantes`, color: '#f97316', urgent: true }
    return { label: `${Math.floor(diff / 86400000)}d restantes`, color: '#10b981', urgent: false }
  }

  const inDebt = balance < 0
  const needsTarget = selectedPowerup && ['freeze', 'sniper', 'sabotage'].includes(selectedPowerup.effect_type)
  const needsTurboDrink = selectedPowerup?.effect_type === 'turbo'
  const needsResetDrink = selectedPowerup?.effect_type === 'market_reset'

  // Cálculos cartera unificada
  const totalStockValue = myStockPositions.reduce((sum, p) => {
    const company = stockCompanies.find(c => c.id === p.company_id)
    return sum + (company ? company.share_price * p.shares : 0)
  }, 0)
  const totalStockInvested = myStockPositions.reduce((sum, p) => sum + p.total_invested, 0)
  const totalStockPnl = totalStockValue - totalStockInvested

  const totalDrinkValue = myPositions.reduce((sum, pos) => {
    const currentMarket = drinkMarket.find(d => d.drink_type_id === pos.drink_type_id)
    const currentPrice = currentMarket?.price || pos.entry_price
    const pnl = pos.direction === 'long'
      ? Math.floor(pos.amount * ((currentPrice - pos.entry_price) / pos.entry_price))
      : Math.floor(pos.amount * ((pos.entry_price - currentPrice) / pos.entry_price))
    return sum + pos.amount + pnl
  }, 0)
  const totalDrinkInvested = myPositions.reduce((sum, p) => sum + p.amount, 0)
  const totalDrinkPnl = totalDrinkValue - totalDrinkInvested

  const totalPortfolio = totalStockValue + totalDrinkValue
  const totalInvested = totalStockInvested + totalDrinkInvested
  const totalPnl = totalStockPnl + totalDrinkPnl

  const estimatedDailyDividend = myStockPositions.reduce((sum, pos) => {
    const company = stockCompanies.find(c => c.id === pos.company_id)
    if (!company) return sum
    return sum + Math.floor(pos.shares * company.share_price * company.dividend_rate)
  }, 0)

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
            <div className="flex items-center gap-2 mt-0.5">
              <motion.div className="w-2 h-2 rounded-full flex-shrink-0"
                animate={marketOpen ? { opacity: [1, 0.3, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
                style={{ backgroundColor: marketOpen ? '#10b981' : '#ef4444' }} />
              <p className="text-xs" style={{ color: marketOpen ? '#10b981' : '#ef4444' }}>
                {marketOpen ? 'Abierto · cierra a las 02:00h 🌙' : 'Cerrado · abre a las 20:00h'}
              </p>
            </div>
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
                  style={{ zIndex: -1, backgroundColor: t.id === 'bank' ? '#6366f1' : t.id === 'portfolio' ? '#7c3aed' : '#f59e0b' }}
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
          <div className="rounded-2xl p-3 mb-4 flex items-center" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="text-center flex-1">
              <p className="text-xs font-bold text-red-400">x0.5</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Mínimo</p>
            </div>
            <div className="text-center flex-1 border-x" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-bold" style={{ color: 'var(--text-muted)' }}>x1.0</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Base</p>
            </div>
            <div className="text-center flex-1 border-r" style={{ borderColor: 'var(--border)' }}>
              <p className="text-xs font-bold text-emerald-400">x2.0</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Máximo</p>
            </div>
            <div className="text-center flex-1">
              <p className={`text-xs font-bold ${opsRemaining > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                {opsRemaining}/3
              </p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Ops hoy</p>
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
          {powerupCooldown > 0 && (
            <motion.div {...fadeIn} className="rounded-2xl p-3 mb-4 text-center"
              style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <p className="text-sm font-bold text-amber-400">⏱ Cooldown activo</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                Próximo powerup en {powerupCooldown} min
              </p>
            </motion.div>
          )}
          {leagues.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Liga donde se aplicará</p>
              <div className="flex gap-2 flex-wrap">
                {leagues.map(l => (
                  <motion.button key={l.id} whileTap={{ scale: 0.95 }} onClick={() => setSelectedLeague(l)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium ${selectedLeague?.id === l.id ? 'bg-amber-500 text-white' : ''}`}
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
                    {ap.extra_data?.uses_left && <p className="text-xs mt-0.5 text-amber-400">{ap.extra_data.uses_left} usos</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Catálogo</p>
          <div className="space-y-3">
            {powerups.map(pw => {
              const canAfford = balance >= pw.cost
              const onCooldown = powerupCooldown > 0
              return (
                <motion.div key={pw.id} variants={staggerItem} initial="initial" animate="animate"
                  className="rounded-2xl p-4"
                  style={{ backgroundColor: 'var(--bg-card)', opacity: canAfford && !onCooldown ? 1 : 0.6 }}>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                      style={{ backgroundColor: 'var(--bg-input)' }}>
                      {pw.emoji}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{pw.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{pw.description}</p>
                      {pw.effect_type === 'freeze'
                        ? <p className="text-xs mt-0.5 text-blue-400">⏱ 15 minutos</p>
                        : pw.duration_hours ? <p className="text-xs mt-0.5 text-amber-400">⏱ {pw.duration_hours}h</p> : null}
                    </div>
                    <motion.button whileTap={{ scale: 0.9 }}
                      disabled={!canAfford || !selectedLeague || onCooldown}
                      onClick={() => setSelectedPowerup(pw)}
                      className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-bold"
                      style={{ backgroundColor: canAfford && !onCooldown ? '#f59e0b' : 'var(--bg-input)', color: canAfford && !onCooldown ? '#fff' : 'var(--text-hint)' }}>
                      {onCooldown ? `${powerupCooldown}m` : `${pw.cost}🪙`}
                    </motion.button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── CARTERA UNIFICADA ── */}
      {tab === 'portfolio' && (
        <div className="px-4 pt-4 max-w-md mx-auto">

          {/* Resumen total */}
          <motion.div {...fadeIn} className="rounded-2xl p-5 mb-4"
            style={{
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(99,102,241,0.15))',
              border: `1px solid ${totalPnl >= 0 ? 'rgba(124,58,237,0.4)' : 'rgba(239,68,68,0.3)'}`,
            }}>
            <p className="text-xs font-bold text-purple-400 mb-3">💼 Cartera total</p>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="text-center">
                <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Valor total</p>
                <p className="font-bold text-sm text-purple-400">{totalPortfolio.toLocaleString()}🪙</p>
              </div>
              <div className="text-center border-x" style={{ borderColor: 'rgba(124,58,237,0.3)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Invertido</p>
                <p className="font-bold text-sm">{totalInvested.toLocaleString()}🪙</p>
              </div>
              <div className="text-center">
                <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>P&L total</p>
                <p className={`font-bold text-sm ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()}🪙
                </p>
              </div>
            </div>
            {estimatedDailyDividend > 0 && (
              <div className="pt-3 border-t flex items-center justify-between"
                style={{ borderColor: 'rgba(124,58,237,0.3)' }}>
                <p className="text-xs" style={{ color: 'var(--text-hint)' }}>💰 Dividendo diario estimado</p>
                <p className="text-sm font-bold text-amber-400">~{estimatedDailyDividend}🪙</p>
              </div>
            )}
            {inDebt && (
              <div className="pt-2 border-t mt-2" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
                <p className="text-xs text-red-400 text-center">
                  🔴 Saldo en números rojos · {balance}🪙
                </p>
              </div>
            )}
          </motion.div>

          {/* ── Sección: S&PINTA 500 ── */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">📊 S&PINTA 500</p>
            {myStockPositions.length > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalStockPnl >= 0 ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'}`}>
                {totalStockPnl >= 0 ? '+' : ''}{totalStockPnl.toLocaleString()}🪙
              </span>
            )}
          </div>

          {myStockPositions.length === 0 ? (
            <div className="rounded-2xl p-4 mb-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="text-3xl mb-2">📊</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin acciones todavía</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Ve al S&PINTA 500 para invertir</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {myStockPositions.map(pos => {
                const company = stockCompanies.find(c => c.id === pos.company_id)
                if (!company) return null
                const currentValue = company.share_price * pos.shares
                const pnl = currentValue - pos.total_invested
                const pnlPct = ((pnl / pos.total_invested) * 100).toFixed(1)
                const dailyDiv = Math.floor(pos.shares * company.share_price * company.dividend_rate)
                const myPct = ((pos.shares / company.total_shares) * 100).toFixed(1)
                return (
                  <motion.div key={pos.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: 'var(--bg-input)' }}>
                        {company.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm">{company.name}</p>
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-900 text-indigo-400">
                            {myPct}%
                          </span>
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                          {pos.shares} acc · precio medio {pos.avg_buy_price.toLocaleString()}🪙
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm">{currentValue.toLocaleString()}🪙</p>
                        <p className={`text-xs font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()}🪙 ({pnlPct}%)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t"
                      style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs" style={{ color: 'var(--text-hint)' }}>
                        💰 Dividendo diario estimado
                      </span>
                      <span className="text-xs font-bold text-amber-400">~{dailyDiv}🪙</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Últimos dividendos */}
          {myDividends.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-bold mb-3">💰 Últimos dividendos</p>
              <div className="space-y-2">
                {myDividends.map(d => (
                  <div key={d.id} className="rounded-2xl p-3 flex items-center gap-3"
                    style={{ backgroundColor: 'var(--bg-card)' }}>
                    <span className="text-xl">{d.stock_companies?.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{d.stock_companies?.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                        {formatDate(d.paid_at)} · {d.shares} acc
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-emerald-400">+{d.amount}🪙</p>
                      {d.bonus_amount > 0 && (
                        <p className="text-xs text-amber-400">+{d.bonus_amount}🪙 bonus</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Sección: Posiciones de bebidas ── */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">🍺 Posiciones en bebidas</p>
            {myPositions.length > 0 && (
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${totalDrinkPnl >= 0 ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'}`}>
                {totalDrinkPnl >= 0 ? '+' : ''}{totalDrinkPnl.toLocaleString()}🪙
              </span>
            )}
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

          {myPositions.length === 0 ? (
            <div className="rounded-2xl p-4 mb-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="text-3xl mb-2">📈</div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Sin posiciones abiertas</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Ve a Cotización para invertir</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
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
                      <p className={`font-bold text-sm ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>
                        {isProfit ? '+' : ''}{pnl}🪙
                      </p>
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

          {/* Tabla de puntos actuales por bebida */}
          <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
            <p className="text-sm font-bold mb-1">¿Cómo ganar 🪙?</p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-hint)' }}>Puntos × 10 = monedas · afectado por el mercado</p>
            <div className="space-y-2">
              {drinkTypes.map(drink => {
                const marketDrink = drinkMarket.find(d => d.drink_type_id === drink.id)
                const multiplier = getMultiplier(marketDrink?.price || 100)
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
                        <span className="text-xs font-bold" style={{ color: multiplier > 1 ? '#10b981' : '#ef4444' }}>
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
        </div>
      )}

      {/* ── BANCO ── */}
      {tab === 'bank' && (
        <div className="px-4 pt-4 max-w-md mx-auto">
          <motion.div {...fadeIn} className="rounded-2xl p-5 mb-4 text-center"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(99,102,241,0.3)' }}>
            <div className="text-4xl mb-2">🏦</div>
            <h2 className="text-lg font-bold">Banco de la Espuma</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Pide monedas adelantadas · cuanto antes pagues, menos interés</p>
          </motion.div>

          <AnimatePresence>
            {loanResult && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="rounded-2xl p-4 mb-4 text-center"
                style={{ backgroundColor: loanResult.success || loanResult.repaid ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${loanResult.success || loanResult.repaid ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                {loanResult.success && !loanResult.repaid && (<><p className="font-bold text-emerald-400 text-lg">🎉 +{loanResult.amount}🪙 recibidas</p><p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Devuelve {loanResult.repay_amount}🪙 · Interés: {loanResult.interest_rate}%</p></>)}
                {loanResult.repaid && (<><p className="font-bold text-emerald-400 text-lg">✅ Préstamo saldado</p><p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Has pagado {loanResult.paid}🪙{loanResult.days_late > 0 ? ` (${loanResult.days_late}d de retraso)` : ' a tiempo 👏'}</p></>)}
                {!loanResult.success && !loanResult.repaid && (<p className="font-bold text-red-400">⚠️ {loanResult.error}</p>)}
              </motion.div>
            )}
          </AnimatePresence>

          {activeLoan && loanDebt && (
            <motion.div {...fadeIn} className="rounded-2xl p-5 mb-4"
              style={{ backgroundColor: 'var(--bg-card)', border: `2px solid ${loanDebt.is_defaulted ? '#ef4444' : loanDebt.is_overdue ? '#f97316' : 'rgba(99,102,241,0.4)'}` }}>
              <div className="flex items-center justify-between mb-4">
                <p className="font-bold">{loanDebt.is_defaulted ? '🔴 En números rojos' : 'Préstamo activo'}</p>
                {(() => { const s = getDueStatus(activeLoan.due_date); return (<motion.span animate={s.urgent ? { opacity: [1, 0.5, 1] } : {}} transition={{ repeat: Infinity, duration: 1.5 }} className="text-xs font-bold px-2 py-1 rounded-full" style={{ backgroundColor: `${s.color}20`, color: s.color }}>⏰ {s.label}</motion.span>) })()}
              </div>
              {loanDebt.is_defaulted && (<div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}><p className="text-xs text-red-400 text-center">⚠️ Tu saldo está en negativo. Cada moneda que ganes irá a reducir tu deuda.</p></div>)}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>Pedido</span><span className="font-bold">{activeLoan.amount}🪙</span></div>
                <div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>Interés base</span><span className="font-medium text-amber-400">{activeLoan.interest_rate}%</span></div>
                {loanDebt.days_late > 0 && (<div className="flex justify-between text-sm"><span style={{ color: 'var(--text-muted)' }}>Penalización ({loanDebt.days_late}d)</span><span className="font-medium text-red-400">+{loanDebt.penalty_rate}%</span></div>)}
                <div className="border-t pt-2 flex justify-between text-sm" style={{ borderColor: 'var(--border)' }}><span className="font-bold">A pagar ahora</span><span className="font-bold text-lg" style={{ color: loanDebt.is_defaulted ? '#ef4444' : loanDebt.is_overdue ? '#f97316' : 'var(--text-primary)' }}>{loanDebt.current_debt}🪙</span></div>
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={executeRepayLoan}
                disabled={repaying || balance < loanDebt.current_debt}
                className="w-full py-3 rounded-xl font-bold text-sm text-white"
                style={{ backgroundColor: loanDebt.is_defaulted ? '#ef4444' : loanDebt.is_overdue ? '#f97316' : '#6366f1' }}>
                {repaying ? 'Pagando...' : balance < loanDebt.current_debt ? `Te faltan ${loanDebt.current_debt - balance}🪙` : `Saldar · ${loanDebt.current_debt}🪙`}
              </motion.button>
            </motion.div>
          )}

          {!activeLoan && (() => {
            const maxLoan = Math.min(2000, Math.max(100, balance * 2))
            return (
              <motion.div {...fadeIn} className="rounded-2xl p-5 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                <p className="text-sm font-bold mb-4">Solicitar préstamo</p>
                <div className="rounded-xl p-3 mb-4 flex items-center justify-between" style={{ backgroundColor: 'var(--bg-base)' }}>
                  <div><p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Tu límite disponible</p><p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Basado en tu saldo actual</p></div>
                  <p className="text-lg font-bold text-indigo-400">{maxLoan.toLocaleString()}🪙</p>
                </div>
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cantidad</p>
                    <p className="text-sm font-bold text-indigo-400">{Math.min(loanAmount, maxLoan)}🪙</p>
                  </div>
                  <input type="range" min="50" max={maxLoan} step="50" value={Math.min(loanAmount, maxLoan)}
                    onChange={e => setLoanAmount(Number(e.target.value))} className="w-full accent-indigo-500" />
                  <div className="flex gap-2 mt-2">
                    {[100, 250, 500, 1000].filter(v => v <= maxLoan).map(v => (
                      <motion.button key={v} whileTap={{ scale: 0.9 }} onClick={() => setLoanAmount(v)}
                        className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                        style={{ backgroundColor: loanAmount === v ? '#6366f1' : 'var(--bg-input)', color: loanAmount === v ? '#fff' : 'var(--text-muted)' }}>{v}</motion.button>
                    ))}
                  </div>
                </div>
                <div className="mb-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Plazo</p>
                  <div className="flex gap-2">
                    {[{ days: 1, label: '1 día', rate: '5%' }, { days: 3, label: '3 días', rate: '8%' }, { days: 7, label: '7 días', rate: '12%' }].map(opt => (
                      <motion.button key={opt.days} whileTap={{ scale: 0.95 }} onClick={() => setLoanDays(opt.days)}
                        className="flex-1 rounded-xl p-3 text-center"
                        style={{ backgroundColor: loanDays === opt.days ? 'rgba(99,102,241,0.2)' : 'var(--bg-input)', border: loanDays === opt.days ? '2px solid #6366f1' : '2px solid transparent' }}>
                        <p className="text-sm font-bold" style={{ color: loanDays === opt.days ? '#818cf8' : 'var(--text-primary)' }}>{opt.label}</p>
                        <p className="text-xs mt-0.5 text-amber-400">{opt.rate}</p>
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
                  <div className="flex justify-between text-sm mb-1"><span style={{ color: 'var(--text-muted)' }}>Recibes ahora</span><span className="font-bold text-emerald-400">+{loanAmount}🪙</span></div>
                  <div className="flex justify-between text-sm mb-1"><span style={{ color: 'var(--text-muted)' }}>Interés ({getInterestRate(loanDays)}%)</span><span className="font-medium text-amber-400">+{getPreviewRepay() - loanAmount}🪙</span></div>
                  <div className="border-t pt-1 mt-1 flex justify-between text-sm" style={{ borderColor: 'var(--border)' }}><span className="font-bold">Total a devolver</span><span className="font-bold text-indigo-400">{getPreviewRepay()}🪙</span></div>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={executeRequestLoan} disabled={requesting}
                  className="w-full py-4 rounded-2xl font-bold text-white text-sm" style={{ backgroundColor: '#6366f1' }}>
                  {requesting ? 'Solicitando...' : `Pedir ${loanAmount}🪙 al banco`}
                </motion.button>
              </motion.div>
            )
          })()}

          {loanHistory.length > 0 && (
            <div>
              <p className="text-sm font-bold mb-3">Historial</p>
              <div className="space-y-2">
                {loanHistory.map(loan => (
                  <motion.div key={loan.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: loan.status === 'repaid' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)' }}>
                      <span className="text-sm">{loan.status === 'repaid' ? '✅' : '❌'}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{loan.amount}🪙 prestadas</p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{formatDate(loan.created_at)} · {loan.interest_rate}% interés</p>
                    </div>
                    <p className="text-xs font-bold" style={{ color: loan.status === 'repaid' ? '#10b981' : '#ef4444' }}>
                      {loan.status === 'repaid' ? 'Pagado' : 'Impagado'}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal detalle bebida ── */}
      <AnimatePresence>
        {selectedDrink && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
            onClick={() => setSelectedDrink(null)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="rounded-t-3xl w-full max-w-lg overflow-y-auto"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '90vh', paddingBottom: '100px' }}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedDrink.drink_types?.emoji}</span>
                    <div>
                      <h2 className="text-lg font-bold">{selectedDrink.drink_types?.name}</h2>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Base: {selectedDrink.drink_types?.points}pts · Vol: {selectedDrink.volume?.toLocaleString()}🪙</p>
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelectedDrink(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
                </div>
                <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-hint)' }}>💡 Pasa el dedo para ver quién movió el precio</p>
                  <DetailChart history={drinkHistory} width={320} height={150} />
                </div>
                {(() => {
                  const mult = getMultiplier(selectedDrink.price)
                  const effPts = Math.round(selectedDrink.drink_types?.points * mult * 10) / 10
                  const effCoins = Math.floor(effPts * 10)
                  return (
                    <div className="grid grid-cols-3 gap-2 mb-4">
                      <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-input)' }}>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Pts ahora</p>
                        <p className="font-bold" style={{ color: mult > 1 ? '#10b981' : mult < 1 ? '#ef4444' : 'var(--text-primary)' }}>{effPts}pts</p>
                      </div>
                      <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-input)' }}>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Monedas</p>
                        <p className="font-bold" style={{ color: mult > 1 ? '#10b981' : mult < 1 ? '#ef4444' : '#f59e0b' }}>+{effCoins}🪙</p>
                      </div>
                      <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-input)' }}>
                        <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Ops hoy</p>
                        <p className={`font-bold ${opsRemaining > 0 ? 'text-amber-400' : 'text-red-400'}`}>{opsRemaining}/3</p>
                      </div>
                    </div>
                  )
                })()}
                {!marketOpen && (
                  <div className="rounded-xl p-3 mb-4 text-center" style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <p className="text-sm font-bold text-indigo-400">🌙 Mercado cerrado</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Solo puedes operar de 20:00 a 02:00h</p>
                  </div>
                )}
                {opsRemaining === 0 && marketOpen && (
                  <div className="rounded-xl p-3 mb-4 text-center" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <p className="text-sm font-bold text-red-400">⛔ Límite diario alcanzado</p>
                  </div>
                )}
                {tradeError && (
                  <div className="rounded-xl p-3 mb-4 text-center" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <p className="text-sm font-bold text-red-400">⚠️ {tradeError}</p>
                  </div>
                )}
                {marketOpen && opsRemaining > 0 && (
                  <>
                    <div className="mb-4">
                      <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Dirección</p>
                      <div className="flex gap-2">
                        {[{ d: 'long', label: '▲ LONG', sub: 'sube multiplicador', color: '#10b981', bg: 'rgba(16,185,129,0.2)' },
                          { d: 'short', label: '▼ SHORT', sub: 'baja multiplicador', color: '#ef4444', bg: 'rgba(239,68,68,0.2)' }].map(opt => (
                          <motion.button key={opt.d} whileTap={{ scale: 0.95 }} onClick={() => setTradeDirection(opt.d)}
                            className="flex-1 py-3 rounded-xl font-bold text-sm"
                            style={{ backgroundColor: tradeDirection === opt.d ? opt.bg : 'var(--bg-input)', color: tradeDirection === opt.d ? opt.color : 'var(--text-muted)', border: tradeDirection === opt.d ? `2px solid ${opt.color}` : '2px solid transparent' }}>
                            {opt.label}<br /><span className="text-xs font-normal">{opt.sub}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    <div className="mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Cantidad</p>
                        <p className="text-xs text-amber-400 font-bold">{tradeAmount}🪙 / {balance}🪙</p>
                      </div>
                      <input type="range" min="10" max={Math.min(Math.max(balance, 10), 1000)} step="10"
                        value={tradeAmount} onChange={e => setTradeAmount(Number(e.target.value))}
                        className="w-full accent-amber-500" />
                      <div className="flex justify-between mt-2 gap-2">
                        {[50, 100, 250, 500].map(v => (
                          <motion.button key={v} whileTap={{ scale: 0.9 }}
                            onClick={() => setTradeAmount(Math.min(v, balance))}
                            className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                            style={{ backgroundColor: tradeAmount === v ? '#f59e0b' : 'var(--bg-input)', color: tradeAmount === v ? '#fff' : 'var(--text-muted)' }}>{v}</motion.button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl p-3 mb-4 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Impacto estimado</p>
                      <p className="text-sm font-bold mt-1" style={{ color: tradeDirection === 'long' ? '#10b981' : '#ef4444' }}>
                        {tradeDirection === 'long' ? '+' : '-'}x{getImpactPreview(tradeAmount)} en el multiplicador
                      </p>
                    </div>
                    <motion.button whileTap={{ scale: 0.97 }} onClick={executeTrade}
                      disabled={trading || tradeAmount > balance || tradeAmount < 10}
                      className="w-full font-bold py-4 rounded-2xl text-white"
                      style={{ backgroundColor: tradeDirection === 'long' ? '#10b981' : '#ef4444' }}>
                      {trading ? 'Ejecutando...' : `${tradeDirection === 'long' ? '▲ LONG' : '▼ SHORT'} · ${tradeAmount}🪙`}
                    </motion.button>
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Modal powerup ── */}
      <AnimatePresence>
        {selectedPowerup && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
            onClick={() => { setSelectedPowerup(null); setTargetUser(null); setTurboDrink(null); setResetDrink(null) }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="rounded-t-3xl p-6 w-full max-w-lg overflow-y-auto"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '85vh', paddingBottom: '100px' }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedPowerup.emoji}</span>
                  <div>
                    <h2 className="text-lg font-bold">{selectedPowerup.name}</h2>
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{selectedPowerup.description}</p>
                    {selectedPowerup.effect_type === 'freeze' ? <p className="text-xs mt-0.5 text-blue-400">⏱ 15 minutos</p>
                      : selectedPowerup.duration_hours ? <p className="text-xs mt-0.5 text-amber-400">⏱ {selectedPowerup.duration_hours}h</p> : null}
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
                    style={{ backgroundColor: buyResult.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${buyResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
                    <p className="text-sm font-bold" style={{ color: buyResult.success ? '#10b981' : '#ef4444' }}>
                      {buyResult.success ? buyResult.extra?.target ? `✅ ${buyResult.extra.target} ha recibido el impacto` : '✅ Powerup activado'
                        : `⚠️ ${buyResult.error || 'Escudo bloqueó el ataque 🛡️'}`}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
              {needsTarget && (
                <div className="mb-5">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Objetivo en {selectedLeague?.name}</p>
                  <div className="space-y-2 max-h-44 overflow-y-auto">
                    {leagueMembers.length === 0
                      ? <p className="text-xs text-center py-4" style={{ color: 'var(--text-hint)' }}>No hay otros miembros</p>
                      : leagueMembers.map(member => (
                        <motion.button key={member.id} whileTap={{ scale: 0.97 }} onClick={() => setTargetUser(member)}
                          className="w-full rounded-xl p-3 flex items-center gap-3"
                          style={{ backgroundColor: targetUser?.id === member.id ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)', border: targetUser?.id === member.id ? '2px solid #f59e0b' : '2px solid transparent' }}>
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
                      <motion.button key={drink.id} whileTap={{ scale: 0.95 }} onClick={() => setTurboDrink(drink.id)}
                        className="rounded-xl p-3 flex items-center gap-2"
                        style={{ backgroundColor: turboDrink === drink.id ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)', border: turboDrink === drink.id ? '2px solid #f59e0b' : '2px solid transparent' }}>
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
                        <motion.button key={drink.drink_type_id} whileTap={{ scale: 0.95 }} onClick={() => setResetDrink(drink.drink_type_id)}
                          className="rounded-xl p-3 flex items-center gap-2"
                          style={{ backgroundColor: resetDrink === drink.drink_type_id ? 'rgba(245,158,11,0.15)' : 'var(--bg-input)', border: resetDrink === drink.drink_type_id ? '2px solid #f59e0b' : '2px solid transparent' }}>
                          <span className="text-xl">{drink.drink_types?.emoji}</span>
                          <div className="flex-1 text-left">
                            <p className="text-xs font-medium">{drink.drink_types?.name}</p>
                            <p className="text-xs" style={{ color: mult > 1.05 ? '#10b981' : mult < 0.95 ? '#ef4444' : 'var(--text-hint)' }}>x{mult.toFixed(2)}</p>
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
                disabled={buying || balance < selectedPowerup.cost || powerupCooldown > 0 || (needsTarget && !targetUser) || (needsTurboDrink && !turboDrink) || (needsResetDrink && !resetDrink)}
                className="w-full bg-amber-500 disabled:opacity-40 text-white font-bold py-4 rounded-2xl">
                {buying ? 'Activando...' : powerupCooldown > 0 ? `Cooldown: ${powerupCooldown}m` : `Activar · ${selectedPowerup.cost}🪙`}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}