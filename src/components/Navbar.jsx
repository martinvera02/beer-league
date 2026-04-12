import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ currentPage, setCurrentPage }) {
  const { logout } = useAuth()
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

  const tabs = [
    { id: 'home',          emoji: '🏠', label: 'Inicio' },
    { id: 'add',           emoji: '🍺', label: 'Añadir' },
    { id: 'leagues',       emoji: '🏆', label: 'Ligas' },
    { id: 'globalranking', emoji: '🌍', label: 'Global' },
    { id: 'social',        emoji: '🍻', label: 'Social' },
    { id: 'profile',       emoji: '👤', label: 'Perfil' },
  ]

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-1 pb-2 pt-1 z-50">
        <div className="flex justify-around max-w-lg mx-auto">
          {tabs.map(tab => (
            <motion.button
              key={tab.id}
              onClick={() => setCurrentPage(tab.id)}
              whileTap={{ scale: 0.85 }}
              className={`relative flex flex-col items-center py-2 px-2 rounded-xl transition-colors ${
                currentPage === tab.id ? 'text-amber-400' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {currentPage === tab.id && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute inset-0 bg-amber-500/10 rounded-xl"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <motion.span
                className="text-xl"
                animate={currentPage === tab.id ? { y: [-3, 0] } : {}}
                transition={{ duration: 0.2 }}
              >
                {tab.emoji}
              </motion.span>
              <span className="text-xs mt-0.5 font-medium">{tab.label}</span>
            </motion.button>
          ))}
          <motion.button
            onClick={() => setShowLogoutConfirm(true)}
            whileTap={{ scale: 0.85 }}
            className="flex flex-col items-center py-2 px-2 rounded-xl text-gray-500 hover:text-red-400 transition-colors"
          >
            <span className="text-xl">🚪</span>
            <span className="text-xs mt-0.5 font-medium">Salir</span>
          </motion.button>
        </div>
      </nav>

      {/* Modal confirmación salir */}
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
              className="bg-gray-900 rounded-2xl p-6 w-full max-w-sm"
            >
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🚪</div>
                <h2 className="text-xl font-bold text-white">¿Cerrar sesión?</h2>
                <p className="text-gray-400 text-sm mt-1">Tendrás que volver a iniciar sesión para entrar.</p>
              </div>
              <div className="flex gap-3">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Cancelar
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={logout}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-3 rounded-xl transition-colors"
                >
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