import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ currentPage, setCurrentPage }) {
  const { logout } = useAuth()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const tabs = [
    { id: 'home',         emoji: '🏠', label: 'Inicio' },
    { id: 'add',          emoji: '🍺', label: 'Añadir' },
    { id: 'leagues',      emoji: '🏆', label: 'Ligas' },
    { id: 'globalranking',emoji: '🌍', label: 'Global' },
    { id: 'social',       emoji: '💬', label: 'Social' },
    { id: 'casino',       emoji: '🃏', label: 'Casino' },
    { id: 'profile',      emoji: '👤', label: 'Perfil' },
  ]

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t transition-colors duration-300"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-around px-1 py-2 max-w-lg mx-auto">
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              whileTap={{ scale: 0.85 }}
              onClick={() => setCurrentPage(tab.id)}
              className="flex flex-col items-center gap-0.5 px-1 py-1 rounded-xl transition-colors min-w-0"
              style={{ flex: 1 }}
            >
              <motion.span
                className="text-xl leading-none"
                animate={currentPage === tab.id ? { scale: [1, 1.3, 1] } : { scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                {tab.emoji}
              </motion.span>
              <span className="text-xs font-medium truncate w-full text-center"
                style={{ color: currentPage === tab.id ? '#f59e0b' : 'var(--text-hint)', fontSize: '9px' }}>
                {tab.label}
              </span>
              {currentPage === tab.id && (
                <motion.div layoutId="nav-indicator"
                  className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-500"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
            </motion.button>
          ))}

          {/* Salir */}
          <motion.button whileTap={{ scale: 0.85 }}
            onClick={() => setShowLogoutConfirm(true)}
            className="flex flex-col items-center gap-0.5 px-1 py-1 rounded-xl"
            style={{ flex: 1 }}>
            <span className="text-xl leading-none">🚪</span>
            <span className="text-xs font-medium" style={{ color: 'var(--text-hint)', fontSize: '9px' }}>Salir</span>
          </motion.button>
        </div>
      </nav>

      <AnimatePresence>
        {showLogoutConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setShowLogoutConfirm(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🚪</div>
                <h2 className="text-xl font-bold">¿Cerrar sesión?</h2>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                  Podrás volver a entrar con tu cuenta en cualquier momento.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 font-semibold py-3 rounded-xl transition-colors"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  Cancelar
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={logout}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors">
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