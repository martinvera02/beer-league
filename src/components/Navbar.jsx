import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

export default function Navbar({ currentPage, setCurrentPage }) {
  const { logout } = useAuth()

  const tabs = [
    { id: 'home',    emoji: '🏠', label: 'Inicio' },
    { id: 'add',     emoji: '🍺', label: 'Añadir' },
    { id: 'ranking', emoji: '🏆', label: 'Ranking' },
    { id: 'profile', emoji: '👤', label: 'Perfil' },
  ]

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-2 pb-2 pt-1 z-50">
      <div className="flex justify-around max-w-md mx-auto">
        {tabs.map(tab => (
          <motion.button
            key={tab.id}
            onClick={() => setCurrentPage(tab.id)}
            whileTap={{ scale: 0.85 }}
            className={`relative flex flex-col items-center py-2 px-4 rounded-xl transition-colors ${
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
              className="text-2xl"
              animate={currentPage === tab.id ? { y: [-3, 0] } : {}}
              transition={{ duration: 0.2 }}
            >
              {tab.emoji}
            </motion.span>
            <span className="text-xs mt-0.5 font-medium">{tab.label}</span>
          </motion.button>
        ))}
        <motion.button
          onClick={logout}
          whileTap={{ scale: 0.85 }}
          className="flex flex-col items-center py-2 px-4 rounded-xl text-gray-500 hover:text-red-400 transition-colors"
        >
          <span className="text-2xl">🚪</span>
          <span className="text-xs mt-0.5 font-medium">Salir</span>
        </motion.button>
      </div>
    </nav>
  )
}