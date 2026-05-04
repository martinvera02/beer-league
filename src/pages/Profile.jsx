import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNotifications } from '../context/NotificationsContext'
import { fadeIn, staggerItem, scaleIn } from '../lib/animations'
import { soundError, soundSuccess as soundOk } from '../lib/sounds'

// ─── DEFINICIÓN DE LOGROS ─────────────────────────────────────────────────────

const ACHIEVEMENTS = [
  // Consumiciones
  { id: 'first_drink',       emoji: '🍺', name: 'Primera ronda',          desc: 'Anota tu primera consumición',                        category: 'consumiciones' },
  { id: 'drinks_10',         emoji: '🔟', name: 'Bebedor consistente',     desc: 'Acumula 10 consumiciones',                            category: 'consumiciones' },
  { id: 'drinks_50',         emoji: '🏅', name: 'Veterano',                desc: 'Acumula 50 consumiciones',                            category: 'consumiciones' },
  { id: 'drinks_100',        emoji: '👑', name: 'Leyenda',                 desc: 'Acumula 100 consumiciones',                           category: 'consumiciones' },
  { id: 'martes_macarra',    emoji: '🔥', name: 'Martes Macarra',          desc: 'Anota una consumición en Martes Macarra',             category: 'consumiciones' },
  { id: 'variety_5',         emoji: '🌈', name: 'Paladar exquisito',       desc: 'Prueba 5 tipos de bebida distintos',                  category: 'consumiciones' },
  { id: 'drinks_day_3',      emoji: '🚀', name: 'Calentando motores',      desc: 'Anota 3 consumiciones en un mismo día',               category: 'consumiciones' },
  { id: 'drinks_day_10',     emoji: '🚨', name: 'Esto ya es un problema',  desc: 'Anota 10 consumiciones en un mismo día',              category: 'consumiciones' },
  { id: 'top1_league',       emoji: '🥇', name: 'El último en pie',        desc: 'Llega al top 1 del ranking de tu liga',               category: 'consumiciones' },
  { id: 'come_back',         emoji: '🧟', name: 'Abstemio rehabilitado',   desc: 'Vuelve a anotar tras 7 días sin nada',                category: 'consumiciones' },
  { id: 'most_active',       emoji: '🏃', name: 'El del bar',              desc: 'Sé el miembro más activo de tu liga',                 category: 'consumiciones' },
  // Casino & Dinero
  { id: 'roulette_win',      emoji: '🎰', name: 'Golpe de suerte',         desc: 'Gana en la ruleta de apuestas',                       category: 'casino' },
  { id: 'roulette_3wins',    emoji: '🎯', name: 'En racha',                desc: 'Gana 3 veces seguidas en ruleta',                     category: 'casino' },
  { id: 'millionaire',       emoji: '💰', name: 'Millonario',              desc: 'Acumula 1000 monedas',                                category: 'casino' },
  { id: 'market_5',          emoji: '📈', name: 'Tiburón del mercado',     desc: 'Abre 5 posiciones en el mercado',                     category: 'casino' },
  { id: 'big_bet',           emoji: '🎲', name: 'Todo o nada',             desc: 'Apuesta 500+ en una sola tirada',                     category: 'casino' },
  { id: 'broke',             emoji: '🪙', name: 'Pelado',                  desc: 'Llega a 0 monedas exactas',                           category: 'casino' },
  { id: 'negative_balance',  emoji: '📉', name: 'En números rojos',        desc: 'Ten saldo negativo',                                  category: 'casino' },
  { id: 'lender',            emoji: '🏦', name: 'Prestamista',             desc: 'Envía monedas a 3 personas distintas',                category: 'casino' },
  { id: 'big_sender',        emoji: '💸', name: 'El que invita',           desc: 'Envía más de 1000 monedas en total',                  category: 'casino' },
  { id: 'roulette_10bets',   emoji: '🎡', name: 'Tahúr',                   desc: 'Haz 10 apuestas en la ruleta',                        category: 'casino' },
  { id: 'big_win',           emoji: '🤑', name: 'Rompebancos',             desc: 'Gana más de 500 monedas en una sola tirada',          category: 'casino' },
  // Social & Powerups
  { id: 'sabotage',          emoji: '💣', name: 'Saboteador',              desc: 'Aplica un Sabotaje a otro miembro',                   category: 'social' },
  { id: 'shield',            emoji: '🛡️', name: 'Protegido',               desc: 'Usa un Escudo',                                       category: 'social' },
  { id: 'generous',          emoji: '💸', name: 'Generoso',                desc: 'Envía monedas a otro miembro',                        category: 'social' },
  { id: 'popular',           emoji: '❤️', name: 'Popular',                 desc: 'Recibe 10 likes en tus posts',                        category: 'social' },
  { id: 'pacifist',          emoji: '☮️', name: 'Pacifista',               desc: 'Lleva 7 días sin usar ningún powerup de ataque',      category: 'social' },
  { id: 'war_mode',          emoji: '⚔️', name: 'Guerra total',            desc: 'Usa Sabotaje y Sniper en el mismo día',               category: 'social' },
  { id: 'revenge',           emoji: '🗡️', name: 'Venganza servida fría',   desc: 'Usa Sabotaje a alguien que te lo usó antes',          category: 'social' },
  { id: 'influencer',        emoji: '🌟', name: 'Influencer',              desc: 'Ten 5 seguidores',                                    category: 'social' },
  { id: 'chatterbox',        emoji: '💬', name: 'Tertuliano',              desc: 'Escribe 50 mensajes en chats de liga',                category: 'social' },
  { id: 'photographer',      emoji: '📸', name: 'Fotógrafo de bodas',      desc: 'Sube 5 historias',                                   category: 'social' },
  // Consumiciones — nuevos
  { id: 'drinks_200',         emoji: '🪦', name: 'Ya no tiene arreglo',        desc: 'Acumula 200 consumiciones',                           category: 'consumiciones' },
  { id: 'drinks_500',         emoji: '🏛️', name: 'Patrimonio de la humanidad', desc: 'Acumula 500 consumiciones',                           category: 'consumiciones' },
  { id: 'night_owl',          emoji: '🦉', name: 'El que nunca duerme',        desc: 'Anota una consumición entre las 4h y las 6h',         category: 'consumiciones' },
  { id: 'early_bird',         emoji: '🐓', name: 'Desayuno de campeones',      desc: 'Anota una consumición antes de las 12h',              category: 'consumiciones' },
  { id: 'monday_drinker',     emoji: '😔', name: 'El lunes también cuenta',    desc: 'Anota una consumición en lunes',                      category: 'consumiciones' },
  { id: 'drinks_day_5',       emoji: '🌪️', name: 'Fuerza de la naturaleza',   desc: 'Anota 5 consumiciones en un mismo día',               category: 'consumiciones' },
  { id: 'top3_league',        emoji: '🥉', name: 'En el podio',                desc: 'Llega al top 3 del ranking de tu liga',               category: 'consumiciones' },
  { id: 'operacion_barbacoa_2026', emoji: '🍖', name: 'Veterano de la Barbacoa', desc: 'Participaste en la Operación Barbacoa 2026',       category: 'consumiciones' },
  { id: 'all_drinks',         emoji: '🌍', name: 'Coleccionista',              desc: 'Prueba todas las bebidas disponibles',                 category: 'consumiciones' },
  { id: 'solo_drinker',       emoji: '🧍', name: 'Bebedor solitario',          desc: 'Sé el único de tu liga que bebe en un día',           category: 'consumiciones' },

  // Casino & Dinero — nuevos
  { id: 'loan_taken',         emoji: '🏦', name: 'Al banco a pedir',           desc: 'Solicita tu primer préstamo',                         category: 'casino' },
  { id: 'loan_paid',          emoji: '✅', name: 'Hombre de palabra',           desc: 'Devuelve un préstamo a tiempo',                       category: 'casino' },
  { id: 'loan_defaulted',     emoji: '😬', name: 'El del banco llama',          desc: 'Deja un préstamo vencer sin pagar',                   category: 'casino' },
  { id: 'millionaire_2',      emoji: '💎', name: 'Multimillonario',             desc: 'Acumula 5000 monedas',                                category: 'casino' },
  { id: 'roulette_loser',     emoji: '😭', name: 'La casa siempre gana',        desc: 'Pierde 5 veces seguidas en ruleta',                   category: 'casino' },
  { id: 'stock_holder',       emoji: '📊', name: 'Accionista',                  desc: 'Compra acciones en el S&PINTA 500',                   category: 'casino' },
  { id: 'market_manipulator', emoji: '🎭', name: 'Manipulador de mercado',      desc: 'Mueve el precio de una bebida al máximo o mínimo',    category: 'casino' },
  { id: 'bet_winner',         emoji: '🤝', name: 'Apostador ganador',           desc: 'Gana una apuesta contra otro miembro',                category: 'casino' },

  // Guerra & Juicio — nuevos
  { id: 'war_winner',         emoji: '🏆', name: 'Conquistador',                desc: 'Gana tu primera guerra de clanes',                    category: 'social' },
  { id: 'war_captain',        emoji: '👑', name: 'Mi general',                  desc: 'Sé capitán en una guerra de clanes',                  category: 'social' },
  { id: 'spy_role',           emoji: '🕵️', name: 'El espía',                    desc: 'Juega una guerra con el rol de Espía',                category: 'social' },
  { id: 'saboteur_role',      emoji: '💣', name: 'El saboteador de guerras',    desc: 'Juega una guerra con el rol de Saboteador',           category: 'social' },
  { id: 'frozen',             emoji: '🧊', name: 'Congelado en vida',           desc: 'Recibe un Freeze de otro miembro',                    category: 'social' },
  { id: 'dispute_winner',     emoji: '⚖️', name: 'Inocente',                    desc: 'Gana una votación de El Juzgado',                     category: 'social' },
  { id: 'dispute_guilty',     emoji: '🔨', name: 'Culpable según el jurado',    desc: 'Pierde una votación de El Juzgado',                   category: 'social' },
  { id: 'dispute_judge',      emoji: '👨‍⚖️', name: 'El Pontífice',               desc: 'Vota en 5 juicios de El Juzgado',                    category: 'social' },
  { id: 'super_influencer',   emoji: '🌠', name: 'Celebrity',                   desc: 'Ten 15 seguidores',                                   category: 'social' },
  { id: 'turbo_user',         emoji: '⚡', name: 'Turbo activado',              desc: 'Usa el powerup Turbo',                                category: 'social' },
  { id: 'double_user',        emoji: '🔥', name: 'Doble o nada',               desc: 'Usa el powerup Racha Doble',                          category: 'social' },
]


