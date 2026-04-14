import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerItem } from '../lib/animations'
import { soundSuccess, soundError } from '../lib/sounds'

// Mini gráfica de precios
function StockChart({ history, width = 80, height = 32 }) {
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
  const color = isUp ? '#10b981' : '#ef4444'
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// Gráfica grande para el detalle
function DetailStockChart({ history, width = 300, height = 120 }) {
  if (!history || history.length < 2) return (
    <div className="flex items-center justify-center" style={{ height }}>
      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Sin historial</p>
    </div>
  )
  const prices = history.map(h => h.price)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const pad = 20
  const toX = (i) => pad + (i / (prices.length - 1)) * (width - pad * 2)
  const toY = (p) => pad + (height - pad * 2) - ((p - min) / range) * (height - pad * 2)
  const pts = prices.map((p, i) => `${toX(i)},${toY(p)}`).join(' ')
  const area = `${toX(0)},${height - pad} ${pts} ${toX(prices.length - 1)},${height - pad}`
  const isUp = prices[prices.length - 1] >= prices[0]
  const color = isUp ? '#10b981' : '#ef4444'
  const current = prices[prices.length - 1]
  const start = prices[0]
  const pct = (((current - start) / start) * 100).toFixed(1)

  return (
    <div>
      <div className="flex items-end gap-2 mb-2">
        <span className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          {current.toLocaleString()}🪙
        </span>
        <span className={`text-sm font-semibold mb-0.5 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? '▲' : '▼'} {Math.abs(pct)}%
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="stock-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((t, i) => (
          <line key={i} x1={pad} y1={pad + (height - pad * 2) * t}
            x2={width - pad} y2={pad + (height - pad * 2) * t}
            stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 3" />
        ))}
        <polygon points={area} fill="url(#stock-grad)" />
        <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={toX(prices.length - 1)} cy={toY(current)} r="4" fill={color} />
      </svg>
    </div>
  )
}

export default function StockMarket({ balance, onBalanceChange }) {
  const { user } = useAuth()
  const [companies, setCompanies] = useState([])
  const [myPositions, setMyPositions] = useState([])
  const [myDividends, setMyDividends] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedCompany, setSelectedCompany] = useState(null)
  const [companyHistory, setCompanyHistory] = useState([])
  const [allPositions, setAllPositions] = useState([])
  const [sharesToBuy, setSharesToBuy] = useState(1)
  const [sharesToSell, setSharesToSell] = useState(1)
  const [activeAction, setActiveAction] = useState('buy')
  const [transacting, setTransacting] = useState(false)
  const [txResult, setTxResult] = useState(null)
  const [marketView, setMarketView] = useState('index') // index | portfolio

  // Horario de mercado (10:00-18:00 hora española)
  const isMarketOpen = () => {
    const now = new Date()
    const madrid = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
    const h = madrid.getHours()
    return h >= 10 && h < 18
  }
  const marketOpen = isMarketOpen()

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    const [
      { data: companiesData },
      { data: positionsData },
      { data: dividendsData },
      { data: allPosData },
    ] = await Promise.all([
      supabase.from('stock_companies').select('*').eq('active', true).order('id'),
      supabase.from('stock_positions')
        .select('*, stock_companies(name, emoji, share_price, dividend_rate, base_price)')
        .eq('user_id', user.id),
      supabase.from('stock_dividends')
        .select('*, stock_companies(name, emoji)')
        .eq('user_id', user.id)
        .order('paid_at', { ascending: false }).limit(10),
      supabase.from('stock_positions')
        .select('company_id, shares, user_id, profiles(username, avatar_url)')
        .order('shares', { ascending: false }),
    ])

    setCompanies(companiesData || [])
    setMyPositions(positionsData || [])
    setMyDividends(dividendsData || [])

    // Agrupar posiciones por empresa para mostrar accionistas
    const grouped = {}
    for (const p of (allPosData || [])) {
      if (!grouped[p.company_id]) grouped[p.company_id] = []
      grouped[p.company_id].push(p)
    }
    setAllPositions(grouped)

    setLoading(false)
  }

  const openCompanyDetail = async (company) => {
    setSelectedCompany(company)
    setSharesToBuy(1)
    setSharesToSell(1)
    setActiveAction('buy')
    setTxResult(null)
    const { data } = await supabase
      .from('stock_price_history').select('*')
      .eq('company_id', company.id)
      .order('recorded_at', { ascending: true }).limit(60)
    setCompanyHistory(data || [])
  }

  const handleBuy = async () => {
    if (!selectedCompany || sharesToBuy < 1) return
    setTransacting(true)
    const { data } = await supabase.rpc('buy_stock', {
      p_company_id: selectedCompany.id,
      p_shares: sharesToBuy,
    })
    if (data?.success) {
      soundSuccess()
      setTxResult({ type: 'buy', ...data })
      onBalanceChange && onBalanceChange(-data.total_cost)
      fetchAll()
      setTimeout(() => setTxResult(null), 4000)
    } else {
      soundError()
      setTxResult({ type: 'error', error: data?.error })
      setTimeout(() => setTxResult(null), 3000)
    }
    setTransacting(false)
  }

  const handleSell = async () => {
    if (!selectedCompany || sharesToSell < 1) return
    setTransacting(true)
    const { data } = await supabase.rpc('sell_stock', {
      p_company_id: selectedCompany.id,
      p_shares: sharesToSell,
    })
    if (data?.success) {
      soundSuccess()
      setTxResult({ type: 'sell', ...data })
      onBalanceChange && onBalanceChange(data.total_value)
      fetchAll()
      setTimeout(() => setTxResult(null), 4000)
    } else {
      soundError()
      setTxResult({ type: 'error', error: data?.error })
      setTimeout(() => setTxResult(null), 3000)
    }
    setTransacting(false)
  }

  // Calcular índice S&PINTA 500 (promedio ponderado de precios)
  const spintaIndex = companies.length > 0
    ? Math.round(companies.reduce((sum, c) => sum + c.share_price, 0) / companies.length)
    : 0

  const spintaBaseIndex = companies.length > 0
    ? Math.round(companies.reduce((sum, c) => sum + c.base_price, 0) / companies.length)
    : 0

  const spintaChange = spintaBaseIndex > 0
    ? (((spintaIndex - spintaBaseIndex) / spintaBaseIndex) * 100).toFixed(2)
    : '0.00'

  const formatDate = (ts) => new Date(ts).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
  })

  const myPosition = selectedCompany
    ? myPositions.find(p => p.company_id === selectedCompany.id)
    : null

  const getShareholdersPct = (companyId) => {
    const positions = allPositions[companyId] || []
    const company = companies.find(c => c.id === companyId)
    if (!company || !positions.length) return []
    return positions
      .sort((a, b) => b.shares - a.shares)
      .slice(0, 5)
      .map(p => ({
        ...p,
        pct: ((p.shares / company.total_shares) * 100).toFixed(1),
      }))
  }

  const totalPortfolioValue = myPositions.reduce((sum, p) => {
    const company = companies.find(c => c.id === p.company_id)
    return sum + (company ? company.share_price * p.shares : 0)
  }, 0)

  const totalInvested = myPositions.reduce((sum, p) => sum + p.total_invested, 0)
  const totalPnl = totalPortfolioValue - totalInvested

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="text-center">
        <motion.div className="text-4xl mb-2" animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>📈</motion.div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Cargando S&PINTA 500...</p>
      </div>
    </div>
  )

  return (
    <div className="max-w-md mx-auto px-4 pt-4">

      {/* Header S&PINTA 500 */}
      <motion.div {...fadeIn} className="rounded-2xl p-4 mb-4"
        style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.15))', border: '1px solid rgba(99,102,241,0.3)' }}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs font-bold text-indigo-400">S&PINTA 500 🍺</p>
            <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {spintaIndex.toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            <span className={`text-sm font-bold px-2 py-1 rounded-full ${parseFloat(spintaChange) >= 0 ? 'bg-emerald-900 text-emerald-400' : 'bg-red-900 text-red-400'}`}>
              {parseFloat(spintaChange) >= 0 ? '▲' : '▼'} {Math.abs(parseFloat(spintaChange))}%
            </span>
            <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>{companies.length} empresas cotizadas</p>
          </div>
        </div>

        {/* Estado del mercado */}
        <div className="flex items-center gap-2 mt-2">
          <motion.div
            className="w-2 h-2 rounded-full"
            animate={marketOpen ? { opacity: [1, 0.3, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{ backgroundColor: marketOpen ? '#10b981' : '#ef4444' }}
          />
          <span className="text-xs font-medium" style={{ color: marketOpen ? '#10b981' : '#ef4444' }}>
            {marketOpen ? 'Mercado abierto · cierra a las 18:00h' : 'Mercado cerrado · abre a las 10:00h'}
          </span>
        </div>
      </motion.div>

      {/* Pestañas */}
      <div className="flex rounded-xl p-1 mb-4" style={{ backgroundColor: 'var(--bg-input)' }}>
        {[
          { id: 'index', label: '🏢 Empresas' },
          { id: 'portfolio', label: '💼 Mi cartera' },
        ].map(t => (
          <button key={t.id} onClick={() => setMarketView(t.id)}
            className="relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10"
            style={{ color: marketView === t.id ? '#fff' : 'var(--text-muted)' }}>
            {marketView === t.id && (
              <motion.div layoutId="stock-tab" className="absolute inset-0 bg-indigo-600 rounded-lg"
                style={{ zIndex: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
            )}
            {t.label}
          </button>
        ))}
      </div>

      {/* ── EMPRESAS ── */}
      {marketView === 'index' && (
        <div className="space-y-3">
          {companies.map(company => {
            const pctChange = (((company.share_price - company.base_price) / company.base_price) * 100).toFixed(1)
            const isUp = company.share_price >= company.base_price
            const myPos = myPositions.find(p => p.company_id === company.id)
            const availablePct = ((company.total_shares - company.shares_sold) / company.total_shares * 100).toFixed(0)
            const shareholders = getShareholdersPct(company.id)

            return (
              <motion.button key={company.id} variants={staggerItem} initial="initial" animate="animate"
                whileTap={{ scale: 0.98 }} onClick={() => openCompanyDetail(company)}
                className="w-full rounded-2xl p-4 text-left" style={{ backgroundColor: 'var(--bg-card)' }}>

                {/* Fila principal */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ backgroundColor: 'var(--bg-input)' }}>
                    {company.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm">{company.name}</p>
                      {myPos && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-indigo-900 text-indigo-400 font-medium">
                          {myPos.shares} acc.
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{company.sector}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm">{company.share_price.toLocaleString()}🪙</p>
                    <p className={`text-xs font-bold ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isUp ? '▲' : '▼'} {Math.abs(parseFloat(pctChange))}%
                    </p>
                  </div>
                </div>

                {/* Barra de acciones disponibles */}
                <div className="mb-2">
                  <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-hint)' }}>
                    <span>Acciones disponibles</span>
                    <span>{company.total_shares - company.shares_sold} / {company.total_shares}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: 'var(--bg-input)' }}>
                    <div className="h-1.5 rounded-full bg-indigo-500"
                      style={{ width: `${availablePct}%` }} />
                  </div>
                </div>

                {/* Accionistas */}
                {shareholders.length > 0 && (
                  <div className="flex items-center gap-1 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-xs mr-1" style={{ color: 'var(--text-hint)' }}>Accionistas:</span>
                    <div className="flex gap-1 flex-wrap">
                      {shareholders.map((s, i) => (
                        <span key={i} className="text-xs px-1.5 py-0.5 rounded-full"
                          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                          {s.profiles?.username} {s.pct}%
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dividendo */}
                <div className="flex justify-between items-center pt-2 mt-1 border-t" style={{ borderColor: 'var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-hint)' }}>
                    💰 Dividendo diario base
                  </span>
                  <span className="text-xs font-bold text-amber-400">
                    {(company.dividend_rate * 100).toFixed(1)}% · ~{Math.floor(company.share_price * company.dividend_rate)}🪙/acc
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* ── MI CARTERA ── */}
      {marketView === 'portfolio' && (
        <motion.div {...fadeIn}>
          {/* Resumen */}
          <div className="rounded-2xl p-5 mb-4"
            style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${totalPnl >= 0 ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
            <p className="text-xs mb-3 font-bold" style={{ color: 'var(--text-muted)' }}>Resumen de cartera</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Valor actual</p>
                <p className="font-bold text-indigo-400">{totalPortfolioValue.toLocaleString()}🪙</p>
              </div>
              <div className="text-center border-x" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Invertido</p>
                <p className="font-bold">{totalInvested.toLocaleString()}🪙</p>
              </div>
              <div className="text-center">
                <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>P&L</p>
                <p className={`font-bold ${totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString()}🪙
                </p>
              </div>
            </div>
          </div>

          {myPositions.length === 0 ? (
            <div className="text-center py-12" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">📊</div>
              <p className="font-medium">Sin acciones todavía</p>
              <p className="text-sm mt-1">Ve a Empresas para invertir</p>
            </div>
          ) : (
            <div className="space-y-3 mb-6">
              {myPositions.map(pos => {
                const company = companies.find(c => c.id === pos.company_id)
                if (!company) return null
                const currentValue = company.share_price * pos.shares
                const pnl = currentValue - pos.total_invested
                const pnlPct = ((pnl / pos.total_invested) * 100).toFixed(1)
                const dailyDividend = Math.floor(pos.shares * company.share_price * company.dividend_rate)

                return (
                  <motion.div key={pos.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: 'var(--bg-input)' }}>
                        {company.emoji}
                      </div>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{company.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                          {pos.shares} acciones · precio medio {pos.avg_buy_price.toLocaleString()}🪙
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">{currentValue.toLocaleString()}🪙</p>
                        <p className={`text-xs font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()}🪙 ({pnlPct}%)
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t"
                      style={{ borderColor: 'var(--border)' }}>
                      <span className="text-xs" style={{ color: 'var(--text-hint)' }}>💰 Dividendo estimado hoy</span>
                      <span className="text-xs font-bold text-amber-400">~{dailyDividend}🪙</span>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}

          {/* Historial dividendos */}
          {myDividends.length > 0 && (
            <div>
              <p className="text-sm font-bold mb-3">💰 Últimos dividendos recibidos</p>
              <div className="space-y-2">
                {myDividends.map(d => (
                  <div key={d.id} className="rounded-2xl p-3 flex items-center gap-3"
                    style={{ backgroundColor: 'var(--bg-card)' }}>
                    <span className="text-xl">{d.stock_companies?.emoji}</span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{d.stock_companies?.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                        {formatDate(d.paid_at)} · {d.shares} acc.
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
        </motion.div>
      )}

      {/* Modal detalle empresa */}
      <AnimatePresence>
        {selectedCompany && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-end justify-center z-50"
            onClick={() => setSelectedCompany(null)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="rounded-t-3xl w-full max-w-lg overflow-y-auto"
              style={{
                backgroundColor: 'var(--bg-card)',
                color: 'var(--text-primary)',
                maxHeight: '90vh',
                paddingBottom: '100px',
              }}>

              {/* Cabecera */}
              <div className="p-6 pb-0">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-3xl"
                      style={{ backgroundColor: 'var(--bg-input)' }}>
                      {selectedCompany.emoji}
                    </div>
                    <div>
                      <h2 className="text-lg font-bold">{selectedCompany.name}</h2>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                        {selectedCompany.sector} · {selectedCompany.description}
                      </p>
                    </div>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelectedCompany(null)}
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
                </div>

                {/* Gráfica */}
                <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
                  <DetailStockChart history={companyHistory} width={320} height={130} />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Precio actual</p>
                    <p className="font-bold text-indigo-400 text-sm">{selectedCompany.share_price.toLocaleString()}🪙</p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Dividendo/acc</p>
                    <p className="font-bold text-amber-400 text-sm">
                      ~{Math.floor(selectedCompany.share_price * selectedCompany.dividend_rate)}🪙
                    </p>
                  </div>
                  <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-base)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-hint)' }}>Disponibles</p>
                    <p className="font-bold text-sm">
                      {selectedCompany.total_shares - selectedCompany.shares_sold}
                    </p>
                  </div>
                </div>

                {/* Mi posición */}
                {myPosition && (
                  <div className="rounded-xl p-3 mb-4"
                    style={{ backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)' }}>
                    <p className="text-xs font-bold text-indigo-400 mb-2">Tu posición actual</p>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>Acciones</span>
                      <span className="font-bold">{myPosition.shares}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>Valor actual</span>
                      <span className="font-bold">
                        {(selectedCompany.share_price * myPosition.shares).toLocaleString()}🪙
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span style={{ color: 'var(--text-muted)' }}>P&L</span>
                      {(() => {
                        const pnl = (selectedCompany.share_price - myPosition.avg_buy_price) * myPosition.shares
                        return (
                          <span className={`font-bold ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()}🪙
                          </span>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {/* Resultado de transacción */}
                <AnimatePresence>
                  {txResult && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                      className="rounded-xl p-3 mb-4 text-center"
                      style={{
                        backgroundColor: txResult.type === 'error' ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                        border: `1px solid ${txResult.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
                      }}>
                      {txResult.type === 'buy' && (
                        <>
                          <p className="font-bold text-emerald-400">✅ {txResult.shares} acciones compradas</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                            Coste total: {txResult.total_cost.toLocaleString()}🪙
                          </p>
                        </>
                      )}
                      {txResult.type === 'sell' && (
                        <>
                          <p className="font-bold text-emerald-400">✅ {txResult.shares_sold} acciones vendidas</p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                            Recibido: {txResult.total_value.toLocaleString()}🪙
                            {txResult.pnl !== 0 && (
                              <span className={txResult.pnl > 0 ? ' text-emerald-400' : ' text-red-400'}>
                                {' '}({txResult.pnl > 0 ? '+' : ''}{txResult.pnl.toLocaleString()}🪙)
                              </span>
                            )}
                          </p>
                        </>
                      )}
                      {txResult.type === 'error' && (
                        <p className="font-bold text-red-400">⚠️ {txResult.error}</p>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Estado del mercado */}
                {!marketOpen && (
                  <div className="rounded-xl p-3 mb-4 text-center"
                    style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}>
                    <p className="text-sm font-bold text-red-400">🔒 Mercado cerrado</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                      Las operaciones solo están disponibles de 10:00 a 18:00h
                    </p>
                  </div>
                )}

                {/* Tabs comprar/vender */}
                {marketOpen && (
                  <>
                    <div className="flex rounded-xl p-1 mb-4" style={{ backgroundColor: 'var(--bg-input)' }}>
                      {[
                        { id: 'buy', label: '🟢 Comprar' },
                        { id: 'sell', label: '🔴 Vender' },
                      ].map(t => (
                        <button key={t.id} onClick={() => setActiveAction(t.id)}
                          className="relative flex-1 py-2 rounded-lg text-xs font-medium transition-colors z-10"
                          style={{ color: activeAction === t.id ? '#fff' : 'var(--text-muted)' }}>
                          {activeAction === t.id && (
                            <motion.div layoutId="action-tab"
                              className="absolute inset-0 rounded-lg"
                              style={{ zIndex: -1, backgroundColor: t.id === 'buy' ? '#10b981' : '#ef4444' }}
                              transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                          )}
                          {t.label}
                        </button>
                      ))}
                    </div>

                    {/* Comprar */}
                    {activeAction === 'buy' && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                            Número de acciones
                          </p>
                          <p className="text-xs text-indigo-400 font-bold">
                            Coste: {(selectedCompany.share_price * sharesToBuy).toLocaleString()}🪙
                          </p>
                        </div>
                        <div className="flex items-center gap-3 mb-3">
                          <motion.button whileTap={{ scale: 0.9 }}
                            onClick={() => setSharesToBuy(Math.max(1, sharesToBuy - 1))}
                            className="w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center"
                            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>−</motion.button>
                          <div className="flex-1 text-center">
                            <p className="text-2xl font-bold text-indigo-400">{sharesToBuy}</p>
                            <p className="text-xs" style={{ color: 'var(--text-hint)' }}>acciones</p>
                          </div>
                          <motion.button whileTap={{ scale: 0.9 }}
                            onClick={() => setSharesToBuy(Math.min(
                              sharesToBuy + 1,
                              selectedCompany.total_shares - selectedCompany.shares_sold
                            ))}
                            className="w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center"
                            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>+</motion.button>
                        </div>
                        <div className="flex gap-2 mb-4">
                          {[1, 2, 5, 10].map(v => (
                            <motion.button key={v} whileTap={{ scale: 0.9 }}
                              onClick={() => setSharesToBuy(Math.min(v,
                                selectedCompany.total_shares - selectedCompany.shares_sold))}
                              className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                              style={{
                                backgroundColor: sharesToBuy === v ? '#6366f1' : 'var(--bg-input)',
                                color: sharesToBuy === v ? '#fff' : 'var(--text-muted)',
                              }}>{v}</motion.button>
                          ))}
                        </div>
                        <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
                          <div className="flex justify-between text-sm mb-1">
                            <span style={{ color: 'var(--text-muted)' }}>Precio por acción</span>
                            <span className="font-medium">{selectedCompany.share_price.toLocaleString()}🪙</span>
                          </div>
                          <div className="flex justify-between text-sm mb-1">
                            <span style={{ color: 'var(--text-muted)' }}>Dividendo diario estimado</span>
                            <span className="font-medium text-amber-400">
                              ~{Math.floor(selectedCompany.share_price * selectedCompany.dividend_rate * sharesToBuy)}🪙
                            </span>
                          </div>
                          <div className="border-t pt-1 mt-1 flex justify-between text-sm"
                            style={{ borderColor: 'var(--border)' }}>
                            <span className="font-bold">Total a pagar</span>
                            <span className="font-bold text-indigo-400">
                              {(selectedCompany.share_price * sharesToBuy).toLocaleString()}🪙
                            </span>
                          </div>
                        </div>
                        <motion.button whileTap={{ scale: 0.97 }} onClick={handleBuy}
                          disabled={transacting || balance < selectedCompany.share_price * sharesToBuy}
                          className="w-full py-4 rounded-2xl font-bold text-white text-sm"
                          style={{ backgroundColor: '#10b981' }}>
                          {transacting ? 'Comprando...' :
                            balance < selectedCompany.share_price * sharesToBuy
                              ? `Necesitas ${(selectedCompany.share_price * sharesToBuy - balance).toLocaleString()}🪙 más`
                              : `Comprar ${sharesToBuy} acc. · ${(selectedCompany.share_price * sharesToBuy).toLocaleString()}🪙`}
                        </motion.button>
                      </div>
                    )}

                    {/* Vender */}
                    {activeAction === 'sell' && (
                      <div>
                        {!myPosition ? (
                          <div className="text-center py-6" style={{ color: 'var(--text-muted)' }}>
                            <p className="text-sm">No tienes acciones de esta empresa</p>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                                Acciones a vender (tienes {myPosition.shares})
                              </p>
                              <p className="text-xs text-emerald-400 font-bold">
                                Recibirás: {(selectedCompany.share_price * sharesToSell).toLocaleString()}🪙
                              </p>
                            </div>
                            <div className="flex items-center gap-3 mb-3">
                              <motion.button whileTap={{ scale: 0.9 }}
                                onClick={() => setSharesToSell(Math.max(1, sharesToSell - 1))}
                                className="w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center"
                                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>−</motion.button>
                              <div className="flex-1 text-center">
                                <p className="text-2xl font-bold text-red-400">{sharesToSell}</p>
                                <p className="text-xs" style={{ color: 'var(--text-hint)' }}>acciones</p>
                              </div>
                              <motion.button whileTap={{ scale: 0.9 }}
                                onClick={() => setSharesToSell(Math.min(sharesToSell + 1, myPosition.shares))}
                                className="w-10 h-10 rounded-xl font-bold text-lg flex items-center justify-center"
                                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>+</motion.button>
                            </div>
                            <div className="flex gap-2 mb-4">
                              {[1, 2, 5].filter(v => v <= myPosition.shares).map(v => (
                                <motion.button key={v} whileTap={{ scale: 0.9 }}
                                  onClick={() => setSharesToSell(v)}
                                  className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                                  style={{
                                    backgroundColor: sharesToSell === v ? '#ef4444' : 'var(--bg-input)',
                                    color: sharesToSell === v ? '#fff' : 'var(--text-muted)',
                                  }}>{v}</motion.button>
                              ))}
                              <motion.button whileTap={{ scale: 0.9 }}
                                onClick={() => setSharesToSell(myPosition.shares)}
                                className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                                style={{
                                  backgroundColor: sharesToSell === myPosition.shares ? '#ef4444' : 'var(--bg-input)',
                                  color: sharesToSell === myPosition.shares ? '#fff' : 'var(--text-muted)',
                                }}>Todo</motion.button>
                            </div>
                            {(() => {
                              const pnl = (selectedCompany.share_price - myPosition.avg_buy_price) * sharesToSell
                              return (
                                <div className="rounded-xl p-3 mb-4" style={{ backgroundColor: 'var(--bg-base)' }}>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span style={{ color: 'var(--text-muted)' }}>Precio actual</span>
                                    <span className="font-medium">{selectedCompany.share_price.toLocaleString()}🪙</span>
                                  </div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span style={{ color: 'var(--text-muted)' }}>Precio medio compra</span>
                                    <span className="font-medium">{myPosition.avg_buy_price.toLocaleString()}🪙</span>
                                  </div>
                                  <div className="flex justify-between text-sm mb-1">
                                    <span style={{ color: 'var(--text-muted)' }}>P&L estimado</span>
                                    <span className={`font-medium ${pnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                      {pnl >= 0 ? '+' : ''}{pnl.toLocaleString()}🪙
                                    </span>
                                  </div>
                                  <div className="border-t pt-1 mt-1 flex justify-between text-sm"
                                    style={{ borderColor: 'var(--border)' }}>
                                    <span className="font-bold">Total a recibir</span>
                                    <span className="font-bold text-emerald-400">
                                      {(selectedCompany.share_price * sharesToSell).toLocaleString()}🪙
                                    </span>
                                  </div>
                                </div>
                              )
                            })()}
                            <motion.button whileTap={{ scale: 0.97 }} onClick={handleSell}
                              disabled={transacting}
                              className="w-full py-4 rounded-2xl font-bold text-white text-sm"
                              style={{ backgroundColor: '#ef4444' }}>
                              {transacting ? 'Vendiendo...' :
                                `Vender ${sharesToSell} acc. · ${(selectedCompany.share_price * sharesToSell).toLocaleString()}🪙`}
                            </motion.button>
                          </>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}