import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePushNotifications } from '../hooks/usePushNotifications'

// ─── BANNER DE NOTIFICACIONES ─────────────────────────────────────────────────
// Úsalo en tu App.jsx o en el Profile.jsx
// <PushNotificationBanner />

export default function PushNotificationBanner() {
  const { permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem('push_banner_dismissed') === 'true'
  )
  const [result, setResult] = useState(null)

  // No mostrar si ya tiene permiso concedido o denegado permanentemente o ya lo descartó
  if (dismissed || permission === 'denied') return null
  if (subscribed) return null

  const handleSubscribe = async () => {
    const ok = await subscribe()
    if (ok) {
      setResult('ok')
    } else {
      setResult('denied')
      setTimeout(() => setResult(null), 3000)
    }
  }

  const handleDismiss = () => {
    localStorage.setItem('push_banner_dismissed', 'true')
    setDismissed(true)
  }

  return (
    <AnimatePresence>
      {!result && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="mx-4 mt-3 rounded-2xl p-4 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <span className="text-2xl flex-shrink-0">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-amber-400">Activa las notificaciones</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
              Entérate de guerras, apuestas y premios al momento
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <motion.button whileTap={{ scale: 0.9 }} onClick={handleDismiss}
              className="text-xs px-2 py-1.5 rounded-lg"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' }}>
              Ahora no
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={handleSubscribe}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg font-bold text-white"
              style={{ backgroundColor: '#f59e0b' }}>
              {loading ? '...' : 'Activar'}
            </motion.button>
          </div>
        </motion.div>
      )}
      {result === 'denied' && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="mx-4 mt-3 rounded-2xl p-3 text-center"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
          <p className="text-xs text-red-400">Permiso denegado. Actívalas desde la configuración del navegador.</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── BOTÓN COMPACTO PARA PERFIL ───────────────────────────────────────────────
export function PushToggle() {
  const { permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications()

  if (permission === 'denied') return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
      <span className="text-xl">🔕</span>
      <div className="flex-1">
        <p className="text-sm font-bold">Notificaciones bloqueadas</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Actívalas desde la configuración del navegador</p>
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl p-4 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
      <span className="text-xl">{subscribed ? '🔔' : '🔕'}</span>
      <div className="flex-1">
        <p className="text-sm font-bold">Notificaciones push</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
          {subscribed ? 'Activadas · recibirás alertas en tiempo real' : 'Desactivadas'}
        </p>
      </div>
      <motion.button whileTap={{ scale: 0.95 }} onClick={subscribed ? unsubscribe : subscribe}
        disabled={loading}
        className="px-4 py-2 rounded-xl text-sm font-bold"
        style={{
          backgroundColor: subscribed ? 'rgba(239,68,68,0.1)' : '#f59e0b',
          color: subscribed ? '#ef4444' : '#fff',
        }}>
        {loading ? '...' : subscribed ? 'Desactivar' : 'Activar'}
      </motion.button>
    </div>
  )
}