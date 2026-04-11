import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, slideUp, staggerContainer, staggerItem, scaleIn } from '../lib/animations'

export default function Home({ setCurrentPage, setSelectedLeague }) {
  const { user } = useAuth()
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [joinId, setJoinId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => { fetchLeagues() }, [])

  const fetchLeagues = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('league_members')
      .select('league_id, leagues(id, name, created_by)')
      .eq('user_id', user.id)
    setLeagues(data?.map(d => d.leagues) || [])
    setLoading(false)
  }

  const createLeague = async () => {
    if (!newLeagueName.trim()) return
    setError('')
    const { data, error } = await supabase
      .from('leagues')
      .insert({ name: newLeagueName, created_by: user.id })
      .select().single()
    if (error) { setError('Error al crear la liga'); return }
    await supabase.from('league_members').insert({ league_id: data.id, user_id: user.id })
    setNewLeagueName('')
    setShowCreate(false)
    fetchLeagues()
  }

  const joinLeague = async () => {
    if (!joinId.trim()) return
    setError('')
    const { data: league } = await supabase
      .from('leagues').select('id').eq('id', parseInt(joinId)).single()
    if (!league) { setError('Liga no encontrada'); return }
    const { error } = await supabase
      .from('league_members').insert({ league_id: league.id, user_id: user.id })
    if (error) { setError('Ya eres miembro o error al unirte'); return }
    setJoinId('')
    setShowJoin(false)
    fetchLeagues()
  }

  const enterLeague = (league) => {
    setSelectedLeague(league)
    setCurrentPage('ranking')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 px-4 pt-6">
      <div className="max-w-md mx-auto">

        <motion.div {...fadeIn}>
          <h1 className="text-2xl font-bold mb-1">Tus ligas 🏆</h1>
          <p className="text-gray-400 text-sm mb-6">Crea una liga o únete con el ID</p>
        </motion.div>

        <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="flex gap-3 mb-6">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => { setShowCreate(true); setShowJoin(false) }}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            + Crear liga
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => { setShowJoin(true); setShowCreate(false) }}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Unirse con ID
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {showCreate && (
            <motion.div {...slideUp} className="bg-gray-900 rounded-2xl p-4 mb-4">
              <p className="text-sm text-gray-400 mb-2">Nombre de la liga</p>
              <input
                type="text"
                value={newLeagueName}
                onChange={e => setNewLeagueName(e.target.value)}
                placeholder="ej: Los Alcohólicos Anónimos"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-3"
              />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.96 }} onClick={createLeague} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-semibold py-2 rounded-lg">Crear</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowCreate(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg">Cancelar</motion.button>
              </div>
            </motion.div>
          )}

          {showJoin && (
            <motion.div {...slideUp} className="bg-gray-900 rounded-2xl p-4 mb-4">
              <p className="text-sm text-gray-400 mb-2">ID de la liga</p>
              <input
                type="number"
                value={joinId}
                onChange={e => setJoinId(e.target.value)}
                placeholder="ej: 42"
                className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-3"
              />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.96 }} onClick={joinLeague} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-semibold py-2 rounded-lg">Unirse</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowJoin(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg">Cancelar</motion.button>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.p {...scaleIn} className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2 mb-4">
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {loading ? (
          <motion.p {...fadeIn} className="text-gray-500 text-center py-10">Cargando ligas...</motion.p>
        ) : leagues.length === 0 ? (
          <motion.div {...fadeIn} className="text-center py-16 text-gray-500">
            <motion.div
              className="text-5xl mb-3"
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
            >
              🍺
            </motion.div>
            <p>Aún no estás en ninguna liga</p>
            <p className="text-sm mt-1">Crea una o únete con un ID</p>
          </motion.div>
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="initial"
            animate="animate"
            className="space-y-3"
          >
            {leagues.map(league => (
              <motion.button
                key={league.id}
                variants={staggerItem}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => enterLeague(league)}
                className="w-full bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-white">{league.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">ID: {league.id} · Comparte este número</p>
                </div>
                <span className="text-gray-400 text-xl">›</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}