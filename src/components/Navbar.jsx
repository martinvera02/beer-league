import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { useNotifications } from '../context/NotificationsContext'
import { soundTab } from '../lib/sounds'

export default function Navbar({ currentPage, setCurrentPage }) {
  const { logout } = useAuth()
  const { unreadCount, toast, dismissToast } = useNotifications()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const tabs = [
    { id: 'home',          emoji: '🏠', label: 'Inicio' },
    { id: 'add',           emoji: '🍺', label: 'Añadir' },
    { id: 'leagues',       emoji: '🏆', label: 'Ligas' },
    { id: 'globalranking', emoji: '🌍', label: 'Global' },
    { id: 'social',        emoji: '🍻', label: 'Social' },
    { id: 'profile',       emoji: '👤', label: 'Perfil' },
  ]

  const handleTabClick = (id) => {
    soundTab()
    setCurrentPage(id)
  }

  const getToastColor = (type) => {
    switch (type) {
      case 'powerup':  return { bg: 'rgba(239,68,68,0.95)',   border: '#ef4444' }
      case 'transfer': return { bg: 'rgba(16,185,129,0.95)',  border: '#10b981' }
      default:         return { bg: 'rgba(245,158,11,0.95)',  border: '#f59e0b' }
    }
  }

  return (
    <>
      {/* ── TOAST in-app ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -80, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -80, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={dismissToast}
            className="fixed top-4 left-4 right-4 z-[200] max-w-md mx-auto cursor-pointer"
          >
            <div
              className="rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl"
              style={{
                backgroundColor: getToastColor(toast.type).bg,
                border: `1px solid ${getToastColor(toast.type).border}`,
                backdropFilter: 'blur(10px)',
              }}
            >
              <span className="text-2xl flex-shrink-0">
                {toast.type === 'powerup' ? '⚡' : '💸'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-sm truncate">{toast.title}</p>
                <p className="text-white/80 text-xs truncate">{toast.body}</p>
              </div>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={dismissToast}
                className="text-white/60 text-lg flex-shrink-0"
              >
                ✕
              </motion.button>
            </div>
            {/* Barra de progreso */}
            <motion.div
              className="absolute bottom-0 left-0 h-0.5 rounded-full"
              style={{ backgroundColor: getToastColor(toast.type).border }}
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: 4, ease: 'linear' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── NAVBAR ── */}
      <nav
        className="fixed bottom-0 left-0 right-0 border-t px-1 pb-2 pt-1 z-50 transition-colors duration-300"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}
      >
        <div className="flex justify-around max-w-lg mx-auto">
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              whileTap={{ scale: 0.85 }}
              className="relative flex flex-col items-center py-2 px-2 rounded-xl transition-colors"
              style={{ color: currentPage === tab.id ? '#f59e0b' : 'var(--text-hint)' }}
            >
              {currentPage === tab.id && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-xl"
                  style={{ backgroundColor: 'rgba(245,158,11,0.1)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <motion.span
                className="text-xl relative"
                animate={currentPage === tab.id ? { y: [-3, 0] } : {}}
                transition={{ duration: 0.2 }}
              >
                {tab.emoji}
                {/* Badge de notificaciones en el icono de perfil */}
                {tab.id === 'profile' && unreadCount > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -right-1 min-w-4 h-4 px-0.5 rounded-full flex items-center justify-center text-white font-black"
                    style={{ backgroundColor: '#ef4444', fontSize: 9 }}
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </motion.span>
                )}
              </motion.span>
              <span className="text-xs mt-0.5 font-medium">{tab.label}</span>
            </motion.button>
          ))}

          <motion.button
            onClick={() => setShowLogoutConfirm(true)}
            whileTap={{ scale: 0.85 }}
            className="flex flex-col items-center py-2 px-2 rounded-xl transition-colors"
            style={{ color: 'var(--text-hint)' }}
          >
            <span className="text-xl">🚪</span>
            <span className="text-xs mt-0.5 font-medium">Salir</span>
          </motion.button>
        </div>
      </nav>

      {/* Modal logout */}
      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[100]"
            onClick={() => setShowLogoutConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
            >
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🚪</div>
                <h2 className="text-xl font-bold">¿Cerrar sesión?</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  Tendrás que volver a iniciar sesión para entrar.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 font-semibold py-3 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  Cancelar
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={logout}
                  className="flex-1 bg-red-600 text-white font-bold py-3 rounded-xl">
                  Salir
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}