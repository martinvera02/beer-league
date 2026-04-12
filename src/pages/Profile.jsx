import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { fadeIn, staggerItem, scaleIn } from '../lib/animations'
import { soundError, soundSuccess as soundOk } from '../lib/sounds'

export default function Profile() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const [profile, setProfile] = useState(null)
  const [stats, setStats] = useState(null)
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

  useEffect(() => { fetchProfile() }, [])

  const fetchProfile = async () => {
    const [{ data: profileData }, { data: drinksData }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      // Contar solo consumiciones únicas agrupando por drink_group_id
      supabase
        .from('drinks')
        .select('drink_group_id, points, drink_types(name, emoji)')
        .eq('user_id', user.id)
        .order('consumed_at', { ascending: false })
    ])

    setProfile(profileData)
    setNewUsername(profileData?.username || '')

    if (drinksData) {
      // Deduplicar por drink_group_id para no contar la misma consumición varias veces
      const seen = new Set()
      const unique = drinksData.filter(d => {
        if (seen.has(d.drink_group_id)) return false
        seen.add(d.drink_group_id)
        return true
      })

      const total = unique.reduce((sum, d) => sum + d.points, 0)
      const byType = unique.reduce((acc, d) => {
        const name = d.drink_types.name
        acc[name] = (acc[name] || 0) + 1
        return acc
      }, {})

      setStats({ total, count: unique.length, byType })
    }

    setLoading(false)
  }

  const showSuccess = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

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
    setUploadingAvatar(false)
    soundOk()
    showSuccess('Foto actualizada')
  }

  const handleChangeUsername = async () => {
    if (!newUsername.trim() || newUsername === profile?.username) return
    setSavingUsername(true)
    setError('')
    const { error } = await supabase.from('profiles').update({ username: newUsername.trim() }).eq('id', user.id)
    if (error) {
      soundError()
      setError(error.message.includes('unique') ? 'Ese nombre de usuario ya está en uso' : error.message)
    } else {
      setProfile(prev => ({ ...prev, username: newUsername.trim() }))
      soundOk()
      showSuccess('Nombre de usuario actualizado')
    }
    setSavingUsername(false)
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword !== confirmPassword) { soundError(); setError('Las contraseñas no coinciden'); return }
    if (newPassword.length < 6) { soundError(); setError('La contraseña debe tener al menos 6 caracteres'); return }
    setSavingPassword(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { soundError(); setError(error.message) } else {
      setNewPassword('')
      setConfirmPassword('')
      soundOk()
      showSuccess('Contraseña actualizada')
    }
    setSavingPassword(false)
  }

  const handleDeleteAccount = async () => {
    setDeleting(true)
    setError('')
    const { error } = await supabase.rpc('delete_user')
    if (error) { soundError(); setError('Error al eliminar la cuenta: ' + error.message); setDeleting(false); setShowDeleteConfirm(false); return }
    await logout()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center transition-colors duration-300" style={{ backgroundColor: 'var(--bg-base)' }}>
      <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen pb-24 px-4 pt-6 transition-colors duration-300" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      <div className="max-w-md mx-auto">

        <motion.div {...fadeIn} className="mb-6">
          <h1 className="text-2xl font-bold mb-4">
            {section === 'profile' ? 'Tu perfil 👤' : 'Ajustes ⚙️'}
          </h1>
          <div className="flex rounded-xl p-1" style={{ backgroundColor: 'var(--bg-input)' }}>
            {[
              { id: 'profile',  label: '👤 Perfil' },
              { id: 'settings', label: '⚙️ Ajustes' },
            ].map(s => (
              <button
                key={s.id}
                onClick={() => { setSection(s.id); setError(''); setSuccessMsg('') }}
                className="relative flex-1 py-2 rounded-lg text-sm font-medium transition-colors z-10"
                style={{ color: section === s.id ? '#fff' : 'var(--text-muted)' }}
              >
                {section === s.id && (
                  <motion.div
                    layoutId="profile-tab"
                    className="absolute inset-0 bg-amber-500 rounded-lg"
                    style={{ zIndex: -1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                {s.label}
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
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-amber-500" />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 flex items-center justify-center text-4xl" style={{ backgroundColor: 'var(--bg-input)', borderColor: 'var(--border)' }}>🍺</div>
                )}
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute bottom-0 right-0 bg-amber-500 hover:bg-amber-400 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm transition-colors"
                >
                  {uploadingAvatar ? '⏳' : '📷'}
                </motion.button>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
              </div>
              <p className="text-xl font-bold">{profile?.username}</p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-hint)' }}>
                {uploadingAvatar ? 'Subiendo...' : 'Toca 📷 para cambiar tu foto'}
              </p>
            </div>

            {stats && (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'Consumiciones', value: stats.count },
                    { label: 'Puntos totales', value: stats.total },
                  ].map(stat => (
                    <motion.div key={stat.label} variants={staggerItem} initial="initial" animate="animate" className="rounded-2xl p-4 text-center" style={{ backgroundColor: 'var(--bg-card)' }}>
                      <p className="text-3xl font-bold text-amber-400">{stat.value}</p>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="rounded-2xl p-4" style={{ backgroundColor: 'var(--bg-card)' }}>
                  <p className="text-sm font-medium mb-3" style={{ color: 'var(--text-muted)' }}>Desglose por bebida</p>
                  {Object.entries(stats.byType).length === 0 ? (
                    <p className="text-sm" style={{ color: 'var(--text-hint)' }}>Aún no has anotado nada</p>
                  ) : (
                    <div className="space-y-2">
                      {Object.entries(stats.byType).sort(([, a], [, b]) => b - a).map(([name, count]) => (
                        <div key={name} className="flex justify-between items-center">
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{name}</span>
                          <span className="text-amber-400 font-bold">{count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {/* ── AJUSTES ── */}
        {section === 'settings' && (
          <motion.div {...fadeIn} key="settings" className="space-y-4">

            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h2 className="text-base font-bold mb-4">✏️ Cambiar nombre de usuario</h2>
              <input
                type="text"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                placeholder="Nuevo nombre de usuario"
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm mb-3 transition-colors"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleChangeUsername}
                disabled={savingUsername || !newUsername.trim() || newUsername === profile?.username}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
                {savingUsername ? 'Guardando...' : 'Guardar nombre'}
              </motion.button>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)' }}>
              <h2 className="text-base font-bold mb-4">🔒 Cambiar contraseña</h2>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nueva contraseña"
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm mb-3 transition-colors"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repetir contraseña"
                className="w-full rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500 text-sm mb-3 transition-colors"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}
              />
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleChangePassword}
                disabled={savingPassword || !newPassword || !confirmPassword}
                className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
              >
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
                  <motion.button
                    key={t.id}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTheme(t.id)}
                    className="flex flex-col items-center gap-2 py-4 rounded-2xl text-sm font-medium transition-colors border-2"
                    style={{
                      borderColor: theme === t.id ? '#f59e0b' : 'var(--border)',
                      backgroundColor: theme === t.id ? 'rgba(245,158,11,0.1)' : 'var(--bg-input)',
                      color: theme === t.id ? '#f59e0b' : 'var(--text-muted)',
                    }}
                  >
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
                Esta acción es irreversible. Se borrarán todos tus datos, consumiciones y puntos.
              </p>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full bg-transparent hover:bg-red-950 text-red-500 hover:text-red-400 font-semibold py-3 rounded-xl border border-red-900 transition-colors text-sm"
              >
                Eliminar cuenta 🗑️
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showDeleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
            onClick={() => setShowDeleteConfirm(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              onClick={e => e.stopPropagation()}
              className="rounded-2xl p-6 w-full max-w-sm"
              style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
            >
              <div className="text-center mb-5">
                <div className="text-4xl mb-2">🗑️</div>
                <h2 className="text-xl font-bold">¿Eliminar cuenta?</h2>
                <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
                  Se borrarán todos tus datos, consumiciones y puntos de forma permanente. Esta acción no se puede deshacer.
                </p>
              </div>
              <div className="flex gap-3">
                <motion.button whileTap={{ scale: 0.96 }} onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                  className="flex-1 font-semibold py-3 rounded-xl transition-colors"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)' }}>
                  Cancelar
                </motion.button>
                <motion.button whileTap={{ scale: 0.96 }} onClick={handleDeleteAccount} disabled={deleting}
                  className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors">
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