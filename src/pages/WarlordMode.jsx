import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// ─── DATOS DE PAÍSES CON POSICIONES EN EL MAPA ────────────────────────────────
// Coordenadas normalizadas [x%, y%] en un canvas de 1000x500
const COUNTRY_POSITIONS = {
  // EUROPA
  ES: { x: 340, y: 195, w: 32, h: 28, label: 'ES' },
  FR: { x: 355, y: 180, w: 30, h: 26, label: 'FR' },
  DE: { x: 390, y: 168, w: 28, h: 24, label: 'DE' },
  IT: { x: 395, y: 190, w: 22, h: 32, label: 'IT' },
  PT: { x: 325, y: 195, w: 18, h: 22, label: 'PT' },
  GB: { x: 345, y: 158, w: 22, h: 24, label: 'GB' },
  NL: { x: 375, y: 160, w: 14, h: 12, label: 'NL' },
  BE: { x: 368, y: 168, w: 12, h: 10, label: 'BE' },
  CH: { x: 383, y: 180, w: 14, h: 12, label: 'CH' },
  AT: { x: 400, y: 178, w: 20, h: 12, label: 'AT' },
  SE: { x: 408, y: 138, w: 20, h: 28, label: 'SE' },
  NO: { x: 396, y: 128, w: 22, h: 26, label: 'NO' },
  DK: { x: 392, y: 152, w: 14, h: 14, label: 'DK' },
  FI: { x: 422, y: 130, w: 22, h: 26, label: 'FI' },
  PL: { x: 415, y: 164, w: 26, h: 20, label: 'PL' },
  CZ: { x: 406, y: 172, w: 16, h: 12, label: 'CZ' },
  SK: { x: 418, y: 174, w: 16, h: 10, label: 'SK' },
  HU: { x: 418, y: 182, w: 18, h: 12, label: 'HU' },
  RO: { x: 430, y: 180, w: 24, h: 18, label: 'RO' },
  BG: { x: 432, y: 192, w: 20, h: 14, label: 'BG' },
  GR: { x: 424, y: 202, w: 18, h: 18, label: 'GR' },
  HR: { x: 406, y: 188, w: 16, h: 12, label: 'HR' },
  RS: { x: 418, y: 190, w: 16, h: 14, label: 'RS' },
  UA: { x: 444, y: 168, w: 32, h: 22, label: 'UA' },
  RU: { x: 470, y: 140, w: 160, h: 60, label: 'RU' },
  TR: { x: 448, y: 202, w: 38, h: 20, label: 'TR' },
  // ASIA
  CN: { x: 620, y: 185, w: 80, h: 60, label: 'CN' },
  IN: { x: 575, y: 215, w: 50, h: 50, label: 'IN' },
  JP: { x: 710, y: 178, w: 20, h: 28, label: 'JP' },
  KR: { x: 696, y: 188, w: 14, h: 16, label: 'KR' },
  ID: { x: 660, y: 268, w: 60, h: 28, label: 'ID' },
  SA: { x: 504, y: 228, w: 38, h: 30, label: 'SA' },
  IR: { x: 520, y: 210, w: 38, h: 28, label: 'IR' },
  PK: { x: 556, y: 205, w: 30, h: 26, label: 'PK' },
  BD: { x: 612, y: 218, w: 14, h: 14, label: 'BD' },
  VN: { x: 650, y: 230, w: 14, h: 32, label: 'VN' },
  TH: { x: 638, y: 235, w: 18, h: 26, label: 'TH' },
  MY: { x: 648, y: 258, w: 22, h: 14, label: 'MY' },
  PH: { x: 682, y: 238, w: 18, h: 22, label: 'PH' },
  MM: { x: 626, y: 220, w: 18, h: 28, label: 'MM' },
  AF: { x: 546, y: 198, w: 26, h: 22, label: 'AF' },
  IQ: { x: 495, y: 210, w: 22, h: 20, label: 'IQ' },
  SY: { x: 478, y: 205, w: 18, h: 16, label: 'SY' },
  YE: { x: 504, y: 242, w: 24, h: 16, label: 'YE' },
  UZ: { x: 546, y: 180, w: 26, h: 18, label: 'UZ' },
  KZ: { x: 540, y: 160, w: 50, h: 26, label: 'KZ' },
  AZ: { x: 492, y: 196, w: 14, h: 12, label: 'AZ' },
  GE: { x: 482, y: 192, w: 14, h: 10, label: 'GE' },
  IL: { x: 468, y: 212, w: 10, h: 12, label: 'IL' },
  AE: { x: 520, y: 238, w: 14, h: 10, label: 'AE' },
  // AFRICA
  NG: { x: 380, y: 268, w: 28, h: 24, label: 'NG' },
  ET: { x: 466, y: 260, w: 26, h: 22, label: 'ET' },
  EG: { x: 450, y: 222, w: 26, h: 24, label: 'EG' },
  CD: { x: 415, y: 278, w: 34, h: 30, label: 'CD' },
  TZ: { x: 454, y: 298, w: 22, h: 20, label: 'TZ' },
  KE: { x: 466, y: 280, w: 18, h: 18, label: 'KE' },
  ZA: { x: 430, y: 335, w: 30, h: 26, label: 'ZA' },
  UG: { x: 454, y: 272, w: 14, h: 14, label: 'UG' },
  GH: { x: 366, y: 264, w: 14, h: 16, label: 'GH' },
  MZ: { x: 450, y: 315, w: 18, h: 26, label: 'MZ' },
  MG: { x: 476, y: 315, w: 16, h: 30, label: 'MG' },
  CM: { x: 394, y: 264, w: 18, h: 20, label: 'CM' },
  CI: { x: 356, y: 265, w: 16, h: 16, label: 'CI' },
  NE: { x: 380, y: 244, w: 26, h: 20, label: 'NE' },
  ML: { x: 350, y: 238, w: 28, h: 22, label: 'ML' },
  AO: { x: 406, y: 300, w: 26, h: 24, label: 'AO' },
  SD: { x: 446, y: 240, w: 28, h: 24, label: 'SD' },
  ZM: { x: 432, y: 310, w: 22, h: 20, label: 'ZM' },
  SN: { x: 330, y: 246, w: 14, h: 12, label: 'SN' },
  MA: { x: 334, y: 215, w: 22, h: 20, label: 'MA' },
  DZ: { x: 352, y: 214, w: 32, h: 28, label: 'DZ' },
  LY: { x: 396, y: 214, w: 30, h: 24, label: 'LY' },
  TN: { x: 378, y: 208, w: 14, h: 16, label: 'TN' },
  SO: { x: 484, y: 264, w: 18, h: 22, label: 'SO' },
  // AMERICAS
  US: { x: 130, y: 185, w: 100, h: 60, label: 'US' },
  BR: { x: 200, y: 280, w: 70, h: 65, label: 'BR' },
  MX: { x: 110, y: 218, w: 46, h: 38, label: 'MX' },
  CO: { x: 178, y: 258, w: 26, h: 24, label: 'CO' },
  AR: { x: 194, y: 330, w: 28, h: 55, label: 'AR' },
  PE: { x: 170, y: 278, w: 24, h: 34, label: 'PE' },
  VE: { x: 192, y: 248, w: 26, h: 20, label: 'VE' },
  CL: { x: 183, y: 310, w: 12, h: 55, label: 'CL' },
  EC: { x: 164, y: 268, w: 16, h: 16, label: 'EC' },
  BO: { x: 188, y: 298, w: 20, h: 22, label: 'BO' },
  PY: { x: 200, y: 316, w: 16, h: 16, label: 'PY' },
  UY: { x: 208, y: 335, w: 12, h: 12, label: 'UY' },
  GT: { x: 128, y: 236, w: 12, h: 10, label: 'GT' },
  HN: { x: 136, y: 238, w: 12, h: 10, label: 'HN' },
  NI: { x: 136, y: 246, w: 12, h: 10, label: 'NI' },
  PA: { x: 150, y: 250, w: 14, h: 8, label: 'PA' },
  CU: { x: 158, y: 224, w: 20, h: 10, label: 'CU' },
  HT: { x: 176, y: 228, w: 10, h: 8, label: 'HT' },
  DO: { x: 184, y: 228, w: 10, h: 8, label: 'DO' },
  CA: { x: 80, y: 145, w: 110, h: 50, label: 'CA' },
  // OCEANÍA
  AU: { x: 680, y: 320, w: 85, h: 60, label: 'AU' },
  NZ: { x: 770, y: 358, w: 18, h: 24, label: 'NZ' },
  PG: { x: 718, y: 286, w: 26, h: 20, label: 'PG' },
  FJ: { x: 780, y: 312, w: 10, h: 8, label: 'FJ' },
}

