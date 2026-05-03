import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { staggerItem } from '../lib/animations'
import { soundSuccess, soundError } from '../lib/sounds'

const BATTLE_TYPES = {
  drink_count:    { emoji: '🍺', label: 'Consumiciones totales', desc: 'Sumar X consumiciones entre todo el equipo' },
  unique_members: { emoji: '👥', label: 'Miembros activos',      desc: 'X miembros distintos deben beber' },
  total_points:   { emoji: '⭐', label: 'Puntos totales',        desc: 'Sumar X puntos entre todo el equipo' },
  night_drinks:   { emoji: '🌙', label: 'Consumiciones nocturnas', desc: 'X consumiciones entre las 22h y las 4h' },
}

function Confetti() {
  const pieces = Array.from({ length: 28 }, (_, i) => ({
    x: Math.random() * 100, delay: Math.random() * 0.6,
    color: ['#ef4444','#f59e0b','#6366f1','#10b981','#ec4899','#fff'][i % 6],
    size: 6 + Math.random() * 8,
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.div key={i} className="absolute rounded-sm"
          style={{ left: `${p.x}%`, top: -10, width: p.size, height: p.size, backgroundColor: p.color }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2, delay: p.delay, ease: 'easeIn' }} />
      ))}
    </div>
  )
}

function WarResult({ war, myLeagueId, onDismiss }) {
  const isChallenger = myLeagueId === war.challenger_league_id
  const myWins = isChallenger ? war.challenger_war_points : war.defender_war_points
  const enemyWins = isChallenger ? war.defender_war_points : war.challenger_war_points
  const myName = isChallenger ? war.challenger?.name : war.defender?.name
  const enemyName = isChallenger ? war.defender?.name : war.challenger?.name
  const won = myWins > enemyWins
  const draw = myWins === enemyWins

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 pb-24"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {won && <Confetti />}
      <motion.div initial={{ opacity: 0, scale: 0.8, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="w-full max-w-sm">
        <div className="text-center mb-8">
          <motion.div className="text-7xl mb-4"
            animate={won ? { rotate: [0, -10, 10, -10, 0], scale: [1, 1.1, 1] } : { scale: [1, 0.95, 1] }}
            transition={{ duration: 0.6, delay: 0.3 }}>
            {won ? '🏆' : draw ? '🤝' : '💀'}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
            className="text-3xl font-black mb-2"
            style={{ color: won ? '#f59e0b' : draw ? '#6366f1' : '#ef4444' }}>
            {won ? '¡Victoria!' : draw ? '¡Empate!' : 'Derrota'}
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {won ? `${myName} ha ganado la guerra` : draw ? 'Ninguna liga ganó' : `${enemyName} ha ganado la guerra`}
          </motion.p>
        </div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          className="rounded-2xl p-5 mb-4"
          style={{
            background: won ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.05))'
              : draw ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.05))'
              : 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.05))',
            border: `2px solid ${won ? 'rgba(245,158,11,0.5)' : draw ? 'rgba(99,102,241,0.4)' : 'rgba(239,68,68,0.3)'}`,
          }}>
          <p className="text-xs font-bold text-center mb-4" style={{ color: 'var(--text-muted)' }}>RESULTADO FINAL</p>
          <div className="flex items-center justify-between">
            <div className="flex-1 text-center">
              <p className="font-black text-sm mb-1 truncate">{myName}</p>
              <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: 'spring' }}
                className="text-5xl font-black" style={{ color: won ? '#f59e0b' : draw ? '#818cf8' : 'var(--text-primary)' }}>
                {myWins}
              </motion.p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>batallas ganadas</p>
              {won && <p className="text-xs mt-1 text-amber-400 font-bold">👑 GANADOR</p>}
            </div>
            <div className="text-2xl font-black mx-4 flex-shrink-0" style={{ color: 'var(--text-hint)' }}>VS</div>
            <div className="flex-1 text-center">
              <p className="font-black text-sm mb-1 truncate">{enemyName}</p>
              <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8, type: 'spring' }}
                className="text-5xl font-black" style={{ color: !won && !draw ? '#ef4444' : 'var(--text-muted)' }}>
                {enemyWins}
              </motion.p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>batallas ganadas</p>
              {!won && !draw && <p className="text-xs mt-1 text-red-400 font-bold">👑 GANADOR</p>}
            </div>
          </div>
        </motion.div>

        {won && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
            className="rounded-2xl p-4 mb-4 text-center"
            style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
            <p className="text-sm font-bold text-amber-400">🎁 Premio de victoria</p>
            <p className="text-2xl font-black text-amber-400 mt-1">+{(war.reward_coins || 1000).toLocaleString()}🪙</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Para cada miembro del equipo ganador</p>
          </motion.div>
        )}

        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
          whileTap={{ scale: 0.97 }} onClick={onDismiss}
          className="w-full py-4 rounded-2xl font-bold text-white"
          style={{ backgroundColor: won ? '#f59e0b' : '#dc2626' }}>
          ⚔️ Nueva guerra
        </motion.button>
      </motion.div>
    </div>
  )
}