// ─── LÓGICA DE DETECCIÓN ──────────────────────────────────────────────────────

async function detectAchievements(userId, stats, supabaseClient) {
  const toUnlock = []

  const [
    { data: drinks },
    { data: wallet },
    { data: marketPositions },
    { data: rouletteBets },
    { data: activePowerups },
    { data: transfers },
    { data: followers },
    { data: stories },
    { data: messages },
    { data: leagueMembers },
  ] = await Promise.all([
    supabaseClient.from('drinks').select('drink_type_id, consumed_at, league_id, user_id').eq('user_id', userId),
    supabaseClient.from('wallets').select('balance').eq('user_id', userId).single(),
    supabaseClient.from('market_positions').select('id').eq('user_id', userId),
    supabaseClient.from('roulette_bets').select('won, net, created_at, bet_amount').eq('user_id', userId).order('created_at', { ascending: false }),
    supabaseClient.from('active_powerups').select('powerup_id, effect_type, created_at, user_id, target_user_id').eq('user_id', userId),
    supabaseClient.from('league_transfers').select('receiver_id, amount, created_at').eq('sender_id', userId),
    supabaseClient.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', userId),
    supabaseClient.from('stories').select('id').eq('user_id', userId),
    supabaseClient.from('messages').select('id').eq('user_id', userId),
    supabaseClient.from('league_members').select('league_id').eq('user_id', userId),
  ])

  const uniqueDrinks = stats?.count || 0
  const drinkTypes = new Set((drinks || []).map(d => d.drink_type_id))
  const balance = wallet?.balance || 0
  const marketCount = marketPositions?.length || 0
  const followersCount = followers?.count || 0
  const storiesCount = stories?.length || 0
  const messagesCount = messages?.length || 0

  const drinksByDay = (drinks || []).reduce((acc, d) => {
    const day = new Date(d.consumed_at).toDateString()
    acc[day] = (acc[day] || 0) + 1
    return acc
  }, {})
  const maxDrinksInDay = Math.max(0, ...Object.values(drinksByDay))

  const hasMartesM = (drinks || []).some(d => {
    const madridDate = new Date(new Date(d.consumed_at).toLocaleString('en-US', { timeZone: 'Europe/Madrid' }))
    return madridDate.getDay() === 2
  })

  let rouletteStreak = 0
  for (const bet of (rouletteBets || [])) {
    if (bet.won) rouletteStreak++
    else break
  }

  const hasBigBet = (rouletteBets || []).some(b => b.bet_amount >= 500)
  const hasBigWin = (rouletteBets || []).some(b => b.won && b.net >= 500)
  const totalBets = (rouletteBets || []).length
  const hasRouletteWin = (rouletteBets || []).some(b => b.won)

  const uniqueReceivers = new Set((transfers || []).map(t => t.receiver_id))
  const totalSent = (transfers || []).reduce((s, t) => s + (t.amount || 0), 0)

  const hasSabotage = (activePowerups || []).some(p => p.effect_type === 'sabotage')
  const hasShieldUsed = (activePowerups || []).some(p => p.effect_type === 'shield')

  const attackPowerupsByDay = (activePowerups || []).reduce((acc, p) => {
    if (['sabotage', 'sniper'].includes(p.effect_type)) {
      const day = new Date(p.created_at).toDateString()
      if (!acc[day]) acc[day] = new Set()
      acc[day].add(p.effect_type)
    }
    return acc
  }, {})
  const hasWarMode = Object.values(attackPowerupsByDay).some(s => s.has('sabotage') && s.has('sniper'))

  let hasRevenge = false
  if (hasSabotage) {
    const { data: receivedSabotage } = await supabaseClient
      .from('active_powerups').select('user_id, created_at')
      .eq('target_user_id', userId).eq('effect_type', 'sabotage')
    if (receivedSabotage && receivedSabotage.length > 0) {
      const attackerIds = new Set(receivedSabotage.map(s => s.user_id))
      const myAttacks = (activePowerups || []).filter(p => p.effect_type === 'sabotage')
      hasRevenge = myAttacks.some(a => attackerIds.has(a.target_user_id))
    }
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recentAttacks = (activePowerups || []).filter(p =>
    ['sabotage', 'sniper'].includes(p.effect_type) && new Date(p.created_at) > sevenDaysAgo
  )
  const isPacifist = uniqueDrinks > 0 && recentAttacks.length === 0

  const sortedDrinks = [...(drinks || [])].sort((a, b) => new Date(b.consumed_at) - new Date(a.consumed_at))
  let hasComeBack = false
  if (sortedDrinks.length >= 2) {
    const latest = new Date(sortedDrinks[0].consumed_at)
    const previous = new Date(sortedDrinks[1].consumed_at)
    hasComeBack = (latest - previous) / (1000 * 60 * 60 * 24) >= 7
  }

  let isTop1 = false
  for (const lm of (leagueMembers || [])) {
    const { data: ranking } = await supabaseClient
      .from('league_rankings').select('user_id')
      .eq('league_id', lm.league_id)
      .order('total_points', { ascending: false })
      .limit(1).maybeSingle()
    if (ranking?.user_id === userId) { isTop1 = true; break }
  }

  let isMostActive = false
  for (const lm of (leagueMembers || [])) {
    const { data: rankingAll } = await supabaseClient
      .from('league_rankings').select('user_id, total_drinks')
      .eq('league_id', lm.league_id)
      .order('total_drinks', { ascending: false })
      .limit(1).maybeSingle()
    if (rankingAll?.user_id === userId) { isMostActive = true; break }
  }

  const { data: myPosts } = await supabaseClient.from('posts').select('id').eq('user_id', userId)
  let totalLikes = 0
  if (myPosts && myPosts.length > 0) {
    const { count } = await supabaseClient.from('post_likes')
      .select('id', { count: 'exact', head: true })
      .in('post_id', myPosts.map(p => p.id))
    totalLikes = count || 0
  }


  // Nuevas detecciones
  const drinkHours = (drinks || []).map(d => new Date(new Date(d.consumed_at).toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).getHours())
  const hasNightOwl = drinkHours.some(h => h >= 4 && h < 6)
  const hasEarlyBird = drinkHours.some(h => h < 12)
  const hasMondayDrink = (drinks || []).some(d => new Date(new Date(d.consumed_at).toLocaleString('en-US', { timeZone: 'Europe/Madrid' })).getDay() === 1)
  const hasTop3 = (() => { return false })() // se comprueba igual que top1 pero posición <= 3
  const hasBarbacoa = false // se inserta desde AddDrink directamente
  const hasAllDrinks = false // requiere saber cuántas bebidas hay en total
  const rouletteLosingStreak = (() => { let s = 0; for (const b of (rouletteBets || [])) { if (!b.won) s++; else break }; return s })()
  const hasLoanTaken = (activePowerups || []).length >= 0 // se comprueba en bank_loans
  const hasStockHolder = (myStockPositions || []).length > 0
  const hasTurboUsed = (activePowerups || []).some(p => p.effect_type === 'turbo')
  const hasDoubleUsed = (activePowerups || []).some(p => p.effect_type === 'double_points')
  const hasWarWinner = false // requiere clan_war_participants — se detecta en fetchGlobalStats
  const hasWarCaptain = false // idem
  const hasSpyRole = false // idem
  const hasSaboteurRole = false // idem
  const hasFrozen = false // requiere active_powerups recibidos

  const conditions = {
    first_drink:      uniqueDrinks >= 1,
    drinks_10:        uniqueDrinks >= 10,
    drinks_50:        uniqueDrinks >= 50,
    drinks_100:       uniqueDrinks >= 100,
    martes_macarra:   hasMartesM,
    variety_5:        drinkTypes.size >= 5,
    drinks_day_3:     maxDrinksInDay >= 3,
    drinks_day_10:    maxDrinksInDay >= 10,
    top1_league:      isTop1,
    come_back:        hasComeBack,
    most_active:      isMostActive,
    roulette_win:     hasRouletteWin,
    roulette_3wins:   rouletteStreak >= 3,
    millionaire:      balance >= 1000,
    market_5:         marketCount >= 5,
    big_bet:          hasBigBet,
    broke:            balance === 0 && uniqueDrinks > 0,
    negative_balance: balance < 0,
    lender:           uniqueReceivers.size >= 3,
    big_sender:       totalSent >= 1000,
    roulette_10bets:  totalBets >= 10,
    big_win:          hasBigWin,
    sabotage:         hasSabotage,
    shield:           hasShieldUsed,
    generous:         (transfers || []).length >= 1,
    popular:          totalLikes >= 10,
    pacifist:         isPacifist,
    war_mode:         hasWarMode,
    revenge:          hasRevenge,
    influencer:       followersCount >= 5,
    chatterbox:       messagesCount >= 50,
    photographer:     storiesCount >= 5,
    // Nuevos
    drinks_200:         uniqueDrinks >= 200,
    drinks_500:         uniqueDrinks >= 500,
    night_owl:          hasNightOwl,
    early_bird:         hasEarlyBird,
    monday_drinker:     hasMondayDrink,
    drinks_day_5:       maxDrinksInDay >= 5,
    super_influencer:   followersCount >= 15,
    roulette_loser:     rouletteLosingStreak >= 5,
    stock_holder:       hasStockHolder,
    turbo_user:         hasTurboUsed,
    double_user:        hasDoubleUsed,
    millionaire_2:      balance >= 5000,
    bet_winner:         (rouletteBets || []).some(b => b.won && b.bet_amount > 0),
  }

  for (const [id, condition] of Object.entries(conditions)) {
    if (condition) toUnlock.push(id)
  }

  return toUnlock
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function Profile() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
  // ✅ NUEVO: seguidores y seguidos
  const [followersCount, setFollowersCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [history, setHistory] = useState([])
  const [historyPage, setHistoryPage] = useState(0)
  const [historyHasMore, setHistoryHasMore] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [section, setSection] = useState('profile')
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingUsername, setSavingUsername] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [unlockedIds, setUnlockedIds] = useState(new Set())
  const [newlyUnlocked, setNewlyUnlocked] = useState([])
  const [loadingAchievements, setLoadingAchievements] = useState(false)
  const [globalRank, setGlobalRank] = useState(null)
  const [globalPoints, setGlobalPoints] = useState(null)
  const [totalGlobalPlayers, setTotalGlobalPlayers] = useState(null)
  const [warStats, setWarStats] = useState(null)
  const [walletBalance, setWalletBalance] = useState(0)
  const fileInputRef = useRef(null)
  const PAGE_SIZE = 20

  useEffect(() => { fetchProfile() }, [])
  useEffect(() => {
    if (section === 'history' && history.length === 0) fetchHistory(0)
    if (section === 'notifications') markAllRead()
    if (section === 'achievements') fetchAndCheckAchievements()
  }, [section])


  const fetchGlobalStats = async () => {
    const [
      { data: wallet },
      { data: allRankings },
    ] = await Promise.all([
      supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
      supabase.from('global_rankings').select('user_id, total_points').order('total_points', { ascending: false }),
    ])
    setWalletBalance(wallet?.balance || 0)
    if (allRankings) {
      setTotalGlobalPlayers(allRankings.length)
      const myIdx = allRankings.findIndex(r => r.user_id === user.id)
      if (myIdx !== -1) {
        setGlobalRank(myIdx + 1)
        setGlobalPoints(Math.round(allRankings[myIdx].total_points * 10) / 10)
      }
    }
    // Stats de guerra
    const { data: warParticipations } = await supabase
      .from('clan_war_participants')
      .select('war_id, league_id, clan_wars(winner_league_id, status, clan_war_battles(winner_league_id))')
      .eq('user_id', user.id)
    if (warParticipations) {
      const finished = warParticipations.filter(p => p.clan_wars?.status === 'finished')
      const won = finished.filter(p => p.clan_wars?.winner_league_id === p.league_id)
      const battlesWon = finished.reduce((sum, p) => {
        const myBattles = (p.clan_wars?.clan_war_battles || []).filter(b => b.winner_league_id === p.league_id)
        return sum + myBattles.length
      }, 0)
      setWarStats({ wars_played: finished.length, wars_won: won.length, battles_won: battlesWon })
    }
  }

  const fetchProfile = async () => {
    const [
      { data: profileData },
      { data: drinksData },
      { count: fwersCount },
      { count: fwingCount },
    ] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('drinks').select('drink_group_id, points, drink_types(name, emoji)').eq('user_id', user.id),
      // ✅ NUEVO: contar seguidores y seguidos
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', user.id),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', user.id),
    ])

    setProfile(profileData)
    setNewUsername(profileData?.username || '')
    setFollowersCount(fwersCount || 0)
    setFollowingCount(fwingCount || 0)

    if (drinksData) {
      const seen = new Set()
      const unique = drinksData.filter(d => {
        if (seen.has(d.drink_group_id)) return false
        seen.add(d.drink_group_id); return true
      })
      // ✅ FIX: redondear a 1 decimal para evitar floats sucios
      const total = Math.round(unique.reduce((sum, d) => sum + (d.points || 0), 0) * 10) / 10
      const byType = unique.reduce((acc, d) => {
        const name = d.drink_types?.name || 'Desconocido'
        const emoji = d.drink_types?.emoji || '🍺'
        if (!acc[name]) acc[name] = { count: 0, emoji }
        acc[name].count++; return acc
      }, {})
      setStats({ total, count: unique.length, byType })
    }
    setLoading(false)
    fetchGlobalStats()
  }

  const fetchHistory = async (page) => {
    setLoadingHistory(true)
    const { data } = await supabase.from('drinks')
      .select('id, drink_group_id, points, consumed_at, drink_types(name, emoji), seasons(active), leagues(name)')
      .eq('user_id', user.id).order('consumed_at', { ascending: false })
    if (!data) { setLoadingHistory(false); return }
    const grouped = {}
    data.forEach(d => {
      const key = d.drink_group_id
      if (!grouped[key]) grouped[key] = { drink_group_id: key, points: d.points, consumed_at: d.consumed_at, drink_type: d.drink_types, leagues: [] }
      if (d.leagues?.name) grouped[key].leagues.push(d.leagues.name)
    })
    const allUnique = Object.values(grouped).sort((a, b) => new Date(b.consumed_at) - new Date(a.consumed_at))
    const from = page * PAGE_SIZE
    const paginated = allUnique.slice(from, from + PAGE_SIZE)
    if (page === 0) setHistory(paginated); else setHistory(prev => [...prev, ...paginated])
    setHistoryHasMore(allUnique.length > from + PAGE_SIZE)
    setHistoryPage(page); setLoadingHistory(false)
  }

  const fetchAndCheckAchievements = async () => {
    setLoadingAchievements(true)
    const { data: existing } = await supabase.from('achievements').select('achievement_id').eq('user_id', user.id)
    const existingIds = new Set((existing || []).map(a => a.achievement_id))
    const earned = await detectAchievements(user.id, stats, supabase)
    const toInsert = earned.filter(id => !existingIds.has(id))
    if (toInsert.length > 0) {
      await supabase.from('achievements').insert(toInsert.map(achievement_id => ({ user_id: user.id, achievement_id })))
      setNewlyUnlocked(toInsert)
      setTimeout(() => setNewlyUnlocked([]), 5000)
    }
    setUnlockedIds(new Set([...existingIds, ...toInsert]))
    setLoadingAchievements(false)
  }

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000) }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]; if (!file) return
    setUploadingAvatar(true); setError('')
    const ext = file.name.split('.').pop()
    const path = `${user.id}/avatar.${ext}`
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { soundError(); setError('Error al subir la imagen'); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user.id)
    setProfile(prev => ({ ...prev, avatar_url: publicUrl }))
    setUploadingAvatar(false); soundOk(); showSuccess('Foto actualizada')
  }

  const handleChangeUsername = async () => {
    if (!newUsername.trim() || newUsername === profile?.username) return
    setSavingUsername(true); setError('')
    const { error } = await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', user.id)
    if (error) { soundError(); setError(error.message.includes('unique') ? 'Ese nombre ya está en uso' : error.message) }
    else { setProfile(prev => ({ ...prev, username: newUsername.trim() })); soundOk(); showSuccess('Nombre actualizado') }
    setSavingUsername(false)
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) { soundError(); setError('Las contraseñas no coinciden'); return }
    if (newPassword.length < 6) { soundError(); setError('Mínimo 6 caracteres'); return }
    setSavingPassword(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { soundError(); setError(error.message) }
    else { setNewPassword(''); setConfirmPassword(''); soundOk(); showSuccess('Contraseña actualizada') }
    setSavingPassword(false)
  }

  const handleDeleteAccount = async () => {
    setDeleting(true); setError('')
    const { error } = await supabase.rpc('delete_user')
    if (error) { soundError(); setError('Error: ' + error.message); setDeleting(false); setShowDeleteConfirm(false); return }
    await logout()
  }

  const formatDate = (ts) => new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  const formatTime = (ts) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  const formatNotifTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000), hours = Math.floor(mins / 60), days = Math.floor(hours / 24)
    if (days > 0) return `hace ${days}d`; if (hours > 0) return `hace ${hours}h`; if (mins > 0) return `hace ${mins}m`; return 'ahora'
  }

  // ✅ FIX: formatear puntos sin decimales basura
  const formatPts = (n) => {
    const rounded = Math.round(n * 10) / 10
    return Number.isInteger(rounded) ? rounded.toString() : rounded.toFixed(1)
  }

  const groupedHistory = history.reduce((groups, item) => {
    const date = formatDate(item.consumed_at)
    if (!groups[date]) groups[date] = []
    groups[date].push(item); return groups
  }, {})

  const getNotifStyle = (type) => {
    switch (type) {
      case 'powerup':  return { bg: 'rgba(239,68,68,0.1)',  color: '#ef4444', icon: '⚡' }
      case 'transfer': return { bg: 'rgba(16,185,129,0.1)', color: '#10b981', icon: '💸' }
      default:         return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', icon: '🔔' }
    }
  }

  const unlockedCount = unlockedIds.size
  const totalCount = ACHIEVEMENTS.length
  const achievementsByCategory = ACHIEVEMENTS.reduce((acc, a) => {
    if (!acc[a.category]) acc[a.category] = []
    acc[a.category].push(a); return acc
  }, {})

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const SECTIONS = [
    { id: 'profile',       label: '👤' },
    { id: 'history',       label: '🍺' },
    { id: 'achievements',  label: '🏅' },
    { id: 'notifications', label: '🔔', badge: unreadCount },
    { id: 'settings',      label: '⚙️' },
  ]

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-md mx-auto">

        <motion.div {...fadeIn} className="mb-6">
          <h1 className="text-2xl font-bold mb-4">
            {{ profile: 'Tu perfil 👤', history: 'Historial 🍺', achievements: 'Logros 🏅', notifications: 'Notificaciones 🔔', settings: 'Ajustes ⚙️' }[section]}
          </h1>
          <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
            {SECTIONS.map(s => (
              <button key={s.id}
                onClick={() => { setSection(s.id); setError(''); setSuccessMsg('') }}
                className="relative flex-1 py-2 rounded-lg text-sm font-medium transition-colors z-10 flex items-center justify-center gap-1"
                style={{ color: section === s.id ? '#fff' : 'var(--text-muted)' }}>
                {section === s.id && (
                  <motion.div layoutId="profile-tab" className="absolute inset-0 bg-amber-500 rounded-lg"
                    style={{ zIndex: -1 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
                )}
                <span>{s.label}</span>
                {s.badge > 0 && (
                  <span className="min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-white font-black"
                    style={{ backgroundColor: '#ef4444', fontSize: 9 }}>
                    {s.badge > 9 ? '9+' : s.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        <AnimatePresence>
          {error && <motion.p {...scaleIn} className="text-red-400 text-sm bg-red-950 rounded-xl px-4 py-3 mb-4">⚠️ {error}</motion.p>}
          {successMsg && <motion.p {...scaleIn} className="text-green-400 text-sm bg-green-950 rounded-xl px-4 py-3 mb-4">✓ {successMsg}</motion.p>}
        </AnimatePresence>

        {/* ── PERFIL ── */}
        {/* ── PERFIL ── */}
        {section === 'profile' && (
          <motion.div {...fadeIn} key="profile">

            {/* ── BANNER + AVATAR ── */}
            <div className="rounded-3xl overflow-hidden mb-4 relative"
              style={{ backgroundColor: 'var(--bg-card)' }}>
              {/* Portada */}
              <div className="h-24 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, #1a0a2e, #0f0a1f, #0a1020)' }}>
                {/* Estrellas */}
                {[
                  { top: '15%', left: '8%', size: 2 }, { top: '40%', left: '85%', size: 3 },
                  { top: '70%', left: '20%', size: 2 }, { top: '25%', left: '60%', size: 2 },
                  { top: '65%', left: '70%', size: 2 }, { top: '80%', left: '45%', size: 3 },
                ].map((s, i) => (
                  <motion.div key={i} className="absolute rounded-full bg-white"
                    style={{ top: s.top, left: s.left, width: s.size, height: s.size, opacity: 0.4 }}
                    animate={{ opacity: [0.2, 0.7, 0.2] }}
                    transition={{ duration: 2 + i * 0.5, repeat: Infinity, delay: i * 0.3 }} />
                ))}
                {/* Ranking badge */}
                {globalRank && (
                  <div className="absolute top-3 right-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: 'rgba(245,158,11,0.2)', border: '1px solid rgba(245,158,11,0.4)' }}>
                      <span className="text-xs">{globalRank <= 3 ? ['🥇','🥈','🥉'][globalRank-1] : '🏆'}</span>
                      <span className="text-xs font-black text-amber-400">#{globalRank} Global</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Avatar + info */}
              <div className="px-5 pb-5">
                <div className="flex items-end gap-4 -mt-10 mb-3">
                  <div className="relative flex-shrink-0">
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="Avatar"
                          className="w-20 h-20 rounded-2xl object-cover border-4"
                          style={{ borderColor: 'var(--bg-card)' }} />
                      : <div className="w-20 h-20 rounded-2xl border-4 flex items-center justify-center text-3xl"
                          style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--bg-card)' }}>🍺</div>}
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-xl flex items-center justify-center text-xs text-white"
                      style={{ backgroundColor: '#f59e0b' }}>
                      {uploadingAvatar ? '⏳' : '📷'}
                    </motion.button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
                  </div>
                  <div className="flex-1 min-w-0 pt-10">
                    <p className="text-lg font-black truncate" style={{ color: 'var(--text-primary)' }}>{profile?.username}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-hint)' }}>{user.email}</p>
                  </div>
                </div>

                {/* Stats rápidos */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                  {[
                    { label: 'Consumiciones', value: stats?.count || 0, color: '#f59e0b' },
                    { label: 'Puntos', value: stats ? formatPts(stats.total) : 0, color: '#f59e0b' },
                    { label: 'Seguidores', value: followersCount, color: '#818cf8' },
                    { label: 'Monedas', value: walletBalance?.toLocaleString() || 0, color: '#10b981' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-2 text-center"
                      style={{ backgroundColor: 'var(--bg-input)' }}>
                      <p className="text-sm font-black" style={{ color: s.color }}>{s.value}</p>
                      <p style={{ color: 'var(--text-hint)', fontSize: 9 }} className="font-medium mt-0.5 leading-tight">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Seguidores / siguiendo */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{followersCount}</span>
                    <span className="text-xs" style={{ color: 'var(--text-hint)' }}>seguidores</span>
                  </div>
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{followingCount}</span>
                    <span className="text-xs" style={{ color: 'var(--text-hint)' }}>siguiendo</span>
                  </div>
                  <div className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--border)' }} />
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-black text-amber-400">{unlockedCount}</span>
                    <span className="text-xs" style={{ color: 'var(--text-hint)' }}>logros</span>
                  </div>
                </div>
              </div>
            </div>

            {/* ── RANKING GLOBAL ── */}
            {globalRank && (
              <div className="rounded-2xl p-4 mb-4 relative overflow-hidden"
                style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.04))', border: '1px solid rgba(245,158,11,0.25)' }}>
                <motion.div className="absolute inset-0"
                  style={{ background: 'linear-gradient(90deg,transparent,rgba(245,158,11,0.05),transparent)' }}
                  animate={{ x: ['-100%', '200%'] }} transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 2 }} />
                <div className="relative flex items-center gap-4">
                  <motion.div className="text-5xl" animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                    {globalRank === 1 ? '🥇' : globalRank === 2 ? '🥈' : globalRank === 3 ? '🥉' : '🏆'}
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-xs font-black" style={{ color: 'rgba(245,158,11,0.7)' }}>RANKING GLOBAL</p>
                    <p className="text-3xl font-black text-amber-400">#{globalRank}</p>
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>de {totalGlobalPlayers} jugadores</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Puntos totales</p>
                    <p className="text-xl font-black text-amber-400">{globalPoints}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── STATS DE GUERRA ── */}
            {warStats && (warStats.wars_played > 0) && (
              <div className="rounded-2xl overflow-hidden mb-4"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <div className="px-4 py-2.5 border-b flex items-center gap-2"
                  style={{ borderColor: 'rgba(220,38,38,0.15)', backgroundColor: 'rgba(220,38,38,0.06)' }}>
                  <span className="text-sm">⚔️</span>
                  <p className="text-xs font-black text-red-400">HISTORIAL DE GUERRA</p>
                </div>
                <div className="grid grid-cols-3 gap-0 divide-x"
                  style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {[
                    { label: 'Guerras', value: warStats.wars_played, color: 'var(--text-primary)' },
                    { label: 'Victorias', value: warStats.wars_won, color: '#10b981' },
                    { label: 'Batallas', value: warStats.battles_won, color: '#f59e0b' },
                  ].map((s, i) => (
                    <div key={i} className="py-3 text-center" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                      <p className="text-xl font-black" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{s.label}</p>
                    </div>
                  ))}
                </div>
                {warStats.wars_played > 0 && (
                  <div className="px-4 py-2.5 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs" style={{ color: 'var(--text-hint)' }}>Ratio de victorias</span>
                      <span className="text-xs font-black text-red-400">
                        {Math.round((warStats.wars_won / warStats.wars_played) * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                      <motion.div className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #7f1d1d, #ef4444)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(warStats.wars_won / warStats.wars_played) * 100}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── MEDALLAS RECIENTES ── */}
            {unlockedCount > 0 && (
              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-bold">🏅 Logros</p>
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => setSection('achievements')}
                    className="text-xs font-bold text-amber-400">Ver todos →</motion.button>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{unlockedCount} de {totalCount} desbloqueados</p>
                  <p className="text-xs font-bold text-amber-400">{Math.round((unlockedCount/totalCount)*100)}%</p>
                </div>
                <div className="w-full h-1.5 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'var(--bg-input)' }}>
                  <motion.div className="h-full rounded-full bg-amber-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
                    transition={{ duration: 0.8 }} />
                </div>
                {/* Últimas medallas desbloqueadas */}
                <div className="flex flex-wrap gap-2">
                  {ACHIEVEMENTS.filter(a => unlockedIds.has(a.id)).slice(-8).map(a => (
                    <div key={a.id} title={a.name}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                      {a.emoji}
                    </div>
                  ))}
                  {unlockedCount < totalCount && (
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black"
                      style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' }}>
                      +{totalCount - unlockedCount}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── BEBIDA FAVORITA ── */}
            {stats && Object.keys(stats.byType).length > 0 && (
              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                <p className="text-sm font-bold mb-3">🍺 Desglose por bebida</p>
                <div className="space-y-2">
                  {Object.entries(stats.byType).sort(([, a], [, b]) => b.count - a.count).map(([name, { count, emoji }]) => (
                    <div key={name} className="flex items-center gap-3">
                      <span className="text-xl w-7 flex-shrink-0">{emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-muted)' }}>{name}</span>
                          <span className="text-xs font-black text-amber-400 flex-shrink-0 ml-2">{count}</span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                          <motion.div className="h-full rounded-full bg-amber-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.round((count / stats.count) * 100)}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── ACCESOS RÁPIDOS ── */}
            <div className="grid grid-cols-2 gap-3">
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSection('history')}
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ backgroundColor: 'var(--bg-card)' }}>
                <span className="text-2xl">🍺</span>
                <div className="text-left">
                  <p className="text-sm font-bold">Historial</p>
                  <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{stats?.count || 0} consumiciones</p>
                </div>
              </motion.button>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSection('achievements')}
                className="rounded-2xl p-4 flex items-center gap-3"
                style={{ backgroundColor: 'var(--bg-card)' }}>
                <span className="text-2xl">🏅</span>
                <div className="text-left">
                  <p className="text-sm font-bold">Logros</p>
                  <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{unlockedCount}/{totalCount} obtenidos</p>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}
        {section === 'history' && (
          <motion.div {...fadeIn} key="history">
            {stats && (
              <div className="grid grid-cols-3 gap-2 mb-5">
                {[
                  { label: 'Total', value: stats.count },
                  { label: 'Puntos', value: formatPts(stats.total) },
                  { label: 'Media pts', value: stats.count > 0 ? formatPts(stats.total / stats.count) : '0' },
                ].map(s => (
                  <div key={s.label} className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <p className="text-xl font-bold text-amber-400">{s.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{s.label}</p>
                  </div>
                ))}
              </div>
            )}
            {history.length === 0 && !loadingHistory ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <div className="text-5xl mb-3">🍺</div>
                <p>Aún no has anotado ninguna consumición</p>
              </div>
            ) : (
              <>
                {Object.entries(groupedHistory).map(([date, items]) => (
                  <div key={date} className="mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                      <span className="text-xs font-semibold px-3 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>{date}</span>
                      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                    </div>
                    <div className="space-y-2">
                      {items.map(item => (
                        <motion.div key={item.drink_group_id} variants={staggerItem} initial="initial" animate="animate"
                          className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0" style={{ backgroundColor: 'var(--bg-input)' }}>
                            {item.drink_type?.emoji || '🍺'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm">{item.drink_type?.name || 'Bebida'}</p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className="text-xs" style={{ color: 'var(--text-hint)' }}>🕐 {formatTime(item.consumed_at)}</span>
                              {item.leagues.slice(0, 2).map(l => (
                                <span key={l} className="text-xs px-2 py-0.5 rounded-full"
                                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' }}>{l}</span>
                              ))}
                              {item.leagues.length > 2 && <span className="text-xs" style={{ color: 'var(--text-hint)' }}>+{item.leagues.length - 2}</span>}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold text-sm ${item.points > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                              {item.points > 0 ? '+' : ''}{formatPts(item.points)} pts
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-hint)' }}>+{Math.floor(item.points * 10)}🪙</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
                {historyHasMore && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => fetchHistory(historyPage + 1)} disabled={loadingHistory}
                    className="w-full py-3 rounded-2xl text-sm font-medium mt-2"
                    style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                    {loadingHistory ? 'Cargando...' : 'Cargar más →'}
                  </motion.button>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── LOGROS ── */}
        {section === 'achievements' && (
          <motion.div {...fadeIn} key="achievements">
            <AnimatePresence>
              {newlyUnlocked.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-2xl p-4 mb-5"
                  style={{ backgroundColor: 'rgba(245,158,11,0.12)', border: '2px solid #f59e0b' }}>
                  <p className="font-bold text-amber-400 text-sm mb-2">🎉 ¡Logros desbloqueados!</p>
                  <div className="flex flex-wrap gap-2">
                    {newlyUnlocked.map(id => {
                      const a = ACHIEVEMENTS.find(a => a.id === id)
                      return a ? (
                        <motion.div key={id} initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-bold"
                          style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                          <span>{a.emoji}</span><span>{a.name}</span>
                        </motion.div>
                      ) : null
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="rounded-2xl p-4 mb-5" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-sm">Progreso total</p>
                <p className="font-bold text-amber-400">{unlockedCount}/{totalCount}</p>
              </div>
              <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                <motion.div className="h-full rounded-full bg-amber-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${(unlockedCount / totalCount) * 100}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }} />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>{totalCount - unlockedCount} logros restantes</p>
            </div>

            {loadingAchievements ? (
              <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-3xl mb-2">🏅</motion.div>
                <p className="text-sm">Comprobando logros...</p>
              </div>
            ) : (
              Object.entries(achievementsByCategory).map(([category, items]) => (
                <div key={category} className="mb-5">
                  <p className="text-sm font-bold mb-3">
                    {category === 'consumiciones' ? '🍺 Consumiciones' : category === 'casino' ? '🎰 Casino & Dinero' : '⚡ Social & Powerups'}
                    <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-hint)' }}>
                      {items.filter(a => unlockedIds.has(a.id)).length}/{items.length}
                    </span>
                  </p>
                  <div className="space-y-2">
                    {items.map(achievement => {
                      const unlocked = unlockedIds.has(achievement.id)
                      const isNew = newlyUnlocked.includes(achievement.id)
                      return (
                        <motion.div key={achievement.id} variants={staggerItem} initial="initial" animate="animate"
                          className="rounded-2xl p-4 flex items-center gap-3"
                          style={{
                            backgroundColor: 'var(--bg-card)',
                            border: isNew ? '2px solid #f59e0b' : unlocked ? '2px solid rgba(245,158,11,0.3)' : '2px solid transparent',
                            opacity: unlocked ? 1 : 0.5,
                          }}>
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0"
                            style={{ backgroundColor: unlocked ? 'rgba(245,158,11,0.12)' : 'var(--bg-input)', filter: unlocked ? 'none' : 'grayscale(100%)' }}>
                            {achievement.emoji}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{achievement.name}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{achievement.desc}</p>
                          </div>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: unlocked ? 'rgba(245,158,11,0.2)' : 'var(--bg-input)' }}>
                            <span className="text-xs" style={{ color: unlocked ? '#f59e0b' : 'var(--text-hint)' }}>{unlocked ? '✓' : '🔒'}</span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}

            <motion.button whileTap={{ scale: 0.97 }} onClick={fetchAndCheckAchievements} disabled={loadingAchievements}
              className="w-full py-3 rounded-2xl text-sm font-medium mt-2"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
              🔄 Comprobar nuevos logros
            </motion.button>
          </motion.div>
        )}

        {/* ── NOTIFICACIONES ── */}
        {section === 'notifications' && (
          <motion.div {...fadeIn} key="notifications">
            {notifications.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <div className="text-5xl mb-3">🔔</div>
                <p>Sin notificaciones todavía</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map(notif => {
                  const style = getNotifStyle(notif.type)
                  return (
                    <motion.div key={notif.id} variants={staggerItem} initial="initial" animate="animate"
                      onClick={() => !notif.read && markRead(notif.id)}
                      className="rounded-2xl p-4 flex items-start gap-3 cursor-pointer"
                      style={{
                        backgroundColor: notif.read ? 'var(--bg-card)' : style.bg,
                        border: notif.read ? '1px solid transparent' : `1px solid ${style.color}30`,
                        opacity: notif.read ? 0.7 : 1,
                      }}>
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0" style={{ backgroundColor: style.bg }}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm truncate">{notif.title}</p>
                          {!notif.read && <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: style.color }} />}
                        </div>
                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{notif.body}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>{formatNotifTime(notif.created_at)}</p>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

        {/* ── AJUSTES ── */}
        {section === 'settings' && (
          <motion.div {...fadeIn} key="settings" className="space-y-4">
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h2 className="text-base font-bold mb-4">✏️ Cambiar nombre de usuario</h2>
              <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)}
                placeholder="Nuevo nombre de usuario"
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm mb-3"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleChangeUsername}
                disabled={savingUsername || !newUsername.trim() || newUsername === profile?.username}
                className="w-full bg-amber-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm">
                {savingUsername ? 'Guardando...' : 'Guardar nombre'}
              </motion.button>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h2 className="text-base font-bold mb-4">🔒 Cambiar contraseña</h2>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña"
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm mb-3"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repetir contraseña"
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm mb-3"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="w-full bg-amber-500 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl text-sm">
                {savingPassword ? 'Guardando...' : 'Cambiar contraseña'}
              </motion.button>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h2 className="text-base font-bold mb-4">🎨 Apariencia</h2>
              <div className="grid grid-cols-3 gap-2">
                {[{ id: 'dark', label: 'Oscuro', emoji: '🌙' }, { id: 'light', label: 'Claro', emoji: '☀️' }, { id: 'system', label: 'Sistema', emoji: '⚙️' }].map(t => (
                  <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setTheme(t.id)}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl text-sm font-medium border-2"
                    style={{ borderColor: theme === t.id ? '#f59e0b' : 'var(--border)', backgroundColor: theme === t.id ? 'rgba(245,158,11,0.1)' : 'var(--bg-input)', color: theme === t.id ? '#f59e0b' : 'var(--text-muted)' }}>
                    <span className="text-2xl">{t.emoji}</span>
                    <span>{t.label}</span>
                    {theme === t.id && <motion.div layoutId="theme-check" className="w-2 h-2 rounded-full bg-amber-400" />}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-5 border border-red-900" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h2 className="text-base font-bold text-red-400 mb-1">⚠️ Zona peligrosa</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-hint)' }}>Esta acción es irreversible.</p>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-transparent text-red-500 font-semibold py-3 rounded-xl border border-red-900 text-sm">
                Eliminar cuenta 🗑️
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteConfirm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🗑️</div>
                <h2 className="text-xl font-bold">¿Eliminar cuenta?</h2>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Se borrarán todos tus datos de forma permanente.</p>
              </div>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                  className="flex-1 font-semibold py-3 rounded-xl"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Cancelar</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleDeleteAccount} disabled={deleting}
                  className="flex-1 bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl">
                  {deleting ? 'Eliminando...' : 'Eliminar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}