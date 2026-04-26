import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { staggerItem } from '../lib/animations'
import { soundSuccess, soundError } from '../lib/sounds'

const REWARD_COINS = 1000

const ROLE_INFO = {
  attacker: { emoji: '🗡️', label: 'Atacante', desc: 'Tus consumiciones suman x2 puntos de guerra', color: '#ef4444', bg: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.4)' },
  defender: { emoji: '🛡️', label: 'Defensor', desc: 'Reduces los puntos que el rival puede robarte', color: '#6366f1', bg: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.4)' },
  spy:      { emoji: '🕵️', label: 'Espía',    desc: 'Ves las misiones rivales · x0.5 puntos de guerra', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', border: 'rgba(245,158,11,0.4)' },
}

const MISSION_LABELS = {
  drink_count:    { emoji: '🍺', label: 'Consumiciones totales' },
  unique_members: { emoji: '👥', label: 'Miembros activos' },
  night_drink:    { emoji: '🌙', label: 'Consumiciones nocturnas (22h-4h)' },
}

// ─── Confetti animado ─────────────────────────────────────────────────────────
function Confetti() {
  const pieces = Array.from({ length: 18 }, (_, i) => ({
    x: Math.random() * 100,
    delay: Math.random() * 0.4,
    color: ['#ef4444','#f59e0b','#6366f1','#10b981','#ec4899'][i % 5],
    size: 6 + Math.random() * 6,
  }))
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.div key={i} className="absolute rounded-sm"
          style={{ left: `${p.x}%`, top: -10, width: p.size, height: p.size, backgroundColor: p.color }}
          initial={{ y: -20, rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 1.8, delay: p.delay, ease: 'easeIn' }} />
      ))}
    </div>
  )
}

