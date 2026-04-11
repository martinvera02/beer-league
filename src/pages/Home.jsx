import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Home({ setCurrentPage, setSelectedLeague }) {
  const { user } = useAuth()
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [newLeagueName, setNewLeagueName] = useState('')
  const [joinId, setJoinId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    fetchLeagues()
  }, [])

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
      .select()
      .single()

    if (error) { setError('Error al crear la liga'); return }

    await supabase.from('league_members').insert({
      league_id: data.id,
      user_id: user.id,
    })

    setNewLeagueName('')
    setShowCreate(false)
    fetchLeagues()
  }

  const joinLeague = async () => {
    if (!joinId.trim()) return
    setError('')

    const { data: league } = await supabase
      .from('leagues')
      .select('id')
      .eq('id', parseInt(joinId))
      .single()

    if (!league) { setError('Liga no encontrada'); return }

    const { error } = await supabase
      .from('league_members')
      .insert({ league_id: league.id, user_id: user.id })

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

        <h1 className="text-2xl font-bold mb-1">Tus ligas 🏆</h1>
        <p className="text-gray-400 text-sm mb-6">Crea una liga o únete con el ID</p>

        {/* Botones de acción */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false) }}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            + Crear liga
          </button>
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false) }}
            className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            Unirse con ID
          </button>
        </div>

        {/* Formulario crear */}
        {showCreate && (
          <div className="bg-gray-900 rounded-2xl p-4 mb-4">
            <p className="text-sm text-gray-400 mb-2">Nombre de la liga</p>
            <input
              type="text"
              value={newLeagueName}
              onChange={e => setNewLeagueName(e.target.value)}
              placeholder="ej: Los Alcohólicos Anónimos"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={createLeague} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-semibold py-2 rounded-lg">
                Crear
              </button>
              <button onClick={() => setShowCreate(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Formulario unirse */}
        {showJoin && (
          <div className="bg-gray-900 rounded-2xl p-4 mb-4">
            <p className="text-sm text-gray-400 mb-2">ID de la liga</p>
            <input
              type="number"
              value={joinId}
              onChange={e => setJoinId(e.target.value)}
              placeholder="ej: 42"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 mb-3"
            />
            <div className="flex gap-2">
              <button onClick={joinLeague} className="flex-1 bg-amber-500 hover:bg-amber-400 text-white font-semibold py-2 rounded-lg">
                Unirse
              </button>
              <button onClick={() => setShowJoin(false)} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-950 rounded-lg px-4 py-2 mb-4">{error}</p>
        )}

        {/* Lista de ligas */}
        {loading ? (
          <p className="text-gray-500 text-center py-10">Cargando ligas...</p>
        ) : leagues.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-3">🍺</div>
            <p>Aún no estás en ninguna liga</p>
            <p className="text-sm mt-1">Crea una o únete con un ID</p>
          </div>
        ) : (
          <div className="space-y-3">
            {leagues.map(league => (
              <button
                key={league.id}
                onClick={() => enterLeague(league)}
                className="w-full bg-gray-900 hover:bg-gray-800 rounded-2xl p-4 text-left transition-colors flex items-center justify-between"
              >
                <div>
                  <p className="font-semibold text-white">{league.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5">ID: {league.id} · Comparte este número con tus amigos</p>
                </div>
                <span className="text-gray-400 text-xl">›</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}