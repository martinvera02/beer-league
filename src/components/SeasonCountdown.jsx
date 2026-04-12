import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'

export default function SeasonCountdown() {
  const [endsAt, setEndsAt] = useState(null)
  const [timeLeft, setTimeLeft] = useState(null)
  const [urgency, setUrgency] = useState('normal') // 'normal' | 'soon' | 'critical'

  useEffect(() => {
    fetchSeason()
  }, [])

  useEffect(() => {
    if (!endsAt) return
    const interval = setInterval(() => tick(), 1000)
    tick()
    return () => clearInterval(interval)
  }, [endsAt])

  const fetchSeason = async () => {
    const { data } = await supabase.rpc('get_active_season')
    if (data?.ends_at) setEndsAt(new Date(data.ends_at))
  }

  const tick = () => {
    if (!endsAt) return
    const now = new Date()
    const diff = endsAt - now

    if (diff <= 0) {
      setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      setUrgency('critical')
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
  }

  if (!timeLeft) return null

  const colors = {
    normal:   { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#f59e0b', label: 'var(--text-muted)' },
    soon:     { bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.3)', text: '#f97316', label: 'var(--text-muted)' },
    critical: { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.4)',  text: '#ef4444', label: 'var(--text-muted)' },
  }

  const c = colors[urgency]

  const Unit = ({ value, label }) => (
    <div className="flex flex-col items-center">
      <motion.div
        key={value}
        initial={{ y: -6, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.2 }}
        className="text-xl font-bold tabular-nums w-10 text-center"
        style={{ color: c.text }}
      >
        {String(value).padStart(2, '0')}
      </motion.div>
      <span className="text-xs mt-0.5" style={{ color: c.label }}>{label}</span>
    </div>
  )

  const Divider = () => (
    <span className="text-lg font-bold mb-4" style={{ color: c.text }}>:</span>
  )

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