export default function ClanWar() {
  const { user } = useAuth()
  const [tab, setTab] = useState('war')
  const [myLeagues, setMyLeagues] = useState([])
  const [myRole, setMyRole] = useState({})
  const [activeWar, setActiveWar] = useState(null)
  const [myParticipation, setMyParticipation] = useState(null)
  const [participants, setParticipants] = useState([])
  const [missions, setMissions] = useState([])
  const [enemyMissions, setEnemyMissions] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState(null)
  const [allLeagues, setAllLeagues] = useState([])
  const [selectedChallenger, setSelectedChallenger] = useState(null)
  const [selectedDefender, setSelectedDefender] = useState(null)
  const [challenging, setChallenging] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [selectingRole, setSelectingRole] = useState(false)
  const [generatingEvent, setGeneratingEvent] = useState(false)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [showConfetti, setShowConfetti] = useState(false)
  const [lastEventCheck, setLastEventCheck] = useState(null)

  useEffect(() => { fetchData() }, [])

  const showMsg = (success, text) => { setMsg({ success, text }); setTimeout(() => setMsg(null), 4000) }

  const fetchData = async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)

    const { data: leagueData } = await supabase
      .from('league_members').select('league_id, role, leagues(id, name, invite_code)').eq('user_id', user.id)
    const leagues = leagueData?.map(d => ({ ...d.leagues, myRole: d.role })) || []
    setMyLeagues(leagues)
    const roles = {}; leagues.forEach(l => { roles[l.id] = l.myRole }); setMyRole(roles)
    const leagueIds = leagues.map(l => l.id)

    if (leagueIds.length > 0) {
      const { data: warData } = await supabase
        .from('clan_wars').select(`*, challenger:leagues!clan_wars_challenger_league_id_fkey(id,name), defender:leagues!clan_wars_defender_league_id_fkey(id,name)`)
        .in('status', ['pending', 'active'])
        .or(leagueIds.map(id => `challenger_league_id.eq.${id},defender_league_id.eq.${id}`).join(','))
        .order('created_at', { ascending: false }).limit(1).maybeSingle()

      if (warData) {
        setActiveWar(warData)
        const { data: part } = await supabase.from('clan_war_participants').select('*').eq('war_id', warData.id).eq('user_id', user.id).maybeSingle()
        setMyParticipation(part)
        const { data: parts } = await supabase.from('clan_war_participants').select('*, profiles(id, username, avatar_url)').eq('war_id', warData.id)
        setParticipants(parts || [])

        const myLeagueId = part?.league_id
        if (myLeagueId && warData.status === 'active') {
          const today = warData.started_at ? Math.min(3, Math.floor((Date.now() - new Date(warData.started_at).getTime()) / 86400000) + 1) : 1
          const { data: myMissions } = await supabase.from('war_missions').select('*').eq('war_id', warData.id).eq('league_id', myLeagueId).eq('day', today)
          setMissions(myMissions || [])

          if (part?.role === 'spy') {
            const enemyLeagueId = myLeagueId === warData.challenger_league_id ? warData.defender_league_id : warData.challenger_league_id
            const { data: eMissions } = await supabase.from('war_missions').select('*').eq('war_id', warData.id).eq('league_id', enemyLeagueId).eq('day', today)
            setEnemyMissions(eMissions || [])
          } else { setEnemyMissions([]) }

          // Auto-generar evento si llevan más de 12h sin uno
          const { data: lastEvent } = await supabase.from('war_events').select('created_at').eq('war_id', warData.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
          const hoursSinceEvent = lastEvent ? (Date.now() - new Date(lastEvent.created_at).getTime()) / 3600000 : 99
          setLastEventCheck(hoursSinceEvent)
          if (hoursSinceEvent > 12) {
            await supabase.rpc('generate_war_event', { p_war_id: warData.id, p_challenger_id: warData.challenger_league_id, p_defender_id: warData.defender_league_id })
          }
        }

        const { data: eventsData } = await supabase.from('war_events').select('*, leagues(name)').eq('war_id', warData.id).eq('active', true).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
        setEvents(eventsData || [])
      } else {
        setActiveWar(null); setMyParticipation(null); setParticipants([]); setMissions([]); setEnemyMissions([]); setEvents([])
      }
    }

    const { data: allL } = await supabase.from('leagues').select('id, name').order('name')
    setAllLeagues(allL || [])
    setLoading(false); setRefreshing(false)
  }

  const handleChallenge = async () => {
    if (!selectedChallenger || !selectedDefender) return
    setChallenging(true)
    const { data: war, error } = await supabase.from('clan_wars')
      .insert({ challenger_league_id: selectedChallenger.id, defender_league_id: selectedDefender.id }).select().single()
    if (error) { soundError(); showMsg(false, 'Error al crear la guerra') }
    else { soundSuccess(); showMsg(true, `⚔️ ¡Guerra declarada a ${selectedDefender.name}! Esperando aceptación...`); setSelectedChallenger(null); setSelectedDefender(null); setTab('war'); fetchData() }
    setChallenging(false)
  }

  const handleAcceptWar = async () => {
    if (!activeWar) return
    setAccepting(true)
    await supabase.from('clan_wars').update({ status: 'active', started_at: new Date().toISOString(), ends_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString() }).eq('id', activeWar.id)
    const [{ data: challengerMembers }, { data: defenderMembers }] = await Promise.all([
      supabase.from('league_members').select('user_id').eq('league_id', activeWar.challenger_league_id),
      supabase.from('league_members').select('user_id').eq('league_id', activeWar.defender_league_id),
    ])
    const allParticipants = [
      ...(challengerMembers || []).map(m => ({ war_id: activeWar.id, user_id: m.user_id, league_id: activeWar.challenger_league_id, role: 'attacker', role_chosen: false })),
      ...(defenderMembers || []).map(m => ({ war_id: activeWar.id, user_id: m.user_id, league_id: activeWar.defender_league_id, role: 'attacker', role_chosen: false })),
    ]
    await supabase.from('clan_war_participants').upsert(allParticipants, { onConflict: 'war_id,user_id' })
    await supabase.rpc('generate_war_missions', { p_war_id: activeWar.id, p_challenger_id: activeWar.challenger_league_id, p_defender_id: activeWar.defender_league_id })
    // Primer evento al arrancar
    await supabase.rpc('generate_war_event', { p_war_id: activeWar.id, p_challenger_id: activeWar.challenger_league_id, p_defender_id: activeWar.defender_league_id })
    soundSuccess(); showMsg(true, '⚔️ ¡Guerra iniciada! Elige tu rol para empezar.')
    setAccepting(false); await fetchData(); setShowRoleModal(true)
  }

  const handleCancelWar = async () => {
    if (!activeWar) return
    setCancelling(true)
    const { error } = await supabase.from('clan_wars').update({ status: 'cancelled' }).eq('id', activeWar.id).eq('status', 'pending')
    if (error) { soundError(); showMsg(false, 'Error al cancelar') }
    else { soundSuccess(); showMsg(true, '✅ Guerra cancelada'); setActiveWar(null); fetchData() }
    setCancelling(false); setShowCancelConfirm(false)
  }

  const handleSelectRole = async (role) => {
    if (!activeWar || !myParticipation) return
    setSelectingRole(true)
    await supabase.from('clan_war_participants').update({ role, role_chosen: true }).eq('war_id', activeWar.id).eq('user_id', user.id)
    soundSuccess()
    setShowConfetti(true)
    setTimeout(() => setShowConfetti(false), 2000)
    showMsg(true, `${ROLE_INFO[role].emoji} ¡Rol elegido: ${ROLE_INFO[role].label}!`)
    setSelectingRole(false); setShowRoleModal(false); fetchData(true)
  }

  const handleGenerateEvent = async () => {
    if (!activeWar || generatingEvent) return
    setGeneratingEvent(true)
    const { data, error } = await supabase.rpc('generate_war_event', { p_war_id: activeWar.id, p_challenger_id: activeWar.challenger_league_id, p_defender_id: activeWar.defender_league_id })
    if (error) { soundError(); showMsg(false, 'Error al generar evento') }
    else { soundSuccess(); showMsg(true, data?.description || '⚡ Nuevo evento activado'); fetchData(true) }
    setGeneratingEvent(false)
  }

  const handleRefresh = async () => { if (refreshing) return; await fetchData(true) }

  const formatTimeLeft = (endsAt) => {
    if (!endsAt) return '—'
    const diff = new Date(endsAt) - new Date()
    if (diff <= 0) return 'Terminada'
    const h = Math.floor(diff / 3600000), d = Math.floor(h / 24)
    return d > 0 ? `${d}d ${h % 24}h` : `${h}h`
  }

  const myLeagueId = myParticipation?.league_id
  const isChallenger = myLeagueId === activeWar?.challenger_league_id
  const myWarPoints = isChallenger ? activeWar?.challenger_war_points : activeWar?.defender_war_points
  const enemyWarPoints = isChallenger ? activeWar?.defender_war_points : activeWar?.challenger_war_points
  const myMissionsPoints = isChallenger ? activeWar?.challenger_missions_points : activeWar?.defender_missions_points
  const enemyMissionsPoints = isChallenger ? activeWar?.defender_missions_points : activeWar?.challenger_missions_points
  const myTotalPoints = (myWarPoints || 0) + (myMissionsPoints || 0)
  const enemyTotalPoints = (enemyWarPoints || 0) + (enemyMissionsPoints || 0)
  const myLeagueName = isChallenger ? activeWar?.challenger?.name : activeWar?.defender?.name
  const enemyLeagueName = isChallenger ? activeWar?.defender?.name : activeWar?.challenger?.name
  const isDefenderOwner = myRole[activeWar?.defender_league_id] === 'owner' || myRole[activeWar?.defender_league_id] === 'admin'
  const isChallengerOwner = myRole[activeWar?.challenger_league_id] === 'owner' || myRole[activeWar?.challenger_league_id] === 'admin'
  const canManageLeagues = myLeagues.some(l => myRole[l.id] === 'owner' || myRole[l.id] === 'admin')
  const currentRole = myParticipation?.role || 'attacker'
  const roleInfo = ROLE_INFO[currentRole]
  const roleChosen = myParticipation?.role_chosen === true
  const today = activeWar?.started_at ? Math.min(3, Math.floor((Date.now() - new Date(activeWar.started_at).getTime()) / 86400000) + 1) : 1
  const hoursToNextDay = activeWar?.started_at ? 24 - ((Date.now() - new Date(activeWar.started_at).getTime()) / 3600000) % 24 : 0

  // Resumen de roles por equipo
  const myTeam = participants.filter(p => p.league_id === myLeagueId)
  const enemyTeam = participants.filter(p => p.league_id !== myLeagueId)
  const roleCount = (team) => {
    const counts = { attacker: 0, defender: 0, spy: 0 }
    team.forEach(p => { counts[p.role || 'attacker']++ }); return counts
  }
  const myRoleCounts = roleCount(myTeam)
  const enemyRoleCounts = roleCount(enemyTeam)
  const pendingRoles = myTeam.filter(p => !p.role_chosen).length

  const Avatar = ({ url, username, size = 'sm' }) => {
    const dim = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10'
    return url ? <img src={url} alt={username} className={`${dim} rounded-full object-cover flex-shrink-0`} />
      : <div className={`${dim} rounded-full flex items-center justify-center flex-shrink-0 text-sm`} style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }} className="text-4xl">⚔️</motion.div>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>

      {showConfetti && <Confetti />}

      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-2xl font-bold">⚔️ Guerra de Clanes</h1>
          <motion.button whileTap={{ scale: 0.9 }} onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
            <motion.span animate={refreshing ? { rotate: 360 } : {}} transition={{ duration: 1, repeat: refreshing ? Infinity : 0, ease: 'linear' }} className="block text-sm">🔄</motion.span>
          </motion.button>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Roles · Misiones · Eventos en tiempo real</p>
        <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
          {[{ id: 'war', label: '⚔️ Guerra' }, { id: 'challenge', label: '🏴 Declarar' }].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className="relative flex-1 py-2 rounded-lg text-sm font-medium transition-colors z-10"
              style={{ color: tab === t.id ? '#fff' : 'var(--text-muted)' }}>
              {tab === t.id && <motion.div layoutId="war-tab" className="absolute inset-0 rounded-lg" style={{ zIndex: -1, backgroundColor: '#dc2626' }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Msg */}
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
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setTab('challenge')} className="mt-6 px-6 py-3 rounded-2xl font-bold text-white" style={{ backgroundColor: '#dc2626' }}>
                  🏴 Declarar guerra
                </motion.button>
              )}
            </div>
          ) : (
            <>
              {/* ── AVISO ROL PENDIENTE ── */}
              <AnimatePresence>
                {activeWar.status === 'active' && myParticipation && !roleChosen && (
                  <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }}
                    className="rounded-2xl p-4 mb-4 flex items-center gap-3 cursor-pointer"
                    style={{ backgroundColor: 'rgba(239,68,68,0.12)', border: '2px solid rgba(239,68,68,0.5)' }}
                    onClick={() => setShowRoleModal(true)}>
                    <motion.span className="text-2xl flex-shrink-0" animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: Infinity }}>⚠️</motion.span>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-sm text-red-400">¡Elige tu rol de guerra!</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Ahora eres Atacante por defecto. Toca para elegir tu estrategia.</p>
                    </div>
                    <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1, repeat: Infinity }} className="text-red-400 text-lg flex-shrink-0">›</motion.span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── DÍA DE GUERRA ── */}
              {activeWar.status === 'active' && (
                <div className="rounded-2xl p-3 mb-4 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div className="flex gap-1.5">
                    {[1, 2, 3].map(d => (
                      <div key={d} className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                        style={{
                          backgroundColor: d < today ? 'rgba(16,185,129,0.2)' : d === today ? '#dc2626' : 'var(--bg-input)',
                          color: d < today ? '#10b981' : d === today ? '#fff' : 'var(--text-hint)',
                          border: d === today ? '2px solid #ef4444' : '2px solid transparent',
                        }}>
                        {d < today ? '✓' : `D${d}`}
                      </div>
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold">Día {today} de 3</p>
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                      {today < 3 ? `Nuevas misiones en ${Math.floor(hoursToNextDay)}h` : `Acaba en ${formatTimeLeft(activeWar.ends_at)}`}
                    </p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg font-bold text-red-400" style={{ backgroundColor: 'rgba(220,38,38,0.1)' }}>
                    {formatTimeLeft(activeWar.ends_at)}
                  </span>
                </div>
              )}

              {/* ── MARCADOR ── */}
              <div className="rounded-2xl p-4 mb-4" style={{
                background: activeWar.status === 'pending'
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))'
                  : 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))',
                border: `1px solid ${activeWar.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'rgba(220,38,38,0.3)'}`,
              }}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${activeWar.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {activeWar.status === 'pending' ? '⏳ Pendiente' : '⚔️ En curso'}
                  </span>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm truncate mb-1">{myLeagueName || activeWar.challenger?.name}</p>
                    {activeWar.status === 'active' && (
                      <>
                        <motion.p key={myTotalPoints} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-3xl font-black text-red-400">{myTotalPoints}</motion.p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{myWarPoints} + {myMissionsPoints}🎯</p>
                      </>
                    )}
                  </div>
                  <div className="text-xl font-black mx-4 flex-shrink-0" style={{ color: 'var(--text-hint)' }}>VS</div>
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm truncate mb-1">{enemyLeagueName || activeWar.defender?.name}</p>
                    {activeWar.status === 'active' && (
                      <>
                        <motion.p key={enemyTotalPoints} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-3xl font-black text-indigo-400">{enemyTotalPoints}</motion.p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{enemyWarPoints} + {enemyMissionsPoints}🎯</p>
                      </>
                    )}
                  </div>
                </div>

                {activeWar.status === 'active' && myTotalPoints + enemyTotalPoints > 0 && (
                  <div>
                    <div className="w-full h-3 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--bg-input)' }}>
                      <motion.div className="h-full bg-red-500"
                        animate={{ width: `${(myTotalPoints / (myTotalPoints + enemyTotalPoints)) * 100}%` }}
                        transition={{ duration: 0.8, type: 'spring' }} />
                      <motion.div className="h-full bg-indigo-500"
                        animate={{ width: `${(enemyTotalPoints / (myTotalPoints + enemyTotalPoints)) * 100}%` }}
                        transition={{ duration: 0.8, type: 'spring' }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1 font-bold">
                      <span className="text-red-400">{myLeagueName}</span>
                      <span className="text-indigo-400">{enemyLeagueName}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Aceptar / Cancelar */}
              {activeWar.status === 'pending' && isDefenderOwner && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleAcceptWar} disabled={accepting}
                  className="w-full py-4 rounded-2xl font-bold text-white mb-3" style={{ backgroundColor: '#dc2626' }}>
                  {accepting ? 'Iniciando guerra...' : '⚔️ Aceptar la guerra'}
                </motion.button>
              )}
              {activeWar.status === 'pending' && isChallengerOwner && !isDefenderOwner && (
                <div className="mb-4 space-y-3">
                  <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
                    <p className="text-sm text-amber-400 font-medium">⏳ Esperando que {activeWar.defender?.name} acepte...</p>
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowCancelConfirm(true)}
                    className="w-full py-3 rounded-2xl font-bold text-sm border" style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.3)' }}>
                    🚫 Cancelar declaración
                  </motion.button>
                </div>
              )}

              {/* ── MI ROL ── */}
              {activeWar.status === 'active' && myParticipation && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowRoleModal(true)}
                  className="w-full rounded-2xl p-4 mb-4 flex items-center gap-3"
                  style={{ backgroundColor: roleInfo.bg, border: `2px solid ${roleChosen ? roleInfo.border : 'rgba(239,68,68,0.5)'}` }}>
                  <span className="text-3xl">{roleInfo.emoji}</span>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-black text-sm" style={{ color: roleInfo.color }}>Tu rol: {roleInfo.label}</p>
                      {roleChosen
                        ? <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>✓ Elegido</span>
                        : <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>Por defecto</span>}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{roleInfo.desc}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg flex-shrink-0" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>Cambiar</span>
                </motion.button>
              )}

              {/* ── RESUMEN ROLES DEL EQUIPO ── */}
              {activeWar.status === 'active' && myTeam.length > 0 && (
                <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-bold">🧩 Composición de equipos</p>
                    {pendingRoles > 0 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                        {pendingRoles} sin elegir
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[{ name: myLeagueName, counts: myRoleCounts, color: '#ef4444' }, { name: enemyLeagueName, counts: enemyRoleCounts, color: '#6366f1' }].map((team, ti) => (
                      <div key={ti} className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-input)' }}>
                        <p className="text-xs font-bold truncate mb-2" style={{ color: ti === 0 ? '#ef4444' : '#818cf8' }}>{team.name}</p>
                        {Object.entries(ROLE_INFO).map(([role, info]) => (
                          <div key={role} className="flex items-center justify-between text-xs mb-1">
                            <span style={{ color: 'var(--text-hint)' }}>{info.emoji} {info.label}</span>
                            <span className="font-bold" style={{ color: team.counts[role] > 0 ? info.color : 'var(--text-hint)' }}>{team.counts[role]}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── MISIONES DEL DÍA ── */}
              {activeWar.status === 'active' && missions.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-bold mb-2">📋 Misiones — Día {today}</p>
                  <div className="space-y-2">
                    {missions.map(m => {
                      const info = MISSION_LABELS[m.mission_type] || { emoji: '🎯', label: m.mission_type }
                      const pct = Math.min(100, Math.round((m.current_value / m.target_value) * 100))
                      return (
                        <motion.div key={m.id} layout className="rounded-2xl p-3"
                          style={{ backgroundColor: 'var(--bg-card)', border: m.completed ? '1px solid rgba(16,185,129,0.35)' : '1px solid transparent' }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span>{info.emoji}</span>
                              <p className="text-sm font-medium">{info.label}</p>
                            </div>
                            {m.completed
                              ? <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-xs font-black text-emerald-400">✅ +{m.bonus_points}pts</motion.span>
                              : <span className="text-xs font-bold" style={{ color: 'var(--text-hint)' }}>{m.current_value}/{m.target_value}</span>}
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                            <motion.div className={`h-full rounded-full ${m.completed ? 'bg-emerald-500' : 'bg-red-500'}`}
                              animate={{ width: `${pct}%` }} transition={{ duration: 0.6, type: 'spring' }} />
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── MISIONES RIVALES (espía) ── */}
              {activeWar.status === 'active' && currentRole === 'spy' && enemyMissions.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-bold">🕵️ Misiones rivales</p>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Solo visible para espías</span>
                  </div>
                  <div className="space-y-2">
                    {enemyMissions.map(m => {
                      const info = MISSION_LABELS[m.mission_type] || { emoji: '🎯', label: m.mission_type }
                      const pct = Math.min(100, Math.round((m.current_value / m.target_value) * 100))
                      return (
                        <div key={m.id} className="rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.15)', opacity: 0.85 }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2"><span>{info.emoji}</span><p className="text-sm font-medium">{info.label}</p></div>
                            <span className="text-xs font-bold" style={{ color: 'var(--text-hint)' }}>{m.current_value}/{m.target_value}</span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                            <motion.div className="h-full rounded-full bg-amber-500" animate={{ width: `${pct}%` }} transition={{ duration: 0.6 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ── EVENTOS ── */}
              {activeWar.status === 'active' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">⚡ Eventos activos</p>
                      {lastEventCheck > 12 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>Auto-generado</span>}
                    </div>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleGenerateEvent}
                      disabled={generatingEvent || events.length >= 3}
                      className="text-xs px-3 py-1.5 rounded-xl font-bold"
                      style={{
                        backgroundColor: events.length >= 3 ? 'var(--bg-input)' : 'rgba(245,158,11,0.12)',
                        color: events.length >= 3 ? 'var(--text-hint)' : '#f59e0b',
                        border: `1px solid ${events.length >= 3 ? 'transparent' : 'rgba(245,158,11,0.2)'}`,
                        opacity: events.length >= 3 ? 0.5 : 1,
                      }}>
                      {generatingEvent ? '...' : events.length >= 3 ? '🔒 Lleno' : '🎲 Generar'}
                    </motion.button>
                  </div>
                  {events.length === 0 ? (
                    <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-hint)' }}>Sin eventos activos</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {events.map(ev => (
                        <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                          className="rounded-2xl p-3 flex items-start gap-3"
                          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="text-xl flex-shrink-0">⚡</motion.span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{ev.description}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                              {ev.leagues?.name} · Expira en {formatTimeLeft(ev.expires_at)}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── PARTICIPANTES ── */}
              {activeWar.status === 'active' && participants.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-bold mb-2">👥 Participantes</p>
                  <div className="space-y-2">
                    {participants.filter(p => p.profiles).map(p => {
                      const isMe = p.user_id === user.id
                      const rInfo = ROLE_INFO[p.role || 'attacker']
                      const isMyTeam = p.league_id === myLeagueId
                      return (
                        <motion.div key={p.id} variants={staggerItem} initial="initial" animate="animate"
                          className="rounded-2xl p-3 flex items-center gap-3"
                          style={{ backgroundColor: 'var(--bg-card)', border: isMe ? `2px solid ${rInfo.color}` : '2px solid transparent' }}>
                          <Avatar url={p.profiles?.avatar_url} username={p.profiles?.username} size="md" />
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm">{p.profiles?.username} {isMe && '(tú)'}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: rInfo.bg, color: rInfo.color }}>{rInfo.emoji} {rInfo.label}</span>
                              {p.role_chosen
                                ? <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: 'rgba(16,185,129,0.1)', color: '#10b981' }}>✓ Listo</span>
                                : <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-hint)' }}>Pendiente</span>}
                            </div>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: isMyTeam ? 'rgba(220,38,38,0.1)' : 'rgba(99,102,241,0.1)', color: isMyTeam ? '#ef4444' : '#818cf8' }}>
                            {isMyTeam ? '⚔️' : '🛡️'}
                          </span>
                        </motion.div>
                      )
                    })}
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
              <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)' }}>
                <p className="text-sm font-bold text-red-400 mb-3">📜 Reglas de guerra 2.0</p>
                <div className="space-y-2">
                  {[
                    { emoji: '🗡️', role: 'Atacante', desc: 'Consumiciones x2 puntos de guerra' },
                    { emoji: '🛡️', role: 'Defensor', desc: 'Reduce los puntos robables por el rival' },
                    { emoji: '🕵️', role: 'Espía',    desc: 'Ve misiones rivales · x0.5 puntos' },
                    { emoji: '📋', role: 'Misiones', desc: '2 misiones diarias por liga · puntos extra' },
                    { emoji: '⚡', role: 'Eventos',  desc: 'Aleatorios cada 12h · cambian la guerra' },
                    { emoji: '🏆', role: 'Victoria', desc: `Más puntos totales al día 3 · ${REWARD_COINS.toLocaleString()}🪙 por miembro` },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-sm flex-shrink-0">{item.emoji}</span>
                      <p className="text-xs"><span className="font-bold" style={{ color: 'var(--text-muted)' }}>{item.role}</span> — <span style={{ color: 'var(--text-hint)' }}>{item.desc}</span></p>
                    </div>
                  ))}
                </div>
              </div>

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
              <div className="space-y-2 mb-6">
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

      {/* ── MODAL SELECCIÓN DE ROL ── */}
      <AnimatePresence>
        {showRoleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 flex items-end justify-center z-50"
            onClick={() => { if (roleChosen) setShowRoleModal(false) }}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 400, damping: 40 }}
              onClick={e => e.stopPropagation()}
              className="rounded-t-3xl w-full max-w-lg overflow-y-auto"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', maxHeight: '90vh', paddingBottom: '32px' }}>
              <div className="px-5 pt-5 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black">⚔️ Elige tu rol</h2>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Define tu estrategia para esta guerra · puedes cambiarlo después</p>
                  </div>
                  {roleChosen && (
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => setShowRoleModal(false)}
                      className="p-2 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
                  )}
                </div>
              </div>
              <div className="px-5 pt-4 space-y-3">
                {Object.entries(ROLE_INFO).map(([role, info]) => (
                  <motion.button key={role} whileTap={{ scale: 0.97 }} onClick={() => handleSelectRole(role)} disabled={selectingRole}
                    className="w-full rounded-2xl p-4 text-left relative overflow-hidden"
                    style={{ backgroundColor: currentRole === role && roleChosen ? info.bg : 'var(--bg-input)', border: currentRole === role && roleChosen ? `2px solid ${info.color}` : '2px solid transparent' }}>
                    {currentRole === role && roleChosen && (
                      <motion.div className="absolute inset-0" style={{ background: `linear-gradient(90deg, transparent, ${info.bg}, transparent)` }}
                        animate={{ x: ['-100%', '200%'] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear', repeatDelay: 2 }} />
                    )}
                    <div className="relative flex items-center gap-4">
                      <span className="text-3xl">{info.emoji}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-black text-sm" style={{ color: currentRole === role && roleChosen ? info.color : 'var(--text-primary)' }}>{info.label}</p>
                          {currentRole === role && roleChosen && <span className="text-xs font-bold" style={{ color: info.color }}>✓ Actual</span>}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{info.desc}</p>
                      </div>
                      <motion.span animate={currentRole !== role ? { x: [0, 3, 0] } : {}} transition={{ duration: 1.5, repeat: Infinity }}
                        style={{ color: currentRole === role && roleChosen ? info.color : 'var(--text-hint)' }} className="text-lg flex-shrink-0">›</motion.span>
                    </div>
                  </motion.button>
                ))}

                {!roleChosen && (
                  <p className="text-xs text-center pt-2" style={{ color: 'var(--text-hint)' }}>
                    ⚠️ Debes elegir un rol para participar activamente en la guerra
                  </p>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MODAL CANCELAR GUERRA ── */}
      <AnimatePresence>
        {showCancelConfirm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50" onClick={() => setShowCancelConfirm(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()} className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🚫</div>
                <h2 className="text-xl font-bold">¿Cancelar la guerra?</h2>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Se retirará la declaración a <strong>{activeWar?.defender?.name}</strong>.</p>
              </div>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowCancelConfirm(false)} className="flex-1 font-semibold py-3 rounded-xl" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>Volver</motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleCancelWar} disabled={cancelling} className="flex-1 font-bold py-3 rounded-xl text-white disabled:opacity-50" style={{ backgroundColor: '#ef4444' }}>{cancelling ? 'Cancelando...' : 'Sí, cancelar'}</motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}