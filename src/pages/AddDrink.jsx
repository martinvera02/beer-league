import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function AddDrink() {
  const { user } = useAuth()
  const [drinkTypes, setDrinkTypes] = useState([])
  const [leagues, setLeagues] = useState([])
  const [selectedDrink, setSelectedDrink] = useState(null)
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    const [{ data: drinks }, { data: members }] = await Promise.all([
      supabase.from('drink_types').select('*'),
      supabase.from('league_members')
        .select('league_id, leagues(id, name)')
        .eq('user_id', user.id)
    ])
    setDrinkTypes(drinks || [])
    setLeagues(members?.map(m => m.leagues) || [])
    if (members?.length > 0) setSelectedLeague(members[0].leagues.id)
  }

  const handleAdd = async () => {
    if (!selectedDrink || !selectedLeague) return
    setLoading(true)

    const drink = drinkTypes.find(d => d.id === selectedDrink)
    await supabase.from('drinks').insert({
      user_id: user.id,
      league_id: selectedLeague,
      drink_type_id: drink.id,
      points: drink.points,
    })

    setSuccess(true)
    setTimeout(() => setSuccess(false), 2000)
    setLoading(false)
    setSelectedDrink(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 px-4 pt-6">
      <div className="max-w-md mx-auto">

        <h1 className="text-2xl font-bold mb-1">Añadir consumición 🍺</h1>
        <p className="text-gray-400 text-sm mb-6">¿Qué has tomado?</p>

        {/* Selector de liga */}
        {leagues.length > 1 && (
          <div className="mb-6">
            <p className="text-sm text-gray-400 mb-2">Liga</p>
            <div className="flex gap-2 flex-wrap">
              {leagues.map(league => (
                <button
                  key={league.id}
                  onClick={() => setSelectedLeague(league.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    selectedLeague === league.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {league.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selector de bebida */}
        <div className="grid grid-cols-2 gap-3 mb-8">
          {drinkTypes.map(drink => (
            <button
              key={drink.id}
              onClick={() => setSelectedDrink(drink.id)}
              className={`rounded-2xl p-5 text-center transition-all ${
                selectedDrink === drink.id
                  ? 'bg-amber-500 scale-105 shadow-lg shadow-amber-900'
                  : 'bg-gray-900 hover:bg-gray-800'
              }`}
            >
              <div className="text-4xl mb-2">{drink.emoji}</div>
              <div className="font-semibold text-sm">{drink.name}</div>
              <div className={`text-xs mt-1 ${selectedDrink === drink.id ? 'text-amber-100' : 'text-gray-500'}`}>
                {drink.points} {drink.points === 1 ? 'punto' : 'puntos'}
              </div>
            </button>
          ))}
        </div>

        {/* Botón confirmar */}
        <button
          onClick={handleAdd}
          disabled={!selectedDrink || !selectedLeague || loading}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-lg transition-colors"
        >
          {loading ? 'Guardando...' : success ? '¡Añadido! 🎉' : 'Confirmar consumición'}
        </button>

        {success && (
          <div className="mt-4 text-center text-green-400 font-medium animate-pulse">
            ¡Punto anotado en la liga! 🏆
          </div>
        )}
      </div>
    </div>
  )
}