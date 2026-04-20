import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { useNotifications } from '../context/NotificationsContext'
import { fadeIn, staggerItem, scaleIn } from '../lib/animations'
import { soundError, soundSuccess as soundOk } from '../lib/sounds'

export default function Profile() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { notifications, unreadCount, markAllRead, markRead } = useNotifications()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
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
  const fileInputRef = useRef(null)

  const PAGE_SIZE = 20

  useEffect(() => { fetchProfile() }, [])
  useEffect(() => {
    if (section === 'history' && history.length === 0) fetchHistory(0)
    if (section === 'notifications') markAllRead()
  }, [section])

  const fetchProfile = async () => {
    const [{ data: profileData }, { data: drinksData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('drinks').select('drink_group_id, points, drink_types(name, emoji)').eq('user_id', user.id)
    ])
    setProfile(profileData)
    setNewUsername(profileData?.username || '')
    if (drinksData) {
      const seen = new Set()
      const unique = drinksData.filter(d => {
        if (seen.has(d.drink_group_id)) return false
        seen.add(d.drink_group_id)
        return true
      })
      const total = unique.reduce((sum, d) => sum + (d.points || 0), 0)
      const byType = unique.reduce((acc, d) => {
        const name = d.drink_types?.name || 'Desconocido'
        const emoji = d.drink_types?.emoji || '🍺'
        if (!acc[name]) acc[name] = { count: 0, emoji }
        acc[name].count++
        return acc
      }, {})
      setStats({ total, count: unique.length, byType })
    }
    setLoading(false)
  }

  const fetchHistory = async (page) => {
    setLoadingHistory(true)
    const { data } = await supabase
      .from('drinks')
      .select('id, drink_group_id, points, consumed_at, drink_types(name, emoji), seasons(active), leagues(name)')
      .eq('user_id', user.id)
      .order('consumed_at', { ascending: false })

    if (!data) { setLoadingHistory(false); return }

    const grouped = {}
    data.forEach(d => {
      const key = d.drink_group_id
      if (!grouped[key]) {
        grouped[key] = {
          drink_group_id: key,
          points: d.points,
          consumed_at: d.consumed_at,
          drink_type: d.drink_types,
          leagues: [],
        }
      }
      if (d.leagues?.name) grouped[key].leagues.push(d.leagues.name)
    })

    const allUnique = Object.values(grouped).sort((a, b) => new Date(b.consumed_at) - new Date(a.consumed_at))
    const from = page * PAGE_SIZE
    const paginated = allUnique.slice(from, from + PAGE_SIZE)

    if (page === 0) setHistory(paginated)
    else setHistory(prev => [...prev, ...paginated])

    setHistoryHasMore(allUnique.length > from + PAGE_SIZE)
    setHistoryPage(page)
    setLoadingHistory(false)
  }

  const showSuccess = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 3000) }

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    setError('')
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

  const formatDate = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  }

  const formatNotifTime = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(mins / 60)
    const days = Math.floor(hours / 24)
    if (days > 0) return `hace ${days}d`
    if (hours > 0) return `hace ${hours}h`
    if (mins > 0) return `hace ${mins}m`
    return 'ahora'
  }

  const groupedHistory = history.reduce((groups, item) => {
    const date = formatDate(item.consumed_at)
    if (!groups[date]) groups[date] = []
    groups[date].push(item)
    return groups
  }, {})

  const getNotifStyle = (type) => {
    switch (type) {
      case 'powerup':  return { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444',  icon: '⚡' }
      case 'transfer': return { bg: 'rgba(16,185,129,0.1)',  color: '#10b981',  icon: '💸' }
      default:         return { bg: 'rgba(245,158,11,0.1)',  color: '#f59e0b',  icon: '🔔' }
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  const SECTIONS = [
    { id: 'profile',       label: '👤' },
    { id: 'history',       label: '🍺' },
    { id: 'notifications', label: '🔔', badge: unreadCount },
    { id: 'settings',      label: '⚙️' },
  ]

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 transition-colors duration-300"
      style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-md mx-auto">

        {/* Header */}
        <motion.div {...fadeIn} className="mb-6">
          <h1 className="text-2xl font-bold mb-4">
            {{ profile: 'Tu perfil 👤', history: 'Historial 🍺', notifications: 'Notificaciones 🔔', settings: 'Ajustes ⚙️' }[section]}
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
        {section === 'profile' && (
          <motion.div {...fadeIn} key="profile">
            <div className="rounded-2xl p-6 mb-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
              <div className="relative inline-block mb-3">
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-amber-500" />
                  : <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center text-4xl" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)' }}>🍺</div>}
                <motion.button whileTap={{ scale: 0.9 }} onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 bg-amber-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                  {uploadingAvatar ? '⏳' : '📷'}
                </motion.button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>
              <p className="text-xl font-bold">{profile?.username}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
            </div>

            {stats && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Consumiciones', value: stats.count },
                    { label: 'Puntos totales', value: stats.total },
                  ].map(stat => (
                    <motion.div key={stat.label} variants={staggerItem} initial="initial" animate="animate"
                      className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <p className="text-3xl font-bold text-amber-400">{stat.value}</p>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="rounded-2xl p-4 mb-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Desglose por bebida</p>
                  {Object.entries(stats.byType).length === 0
                    ? <p className="text-sm" style={{ color: 'var(--text-hint)' }}>Aún no has anotado nada</p>
                    : <div className="space-y-2">
                        {Object.entries(stats.byType).sort(([, a], [, b]) => b.count - a.count).map(([name, { count, emoji }]) => (
                          <div key={name} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xl">{emoji}</span>
                              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-1.5 rounded-full bg-amber-500 opacity-60"
                                style={{ width: `${Math.round((count / stats.count) * 80)}px` }} />
                              <span className="text-amber-400 font-bold text-sm">{count}</span>
                            </div>
                          </div>
                        ))}
                      </div>}
                </div>

                <div className="flex gap-2">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSection('history')}
                    className="flex-1 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                    🍺 Ver historial →
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSection('notifications')}
                    className="relative flex-1 py-3 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2"
                    style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                    🔔 Notificaciones →
                    {unreadCount > 0 && (
                      <span className="absolute top-2 right-2 min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-white font-black"
                        style={{ backgroundColor: '#ef4444', fontSize: 9 }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </motion.button>
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── HISTORIAL ── */}
        {section === 'history' && (
          <motion.div {...fadeIn} key="history">
            {stats && (
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <p className="text-xl font-bold text-amber-400">{stats.count}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Total</p>
                </div>
                <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <p className="text-xl font-bold text-amber-400">{stats.total}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Puntos</p>
                </div>
                <div className="rounded-2xl p-3 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <p className="text-xl font-bold text-amber-400">
                    {stats.count > 0 ? (stats.total / stats.count).toFixed(1) : '0'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-hint)' }}>Media pts</p>
                </div>
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
                        style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                        {date}
                      </span>
                      <div className="flex-1 h-px" style={{ backgroundColor: 'var(--border)' }} />
                    </div>
                    <div className="space-y-2">
                      {items.map(item => (
                        <motion.div key={item.drink_group_id} variants={staggerItem} initial="initial" animate="animate"
                          className="rounded-2xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--bg-card)' }}>
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                            style={{ backgroundColor: 'var(--bg-input)' }}>
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
                              {item.leagues.length > 2 && (
                                <span className="text-xs" style={{ color: 'var(--text-hint)' }}>+{item.leagues.length - 2}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`font-bold text-sm ${item.points > 0 ? 'text-amber-400' : 'text-red-400'}`}>
                              {item.points > 0 ? '+' : ''}{item.points} pts
                            </p>
                            <p className="text-xs" style={{ color: 'var(--text-hint)' }}>+{Math.floor(item.points * 10)}🪙</p>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}

                {historyHasMore && (
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => fetchHistory(historyPage + 1)}
                    disabled={loadingHistory}
                    className="w-full py-3 rounded-2xl text-sm font-medium mt-2"
                    style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                    {loadingHistory ? 'Cargando...' : 'Cargar más →'}
                  </motion.button>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── NOTIFICACIONES ── */}
        {section === 'notifications' && (
          <motion.div {...fadeIn} key="notifications">
            {notifications.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <div className="text-5xl mb-3">🔔</div>
                <p>Sin notificaciones todavía</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-hint)' }}>
                  Aquí aparecerán los powerups recibidos y transferencias
                </p>
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
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: style.bg }}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm truncate">{notif.title}</p>
                          {!notif.read && (
                            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: style.color }} />
                          )}
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
                {[
                  { id: 'dark',   label: 'Oscuro',  emoji: '🌙' },
                  { id: 'light',  label: 'Claro',   emoji: '☀️' },
                  { id: 'system', label: 'Sistema', emoji: '⚙️' },
                ].map(t => (
                  <motion.button key={t.id} whileTap={{ scale: 0.95 }} onClick={() => setTheme(t.id)}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl text-sm font-medium border-2"
                    style={{
                      borderColor: theme === t.id ? '#f59e0b' : 'var(--border)',
                      backgroundColor: theme === t.id ? 'rgba(245,158,11,0.1)' : 'var(--bg-input)',
                      color: theme === t.id ? '#f59e0b' : 'var(--text-muted)',
                    }}>
                    <span className="text-2xl">{t.emoji}</span>
                    <span>{t.label}</span>
                    {theme === t.id && <motion.div layoutId="theme-check" className="w-2 h-2 rounded-full bg-amber-400" />}
                  </motion.button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-5 border border-red-900" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h2 className="text-base font-bold text-red-400 mb-1">⚠️ Zona peligrosa</h2>
              <p className="text-xs mb-4" style={{ color: 'var(--text-hint)' }}>
                Esta acción es irreversible. Se borrarán todos tus datos.
              </p>
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
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                  Se borrarán todos tus datos de forma permanente.
                </p>
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