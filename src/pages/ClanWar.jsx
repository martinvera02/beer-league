import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { staggerItem } from '../lib/animations'
import { soundSuccess, soundError } from '../lib/sounds'

const REWARD_COINS = 1000

const ROLE_INFO = {
  attacker: { emoji: '🗡️', label: 'Atacante', desc: 'Tus consumiciones suman x2 puntos de guerra', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  defender: { emoji: '🛡️', label: 'Defensor', desc: 'Reduces los puntos que el rival puede robar', color: '#6366f1', bg: 'rgba(99,102,241,0.15)' },
  spy:      { emoji: '🕵️', label: 'Espía',    desc: 'Ves las misiones rivales · tus consumiciones suman x0.5', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
}

const MISSION_LABELS = {
  drink_count:    { emoji: '🍺', label: 'Consumiciones' },
  unique_members: { emoji: '👥', label: 'Miembros activos' },
  night_drink:    { emoji: '🌙', label: 'Consumiciones nocturnas' },
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

  useEffect(() => { fetchData() }, [])

  const showMsg = (success, text) => { setMsg({ success, text }); setTimeout(() => setMsg(null), 4000) }

  const fetchData = async () => {
    setLoading(true)
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

        // Misiones propias y rivales (si eres espía)
        const myLeagueId = part?.league_id
        if (myLeagueId) {
          const today = warData.started_at ? Math.min(3, Math.floor((Date.now() - new Date(warData.started_at).getTime()) / 86400000) + 1) : 1
          const { data: myMissions } = await supabase.from('war_missions').select('*').eq('war_id', warData.id).eq('league_id', myLeagueId).eq('day', today)
          setMissions(myMissions || [])

          if (part?.role === 'spy') {
            const enemyLeagueId = myLeagueId === warData.challenger_league_id ? warData.defender_league_id : warData.challenger_league_id
            const { data: eMissions } = await supabase.from('war_missions').select('*').eq('war_id', warData.id).eq('league_id', enemyLeagueId).eq('day', today)
            setEnemyMissions(eMissions || [])
          }
        }

        // Eventos activos
        const { data: eventsData } = await supabase.from('war_events').select('*, leagues(name)').eq('war_id', warData.id).eq('active', true).gt('expires_at', new Date().toISOString())
        setEvents(eventsData || [])
      } else {
        setActiveWar(null); setMyParticipation(null); setParticipants([]); setMissions([]); setEnemyMissions([]); setEvents([])
      }
    }

    const { data: allL } = await supabase.from('leagues').select('id, name').order('name')
    setAllLeagues(allL || [])
    setLoading(false)
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
      ...(challengerMembers || []).map(m => ({ war_id: activeWar.id, user_id: m.user_id, league_id: activeWar.challenger_league_id, role: 'attacker' })),
      ...(defenderMembers || []).map(m => ({ war_id: activeWar.id, user_id: m.user_id, league_id: activeWar.defender_league_id, role: 'attacker' })),
    ]
    await supabase.from('clan_war_participants').upsert(allParticipants, { onConflict: 'war_id,user_id' })

    // Generar misiones
    await supabase.rpc('generate_war_missions', { p_war_id: activeWar.id, p_challenger_id: activeWar.challenger_league_id, p_defender_id: activeWar.defender_league_id })

    soundSuccess(); showMsg(true, '⚔️ ¡Guerra aceptada! Elige tu rol para empezar.')
    setAccepting(false); fetchData(); setShowRoleModal(true)
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
    await supabase.from('clan_war_participants').update({ role }).eq('war_id', activeWar.id).eq('user_id', user.id)
    soundSuccess(); showMsg(true, `${ROLE_INFO[role].emoji} Rol seleccionado: ${ROLE_INFO[role].label}`)
    setSelectingRole(false); setShowRoleModal(false); fetchData()
  }

  const handleGenerateEvent = async () => {
    if (!activeWar || generatingEvent) return
    setGeneratingEvent(true)
    const { data, error } = await supabase.rpc('generate_war_event', {
      p_war_id: activeWar.id,
      p_challenger_id: activeWar.challenger_league_id,
      p_defender_id: activeWar.defender_league_id,
    })
    if (error) { soundError(); showMsg(false, 'Error al generar evento') }
    else { soundSuccess(); showMsg(true, data?.description || '⚡ Nuevo evento activado'); fetchData() }
    setGeneratingEvent(false)
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
  const today = activeWar?.started_at ? Math.min(3, Math.floor((Date.now() - new Date(activeWar.started_at).getTime()) / 86400000) + 1) : 1

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

      {/* Header */}
      <div className="px-4 pt-6 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <h1 className="text-2xl font-bold mb-1">⚔️ Guerra de Clanes</h1>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>Roles, misiones y eventos · Estrategia en tiempo real</p>
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
              {/* Marcador */}
              <div className="rounded-2xl p-4 mb-4" style={{
                background: activeWar.status === 'pending'
                  ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))'
                  : 'linear-gradient(135deg, rgba(220,38,38,0.15), rgba(220,38,38,0.05))',
                border: `1px solid ${activeWar.status === 'pending' ? 'rgba(245,158,11,0.3)' : 'rgba(220,38,38,0.3)'}`,
              }}>
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${activeWar.status === 'pending' ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'}`}>
                    {activeWar.status === 'pending' ? '⏳ Pendiente' : activeWar.status === 'active' ? '⚔️ En curso' : '🏁 Finalizada'}
                  </span>
                  {activeWar.status === 'active' && <span className="text-xs font-medium" style={{ color: 'var(--text-hint)' }}>⏱ {formatTimeLeft(activeWar.ends_at)}</span>}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm truncate">{myLeagueName || activeWar.challenger?.name}</p>
                    {activeWar.status === 'active' && (
                      <>
                        <p className="text-2xl font-black text-red-400 mt-1">{myTotalPoints}</p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{myWarPoints} consumo + {myMissionsPoints} misiones</p>
                      </>
                    )}
                  </div>
                  <div className="text-2xl font-black mx-3" style={{ color: 'var(--text-hint)' }}>VS</div>
                  <div className="flex-1 text-center">
                    <p className="font-black text-sm truncate">{enemyLeagueName || activeWar.defender?.name}</p>
                    {activeWar.status === 'active' && (
                      <>
                        <p className="text-2xl font-black text-red-400 mt-1">{enemyTotalPoints}</p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>{enemyWarPoints} consumo + {enemyMissionsPoints} misiones</p>
                      </>
                    )}
                  </div>
                </div>

                {/* Barra de progreso */}
                {activeWar.status === 'active' && myTotalPoints + enemyTotalPoints > 0 && (
                  <div className="mt-3">
                    <div className="w-full h-2.5 rounded-full overflow-hidden flex" style={{ backgroundColor: 'var(--bg-input)' }}>
                      <motion.div className="h-full bg-red-500 rounded-l-full"
                        animate={{ width: `${(myTotalPoints / (myTotalPoints + enemyTotalPoints)) * 100}%` }}
                        transition={{ duration: 0.6 }} />
                      <motion.div className="h-full bg-indigo-500 rounded-r-full"
                        animate={{ width: `${(enemyTotalPoints / (myTotalPoints + enemyTotalPoints)) * 100}%` }}
                        transition={{ duration: 0.6 }} />
                    </div>
                    <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                      <span className="text-red-400 font-bold">{myLeagueName}</span>
                      <span className="text-indigo-400 font-bold">{enemyLeagueName}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Aceptar / Cancelar */}
              {activeWar.status === 'pending' && isDefenderOwner && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleAcceptWar} disabled={accepting}
                  className="w-full py-4 rounded-2xl font-bold text-white mb-3" style={{ backgroundColor: '#dc2626' }}>
                  {accepting ? 'Aceptando...' : '⚔️ Aceptar la guerra'}
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

              {/* Mi rol */}
              {activeWar.status === 'active' && myParticipation && (
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setShowRoleModal(true)}
                  className="w-full rounded-2xl p-4 mb-4 flex items-center gap-3"
                  style={{ backgroundColor: roleInfo.bg, border: `2px solid ${roleInfo.color}` }}>
                  <span className="text-3xl">{roleInfo.emoji}</span>
                  <div className="flex-1 text-left">
                    <p className="font-black text-sm" style={{ color: roleInfo.color }}>Tu rol: {roleInfo.label}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{roleInfo.desc}</p>
                  </div>
                  <span className="text-xs px-2 py-1 rounded-lg" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>Cambiar</span>
                </motion.button>
              )}

              {/* Misiones del día */}
              {activeWar.status === 'active' && missions.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-bold mb-2">📋 Misiones del día {today}</p>
                  <div className="space-y-2">
                    {missions.map(m => {
                      const info = MISSION_LABELS[m.mission_type] || { emoji: '🎯', label: m.mission_type }
                      const pct = Math.min(100, Math.round((m.current_value / m.target_value) * 100))
                      return (
                        <div key={m.id} className="rounded-2xl p-3" style={{ backgroundColor: 'var(--bg-card)', border: m.completed ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent' }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span>{info.emoji}</span>
                              <p className="text-sm font-medium">{info.label}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {m.completed
                                ? <span className="text-xs font-bold text-emerald-400">✅ +{m.bonus_points}pts</span>
                                : <span className="text-xs" style={{ color: 'var(--text-hint)' }}>{m.current_value}/{m.target_value}</span>}
                            </div>
                          </div>
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                            <motion.div className={`h-full rounded-full ${m.completed ? 'bg-emerald-500' : 'bg-red-500'}`}
                              animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Misiones del rival (solo espías) */}
              {activeWar.status === 'active' && currentRole === 'spy' && enemyMissions.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-bold mb-2">🕵️ Misiones rivales <span className="text-xs font-normal" style={{ color: 'var(--text-hint)' }}>(solo visible para espías)</span></p>
                  <div className="space-y-2">
                    {enemyMissions.map(m => {
                      const info = MISSION_LABELS[m.mission_type] || { emoji: '🎯', label: m.mission_type }
                      const pct = Math.min(100, Math.round((m.current_value / m.target_value) * 100))
                      return (
                        <div key={m.id} className="rounded-2xl p-3 opacity-80" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2"><span>{info.emoji}</span><p className="text-sm font-medium">{info.label}</p></div>
                            <span className="text-xs" style={{ color: 'var(--text-hint)' }}>{m.current_value}/{m.target_value}</span>
                          </div>
                          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-input)' }}>
                            <motion.div className="h-full rounded-full bg-amber-500" animate={{ width: `${pct}%` }} transition={{ duration: 0.5 }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Eventos activos */}
              {activeWar.status === 'active' && (
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-bold">⚡ Eventos activos</p>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={handleGenerateEvent} disabled={generatingEvent}
                      className="text-xs px-3 py-1.5 rounded-xl font-bold"
                      style={{ backgroundColor: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
                      {generatingEvent ? '...' : '🎲 Generar'}
                    </motion.button>
                  </div>
                  {events.length === 0 ? (
                    <div className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-hint)' }}>Sin eventos activos · Genera uno para sorprender</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {events.map(ev => (
                        <motion.div key={ev.id} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                          className="rounded-2xl p-3 flex items-start gap-3"
                          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.2)' }}>
                          <span className="text-xl flex-shrink-0">⚡</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{ev.description}</p>
                            <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                              Afecta a: {ev.leagues?.name || '—'} · Expira en {formatTimeLeft(ev.expires_at)}
                            </p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Participantes */}
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
                            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: rInfo.bg, color: rInfo.color }}>{rInfo.emoji} {rInfo.label}</span>
                          </div>
                          <span className="text-xs px-2 py-1 rounded-full flex-shrink-0" style={{ backgroundColor: isMyTeam ? 'rgba(220,38,38,0.1)' : 'rgba(99,102,241,0.1)', color: isMyTeam ? '#ef4444' : '#818cf8' }}>
                            {isMyTeam ? myLeagueName : enemyLeagueName}
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
                <p className="text-sm font-bold text-red-400 mb-2">📜 Reglas de guerra 2.0</p>
                <div className="space-y-1.5 text-xs" style={{ color: 'var(--text-hint)' }}>
                  <p>🗡️ <strong style={{ color: 'var(--text-muted)' }}>Atacante</strong> — consumiciones x2 puntos de guerra</p>
                  <p>🛡️ <strong style={{ color: 'var(--text-muted)' }}>Defensor</strong> — reduce puntos robables</p>
                  <p>🕵️ <strong style={{ color: 'var(--text-muted)' }}>Espía</strong> — ve misiones rivales · x0.5 puntos</p>
                  <p>📋 Misiones diarias dan puntos extra al equipo</p>
                  <p>⚡ Eventos aleatorios cambian la guerra cada 12h</p>
                  <p>🏆 Gana la liga con más puntos totales al final · {REWARD_COINS.toLocaleString()}🪙 por miembro</p>
                </div>
              </div>

              <p className="text-sm font-bold mb-2">⚔️ Tu liga (atacante)</p>
              <div className="space-y-2 mb-4">
                {myLeagues.filter(l => myRole[l.id] === 'owner' || myRole[l.id] === 'admin').map(league => (
                  <motion.button key={league.id} whileTap={{ scale: 0.96 }} onClick={() => setSelectedChallenger(league)}
                    className="w-full rounded-2xl p-4 text-left"
                    style={{ backgroundColor: selectedChallenger?.id === league.id ? 'rgba(220,38,38,0.15)' : 'var(--bg-card)', border: selectedChallenger?.id === league.id ? '2px solid #dc2626' : '2px solid transparent' }}>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm">{league.name}</p>
                      {selectedChallenger?.id === league.id && <span className="text-red-400">✓</span>}
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
                      {selectedDefender?.id === league.id && <span className="text-red-400">✓</span>}
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

      {/* Modal selección de rol */}
      <AnimatePresence>
        {showRoleModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setShowRoleModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.85, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}>
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">⚔️</div>
                <h2 className="text-xl font-bold">Elige tu rol</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Tu estrategia para esta guerra</p>
              </div>
              <div className="space-y-3">
                {Object.entries(ROLE_INFO).map(([role, info]) => (
                  <motion.button key={role} whileTap={{ scale: 0.97 }} onClick={() => handleSelectRole(role)} disabled={selectingRole}
                    className="w-full rounded-2xl p-4 text-left"
                    style={{ backgroundColor: currentRole === role ? info.bg : 'var(--bg-input)', border: currentRole === role ? `2px solid ${info.color}` : '2px solid transparent' }}>
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{info.emoji}</span>
                      <div className="flex-1">
                        <p className="font-bold text-sm" style={{ color: currentRole === role ? info.color : 'var(--text-primary)' }}>{info.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>{info.desc}</p>
                      </div>
                      {currentRole === role && <span style={{ color: info.color }}>✓</span>}
                    </div>
                  </motion.button>
                ))}
              </div>
              <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowRoleModal(false)}
                className="w-full mt-4 font-semibold py-3 rounded-xl text-sm" style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                Cerrar
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal cancelar guerra */}
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