export default function ClanWar() {
  const { user } = useAuth()
  const [tab, setTab] = useState('war')
  const [myLeagues, setMyLeagues] = useState([])
  const [myRole, setMyRole] = useState({})
  const [activeWar, setActiveWar] = useState(null)
  const [finishedWar, setFinishedWar] = useState(null)
  const [battles, setBattles] = useState([])
  const [participants, setParticipants] = useState([])
  const [myParticipation, setMyParticipation] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState(null)
  const [allLeagues, setAllLeagues] = useState([])
  const [showConfetti, setShowConfetti] = useState(false)

  // Declarar guerra
  const [selectedChallenger, setSelectedChallenger] = useState(null)
  const [selectedDefender, setSelectedDefender] = useState(null)
  const [warDuration, setWarDuration] = useState(3)
  const [warReward, setWarReward] = useState(1000)
  const [battleConfigs, setBattleConfigs] = useState([
    { type: 'drink_count', challengerTarget: 50, defenderTarget: 50, description: '' },
    { type: 'unique_members', challengerTarget: 5, defenderTarget: 5, description: '' },
    { type: 'night_drinks', challengerTarget: 10, defenderTarget: 10, description: '' },
  ])
  const [challenging, setChallenging] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Roles
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [assigningRole, setAssigningRole] = useState(false)
  const [selectedMemberForRole, setSelectedMemberForRole] = useState(null)

  // Espía
  const [enemyProgress, setEnemyProgress] = useState(null)

  useEffect(() => { fetchData() }, [])

  const showMsg = (success, text) => { setMsg({ success, text }); setTimeout(() => setMsg(null), 4000) }

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data: leagueData } = await supabase
      .from('league_members').select('league_id, role, leagues(id, name)').eq('user_id', user.id)
    const leagues = leagueData?.map(d => ({ ...d.leagues, myRole: d.role })) || []
    setMyLeagues(leagues)
    const roles = {}; leagues.forEach(l => { roles[l.id] = l.myRole }); setMyRole(roles)
    const leagueIds = leagues.map(l => l.id)

    if (leagueIds.length > 0) {
      await supabase.rpc('update_war_battle_progress')

      const { data: warData } = await supabase
        .from('clan_wars').select(`*, challenger:leagues!clan_wars_challenger_league_id_fkey(id,name), defender:leagues!clan_wars_defender_league_id_fkey(id,name)`)
        .in('status', ['pending', 'active'])
        .or(leagueIds.map(id => `challenger_league_id.eq.${id},defender_league_id.eq.${id}`).join(','))
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()
      const { data: finishedData } = await supabase
        .from('clan_wars').select(`*, challenger:leagues!clan_wars_challenger_league_id_fkey(id,name), defender:leagues!clan_wars_defender_league_id_fkey(id,name)`)
        .eq('status', 'finished')
        .or(leagueIds.map(id => `challenger_league_id.eq.${id},defender_league_id.eq.${id}`).join(','))
        .gte('ends_at', since48h)
        .order('ends_at', { ascending: false }).limit(1).maybeSingle()

      const seenWarId = localStorage.getItem('beer_league_seen_war')
      setFinishedWar(finishedData && String(finishedData.id) !== seenWarId ? finishedData : null)

      if (warData) {
        if (warData.status === 'active' && warData.ends_at && new Date(warData.ends_at) < new Date()) {
          await supabase.rpc('resolve_clan_war', { p_war_id: warData.id })
          setActiveWar(null)
          const { data: newFinished } = await supabase
            .from('clan_wars').select(`*, challenger:leagues!clan_wars_challenger_league_id_fkey(id,name), defender:leagues!clan_wars_defender_league_id_fkey(id,name)`)
            .eq('id', warData.id).single()
          setFinishedWar(newFinished)
        } else {
          setActiveWar(warData)

          const { data: battlesData } = await supabase
            .from('clan_war_battles').select('*').eq('war_id', warData.id).order('day')
          setBattles(battlesData || [])

          const { data: parts } = await supabase
            .from('clan_war_participants').select('*, profiles(id, username, avatar_url)')
            .eq('war_id', warData.id)
          setParticipants(parts || [])

          // FIX: determinar la liga del usuario correctamente
          // Si el usuario está en la liga challenger → es challenger
          // Si no → es defender
          const myLeagueInWar = leagueIds.includes(warData.challenger_league_id)
            ? warData.challenger_league_id
            : warData.defender_league_id

          const myPart = parts?.find(p => p.user_id === user.id && p.league_id === myLeagueInWar)
          setMyParticipation(myPart || null)

          if (myPart?.role === 'spy') {
            const myLeagueId = myPart.league_id
            const enemyLeagueId = myLeagueId === warData.challenger_league_id
              ? warData.defender_league_id : warData.challenger_league_id
            const today = getCurrentDay(warData)
            const todayBattle = battlesData?.find(b => b.day === today)
            if (todayBattle) {
              setEnemyProgress({
                current: myLeagueId === warData.challenger_league_id
                  ? todayBattle.defender_current : todayBattle.challenger_current,
                target: myLeagueId === warData.challenger_league_id
                  ? todayBattle.defender_target : todayBattle.challenger_target,
              })
            }
          } else {
            setEnemyProgress(null)
          }
        }
      } else {
        setActiveWar(null); setBattles([]); setParticipants([]); setMyParticipation(null); setEnemyProgress(null)
      }
    }

    const { data: allL } = await supabase.from('leagues').select('id, name').order('name')
    setAllLeagues(allL || [])
    setLoading(false); setRefreshing(false)
  }

  const getCurrentDay = (war) => {
    if (!war?.started_at) return 1
    const elapsed = (Date.now() - new Date(war.started_at).getTime()) / 86400000
    return Math.min(war.duration_days || 3, Math.max(1, Math.ceil(elapsed)))
  }

  const handleChallenge = async () => {
    if (!selectedChallenger || !selectedDefender) return
    setChallenging(true)

    const { data: captainId } = await supabase.rpc('get_war_captain', { p_league_id: selectedChallenger.id })

    const { data: war, error } = await supabase.from('clan_wars').insert({
      challenger_league_id: selectedChallenger.id,
      defender_league_id: selectedDefender.id,
      duration_days: warDuration,
      reward_coins: warReward,
      captain_challenger_id: captainId,
    }).select().single()

    if (error || !war) { soundError(); showMsg(false, 'Error al declarar la guerra'); setChallenging(false); return }

    const battlesToInsert = battleConfigs.slice(0, warDuration).map((bc, i) => ({
      war_id: war.id,
      day: i + 1,
      battle_type: bc.type,
      challenger_target: bc.challengerTarget,
      defender_target: bc.defenderTarget,
      description: bc.description || BATTLE_TYPES[bc.type]?.label,
    }))
    await supabase.from('clan_war_battles').insert(battlesToInsert)

    soundSuccess()
    showMsg(true, `⚔️ ¡Guerra declarada a ${selectedDefender.name}! Esperando aceptación...`)
    setSelectedChallenger(null); setSelectedDefender(null)
    setTab('war'); fetchData()
    setChallenging(false)
  }

  const handleAcceptWar = async () => {
    if (!activeWar) return
    setAccepting(true)

    const captainDefender = await supabase.rpc('get_war_captain', { p_league_id: activeWar.defender_league_id })

    await supabase.from('clan_wars').update({
      status: 'active',
      started_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + (activeWar.duration_days || 3) * 24 * 60 * 60 * 1000).toISOString(),
      captain_defender_id: captainDefender.data,
    }).eq('id', activeWar.id)

    const [{ data: challengerMembers }, { data: defenderMembers }] = await Promise.all([
      supabase.from('league_members').select('user_id').eq('league_id', activeWar.challenger_league_id),
      supabase.from('league_members').select('user_id').eq('league_id', activeWar.defender_league_id),
    ])

    const allParticipants = [
      ...(challengerMembers || []).map(m => ({
        war_id: activeWar.id, user_id: m.user_id, league_id: activeWar.challenger_league_id,
        role: null, is_captain: m.user_id === activeWar.captain_challenger_id,
      })),
      ...(defenderMembers || []).map(m => ({
        war_id: activeWar.id, user_id: m.user_id, league_id: activeWar.defender_league_id,
        role: null, is_captain: m.user_id === captainDefender.data,
      })),
    ]
    await supabase.from('clan_war_participants').upsert(allParticipants, { onConflict: 'war_id,user_id' })

    soundSuccess(); showMsg(true, '⚔️ ¡Guerra iniciada! El capitán debe asignar roles.')
    setAccepting(false); fetchData()
  }

  const handleAssignRole = async (userId, role) => {
    if (!activeWar) return
    setAssigningRole(true)
    await supabase.from('clan_war_participants')
      .update({ role })
      .eq('war_id', activeWar.id)
      .eq('user_id', userId)
      .eq('league_id', myLeagueId)
    soundSuccess()
    setSelectedMemberForRole(null)
    fetchData(true)
    setAssigningRole(false)
  }

  const handleCancelWar = async () => {
    if (!activeWar) return
    setCancelling(true)
    const { error } = await supabase.from('clan_wars').update({ status: 'cancelled' }).eq('id', activeWar.id).eq('status', 'pending')
    if (error) { soundError(); showMsg(false, 'Error al cancelar') }
    else { soundSuccess(); showMsg(true, '✅ Guerra cancelada'); setActiveWar(null); fetchData() }
    setCancelling(false); setShowCancelConfirm(false)
  }

  const updateBattleConfig = (index, field, value) => {
    setBattleConfigs(prev => prev.map((bc, i) => i === index ? { ...bc, [field]: value } : bc))
  }

  const formatTimeLeft = (endsAt) => {
    if (!endsAt) return '—'
    const diff = new Date(endsAt) - new Date()
    if (diff <= 0) return 'Terminada'
    const h = Math.floor(diff / 3600000), d = Math.floor(h / 24)
    return d > 0 ? `${d}d ${h % 24}h` : `${h}h`
  }

  const myLeagueId = myParticipation?.league_id
  const isChallenger = myLeagueId === activeWar?.challenger_league_id
  const myLeagueName = isChallenger ? activeWar?.challenger?.name : activeWar?.defender?.name
  const enemyLeagueName = isChallenger ? activeWar?.defender?.name : activeWar?.challenger?.name
  const enemyLeagueId = isChallenger ? activeWar?.defender_league_id : activeWar?.challenger_league_id
  const today = activeWar ? getCurrentDay(activeWar) : 1
  const todayBattle = battles.find(b => b.day === today)
  const myLeagueIdForResult = myLeagues.find(l => l.id === finishedWar?.challenger_league_id)?.id ||
    myLeagues.find(l => l.id === finishedWar?.defender_league_id)?.id

  // Separar participantes por equipo usando league_id explícitamente
  const myTeam = participants.filter(p => p.league_id === myLeagueId)
  const enemyTeam = participants.filter(p => p.league_id === enemyLeagueId)

  const iAmCaptain = myParticipation?.is_captain === true
  const isDefenderAdmin = myRole[activeWar?.defender_league_id] === 'owner' || myRole[activeWar?.defender_league_id] === 'admin'
  const isChallengerAdmin = myRole[activeWar?.challenger_league_id] === 'owner' || myRole[activeWar?.challenger_league_id] === 'admin'
  const canManageLeagues = myLeagues.some(l => myRole[l.id] === 'owner' || myRole[l.id] === 'admin')
  const mySpy = myTeam.find(p => p.role === 'spy')
  const mySaboteur = myTeam.find(p => p.role === 'saboteur')

  const getTodayProgress = (battle) => {
    if (!battle) return { myPct: 0, myCurrent: 0, myTarget: 0 }
    const myCurrent = isChallenger ? battle.challenger_current : battle.defender_current
    const myTarget = isChallenger ? battle.challenger_target : battle.defender_target
    const myPct = Math.min(100, Math.round((myCurrent / myTarget) * 100))
    return { myPct, myCurrent, myTarget }
  }

  const Avatar = ({ url, username, size = 'sm' }) => {
    const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
    return url
      ? <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
      : <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 text-sm`} style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
  }

  const TeamSection = ({ team, leagueName, isMyTeam }) => {
    const color = isMyTeam ? '#ef4444' : '#6366f1'
    const bgColor = isMyTeam ? 'rgba(239,68,68,0.08)' : 'rgba(99,102,241,0.08)'
    const borderColor = isMyTeam ? 'rgba(239,68,68,0.25)' : 'rgba(99,102,241,0.25)'

    return (
      <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: bgColor, border: `1px solid ${borderColor}` }}>
        <div className="px-3 py-2.5 flex items-center gap-2 border-b" style={{ borderColor }}>
          <span className="text-sm">{isMyTeam ? '⚔️' : '🛡️'}</span>
          <p className="text-xs font-black" style={{ color }}>{leagueName}</p>
          {isMyTeam && iAmCaptain && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold ml-auto"
              style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
              👑 Tu equipo
            </span>
          )}
          {isMyTeam && !iAmCaptain && (
            <span className="text-xs px-1.5 py-0.5 rounded-full font-bold ml-auto"
              style={{ backgroundColor: `${color}20`, color }}>
              Tu equipo
            </span>
          )}
        </div>
        <div className="divide-y" style={{ borderColor }}>
          {team.filter(p => p.profiles).map(p => {
            const isMe = p.user_id === user.id
            const roleEmoji = p.role === 'spy' ? '🕵️' : p.role === 'saboteur' ? '💣' : '⚔️'
            const roleLabel = p.role === 'spy' ? 'Espía' : p.role === 'saboteur' ? 'Saboteador' : 'Combatiente'
            const roleColor = p.role === 'spy' ? '#f59e0b' : p.role === 'saboteur' ? '#ef4444' : color
            return (
              <div key={p.id} className="px-3 py-2.5 flex items-center gap-2.5">
                <Avatar url={p.profiles?.avatar_url} username={p.profiles?.username} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className="text-sm font-bold truncate">{p.profiles?.username} {isMe && '(tú)'}</p>
                    {p.is_captain && <span className="text-xs text-amber-400">👑</span>}
                  </div>
                  <span className="text-xs" style={{ color: roleColor }}>{roleEmoji} {roleLabel}</span>
                </div>
                {isMyTeam && iAmCaptain && !isMe && (
                  <motion.button whileTap={{ scale: 0.9 }}
                    onClick={() => setSelectedMemberForRole(p)}
                    className="text-xs px-2.5 py-1.5 rounded-xl font-bold flex-shrink-0"
                    style={{ backgroundColor: 'rgba(220,38,38,0.1)', color: '#ef4444' }}>
                    Rol
                  </motion.button>
                )}
              </div>
            )
          })}
          {team.length === 0 && (
            <div className="px-3 py-4 text-center">
              <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Sin participantes</p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-4xl">⚔️</motion.div>
    </div>
  )

  if (finishedWar && !activeWar && tab === 'war' && myLeagueIdForResult) {
    return (
      <WarResult war={finishedWar} myLeagueId={myLeagueIdForResult}
        onDismiss={() => { localStorage.setItem('beer_league_seen_war', String(finishedWar.id)); setFinishedWar(null) }} />
    )
  }

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold">⚔️ Guerra de Clanes</h1>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => fetchData(true)} disabled={refreshing}
            className="p-2 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
            <motion.span animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }} className="block text-sm">🔄</motion.span>
          </motion.button>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Batallas colectivas · Roles estratégicos</p>
        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
          {[{ id: 'war', label: '⚔️ Guerra' }, { id: 'challenge', label: '🏴 Declarar' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-sm font-medium transition-colors z-10"
              style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {tab === t.id && <motion.div layoutId="war-tab" className="absolute inset-0 rounded-lg"
                style={{ zIndex: -1, backgroundColor: '#dc2626' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mt-4 rounded-2xl p-4 text-center"
            style={{ backgroundColor: msg.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${msg.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}` }}>
            <p className={`font-bold text-sm ${msg.success ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GUERRA ── */}
      {tab === 'war' && (
        <div className="px-4 pt-4 max-w-md mx-auto">
          {!activeWar ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <motion.div className="text-6xl mb-4" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>⚔️</motion.div>
              <p className="font-bold text-lg">Sin guerra activa</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-hint)' }}>Declara una guerra desde la pestaña 🏴</p>
              {canManageLeagues && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setTab('challenge')}
                  className="mt-6 px-6 py-3 rounded-2xl font-bold text-white" style={{ backgroundColor: '#dc2626' }}>
                  🏴 Declarar guerra
                </motion.button>
              )}
            </div>
          ) : (
            <>
              {activeWar.status === 'pending' && (
                <div className="rounded-2xl p-4 mb-4 text-center"
                  style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                  <p className="text-sm font-bold text-amber-400 mb-1">⏳ Guerra pendiente de aceptación</p>
                  <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                    {activeWar.challenger?.name} ha declarado la guerra a {activeWar.defender?.name}
                  </p>
                </div>
              )}

              {/* Marcador */}
              <div className="rounded-2xl p-4 mb-4" style={{
                background: 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))',
                border: '1px solid rgba(220,38,38,0.3)',
              }}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${activeWar.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {activeWar.status === 'pending' ? '⏳ Pendiente' : `⚔️ Día ${today}/${activeWar.duration_days || 3}`}
                  </span>
                  {activeWar.status === 'active' && (
                    <span className="text-xs font-bold text-red-400">{formatTimeLeft(activeWar.ends_at)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm truncate mb-2">{activeWar.challenger?.name}</p>
                    {activeWar.status === 'active' && (
                      <>
                        <p className="text-4xl font-black text-red-400">{activeWar.challenger_war_points || 0}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>batallas ganadas</p>
                      </>
                    )}
                  </div>
                  <div className="text-2xl font-black mx-4" style={{ color: 'var(--text-hint)' }}>VS</div>
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm truncate mb-2">{activeWar.defender?.name}</p>
                    {activeWar.status === 'active' && (
                      <>
                        <p className="text-4xl font-black text-indigo-400">{activeWar.defender_war_points || 0}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>batallas ganadas</p>
                      </>
                    )}
                  </div>
                </div>
                {activeWar.status === 'active' && (
                  <div className="mt-3">
                    <div className="w-full h-2.5 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--bg-input)' }}>
                      {(() => {
                        const total = (activeWar.challenger_war_points || 0) + (activeWar.defender_war_points || 0)
                        if (total === 0) return <div className="h-full w-full" style={{ backgroundColor: 'var(--bg-input)' }} />
                        return <>
                          <motion.div className="h-full bg-red-500"
                            animate={{ width: `${((activeWar.challenger_war_points || 0) / total) * 100}%` }}
                            transition={{ duration: 0.8, type: 'spring' }} />
                          <motion.div className="h-full bg-indigo-500"
                            animate={{ width: `${((activeWar.defender_war_points || 0) / total) * 100}%` }}
                            transition={{ duration: 0.8, type: 'spring' }} />
                        </>
                      })()}
                    </div>
                  </div>
                )}
              </div>

              {/* Botones pendiente */}
              {activeWar.status === 'pending' && isDefenderAdmin && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleAcceptWar} disabled={accepting}
                  className="w-full py-4 rounded-2xl font-bold text-white mb-3" style={{ backgroundColor: '#dc2626' }}>
                  {accepting ? 'Iniciando guerra...' : '⚔️ Aceptar la guerra'}
                </motion.button>
              )}
              {activeWar.status === 'pending' && isChallengerAdmin && !isDefenderAdmin && (
                <div className="mb-4">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowCancelConfirm(true)}
                    className="w-full py-3 rounded-2xl font-bold text-sm border"
                    style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                    🚫 Cancelar declaración
                  </motion.button>
                </div>
              )}

              {/* Batalla del día */}
              {activeWar.status === 'active' && todayBattle && (
                <div className="mb-4">
                  <p className="text-sm font-bold mb-2">🎯 Batalla de hoy — Día {today}</p>
                  <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(220,38,38,0.2)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xl">{BATTLE_TYPES[todayBattle.battle_type]?.emoji}</span>
                      <div>
                        <p className="font-bold text-sm">{todayBattle.description || BATTLE_TYPES[todayBattle.battle_type]?.label}</p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{BATTLE_TYPES[todayBattle.battle_type]?.desc}</p>
                      </div>
                    </div>
                    {(() => {
                      const { myPct, myCurrent, myTarget } = getTodayProgress(todayBattle)
                      const won = todayBattle.winner_league_id === myLeagueId
                      const lost = todayBattle.winner_league_id && todayBattle.winner_league_id !== myLeagueId
                      return (
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold" style={{ color: 'var(--text-muted)' }}>Tu equipo · {myLeagueName}</span>
                            <span className="font-black" style={{ color: won ? '#10b981' : '#ef4444' }}>
                              {myCurrent}/{myTarget} {won ? '✅' : ''}
                            </span>
                          </div>
                          <div className="w-full h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                            <motion.div className="h-full rounded-full"
                              style={{ backgroundColor: won ? '#10b981' : '#ef4444' }}
                              animate={{ width: `${myPct}%` }} transition={{ duration: 0.6, type: 'spring' }} />
                          </div>
                          {won && !lost && <p className="text-xs mt-1 font-bold text-emerald-400">🏆 ¡Batalla ganada!</p>}
                        </div>
                      )
                    })()}
                    {enemyProgress && (
                      <div className="pt-3 border-t" style={{ borderColor: 'var(--border)' }}>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs">🕵️</span>
                          <span className="text-xs font-bold" style={{ color: '#f59e0b' }}>Progreso rival (solo visible para el espía)</span>
                        </div>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: 'var(--text-hint)' }}>{enemyLeagueName}</span>
                          <span className="font-black" style={{ color: '#f59e0b' }}>{enemyProgress.current}/{enemyProgress.target}</span>
                        </div>
                        <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                          <motion.div className="h-full rounded-full bg-amber-500"
                            animate={{ width: `${Math.min(100, Math.round((enemyProgress.current / enemyProgress.target) * 100))}%` }}
                            transition={{ duration: 0.6 }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Historial batallas */}
              {activeWar.status === 'active' && battles.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-bold mb-2">📅 Batallas</p>
                  <div className="space-y-2">
                    {battles.map(battle => {
                      const isToday = battle.day === today
                      const won = battle.winner_league_id === myLeagueId
                      const lost = battle.winner_league_id && battle.winner_league_id !== myLeagueId
                      const pending = !battle.winner_league_id
                      return (
                        <div key={battle.id} className="rounded-2xl p-3 flex items-center gap-3"
                          style={{ backgroundColor: 'var(--bg-card)', border: isToday ? '2px solid rgba(220,38,38,0.4)' : '2px solid transparent', opacity: battle.day > today ? 0.5 : 1 }}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0"
                            style={{ backgroundColor: isToday ? 'rgba(220,38,38,0.15)' : 'var(--bg-input)' }}>
                            {pending && battle.day <= today ? '⚔️' : won ? '✅' : lost ? '❌' : '🔒'}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-bold">Día {battle.day}</p>
                              {isToday && <span className="text-xs px-1.5 py-0.5 rounded-full font-bold text-red-400" style={{ backgroundColor: 'rgba(220,38,38,0.1)' }}>HOY</span>}
                            </div>
                            <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                              {BATTLE_TYPES[battle.battle_type]?.emoji} {battle.description || BATTLE_TYPES[battle.battle_type]?.label}
                            </p>
                          </div>
                          {battle.day <= today && (
                            <div className="text-right flex-shrink-0">
                              <p className="text-xs font-bold" style={{ color: won ? '#10b981' : lost ? '#ef4444' : 'var(--text-hint)' }}>
                                {won ? '🏆 Victoria' : lost ? '💀 Derrota' : '⏳ En curso'}
                              </p>
                              <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                                {isChallenger ? battle.challenger_current : battle.defender_current}/
                                {isChallenger ? battle.challenger_target : battle.defender_target}
                              </p>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Equipos */}
              {activeWar.status === 'active' && participants.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">👥 Equipos</p>
                    {iAmCaptain && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                        style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                        👑 Eres el capitán
                      </span>
                    )}
                  </div>

                  {/* Info roles */}
                  <div className="rounded-2xl p-3 mb-3 space-y-1.5" style={{ backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#818cf8' }}>Roles especiales (máx. 1 de cada por equipo)</p>
                    <div className="flex items-start gap-2">
                      <span className="text-sm">🕵️</span>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}><span className="font-bold" style={{ color: 'var(--text-muted)' }}>Espía</span> — Ve el progreso del equipo rival en tiempo real</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-sm">💣</span>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}><span className="font-bold" style={{ color: 'var(--text-muted)' }}>Saboteador</span> — Puede congelar a un miembro rival una vez</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <TeamSection team={myTeam} leagueName={myLeagueName} isMyTeam={true} />
                    <TeamSection team={enemyTeam} leagueName={enemyLeagueName} isMyTeam={false} />
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── DECLARAR GUERRA ── */}
      {tab === 'challenge' && (
        <div className="px-4 pt-4 max-w-md mx-auto">
          {!canManageLeagues ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <div className="text-5xl mb-3">🔒</div>
              <p>Solo owners y admins pueden declarar guerras</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-bold mb-2">⚔️ Tu liga</p>
              <div className="space-y-2 mb-4">
                {myLeagues.filter(l => myRole[l.id] === 'owner' || myRole[l.id] === 'admin').map(league => (
                  <motion.button key={league.id} whileTap={{ scale: 0.96 }} onClick={() => setSelectedChallenger(league)}
                    className="w-full rounded-2xl p-4 text-left"
                    style={{ backgroundColor: selectedChallenger?.id === league.id ? 'rgba(220,38,38,0.15)' : 'var(--bg-card)', border: selectedChallenger?.id === league.id ? '2px solid #dc2626' : '2px solid transparent' }}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">{league.name}</p>
                      {selectedChallenger?.id === league.id && <span className="text-red-400 font-black">✓</span>}
                    </div>
                  </motion.button>
                ))}
              </div>

              <p className="text-sm font-bold mb-2">🏴 Liga rival</p>
              <div className="space-y-2 mb-5">
                {allLeagues.filter(l => !myLeagues.find(ml => ml.id === l.id)).map(league => (
                  <motion.button key={league.id} whileTap={{ scale: 0.96 }} onClick={() => setSelectedDefender(league)}
                    className="w-full rounded-2xl p-4 text-left"
                    style={{ backgroundColor: selectedDefender?.id === league.id ? 'rgba(220,38,38,0.15)' : 'var(--bg-card)', border: selectedDefender?.id === league.id ? '2px solid #dc2626' : '2px solid transparent' }}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">{league.name}</p>
                      {selectedDefender?.id === league.id && <span className="text-red-400 font-black">✓</span>}
                    </div>
                  </motion.button>
                ))}
              </div>

              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                <p className="text-sm font-bold mb-4">⚙️ Configuración de la guerra</p>

                <div className="mb-4">
                  <p className="text-xs font-medium mb-2" style={{ color: 'var(--text-muted)' }}>Duración</p>
                  <div className="flex gap-2">
                    {[1, 2, 3].map(d => (
                      <motion.button key={d} whileTap={{ scale: 0.95 }} onClick={() => setWarDuration(d)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold"
                        style={{ backgroundColor: warDuration === d ? '#dc2626' : 'var(--bg-input)', color: warDuration === d ? '#fff' : 'var(--text-muted)' }}>
                        {d} {d === 1 ? 'día' : 'días'}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Recompensa por miembro ganador</p>
                    <p className="text-sm font-black text-amber-400">{warReward}🪙</p>
                  </div>
                  <input type="range" min="100" max="5000" step="100" value={warReward}
                    onChange={e => setWarReward(Number(e.target.value))} className="w-full accent-red-600" />
                  <div className="flex gap-2 mt-2">
                    {[500, 1000, 2000, 5000].map(v => (
                      <motion.button key={v} whileTap={{ scale: 0.9 }} onClick={() => setWarReward(v)}
                        className="flex-1 text-xs py-1.5 rounded-lg font-medium"
                        style={{ backgroundColor: warReward === v ? '#dc2626' : 'var(--bg-input)', color: warReward === v ? '#fff' : 'var(--text-muted)' }}>
                        {v}
                      </motion.button>
                    ))}
                  </div>
                </div>

                <p className="text-xs font-bold mb-3" style={{ color: 'var(--text-muted)' }}>🎯 Batallas ({warDuration} día{warDuration > 1 ? 's' : ''})</p>
                <div className="space-y-4">
                  {Array.from({ length: warDuration }, (_, i) => (
                    <div key={i} className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-input)' }}>
                      <p className="text-xs font-bold mb-3" style={{ color: '#ef4444' }}>Día {i + 1}</p>
                      <p className="text-xs font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>Tipo de reto</p>
                      <div className="grid grid-cols-2 gap-1.5 mb-3">
                        {Object.entries(BATTLE_TYPES).map(([type, info]) => (
                          <motion.button key={type} whileTap={{ scale: 0.96 }}
                            onClick={() => updateBattleConfig(i, 'type', type)}
                            className="rounded-xl p-2 text-left"
                            style={{ backgroundColor: battleConfigs[i]?.type === type ? 'rgba(220,38,38,0.2)' : 'var(--bg-card)', border: battleConfigs[i]?.type === type ? '2px solid #dc2626' : '2px solid transparent' }}>
                            <p className="text-sm">{info.emoji}</p>
                            <p className="text-xs font-medium mt-0.5" style={{ color: battleConfigs[i]?.type === type ? '#ef4444' : 'var(--text-muted)' }}>{info.label}</p>
                          </motion.button>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Objetivo {selectedChallenger?.name || 'Tu liga'}</p>
                          <input type="number" min="1" value={battleConfigs[i]?.challengerTarget || 50}
                            onChange={e => updateBattleConfig(i, 'challengerTarget', parseInt(e.target.value) || 1)}
                            className="w-full rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500"
                            style={{ backgroundColor: 'var(--bg-card)', color: '#ef4444' }} />
                        </div>
                        <div>
                          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Objetivo {selectedDefender?.name || 'Liga rival'}</p>
                          <input type="number" min="1" value={battleConfigs[i]?.defenderTarget || 50}
                            onChange={e => updateBattleConfig(i, 'defenderTarget', parseInt(e.target.value) || 1)}
                            className="w-full rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                            style={{ backgroundColor: 'var(--bg-card)', color: '#818cf8' }} />
                        </div>
                      </div>
                      <input type="text" placeholder="Descripción opcional..."
                        value={battleConfigs[i]?.description || ''}
                        onChange={e => updateBattleConfig(i, 'description', e.target.value)}
                        maxLength={80}
                        className="w-full rounded-lg px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-red-500"
                        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />
                    </div>
                  ))}
                </div>
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleChallenge}
                disabled={!selectedChallenger || !selectedDefender || challenging}
                className="w-full py-4 rounded-2xl font-bold text-white text-base disabled:opacity-40"
                style={{ backgroundColor: '#dc2626' }}>
                {challenging ? 'Declarando...' : !selectedChallenger ? '← Elige tu liga' : !selectedDefender ? '← Elige la liga rival' : `⚔️ Declarar guerra a ${selectedDefender.name}`}
              </motion.button>
            </>
          )}
        </div>
      )}

      {/* Modal asignar rol */}
      <AnimatePresence>
        {selectedMemberForRole && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 flex items-end justify-center z-50"
            onClick={() => setSelectedMemberForRole(null)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="rounded-t-3xl w-full max-w-lg overflow-y-auto"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', paddingBottom: '100px' }}>
              <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black">Asignar rol a {selectedMemberForRole.profiles?.username}</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Solo el capitán puede asignar roles especiales</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => setSelectedMemberForRole(null)}
                    className="p-2 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
                </div>
              </div>
              <div className="px-5 pt-4 space-y-3">
                {[
                  { role: null, emoji: '⚔️', label: 'Combatiente', desc: 'Contribuye normalmente a las batallas colectivas', color: '#818cf8' },
                  { role: 'spy', emoji: '🕵️', label: 'Espía', desc: 'Ve el progreso del equipo rival en tiempo real', color: '#f59e0b', disabled: mySpy && mySpy.user_id !== selectedMemberForRole.user_id },
                  { role: 'saboteur', emoji: '💣', label: 'Saboteador', desc: 'Puede congelar a un rival una vez durante la guerra', color: '#ef4444', disabled: mySaboteur && mySaboteur.user_id !== selectedMemberForRole.user_id },
                ].map(opt => (
                  <motion.button key={opt.role || 'none'} whileTap={{ scale: 0.97 }}
                    onClick={() => !opt.disabled && handleAssignRole(selectedMemberForRole.user_id, opt.role)}
                    disabled={assigningRole || opt.disabled}
                    className="w-full rounded-2xl p-4 text-left"
                    style={{
                      backgroundColor: selectedMemberForRole.role === opt.role ? `${opt.color}20` : 'var(--bg-input)',
                      border: selectedMemberForRole.role === opt.role ? `2px solid ${opt.color}` : '2px solid transparent',
                      opacity: opt.disabled ? 0.4 : 1,
                    }}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{opt.emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm" style={{ color: selectedMemberForRole.role === opt.role ? opt.color : 'var(--text-primary)' }}>{opt.label}</p>
                          {selectedMemberForRole.role === opt.role && <span className="text-xs font-bold" style={{ color: opt.color }}>✓ Actual</span>}
                          {opt.disabled && <span className="text-xs" style={{ color: 'var(--text-hint)' }}>Ya asignado</span>}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{opt.desc}</p>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal cancelar */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowCancelConfirm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🚫</div>
                <h2 className="text-xl font-bold">¿Cancelar la guerra?</h2>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Se retirará la declaración a <strong>{activeWar?.defender?.name}</strong>.</p>
              </div>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowCancelConfirm(false)}
                  className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Volver</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleCancelWar} disabled={cancelling}
                  className="flex-1 font-bold py-3 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: '#ef4444' }}>
                  {cancelling ? 'Cancelando...' : 'Sí, cancelar'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}