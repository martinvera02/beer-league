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
      .from('leagues').insert({ name: newLeagueName, created_by: user.id }).select().single()
    if (error) { setError('Error al crear la liga'); return }
    await supabase.from('league_members').insert({ league_id: data.id, user_id: user.id })
    setNewLeagueName('')
    setShowCreate(false)
    fetchLeagues()
  }

  const joinLeague = async () => {
    if (!joinId.trim()) return
    setError('')
    const { data: league } = await supabase.from('leagues').select('id').eq('id', parseInt(joinId)).single()
    if (!league) { setError('Liga no encontrada'); return }
    const { error } = await supabase.from('league_members').insert({ league_id: league.id, user_id: user.id })
    if (error) { setError('Ya eres miembro o error al unirte'); return }
    setJoinId('')
    setShowJoin(false)
    fetchLeagues()
  }

  const enterLeague = (league) => {
    setSelectedLeague(league)
    setCurrentPage('leagues')
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-md mx-auto">

        <motion.div {...fadeIn}>
          <h1 className="text-2xl font-bold mb-1">Tus ligas 🏆</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Crea una liga o únete con el ID</p>
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
            className="font-semibold py-3 rounded-xl transition-colors flex-1"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
          >
            Unirse con ID
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {showCreate && (
            <motion.div {...slideUp} className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
              <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>Nombre de la liga</p>
              <input
                type="text"
                value={newLeagueName}
                onChange={e => setNewLeagueName(e.target.value)}
                placeholder="ej: Los Alcohólicos Anónimos"
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-3 text-sm"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.96 }} onClick={createLeague} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-semibold py-2 rounded-xl">Crear</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>Cancelar</motion.button>
              </div>
            </motion.div>
          )}

          {showJoin && (
            <motion.div {...slideUp} className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
              <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>ID de la liga</p>
              <input
                type="number"
                value={joinId}
                onChange={e => setJoinId(e.target.value)}
                placeholder="ej: 42"
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-3 text-sm"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.96 }} onClick={joinLeague} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-semibold py-2 rounded-xl">Unirse</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowJoin(false)} className="flex-1 py-2 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>Cancelar</motion.button>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.p {...scaleIn} className="text-red-400 text-sm bg-red-950 rounded-xl px-4 py-2 mb-4">{error}</motion.p>
          )}
        </AnimatePresence>

        {loading ? (
          <motion.p {...fadeIn} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Cargando ligas...</motion.p>
        ) : leagues.length === 0 ? (
          <motion.div {...fadeIn} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <motion.div className="text-5xl mb-3" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>🍺</motion.div>
            <p>Aún no estás en ninguna liga</p>
            <p className="text-sm mt-1">Crea una o únete con un ID</p>
          </motion.div>
        ) : (
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
            {leagues.map(league => (
              <motion.button
                key={league.id}
                variants={staggerItem}
                whileHover={{ x: 4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => enterLeague(league)}
                className="w-full rounded-2xl p-4 text-left transition-colors flex items-center justify-between"
                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
              >
                <div>
                  <p className="font-semibold">{league.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>ID: {league.id} · Comparte este número</p>
                </div>
                <span className="text-xl" style={{ color: 'var(--text-muted)' }}>›</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  )
}