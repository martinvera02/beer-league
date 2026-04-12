import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { staggerItem, fadeIn } from '../lib/animations'
import SeasonCountdown from '../components/SeasonCountdown'

export default function GlobalRanking() {
  const { user } = useAuth()
  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { fetchRanking() }, [])

  const fetchRanking = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('global_rankings')
      .select('*')
      .order('total_points', { ascending: false })
    setRankings(data || [])
    setLoading(false)
  }

  const medals = ['🥇', '🥈', '🥉']

  const Avatar = ({ url, username, size = 'md' }) => {
    const dim = size === 'md' ? 'w-10 h-10' : 'w-8 h-8'
    return url ? (
      <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
    ) : (
      <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0`} style={{ backgroundColor: 'var(--bg-input)' }}>
        🍺
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-md mx-auto">

        <motion.div {...fadeIn}>
          <h1 className="text-2xl font-bold mb-1">Ranking global 🌍</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Los más bebedores del mundo mundial</p>
        </motion.div>

        {/* Cuenta atrás de temporada */}
        <SeasonCountdown />

        {/* Podio top 3 */}
        {!loading && rankings.length >= 3 && (
          <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="flex items-end justify-center gap-3 mb-8">
            {/* 2º */}
            <div className="flex flex-col items-center flex-1">
              <Avatar url={rankings[1]?.avatar_url} username={rankings[1]?.username} />
              <p className="text-xs font-semibold mt-1 truncate w-full text-center" style={{ color: 'var(--text-muted)' }}>{rankings[1]?.username}</p>
              <p className="text-amber-400 font-bold text-sm">{rankings[1]?.total_points}pts</p>
              <div className="w-full rounded-t-lg h-16 flex items-center justify-center text-2xl mt-1" style={{ backgroundColor: 'var(--bg-card)' }}>🥈</div>
            </div>
            {/* 1º */}
            <div className="flex flex-col items-center flex-1">
              <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}>
                <Avatar url={rankings[0]?.avatar_url} username={rankings[0]?.username} />
              </motion.div>
              <p className="text-xs font-semibold mt-1 truncate w-full text-center" style={{ color: 'var(--text-primary)' }}>{rankings[0]?.username}</p>
              <p className="text-amber-400 font-bold text-sm">{rankings[0]?.total_points}pts</p>
              <div className="w-full bg-amber-500 rounded-t-lg h-24 flex items-center justify-center text-2xl mt-1">🥇</div>
            </div>
            {/* 3º */}
            <div className="flex flex-col items-center flex-1">
              <Avatar url={rankings[2]?.avatar_url} username={rankings[2]?.username} />
              <p className="text-xs font-semibold mt-1 truncate w-full text-center" style={{ color: 'var(--text-muted)' }}>{rankings[2]?.username}</p>
              <p className="text-amber-400 font-bold text-sm">{rankings[2]?.total_points}pts</p>
              <div className="w-full rounded-t-lg h-10 flex items-center justify-center text-2xl mt-1" style={{ backgroundColor: 'var(--bg-hover)' }}>🥉</div>
            </div>
          </motion.div>
        )}

        {loading ? (
          <p className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Cargando ranking...</p>
        ) : rankings.length === 0 ? (
          <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
            <div className="text-5xl mb-3">🌍</div>
            <p>Aún no hay datos globales</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rankings.map((entry, index) => {
              const isMe = entry.user_id === user.id
              const drinkCounts = (entry.drinks_detail || []).reduce((acc, d) => {
                if (!acc[d.name]) acc[d.name] = { emoji: d.emoji, count: 0 }
                acc[d.name].count += 1
                return acc
              }, {})

              return (
                <motion.div
                  key={entry.user_id}
                  variants={staggerItem}
                  initial="initial"
                  animate="animate"
                  className={`rounded-2xl p-4 ${isMe ? 'bg-amber-500' : ''}`}
                  style={!isMe ? { backgroundColor: 'var(--bg-card)' } : {}}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-2xl w-8 text-center">{medals[index] || `${index + 1}`}</span>
                    <Avatar url={entry.avatar_url} username={entry.username} />
                    <div className="flex-1">
                      <p className="font-bold">{entry.username} {isMe && '(tú)'}</p>
                      <p className="text-xs" style={{ color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>
                        {entry.total_drinks} consumiciones
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${isMe ? 'text-white' : 'text-amber-400'}`}>{entry.total_points}</p>
                      <p className="text-xs" style={{ color: isMe ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}>puntos</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2 border-t" style={{ borderColor: isMe ? 'rgba(255,255,255,0.3)' : 'var(--border)' }}>
                    {Object.entries(drinkCounts)
                      .sort(([, a], [, b]) => b.count - a.count)
                      .map(([name, { emoji, count }]) => (
                        <div
                          key={name}
                          className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${isMe ? 'bg-amber-600 text-white' : ''}`}
                          style={!isMe ? { backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' } : {}}
                        >
                          <span>{emoji}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}