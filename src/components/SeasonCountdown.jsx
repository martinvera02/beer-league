import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function SeasonCountdown({ onSeasonReset }) {
  const [endsAt, setEndsAt] = useState(null)
  const [seasonId, setSeasonId] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const [urgency, setUrgency] = useState('normal')
  const [seasonEnded, setSeasonEnded] = useState(false)
  const [checking, setChecking] = useState(false)
  const intervalRef = useRef(null)
  const checkRef = useRef(null)

  useEffect(() => {
    fetchSeason()
    return () => {
      clearInterval(intervalRef.current)
      clearTimeout(checkRef.current)
    }
  }, [])

  const fetchSeason = useCallback(async () => {
    const { data } = await supabase.rpc('get_active_season')
    if (data?.ends_at) {
      setEndsAt(new Date(data.ends_at))
      setSeasonId(data.id)
      setSeasonEnded(false)
    }
  }, [])

  useEffect(() => {
    if (!endsAt) return
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(tick, 1000)
    tick()
    return () => clearInterval(intervalRef.current)
  }, [endsAt])

  const tick = useCallback(() => {
    if (!endsAt) return
    const now = new Date()
    const diff = endsAt - now

    if (diff <= 0) {
      clearInterval(intervalRef.current)
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      setUrgency('critical')
      handleSeasonEnd()
      return
    }

    const days    = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    setTimeLeft({ days, hours, minutes, seconds })

    if (days === 0 && hours < 6) setUrgency('critical')
    else if (days <= 1) setUrgency('soon')
    else setUrgency('normal')
  }, [endsAt])

  const handleSeasonEnd = useCallback(async () => {
    if (checking) return
    setChecking(true)
    setSeasonEnded(true)

    // Esperar hasta que el GitHub Action ejecute el reset (puede tardar unos minutos)
    // Reintentamos cada 30 segundos hasta que detectemos una nueva temporada
    const poll = async () => {
      const { data } = await supabase.rpc('get_active_season')
      if (data?.id && data.id !== seasonId) {
        // Nueva temporada detectada
        setEndsAt(new Date(data.ends_at))
        setSeasonId(data.id)
        setSeasonEnded(false)
        setChecking(false)
        if (onSeasonReset) onSeasonReset()
      } else {
        // Seguir reintentando cada 30s
        checkRef.current = setTimeout(poll, 30000)
      }
    }

    checkRef.current = setTimeout(poll, 30000)
  }, [checking, seasonId, onSeasonReset])

  if (!timeLeft) return null

  const colors = {
    normal:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',  text: '#f59e0b' },
    soon:     { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)',  text: '#f97316' },
    critical: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.4)',   text: '#ef4444' },
  }
  const c = colors[urgency]

  const Unit = ({ value, label }) => (
  <div className="flex flex-col items-center">
    <motion.div
      key={value}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="text-xl font-bold tabular-nums w-10 text-center"
      style={{ color: c.text }}
    >
      {String(value).padStart(2, '0')}
    </motion.div>
    <span className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{label}</span>
  </div>
)

  const Divider = () => (
    <span className="text-lg font-bold mb-4" style={{ color: c.text }}>:</span>
  )

  // Pantalla de fin de temporada
  if (seasonEnded) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-4 mb-4 text-center"
        style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.4)' }}
      >
        <motion.div
          className="text-3xl mb-2"
          animate={{ rotate: [0, -10, 10, -5, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          🏁
        </motion.div>
        <p className="font-bold text-red-400">¡Temporada terminada!</p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
          Esperando el inicio de la nueva temporada...
        </p>
        <motion.div
          className="flex justify-center gap-1 mt-2"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-400" />
          ))}
        </motion.div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between"
      style={{ backgroundColor: c.bg, border: `1px solid ${c.border}` }}
    >
      <div>
        <p className="text-xs font-semibold mb-0.5" style={{ color: c.text }}>
          {urgency === 'critical' ? '⚠️ ¡Reinicio inminente!' : urgency === 'soon' ? '⏳ Reinicio próximo' : '🔄 Próximo reinicio'}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>El ranking se reseteará en</p>
      </div>
      <div className="flex items-end gap-1">
        {timeLeft.days > 0 && (
          <>
            <Unit value={timeLeft.days} label="días" />
            <Divider />
          </>
        )}
        <Unit value={timeLeft.hours}   label="horas" />
        <Divider />
        <Unit value={timeLeft.minutes} label="min" />
        <Divider />
        <Unit value={timeLeft.seconds} label="seg" />
      </div>
    </motion.div>
  )
}