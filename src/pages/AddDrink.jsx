import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerContainer, staggerItem } from '../lib/animations'
import { soundDrink, soundSuccess } from '../lib/sounds'

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}

export default function AddDrink() {
  const { user } = useAuth()
  const [drinkTypes, setDrinkTypes] = useState([])
  const [leagues, setLeagues] = useState([])
  const [seasonId, setSeasonId] = useState(null)
  const [selectedDrink, setSelectedDrink] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [coinsEarned, setCoinsEarned] = useState(0)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    const [{ data: drinks }, { data: members }, { data: season }] = await Promise.all([
      supabase.from('drink_types').select('*'),
      supabase.from('league_members').select('league_id').eq('user_id', user.id),
      supabase.rpc('get_active_season'),
    ])
    setDrinkTypes(drinks || [])
    setLeagues(members?.map(m => m.league_id) || [])
    setSeasonId(season?.id || null)
  }

  const handleAdd = async () => {
    if (!selectedDrink || leagues.length === 0 || !seasonId) return
    setLoading(true)
    soundDrink()

    const drink = drinkTypes.find(d => d.id === selectedDrink)
    const drinkGroupId = generateUUID()
    const coins = Math.floor(drink.points * 10)

    const inserts = leagues.map(league_id => ({
      user_id: user.id,
      league_id,
      drink_type_id: drink.id,
      points: drink.points,
      season_id: seasonId,
      drink_group_id: drinkGroupId,
    }))

    await supabase.from('drinks').insert(inserts)

    // Dar recompensa en monedas 🪙
    await supabase.rpc('reward_drink', {
      p_user_id: user.id,
      p_points: drink.points,
    })

    setCoinsEarned(coins)
    setSuccess(true)
    soundSuccess()
    setTimeout(() => setSuccess(false), 2500)
    setLoading(false)
    setSelectedDrink(null)
  }

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-md mx-auto">

        <motion.div {...fadeIn}>
          <h1 className="text-2xl font-bold mb-1">Añadir consumición 🍺</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>¿Qué has tomado? Se anotará en todas tus ligas.</p>
        </motion.div>

        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-2 gap-3 mb-8">
          {drinkTypes.map(drink => (
            <motion.button
              key={drink.id}
              variants={staggerItem}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setSelectedDrink(drink.id)}
              className={`rounded-2xl p-5 text-center transition-all ${
                selectedDrink === drink.id ? 'bg-amber-500 shadow-lg shadow-amber-900' : ''
              }`}
              style={selectedDrink !== drink.id ? { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' } : {}}
            >
              <motion.div
                className="text-4xl mb-2"
                animate={selectedDrink === drink.id ? { scale: [1, 1.3, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                {drink.emoji}
              </motion.div>
              <div className="font-semibold text-sm">{drink.name}</div>
              <div className="text-xs mt-0.5" style={{ color: selectedDrink === drink.id ? 'rgba(255,255,255,0.8)' : 'var(--text-hint)' }}>
                {drink.points} {drink.points === 1 ? 'punto' : 'puntos'}
              </div>
              <div className="text-xs mt-0.5 font-medium" style={{ color: selectedDrink === drink.id ? 'rgba(255,255,255,0.9)' : '#f59e0b' }}>
                +{Math.floor(drink.points * 10)}🪙
              </div>
            </motion.button>
          ))}
        </motion.div>

        <motion.button
          onClick={handleAdd}
          disabled={!selectedDrink || loading || leagues.length === 0}
          whileTap={{ scale: 0.97 }}
          whileHover={selectedDrink ? { scale: 1.02 } : {}}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-lg transition-colors"
        >
          {loading ? 'Guardando...' : leagues.length === 0 ? 'Únete a una liga primero' : '¡Apuntar consumición!'}
        </motion.button>

        {leagues.length === 0 && (
          <motion.p {...fadeIn} className="text-center text-sm mt-3" style={{ color: 'var(--text-hint)' }}>
            Crea o únete a una liga desde la sección 🏆
          </motion.p>
        )}

        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.8 }}
              className="mt-6 text-center bg-green-900 rounded-2xl py-5"
            >
              <motion.div className="text-5xl mb-2"
                animate={{ rotate: [0, -15, 15, -10, 0], scale: [1, 1.3, 1] }}
                transition={{ duration: 0.6 }}>
                🎉
              </motion.div>
              <p className="text-green-300 font-bold text-lg">¡Punto anotado!</p>
              <p className="text-green-500 text-sm mt-1">Anotado en {leagues.length} {leagues.length === 1 ? 'liga' : 'ligas'} 🏆</p>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-amber-400 font-bold mt-2"
              >
                +{coinsEarned}🪙 ganadas
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}