const CONTINENT_COLORS = {
  europe:   '#4a90d9',
  asia:     '#e8a838',
  africa:   '#6bbf5a',
  americas: '#d9544a',
  oceania:  '#9b59b6',
}

// ─── COMPONENTE MAPA ──────────────────────────────────────────────────────────
function WorldMap({ provinces, ownership, leagueColors, selectedProvince, onSelectProvince, myLeagueId }) {
  const svgRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [lastPan, setLastPan] = useState({ x: 0, y: 0 })

  const getProvinceColor = (code) => {
    const own = ownership[code]
    if (!own) {
      const p = provinces.find(p => p.code === code)
      return p ? CONTINENT_COLORS[p.continent] + '55' : '#33333355'
    }
    const color = leagueColors[own.league_id]
    return color || '#888888'
  }

  const getProvinceOwner = (code) => ownership[code]

  const handleWheel = (e) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.85 : 1.15
    setZoom(z => Math.min(4, Math.max(0.5, z * delta)))
  }

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'rect' || e.target.tagName === 'text') return
    setIsPanning(true)
    setLastPan({ x: e.clientX - pan.x, y: e.clientY - pan.y })
  }

  const handleMouseMove = (e) => {
    if (!isPanning) return
    setPan({ x: e.clientX - lastPan.x, y: e.clientY - lastPan.y })
  }

  const handleMouseUp = () => setIsPanning(false)

  return (
    <div className="relative w-full overflow-hidden rounded-2xl"
      style={{ backgroundColor: '#0a1628', height: '60vh', cursor: isPanning ? 'grabbing' : 'grab' }}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}>

      {/* Océano / fondo */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 40%, #0d2140 0%, #071020 100%)',
      }} />

      {/* Grid decorativo oceánico */}
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'linear-gradient(rgba(100,160,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(100,160,255,0.3) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <svg
        ref={svgRef}
        viewBox="0 0 1000 500"
        className="absolute inset-0 w-full h-full"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '50% 50%',
          transition: isPanning ? 'none' : 'transform 0.1s',
        }}>

        {/* Países */}
        {Object.entries(COUNTRY_POSITIONS).map(([code, pos]) => {
          const isSelected = selectedProvince === code
          const owner = getProvinceOwner(code)
          const fillColor = getProvinceColor(code)
          const isMyTerritory = owner?.league_id === myLeagueId
          const province = provinces.find(p => p.code === code)
          const soldiers = owner?.soldiers || 0

          return (
            <g key={code} onClick={(e) => { e.stopPropagation(); onSelectProvince(code) }}
              style={{ cursor: 'pointer' }}>
              {/* Sombra */}
              <rect
                x={pos.x + 2} y={pos.y + 3}
                width={pos.w} height={pos.h}
                rx={pos.w * 0.15} ry={pos.h * 0.15}
                fill="rgba(0,0,0,0.3)" />

              {/* País */}
              <rect
                x={pos.x} y={pos.y}
                width={pos.w} height={pos.h}
                rx={pos.w * 0.15} ry={pos.h * 0.15}
                fill={fillColor}
                stroke={isSelected ? '#fff' : isMyTerritory ? '#f59e0b' : 'rgba(255,255,255,0.15)'}
                strokeWidth={isSelected ? 2.5 : isMyTerritory ? 1.5 : 0.8}
                style={{ filter: isSelected ? 'brightness(1.3) drop-shadow(0 0 4px rgba(255,255,255,0.5))' : isMyTerritory ? 'brightness(1.15)' : 'none' }}
              />

              {/* Brillo cartoon */}
              <rect
                x={pos.x + 2} y={pos.y + 2}
                width={pos.w * 0.6} height={pos.h * 0.3}
                rx={pos.w * 0.1}
                fill="rgba(255,255,255,0.15)"
                style={{ pointerEvents: 'none' }}
              />

              {/* Código del país */}
              {pos.w > 16 && (
                <text
                  x={pos.x + pos.w / 2}
                  y={pos.y + pos.h / 2 + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={Math.min(10, pos.w / 3.5)}
                  fontWeight="bold"
                  fill={owner ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)'}
                  style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'system-ui, sans-serif' }}>
                  {code}
                </text>
              )}

              {/* Soldados */}
              {soldiers > 0 && (
                <text
                  x={pos.x + pos.w - 2}
                  y={pos.y + 4}
                  textAnchor="end"
                  fontSize={Math.min(7, pos.w / 4)}
                  fill="rgba(255,255,255,0.9)"
                  fontWeight="bold"
                  style={{ pointerEvents: 'none', userSelect: 'none', fontFamily: 'monospace' }}>
                  ⚔{soldiers > 999 ? `${(soldiers/1000).toFixed(0)}k` : soldiers}
                </text>
              )}

              {/* Estrella si es capital */}
              {owner?.is_capital && (
                <text
                  x={pos.x + 3}
                  y={pos.y + 5}
                  fontSize={8}
                  fill="#FFD700"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}>
                  ★
                </text>
              )}
            </g>
          )
        })}
      </svg>

      {/* Controles de zoom */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 z-10">
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setZoom(z => Math.min(4, z * 1.3))}
          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>+</motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.1)' }}>⊙</motion.button>
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setZoom(z => Math.max(0.5, z * 0.77))}
          className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-lg"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>−</motion.button>
      </div>

      {/* Leyenda continentes */}
      <div className="absolute top-3 left-3 flex flex-col gap-1 z-10">
        {Object.entries(CONTINENT_COLORS).map(([cont, color]) => (
          <div key={cont} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color + 'aa' }} />
            <span className="text-xs font-medium capitalize" style={{ color: 'rgba(255,255,255,0.5)' }}>{cont}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── PANEL DE PROVINCIA ───────────────────────────────────────────────────────
function ProvincePanel({ code, provinces, ownership, leagueColors, leagueNames, myLeagueId, gameId, onClose, onClaim }) {
  const province = provinces.find(p => p.code === code)
  const owner = ownership[code]
  const ownerColor = owner ? leagueColors[owner.league_id] : null
  const ownerName = owner ? leagueNames[owner.league_id] : null
  const isNeutral = !owner
  const isMyTerritory = owner?.league_id === myLeagueId
  const pos = COUNTRY_POSITIONS[code]

  if (!province) return null

  const resources = province.base_resources || { food: 0, production: 0, gold: 0 }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="rounded-2xl overflow-hidden"
      style={{ backgroundColor: '#0d1f35', border: `2px solid ${ownerColor || 'rgba(255,255,255,0.1)'}` }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: ownerColor ? ownerColor + '22' : 'rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ownerColor || '#555' }} />
          <div>
            <p className="font-black text-white text-sm">{province.name}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
              {province.continent.toUpperCase()} · {code}
            </p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-xs"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>✕</motion.button>
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* Estado */}
        <div className="flex items-center gap-2">
          {isNeutral ? (
            <span className="text-xs px-2 py-1 rounded-full font-bold"
              style={{ backgroundColor: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
              🌍 Territorio neutral
            </span>
          ) : isMyTerritory ? (
            <span className="text-xs px-2 py-1 rounded-full font-bold"
              style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              ⭐ Tu territorio
            </span>
          ) : (
            <span className="text-xs px-2 py-1 rounded-full font-bold"
              style={{ backgroundColor: ownerColor + '22', color: ownerColor }}>
              👑 {ownerName}
            </span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-2 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <p className="text-lg">🌾</p>
            <p className="text-xs font-black text-white">{resources.food}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Comida</p>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <p className="text-lg">⚙️</p>
            <p className="text-xs font-black text-white">{resources.production}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Producción</p>
          </div>
          <div className="rounded-xl p-2 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <p className="text-lg">💰</p>
            <p className="text-xs font-black text-white">{resources.gold}</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Oro</p>
          </div>
        </div>

        {/* Soldados */}
        {owner && (
          <div className="flex items-center justify-between rounded-xl px-3 py-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
            <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>⚔️ Soldados</span>
            <span className="text-sm font-black text-white">{(owner.soldiers || 0).toLocaleString()}</span>
          </div>
        )}

        {/* Población */}
        <div className="flex items-center justify-between rounded-xl px-3 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
          <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>👥 Población</span>
          <span className="text-sm font-black text-white">{(province.base_population / 1000000).toFixed(1)}M</span>
        </div>

        {/* Acción */}
        {isNeutral && myLeagueId && (
          <motion.button whileTap={{ scale: 0.97 }} onClick={() => onClaim(code)}
            className="w-full py-3 rounded-xl font-black text-sm text-white relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, #1a4a8a, #2563eb)' }}>
            <motion.div className="absolute inset-0"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent)' }}
              animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }} />
            <span className="relative">🏴 Reclamar territorio</span>
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// ─── PÁGINA PRINCIPAL ─────────────────────────────────────────────────────────
export default function WarlordMode() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [gameData, setGameData] = useState(null)
  const [provinces, setProvinces] = useState([])
  const [ownership, setOwnership] = useState({}) // { code: { league_id, soldiers, is_capital } }
  const [participants, setParticipants] = useState([]) // [{ league_id, color, leagues: { name } }]
  const [myLeagues, setMyLeagues] = useState([])
  const [myActiveLeague, setMyActiveLeague] = useState(null)
  const [selectedProvince, setSelectedProvince] = useState(null)
  const [joining, setJoining] = useState(false)
  const [tab, setTab] = useState('map') // map | rankings | info

  const leagueColors = Object.fromEntries(participants.map(p => [p.league_id, p.color]))
  const leagueNames = Object.fromEntries(participants.map(p => [p.league_id, p.leagues?.name || `Liga ${p.league_id}`]))
  const myLeagueId = myActiveLeague?.league_id

  useEffect(() => { fetchAll() }, [])

  // Realtime ownership updates
  useEffect(() => {
    const channel = supabase.channel('warlord_ownership')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'warlord_ownership' }, () => fetchOwnership())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [gameData?.id])

  const fetchAll = async () => {
    setLoading(true)
    const [{ data: game }, { data: provs }, { data: myLgs }] = await Promise.all([
      supabase.from('warlord_games').select('*').eq('status', 'active').order('id', { ascending: false }).limit(1).single(),
      supabase.from('warlord_provinces').select('*').order('name'),
      supabase.from('league_members').select('league_id, leagues(id, name)').eq('user_id', user.id),
    ])

    setProvinces(provs || [])
    setMyLeagues(myLgs?.map(m => m.leagues) || [])

    if (game) {
      setGameData(game)
      await fetchParticipants(game.id)
      await fetchOwnership(game.id)
    }
    setLoading(false)
  }

  const fetchParticipants = async (gameId) => {
    const { data } = await supabase.from('warlord_participants')
      .select('*, leagues(name)').eq('game_id', gameId)
    setParticipants(data || [])
    // Detectar si el usuario ya participa
    const myLgIds = myLeagues.map(l => l.id)
    const myPart = (data || []).find(p => myLgIds.includes(p.league_id))
    setMyActiveLeague(myPart || null)
  }

  const fetchOwnership = async (gameId) => {
    const gid = gameId || gameData?.id
    if (!gid) return
    const { data } = await supabase.from('warlord_ownership')
      .select('*, warlord_provinces(code)').eq('game_id', gid)
    const map = {}
    ;(data || []).forEach(o => {
      if (o.warlord_provinces?.code) {
        map[o.warlord_provinces.code] = { league_id: o.league_id, soldiers: o.soldiers, is_capital: o.is_capital }
      }
    })
    setOwnership(map)
  }

  const handleJoinGame = async (leagueId) => {
    setJoining(true)
    const { data } = await supabase.rpc('join_warlord_game', { p_league_id: leagueId })
    if (data?.success) {
      await fetchAll()
    }
    setJoining(false)
  }

  const handleClaim = async (code) => {
    if (!myLeagueId || !gameData) return
    const province = provinces.find(p => p.code === code)
    if (!province) return
    await supabase.from('warlord_ownership').insert({
      game_id: gameData.id,
      province_id: province.id,
      league_id: myLeagueId,
      soldiers: 100,
    })
    setSelectedProvince(null)
    await fetchOwnership()
  }

  const myTerritoriesCount = Object.values(ownership).filter(o => o.league_id === myLeagueId).length
  const totalTerritories = Object.keys(ownership).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#071020' }}>
      <div className="text-center">
        <motion.div className="text-5xl mb-3" animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>🌍</motion.div>
        <p className="text-white/60 text-sm">Cargando el mundo...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24" style={{ backgroundColor: '#071020', color: '#fff' }}>

      {/* Header */}
      <div className="px-4 pt-6 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-black px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                ⚔️ WARLORD MODE
              </span>
              {gameData && (
                <span className="text-xs font-black px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                  🟢 EN VIVO
                </span>
              )}
            </div>
            <h1 className="text-2xl font-black leading-tight">Conquista<br />el mundo 🌍</h1>
          </div>
          {myLeagueId && (
            <div className="text-right">
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Tus territorios</p>
              <p className="text-2xl font-black" style={{ color: leagueColors[myLeagueId] || '#f59e0b' }}>
                {myTerritoriesCount}
              </p>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>de {provinces.length}</p>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl p-1" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
          {[
            { id: 'map', label: '🗺️ Mapa' },
            { id: 'rankings', label: '🏆 Ranking' },
            { id: 'info', label: 'ℹ️ Info' },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-xs font-bold z-10"
              style={{ color: tab === t.id ? '#fff' : 'rgba(255,255,255,0.4)' }}>
              {tab === t.id && (
                <motion.div layoutId="warlord-tab" className="absolute inset-0 rounded-lg"
                  style={{ zIndex: -1, backgroundColor: '#1a3a6e' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAPA ── */}
      {tab === 'map' && (
        <div className="px-3 pt-4 pb-6">
          {/* Unirse si no participa */}
          {!myLeagueId && myLeagues.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-4 mb-4"
              style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <p className="font-black text-sm text-amber-400 mb-2">🏴 Lleva tu liga a la guerra</p>
              <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Selecciona la liga con la que quieres participar en la conquista global
              </p>
              <div className="flex flex-wrap gap-2">
                {myLeagues.map(lg => (
                  <motion.button key={lg.id} whileTap={{ scale: 0.95 }}
                    disabled={joining}
                    onClick={() => handleJoinGame(lg.id)}
                    className="px-4 py-2 rounded-xl text-xs font-black"
                    style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#000' }}>
                    {joining ? '...' : `⚔️ ${lg.name}`}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Participantes activos */}
          {participants.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2 mb-3">
              {participants.map(p => (
                <div key={p.league_id} className="flex items-center gap-2 px-3 py-2 rounded-xl flex-shrink-0"
                  style={{ backgroundColor: p.color + '18', border: `1px solid ${p.color}44` }}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-xs font-black" style={{ color: p.color }}>{p.leagues?.name}</span>
                  <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {Object.values(ownership).filter(o => o.league_id === p.league_id).length}🏴
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Mapa */}
          <WorldMap
            provinces={provinces}
            ownership={ownership}
            leagueColors={leagueColors}
            selectedProvince={selectedProvince}
            onSelectProvince={setSelectedProvince}
            myLeagueId={myLeagueId}
          />

          <p className="text-center text-xs mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
            Arrastra para mover · Rueda para zoom · Click en país para detalles
          </p>

          {/* Panel de provincia seleccionada */}
          <AnimatePresence>
            {selectedProvince && (
              <div className="mt-4">
                <ProvincePanel
                  code={selectedProvince}
                  provinces={provinces}
                  ownership={ownership}
                  leagueColors={leagueColors}
                  leagueNames={leagueNames}
                  myLeagueId={myLeagueId}
                  gameId={gameData?.id}
                  onClose={() => setSelectedProvince(null)}
                  onClaim={handleClaim}
                />
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ── RANKING ── */}
      {tab === 'rankings' && (
        <div className="px-4 pt-4">
          <p className="text-xs font-black mb-3" style={{ color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em' }}>
            LIGAS EN COMBATE
          </p>
          {participants.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.3)' }}>
              <div className="text-5xl mb-3">🌍</div>
              <p>Ninguna liga ha entrado todavía</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[...participants]
                .sort((a, b) =>
                  Object.values(ownership).filter(o => o.league_id === b.league_id).length -
                  Object.values(ownership).filter(o => o.league_id === a.league_id).length
                )
                .map((p, idx) => {
                  const territories = Object.values(ownership).filter(o => o.league_id === p.league_id).length
                  const soldiers = Object.values(ownership).filter(o => o.league_id === p.league_id).reduce((s, o) => s + (o.soldiers || 0), 0)
                  const isMe = p.league_id === myLeagueId
                  return (
                    <motion.div key={p.league_id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                      className="rounded-2xl p-4 flex items-center gap-3"
                      style={{
                        backgroundColor: isMe ? p.color + '12' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isMe ? p.color + '40' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                      <div className="text-2xl font-black" style={{ color: 'rgba(255,255,255,0.2)', minWidth: 28 }}>
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                      </div>
                      <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-sm truncate" style={{ color: isMe ? p.color : '#fff' }}>
                          {p.leagues?.name}{isMe && ' (tú)'}
                        </p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          ⚔️ {soldiers.toLocaleString()} soldados
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-black text-lg" style={{ color: p.color }}>{territories}</p>
                        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>territorios</p>
                      </div>
                    </motion.div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* ── INFO ── */}
      {tab === 'info' && (
        <div className="px-4 pt-4 space-y-3">
          <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="font-black text-sm text-amber-400 mb-3">🌍 ¿Cómo funciona?</h3>
            <div className="space-y-2.5">
              {[
                { icon: '🏴', text: 'Cada liga controla un color en el mapa. Reclamad territorios neutrales para expandiros.' },
                { icon: '⚔️', text: 'Los puntos de tu liga se convierten en soldados. Cada consumición aporta tropas.' },
                { icon: '🏰', text: 'Construye edificios en tus provincias para generar recursos y reclutar más soldados.' },
                { icon: '💰', text: 'Comercia con otras ligas o recluta de la población local de cada provincia.' },
                { icon: '⏱️', text: '5 acciones de movimiento o gestión comercial cada 30 minutos por liga.' },
              ].map((item, i) => (
                <div key={i} className="flex gap-3">
                  <span className="text-lg flex-shrink-0">{item.icon}</span>
                  <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-4" style={{ backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <h3 className="font-black text-sm text-amber-400 mb-3">🔜 Próximamente</h3>
            <div className="space-y-1.5">
              {['Combate entre ligas con barra de batalla', 'Sistema de edificios (granjas, cuarteles, murallas)', 'Diplomacia y tratados comerciales', 'Formas de gobierno', 'Eventos globales (plagas, hambrunas, bonanzas)'].map((f, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: 'rgba(245,158,11,0.5)' }} />
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>{f}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}