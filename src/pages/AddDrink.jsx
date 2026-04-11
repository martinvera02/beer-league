import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerContainer, staggerItem, scaleIn } from '../lib/animations'

export default function AddDrink() {
  const { user } = useAuth()
  const [drinkTypes, setDrinkTypes] = useState([])
  const [leagues, setLeagues] = useState([])
  const [selectedDrink, setSelectedDrink] = useState(null)
  const [selectedLeague, setSelectedLeague] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [{ data: drinks }, { data: members }] = await Promise.all([
      supabase.from('drink_types').select('*'),
      supabase.from('league_members').select('league_id, leagues(id, name)').eq('user_id', user.id)
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
    setTimeout(() => setSuccess(false), 2500)
    setLoading(false)
    setSelectedDrink(null)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-24 px-4 pt-6">
      <div className="max-w-md mx-auto">

        <motion.div {...fadeIn}>
          <h1 className="text-2xl font-bold mb-1">Añadir consumición 🍺</h1>
          <p className="text-gray-400 text-sm mb-6">¿Qué has tomado?</p>
        </motion.div>

        {leagues.length > 1 && (
          <motion.div {...fadeIn} transition={{ delay: 0.1 }} className="mb-6">
            <p className="text-sm text-gray-400 mb-2">Liga</p>
            <div className="flex gap-2 flex-wrap">
              {leagues.map(league => (
                <motion.button
                  key={league.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setSelectedLeague(league.id)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    selectedLeague === league.id
                      ? 'bg-amber-500 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {league.name}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}

        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-2 gap-3 mb-8"
        >
          {drinkTypes.map(drink => (
            <motion.button
              key={drink.id}
              variants={staggerItem}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedDrink(drink.id)}
              className={`rounded-2xl p-5 text-center transition-all ${
                selectedDrink === drink.id
                  ? 'bg-amber-500 shadow-lg shadow-amber-900'
                  : 'bg-gray-900 hover:bg-gray-800'
              }`}
            >
              <motion.div
                className="text-4xl mb-2"
                animate={selectedDrink === drink.id ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {drink.emoji}
              </motion.div>
              <div className="font-semibold text-sm">{drink.name}</div>
              <div className={`text-xs mt-1 ${selectedDrink === drink.id ? 'text-amber-100' : 'text-gray-500'}`}>
                {drink.points} {drink.points === 1 ? 'punto' : 'puntos'}
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.button
          onClick={handleAdd}
          disabled={!selectedDrink || !selectedLeague || loading}
          whileTap={{ scale: 0.97 }}
          whileHover={selectedDrink ? { scale: 1.02 } : {}}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-lg transition-colors"
        >
          {loading ? 'Guardando...' : '¡Apuntar consumición!'}
        </motion.button>

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="mt-6 text-center bg-green-900 rounded-2xl py-5"
            >
              <motion.div
                className="text-5xl mb-2"
                animate={{ rotate: [0, -15, 15, -10, 0], scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6 }}
              >
                🎉
              </motion.div>
              <p className="text-green-300 font-bold text-lg">¡Punto anotado!</p>
              <p className="text-green-500 text-sm mt-1">Sigue así campeón 🏆</p>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  )
}