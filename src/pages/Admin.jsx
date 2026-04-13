import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fadeIn, staggerItem } from '../lib/animations'

export default function Admin({ onClose }) {
  const { user } = useAuth()
  const [section, setSection] = useState('stats')
  const [loading, setLoading] = useState(true)

  // Stats
  const [stats, setStats] = useState(null)

  // Usuarios
  const [users, setUsers] = useState([])
  const [userSearch, setUserSearch] = useState('')
  const [editingUser, setEditingUser] = useState(null)
  const [banReason, setBanReason] = useState('')

  // Ligas
  const [leagues, setLeagues] = useState([])
  const [leagueSearch, setLeagueSearch] = useState('')
  const [editingLeague, setEditingLeague] = useState(null)
  const [newLeagueName, setNewLeagueName] = useState('')

  // Consumiciones
  const [drinks, setDrinks] = useState([])
  const [drinkSearch, setDrinkSearch] = useState('')

  // Mercado
  const [market, setMarket] = useState([])
  const [editingPrice, setEditingPrice] = useState(null)
  const [newPrice, setNewPrice] = useState('')

  // Powerups
  const [powerups, setPowerups] = useState([])

  // Logs
  const [logs, setLogs] = useState([])

  useEffect(() => { fetchAll() }, [])

  const fetchAll = async () => {
    setLoading(true)
    await Promise.all([
      fetchStats(),
      fetchUsers(),
      fetchLeagues(),
      fetchDrinks(),
      fetchMarket(),
      fetchPowerups(),
      fetchLogs(),
    ])
    setLoading(false)
  }

  const fetchStats = async () => {
    const [
      { count: totalUsers },
      { count: totalDrinks },
      { count: totalLeagues },
      { count: totalMessages },
      { count: totalPosts },
      { data: topDrinker },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('drinks').select('*', { count: 'exact', head: true }),
      supabase.from('leagues').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('posts').select('*', { count: 'exact', head: true }),
      supabase.from('global_rankings').select('username, total_points').order('total_points', { ascending: false }).limit(1),
    ])
    setStats({ totalUsers, totalDrinks, totalLeagues, totalMessages, totalPosts, topDrinker: topDrinker?.[0] })
  }

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, wallets(balance)')
      .order('created_at', { ascending: false })
    setUsers(data || [])
  }

  const fetchLeagues = async () => {
    const { data } = await supabase
      .from('leagues')
      .select('*, profiles(username), league_members(count)')
      .order('created_at', { ascending: false })
    setLeagues(data || [])
  }

  const fetchDrinks = async () => {
    const { data } = await supabase
      .from('drinks')
      .select('*, profiles(username), drink_types(name, emoji), leagues(name)')
      .order('consumed_at', { ascending: false })
      .limit(100)
    setDrinks(data || [])
  }

  const fetchMarket = async () => {
    const { data } = await supabase
      .from('drink_market')
      .select('*, drink_types(name, emoji, points)')
      .order('drink_type_id')
    setMarket(data || [])
  }

  const fetchPowerups = async () => {
    const { data } = await supabase
      .from('active_powerups')
      .select('*, profiles(username), powerup_catalog(name, emoji, effect_type), leagues(name)')
      .eq('active', true)
      .order('created_at', { ascending: false })
    setPowerups(data || [])
  }

  const fetchLogs = async () => {
    const { data } = await supabase
      .from('activity_logs')
      .select('*, profiles(username)')
      .order('created_at', { ascending: false })
      .limit(50)
    setLogs(data || [])
  }

  // Acciones usuarios
  const toggleBan = async (u) => {
    const newBanned = !u.is_banned
    await supabase.from('profiles').update({
      is_banned: newBanned,
      ban_reason: newBanned ? banReason || 'Baneado por admin' : null,
    }).eq('id', u.id)
    await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_action: newBanned ? 'BAN_USER' : 'UNBAN_USER',
      p_details: { target_user: u.username },
    })
    setBanReason('')
    setEditingUser(null)
    fetchUsers()
  }

  const deleteUser = async (u) => {
    if (!confirm(`¿Eliminar cuenta de ${u.username}? Esta acción no se puede deshacer.`)) return
    await supabase.from('profiles').delete().eq('id', u.id)
    await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_action: 'DELETE_USER',
      p_details: { target_user: u.username },
    })
    fetchUsers()
  }

  const adjustBalance = async (u, amount) => {
    await supabase.from('wallets').update({ balance: Math.max(0, (u.wallets?.balance || 0) + amount) }).eq('user_id', u.id)
    await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_action: 'ADJUST_BALANCE',
      p_details: { target_user: u.username, amount },
    })
    fetchUsers()
  }

  // Acciones ligas
  const saveLeagueName = async () => {
    if (!newLeagueName.trim() || !editingLeague) return
    await supabase.from('leagues').update({ name: newLeagueName.trim() }).eq('id', editingLeague.id)
    await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_action: 'EDIT_LEAGUE',
      p_details: { league_id: editingLeague.id, new_name: newLeagueName.trim() },
    })
    setEditingLeague(null)
    fetchLeagues()
  }

  const deleteLeague = async (l) => {
    if (!confirm(`¿Eliminar la liga "${l.name}"? Se borrarán todos sus datos.`)) return
    await supabase.from('leagues').delete().eq('id', l.id)
    await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_action: 'DELETE_LEAGUE',
      p_details: { league_name: l.name },
    })
    fetchLeagues()
  }

  // Acciones consumiciones
  const deleteDrink = async (d) => {
    await supabase.from('drinks').delete().eq('drink_group_id', d.drink_group_id)
    await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_action: 'DELETE_DRINK',
      p_details: { user: d.profiles?.username, drink: d.drink_types?.name },
    })
    fetchDrinks()
  }

  // Acciones mercado
  const savePrice = async () => {
    if (!editingPrice || !newPrice) return
    const price = parseFloat(newPrice)
    if (isNaN(price) || price < 1) return
    await supabase.from('drink_market').update({ price }).eq('drink_type_id', editingPrice.drink_type_id)
    await supabase.from('drink_market_history').insert({ drink_type_id: editingPrice.drink_type_id, price })
    await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_action: 'EDIT_MARKET_PRICE',
      p_details: { drink: editingPrice.drink_types?.name, new_price: price },
    })
    setEditingPrice(null)
    setNewPrice('')
    fetchMarket()
  }

  // Acciones powerups
  const deactivatePowerup = async (p) => {
    await supabase.from('active_powerups').update({ active: false }).eq('id', p.id)
    await supabase.rpc('log_activity', {
      p_user_id: user.id,
      p_action: 'DEACTIVATE_POWERUP',
      p_details: { powerup: p.powerup_catalog?.name, user: p.profiles?.username },
    })
    fetchPowerups()
  }

  const formatTime = (ts) => new Date(ts).toLocaleString('es-ES', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit'
  })

  const sections = [
    { id: 'stats',    emoji: '📊', label: 'Stats' },
    { id: 'users',    emoji: '👥', label: 'Usuarios' },
    { id: 'leagues',  emoji: '🏆', label: 'Ligas' },
    { id: 'drinks',   emoji: '🍺', label: 'Consumiciones' },
    { id: 'market',   emoji: '📈', label: 'Mercado' },
    { id: 'powerups', emoji: '⚡', label: 'Powerups' },
    { id: 'logs',     emoji: '📋', label: 'Logs' },
  ]

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.id?.includes(userSearch)
  )

  const filteredLeagues = leagues.filter(l =>
    l.name?.toLowerCase().includes(leagueSearch.toLowerCase())
  )

  const filteredDrinks = drinks.filter(d =>
    d.profiles?.username?.toLowerCase().includes(drinkSearch.toLowerCase()) ||
    d.drink_types?.name?.toLowerCase().includes(drinkSearch.toLowerCase())
  )

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex flex-col"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">⚙️</span>
          <div>
            <h1 className="font-bold text-sm">Panel de Control</h1>
            <p className="text-xs" style={{ color: 'var(--text-hint)' }}>God Mode · MVC Productions</p>
          </div>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>✕</motion.button>
      </div>

      {/* Nav horizontal */}
      <div className="flex gap-1 px-3 py-2 overflow-x-auto flex-shrink-0 border-b"
        style={{ borderColor: 'var(--border)' }}>
        {sections.map(s => (
          <motion.button key={s.id} whileTap={{ scale: 0.95 }} onClick={() => setSection(s.id)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors"
            style={{
              backgroundColor: section === s.id ? '#f59e0b' : 'var(--bg-card)',
              color: section === s.id ? '#fff' : 'var(--text-muted)',
            }}>
            <span>{s.emoji}</span>
            <span>{s.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Contenido con scroll */}
      <div className="flex-1 overflow-y-auto px-4 py-4">

        {/* ── ESTADÍSTICAS ── */}
        {section === 'stats' && stats && (
          <motion.div {...fadeIn}>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'Usuarios', value: stats.totalUsers, emoji: '👥' },
                { label: 'Consumiciones', value: stats.totalDrinks, emoji: '🍺' },
                { label: 'Ligas', value: stats.totalLeagues, emoji: '🏆' },
                { label: 'Mensajes', value: stats.totalMessages, emoji: '💬' },
                { label: 'Posts', value: stats.totalPosts, emoji: '📰' },
                { label: 'Top bebedor', value: stats.topDrinker?.username || '—', emoji: '🥇' },
              ].map(stat => (
                <motion.div key={stat.label} variants={staggerItem} initial="initial" animate="animate"
                  className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div className="text-2xl mb-1">{stat.emoji}</div>
                  <p className="text-xl font-bold text-amber-400">{stat.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                </motion.div>
              ))}
            </div>

            <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
              <p className="text-sm font-bold mb-3">Resumen del sistema</p>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'Usuarios registrados', value: stats.totalUsers },
                  { label: 'Consumiciones totales', value: stats.totalDrinks },
                  { label: 'Ligas activas', value: stats.totalLeagues },
                  { label: 'Mensajes en chats', value: stats.totalMessages },
                  { label: 'Posts publicados', value: stats.totalPosts },
                ].map(item => (
                  <div key={item.label} className="flex justify-between items-center py-1.5 border-b last:border-0"
                    style={{ borderColor: 'var(--border)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{item.label}</span>
                    <span className="font-bold text-amber-400">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── USUARIOS ── */}
        {section === 'users' && (
          <motion.div {...fadeIn}>
            <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)}
              placeholder="Buscar por nombre o ID..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />

            <div className="space-y-3">
              {filteredUsers.map(u => (
                <motion.div key={u.id} variants={staggerItem} initial="initial" animate="animate"
                  className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: u.is_banned ? '2px solid #ef4444' : '2px solid transparent' }}>
                  <div className="flex items-center gap-3 mb-3">
                    {u.avatar_url
                      ? <img src={u.avatar_url} className="w-10 h-10 rounded-full object-cover" alt="" />
                      : <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-input)' }}>🍺</div>
                    }
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm">{u.username}</p>
                        {u.is_admin && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-white">Admin</span>}
                        {u.is_banned && <span className="text-xs px-2 py-0.5 rounded-full bg-red-900 text-red-400">Baneado</span>}
                      </div>
                      <p className="text-xs truncate" style={{ color: 'var(--text-hint)' }}>{u.id}</p>
                      <p className="text-xs text-amber-400">🪙 {u.wallets?.balance || 0}</p>
                    </div>
                  </div>

                  {u.is_banned && u.ban_reason && (
                    <p className="text-xs text-red-400 mb-3 px-1">Motivo: {u.ban_reason}</p>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    {/* Ajustar monedas */}
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustBalance(u, 100)}
                      className="text-xs px-3 py-1.5 rounded-xl font-medium"
                      style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                      +100🪙
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => adjustBalance(u, -100)}
                      className="text-xs px-3 py-1.5 rounded-xl font-medium"
                      style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                      -100🪙
                    </motion.button>

                    {/* Ban / Unban */}
                    {!u.is_admin && (
                      u.is_banned ? (
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleBan(u)}
                          className="text-xs px-3 py-1.5 rounded-xl font-medium"
                          style={{ backgroundColor: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
                          Desbanear
                        </motion.button>
                      ) : (
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditingUser(u)}
                          className="text-xs px-3 py-1.5 rounded-xl font-medium"
                          style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                          Banear
                        </motion.button>
                      )
                    )}

                    {/* Eliminar */}
                    {!u.is_admin && (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteUser(u)}
                        className="text-xs px-3 py-1.5 rounded-xl font-medium bg-red-900 text-red-400">
                        Eliminar
                      </motion.button>
                    )}
                  </div>

                  {/* Modal banear */}
                  {editingUser?.id === u.id && (
                    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                      className="mt-3 flex gap-2">
                      <input type="text" value={banReason} onChange={e => setBanReason(e.target.value)}
                        placeholder="Motivo del baneo..."
                        className="flex-1 rounded-xl px-3 py-2 text-xs outline-none"
                        style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => toggleBan(u)}
                        className="text-xs px-3 py-2 rounded-xl bg-red-600 text-white font-bold">
                        Confirmar
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditingUser(null)}
                        className="text-xs px-3 py-2 rounded-xl"
                        style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                        ✕
                      </motion.button>
                    </motion.div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── LIGAS ── */}
        {section === 'leagues' && (
          <motion.div {...fadeIn}>
            <input type="text" value={leagueSearch} onChange={e => setLeagueSearch(e.target.value)}
              placeholder="Buscar liga..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />

            <div className="space-y-3">
              {filteredLeagues.map(l => (
                <motion.div key={l.id} variants={staggerItem} initial="initial" animate="animate"
                  className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>

                  {editingLeague?.id === l.id ? (
                    <div className="flex gap-2 mb-3">
                      <input type="text" value={newLeagueName} onChange={e => setNewLeagueName(e.target.value)}
                        className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                        style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                      <motion.button whileTap={{ scale: 0.9 }} onClick={saveLeagueName}
                        className="text-xs px-3 py-2 rounded-xl bg-amber-500 text-white font-bold">
                        Guardar
                      </motion.button>
                      <motion.button whileTap={{ scale: 0.9 }} onClick={() => setEditingLeague(null)}
                        className="text-xs px-3 py-2 rounded-xl"
                        style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                        ✕
                      </motion.button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-sm">{l.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                          ID: {l.id} · Creador: {l.profiles?.username}
                        </p>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full"
                        style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                        {l.league_members?.[0]?.count || 0} miembros
                      </span>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <motion.button whileTap={{ scale: 0.9 }}
                      onClick={() => { setEditingLeague(l); setNewLeagueName(l.name) }}
                      className="text-xs px-3 py-1.5 rounded-xl font-medium"
                      style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      Editar nombre
                    </motion.button>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteLeague(l)}
                      className="text-xs px-3 py-1.5 rounded-xl font-medium bg-red-900 text-red-400">
                      Eliminar
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── CONSUMICIONES ── */}
        {section === 'drinks' && (
          <motion.div {...fadeIn}>
            <input type="text" value={drinkSearch} onChange={e => setDrinkSearch(e.target.value)}
              placeholder="Buscar por usuario o bebida..."
              className="w-full rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 mb-4"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }} />

            <p className="text-xs mb-3" style={{ color: 'var(--text-hint)' }}>Últimas 100 consumiciones</p>

            <div className="space-y-2">
              {filteredDrinks.map(d => (
                <motion.div key={d.id} variants={staggerItem} initial="initial" animate="animate"
                  className="rounded-2xl p-3 flex items-center gap-3"
                  style={{ backgroundColor: 'var(--bg-card)' }}>
                  <span className="text-2xl flex-shrink-0">{d.drink_types?.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{d.profiles?.username}</p>
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                      {d.drink_types?.name} · {d.points}pts · {d.leagues?.name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                      {formatTime(d.consumed_at)}
                    </p>
                  </div>
                  <motion.button whileTap={{ scale: 0.9 }} onClick={() => deleteDrink(d)}
                    className="text-xs px-3 py-1.5 rounded-xl flex-shrink-0 bg-red-900 text-red-400">
                    Eliminar
                  </motion.button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── MERCADO ── */}
        {section === 'market' && (
          <motion.div {...fadeIn}>
            <p className="text-xs mb-4" style={{ color: 'var(--text-hint)' }}>
              Modifica el precio de cualquier bebida manualmente. El cambio afecta a los puntos en tiempo real.
            </p>
            <div className="space-y-3">
              {market.map(m => {
                const multiplier = Math.max(0.5, Math.min(2.0, m.price / 100))
                const effectivePoints = Math.round(m.drink_types?.points * multiplier * 10) / 10
                return (
                  <motion.div key={m.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-3xl">{m.drink_types?.emoji}</span>
                      <div className="flex-1">
                        <p className="font-bold text-sm">{m.drink_types?.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs" style={{ color: 'var(--text-hint)' }}>
                            Base: {m.drink_types?.points}pts
                          </span>
                          <span className="text-xs font-bold"
                            style={{ color: multiplier > 1 ? '#10b981' : multiplier < 1 ? '#ef4444' : 'var(--text-muted)' }}>
                            → {effectivePoints}pts ahora (x{multiplier.toFixed(1)})
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-amber-400">{parseFloat(m.price).toFixed(0)}🪙</p>
                        <p className="text-xs" style={{ color: 'var(--text-hint)' }}>Vol: {m.volume}</p>
                      </div>
                    </div>

                    {editingPrice?.drink_type_id === m.drink_type_id ? (
                      <div className="flex gap-2">
                        <input type="number" value={newPrice} onChange={e => setNewPrice(e.target.value)}
                          placeholder="Nuevo precio..."
                          className="flex-1 rounded-xl px-3 py-2 text-sm outline-none"
                          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }} />
                        <motion.button whileTap={{ scale: 0.9 }} onClick={savePrice}
                          className="text-xs px-3 py-2 rounded-xl bg-amber-500 text-white font-bold">
                          Aplicar
                        </motion.button>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setEditingPrice(null); setNewPrice('') }}
                          className="text-xs px-3 py-2 rounded-xl"
                          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                          ✕
                        </motion.button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        {[50, 75, 100, 150, 200].map(p => (
                          <motion.button key={p} whileTap={{ scale: 0.9 }}
                            onClick={async () => {
                              await supabase.from('drink_market').update({ price: p }).eq('drink_type_id', m.drink_type_id)
                              await supabase.from('drink_market_history').insert({ drink_type_id: m.drink_type_id, price: p })
                              fetchMarket()
                            }}
                            className="flex-1 text-xs py-1.5 rounded-xl font-medium transition-colors"
                            style={{
                              backgroundColor: Math.round(m.price) === p ? '#f59e0b' : 'var(--bg-input)',
                              color: Math.round(m.price) === p ? '#fff' : 'var(--text-muted)',
                            }}>
                            {p}
                          </motion.button>
                        ))}
                        <motion.button whileTap={{ scale: 0.9 }}
                          onClick={() => { setEditingPrice(m); setNewPrice(String(Math.round(m.price))) }}
                          className="text-xs px-3 py-1.5 rounded-xl font-medium"
                          style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                          Custom
                        </motion.button>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </motion.div>
        )}

        {/* ── POWERUPS ── */}
        {section === 'powerups' && (
          <motion.div {...fadeIn}>
            {powerups.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <div className="text-4xl mb-2">⚡</div>
                <p>No hay powerups activos</p>
              </div>
            ) : (
              <div className="space-y-3">
                {powerups.map(p => (
                  <motion.div key={p.id} variants={staggerItem} initial="initial" animate="animate"
                    className="rounded-2xl p-4 flex items-center gap-3"
                    style={{ backgroundColor: 'var(--bg-card)' }}>
                    <span className="text-3xl flex-shrink-0">{p.powerup_catalog?.emoji}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{p.powerup_catalog?.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                        Usuario: {p.profiles?.username} · Liga: {p.leagues?.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-hint)' }}>
                        Expira: {p.expires_at ? formatTime(p.expires_at) : 'Nunca'}
                      </p>
                      {p.extra_data?.uses_left && (
                        <p className="text-xs text-amber-400">{p.extra_data.uses_left} usos restantes</p>
                      )}
                    </div>
                    <motion.button whileTap={{ scale: 0.9 }} onClick={() => deactivatePowerup(p)}
                      className="text-xs px-3 py-1.5 rounded-xl flex-shrink-0 bg-red-900 text-red-400">
                      Desactivar
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ── LOGS ── */}
        {section === 'logs' && (
          <motion.div {...fadeIn}>
            <div className="space-y-2">
              {logs.length === 0 ? (
                <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                  <div className="text-4xl mb-2">📋</div>
                  <p>Sin actividad registrada</p>
                </div>
              ) : logs.map(log => (
                <motion.div key={log.id} variants={staggerItem} initial="initial" animate="animate"
                  className="rounded-2xl p-3 flex items-start gap-3"
                  style={{ backgroundColor: 'var(--bg-card)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm"
                    style={{ backgroundColor: 'var(--bg-input)' }}>
                    {log.action.includes('DELETE') ? '🗑️' :
                     log.action.includes('BAN') ? '🚫' :
                     log.action.includes('EDIT') ? '✏️' :
                     log.action.includes('BALANCE') ? '🪙' : '⚙️'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold"
                      style={{ color: log.action.includes('DELETE') || log.action.includes('BAN') ? '#ef4444' : '#f59e0b' }}>
                      {log.action}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Por: {log.profiles?.username || 'Sistema'}
                    </p>
                    {Object.keys(log.details || {}).length > 0 && (
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>
                        {JSON.stringify(log.details)}
                      </p>
                    )}
                  </div>
                  <p className="text-xs flex-shrink-0" style={{ color: 'var(--text-hint)' }}>
                    {formatTime(log.created_at)}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}