import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Ranking({ selectedLeague, setSelectedLeague }) {
  const { user } = useAuth()
  const [leagues, setLeagues] = useState([])
  const [rankings, setRankings] = useState([])
  const [members, setMembers] = useState([])
  const [tab, setTab] = useState('ranking')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeagues()
  }, [])

  useEffect(() => {
    if (selectedLeague) {
      fetchRanking(selectedLeague.id)
      fetchMembers(selectedLeague.id)
    }
  }, [selectedLeague])

  const fetchLeagues = async () => {
    const { data } = await supabase
      .from('league_members')
      .select('league_id, leagues(id, name, created_by)')
      .eq('user_id', user.id)

    const userLeagues = data?.map(d => d.leagues) || []
    setLeagues(userLeagues)
    if (!selectedLeague && userLeagues.length > 0) setSelectedLeague(userLeagues[0])
  }

  const fetchRanking = async (leagueId) => {
    setLoading(true)
    const { data } = await supabase
      .from('league_rankings')
      .select('*')
      .eq('league_id', leagueId)
      .order('total_points', { ascending: false })
    setRankings(data || [])
    setLoading(false)
  }

  const fetchMembers = async (leagueId) => {
    const { data } = await supabase
      .from('league_members')
      .select('joined_at, profiles(id, username)')
      .eq('league_id', leagueId)
      .order('joined_at', { ascending: true })
    setMembers(data?.map(m => ({ ...m.profiles, joined_at: m.joined_at })) || [])
  }

  const leaveLeague = async () => {
    if (!selectedLeague) return
    await supabase
      .from('league_members')
      .delete()
      .eq('league_id', selectedLeague.id)
      .eq('user_id', user.id)
    setSelectedLeague(null)
    fetchLeagues()
    setTab('ranking')
  }

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 px-4 pt-6">
      <div className="max-w-md mx-auto">

        <h1 className="text-2xl font-bold mb-1">Ranking 🏆</h1>
        <p className="text-gray-400 text-sm mb-4">¿Quién va ganando?</p>

        {/* Selector de liga */}
        {leagues.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-4">
            {leagues.map(league => (
              <button
                key={league.id}
                onClick={() => setSelectedLeague(league)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  selectedLeague?.id === league.id
                    ? 'bg-amber-500 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {league.name}
              </button>
            ))}
          </div>
        )}

        {/* ID para compartir */}
        {selectedLeague && (
          <div className="bg-gray-900 rounded-2xl px-4 py-3 mb-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Comparte este ID con tus amigos</p>
              <p className="text-amber-400 font-bold text-lg">#{selectedLeague.id}</p>
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(String(selectedLeague.id))}
              className="bg-gray-800 hover:bg-gray-700 text-sm px-3 py-2 rounded-lg transition-colors"
            >
              Copiar
            </button>
          </div>
        )}

        {/* Pestañas ranking / participantes */}
        {selectedLeague && (
          <div className="flex bg-gray-800 rounded-xl p-1 mb-6">
            <button
              onClick={() => setTab('ranking')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'ranking' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              🏆 Ranking
            </button>
            <button
              onClick={() => setTab('members')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'members' ? 'bg-amber-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              👥 Participantes
            </button>
          </div>
        )}

        {/* Contenido ranking */}
        {tab === 'ranking' && (
          loading ? (
            <p className="text-gray-500 text-center py-10">Cargando ranking...</p>
          ) : rankings.length === 0 ? (
            <div className="text-center py-16 text-gray-500">
              <div className="text-5xl mb-3">🍺</div>
              <p>Aún no hay consumiciones</p>
              <p className="text-sm mt-1">¡Sé el primero en anotar!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rankings.map((entry, index) => {
                const isMe = entry.user_id === user.id
                return (
                  <div
                    key={entry.user_id}
                    className={`rounded-2xl p-4 flex items-center gap-4 ${
                      isMe ? 'bg-amber-500' : 'bg-gray-900'
                    }`}
                  >
                    <span className="text-2xl w-8 text-center">
                      {medals[index] || `${index + 1}`}
                    </span>
                    <div className="flex-1">
                      <p className="font-bold">{entry.username} {isMe && '(tú)'}</p>
                      <p className={`text-xs ${isMe ? 'text-amber-100' : 'text-gray-500'}`}>
                        {entry.total_drinks} consumiciones
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-bold ${isMe ? 'text-white' : 'text-amber-400'}`}>
                        {entry.total_points}
                      </p>
                      <p className={`text-xs ${isMe ? 'text-amber-100' : 'text-gray-500'}`}>puntos</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )
        )}

        {/* Contenido participantes */}
        {tab === 'members' && (
          <div className="space-y-3">
            {members.map(member => {
              const isMe = member.id === user.id
              const isOwner = selectedLeague?.created_by === member.id
              return (
                <div
                  key={member.id}
                  className={`rounded-2xl p-4 flex items-center gap-4 ${
                    isMe ? 'bg-gray-800 border border-amber-500' : 'bg-gray-900'
                  }`}
                >
                  <div className="text-3xl">
                    {isOwner ? '👑' : '🍺'}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">
                      {member.username} {isMe && '(tú)'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {isOwner ? 'Creador de la liga' : 'Miembro'}
                    </p>
                  </div>
                </div>
              )
            })}

            <button
              onClick={leaveLeague}
              className="w-full mt-4 bg-transparent hover:bg-red-950 text-red-500 hover:text-red-400 font-semibold py-3 rounded-2xl border border-red-900 transition-colors"
            >
              Abandonar liga 🚪
            </button>
          </div>
        )}

      </div>
    </div>
  )
}