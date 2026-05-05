import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

// ─── MINI SPARKLINE ──────────────────────────────────────────────────────────
function Sparkline({ data, color = '#f59e0b', height = 40 }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const w = 120, h = height
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w
    const y = h - ((v - min) / range) * (h - 6) - 3
    return `${x},${y}`
  }).join(' ')
  const last = data[data.length - 1]
  const first = data[0]
  const up = last >= first
  const lineColor = up ? '#10b981' : '#ef4444'
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sg-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline points={pts} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts.split(' ').pop().split(',')[0]} cy={pts.split(' ').pop().split(',')[1]}
        r="2.5" fill={lineColor} />
    </svg>
  )
}

// ─── TICKER DE MERCADO ───────────────────────────────────────────────────────
function MarketTicker({ marketSnapshot }) {
  const drinks = marketSnapshot?.drinks || []
  if (!drinks.length) return null

  // Calcular variación simulada basada en puntos (más puntos = más volátil)
  const items = drinks.map(d => {
    const seed = d.name.length + Math.floor(d.points)
    const change = (((seed * 7 + Date.now() / 86400000) % 20) - 10).toFixed(2)
    return { name: d.name, emoji: d.emoji, pts: d.points, change: parseFloat(change) }
  })

  const totalWidth = items.length * 160
  return (
    <div className="overflow-hidden relative" style={{ background: '#0a0a0a', borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
      <div className="flex items-center gap-0">
        <div className="flex-shrink-0 px-3 py-1.5 text-xs font-black tracking-widest z-10"
          style={{ background: '#f59e0b', color: '#000' }}>
          MERCADO
        </div>
        <div className="overflow-hidden flex-1">
          <motion.div className="flex gap-8 py-1.5 px-4 whitespace-nowrap"
            animate={{ x: [0, -totalWidth] }}
            transition={{ duration: items.length * 3, repeat: Infinity, ease: 'linear' }}>
            {[...items, ...items, ...items].map((item, i) => (
              <span key={i} className="text-xs font-bold flex items-center gap-1.5">
                <span>{item.emoji}</span>
                <span style={{ color: 'rgba(255,255,255,0.7)' }}>{item.name}</span>
                <span className="text-xs font-black" style={{ color: 'rgba(255,255,255,0.3)' }}>{item.pts}pts</span>
                <span style={{ color: item.change >= 0 ? '#10b981' : '#ef4444' }}>
                  {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change)}%
                </span>
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

// ─── TARJETA FEATURED (grande, portada) ─────────────────────────────────────
function FeaturedCard({ article, onClick }) {
  const catColors = {
    economia: { bg: '#f59e0b', text: '#000', label: '📈 ECONOMÍA' },
    deportes: { bg: '#3b82f6', text: '#fff', label: '⚽ DEPORTES' },
    cotilleo: { bg: '#ec4899', text: '#fff', label: '💅 COTILLEO' },
    actualidad: { bg: '#8b5cf6', text: '#fff', label: '🗞️ ACTUALIDAD' },
    variedades: { bg: '#06b6d4', text: '#000', label: '🎲 VARIEDADES' },
  }
  const cat = catColors[article.category] || catColors.actualidad
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(article)}
      className="relative overflow-hidden cursor-pointer"
      style={{
        background: 'linear-gradient(135deg, #111 0%, #1a1a1a 100%)',
        border: `2px solid ${cat.bg}40`,
        borderRadius: 16,
      }}>
      {/* Fondo decorativo */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-8 -right-8 text-9xl opacity-10 select-none"
          style={{ filter: 'blur(2px)' }}>{article.icon}</div>
        <div className="absolute inset-0" style={{
          background: `radial-gradient(ellipse at 80% 20%, ${cat.bg}18 0%, transparent 65%)`
        }} />
      </div>

      <div className="relative p-5">
        {/* Badge categoría */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black mb-3"
          style={{ background: cat.bg, color: cat.text }}>
          {cat.label}
        </div>

        {/* Titular */}
        <h2 className="font-black text-white leading-tight mb-2"
          style={{ fontSize: 20, fontFamily: '"Georgia", serif', letterSpacing: '-0.02em' }}>
          {article.headline}
        </h2>
        <p className="text-sm mb-3" style={{ color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
          {article.subtitle}
        </p>

        {/* Chart si es economía */}
        {article.category === 'economia' && article.chart_data && (
          <div className="mb-3 -mx-1">
            <Sparkline data={article.chart_data} height={48} />
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3"
          style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-xs font-bold" style={{ color: cat.bg }}>
            ✍️ {article.author}
          </span>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold"
            style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)' }}>
            Leer más →
          </span>
        </div>
      </div>
    </motion.div>
  )
}

// ─── TARJETA PEQUEÑA ─────────────────────────────────────────────────────────
function SmallCard({ article, index, onClick }) {
  const catColors = {
    economia: { accent: '#f59e0b', label: '📈' },
    deportes: { accent: '#3b82f6', label: '⚽' },
    cotilleo: { accent: '#ec4899', label: '💅' },
    actualidad: { accent: '#8b5cf6', label: '🗞️' },
    variedades: { accent: '#06b6d4', label: '🎲' },
  }
  const cat = catColors[article.category] || catColors.actualidad

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => onClick(article)}
      className="flex gap-3 cursor-pointer p-3 rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>

      {/* Icono categoría */}
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
        style={{ background: cat.accent + '18', border: `1px solid ${cat.accent}30` }}>
        {article.icon}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-black" style={{ color: cat.accent }}>{cat.label}</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>•</span>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>{article.author}</span>
        </div>
        <p className="font-black text-sm leading-snug text-white truncate"
          style={{ fontFamily: '"Georgia", serif' }}>
          {article.headline}
        </p>
        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'rgba(255,255,255,0.4)', lineHeight: 1.4 }}>
          {article.subtitle}
        </p>
        {/* Mini chart inline para economía */}
        {article.category === 'economia' && article.chart_data && (
          <div className="mt-1.5">
            <Sparkline data={article.chart_data} height={24} />
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── MODAL ARTÍCULO COMPLETO ─────────────────────────────────────────────────
function ArticleModal({ article, onClose }) {
  if (!article) return null
  const catColors = {
    economia: { bg: '#f59e0b', text: '#000', label: '📈 ECONOMÍA' },
    deportes: { bg: '#3b82f6', text: '#fff', label: '⚽ DEPORTES' },
    cotilleo: { bg: '#ec4899', text: '#fff', label: '💅 COTILLEO' },
    actualidad: { bg: '#8b5cf6', text: '#fff', label: '🗞️ ACTUALIDAD' },
    variedades: { bg: '#06b6d4', text: '#000', label: '🎲 VARIEDADES' },
  }
  const cat = catColors[article.category] || catColors.actualidad

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 40 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-lg mx-auto rounded-t-3xl overflow-hidden"
        style={{ background: '#111', maxHeight: '88vh', overflowY: 'auto' }}>

        {/* Header */}
        <div className="sticky top-0 z-10 px-5 pt-5 pb-4"
          style={{ background: '#111', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black"
              style={{ background: cat.bg, color: cat.text }}>
              {cat.label}
            </div>
            <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              ✕
            </motion.button>
          </div>
          <h1 className="font-black text-white leading-tight"
            style={{ fontSize: 22, fontFamily: '"Georgia", serif', letterSpacing: '-0.02em' }}>
            {article.headline}
          </h1>
          <p className="mt-2 text-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
            {article.subtitle}
          </p>
        </div>

        {/* Contenido */}
        <div className="px-5 py-4">
          {/* Chart grande si es economía */}
          {article.category === 'economia' && article.chart_data && (
            <div className="mb-5 p-4 rounded-2xl" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-black text-amber-400">EVOLUCIÓN DE PRECIO</span>
                <span className="text-xs font-black" style={{
                  color: article.chart_data[article.chart_data.length-1] >= article.chart_data[0] ? '#10b981' : '#ef4444'
                }}>
                  {article.chart_data[article.chart_data.length-1] >= article.chart_data[0] ? '▲' : '▼'}
                  {' '}{Math.abs(article.chart_data[article.chart_data.length-1] - article.chart_data[0]).toFixed(1)} pts
                </span>
              </div>
              <Sparkline data={article.chart_data} height={64} />
              <div className="flex justify-between mt-2">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Min: {Math.min(...article.chart_data).toFixed(0)}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Actual: {article.chart_data[article.chart_data.length-1].toFixed(0)}
                </span>
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  Max: {Math.max(...article.chart_data).toFixed(0)}
                </span>
              </div>
            </div>
          )}

          {/* Cuerpo */}
          <p className="leading-relaxed text-sm" style={{ color: 'rgba(255,255,255,0.7)', lineHeight: 1.8 }}>
            {article.body}
          </p>

          {/* Firma */}
          <div className="mt-5 pt-4 flex items-center gap-2"
            style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
              style={{ background: cat.bg + '25', border: `1px solid ${cat.bg}40` }}>
              ✍️
            </div>
            <div>
              <p className="text-xs font-black" style={{ color: cat.bg }}>{article.author}</p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                El Heraldo de la Caña
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── SELECTOR DE BLOQUE ──────────────────────────────────────────────────────
function BlockSelector({ blocks, selectedId, onSelect }) {
  if (!blocks.length) return null
  return (
    <div className="flex gap-2 px-4 py-3 overflow-x-auto"
      style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      {blocks.map(block => {
        const isMorning = block.block_type === 'morning'
        const date = new Date(block.generated_at)
        const label = date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })
        const isSelected = block.id === selectedId
        return (
          <motion.button key={block.id} whileTap={{ scale: 0.94 }}
            onClick={() => onSelect(block.id)}
            className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black"
            style={{
              background: isSelected ? (isMorning ? '#f59e0b' : '#6366f1') : 'rgba(255,255,255,0.05)',
              color: isSelected ? (isMorning ? '#000' : '#fff') : 'rgba(255,255,255,0.4)',
              border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.08)',
            }}>
            <span>{isMorning ? '🌅' : '🌆'}</span>
            <span>{isMorning ? 'Mañana' : 'Tarde'}</span>
            <span className="opacity-70">{label}</span>
          </motion.button>
        )
      })}
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function News() {
  const [blocks, setBlocks] = useState([])
  const [selectedBlock, setSelectedBlock] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('all')

  useEffect(() => { fetchBlocks() }, [])

  const fetchBlocks = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('news_blocks')
      .select('*')
      .eq('active', true)
      .gt('expires_at', new Date().toISOString())
      .order('generated_at', { ascending: false })
      .limit(6)

    if (data?.length) {
      setBlocks(data)
      setSelectedBlock(data[0])
    }
    setLoading(false)
  }

  const selectBlock = (id) => {
    const block = blocks.find(b => b.id === id)
    if (block) { setSelectedBlock(block); setFilterCat('all') }
  }

  const articles = selectedBlock?.articles || []
  const featured = articles.find(a => a.featured) || articles[0]
  const rest = articles.filter(a => a !== featured)
  const filtered = filterCat === 'all' ? rest : rest.filter(a => a.category === filterCat)

  const catFilters = [
    { id: 'all', label: 'Todo', icon: '📰' },
    { id: 'economia', label: 'Mercado', icon: '📈' },
    { id: 'deportes', label: 'Deporte', icon: '⚽' },
    { id: 'cotilleo', label: 'Cotilleo', icon: '💅' },
    { id: 'actualidad', label: 'Actualidad', icon: '🗞️' },
    { id: 'variedades', label: 'Varios', icon: '🎲' },
  ]

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ background: '#0a0a0a' }}>
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        className="text-4xl">📰</motion.div>
      <p className="font-black text-white" style={{ fontFamily: '"Georgia", serif' }}>
        Cargando la redacción...
      </p>
      <div className="flex gap-1.5">
        {[0,1,2].map(i => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400"
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.25 }} />
        ))}
      </div>
    </div>
  )

  // ── Sin noticias ────────────────────────────────────────────────────────────
  if (!blocks.length) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{ background: '#0a0a0a' }}>
      <div className="text-6xl mb-2">📰</div>
      <h2 className="font-black text-2xl text-white" style={{ fontFamily: '"Georgia", serif' }}>
        La redacción está de siesta
      </h2>
      <p className="text-sm" style={{ color: 'rgba(255,255,255,0.4)' }}>
        Las noticias se generan a las 9:00 y las 18:00.{'\n'}
        Vuelve más tarde, periodista.
      </p>
    </div>
  )

  return (
    <div className="min-h-screen pb-28" style={{ background: '#0a0a0a', color: '#fff' }}>

      {/* CABECERA DEL PERIÓDICO */}
      <div className="relative overflow-hidden" style={{ background: '#0a0a0a', borderBottom: '2px solid #f59e0b' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% -20%, rgba(245,158,11,0.12) 0%, transparent 60%)' }} />
        <div className="relative px-4 pt-6 pb-4 text-center">
          <p className="text-xs font-black tracking-[0.3em] mb-1" style={{ color: 'rgba(245,158,11,0.6)' }}>
            EL HERALDO DE LA CAÑA
          </p>
          <h1 className="font-black text-white leading-none"
            style={{ fontSize: 28, fontFamily: '"Georgia", serif', letterSpacing: '-0.02em' }}>
            Noticias
          </h1>
          <div className="flex items-center justify-center gap-3 mt-1.5">
            <div className="h-px flex-1" style={{ background: 'rgba(245,158,11,0.3)' }} />
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)', fontStyle: 'italic' }}>
              {selectedBlock && new Date(selectedBlock.generated_at).toLocaleDateString('es-ES', {
                weekday: 'long', day: 'numeric', month: 'long'
              })}
            </p>
            <div className="h-px flex-1" style={{ background: 'rgba(245,158,11,0.3)' }} />
          </div>
        </div>
      </div>

      {/* TICKER DE MERCADO */}
      {selectedBlock?.market_snapshot && <MarketTicker marketSnapshot={selectedBlock.market_snapshot} />}

      {/* SELECTOR DE BLOQUES */}
      <BlockSelector blocks={blocks} selectedId={selectedBlock?.id} onSelect={selectBlock} />

      {/* FILTRO DE CATEGORÍAS */}
      <div className="flex gap-2 px-4 py-3 overflow-x-auto"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        {catFilters.map(f => (
          <motion.button key={f.id} whileTap={{ scale: 0.92 }}
            onClick={() => setFilterCat(f.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black"
            style={{
              background: filterCat === f.id ? '#f59e0b' : 'rgba(255,255,255,0.05)',
              color: filterCat === f.id ? '#000' : 'rgba(255,255,255,0.4)',
              border: filterCat === f.id ? 'none' : '1px solid rgba(255,255,255,0.07)',
            }}>
            <span>{f.icon}</span>
            <span>{f.label}</span>
          </motion.button>
        ))}
      </div>

      {/* CONTENIDO */}
      <div className="px-4 pt-4 space-y-3">

        {/* PORTADA — artículo destacado */}
        {filterCat === 'all' && featured && (
          <FeaturedCard article={featured} onClick={setSelectedArticle} />
        )}

        {/* SEPARADOR */}
        {filterCat === 'all' && filtered.length > 0 && (
          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <span className="text-xs font-black tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
              MÁS NOTICIAS
            </span>
            <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.06)' }} />
          </div>
        )}

        {/* RESTO DE ARTÍCULOS */}
        {filtered.map((article, i) => (
          <SmallCard key={i} article={article} index={i} onClick={setSelectedArticle} />
        ))}

        {filtered.length === 0 && filterCat !== 'all' && (
          <div className="text-center py-8" style={{ color: 'rgba(255,255,255,0.25)' }}>
            <p className="text-2xl mb-2">🔍</p>
            <p className="text-sm">No hay artículos de esta sección en este bloque</p>
          </div>
        )}

        {/* FOOTER DEL PERIÓDICO */}
        <div className="text-center pt-4 pb-2">
          <p className="text-xs font-black tracking-[0.2em]"
            style={{ color: 'rgba(245,158,11,0.4)', fontFamily: '"Georgia", serif' }}>
            EL HERALDO DE LA CAÑA
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.15)', fontStyle: 'italic' }}>
            "La verdad, con matices"
          </p>
          <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.1)' }}>
            Las noticias expiran en 3 días · Nueva edición a las 9h y 18h
          </p>
        </div>
      </div>

      {/* MODAL ARTÍCULO */}
      <AnimatePresence>
        {selectedArticle && (
          <ArticleModal article={selectedArticle} onClose={() => setSelectedArticle(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}