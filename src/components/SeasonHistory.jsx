import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerItem } from '../lib/animations'

export default function SeasonHistory({ leagueId = null }) {
  const { user } = useAuth()
  const [seasons, setSeasons] = useState([])
  const [selectedSeason, setSelectedSeason] = useState(null)
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchSeasons() }, [])

  const fetchSeasons = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('active', false)
      .order('ends_at', { ascending: false })
      .limit(10)

    setSeasons(data || [])
    setLoading(false)
  }

  const fetchResults = async (season) => {
    setSelectedSeason(season)
    const query = supabase
      .from('season_results')
      .select('*')
      .eq('season_id', season.id)
      .order('rank', { ascending: true })
      .limit(20)

    if (leagueId) {
      query.eq('scope', String(leagueId))
    } else {
      query.eq('scope', 'global')
    }

    const { data } = await query
    setResults(data || [])
  }

  const formatDate = (ts) => new Date(ts).toLocaleDateString('es-ES', {
    day: 'numeric', month: 'short', year: 'numeric'
  })

  const medals = ['🥇', '🥈', '🥉']

  if (loading) return null
  if (seasons.length === 0) return null

  return (
    <div className="mt-6">
      <p className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        📚 Temporadas anteriores
      </p>

      {/* Lista de temporadas */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
        {seasons.map((season, index) => (
          <motion.button
            key={season.id}
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchResults(season)}
            className="flex-shrink-0 rounded-xl px-3 py-2 text-xs font-medium transition-colors"
            style={{
              backgroundColor: selectedSeason?.id === season.id ? '#f59e0b' : 'var(--bg-card)',
              color: selectedSeason?.id === season.id ? '#fff' : 'var(--text-muted)',
            }}
          >
            T{seasons.length - index} · {formatDate(season.started_at)}
          </motion.button>
        ))}
      </div>

      {/* Resultados de la temporada seleccionada */}
      <AnimatePresence mode="wait">
        {selectedSeason && (
          <motion.div
            key={selectedSeason.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <div className="rounded-2xl overflow-hidden mb-2"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
                  🏁 Ranking final · {formatDate(selectedSeason.started_at)} → {formatDate(selectedSeason.ends_at)}
                </p>
              </div>

              {results.length === 0 ? (
                <div className="px-4 py-6 text-center" style={{ color: 'var(--text-hint)' }}>
                  <p className="text-sm">Sin datos para esta temporada</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                  {results.map((entry, index) => {
                    const isMe = entry.user_id === user.id
                    return (
                      <motion.div
                        key={entry.id}
                        variants={staggerItem}
                        initial="initial"
                        animate="animate"
                        className="flex items-center gap-3 px-4 py-3"
                        style={{ backgroundColor: isMe ? 'rgba(245,158,11,0.08)' : 'transparent' }}
                      >
                        <span className="text-lg w-7 text-center">
                          {medals[index] || `${index + 1}`}
                        </span>
                        {entry.avatar_url ? (
                          <img src={entry.avatar_url} alt={entry.username} className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs"
                            style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
                        )}
                        <p className="flex-1 text-sm font-medium" style={{ color: isMe ? '#f59e0b' : 'var(--text-primary)' }}>
                          {entry.username} {isMe && '(tú)'}
                        </p>
                        <div className="text-right">
                          <p className="text-sm font-bold" style={{ color: isMe ? '#f59e0b' : 'var(--text-primary)' }}>
                            {entry.total_points} pts
                          </p>
                          <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                            {entry.total_drinks} consumiciones
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}