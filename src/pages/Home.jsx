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
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [creating, setCreating] = useState(false)
  const [joinSuccess, setJoinSuccess] = useState('')
  const [userCount, setUserCount] = useState(null)

  useEffect(() => { fetchLeagues() }, [])

  const fetchLeagues = async () => {
    setLoading(true)
    const [{ data }, { count }] = await Promise.all([
      supabase.from('league_members').select('league_id, leagues(id, name, created_by, invite_code)').eq('user_id', user.id),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
    ])
    setLeagues(data?.map(d => d.leagues) || [])
    setUserCount(count || 0)
    setLoading(false)
  }

  const createLeague = async () => {
    if (!newLeagueName.trim()) return
    setError(''); setCreating(true)
    const { data, error } = await supabase
      .from('leagues').insert({ name: newLeagueName.trim(), created_by: user.id }).select().single()
    if (error) { setError('Error al crear la liga'); setCreating(false); return }
    await supabase.from('league_members').insert({ league_id: data.id, user_id: user.id, role: 'owner' })
    setNewLeagueName(''); setShowCreate(false); setCreating(false)
    fetchLeagues()
  }

  const joinLeague = async () => {
    if (!joinCode.trim()) return
    setError(''); setJoinSuccess(''); setJoining(true)
    const { data, error } = await supabase.rpc('join_league_by_code', {
      p_code: joinCode.trim().toUpperCase()
    })
    if (error || !data?.success) {
      setError(data?.error || 'Código no válido')
    } else {
      setJoinSuccess(`¡Te has unido a ${data.league_name}! 🎉`)
      setJoinCode('')
      fetchLeagues()
      setTimeout(() => { setShowJoin(false); setJoinSuccess('') }, 2000)
    }
    setJoining(false)
  }

  const enterLeague = (league) => {
    setSelectedLeague(league)
    setCurrentPage('leagues')
  }

  const handleJoinKeyDown = (e) => { if (e.key === 'Enter') joinLeague() }
  const handleCreateKeyDown = (e) => { if (e.key === 'Enter') createLeague() }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-md mx-auto">

        <motion.div {...fadeIn}>
          <h1 className="text-2xl font-bold mb-1">Tus ligas 🏆</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            Crea una liga o únete con el código de invitación
          </p>
        </motion.div>

        {/* ── MARCADOR DE USUARIOS ── */}
        {userCount !== null && (
          <motion.div {...fadeIn} transition={{ delay: 0.05 }}
            className="rounded-2xl p-3 mb-5 flex items-center gap-3"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex -space-x-1.5">
              {['🍺', '🍻', '🥂'].map((e, i) => (
                <motion.div key={i}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ delay: 0.1 + i * 0.05, type: 'spring', stiffness: 400, damping: 20 }}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-base border-2"
                  style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--bg-base)' }}>
                  {e}
                </motion.div>
              ))}
            </div>
            <div>
              <p className="text-sm font-bold">
                <motion.span
                  key={userCount}
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-amber-400">
                  {userCount}
                </motion.span>
                {' '}jugadores en Beer League
              </p>
              <p className="text-xs" style={{ color: 'var(--text-hint)' }}>¡Invita a más amigos! 🍻</p>
            </div>
          </motion.div>
        )}

        <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="flex gap-3 mb-6">
          <motion.button whileTap={{ scale: 0.96 }}
            onClick={() => { setShowCreate(true); setShowJoin(false); setError('') }}
            className="flex-1 bg-amber-500 text-white font-semibold py-3 rounded-xl">
            + Crear liga
          </motion.button>
          <motion.button whileTap={{ scale: 0.96 }}
            onClick={() => { setShowJoin(true); setShowCreate(false); setError('') }}
            className="flex-1 font-semibold py-3 rounded-xl"
            style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
            🔑 Unirse
          </motion.button>
        </motion.div>

        <AnimatePresence>
          {showCreate && (
            <motion.div {...slideUp} className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Nombre de la liga</p>
              <input
                type="text"
                value={newLeagueName}
                onChange={e => setNewLeagueName(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                placeholder="ej: Los Alcohólicos Anónimos"
                autoFocus
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-3 text-sm"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              <p className="text-xs mb-3" style={{ color: 'var(--text-hint)' }}>
                Se generará un código de invitación automáticamente
              </p>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.96 }} onClick={createLeague}
                  disabled={!newLeagueName.trim() || creating}
                  className="flex-1 bg-amber-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm">
                  {creating ? 'Creando...' : 'Crear'}
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => { setShowCreate(false); setError('') }}
                  className="flex-1 py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                  Cancelar
                </motion.button>
              </div>
            </motion.div>
          )}

          {showJoin && (
            <motion.div {...slideUp} className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
              <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Código de invitación</p>
              <input
                type="text"
                value={joinCode}
                onChange={e => { setJoinCode(e.target.value.toUpperCase()); setError(''); setJoinSuccess('') }}
                onKeyDown={handleJoinKeyDown}
                placeholder="BEER-XXXX-XXXX"
                autoFocus
                maxLength={14}
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-3 text-sm font-bold tracking-widest text-center"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              <AnimatePresence>
                {joinSuccess && (
                  <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="text-emerald-400 text-sm text-center font-bold mb-3">
                    {joinSuccess}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.96 }} onClick={joinLeague}
                  disabled={!joinCode.trim() || joining}
                  className="flex-1 bg-amber-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm">
                  {joining ? 'Uniéndose...' : 'Unirse'}
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }}
                  onClick={() => { setShowJoin(false); setJoinCode(''); setError(''); setJoinSuccess('') }}
                  className="flex-1 py-2.5 rounded-xl text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                  Cancelar
                </motion.button>
              </div>
            </motion.div>
          )}

          {error && (
            <motion.p {...scaleIn} className="text-red-400 text-sm bg-red-950 rounded-xl px-4 py-2 mb-4">
              ⚠️ {error}
            </motion.p>
          )}
        </AnimatePresence>

        {loading ? (
          <motion.p {...fadeIn} className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
            Cargando ligas...
          </motion.p>
        ) : leagues.length === 0 ? (
          <motion.div {...fadeIn} className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <motion.div className="text-5xl mb-3" animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>🍺</motion.div>
            <p>Aún no estás en ninguna liga</p>
            <p className="text-sm mt-1">Crea una o pide el código a tus amigos</p>
          </motion.div>
        ) : (
          <motion.div variants={staggerContainer} initial="initial" animate="animate" className="space-y-3">
            {leagues.map(league => (
              <motion.button key={league.id} variants={staggerItem}
                whileHover={{ x: 4 }} whileTap={{ scale: 0.98 }}
                onClick={() => enterLeague(league)}
                className="w-full rounded-2xl p-4 text-left flex items-center justify-between"
                style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
                <div>
                  <p className="font-semibold">{league.name}</p>
                  <p className="text-xs mt-0.5 font-mono tracking-wider" style={{ color: 'var(--text-hint)' }}>
                    {league.invite_code || '···-····-····'}
                  </p>
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