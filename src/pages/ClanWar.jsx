import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { staggerItem, fadeIn } from '../lib/animations'
import { soundSuccess, soundError } from '../lib/sounds'

const JUG = '🏺'
const POINTS_PER_JUG = 50
const REWARD_COINS = 1000

export default function ClanWar() {
  const { user } = useAuth()
  const [tab, setTab] = useState('war') // war | challenge
  const [myLeagues, setMyLeagues] = useState([])
  const [myRole, setMyRole] = useState({}) // { leagueId: role }
  const [activeWar, setActiveWar] = useState(null)
  const [myParticipation, setMyParticipation] = useState(null)
  const [participants, setParticipants] = useState([])
  const [battles, setBattles] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState(null)

  // Challenge
  const [allLeagues, setAllLeagues] = useState([])
  const [selectedChallenger, setSelectedChallenger] = useState(null)
  const [selectedDefender, setSelectedDefender] = useState(null)
  const [challenging, setChallenging] = useState(false)

  // Attack
  const [showAttackModal, setShowAttackModal] = useState(false)
  const [attackTarget, setAttackTarget] = useState(null)
  const [attacking, setAttacking] = useState(false)
  const [battleResult, setBattleResult] = useState(null)

  // Accept war
  const [accepting, setAccepting] = useState(false)

  useEffect(() => { fetchData() }, [])

  const showMsg = (success, text) => {
    setMsg({ success, text })
    setTimeout(() => setMsg(null), 4000)
  }

  const fetchData = async () => {
    setLoading(true)
    // Mis ligas y roles
    const { data: leagueData } = await supabase
      .from('league_members')
      .select('league_id, role, leagues(id, name, invite_code)')
      .eq('user_id', user.id)

    const leagues = leagueData?.map(d => ({ ...d.leagues, myRole: d.role })) || []
    setMyLeagues(leagues)
    const roles = {}
    leagues.forEach(l => { roles[l.id] = l.myRole })
    setMyRole(roles)

    const leagueIds = leagues.map(l => l.id)

    // Guerra activa de mis ligas
    if (leagueIds.length > 0) {
      const { data: warData } = await supabase
        .from('clan_wars')
        .select(`
          *,
          challenger:leagues!clan_wars_challenger_league_id_fkey(id, name),
          defender:leagues!clan_wars_defender_league_id_fkey(id, name)
        `)
        .in('status', ['pending', 'active'])
        .or(leagueIds.map(id => `challenger_league_id.eq.${id},defender_league_id.eq.${id}`).join(','))
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (warData) {
        setActiveWar(warData)

        // Mi participación
        const { data: part } = await supabase
          .from('clan_war_participants')
          .select('*')
          .eq('war_id', warData.id)
          .eq('user_id', user.id)
          .maybeSingle()
        setMyParticipation(part)

        // Todos los participantes con perfil
        const { data: parts } = await supabase
          .from('clan_war_participants')
          .select('*, profiles(id, username, avatar_url)')
          .eq('war_id', warData.id)
        setParticipants(parts || [])

        // Combates
        const { data: battleData } = await supabase
          .from('clan_war_battles')
          .select('*, attacker:profiles!clan_war_battles_attacker_id_fkey(username, avatar_url), defender:profiles!clan_war_battles_defender_id_fkey(username, avatar_url)')
          .eq('war_id', warData.id)
          .order('created_at', { ascending: false })
        setBattles(battleData || [])
      } else {
        setActiveWar(null)
        setMyParticipation(null)
        setParticipants([])
        setBattles([])
      }
    }

    // Todas las ligas para retar
    const { data: allL } = await supabase.from('leagues').select('id, name').order('name')
    setAllLeagues(allL || [])

    setLoading(false)
  }

  const handleChallenge = async () => {
    if (!selectedChallenger || !selectedDefender) return
    setChallenging(true)

    const { data: validation } = await supabase.rpc('challenge_league', {
      p_challenger_league_id: selectedChallenger.id,
      p_defender_league_id: selectedDefender.id,
    })

    if (!validation?.success) {
      soundError(); showMsg(false, validation?.error || 'Error al retar')
      setChallenging(false); return
    }

    // Insertar la guerra
    const { data: war, error } = await supabase.from('clan_wars')
      .insert({ challenger_league_id: selectedChallenger.id, defender_league_id: selectedDefender.id })
      .select().single()

    if (error) {
      soundError(); showMsg(false, 'Error al crear la guerra')
    } else {
      soundSuccess()
      showMsg(true, `¡Guerra declarada a ${selectedDefender.name}! Esperando aceptación...`)
      setSelectedChallenger(null); setSelectedDefender(null)
      setTab('war'); fetchData()
    }
    setChallenging(false)
  }

  const handleAcceptWar = async () => {
    if (!activeWar) return
    setAccepting(true)

    const { data: validation } = await supabase.rpc('accept_clan_war', { p_war_id: activeWar.id })

    if (!validation?.success) {
      soundError(); showMsg(false, validation?.error || 'Error')
      setAccepting(false); return
    }

    // Actualizar guerra a activa
    await supabase.from('clan_wars').update({
      status: 'active',
      started_at: new Date().toISOString(),
      ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    }).eq('id', activeWar.id)

    // Inscribir participantes de ambas ligas
    const { data: challengerMembers } = await supabase
      .from('league_members').select('user_id')
      .eq('league_id', activeWar.challenger_league_id)
    const { data: defenderMembers } = await supabase
      .from('league_members').select('user_id')
      .eq('league_id', activeWar.defender_league_id)

    const allParticipants = [
      ...(challengerMembers || []).map(m => ({ war_id: activeWar.id, user_id: m.user_id, league_id: activeWar.challenger_league_id })),
      ...(defenderMembers || []).map(m => ({ war_id: activeWar.id, user_id: m.user_id, league_id: activeWar.defender_league_id })),
    ]

    await supabase.from('clan_war_participants').upsert(allParticipants, { onConflict: 'war_id,user_id' })

    soundSuccess(); showMsg(true, '⚔️ ¡Guerra aceptada! Comienza la batalla.')
    setAccepting(false); fetchData()
  }

  const handleAttack = async () => {
    if (!attackTarget || !activeWar) return
    setAttacking(true); setBattleResult(null)

    const { data: validation } = await supabase.rpc('validate_attack', {
      p_war_id: activeWar.id,
      p_defender_id: attackTarget.profiles.id,
    })

    if (!validation?.success) {
      soundError(); showMsg(false, validation?.error || 'Error al atacar')
      setAttacking(false); return
    }

    const attackerPts = validation.attacker_points
    const defenderPts = validation.defender_points
    const attackerWon = attackerPts >= defenderPts
    const winnerId = attackerWon ? user.id : attackTarget.profiles.id
    const attackerLeagueId = validation.attacker_league_id

    // Insertar batalla
    await supabase.from('clan_war_battles').insert({
      war_id: activeWar.id,
      attacker_id: user.id,
      defender_id: attackTarget.profiles.id,
      attacker_points: attackerPts,
      defender_points: defenderPts,
      winner_id: winnerId,
    })

    // Restar batalla al atacante
    await supabase.from('clan_war_participants')
      .update({ battles_left: myParticipation.battles_left - 1 })
      .eq('war_id', activeWar.id).eq('user_id', user.id)

    // Sumar 10 puntos de guerra a la liga ganadora
    const isChallenger = attackerLeagueId === activeWar.challenger_league_id
    const winnerIsAttacker = attackerWon

    let newChallengerPts = activeWar.challenger_war_points
    let newDefenderPts = activeWar.defender_war_points

    if (winnerIsAttacker && isChallenger) newChallengerPts += 10
    else if (winnerIsAttacker && !isChallenger) newDefenderPts += 10
    else if (!winnerIsAttacker && isChallenger) newDefenderPts += 10
    else if (!winnerIsAttacker && !isChallenger) newChallengerPts += 10

    // Calcular jarras: cada 50 puntos = 1 jarra robada
    let newChallengerJugs = activeWar.challenger_jugs
    let newDefenderJugs = activeWar.defender_jugs

    const prevChallengerJugThreshold = Math.floor(activeWar.challenger_war_points / POINTS_PER_JUG)
    const newChallengerJugThreshold = Math.floor(newChallengerPts / POINTS_PER_JUG)
    const prevDefenderJugThreshold = Math.floor(activeWar.defender_war_points / POINTS_PER_JUG)
    const newDefenderJugThreshold = Math.floor(newDefenderPts / POINTS_PER_JUG)

    const challengerStolenJugs = newChallengerJugThreshold - prevChallengerJugThreshold
    const defenderStolenJugs = newDefenderJugThreshold - prevDefenderJugThreshold

    if (challengerStolenJugs > 0) {
      newDefenderJugs = Math.max(0, newDefenderJugs - challengerStolenJugs)
      newChallengerJugs = Math.min(10, newChallengerJugs + challengerStolenJugs)
    }
    if (defenderStolenJugs > 0) {
      newChallengerJugs = Math.max(0, newChallengerJugs - defenderStolenJugs)
      newDefenderJugs = Math.min(10, newDefenderJugs + defenderStolenJugs)
    }

    // Comprobar si la guerra termina (rival a 0 jarras o tiempo acabado)
    let newStatus = activeWar.status
    let winnerLeagueId = null

    if (newChallengerJugs === 0) { newStatus = 'finished'; winnerLeagueId = activeWar.defender_league_id }
    else if (newDefenderJugs === 0) { newStatus = 'finished'; winnerLeagueId = activeWar.challenger_league_id }

    await supabase.from('clan_wars').update({
      challenger_war_points: newChallengerPts,
      defender_war_points: newDefenderPts,
      challenger_jugs: newChallengerJugs,
      defender_jugs: newDefenderJugs,
      status: newStatus,
      winner_league_id: winnerLeagueId,
    }).eq('id', activeWar.id)

    // Si hay ganador, repartir monedas
    if (winnerLeagueId) {
      const { data: winners } = await supabase.from('league_members')
        .select('user_id').eq('league_id', winnerLeagueId)
      if (winners) {
        for (const w of winners) {
          await supabase.from('wallets').upsert({ user_id: w.user_id, balance: REWARD_COINS },
            { onConflict: 'user_id' })
          await supabase.from('wallets')
            .update({ balance: supabase.raw ? undefined : undefined })
            .eq('user_id', w.user_id)
          // Incrementar saldo
          await supabase.rpc('send_coins_to_member', {
            p_league_id: winnerLeagueId,
            p_receiver_id: w.user_id,
            p_amount: REWARD_COINS,
            p_note: '🏆 Premio Guerra de Clanes',
          }).catch(() => {})
        }
      }
    }

    if (attackerWon) soundSuccess(); else soundError()

    setBattleResult({
      attackerWon,
      attackerPts,
      defenderPts,
      defenderName: attackTarget.profiles.username,
      stolenJug: challengerStolenJugs > 0 || defenderStolenJugs > 0,
      warFinished: newStatus === 'finished',
      winnerLeagueName: winnerLeagueId === activeWar.challenger_league_id
        ? activeWar.challenger?.name
        : activeWar.defender?.name,
    })

    setAttacking(false)
    fetchData()
  }

  const formatTimeLeft = (endsAt) => {
    if (!endsAt) return '—'
    const diff = new Date(endsAt) - new Date()
    if (diff <= 0) return 'Terminada'
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(hours / 24)
    const remainHours = hours % 24
    if (days > 0) return `${days}d ${remainHours}h`
    return `${hours}h`
  }

  // Rivales disponibles para atacar (liga contraria, con participación activa)
  const myLeagueId = myParticipation?.league_id
  const enemies = participants.filter(p =>
    p.league_id !== myLeagueId && p.profiles
  )
  const allies = participants.filter(p =>
    p.league_id === myLeagueId && p.profiles
  )

  const isChallenger = myLeagueId === activeWar?.challenger_league_id
  const myWarPoints = isChallenger ? activeWar?.challenger_war_points : activeWar?.defender_war_points
  const enemyWarPoints = isChallenger ? activeWar?.defender_war_points : activeWar?.challenger_war_points
  const myJugs = isChallenger ? activeWar?.challenger_jugs : activeWar?.defender_jugs
  const enemyJugs = isChallenger ? activeWar?.defender_jugs : activeWar?.challenger_jugs
  const myLeagueName = isChallenger ? activeWar?.challenger?.name : activeWar?.defender?.name
  const enemyLeagueName = isChallenger ? activeWar?.defender?.name : activeWar?.challenger?.name

  const isDefenderOwner = myRole[activeWar?.defender_league_id] === 'owner' || myRole[activeWar?.defender_league_id] === 'admin'
  const isChallengerOwner = myRole[activeWar?.challenger_league_id] === 'owner' || myRole[activeWar?.challenger_league_id] === 'admin'
  const canManageLeagues = myLeagues.some(l => myRole[l.id] === 'owner' || myRole[l.id] === 'admin')

  const Avatar = ({ url, username, size = 'sm' }) => {
    const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
    return url
      ? <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
      : <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 text-sm`}
          style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-4xl">⚔️</motion.div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-2xl font-bold mb-1">⚔️ Guerra de Clanes</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Roba jarras, destruye rivales, gana monedas</p>
        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
          {[{ id: 'war', label: '⚔️ Guerra' }, { id: 'challenge', label: '🏴 Declarar' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-sm font-medium transition-colors z-10"
              style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {tab === t.id && (
                <motion.div layoutId="war-tab" className="absolute inset-0 rounded-lg"
                  style={{ zIndex: -1, backgroundColor: '#dc2626' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }} />
              )}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mensaje */}
      <AnimatePresence>
        {msg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mt-4 rounded-2xl p-4 text-center"
            style={{
              backgroundColor: msg.success ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              border: `1px solid ${msg.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
            <p className={`font-bold text-sm ${msg.success ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── GUERRA ACTIVA ── */}
      {tab === 'war' && (
        <div className="px-4 pt-4 max-w-md mx-auto">

          {!activeWar ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              <motion.div className="text-6xl mb-4" animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 2 }}>🏺</motion.div>
              <p className="font-bold text-lg">Sin guerra activa</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-hint)' }}>Declara una guerra desde la pestaña 🏴</p>
              {canManageLeagues && (
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setTab('challenge')}
                  className="mt-6 px-6 py-3 rounded-2xl font-bold text-white"
                  style={{ backgroundColor: '#dc2626' }}>
                  🏴 Declarar guerra
                </motion.button>
              )}
            </div>
          ) : (
            <>
              {/* Estado de la guerra */}
              <div className="rounded-2xl p-4 mb-4"
                style={{
                  background: activeWar.status === 'pending'
                    ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))'
                    : 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))',
                  border: `1px solid ${activeWar.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'rgba(220,38,38,0.3)'}`,
                }}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${activeWar.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {activeWar.status === 'pending' ? '⏳ Pendiente' : activeWar.status === 'active' ? '⚔️ En curso' : '🏁 Finalizada'}
                  </span>
                  {activeWar.status === 'active' && (
                    <span className="text-xs font-medium" style={{ color: 'var(--text-hint)' }}>
                      ⏱ {formatTimeLeft(activeWar.ends_at)}
                    </span>
                  )}
                </div>

                {/* Enfrentamiento */}
                <div className="flex items-center justify-between mt-3">
                  {/* Mi liga */}
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm truncate">{myLeagueName || activeWar.challenger?.name}</p>
                    <div className="flex justify-center gap-0.5 mt-2 flex-wrap">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className="text-xl"
                          style={{ opacity: i < (myJugs ?? activeWar.challenger_jugs) ? 1 : 0.2 }}>{JUG}</span>
                      ))}
                    </div>
                    {activeWar.status === 'active' && (
                      <p className="text-xs mt-1 font-bold text-red-400">{myWarPoints ?? activeWar.challenger_war_points} pts guerra</p>
                    )}
                  </div>

                  <div className="text-2xl font-black mx-3" style={{ color: 'var(--text-hint)' }}>VS</div>

                  {/* Liga rival */}
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm truncate">{enemyLeagueName || activeWar.defender?.name}</p>
                    <div className="flex justify-center gap-0.5 mt-2 flex-wrap">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <span key={i} className="text-xl"
                          style={{ opacity: i < (enemyJugs ?? activeWar.defender_jugs) ? 1 : 0.2 }}>{JUG}</span>
                      ))}
                    </div>
                    {activeWar.status === 'active' && (
                      <p className="text-xs mt-1 font-bold text-red-400">{enemyWarPoints ?? activeWar.defender_war_points} pts guerra</p>
                    )}
                  </div>
                </div>

                {/* Barra de progreso jarras */}
                {activeWar.status === 'active' && myJugs !== undefined && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-hint)' }}>
                      <span>Próxima jarra en {POINTS_PER_JUG - (myWarPoints % POINTS_PER_JUG)} pts</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                      <motion.div className="h-full rounded-full bg-red-500"
                        animate={{ width: `${(myWarPoints % POINTS_PER_JUG) / POINTS_PER_JUG * 100}%` }}
                        transition={{ duration: 0.5 }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Aceptar guerra (solo defender owner/admin) */}
              {activeWar.status === 'pending' && isDefenderOwner && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleAcceptWar} disabled={accepting}
                  className="w-full py-4 rounded-2xl font-bold text-white mb-4"
                  style={{ backgroundColor: '#dc2626' }}>
                  {accepting ? 'Aceptando...' : '⚔️ Aceptar la guerra'}
                </motion.button>
              )}

              {activeWar.status === 'pending' && isChallengerOwner && !isDefenderOwner && (
                <div className="rounded-2xl p-4 mb-4 text-center"
                  style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                  <p className="text-sm text-amber-400 font-medium">⏳ Esperando que {activeWar.defender?.name} acepte...</p>
                </div>
              )}

              {/* Mis combates restantes */}
              {activeWar.status === 'active' && myParticipation && (
                <div className="rounded-2xl p-4 mb-4 flex items-center justify-between"
                  style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div>
                    <p className="font-bold text-sm">Tus combates</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>3 por guerra</p>
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold`}
                        style={{
                          backgroundColor: i < myParticipation.battles_left ? '#dc2626' : 'var(--bg-input)',
                          color: i < myParticipation.battles_left ? '#fff' : 'var(--text-hint)',
                        }}>
                        {i < myParticipation.battles_left ? '⚔️' : '✓'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Lista de rivales para atacar */}
              {activeWar.status === 'active' && myParticipation && myParticipation.battles_left > 0 && (
                <>
                  <p className="text-sm font-bold mb-3">👊 Rivales disponibles</p>
                  {enemies.length === 0 ? (
                    <div className="rounded-2xl p-4 text-center mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-hint)' }}>No hay rivales disponibles</p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-4">
                      {enemies.map(enemy => (
                        <motion.div key={enemy.id} variants={staggerItem} initial="initial" animate="animate"
                          className="rounded-2xl p-3 flex items-center gap-3"
                          style={{ backgroundColor: 'var(--bg-card)' }}>
                          <Avatar url={enemy.profiles?.avatar_url} username={enemy.profiles?.username} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{enemy.profiles?.username}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                              {enemyLeagueName}
                            </p>
                          </div>
                          <motion.button whileTap={{ scale: 0.9 }}
                            onClick={() => { setAttackTarget(enemy); setBattleResult(null); setShowAttackModal(true) }}
                            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex-shrink-0"
                            style={{ backgroundColor: '#dc2626' }}>
                            ⚔️ Atacar
                          </motion.button>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Aliados */}
              {activeWar.status === 'active' && allies.length > 0 && (
                <>
                  <p className="text-sm font-bold mb-3">🛡️ Tu equipo</p>
                  <div className="space-y-2 mb-4">
                    {allies.map(ally => (
                      <motion.div key={ally.id} variants={staggerItem} initial="initial" animate="animate"
                        className="rounded-2xl p-3 flex items-center gap-3"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          border: ally.user_id === user.id ? '2px solid rgba(220,38,38,0.4)' : '2px solid transparent',
                        }}>
                        <Avatar url={ally.profiles?.avatar_url} username={ally.profiles?.username} size="md" />
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm">{ally.profiles?.username} {ally.user_id === user.id && '(tú)'}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                            {ally.battles_left} combates restantes
                          </p>
                        </div>
                        <div className="flex gap-0.5">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: i < ally.battles_left ? '#dc2626' : 'var(--bg-input)' }} />
                          ))}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}

              {/* Historial de combates */}
              {battles.length > 0 && (
                <>
                  <p className="text-sm font-bold mb-3">📜 Combates recientes</p>
                  <div className="space-y-2 mb-4">
                    {battles.slice(0, 10).map(battle => {
                      const attackerWon = battle.winner_id === battle.attacker_id
                      return (
                        <motion.div key={battle.id} variants={staggerItem} initial="initial" animate="animate"
                          className="rounded-2xl p-3 flex items-center gap-3"
                          style={{ backgroundColor: 'var(--bg-card)' }}>
                          <div className="text-2xl flex-shrink-0">{attackerWon ? '⚔️' : '🛡️'}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              <span style={{ color: attackerWon ? '#10b981' : 'var(--text-primary)' }}>
                                {battle.attacker?.username}
                              </span>
                              <span style={{ color: 'var(--text-hint)' }}> vs </span>
                              <span style={{ color: !attackerWon ? '#10b981' : 'var(--text-primary)' }}>
                                {battle.defender?.username}
                              </span>
                            </p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                              {battle.attacker_points}pts vs {battle.defender_points}pts · +10 pts guerra
                            </p>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </>
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
              <p>Solo los owners y admins pueden declarar guerras</p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl p-4 mb-4"
                style={{ backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <p className="text-sm font-bold text-red-400 mb-1">📜 Reglas de guerra</p>
                <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                  Cada liga empieza con 5 🏺 · Cada 50 pts de guerra se roba 1 jarra · 3 combates por miembro · Dura 3 días · La liga con más jarras gana 1000🪙 por miembro
                </p>
              </div>

              {/* Elegir tu liga */}
              <p className="text-sm font-bold mb-2">⚔️ Tu liga (atacante)</p>
              <div className="space-y-2 mb-4">
                {myLeagues.filter(l => myRole[l.id] === 'owner' || myRole[l.id] === 'admin').map(league => (
                  <motion.button key={league.id} whileTap={{ scale: 0.96 }}
                    onClick={() => setSelectedChallenger(league)}
                    className="w-full rounded-2xl p-4 text-left"
                    style={{
                      backgroundColor: selectedChallenger?.id === league.id ? 'rgba(220,38,38,0.15)' : 'var(--bg-card)',
                      border: selectedChallenger?.id === league.id ? '2px solid #dc2626' : '2px solid transparent',
                    }}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">{league.name}</p>
                      {selectedChallenger?.id === league.id && <span className="text-red-400">✓</span>}
                    </div>
                  </motion.button>
                ))}
              </div>

              {/* Elegir liga rival */}
              <p className="text-sm font-bold mb-2">🏴 Liga rival (defensor)</p>
              <div className="space-y-2 mb-6">
                {allLeagues.filter(l => !myLeagues.find(ml => ml.id === l.id)).map(league => (
                  <motion.button key={league.id} whileTap={{ scale: 0.96 }}
                    onClick={() => setSelectedDefender(league)}
                    className="w-full rounded-2xl p-4 text-left"
                    style={{
                      backgroundColor: selectedDefender?.id === league.id ? 'rgba(220,38,38,0.15)' : 'var(--bg-card)',
                      border: selectedDefender?.id === league.id ? '2px solid #dc2626' : '2px solid transparent',
                    }}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">{league.name}</p>
                      {selectedDefender?.id === league.id && <span className="text-red-400">✓</span>}
                    </div>
                  </motion.button>
                ))}
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleChallenge}
                disabled={!selectedChallenger || !selectedDefender || challenging}
                className="w-full py-4 rounded-2xl font-bold text-white text-base disabled:opacity-40"
                style={{ backgroundColor: '#dc2626' }}>
                {challenging ? 'Declarando...' :
                  !selectedChallenger ? '← Elige tu liga' :
                  !selectedDefender ? '← Elige la liga rival' :
                  `⚔️ Declarar guerra a ${selectedDefender.name}`}
              </motion.button>
            </>
          )}
        </div>
      )}

      {/* Modal de ataque */}
      <AnimatePresence>
        {showAttackModal && attackTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => { if (!attacking) { setShowAttackModal(false); setBattleResult(null) } }}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>

              {!battleResult ? (
                <>
                  <div className="text-center mb-5">
                    <div className="text-5xl mb-3">⚔️</div>
                    <h2 className="text-xl font-bold">¿Atacar a {attackTarget.profiles?.username}?</h2>
                    <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                      Se compararán los puntos de temporada actuales. El que más tenga gana.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <motion.button whileTap={{ scale: 0.96 }}
                      onClick={() => { setShowAttackModal(false); setBattleResult(null) }}
                      className="flex-1 font-semibold py-3 rounded-xl"
                      style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                      Cancelar
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.96 }} onClick={handleAttack} disabled={attacking}
                      className="flex-1 bg-red-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl">
                      {attacking ? '⚔️ Combatiendo...' : '⚔️ ¡Atacar!'}
                    </motion.button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-center mb-5">
                    <motion.div animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.5 }} className="text-5xl mb-3">
                      {battleResult.attackerWon ? '🏆' : '💀'}
                    </motion.div>
                    <h2 className="text-xl font-bold" style={{ color: battleResult.attackerWon ? '#10b981' : '#ef4444' }}>
                      {battleResult.attackerWon ? '¡VICTORIA!' : '¡DERROTA!'}
                    </h2>
                    <div className="flex items-center justify-center gap-4 mt-3">
                      <div className="text-center">
                        <p className="text-2xl font-black text-amber-400">{battleResult.attackerPts}</p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Tus pts</p>
                      </div>
                      <span className="text-xl font-black" style={{ color: 'var(--text-hint)' }}>vs</span>
                      <div className="text-center">
                        <p className="text-2xl font-black text-amber-400">{battleResult.defenderPts}</p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{battleResult.defenderName}</p>
                      </div>
                    </div>
                    {battleResult.attackerWon && (
                      <p className="text-sm mt-3 font-bold text-red-400">+10 pts de guerra para tu liga</p>
                    )}
                    {battleResult.stolenJug && (
                      <motion.p initial={{ scale: 0 }} animate={{ scale: 1 }}
                        className="text-sm mt-2 font-black text-amber-400">
                        🏺 ¡Jarra robada!
                      </motion.p>
                    )}
                    {battleResult.warFinished && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="mt-3 rounded-xl p-3"
                        style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}>
                        <p className="text-sm font-bold text-amber-400">
                          🏆 ¡{battleResult.winnerLeagueName} gana la guerra!
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                          Los ganadores reciben 1000🪙 cada uno
                        </p>
                      </motion.div>
                    )}
                  </div>
                  <motion.button whileTap={{ scale: 0.96 }}
                    onClick={() => { setShowAttackModal(false); setBattleResult(null) }}
                    className="w-full py-3 rounded-xl font-semibold"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                    Cerrar
                  </motion.button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}